import type { AgentFeedEntry } from './types';

export interface FeedScript {
  entries: ReadonlyArray<{ delay: number; entry: AgentFeedEntry }>;
}

let _idCounter = 0;
function nextId(): string {
  _idCounter += 1;
  return `feed-${_idCounter}-${1711584000000}`;
}

function mkEntry(
  delay: number,
  agentName: string,
  action: string,
  detail: string,
  tier: AgentFeedEntry['tier'],
  opts?: { mandateClause?: string; resourceType?: AgentFeedEntry['resourceType'] },
): { delay: number; entry: AgentFeedEntry } {
  return {
    delay,
    entry: {
      id: nextId(),
      timestamp: 1711584000000 + delay,
      agentName,
      action,
      detail,
      tier,
      ...(opts?.mandateClause ? { mandateClause: opts.mandateClause } : {}),
      ...(opts?.resourceType ? { resourceType: opts.resourceType } : {}),
    },
  };
}

// ── CHAOTIC AGENT (Onboarding: before mandate) ──────────────────────────────
export const chaoticAgentScript: FeedScript = {
  entries: [
    mkEntry(0, 'Unguided-Agent', 'SELL COMPUTE', 'Sold COMPUTE: 50 units @ 0.45 RATE (market: 1.23 RATE) — 63% below market', 'warning', { resourceType: 'COMPUTE' }),
    mkEntry(1200, 'Unguided-Agent', 'BUY ENERGY', 'Bought ENERGY: 200 units @ 2.10 RATE (market: 0.89 RATE) — 136% premium paid', 'critical', { resourceType: 'ENERGY' }),
    mkEntry(2400, 'Unguided-Agent', 'ACCEPT TRADE', 'Accepted trade: 100 ENERGY for 20 COMPUTE (ratio: 0.2:1, fair value: 1.38:1)', 'warning', { resourceType: 'ENERGY' }),
    mkEntry(3600, 'Unguided-Agent', 'IDLE', 'No action taken — COMPUTE price spike +45% ignored, 0 orders placed', 'info'),
    mkEntry(4800, 'Unguided-Agent', 'SELL DATA', 'Sold DATA: 300 units @ 0.12 RATE to reputation-12 counterparty — bulk dump', 'critical', { resourceType: 'DATA' }),
    mkEntry(6000, 'Unguided-Agent', 'BUY COOLING', 'Bought COOLING: 80 units @ 1.95 RATE — no production use, idle inventory', 'warning', { resourceType: 'COOLING' }),
    mkEntry(7200, 'Unguided-Agent', 'ACCEPT TRADE', 'Accepted: 150 TALENT for 400 RATE (market rate: 0.71 RATE/unit, paid: 2.67)', 'critical', { resourceType: 'TALENT' }),
    mkEntry(8400, 'Unguided-Agent', 'SELL CHIPS', 'Sold CHIPS: 25 units @ 0.30 RATE during supply shortage (market: 3.40 RATE)', 'warning', { resourceType: 'CHIPS' }),
    mkEntry(9200, 'Unguided-Agent', 'STATUS', 'Epoch summary: -847 RATE PnL, 0 profitable trades, reputation: 18/100', 'critical'),
    mkEntry(9800, 'Unguided-Agent', 'IDLE', 'Session ended. No mandate detected. No strategy applied.', 'info'),
  ],
};

