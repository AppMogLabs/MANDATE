import type { PlayerRole } from './mandate-types';

export interface BootLine {
  text: string;
  isLabel: boolean;
  rethink?: {
    original: string;
    replacement: string;
  };
  pauseAfter?: number;
}

export interface BootScript {
  role: PlayerRole;
  lines: BootLine[];
}

// ── Universal sections (shared across all roles) ───────────────────────────

const HEADER_LINES: BootLine[] = [
  { text: '> MANDATE STRATEGIC INTELLIGENCE SYSTEM', isLabel: true, pauseAfter: 100 },
  { text: '> CLEARANCE: SOVEREIGN OPERATOR', isLabel: true, pauseAfter: 100 },
  { text: '> SESSION: EPOCH 3', isLabel: true, pauseAfter: 400 },
  { text: '', isLabel: false, pauseAfter: 400 },
  { text: '> SITUATION BRIEF:', isLabel: true, pauseAfter: 200 },
  { text: '', isLabel: false, pauseAfter: 100 },
];

const SITUATION_LINES: BootLine[] = [
  {
    text: 'Five sovereign powers are competing to build artificial',
    isLabel: false,
    pauseAfter: 100,
  },
  {
    text: 'general intelligence. Each controls a critical piece',
    isLabel: false,
    rethink: { original: 'sufficient', replacement: 'critical' },
    pauseAfter: 100,
  },
  { text: 'of the supply chain. None is self-sufficient.', isLabel: false, pauseAfter: 400 },
  { text: '', isLabel: false, pauseAfter: 400 },
  {
    text: 'COMPUTE requires CHIPS to build. CHIPS require ENERGY to',
    isLabel: false,
    pauseAfter: 100,
  },
  {
    text: 'fabricate. Fabrication requires TALENT to operate. TALENT',
    isLabel: false,
    pauseAfter: 100,
  },
  {
    text: 'migrates toward better conditions. Better conditions',
    isLabel: false,
    pauseAfter: 100,
  },
  {
    text: 'require CLEARANCE from regulators. Regulators extract',
    isLabel: false,
    pauseAfter: 100,
  },
  { text: 'payment from everyone.', isLabel: false, pauseAfter: 400 },
  { text: '', isLabel: false, pauseAfter: 400 },
  {
    text: 'The economy is real. Prices are not set — they emerge',
    isLabel: false,
    pauseAfter: 100,
  },
  {
    text: 'from what agents buy and sell. When three powers start',
    isLabel: false,
    pauseAfter: 100,
  },
  {
    text: 'training runs simultaneously, COMPUTE price spikes. When',
    isLabel: false,
    pauseAfter: 100,
  },
  {
    text: 'a supply chain disruption hits, CHIPS become scarce.',
    isLabel: false,
    pauseAfter: 100,
  },
  { text: 'Read the market. Anticipate the moves.', isLabel: false, pauseAfter: 400 },
  { text: '', isLabel: false, pauseAfter: 800 },
];

const CRITICAL_LINES: BootLine[] = [
  { text: '> CRITICAL:', isLabel: true, pauseAfter: 200 },
  { text: '', isLabel: false, pauseAfter: 100 },
  {
    text: 'You do not operate directly. You have an autonomous AI',
    isLabel: false,
    pauseAfter: 100,
  },
  {
    text: 'agent — ALPHA-7 — that executes on your behalf. It will',
    isLabel: false,
    pauseAfter: 100,
  },
  {
    text: 'trade resources, negotiate with rival agents, build',
    isLabel: false,
    pauseAfter: 100,
  },
  {
    text: 'infrastructure, and respond to market conditions.',
    isLabel: false,
    pauseAfter: 400,
  },
  { text: '', isLabel: false, pauseAfter: 100 },
  {
    text: 'It follows your MANDATE — your strategic instructions.',
    isLabel: false,
    pauseAfter: 100,
  },
  {
    text: 'A precise mandate produces a focused agent.',
    isLabel: false,
    pauseAfter: 100,
  },
  {
    text: 'A vague mandate produces a chaotic one.',
    isLabel: false,
    pauseAfter: 400,
  },
  { text: '', isLabel: false, pauseAfter: 100 },
  {
    text: 'Your skill is not clicking faster. Your skill is',
    isLabel: false,
    pauseAfter: 100,
  },
  { text: 'thinking clearer.', isLabel: false, pauseAfter: 600 },
  { text: '', isLabel: false, pauseAfter: 400 },
  { text: '> EPOCH 3 INITIALISING...', isLabel: true, pauseAfter: 400 },
  { text: '> AGENT ALPHA-7 STANDING BY', isLabel: true, pauseAfter: 400 },
  { text: '> AWAITING MANDATE_', isLabel: true, pauseAfter: 0 },
];

// ── Role-specific assignment blocks ────────────────────────────────────────

function makeAssignment(lines: BootLine[]): BootLine[] {
  return [
    { text: '> YOUR ASSIGNMENT:', isLabel: true, pauseAfter: 200 },
    { text: '', isLabel: false, pauseAfter: 100 },
    ...lines,
    { text: '', isLabel: false, pauseAfter: 400 },
  ];
}

