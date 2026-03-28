/**
 * Local audit logging — mirrors the on-chain AuditLog format.
 * Append-only file-based log for full observability.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { keccak256, toHex } from "viem";

export interface AuditEntry {
  readonly timestamp: number;
  readonly agentId: number;
  readonly actionType: string;
  readonly inputHash: string;
  readonly outcome: "success" | "rejected" | "failed";
  readonly details: Record<string, unknown>;
}

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "audit.jsonl");

let logDirCreated = false;

async function ensureLogDir(): Promise<void> {
  if (!logDirCreated) {
    await mkdir(dirname(LOG_FILE), { recursive: true });
    logDirCreated = true;
  }
}

/**
 * Computes a keccak256 hash of the input data for the audit trail.
 */
export function hashInput(data: unknown): string {
  const serialised = JSON.stringify(data, Object.keys(data as object).sort());
  return keccak256(toHex(serialised));
}

/**
 * Logs an action to the local audit file (JSONL format, one entry per line).
 */
export async function logAction(entry: AuditEntry): Promise<void> {
  await ensureLogDir();
  const line = JSON.stringify(entry) + "\n";
  await appendFile(LOG_FILE, line, "utf-8");
}

/**
 * Creates a structured audit entry from action details.
 */
export function createAuditEntry(
  agentId: number,
  actionType: string,
  input: unknown,
  outcome: AuditEntry["outcome"],
  details: Record<string, unknown> = {},
): AuditEntry {
  return {
    timestamp: Math.floor(Date.now() / 1000),
    agentId,
    actionType,
    inputHash: hashInput(input),
    outcome,
    details,
  };
}

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel]) {
    return;
  }
  const entry = {
    time: new Date().toISOString(),
    level,
    msg: message,
    ...data,
  };
  const output = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(output + "\n");
  } else {
    process.stdout.write(output + "\n");
  }
}
