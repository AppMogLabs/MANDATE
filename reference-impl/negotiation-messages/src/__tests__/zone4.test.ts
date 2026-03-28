import { test, expect, describe } from "bun:test";
import { messageToZone4 } from "../zone4.js";
import type {
  RequestMessage,
  ProposeMessage,
  AcceptMessage,
  RejectMessage,
  WithdrawMessage,
} from "../types.js";

const ADDR_A = "0x1234567890abcdef1234567890abcdef12345678";
const ADDR_B = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

describe("messageToZone4", () => {
  test("REQUEST message formatting", () => {
    const msg: RequestMessage = {
      type: "REQUEST",
      from: ADDR_A,
      signature: "0xsig",
      requestId: "req-001",
      resource: "wood",
      quantity: 100,
      urgency: "high",
    };

    const output = messageToZone4(msg);
    expect(output).toContain(`[NEGOTIATION from:${ADDR_A} type:REQUEST]`);
    expect(output).toContain("Resource: wood");
    expect(output).toContain("Quantity: 100");
    expect(output).toContain("Urgency: high");
    expect(output).toContain("Request ID: req-001");
    expect(output).toContain("[/NEGOTIATION]");
    // Signature should NOT appear in output
    expect(output).not.toContain("0xsig");
  });

  test("PROPOSE message formatting with legs", () => {
    const msg: ProposeMessage = {
      type: "PROPOSE",
      from: ADDR_A,
      signature: "0xsig",
      proposalId: "prop-001",
      to: ADDR_B,
      legs: [
        {
          party: "A",
          gives: "wood",
          amount: 50,
          receivesResource: "stone",
          receivesAmount: 30,
        },
        {
          party: "B",
          gives: "stone",
          amount: 30,
          receivesResource: "wood",
          receivesAmount: 50,
        },
      ],
      expiresAt: 1700000000,
      nonce: 1,
    };

    const output = messageToZone4(msg);
    expect(output).toContain(`[NEGOTIATION from:${ADDR_A} type:PROPOSE]`);
    expect(output).toContain("Proposal ID: prop-001");
    expect(output).toContain(`To: ${ADDR_B}`);
    expect(output).toContain("Party A: gives 50 wood, receives 30 stone");
    expect(output).toContain("Party B: gives 30 stone, receives 50 wood");
    expect(output).toContain("[/NEGOTIATION]");
  });

  test("ACCEPT message formatting", () => {
    const msg: AcceptMessage = {
      type: "ACCEPT",
      from: ADDR_A,
      signature: "0xsig",
      proposalId: "prop-001",
      to: ADDR_B,
      dealHash: "0xdealhash123",
    };

    const output = messageToZone4(msg);
    expect(output).toContain(`[NEGOTIATION from:${ADDR_A} type:ACCEPT]`);
    expect(output).toContain("Proposal ID: prop-001");
    expect(output).toContain("Deal Hash: 0xdealhash123");
    expect(output).toContain("[/NEGOTIATION]");
  });

  test("REJECT with reason", () => {
    const msg: RejectMessage = {
      type: "REJECT",
      from: ADDR_A,
      signature: "0xsig",
      proposalId: "prop-001",
      to: ADDR_B,
      reason: "Price too high",
    };

    const output = messageToZone4(msg);
    expect(output).toContain(`[NEGOTIATION from:${ADDR_A} type:REJECT]`);
    expect(output).toContain("Proposal ID: prop-001");
    expect(output).toContain("Reason: Price too high");
    expect(output).toContain("[/NEGOTIATION]");
  });

  test("WITHDRAW formatting", () => {
    const msg: WithdrawMessage = {
      type: "WITHDRAW",
      from: ADDR_A,
      signature: "0xsig",
      to: ADDR_B,
    };

    const output = messageToZone4(msg);
    expect(output).toContain(`[NEGOTIATION from:${ADDR_A} type:WITHDRAW]`);
    expect(output).toContain(`To: ${ADDR_B}`);
    expect(output).toContain("[/NEGOTIATION]");
  });
});
