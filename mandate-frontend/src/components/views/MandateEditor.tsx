"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { ResourceType } from "@/mock/types";
import { RESOURCE_ORDER, RESOURCE_LABELS, RESOURCE_COLOURS, RESOURCE_TW_COLOURS } from "@/lib/constants";
import { calculateClarityScore, getClarityColour, type ClarityBreakdown } from "@/lib/clarity-score";
import { Tooltip } from "@/components/tooltip";
import { Button } from "@/components/interactive/Button";
import { Slider } from "@/components/interactive/Slider";
import { Toggle } from "@/components/interactive/Toggle";
import { Select } from "@/components/interactive/Select";
import { Input } from "@/components/interactive/Input";
import { resourceBalances } from "@/mock/resources";
import { formatNumber, formatPrice } from "@/lib/format";

// ─── Constraint Types ───

interface ConstraintValues {
  trading: {
    aggressiveness: number;
    minCounterpartyReputation: number;
  };
  resources: {
    reserveFloors: Partial<Record<ResourceType, number>>;
    priorityResource: ResourceType | null;
  };
  risk: {
    reflexWindowParticipation: boolean;
    autoHedgeOnEvent: boolean;
    insuranceCoverage: boolean;
  };
  diplomacy: {
    negotiationStyle: "cooperative" | "neutral" | "aggressive";
    allianceWillingness: number;
    informationSharing: "none" | "selective" | "open";
  };
  building: {
    buildPriority: "expand" | "upgrade" | "consolidate";
    tileExpansionLimit: number;
  };
}

const DEFAULT_CONSTRAINTS: ConstraintValues = {
  trading: { aggressiveness: 5, minCounterpartyReputation: 0 },
  resources: { reserveFloors: {}, priorityResource: null },
  risk: { reflexWindowParticipation: true, autoHedgeOnEvent: false, insuranceCoverage: false },
  diplomacy: { negotiationStyle: "neutral", allianceWillingness: 5, informationSharing: "selective" },
  building: { buildPriority: "expand", tileExpansionLimit: 10 },
};

// ─── Mandate Version ───

interface MandateVersion {
  version: number;
  text: string;
  timestamp: number;
  isDraft: boolean;
  performance?: { tradesExecuted: number; netPnL: number; duration: string };
}

// ─── Mock Interpretation ───

interface InterpretationStep {
  action: string;
  details: string[];
  resource?: ResourceType;
  priority: "high" | "medium" | "low";
}

interface Interpretation {
  plan: InterpretationStep[];
  constraintsDetected: number;
  conflicts: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  warnings: string[];
}

function generateMockInterpretation(text: string, constraints: ConstraintValues): Interpretation {
  const lower = text.toLowerCase();
  const plan: InterpretationStep[] = [];

  if (lower.includes("compute") || constraints.resources.priorityResource === "COMPUTE") {
    plan.push({
      action: "ACQUIRE COMPUTE",
      details: ["Scan order book for offers below 1.30 RATE", "Accept up to 1.45 RATE if book is thin"],
      resource: "COMPUTE",
      priority: "high",
    });
  }
  if (lower.includes("energy") || lower.includes("sell") || lower.includes("surplus")) {
    plan.push({
      action: "SELL surplus ENERGY",
      details: ["List at 1.50 RATE minimum", "Accept 1.45 if buyer rep > 6000"],
      resource: "ENERGY",
      priority: "medium",
    });
  }
  if (lower.includes("build") || lower.includes("construct")) {
    plan.push({
      action: "BUILD infrastructure",
      details: ["Monitor CHIPS price for build opportunity", "Target next available tile in industrial zone"],
      resource: "CHIPS",
      priority: "medium",
    });
  }
  if (lower.includes("reserve") || lower.includes("maintain") || lower.includes("minimum")) {
    plan.push({
      action: "MAINTAIN reserves",
      details: ["Enforce floor constraints on all specified resources", "Will not trade below reserve levels"],
      priority: "high",
    });
  }
  if (lower.includes("reputation") || lower.includes("reject")) {
    plan.push({
      action: "FILTER counterparties",
      details: [`Reject agents below ${constraints.trading.minCounterpartyReputation || 4000} reputation`],
      priority: "low",
    });
  }

  if (plan.length === 0) {
    plan.push({
      action: "MONITOR markets",
      details: ["No specific directives detected", "Agent will observe and report"],
      priority: "low",
    });
  }

  const warnings: string[] = [];
  if (constraints.trading.minCounterpartyReputation > 5000) {
    warnings.push("High reputation threshold may limit available counterparties (only 2 of 8 agents qualify).");
  }
  if (text.length < 50) {
    warnings.push("Mandate is very short. Consider adding specific constraints to improve agent performance.");
  }

  return {
    plan,
    constraintsDetected: plan.length + Object.values(constraints.resources.reserveFloors).filter(Boolean).length,
    conflicts: 0,
    confidence: text.length > 100 ? "HIGH" : text.length > 40 ? "MEDIUM" : "LOW",
    warnings,
  };
}

