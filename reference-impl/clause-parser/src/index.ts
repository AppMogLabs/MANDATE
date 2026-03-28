export { parseClause, encodeClauseTemplate } from "./parse.ts";
export { evaluateClause } from "./evaluate.ts";
export { clauseToDirective } from "./directive.ts";

export type {
  ConditionSource,
  Comparator,
  Condition,
  ClauseActionType,
  ClauseAction,
  ParsedClause,
  ParseResult,
  ClauseTemplate,
  ClauseGameState,
} from "./types.ts";

export { MAX_OPCODES, MAX_GAS_ESTIMATE } from "./types.ts";

export type { EvaluationResult } from "./evaluate.ts";
