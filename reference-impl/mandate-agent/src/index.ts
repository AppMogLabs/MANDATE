/**
 * MANDATE Reference Agent — main lifecycle orchestrator.
 *
 * Startup → Main Loop → Mandate Update → Epoch End
 *
 * Single-process, LLM-agnostic agent that demonstrates every Phase 4
 * protocol feature. Fork, customise, or replace entirely.
 */

import { loadConfig, type AgentConfig } from "./config.ts";
import { createChainReader, type ChainState } from "./chain/reader.ts";
import { subscribeToEvents, type EventHandler } from "./chain/events.ts";
import { DecisionEngine, type ProposedAction } from "./decision/engine.ts";
import { Executor } from "./execution/executor.ts";
import { MNPClient } from "./negotiation/client.ts";
import { startMNPServer, type MNPServer } from "./negotiation/server.ts";
import { AnthropicAdapter } from "./llm/anthropic.ts";
import { OpenAIAdapter } from "./llm/openai.ts";
import type { LLMAdapter } from "./llm/adapter.ts";
import {
  loadMandateFromFile,
  toGuardConstraints,
  DEFAULT_LAYER2,
  type MandateSchema,
  type Layer2Constraints,
} from "./mandate/schema.ts";
import { computeMandateHash } from "./mandate/hash.ts";
import {
  log,
  setLogLevel,
  logAction,
  createAuditEntry,
} from "./logging/audit.ts";
import type { NegotiationMessage } from "./negotiation/types.ts";
import type { Address } from "viem";

// ─── State ───────────────────────────────────────────────────────────

let config: AgentConfig;
let chainReader: ReturnType<typeof createChainReader>;
let decisionEngine: DecisionEngine;
let executor: Executor;
let mnpClient: MNPClient;
let mnpServer: MNPServer;
let mandate: MandateSchema | null = null;
let chainState: ChainState | null = null;
let running = false;
let pendingNegotiations: NegotiationMessage[] = [];

// ─── Lifecycle ───────────────────────────────────────────────────────

async function startup(): Promise<void> {
  log("info", "=== MANDATE Reference Agent starting ===");

  // Load and validate configuration
  config = loadConfig();
  setLogLevel(config.logLevel);
  log("info", "Configuration loaded", {
    chainId: config.chainId,
    agentId: config.agentId,
    llmProvider: config.llmProvider,
  });

  // Connect to MegaETH
  chainReader = createChainReader(config.rpcUrl, config.contracts);
  log("info", "Connected to MegaETH RPC", { rpcUrl: config.rpcUrl });

  // Create LLM adapter
  const llm = createLLMAdapter(config);
  decisionEngine = new DecisionEngine(llm);
  log("info", `LLM adapter created: ${config.llmProvider} / ${config.llmModel}`);

  // Create executor
  executor = new Executor(
    config.agentPrivateKey,
    config.rpcUrl,
    chainReader.client,
    config.contracts,
    config.agentId,
  );
  log("info", `Agent wallet: ${executor.agentAddress}`);

  // Read initial chain state
  chainState = await chainReader.readState(executor.agentAddress as Address);
  log("info", "Initial chain state read", {
    agentId: chainState.agentId,
    role: chainState.role,
    rateBalance: chainState.balances.RATE,
  });

  // Load mandate from file (or wait for frontend push)
  try {
    mandate = await loadMandateFromFile("mandate.json");
    log("info", "Mandate loaded from file", { version: mandate.version });
  } catch {
    log("warn", "No mandate.json found — agent will wait for mandate via MNP server");
  }

  // Create MNP client for agent-to-agent communication
  mnpClient = new MNPClient(
    chainReader.client,
    config.contracts,
    executor.agentAddress as Address,
  );

  // Start MNP server for incoming negotiations
  mnpServer = startMNPServer(config.mnpListenPort, handleIncomingNegotiation);

  // Subscribe to WebSocket events
  const eventSubs = subscribeToEvents(
    config.wsUrl,
    config.contracts,
    handleChainEvent,
  );

  // Register shutdown handler
  process.on("SIGINT", () => shutdown(eventSubs.unsubscribeAll));
  process.on("SIGTERM", () => shutdown(eventSubs.unsubscribeAll));

  log("info", "=== Startup complete. Beginning main loop ===");
}

