import type { WorldEvent } from './types';

const BASE_TS = 1711584000000 - 30 * 60 * 1000;

function ts(offsetMs: number): number {
  return BASE_TS + offsetMs;
}

export const worldEvents: WorldEvent[] = [
  {
    id: 'evt-001',
    timestamp: ts(0),
    category: 'CHIPS',
    headline: 'Fabrication corridor sector 7-N reports unplanned downtime. Output reduced 35%.',
    tier: 'free',
  },
  {
    id: 'evt-002',
    timestamp: ts(60000),
    category: 'SUPPLY_CHAIN',
    headline: 'Cross-region logistics delay. CHIPS transit time extended by 4 epochs.',
    tier: 'free',
  },
  {
    id: 'evt-003',
    timestamp: ts(120000),
    category: 'COMPUTE',
    headline: 'Compute availability under pressure. Cluster utilization at 91% across northern zones.',
    tier: 'free',
  },
  {
    id: 'evt-004',
    timestamp: ts(200000),
    category: 'REGULATORY',
    headline: 'New clearance requirements proposed for tier 3 building permits. Comment period open.',
    tier: 'analyst',
  },
  {
    id: 'evt-005',
    timestamp: ts(300000),
    category: 'ENERGY',
    headline: 'Solar array output declining. Seasonal efficiency drop of 12% projected through epoch 5.',
    tier: 'free',
  },
  {
    id: 'evt-006',
    timestamp: ts(420000),
    category: 'TALENT',
    headline: 'Talent migration pattern shift. Net outflow from industrial zones to research corridors.',
    tier: 'analyst',
  },
  {
    id: 'evt-007',
    timestamp: ts(540000),
    category: 'CHIPS',
    headline: 'Secondary fabrication source activated. Partial capacity. Output 40% of primary.',
    tier: 'free',
  },
  {
    id: 'evt-008',
    timestamp: ts(600000),
    category: 'DATA',
    headline: 'Data purity incident reported in upstream feed DL-008. Contamination scope under assessment.',
    tier: 'premium',
  },
  {
    id: 'evt-009',
    timestamp: ts(720000),
    category: 'COOLING',
    headline: 'Cooling demand forecast revised upward. Thermal load increase from expanded compute operations.',
    tier: 'free',
  },
  {
    id: 'evt-010',
    timestamp: ts(840000),
    category: 'SUPPLY_CHAIN',
    headline: 'CHIPS spot premium widening. Bid-ask spread at 2.8%, up from 1.1% pre-disruption.',
    tier: 'free',
  },
  {
    id: 'evt-011',
    timestamp: ts(960000),
    category: 'REGULATORY',
    headline: 'Clearance processing backlog at 340% of normal. Expedited review fees increased.',
    tier: 'analyst',
  },
  {
    id: 'evt-012',
    timestamp: ts(1020000),
    category: 'COMPUTE',
    headline: 'Tier 2 compute cluster upgrade wave underway. Three facilities in upgrade queue.',
    tier: 'free',
  },
  {
    id: 'evt-013',
    timestamp: ts(1140000),
    category: 'ENERGY',
    headline: 'Long-term energy supply contracts being renegotiated. Fixed-rate deals at 0.868 RATE/unit.',
    tier: 'premium',
  },
  {
    id: 'evt-014',
    timestamp: ts(1260000),
    category: 'CHIPS',
    headline: 'Emergency procurement activity detected. Multiple agents issuing RFQs for CHIPS.',
    tier: 'free',
  },
  {
    id: 'evt-015',
    timestamp: ts(1380000),
    category: 'TALENT',
    headline: 'Worker efficiency improvements reported at facilities with dedicated talent allocation.',
    tier: 'analyst',
  },
  {
    id: 'evt-016',
    timestamp: ts(1440000),
    category: 'DATA',
    headline: 'Data lineage verification protocols tightened. Purity threshold raised to 0.85 minimum.',
    tier: 'premium',
  },
  {
    id: 'evt-017',
    timestamp: ts(1560000),
    category: 'SUPPLY_CHAIN',
    headline: 'Fabrication corridor partial recovery. Sector 7-N output at 65% of pre-disruption levels.',
    tier: 'free',
  },
  {
    id: 'evt-018',
    timestamp: ts(1650000),
    category: 'COOLING',
    headline: 'Coastal cooling infrastructure operating at capacity. Inland alternatives being evaluated.',
    tier: 'analyst',
  },
  {
    id: 'evt-019',
    timestamp: ts(1740000),
    category: 'COMPUTE',
    headline: 'Compute Superpower faction consolidating northern grid. Market share at 38%.',
    tier: 'free',
  },
  {
    id: 'evt-020',
    timestamp: ts(1790000),
    category: 'CHIPS',
    headline: 'CHIPS supply stabilizing. Spot premium contracting. Secondary source ramping production.',
    tier: 'free',
  },
];
