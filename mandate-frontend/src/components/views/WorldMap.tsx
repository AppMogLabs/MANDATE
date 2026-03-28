"use client";

import { useState } from "react";
import type { HexTile } from "@/mock/types";
import { TERRAIN_LABELS, MAP_MODES, type MapMode } from "@/lib/constants";
import { RESOURCE_TW_COLOURS } from "@/lib/constants";
import { Tooltip } from "@/components/tooltip";

interface WorldMapProps {
  tiles: HexTile[];
}

const HEX_SIZE = 32;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const HEX_HEIGHT = 2 * HEX_SIZE;

function hexToPixel(q: number, r: number): { x: number; y: number } {
  const x = HEX_WIDTH * (q + r * 0.5);
  const y = HEX_HEIGHT * 0.75 * r;
  return { x, y };
}

function hexPoints(cx: number, cy: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push(
      `${cx + HEX_SIZE * Math.cos(angle)},${cy + HEX_SIZE * Math.sin(angle)}`
    );
  }
  return points.join(" ");
}

// ── Resource colour hex values for SVG fills ──────────────────────────────

const RESOURCE_HEX_COLOURS: Record<string, string> = {
  COMPUTE: "#7EAAD4",
  ENERGY: "#F5AF94",
  CHIPS: "#F5949D",
  COOLING: "#70BAD2",
  TALENT: "#F786C6",
  DATA: "#90D79F",
  CLEARANCE: "#6DD0A9",
};

// Terrain → resource colour mapping for tinted terrain mode
const TERRAIN_RESOURCE_COLOUR: Record<string, string> = {
  urban: RESOURCE_HEX_COLOURS.COMPUTE,
  industrial: RESOURCE_HEX_COLOURS.ENERGY,
  research: RESOURCE_HEX_COLOURS.TALENT,
  coastal: RESOURCE_HEX_COLOURS.DATA,
  regulatory: RESOURCE_HEX_COLOURS.CLEARANCE,
  flat: "#333334", // surface-hover
};

function hexWithOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// ── Tile colour per mode ──────────────────────────────────────────────────

// Player's agent name in mock data — tiles owned by this agent are "ours"
const PLAYER_AGENT = "Alpha-7";

function getTileColour(tile: HexTile, mode: MapMode): string {
  const surface0 = "#19191A"; // night-sky
  const surface1 = "#1F1F20";

  switch (mode) {
    case "terrain": {
      const resourceColour = TERRAIN_RESOURCE_COLOUR[tile.terrain] ?? "#333334";
      return hexWithOpacity(resourceColour, 0.20);
    }

    case "buildings": {
      if (!tile.building) return surface0;
      const buildColour = RESOURCE_HEX_COLOURS[tile.building.producing] ?? "#333334";
      return hexWithOpacity(buildColour, 0.25);
    }

    case "territory": {
      if (tile.owner === PLAYER_AGENT) return hexWithOpacity(RESOURCE_HEX_COLOURS.COMPUTE, 0.25);
      if (tile.owner) return hexWithOpacity("#F5949D", 0.15);
      return surface1;
    }

    case "production": {
      if (!tile.building) return surface0;
      const prodColour = RESOURCE_HEX_COLOURS[tile.building.producing] ?? "#333334";
      const intensity = tile.building.tier === 3 ? 0.30 : tile.building.tier === 2 ? 0.20 : 0.10;
      return hexWithOpacity(prodColour, intensity);
    }

    case "intelligence": {
      if (tile.building) return hexWithOpacity(RESOURCE_HEX_COLOURS.DATA, 0.20);
      return surface0;
    }

    default:
      return hexWithOpacity(TERRAIN_RESOURCE_COLOUR[tile.terrain] ?? "#333334", 0.20);
  }
}

// ── Tile stroke per mode ──────────────────────────────────────────────────

