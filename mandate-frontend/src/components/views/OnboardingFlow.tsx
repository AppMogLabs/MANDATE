"use client";

import { useState, useCallback, useEffect } from "react";
import type { PlayerRole } from "@/mock/mandate-types";
import { RoleSelection } from "./RoleSelection";
import { SelfDeclaration, type SelfDeclarationResult } from "./SelfDeclaration";
import { TerminalBoot } from "./TerminalBoot";
import { DashboardTour } from "./DashboardTour";
import { MandateMastery } from "./MandateMastery";

// ── Types ──────────────────────────────────────────────────────────────────

type OnboardingPhase =
  | "ROLE_SELECTION"
  | "SELF_DECLARATION"
  | "TERMINAL_BOOT"
  | "DASHBOARD"
  | "DASHBOARD_TOUR"
  | "MANDATE_MASTERY"
  | "COMPLETE";

export interface OnboardingModuleState {
  tourCompleted: boolean;
  masteryCompleted: boolean;
}

export interface OnboardingFlowProps {
  readonly onComplete: () => void;
  readonly onSwitchToMandate: () => void;
  readonly onSwitchToOverview: () => void;
  readonly onModuleStateChange?: (state: OnboardingModuleState) => void;
  readonly onRoleSelected?: (role: PlayerRole) => void;
  readonly onPhaseChange?: (phase: OnboardingPhase) => void;
  readonly currentView?: string;
  /** Called after role selection to register the player on-chain */
  readonly onRegister?: (role: PlayerRole) => Promise<boolean>;
}

// ── Instruction Bar (exported for page.tsx) ────────────────────────────────

export interface OnboardingInstructionBarProps {
  readonly roundNumber: number;
  readonly totalRounds: number;
  readonly message: string;
  readonly onSkip: () => void;
}

