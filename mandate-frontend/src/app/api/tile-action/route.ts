import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { megaethTestnet } from '@/lib/wagmi-config';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import MapRegistryABI from '@/lib/abis/MapRegistry.json';

const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;

function encodeTileId(q: number, r: number, gridOffset = 10): number {
  const x = q + gridOffset;
  const y = r + gridOffset;
  return ((x & 0xFFFF) << 16) | (y & 0xFFFF);
}

/**
 * POST /api/tile-action
 * Body: { action: 'claim' | 'release', q: number, r: number, playerAddress: string }
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

  const { action, q, r, playerAddress } = body as {
    action: string;
    q: number;
    r: number;
    playerAddress: string;
  };

  if (!action || typeof q !== 'number' || typeof r !== 'number' || !playerAddress) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const tileId = encodeTileId(q, r);
  const mapAddress = TESTNET_ADDRESSES.contracts.mapRegistry as `0x${string}`;

  const account = privateKeyToAccount(OPERATOR_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: megaethTestnet,
    transport: http(),
  });
  const publicClient = createPublicClient({
    chain: megaethTestnet,
    transport: http(),
  });

  try {
    let data: `0x${string}`;

    switch (action) {
      case 'claim':
        data = encodeFunctionData({
          abi: MapRegistryABI,
          functionName: 'claimTile',
          args: [tileId, playerAddress],
        });
        break;
      case 'release':
        // releaseTile doesn't exist in the ABI — use transferTileOwnership to zero address
        // Actually check the contract for the right function
        data = encodeFunctionData({
          abi: MapRegistryABI,
          functionName: 'transferTileOwnership',
          args: [tileId, '0x0000000000000000000000000000000000000000'],
        });
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const hash = await walletClient.sendTransaction({
      to: mapAddress,
      data,
    });

    // Don't wait for receipt — MegaETH's 10ms blocks make waitForTransactionReceipt
    // unreliable. Return the tx hash immediately; the frontend can poll chain state.
    return NextResponse.json({
      success: true,
      txHash: hash,
      tileId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Tile action failed: ${message}` }, { status: 500 });
  }
}
