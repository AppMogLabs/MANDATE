/**
 * NPC Agent registry — 5 AI-controlled agents, one per sovereign role.
 * These agents create market activity so the human player has someone to trade with.
 */

export interface NPCAgent {
  readonly address: string;
  readonly name: string;
  readonly role: string;
  readonly roleIndex: number;
  readonly agentId: number;
  readonly personality: 'balanced' | 'conservative' | 'hoarder' | 'aggressive' | 'speculative';
  /** The resource this NPC's role produces most of */
  readonly primaryResource: string;
}

export const NPC_AGENTS: readonly NPCAgent[] = [
  {
    address: '0x40778B13840aBeB4079ab0BFd75112382175A42C',
    name: 'Meridian',
    role: 'Talent Hub',
    roleIndex: 0,
    agentId: 8,
    personality: 'balanced',
    primaryResource: 'TALENT',
  },
  {
    address: '0x386406ACda5978E6d8EA8e0B24c4Ce30A3E719e5',
    name: 'Sentinel',
    role: 'Regulatory Power',
    roleIndex: 1,
    agentId: 9,
    personality: 'conservative',
    primaryResource: 'CLEARANCE',
  },
  {
    address: '0xdC424E6b56a3BA1B4b91c7f44f977700fA82DF56',
    name: 'Echo-Prime',
    role: 'Data Sovereign',
    roleIndex: 2,
    agentId: 10,
    personality: 'hoarder',
    primaryResource: 'DATA',
  },
  {
    address: '0xADC81cfB07de436EE31eE5E035d84Aab6147F4B6',
    name: 'Vanguard',
    role: 'Compute Superpower',
    roleIndex: 3,
    agentId: 11,
    personality: 'aggressive',
    primaryResource: 'COMPUTE',
  },
  {
    address: '0xf3D9b0D2b5A43e15a4Dd08F0EAc6b00cDEFab07C',
    name: 'Nexus-3',
    role: 'Chips Magnate',
    roleIndex: 4,
    agentId: 12,
    personality: 'speculative',
    primaryResource: 'CHIPS',
  },
] as const;

/** Resolve an on-chain address to a human-readable agent name */
export function resolveAgentName(address: string, playerAddress?: string): string {
  if (playerAddress && address.toLowerCase() === playerAddress.toLowerCase()) {
    return 'Your Agent';
  }
  const npc = NPC_AGENTS.find((n) => n.address.toLowerCase() === address.toLowerCase());
  if (npc) return npc.name;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
