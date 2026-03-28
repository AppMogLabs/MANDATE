import type { ResourceType } from "@/mock/types";

export const RESOURCE_COLOURS: Record<ResourceType, string> = {
  COMPUTE: "var(--colour-compute)",
  ENERGY: "var(--colour-energy)",
  CHIPS: "var(--colour-chips)",
  COOLING: "var(--colour-cooling)",
  TALENT: "var(--colour-talent)",
  DATA: "var(--colour-data)",
  CLEARANCE: "var(--colour-clearance)",
};

export const RESOURCE_TW_COLOURS: Record<ResourceType, string> = {
  COMPUTE: "text-compute",
  ENERGY: "text-energy",
  CHIPS: "text-chips",
  COOLING: "text-cooling",
  TALENT: "text-talent",
  DATA: "text-data",
  CLEARANCE: "text-clearance",
};

export const RESOURCE_BG_COLOURS: Record<ResourceType, string> = {
  COMPUTE: "bg-compute/15",
  ENERGY: "bg-energy/15",
  CHIPS: "bg-chips/15",
  COOLING: "bg-cooling/15",
  TALENT: "bg-talent/15",
  DATA: "bg-data/15",
  CLEARANCE: "bg-clearance/15",
};

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  COMPUTE: "CMP",
  ENERGY: "NRG",
  CHIPS: "CHP",
  COOLING: "CLG",
  TALENT: "TLT",
  DATA: "DTA",
  CLEARANCE: "CLR",
};

export const RESOURCE_ORDER: readonly ResourceType[] = [
  "COMPUTE",
  "ENERGY",
  "CHIPS",
  "COOLING",
  "TALENT",
  "DATA",
  "CLEARANCE",
] as const;

export const TERRAIN_COLOURS: Record<string, string> = {
  urban: "#2A2A3D",
  industrial: "#2D2A23",
  research: "#232A2D",
  coastal: "#23292D",
  regulatory: "#2D232A",
  flat: "#252525",
};

export const TERRAIN_LABELS: Record<string, string> = {
  urban: "High-Density Urban",
  industrial: "Industrial Zone",
  research: "Research Corridor",
  coastal: "Coastal/Port",
  regulatory: "Regulatory District",
  flat: "Flat/Mixed",
};

export const NOTIFICATION_TIERS = {
  critical: {
    colour: "var(--status-critical)",
    borderWidth: "3px",
    tw: "border-status-critical",
  },
  warning: {
    colour: "var(--status-warning)",
    borderWidth: "2px",
    tw: "border-status-warning",
  },
  info: {
    colour: "var(--status-info)",
    borderWidth: "1px",
    tw: "border-text-tertiary",
  },
} as const;

export const MAP_MODES = [
  "terrain",
  "buildings",
  "territory",
  "production",
  "intelligence",
] as const;

export type MapMode = (typeof MAP_MODES)[number];

export const VIEW_NAMES = [
  "Overview",
  "Map",
  "Market",
  "Buildings",
  "Intelligence",
  "Mandate",
] as const;

export type ViewName = (typeof VIEW_NAMES)[number];

export const RESOURCE_PRODUCERS: Record<ResourceType, string[]> = {
  COMPUTE: ["Data Centres", "Deployed Models"],
  ENERGY: ["Power Plants", "Solar Farms", "Fusion Reactors"],
  CHIPS: ["Fabrication Plants", "Assembly Lines"],
  COOLING: ["Cooling Towers", "Cryo Facilities"],
  TALENT: ["Universities", "Training Academies"],
  DATA: ["Data Refineries", "Sensor Arrays"],
  CLEARANCE: ["Regulatory Offices", "Compliance Bureaus"],
};

export const RESOURCE_CONSUMERS: Record<ResourceType, string[]> = {
  COMPUTE: ["Training Runs", "Inference", "Guard Clauses"],
  ENERGY: ["All Buildings", "Processing Plants", "Data Centres"],
  CHIPS: ["Hardware Upgrades", "New Construction", "Maintenance"],
  COOLING: ["Data Centres", "Fabrication Plants", "Processing"],
  TALENT: ["Data Centres", "Research Labs", "Regulatory Offices"],
  DATA: ["Intelligence Operations", "Echo Oracles", "Guard Clauses"],
  CLEARANCE: ["Building Permits", "Trade Licences", "Zone Access"],
};
