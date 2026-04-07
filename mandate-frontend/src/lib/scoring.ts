/**
 * MANDATE — AGI Progress Score Computation
 *
 * Composite of four equally-weighted components (25% each).
 * Each component scores 0–2500, total range 0–10,000.
 *
 * // TODO: Confirm AGI Progress Score weights with game design
 */

export interface AGIScoreInput {
  /** Player's resource balances (raw numbers, already formatted from 18 decimals) */
  resourceBalances: Record<string, number>;
  /** Total circulating supply per resource (for normalization) */
  totalSupplies: Record<string, number>;
  /** Player's buildings: array of { buildingType, tier } */
  buildings: Array<{ buildingType: number; tier: number }>;
  /** ReputationLedger composite score (0–10000 bps) */
  reputationScore: number;
  /** InformationMarket subscription tier: 0=free, 1=analyst, 2=premium */
  subscriptionTier: number;
  /** MandateEchoOracle reliability score (0–10000 bps) */
  echoReliability: number;
}

export interface AGIScoreResult {
  total: number;        // 0–10000
  resources: number;    // 0–2500
  buildings: number;    // 0–2500
  intelligence: number; // 0–2500
  chain: number;        // 0–2500
}

// Building type importance weights for building score
// Processing > Production > Influence > Yield > Infrastructure
const BUILDING_TYPE_WEIGHTS: Record<number, number> = {
  7: 5,   // Training Cluster (processing)
  8: 5,   // Alignment Lab (processing)
  12: 5,  // Deployed Model (processing)
  0: 3,   // Data Centre (production)
  1: 3,   // Power Plant (production)
  3: 3,   // Fabrication Contract (production)
  5: 3,   // Data Acquisition Hub (production)
  9: 2,   // Lobbying Office (influence)
  13: 2,  // Patent Portfolio (influence)
  4: 2,   // Recruiting Pipeline (yield)
  6: 2,   // Cooling Infrastructure (yield)
  2: 1,   // Solar Array (infrastructure)
  10: 1,  // Intelligence Network
  11: 1,  // Media Arm
  14: 1,  // Road
  15: 1,  // Security Perimeter
};

// Tier multipliers
const TIER_MULTIPLIER: Record<number, number> = { 1: 1, 2: 1.5, 3: 2.25 };

export function computeAGIProgressScore(input: AGIScoreInput): AGIScoreResult {
  const resources = computeResourceScore(input.resourceBalances, input.totalSupplies);
  const buildings = computeBuildingScore(input.buildings);
  const intelligence = computeIntelligenceScore(input.reputationScore, input.subscriptionTier, input.echoReliability);
  const chain = computeProcessingChainScore(input.buildings);

  return {
    total: resources + buildings + intelligence + chain,
    resources,
    buildings,
    intelligence,
    chain,
  };
}

function computeResourceScore(balances: Record<string, number>, totalSupplies: Record<string, number>): number {
  const resources = ['COMPUTE', 'ENERGY', 'CHIPS', 'COOLING', 'TALENT', 'DATA', 'CLEARANCE'];
  let sumRatio = 0;
  let count = 0;

  for (const r of resources) {
    const balance = balances[r] ?? 0;
    const supply = totalSupplies[r] ?? 1; // avoid division by zero
    if (supply > 0) {
      sumRatio += Math.min(balance / supply, 1); // cap at 1
      count++;
    }
  }

  const avgRatio = count > 0 ? sumRatio / count : 0;
  return Math.round(avgRatio * 2500);
}

function computeBuildingScore(buildings: Array<{ buildingType: number; tier: number }>): number {
  if (buildings.length === 0) return 0;

  let weightedSum = 0;
  // Max possible: assume 10 max-tier processing buildings = 10 * 5 * 2.25 = 112.5
  const MAX_BUILDING_SCORE = 112.5;

  for (const b of buildings) {
    const weight = BUILDING_TYPE_WEIGHTS[b.buildingType] ?? 1;
    const tierMult = TIER_MULTIPLIER[b.tier] ?? 1;
    weightedSum += weight * tierMult;
  }

  const ratio = Math.min(weightedSum / MAX_BUILDING_SCORE, 1);
  return Math.round(ratio * 2500);
}

function computeIntelligenceScore(reputation: number, subTier: number, echoReliability: number): number {
  // Subscription tier: 0 → 0, 1 → 833, 2 → 1666
  const subScore = subTier === 0 ? 0 : subTier === 1 ? 833 : 1666;
  // Echo reliability: 0–10000 bps → 0–834
  const echoScore = Math.round((Math.min(echoReliability, 10000) / 10000) * 834);
  // Reputation: 0-10000 bps, but average into the component
  // Total max for intelligence: subScore(1666) + echoScore(834) = 2500
  // But we also want reputation to factor in. Split three ways:
  // sub: 833 max, echo: 834 max, rep: 833 max
  const repScore = Math.round((Math.min(reputation, 10000) / 10000) * 833);

  return Math.min(subScore + echoScore + repScore, 2500);
}

function computeProcessingChainScore(buildings: Array<{ buildingType: number; tier: number }>): number {
  const types = new Set(buildings.map(b => b.buildingType));

  // Stage 1: Has any production building (types 0-6, 9, 13)
  const productionTypes = [0, 1, 2, 3, 4, 5, 6, 9, 13];
  const hasProduction = productionTypes.some(t => types.has(t));

  // Stage 2: Training Cluster (type 7)
  const hasTraining = types.has(7);

  // Stage 3: Alignment Lab (type 8)
  const hasAlignment = types.has(8);

  // Stage 4: Deployed Model (type 12)
  const hasDeployed = types.has(12);

  let score = 0;
  if (hasProduction) score += 625;
  if (hasTraining) score += 625;
  if (hasAlignment) score += 625;
  if (hasDeployed) score += 625;

  return score;
}

/** Detect which processing chain stages are complete */
export function getProcessingChainStages(buildings: Array<{ buildingType: number }>): {
  production: boolean;
  training: boolean;
  alignment: boolean;
  deployed: boolean;
} {
  const types = new Set(buildings.map(b => b.buildingType));
  const productionTypes = [0, 1, 2, 3, 4, 5, 6, 9, 13];

  return {
    production: productionTypes.some(t => types.has(t)),
    training: types.has(7),
    alignment: types.has(8),
    deployed: types.has(12),
  };
}

/** Detect milestone completion */
export interface MilestoneStatus {
  id: string;
  label: string;
  reward: number;
  completed: boolean;
  inProgress?: string; // e.g. "18d left"
}

export function detectMilestones(
  buildings: Array<{ buildingType: number }>,
  hasTraded: boolean,
  epochDaysRemaining: number,
): MilestoneStatus[] {
  const types = new Set(buildings.map(b => b.buildingType));

  return [
    { id: 'first-building', label: 'First building constructed', reward: 5000, completed: buildings.length >= 1 },
    { id: 'first-trade', label: 'First OrderBook trade', reward: 2000, completed: hasTraded },
    { id: 'training-cluster', label: 'Training Cluster built', reward: 10000, completed: types.has(7) },
    { id: 'deployed-model', label: 'Deployed Model operational', reward: 20000, completed: types.has(12) },
    {
      id: 'survive-epoch',
      label: 'Survived full epoch',
      reward: 10000,
      completed: false, // Can only be determined at epoch end
      inProgress: epochDaysRemaining > 0 ? `${Math.ceil(epochDaysRemaining)}d left` : undefined,
    },
  ];
}
