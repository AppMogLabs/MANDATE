'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useReadContract } from 'wagmi';
import { keccak256, toBytes } from 'viem';
import { useMvpMandate, MVP_MANDATE_MAX } from '@/hooks/useMvpMandate';
import { useMvpAgent } from '../MvpAgentProvider';
import { useAuth } from '@/hooks/useAuth';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import { mvpEpochAbi } from '@/lib/abis/MvpEpoch';

const MVP_EPOCH = TESTNET_ADDRESSES.contracts.mvpEpoch as `0x${string}`;

function formatAgo(ts: number | null): string {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function MandatePage() {
  const { mandate, savedAt, save } = useMvpMandate();
  const { lifecycle, deploy } = useMvpAgent();
  const { walletAddress } = useAuth();
  const [draft, setDraft] = useState(mandate);
  const [justSaved, setJustSaved] = useState(false);

  const { data: registered } = useReadContract({
    address: MVP_EPOCH,
    abi: mvpEpochAbi,
    functionName: 'registered',
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    query: { enabled: !!walletAddress, refetchInterval: 20_000 },
  });
  const { writeContract, isPending: committing } = useWriteContract();

  useEffect(() => {
    setDraft(mandate);
  }, [mandate]);

  const dirty = draft !== mandate;
  const remaining = MVP_MANDATE_MAX - draft.length;
  const lastSitrep = lifecycle.agent.latestSitrep;
  const lastAction = lifecycle.submittedActions[lifecycle.submittedActions.length - 1];

  const handleSave = () => {
    save(draft);
    deploy(draft);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);

    // Commit mandate hash on-chain. Uses register() for first save, which is
    // idempotent so it also works as an update; writeContract handles both.
    if (walletAddress) {
      const hash = keccak256(toBytes(draft));
      writeContract({
        address: MVP_EPOCH,
        abi: mvpEpochAbi,
        functionName: registered ? 'updateMandate' : 'register',
        args: [hash],
      });
    }
  };

  const statusLabel: Record<typeof lifecycle.agent.status, string> = {
    idle: 'awaiting deployment',
    running: 'running',
    paused: 'paused',
    error: 'error',
  };

  return (
    <div className="pt-8">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-[0.15em] text-text-secondary">Mandate</span>
        <span className="text-[11px] font-[family-name:var(--font-terminal)] text-text-tertiary">
          SAVED {formatAgo(savedAt)}
        </span>
      </div>

      <p className="mt-3 text-sm text-text-secondary leading-relaxed">
        Instructions for your autonomous trading agent. Natural language. The agent
        reads market prices and your holdings every tick and decides what to do.
      </p>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, MVP_MANDATE_MAX))}
        rows={10}
        spellCheck={false}
        className="mt-5 w-full bg-surface-1 border border-border-default rounded p-3 text-sm leading-relaxed font-[family-name:var(--font-terminal)] resize-none focus:outline-none focus:border-border-focus"
      />

      <div className="mt-2 flex items-center justify-between text-[11px] font-[family-name:var(--font-terminal)] text-text-tertiary">
        <span>{draft.length} / {MVP_MANDATE_MAX}</span>
        <span className={remaining < 50 ? 'text-status-warning' : undefined}>
          {remaining} remaining
        </span>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty || committing}
        className="mt-6 w-full py-3 border border-moon-white text-sm tracking-wide uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-moon-white hover:text-night-sky transition-colors"
      >
        {committing ? 'Committing on-chain…' : justSaved ? 'Deployed' : dirty ? 'Deploy mandate' : 'Mandate active'}
      </button>

      {walletAddress && (
        <p className="mt-2 text-[10px] font-[family-name:var(--font-terminal)] text-text-tertiary text-center">
          {registered ? 'REGISTERED ON-CHAIN' : 'Saving will register you for the epoch'}
        </p>
      )}

      <div className="mt-8 border-t border-border-default/60 pt-4 space-y-4 font-[family-name:var(--font-terminal)]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-text-tertiary mb-1">
            Agent status
          </div>
          <div className="text-xs text-moon-white">
            {statusLabel[lifecycle.agent.status]}
            <span className="text-text-tertiary ml-2">· tick #{lifecycle.agent.tickNumber}</span>
          </div>
        </div>

        {lastSitrep && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-text-tertiary mb-1">
              Last sitrep
            </div>
            <p className="text-xs text-text-secondary leading-snug">{lastSitrep.summary}</p>
          </div>
        )}

        {lastAction && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-text-tertiary mb-1">
              Last action
            </div>
            <p className="text-xs text-text-secondary break-words">
              {lastAction.description}
              {lastAction.txHash && (
                <span className="text-text-tertiary ml-2">
                  · {lastAction.txHash.slice(0, 10)}…
                </span>
              )}
              {lastAction.error && (
                <span className="text-status-critical ml-2">· {lastAction.error}</span>
              )}
            </p>
          </div>
        )}

        {lifecycle.agent.error && (
          <div className="text-xs text-status-critical">{lifecycle.agent.error}</div>
        )}
      </div>
    </div>
  );
}
