"use client";

export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { SimpleLayout } from "@/components/layout/SimpleLayout";
import { SimpleHintBar } from "@/components/layout/SimpleHintBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { ViewSwitcher } from "@/components/navigation/ViewSwitcher";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { ActivityFeed } from "@/components/feed/ActivityFeed";
import { NewsTicker } from "@/components/feed/NewsTicker";
import { LoginGate } from "@/components/views/LoginGate";

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
import { SitrepFeed } from "@/components/views/SitrepFeed";
import { DirectActionPanel } from "@/components/views/DirectActionPanel";
import { LLMSetup, type LLMConfig } from "@/components/views/LLMSetup";
import {
  OnboardingFlow,
  type OnboardingModuleState,
  type OnboardingPhase,
} from "@/components/views/OnboardingFlow";
import { DashboardTour } from "@/components/views/DashboardTour";
import { MandateMastery } from "@/components/views/MandateMastery";

// Mock data (gradually being replaced with live chain data)
import { resourceBalances } from "@/mock/resources";
import { orderBooks } from "@/mock/orderbook";
import { hexTiles } from "@/mock/map";
import { epochState } from "@/mock/epoch";
import { worldEvents } from "@/mock/events";
import {
  agentReputations,
  echoOracleEntries,
  dataLineageNodes,
  guardClauseTemplates,
} from "@/mock/intelligence";
import type { PlayerRole } from "@/mock/mandate-types";

// Hooks
import { usePanelLayout, type PanelConfig } from "@/hooks/usePanelLayout";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useOnboardPlayer } from "@/hooks/useOnboardPlayer";
import { useAgentLifecycle } from "@/hooks/useAgentLifecycle";
import { useTileActions } from "@/hooks/chain/useTileActions";
import { useSimpleModeHints } from "@/hooks/useSimpleModeHints";
import { useActivityFeed } from "@/hooks/useActivityFeed";

// Chain hooks (live data from MegaETH testnet)
import { useResourceBalances, useEpochState, useChainStatus } from "@/hooks/chain";

export default function Home() {
  return (
    <LoginGate>
      {({ walletAddress, isRegistered }) => (
        <GameShell
          walletAddress={walletAddress}
          isRegistered={isRegistered}
        />
      )}
    </LoginGate>
  );
}

// ── Game Shell (rendered after auth) ──────────────────────────────────────────

interface GameShellProps {
  walletAddress: string;
  isRegistered: boolean;
}

// Maps frontend role names to RoleRegistry enum values
const ROLE_TO_INDEX: Record<PlayerRole, number> = {
  "Talent Hub": 0,         // TALENT_HUB
  "Regulatory Power": 1,   // REGULATORY_POWER
  "Data-Rich State": 2,    // DATA_SOVEREIGN
  "Compute Superpower": 3, // COMPUTE_SUPERPOWER
  "Chip Power": 4,         // CHIPS_MAGNATE
};

