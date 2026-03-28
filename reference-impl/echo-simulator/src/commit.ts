/**
 * Echo Commitment Tool Call
 *
 * Wraps the on-chain MandateEchoOracle.commitVector() call.
 * Checks the 30-block minimum interval and spam limits before submitting.
 */

import { Contract, type JsonRpcProvider, type Signer } from "ethers";
import { ECHO_ORACLE_ABI } from "./types.js";

/** Result of an echo commit attempt */
export interface CommitResult {
  readonly success: boolean;
  readonly txHash?: string;
  readonly error?: string;
}

/** Pre-commit check result */
export interface PreCommitCheck {
  readonly canCommit: boolean;
  readonly blocksSinceLastCommit: number;
  readonly blocksUntilReady: number;
  readonly totalCommitments: number;
}

const MIN_COMMIT_INTERVAL_BLOCKS = 30;

/**
 * Check whether the agent can commit an echo hash right now.
 * Reads the 30-block interval from the on-chain contract.
 *
 * @param agentAddress - The agent's wallet address
 * @param oracleAddress - MandateEchoOracle contract address
 * @param provider - ethers.js JSON-RPC provider
 * @returns Pre-commit check result
 */
export async function checkCanCommit(
  agentAddress: string,
  oracleAddress: string,
  provider: JsonRpcProvider,
): Promise<PreCommitCheck> {
  const oracle = new Contract(oracleAddress, ECHO_ORACLE_ABI, provider);

  const [lastBlock, totalCommits, currentBlock] = await Promise.all([
    oracle.lastCommitBlock(agentAddress) as Promise<bigint>,
    oracle.totalCommitments(agentAddress) as Promise<bigint>,
    provider.getBlockNumber(),
  ]);

  const lastBlockNum = Number(lastBlock);
  const blocksSince = lastBlockNum === 0 ? MIN_COMMIT_INTERVAL_BLOCKS : currentBlock - lastBlockNum;
  const blocksUntilReady = Math.max(0, MIN_COMMIT_INTERVAL_BLOCKS - blocksSince);

  return {
    canCommit: blocksSince >= MIN_COMMIT_INTERVAL_BLOCKS,
    blocksSinceLastCommit: blocksSince,
    blocksUntilReady,
    totalCommitments: Number(totalCommits),
  };
}

/**
 * Commit an echo hash to the MandateEchoOracle on-chain.
 * Checks the 30-block interval before submitting.
 *
 * @param hash - The echo commitment hash (bytes32)
 * @param oracleAddress - MandateEchoOracle contract address
 * @param signer - ethers.js Signer (the agent's wallet)
 * @returns CommitResult with success status and transaction hash
 */
export async function commitEchoHash(
  hash: string,
  oracleAddress: string,
  signer: Signer,
): Promise<CommitResult> {
  const provider = signer.provider;
  if (provider === null || provider === undefined) {
    return { success: false, error: "Signer has no provider" };
  }

  const agentAddress = await signer.getAddress();

  // Pre-commit check
  const check = await checkCanCommit(
    agentAddress,
    oracleAddress,
    provider as JsonRpcProvider,
  );

  if (!check.canCommit) {
    return {
      success: false,
      error: `Cannot commit yet — ${check.blocksUntilReady} blocks until 30-block interval clears`,
    };
  }

  // Determine ETH value needed for spam mitigation
  // First commit in 100-block window is free; subsequent ones cost BASE_GAS_COST * 2^count
  const oracle = new Contract(oracleAddress, ECHO_ORACLE_ABI, signer);

  try {
    // First commit in window is free (value = 0)
    // Subsequent commits need payment — the contract will revert if underpaid
    const tx = await oracle.commitVector(hash, { value: 0n });
    const receipt = await tx.wait();
    return {
      success: true,
      txHash: receipt.hash as string,
    };
  } catch (err: unknown) {
    // If first attempt fails (not first in window), retry with payment
    if (err instanceof Error && err.message.includes("Insufficient spam prevention payment")) {
      try {
        // Try with BASE_GAS_COST (0.001 ETH) — covers second commit in window
        const tx = await oracle.commitVector(hash, { value: 1_000_000_000_000_000n }); // 0.001 ETH
        const receipt = await tx.wait();
        return {
          success: true,
          txHash: receipt.hash as string,
        };
      } catch (retryErr: unknown) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : "Unknown error on retry";
        return { success: false, error: retryMsg };
      }
    }

    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
