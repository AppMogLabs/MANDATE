import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseUnits, formatUnits, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { megaethTestnet } from '@/lib/wagmi-config';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import OrderBookABI from '@/lib/abis/OrderBook.json';
import BuildingRegistryABI from '@/lib/abis/BuildingRegistry.json';

const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;
const RESOURCE_ADDRS = TESTNET_ADDRESSES.contracts.resources;

/**
 * POST /api/agent-action
 * Submits approved agent actions on-chain.
 *
 * For testnet: uses the operator/deployer wallet (agent ID 1) which has full
 * allowlist and token balances. The frontend reads this wallet's balances to
 * show trade results.
 *
 * For production: would use the player's own embedded wallet via Privy signing.
 *
 * Body: { actionType, params }
 */
export async function POST(request: NextRequest) {
  if (!OPERATOR_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { actionType, params } = body as {
    actionType: string;
    params: Record<string, unknown>;
  };

  if (!actionType || !params) {
    return NextResponse.json({ error: 'Missing actionType or params' }, { status: 400 });
  }

  const account = privateKeyToAccount(OPERATOR_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: megaethTestnet,
    transport: http(),
  });

  try {
    let to: `0x${string}`;
    let data: `0x${string}`;
    let description: string;

    switch (actionType) {
      case 'ORDER_PLACE': {
        const resource = params.resource as string;
        const amount = params.amount as number;
        const price = params.price as number;
        const resourceAddr = RESOURCE_ADDRS[resource as keyof typeof RESOURCE_ADDRS];
        if (!resourceAddr || !amount || !price) {
          return NextResponse.json({ error: 'Missing resource/amount/price' }, { status: 400 });
        }

        to = TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`;
        data = encodeFunctionData({
          abi: OrderBookABI,
          functionName: 'placeOrder',
          args: [resourceAddr, parseUnits(amount.toString(), 18), parseUnits(price.toFixed(4), 18)],
        });
        description = `SELL ${amount} ${resource} @ ${price.toFixed(4)} RATE`;
        break;
      }

      case 'ORDER_MATCH': {
        const orderId = params.orderId as number;
        const fillAmount = (params.fillAmount ?? params.amount) as number;
        if (orderId === undefined || !fillAmount) {
          return NextResponse.json({ error: 'Missing orderId/fillAmount' }, { status: 400 });
        }

        to = TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`;
        data = encodeFunctionData({
          abi: OrderBookABI,
          functionName: 'matchOrder',
          args: [BigInt(orderId), parseUnits(fillAmount.toString(), 18)],
        });
        description = `MATCH order #${orderId} fill ${fillAmount}`;
        break;
      }

      case 'ORDER_CANCEL': {
        const orderId = params.orderId as number;
        if (orderId === undefined) {
          return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
        }

        to = TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`;
        data = encodeFunctionData({
          abi: OrderBookABI,
          functionName: 'cancelOrder',
          args: [BigInt(orderId)],
        });
        description = `CANCEL order #${orderId}`;
        break;
      }

      case 'CLAIM_PRODUCTION': {
        const tokenId = (params.buildingId ?? params.tokenId) as number;
        if (tokenId === undefined) {
          return NextResponse.json({ error: 'Missing tokenId' }, { status: 400 });
        }

        to = TESTNET_ADDRESSES.contracts.buildingRegistry as `0x${string}`;
        data = encodeFunctionData({
          abi: BuildingRegistryABI,
          functionName: 'claimProduction',
          args: [BigInt(tokenId)],
        });
        description = `CLAIM production #${tokenId}`;
        break;
      }

      case 'CONSTRUCT_BUILDING': {
        const buildingType = params.buildingType as number;
        const tileId = params.tileId as number;
        const agent = params.agent as string | undefined;
        if (buildingType === undefined || tileId === undefined) {
          return NextResponse.json({ error: 'Missing buildingType/tileId' }, { status: 400 });
        }

        to = TESTNET_ADDRESSES.contracts.buildingRegistry as `0x${string}`;
        data = encodeFunctionData({
          abi: BuildingRegistryABI,
          functionName: 'construct',
          args: [buildingType, tileId, (agent ?? account.address) as `0x${string}`],
        });
        description = `CONSTRUCT building type ${buildingType} on tile ${tileId}`;
        break;
      }

      case 'INITIATE_UPGRADE': {
        const tokenId = params.tokenId as number;
        if (tokenId === undefined) {
          return NextResponse.json({ error: 'Missing tokenId' }, { status: 400 });
        }

        to = TESTNET_ADDRESSES.contracts.buildingRegistry as `0x${string}`;
        data = encodeFunctionData({
          abi: BuildingRegistryABI,
          functionName: 'initiateUpgrade',
          args: [BigInt(tokenId)],
        });
        description = `UPGRADE building #${tokenId}`;
        break;
      }

      case 'ORDER_BUY': {
        // Buy = find the cheapest active sell order for this resource and match it
        const resource = params.resource as string;
        const amount = params.amount as number;
        const maxPrice = params.maxPrice as number;
        const resourceAddr = RESOURCE_ADDRS[resource as keyof typeof RESOURCE_ADDRS];
        if (!resourceAddr || !amount) {
          return NextResponse.json({ error: 'Missing resource/amount' }, { status: 400 });
        }

        const publicClient = createPublicClient({ chain: megaethTestnet, transport: http() });

        // Discover active sell orders via events — look back far enough to find all orders
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > 5_000_000n ? currentBlock - 5_000_000n : 0n;

        // Fetch ALL OrderPlaced events (not filtered by resource — indexed topic matching can be unreliable)
        const placedLogs = await publicClient.getLogs({
          address: TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`,
          event: parseAbiItem('event OrderPlaced(uint256 indexed orderId, address indexed seller, address indexed resourceToken, uint256 amount, uint256 pricePerUnit)'),
          fromBlock,
          toBlock: currentBlock,
        });

        // Collect ALL order IDs — we'll filter by resource when reading the order state
        const allOrderIds = [...new Set(
          placedLogs.map(log => Number(log.args.orderId)).filter((id): id is number => !isNaN(id))
        )].slice(-100);

        // Read order state and find active orders for this resource
        type ActiveOrder = { orderId: number; remaining: number; price: number };
        const candidates: ActiveOrder[] = [];

        for (const id of allOrderIds) {
          try {
            const orderData = await publicClient.readContract({
              address: TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`,
              abi: OrderBookABI,
              functionName: 'orders',
              args: [BigInt(id)],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any) as readonly [bigint, string, string, bigint, bigint, bigint, number, bigint];

            const [, , resourceToken, totalAmount, filledAmount, pricePerUnit, status] = orderData;

            // Check: active, correct resource, not fully filled
            if (
              status === 1 &&
              totalAmount > filledAmount &&
              (resourceToken as string).toLowerCase() === resourceAddr.toLowerCase()
            ) {
              const price = Number(formatUnits(pricePerUnit, 18));
              const remaining = Number(formatUnits(totalAmount - filledAmount, 18));
              if (maxPrice === 0 || price <= maxPrice) {
                candidates.push({ orderId: id, remaining, price });
              }
            }
          } catch {
            // skip
          }
        }

        if (candidates.length === 0) {
          return NextResponse.json({
            error: `No sell orders found for ${resource}${maxPrice ? ` at or below ${maxPrice} RATE` : ''}. Found ${allOrderIds.length} total orders on-chain.`,
          }, { status: 400 });
        }

        // Sort by price ascending (cheapest first)
        candidates.sort((a, b) => a.price - b.price);
        const best = candidates[0];
        const fillAmount = Math.min(amount, best.remaining);

        to = TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`;
        data = encodeFunctionData({
          abi: OrderBookABI,
          functionName: 'matchOrder',
          args: [BigInt(best.orderId), parseUnits(fillAmount.toString(), 18)],
        });
        description = `BUY ${fillAmount} ${resource} @ ${best.price.toFixed(4)} RATE (order #${best.orderId})`;
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${actionType}` }, { status: 400 });
    }

    const hash = await walletClient.sendTransaction({ to, data });

    return NextResponse.json({
      success: true,
      txHash: hash,
      description,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message.slice(0, 200) : 'Unknown error';
    return NextResponse.json({ error: `Action failed: ${message}` }, { status: 500 });
  }
}
