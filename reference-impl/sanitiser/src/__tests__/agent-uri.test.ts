import { test, expect, describe } from "bun:test";
import { validateAgentURI } from "../agent-uri";

describe("validateAgentURI", () => {
  test("valid agentURI with negotiationEndpoint", () => {
    const result = validateAgentURI({
      negotiationEndpoint: "https://agent.example.com/negotiate",
    });
    expect(result.valid).toBe(true);
    expect(result.negotiationEndpoint).toBe("https://agent.example.com/negotiate");
    expect(result.errors).toHaveLength(0);
  });

  test("strips extra fields and only returns negotiationEndpoint", () => {
    const result = validateAgentURI({
      negotiationEndpoint: "https://agent.example.com/negotiate",
      maliciousField: "injection payload",
      anotherField: 42,
      nested: { key: "value" },
    });
    expect(result.valid).toBe(true);
    expect(result.negotiationEndpoint).toBe("https://agent.example.com/negotiate");
    expect(result.errors).toHaveLength(0);
    // Ensure extra fields are not in the result
    expect("maliciousField" in result).toBe(false);
    expect("anotherField" in result).toBe(false);
    expect("nested" in result).toBe(false);
  });

  test("rejects missing negotiationEndpoint", () => {
    const result = validateAgentURI({ someOtherField: "value" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("negotiationEndpoint");
  });

  test("rejects non-string negotiationEndpoint", () => {
    const result = validateAgentURI({ negotiationEndpoint: 12345 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("rejects non-https endpoint", () => {
    const result = validateAgentURI({
      negotiationEndpoint: "http://agent.example.com/negotiate",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("https://");
  });

  test("rejects non-object input: null", () => {
    const result = validateAgentURI(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("non-null object");
  });

  test("rejects non-object input: string", () => {
    const result = validateAgentURI("not an object");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("non-null object");
  });

  test("rejects non-object input: number", () => {
    const result = validateAgentURI(42);
    expect(result.valid).toBe(false);
  });

  test("rejects non-object input: array", () => {
    const result = validateAgentURI(["https://example.com"]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("non-null object");
  });

  test("rejects non-object input: undefined", () => {
    const result = validateAgentURI(undefined);
    expect(result.valid).toBe(false);
  });

  test("rejects empty object", () => {
    const result = validateAgentURI({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
