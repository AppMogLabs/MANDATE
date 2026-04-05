"use client";

interface SimpleHintBarProps {
  readonly hint: string;
}

/**
 * Bottom bar showing contextual guidance for the player in Simple Mode.
 */
export function SimpleHintBar({ hint }: SimpleHintBarProps) {
  return (
    <div className="h-9 px-4 flex items-center bg-surface-1 border-t border-border-default shrink-0">
      <div className="border-l-2 border-[#7CD8D5] pl-3">
        <span className="text-xs text-text-secondary font-dashboard">{hint}</span>
      </div>
    </div>
  );
}
