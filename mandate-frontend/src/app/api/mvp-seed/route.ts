import { NextRequest, NextResponse } from 'next/server';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  isAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { megaethTestnet } from '@/lib/wagmi-config';
import { TESTNET_ADDRESSES } from '@/lib/addresses';

const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY as `0x${string}` | undefined;

// Starting kit for new MVP players. Transferred once per address from the
// operator wallet on first /mvp/mandate save. Idempotent: if the player
// already has >= SEED_THRESHOLD RATE we skip.
const SEED_RATE = parseUnits('10000', 18);
const SEED_RESOURCE = parseUnits('500', 18);
const SEED_THRESHOLD = parseUnits('1', 18); // anyone with <1 RATE is treated as new

const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

export async function POST(request: NextRequest) {
  if (!OPERATOR_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  let body: { player?: string };
  try {
    body = (await request.json()) as { player?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const player = body.player;
  if (!player || !isAddress(player)) {
    return NextResponse.json({ error: 'Invalid player address' }, { status: 400 });
  }

  const publicClient = createPublicClient({ chain: megaethTestnet, transport: http() });

  // Idempotency — skip if already seeded
  const currentRate = (await publicClient.readContract({
    address: TESTNET_ADDRESSES.contracts.rateToken as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [player as `0x${string}`],
  })) as bigint;

  if (currentRate >= SEED_THRESHOLD) {
    return NextResponse.json({
      ok: true,
      alreadySeeded: true,
      rateBalance: formatUnits(currentRate, 18),
    });
  }

  const account = privateKeyToAccount(OPERATOR_PRIVATE_KEY);
  const walletClient = createWalletClient({
    account,
    chain: megaethTestnet,
    transport: http(),
  });

  const tokens: Array<{ name: string; address: `0x${string}`; amount: bigint }> = [
    { name: 'RATE', address: TESTNET_ADDRESSES.contracts.rateToken as `0x${string}`, amount: SEED_RATE },
    { name: 'COMPUTE', address: TESTNET_ADDRESSES.contracts.resources.COMPUTE as `0x${string}`, amount: SEED_RESOURCE },
    { name: 'CHIPS', address: TESTNET_ADDRESSES.contracts.resources.CHIPS as `0x${string}`, amount: SEED_RESOURCE },
    { name: 'DATA', address: TESTNET_ADDRESSES.contracts.resources.DATA as `0x${string}`, amount: SEED_RESOURCE },
  ];

  const txHashes: Record<string, string> = {};

  for (const t of tokens) {
    try {
      const hash = await walletClient.writeContract({
        address: t.address,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [player as `0x${string}`, t.amount],
      });
      txHashes[t.name] = hash;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Seed transfer failed for ${t.name}: ${msg}`, partial: txHashes },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, alreadySeeded: false, txHashes });
}
