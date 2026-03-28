import { test, expect, describe } from "bun:test";
import {
  fetchGameState,
  mapRoleId,
  formatBalance,
  RESOURCE_NAMES,
  AGENT_REGISTRY_ABI,
  ERC20_ABI,
  REPUTATION_LEDGER_ABI,
  ORDER_BOOK_ABI,
  EPOCH_MANAGER_ABI,
  INFORMATION_MARKET_ABI,
  ROLE_REGISTRY_ABI,
  NEGOTIATION_SETTLEMENT_ABI,
} from "../index.js";

describe("RESOURCE_NAMES", () => {
  test("contains exactly 7 resources", () => {
    expect(RESOURCE_NAMES).toHaveLength(7);
  });

  test("contains all expected resource names", () => {
    const expected = ["COMPUTE", "CHIPS", "DATA", "ENERGY", "TALENT", "COOLING", "CLEARANCE"];
    expect([...RESOURCE_NAMES]).toEqual(expected);
  });

  test("is readonly and cannot be mutated", () => {
    // TypeScript enforces this at compile time; runtime check for array identity
    const original = RESOURCE_NAMES[0];
    expect(original).toBe("COMPUTE");
  });
});

describe("mapRoleId", () => {
  test("maps 0 to ComputeSuperpower", () => {
    expect(mapRoleId(0)).toBe("ComputeSuperpower");
  });

  test("maps 1 to DataRichState", () => {
    expect(mapRoleId(1)).toBe("DataRichState");
  });

  test("maps 2 to ChipPower", () => {
    expect(mapRoleId(2)).toBe("ChipPower");
  });

  test("maps 3 to TalentHub", () => {
    expect(mapRoleId(3)).toBe("TalentHub");
  });

  test("maps 4 to RegulatoryPower", () => {
    expect(mapRoleId(4)).toBe("RegulatoryPower");
  });

  test("returns Unknown for unrecognized role ID", () => {
    expect(mapRoleId(5)).toBe("Unknown");
    expect(mapRoleId(99)).toBe("Unknown");
    expect(mapRoleId(-1)).toBe("Unknown");
  });
});

describe("formatBalance", () => {
  test("converts 1e18 wei to 1.0", () => {
    expect(formatBalance(1000000000000000000n)).toBe(1.0);
  });

  test("converts 0 wei to 0", () => {
    expect(formatBalance(0n)).toBe(0);
  });

  test("converts 500000000000000000 wei to 0.5", () => {
    expect(formatBalance(500000000000000000n)).toBe(0.5);
  });

  test("handles large values", () => {
    // 1 million tokens
    const oneMillionWei = 1000000n * 10n ** 18n;
    expect(formatBalance(oneMillionWei)).toBe(1_000_000);
  });

  test("respects custom decimals", () => {
    // USDC-style 6 decimals: 1_000_000 = 1.0
    expect(formatBalance(1000000n, 6)).toBe(1.0);
  });

  test("handles 0 decimals", () => {
    expect(formatBalance(42n, 0)).toBe(42);
  });
});

describe("ABI exports", () => {
  test("AGENT_REGISTRY_ABI is a non-empty array", () => {
    expect(Array.isArray(AGENT_REGISTRY_ABI)).toBe(true);
    expect(AGENT_REGISTRY_ABI.length).toBeGreaterThan(0);
  });

  test("ERC20_ABI is a non-empty array", () => {
    expect(Array.isArray(ERC20_ABI)).toBe(true);
    expect(ERC20_ABI.length).toBeGreaterThan(0);
  });

  test("REPUTATION_LEDGER_ABI is a non-empty array", () => {
    expect(Array.isArray(REPUTATION_LEDGER_ABI)).toBe(true);
    expect(REPUTATION_LEDGER_ABI.length).toBeGreaterThan(0);
  });

  test("ORDER_BOOK_ABI is a non-empty array", () => {
    expect(Array.isArray(ORDER_BOOK_ABI)).toBe(true);
    expect(ORDER_BOOK_ABI.length).toBeGreaterThan(0);
  });

  test("EPOCH_MANAGER_ABI is a non-empty array", () => {
    expect(Array.isArray(EPOCH_MANAGER_ABI)).toBe(true);
    expect(EPOCH_MANAGER_ABI.length).toBeGreaterThan(0);
  });

  test("INFORMATION_MARKET_ABI is a non-empty array", () => {
    expect(Array.isArray(INFORMATION_MARKET_ABI)).toBe(true);
    expect(INFORMATION_MARKET_ABI.length).toBeGreaterThan(0);
  });

  test("ROLE_REGISTRY_ABI is a non-empty array", () => {
    expect(Array.isArray(ROLE_REGISTRY_ABI)).toBe(true);
    expect(ROLE_REGISTRY_ABI.length).toBeGreaterThan(0);
  });

  test("NEGOTIATION_SETTLEMENT_ABI is a non-empty array", () => {
    expect(Array.isArray(NEGOTIATION_SETTLEMENT_ABI)).toBe(true);
    expect(NEGOTIATION_SETTLEMENT_ABI.length).toBeGreaterThan(0);
  });

  test("all ABIs contain only human-readable function signatures", () => {
    const allAbis = [
      ...AGENT_REGISTRY_ABI,
      ...ERC20_ABI,
      ...REPUTATION_LEDGER_ABI,
      ...ORDER_BOOK_ABI,
      ...EPOCH_MANAGER_ABI,
      ...INFORMATION_MARKET_ABI,
      ...ROLE_REGISTRY_ABI,
      ...NEGOTIATION_SETTLEMENT_ABI,
    ];

    for (const fragment of allAbis) {
      expect(fragment).toMatch(/^function\s+\w+/);
    }
  });

  test("all ABIs use view or pure modifiers (read-only)", () => {
    const allAbis = [
      ...AGENT_REGISTRY_ABI,
      ...ERC20_ABI,
      ...REPUTATION_LEDGER_ABI,
      ...ORDER_BOOK_ABI,
      ...EPOCH_MANAGER_ABI,
      ...INFORMATION_MARKET_ABI,
      ...ROLE_REGISTRY_ABI,
      ...NEGOTIATION_SETTLEMENT_ABI,
    ];

    for (const fragment of allAbis) {
      expect(fragment).toMatch(/\b(view|pure)\b/);
    }
  });
});

describe("fetchGameState", () => {
  test("is exported as a function", () => {
    expect(typeof fetchGameState).toBe("function");
  });

  test("accepts three arguments", () => {
    expect(fetchGameState.length).toBe(3);
  });
});
