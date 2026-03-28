import { test, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig } from "./config.ts";

const REQUIRED_ENVS: Record<string, string> = {
  AGENT_PRIVATE_KEY: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  AGENT_ID: "7",
  LLM_API_KEY: "sk-test-key",
  AGENT_REGISTRY_ADDRESS: "0x" + "a".repeat(40),
  RATE_TOKEN: "0x" + "b".repeat(40),
  ORDER_BOOK: "0x" + "c".repeat(40),
  BUILDING_REGISTRY: "0x" + "d".repeat(40),
  EVENT_ORACLE: "0x" + "e".repeat(40),
  REPUTATION_LEDGER: "0x" + "f".repeat(40),
  MANDATE_ECHO_ORACLE: "0x" + "1".repeat(40),
  NEGOTIATION_SETTLEMENT: "0x" + "2".repeat(40),
  REFLEX_WINDOW_MANAGER: "0x" + "3".repeat(40),
  EPOCH_MANAGER: "0x" + "4".repeat(40),
  ROLE_REGISTRY: "0x" + "5".repeat(40),
  MAP_REGISTRY: "0x" + "6".repeat(40),
  RESOURCE_COMPUTE: "0x" + "7".repeat(40),
  RESOURCE_CHIPS: "0x" + "8".repeat(40),
  RESOURCE_DATA: "0x" + "9".repeat(40),
  RESOURCE_ENERGY: "0x" + "a1".repeat(20),
  RESOURCE_TALENT: "0x" + "b1".repeat(20),
  RESOURCE_COOLING: "0x" + "c1".repeat(20),
  RESOURCE_CLEARANCE: "0x" + "d1".repeat(20),
};

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const [key, value] of Object.entries(REQUIRED_ENVS)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
});

afterEach(() => {
  for (const [key] of Object.entries(REQUIRED_ENVS)) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

test("loadConfig returns valid config with all env vars set", () => {
  const config = loadConfig();
  expect(config.agentId).toBe(7);
  expect(config.chainId).toBe(4326);
  expect(config.llmProvider).toBe("anthropic");
  expect(config.decisionIntervalMs).toBe(30000);
  expect(config.contracts.agentRegistry).toMatch(/^0x/);
});

test("loadConfig throws when AGENT_PRIVATE_KEY missing", () => {
  delete process.env.AGENT_PRIVATE_KEY;
  expect(() => loadConfig()).toThrow("Missing required environment variable: AGENT_PRIVATE_KEY");
});

test("loadConfig throws on invalid LLM_PROVIDER", () => {
  process.env.LLM_PROVIDER = "invalid";
  try {
    expect(() => loadConfig()).toThrow("Invalid LLM_PROVIDER");
  } finally {
    process.env.LLM_PROVIDER = "anthropic";
  }
});

test("loadConfig uses default values for optional vars", () => {
  const config = loadConfig();
  expect(config.rpcUrl).toBe("https://carrot.megaeth.com/rpc");
  expect(config.echoEnabled).toBe(true);
  expect(config.mnpListenPort).toBe(8545);
  expect(config.logLevel).toBe("info");
});

test("loadConfig respects custom optional values", () => {
  process.env.DECISION_INTERVAL_MS = "60000";
  process.env.LOG_LEVEL = "debug";
  process.env.ECHO_ENABLED = "false";
  const config = loadConfig();
  expect(config.decisionIntervalMs).toBe(60000);
  expect(config.logLevel).toBe("debug");
  expect(config.echoEnabled).toBe(false);
});
