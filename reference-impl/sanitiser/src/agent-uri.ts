import type { AgentURIRegistration } from "./types";

interface ValidationResult {
  valid: boolean;
  negotiationEndpoint?: string;
  errors: string[];
}

/**
 * Validate an agentURI registration payload and extract only
 * the negotiationEndpoint field. All other fields are stripped
 * as a defence against injection via arbitrary metadata.
 */
export function validateAgentURI(json: unknown): ValidationResult {
  const errors: string[] = [];

  // Must be a non-null object
  if (json === null || json === undefined || typeof json !== "object" || Array.isArray(json)) {
    return {
      valid: false,
      errors: ["Input must be a non-null object"],
    };
  }

  const record = json as Record<string, unknown>;

  // negotiationEndpoint must be present
  if (!("negotiationEndpoint" in record) || typeof record["negotiationEndpoint"] !== "string") {
    errors.push("Missing or invalid negotiationEndpoint (must be a string)");
    return { valid: false, errors };
  }

  const endpoint = record["negotiationEndpoint"];

  // Must be a valid https:// URL
  if (!endpoint.startsWith("https://")) {
    errors.push("negotiationEndpoint must use https:// prefix");
    return { valid: false, errors };
  }

  try {
    new URL(endpoint);
  } catch {
    errors.push("negotiationEndpoint is not a valid URL");
    return { valid: false, errors };
  }

  // Return only the extracted field — strip everything else
  const registration: AgentURIRegistration = {
    negotiationEndpoint: endpoint,
  };

  return {
    valid: true,
    negotiationEndpoint: registration.negotiationEndpoint,
    errors: [],
  };
}