function getTileStroke(tile: HexTile, mode: MapMode): { colour: string; width: number; dashArray?: string } {
  switch (mode) {
    case "territory": {
      if (tile.owner === PLAYER_AGENT) {
        return { colour: RESOURCE_HEX_COLOURS.COMPUTE, width: 2 };
      }
      if (tile.owner) {
        return { colour: "#F5949D", width: 1, dashArray: "3,3" };
      }
      return { colour: "#2A2A2B", width: 0.5 };
    }
    default:
      return {
        colour: tile.owner ? "#4A4A5D" : "#2A2A2B",
        width: 1,
      };
  }
}

// ── Mock production rates for tooltips ─────────────────────────────────────

const TIER_PRODUCTION: Record<number, number> = { 1: 12, 2: 22, 3: 40 };
const TIER_ENERGY: Record<number, number> = { 1: 5, 2: 12, 3: 25 };
const TIER_TALENT: Record<number, number> = { 1: 2, 2: 5, 3: 10 };
const TIER_EFFICIENCY: Record<number, number> = { 1: 72, 2: 85, 3: 94 };

// ── Tooltip content per mode ──────────────────────────────────────────────

function TileTooltipContent({
  tile,
  mode,
}: {
  tile: HexTile;
  mode: MapMode;
}) {
  switch (mode) {
    case "terrain":
      return (
        <div className="space-y-1 font-dashboard text-xs">
          <div className="text-text-primary font-medium">{TERRAIN_LABELS[tile.terrain]}</div>
          <div className="text-text-secondary">Hex ({tile.q}, {tile.r})</div>
          <div className="text-text-tertiary">
            Eligible: {getEligibleBuildings(tile.terrain)}
          </div>
          <div className="text-text-tertiary">
            Strategic value: {getStrategicValue(tile.terrain)}
          </div>
        </div>
      );

    case "buildings":
      return (
        <div className="space-y-1 font-dashboard text-xs">
          <div className="text-text-primary font-medium">
            Hex ({tile.q}, {tile.r})
          </div>
          {tile.building ? (
            <>
              <div className="text-text-primary">
                {tile.building.type} (Tier {tile.building.tier})
              </div>
              <div className={RESOURCE_TW_COLOURS[tile.building.producing]}>
                Producing: {tile.building.producing}
              </div>
              <div className="text-text-secondary">
                Rate: {TIER_PRODUCTION[tile.building.tier]}/hr
              </div>
              <div className="text-text-secondary">
                TALENT: {TIER_TALENT[tile.building.tier]} allocated
              </div>
              <div className="text-text-secondary">
                ENERGY: {TIER_ENERGY[tile.building.tier]}/hr consumption
              </div>
            </>
          ) : (
            <div className="text-text-tertiary">No building — available for construction</div>
          )}
        </div>
      );

    case "territory":
      return (
        <div className="space-y-1 font-dashboard text-xs">
          <div className="text-text-primary font-medium">
            Hex ({tile.q}, {tile.r})
          </div>
          {tile.owner ? (
            <>
              <div className="text-text-secondary">Owner: {tile.owner}</div>
              <div className="text-text-tertiary">Claimed: Epoch 2</div>
              <div className="text-text-tertiary">Rent: 3.2 RATE/epoch</div>
              <div className="text-text-tertiary">Adjacent owned: 2</div>
            </>
          ) : (
            <div className="text-text-tertiary">Unclaimed — available</div>
          )}
        </div>
      );

    case "production":
      return (
        <div className="space-y-1 font-dashboard text-xs">
          <div className="text-text-primary font-medium">
            Hex ({tile.q}, {tile.r})
          </div>
          {tile.building ? (
            <>
              <div className={RESOURCE_TW_COLOURS[tile.building.producing]}>
                {tile.building.producing}: {TIER_PRODUCTION[tile.building.tier]}/hr
              </div>
              <div className="text-text-secondary">
                Efficiency: {TIER_EFFICIENCY[tile.building.tier]}%
              </div>
              <div className="text-text-secondary">
                Upkeep: {TIER_ENERGY[tile.building.tier]} ENERGY + {TIER_TALENT[tile.building.tier]} TALENT/hr
              </div>
            </>
          ) : (
            <div className="text-text-tertiary">No production</div>
          )}
        </div>
      );

    case "intelligence":
      return (
        <div className="space-y-1 font-dashboard text-xs">
          <div className="text-text-primary font-medium">
            Hex ({tile.q}, {tile.r})
          </div>
          <div className="text-text-secondary">
            Coverage: {tile.building ? "Monitored" : "Unmonitored"}
          </div>
          {tile.building && (
            <>
              <div className="text-text-tertiary">Last scan: 12m ago</div>
              <div className="text-text-tertiary">
                Purity: {85 + Math.abs(tile.q * 3 + tile.r * 7) % 15}%
              </div>
            </>
          )}
          {tile.owner && tile.owner !== PLAYER_AGENT && (
            <div className="text-talent text-xs">Echo signal detected</div>
          )}
        </div>
      );

    default:
      return null;
  }
}

