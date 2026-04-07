'use client';

interface ProcessingChainVizProps {
  stages: {
    production: boolean;
    training: boolean;
    alignment: boolean;
    deployed: boolean;
  };
}

const NODES: Array<{ key: keyof ProcessingChainVizProps['stages']; label: string }> = [
  { key: 'production', label: 'RES' },
  { key: 'training', label: 'TRAIN' },
  { key: 'alignment', label: 'ALIGN' },
  { key: 'deployed', label: 'DEPLOY' },
];

export function ProcessingChainViz({ stages }: ProcessingChainVizProps) {
  return (
    <div className="space-y-1.5">
      <div className="font-terminal text-[10px] text-text-tertiary uppercase tracking-wider">
        Chain Progress
      </div>

      <div className="flex items-center gap-1">
        {NODES.map(({ key, label }, i) => {
          const completed = stages[key];

          return (
            <div key={key} className="flex items-center gap-1">
              {i > 0 && (
                <span className="font-terminal text-[10px] text-text-tertiary">&rarr;</span>
              )}
              <span
                className={`px-2 py-1 rounded text-[10px] font-terminal transition-colors ${
                  completed
                    ? 'bg-surface-hover text-text-primary border border-text-tertiary'
                    : 'bg-transparent text-text-tertiary border border-border-default opacity-40'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
