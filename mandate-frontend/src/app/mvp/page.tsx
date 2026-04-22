'use client';

import { useResourceBalances } from '@/hooks/chain/useResourceBalances';
import { useMvpMarket } from '@/hooks/useMvpMarket';
import { useMvpEpochChain } from '@/hooks/useMvpEpochChain';
import { formatRemaining } from '@/hooks/useMvpEpoch';
import { ResourceRow } from '@/components/mvp/ResourceRow';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import type { MvpResource } from '@/hooks/useMvpEvents';

const RESOURCES: readonly MvpResource[] = ['COMPUTE', 'CHIPS', 'DATA'];

export default function PortfolioPage() {
  const { walletAddress } = useAuth();
  const { balances, rateBalance, isLive } = useResourceBalances(
    walletAddress as `0x${string}` | undefined,
  );
  const { prices } = useMvpMarket();
  const { remainingMs, finalized, chainReady } = useMvpEpochChain();

  const resourceValue = RESOURCES.reduce((sum, r) => {
    const bal = balances?.[r] ?? 0;
    return sum + bal * prices[r].price;
  }, 0);
  const totalValue = rateBalance + resourceValue;

  return (
    <div className="pt-8">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-[0.15em] text-text-secondary">Portfolio</span>
        <span className="text-[11px] font-[family-name:var(--font-terminal)] text-text-tertiary">
          {isLive ? 'ON-CHAIN' : 'CACHED'}
        </span>
      </div>

      <div className="mt-3">
        <div className="text-4xl font-[family-name:var(--font-terminal)] tracking-tight">
          {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-text-secondary mt-1">RATE equivalent</div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] font-[family-name:var(--font-terminal)] text-text-secondary">
        <span>{finalized ? 'EPOCH ENDED' : 'EPOCH ENDS IN'}</span>
        <span className="text-moon-white">
          {!chainReady ? '…' : finalized ? 'finalized' : formatRemaining(remainingMs)}
        </span>
      </div>

      <div className="mt-8 border-t border-border-default/60">
        <div className="py-2 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-text-tertiary border-b border-border-default/60">
          <span>Resource</span>
          <span>Price · 24h</span>
        </div>
        {RESOURCES.map((r) => (
          <ResourceRow key={r} price={prices[r]} balance={balances?.[r] ?? 0} />
        ))}

        <div className="flex items-center justify-between py-3 border-b border-border-default/60">
          <span className="text-sm">RATE</span>
          <span className="text-sm font-[family-name:var(--font-terminal)]">
            {rateBalance.toFixed(2)}
          </span>
        </div>
      </div>

      <Link
        href="/mvp/mandate"
        className="mt-8 block w-full text-center py-3 border border-border-default rounded hover:bg-surface-1 text-sm transition-colors"
      >
        Edit mandate →
      </Link>

      {!walletAddress && (
        <p className="mt-4 text-xs text-text-tertiary text-center">
          Wallet not connected. Showing default player balances.
        </p>
      )}
    </div>
  );
}
