import type { HexTile } from './types';

export const hexTiles: HexTile[] = [
  // Row r = -3
  { q: -1, r: -3, terrain: 'coastal', owner: 'Nexus-3' },
  { q: 0, r: -3, terrain: 'industrial', owner: 'Alpha-7', building: { type: 'Fabrication Plant', tier: 2, producing: 'CHIPS' } },
  { q: 1, r: -3, terrain: 'flat' },
  { q: 2, r: -3, terrain: 'coastal' },

  // Row r = -2
  { q: -2, r: -2, terrain: 'flat' },
  { q: -1, r: -2, terrain: 'industrial', owner: 'Alpha-7', building: { type: 'Compute Cluster', tier: 3, producing: 'COMPUTE' } },
  { q: 0, r: -2, terrain: 'urban', owner: 'Meridian' },
  { q: 1, r: -2, terrain: 'industrial', owner: 'Meridian', building: { type: 'Energy Grid', tier: 2, producing: 'ENERGY' } },
  { q: 2, r: -2, terrain: 'flat', owner: 'Vanguard' },

  // Row r = -1
  { q: -2, r: -1, terrain: 'research', owner: 'Echo-Prime', building: { type: 'Data Refinery', tier: 1, producing: 'DATA' } },
  { q: -1, r: -1, terrain: 'urban', owner: 'Alpha-7' },
  { q: 0, r: -1, terrain: 'urban', owner: 'Alpha-7', building: { type: 'Compute Cluster', tier: 2, producing: 'COMPUTE' } },
  { q: 1, r: -1, terrain: 'flat', owner: 'Sentinel' },
  { q: 2, r: -1, terrain: 'research', owner: 'Vanguard', building: { type: 'Data Refinery', tier: 2, producing: 'DATA' } },
  { q: 3, r: -1, terrain: 'coastal' },

  // Row r = 0
  { q: -3, r: 0, terrain: 'regulatory', owner: 'Nexus-3', building: { type: 'Regulatory Office', tier: 1, producing: 'CLEARANCE' } },
  { q: -2, r: 0, terrain: 'industrial', owner: 'Sentinel', building: { type: 'Energy Grid', tier: 1, producing: 'ENERGY' } },
  { q: -1, r: 0, terrain: 'urban', owner: 'Alpha-7', building: { type: 'Talent Academy', tier: 2, producing: 'TALENT' } },
  { q: 0, r: 0, terrain: 'urban', owner: 'Alpha-7' },
  { q: 1, r: 0, terrain: 'industrial', owner: 'Meridian', building: { type: 'Fabrication Plant', tier: 1, producing: 'CHIPS' } },
  { q: 2, r: 0, terrain: 'flat', owner: 'Echo-Prime' },
  { q: 3, r: 0, terrain: 'flat' },

  // Row r = 1
  { q: -3, r: 1, terrain: 'flat' },
  { q: -2, r: 1, terrain: 'industrial', owner: 'Alpha-7', building: { type: 'Compute Cluster', tier: 1, producing: 'COMPUTE' } },
  { q: -1, r: 1, terrain: 'flat', owner: 'Sentinel' },
  { q: 0, r: 1, terrain: 'research', owner: 'Echo-Prime', building: { type: 'Data Refinery', tier: 1, producing: 'DATA' } },
  { q: 1, r: 1, terrain: 'urban', owner: 'Vanguard' },
  { q: 2, r: 1, terrain: 'coastal', owner: 'Nexus-3' },

  // Row r = 2
  { q: -3, r: 2, terrain: 'coastal' },
  { q: -2, r: 2, terrain: 'flat', owner: 'Sentinel' },
  { q: -1, r: 2, terrain: 'industrial', owner: 'Alpha-7', building: { type: 'Cooling Tower', tier: 2, producing: 'COOLING' } },
  { q: 0, r: 2, terrain: 'flat', owner: 'Meridian' },
  { q: 1, r: 2, terrain: 'regulatory', owner: 'Nexus-3', building: { type: 'Regulatory Office', tier: 2, producing: 'CLEARANCE' } },
  { q: 2, r: 2, terrain: 'flat' },

  // Row r = 3
  { q: -3, r: 3, terrain: 'flat' },
  { q: -2, r: 3, terrain: 'coastal' },
  { q: -1, r: 3, terrain: 'flat', owner: 'Echo-Prime' },
  { q: 0, r: 3, terrain: 'industrial', owner: 'Echo-Prime', building: { type: 'Cooling Tower', tier: 1, producing: 'COOLING' } },
  { q: 1, r: 3, terrain: 'flat', owner: 'Vanguard' },

  // Scattered extras for variety
  { q: 3, r: -3, terrain: 'flat' },
  { q: -3, r: -1, terrain: 'coastal' },
  { q: 3, r: 1, terrain: 'regulatory' },
  { q: -3, r: -2, terrain: 'flat' },
  { q: 3, r: -2, terrain: 'research', owner: 'Vanguard' },
  { q: -2, r: -3, terrain: 'flat', owner: 'Sentinel' },
  { q: 3, r: 2, terrain: 'flat' },
  { q: 2, r: 3, terrain: 'coastal' },
  { q: 3, r: 3, terrain: 'flat' },
];
