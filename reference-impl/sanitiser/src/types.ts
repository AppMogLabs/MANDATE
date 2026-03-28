export interface SanitiseOptions {
  maxLength?: number;
}

export interface AgentURIRegistration {
  negotiationEndpoint: string;
}

export type ReturnValueType = "address" | "uint256" | "bool" | "string" | "bytes32";
