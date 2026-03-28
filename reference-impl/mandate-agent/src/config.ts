/**
 * Environment configuration loading and validation.
 * All required env vars are validated at startup — fail fast if missing.
 */

export interface AgentConfig {
  // MegaETH connection
  readonly rpcUrl: string;
  readonly wsUrl: string;
  readonly chainId: number;

  // Agent identity
  readonly agentPrivateKey: `0x${string}`;
  readonly agentId: number;

  // LLM configuration
  readonly llmProvider: "anthropic" | "openai";
  readonly llmApiKey: string;
  readonly llmModel: string;

  // Contract addresses
  readonly contracts: ContractAddresses;

  // Behaviour
  readonly decisionIntervalMs: number;
  readonly chainPollIntervalMs: number;
  readonly echoEnabled: boolean;
  readonly mnpListenPort: number;
  readonly logLevel: "debug" | "info" | "warn" | "error";
}

export interface ContractAddresses {
  readonly agentRegistry: `0x${string}`;
  readonly rateToken: `0x${string}`;
  readonly orderBook: `0x${string}`;
  readonly buildingRegistry: `0x${string}`;
  readonly eventOracle: `0x${string}`;
  readonly reputationLedger: `0x${string}`;
  readonly mandateEchoOracle: `0x${string}`;
  readonly negotiationSettlement: `0x${string}`;
  readonly reflexWindowManager: `0x${string}`;
  readonly epochManager: `0x${string}`;
  readonly roleRegistry: `0x${string}`;
  readonly mapRegistry: `0x${string}`;
  readonly resourceTokens: Readonly<Record<string, `0x${string}`>>;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireAddress(name: string): `0x${string}` {
  const value = requireEnv(name);
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`Invalid address for ${name}: ${value}`);
  }
  return value as `0x${string}`;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export function loadConfig(): AgentConfig {
  const llmProvider = optionalEnv("LLM_PROVIDER", "anthropic");
  if (llmProvider !== "anthropic" && llmProvider !== "openai") {
    throw new Error(`Invalid LLM_PROVIDER: ${llmProvider}. Must be 'anthropic' or 'openai'`);
  }

  const logLevel = optionalEnv("LOG_LEVEL", "info");
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: ${logLevel}`);
  }

  return {
    rpcUrl: optionalEnv("RPC_URL", "https://carrot.megaeth.com/rpc"),
    wsUrl: optionalEnv("WS_URL", "wss://carrot.megaeth.com/ws"),
    chainId: Number(optionalEnv("CHAIN_ID", "4326")),

    agentPrivateKey: requireEnv("AGENT_PRIVATE_KEY") as `0x${string}`,
    agentId: Number(requireEnv("AGENT_ID")),

    llmProvider,
    llmApiKey: requireEnv("LLM_API_KEY"),
    llmModel: optionalEnv("LLM_MODEL", "claude-sonnet-4-20250514"),

    contracts: {
      agentRegistry: requireAddress("AGENT_REGISTRY_ADDRESS"),
      rateToken: requireAddress("RATE_TOKEN"),
      orderBook: requireAddress("ORDER_BOOK"),
      buildingRegistry: requireAddress("BUILDING_REGISTRY"),
      eventOracle: requireAddress("EVENT_ORACLE"),
      reputationLedger: requireAddress("REPUTATION_LEDGER"),
      mandateEchoOracle: requireAddress("MANDATE_ECHO_ORACLE"),
      negotiationSettlement: requireAddress("NEGOTIATION_SETTLEMENT"),
      reflexWindowManager: requireAddress("REFLEX_WINDOW_MANAGER"),
      epochManager: requireAddress("EPOCH_MANAGER"),
      roleRegistry: requireAddress("ROLE_REGISTRY"),
      mapRegistry: requireAddress("MAP_REGISTRY"),
      resourceTokens: {
        COMPUTE: requireAddress("RESOURCE_COMPUTE"),
        CHIPS: requireAddress("RESOURCE_CHIPS"),
        DATA: requireAddress("RESOURCE_DATA"),
        ENERGY: requireAddress("RESOURCE_ENERGY"),
        TALENT: requireAddress("RESOURCE_TALENT"),
        COOLING: requireAddress("RESOURCE_COOLING"),
        CLEARANCE: requireAddress("RESOURCE_CLEARANCE"),
      },
    },

    decisionIntervalMs: Number(optionalEnv("DECISION_INTERVAL_MS", "30000")),
    chainPollIntervalMs: Number(optionalEnv("CHAIN_POLL_INTERVAL_MS", "5000")),
    echoEnabled: optionalEnv("ECHO_ENABLED", "true") === "true",
    mnpListenPort: Number(optionalEnv("MNP_LISTEN_PORT", "8545")),
    logLevel: logLevel as AgentConfig["logLevel"],
  };
}
