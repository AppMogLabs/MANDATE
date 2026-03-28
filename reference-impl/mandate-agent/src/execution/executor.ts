/**
 * Execution layer — converts approved actions into EVM transactions.
 * Uses viem for transaction construction and signing.
 * Uses eth_sendRawTransactionSync (EIP-7966) for instant MegaETH receipts.
 */

import {
  createWalletClient,
  http,
  encodeFunctionData,
  parseUnits,
  type WalletClient,
  type Address,
  type Hash,
  type PublicClient,
  type Transport,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ABIS } from "../chain/contracts.ts";
import type { ContractAddresses } from "../config.ts";
import type { ProposedAction } from "../decision/engine.ts";
import { log, createAuditEntry, logAction } from "../logging/audit.ts";
import { megaeth } from "../chain/reader.ts";

export interface ExecutionResult {
  readonly action: ProposedAction;
  readonly txHash: Hash | null;
  readonly success: boolean;
  readonly error?: string;
}

export class Executor {
  private readonly wallet: WalletClient;
  private readonly publicClient: PublicClient<Transport, Chain>;
  private readonly addresses: ContractAddresses;
  private readonly agentId: number;
  private readonly account: ReturnType<typeof privateKeyToAccount>;

  constructor(
    privateKey: `0x${string}`,
    rpcUrl: string,
    publicClient: PublicClient<Transport, Chain>,
    addresses: ContractAddresses,
    agentId: number,
  ) {
    this.account = privateKeyToAccount(privateKey);
    this.wallet = createWalletClient({
      account: this.account,
      chain: megaeth,
      transport: http(rpcUrl),
    });
    this.publicClient = publicClient;
    this.addresses = addresses;
    this.agentId = agentId;
  }

  get agentAddress(): Address {
    return this.account.address;
  }

  async executeAction(action: ProposedAction): Promise<ExecutionResult> {
    try {
      const txHash = await this.dispatchAction(action);

      await logAction(
        createAuditEntry(this.agentId, action.actionType, action, "success", {
          txHash,
          resource: action.resource,
          quantity: action.quantity,
          price: action.price,
        }),
      );

      log("info", `Action executed: ${action.actionType}`, {
        txHash,
        resource: action.resource,
        quantity: action.quantity,
      });

      return { action, txHash, success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      await logAction(
        createAuditEntry(this.agentId, action.actionType, action, "failed", {
          error: errorMsg,
        }),
      );

      log("error", `Action failed: ${action.actionType}`, { error: errorMsg });

      return { action, txHash: null, success: false, error: errorMsg };
    }
  }

  async executeActions(actions: readonly ProposedAction[]): Promise<readonly ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    for (const action of actions) {
      const result = await this.executeAction(action);
      results.push(result);
    }
    return results;
  }

  private async dispatchAction(action: ProposedAction): Promise<Hash> {
    switch (action.actionType) {
      case "ORDER_PLACE":
        return this.placeOrder(action);
      case "ORDER_CANCEL":
        return this.cancelOrder(action);
      case "ORDER_MATCH":
        return this.matchOrder(action);
      default:
        throw new Error(`Unsupported action type: ${action.actionType}`);
    }
  }

  private async placeOrder(action: ProposedAction): Promise<Hash> {
    const resourceAddress = this.addresses.resourceTokens[action.resource];
    if (!resourceAddress) {
      throw new Error(`Unknown resource: ${action.resource}`);
    }

    const amount = parseUnits(String(action.quantity), 18);
    const price = parseUnits(String(action.price), 18);

    // First approve RATE token spending
    const approvalHash = await this.wallet.writeContract({
      address: this.addresses.rateToken,
      abi: ABIS.rateToken,
      functionName: "approve",
      args: [this.addresses.orderBook, amount * price / parseUnits("1", 18)],
    });

    await this.publicClient.waitForTransactionReceipt({ hash: approvalHash });

    // Place the order
    return this.wallet.writeContract({
      address: this.addresses.orderBook,
      abi: ABIS.orderBook,
      functionName: "placeOrder",
      args: [resourceAddress, amount, price, true], // true = buy
    });
  }

  private async cancelOrder(action: ProposedAction): Promise<Hash> {
    // Cancel uses an orderId encoded in the quantity field for simplicity
    const orderId = BigInt(action.quantity);
    return this.wallet.writeContract({
      address: this.addresses.orderBook,
      abi: ABIS.orderBook,
      functionName: "cancelOrder",
      args: [orderId],
    });
  }

  private async matchOrder(action: ProposedAction): Promise<Hash> {
    const orderId = BigInt(action.quantity);
    const amount = parseUnits(String(action.price), 18); // price field used as match amount
    return this.wallet.writeContract({
      address: this.addresses.orderBook,
      abi: ABIS.orderBook,
      functionName: "matchOrder",
      args: [orderId, amount],
    });
  }
}
