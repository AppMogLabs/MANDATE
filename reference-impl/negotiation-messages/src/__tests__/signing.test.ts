import { test, expect, describe } from "bun:test";
import { Wallet } from "ethers";
import { signMessage, verifyMessage } from "../signing.js";
import type { ProposeMessage } from "../types.js";

const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const TEST_WALLET = new Wallet(TEST_PRIVATE_KEY);

describe("signing", () => {
  test("sign and verify roundtrip", async () => {
    const unsigned = {
      type: "PROPOSE" as const,
      from: TEST_WALLET.address,
      proposalId: "prop-001",
      to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      legs: [
        {
          party: "A" as const,
          gives: "wood",
          amount: 50,
          receivesResource: "stone",
          receivesAmount: 30,
        },
      ],
      expiresAt: 1700000000,
      nonce: 1,
    };

    const signed = await signMessage(unsigned, TEST_PRIVATE_KEY);
    expect(signed.signature).toBeDefined();
    expect(signed.signature.length).toBeGreaterThan(0);

    const verification = verifyMessage(signed as ProposeMessage);
    expect(verification.valid).toBe(true);
    expect(verification.recoveredAddress?.toLowerCase()).toBe(
      TEST_WALLET.address.toLowerCase(),
    );
  });

  test("verification fails with tampered message", async () => {
    const unsigned = {
      type: "PROPOSE" as const,
      from: TEST_WALLET.address,
      proposalId: "prop-001",
      to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      legs: [
        {
          party: "A" as const,
          gives: "wood",
          amount: 50,
          receivesResource: "stone",
          receivesAmount: 30,
        },
      ],
      expiresAt: 1700000000,
      nonce: 1,
    };

    const signed = (await signMessage(unsigned, TEST_PRIVATE_KEY)) as ProposeMessage;

    // Tamper with the message
    const tampered: ProposeMessage = { ...signed, nonce: 999 };

    const verification = verifyMessage(tampered);
    // Recovered address should differ from the claimed 'from'
    expect(verification.valid).toBe(false);
  });

  test("verification returns recovered address", async () => {
    const unsigned = {
      type: "WITHDRAW" as const,
      from: TEST_WALLET.address,
      to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    };

    const signed = await signMessage(unsigned, TEST_PRIVATE_KEY);
    const verification = verifyMessage(signed);

    expect(verification.recoveredAddress).toBeDefined();
    expect(typeof verification.recoveredAddress).toBe("string");
    expect(verification.recoveredAddress?.startsWith("0x")).toBe(true);
  });
});
