'use client';

import { useResourceBalances, useEpochState } from '@/hooks/chain';
import { usePlayerBuildings } from '@/hooks/chain/usePlayerBuildings';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { computeAGIProgressScore, getProcessingChainStages, detectMilestones } from '@/lib/scoring';
import { useScoreHistory } from '@/hooks/useScoreHistory';
import type { PlayerBuilding } from '@/hooks/chain/usePlayerBuildings';

import { AGIScoreSection } from './AGIScoreSection';
import { RelativePositionSection } from './RelativePositionSection';
import { EpochProgressSection } from './EpochProgressSection';
import { RateBalanceSection } from './RateBalanceSection';
import { ProcessingChainViz } from './ProcessingChainViz';
import { ResourceSummaryBar } from './ResourceSummaryBar';
import { ReputationSection } from './ReputationSection';
import { MilestoneTracker } from './MilestoneTracker';

interface FeedbackPanelProps {
  walletAddress: string;
}

// TODO: Read totalSupply from contracts
const TOTAL_SUPPLIES: Record<string, number> = {
  COMPUTE: 1_000_000,
  ENERGY: 1_000_000,
  CHIPS: 1_000_000,
  COOLING: 1_000_000,
  TALENT: 1_000_000,
  DATA: 1_000_000,
  CLEARANCE: 1_000_000,
};

// Default epoch duration: 30 days in seconds
const DEFAULT_EPOCH_DURATION = 30 * 24 * 60 * 60;

export function FeedbackPanel({ walletAddress }: FeedbackPanelProps) {
  const { balances, rateBalance } = useResourceBalances(walletAddress as `0x${string}`);
  const { buildings } = usePlayerBuildings(walletAddress);
  const { epochNumber, timeRemaining } = useEpochState();
  const { entries } = useActivityFeed(walletAddress);

  const hasTraded = entries.length > 0;
  const epochDaysRemaining = timeRemaining / 86400;

  const score = balances
    ? computeAGIProgressScore({
        resourceBalances: balances,
        totalSupplies: TOTAL_SUPPLIES,
        buildings: buildings.map((b: PlayerBuilding) => ({ buildingType: b.buildingType, tier: b.tier })),
        reputationScore: 0,
        subscriptionTier: 0,
        echoReliability: 0,
      })
    : null;

  const { delta24h, sparkline } = useScoreHistory(score, rateBalance);

  const stages = getProcessingChainStages(
    buildings.map((b: PlayerBuilding) => ({ buildingType: b.buildingType })),
  );

  const milestones = detectMilestones(
    buildings.map((b: PlayerBuilding) => ({ buildingType: b.buildingType })),
    hasTraded,
    epochDaysRemaining,
  );

  // TODO: Wire useReputation hook
  const reputationScore: number | null = null;
  const isTopTwentyPercent: boolean | null = null;

  // TODO: Wire useAllAgentScores for leaderboard
  const leaderboard = { rank: 1, totalAgents: 1, gapAbove: null as number | null, gapBelow: null as number | null };

  return (
    <div className="h-full overflow-y-auto space-y-3 p-3 font-dashboard">
      <AGIScoreSection
        total={score?.total ?? 0}
        resources={score?.resources ?? 0}
        buildings={score?.buildings ?? 0}
        intelligence={score?.intelligence ?? 0}
        chain={score?.chain ?? 0}
        delta24h={delta24h}
        sparkline={sparkline}
      />

      <div className="border-t border-border-default pt-3">
        <RelativePositionSection
          rank={leaderboard.rank}
          totalAgents={leaderboard.totalAgents}
          gapAbove={leaderboard.gapAbove}
          gapBelow={leaderboard.gapBelow}
        />
      </div>

      <div className="border-t border-border-default pt-3">
        <EpochProgressSection
          epochNumber={epochNumber}
          timeRemainingSeconds={timeRemaining}
          epochDurationSeconds={DEFAULT_EPOCH_DURATION}
        />
      </div>

      <div className="border-t border-border-default pt-3">
        <RateBalanceSection
          balance={rateBalance}
          delta24h={null}
        />
      </div>

      <div className="border-t border-border-default pt-3">
        <ProcessingChainViz stages={stages} />
      </div>

      <div className="border-t border-border-default pt-3">
        <ResourceSummaryBar balances={balances ?? {}} />
      </div>

      <div className="border-t border-border-default pt-3">
        <ReputationSection
          score={reputationScore}
          isTopTwentyPercent={isTopTwentyPercent}
        />
      </div>

      <div className="border-t border-border-default pt-3">
        <MilestoneTracker milestones={milestones} />
      </div>
    </div>
  );
}