function getEligibleBuildings(terrain: string): string {
  const map: Record<string, string> = {
    urban: "Data Centre, Processing Hub",
    industrial: "Fabrication Plant, Power Station",
    research: "Training Academy, Research Lab",
    coastal: "Data Refinery, Cooling Tower",
    regulatory: "Compliance Bureau, Licensing Office",
    flat: "Any Tier 1 building",
  };
  return map[terrain] ?? "Unknown";
}

function getStrategicValue(terrain: string): string {
  const map: Record<string, string> = {
    urban: "High density — adjacency bonuses",
    industrial: "Production multiplier for CHIPS",
    research: "TALENT attraction radius +2",
    coastal: "Trade route access — cheaper imports",
    regulatory: "CLEARANCE generation passive",
    flat: "Low cost — expansion staging",
  };
  return map[terrain] ?? "Standard";
}

// ── Main Component ────────────────────────────────────────────────────────

export function WorldMap({ tiles }: WorldMapProps) {
  const [mode, setMode] = useState<MapMode>("terrain");

  // Compute SVG viewBox from tiles
  const positions = tiles.map((t) => hexToPixel(t.q, t.r));
  const svgPadding = HEX_SIZE * 2;
  const minX = Math.min(...positions.map((p) => p.x)) - svgPadding;
  const minY = Math.min(...positions.map((p) => p.y)) - svgPadding;
  const maxX = Math.max(...positions.map((p) => p.x)) + svgPadding;
  const maxY = Math.max(...positions.map((p) => p.y)) + svgPadding;

  return (
    <div className="h-full flex flex-col">
      {/* Map Mode Buttons */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-surface-1 border-b border-border-default shrink-0">
        {MAP_MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={[
              "px-2 py-1 text-xs font-dashboard rounded transition-colors duration-200",
              mode === m
                ? "text-text-primary border-b-2 border-border-active"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Hex Grid */}
      <div className="flex-1 overflow-hidden flex items-center justify-center">
        <svg
          viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
          className="w-full h-full max-w-full max-h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {tiles.map((tile) => {
            const { x, y } = hexToPixel(tile.q, tile.r);
            const fill = getTileColour(tile, mode);
            const stroke = getTileStroke(tile, mode);

            return (
              <g key={`${tile.q}-${tile.r}`}>
                <Tooltip
                  trigger={
                    <polygon
                      points={hexPoints(x, y)}
                      fill={fill}
                      stroke={stroke.colour}
                      strokeWidth={stroke.width}
                      strokeDasharray={stroke.dashArray}
                      className="cursor-pointer hover:brightness-125 transition-all duration-200"
                    />
                  }
                  content={<TileTooltipContent tile={tile} mode={mode} />}
                />
                {tile.building && (
                  <>
                    <circle
                      cx={x}
                      cy={y}
                      r={8}
                      fill={fill}
                      stroke={hexWithOpacity(RESOURCE_HEX_COLOURS[tile.building.producing] ?? "#555", 0.5)}
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={y + 3}
                      textAnchor="middle"
                      className="text-[8px] fill-moon-white font-dashboard"
                    >
                      T{tile.building.tier}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Flag note */}
      <div className="px-3 py-1 bg-surface-1 border-t border-border-default text-xs text-text-tertiary font-terminal">
        Placeholder hex grid — rendering library TBD (Pixi.js / Canvas / SVG /
        react-hexgrid)
      </div>
    </div>
  );
}

export default WorldMap;
