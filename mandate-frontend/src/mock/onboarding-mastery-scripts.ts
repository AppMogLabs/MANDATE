import type { AgentFeedEntry } from './types';

export interface TimedFeedEntry {
  delay: number;
  entry: AgentFeedEntry;
}

export interface RoundResult {
  tradesExecuted: number;
  avgPrice: number;
  pnl: number;
  annotations?: string[];
  suggestions?: string[];
}

export interface MasteryRoundScript {
  feedEntries: TimedFeedEntry[];
  results: RoundResult;
}

const MOCK_BASE_TS = 1711584000000;
let _idCounter = 100;

function nextId(): string {
  _idCounter += 1;
  return `mastery-${_idCounter}-${MOCK_BASE_TS}`;
}

function mkEntry(
  delay: number,
  agentName: string,
  action: string,
  detail: string,
  tier: AgentFeedEntry['tier'],
  opts?: { mandateClause?: string; resourceType?: AgentFeedEntry['resourceType'] },
): TimedFeedEntry {
  return {
    delay,
    entry: {
      id: nextId(),
      timestamp: MOCK_BASE_TS + delay,
      agentName,
      action,
      detail,
      tier,
      ...(opts?.mandateClause ? { mandateClause: opts.mandateClause } : {}),
      ...(opts?.resourceType ? { resourceType: opts.resourceType } : {}),
    },
  };
}

// ── Step 1: Chaotic agent (top half — without mandate) ─────────────────────

export const chaoticDemoScript: MasteryRoundScript = {
  feedEntries: [
    mkEntry(0, 'Unguided-Agent', 'SELL COMPUTE', 'Sold COMPUTE: 50 units @ 0.45 RATE (market: 1.23 RATE) — 63% below market', 'warning', { resourceType: 'COMPUTE' }),
    mkEntry(1200, 'Unguided-Agent', 'BUY ENERGY', 'Bought ENERGY: 200 units @ 2.10 RATE (market: 0.89 RATE) — 136% premium paid', 'critical', { resourceType: 'ENERGY' }),
    mkEntry(2400, 'Unguided-Agent', 'ACCEPT TRADE', 'Accepted trade: 100 ENERGY for 20 COMPUTE (ratio: 0.2:1, fair value: 1.38:1)', 'warning', { resourceType: 'ENERGY' }),
    mkEntry(3600, 'Unguided-Agent', 'IDLE', 'No action taken — COMPUTE price spike +45% ignored, 0 orders placed', 'info'),
    mkEntry(4800, 'Unguided-Agent', 'SELL DATA', 'Sold DATA: 300 units @ 0.12 RATE to reputation-12 counterparty — bulk dump', 'critical', { resourceType: 'DATA' }),
    mkEntry(6000, 'Unguided-Agent', 'STATUS', 'Session ended. No mandate detected. No strategy applied.', 'critical'),
  ],
  results: {
    tradesExecuted: 4,
    avgPrice: 1.82,
    pnl: -847,
  },
};

// ── Step 1: Strategic agent (bottom half — with mandate) ───────────────────