async function mainLoop(): Promise<void> {
  running = true;

  while (running) {
    try {
      await decisionCycle();
    } catch (err) {
      log("error", "Decision cycle error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await sleep(config.decisionIntervalMs);
  }
}

async function decisionCycle(): Promise<void> {
  if (!mandate) {
    log("debug", "No mandate loaded — skipping cycle");
    return;
  }

  // 1. Refresh chain state
  chainState = await chainReader.readState(executor.agentAddress as Address);

  // 2. Check for reflex window — use pre-approvals if active
  if (chainState.reflexWindowActive) {
    log("info", "Reflex window active — checking pre-approvals");
    // Pre-approval execution would go here (integrates with reflex-preapproval module)
  }

  // 3. Build negotiation message strings for the data zone
  const negotiationStrings = pendingNegotiations.map(
    (msg) =>
      `[${msg.performative.toUpperCase()}] from ${msg.sender}: ${JSON.stringify(msg.content)}`,
  );
  pendingNegotiations = []; // Clear after reading

  // 4. Call decision engine
  const layer2 = mandate.layer2_operationalConstraints ?? DEFAULT_LAYER2;
  const decision = await decisionEngine.decide(
    mandate.layer1_strategicIntent.text,
    layer2 as unknown as Record<string, unknown>,
    chainState,
    negotiationStrings,
  );

  if (decision.holdReason) {
    log("info", "Decision: hold", { reason: decision.holdReason });
    return;
  }

  // 5. Guard validation for each action
  const approvedActions: ProposedAction[] = [];
  for (const action of decision.actions) {
    const guardResult = validateWithGuard(action, layer2);
    if (guardResult.approved) {
      approvedActions.push(action);
    } else {
      log("info", "Guard rejected action", {
        actionType: action.actionType,
        reason: guardResult.reason,
      });
      await logAction(
        createAuditEntry(config.agentId, action.actionType, action, "rejected", {
          guardReason: guardResult.reason,
        }),
      );
    }
  }

  // 6. Execute approved actions
  if (approvedActions.length > 0) {
    const results = await executor.executeActions(approvedActions);
    const successes = results.filter((r) => r.success).length;
    log("info", `Executed ${successes}/${results.length} actions`);
  }
}

// ─── Guard Integration ───────────────────────────────────────────────

interface GuardResult {
  approved: boolean;
  reason?: string;
}

function validateWithGuard(
  action: ProposedAction,
  layer2: Layer2Constraints,
): GuardResult {
  // Check blocked counterparties (deterministic, no LLM)
  // Full guard integration uses the guard workspace module

  // Reserve floor check
  if (chainState && action.resource) {
    const floor = layer2.reserves.floors[action.resource] ?? 0;
    const currentBalance = chainState.balances[action.resource] ?? 0;

    if (action.actionType === "ORDER_PLACE" && currentBalance - action.quantity < floor) {
      return {
        approved: false,
        reason: `Would breach reserve floor for ${action.resource}: ${currentBalance} - ${action.quantity} < ${floor}`,
      };
    }
  }

  // Price threshold check
  const minRatio = layer2.trading.minimumTradeRatios[action.resource] ?? 0;
  if (action.actionType === "ORDER_PLACE" && action.price < minRatio) {
    return {
      approved: false,
      reason: `Sell price ${action.price} below minimum ratio ${minRatio} for ${action.resource}`,
    };
  }

  // Max single trade size
  if (
    layer2.risk.maxSingleTradeSize > 0 &&
    action.quantity > layer2.risk.maxSingleTradeSize
  ) {
    return {
      approved: false,
      reason: `Trade size ${action.quantity} exceeds max ${layer2.risk.maxSingleTradeSize}`,
    };
  }

  return { approved: true };
}

// ─── Event Handlers ──────────────────────────────────────────────────

const handleChainEvent: EventHandler = (eventName, data) => {
  log("info", `Chain event: ${eventName}`, data);

  if (eventName === "ReflexWindow") {
    log("info", "Reflex window event detected — will check pre-approvals next cycle");
  }

  if (eventName === "Epoch") {
    log("info", "Epoch transition detected");
  }
};

async function handleIncomingNegotiation(message: NegotiationMessage): Promise<void> {
  log("info", "Queuing incoming negotiation", {
    from: message.sender,
    performative: message.performative,
  });
  pendingNegotiations.push(message);
}

// ─── Helpers ─────────────────────────────────────────────────────────

function createLLMAdapter(cfg: AgentConfig): LLMAdapter {
  switch (cfg.llmProvider) {
    case "anthropic":
      return new AnthropicAdapter(cfg.llmApiKey, cfg.llmModel);
    case "openai":
      return new OpenAIAdapter(cfg.llmApiKey, cfg.llmModel);
    default:
      throw new Error(`Unknown LLM provider: ${cfg.llmProvider}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shutdown(unsubscribeEvents: () => void): void {
  log("info", "=== Shutting down ===");
  running = false;
  unsubscribeEvents();
  mnpServer.stop();
  process.exit(0);
}

// ─── Entry Point ─────────────────────────────────────────────────────

await startup();
await mainLoop();
