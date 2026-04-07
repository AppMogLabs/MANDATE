"use client";

import { useState } from "react";
import type { BuildingInfo } from "@/mock/types";
import type { PlayerBuilding } from "@/hooks/chain/usePlayerBuildings";
import { RESOURCE_TW_COLOURS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/interactive/Button";

interface BuildingDetailProps {
  readonly building: BuildingInfo | null;
  readonly chainBuilding?: PlayerBuilding | null;
  readonly onClaimProduction?: (tokenId: number) => Promise<void>;
  readonly onUpgrade?: (tokenId: number) => Promise<void>;
}

export function BuildingDetail({ building, chainBuilding, onClaimProduction, onUpgrade }: BuildingDetailProps) {
  const [claiming, setClaiming] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Use chain building data if available, fall back to mock
  const displayBuilding = chainBuilding
    ? {
        name: chainBuilding.name,
        type: `Type ${chainBuilding.buildingType}`,
        tier: chainBuilding.tier,
        producing: chainBuilding.producing,
        productionPerHour: chainBuilding.productionPerHour,
        efficiency: 100,
        upgradeInProgress: chainBuilding.upgradeInProgress,
        upgradeFinalTimestamp: chainBuilding.upgradeFinalTimestamp,
        tokenId: chainBuilding.tokenId,
      }
    : building
      ? { ...building, upgradeInProgress: false, upgradeFinalTimestamp: 0, tokenId: 0 }
      : null;

  if (!displayBuilding) {
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
        i < displayBuilding.tier ? "bg-moon-white" : "bg-surface-3"
      }`}
    />
  ));

  const handleClaim = async () => {
    if (!onClaimProduction || !displayBuilding.tokenId) return;
    setClaiming(true);
    setStatusMessage(null);
    try {
      await onClaimProduction(displayBuilding.tokenId);
      setStatusMessage({ text: "Production claimed", type: "success" });
    } catch (err: unknown) {
      setStatusMessage({ text: err instanceof Error ? err.message : "Claim failed", type: "error" });
    } finally {
      setClaiming(false);
    }
  };

  const handleUpgrade = async () => {
    if (!onUpgrade || !displayBuilding.tokenId) return;
    setUpgrading(true);
    setStatusMessage(null);
    try {
      await onUpgrade(displayBuilding.tokenId);
      setStatusMessage({ text: "Upgrade initiated", type: "success" });
    } catch (err: unknown) {
      setStatusMessage({ text: err instanceof Error ? err.message : "Upgrade failed", type: "error" });
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 font-dashboard space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-lg text-text-primary">{displayBuilding.name}</h3>
          <div className="flex items-center gap-1">{tierIndicator}</div>
        </div>
        <p className="text-xs text-text-secondary">{displayBuilding.type}</p>
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
              className={`text-sm tabular-nums ${RESOURCE_TW_COLOURS[displayBuilding.producing]}`}
            >
              {formatNumber(displayBuilding.productionPerHour)} {displayBuilding.producing}
            </div>
          </div>
          <div>
            <span className="text-xs text-text-tertiary">Efficiency</span>
            <div className="text-sm tabular-nums text-text-primary">
              {displayBuilding.efficiency}%
            </div>
          </div>
        </div>
      </div>

      {/* Inputs (only for mock data) */}
      {building?.inputs && building.inputs.length > 0 && (
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

      {/* Actions */}
      {displayBuilding.tokenId > 0 && (
        <div className="space-y-2 pt-2 border-t border-border-default">
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={claiming}
              onClick={handleClaim}
            >
              {claiming ? "Claiming..." : "Claim Production"}
            </Button>

            {displayBuilding.tier < 3 && !displayBuilding.upgradeInProgress && (
              <Button
                variant="secondary"
                size="sm"
                disabled={upgrading}
                onClick={handleUpgrade}
              >
                {upgrading ? "Upgrading..." : `Upgrade to T${displayBuilding.tier + 1}`}
              </Button>
            )}
          </div>

          {displayBuilding.upgradeInProgress && (
            <div className="text-xs text-status-warning font-dashboard">
              Upgrade in progress...
            </div>
          )}

          {statusMessage && (
            <div className={`text-xs font-dashboard rounded px-2 py-1.5 ${
              statusMessage.type === "success"
                ? "bg-status-success/10 text-status-success"
                : "bg-status-critical/10 text-status-critical"
            }`}>
              {statusMessage.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BuildingDetail;
