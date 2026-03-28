import { test, expect } from "bun:test";
import { DEFAULT_COMPLETION_OPTIONS, type LLMAdapter, type CompletionOptions } from "./adapter.ts";

test("DEFAULT_COMPLETION_OPTIONS has correct defaults", () => {
  expect(DEFAULT_COMPLETION_OPTIONS.maxTokens).toBe(4096);
  expect(DEFAULT_COMPLETION_OPTIONS.temperature).toBe(0.3);
  expect(DEFAULT_COMPLETION_OPTIONS.responseFormat).toBe("json");
});

test("LLMAdapter interface can be implemented", () => {
  class TestAdapter implements LLMAdapter {
    async complete(prompt: string, options: CompletionOptions): Promise<string> {
      return `Response for: ${prompt.slice(0, 10)}`;
    }
  }

  const adapter = new TestAdapter();
  expect(adapter).toBeDefined();
});
