import type {
  NegotiationMessage,
  RequestMessage,
  ProposeMessage,
  CounterMessage,
  AcceptMessage,
  RejectMessage,
  WithdrawMessage,
  ProposeLeg,
} from "./types.js";

function formatLegs(legs: readonly ProposeLeg[]): string {
  return legs
    .map((leg) => {
      const receives =
        leg.receivesResource !== null
          ? `receives ${leg.receivesAmount} ${leg.receivesResource}`
          : `receives ${leg.receivesAmount} (unspecified)`;
      return `  Party ${leg.party}: gives ${leg.amount} ${leg.gives}, ${receives}`;
    })
    .join("\n");
}

function formatRequest(msg: RequestMessage): string {
  const lines: string[] = [
    `Resource: ${msg.resource}`,
    `Quantity: ${msg.quantity}`,
    `Urgency: ${msg.urgency}`,
    `Request ID: ${msg.requestId}`,
  ];
  if (msg.maxPrice !== undefined) {
    lines.push(`Max Price: ${msg.maxPrice}`);
  }
  return lines.join("\n");
}

function formatPropose(msg: ProposeMessage): string {
  const lines: string[] = [
    `Proposal ID: ${msg.proposalId}`,
    `To: ${msg.to}`,
    `Expires: ${msg.expiresAt}`,
    `Nonce: ${msg.nonce}`,
    `Legs:`,
    formatLegs(msg.legs),
  ];
  return lines.join("\n");
}

function formatCounter(msg: CounterMessage): string {
  const lines: string[] = [
    `Counter Proposal ID: ${msg.proposalId}`,
    `In Response To: ${msg.inResponseTo}`,
    `To: ${msg.to}`,
    `Expires: ${msg.expiresAt}`,
    `Nonce: ${msg.nonce}`,
    `Legs:`,
    formatLegs(msg.legs),
  ];
  return lines.join("\n");
}

function formatAccept(msg: AcceptMessage): string {
  return [`Proposal ID: ${msg.proposalId}`, `To: ${msg.to}`, `Deal Hash: ${msg.dealHash}`].join(
    "\n",
  );
}

function formatReject(msg: RejectMessage): string {
  const lines: string[] = [`Proposal ID: ${msg.proposalId}`, `To: ${msg.to}`];
  if (msg.reason) {
    lines.push(`Reason: ${msg.reason}`);
  }
  return lines.join("\n");
}

function formatWithdraw(msg: WithdrawMessage): string {
  return `To: ${msg.to}`;
}

export function messageToZone4(message: NegotiationMessage): string {
  let body: string;

  switch (message.type) {
    case "REQUEST":
      body = formatRequest(message);
      break;
    case "PROPOSE":
      body = formatPropose(message);
      break;
    case "COUNTER":
      body = formatCounter(message);
      break;
    case "ACCEPT":
      body = formatAccept(message);
      break;
    case "REJECT":
      body = formatReject(message);
      break;
    case "WITHDRAW":
      body = formatWithdraw(message);
      break;
  }

  return `[NEGOTIATION from:${message.from} type:${message.type}]\n${body}\n[/NEGOTIATION]`;
}
