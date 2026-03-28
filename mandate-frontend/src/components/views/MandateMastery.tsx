"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentFeedEntry } from "@/mock/types";
import { FeedEntry } from "@/components/feed/FeedEntry";
import { Button } from "@/components/interactive/Button";
import {
  chaoticDemoScript,
  strategicDemoScript,
  templateRoundScript,
  ownMandateRoundScript,
  iteratedMandateRoundScript,
  type MasteryRoundScript,
} from "@/mock/onboarding-mastery-scripts";
import { detectEmotionalLanguage } from "@/mock/emotional-keywords";

// ── Types ──────────────────────────────────────────────────────────────────

type MasteryStep = 1 | 2 | 3 | 4 | 5;

interface MandateMasteryProps {
  readonly skipStep1: boolean;
  readonly showAINaiveScaffolding: boolean;
  readonly onComplete: () => void;
  readonly onRequestMandateView: () => void;
  /** page.tsx passes current view so mastery can detect navigation away */
  readonly currentView?: string;
}

interface RoundResultBar {
  tradesExecuted: number;
  avgPrice: number;
  pnl: number;
  previousPnl?: number;
}

// ── Feed playback hook ─────────────────────────────────────────────────────

function useFeedPlayback(
  script: MasteryRoundScript,
  active: boolean,
): { entries: AgentFeedEntry[]; done: boolean } {
  const [entries, setEntries] = useState<AgentFeedEntry[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setEntries([]);
      setDone(false);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const item of script.feedEntries) {
      timers.push(
        setTimeout(() => {
          setEntries((prev) => [...prev, item.entry]);
        }, item.delay),
      );
    }

    const lastDelay = script.feedEntries.at(-1)?.delay ?? 0;
    timers.push(setTimeout(() => setDone(true), lastDelay + 500));

    return () => timers.forEach(clearTimeout);
  }, [script, active]);

  return { entries, done };
}

// ── Main Component ─────────────────────────────────────────────────────────

