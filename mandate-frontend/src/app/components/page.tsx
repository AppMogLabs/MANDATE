"use client";

import { useState } from "react";

// Data Display
import { ResourceBadge } from "@/components/data-display/ResourceBadge";
import { PriceCell } from "@/components/data-display/PriceCell";
import { Sparkline } from "@/components/data-display/Sparkline";
import { StatusDot } from "@/components/data-display/StatusDot";
import { DataTable } from "@/components/data-display/DataTable";

// Interactive
import { Button } from "@/components/interactive/Button";
import { Input } from "@/components/interactive/Input";
import { Select } from "@/components/interactive/Select";
import { Slider } from "@/components/interactive/Slider";
import { Toggle } from "@/components/interactive/Toggle";

// Tooltip
import { Tooltip } from "@/components/tooltip";

// Feed
import { FeedEntry } from "@/components/feed/FeedEntry";

// Mock data
import { resourceBalances } from "@/mock/resources";
import { feedEntries } from "@/mock/feed";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-lg text-moon-white font-dashboard mb-4 pb-2 border-b border-border-default">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm text-text-secondary font-dashboard mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function ComponentsPage() {
  const [sliderVal, setSliderVal] = useState(50);
  const [toggleVal, setToggleVal] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [selectVal, setSelectVal] = useState("compute");

  const sparkData = [1.2, 1.3, 1.25, 1.4, 1.35, 1.5, 1.45, 1.6, 1.55, 1.7, 1.65, 1.8];
  const sparkDataDown = [1.8, 1.7, 1.6, 1.5, 1.4, 1.35, 1.3, 1.25, 1.2, 1.15, 1.1, 1.0];

  const tableColumns = [
    { key: "name", label: "Agent", sortable: true },
    { key: "score", label: "Score", sortable: true, align: "right" as const },
    { key: "status", label: "Status" },
  ];
  const tableData = [
    { name: "Alpha-7", score: 94.2, status: "Active" },
    { name: "Meridian", score: 87.5, status: "Active" },
    { name: "Vanguard", score: 76.1, status: "Idle" },
    { name: "Sentinel", score: 91.8, status: "Active" },
  ];

  return (
    <div className="min-h-screen bg-night-sky p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl text-moon-white font-dashboard mb-2">
        MANDATE Component Library
      </h1>
      <p className="text-sm text-text-secondary font-dashboard mb-8">
        All base components with MegaETH design system tokens.
      </p>

      {/* === DATA DISPLAY === */}
      <Section title="Data Display">
        <SubSection title="ResourceBadge">
          <div className="flex flex-wrap gap-3">
            {resourceBalances.map((rb) => (
              <ResourceBadge
                key={rb.resource}
                resource={rb.resource}
                balance={rb.priceInRate}
                change={rb.change1h}
                sparkline={rb.sparkline}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            <span className="text-xs text-text-tertiary">Compact:</span>
            {resourceBalances.slice(0, 3).map((rb) => (
              <ResourceBadge
                key={rb.resource}
                resource={rb.resource}
                balance={rb.priceInRate}
                change={rb.change1h}
                sparkline={rb.sparkline}
                compact
              />
            ))}
          </div>
        </SubSection>

        <SubSection title="PriceCell">
          <div className="flex items-center gap-6">
            <PriceCell value={1.234} change={2.5} />
            <PriceCell value={0.871} change={-1.3} />
            <PriceCell value={2.15} change={0} />
            <PriceCell value={0.5432} />
          </div>
        </SubSection>

        <SubSection title="Sparkline">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-text-tertiary block mb-1">
                Trending up
              </span>
              <Sparkline data={sparkData} />
            </div>
            <div>
              <span className="text-xs text-text-tertiary block mb-1">
                Trending down
              </span>
              <Sparkline data={sparkDataDown} />
            </div>
            <div>
              <span className="text-xs text-text-tertiary block mb-1">
                Custom colour (COMPUTE blue)
              </span>
              <Sparkline data={sparkData} colour="var(--colour-compute)" />
            </div>
            <div>
              <span className="text-xs text-text-tertiary block mb-1">
                Large
              </span>
              <Sparkline data={sparkData} width={120} height={40} />
            </div>
          </div>
        </SubSection>

        <SubSection title="StatusDot">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <StatusDot status="critical" pulse />
              <span className="text-xs text-text-secondary">Critical (pulse)</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status="warning" />
              <span className="text-xs text-text-secondary">Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status="info" />
              <span className="text-xs text-text-secondary">Info</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status="success" />
              <span className="text-xs text-text-secondary">Success</span>
            </div>
          </div>
        </SubSection>

        <SubSection title="DataTable">
          <DataTable columns={tableColumns} data={tableData} />
        </SubSection>
      </Section>

      {/* === INTERACTIVE === */}
      <Section title="Interactive">
        <SubSection title="Button">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="primary" size="sm">Small Primary</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
        </SubSection>

        <SubSection title="Input">
          <div className="flex items-center gap-3">
            <Input
              value={inputVal}
              onChange={(v) => setInputVal(v)}
              placeholder="Form input (Helvetica Neue)"
              variant="form"
            />
            <Input
              value={inputVal}
              onChange={(v) => setInputVal(v)}
              placeholder="Terminal input (Wudoo Mono)"
              variant="terminal"
            />
          </div>
        </SubSection>

        <SubSection title="Select">
          <Select
            options={[
              { value: "compute", label: "COMPUTE" },
              { value: "energy", label: "ENERGY" },
              { value: "chips", label: "CHIPS" },
              { value: "cooling", label: "COOLING" },
            ]}
            value={selectVal}
            onChange={setSelectVal}
          />
        </SubSection>

        <SubSection title="Slider">
          <div className="max-w-xs">
            <Slider
              value={sliderVal}
              onChange={setSliderVal}
              min={0}
              max={100}
              step={1}
              label={`Aggressiveness: ${sliderVal}%`}
            />
          </div>
        </SubSection>

        <SubSection title="Toggle">
          <div className="flex items-center gap-6">
            <Toggle
              checked={toggleVal}
              onChange={setToggleVal}
              label="Auto-execute"
            />
            <Toggle checked={true} onChange={() => {}} label="Always on" />
            <Toggle checked={false} onChange={() => {}} label="Always off" />
          </div>
        </SubSection>
      </Section>

      {/* === TOOLTIP === */}
      <Section title="Tooltip (CK3-style nested)">
        <div className="flex items-center gap-6">
          <Tooltip
            trigger={
              <span className="text-compute underline decoration-dotted cursor-help">
                Hover for tooltip
              </span>
            }
            content={
              <div className="space-y-1">
                <p>This is a basic tooltip with rich content.</p>
                <Tooltip
                  trigger={
                    <span className="text-energy underline decoration-dotted cursor-help">
                      Hover for nested tooltip (level 2)
                    </span>
                  }
                  content={
                    <div className="space-y-1">
                      <p>Second level tooltip.</p>
                      <Tooltip
                        trigger={
                          <span className="text-talent underline decoration-dotted cursor-help">
                            Level 3 tooltip
                          </span>
                        }
                        content={
                          <p>
                            Third level — arbitrary depth supported. This is
                            the CK3-style progressive disclosure pattern.
                          </p>
                        }
                      />
                    </div>
                  }
                />
              </div>
            }
          />

          <Tooltip
            trigger={
              <ResourceBadge
                resource="COMPUTE"
                balance={1.234}
                change={2.5}
                sparkline={sparkData}
                compact
              />
            }
            content={
              <div className="space-y-1 text-xs">
                <div className="font-medium text-text-primary">COMPUTE</div>
                <div className="text-text-secondary">Production: 450/hr</div>
                <div className="text-text-secondary">Consumption: 320/hr</div>
                <div className="text-status-success">Net: +130/hr</div>
              </div>
            }
          />
        </div>
      </Section>

      {/* === FEED === */}
      <Section title="Feed Entry">
        <div className="max-w-lg bg-surface-1 border border-border-default rounded overflow-hidden">
          {feedEntries.slice(0, 5).map((entry) => (
            <FeedEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </Section>

      {/* === TYPOGRAPHY === */}
      <Section title="Typography">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h4 className="text-xs text-text-tertiary uppercase tracking-wider mb-3">
              Dashboard Register (Helvetica Neue)
            </h4>
            <div className="space-y-1 font-dashboard">
              <p className="text-2xl text-text-primary">Page Header (24px)</p>
              <p className="text-xl text-text-primary">Panel Title (20px)</p>
              <p className="text-lg text-text-primary">Section Header (16px)</p>
              <p className="text-base text-text-primary">
                Body text — primary data values (14px)
              </p>
              <p className="text-sm text-text-secondary">
                Secondary data — feed entries (13px)
              </p>
              <p className="text-xs text-text-tertiary">
                Timestamps — micro-labels (12px)
              </p>
            </div>
          </div>
          <div>
            <h4 className="text-xs text-text-tertiary uppercase tracking-wider mb-3">
              Terminal Register (Wudoo Mono)
            </h4>
            <div className="space-y-1 font-terminal">
              <p className="text-base text-text-primary">
                Agent communication text (14px)
              </p>
              <p className="text-sm text-text-secondary">
                [14:32:07] Alpha-7 Executed COMPUTE purchase
              </p>
              <p className="text-xs text-text-tertiary">
                mandate.clause.priority_resource = COMPUTE
              </p>
            </div>
          </div>
        </div>

        <SubSection title="Tabular Numerals">
          <div className="font-dashboard tabular-nums text-sm space-y-0.5 text-text-primary">
            <p>1,234.5678</p>
            <p>12,345.6789</p>
            <p>123,456.7890</p>
            <p className="text-text-tertiary text-xs mt-1">
              All digits align vertically with tabular-nums
            </p>
          </div>
        </SubSection>
      </Section>

      {/* === COLOURS === */}
      <Section title="Colour Palette">
        <SubSection title="Resource Accents">
          <div className="flex flex-wrap gap-3">
            {[
              { name: "COMPUTE", cls: "bg-compute" },
              { name: "ENERGY", cls: "bg-energy" },
              { name: "CHIPS", cls: "bg-chips" },
              { name: "COOLING", cls: "bg-cooling" },
              { name: "TALENT", cls: "bg-talent" },
              { name: "DATA", cls: "bg-data" },
              { name: "CLEARANCE", cls: "bg-clearance" },
            ].map((c) => (
              <div key={c.name} className="text-center">
                <div className={`w-12 h-12 rounded ${c.cls}`} />
                <span className="text-xs text-text-tertiary mt-1 block">
                  {c.name}
                </span>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection title="Surface Elevation">
          <div className="flex gap-3">
            {[
              { name: "Surface 0", cls: "bg-surface-0" },
              { name: "Surface 1", cls: "bg-surface-1" },
              { name: "Surface 2", cls: "bg-surface-2" },
              { name: "Surface 3", cls: "bg-surface-3" },
              { name: "Hover", cls: "bg-surface-hover" },
            ].map((s) => (
              <div key={s.name} className="text-center">
                <div
                  className={`w-16 h-16 rounded border border-border-default ${s.cls}`}
                />
                <span className="text-xs text-text-tertiary mt-1 block">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection title="Status Colours">
          <div className="flex gap-3">
            {[
              { name: "Critical", cls: "bg-status-critical" },
              { name: "Warning", cls: "bg-status-warning" },
              { name: "Info", cls: "bg-status-info" },
              { name: "Success", cls: "bg-status-success" },
            ].map((s) => (
              <div key={s.name} className="text-center">
                <div className={`w-12 h-12 rounded ${s.cls}`} />
                <span className="text-xs text-text-tertiary mt-1 block">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </SubSection>
      </Section>
    </div>
  );
}
