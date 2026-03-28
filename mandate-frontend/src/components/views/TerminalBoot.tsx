"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { PlayerRole } from "@/mock/mandate-types";
import { BOOT_SCRIPTS, type BootLine } from "@/mock/onboarding-boot-scripts";

interface TerminalBootProps {
  readonly role: PlayerRole;
  readonly onComplete: () => void;
}

interface DisplayLine {
  text: string;
  isLabel: boolean;
}

// Typing speed: 50 chars/sec = 20ms per char
const CHAR_DELAY = 20;
// Rethink delete speed: 40ms per char
const RETHINK_DELETE_DELAY = 40;

type BootPhase = "typing" | "holding" | "fading-text" | "m-icon" | "fading-in" | "done";

export function TerminalBoot({ role, onComplete }: TerminalBootProps) {
  const [lines, setLines] = useState<DisplayLine[]>([]);
  const [currentLineText, setCurrentLineText] = useState("");
  const [currentLineIsLabel, setCurrentLineIsLabel] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [finished, setFinished] = useState(false);
  const [showSkipHint, setShowSkipHint] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [bootPhase, setBootPhase] = useState<BootPhase>("typing");
  const [mIconOpacity, setMIconOpacity] = useState(0);
  const [mIconScale, setMIconScale] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const script = BOOT_SCRIPTS[role];

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  // Show skip hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowSkipHint(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll to keep typing position at ~70% of viewport
  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current;
      const targetScroll = el.scrollHeight - el.clientHeight * 0.3;
      if (targetScroll > el.scrollTop) {
        el.scrollTo({ top: targetScroll, behavior: "smooth" });
      }
    }
  }, [lines, currentLineText]);

  // Skip handler
  const handleSkip = useCallback(() => {
    abortRef.current = true;
    if (animationRef.current) clearTimeout(animationRef.current);

    // Instantly reveal all remaining text
    const allLines: DisplayLine[] = script.lines.map((line) => {
      let text = line.text;
      if (line.rethink) {
        // Show the replacement version directly
        text = text.replace(line.rethink.replacement, line.rethink.replacement);
      }
      return { text, isLabel: line.isLabel };
    });

    setLines(allLines);
    setCurrentLineText("");
    setFinished(true);
  }, [script]);

  // Main typing animation
  useEffect(() => {
    abortRef.current = false;

    async function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => {
        animationRef.current = setTimeout(resolve, ms);
      });
    }

    async function typeChar(text: string, charIndex: number, isLabel: boolean): Promise<void> {
      if (abortRef.current) return;
      setCurrentLineIsLabel(isLabel);
      setCurrentLineText(text.slice(0, charIndex + 1));
      await sleep(CHAR_DELAY);
    }

    async function deletePart(fullText: string, original: string): Promise<void> {
      if (abortRef.current) return;
      // Find the position of the original word in the typed text so far
      const idx = fullText.lastIndexOf(original);
      if (idx === -1) return;

      // Delete character by character
      for (let i = original.length - 1; i >= 0; i--) {
        if (abortRef.current) return;
        setCurrentLineText(fullText.slice(0, idx + i));
        await sleep(RETHINK_DELETE_DELAY);
      }
    }

    async function typeLine(line: BootLine): Promise<void> {
      if (abortRef.current) return;

      let text = line.text;

      if (line.rethink) {
        // Type with the original word first
        const textWithOriginal = text.replace(line.rethink.replacement, line.rethink.original);

        for (let i = 0; i < textWithOriginal.length; i++) {
          if (abortRef.current) return;
          await typeChar(textWithOriginal, i, line.isLabel);
        }

        // Pause before rethinking
        await sleep(300);

        // Delete the original word
        await deletePart(textWithOriginal, line.rethink.original);

        // Type the replacement word
        const idx = textWithOriginal.lastIndexOf(line.rethink.original);
        const prefix = textWithOriginal.slice(0, idx);
        const suffix = text.slice(idx + line.rethink.replacement.length);

        for (let i = 0; i < line.rethink.replacement.length; i++) {
          if (abortRef.current) return;
          setCurrentLineText(prefix + line.rethink.replacement.slice(0, i + 1) + (i === line.rethink.replacement.length - 1 ? suffix : ""));
          await sleep(CHAR_DELAY);
        }
        // Final full line
        setCurrentLineText(text);
      } else {
        // Normal typing
        for (let i = 0; i < text.length; i++) {
          if (abortRef.current) return;
          await typeChar(text, i, line.isLabel);
        }
      }

      // Commit the line
      if (!abortRef.current) {
        setLines((prev) => [...prev, { text, isLabel: line.isLabel }]);
        setCurrentLineText("");
      }

      // Pause after line
      const pause = line.pauseAfter ?? 100;
      if (pause > 0 && !abortRef.current) {
        await sleep(pause);
      }
    }

    async function runScript(): Promise<void> {
      for (const line of script.lines) {
        if (abortRef.current) return;
        await typeLine(line);
      }
      if (!abortRef.current) {
        setFinished(true);
      }
    }

    runScript();

    return () => {
      abortRef.current = true;
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [script]);

  // Phase progression: typing → holding (12s) → fading-text (500ms) → m-icon (1400ms) → done
  useEffect(() => {
    if (!finished || bootPhase !== "typing") return;
    setBootPhase("holding");
    const timer = setTimeout(() => setBootPhase("fading-text"), 12000);
    return () => clearTimeout(timer);
  }, [finished, bootPhase]);

  // Fade out terminal text
  useEffect(() => {
    if (bootPhase !== "fading-text") return;
    setFadingOut(true);
    const timer = setTimeout(() => setBootPhase("m-icon"), 700); // 500ms fade + 200ms black
    return () => clearTimeout(timer);
  }, [bootPhase]);

  // M icon animation: fade in (400ms) → hold with pulse (600ms) → fade out (400ms)
  useEffect(() => {
    if (bootPhase !== "m-icon") return;

    // Fade in
    const t0 = setTimeout(() => setMIconOpacity(0.3), 50);
    // Pulse at midpoint
    const t1 = setTimeout(() => setMIconScale(1.03), 400);
    const t2 = setTimeout(() => setMIconScale(1.0), 800);
    // Fade out
    const t3 = setTimeout(() => setMIconOpacity(0), 1000);
    // Complete
    const t4 = setTimeout(() => setBootPhase("done"), 1600);

    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [bootPhase]);

  // Done → notify parent
  useEffect(() => {
    if (bootPhase !== "done") return;
    const timer = setTimeout(onComplete, 200);
    return () => clearTimeout(timer);
  }, [bootPhase, onComplete]);

  // Click/keypress to skip — two-press pattern:
  // 1st press during typing: reveals all text instantly, starts 12-second hold
  // 2nd press during hold: immediately triggers fade → M icon → dashboard
  useEffect(() => {
    function handleInteraction(e: Event) {
      e.stopPropagation();

      if (bootPhase === "fading-text" || bootPhase === "m-icon" || bootPhase === "done") return;

      if (bootPhase === "holding") {
        // Second press during hold → skip to fading text
        setBootPhase("fading-text");
        return;
      }

      // First press during typing → reveal all text
      handleSkip();
    }

    window.addEventListener("click", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [bootPhase, handleSkip]);

  // M icon phase — render only the MegaETH icon on black background
  if (bootPhase === "m-icon" || bootPhase === "done") {
    return (
      <div className="fixed inset-0 z-[3000] bg-night-sky flex items-center justify-center">
        <svg
          width="120"
          height="120"
          viewBox="0 0 105 105"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            opacity: mIconOpacity,
            transform: `scale(${mIconScale})`,
            transition: "opacity 400ms ease-in-out, transform 400ms ease-in-out",
            color: "var(--moon-white)",
          }}
        >
          <path d="M62.7534 81.6321C65.9781 81.6321 68.5825 79.0297 68.5825 75.8195C68.5825 72.6093 65.9781 70.0068 62.7534 70.0068C59.5536 70.0068 56.9492 72.6093 56.9492 75.8195C56.9492 79.0297 59.5536 81.6321 62.7534 81.6321Z" fill="currentColor"/>
          <path d="M41.8648 81.805C45.0894 81.805 47.6693 79.2026 47.6693 75.9923C47.6693 72.7821 45.0894 70.1797 41.8648 70.1797C38.665 70.1797 36.0605 72.7821 36.0605 75.9923C36.0605 79.2026 38.665 81.805 41.8648 81.805Z" fill="currentColor"/>
          <path d="M29.1376 21.0791H42.9855C45.5913 28.1286 52.3911 48.1021 52.8874 49.215C53.0115 48.6586 59.8608 26.8919 61.7966 21.2028H76.1904V70.8582C74.4036 69.8687 72.6166 68.8795 70.6809 67.7662C69.3407 67.0863 68.1 66.344 66.7351 65.7875C66.611 56.1409 66.487 46.5561 66.1892 36.5385C64.2535 42.2894 57.5776 62.5721 57.0316 63.1286H48.1225C48.1225 63.1286 39.4613 38.5172 39.0394 37.4042C38.9154 46.8653 38.7913 56.3264 38.4687 66.0968C33.1579 68.8175 30.0063 70.3635 29.0137 70.7344V21.0791H29.1376Z" fill="currentColor"/>
          <path d="M52.5124 8.34804C76.8081 8.34804 96.6616 28.136 96.6616 52.4999C96.6616 76.864 76.8825 96.6519 52.5124 96.6519C28.1423 96.6519 8.36325 76.864 8.36325 52.4999C8.36325 28.136 28.1423 8.34804 52.5124 8.34804ZM52.5124 0C23.5016 0 0 23.4983 0 52.4999C0 81.5016 23.5016 105 52.5124 105C81.4984 105 105 81.5016 105 52.4999C105 23.4983 81.4984 0 52.5124 0Z" fill="currentColor"/>
        </svg>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[3000] bg-night-sky transition-opacity duration-500"
      style={{ opacity: fadingOut ? 0 : 1 }}
    >
      <div
        ref={containerRef}
        className="h-full overflow-y-auto px-8 py-12"
        style={{ maxWidth: "70ch", margin: "0 auto" }}
      >
        {/* Completed lines */}
        {lines.map((line, i) => (
          <TerminalLine key={i} text={line.text} isLabel={line.isLabel} />
        ))}

        {/* Current typing line */}
        {!finished && currentLineText !== "" && (
          <TerminalLine
            text={currentLineText}
            isLabel={currentLineIsLabel}
            cursor={cursorVisible}
          />
        )}

        {/* Blinking cursor on empty line while between lines */}
        {!finished && currentLineText === "" && lines.length > 0 && (
          <span
            className="inline-block w-2 h-4 font-terminal"
            style={{
              backgroundColor: cursorVisible ? "var(--colour-data)" : "transparent",
            }}
          />
        )}

        {/* Final cursor blink on last line */}
        {finished && (
          <span
            className="inline-block w-2 h-4 font-terminal ml-0.5"
            style={{
              backgroundColor: cursorVisible ? "var(--colour-data)" : "transparent",
            }}
          />
        )}
      </div>

      {/* Skip hint */}
      {showSkipHint && !finished && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-text-tertiary text-xs font-dashboard">
          Press any key to skip
        </div>
      )}
    </div>
  );
}

// ── Terminal Line ────────────────────────────────────────────────────────────

interface TerminalLineProps {
  readonly text: string;
  readonly isLabel: boolean;
  readonly cursor?: boolean;
}

function TerminalLine({ text, isLabel, cursor }: TerminalLineProps) {
  if (text === "") {
    return <div className="h-5" />;
  }

  return (
    <div
      className="font-terminal text-sm leading-6 whitespace-pre-wrap"
      style={{
        color: isLabel ? "var(--text-primary)" : "var(--colour-data)",
      }}
    >
      {text}
      {cursor && (
        <span
          className="inline-block w-2 h-4 ml-0.5 align-text-bottom"
          style={{ backgroundColor: "var(--colour-data)" }}
        />
      )}
    </div>
  );
}
