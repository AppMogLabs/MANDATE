"use client";

import { VIEW_NAMES, type ViewName } from "@/lib/constants";

interface ViewSwitcherProps {
  activeView: ViewName;
  onSwitch: (view: ViewName) => void;
}

export function ViewSwitcher({ activeView, onSwitch }: ViewSwitcherProps) {
  return (
    <nav className="flex items-center gap-0 h-8 bg-surface-0 border-b border-border-default px-2">
      {VIEW_NAMES.map((view) => {
        const isActive = view === activeView;
        return (
          <button
            key={view}
            onClick={() => onSwitch(view)}
            {...(view === "Mandate" ? { "data-tour": "mandate-tab" } : {})}
            className={`px-3 h-full text-xs font-dashboard transition-colors duration-150 border-b-2 ${
              isActive
                ? "text-text-primary border-border-active"
                : "text-text-tertiary border-transparent hover:text-text-secondary"
            }`}
          >
            {view}
          </button>
        );
      })}
    </nav>
  );
}

export default ViewSwitcher;
