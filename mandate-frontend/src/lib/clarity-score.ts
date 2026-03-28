import type { ResourceType } from "@/mock/types";

export interface ClarityBreakdown {
  specificity: number;
  constraints: number;
  priorities: number;
  completeness: number;
  total: number;
}

const RESOURCE_NAMES: ResourceType[] = [
  "COMPUTE", "ENERGY", "CHIPS", "COOLING", "TALENT", "DATA", "CLEARANCE",
];
const RESOURCE_ABBREVS = ["CMP", "NRG", "CHP", "CLG", "TLT", "DTA", "CLR"];
const PRIORITY_WORDS = [
  "prioriti", "first", "then", "before", "after", "primary", "secondary",
  "high priority", "low priority", "most important", "focus",
];
const CONSTRAINT_PATTERNS = [
  /\bminimum\b/i, /\bmaximum\b/i, /\bat least\b/i, /\bat most\b/i,
  /\bno less than\b/i, /\bno more than\b/i, /\bbelow\b/i, /\babove\b/i,
  /\bfloor\b/i, /\bceiling\b/i, /\breject\b/i, /\bnever\b/i,
  /\bonly if\b/i, /\bunless\b/i, /\bif\s+.+then/i, /\blimit\b/i,
];
const DOMAIN_KEYWORDS = {
  trading: ["trade", "buy", "sell", "order", "market", "ratio", "price"],
  building: ["build", "construct", "upgrade", "tile", "expand"],
  risk: ["reserve", "floor", "hedge", "insurance", "limit", "cap"],
  diplomacy: ["negotiate", "alliance", "reputation", "cooperat", "partner"],
};

function scoreSpecificity(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();

  // Resource names mentioned
  const resourceCount = RESOURCE_NAMES.filter(
    (r) => lower.includes(r.toLowerCase())
  ).length;
  score += Math.min(10, resourceCount * 2);

  // Abbreviations
  const abbrevCount = RESOURCE_ABBREVS.filter((a) =>
    text.includes(a)
  ).length;
  score += Math.min(5, abbrevCount);

  // Numbers present
  const numbers = text.match(/\d+(\.\d+)?/g) || [];
  score += Math.min(10, numbers.length * 2);

  return Math.min(25, score);
}

function scoreConstraints(text: string): number {
  let score = 0;
  for (const pattern of CONSTRAINT_PATTERNS) {
    if (pattern.test(text)) score += 3;
  }
  // Numeric constraints (number near a resource name)
  const lines = text.split("\n");
  for (const line of lines) {
    if (/\d/.test(line) && RESOURCE_NAMES.some((r) => line.toUpperCase().includes(r))) {
      score += 2;
    }
  }
  return Math.min(25, score);
}

function scorePriorities(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();
  for (const word of PRIORITY_WORDS) {
    if (lower.includes(word)) score += 4;
  }
  // Ordered lists (numbered items or "first...then...finally")
  if (/\b(1\.|first)\b/i.test(text) && /\b(2\.|then|second)\b/i.test(text)) {
    score += 5;
  }
  return Math.min(25, score);
}

function scoreCompleteness(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();
  for (const [, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      score += 6;
    }
  }
  return Math.min(25, score);
}

export function calculateClarityScore(text: string): ClarityBreakdown {
  const specificity = scoreSpecificity(text);
  const constraints = scoreConstraints(text);
  const priorities = scorePriorities(text);
  const completeness = scoreCompleteness(text);

  return {
    specificity,
    constraints,
    priorities,
    completeness,
    total: specificity + constraints + priorities + completeness,
  };
}

export function getClarityColour(score: number): string {
  if (score >= 70) return "var(--status-success)";
  if (score >= 30) return "var(--status-warning)";
  return "var(--status-critical)";
}
