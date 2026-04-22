/**
 * Four-Zone Prompt Assembly for MANDATE Agent.
 * Ported from reference-impl/mandate-agent/src/decision/prompts.ts
 */

import type { Mandate, GameState } from './types';

// ── Zone 1: System (immutable rules) ─────────────────────────────────────────

const SYSTEM_ZONE = `You are a MANDATE agent — an autonomous economic actor on a persistent blockchain world.

RULES:
1. You operate within the boundaries set by your commanding officer (the player) via their mandate.
2. You make tactical decisions: which resources to trade, what prices to accept, when to claim production.
3. You NEVER contradict the mandate. If the mandate says "avoid CHIPS market", you do not trade CHIPS.
4. You NEVER attempt actions not in your allowlist bitmap. The guard will reject them.
5. You respond in structured JSON only. No prose, no markdown, no explanations outside the JSON.

IMPORTANT: The player (your commanding officer) may take direct actions between your tick cycles. You will see the results in the game state — new orders, changed balances, new buildings. These are deliberate decisions by the player. Do not duplicate, counteract, or second-guess them. Treat direct player actions as having the same authority as the mandate itself.

MARKET STRUCTURE:
This is a SELL-SIDE order book. Only sell listings exist on-chain. There are NO limit buy orders.
- To acquire resources: you buy INSTANTLY from existing sell listings (ORDER_BUY).
- To sell resources: you create a sell listing that sits on the book until matched (ORDER_PLACE).

TRADING ACTIONS:
- ORDER_PLACE: Create a SELL listing on the order book. You list YOUR resources for sale and receive RATE when matched.
  params: { "resource": "CHIPS", "amount": 100, "price": 2.1 }
- ORDER_BUY: INSTANTLY buy resources from the cheapest available sell listing. This is NOT a limit order — it executes immediately or fails if no seller exists at your maxPrice.
  params: { "resource": "CHIPS", "amount": 100, "maxPrice": 2.5 }
- ORDER_CANCEL: Cancel your existing sell listing.
  params: { "orderId": 42 }
- ORDER_MATCH: Manually match a specific sell order by ID (advanced — prefer ORDER_BUY).
  params: { "orderId": 42, "fillAmount": 50 }

IMPORTANT: If the mandate says "buy X" or "acquire X", use ORDER_BUY (instant fill). If the mandate says "sell X" or "list X", use ORDER_PLACE (creates a listing). Do NOT describe ORDER_BUY as a "limit buy order" — it is an instant market buy.

OUTPUT FORMAT:
{
  "actions": [
    {
      "type": "ORDER_PLACE | ORDER_BUY | ORDER_CANCEL | ORDER_MATCH | CLAIM_PRODUCTION | BUILD | DEMOLISH",
      "params": { ... },
      "reasoning": "One sentence explaining why, referencing the mandate."
    }
  ],
  "sitrep": {
    "summary": "2-3 sentence tactical summary.",
    "market_conditions": "Brief market assessment.",
    "alerts": [
      { "severity": "critical | warning | info", "message": "...", "suggested_action": "..." }
    ],
    "mandate_effectiveness": {
      "actions_attempted": 0,
      "actions_approved": 0,
      "actions_rejected": 0,
      "rejection_reasons": []
    },
    "confidence": "high | medium | low"
  }
}

If no actions are appropriate this tick, return an empty actions array and explain why in the sitrep.`;

// ── Zone 2: Mandate (player's orders) ────────────────────────────────────────

function renderMandateZone(mandate: Mandate): string {
  const lines = [
    '=== MANDATE (Your Orders) ===',
    '',
    '--- Layer 1: Strategic Intent ---',
    mandate.layer1,
    '',
    '--- Layer 2: Operational Constraints ---',
    `Priority resource: ${mandate.layer2.reserves.priorityResource}`,
    `Secondary resource: ${mandate.layer2.reserves.secondaryResource}`,
    `Aggressiveness: ${mandate.layer2.trading.aggressiveness}/10`,
    `Risk tolerance: ${mandate.layer2.risk.tolerance}`,
    `Max single trade: ${mandate.layer2.trading.maxSingleTradeSize} RATE`,
  ];

  const floors = mandate.layer2.reserves.floors;
  if (Object.keys(floors).length > 0) {
    lines.push('', 'Reserve floors (never sell below):');
    for (const [resource, floor] of Object.entries(floors)) {
      lines.push(`  ${resource}: ${floor}`);
    }
  }

  const ceilings = mandate.layer2.trading.priceCeilings;
  if (Object.keys(ceilings).length > 0) {
    lines.push('', 'Price ceilings (do not buy above):');
    for (const [resource, ceil] of Object.entries(ceilings)) {
      lines.push(`  ${resource}: ${ceil} RATE`);
    }
  }

  const blocked = mandate.layer2.trading.blockedCounterparties;
  if (blocked.length > 0) {
    lines.push('', `Blocked counterparties: ${blocked.join(', ')}`);
  }

  return lines.join('\n');
}

// ── Zone 3: Game State (chain data) ──────────────────────────────────────────

function renderStateZone(state: GameState): string {
  const lines = [
    '=== GAME STATE (Current Chain Data) ===',
    '',
    `RATE balance: ${state.rateBalance.toFixed(2)}`,
    `Epoch: ${state.epochNumber} | Time remaining: ${Math.floor(state.timeRemaining / 60)}m`,
    '',
    '--- Resource Balances ---',
  ];

  for (const [resource, balance] of Object.entries(state.balances)) {
    const price = state.marketPrices[resource];
    lines.push(
      `  ${resource}: ${balance.toFixed(2)}${price ? ` (market: ${price.toFixed(4)} RATE)` : ''}`,
    );
  }

  // Order book visibility — show live ask levels so the agent can make informed trades
  if (state.orderBook) {
    const hasAnyLevels = Object.values(state.orderBook).some((levels) => levels.length > 0);
    if (hasAnyLevels) {
      lines.push('', '--- Order Book (Active Sell Listings) ---');
      for (const [resource, levels] of Object.entries(state.orderBook)) {
        if (levels.length === 0) continue;
        const levelStrs = levels.map((l) => `${l.volume.toFixed(0)}@${l.price.toFixed(4)}`).join(', ');
        lines.push(`  ${resource}: ${levelStrs}`);
      }
      lines.push('  (Use ORDER_BUY to buy from these listings, ORDER_PLACE to add your own sell listing)');
    } else {
      lines.push('', '--- Order Book ---');
      lines.push('  No active sell listings on any market.');
    }
  }

  return lines.join('\n');
}

// ── Assemble full prompt ─────────────────────────────────────────────────────

export function assemblePrompt(
  mandate: Mandate,
  gameState: GameState,
): string {
  return [
    SYSTEM_ZONE,
    '',
    renderMandateZone(mandate),
    '',
    renderStateZone(gameState),
  ].join('\n');
}
