/**
 * @mandate/echo-simulator
 *
 * Echo simulation hook for the MandateEchoOracle.
 * Reads agent mandate + game state + prediction market probabilities,
 * generates a deterministic repositioning plan, and produces the
 * echo hash for on-chain commitment.
 *
 * Reference implementation — players may replace with custom simulation logic.
 */

export {
  simulateRepositioning,
} from "./simulate.js";

export {
  generateEchoHash,
  generateEchoCommitment,
  verifyEchoReveal,
} from "./hash.js";

export {
  commitEchoHash,
  checkCanCommit,
  type CommitResult,
  type PreCommitCheck,
} from "./commit.js";

export {
  type ResourceName,
  type EventProbability,
  type TradeDirection,
  type RepositioningLeg,
  type RepositioningPlan,
  type EchoCommitment,
  type MandateForEcho,
  type GameStateForEcho,
  RESOURCE_NAMES,
  ECHO_ORACLE_ABI,
} from "./types.js";