export const strategicDemoScript: MasteryRoundScript = {
  feedEntries: [
    mkEntry(0, 'Alpha-7', 'SCAN MARKET', 'Order book analysis complete — COMPUTE undervalued at 0.92 RATE', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(1200, 'Alpha-7', 'BUY COMPUTE', 'Placed limit buy: 100 COMPUTE @ 0.95 RATE — below 24h average', 'info', { mandateClause: 'Buy below 24h average', resourceType: 'COMPUTE' }),
    mkEntry(2400, 'Alpha-7', 'REJECT TRADE', 'Rejected: 100 ENERGY for 20 COMPUTE from reputation-12 agent — below min rep', 'info', { mandateClause: 'Min reputation: 60' }),
    mkEntry(3600, 'Alpha-7', 'SELL ENERGY', 'Sold ENERGY: 80 units @ 1.45 RATE — +62.9% margin', 'info', { mandateClause: 'Sell above 1.3x average', resourceType: 'ENERGY' }),
    mkEntry(4800, 'Alpha-7', 'HEDGE EVENT', 'Event detected — shifted 15% portfolio to RATE reserve', 'warning', { mandateClause: 'Auto-hedge on events' }),
    mkEntry(6000, 'Alpha-7', 'STATUS', 'Epoch summary: +312 RATE PnL, 6/7 profitable trades, reputation: 74', 'info'),
  ],
  results: {
    tradesExecuted: 6,
    avgPrice: 1.12,
    pnl: 312,
  },
};

// ── Step 2: Template round (after editing template) ────────────────────────

export const templateRoundScript: MasteryRoundScript = {
  feedEntries: [
    mkEntry(0, 'Alpha-7', 'INIT', 'Mandate received. Parsing directive text...', 'info'),
    mkEntry(800, 'Alpha-7', 'PARSE', 'Detected 4 constraints, 2 resource priorities, 1 risk parameter', 'info'),
    mkEntry(2000, 'Alpha-7', 'BUY COMPUTE', 'Limit buy placed: 60 COMPUTE @ 1.05 RATE', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(3200, 'Alpha-7', 'ORDER FILLED', 'Filled: 60 COMPUTE @ 1.03 RATE — slippage: -0.02', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(4800, 'Alpha-7', 'REJECT TRADE', 'Rejected offer from Agent-X4: ratio below mandate minimum', 'info'),
    mkEntry(6400, 'Alpha-7', 'SELL ENERGY', 'Sold 40 ENERGY @ 1.35 RATE to fund compute acquisition', 'info', { resourceType: 'ENERGY' }),
    mkEntry(8000, 'Alpha-7', 'BUY COMPUTE', 'Second buy: 30 COMPUTE @ 1.08 RATE', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(10000, 'Alpha-7', 'RESERVE CHECK', 'RATE reserves at 420 — above floor. Continuing.', 'info'),
    mkEntry(12000, 'Alpha-7', 'STATUS', 'Round complete: +120 RATE PnL, 4 trades, 1 rejected', 'info'),
  ],
  results: {
    tradesExecuted: 4,
    avgPrice: 1.34,
    pnl: 120,
  },
};

// ── Step 3: Own mandate round ──────────────────────────────────────────────

export const ownMandateRoundScript: MasteryRoundScript = {
  feedEntries: [
    mkEntry(0, 'Alpha-7', 'INIT', 'Custom mandate received. Parsing...', 'info'),
    mkEntry(800, 'Alpha-7', 'PARSE', 'Detected 6 constraints, 2 priorities, 2 risk parameters', 'info'),
    mkEntry(2000, 'Alpha-7', 'SCAN MARKET', 'COMPUTE at 1.18, ENERGY recovering +5.4%', 'info'),
    mkEntry(3500, 'Alpha-7', 'BUY COMPUTE', 'Bought 80 COMPUTE @ 1.15 RATE', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(5000, 'Alpha-7', 'BUY COMPUTE', 'Bought 45 COMPUTE @ 1.12 RATE — filled at ask', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(6500, 'Alpha-7', 'SELL ENERGY', 'Sold 50 ENERGY @ 1.28 RATE', 'info', { resourceType: 'ENERGY' }),
    mkEntry(8000, 'Alpha-7', 'REJECT TRADE', 'Rejected Agent-K9: reputation 38 below minimum 50', 'info'),
    mkEntry(9500, 'Alpha-7', 'WORLD EVENT', 'Event: "Regulatory Tightening" — hedge activated', 'warning'),
    mkEntry(11000, 'Alpha-7', 'BUY CHIPS', 'Post-event: 25 CHIPS @ 2.70 RATE (pre-event: 3.15)', 'info', { resourceType: 'CHIPS' }),
    mkEntry(12500, 'Alpha-7', 'REBALANCE', 'Portfolio balanced. COMPUTE 28%, no single resource >35%', 'info'),
    mkEntry(14000, 'Alpha-7', 'STATUS', 'Round complete: +210 RATE PnL, 6 trades, 1 rejected', 'info'),
  ],
  results: {
    tradesExecuted: 6,
    avgPrice: 1.28,
    pnl: 210,
  },
};

// ── Step 4: Iterated mandate round (must show improvement over Step 3) ─────

export const iteratedMandateRoundScript: MasteryRoundScript = {
  feedEntries: [
    mkEntry(0, 'Alpha-7', 'INIT', 'Revised mandate received. Parsing v2 directive...', 'info'),
    mkEntry(800, 'Alpha-7', 'PARSE', 'Detected 9 constraints, 3 priorities, 3 risk params. Improved specificity.', 'info'),
    mkEntry(2000, 'Alpha-7', 'BUY COMPUTE', 'Bought 100 COMPUTE @ 1.10 RATE — below price ceiling 1.35', 'info', { mandateClause: 'COMPUTE ceiling: 1.35', resourceType: 'COMPUTE' }),
    mkEntry(3200, 'Alpha-7', 'SELL ENERGY', 'Sold 60 ENERGY @ 1.42 RATE — above sell threshold', 'info', { mandateClause: 'Sell above 1.30', resourceType: 'ENERGY' }),
    mkEntry(4400, 'Alpha-7', 'BUY CHIPS', 'Bought 35 CHIPS @ 2.65 RATE — supply constrained, within ceiling', 'info', { resourceType: 'CHIPS' }),
    mkEntry(5600, 'Alpha-7', 'REJECT TRADE', 'Rejected Agent-X4: reputation 32 below threshold 3500', 'info', { mandateClause: 'Min reputation: 3500' }),
    mkEntry(6800, 'Alpha-7', 'ALLIANCE TRADE', 'Preferential trade with ally: 50 DATA @ 1.05 (market: 1.12)', 'info', { mandateClause: 'Alliance preference', resourceType: 'DATA' }),
    mkEntry(8000, 'Alpha-7', 'ARBITRAGE', 'Three-leg arb: CHIPS→DATA→ENERGY→RATE. Spread: 9.2%', 'info'),
    mkEntry(9200, 'Alpha-7', 'ARBITRAGE', 'Arb complete: net +22.4 RATE. Position unwound.', 'info'),
    mkEntry(10400, 'Alpha-7', 'BUILD', 'Tier 1 Data Center built on tile (2,3)', 'info', { resourceType: 'DATA' }),
    mkEntry(12000, 'Alpha-7', 'REBALANCE', 'COMPUTE 29%, CHIPS 18%, ENERGY 16% — all within limits', 'info'),
    mkEntry(13500, 'Alpha-7', 'STATUS', 'Round complete: +340 RATE PnL, 8 trades, 1 rejected, 1 arb cycle', 'info'),
  ],
  results: {
    tradesExecuted: 8,
    avgPrice: 1.31,
    pnl: 340,
    annotations: [
      'Your agent bought COMPUTE at 1.45 when the book had offers at 1.30. No price ceiling was set.',
      'Two trades were rejected by counterparties below your reputation threshold — consider lowering to 3500 to access more liquidity.',
      'CHIPS reserve held at 634 (above your 500 floor ✓)',
    ],
    suggestions: [
      'Add COMPUTE price ceiling: 1.35',
      'Lower reputation threshold to 3500',
      'Add ENERGY sell trigger at 2.0+',
    ],
  },
};
