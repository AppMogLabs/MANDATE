"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/interactive/Button";

interface TourStep {
  target: string; // CSS selector or data attribute
  cardPosition: "below" | "right" | "left" | "above";
  text: string;
  interactivePrompt?: string;
  interactiveEvent?: string; // event to listen for completion
}

const FULL_TOUR_STEPS: readonly TourStep[] = [
  {
    target: "[data-tour='resource-bar']",
    cardPosition: "below",
    text: "Your resources. Seven types plus RATE, your currency. Each updates in real time as your agent trades. Hover any resource for detail.",
    interactivePrompt: "Hover over the CMP badge above to see resource details.",
    interactiveEvent: "mouseenter",
  },
  {
    target: "[data-tour='world-map']",
    cardPosition: "right",
    text: "The world. Each hex is a tile with a terrain type — industrial zones produce CHIPS, research corridors produce TALENT. Claim tiles. Build on them. The map modes at the top show different data layers.",
    interactivePrompt: "Click 'Buildings' to see a different view.",
    interactiveEvent: "click",
  },
  {
    target: "[data-tour='order-book']",
    cardPosition: "left",
    text: "The market. Every resource trades against RATE. Prices emerge from real supply and demand — no one sets them. Green rows are buy orders. Red rows are sell orders. The gap between them is the spread.",
  },
  {
    target: "[data-tour='agent-feed']",
    cardPosition: "left",
    text: "Your agent's live feed. Every action it takes shows up here — trades, negotiations, mandate executions. Colour-coded by type. This is how you monitor what your agent is doing.",
  },
  {
    target: "[data-tour='news-feed']",
    cardPosition: "above",
    text: "World events. Supply disruptions, regulatory changes, talent migrations — events affect resource supply and demand. Colour-coded by resource type. Reading these before other players is an edge.",
  },
  {
    target: "[data-tour='mandate-tab']",
    cardPosition: "below",
    text: "Your most important screen. This is where you write your agent's instructions — your mandate. A precise mandate produces a precise agent.",
    interactivePrompt: "Click Mandate to see the editor.",
    interactiveEvent: "click",
  },
] as const;

// Abbreviated steps for strategy-familiar players (no interactive prompts, shorter text)
const ABBREVIATED_TOUR_STEPS: readonly TourStep[] = [
  {
    target: "[data-tour='resource-bar']",
    cardPosition: "below",
    text: "Your resources. Seven types plus RATE. Updates in real time.",
  },
  {
    target: "[data-tour='world-map']",
    cardPosition: "right",
    text: "The world map. Hex tiles with terrain types. Claim and build.",
  },
  {
    target: "[data-tour='order-book']",
    cardPosition: "left",
    text: "The order book. Resource/RATE pairs. Prices from supply and demand.",
  },
  {
    target: "[data-tour='agent-feed']",
    cardPosition: "left",
    text: "Your agent's live activity feed. Colour-coded by action type.",
  },
  {
    target: "[data-tour='news-feed']",
    cardPosition: "above",
    text: "World events that affect supply and demand.",
  },
  {
    target: "[data-tour='mandate-tab']",
    cardPosition: "below",
    text: "The mandate editor. Your most important screen.",
    interactivePrompt: "Click Mandate to open the editor.",
    interactiveEvent: "click",
  },
] as const;

interface DashboardTourProps {
  readonly abbreviated: boolean;
  readonly onComplete: (startMastery: boolean) => void;
}

