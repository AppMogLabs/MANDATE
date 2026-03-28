import { test, expect } from "bun:test";
import { DecisionEngine, type ProposedAction } from "./engine.ts";
import type { LLMAdapter, CompletionOptions } from "../llm/adapter.ts";
import type { ChainState } from "../chain/reader.ts";

const mockState: ChainState = {
  agentId: 7,
  role: "ComputeSuperpower",
  balances: { RATE: 10000, COMPUTE: 500, CHIPS: 200, DATA: 100, ENERGY: 300, TALENT: 150, COOLING: 80, CLEARANCE: 50 },
  reputationScore: 5000,
  marketPrices: { COMPUTE: 1.2, CHIPS: 0.8, DATA: 2.1, ENERGY: 0.5, TALENT: 1.8, COOLING: 0.3, CLEARANCE: 3.0 },
  epochProgress: { currentEpoch: 1, timeRemaining: 3600 },
  blockNumber: 1000n,
  timestamp: 1711612800,
  reflexWindowActive: false,
};

class MockLLMAdapter implements LLMAdapter {
  response: string;
  constructor(response: string) {
    this.response = response;
  }
  async complete(_prompt: string, _options: CompletionOptions): Promise<string> {
    return this.response;
  }
}

test("DecisionEngine parses valid JSON response", async () => {
  const llm = new MockLLMAdapter(JSON.stringify({
    actions: [
      { actionType: "ORDER_PLACE", resource: "COMPUTE", quantity: 500, price: 1.25, rationale: "Buy COMPUTE" },
    ],
    holdReason: null,
  }));

  const engine = new DecisionEngine(llm);
  const result = await engine.decide("Buy COMPUTE", {}, mockState);

  expect(result.actions).toHaveLength(1);
  expect(result.actions[0].actionType).toBe("ORDER_PLACE");
  expect(result.actions[0].resource).toBe("COMPUTE");
  expect(result.holdReason).toBeNull();
});

test("DecisionEngine handles hold response", async () => {
  const llm = new MockLLMAdapter(JSON.stringify({
    actions: [],
    holdReason: "Market conditions unfavourable",
  }));

  const engine = new DecisionEngine(llm);
  const result = await engine.decide("Buy COMPUTE", {}, mockState);

  expect(result.actions).toHaveLength(0);
  expect(result.holdReason).toBe("Market conditions unfavourable");
});

test("DecisionEngine handles malformed JSON", async () => {
  const llm = new MockLLMAdapter("this is not json");

  const engine = new DecisionEngine(llm);
  const result = await engine.decide("Buy COMPUTE", {}, mockState);

  expect(result.actions).toHaveLength(0);
  expect(result.holdReason).toContain("Failed to parse");
});

test("DecisionEngine extracts JSON from code blocks", async () => {
  const llm = new MockLLMAdapter("```json\n" + JSON.stringify({
    actions: [{ actionType: "ORDER_CANCEL", resource: "CHIPS", quantity: 1, price: 0, rationale: "Cancel" }],
    holdReason: null,
  }) + "\n```");

  const engine = new DecisionEngine(llm);
  const result = await engine.decide("Cancel orders", {}, mockState);

  expect(result.actions).toHaveLength(1);
  expect(result.actions[0].actionType).toBe("ORDER_CANCEL");
});

test("DecisionEngine filters invalid actions", async () => {
  const llm = new MockLLMAdapter(JSON.stringify({
    actions: [
      { actionType: "ORDER_PLACE", resource: "COMPUTE", quantity: 500, price: 1.25, rationale: "Valid" },
      { actionType: "BAD", resource: null, quantity: "not a number" }, // invalid
    ],
    holdReason: null,
  }));

  const engine = new DecisionEngine(llm);
  const result = await engine.decide("Buy", {}, mockState);

  expect(result.actions).toHaveLength(1);
});
