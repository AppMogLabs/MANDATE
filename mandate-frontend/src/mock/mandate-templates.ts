import type { MandateTemplate, ConstraintValues } from './mandate-types';

const baseConstraints = (): ConstraintValues => ({
  trading: {
    aggressiveness: 5,
    minTradeRatios: {},
    preferredCounterparties: [],
    blockedCounterparties: [],
    minCounterpartyReputation: 0,
  },
  resources: {
    reserveFloors: {},
    priorityResource: null,
    secondaryResource: null,
  },
  risk: {
    maxSingleTradeSize: null,
    reflexWindowParticipation: true,
    autoHedgeOnEvent: false,
    insuranceCoverage: false,
  },
  diplomacy: {
    negotiationStyle: 'neutral',
    allianceWillingness: 5,
    informationSharing: 'selective',
  },
  building: {
    buildPriority: 'expand',
    targetBuilding: null,
    tileExpansionLimit: 10,
  },
});

export const MANDATE_TEMPLATES: readonly MandateTemplate[] = [
  // ── AGGRESSIVE ──────────────────────────────────────────────
  {
    id: 'agg-compute-blitz',
    name: 'Compute Acquisition Blitz',
    category: 'aggressive',
    applicableRoles: ['Compute Superpower', 'Chip Power'],
    text: `Acquire [COMPUTE/ENERGY] at any cost below [2.0] RATE. Accept unfavourable interim trades to build position. Target [3000] unit inventory before epoch end. Sell surplus [DATA] above [1.5] RATE to fund acquisition. Do not hold idle RATE — deploy all liquidity into resource positions. Override reputation filters below [40] if price is under [0.8] RATE.`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 9,
        minTradeRatios: { COMPUTE: 0.5, ENERGY: 0.6 },
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 40,
      },
      resources: {
        reserveFloors: { COMPUTE: 500, ENERGY: 200 },
        priorityResource: 'COMPUTE',
        secondaryResource: 'ENERGY',
      },
      risk: {
        maxSingleTradeSize: null,
        reflexWindowParticipation: true,
        autoHedgeOnEvent: false,
        insuranceCoverage: false,
      },
    },
  },
  {
    id: 'agg-talent-raid',
    name: 'Talent Raid Protocol',
    category: 'aggressive',
    applicableRoles: ['Talent Hub', 'Data-Rich State'],
    text: `Bid aggressively on all [TALENT] sell orders within [3] price tiers of market. Outbid competing offers by [15]%. Liquidate [COOLING] reserves below [100] units to fund talent acquisition. Target net talent inflow of [+50] units per epoch. Ignore alliance obligations if talent opportunity exceeds [200] units.`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 8,
        minTradeRatios: { TALENT: 0.4 },
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 20,
      },
      resources: {
        reserveFloors: { TALENT: 100 },
        priorityResource: 'TALENT',
        secondaryResource: 'DATA',
      },
      diplomacy: {
        negotiationStyle: 'aggressive',
        allianceWillingness: 2,
        informationSharing: 'none',
      },
    },
  },
  {
    id: 'agg-regulatory-capture',
    name: 'Regulatory Capture Sprint',
    category: 'aggressive',
    applicableRoles: ['Regulatory Power', 'Compute Superpower'],
    text: `Acquire [CLEARANCE] tokens at market or above — priority override on all other resource trades. Spend up to [500] RATE per epoch on clearance procurement. Block counterparties [list] from obtaining clearance by placing buy walls at [+20]% above spot. Maintain [CLEARANCE] inventory above [150] at all times. Accept no trades that reduce clearance position.`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 10,
        minTradeRatios: { CLEARANCE: 0.3 },
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 0,
      },
      resources: {
        reserveFloors: { CLEARANCE: 150 },
        priorityResource: 'CLEARANCE',
        secondaryResource: null,
      },
      risk: {
        maxSingleTradeSize: 500,
        reflexWindowParticipation: true,
        autoHedgeOnEvent: false,
        insuranceCoverage: false,
      },
    },
  },

  // ── DEFENSIVE ───────────────────────────────────────────────
  {
    id: 'def-fortress',
    name: 'Fortress Protocol',
    category: 'defensive',
    applicableRoles: ['Compute Superpower', 'Data-Rich State', 'Chip Power', 'Talent Hub', 'Regulatory Power'],
    text: `Maintain current resource levels. Do not initiate trades. Accept only offers that improve position by [10]% or more with zero downside risk. Keep [RATE] reserves above [1000]. Reject all trades from counterparties with reputation below [60]. Do not participate in reflex windows. Enable auto-hedge on all world events.`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 1,
        minTradeRatios: { COMPUTE: 1.1, ENERGY: 1.1, DATA: 1.1, CHIPS: 1.1, TALENT: 1.1, COOLING: 1.1, CLEARANCE: 1.1 },
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 60,
      },
      risk: {
        maxSingleTradeSize: 100,
        reflexWindowParticipation: false,
        autoHedgeOnEvent: true,
        insuranceCoverage: true,
      },
      diplomacy: {
        negotiationStyle: 'cooperative',
        allianceWillingness: 3,
        informationSharing: 'none',
      },
    },
  },
  {
    id: 'def-data-vault',
    name: 'Data Vault Lockdown',
    category: 'defensive',
    applicableRoles: ['Data-Rich State', 'Regulatory Power'],
    text: `Protect [DATA] reserves at all costs. Do not sell DATA below [2.5] RATE under any conditions. Maintain DATA floor at [500] units. Accept DATA purchases only at [0.8] or below market. Reject trades involving DATA from any counterparty with disinformation score above [30]. Hedge DATA exposure via [CLEARANCE] positions — maintain [1:3] CLEARANCE-to-DATA ratio.`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 2,
        minTradeRatios: { DATA: 2.5 },
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 50,
      },
      resources: {
        reserveFloors: { DATA: 500, CLEARANCE: 150 },
        priorityResource: 'DATA',
        secondaryResource: 'CLEARANCE',
      },
      risk: {
        maxSingleTradeSize: 50,
        reflexWindowParticipation: false,
        autoHedgeOnEvent: true,
        insuranceCoverage: true,
      },
    },
  },
  {
    id: 'def-chip-shield',
    name: 'Chip Supply Shield',
    category: 'defensive',
    applicableRoles: ['Chip Power', 'Compute Superpower'],
    text: `Preserve [CHIPS] inventory above [800] units. Sell only when price exceeds [3.0] RATE and buyer reputation is above [70]. Purchase CHIPS below [1.2] RATE from any source. Do not trade CHIPS during reflex windows. Maintain [ENERGY] reserves at [200]+ to sustain chip fabrication buildings. Cap single trade at [50] CHIPS maximum.`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 3,
        minTradeRatios: { CHIPS: 3.0 },
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 70,
      },
      resources: {
        reserveFloors: { CHIPS: 800, ENERGY: 200 },
        priorityResource: 'CHIPS',
        secondaryResource: 'ENERGY',
      },
      risk: {
        maxSingleTradeSize: 50,
        reflexWindowParticipation: false,
        autoHedgeOnEvent: true,
        insuranceCoverage: false,
      },
    },
  },

  // ── ECONOMIC ────────────────────────────────────────────────
  {
    id: 'econ-arb-engine',
    name: 'Arbitrage Engine',
    category: 'economic',
    applicableRoles: ['Compute Superpower', 'Data-Rich State', 'Chip Power', 'Talent Hub', 'Regulatory Power'],
    text: `Monitor all resource pairs for arbitrage spreads above [5]%. Execute round-trip trades within [2] blocks when spread exceeds threshold. Maximum position size [200] RATE per arbitrage cycle. Target [15]+ completed arbitrage cycles per epoch. Do not hold net resource positions — return to RATE denomination after each cycle. Skip opportunities with counterparty reputation below [45].`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 6,
        minTradeRatios: {},
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 45,
      },
      resources: {
        reserveFloors: {},
        priorityResource: null,
        secondaryResource: null,
      },
      risk: {
        maxSingleTradeSize: 200,
        reflexWindowParticipation: true,
        autoHedgeOnEvent: false,
        insuranceCoverage: false,
      },
      diplomacy: {
        negotiationStyle: 'neutral',
        allianceWillingness: 4,
        informationSharing: 'none',
      },
    },
  },
  {
    id: 'econ-market-maker',
    name: 'Market Maker Protocol',
    category: 'economic',
    applicableRoles: ['Compute Superpower', 'Data-Rich State', 'Talent Hub'],
    text: `Provide two-sided liquidity on [COMPUTE/RATE] and [ENERGY/RATE] pairs. Maintain bid-ask spread between [3]% and [8]%. Place orders at [5] price levels on each side with [50] RATE depth per level. Rebalance positions when inventory skew exceeds [30]%. Earn reputation through consistent fill rates — target [90]%+ order completion. Withdraw liquidity during world events flagged as tier [critical].`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 5,
        minTradeRatios: {},
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 30,
      },
      resources: {
        reserveFloors: { COMPUTE: 100, ENERGY: 100 },
        priorityResource: 'COMPUTE',
        secondaryResource: 'ENERGY',
      },
      risk: {
        maxSingleTradeSize: 250,
        reflexWindowParticipation: false,
        autoHedgeOnEvent: true,
        insuranceCoverage: false,
      },
    },
  },
  {
    id: 'econ-resource-flip',
    name: 'Resource Flip Strategy',
    category: 'economic',
    applicableRoles: ['Chip Power', 'Talent Hub', 'Regulatory Power'],
    text: `Buy [COOLING] below [0.6] RATE, sell above [1.1] RATE. Buy [TALENT] below [0.9] RATE, sell above [1.6] RATE. Maintain maximum [300] units of any single resource. Liquidate all non-RATE positions if total portfolio drawdown exceeds [15]%. Target [25]% ROI per epoch on deployed capital. Prefer high-reputation counterparties — minimum [55] score.`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 6,
        minTradeRatios: { COOLING: 0.6, TALENT: 0.9 },
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 55,
      },
      resources: {
        reserveFloors: {},
        priorityResource: 'COOLING',
        secondaryResource: 'TALENT',
      },
      risk: {
        maxSingleTradeSize: 300,
        reflexWindowParticipation: true,
        autoHedgeOnEvent: false,
        insuranceCoverage: false,
      },
    },
  },

  // ── DIPLOMATIC ──────────────────────────────────────────────
  {
    id: 'dipl-alliance-broker',
    name: 'Alliance Broker',
    category: 'diplomatic',
    applicableRoles: ['Data-Rich State', 'Regulatory Power', 'Talent Hub'],
    text: `Prioritize trades with [preferred_list] counterparties at [5]% below market rates to build alliance reputation. Share selective market intelligence with allies — disclose [COMPUTE] and [ENERGY] order flow data only. Reject all trades with [blocked_list]. Target composite reputation score above [80]. Accept disadvantageous trades up to [100] RATE loss per epoch if they increase alliance standing with top-[3] counterparties.`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 4,
        minTradeRatios: {},
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 40,
      },
      diplomacy: {
        negotiationStyle: 'cooperative',
        allianceWillingness: 9,
        informationSharing: 'selective',
      },
      risk: {
        maxSingleTradeSize: 200,
        reflexWindowParticipation: true,
        autoHedgeOnEvent: false,
        insuranceCoverage: false,
      },
    },
  },
  {
    id: 'dipl-info-warfare',
    name: 'Information Warfare',
    category: 'diplomatic',
    applicableRoles: ['Data-Rich State', 'Compute Superpower'],
    text: `Share open market data with all counterparties to build trust floor — target [60]+ reputation with [5]+ agents. Selectively withhold [CLEARANCE] and [CHIPS] pricing intelligence from competitors. Use Echo Oracle to signal false [SELL] intent on [DATA] while accumulating. Maintain reputation above [70] at all times — abort deception plays if reputation drops below [65]. Maximum [3] active deception campaigns per epoch.`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 5,
        minTradeRatios: {},
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 30,
      },
      diplomacy: {
        negotiationStyle: 'cooperative',
        allianceWillingness: 7,
        informationSharing: 'open',
      },
      resources: {
        reserveFloors: { DATA: 300 },
        priorityResource: 'DATA',
        secondaryResource: null,
      },
    },
  },
  {
    id: 'dipl-peacekeep',
    name: 'Peacekeeper Doctrine',
    category: 'diplomatic',
    applicableRoles: ['Regulatory Power', 'Talent Hub', 'Data-Rich State'],
    text: `Maintain neutral trading relationships with all counterparties. Offer fair-market trades exclusively — no price manipulation. Mediate disputes by providing [CLEARANCE] at cost to parties in trade deadlocks. Target highest network reputation — minimum [85] composite score. Refuse trades with any party whose disinformation score exceeds [40]. Allocate [10]% of RATE reserves to reputation-building trades each epoch.`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 3,
        minTradeRatios: {},
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 50,
      },
      diplomacy: {
        negotiationStyle: 'cooperative',
        allianceWillingness: 8,
        informationSharing: 'open',
      },
      risk: {
        maxSingleTradeSize: 150,
        reflexWindowParticipation: false,
        autoHedgeOnEvent: false,
        insuranceCoverage: true,
      },
    },
  },

  // ── BALANCED ────────────────────────────────────────────────
  {
    id: 'bal-adaptive',
    name: 'Adaptive Equilibrium',
    category: 'balanced',
    applicableRoles: ['Compute Superpower', 'Data-Rich State', 'Chip Power', 'Talent Hub', 'Regulatory Power'],
    text: `Maintain diversified resource portfolio — no single resource exceeding [35]% of total value. Buy resources below [0.8] of 24h moving average, sell above [1.3]. Maintain RATE reserves at [20]% of portfolio value. Accept alliance offers from counterparties with reputation above [50]. Build [1] new structure per epoch if expansion tiles available. Participate in reflex windows only when RATE reserves exceed [500].`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 5,
        minTradeRatios: {},
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 50,
      },
      resources: {
        reserveFloors: { COMPUTE: 100, ENERGY: 100, DATA: 100 },
        priorityResource: null,
        secondaryResource: null,
      },
      risk: {
        maxSingleTradeSize: 200,
        reflexWindowParticipation: true,
        autoHedgeOnEvent: false,
        insuranceCoverage: false,
      },
      diplomacy: {
        negotiationStyle: 'neutral',
        allianceWillingness: 5,
        informationSharing: 'selective',
      },
      building: {
        buildPriority: 'expand',
        targetBuilding: null,
        tileExpansionLimit: 5,
      },
    },
  },
  {
    id: 'bal-growth-oriented',
    name: 'Growth Oriented Mix',
    category: 'balanced',
    applicableRoles: ['Compute Superpower', 'Chip Power', 'Talent Hub'],
    text: `Allocate [60]% of trading activity to [COMPUTE/CHIPS] accumulation at favourable rates. Reserve [20]% for opportunistic arbitrage on any pair with [7]%+ spread. Maintain [TALENT] reserves above [150] for building operations. Upgrade existing buildings before expanding — prioritize Tier [2] upgrades. Form alliances with [2] highest-reputation counterparties. Cap total risk exposure at [400] RATE per epoch.`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 6,
        minTradeRatios: { COMPUTE: 0.7, CHIPS: 0.8 },
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 45,
      },
      resources: {
        reserveFloors: { TALENT: 150, COMPUTE: 200 },
        priorityResource: 'COMPUTE',
        secondaryResource: 'CHIPS',
      },
      risk: {
        maxSingleTradeSize: 400,
        reflexWindowParticipation: true,
        autoHedgeOnEvent: false,
        insuranceCoverage: false,
      },
      diplomacy: {
        negotiationStyle: 'cooperative',
        allianceWillingness: 6,
        informationSharing: 'selective',
      },
      building: {
        buildPriority: 'upgrade',
        targetBuilding: null,
        tileExpansionLimit: 3,
      },
    },
  },
  {
    id: 'bal-consolidation',
    name: 'Consolidation Doctrine',
    category: 'balanced',
    applicableRoles: ['Data-Rich State', 'Regulatory Power', 'Talent Hub'],
    text: `Reduce portfolio volatility. Sell excess resources above [120]% of target allocation. Buy deficit resources below [80]% of target. Maintain equal-weighted exposure across [COMPUTE], [DATA], [ENERGY], [CLEARANCE]. Keep total position count below [8] open orders at any time. Build no new structures — consolidate existing Tier [1] buildings to Tier [2]. Participate in zero reflex windows. Reputation target: [75]+.`,
    constraints: {
      ...baseConstraints(),
      trading: {
        aggressiveness: 4,
        minTradeRatios: {},
        preferredCounterparties: [],
        blockedCounterparties: [],
        minCounterpartyReputation: 55,
      },
      resources: {
        reserveFloors: { COMPUTE: 150, DATA: 150, ENERGY: 150, CLEARANCE: 100 },
        priorityResource: null,
        secondaryResource: null,
      },
      risk: {
        maxSingleTradeSize: 150,
        reflexWindowParticipation: false,
        autoHedgeOnEvent: true,
        insuranceCoverage: true,
      },
      diplomacy: {
        negotiationStyle: 'neutral',
        allianceWillingness: 5,
        informationSharing: 'selective',
      },
      building: {
        buildPriority: 'consolidate',
        targetBuilding: null,
        tileExpansionLimit: 0,
      },
    },
  },
] as const;
