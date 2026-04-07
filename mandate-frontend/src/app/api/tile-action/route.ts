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
    // Pre-check tile ownership for better error messages
    let currentOwner: string | null = null;
    try {
      currentOwner = await publicClient.readContract({
        address: mapAddress,
        abi: MapRegistryABI,
        functionName: 'tileOwner',
        args: [tileId],
      }) as string;
    } catch {
      // tileOwner might not exist — try getTileInfo
      try {
        const tileInfo = await publicClient.readContract({
          address: mapAddress,
          abi: MapRegistryABI,
          functionName: 'getTileInfo',
          args: [tileId],
        }) as { owner: string };
        currentOwner = tileInfo.owner;
      } catch {
        // Can't read ownership — proceed and let the contract revert with details
      }
    }

    const zeroAddr = '0x0000000000000000000000000000000000000000';

    if (action === 'claim' && currentOwner && currentOwner.toLowerCase() !== zeroAddr) {
      if (currentOwner.toLowerCase() === account.address.toLowerCase()) {
        return NextResponse.json({
          error: 'You already own this tile. Try a different one.',
        }, { status: 400 });
      }
      const shortAddr = `${currentOwner.slice(0, 6)}...${currentOwner.slice(-4)}`;
      return NextResponse.json({
        error: `This tile is owned by ${shortAddr}. Choose an unclaimed tile.`,
      }, { status: 400 });
    }

    if (action === 'release' && currentOwner && currentOwner.toLowerCase() === zeroAddr) {
      return NextResponse.json({
        error: 'This tile is not owned — nothing to release.',
      }, { status: 400 });
    }

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
        data = encodeFunctionData({
          abi: MapRegistryABI,
          functionName: 'transferTileOwnership',
          args: [tileId, zeroAddr],
        });
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const hash = await walletClient.sendTransaction({
      to: mapAddress,
      data,
    });

    return NextResponse.json({
      success: true,
      txHash: hash,
      tileId,
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : 'Unknown error';

    // Parse common revert reasons into user-friendly messages
    if (raw.includes('already claimed') || raw.includes('already owned') || raw.includes('not available')) {
      return NextResponse.json({ error: 'This tile is already owned. Choose an unclaimed tile.' }, { status: 400 });
    }
    if (raw.includes('not registered')) {
      return NextResponse.json({ error: 'Your agent is not registered. Complete onboarding first.' }, { status: 400 });
    }
    if (raw.includes('not the owner') || raw.includes('not owner')) {
      return NextResponse.json({ error: 'You do not own this tile.' }, { status: 400 });
    }

    return NextResponse.json({ error: `Tile action failed: ${raw.slice(0, 150)}` }, { status: 500 });
  }
}
