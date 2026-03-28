"use client";

import { useEffect, useCallback } from "react";
import type { ViewName } from "@/lib/constants";

interface KeyboardShortcutHandlers {
  onViewSwitch: (view: ViewName) => void;
  onToggleSidebar: () => void;
  onOpenCommandPalette: () => void;
}

const VIEW_KEYS: Record<string, ViewName> = {
  "1": "Overview",
  "2": "Map",
  "3": "Market",
  "4": "Buildings",
  "5": "Intelligence",
  "6": "Mandate",
};

export function useKeyboardShortcuts({
  onViewSwitch,
  onToggleSidebar,
  onOpenCommandPalette,
}: KeyboardShortcutHandlers) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+K — command palette
      if (meta && e.key === "k") {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      // Cmd+1-6 — view switching
      if (meta && VIEW_KEYS[e.key]) {
        e.preventDefault();
        onViewSwitch(VIEW_KEYS[e.key]);
        return;
      }

      // Cmd+\ — toggle sidebar
      if (meta && e.key === "\\") {
        e.preventDefault();
        onToggleSidebar();
        return;
      }
    },
    [onViewSwitch, onToggleSidebar, onOpenCommandPalette]
  );

  useEffect(() => {
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler]);
}
