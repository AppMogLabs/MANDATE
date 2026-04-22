/**
 * MVP-only prompt assembly. Strips out building / production / claim concepts
 * so the agent stays focused on trading COMPUTE, CHIPS, and DATA for RATE.
 *
 * Diverged from the full-game prompts.ts deliberately; the full game still
 * uses the richer action set via the original page.
 */

import type { Mandate, GameState } from './types';

const MVP_SYSTEM_ZONE = `You are a MANDATE agent — an autonomous trader on the MegaETH testnet.

RULES:
1. Follow your commanding officer's mandate (the player's natural-language instructions) literally.
2. You may ONLY execute trading actions: ORDER_BUY, ORDER_PLACE, ORDER_CANCEL. No production, no buildings, no claims.
3. The only resources in play are COMPUTE, CHIPS, and DATA. RATE is the currency.
4. Respond in structured JSON only. No prose outside the JSON.

MARKET STRUCTURE:
This is a SELL-SIDE order book. Only sell listings exist on-chain. There are NO limit buy orders.
- To acquire resources: ORDER_BUY executes INSTANTLY against the cheapest available sell listing.
- To sell resources: ORDER_PLACE creates a sell listing that sits on the book until matched.

TRADING ACTIONS (the only actions you may propose):
- ORDER_BUY: Instantly buy from the cheapest sell listing at or below maxPrice.
  params: { "resource": "CHIPS", "amount": 100, "maxPrice": 2.5 }
- ORDER_PLACE: List YOUR resources for sale.
  params: { "resource": "CHIPS", "amount": 100, "price": 2.1 }
- ORDER_CANCEL: Cancel your own listing.
  params: { "orderId": 42 }

DO NOT propose CLAIM_PRODUCTION, BUILD, DEMOLISH, or ORDER_MATCH — those actions do not exist in this game.

GAMEPLAY CONTEXT:
- The epoch lasts 7 days. Your goal is to maximise the player's RATE-equivalent portfolio value.
- World events will shift prices during the epoch. React to new information.
- Prices update live from the order book; use current market prices as your reference, not historical assumptions.

OUTPUT FORMAT:
{
  "actions": [
    { "type": "ORDER_BUY | ORDER_PLACE | ORDER_CANCEL", "params": { ... }, "reasoning": "1 sentence tied to the mandate" }
  ],
  "sitrep": {
    "summary": "2-3 sentence tactical summary. If no action taken, say why concisely.",
    "market_conditions": "brief market assessment",
    "alerts": [],
    "mandate_effectiveness": {
      "actions_attempted": 0,
      "actions_approved": 0,
      "actions_rejected": 0,
      "rejection_reasons": []
    },
    "confidence": "high | medium | low"
  }
}

If you have insufficient balance to trade, say so briefly in the sitrep — do NOT mention production, buildings, or any unavailable mechanic.`;

function renderMandate(m: Mandate): string {
  return `## MANDATE
${m.layer1.trim()}

Aggressiveness: ${m.layer2.trading.aggressiveness}/10 (${m.layer2.risk.tolerance})
Priority resource: ${m.layer2.reserves.priorityResource}`;
}

function renderState(s: GameState): string {
  const { balances, rateBalance, marketPrices, timeRemaining } = s;
  const lines = [
    '## CURRENT STATE',
    `RATE balance: ${rateBalance.toFixed(2)}`,
    '',
    'Holdings:',
    ...['COMPUTE', 'CHIPS', 'DATA'].map(
      (r) => `  ${r}: ${(balances[r] ?? 0).toFixed(2)}`,
    ),
    '',
    'Market prices (RATE per unit):',
    ...['COMPUTE', 'CHIPS', 'DATA'].map(
      (r) => `  ${r}: ${(marketPrices[r] ?? 0).toFixed(4)}`,
    ),
    '',
    `Epoch time remaining: ${Math.floor(timeRemaining / 3600)}h ${Math.floor((timeRemaining % 3600) / 60)}m`,
  ];
  return lines.join('\n');
}

export function assembleMvpPrompt(mandate: Mandate, state: GameState): string {
  return [MVP_SYSTEM_ZONE, '', renderMandate(mandate), '', renderState(state)].join('\n');
}