// ─── Resource Highlighting ───

const RESOURCE_RE = new RegExp(
  `\\b(${RESOURCE_ORDER.join("|")}|${Object.values(RESOURCE_LABELS).join("|")}|RATE)\\b`,
  "g"
);

function highlightResources(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(RESOURCE_RE.source, "g");

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const word = match[0].toUpperCase();
    const resource = RESOURCE_ORDER.find(
      (r) => r === word || RESOURCE_LABELS[r] === word
    );
    const colour = resource ? RESOURCE_COLOURS[resource] : "var(--text-primary)";
    parts.push(
      <span key={match.index} style={{ color: colour }}>{match[0]}</span>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// ─── Generated Constraints Text ───

function generateConstraintText(c: ConstraintValues): string {
  const lines: string[] = [];
  if (c.trading.aggressiveness !== 5) {
    lines.push(`Trading aggressiveness set to ${c.trading.aggressiveness}/10.`);
  }
  if (c.trading.minCounterpartyReputation > 0) {
    lines.push(`Reject deals with agents below ${c.trading.minCounterpartyReputation} reputation.`);
  }
  if (c.resources.priorityResource) {
    lines.push(`Priority resource: ${c.resources.priorityResource}.`);
  }
  for (const [res, floor] of Object.entries(c.resources.reserveFloors)) {
    if (floor && floor > 0) {
      lines.push(`Maintain minimum ${floor} ${res} reserve.`);
    }
  }
  if (!c.risk.reflexWindowParticipation) {
    lines.push("Do not participate in reflex windows.");
  }
  if (c.risk.autoHedgeOnEvent) {
    lines.push("Auto-hedge positions on world events.");
  }
  if (c.diplomacy.negotiationStyle !== "neutral") {
    lines.push(`Negotiation style: ${c.diplomacy.negotiationStyle}.`);
  }
  if (c.building.buildPriority !== "expand") {
    lines.push(`Building priority: ${c.building.buildPriority}.`);
  }
  return lines.join("\n");
}

// ─── Templates ───

const TEMPLATES = [
  { id: "aggressive", name: "Aggressive Acquisition", category: "aggressive", text: "Acquire [COMPUTE] at any cost below [2.0] RATE. Accept unfavourable interim trades to build position. Target [3000] unit inventory before epoch end. Sell [ENERGY] surpluses at market rate to fund acquisition. Reject only offers from agents with active disinformation flags." },
  { id: "defensive", name: "Defensive Holding", category: "defensive", text: "Maintain current resource levels. Do not initiate trades. Accept only offers that improve position by [10]% or more. Maintain minimum [500] reserve on all resources. Prioritise COOLING maintenance for existing infrastructure." },
  { id: "economic", name: "Market Maker", category: "economic", text: "Identify arbitrage opportunities across all 7 resource markets. Place limit orders at [5]% below ask for COMPUTE and ENERGY. Sell into bid when spread exceeds [0.08] RATE. Target [200] RATE profit per epoch from trading activity." },
  { id: "diplomatic", name: "Alliance Builder", category: "diplomatic", text: "Prioritise deals with agents above [6000] reputation. Offer [15]% discount on ENERGY trades to build relationships. Share selective market intelligence with trusted counterparties. Avoid antagonising any agent with reputation above [5000]." },
  { id: "balanced", name: "Balanced Strategy", category: "balanced", text: "Prioritise [COMPUTE] acquisition as primary resource. Maintain minimum [500] [CHIPS] reserve. Trade surplus [ENERGY] at no less than [1.5]:1 ratio. Reject deals with agents below [4000] reputation. Build [Data Centre] when CHIPS price drops below [2.0]." },
];

// ─── Main Component ───

const PROMPT_STARTERS = [
  { label: "Acquire COMPUTE", text: "Prioritize acquiring COMPUTE. Trade surplus resources at favourable rates. Maintain reserves of essential materials." },
  { label: "Trade for RATE", text: "Sell surplus resources for RATE. Focus on selling resources that are above market average price. Keep minimum reserves." },
  { label: "Play it safe", text: "Maintain reserves of all resources. Only trade when prices are highly favourable. Avoid aggressive positions." },
  { label: "Expand territory", text: "Claim new tiles and build infrastructure. Prioritize production buildings. Expand territory where terrain matches our strengths." },
];

interface MandateEditorProps {
  simple?: boolean;
  onDeploy?: (text: string, aggressiveness: number, priorityResource: string) => void;
}

export function MandateEditor({ simple = false, onDeploy }: MandateEditorProps) {
  // Layer 1 state
  const [mandateText, setMandateText] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('mandate-draft') ?? "Prioritise COMPUTE acquisition. Trade surplus ENERGY at no less than 1.5:1 ratio. Reject deals with agents below 4000 reputation. Maintain minimum 500 CHIPS reserve.";
  });

  useEffect(() => {
    localStorage.setItem('mandate-draft', mandateText);
  }, [mandateText]);

  const [showTemplates, setShowTemplates] = useState(false);

  // Layer 2 state
  const [constraints, setConstraints] = useState<ConstraintValues>(DEFAULT_CONSTRAINTS);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    trading: true, resources: false, risk: false, diplomacy: false, building: false,
  });

  // Layer 3 collapsed
  const [layer3Open, setLayer3Open] = useState(false);

  // Interpretation
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Clarity score
  const [clarity, setClarity] = useState<ClarityBreakdown>({ specificity: 0, constraints: 0, priorities: 0, completeness: 0, total: 0 });

  // History
  const [history, setHistory] = useState<MandateVersion[]>([
    { version: 1, text: "Focus on COMPUTE production.", timestamp: 1711584000000 - 12 * 3600000, isDraft: false, performance: { tradesExecuted: 8, netPnL: 180, duration: "6h" } },
    { version: 2, text: "Prioritise COMPUTE. Reject low-reputation agents.", timestamp: 1711584000000 - 2 * 3600000, isDraft: false, performance: { tradesExecuted: 14, netPnL: 340, duration: "2h" } },
  ]);
  const [diffVersions, setDiffVersions] = useState<[number, number] | null>(null);

  // Submit state
  const [submitState, setSubmitState] = useState<"idle" | "confirm" | "processing" | "success">("idle");

  // Update clarity on text change
  useEffect(() => {
    const fullText = mandateText + "\n" + generateConstraintText(constraints);
    setClarity(calculateClarityScore(fullText));
  }, [mandateText, constraints]);

  // Debounced interpretation
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setInterpretation(generateMockInterpretation(mandateText, constraints));
    }, 1000);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [mandateText, constraints]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSubmit = useCallback(() => {
    setSubmitState("confirm");
  }, []);

  const confirmSubmit = useCallback(() => {
    setSubmitState("processing");
    setTimeout(() => {
      const newVersion: MandateVersion = {
        version: history.length + 1,
        text: mandateText,
        timestamp: Date.now(),
        isDraft: false,
      };
      setHistory((prev) => [...prev, newVersion]);
      setSubmitState("success");
      // Notify mastery flow (if active) that a mandate was submitted
      window.dispatchEvent(new CustomEvent("mandate-submitted"));
      // Send mandate to agent worker
      onDeploy?.(mandateText, constraints.trading.aggressiveness, constraints.resources.priorityResource ?? "COMPUTE");
      setTimeout(() => setSubmitState("idle"), 2000);
    }, 500);
  }, [mandateText, history.length, onDeploy, constraints.trading.aggressiveness, constraints.resources.priorityResource]);

  const handleSaveDraft = useCallback(() => {
    const newVersion: MandateVersion = {
      version: history.length + 1,
      text: mandateText,
      timestamp: Date.now(),
      isDraft: true,
    };
    setHistory((prev) => [...prev, newVersion]);
  }, [mandateText, history.length]);

  const applyTemplate = useCallback((text: string) => {
    if (mandateText.trim() && !window.confirm("Replace current mandate with template?")) return;
    setMandateText(text);
    setShowTemplates(false);
  }, [mandateText]);

  const handleEnhance = useCallback(() => {
    const enhanced = mandateText +
      "\n\nAdditional constraints: Limit single trade size to 500 units. Prefer bilateral negotiations over market orders when spread exceeds 0.05 RATE. Allocate 60% of TALENT to active production buildings.";
    setMandateText(enhanced);
  }, [mandateText]);

  // Generated constraints text
  const generatedText = generateConstraintText(constraints);

  // Line numbers for text area
  const lineCount = mandateText.split("\n").length;

  // ── Simple Mode ──
  if (simple) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 bg-surface-1 border-b border-border-default shrink-0">
          <span className="text-xs text-text-secondary font-dashboard uppercase tracking-wider">
            Your Mandate
          </span>
        </div>

        {/* Prompt Starters — shown when text is default or empty */}
        {mandateText.length < 20 && (
          <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-border-default shrink-0">
            {PROMPT_STARTERS.map((starter) => (
              <button
                key={starter.label}
                onClick={() => setMandateText(starter.text)}
                className="px-2.5 py-1 text-[11px] font-dashboard bg-surface-2 text-text-secondary border border-border-default rounded hover:bg-[#7CD8D5]/10 hover:border-[#7CD8D5]/30 hover:text-text-primary transition-colors"
              >
                {starter.label}
              </button>
            ))}
          </div>
        )}

        {/* Textarea */}
        <div className="flex-1 overflow-hidden">
          <textarea
            value={mandateText}
            onChange={(e) => setMandateText(e.target.value)}
            className="w-full h-full bg-surface-0 text-text-primary text-sm font-terminal p-3 resize-none focus:outline-none placeholder:text-text-tertiary"
            placeholder="Tell your agent what to do..."
          />
        </div>

        {/* Key controls */}
        <div className="px-3 py-2 bg-surface-1 border-t border-border-default space-y-2 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-text-tertiary font-dashboard w-24">Aggressiveness</span>
            <Slider
              value={constraints.trading.aggressiveness}
              onChange={(v) => setConstraints((prev) => ({ ...prev, trading: { ...prev.trading, aggressiveness: v } }))}
              min={1}
              max={10}
              step={1}
              label={`${constraints.trading.aggressiveness}/10`}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-text-tertiary font-dashboard w-24">Priority</span>
            <Select
              options={RESOURCE_ORDER.map((r) => ({ value: r, label: r }))}
              value={constraints.resources.priorityResource ?? ""}
              onChange={(v) =>
                setConstraints((prev) => ({
                  ...prev,
                  resources: { ...prev.resources, priorityResource: v as ResourceType },
                }))
              }
            />
          </div>
        </div>

        {/* Submit — skip confirm dialog in simple mode */}
        <div className="px-3 py-2 border-t border-border-default shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={confirmSubmit}
            disabled={submitState === "processing" || mandateText.trim().length === 0}
          >
            {submitState === "processing" ? "Deploying..." : submitState === "success" ? "Mandate Active" : "Deploy Mandate"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* ═══ LEFT: Editor ═══ */}
      <div className="flex-[3] flex flex-col overflow-hidden border-r border-border-default">
        {/* Layer 1: Strategic Intent */}
        <div className="flex flex-col border-b border-border-default">
          <div className="flex items-center justify-between px-3 py-2 bg-surface-1 border-b border-border-default">
            <span className="text-xs text-text-secondary font-dashboard uppercase tracking-wider">
              Layer 1: Strategic Intent
            </span>
            <div className="flex items-center gap-2">
              {/* Enhance button */}
              <button
                onClick={handleEnhance}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-text-secondary font-dashboard transition-colors"
                title="Enhance mandate"
              >
                <span>✦</span> Enhance
              </button>
              {/* Templates */}
              <div className="relative">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="px-2 py-1 text-xs text-text-tertiary hover:text-text-secondary font-dashboard transition-colors"
                >
                  Templates ▾
                </button>
                {showTemplates && (
                  <div className="absolute right-0 top-full mt-1 w-64 bg-surface-2 border border-border-default rounded z-50 shadow-none max-h-60 overflow-y-auto">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t.text)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-surface-hover transition-colors"
                      >
                        <div className="text-text-primary font-dashboard">{t.name}</div>
                        <div className="text-text-tertiary font-dashboard">{t.category}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Text area with line numbers */}
          <div className="flex max-h-48 overflow-y-auto bg-surface-1">
            <div className="w-8 shrink-0 pt-3 pr-1 text-right select-none">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="text-xs text-text-tertiary leading-[1.625rem] font-terminal">
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              value={mandateText}
              onChange={(e) => setMandateText(e.target.value)}
              className="flex-1 bg-transparent text-text-primary font-terminal text-sm leading-relaxed p-3 outline-none resize-y min-h-[120px] placeholder:text-text-tertiary placeholder:italic"
              placeholder="Write your strategic intent here. What do you want your agent to prioritise? What should it avoid? What are your constraints?"
              spellCheck={false}
            />
          </div>

          {/* Generated constraints block */}
          {generatedText && (
            <div className="px-3 py-2 bg-surface-0 border-t border-border-default">
              <span className="text-xs text-text-tertiary font-dashboard">
                Generated from controls:
              </span>
              <pre className="text-xs text-text-secondary font-terminal mt-1 whitespace-pre-wrap opacity-70">
                {generatedText}
              </pre>
            </div>
          )}
        </div>

        {/* Layer 2: Operational Constraints */}
        <div className="flex-1 overflow-y-auto">
          {/* Trading */}
          <ConstraintSection title="Trading Constraints" expanded={expandedSections.trading} onToggle={() => toggleSection("trading")}>
            <div className="space-y-3">
              <Slider
                value={constraints.trading.aggressiveness}
                onChange={(v) => setConstraints((prev) => ({ ...prev, trading: { ...prev.trading, aggressiveness: v } }))}
                min={1} max={10} step={1}
                label={`Trading Aggressiveness: ${constraints.trading.aggressiveness}/10`}
              />
              <div>
                <label className="text-xs text-text-secondary font-dashboard block mb-1">Min Counterparty Reputation</label>
                <input
                  type="number"
                  value={constraints.trading.minCounterpartyReputation}
                  onChange={(e) => setConstraints((prev) => ({ ...prev, trading: { ...prev.trading, minCounterpartyReputation: Number(e.target.value) } }))}
                  className="w-20 bg-surface-1 text-text-primary font-terminal text-sm text-right px-2 py-1 border border-border-default rounded outline-none focus:border-border-focus tabular-nums"
                  min={0} max={10000}
                />
              </div>
            </div>
          </ConstraintSection>

          {/* Resources */}
          <ConstraintSection title="Resource Reserves" expanded={expandedSections.resources} onToggle={() => toggleSection("resources")}>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary font-dashboard block mb-1">Priority Resource</label>
                <Select
                  options={[
                    { value: "", label: "None" },
                    ...RESOURCE_ORDER.map((r) => ({ value: r, label: r })),
                  ]}
                  value={constraints.resources.priorityResource || ""}
                  onChange={(v) => setConstraints((prev) => ({
                    ...prev,
                    resources: { ...prev.resources, priorityResource: (v || null) as ResourceType | null },
                  }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-text-secondary font-dashboard block">Reserve Floors</label>
                {RESOURCE_ORDER.map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <span className={`text-xs w-12 ${RESOURCE_TW_COLOURS[r]}`}>{RESOURCE_LABELS[r]}</span>
                    <input
                      type="number"
                      value={constraints.resources.reserveFloors[r] || 0}
                      onChange={(e) => setConstraints((prev) => ({
                        ...prev,
                        resources: {
                          ...prev.resources,
                          reserveFloors: { ...prev.resources.reserveFloors, [r]: Number(e.target.value) },
                        },
                      }))}
                      className="w-20 bg-surface-1 text-text-primary font-terminal text-xs text-right px-2 py-1 border border-border-default rounded outline-none focus:border-border-focus tabular-nums"
                      min={0}
                    />
                  </div>
                ))}
              </div>
            </div>
          </ConstraintSection>

          {/* Risk */}
          <ConstraintSection title="Risk Management" expanded={expandedSections.risk} onToggle={() => toggleSection("risk")}>
            <div className="space-y-3">
              <Toggle checked={constraints.risk.reflexWindowParticipation} onChange={(v) => setConstraints((prev) => ({ ...prev, risk: { ...prev.risk, reflexWindowParticipation: v } }))} label="Reflex Window Participation" />
              <Toggle checked={constraints.risk.autoHedgeOnEvent} onChange={(v) => setConstraints((prev) => ({ ...prev, risk: { ...prev.risk, autoHedgeOnEvent: v } }))} label="Auto-Hedge on World Events" />
              <Toggle checked={constraints.risk.insuranceCoverage} onChange={(v) => setConstraints((prev) => ({ ...prev, risk: { ...prev.risk, insuranceCoverage: v } }))} label="Insurance Coverage" />
            </div>
          </ConstraintSection>

          {/* Diplomacy */}
          <ConstraintSection title="Diplomatic Stance" expanded={expandedSections.diplomacy} onToggle={() => toggleSection("diplomacy")}>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary font-dashboard block mb-1">Negotiation Style</label>
                <Select
                  options={[
                    { value: "cooperative", label: "Cooperative" },
                    { value: "neutral", label: "Neutral" },
                    { value: "aggressive", label: "Aggressive" },
                  ]}
                  value={constraints.diplomacy.negotiationStyle}
                  onChange={(v) => setConstraints((prev) => ({ ...prev, diplomacy: { ...prev.diplomacy, negotiationStyle: v as "cooperative" | "neutral" | "aggressive" } }))}
                />
              </div>
              <Slider
                value={constraints.diplomacy.allianceWillingness}
                onChange={(v) => setConstraints((prev) => ({ ...prev, diplomacy: { ...prev.diplomacy, allianceWillingness: v } }))}
                min={1} max={10} step={1}
                label={`Alliance Willingness: ${constraints.diplomacy.allianceWillingness}/10`}
              />
              <div>
                <label className="text-xs text-text-secondary font-dashboard block mb-1">Information Sharing</label>
                <Select
                  options={[
                    { value: "none", label: "None" },
                    { value: "selective", label: "Selective" },
                    { value: "open", label: "Open" },
                  ]}
                  value={constraints.diplomacy.informationSharing}
                  onChange={(v) => setConstraints((prev) => ({ ...prev, diplomacy: { ...prev.diplomacy, informationSharing: v as "none" | "selective" | "open" } }))}
                />
              </div>
            </div>
          </ConstraintSection>

          {/* Building */}
          <ConstraintSection title="Building Strategy" expanded={expandedSections.building} onToggle={() => toggleSection("building")}>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary font-dashboard block mb-1">Build Priority</label>
                <Select
                  options={[
                    { value: "expand", label: "Expand" },
                    { value: "upgrade", label: "Upgrade" },
                    { value: "consolidate", label: "Consolidate" },
                  ]}
                  value={constraints.building.buildPriority}
                  onChange={(v) => setConstraints((prev) => ({ ...prev, building: { ...prev.building, buildPriority: v as "expand" | "upgrade" | "consolidate" } }))}
                />
              </div>
              <Slider
                value={constraints.building.tileExpansionLimit}
                onChange={(v) => setConstraints((prev) => ({ ...prev, building: { ...prev.building, tileExpansionLimit: v } }))}
                min={1} max={30} step={1}
                label={`Tile Expansion Limit: ${constraints.building.tileExpansionLimit}`}
              />
            </div>
          </ConstraintSection>
        </div>

        {/* Layer 3: Machine Context (collapsed) */}
        <div className="border-t border-border-default">
          <button
            onClick={() => setLayer3Open(!layer3Open)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-tertiary font-dashboard hover:text-text-secondary transition-colors"
          >
            <span>{layer3Open ? "▾" : "▸"}</span>
            Layer 3: Machine Context
          </button>
          {layer3Open && (
            <div className="px-3 py-2 bg-surface-0 border-t border-border-default max-h-40 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {resourceBalances.map((rb) => (
                  <div key={rb.resource} className="flex justify-between">
                    <span className={`font-dashboard ${RESOURCE_TW_COLOURS[rb.resource]}`}>{rb.resource}</span>
                    <span className="font-terminal text-text-secondary tabular-nums">{formatPrice(rb.priceInRate)} RATE</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-text-tertiary font-dashboard">
                Epoch 3 · 16h remaining · Compute Superpower · 12 buildings active
              </div>
            </div>
          )}
        </div>

        {/* Submit Area */}
        <div className="px-3 py-3 bg-surface-1 border-t border-border-default shrink-0">
          {/* Clarity Score */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <Tooltip
                trigger={
                  <span className="text-xs text-text-secondary font-dashboard cursor-help">
                    Clarity Score: {clarity.total}/100
                  </span>
                }
                content={
                  <div className="space-y-1 text-xs font-dashboard">
                    <div className="flex justify-between gap-4"><span>Specificity</span><span className="tabular-nums">{clarity.specificity}/25</span></div>
                    <div className="flex justify-between gap-4"><span>Constraints</span><span className="tabular-nums">{clarity.constraints}/25</span></div>
                    <div className="flex justify-between gap-4"><span>Priorities</span><span className="tabular-nums">{clarity.priorities}/25</span></div>
                    <div className="flex justify-between gap-4"><span>Completeness</span><span className="tabular-nums">{clarity.completeness}/25</span></div>
                  </div>
                }
              />
            </div>
            <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${clarity.total}%`,
                  backgroundColor: getClarityColour(clarity.total),
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={handleSubmit}>Submit Mandate</Button>
            <Button variant="secondary" onClick={handleSaveDraft}>Save Draft</Button>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT: Interpretation + History ═══ */}
      <div className="flex-[2] flex flex-col overflow-hidden">
        {/* Agent Interpretation */}
        <div className="flex-[2] flex flex-col overflow-hidden border-b border-border-default">
          <div className="px-3 py-2 bg-surface-1 border-b border-border-default shrink-0 flex items-center justify-between">
            <span className="text-xs text-text-secondary font-dashboard uppercase tracking-widest">
              Agent Interpretation
            </span>
            <button
              onClick={() => setInterpretation(generateMockInterpretation(mandateText, constraints))}
              className="text-xs text-text-tertiary hover:text-text-secondary font-dashboard transition-colors"
            >
              Refresh
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-terminal text-xs">
            {interpretation ? (
              <div className="space-y-3">
                <p className="text-text-secondary">Based on your mandate, I plan to:</p>
                {interpretation.plan.map((step, i) => (
                  <div key={i}>
                    <div className="text-text-primary">
                      {i + 1}. <span className="font-medium">{step.action}</span>
                      {step.resource && (
                        <span className="ml-1" style={{ color: RESOURCE_COLOURS[step.resource] }}>
                          [{step.priority}]
                        </span>
                      )}
                    </div>
                    {step.details.map((d, j) => (
                      <div key={j} className="text-text-secondary ml-4">→ {d}</div>
                    ))}
                  </div>
                ))}

                <div className="border-t border-border-default pt-2 flex items-center gap-4 text-text-secondary">
                  <span>Constraints: {interpretation.constraintsDetected}</span>
                  <span>Conflicts: {interpretation.conflicts}</span>
                  <span className={interpretation.confidence === "HIGH" ? "text-status-success" : interpretation.confidence === "MEDIUM" ? "text-status-warning" : "text-status-critical"}>
                    Confidence: {interpretation.confidence}
                  </span>
                </div>

                {interpretation.warnings.map((w, i) => (
                  <div key={i} className="text-status-warning">⚠ {w}</div>
                ))}
              </div>
            ) : (
              <p className="text-text-tertiary">Analyzing mandate...</p>
            )}
          </div>
        </div>

        {/* Mandate History */}
        <div className="flex-[1] flex flex-col overflow-hidden">
          <div className="px-3 py-2 bg-surface-1 border-b border-border-default shrink-0">
            <span className="text-xs text-text-secondary font-dashboard uppercase tracking-widest">
              Mandate History
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {history.map((v) => (
              <div
                key={v.version}
                className="px-2 py-1.5 rounded hover:bg-surface-hover/50 cursor-pointer transition-colors"
                onClick={() => setMandateText(v.text)}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-text-primary font-dashboard">
                    v{v.version}
                  </span>
                  {v.isDraft && (
                    <span className="text-text-tertiary bg-surface-3 px-1 rounded text-xs font-terminal">draft</span>
                  )}
                  <span className="text-text-tertiary font-dashboard ml-auto">
                    {new Date(v.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {v.performance && (
                  <div className="text-xs text-text-tertiary font-terminal mt-0.5">
                    {v.performance.tradesExecuted} trades · {v.performance.netPnL >= 0 ? "+" : ""}{v.performance.netPnL} RATE · {v.performance.duration}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {submitState === "confirm" && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center">
          <div className="absolute inset-0 bg-night-sky/80" onClick={() => setSubmitState("idle")} />
          <div className="relative bg-surface-2 border border-border-default rounded p-6 max-w-lg w-full mx-4">
            <h3 className="text-sm text-text-primary font-dashboard mb-3">Confirm Mandate Submission</h3>
            <pre className="font-terminal text-xs text-text-secondary bg-surface-1 p-3 rounded mb-4 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {mandateText}
              {generatedText && `\n\n${generatedText}`}
            </pre>
            <p className="text-xs text-text-tertiary font-dashboard mb-4">
              Your agent will execute based on this mandate. Confirm?
            </p>
            <div className="flex gap-2">
              <Button variant="primary" onClick={confirmSubmit}>Confirm</Button>
              <Button variant="secondary" onClick={() => setSubmitState("idle")}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {submitState === "processing" && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-night-sky/80">
          <div className="text-sm text-text-secondary font-terminal animate-pulse">
            Submitting mandate...
          </div>
        </div>
      )}

      {submitState === "success" && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-night-sky/80">
          <div className="text-sm text-text-primary font-terminal">
            Mandate active. Your agent is now operating under v{history.length}.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Constraint Section ───

function ConstraintSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border-default">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary font-dashboard hover:bg-surface-hover/50 transition-colors"
      >
        <span className="text-text-tertiary text-xs">{expanded ? "▾" : "▸"}</span>
        {title}
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

export default MandateEditor;