// ── STRATEGIC AGENT (Onboarding: with mandate) ──────────────────────────────
export const strategicAgentScript: FeedScript = {
  entries: [
    mkEntry(0, 'Alpha-7', 'SCAN MARKET', 'Order book analysis complete — COMPUTE undervalued at 0.92 RATE (24h avg: 1.23)', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(1200, 'Alpha-7', 'BUY COMPUTE', 'Placed limit buy: 100 COMPUTE @ 0.95 RATE — below 24h moving average', 'info', { mandateClause: 'Buy resources below 0.8 of 24h average', resourceType: 'COMPUTE' }),
    mkEntry(2200, 'Alpha-7', 'ORDER FILLED', 'Buy order filled: 100 COMPUTE @ 0.94 RATE — saved 0.29 RATE/unit vs market', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(3400, 'Alpha-7', 'REJECT TRADE', 'Rejected: 100 ENERGY for 20 COMPUTE from reputation-12 agent — below minimum rep threshold (60)', 'info', { mandateClause: 'Minimum counterparty reputation: 60', resourceType: 'ENERGY' }),
    mkEntry(4600, 'Alpha-7', 'SELL ENERGY', 'Sold ENERGY: 80 units @ 1.45 RATE (acquired at 0.89) — +62.9% margin', 'info', { mandateClause: 'Sell above 1.3x 24h average', resourceType: 'ENERGY' }),
    mkEntry(5800, 'Alpha-7', 'HEDGE EVENT', 'World event detected: "Chip Shortage Alert" — shifted 15% portfolio to RATE reserve', 'warning', { mandateClause: 'Auto-hedge on world events' }),
    mkEntry(6800, 'Alpha-7', 'BUY CHIPS', 'Post-event buy: 40 CHIPS @ 2.10 RATE (pre-event: 3.40) — discount captured', 'info', { resourceType: 'CHIPS' }),
    mkEntry(7800, 'Alpha-7', 'ALLIANCE TRADE', 'Preferential trade with high-rep counterparty: 50 DATA @ 1.05 RATE (market: 1.12) — alliance building', 'info', { mandateClause: 'Accept alliance offers from rep >50', resourceType: 'DATA' }),
    mkEntry(8800, 'Alpha-7', 'REBALANCE', 'Portfolio rebalanced — no single resource exceeds 35% of total value', 'info', { mandateClause: 'No single resource >35%' }),
    mkEntry(9600, 'Alpha-7', 'STATUS', 'Epoch summary: +312 RATE PnL, 6/7 profitable trades, reputation: 74/100', 'info'),
  ],
};

// ── ROUND ONE: Post-submission execution ─────────────────────────────────────
export const roundOneScript: FeedScript = {
  entries: [
    mkEntry(0, 'Agent-R1', 'INIT', 'Mandate received. Parsing directive text...', 'info'),
    mkEntry(800, 'Agent-R1', 'PARSE', 'Detected 4 constraints, 2 resource priorities, 1 risk parameter', 'info'),
    mkEntry(1600, 'Agent-R1', 'SCAN MARKET', 'Order book snapshot captured — 23 active orders across 4 pairs', 'info'),
    mkEntry(2800, 'Agent-R1', 'BUY COMPUTE', 'Limit buy placed: 60 COMPUTE @ 1.05 RATE', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(3800, 'Agent-R1', 'ORDER FILLED', 'Filled: 60 COMPUTE @ 1.03 RATE — slippage: -0.02', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(5000, 'Agent-R1', 'REJECT TRADE', 'Rejected offer from Agent-X4: ratio below mandate minimum', 'info'),
    mkEntry(6200, 'Agent-R1', 'SELL ENERGY', 'Sold 40 ENERGY @ 1.35 RATE to fund compute acquisition', 'info', { resourceType: 'ENERGY' }),
    mkEntry(7400, 'Agent-R1', 'BUY COMPUTE', 'Second buy: 30 COMPUTE @ 1.08 RATE', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(8200, 'Agent-R1', 'RESERVE CHECK', 'RATE reserves at 420 — above floor. Continuing execution.', 'info'),
    mkEntry(9200, 'Agent-R1', 'WORLD EVENT', 'Event: "Energy Grid Overload" — monitoring impact on ENERGY prices', 'warning'),
    mkEntry(10400, 'Agent-R1', 'HOLD', 'Pausing ENERGY trades until event impact stabilizes', 'info', { resourceType: 'ENERGY' }),
    mkEntry(11200, 'Agent-R1', 'BUY COMPUTE', 'Opportunistic buy: 20 COMPUTE @ 0.97 RATE during event dip', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(12400, 'Agent-R1', 'REBALANCE', 'Portfolio check: COMPUTE at 28% of total — within limits', 'info'),
    mkEntry(13600, 'Agent-R1', 'REPUTATION', 'Current reputation: 62/100 — deal completion: 85%', 'info'),
    mkEntry(14400, 'Agent-R1', 'STATUS', 'Round 1 complete: +87 RATE PnL, 4 trades executed, 1 rejected', 'info'),
  ],
};

// ── ROUND TWO: Post-submission execution ─────────────────────────────────────
export const roundTwoScript: FeedScript = {
  entries: [
    mkEntry(0, 'Agent-R2', 'INIT', 'Updated mandate received. Parsing v2 directive...', 'info'),
    mkEntry(1000, 'Agent-R2', 'PARSE', 'Detected 6 constraints, 2 resource priorities, 3 risk parameters, 1 diplomacy rule', 'info'),
    mkEntry(2000, 'Agent-R2', 'SCAN MARKET', 'Market state: COMPUTE +8.2% (1h), ENERGY -3.1%, DATA flat. Spread opportunities detected on CHIPS/RATE.', 'info'),
    mkEntry(3000, 'Agent-R2', 'BUY COMPUTE', 'Limit buy: 80 COMPUTE @ 1.12 RATE — mandate floor price observed', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(4000, 'Agent-R2', 'ORDER FILLED', 'Partial fill: 55/80 COMPUTE @ 1.11 RATE — remainder queued', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(5500, 'Agent-R2', 'REJECT TRADE', 'Rejected: Agent-K9 offer 200 DATA for 50 COMPUTE — counterparty reputation 38 (min: 50)', 'info', { resourceType: 'DATA' }),
    mkEntry(7000, 'Agent-R2', 'SELL DATA', 'Sold 120 DATA @ 1.42 RATE — above mandate sell threshold', 'info', { resourceType: 'DATA' }),
    mkEntry(8500, 'Agent-R2', 'ALLIANCE TRADE', 'Preferential buy from ally Agent-M3: 30 CHIPS @ 2.80 RATE (market: 3.15)', 'info', { mandateClause: 'Preferred counterparty discount', resourceType: 'CHIPS' }),
    mkEntry(10000, 'Agent-R2', 'WORLD EVENT', 'Event: "Regulatory Tightening" — CLEARANCE demand spike +22%', 'warning'),
    mkEntry(11500, 'Agent-R2', 'HEDGE', 'Auto-hedge activated: shifted 10% RATE to CLEARANCE positions', 'info', { mandateClause: 'Auto-hedge on events', resourceType: 'CLEARANCE' }),
    mkEntry(13000, 'Agent-R2', 'ORDER FILLED', 'Remaining 25 COMPUTE filled @ 1.14 RATE — full order complete', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(14500, 'Agent-R2', 'BUY ENERGY', 'Bought 60 ENERGY @ 0.82 RATE — post-event discount', 'info', { resourceType: 'ENERGY' }),
    mkEntry(16000, 'Agent-R2', 'REPUTATION', 'Reputation updated: 68/100 (+6 from Round 1). Deal completion: 91%', 'info'),
    mkEntry(17500, 'Agent-R2', 'ARBITRAGE', 'Detected CHIPS/ENERGY spread at 9.2% — executing round-trip', 'info'),
    mkEntry(19000, 'Agent-R2', 'ARBITRAGE', 'Round-trip complete: CHIPS->ENERGY->RATE. Net: +14.3 RATE', 'info'),
    mkEntry(20500, 'Agent-R2', 'RESERVE CHECK', 'RATE reserves at 580 — healthy margin above floor', 'info'),
    mkEntry(22000, 'Agent-R2', 'BUILD', 'Tier 1 Data Center constructed on tile (2,3) — producing DATA', 'info', { mandateClause: 'Build 1 structure per epoch', resourceType: 'DATA' }),
    mkEntry(24000, 'Agent-R2', 'REBALANCE', 'Portfolio: COMPUTE 31%, DATA 22%, ENERGY 18%, CHIPS 12%, other 17% — balanced', 'info'),
    mkEntry(27000, 'Agent-R2', 'RISK CHECK', 'Max single trade exposure: 120 RATE (limit: 200) — within bounds', 'info'),
    mkEntry(29500, 'Agent-R2', 'STATUS', 'Round 2 complete: +198 RATE PnL, 8 trades executed, 2 rejected, 1 arb cycle. Reputation: 68', 'info'),
  ],
};

// ── ROUND THREE: Post-submission execution ───────────────────────────────────
export const roundThreeScript: FeedScript = {
  entries: [
    mkEntry(0, 'Agent-R3', 'INIT', 'Final mandate revision received. Parsing v3 directive with full constraint set...', 'info'),
    mkEntry(1000, 'Agent-R3', 'PARSE', 'Detected 9 constraints, 3 resource priorities, 4 risk parameters, 2 diplomacy rules, 1 building directive', 'info'),
    mkEntry(2000, 'Agent-R3', 'MARKET SCAN', 'Full market analysis: COMPUTE stable (1.18), ENERGY recovering (+5.4% 1h), CHIPS supply constrained, DATA oversupplied', 'info'),
    mkEntry(3000, 'Agent-R3', 'STRATEGY', 'Execution plan: accumulate COMPUTE + CHIPS, market-make ENERGY/RATE, build on tile (4,1)', 'info'),
    mkEntry(4500, 'Agent-R3', 'BUY COMPUTE', 'Bought 100 COMPUTE @ 1.15 RATE from Agent-M3 (ally discount applied)', 'info', { mandateClause: 'Preferred counterparty trades', resourceType: 'COMPUTE' }),
    mkEntry(6000, 'Agent-R3', 'SELL ENERGY', 'Market-making: sold 50 ENERGY @ 1.28 RATE (bid placed at 1.22, filled at ask)', 'info', { resourceType: 'ENERGY' }),
    mkEntry(7000, 'Agent-R3', 'BUY ENERGY', 'Market-making: bought 45 ENERGY @ 1.19 RATE — spread captured: +4.05 RATE', 'info', { resourceType: 'ENERGY' }),
    mkEntry(8000, 'Agent-R3', 'REJECT TRADE', 'Rejected Agent-X4: CLEARANCE for COMPUTE — blocked counterparty list match', 'info', { mandateClause: 'Blocked counterparties' }),
    mkEntry(9500, 'Agent-R3', 'WORLD EVENT', 'Event: "Talent Migration Wave" — TALENT supply +35%, price dropping', 'warning', { resourceType: 'TALENT' }),
    mkEntry(10500, 'Agent-R3', 'BUY TALENT', 'Opportunistic buy: 80 TALENT @ 0.52 RATE (pre-event: 0.89) — mandate floor respected', 'info', { resourceType: 'TALENT' }),
    mkEntry(12000, 'Agent-R3', 'BUILD', 'Upgraded Data Center (2,3) to Tier 2 — production +40%', 'info', { mandateClause: 'Upgrade existing buildings', resourceType: 'DATA' }),
    mkEntry(13500, 'Agent-R3', 'ARBITRAGE', 'Three-leg arb detected: CHIPS->DATA->ENERGY->RATE. Spread: 11.4%', 'info'),
    mkEntry(15000, 'Agent-R3', 'ARBITRAGE', 'Arb complete: net +28.7 RATE. Position unwound to RATE denomination.', 'info'),
    mkEntry(16500, 'Agent-R3', 'ALLIANCE', 'Alliance proposal sent to Agent-J7 (reputation: 82) — offering CLEARANCE at cost', 'info', { mandateClause: 'Alliance willingness: 8', resourceType: 'CLEARANCE' }),
    mkEntry(18000, 'Agent-R3', 'BUY CHIPS', 'Bought 35 CHIPS @ 2.95 RATE — supply constrained, mandate ceiling not reached', 'info', { resourceType: 'CHIPS' }),
    mkEntry(20000, 'Agent-R3', 'SELL DATA', 'Sold 200 DATA @ 1.08 RATE — oversupply detected, reducing exposure before price decay', 'info', { resourceType: 'DATA' }),
    mkEntry(22000, 'Agent-R3', 'RISK CHECK', 'Portfolio risk assessment: max drawdown 4.2%, single-trade max 95 RATE (limit: 200). All clear.', 'info'),
    mkEntry(24000, 'Agent-R3', 'REPUTATION', 'Reputation: 76/100 (+8). Deal completion: 94%. Activity score: 88/100.', 'info'),
    mkEntry(27000, 'Agent-R3', 'REBALANCE', 'Final rebalance: COMPUTE 29%, CHIPS 18%, ENERGY 16%, TALENT 14%, DATA 12%, other 11%', 'info'),
    mkEntry(29500, 'Agent-R3', 'STATUS', 'Round 3 complete: +347 RATE PnL, 11 trades executed, 2 rejected, 2 arb cycles, 1 build. Reputation: 76', 'info'),
  ],
};

// ── ROUND FOUR: VAGUE AGENT (left side comparison) ──────────────────────────
export const vagueAgentScript: FeedScript = {
  entries: [
    mkEntry(0, 'Vague-Agent', 'INIT', 'Mandate received: "Do well and make profit." Parsing...', 'info'),
    mkEntry(1500, 'Vague-Agent', 'PARSE', 'Detected 0 constraints, 0 resource priorities. Falling back to defaults.', 'warning'),
    mkEntry(3000, 'Vague-Agent', 'BUY COMPUTE', 'Bought 30 COMPUTE @ 1.22 RATE — no price target specified, used market price', 'info', { resourceType: 'COMPUTE' }),
    mkEntry(4500, 'Vague-Agent', 'ACCEPT TRADE', 'Accepted: 80 ENERGY for 40 COMPUTE (ratio: 0.5:1) — no ratio constraints defined', 'warning', { resourceType: 'ENERGY' }),
    mkEntry(6000, 'Vague-Agent', 'IDLE', 'No clear directive for current market conditions. Holding position.', 'info'),
    mkEntry(7500, 'Vague-Agent', 'WORLD EVENT', 'Event: "Energy Grid Overload" — no hedge parameters defined. No action taken.', 'warning'),
    mkEntry(9000, 'Vague-Agent', 'SELL DATA', 'Sold 50 DATA @ 0.95 RATE — marginal profit, no sell threshold specified', 'info', { resourceType: 'DATA' }),
    mkEntry(10500, 'Vague-Agent', 'BUY CHIPS', 'Bought 15 CHIPS @ 3.20 RATE — above market average, no ceiling constraint', 'warning', { resourceType: 'CHIPS' }),
    mkEntry(12000, 'Vague-Agent', 'REPUTATION', 'Reputation: 45/100. Deal completion: 72%. Low activity score.', 'info'),
    mkEntry(14500, 'Vague-Agent', 'STATUS', 'Execution complete: +23 RATE PnL, 4 trades, 0 rejected (no filters). Reputation: 45', 'info'),
  ],
};

// ── ROUND FOUR: SPECIFIC AGENT (right side comparison) ──────────────────────
export const specificAgentScript: FeedScript = {
  entries: [
    mkEntry(0, 'Specific-Agent', 'INIT', 'Mandate received with 8 constraints, 2 priorities, 3 risk params. Executing...', 'info'),
    mkEntry(1500, 'Specific-Agent', 'SCAN MARKET', 'Full scan complete. COMPUTE undervalued by 12%. ENERGY overvalued by 8%. Opportunities identified.', 'info'),
    mkEntry(3000, 'Specific-Agent', 'BUY COMPUTE', 'Bought 75 COMPUTE @ 1.08 RATE — mandate ceiling: 1.15. Saved 0.07/unit vs limit.', 'info', { mandateClause: 'Buy COMPUTE below 1.15 RATE', resourceType: 'COMPUTE' }),
    mkEntry(4500, 'Specific-Agent', 'REJECT TRADE', 'Rejected: 80 ENERGY for 40 COMPUTE from rep-32 agent — mandate min rep: 50', 'info', { mandateClause: 'Min counterparty reputation: 50' }),
    mkEntry(6000, 'Specific-Agent', 'SELL ENERGY', 'Sold 60 ENERGY @ 1.38 RATE — above mandate sell threshold of 1.30', 'info', { mandateClause: 'Sell ENERGY above 1.30 RATE', resourceType: 'ENERGY' }),
    mkEntry(7500, 'Specific-Agent', 'HEDGE', 'Event detected: "Energy Grid Overload" — auto-hedge activated, RATE reserve +15%', 'warning', { mandateClause: 'Auto-hedge on world events' }),
    mkEntry(9000, 'Specific-Agent', 'BUY CHIPS', 'Post-event opportunity: 25 CHIPS @ 2.70 RATE (pre-event: 3.20). Mandate ceiling: 3.00.', 'info', { mandateClause: 'Buy CHIPS below 3.00 RATE', resourceType: 'CHIPS' }),
    mkEntry(10500, 'Specific-Agent', 'ARBITRAGE', 'Arb cycle: DATA->COOLING->RATE. Net: +18.4 RATE. Position neutral.', 'info'),
    mkEntry(12000, 'Specific-Agent', 'REPUTATION', 'Reputation: 71/100. Deal completion: 93%. Activity score: 85/100.', 'info'),
    mkEntry(14500, 'Specific-Agent', 'STATUS', 'Execution complete: +241 RATE PnL, 6 trades, 1 rejected, 1 arb. Reputation: 71', 'info'),
  ],
};
