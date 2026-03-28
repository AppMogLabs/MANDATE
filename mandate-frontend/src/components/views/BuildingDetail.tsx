"use client";

import type { BuildingInfo } from "@/mock/types";
import { RESOURCE_TW_COLOURS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";

interface BuildingDetailProps {
  building: BuildingInfo | null;
}

export function BuildingDetail({ building }: BuildingDetailProps) {
  if (!building) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-sm text-text-tertiary font-dashboard">
          Select a building on the map
        </span>
      </div>
    );
  }

  const tierIndicator = Array.from({ length: 3 }, (_, i) => (
    <div
      key={i}
      className={`w-2 h-2 rounded-full ${
        i < building.tier ? "bg-moon-white" : "bg-surface-3"
      }`}
    />
  ));

  return (
    <div className="h-full overflow-y-auto p-4 font-dashboard space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-lg text-text-primary">{building.name}</h3>
          <div className="flex items-center gap-1">{tierIndicator}</div>
        </div>
        <p className="text-xs text-text-secondary">{building.type}</p>
      </div>

      {/* Production */}
      <div className="space-y-2">
        <h4 className="text-xs text-text-tertiary uppercase tracking-wider">
          Production
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs text-text-tertiary">Output/hr</span>
            <div
              className={`text-sm tabular-nums ${RESOURCE_TW_COLOURS[building.producing]}`}
            >
              {formatNumber(building.productionPerHour)} {building.producing}
            </div>
          </div>
          <div>
            <span className="text-xs text-text-tertiary">Efficiency</span>
            <div className="text-sm tabular-nums text-text-primary">
              {building.efficiency}%
            </div>
          </div>
        </div>
      </div>

      {/* Inputs */}
      {building.inputs && building.inputs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs text-text-tertiary uppercase tracking-wider">
            Inputs Required
          </h4>
          {building.inputs.map((input) => (
            <div
              key={input.resource}
              className="flex justify-between text-sm"
            >
              <span
                className={RESOURCE_TW_COLOURS[input.resource]}
              >
                {input.resource}
              </span>
              <span className="tabular-nums text-text-secondary">
                {formatNumber(input.amountPerHour)}/hr
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Workers */}
      <div className="space-y-2">
        <h4 className="text-xs text-text-tertiary uppercase tracking-wider">
          Workers
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs text-text-tertiary">TALENT allocated</span>
            <div className="text-sm tabular-nums text-talent">
              {building.talentAllocated}
            </div>
          </div>
          <div>
            <span className="text-xs text-text-tertiary">Worker efficiency</span>
            <div className="text-sm tabular-nums text-text-primary">
              {building.workerEfficiency}%
            </div>
          </div>
        </div>
      </div>

      {/* Costs */}
      <div className="space-y-2">
        <h4 className="text-xs text-text-tertiary uppercase tracking-wider">
          Costs
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs text-text-tertiary">ENERGY/hr</span>
            <div className="text-sm tabular-nums text-energy">
              {formatNumber(building.energyConsumption)}
            </div>
          </div>
          <div>
            <span className="text-xs text-text-tertiary">Tile rent/day</span>
            <div className="text-sm tabular-nums text-text-primary">
              {formatNumber(building.tileRentPerDay)} RATE
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade */}
      {building.upgradeCost != null && building.tier < 3 && (
        <div className="space-y-2 pt-2 border-t border-border-default">
          <h4 className="text-xs text-text-tertiary uppercase tracking-wider">
            Upgrade to Tier {building.tier + 1}
          </h4>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Cost</span>
            <span className="tabular-nums text-text-primary">
              {formatNumber(building.upgradeCost)} RATE
            </span>
          </div>
          {building.upgradeCooldown != null && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Cooldown</span>
              <span className="tabular-nums text-text-tertiary">
                {building.upgradeCooldown}h remaining
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BuildingDetail;
