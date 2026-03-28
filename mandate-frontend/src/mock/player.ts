import type { PlayerState } from './types';
import { resourceBalances } from './resources';

export const playerState: PlayerState = {
  name: 'Dominion-Prime',
  role: 'Compute Superpower',
  agentName: 'Alpha-7',
  rateBalance: "15000000000000000000000",
  resources: resourceBalances,
  currentMandate: `Prioritise COMPUTE acquisition. Trade surplus ENERGY at no less than 1.5:1 ratio. Reject deals with agents below 4000 reputation. Maintain minimum 500 CHIPS reserve.

If CHIPS reserves fall below 200, suspend all non-essential trades and issue emergency RFQ to top-3 reputation suppliers. Allocate 60% of TALENT to active Data Centres, remainder to Training Runs.

Do not engage in diplomatic agreements with agents who have active disinformation flags. Prefer bilateral trades over market orders when spread exceeds 0.05 RATE.`,
  mandateClarityScore: 72,
  mandateConstraintCount: 4,
  mandateLastUpdated: '2h ago',
  agentConfidence: 'High',
};
