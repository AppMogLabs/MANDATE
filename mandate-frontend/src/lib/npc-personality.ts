/**
 * NPC personality engine — deterministic rule-based trading strategies.
 * No LLM needed. Each NPC has a simple strategy based on their role and personality.
 */

import type { NPCAgent } from './npc-agents';

const RESOURCES = ['COMPUTE', 'ENERGY', 'CHIPS', 'COOLING', 'TALENT', 'DATA', 'CLEARANCE'] as const;

export interface NPCAction {
  type: 'PLACE_ORDER' | 'MATCH_ORDER';
  resource?: string;
  amount?: number;
  price?: number;
  orderId?: number;
  fillAmount?: number;
}

export interface MarketState {
  balances: Record<string, number>;
  rateBalance: number;
  activeOrders: Array<{
    orderId: number;
    seller: string;
    resource: string;
    amount: number;
    price: number;
  }>;
}

/** Base market prices (RATE per unit) for reference */
const BASE_PRICES: Record<string, number> = {
  COMPUTE: 1.2,
  ENERGY: 0.5,
  CHIPS: 2.1,
  COOLING: 0.8,
  TALENT: 3.5,
  DATA: 1.8,
  CLEARANCE: 1.0,
};

/**
 * Determine what actions an NPC should take this tick.
 * Returns 0-3 actions per tick depending on personality.
 */
export function determineNPCActions(
  npc: NPCAgent,
  state: MarketState,
  tickNumber: number,
): NPCAction[] {
  const actions: NPCAction[] = [];

  // Activity rate varies by personality
  const activityChance = getActivityChance(npc.personality);
  if (Math.random() > activityChance) return actions; // Skip this tick

  // 1. Sell surplus of primary resource
  const primaryBalance = state.balances[npc.primaryResource] ?? 0;
  const sellThreshold = getSellThreshold(npc.personality);
  if (primaryBalance > sellThreshold) {
    const sellAmount = Math.floor(primaryBalance * getSellFraction(npc.personality));
    const price = getSellingPrice(npc, npc.primaryResource);
    if (sellAmount > 0) {
      actions.push({
        type: 'PLACE_ORDER',
        resource: npc.primaryResource,
        amount: sellAmount,
        price,
      });
    }
  }

  // 2. Sell a random non-primary resource occasionally
  if (Math.random() < 0.3) {
    const secondary = pickRandomResource(npc.primaryResource);
    const secBalance = state.balances[secondary] ?? 0;
    if (secBalance > 20) {
      const sellAmt = Math.floor(secBalance * 0.1);
      if (sellAmt > 0) {
        actions.push({
          type: 'PLACE_ORDER',
          resource: secondary,
          amount: sellAmt,
          price: getSellingPrice(npc, secondary),
        });
      }
    }
  }

  // 3. Match favorable buy opportunities
  const buyBudget = state.rateBalance * getBuyBudgetFraction(npc.personality);
  for (const order of state.activeOrders) {
    if (order.seller.toLowerCase() === npc.address.toLowerCase()) continue; // Can't match own
    if (actions.length >= 3) break; // Max 3 actions per tick

    const maxPrice = getMaxBuyPrice(npc, order.resource);
    if (order.price <= maxPrice && order.price * order.amount <= buyBudget) {
      const fillAmount = Math.min(order.amount, Math.floor(buyBudget / order.price));
      if (fillAmount > 0) {
        actions.push({
          type: 'MATCH_ORDER',
          orderId: order.orderId,
          fillAmount,
        });
      }
    }
  }

  return actions;
}

// ── Personality helpers ───────────────────────────────────────────────────────

function getActivityChance(personality: NPCAgent['personality']): number {
  switch (personality) {
    case 'aggressive': return 0.8;
    case 'balanced': return 0.6;
    case 'speculative': return 0.7;
    case 'hoarder': return 0.5;
    case 'conservative': return 0.4;
  }
}

function getSellThreshold(personality: NPCAgent['personality']): number {
  switch (personality) {
    case 'aggressive': return 30;
    case 'balanced': return 50;
    case 'speculative': return 40;
    case 'hoarder': return 80;
    case 'conservative': return 60;
  }
}

function getSellFraction(personality: NPCAgent['personality']): number {
  switch (personality) {
    case 'aggressive': return 0.3;
    case 'balanced': return 0.15;
    case 'speculative': return 0.25;
    case 'hoarder': return 0.05;
    case 'conservative': return 0.1;
  }
}

function getBuyBudgetFraction(personality: NPCAgent['personality']): number {
  switch (personality) {
    case 'aggressive': return 0.3;
    case 'balanced': return 0.15;
    case 'speculative': return 0.2;
    case 'hoarder': return 0.25;
    case 'conservative': return 0.05;
  }
}

function getSellingPrice(npc: NPCAgent, resource: string): number {
  const base = BASE_PRICES[resource] ?? 1.0;
  const jitter = (Math.random() - 0.5) * 0.1; // +/- 5% random

  switch (npc.personality) {
    case 'aggressive': return base * (0.98 + jitter); // Undercuts slightly
    case 'conservative': return base * (1.10 + jitter); // Premium
    case 'hoarder': return base * (1.15 + jitter); // High premium
    case 'speculative': return base * (0.90 + Math.random() * 0.3); // Volatile
    case 'balanced': return base * (1.05 + jitter); // Slight markup
  }
}

function getMaxBuyPrice(npc: NPCAgent, resource: string): number {
  const base = BASE_PRICES[resource] ?? 1.0;

  // NPCs want to buy their non-primary resources
  const isNeeded = resource !== npc.primaryResource;
  if (!isNeeded) return base * 0.5; // Only buy primary at deep discount

  switch (npc.personality) {
    case 'aggressive': return base * 1.05;
    case 'conservative': return base * 0.92;
    case 'hoarder': return resource === 'DATA' ? base * 1.2 : base * 0.95;
    case 'speculative': return base * 1.1;
    case 'balanced': return base * 1.0;
  }
}

function pickRandomResource(exclude: string): string {
  const options = RESOURCES.filter((r) => r !== exclude);
  return options[Math.floor(Math.random() * options.length)];
}
