interface JsonSchema {
  type: string;
  required: string[];
  properties: Record<string, JsonSchemaProperty>;
  additionalProperties?: boolean;
}

interface JsonSchemaProperty {
  type?: string | string[];
  enum?: readonly string[];
  pattern?: string;
  minLength?: number;
  minimum?: number;
  items?: JsonSchemaProperty;
  minItems?: number;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  oneOf?: JsonSchemaProperty[];
}

const addressProperty: JsonSchemaProperty = {
  type: "string",
  pattern: "^0x[0-9a-fA-F]{40}$",
};

const signatureProperty: JsonSchemaProperty = {
  type: "string",
  minLength: 1,
};

const baseProperties: Record<string, JsonSchemaProperty> = {
  from: addressProperty,
  signature: signatureProperty,
};

const baseRequired = ["from", "signature"];

const legSchema: JsonSchemaProperty = {
  type: "object",
  required: ["party", "gives", "amount", "receivesResource", "receivesAmount"],
  properties: {
    party: { type: "string", enum: ["A", "B"] as const },
    gives: { type: "string", minLength: 1 },
    amount: { type: "number", minimum: 0 },
    receivesResource: {
      oneOf: [{ type: "string", minLength: 1 }, { type: "null" as const }],
    },
    receivesAmount: { type: "number", minimum: 0 },
  },
};

const requestSchema: JsonSchema = {
  type: "object",
  required: [...baseRequired, "type", "requestId", "resource", "quantity", "urgency"],
  properties: {
    ...baseProperties,
    type: { type: "string", enum: ["REQUEST"] as const },
    requestId: { type: "string", minLength: 1 },
    resource: { type: "string", minLength: 1 },
    quantity: { type: "number", minimum: 0 },
    maxPrice: { type: "number", minimum: 0 },
    urgency: { type: "string", enum: ["low", "medium", "high"] as const },
  },
};

const proposeSchema: JsonSchema = {
  type: "object",
  required: [...baseRequired, "type", "proposalId", "to", "legs", "expiresAt", "nonce"],
  properties: {
    ...baseProperties,
    type: { type: "string", enum: ["PROPOSE"] as const },
    proposalId: { type: "string", minLength: 1 },
    to: addressProperty,
    legs: { type: "array", items: legSchema, minItems: 1 },
    expiresAt: { type: "number", minimum: 0 },
    nonce: { type: "number", minimum: 0 },
  },
};

const counterSchema: JsonSchema = {
  type: "object",
  required: [
    ...baseRequired,
    "type",
    "proposalId",
    "inResponseTo",
    "to",
    "legs",
    "expiresAt",
    "nonce",
  ],
  properties: {
    ...baseProperties,
    type: { type: "string", enum: ["COUNTER"] as const },
    proposalId: { type: "string", minLength: 1 },
    inResponseTo: { type: "string", minLength: 1 },
    to: addressProperty,
    legs: { type: "array", items: legSchema, minItems: 1 },
    expiresAt: { type: "number", minimum: 0 },
    nonce: { type: "number", minimum: 0 },
  },
};

const acceptSchema: JsonSchema = {
  type: "object",
  required: [...baseRequired, "type", "proposalId", "to", "dealHash"],
  properties: {
    ...baseProperties,
    type: { type: "string", enum: ["ACCEPT"] as const },
    proposalId: { type: "string", minLength: 1 },
    to: addressProperty,
    dealHash: { type: "string", minLength: 1 },
  },
};

const rejectSchema: JsonSchema = {
  type: "object",
  required: [...baseRequired, "type", "proposalId", "to"],
  properties: {
    ...baseProperties,
    type: { type: "string", enum: ["REJECT"] as const },
    proposalId: { type: "string", minLength: 1 },
    to: addressProperty,
    reason: { type: "string" },
  },
};

const withdrawSchema: JsonSchema = {
  type: "object",
  required: [...baseRequired, "type", "to"],
  properties: {
    ...baseProperties,
    type: { type: "string", enum: ["WITHDRAW"] as const },
    to: addressProperty,
  },
};

export const messageSchemas: ReadonlyMap<string, JsonSchema> = new Map([
  ["REQUEST", requestSchema],
  ["PROPOSE", proposeSchema],
  ["COUNTER", counterSchema],
  ["ACCEPT", acceptSchema],
  ["REJECT", rejectSchema],
  ["WITHDRAW", withdrawSchema],
]);