function GameShell({ walletAddress, isRegistered }: GameShellProps) {
  // UI mode: simple (default for new players) or advanced
  const [isSimpleMode, setIsSimpleMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('mandate-ui-mode');
    return stored === null ? true : stored === 'simple';
  });
  useEffect(() => {
    localStorage.setItem('mandate-ui-mode', isSimpleMode ? 'simple' : 'advanced');
  }, [isSimpleMode]);
  const toggleMode = useCallback(() => setIsSimpleMode((prev) => !prev), []);

  // On-chain registration
  const { onboard } = useOnboardPlayer();

  // Agent lifecycle (LLM config + mandate + worker)
  const agentLifecycle = useAgentLifecycle(walletAddress);

  // Tile actions (claim, release)
  const tileActions = useTileActions(walletAddress);

  // Chain data hooks
  // For testnet: read deployer's balances since operator wallet submits trades
  // For production: would read the player's Privy wallet balances directly
  const DEPLOYER_ADDRESS = '0x3382189F8a29607FdDf3D692B10a2D74480a503F' as `0x${string}`;
  const {
    balances: liveBalances,
    rateBalance: liveRateBalance,
    isLive: balancesLive,
  } = useResourceBalances(DEPLOYER_ADDRESS);
  const {
    epochNumber: liveEpochNumber,
    timeRemaining: liveTimeRemaining,
    isLive: epochLive,
  } = useEpochState();
  const { status: chainStatus } = useChainStatus();

  // Live activity feed from on-chain OrderBook events
  const { entries: feedEntries } = useActivityFeed(walletAddress);

  // Merge live chain balances into mock resource data for TopBar display
  const liveResourceBalances = balancesLive && liveBalances
    ? resourceBalances.map((rb) => ({
        ...rb,
        balance: liveBalances[rb.resource]?.toString() ?? rb.balance,
        priceInRate: liveBalances[rb.resource] ?? rb.priceInRate,
      }))
    : resourceBalances;

  const {
    activeView,
    panels,
    sidebarCollapsed,
    switchView,
    toggleSidebar,
  } = usePanelLayout();

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  // New players see onboarding; returning players skip to dashboard
  const [showOnboarding, setShowOnboarding] = useState(!isRegistered);
  const [alertMessage, setAlertMessage] = useState<string | undefined>(
    isRegistered
      ? "CHIPS supply disruption detected. East Asian corridor. Estimated recovery: unknown."
      : undefined,
  );

  // Onboarding module state for command palette tutorials
  const [moduleState, setModuleState] = useState<OnboardingModuleState>({
    tourCompleted: false,
    masteryCompleted: false,
  });

  // Re-launchable tutorials from command palette
  const [activeTutorial, setActiveTutorial] = useState<
    "tour" | "mastery" | null
  >(null);

  // Track onboarding phase to hide game UI during full-screen takeover phases
  const [onboardingPhase, setOnboardingPhase] =
    useState<OnboardingPhase>("ROLE_SELECTION");
  const isFullScreenOnboarding =
    showOnboarding &&
    (onboardingPhase === "ROLE_SELECTION" ||
      onboardingPhase === "SELF_DECLARATION" ||
      onboardingPhase === "TERMINAL_BOOT");

  // Player role — updated by onboarding role selection
  const ROLE_AGENT_NAMES: Record<PlayerRole, string> = {
    "Compute Superpower": "Alpha-7",
    "Data-Rich State": "Archon-3",
    "Chip Power": "Forge-9",
    "Talent Hub": "Nexus-5",
    "Regulatory Power": "Sentinel-1",
  };
  const [selectedRole, setSelectedRole] = useState<PlayerRole>(
    "Compute Superpower",
  );
  const agentName = ROLE_AGENT_NAMES[selectedRole];

  // Truncated wallet address as player name
  const playerName = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  // Registration callback for onboarding flow
  const handleRegister = useCallback(async (role: PlayerRole): Promise<boolean> => {
    const roleIndex = ROLE_TO_INDEX[role];
    console.log("[Register] wallet:", walletAddress, "role:", role, "index:", roleIndex);
    const result = await onboard(walletAddress, roleIndex);
    console.log("[Register] result:", result);
    return result.success;
  }, [walletAddress, onboard]);

  const openCommandPalette = useCallback(
    () => setCommandPaletteOpen(true),
    [],
  );

  useKeyboardShortcuts({
    onViewSwitch: switchView,
    onToggleSidebar: toggleSidebar,
    onOpenCommandPalette: openCommandPalette,
  });

  // Count critical/warning entries for sidebar indicators
  const criticalCount = feedEntries.filter(
    (e) => e.tier === "critical",
  ).length;
  const warningCount = feedEntries.filter(
    (e) => e.tier === "warning",
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
        return (
          <div data-tour="world-map" className="h-full">
            <WorldMap
              tiles={hexTiles}
              playerAgent="You"
              onClaimTile={(q, r) => {
                tileActions.claimTile(q, r).then((result) => {
                  if (!result.success) {
                    setAlertMessage(`Claim failed: ${result.error}`);
                  }
                });
              }}
              onReleaseTile={(q, r) => {
                tileActions.releaseTile(q, r).then((result) => {
                  if (!result.success) {
                    setAlertMessage(`Release failed: ${result.error}`);
                  }
                });
              }}
            />
          </div>
        );
      case "OrderBook":
        return (
          <div data-tour="order-book" className="h-full">
            <OrderBook snapshots={orderBooks} />
          </div>
        );
      case "NewsFeed":
        return (
          <div data-tour="news-feed" className="h-full">
            <NewsFeed events={worldEvents} />
          </div>
        );
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
      case "SitrepFeed":
        return (
          <SitrepFeed
            sitreps={agentLifecycle.agent.sitreps}
            agentStatus={agentLifecycle.agent.status}
            tickNumber={agentLifecycle.agent.tickNumber}
          />
        );
      case "DirectActionPanel":
        return <DirectActionPanel />;
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
      {/* Game UI — hidden during full-screen onboarding phases */}
      <div
        className="h-screen flex flex-col overflow-hidden"
        style={{ display: isFullScreenOnboarding ? "none" : undefined }}
      >
        {/* TopBar — always shown */}
        <TopBar
          resources={liveResourceBalances}
          epoch={
            epochLive
              ? {
                  ...epochState,
                  epochNumber: liveEpochNumber,
                  timeRemaining: liveTimeRemaining * 1000,
                }
              : epochState
          }
          playerName={playerName}
          playerRole={selectedRole}
          rateBalance={balancesLive ? liveRateBalance : 0}
          alertMessage={alertMessage}
          onDismissAlert={() => setAlertMessage(undefined)}
          isSimpleMode={isSimpleMode}
          onToggleMode={toggleMode}
        />

        {isSimpleMode ? (
          /* ═══ SIMPLE MODE ═══ */
          <SimpleLayout
            mapSlot={
              <WorldMap
                tiles={hexTiles}
                playerAgent="You"
                compact
                onClaimTile={(q, r) => {
                  tileActions.claimTile(q, r).then((result) => {
                    if (!result.success) setAlertMessage(`Claim failed: ${result.error}`);
                  });
                }}
              />
            }
            sitrepSlot={
              <SitrepFeed
                sitreps={agentLifecycle.agent.sitreps}
                agentStatus={agentLifecycle.agent.status}
                tickNumber={agentLifecycle.agent.tickNumber}
              />
            }
            mandateSlot={
              !agentLifecycle.llmConfigured ? (
                <LLMSetup
                  onConfigured={agentLifecycle.configureLLM}
                  isConfigured={false}
                />
              ) : (
                <div className="h-full flex flex-col">
                  <LLMSetup
                    onConfigured={agentLifecycle.configureLLM}
                    isConfigured={true}
                  />
                  <div className="flex-1 overflow-hidden">
                    <MandateEditor
                      simple
                      onDeploy={agentLifecycle.deployMandate}
                    />
                  </div>
                </div>
              )
            }
            hintBar={
              <SimpleHintBar
                hint={useSimpleModeHints({
                  agentStatus: agentLifecycle.agent.status,
                  sitreps: agentLifecycle.agent.sitreps,
                  hasMandateText: true,
                  epochTimeRemainingPct: epochLive ? (liveTimeRemaining / 3600) * 100 : 50,
                })}
              />
            }
          />
        ) : (
          /* ═══ ADVANCED MODE ═══ */
          <>
            {/* View Switcher */}
            <ViewSwitcher activeView={activeView} onSwitch={switchView} />

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
              <PanelLayout panels={panels} renderPanel={renderPanel} />
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
              chainStatus={chainStatus}
            />
          </>
        )}

        {/* Command Palette */}
        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onViewSwitch={(view) => {
            switchView(view);
            setCommandPaletteOpen(false);
          }}
          onToggleSidebar={toggleSidebar}
          resources={liveResourceBalances}
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

      {/* Onboarding — for new (unregistered) players */}
      {showOnboarding && (
        <OnboardingFlow
          onComplete={() => setShowOnboarding(false)}
          onSwitchToMandate={() => switchView("Mandate")}
          onSwitchToOverview={() => switchView("Overview")}
          onModuleStateChange={setModuleState}
          onPhaseChange={setOnboardingPhase}
          onRoleSelected={setSelectedRole}
          onRegister={handleRegister}
          currentView={activeView}
        />
      )}
    </>
  );
}
