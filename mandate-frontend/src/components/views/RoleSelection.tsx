"use client";

import { useState, useEffect, useCallback } from "react";
import type { PlayerRole } from "@/mock/mandate-types";

interface RoleCardData {
  role: PlayerRole;
  name: string;
  advantage: string;
  colourVar: string;
}

const ROLES: readonly RoleCardData[] = [
  {
    role: "Compute Superpower",
    name: "COMPUTE SUPERPOWER",
    advantage: "Large compute capacity. Cheap energy.",
    colourVar: "var(--colour-compute)",
  },
  {
    role: "Data-Rich State",
    name: "DATA-RICH STATE",
    advantage: "Large DATA reserves. Fast DATA regeneration.",
    colourVar: "var(--colour-data)",
  },
  {
    role: "Chip Power",
    name: "CHIP POWER",
    advantage: "CHIPS abundance. Surplus for trade.",
    colourVar: "var(--colour-chips)",
  },
  {
    role: "Talent Hub",
    name: "TALENT HUB",
    advantage: "TALENT regenerates fast.",
    colourVar: "var(--colour-talent)",
  },
  {
    role: "Regulatory Power",
    name: "REGULATORY POWER",
    advantage: "Sets standards others pay CLEARANCE.",
    colourVar: "var(--colour-clearance)",
  },
] as const;

interface RoleSelectionProps {
  readonly onSelect: (role: PlayerRole) => void;
}

export function RoleSelection({ onSelect }: RoleSelectionProps) {
  const [selected, setSelected] = useState<PlayerRole | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const [shuffleIndex, setShuffleIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  // Shuffle animation
  useEffect(() => {
    if (!shuffling) return;
    if (shuffleIndex >= 10) {
      // Pick random role after shuffle
      const randomRole = ROLES[Math.floor(Math.random() * ROLES.length)].role;
      setSelected(randomRole);
      setShuffling(false);
      return;
    }
    const timer = setTimeout(() => setShuffleIndex((i) => i + 1), 100);
    return () => clearTimeout(timer);
  }, [shuffling, shuffleIndex]);

  // After selection, fade out and proceed
  useEffect(() => {
    if (selected && !shuffling) {
      const timer = setTimeout(() => setFadingOut(true), 400);
      return () => clearTimeout(timer);
    }
  }, [selected, shuffling]);

  useEffect(() => {
    if (fadingOut) {
      const timer = setTimeout(() => {
        if (selected) onSelect(selected);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [fadingOut, selected, onSelect]);

  const handleShuffle = useCallback(() => {
    setShuffling(true);
    setShuffleIndex(0);
    setSelected(null);
  }, []);

  const handleCardClick = useCallback((role: PlayerRole) => {
    if (shuffling) return;
    setSelected(role);
  }, [shuffling]);

  // During shuffle, highlight cards in sequence
  const shuffleHighlight = shuffling ? ROLES[shuffleIndex % ROLES.length].role : null;

  return (
    <div
      className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-night-sky transition-opacity duration-500"
      style={{ opacity: fadingOut ? 0 : 1 }}
    >
      <h1 className="font-terminal text-2xl text-text-primary mb-2 tracking-wider">
        MANDATE
      </h1>
      <p className="font-dashboard text-sm text-text-secondary mb-8">
        Select your sovereign role
      </p>

      {/* Top row: 3 cards */}
      <div className="flex gap-4 mb-4">
        {ROLES.slice(0, 3).map((card) => (
          <RoleCard
            key={card.role}
            card={card}
            isSelected={selected === card.role}
            isShuffleHighlight={shuffleHighlight === card.role}
            onClick={() => handleCardClick(card.role)}
            disabled={shuffling}
          />
        ))}
      </div>

      {/* Bottom row: 2 cards */}
      <div className="flex gap-4 mb-8">
        {ROLES.slice(3).map((card) => (
          <RoleCard
            key={card.role}
            card={card}
            isSelected={selected === card.role}
            isShuffleHighlight={shuffleHighlight === card.role}
            onClick={() => handleCardClick(card.role)}
            disabled={shuffling}
          />
        ))}
      </div>

      {/* Let the system decide */}
      <button
        onClick={handleShuffle}
        disabled={shuffling || selected !== null}
        className="font-terminal text-sm text-text-tertiary hover:text-text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        [ Let the system decide ]
      </button>
    </div>
  );
}

// ── Role Card ────────────────────────────────────────────────────────────────

interface RoleCardProps {
  readonly card: RoleCardData;
  readonly isSelected: boolean;
  readonly isShuffleHighlight: boolean;
  readonly onClick: () => void;
  readonly disabled: boolean;
}

function RoleCard({ card, isSelected, isShuffleHighlight, onClick, disabled }: RoleCardProps) {
  const [hovered, setHovered] = useState(false);

  const isHighlighted = isSelected || isShuffleHighlight;
  const showGlow = isHighlighted || hovered;

  const borderColor = isSelected
    ? "var(--border-active)"
    : isShuffleHighlight
      ? card.colourVar
      : hovered
        ? "var(--border-focus)"
        : undefined;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        "w-[200px] h-[160px] rounded p-4 flex flex-col items-center justify-center text-center",
        "border relative",
        isSelected ? "bg-surface-2" : "bg-surface-1",
        disabled && !isShuffleHighlight ? "cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
      style={{
        borderColor: borderColor ?? "var(--border-default)",
        boxShadow: showGlow ? `0 0 20px ${card.colourVar}1F` : "none",
        transform: hovered && !disabled ? "scale(1.04)" : "scale(1)",
        zIndex: hovered ? 1 : 0,
        transition: "transform 200ms ease-out, border-color 200ms ease-out, box-shadow 200ms ease-out",
      }}
    >
      <span className="font-terminal text-sm text-text-primary uppercase tracking-wide mb-3">
        {card.name}
      </span>
      <span className="font-dashboard text-xs text-text-secondary leading-relaxed">
        {card.advantage}
      </span>
    </button>
  );
}
