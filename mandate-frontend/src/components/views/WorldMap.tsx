"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { HexTile } from "@/mock/types";
import { TERRAIN_LABELS, MAP_MODES, type MapMode } from "@/lib/constants";

interface WorldMapProps {
  tiles: HexTile[];
  playerAgent?: string;
  compact?: boolean;
  onClaimTile?: (q: number, r: number) => void;
  onPlaceBuilding?: (q: number, r: number) => void;
  onReleaseTile?: (q: number, r: number) => void;
  onSelectTile?: (q: number, r: number) => void;
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

// ── Colour utilities ──────────────────────────────────────────────────────────

const RESOURCE_HEX_COLOURS: Record<string, string> = {
  COMPUTE: "#7EAAD4",
  ENERGY: "#F5AF94",
  CHIPS: "#F5949D",
  COOLING: "#70BAD2",
  TALENT: "#F786C6",
  DATA: "#90D79F",
  CLEARANCE: "#6DD0A9",
};

const TERRAIN_RESOURCE_COLOUR: Record<string, string> = {
  urban: RESOURCE_HEX_COLOURS.COMPUTE,
  industrial: RESOURCE_HEX_COLOURS.ENERGY,
  research: RESOURCE_HEX_COLOURS.TALENT,
  coastal: RESOURCE_HEX_COLOURS.DATA,
  regulatory: RESOURCE_HEX_COLOURS.CLEARANCE,
  flat: "#333334",
};

// Terrain colour from handoff doc
const TERRAIN_FILL_COLOUR: Record<string, string> = {
  urban: "#FF877C",       // Coral
  industrial: "#FFB347",  // Amber
  research: "#7CD8D5",    // Teal
  coastal: "#7CB9E8",     // Sky
  regulatory: "#C3B1E1",  // Lavender
  flat: "#B0B0B0",        // Neutral
};

function hexWithOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// ── Tile colour per mode ──────────────────────────────────────────────────────

function getTileColour(tile: HexTile, mode: MapMode, playerAgent: string): string {
  const surface0 = "#19191A";
  const surface1 = "#1F1F20";

  switch (mode) {
    case "terrain": {
      const colour = TERRAIN_FILL_COLOUR[tile.terrain] ?? "#333334";
      const isOwned = !!tile.owner;
      return hexWithOpacity(colour, isOwned ? 0.5 : 0.2);
    }

    case "buildings": {
      if (!tile.building) return surface0;
      const buildColour = RESOURCE_HEX_COLOURS[tile.building.producing] ?? "#333334";
      return hexWithOpacity(buildColour, 0.25);
    }

    case "territory": {
      if (tile.owner === playerAgent || tile.owner === "You") return hexWithOpacity(RESOURCE_HEX_COLOURS.COMPUTE, 0.25);
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

// ── Tile stroke ───────────────────────────────────────────────────────────────

function getTileStroke(tile: HexTile, mode: MapMode, playerAgent: string): { colour: string; width: number; dashArray?: string } {
  const isOurs = tile.owner === playerAgent || tile.owner === "You";

  switch (mode) {
    case "territory": {
      if (isOurs) return { colour: RESOURCE_HEX_COLOURS.COMPUTE, width: 2 };
      if (tile.owner) return { colour: "#F5949D", width: 1, dashArray: "3,3" };
      return { colour: "#2A2A2B", width: 0.5 };
    }
    default: {
      if (isOurs) return { colour: RESOURCE_HEX_COLOURS.COMPUTE, width: 1.5 };
      if (!tile.owner) return { colour: "#2A2A2B", width: 0.5, dashArray: "2,4" };
      return { colour: "#4A4A5D", width: 1 };
    }
  }
}

// ── Building type abbreviations ───────────────────────────────────────────────

const BUILDING_ABBREV: Record<string, string> = {
  "Data Centre": "DC", "Power Plant": "PP", "Solar Array": "SA",
  "Fabrication Contract": "FC", "Fabrication Plant": "FC",
  "Recruiting Pipeline": "RP", "Data Acquisition Hub": "DAH",
  "Cooling Infrastructure": "CI", "Cooling Tower": "CI",
  "Training Cluster": "TC", "Training Academy": "TC",
  "Alignment Lab": "AL", "Lobbying Office": "LO",
  "Intelligence Network": "IN", "Media Arm": "MA",
  "Open Source Front": "OSF", "Deployed Model": "DM",
  "Patent Portfolio": "PAT", "Regulatory Moat": "RM",
  "Regulatory Office": "RO", "Road": "RD",
  "Security Perimeter": "SP", "Compute Cluster": "CC",
  "Energy Grid": "EG", "Data Refinery": "DR", "Talent Academy": "TA",
  "Building": "B",
};

// ── Tile tooltip ──────────────────────────────────────────────────────────────

const TIER_PRODUCTION: Record<number, number> = { 1: 12, 2: 22, 3: 40 };
const TIER_ENERGY: Record<number, number> = { 1: 5, 2: 12, 3: 25 };
const TIER_TALENT: Record<number, number> = { 1: 2, 2: 5, 3: 10 };

function getEligibleBuildings(terrain: string): string {
  const map: Record<string, string> = {
    urban: "Data Centre, Recruiting Pipeline, Lobbying Office",
    industrial: "Power Plant, Fabrication Contract, Cooling Infrastructure",
    research: "Training Cluster, Alignment Lab",
    coastal: "Data Acquisition Hub, Media Arm, Open Source Front",
    regulatory: "Lobbying Office, Regulatory Moat, Intelligence Network",
    flat: "Housing, Trading Post, Infrastructure",
  };
  return map[terrain] ?? "Unknown";
}

function tileTooltipText(tile: HexTile, playerAgent: string): string {
  const isOurs = tile.owner === playerAgent || tile.owner === "You";
  const lines = [`${TERRAIN_LABELS[tile.terrain]} (${tile.q}, ${tile.r})`];

  if (tile.owner) {
    lines.push(`Owner: ${isOurs ? "You" : tile.owner}`);
  } else {
    lines.push("Unclaimed — click to claim");
  }

  if (tile.building) {
    lines.push(`${tile.building.type} (Tier ${tile.building.tier})`);
    lines.push(`Produces: ${TIER_PRODUCTION[tile.building.tier]}/hr`);
  } else if (isOurs) {
    lines.push("Empty — click to build");
  } else if (!tile.owner) {
    lines.push(`Eligible: ${getEligibleBuildings(tile.terrain)}`);
  }

  return lines.join("\n");
}

// ── Action Modal ──────────────────────────────────────────────────────────────

interface TileActionProps {
  tile: HexTile;
  playerAgent: string;
  onClaim?: () => void;
  onBuild?: () => void;
  onRelease?: () => void;
  onClose: () => void;
}

function TileActionModal({ tile, playerAgent, onClaim, onBuild, onRelease, onClose }: TileActionProps) {
  const isOurs = tile.owner === playerAgent || tile.owner === "You";
  const [acting, setActing] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const handleAction = (label: string, fn?: () => void) => {
    if (!fn) return;
    setActing(true);
    setActionResult(`${label}...`);
    fn();
    // Close after a brief delay to show feedback
    setTimeout(() => onClose(), 1500);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-surface-2 border border-border-default rounded-lg p-4 max-w-xs w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        {/* Tile info — always shown */}
        <div className="space-y-1">
          <div className="text-sm text-text-primary font-dashboard font-medium">
            {TERRAIN_LABELS[tile.terrain]} ({tile.q}, {tile.r})
          </div>
          {tile.owner ? (
            <div className={`text-xs font-dashboard ${isOurs ? "text-compute" : "text-text-secondary"}`}>
              Owner: {isOurs ? "You" : tile.owner}
            </div>
          ) : (
            <div className="text-xs font-dashboard text-text-tertiary">Unclaimed</div>
          )}
          {tile.building && (
            <div className="text-xs font-dashboard text-text-secondary">
              {tile.building.type} (Tier {tile.building.tier}) — produces {tile.building.producing}
            </div>
          )}
          {!tile.owner && (
            <div className="text-xs font-dashboard text-text-tertiary">
              Eligible: {getEligibleBuildings(tile.terrain)}
            </div>
          )}
        </div>

        {/* Actions or result */}
        {acting ? (
          <div className="text-center py-2">
            <div className="w-5 h-5 border-2 border-text-tertiary border-t-[#7CD8D5] rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-text-secondary font-dashboard">{actionResult}</p>
          </div>
        ) : (
          <>
            {!tile.owner && onClaim && (
              <button
                onClick={() => handleAction("Claiming tile", onClaim)}
                className="w-full px-3 py-2 bg-[#7CD8D5] text-night-sky text-sm font-bold rounded hover:bg-[#9AE4E2] transition-colors"
              >
                Claim Tile
              </button>
            )}
            {isOurs && !tile.building && onBuild && (
              <button
                onClick={() => handleAction("Placing building", onBuild)}
                className="w-full px-3 py-2 bg-surface-hover text-text-primary text-sm font-dashboard rounded border border-border-default hover:bg-surface-3 transition-colors"
              >
                Place Building
              </button>
            )}
            {isOurs && onRelease && (
              <button
                onClick={() => handleAction("Releasing tile", onRelease)}
                className="w-full px-3 py-2 bg-status-critical/20 text-status-critical text-sm font-dashboard rounded border border-status-critical/30 hover:bg-status-critical/30 transition-colors"
              >
                Release Tile
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full px-3 py-1.5 text-text-tertiary text-xs font-dashboard hover:text-text-secondary transition-colors"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WorldMap({
  tiles,
  playerAgent = "Alpha-7",
  compact = false,
  onClaimTile,
  onPlaceBuilding,
  onReleaseTile,
  onSelectTile,
}: WorldMapProps) {
  const [mode, setMode] = useState<MapMode>("terrain");
  const [selectedTile, setSelectedTile] = useState<HexTile | null>(null);
  const [hoveredTile, setHoveredTile] = useState<HexTile | null>(null);

  // Pan & Zoom state
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Compute initial viewBox from tiles
  const positions = tiles.map((t) => hexToPixel(t.q, t.r));
  const svgPadding = HEX_SIZE * 2;
  const boundsMinX = Math.min(...positions.map((p) => p.x)) - svgPadding;
  const boundsMinY = Math.min(...positions.map((p) => p.y)) - svgPadding;
  const boundsMaxX = Math.max(...positions.map((p) => p.x)) + svgPadding;
  const boundsMaxY = Math.max(...positions.map((p) => p.y)) + svgPadding;
  const boundsW = boundsMaxX - boundsMinX;
  const boundsH = boundsMaxY - boundsMinY;

  // Initialize viewBox once
  useEffect(() => {
    if (viewBox.w === 0) {
      setViewBox({ x: boundsMinX, y: boundsMinY, w: boundsW, h: boundsH });
    }
  }, [boundsMinX, boundsMinY, boundsW, boundsH, viewBox.w]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;
    const dx = (e.clientX - dragStart.current.x) * scaleX;
    const dy = (e.clientY - dragStart.current.y) * scaleY;
    setViewBox((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
    dragStart.current = { x: e.clientX, y: e.clientY };
  }, [isDragging, viewBox.w, viewBox.h]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.3, Math.min(3, zoom * zoomFactor));

    setViewBox((prev) => {
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      const newW = boundsW / newZoom;
      const newH = boundsH / newZoom;
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
    });
    setZoom(newZoom);
  }, [zoom, boundsW, boundsH]);

  // Tile click handler
  const handleTileClick = useCallback((tile: HexTile) => {
    setSelectedTile(tile);
    onSelectTile?.(tile.q, tile.r);
  }, [onSelectTile]);

  const activeViewBox = viewBox.w > 0
    ? `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`
    : `${boundsMinX} ${boundsMinY} ${boundsW} ${boundsH}`;

  return (
    <div className="h-full flex flex-col">
      {/* Map Mode Buttons — hidden in compact mode */}
      {!compact && <div className="flex items-center gap-1 px-3 py-1.5 bg-surface-1 border-b border-border-default shrink-0">
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
        <div className="ml-auto text-xs text-text-tertiary font-dashboard">
          {tiles.length} tiles | Zoom: {Math.round(zoom * 100)}%
        </div>
      </div>}

      {/* Hex Grid with Pan/Zoom */}
      <div
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          viewBox={activeViewBox}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {tiles.map((tile) => {
            const { x, y } = hexToPixel(tile.q, tile.r);
            const fill = getTileColour(tile, mode, playerAgent);
            const stroke = getTileStroke(tile, mode, playerAgent);
            const abbrev = tile.building ? (BUILDING_ABBREV[tile.building.type] ?? "B") : null;

            return (
              <g key={`${tile.q}-${tile.r}`}>
                <polygon
                  points={hexPoints(x, y)}
                  fill={fill}
                  stroke={stroke.colour}
                  strokeWidth={stroke.width}
                  strokeDasharray={stroke.dashArray}
                  className="cursor-pointer hover:brightness-125 transition-all duration-200"
                  onMouseEnter={() => setHoveredTile(tile)}
                  onMouseLeave={() => setHoveredTile(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTileClick(tile);
                  }}
                />
                {abbrev && (
                  <>
                    <circle
                      cx={x}
                      cy={y}
                      r={10}
                      fill={hexWithOpacity(RESOURCE_HEX_COLOURS[tile.building!.producing] ?? "#555", 0.3)}
                      stroke={hexWithOpacity(RESOURCE_HEX_COLOURS[tile.building!.producing] ?? "#555", 0.6)}
                      strokeWidth="1"
                      className="pointer-events-none"
                    />
                    <text
                      x={x}
                      y={y + 3.5}
                      textAnchor="middle"
                      className="text-[7px] fill-moon-white font-dashboard pointer-events-none"
                    >
                      {abbrev}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover Info Bar */}
      <div className="h-7 px-3 flex items-center gap-2 bg-surface-2 border-t border-border-default shrink-0 text-xs font-dashboard">
        {hoveredTile ? (
          <>
            <span className="text-text-primary font-medium">{TERRAIN_LABELS[hoveredTile.terrain]}</span>
            <span className="text-text-tertiary">|</span>
            {hoveredTile.owner ? (
              <span className={hoveredTile.owner === playerAgent || hoveredTile.owner === "You" ? "text-compute" : "text-text-secondary"}>
                {hoveredTile.owner === playerAgent || hoveredTile.owner === "You" ? "Your territory" : hoveredTile.owner}
              </span>
            ) : (
              <span className="text-status-success">Available to claim</span>
            )}
            {hoveredTile.building && (
              <>
                <span className="text-text-tertiary">|</span>
                <span className="text-text-secondary">{hoveredTile.building.type} (Tier {hoveredTile.building.tier})</span>
              </>
            )}
          </>
        ) : (
          <span className="text-text-tertiary">Hover a tile for info. Click to interact.</span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1 bg-surface-1 border-t border-border-default shrink-0">
        {Object.entries(TERRAIN_FILL_COLOUR).map(([terrain, colour]) => (
          <div key={terrain} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: hexWithOpacity(colour, 0.5) }}
            />
            <span className="text-[10px] text-text-tertiary font-dashboard capitalize">
              {terrain}
            </span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm border-2 border-dashed" style={{ borderColor: "#2A2A2B" }} />
          <span className="text-[10px] text-text-tertiary font-dashboard">Unclaimed</span>
        </div>
      </div>

      {/* Tile Action Modal */}
      {selectedTile && (
        <TileActionModal
          tile={selectedTile}
          playerAgent={playerAgent}
          onClaim={
            !selectedTile.owner && onClaimTile
              ? () => {
                  onClaimTile(selectedTile.q, selectedTile.r);
                  setSelectedTile(null);
                }
              : undefined
          }
          onBuild={
            (selectedTile.owner === playerAgent || selectedTile.owner === "You") &&
            !selectedTile.building &&
            onPlaceBuilding
              ? () => {
                  onPlaceBuilding(selectedTile.q, selectedTile.r);
                  setSelectedTile(null);
                }
              : undefined
          }
          onRelease={
            (selectedTile.owner === playerAgent || selectedTile.owner === "You") && onReleaseTile
              ? () => {
                  onReleaseTile(selectedTile.q, selectedTile.r);
                  setSelectedTile(null);
                }
              : undefined
          }
          onClose={() => setSelectedTile(null)}
        />
      )}
    </div>
  );
}

export default WorldMap;