export function MandateMastery({
  skipStep1,
  showAINaiveScaffolding,
  onComplete,
  onRequestMandateView,
  currentView,
}: MandateMasteryProps) {
  const startStep: MasteryStep = skipStep1 ? 2 : 1;
  const [step, setStep] = useState<MasteryStep>(startStep);
  const [showResult, setShowResult] = useState(false);
  const [previousPnl, setPreviousPnl] = useState<number | undefined>(undefined);
  const [showVarianceNotice, setShowVarianceNotice] = useState(false);
  const [varianceShown, setVarianceShown] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Track whether mastery has navigated to Mandate for the current step
  const [hasRequestedView, setHasRequestedView] = useState(false);

  // Detect if player navigated away from Mandate view
  const isPaused = step >= 2 && step <= 4 && !showResult && currentView !== "Mandate";

  // Step 1 playback
  const { entries: chaoticEntries } = useFeedPlayback(chaoticDemoScript, step === 1);
  const { entries: strategicEntries } = useFeedPlayback(strategicDemoScript, step === 1);

  // Step 2 playback
  const { entries: templateEntries, done: templateDone } = useFeedPlayback(
    templateRoundScript,
    step === 2 && showResult,
  );

  // Step 3 playback
  const { entries: ownEntries, done: ownDone } = useFeedPlayback(
    ownMandateRoundScript,
    step === 3 && showResult,
  );

  // Step 4 playback
  const { entries: iteratedEntries, done: iteratedDone } = useFeedPlayback(
    iteratedMandateRoundScript,
    step === 4 && showResult,
  );

  // Step 1: countdown timer (visual only — player can also click "Next Step")
  const [step1Countdown, setStep1Countdown] = useState(15);
  useEffect(() => {
    if (step !== 1) return;
    const interval = setInterval(() => {
      setStep1Countdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setStep(2);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // Navigate to Mandate view ONCE when an editing step starts (not on every render)
  useEffect(() => {
    if (step >= 2 && step <= 4 && !showResult && !hasRequestedView) {
      onRequestMandateView();
      setHasRequestedView(true);
    }
  }, [step, showResult, hasRequestedView, onRequestMandateView]);

  // Reset the "has requested" flag when step changes
  useEffect(() => {
    setHasRequestedView(false);
  }, [step]);

  // Show variance notice on first submission (AI-naive only)
  useEffect(() => {
    if (showAINaiveScaffolding && showResult && step === 2 && !varianceShown) {
      setShowVarianceNotice(true);
      setVarianceShown(true);
    }
  }, [showAINaiveScaffolding, showResult, step, varianceShown]);

  // Escape key → show exit confirmation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !showExitConfirm) {
        setShowExitConfirm(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showExitConfirm]);

  const handleSubmit = useCallback(() => {
    setShowResult(true);
  }, []);

  const handleNextStep = useCallback(() => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setPreviousPnl(templateRoundScript.results.pnl);
      setShowResult(false);
      setStep(3);
    } else if (step === 3) {
      setPreviousPnl(ownMandateRoundScript.results.pnl);
      setShowResult(false);
      setStep(4);
    } else if (step === 4) {
      setShowResult(false);
      setStep(5);
    }
  }, [step]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleResume = useCallback(() => {
    onRequestMandateView();
  }, [onRequestMandateView]);

  const totalSteps = skipStep1 ? 4 : 5;
  const displayStep = skipStep1 ? step - 1 : step;

  // ── Exit confirmation modal ──────────────────────────────────────────────

  if (showExitConfirm) {
    return (
      <div className="fixed inset-0 z-[2800] bg-night-sky/80 flex items-center justify-center">
        <div className="bg-surface-2 border border-border-default rounded p-6 max-w-sm text-center">
          <p className="font-dashboard text-sm text-text-primary mb-2">
            Exit Mandate Mastery?
          </p>
          <p className="font-dashboard text-xs text-text-secondary mb-5">
            You can resume anytime from the command palette.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="primary" size="sm" onClick={handleSkip}>
              Exit
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowExitConfirm(false)}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Without/With demonstration ───────────────────────────────────

  if (step === 1) {
    return (
      <div className="fixed inset-0 z-[2500] bg-night-sky/95 flex flex-col">
        <InstructionBar
          step={displayStep}
          totalSteps={totalSteps}
          message="This is what your agent does without a mandate vs. with one."
          onSkip={handleSkip}
          onNext={handleNextStep}
          countdown={step1Countdown}
        />
        <div className="flex-1 flex gap-0 overflow-hidden">
          <div className="flex-1 border-r border-border-default flex flex-col">
            <div className="px-4 py-2 bg-surface-1 border-b border-border-default">
              <span className="font-terminal text-xs text-status-critical uppercase tracking-wider">
                WITHOUT MANDATE
              </span>
            </div>
            <div className="flex-1 overflow-y-auto bg-surface-0 p-2">
              {chaoticEntries.map((e) => (
                <FeedEntry key={e.id} entry={e} />
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2 bg-surface-1 border-b border-border-default">
              <span className="font-terminal text-xs text-status-success uppercase tracking-wider">
                WITH MANDATE
              </span>
            </div>
            <div className="flex-1 overflow-y-auto bg-surface-0 p-2">
              {strategicEntries.map((e) => (
                <FeedEntry key={e.id} entry={e} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 5: Completion ───────────────────────────────────────────────────

  if (step === 5) {
    return <CompletionBar onDismiss={onComplete} />;
  }

  // ── Paused state: player navigated away ──────────────────────────────────

  if (isPaused) {
    return <ResumePrompt onResume={handleResume} onSkip={handleSkip} />;
  }

  // ── Steps 2-4: Instruction bar + result overlay ──────────────────────────

  const stepMessages: Record<2 | 3 | 4, string> = {
    2: "Edit the mandate below, then click \"Submit Mandate\" to see how your agent performs.",
    3: "Write your own mandate from scratch, then click \"Submit Mandate\" to test it.",
    4: "Refine your mandate based on the results. Click \"Submit Mandate\" when ready.",
  };

  const activeScript =
    step === 2 ? templateRoundScript : step === 3 ? ownMandateRoundScript : iteratedMandateRoundScript;
  const activeEntries =
    step === 2 ? templateEntries : step === 3 ? ownEntries : iteratedEntries;
  const activeDone =
    step === 2 ? templateDone : step === 3 ? ownDone : iteratedDone;

  return (
    <>
      <InstructionBar
        step={displayStep}
        totalSteps={totalSteps}
        message={stepMessages[step]}
        onSkip={handleSkip}
      />

      {step === 4 && !showResult && (
        <IterationAnnotations
          annotations={iteratedMandateRoundScript.results.annotations ?? []}
          suggestions={iteratedMandateRoundScript.results.suggestions ?? []}
        />
      )}

      {showAINaiveScaffolding && !showResult && (
        <EmotionalTranslator />
      )}

      {showVarianceNotice && (
        <div className="fixed left-0 right-0 bg-surface-2 border-b border-border-default px-4 py-3 z-[2599]" style={{ top: "116px" }}>
          <p className="font-dashboard text-xs text-text-secondary">
            Note: Your agent interprets your mandate freshly each round. The same
            mandate may produce slightly different actions depending on market
            conditions. This is strategic variance, not a bug.
          </p>
          <button
            onClick={() => setShowVarianceNotice(false)}
            className="font-dashboard text-xs text-text-tertiary hover:text-text-secondary mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      <MasterySubmitListener
        step={step}
        showResult={showResult}
        onSubmit={handleSubmit}
      />

      {showResult && (
        <ResultOverlay
          entries={activeEntries}
          result={{
            tradesExecuted: activeScript.results.tradesExecuted,
            avgPrice: activeScript.results.avgPrice,
            pnl: activeScript.results.pnl,
            previousPnl,
          }}
          done={activeDone}
          step={step}
          onNext={handleNextStep}
        />
      )}
    </>
  );
}

// ── Instruction Bar ────────────────────────────────────────────────────────

interface InstructionBarProps {
  readonly step: number;
  readonly totalSteps: number;
  readonly message: string;
  readonly onSkip: () => void;
  readonly onNext?: () => void;
  readonly countdown?: number;
}

function InstructionBar({ step, totalSteps, message, onSkip, onNext, countdown }: InstructionBarProps) {
  return (
    <div
      className="fixed left-0 right-0 bg-surface-2 border-b border-border-default px-4 py-2.5 flex items-center shrink-0 z-[2600]"
      style={{ borderLeft: "2px solid var(--colour-compute)", top: "80px" }}
    >
      <span className="font-terminal text-xs text-text-primary mr-2">
        MANDATE MASTERY
      </span>
      <span className="text-xs text-text-tertiary font-dashboard mr-3">
        Step {step} of {totalSteps}
      </span>
      <span className="text-xs text-text-secondary font-dashboard flex-1">
        {message}
      </span>
      {countdown !== undefined && countdown > 0 && (
        <span className="text-xs text-text-tertiary font-dashboard mr-3">
          Auto-advancing in {countdown}s
        </span>
      )}
      {onNext && (
        <button
          onClick={onNext}
          className="ml-2 h-7 px-3 text-xs font-dashboard rounded transition-colors bg-compute/20 text-compute border border-compute/40 hover:bg-compute/30 hover:border-compute/60"
        >
          Next Step →
        </button>
      )}
      <button
        onClick={onSkip}
        className="ml-2 h-7 px-3 text-xs font-dashboard rounded transition-colors bg-surface-hover text-text-secondary border border-border-default hover:text-text-primary hover:border-border-focus"
      >
        Skip to game →
      </button>
    </div>
  );
}

// ── Resume Prompt (shown when player navigates away during mastery) ────────

interface ResumePromptProps {
  readonly onResume: () => void;
  readonly onSkip: () => void;
}

function ResumePrompt({ onResume, onSkip }: ResumePromptProps) {
  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[2600] bg-surface-2 border border-border-default rounded px-4 py-2 flex items-center gap-3 shadow-lg">
      <span className="font-dashboard text-sm text-text-secondary">
        Mandate Mastery paused
      </span>
      <button
        onClick={onResume}
        className="h-7 px-3 text-xs font-dashboard rounded transition-colors bg-surface-hover text-text-primary border border-border-default hover:border-border-focus"
      >
        Resume
      </button>
      <button
        onClick={onSkip}
        className="text-xs text-text-tertiary hover:text-text-secondary font-dashboard transition-colors"
      >
        Exit
      </button>
    </div>
  );
}

// ── Result Overlay ─────────────────────────────────────────────────────────

interface ResultOverlayProps {
  readonly entries: AgentFeedEntry[];
  readonly result: RoundResultBar;
  readonly done: boolean;
  readonly step: MasteryStep;
  readonly onNext: () => void;
}

function ResultOverlay({ entries, result, done, step, onNext }: ResultOverlayProps) {
  const improvement = result.previousPnl !== undefined
    ? Math.round(((result.pnl - result.previousPnl) / Math.max(Math.abs(result.previousPnl), 1)) * 100)
    : undefined;

  return (
    <div className="fixed inset-0 z-[2700] bg-night-sky/80 flex items-center justify-center">
      <div className="bg-surface-2 border border-border-default rounded w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 min-h-[200px]">
          {entries.map((e) => (
            <FeedEntry key={e.id} entry={e} />
          ))}
        </div>

        {done && (
          <div className="border-t border-border-default px-4 py-3 bg-surface-1">
            <div className="font-terminal text-xs text-text-primary">
              <span>ROUND RESULT: </span>
              <span>{result.tradesExecuted} trades executed. </span>
              <span>Avg price: {result.avgPrice.toFixed(2)} RATE. </span>
              <span className={result.pnl >= 0 ? "text-status-success" : "text-status-critical"}>
                Net P&L: {result.pnl >= 0 ? "+" : ""}{result.pnl} RATE
              </span>
            </div>
            {improvement !== undefined && (
              <div className="font-terminal text-xs text-text-secondary mt-1">
                <span>vs. previous: </span>
                <span className={improvement >= 0 ? "text-status-success" : "text-status-critical"}>
                  {improvement >= 0 ? "+" : ""}{improvement}% {improvement >= 0 ? "improvement" : "change"} in P&L
                </span>
                {step === 4 && (
                  <span className="block mt-1 text-compute">
                    ITERATE TO IMPROVE — this is the core skill of MANDATE
                  </span>
                )}
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Button variant="primary" size="sm" onClick={onNext}>
                Continue
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Completion Bar ─────────────────────────────────────────────────────────

function CompletionBar({ onDismiss }: { readonly onDismiss: () => void }) {
  return (
    <div className="bg-surface-2 border-b border-border-default px-4 py-4 z-[2600]">
      <p className="font-terminal text-xs text-text-primary mb-1">
        MANDATE MASTERY COMPLETE
      </p>
      <p className="font-dashboard text-xs text-text-secondary mb-3">
        Your agent is operating on your latest mandate. Update it anytime —
        conditions change, your strategy should too. Check the agent feed to
        monitor execution. Check the news for market-moving events.
      </p>
      <p className="font-dashboard text-xs text-text-secondary mb-3">
        Good luck.
      </p>
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

// ── Iteration Annotations (Step 4) ─────────────────────────────────────────

interface IterationAnnotationsProps {
  readonly annotations: string[];
  readonly suggestions: string[];
}

function IterationAnnotations({ annotations, suggestions }: IterationAnnotationsProps) {
  return (
    <div className="fixed left-0 right-0 bg-surface-1 border-b border-border-default px-4 py-3 z-[2599]" style={{ top: "116px" }}>
      {annotations.length > 0 && (
        <div className="mb-3">
          <p className="font-terminal text-xs text-text-primary mb-1.5">WHAT HAPPENED:</p>
          <ul className="space-y-1">
            {annotations.map((a, i) => (
              <li key={i} className="font-dashboard text-xs text-text-secondary">
                • {a}
              </li>
            ))}
          </ul>
        </div>
      )}
      {suggestions.length > 0 && (
        <div>
          <p className="font-terminal text-xs text-text-primary mb-1.5">SUGGESTED IMPROVEMENTS:</p>
          <div className="flex gap-2 flex-wrap">
            {suggestions.map((s, i) => (
              <button
                key={i}
                className="px-3 py-1.5 bg-surface-2 border border-border-default rounded text-xs text-compute font-dashboard hover:bg-surface-hover hover:border-border-focus transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Emotional Translator (AI-naive scaffolding) ────────────────────────────

function EmotionalTranslator() {
  const [suggestion, setSuggestion] = useState<{
    original: string;
    replacement: string;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function handleTextChange(e: Event) {
      if (dismissed) return;
      const text = (e as CustomEvent<string>).detail;
      const result = detectEmotionalLanguage(text);
      if (result) {
        setSuggestion({ original: result.original, replacement: result.suggestion });
      } else {
        setSuggestion(null);
      }
    }

    window.addEventListener("mandate-text-change", handleTextChange);
    return () => window.removeEventListener("mandate-text-change", handleTextChange);
  }, [dismissed]);

  if (!suggestion || dismissed) return null;

  return (
    <div className="bg-surface-1 border-b border-border-default px-4 py-3">
      <p className="font-dashboard text-xs text-text-secondary mb-2">
        Your agent responds better to specific instructions.
      </p>
      <div className="font-dashboard text-xs mb-2">
        <p className="text-text-tertiary">
          &ldquo;{suggestion.original}&rdquo;
        </p>
        <p className="text-compute">
          → &ldquo;{suggestion.replacement}&rdquo;
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={() => {
          window.dispatchEvent(
            new CustomEvent("mandate-apply-suggestion", {
              detail: suggestion.replacement,
            }),
          );
          setSuggestion(null);
        }}>
          Apply suggestion
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setDismissed(true)}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

// ── Submit Listener ────────────────────────────────────────────────────────

function MasterySubmitListener({
  step,
  showResult,
  onSubmit,
}: {
  readonly step: MasteryStep;
  readonly showResult: boolean;
  readonly onSubmit: () => void;
}) {
  useEffect(() => {
    if (showResult) return;
    if (step < 2 || step > 4) return;

    function handleSubmit() {
      onSubmit();
    }

    window.addEventListener("mandate-submitted", handleSubmit);
    return () => window.removeEventListener("mandate-submitted", handleSubmit);
  }, [step, showResult, onSubmit]);

  return null;
}