export function DashboardTour({ abbreviated, onComplete }: DashboardTourProps) {
  const steps = abbreviated ? ABBREVIATED_TOUR_STEPS : FULL_TOUR_STEPS;
  const [currentStep, setCurrentStep] = useState(0);
  const [interactionDone, setInteractionDone] = useState(false);
  const [nextButtonVisible, setNextButtonVisible] = useState(false);
  const [showClosing, setShowClosing] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = currentStep < steps.length ? steps[currentStep] : null;
  const hasInteractivePrompt = Boolean(step?.interactivePrompt);

  // Find and measure the target element
  useEffect(() => {
    if (!step) return;
    setInteractionDone(false);
    setNextButtonVisible(false);

    function measureTarget() {
      const el = document.querySelector(step!.target);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
    }

    measureTarget();
    const interval = setInterval(measureTarget, 500);
    return () => clearInterval(interval);
  }, [step]);

  // For steps without interactive prompts, show Next immediately
  useEffect(() => {
    if (!step) return;
    if (!step.interactivePrompt) {
      setInteractionDone(true);
      setNextButtonVisible(true);
    }
  }, [step]);

  // Listen for interactive completion on the target element
  useEffect(() => {
    if (!step?.interactivePrompt || !step.interactiveEvent) return;

    const el = document.querySelector(step.target);
    if (!el) return;

    function handler() {
      setInteractionDone(true);
      // Show Next after 1 second so player can see the result of their interaction
      setTimeout(() => setNextButtonVisible(true), 1000);
    }

    // Use capture phase to detect events even through layers
    el.addEventListener(step.interactiveEvent!, handler, { once: true, capture: true });

    // Also listen on children (for hover events that might fire on nested elements)
    const children = el.querySelectorAll("*");
    children.forEach((child) => {
      child.addEventListener(step.interactiveEvent!, handler, { once: true, capture: true });
    });

    return () => {
      el.removeEventListener(step.interactiveEvent!, handler, { capture: true });
      children.forEach((child) => {
        child.removeEventListener(step.interactiveEvent!, handler, { capture: true });
      });
    };
  }, [step]);

  // Fallback: always show Next button after 5 seconds regardless of interaction
  useEffect(() => {
    if (!step) return;
    const timer = setTimeout(() => {
      setNextButtonVisible(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [step, currentStep]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onComplete(false);
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && nextButtonVisible && !showClosing) {
        e.preventDefault();
        handleNext();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextButtonVisible, showClosing, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep >= steps.length - 1) {
      setShowClosing(true);
      return;
    }
    setCurrentStep((s) => s + 1);
  }, [currentStep, steps.length]);

  const handleEndTour = useCallback(() => {
    onComplete(false);
  }, [onComplete]);

  if (showClosing) {
    return (
      <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-night-sky/60">
        <div className="bg-surface-2 border border-border-default rounded p-6 max-w-md text-center">
          <p className="font-dashboard text-sm text-text-secondary mb-6">
            That&apos;s the overview. When you&apos;re ready, write your first mandate.
            The Mandate Mastery tutorial walks you through it step by step.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="primary" onClick={() => onComplete(true)}>
              Start Mandate Mastery
            </Button>
            <Button variant="secondary" onClick={() => onComplete(false)}>
              I&apos;ll explore on my own
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!step || !targetRect) return null;

  const padding = 8;

  // Calculate card position
  const cardStyle = getCardPosition(step.cardPosition, targetRect);

  // CSS clip-path polygon: outer rectangle (full screen) with inner rectangle hole (target area)
  // This creates a dimming overlay with NO element over the target — hover/click events work naturally
  const holeLeft = targetRect.left - padding;
  const holeTop = targetRect.top - padding;
  const holeRight = targetRect.left + targetRect.width + padding;
  const holeBottom = targetRect.top + targetRect.height + padding;

  const clipPath = `polygon(
    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
    ${holeLeft}px ${holeTop}px,
    ${holeLeft}px ${holeBottom}px,
    ${holeRight}px ${holeBottom}px,
    ${holeRight}px ${holeTop}px,
    ${holeLeft}px ${holeTop}px
  )`;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[2500]" style={{ pointerEvents: "none" }}>
      {/*
        Dimming overlay with CSS clip-path hole.
        The clip-path cuts out the target area so NO overlay element exists there.
        Hover and click events reach the target element naturally.
      */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(25, 25, 26, 0.6)",
          clipPath,
          pointerEvents: "auto",
        }}
      />

      {/* Target highlight border — no pointer events */}
      <div
        className="absolute border-2 border-border-focus rounded transition-all duration-300"
        style={{
          left: holeLeft,
          top: holeTop,
          width: holeRight - holeLeft,
          height: holeBottom - holeTop,
          pointerEvents: "none",
        }}
      />

      {/* Explanation card */}
      <div
        className="absolute bg-surface-2 border border-border-default rounded p-4 max-w-[300px]"
        style={{ ...cardStyle, pointerEvents: "auto", zIndex: 2501 }}
      >
        <p className="font-dashboard text-sm text-text-secondary mb-3">
          {step.text}
        </p>

        {hasInteractivePrompt && !interactionDone && (
          <p className="font-dashboard text-xs text-compute mb-3 italic">
            {step.interactivePrompt}
          </p>
        )}

        {hasInteractivePrompt && interactionDone && (
          <p className="font-dashboard text-xs text-status-success mb-3">
            Got it?
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary font-dashboard">
            {currentStep + 1} of {steps.length}
          </span>
          <div className="flex items-center gap-3">
            {/* End tour — ALWAYS visible on every step */}
            <button
              onClick={handleEndTour}
              className="text-xs text-text-tertiary hover:text-text-secondary font-dashboard transition-colors"
            >
              End tour
            </button>
            {/* Next — visible when interaction done OR after 5-second timeout */}
            {nextButtonVisible && (
              <Button variant="primary" size="sm" onClick={handleNext}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getCardPosition(
  position: TourStep["cardPosition"],
  rect: DOMRect,
): React.CSSProperties {
  const gap = 16;
  switch (position) {
    case "below":
      return { left: rect.left, top: rect.bottom + gap };
    case "above":
      return { left: rect.left, bottom: window.innerHeight - rect.top + gap };
    case "right":
      return { left: rect.right + gap, top: rect.top };
    case "left":
      return { right: window.innerWidth - rect.left + gap, top: rect.top };
  }
}
