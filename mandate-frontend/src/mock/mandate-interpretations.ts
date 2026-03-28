import type { MockInterpretation } from './mandate-types';

export const MOCK_INTERPRETATIONS: Record<string, MockInterpretation> = {
  'aggressive-trading': {
    keywords: ['acquire', 'buy', 'aggressive', 'accumulate', 'position', 'blitz', 'raid', 'capture', 'outbid', 'liquidate'],
    plan: [
      {
        action: '1. SCAN order book for target resource sell orders',
        details: [
          'Enumerate all active SELL orders across priority resource pairs',
          'Filter by price threshold specified in mandate constraints',
          'Rank by fill probability and counterparty reputation',
        ],
        resource: 'COMPUTE',
        priority: 'high',
      },
      {
        action: '2. EXECUTE market and limit BUY orders',
        details: [
          'Place aggressive limit orders 5-15% above current best bid',
          'Submit market orders for lots below mandate price ceiling',
          'Batch orders to minimize slippage on large acquisitions',
        ],
        resource: 'COMPUTE',
        priority: 'high',
      },
      {
        action: '3. LIQUIDATE non-priority holdings',
        details: [
          'Identify surplus resources exceeding reserve floor',
          'Place SELL orders at market for rapid liquidation',
          'Route RATE proceeds to primary acquisition pipeline',
        ],
        resource: 'DATA',
        priority: 'medium',
      },
      {
        action: '4. MONITOR inventory progress against epoch target',
        details: [
          'Track cumulative acquisition vs mandate target quantity',
          'Escalate aggressiveness if behind pace at epoch midpoint',
          'Log all trade executions to audit trail',
        ],
        priority: 'medium',
      },
      {
        action: '5. OVERRIDE reputation filters when price is below threshold',
        details: [
          'Temporarily lower counterparty reputation floor for sub-threshold prices',
          'Accept trades from low-reputation agents only at steep discount',
          'Flag overridden trades for post-epoch review',
        ],
        priority: 'low',
      },
    ],
    constraintsDetected: 7,
    conflicts: [
      'Reputation override conflicts with risk management — accepting low-reputation counterparties increases default risk',
    ],
    confidence: 'HIGH',
    warnings: [
      'WARNING: Unlimited trade size with aggressive posture exposes portfolio to single-trade concentration risk',
      'WARNING: Overriding reputation filters below 40 may trigger adverse selection — recommend minimum floor of 25',
    ],
  },

  'defensive-holding': {
    keywords: ['maintain', 'hold', 'preserve', 'protect', 'conservative', 'fortress', 'shield', 'vault', 'lock', 'floor'],
    plan: [
      {
        action: '1. ENFORCE reserve floor constraints',
        details: [
          'Set hard limits on all resource balances per mandate specification',
          'Reject any outbound trade that would breach reserve floor',
          'Monitor real-time balance deltas against threshold triggers',
        ],
        priority: 'high',
      },
      {
        action: '2. EVALUATE inbound offers against improvement threshold',
        details: [
          'Calculate net portfolio impact for each incoming trade proposal',
          'Accept only if improvement exceeds mandate minimum (e.g., 10%)',
          'Reject all trades that do not meet strict improvement criteria',
        ],
        priority: 'high',
      },
      {
        action: '3. ACTIVATE hedging protocols on world events',
        details: [
          'Subscribe to world event feed for critical-tier alerts',
          'Automatically reduce exposure to volatile resource pairs',
          'Shift portfolio weight toward RATE denomination during events',
        ],
        priority: 'medium',
      },
      {
        action: '4. MAINTAIN reputation through selective engagement',
        details: [
          'Respond to high-quality trade proposals to avoid reputation decay',
          'Provide counteroffers at mandate-compliant terms',
          'Log all rejected proposals with reason codes',
        ],
        priority: 'low',
      },
    ],
    constraintsDetected: 9,
    conflicts: [],
    confidence: 'HIGH',
    warnings: [
      'WARNING: Fully defensive posture may cause reputation stagnation — no initiated trades means lower activity score',
    ],
  },

  'economic-arbitrage': {
    keywords: ['arbitrage', 'profit', 'margin', 'spread', 'efficient', 'flip', 'market-make', 'liquidity', 'roi', 'cycle'],
    plan: [
      {
        action: '1. SCAN all resource pairs for spread opportunities',
        details: [
          'Calculate real-time bid-ask spreads across all 7 resource pairs',
          'Identify cross-pair arbitrage routes (e.g., COMPUTE->ENERGY->RATE)',
          'Filter for minimum spread threshold defined in mandate',
        ],
        resource: 'COMPUTE',
        priority: 'high',
      },
      {
        action: '2. EXECUTE round-trip arbitrage within block window',
        details: [
          'Submit atomic trade sequences to capture spread',
          'Enforce maximum position size per cycle from mandate constraints',
          'Target sub-2-block execution to minimize price drift',
        ],
        priority: 'high',
      },
      {
        action: '3. UNWIND positions to RATE denomination',
        details: [
          'Convert all resource holdings back to RATE after each cycle',
          'Verify net positive PnL before closing position',
          'Abort and unwind at loss if spread collapses mid-execution',
        ],
        priority: 'high',
      },
      {
        action: '4. TRACK cycle count and ROI against epoch targets',
        details: [
          'Increment completed arbitrage cycle counter',
          'Calculate running ROI on deployed capital',
          'Adjust spread threshold dynamically if behind target pace',
        ],
        priority: 'medium',
      },
      {
        action: '5. MANAGE counterparty selection for execution speed',
        details: [
          'Prefer counterparties with high fill rates and low latency',
          'Maintain working relationships with reliable market participants',
          'Avoid counterparties with history of order cancellation',
        ],
        priority: 'low',
      },
    ],
    constraintsDetected: 6,
    conflicts: [
      'Rapid cycle trading may conflict with reputation building — frequent small trades may be perceived as noise',
    ],
    confidence: 'MEDIUM',
    warnings: [
      'WARNING: Arbitrage assumes sufficient liquidity on both legs — thin order books may cause partial fills and inventory risk',
      'WARNING: Round-trip execution within 2 blocks depends on network conditions — MegaETH 10ms blocks are fast but not guaranteed',
    ],
  },

  'diplomatic-alliance': {
    keywords: ['alliance', 'cooperate', 'negotiate', 'partner', 'reputation', 'trust', 'mediate', 'share', 'peacekeeper', 'broker'],
    plan: [
      {
        action: '1. IDENTIFY high-value alliance targets',
        details: [
          'Rank all counterparties by reputation composite score',
          'Filter for complementary resource profiles (they have what we need)',
          'Calculate expected value of preferential trade terms over epoch',
        ],
        priority: 'high',
      },
      {
        action: '2. INITIATE alliance-building trades',
        details: [
          'Offer below-market rates on preferred counterparty trades',
          'Accept net-negative trades within mandate loss budget for relationship building',
          'Track reputation delta per counterparty after each trade',
        ],
        priority: 'high',
      },
      {
        action: '3. SHARE market intelligence per mandate disclosure rules',
        details: [
          'Publish order flow data for whitelisted resource pairs only',
          'Withhold strategic resource pricing from competitors',
          'Verify information sharing does not breach other mandate constraints',
        ],
        priority: 'medium',
      },
      {
        action: '4. ENFORCE counterparty blocklist',
        details: [
          'Reject all trade proposals from blocked counterparties',
          'Do not share any market intelligence with blocked entities',
          'Log all blocked interaction attempts for audit',
        ],
        priority: 'medium',
      },
      {
        action: '5. MONITOR reputation score trajectory',
        details: [
          'Track composite reputation toward mandate target (e.g., 80+)',
          'Adjust alliance spending if reputation growth is behind pace',
          'Escalate cooperative gestures if approaching epoch deadline',
        ],
        priority: 'low',
      },
    ],
    constraintsDetected: 8,
    conflicts: [
      'Below-market alliance trades directly reduce short-term PnL — mandate must budget for reputation investment costs',
    ],
    confidence: 'HIGH',
    warnings: [
      'WARNING: Open information sharing increases vulnerability to counterparty deception — monitor disinformation scores closely',
    ],
  },

  'building-expansion': {
    keywords: ['build', 'construct', 'expand', 'upgrade', 'territory', 'tile', 'structure', 'fabrication', 'production', 'infrastructure'],
    plan: [
      {
        action: '1. SURVEY available expansion tiles',
        details: [
          'Enumerate unclaimed tiles within mandate expansion radius',
          'Score tiles by terrain type and adjacency bonuses',
          'Filter by resource production alignment with mandate priorities',
        ],
        priority: 'high',
      },
      {
        action: '2. CLAIM optimal tiles within expansion limit',
        details: [
          'Claim tiles up to mandate tileExpansionLimit',
          'Prioritize tiles adjacent to existing buildings for synergy bonuses',
          'Reserve RATE for claiming costs — do not exceed building budget',
        ],
        priority: 'high',
      },
      {
        action: '3. CONSTRUCT or UPGRADE buildings per priority',
        details: [
          'If buildPriority=expand: construct new Tier 1 buildings on claimed tiles',
          'If buildPriority=upgrade: upgrade existing Tier 1 to Tier 2 first',
          'If buildPriority=consolidate: upgrade only, no new construction',
        ],
        priority: 'high',
      },
      {
        action: '4. ALLOCATE resources to building operations',
        details: [
          'Ensure ENERGY and TALENT reserves meet building input requirements',
          'Adjust trade strategy to acquire building materials if deficit',
          'Monitor building efficiency and worker allocation',
        ],
        resource: 'ENERGY',
        priority: 'medium',
      },
    ],
    constraintsDetected: 5,
    conflicts: [
      'Tile expansion competes with trading capital — building costs reduce RATE available for market operations',
    ],
    confidence: 'MEDIUM',
    warnings: [
      'WARNING: Expansion without adequate ENERGY reserves will leave buildings idle — verify production pipeline first',
      'WARNING: Tile claiming is irreversible — overexpansion increases maintenance costs permanently',
    ],
  },

  'balanced-default': {
    keywords: [],
    plan: [
      {
        action: '1. ASSESS current portfolio state',
        details: [
          'Calculate resource allocation percentages across all holdings',
          'Identify any single-resource concentration exceeding 35%',
          'Determine RATE reserve ratio against total portfolio value',
        ],
        priority: 'medium',
      },
      {
        action: '2. REBALANCE toward target allocation',
        details: [
          'Sell overweight resources above 120% of target',
          'Buy underweight resources below 80% of target',
          'Execute rebalance trades at market or near-market prices',
        ],
        priority: 'medium',
      },
      {
        action: '3. EVALUATE opportunistic trades',
        details: [
          'Monitor for spreads or price dislocations exceeding 10%',
          'Execute opportunistic trades within risk budget',
          'Maintain neutral net exposure after opportunistic activity',
        ],
        priority: 'low',
      },
    ],
    constraintsDetected: 3,
    conflicts: [],
    confidence: 'LOW',
    warnings: [
      'NOTE: Mandate text is generic — agent will operate with default parameters. Add specific constraints for better performance.',
    ],
  },
};

/**
 * Match a mandate text against interpretation patterns.
 * Returns the best-matching interpretation key, falling back to 'balanced-default'.
 */
export function matchInterpretation(mandateText: string): string {
  const lower = mandateText.toLowerCase();
  let bestMatch = 'balanced-default';
  let bestScore = 0;

  for (const [key, interp] of Object.entries(MOCK_INTERPRETATIONS)) {
    if (key === 'balanced-default') continue;
    const score = interp.keywords.reduce(
      (acc, kw) => acc + (lower.includes(kw) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestMatch = key;
    }
  }

  return bestMatch;
}
