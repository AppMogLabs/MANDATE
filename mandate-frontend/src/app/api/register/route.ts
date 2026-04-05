import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { megaethTestnet } from '@/lib/wagmi-config';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import PlayerOnboardingABI from '@/lib/abis/PlayerOnboarding.json';
import AgentRegistryABI from '@/lib/abis/AgentRegistry.json';
import { createPublicClient } from 'viem';

const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;

/**
 * POST /api/register
 * Body: { playerAddress: string, role: number (0-4), agentURI?: string }
 *
 * Calls PlayerOnboarding.onboardPlayer() using the MANDATE operator wallet.
 * This is the backend relay that sponsors the registration transaction.
 */
export async function POST(request: NextRequest) {
  if (!OPERATOR_PRIVATE_KEY) {
    return NextResponse.json(
      { error: 'Server not configured: missing OPERATOR_PRIVATE_KEY' },
      { status: 500 },
    );
  }

  const onboardingAddress = TESTNET_ADDRESSES.contracts.playerOnboarding;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { playerAddress, role, agentURI } = body as {
    playerAddress: string;
    role: number;
    agentURI?: string;
  };

  // Validate inputs
  if (!playerAddress || !/^0x[a-fA-F0-9]{40}$/.test(playerAddress)) {
    return NextResponse.json({ error: 'Invalid player address' }, { status: 400 });
  }
  if (typeof role !== 'number' || role < 0 || role > 4) {
    return NextResponse.json({ error: 'Invalid role (must be 0-4)' }, { status: 400 });
  }

  // Check if already registered
  const publicClient = createPublicClient({
    chain: megaethTestnet,
    transport: http(),
  });

  const isRegistered = await publicClient.readContract({
    address: TESTNET_ADDRESSES.contracts.agentRegistry as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: 'isRegistered',
    args: [playerAddress],
  });

  if (isRegistered) {
    return NextResponse.json({ error: 'Player already registered' }, { status: 409 });
  }

  // Build and send the onboarding transaction
  const account = privateKeyToAccount(OPERATOR_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: megaethTestnet,
    transport: http(),
  });

  const uri = agentURI ?? JSON.stringify({
    name: `Agent-${playerAddress.slice(2, 8)}`,
    role: ['TalentHub', 'RegulatoryPower', 'DataSovereign', 'ComputeSuperpower', 'ChipsMagnate'][role],
    registeredAt: new Date().toISOString(),
  });

  try {
    const hash = await walletClient.sendTransaction({
      to: onboardingAddress as `0x${string}`,
      data: encodeFunctionData({
        abi: PlayerOnboardingABI,
        functionName: 'onboardPlayer',
        args: [playerAddress, role, uri],
      }),
    });

    // Don't wait for receipt — MegaETH's 10ms blocks make waitForTransactionReceipt
    // unreliable via viem. Return tx hash immediately; poll chain state for confirmation.
    // Brief delay to let the tx land before the frontend checks registration status.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Read the agent ID from chain (should be available after 2s on MegaETH)
    let agentId = 0;
    try {
      const id = await publicClient.readContract({
        address: TESTNET_ADDRESSES.contracts.agentRegistry as `0x${string}`,
        abi: AgentRegistryABI,
        functionName: 'agentIdOf',
        args: [playerAddress],
      });
      agentId = Number(id);
    } catch {
      // Agent ID read failed — tx may still be pending, return 0
    }

    return NextResponse.json({
      success: true,
      txHash: hash,
      agentId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Registration failed: ${message}` }, { status: 500 });
  }
}