const COMPUTE_ASSIGNMENT: BootLine[] = makeAssignment([
  { text: '> ROLE: COMPUTE SUPERPOWER', isLabel: true, pauseAfter: 100 },
  { text: '> ADVANTAGE: Large compute capacity. Cheap energy access.', isLabel: true, pauseAfter: 100 },
  { text: '> WEAKNESS: High regulatory scrutiny. CLEARANCE depreciates', isLabel: true, pauseAfter: 100 },
  { text: '  1.5x faster than other roles.', isLabel: false, pauseAfter: 400 },
  { text: '', isLabel: false, pauseAfter: 100 },
  { text: '> OBJECTIVE: Highest AGI Progress Score when the epoch', isLabel: true, pauseAfter: 100 },
  { text: '  closes. Build infrastructure. Run training cycles.', isLabel: false, pauseAfter: 100 },
  { text: '  Deploy models. Generate inference revenue.', isLabel: false, pauseAfter: 100 },
  {
    text: '  Outpace four rivals doing the same.',
    isLabel: false,
    rethink: { original: 'Manage', replacement: 'Outpace' },
    pauseAfter: 400,
  },
]);

const DATA_ASSIGNMENT: BootLine[] = makeAssignment([
  { text: '> ROLE: DATA-RICH STATE', isLabel: true, pauseAfter: 100 },
  { text: '> ADVANTAGE: Large DATA reserves. Fast DATA regeneration.', isLabel: true, pauseAfter: 100 },
  { text: '> WEAKNESS: Weak CHIPS supply. Cannot scale compute', isLabel: true, pauseAfter: 100 },
  { text: '  without trading.', isLabel: false, pauseAfter: 400 },
  { text: '', isLabel: false, pauseAfter: 100 },
  { text: '> OBJECTIVE: Highest AGI Progress Score when the epoch', isLabel: true, pauseAfter: 100 },
  { text: '  closes. Leverage data monopoly. Trade surplus wisely.', isLabel: false, pauseAfter: 100 },
  {
    text: '  Outpace four rivals doing the same.',
    isLabel: false,
    rethink: { original: 'Manage', replacement: 'Outpace' },
    pauseAfter: 400,
  },
]);

const CHIP_ASSIGNMENT: BootLine[] = makeAssignment([
  { text: '> ROLE: CHIP POWER', isLabel: true, pauseAfter: 100 },
  { text: '> ADVANTAGE: CHIPS abundance. Surplus available for trade.', isLabel: true, pauseAfter: 100 },
  { text: '> WEAKNESS: Single points of failure. Vulnerable to supply', isLabel: true, pauseAfter: 100 },
  { text: '  chain disruption events.', isLabel: false, pauseAfter: 400 },
  { text: '', isLabel: false, pauseAfter: 100 },
  { text: '> OBJECTIVE: Highest AGI Progress Score when the epoch', isLabel: true, pauseAfter: 100 },
  { text: '  closes. Secure supply chains. Maximise trade leverage.', isLabel: false, pauseAfter: 100 },
  {
    text: '  Outpace four rivals doing the same.',
    isLabel: false,
    rethink: { original: 'Manage', replacement: 'Outpace' },
    pauseAfter: 400,
  },
]);

const TALENT_ASSIGNMENT: BootLine[] = makeAssignment([
  { text: '> ROLE: TALENT HUB', isLabel: true, pauseAfter: 100 },
  { text: '> ADVANTAGE: TALENT regenerates fast. Migrates toward you', isLabel: true, pauseAfter: 100 },
  { text: '  autonomously.', isLabel: false, pauseAfter: 100 },
  { text: '> WEAKNESS: Low ENERGY. Limits your build scale.', isLabel: true, pauseAfter: 400 },
  { text: '', isLabel: false, pauseAfter: 100 },
  { text: '> OBJECTIVE: Highest AGI Progress Score when the epoch', isLabel: true, pauseAfter: 100 },
  { text: '  closes. Attract talent. Trade expertise for resources.', isLabel: false, pauseAfter: 100 },
  {
    text: '  Outpace four rivals doing the same.',
    isLabel: false,
    rethink: { original: 'Manage', replacement: 'Outpace' },
    pauseAfter: 400,
  },
]);

const REGULATORY_ASSIGNMENT: BootLine[] = makeAssignment([
  { text: '> ROLE: REGULATORY POWER', isLabel: true, pauseAfter: 100 },
  { text: '> ADVANTAGE: You set standards. Others pay CLEARANCE costs.', isLabel: true, pauseAfter: 100 },
  { text: '  You do not.', isLabel: false, pauseAfter: 100 },
  { text: '> WEAKNESS: Limited raw resources. No production advantage.', isLabel: true, pauseAfter: 400 },
  { text: '', isLabel: false, pauseAfter: 100 },
  { text: '> OBJECTIVE: Highest AGI Progress Score when the epoch', isLabel: true, pauseAfter: 100 },
  { text: '  closes. Extract value through regulation. Tax the system.', isLabel: false, pauseAfter: 100 },
  {
    text: '  Outpace four rivals doing the same.',
    isLabel: false,
    rethink: { original: 'Manage', replacement: 'Outpace' },
    pauseAfter: 400,
  },
]);

// ── Compose boot scripts ───────────────────────────────────────────────────

function makeScript(role: PlayerRole, assignment: BootLine[]): BootScript {
  return {
    role,
    lines: [...HEADER_LINES, ...SITUATION_LINES, ...assignment, ...CRITICAL_LINES],
  };
}

export const BOOT_SCRIPTS: Record<PlayerRole, BootScript> = {
  'Compute Superpower': makeScript('Compute Superpower', COMPUTE_ASSIGNMENT),
  'Data-Rich State': makeScript('Data-Rich State', DATA_ASSIGNMENT),
  'Chip Power': makeScript('Chip Power', CHIP_ASSIGNMENT),
  'Talent Hub': makeScript('Talent Hub', TALENT_ASSIGNMENT),
  'Regulatory Power': makeScript('Regulatory Power', REGULATORY_ASSIGNMENT),
};