export function OnboardingInstructionBar({ roundNumber, totalRounds, message, onSkip }: OnboardingInstructionBarProps) {
  return (
    <div className="h-10 bg-surface-2 border-b border-border-default flex items-center px-4 shrink-0">
      <span className="text-xs text-text-tertiary font-dashboard mr-2">
        Round {roundNumber} of {totalRounds}
      </span>
      <span className="text-xs text-text-secondary font-dashboard">
        — {message}
      </span>
      <button
        onClick={onSkip}
        className="ml-auto text-xs text-text-tertiary hover:text-text-secondary font-dashboard transition-colors"
      >
        Skip to game →
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function OnboardingFlow({
  onComplete,
  onSwitchToMandate,
  onSwitchToOverview,
  onModuleStateChange,
  onRoleSelected,
  onPhaseChange,
  onRegister,
  currentView,
}: OnboardingFlowProps) {
  const [phase, _setPhase] = useState<OnboardingPhase>("ROLE_SELECTION");

  const setPhase = useCallback((p: OnboardingPhase) => {
    _setPhase(p);
    onPhaseChange?.(p);
  }, [onPhaseChange]);
  const [role, setRole] = useState<PlayerRole>("Compute Superpower");
  const [strategyFamiliar, setStrategyFamiliar] = useState(false);
  const [aiFamiliar, setAIFamiliar] = useState(false);
  const [moduleState, setModuleState] = useState<OnboardingModuleState>({
    tourCompleted: false,
    masteryCompleted: false,
  });
  const [showTourRecommendation, setShowTourRecommendation] = useState(false);

  const updateModuleState = useCallback(
    (update: Partial<OnboardingModuleState>) => {
      setModuleState((prev) => {
        const next = { ...prev, ...update };
        onModuleStateChange?.(next);
        return next;
      });
    },
    [onModuleStateChange],
  );

  // ── Role Selection ───────────────────────────────────────────────────────

  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const handleRoleSelected = useCallback(
    async (selectedRole: PlayerRole) => {
      console.log("[Onboarding] Role selected:", selectedRole);
      setRole(selectedRole);
      onRoleSelected?.(selectedRole);

      // Trigger on-chain registration if callback provided
      if (onRegister) {
        console.log("[Onboarding] Starting on-chain registration...");
        setRegistering(true);
        setRegisterError(null);
        try {
          const success = await onRegister(selectedRole);
          console.log("[Onboarding] Registration result:", success);
          setRegistering(false);
          if (!success) {
            setRegisterError("Registration failed. Please try again.");
            return;
          }
        } catch (err) {
          console.error("[Onboarding] Registration error:", err);
          setRegistering(false);
          setRegisterError(
            err instanceof Error ? err.message : "Registration failed unexpectedly.",
          );
          return;
        }
      }

      console.log("[Onboarding] Advancing to SELF_DECLARATION");
      setPhase("SELF_DECLARATION");
    },
    [onRoleSelected, onRegister, setPhase],
  );

  // ── Self-Declaration ─────────────────────────────────────────────────────

  const handleDeclaration = useCallback(
    (result: SelfDeclarationResult) => {
      setStrategyFamiliar(result.strategyFamiliar);
      setAIFamiliar(result.aiFamiliar);
      setPhase("TERMINAL_BOOT");
    },
    [setPhase],
  );

  // ── Terminal Boot ────────────────────────────────────────────────────────

  const handleBootComplete = useCallback(() => {
    // Determine what happens after boot based on familiarity flags
    if (strategyFamiliar && aiFamiliar) {
      // Both familiar → show recommendation bar, go to dashboard
      setShowTourRecommendation(true);
      setPhase("DASHBOARD");
    } else if (!strategyFamiliar && !aiFamiliar) {
      // Neither familiar → auto-start Dashboard Tour
      setPhase("DASHBOARD_TOUR");
    } else if (strategyFamiliar) {
      // Strategy familiar, not AI → abbreviated tour, then mastery with scaffolding
      setPhase("DASHBOARD_TOUR");
    } else {
      // AI familiar, not strategy → full tour, mastery without scaffolding
      setPhase("DASHBOARD_TOUR");
    }
  }, [strategyFamiliar, aiFamiliar]);

  // ── Dashboard Tour ───────────────────────────────────────────────────────

  const handleTourComplete = useCallback(
    (startMastery: boolean) => {
      updateModuleState({ tourCompleted: true });
      if (startMastery) {
        setPhase("MANDATE_MASTERY");
        onSwitchToMandate();
      } else {
        setPhase("DASHBOARD");
      }
    },
    [updateModuleState, onSwitchToMandate],
  );

  // ── Mandate Mastery ──────────────────────────────────────────────────────

  const handleMasteryComplete = useCallback(() => {
    updateModuleState({ masteryCompleted: true });
    setPhase("COMPLETE");
    onComplete();
  }, [updateModuleState, onComplete]);

  // ── Tour Recommendation Bar ──────────────────────────────────────────────

  const handleStartTourFromBar = useCallback(() => {
    setShowTourRecommendation(false);
    onSwitchToOverview();
    setPhase("DASHBOARD_TOUR");
  }, [onSwitchToOverview]);

  const handleDismissRecommendation = useCallback(() => {
    setShowTourRecommendation(false);
  }, []);

  // Auto-dismiss recommendation after 30 seconds
  const [recommendationVisible, setRecommendationVisible] = useState(true);
  const handleRecommendationTimeout = useCallback(() => {
    setShowTourRecommendation(false);
    setRecommendationVisible(false);
  }, []);

  // ── Launch modules from command palette ──────────────────────────────────

  // These are exposed via the module state and callable from outside
  // See CommandPalette integration in page.tsx

  // ── Render ───────────────────────────────────────────────────────────────

  // Full-screen phases get a persistent black backdrop so there's never a flash
  // of game UI between phase transitions
  const isFullScreen = phase === "ROLE_SELECTION" || phase === "SELF_DECLARATION" || phase === "TERMINAL_BOOT";

  switch (phase) {
    case "ROLE_SELECTION":
      return (
        <>
          <div className="fixed inset-0 z-[2999] bg-night-sky" />
          {registering ? (
            <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-night-sky">
              <div className="text-center space-y-4">
                <div className="w-8 h-8 border-2 border-text-tertiary border-t-[#7CD8D5] rounded-full animate-spin mx-auto" />
                <p className="text-sm text-text-secondary">Registering agent on-chain...</p>
                <p className="text-xs text-text-tertiary">Minting your agent NFT and starter resources</p>
              </div>
            </div>
          ) : (
            <>
              <RoleSelection onSelect={handleRoleSelected} />
              {registerError && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3001] bg-status-critical/20 border border-status-critical/40 text-status-critical text-sm px-4 py-2 rounded">
                  {registerError}
                </div>
              )}
            </>
          )}
        </>
      );

    case "SELF_DECLARATION":
      return (
        <>
          <div className="fixed inset-0 z-[2999] bg-night-sky" />
          <SelfDeclaration onComplete={handleDeclaration} />
        </>
      );

    case "TERMINAL_BOOT":
      return (
        <>
          <div className="fixed inset-0 z-[2999] bg-night-sky" />
          <TerminalBoot role={role} onComplete={handleBootComplete} />
        </>
      );

    case "DASHBOARD_TOUR":
      return (
        <DashboardTour
          abbreviated={strategyFamiliar}
          onComplete={handleTourComplete}
        />
      );

    case "MANDATE_MASTERY":
      return (
        <MandateMastery
          skipStep1={aiFamiliar}
          showAINaiveScaffolding={!aiFamiliar}
          onComplete={handleMasteryComplete}
          onRequestMandateView={onSwitchToMandate}
          currentView={currentView}
        />
      );

    case "DASHBOARD":
      return (
        <>
          {showTourRecommendation && recommendationVisible && (
            <TourRecommendationBar
              onStartTour={handleStartTourFromBar}
              onDismiss={handleDismissRecommendation}
              onTimeout={handleRecommendationTimeout}
            />
          )}
        </>
      );

    case "COMPLETE":
      return null;

    default:
      return null;
  }
}

// ── Tour Recommendation Bar ────────────────────────────────────────────────

interface TourRecommendationBarProps {
  readonly onStartTour: () => void;
  readonly onDismiss: () => void;
  readonly onTimeout: () => void;
}

function TourRecommendationBar({ onStartTour, onDismiss, onTimeout }: TourRecommendationBarProps) {
  // Auto-dismiss after 30 seconds
  useEffect(() => {
    const timer = setTimeout(onTimeout, 30000);
    return () => clearTimeout(timer);
  }, [onTimeout]);

  return (
    <div className="bg-surface-2 border-b border-border-default px-4 py-2.5 flex items-center gap-4 z-[100]">
      <span className="font-dashboard text-sm text-text-secondary">
        ○ Recommended: Take the Dashboard Tour (2 min)
      </span>
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={onStartTour}
          className="px-3 py-1.5 bg-surface-hover text-text-primary text-xs font-dashboard rounded border border-border-default hover:bg-surface-3 transition-colors"
        >
          Start Tour
        </button>
        <button
          onClick={onDismiss}
          className="text-xs text-text-tertiary hover:text-text-secondary font-dashboard transition-colors"
        >
          Skip →
        </button>
      </div>
    </div>
  );
}

// Re-export types for page.tsx
export type { OnboardingPhase };

export default OnboardingFlow;
