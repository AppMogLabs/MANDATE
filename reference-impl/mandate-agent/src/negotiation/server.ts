/**
 * MNP Server — HTTP listener for incoming negotiation messages.
 * Uses Bun.serve() per project conventions.
 */

import type { NegotiationMessage, ConversationState } from "./types.ts";
import { log } from "../logging/audit.ts";

export type MessageHandler = (message: NegotiationMessage) => Promise<void>;

export interface MNPServer {
  readonly port: number;
  readonly conversations: ReadonlyMap<string, ConversationState>;
  stop(): void;
}

/**
 * Creates and starts the MNP negotiation HTTP server.
 */
export function startMNPServer(
  port: number,
  onMessage: MessageHandler,
): MNPServer {
  const conversations = new Map<string, ConversationState>();

  const server = Bun.serve({
    port,
    routes: {
      "/negotiate": {
        POST: async (req) => {
          try {
            const body = await req.json();
            const message = body as NegotiationMessage;

            if (!message.performative || !message.sender || !message.conversationId) {
              return new Response(
                JSON.stringify({ error: "Invalid negotiation message" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
              );
            }

            // Update conversation state
            const existing = conversations.get(message.conversationId);
            const updatedMessages = existing
              ? [...existing.messages, message]
              : [message];

            let status: ConversationState["status"] = "open";
            if (message.performative === "accept") status = "accepted";
            if (message.performative === "reject") status = "rejected";

            conversations.set(message.conversationId, {
              conversationId: message.conversationId,
              counterparty: message.sender,
              messages: updatedMessages,
              status,
            });

            // Dispatch to handler
            await onMessage(message);

            log("info", "Received negotiation message", {
              from: message.sender,
              performative: message.performative,
              conversationId: message.conversationId,
            });

            return new Response(
              JSON.stringify({ status: "received" }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          } catch (err) {
            log("error", "Error processing negotiation message", {
              error: String(err),
            });
            return new Response(
              JSON.stringify({ error: "Internal error" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
        },
      },
      "/health": {
        GET: () =>
          new Response(
            JSON.stringify({ status: "ok", conversations: conversations.size }),
            { headers: { "Content-Type": "application/json" } },
          ),
      },
    },
  });

  log("info", `MNP server listening on port ${port}`);

  return {
    port,
    conversations,
    stop: () => server.stop(),
  };
}
