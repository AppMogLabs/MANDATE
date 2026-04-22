'use client';

import { useReadContracts, useWriteContract } from 'wagmi';
import { formatUnits } from 'viem';
import { useMemo } from 'react';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import { mvpEpochAbi } from '@/lib/abis/MvpEpoch';
import { NPC_AGENTS } from '@/lib/npc-agents';
import { useAuth } from '@/hooks/useAuth';
import { useMvpEpochChain } from '@/hooks/useMvpEpochChain';

const MVP_EPOCH = TESTNET_ADDRESSES.contracts.mvpEpoch as `0x${string}`;

interface Row {
  readonly address: string;
  readonly name: string;
  readonly isPlayer: boolean;
  readonly value: number;
  readonly finalScore: number | null;
}

export default function LeaderboardPage() {
  const { walletAddress } = useAuth();
  const { finalized, remainingMs, chainReady } = useMvpEpochChain();

  const participants = useMemo(() => {
    const rows = NPC_AGENTS.map((a) => ({
      address: a.address,
      name: a.name,
      isPlayer: false,
    }));
    if (walletAddress) {
      rows.push({ address: walletAddress, name: 'You', isPlayer: true });
    }
    return rows;
  }, [walletAddress]);

  // Read currentValue + finalScore for every participant in a single batch
  const contracts = useMemo(
    () =>
      participants.flatMap((p) => [
        {
          address: MVP_EPOCH,
          abi: mvpEpochAbi,
          functionName: 'currentValue' as const,
          args: [p.address as `0x${string}`] as const,
        },
        {
          address: MVP_EPOCH,
          abi: mvpEpochAbi,
          functionName: 'finalScore' as const,
          args: [p.address as `0x${string}`] as const,
        },
      ]),
    [participants],
  );

  const { data } = useReadContracts({
    contracts,
    query: { refetchInterval: 10_000, enabled: contracts.length > 0 },
  });

  const standings: Row[] = useMemo(() => {
    if (!data) return participants.map((p) => ({ ...p, value: 0, finalScore: null }));
    return participants
      .map((p, i) => {
        const cv = data[i * 2]?.result;
        const fs = data[i * 2 + 1]?.result;
        const value = typeof cv === 'bigint' ? Number(formatUnits(cv, 18)) : 0;
        const finalScore = typeof fs === 'bigint' && fs > 0n ? Number(formatUnits(fs, 18)) : null;
        return { ...p, value, finalScore };
      })
      .sort((a, b) => {
        const av = a.finalScore ?? a.value;
        const bv = b.finalScore ?? b.value;
        return bv - av;
      });
  }, [data, participants]);

  const { writeContract, isPending: finalizing } = useWriteContract();
  // Only show Finalize button once we've confirmed epoch state from chain.
  const readyToFinalize = chainReady && remainingMs === 0 && !finalized;

  const handleFinalize = () => {
    writeContract({
      address: MVP_EPOCH,
      abi: mvpEpochAbi,
      functionName: 'finalize',
      args: [],
    });
  };

  return (
    <div className="pt-8">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-[0.15em] text-text-secondary">Standings</span>
        <span className="text-[11px] font-[family-name:var(--font-terminal)] text-text-tertiary">
          {finalized ? 'FINAL' : `${standings.length} ACTIVE`}
        </span>
      </div>

      <div className="mt-5 font-[family-name:var(--font-terminal)]">
        <div className="grid grid-cols-[auto_1fr_auto] gap-3 text-[10px] uppercase tracking-[0.15em] text-text-tertiary py-2 border-b border-border-default/60">
          <span>#</span>
          <span>Agent</span>
          <span className="text-right">Portfolio</span>
        </div>

        {standings.map((row, i) => {
          const displayValue = row.finalScore ?? row.value;
          return (
            <div
              key={row.address}
              className={`grid grid-cols-[auto_1fr_auto] gap-3 py-3 border-b border-border-default/40 text-sm ${
                row.isPlayer ? 'bg-surface-1/60 -mx-4 px-4' : ''
              }`}
            >
              <span className="text-text-tertiary tabular-nums w-5">{i + 1}</span>
              <span className={row.isPlayer ? 'text-moon-white' : 'text-text-primary'}>
                {row.name}
                {row.isPlayer && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-status-info">you</span>
                )}
              </span>
              <span className="text-right tabular-nums">
                {displayValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                <span className="ml-1 text-[10px] text-text-tertiary">RATE</span>
              </span>
            </div>
          );
        })}
      </div>

      {readyToFinalize && (
        <button
          type="button"
          onClick={handleFinalize}
          disabled={finalizing}
          className="mt-6 w-full py-3 border border-moon-white text-sm tracking-wide uppercase disabled:opacity-30 hover:bg-moon-white hover:text-night-sky transition-colors"
        >
          {finalizing ? 'Finalizing…' : 'Finalize epoch'}
        </button>
      )}

      <p className="mt-6 text-[11px] text-text-tertiary text-center leading-relaxed">
        {finalized
          ? 'Epoch finalized on-chain. Final scores snapshotted from OrderBook spot prices.'
          : 'Ranked by on-chain balances × live spot prices via MvpEpoch.currentValue().'}
      </p>
    </div>
  );
}
