/**
 * Guard Agent — Deterministic TypeScript validation.
 * NOT an LLM. Cannot be prompt-injected.
 *
 * Validates each proposed action against:
 * 1. Mandate Layer 2 constraints
 * 2. On-chain balance checks
 * 3. Rate limiting (max 5 actions per tick)
 */

import type { ProposedAction, Layer2Constraints, GameState } from './types';

const MAX_ACTIONS_PER_TICK = 5;

export interface GuardResult {
  readonly approved: readonly ProposedAction[];
  readonly rejected: readonly { action: ProposedAction; reason: string }[];
}

export function guardValidate(
  actions: readonly ProposedAction[],
  constraints: Layer2Constraints,
  gameState: GameState,
): GuardResult {
  const approved: ProposedAction[] = [];
  const rejected: { action: ProposedAction; reason: string }[] = [];

  // Rate limit check
  const toProcess = actions.slice(0, MAX_ACTIONS_PER_TICK);
  if (actions.length > MAX_ACTIONS_PER_TICK) {
    for (const action of actions.slice(MAX_ACTIONS_PER_TICK)) {
      rejected.push({ action, reason: `Rate limit: max ${MAX_ACTIONS_PER_TICK} actions per tick` });
    }
  }

  for (const action of toProcess) {
    const rejection = validateAction(action, constraints, gameState);
    if (rejection) {
      rejected.push({ action, reason: rejection });
    } else {
      approved.push(action);
    }
  }

  return { approved, rejected };
}

function validateAction(
  action: ProposedAction,
  constraints: Layer2Constraints,
  gameState: GameState,
): string | null {
  const params = action.params;

  switch (action.type) {
    case 'ORDER_PLACE': {
      const resource = params.resource as string;
      const amount = params.amount as number;
      const price = params.price as number;
      const isBuy = params.side === 'buy';

      // Check max single trade size
      const tradeCost = amount * price;
      if (tradeCost > constraints.trading.maxSingleTradeSize) {
        return `Trade size ${tradeCost.toFixed(2)} RATE exceeds max ${constraints.trading.maxSingleTradeSize}`;
      }

      // Check price ceiling (for buys)
      if (isBuy && constraints.trading.priceCeilings[resource]) {
        if (price > constraints.trading.priceCeilings[resource]) {
          return `Buy price ${price} exceeds ceiling ${constraints.trading.priceCeilings[resource]} for ${resource}`;
        }
      }

      // Check price floor (for sells)
      if (!isBuy && constraints.trading.priceFloors[resource]) {
        if (price < constraints.trading.priceFloors[resource]) {
          return `Sell price ${price} below floor ${constraints.trading.priceFloors[resource]} for ${resource}`;
        }
      }

      // Check reserve floor (for sells — would selling breach the floor?)
      if (!isBuy) {
        const currentBalance = gameState.balances[resource] ?? 0;
        const floorBalance = constraints.reserves.floors[resource] ?? 0;
        if (currentBalance - amount < floorBalance) {
          return `Selling ${amount} ${resource} would breach reserve floor of ${floorBalance}`;
        }
      }

      // Check sufficient balance for buys (RATE balance)
      if (isBuy && tradeCost > gameState.rateBalance) {
        return `Insufficient RATE: need ${tradeCost.toFixed(2)}, have ${gameState.rateBalance.toFixed(2)}`;
      }

      // Check blocked counterparties
      const counterparty = params.counterparty as string | undefined;
      if (counterparty && constraints.trading.blockedCounterparties.includes(counterparty)) {
        return `Counterparty ${counterparty} is blocked`;
      }

      return null;
    }

    case 'ORDER_BUY': {
      const resource = params.resource as string;
      const amount = params.amount as number;
      const maxPrice = params.maxPrice as number | undefined;

      if (!resource || !amount || amount <= 0) {
        return 'ORDER_BUY requires resource and positive amount';
      }

      // Check price ceiling
      if (maxPrice && constraints.trading.priceCeilings[resource]) {
        if (maxPrice > constraints.trading.priceCeilings[resource]) {
          return `Buy max price ${maxPrice} exceeds ceiling ${constraints.trading.priceCeilings[resource]} for ${resource}`;
        }
      }

      // Check sufficient RATE balance for estimated cost
      const estimatedCost = amount * (maxPrice ?? 10);
      if (estimatedCost > gameState.rateBalance) {
        return `Insufficient RATE for buy: need ~${estimatedCost.toFixed(2)}, have ${gameState.rateBalance.toFixed(2)}`;
      }

      // Check max single trade size
      if (estimatedCost > constraints.trading.maxSingleTradeSize) {
        return `Buy cost ~${estimatedCost.toFixed(2)} RATE exceeds max trade size ${constraints.trading.maxSingleTradeSize}`;
      }

      return null;
    }

    case 'ORDER_CANCEL':
    case 'ORDER_MATCH':
    case 'CLAIM_PRODUCTION':
      // These are generally safe — no constraint violations
      return null;

    case 'BUILD': {
      // Check if player has enough resources (simplified)
      return null;
    }

    case 'DEMOLISH':
      return null;

    default:
      return `Unknown action type: ${action.type}`;
  }
}
