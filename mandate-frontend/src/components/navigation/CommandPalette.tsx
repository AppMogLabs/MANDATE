"use client";

import { useEffect, useRef } from "react";
import { Command } from "cmdk";
import type { ViewName } from "@/lib/constants";
import { VIEW_NAMES, RESOURCE_ORDER, RESOURCE_LABELS } from "@/lib/constants";
import type { ResourceBalance } from "@/mock/types";

interface TutorialState {
  tourCompleted: boolean;
  masteryCompleted: boolean;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onViewSwitch: (view: ViewName) => void;
  onToggleSidebar: () => void;
  resources?: ResourceBalance[];
  tutorials?: TutorialState;
  onLaunchTour?: () => void;
  onLaunchMastery?: () => void;
}

const VIEW_SHORTCUTS: Record<string, string> = {
  Overview: "⌘1",
  Map: "⌘2",
  Market: "⌘3",
  Buildings: "⌘4",
  Intelligence: "⌘5",
  Mandate: "⌘6",
};

export function CommandPalette({
  open,
  onClose,
  onViewSwitch,
  onToggleSidebar,
  resources = [],
  tutorials,
  onLaunchTour,
  onLaunchMastery,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-night-sky/80"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-[640px]">
        <Command
          className="bg-surface-2 border border-border-default rounded overflow-hidden"
          label="Command palette"
        >
          <Command.Input
            ref={inputRef}
            placeholder="Type a command..."
            className="w-full h-12 px-4 bg-transparent text-text-primary font-terminal text-sm border-b border-border-default outline-none placeholder:text-text-tertiary"
          />

          <Command.List className="max-h-[480px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-text-tertiary text-sm font-dashboard">
              No results found.
            </Command.Empty>

            {/* Navigation */}
            <Command.Group
              heading="Navigation"
              className="[&_[cmdk-group-heading]]:text-text-tertiary [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-dashboard"
            >
              {VIEW_NAMES.map((view) => (
                <Command.Item
                  key={view}
                  value={view}
                  onSelect={() => {
                    onViewSwitch(view);
                    onClose();
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded text-sm text-text-secondary font-dashboard cursor-pointer data-[selected=true]:bg-surface-hover data-[selected=true]:text-text-primary"
                >
                  <span>{view}</span>
                  <span className="text-xs text-text-tertiary">
                    {VIEW_SHORTCUTS[view]}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* Resources */}
            <Command.Group
              heading="Resources"
              className="[&_[cmdk-group-heading]]:text-text-tertiary [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-dashboard"
            >
              {RESOURCE_ORDER.map((r) => {
                const rb = resources.find((res) => res.resource === r);
                return (
                  <Command.Item
                    key={r}
                    value={r}
                    className="flex items-center justify-between px-3 py-2 rounded text-sm text-text-secondary font-dashboard cursor-pointer data-[selected=true]:bg-surface-hover data-[selected=true]:text-text-primary"
                  >
                    <span>
                      {RESOURCE_LABELS[r]} — {r}
                    </span>
                    {rb && (
                      <span className="text-xs text-text-tertiary tabular-nums">
                        {rb.priceInRate.toFixed(4)} RATE
                      </span>
                    )}
                  </Command.Item>
                );
              })}
            </Command.Group>

            {/* Tutorials */}
            {tutorials && (
              <Command.Group
                heading="Tutorials"
                className="[&_[cmdk-group-heading]]:text-text-tertiary [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-dashboard"
              >
                <Command.Item
                  value="Dashboard Tour"
                  onSelect={() => {
                    onLaunchTour?.();
                    onClose();
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded text-sm text-text-secondary font-dashboard cursor-pointer data-[selected=true]:bg-surface-hover data-[selected=true]:text-text-primary"
                >
                  <span>Dashboard Tour</span>
                  <span className="text-xs text-text-tertiary">
                    {tutorials.tourCompleted ? "✓ completed" : "○ recommended"}
                  </span>
                </Command.Item>
                <Command.Item
                  value="Mandate Mastery"
                  onSelect={() => {
                    onLaunchMastery?.();
                    onClose();
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded text-sm text-text-secondary font-dashboard cursor-pointer data-[selected=true]:bg-surface-hover data-[selected=true]:text-text-primary"
                >
                  <span>Mandate Mastery</span>
                  <span className="text-xs text-text-tertiary">
                    {tutorials.masteryCompleted ? "✓ completed" : "○ recommended"}
                  </span>
                </Command.Item>
              </Command.Group>
            )}

            {/* Actions */}
            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:text-text-tertiary [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-dashboard"
            >
              <Command.Item
                value="Toggle Sidebar"
                onSelect={() => {
                  onToggleSidebar();
                  onClose();
                }}
                className="flex items-center justify-between px-3 py-2 rounded text-sm text-text-secondary font-dashboard cursor-pointer data-[selected=true]:bg-surface-hover data-[selected=true]:text-text-primary"
              >
                <span>Toggle Sidebar</span>
                <span className="text-xs text-text-tertiary">⌘\</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

export default CommandPalette;
