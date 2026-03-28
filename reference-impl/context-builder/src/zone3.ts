import type { GameState } from "./types.js";

const RESOURCE_NAMES = ["COMPUTE", "CHIPS", "DATA", "ENERGY", "TALENT", "COOLING", "CLEARANCE"] as const;

function renderBalances(balances: Record<string, number>): string {
  const rateLine = `- RATE: ${balances["RATE"] ?? 0}`;

  const row1Resources = ["COMPUTE", "CHIPS", "DATA"] as const;
  const row2Resources = ["ENERGY", "TALENT", "COOLING", "CLEARANCE"] as const;

  const row1 = row1Resources
    .map((r) => `${r}: ${balances[r] ?? 0}`)
    .join("  |  ");

  const row2 = row2Resources
    .map((r) => `${r}: ${balances[r] ?? 0}`)
    .join("  |  ");

  return `${rateLine}  |  ${row1}\n- ${row2}`;
}

function renderMarketSnapshot(snapshot: Record<string, { twapPrice: number; bookDepth: number; recentVolume: number }>): string {
  const entries = Object.entries(snapshot);
  if (entries.length === 0) return "";

  const pairs = entries
    .map(([resource, data]) => `${resource}: ${data.twapPrice} RATE`)
    .join("  |  ");

  return `\nMARKET (TWAP):\n- ${pairs}`;
}

function renderCommitments(commitments: { openOrders: number; pendingSettlements: number; activeInsurance: number; activePredictions: number }): string {
  const lines = [
    "\nCOMMITMENTS:",
    `- Open orders: ${commitments.openOrders}`,
    `- Pending settlements: ${commitments.pendingSettlements}`,
  ];
  return lines.join("\n");
}

export function renderZone3(state: GameState): string {
  const lines: string[] = [
    `=== GAME STATE (block ${state.blockNumber}, ${state.timestamp}) ===`,
    "",
    "YOUR POSITION:",
    `- Role: ${state.role}`,
    renderBalances(state.currentBalances),
  ];

  if (state.reputationScore !== undefined) {
    lines.push(`- Reputation: ${state.reputationScore} bps`);
  }

  if (state.epochProgress) {
    lines.push(`- Epoch: ${state.epochProgress.currentEpoch}, ${state.epochProgress.timeRemaining} remaining`);
  }

  if (state.marketSnapshot && Object.keys(state.marketSnapshot).length > 0) {
    lines.push(renderMarketSnapshot(state.marketSnapshot));
  }

  if (state.activeCommitments) {
    lines.push(renderCommitments(state.activeCommitments));
  }

  lines.push("");
  lines.push("=== END GAME STATE ===");

  return lines.join("\n");
}
