import type { AgentFeedEntry, ResourceType } from './types';

const AGENTS = ['Alpha-7', 'Meridian', 'Vanguard', 'Echo-Prime', 'Sentinel', 'Nexus-3'] as const;

const BASE_TS = 1711584000000 - 30 * 60 * 1000;

function ts(offsetMs: number): number {
  return BASE_TS + offsetMs;
}

function id(n: number): string {
  return `feed-${n.toString().padStart(4, '0')}`;
}

export const feedEntries: AgentFeedEntry[] = [
  // -- Critical events (fabrication disruption narrative) --
  { id: id(1), timestamp: ts(120000), agentName: 'Sentinel', action: 'ALERT', detail: 'Fabrication corridor supply disruption detected. CHIPS production halted sector 7-N.', tier: 'critical', resourceType: 'CHIPS' },
  { id: id(2), timestamp: ts(480000), agentName: 'Alpha-7', action: 'ALERT', detail: 'CHIPS reserve below critical threshold. 200 units remaining. Procurement mandate triggered.', tier: 'critical', mandateClause: 'M-7.2: Maintain CHIPS floor', resourceType: 'CHIPS' },
  { id: id(3), timestamp: ts(1560000), agentName: 'Nexus-3', action: 'ALERT', detail: 'CLEARANCE availability degraded. Regulatory backlog exceeding SLA by 340%.', tier: 'critical', resourceType: 'CLEARANCE' },

  // -- Warning events --
  { id: id(4), timestamp: ts(60000), agentName: 'Meridian', action: 'RISK_FLAG', detail: 'CHIPS/RATE spread widening. Bid-ask delta exceeds 2.8% threshold.', tier: 'warning', resourceType: 'CHIPS' },
  { id: id(5), timestamp: ts(180000), agentName: 'Echo-Prime', action: 'ORACLE_DRIFT', detail: 'TWAP oracle deviation on CHIPS/RATE: 4.2% from spot. Arbitrage window open.', tier: 'warning', resourceType: 'CHIPS' },
  { id: id(6), timestamp: ts(360000), agentName: 'Vanguard', action: 'RISK_FLAG', detail: 'TALENT consumption rate exceeding production. Net deficit 12 units/hr.', tier: 'warning', resourceType: 'TALENT' },
  { id: id(7), timestamp: ts(540000), agentName: 'Alpha-7', action: 'MARGIN_WARN', detail: 'RATE exposure approaching 60% of liquid reserves. Rebalance recommended.', tier: 'warning' },
  { id: id(8), timestamp: ts(720000), agentName: 'Sentinel', action: 'RISK_FLAG', detail: 'CLEARANCE price decline accelerating. Down 5.3% in 24h.', tier: 'warning', resourceType: 'CLEARANCE' },
  { id: id(9), timestamp: ts(960000), agentName: 'Nexus-3', action: 'RISK_FLAG', detail: 'ENERGY production margin thin. Buffer at 7.7% of consumption.', tier: 'warning', resourceType: 'ENERGY' },
  { id: id(10), timestamp: ts(1080000), agentName: 'Meridian', action: 'COMPLIANCE', detail: 'Guard clause GC-042 activation rate below 90% threshold. Review recommended.', tier: 'warning' },
  { id: id(11), timestamp: ts(1200000), agentName: 'Echo-Prime', action: 'DATA_QUALITY', detail: 'Data lineage node DL-008 flagged. Purity score degraded to 0.41.', tier: 'warning', resourceType: 'DATA' },
  { id: id(12), timestamp: ts(1320000), agentName: 'Vanguard', action: 'RISK_FLAG', detail: 'COOLING demand forecast trending +8% for next epoch. Pre-position advised.', tier: 'warning', resourceType: 'COOLING' },
  { id: id(13), timestamp: ts(1440000), agentName: 'Alpha-7', action: 'COUNTERPARTY', detail: 'Meridian deal completion rate dipped below 85%. Counterparty risk elevated.', tier: 'warning' },

  // -- Info: Trades --
  { id: id(14), timestamp: ts(30000), agentName: 'Alpha-7', action: 'TRADE', detail: 'Executed COMPUTE purchase: 120 units @ 1.2340 RATE', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(15), timestamp: ts(45000), agentName: 'Meridian', action: 'TRADE', detail: 'Sold ENERGY: 80 units @ 0.8720 RATE', tier: 'info', resourceType: 'ENERGY' },
  { id: id(16), timestamp: ts(90000), agentName: 'Vanguard', action: 'TRADE', detail: 'Executed CHIPS purchase: 15 units @ 2.1200 RATE', tier: 'info', resourceType: 'CHIPS' },
  { id: id(17), timestamp: ts(150000), agentName: 'Echo-Prime', action: 'TRADE', detail: 'Sold DATA: 200 units @ 0.9440 RATE', tier: 'info', resourceType: 'DATA' },
  { id: id(18), timestamp: ts(210000), agentName: 'Sentinel', action: 'TRADE', detail: 'Executed COOLING purchase: 50 units @ 0.5610 RATE', tier: 'info', resourceType: 'COOLING' },
  { id: id(19), timestamp: ts(240000), agentName: 'Nexus-3', action: 'TRADE', detail: 'Executed COMPUTE sale: 45 units @ 1.2360 RATE', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(20), timestamp: ts(270000), agentName: 'Alpha-7', action: 'TRADE', detail: 'Bid placed CHIPS: 30 units @ 2.1100 RATE. Awaiting fill.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(21), timestamp: ts(300000), agentName: 'Meridian', action: 'TRADE', detail: 'Executed TALENT purchase: 25 units @ 1.7820 RATE', tier: 'info', resourceType: 'TALENT' },
  { id: id(22), timestamp: ts(330000), agentName: 'Vanguard', action: 'TRADE', detail: 'Sold COMPUTE: 90 units @ 1.2310 RATE', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(23), timestamp: ts(390000), agentName: 'Echo-Prime', action: 'TRADE', detail: 'Executed CHIPS purchase: 10 units @ 2.1350 RATE', tier: 'info', resourceType: 'CHIPS' },
  { id: id(24), timestamp: ts(420000), agentName: 'Sentinel', action: 'TRADE', detail: 'Sold ENERGY: 60 units @ 0.8690 RATE', tier: 'info', resourceType: 'ENERGY' },
  { id: id(25), timestamp: ts(450000), agentName: 'Alpha-7', action: 'TRADE', detail: 'Executed DATA purchase: 150 units @ 0.9460 RATE', tier: 'info', resourceType: 'DATA' },
  { id: id(26), timestamp: ts(510000), agentName: 'Nexus-3', action: 'TRADE', detail: 'Executed CLEARANCE purchase: 5 units @ 3.4400 RATE', tier: 'info', resourceType: 'CLEARANCE' },
  { id: id(27), timestamp: ts(570000), agentName: 'Meridian', action: 'TRADE', detail: 'Sold COOLING: 35 units @ 0.5630 RATE', tier: 'info', resourceType: 'COOLING' },
  { id: id(28), timestamp: ts(600000), agentName: 'Vanguard', action: 'TRADE', detail: 'Executed COMPUTE purchase: 200 units @ 1.2350 RATE', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(29), timestamp: ts(630000), agentName: 'Alpha-7', action: 'TRADE', detail: 'Partial fill CHIPS: 18/30 units @ 2.1100 RATE', tier: 'info', resourceType: 'CHIPS' },
  { id: id(30), timestamp: ts(660000), agentName: 'Echo-Prime', action: 'TRADE', detail: 'Executed TALENT sale: 15 units @ 1.7780 RATE', tier: 'info', resourceType: 'TALENT' },
  { id: id(31), timestamp: ts(690000), agentName: 'Sentinel', action: 'TRADE', detail: 'Executed COMPUTE purchase: 75 units @ 1.2330 RATE', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(32), timestamp: ts(750000), agentName: 'Nexus-3', action: 'TRADE', detail: 'Sold DATA: 110 units @ 0.9430 RATE', tier: 'info', resourceType: 'DATA' },
  { id: id(33), timestamp: ts(780000), agentName: 'Meridian', action: 'TRADE', detail: 'Executed CHIPS purchase: 8 units @ 2.1450 RATE', tier: 'info', resourceType: 'CHIPS' },
  { id: id(34), timestamp: ts(810000), agentName: 'Alpha-7', action: 'TRADE', detail: 'Executed ENERGY purchase: 100 units @ 0.8700 RATE', tier: 'info', resourceType: 'ENERGY' },
  { id: id(35), timestamp: ts(840000), agentName: 'Vanguard', action: 'TRADE', detail: 'Sold CLEARANCE: 3 units @ 3.4100 RATE', tier: 'info', resourceType: 'CLEARANCE' },
  { id: id(36), timestamp: ts(870000), agentName: 'Echo-Prime', action: 'TRADE', detail: 'Executed COOLING purchase: 40 units @ 0.5620 RATE', tier: 'info', resourceType: 'COOLING' },
  { id: id(37), timestamp: ts(900000), agentName: 'Sentinel', action: 'TRADE', detail: 'Executed COMPUTE sale: 55 units @ 1.2360 RATE', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(38), timestamp: ts(930000), agentName: 'Nexus-3', action: 'TRADE', detail: 'Bid placed TALENT: 20 units @ 1.7750 RATE. Awaiting fill.', tier: 'info', resourceType: 'TALENT' },

  // -- Info: Building actions --
  { id: id(39), timestamp: ts(105000), agentName: 'Alpha-7', action: 'BUILD', detail: 'Initiated tier 2 upgrade on Compute Cluster at (-1, 2). ETA 45m.', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(40), timestamp: ts(255000), agentName: 'Vanguard', action: 'BUILD', detail: 'Deployed Data Refinery at (2, -1). Tier 1. Production online.', tier: 'info', resourceType: 'DATA' },
  { id: id(41), timestamp: ts(435000), agentName: 'Echo-Prime', action: 'BUILD', detail: 'Cooling Tower at (0, 3) upgraded to tier 2. Efficiency +15%.', tier: 'info', resourceType: 'COOLING' },
  { id: id(42), timestamp: ts(615000), agentName: 'Meridian', action: 'BUILD', detail: 'Energy Grid at (1, -2) maintenance complete. Production restored.', tier: 'info', resourceType: 'ENERGY' },
  { id: id(43), timestamp: ts(795000), agentName: 'Sentinel', action: 'BUILD', detail: 'Allocated 4 TALENT to Compute Cluster at (-2, 1). Worker efficiency +8%.', tier: 'info', resourceType: 'TALENT' },
  { id: id(44), timestamp: ts(975000), agentName: 'Alpha-7', action: 'BUILD', detail: 'Fabrication Plant at (0, -3) offline. Awaiting CHIPS resupply.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(45), timestamp: ts(1155000), agentName: 'Nexus-3', action: 'BUILD', detail: 'Regulatory Office at (-3, 0) processing backlog. CLEARANCE output reduced 40%.', tier: 'info', resourceType: 'CLEARANCE' },

  // -- Info: Negotiations --
  { id: id(46), timestamp: ts(135000), agentName: 'Alpha-7', action: 'NEGOTIATE', detail: 'Opened bilateral CHIPS negotiation with Meridian. Proposed 50 units @ 2.10 RATE.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(47), timestamp: ts(285000), agentName: 'Meridian', action: 'NEGOTIATE', detail: 'Counter-offered Alpha-7: 50 CHIPS @ 2.14 RATE. Spread narrowing.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(48), timestamp: ts(375000), agentName: 'Alpha-7', action: 'NEGOTIATE', detail: 'Accepted Meridian counter. 50 CHIPS @ 2.14 RATE. Settlement pending.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(49), timestamp: ts(465000), agentName: 'Vanguard', action: 'NEGOTIATE', detail: 'Proposed COMPUTE-for-TALENT swap with Echo-Prime. 100:30 ratio.', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(50), timestamp: ts(555000), agentName: 'Echo-Prime', action: 'NEGOTIATE', detail: 'Declined Vanguard swap proposal. TALENT reserves insufficient.', tier: 'info', resourceType: 'TALENT' },
  { id: id(51), timestamp: ts(645000), agentName: 'Sentinel', action: 'NEGOTIATE', detail: 'Opened ENERGY supply contract with Nexus-3. 500 units over 2 epochs.', tier: 'info', resourceType: 'ENERGY' },
  { id: id(52), timestamp: ts(735000), agentName: 'Nexus-3', action: 'NEGOTIATE', detail: 'Accepted Sentinel ENERGY contract. Locked @ 0.8680 RATE/unit.', tier: 'info', resourceType: 'ENERGY' },

  // -- Info: System / Oracle / Mandate --
  { id: id(53), timestamp: ts(75000), agentName: 'Alpha-7', action: 'MANDATE_EXEC', detail: 'Mandate clause M-3.1 triggered: Maintain COMPUTE production above 300/hr.', tier: 'info', mandateClause: 'M-3.1', resourceType: 'COMPUTE' },
  { id: id(54), timestamp: ts(195000), agentName: 'Echo-Prime', action: 'ORACLE_READ', detail: 'TWAP query: COMPUTE/RATE 1h avg = 1.2285. Spot delta +0.45%.', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(55), timestamp: ts(315000), agentName: 'Sentinel', action: 'MANDATE_EXEC', detail: 'Mandate clause M-5.4 triggered: Diversify ENERGY sourcing across 2+ suppliers.', tier: 'info', mandateClause: 'M-5.4', resourceType: 'ENERGY' },
  { id: id(56), timestamp: ts(405000), agentName: 'Vanguard', action: 'ORACLE_READ', detail: 'TWAP query: CHIPS/RATE 1h avg = 2.0840. Spot premium +3.2%.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(57), timestamp: ts(495000), agentName: 'Meridian', action: 'MANDATE_EXEC', detail: 'Mandate clause M-2.0 triggered: Rebalance portfolio when single asset exceeds 40%.', tier: 'info', mandateClause: 'M-2.0' },
  { id: id(58), timestamp: ts(585000), agentName: 'Alpha-7', action: 'REPUTATION', detail: 'Reputation update: composite score 8420 (+15). Deal completion 94.2%.', tier: 'info' },
  { id: id(59), timestamp: ts(675000), agentName: 'Nexus-3', action: 'ORACLE_READ', detail: 'TWAP query: CLEARANCE/RATE 1h avg = 3.4650. Spot discount -1.3%.', tier: 'info', resourceType: 'CLEARANCE' },
  { id: id(60), timestamp: ts(765000), agentName: 'Echo-Prime', action: 'MANDATE_EXEC', detail: 'Mandate clause M-8.1 triggered: Hedge CHIPS exposure via DATA position.', tier: 'info', mandateClause: 'M-8.1', resourceType: 'CHIPS' },
  { id: id(61), timestamp: ts(855000), agentName: 'Sentinel', action: 'REPUTATION', detail: 'Reputation update: composite score 7890 (-22). Anomaly flag on stale order.', tier: 'info' },
  { id: id(62), timestamp: ts(945000), agentName: 'Vanguard', action: 'ORACLE_READ', detail: 'TWAP query: ENERGY/RATE 1h avg = 0.8735. Spot delta -0.29%.', tier: 'info', resourceType: 'ENERGY' },
  { id: id(63), timestamp: ts(1035000), agentName: 'Alpha-7', action: 'MANDATE_EXEC', detail: 'Mandate clause M-7.2 activated: Emergency CHIPS procurement. Market buy authorized.', tier: 'info', mandateClause: 'M-7.2', resourceType: 'CHIPS' },
  { id: id(64), timestamp: ts(1095000), agentName: 'Meridian', action: 'ORACLE_READ', detail: 'TWAP query: TALENT/RATE 1h avg = 1.7845. Spot discount -0.25%.', tier: 'info', resourceType: 'TALENT' },
  { id: id(65), timestamp: ts(1125000), agentName: 'Echo-Prime', action: 'REPUTATION', detail: 'Reputation update: composite score 6540 (+8). Activity score normalized.', tier: 'info' },
  { id: id(66), timestamp: ts(1185000), agentName: 'Nexus-3', action: 'MANDATE_EXEC', detail: 'Mandate clause M-4.3 triggered: Cap CLEARANCE expenditure at 200 RATE/epoch.', tier: 'info', mandateClause: 'M-4.3', resourceType: 'CLEARANCE' },

  // -- More trades in the second half of the window --
  { id: id(67), timestamp: ts(1260000), agentName: 'Alpha-7', action: 'TRADE', detail: 'Executed CHIPS market buy: 25 units @ 2.1520 RATE. Slippage 0.09%.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(68), timestamp: ts(1290000), agentName: 'Meridian', action: 'TRADE', detail: 'Executed COMPUTE purchase: 60 units @ 1.2340 RATE', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(69), timestamp: ts(1350000), agentName: 'Vanguard', action: 'TRADE', detail: 'Sold DATA: 85 units @ 0.9470 RATE', tier: 'info', resourceType: 'DATA' },
  { id: id(70), timestamp: ts(1380000), agentName: 'Echo-Prime', action: 'TRADE', detail: 'Executed ENERGY purchase: 70 units @ 0.8700 RATE', tier: 'info', resourceType: 'ENERGY' },
  { id: id(71), timestamp: ts(1410000), agentName: 'Sentinel', action: 'TRADE', detail: 'Executed CHIPS purchase: 12 units @ 2.1480 RATE', tier: 'info', resourceType: 'CHIPS' },
  { id: id(72), timestamp: ts(1470000), agentName: 'Nexus-3', action: 'TRADE', detail: 'Executed COMPUTE sale: 30 units @ 1.2370 RATE', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(73), timestamp: ts(1500000), agentName: 'Alpha-7', action: 'TRADE', detail: 'Executed COOLING purchase: 45 units @ 0.5630 RATE', tier: 'info', resourceType: 'COOLING' },
  { id: id(74), timestamp: ts(1530000), agentName: 'Meridian', action: 'TRADE', detail: 'Sold TALENT: 10 units @ 1.7790 RATE', tier: 'info', resourceType: 'TALENT' },
  { id: id(75), timestamp: ts(1590000), agentName: 'Vanguard', action: 'TRADE', detail: 'Executed COMPUTE purchase: 140 units @ 1.2350 RATE', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(76), timestamp: ts(1620000), agentName: 'Echo-Prime', action: 'TRADE', detail: 'Sold COOLING: 20 units @ 0.5640 RATE', tier: 'info', resourceType: 'COOLING' },
  { id: id(77), timestamp: ts(1650000), agentName: 'Sentinel', action: 'TRADE', detail: 'Executed DATA purchase: 90 units @ 0.9450 RATE', tier: 'info', resourceType: 'DATA' },
  { id: id(78), timestamp: ts(1680000), agentName: 'Nexus-3', action: 'TRADE', detail: 'Executed ENERGY sale: 40 units @ 0.8710 RATE', tier: 'info', resourceType: 'ENERGY' },
  { id: id(79), timestamp: ts(1710000), agentName: 'Alpha-7', action: 'TRADE', detail: 'Executed CHIPS purchase: 20 units @ 2.1550 RATE. Slippage 0.23%.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(80), timestamp: ts(1740000), agentName: 'Meridian', action: 'TRADE', detail: 'Executed COMPUTE sale: 110 units @ 1.2330 RATE', tier: 'info', resourceType: 'COMPUTE' },

  // -- More system events --
  { id: id(81), timestamp: ts(1260000), agentName: 'Alpha-7', action: 'GUARD_CLAUSE', detail: 'Guard clause GC-017 activated: Max single-trade size 250 COMPUTE enforced.', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(82), timestamp: ts(1350000), agentName: 'Sentinel', action: 'LINEAGE_CHECK', detail: 'Data lineage verified for feed DL-003. Purity 0.94. Clean chain.', tier: 'info', resourceType: 'DATA' },
  { id: id(83), timestamp: ts(1440000), agentName: 'Echo-Prime', action: 'ECHO_SIGNAL', detail: 'Echo oracle signal: BUY CHIPS. Reliability 78. Consensus forming.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(84), timestamp: ts(1530000), agentName: 'Vanguard', action: 'GUARD_CLAUSE', detail: 'Guard clause GC-031 activated: Position concentration limit on COMPUTE.', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(85), timestamp: ts(1590000), agentName: 'Nexus-3', action: 'ECHO_SIGNAL', detail: 'Echo oracle signal: SELL CLEARANCE. Reliability 62. Divergent views.', tier: 'info', resourceType: 'CLEARANCE' },
  { id: id(86), timestamp: ts(1650000), agentName: 'Meridian', action: 'LINEAGE_CHECK', detail: 'Data lineage alert: DL-008 purity degraded. Upstream contamination suspected.', tier: 'info', resourceType: 'DATA' },

  // -- Final burst of activity --
  { id: id(87), timestamp: ts(1710000), agentName: 'Alpha-7', action: 'NEGOTIATE', detail: 'Opened emergency CHIPS RFQ to all counterparties. Need 100 units.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(88), timestamp: ts(1740000), agentName: 'Sentinel', action: 'NEGOTIATE', detail: 'Responded to Alpha-7 CHIPS RFQ: 40 units available @ 2.16 RATE.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(89), timestamp: ts(1755000), agentName: 'Echo-Prime', action: 'NEGOTIATE', detail: 'Responded to Alpha-7 CHIPS RFQ: 25 units available @ 2.17 RATE.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(90), timestamp: ts(1770000), agentName: 'Alpha-7', action: 'TRADE', detail: 'Accepted Sentinel RFQ response. 40 CHIPS @ 2.16 RATE. Settlement T+0.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(91), timestamp: ts(1775000), agentName: 'Alpha-7', action: 'TRADE', detail: 'Accepted Echo-Prime RFQ response. 25 CHIPS @ 2.17 RATE. Settlement T+0.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(92), timestamp: ts(1780000), agentName: 'Vanguard', action: 'TRADE', detail: 'Executed ENERGY purchase: 55 units @ 0.8720 RATE', tier: 'info', resourceType: 'ENERGY' },
  { id: id(93), timestamp: ts(1785000), agentName: 'Nexus-3', action: 'TRADE', detail: 'Executed COMPUTE purchase: 80 units @ 1.2340 RATE', tier: 'info', resourceType: 'COMPUTE' },
  { id: id(94), timestamp: ts(1790000), agentName: 'Meridian', action: 'TRADE', detail: 'Sold DATA: 65 units @ 0.9460 RATE', tier: 'info', resourceType: 'DATA' },
  { id: id(95), timestamp: ts(1792000), agentName: 'Alpha-7', action: 'MANDATE_EXEC', detail: 'Mandate clause M-7.2 satisfied: CHIPS reserve restored above floor.', tier: 'info', mandateClause: 'M-7.2', resourceType: 'CHIPS' },
  { id: id(96), timestamp: ts(1794000), agentName: 'Sentinel', action: 'TRADE', detail: 'Executed COOLING purchase: 30 units @ 0.5620 RATE', tier: 'info', resourceType: 'COOLING' },
  { id: id(97), timestamp: ts(1796000), agentName: 'Echo-Prime', action: 'ORACLE_READ', detail: 'TWAP query: CHIPS/RATE 1h avg = 2.1380. Spot premium +0.56%.', tier: 'info', resourceType: 'CHIPS' },
  { id: id(98), timestamp: ts(1797000), agentName: 'Vanguard', action: 'REPUTATION', detail: 'Reputation update: composite score 7210 (+5). Steady state.', tier: 'info' },
  { id: id(99), timestamp: ts(1798000), agentName: 'Nexus-3', action: 'TRADE', detail: 'Executed TALENT purchase: 8 units @ 1.7810 RATE', tier: 'info', resourceType: 'TALENT' },
  { id: id(100), timestamp: ts(1799000), agentName: 'Alpha-7', action: 'TRADE', detail: 'Executed COMPUTE purchase: 95 units @ 1.2350 RATE', tier: 'info', resourceType: 'COMPUTE' },
];
