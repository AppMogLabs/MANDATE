import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, encodeFunctionData, parseUnits } from 'viem';
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
