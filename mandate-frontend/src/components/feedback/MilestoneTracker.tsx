'use client';

interface Milestone {
  id: string;
  label: string;
  reward: number;
  completed: boolean;
  inProgress?: string;
}

interface MilestoneTrackerProps {
  milestones: Milestone[];
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function MilestoneTracker({ milestones }: MilestoneTrackerProps) {
  const earned = milestones
    .filter((m) => m.completed)
    .reduce((sum, m) => sum + m.reward, 0);
  const totalReward = milestones.reduce((sum, m) => sum + m.reward, 0);

  // Incomplete first (sorted by reward desc), then completed (dimmed)
  const sorted = [...milestones].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return b.reward - a.reward;
  });

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-terminal text-[10px] text-text-tertiary uppercase tracking-wider">
          Milestones
        </span>
        <span className="font-terminal text-[10px] text-text-secondary tabular-nums">
          Earned: {formatNumber(earned)} / {formatNumber(totalReward)} RATE
        </span>
      </div>

      <div className="space-y-0.5">
        {sorted.map((m) => (
          <div key={m.id} className="flex items-center gap-1.5 font-terminal text-[11px]">
            {m.completed ? (
              <>
                <span className="text-status-success w-3 text-center shrink-0">{'\u2713'}</span>
                <span className="text-text-tertiary flex-1 truncate">{m.label}</span>
                <span className="text-text-tertiary tabular-nums opacity-50">
                  +{formatNumber(m.reward)}
                </span>
              </>
            ) : m.inProgress ? (
              <>
                <span className="text-status-warning w-3 text-center shrink-0">{'\u25D0'}</span>
                <span className="text-text-primary flex-1 truncate">{m.label}</span>
                <span className="text-status-warning tabular-nums text-[10px]">
                  {m.inProgress}
                </span>
              </>
            ) : (
              <>
                <span className="text-text-primary w-3 text-center shrink-0">{'\u25CB'}</span>
                <span className="text-text-primary flex-1 truncate">{m.label}</span>
                <span className="text-status-success tabular-nums">
                  +{formatNumber(m.reward)} RATE
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
