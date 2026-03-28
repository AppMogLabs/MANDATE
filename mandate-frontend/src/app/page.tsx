"use client";

import { useState, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { ViewSwitcher } from "@/components/navigation/ViewSwitcher";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { ActivityFeed } from "@/components/feed/ActivityFeed";
import { NewsTicker } from "@/components/feed/NewsTicker";

// Views
import { WorldMap } from "@/components/views/WorldMap";
import { OrderBook } from "@/components/views/OrderBook";
import { BuildingDetail } from "@/components/views/BuildingDetail";
import { NewsFeed } from "@/components/views/NewsFeed";
import { EchoOracle } from "@/components/views/EchoOracle";
import { ReputationScores } from "@/components/views/ReputationScores";
import { DataLineage } from "@/components/views/DataLineage";
import { GuardClauseMarketplace } from "@/components/views/GuardClauseMarketplace";
import { ProductionSummary } from "@/components/views/ProductionSummary";
import { TradeHistory } from "@/components/views/TradeHistory";
import { PriceChart } from "@/components/views/PriceChart";
import { MandateEditor } from "@/components/views/MandateEditor";
import {
  OnboardingFlow,
  type OnboardingModuleState,
  type OnboardingPhase,
} from "@/components/views/OnboardingFlow";
import { DashboardTour } from "@/components/views/DashboardTour";
import { MandateMastery } from "@/components/views/MandateMastery";

// Mock data
import { resourceBalances } from "@/mock/resources";
import { orderBooks } from "@/mock/orderbook";
import { feedEntries } from "@/mock/feed";
import { hexTiles } from "@/mock/map";
import { epochState } from "@/mock/epoch";
import { worldEvents } from "@/mock/events";
import {
  agentReputations,
  echoOracleEntries,
  dataLineageNodes,
  guardClauseTemplates,
} from "@/mock/intelligence";
import { playerState as defaultPlayerState } from "@/mock/player";
import type { PlayerRole } from "@/mock/mandate-types";

// Hooks
import { usePanelLayout, type PanelConfig } from "@/hooks/usePanelLayout";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export default function Home() {
  const {
    activeView,
    panels,
    sidebarCollapsed,
    switchView,
    toggleSidebar,
  } = usePanelLayout();

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [alertMessage, setAlertMessage] = useState<string | undefined>(
    "CHIPS supply disruption detected. East Asian corridor. Estimated recovery: unknown."
  );

  // Onboarding module state for command palette tutorials
  const [moduleState, setModuleState] = useState<OnboardingModuleState>({
    tourCompleted: false,
    masteryCompleted: false,
  });

  // Re-launchable tutorials from command palette
  const [activeTutorial, setActiveTutorial] = useState<"tour" | "mastery" | null>(null);

  // Track onboarding phase to hide game UI during full-screen takeover phases
  const [onboardingPhase, setOnboardingPhase] = useState<OnboardingPhase>("ROLE_SELECTION");
  const isFullScreenOnboarding = showOnboarding && (
    onboardingPhase === "ROLE_SELECTION" ||
    onboardingPhase === "SELF_DECLARATION" ||
    onboardingPhase === "TERMINAL_BOOT"
  );

  // Player role — updated by onboarding role selection
  const ROLE_AGENT_NAMES: Record<PlayerRole, string> = {
    "Compute Superpower": "Alpha-7",
    "Data-Rich State": "Archon-3",
    "Chip Power": "Forge-9",
    "Talent Hub": "Nexus-5",
    "Regulatory Power": "Sentinel-1",
  };
  const [selectedRole, setSelectedRole] = useState<PlayerRole>(defaultPlayerState.role as PlayerRole);
  const agentName = ROLE_AGENT_NAMES[selectedRole];
  const playerName = defaultPlayerState.name;

  const openCommandPalette = useCallback(
    () => setCommandPaletteOpen(true),
    []
  );

  useKeyboardShortcuts({
    onViewSwitch: switchView,
    onToggleSidebar: toggleSidebar,
    onOpenCommandPalette: openCommandPalette,
  });

  // Count critical/warning entries for sidebar indicators
  const criticalCount = feedEntries.filter(
    (e) => e.tier === "critical"
  ).length;
  const warningCount = feedEntries.filter(
    (e) => e.tier === "warning"
  ).length;

  // Get sparkline data for price chart placeholder
  const computeSparkline =
    resourceBalances.find((r) => r.resource === "COMPUTE")?.sparkline || [];

  // ── Tutorial launchers (from command palette) ────────────────────────────

  const handleLaunchTour = useCallback(() => {
    switchView("Overview");
    setActiveTutorial("tour");
  }, [switchView]);

  const handleLaunchMastery = useCallback(() => {
    switchView("Mandate");
    setActiveTutorial("mastery");
  }, [switchView]);

  const handleTutorialTourComplete = useCallback(
    (startMastery: boolean) => {
      setModuleState((prev) => ({ ...prev, tourCompleted: true }));
      setActiveTutorial(null);
      if (startMastery) {
        switchView("Mandate");
        setActiveTutorial("mastery");
      }
    },
    [switchView],
  );

  const handleTutorialMasteryComplete = useCallback(() => {
    setModuleState((prev) => ({ ...prev, masteryCompleted: true }));
    setActiveTutorial(null);
  }, []);

  function renderPanel(config: PanelConfig) {
    switch (config.component) {
      case "WorldMap":
        return <div data-tour="world-map" className="h-full"><WorldMap tiles={hexTiles} /></div>;
      case "OrderBook":
        return <div data-tour="order-book" className="h-full"><OrderBook snapshots={orderBooks} /></div>;
      case "NewsFeed":
        return <div data-tour="news-feed" className="h-full"><NewsFeed events={worldEvents} /></div>;
      case "BuildingDetail":
        return <BuildingDetail building={null} />;
      case "ProductionSummary":
        return <ProductionSummary resources={resourceBalances} />;
      case "EchoOracle":
        return <EchoOracle entries={echoOracleEntries} />;
      case "ReputationScores":
        return <ReputationScores agents={agentReputations} />;
      case "DataLineage":
        return <DataLineage nodes={dataLineageNodes} />;
      case "GuardClauseMarketplace":
        return <GuardClauseMarketplace templates={guardClauseTemplates} />;
      case "TradeHistory":
        return <TradeHistory entries={feedEntries} />;
      case "PriceChart":
        return <PriceChart data={computeSparkline} />;
      case "MandateView":
        return <MandateEditor />;
      default:
        return (
          <div className="h-full flex items-center justify-center text-text-tertiary text-sm">
            {config.component}
          </div>
        );
    }
  }

  return (
    <>
      {/*
        Game UI — hidden (not unmounted) during full-screen onboarding phases
        to prevent flash. Uses display:none so it doesn't render visually
        but stays in the tree so it mounts only once.
      */}
      <div
        className="h-screen flex flex-col overflow-hidden"
        style={{ display: isFullScreenOnboarding ? "none" : undefined }}
      >
        {/* TopBar */}
        <TopBar
          resources={resourceBalances}
          epoch={epochState}
          playerName={playerName}
          playerRole={selectedRole}
          rateBalance={15000}
          alertMessage={alertMessage}
          onDismissAlert={() => setAlertMessage(undefined)}
        />

        {/* View Switcher */}
        <ViewSwitcher activeView={activeView} onSwitch={switchView} />

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Panel Layout */}
          <PanelLayout panels={panels} renderPanel={renderPanel} />

          {/* Sidebar */}
          <Sidebar
            defaultCollapsed={sidebarCollapsed}
            criticalCount={criticalCount}
            warningCount={warningCount}
          >
            <ActivityFeed entries={feedEntries} />
          </Sidebar>
        </div>

        {/* News Ticker */}
        <NewsTicker events={worldEvents} />

        {/* StatusBar */}
        <StatusBar
          buildingCount={15}
          activeBuildings={12}
          systemStatus="online"
        />

        {/* Command Palette */}
        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onViewSwitch={(view) => {
            switchView(view);
            setCommandPaletteOpen(false);
          }}
          onToggleSidebar={toggleSidebar}
          resources={resourceBalances}
          tutorials={showOnboarding ? undefined : moduleState}
          onLaunchTour={handleLaunchTour}
          onLaunchMastery={handleLaunchMastery}
        />

        {/* Re-launchable tutorials from command palette */}
        {activeTutorial === "tour" && (
          <DashboardTour
            abbreviated={false}
            onComplete={handleTutorialTourComplete}
          />
        )}

        {activeTutorial === "mastery" && (
          <MandateMastery
            skipStep1={true}
            showAINaiveScaffolding={false}
            onComplete={handleTutorialMasteryComplete}
            onRequestMandateView={() => switchView("Mandate")}
            currentView={activeView}
          />
        )}
      </div>

      {/* Onboarding — always rendered in one place so it never unmounts/remounts */}
      {showOnboarding && (
        <OnboardingFlow
          onComplete={() => setShowOnboarding(false)}
          onSwitchToMandate={() => switchView("Mandate")}
          onSwitchToOverview={() => switchView("Overview")}
          onModuleStateChange={setModuleState}
          onPhaseChange={setOnboardingPhase}
          onRoleSelected={setSelectedRole}
          currentView={activeView}
        />
      )}
    </>
  );
}
