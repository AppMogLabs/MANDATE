"use client";

import { useState } from "react";
import { Button } from "@/components/interactive/Button";
import type { ResourceType } from "@/mock/types";

const BUILDING_TYPES = [
  { id: 0, name: "Data Centre", produces: "COMPUTE" as ResourceType, rate: "5.0/hr", desc: "Core compute production" },
  { id: 1, name: "Power Plant", produces: "ENERGY" as ResourceType, rate: "4.0/hr", desc: "Primary energy source" },
  { id: 2, name: "Solar Array", produces: "ENERGY" as ResourceType, rate: "2.5/hr", desc: "Cheaper build, lower output" },
  { id: 3, name: "Fabrication Contract", produces: "CHIPS" as ResourceType, rate: "1.5/hr", desc: "Scarce chip production" },
  { id: 4, name: "Recruiting Pipeline", produces: "TALENT" as ResourceType, rate: "1.2/hr", desc: "Talent acquisition" },
  { id: 5, name: "Data Acquisition Hub", produces: "DATA" as ResourceType, rate: "3.5/hr", desc: "Data harvesting" },
  { id: 6, name: "Cooling Infrastructure", produces: "COOLING" as ResourceType, rate: "3.0/hr", desc: "Thermal management" },
  { id: 9, name: "Lobbying Office", produces: "CLEARANCE" as ResourceType, rate: "2.0/hr", desc: "Political influence" },
  { id: 13, name: "Patent Portfolio", produces: "CLEARANCE" as ResourceType, rate: "3.0/hr", desc: "IP protection (premium)" },
  { id: 12, name: "Deployed Model", produces: "COMPUTE" as ResourceType, rate: "8.0/hr", desc: "Premium compute (requires training)" },
] as const;

// Abbreviations for building types (same as WorldMap)
const BUILDING_ABBREV: Record<number, string> = {
  0: "DC", 1: "PP", 2: "SA", 3: "FC", 4: "RP",
  5: "DH", 6: "CI", 9: "LO", 12: "DM", 13: "PP",
};

// Resource colours (CSS var names)
const RESOURCE_COLOUR: Record<ResourceType, string> = {
  COMPUTE: "var(--colour-compute)",
  ENERGY: "var(--colour-energy)",
  CHIPS: "var(--colour-chips)",
  COOLING: "var(--colour-cooling)",
  TALENT: "var(--colour-talent)",
  DATA: "var(--colour-data)",
  CLEARANCE: "var(--colour-clearance)",
};

interface BuildingConstructorProps {
  readonly tileId: number;
  readonly onConstruct: (buildingType: number, tileId: number) => Promise<void>;
}

export function BuildingConstructor({ tileId, onConstruct }: BuildingConstructorProps) {
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [constructing, setConstructing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConstruct = async () => {
    if (selectedType === null) return;
    setConstructing(true);
    setError(null);
    try {
      await onConstruct(selectedType, tileId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Construction failed");
    } finally {
      setConstructing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-3 font-dashboard space-y-3">
      <div>
        <h3 className="text-sm text-text-primary">Build on Tile #{tileId}</h3>
        <p className="text-xs text-text-tertiary mt-0.5">Select a building type</p>
      </div>

      <div className="space-y-1.5">
        {BUILDING_TYPES.map((bt) => (
          <button
            key={bt.id}
            onClick={() => setSelectedType(bt.id)}
            className={[
              "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors",
              selectedType === bt.id
                ? "bg-surface-hover border border-border-focus"
                : "bg-surface-2 border border-transparent hover:border-border-default",
            ].join(" ")}
          >
            <span
              className="w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold"
              style={{ backgroundColor: RESOURCE_COLOUR[bt.produces] + "30", color: RESOURCE_COLOUR[bt.produces] }}
            >
              {BUILDING_ABBREV[bt.id] ?? "??"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-text-primary truncate">{bt.name}</div>
              <div className="text-[10px] text-text-tertiary">{bt.desc}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs tabular-nums" style={{ color: RESOURCE_COLOUR[bt.produces] }}>{bt.rate}</div>
              <div className="text-[10px] text-text-tertiary">{bt.produces}</div>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <div className="text-xs font-dashboard rounded px-2 py-1.5 bg-status-critical/10 text-status-critical">
          {error}
        </div>
      )}

      <Button
        variant="primary"
        size="sm"
        disabled={selectedType === null || constructing}
        onClick={handleConstruct}
      >
        {constructing ? "Building..." : "Construct"}
      </Button>
    </div>
  );
}
