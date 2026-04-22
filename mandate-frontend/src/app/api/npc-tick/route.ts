import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, encodeFunctionData, formatUnits, parseUnits, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { megaethTestnet } from '@/lib/wagmi-config';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import { NPC_AGENTS } from '@/lib/npc-agents';
import { determineNPCActions, type MarketState } from '@/lib/npc-personality';
import OrderBookABI from '@/lib/abis/OrderBook.json';
import { erc20Abi } from 'viem';

const NPC_ENGINE_SECRET = process.env.NPC_ENGINE_SECRET;
const NPC_KEYS = [
  process.env.NPC_PK_0,
  process.env.NPC_PK_1,
  process.env.NPC_PK_2,
  process.env.NPC_PK_3,
  process.env.NPC_PK_4,
];

const ORDER_BOOK = TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`;
const RATE_TOKEN = TESTNET_ADDRESSES.contracts.rateToken as `0x${string}`;
const RESOURCES = TESTNET_ADDRESSES.contracts.resources;

const publicClient = createPublicClient({
  chain: megaethTestnet,
  transport: http(),
});

// Track tick number
let tickCount = 0;

/**
 * POST /api/npc-tick
 * Executes one NPC cycle. Each NPC evaluates market and places/matches orders.
 * Protected by NPC_ENGINE_SECRET bearer token.
 */
export async function POST(request: NextRequest) {
  // Auth check
  const auth = request.headers.get('authorization');
  if (!NPC_ENGINE_SECRET || auth !== `Bearer ${NPC_ENGINE_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  tickCount++;
  const results: Array<{ npc: string; actions: string[] }> = [];

  for (let i = 0; i < 5; i++) {
    const npc = NPC_AGENTS[i];
    const pk = NPC_KEYS[i];
    if (!pk) continue;

    try {
      // Read NPC's balances
      const state = await readNPCState(npc.address);

      // Determine actions
      const actions = determineNPCActions(npc, state, tickCount);
      const actionResults: string[] = [];

      if (actions.length === 0) {
        results.push({ npc: npc.name, actions: ['Skipped (no action needed)'] });
        continue;
      }

      // Execute actions
      const account = privateKeyToAccount(pk as `0x${string}`);
      const walletClient = createWalletClient({
        account,
        chain: megaethTestnet,
        transport: http(),
      });

      for (const action of actions) {
        try {
          if (action.type === 'PLACE_ORDER' && action.resource && action.amount && action.price) {
            const resourceAddr = RESOURCES[action.resource as keyof typeof RESOURCES] as `0x${string}`;
            if (!resourceAddr) continue;

            const hash = await walletClient.sendTransaction({
              to: ORDER_BOOK,
              data: encodeFunctionData({
                abi: OrderBookABI,
                functionName: 'placeOrder',
                args: [
                  resourceAddr,
                  parseUnits(action.amount.toString(), 18),
                  parseUnits(action.price.toFixed(4), 18),
                ],
              }),
            });
            actionResults.push(`SELL ${action.amount} ${action.resource} @ ${action.price.toFixed(4)} RATE (tx: ${hash.slice(0, 10)}...)`);
          }

          if (action.type === 'MATCH_ORDER' && action.orderId !== undefined && action.fillAmount) {
            const hash = await walletClient.sendTransaction({
              to: ORDER_BOOK,
              data: encodeFunctionData({
                abi: OrderBookABI,
                functionName: 'matchOrder',
                args: [
                  BigInt(action.orderId),
                  parseUnits(action.fillAmount.toString(), 18),
                ],
              }),
            });
            actionResults.push(`MATCH order #${action.orderId} fill ${action.fillAmount} (tx: ${hash.slice(0, 10)}...)`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message.slice(0, 80) : 'error';
          actionResults.push(`FAILED: ${msg}`);
        }
      }

      results.push({ npc: npc.name, actions: actionResults });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.slice(0, 80) : 'error';
      results.push({ npc: npc.name, actions: [`Error reading state: ${msg}`] });
    }
  }

  return NextResponse.json({ tick: tickCount, results });
}

// ── Read NPC chain state ──────────────────────────────────────────────────────

async function readNPCState(npcAddress: string): Promise<MarketState> {
  const addr = npcAddress as `0x${string}`;

  // Read RATE balance
  const rateBal = await publicClient.readContract({
    address: RATE_TOKEN,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [addr],
  });

  // Read resource balances
  const balances: Record<string, number> = {};
  for (const [name, tokenAddr] of Object.entries(RESOURCES)) {
    const bal = await publicClient.readContract({
      address: tokenAddr as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [addr],
    });
    balances[name] = Number(formatUnits(bal, 18));
  }

  // Discover active orders via events instead of hardcoded range
  const currentBlock = await publicClient.getBlockNumber();
  const fromBlock = currentBlock > 500_000n ? currentBlock - 500_000n : 0n;

  const placedLogs = await publicClient.getLogs({
    address: ORDER_BOOK,
    event: parseAbiItem('event OrderPlaced(uint256 indexed orderId, address indexed seller, address indexed resourceToken, uint256 amount, uint256 pricePerUnit)'),
    fromBlock,
    toBlock: currentBlock,
  });

  // Get unique order IDs (most recent 50)
  const orderIds = [...new Set(placedLogs.map(log => Number(log.args.orderId)))].slice(-50);

  const activeOrders: MarketState['activeOrders'] = [];
  for (const id of orderIds) {
    try {
      const orderData = await publicClient.readContract({
        address: ORDER_BOOK,
        abi: OrderBookABI,
        functionName: 'orders',
        args: [BigInt(id)],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as readonly [bigint, string, string, bigint, bigint, bigint, number, bigint];

      const [, seller, resourceToken, totalAmount, filledAmount, pricePerUnit, status] = orderData;
      if (status === 0 && totalAmount > filledAmount) {
        const remaining = Number(formatUnits(totalAmount - filledAmount, 18));
        const price = Number(formatUnits(pricePerUnit, 18));
        const resource = Object.entries(RESOURCES).find(
          ([, a]) => a.toLowerCase() === resourceToken.toLowerCase()
        )?.[0] ?? 'UNKNOWN';

        activeOrders.push({ orderId: id, seller, resource, amount: remaining, price });
      }
    } catch {
      // Order doesn't exist or read failed
    }
  }

  return {
    balances,
    rateBalance: Number(formatUnits(rateBal, 18)),
    activeOrders,
  };
}

/**
 * GET /api/npc-tick — health check / manual trigger info
 */
export async function GET() {
  return NextResponse.json({
    status: 'NPC engine ready',
    tick: tickCount,
    npcs: NPC_AGENTS.map((n) => n.name),
  });
}
