import { test, expect, describe } from "bun:test";
import { validateReturnValue } from "../return-value";

describe("validateReturnValue", () => {
  // 32 bytes = 64 hex chars
  const validWord = "0".repeat(64);
  const validAddress = "000000000000000000000000" + "d8dA6BF26964aF9D7eEd9e03E53415D37aA96045".toLowerCase();

  test("valid address (32 bytes / 64 hex chars)", () => {
    const result = validateReturnValue(validAddress, "address");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("valid address with 0x prefix", () => {
    const result = validateReturnValue("0x" + validWord, "address");
    expect(result.valid).toBe(true);
  });

  test("rejects oversized address return (potential injection)", () => {
    const oversized = validWord + "abcdef1234567890";
    const result = validateReturnValue(oversized, "address");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Expected 64 hex chars");
  });

  test("rejects undersized address return", () => {
    const undersized = "0".repeat(40);
    const result = validateReturnValue(undersized, "address");
    expect(result.valid).toBe(false);
  });

  test("valid uint256", () => {
    const result = validateReturnValue(validWord, "uint256");
    expect(result.valid).toBe(true);
  });

  test("rejects oversized uint256", () => {
    const oversized = validWord + "00";
    const result = validateReturnValue(oversized, "uint256");
    expect(result.valid).toBe(false);
  });

  test("valid bool (32 bytes, value 1)", () => {
    const boolTrue = "0".repeat(63) + "1";
    const result = validateReturnValue(boolTrue, "bool");
    expect(result.valid).toBe(true);
  });

  test("valid bool (32 bytes, value 0)", () => {
    const boolFalse = "0".repeat(64);
    const result = validateReturnValue(boolFalse, "bool");
    expect(result.valid).toBe(true);
  });

  test("rejects empty hex", () => {
    const result = validateReturnValue("", "address");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Empty return value");
  });

  test("rejects empty hex with 0x prefix", () => {
    const result = validateReturnValue("0x", "uint256");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Empty return value");
  });

  test("valid bytes32", () => {
    const result = validateReturnValue(validWord, "bytes32");
    expect(result.valid).toBe(true);
  });

  test("rejects oversized bytes32", () => {
    const oversized = validWord + "ff";
    const result = validateReturnValue(oversized, "bytes32");
    expect(result.valid).toBe(false);
  });

  test("valid string with proper ABI offset", () => {
    // Offset (0x20 = 32), length (5), "hello" padded
    const offset = "0".repeat(62) + "20"; // offset = 32
    const length = "0".repeat(62) + "05"; // length = 5
    const data = "68656c6c6f" + "0".repeat(54); // "hello" padded to 32 bytes
    const result = validateReturnValue(offset + length + data, "string");
    expect(result.valid).toBe(true);
  });

  test("rejects string with too-short return", () => {
    const result = validateReturnValue("0".repeat(32), "string");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too short");
  });

  test("rejects string with invalid ABI offset", () => {
    // Offset not a multiple of 32
    const badOffset = "0".repeat(62) + "15"; // offset = 21 (not multiple of 32)
    const rest = "0".repeat(128);
    const result = validateReturnValue(badOffset + rest, "string");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not a multiple of 32");
  });

  test("rejects invalid hex characters", () => {
    const result = validateReturnValue("0xGGGG" + "0".repeat(60), "address");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid hex");
  });
});
