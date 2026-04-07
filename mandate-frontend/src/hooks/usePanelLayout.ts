"use client";

import { useState, useCallback } from "react";
import type { ViewName } from "@/lib/constants";

export type LayoutPreset = "overview" | "map" | "market" | "buildings" | "intelligence" | "mandate";

export interface PanelConfig {
  id: string;
  component: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

const PRESETS: Record<LayoutPreset, PanelConfig[]> = {
  overview: [
    { id: "map", component: "WorldMap", row: 0, col: 0, rowSpan: 2, colSpan: 2 },
    { id: "sitrep", component: "SitrepFeed", row: 0, col: 2, rowSpan: 1, colSpan: 1 },
    { id: "orderbook", component: "OrderBook", row: 1, col: 2, rowSpan: 1, colSpan: 1 },
  ],
  map: [
    { id: "map", component: "WorldMap", row: 0, col: 0, rowSpan: 1, colSpan: 1 },
  ],
  market: [
    { id: "orderbook", component: "OrderBook", row: 0, col: 0, rowSpan: 1, colSpan: 2 },
    { id: "actions", component: "DirectActionPanel", row: 0, col: 2, rowSpan: 1, colSpan: 1 },
    { id: "production", component: "ProductionSummary", row: 1, col: 0, rowSpan: 1, colSpan: 1 },
    { id: "chart", component: "PriceChart", row: 1, col: 1, rowSpan: 1, colSpan: 2 },
  ],
  buildings: [
    { id: "map", component: "WorldMap", row: 0, col: 0, rowSpan: 2, colSpan: 2 },
    { id: "detail", component: "BuildingDetail", row: 0, col: 2, rowSpan: 1, colSpan: 1 },
    { id: "production", component: "ProductionSummary", row: 1, col: 2, rowSpan: 1, colSpan: 1 },
  ],
  intelligence: [
    { id: "echo", component: "EchoOracle", row: 0, col: 0, rowSpan: 1, colSpan: 1 },
    { id: "reputation", component: "ReputationScores", row: 0, col: 1, rowSpan: 2, colSpan: 1 },
    { id: "lineage", component: "DataLineage", row: 1, col: 0, rowSpan: 1, colSpan: 1 },
    { id: "guard", component: "GuardClauseMarketplace", row: 1, col: 1, rowSpan: 1, colSpan: 1 },
  ],
  mandate: [
    { id: "mandate", component: "MandateView", row: 0, col: 0, rowSpan: 1, colSpan: 1 },
  ],
};

const VIEW_TO_PRESET: Partial<Record<ViewName, LayoutPreset>> = {
  Overview: "overview",
  Map: "map",
  Market: "market",
  Buildings: "buildings",
  Intelligence: "intelligence",
  Mandate: "mandate",
};

export function usePanelLayout() {
  const [activeView, setActiveView] = useState<ViewName>("Overview");
  const [activePreset, setActivePreset] = useState<LayoutPreset>("overview");
  const [panels, setPanels] = useState<PanelConfig[]>(PRESETS.overview);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const switchView = useCallback((view: ViewName) => {
    setActiveView(view);
    const preset = VIEW_TO_PRESET[view];
    if (preset) {
      setActivePreset(preset);
      setPanels(PRESETS[preset]);
    }
  }, []);

  const switchPreset = useCallback((preset: LayoutPreset) => {
    setActivePreset(preset);
    setPanels(PRESETS[preset]);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  return {
    activeView,
    activePreset,
    panels,
    sidebarCollapsed,
    switchView,
    switchPreset,
    toggleSidebar,
  };
}
