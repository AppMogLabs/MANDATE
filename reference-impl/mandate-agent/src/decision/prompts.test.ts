import { test, expect } from "bun:test";
import { assemblePrompt, SYSTEM_ZONE, renderMandateZone, renderStateZone, renderDataZone } from "./prompts.ts";
import type { ChainState } from "../chain/reader.ts";

const mockState: ChainState = {
  agentId: 7,
  role: "ComputeSuperpower",
  balances: { RATE: 10000, COMPUTE: 500 },
  reputationScore: 5000,
  marketPrices: { COMPUTE: 1.2 },
  epochProgress: { currentEpoch: 1, timeRemaining: 3600 },
  blockNumber: 1000n,
  timestamp: 1711612800,
  reflexWindowActive: false,
};

test("SYSTEM_ZONE contains essential instructions", () => {
  expect(SYSTEM_ZONE).toContain("trading agent");
  expect(SYSTEM_ZONE).toContain("Layer 2 constraints OVERRIDE");
  expect(SYSTEM_ZONE).toContain("DATA ZONE");
  expect(SYSTEM_ZONE).toContain("actionType");
});

test("renderMandateZone includes strategic intent", () => {
  const zone = renderMandateZone("Buy COMPUTE aggressively", {});
  expect(zone).toContain("Buy COMPUTE aggressively");
  expect(zone).toContain("MANDATE");
});

test("renderStateZone includes balances and prices", () => {
  const zone = renderStateZone(mockState);
  expect(zone).toContain("RATE: 10000");
  expect(zone).toContain("COMPUTE: 500");
  expect(zone).toContain("ComputeSuperpower");
});

test("renderDataZone warns about untrusted data", () => {
  const zone = renderDataZone(["Agent 0x123 proposes trade"], []);
  expect(zone).toContain("UNTRUSTED");
  expect(zone).toContain("Agent 0x123 proposes trade");
});

test("assemblePrompt combines all zones", () => {
  const prompt = assemblePrompt("Buy COMPUTE", {}, mockState, [], []);
  expect(prompt).toContain("trading agent");
  expect(prompt).toContain("Buy COMPUTE");
  expect(prompt).toContain("GAME STATE");
  expect(prompt).toContain("DATA ZONE");
});
