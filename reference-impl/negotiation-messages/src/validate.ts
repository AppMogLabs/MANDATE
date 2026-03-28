import { messageSchemas } from "./schemas.js";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateAddressFormat(value: unknown, fieldName: string): string | null {
  if (typeof value !== "string") {
    return `${fieldName} must be a string`;
  }
  if (!ADDRESS_REGEX.test(value)) {
    return `${fieldName} is not a valid address (expected 0x + 40 hex chars)`;
  }
  return null;
}

function validateSchemaProperty(
  value: unknown,
  property: Record<string, unknown>,
  fieldName: string,
): string[] {
  const errors: string[] = [];

  if (property.oneOf) {
    const oneOfOptions = property.oneOf as Record<string, unknown>[];
    const matchesAny = oneOfOptions.some((option) => {
      if (option.type === "null") return value === null;
      if (option.type === "string") return typeof value === "string";
      return false;
    });
    if (!matchesAny) {
      errors.push(`${fieldName} does not match any allowed type`);
    }
    return errors;
  }

  const expectedType = property.type as string | undefined;

  if (expectedType === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${fieldName} must be an array`);
      return errors;
    }
    const minItems = property.minItems as number | undefined;
    if (minItems !== undefined && value.length < minItems) {
      errors.push(`${fieldName} must have at least ${minItems} item(s)`);
    }
    const itemSchema = property.items as Record<string, unknown> | undefined;
    if (itemSchema) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (itemSchema.type === "object" && isRecord(item)) {
          const itemRequired = (itemSchema.required as string[]) ?? [];
          const itemProperties = (itemSchema.properties as Record<string, Record<string, unknown>>) ?? {};
          for (const reqField of itemRequired) {
            if (!(reqField in item)) {
              errors.push(`${fieldName}[${i}].${reqField} is required`);
            }
          }
          for (const [propName, propSchema] of Object.entries(itemProperties)) {
            if (propName in item) {
              errors.push(
                ...validateSchemaProperty(item[propName], propSchema, `${fieldName}[${i}].${propName}`),
              );
            }
          }
        }
      }
    }
    return errors;
  }

  if (expectedType === "string") {
    if (typeof value !== "string") {
      errors.push(`${fieldName} must be a string`);
      return errors;
    }
    const pattern = property.pattern as string | undefined;
    if (pattern && !new RegExp(pattern).test(value)) {
      errors.push(`${fieldName} does not match required pattern`);
    }
    const minLength = property.minLength as number | undefined;
    if (minLength !== undefined && value.length < minLength) {
      errors.push(`${fieldName} must have at least ${minLength} character(s)`);
    }
    const enumValues = property.enum as string[] | undefined;
    if (enumValues && !enumValues.includes(value)) {
      errors.push(`${fieldName} must be one of: ${enumValues.join(", ")}`);
    }
  }

  if (expectedType === "number") {
    if (typeof value !== "number") {
      errors.push(`${fieldName} must be a number`);
      return errors;
    }
    const minimum = property.minimum as number | undefined;
    if (minimum !== undefined && value < minimum) {
      errors.push(`${fieldName} must be >= ${minimum}`);
    }
  }

  return errors;
}

export function validateMessage(msg: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(msg)) {
    return { valid: false, errors: ["Message must be an object"] };
  }

  if (!("type" in msg) || typeof msg.type !== "string") {
    return { valid: false, errors: ["Missing or invalid 'type' field"] };
  }

  const schema = messageSchemas.get(msg.type);
  if (!schema) {
    return { valid: false, errors: [`Unknown message type: ${msg.type}`] };
  }

  const schemaRequired = schema.required;
  const schemaProperties = schema.properties;

  // Check required fields
  for (const field of schemaRequired) {
    if (!(field in msg) || msg[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate address fields
  if ("from" in msg) {
    const addrError = validateAddressFormat(msg.from, "from");
    if (addrError) errors.push(addrError);
  }

  if ("to" in msg && schemaProperties.to) {
    const addrError = validateAddressFormat(msg.to, "to");
    if (addrError) errors.push(addrError);
  }

  // Validate each present field against its schema property
  for (const [fieldName, propSchema] of Object.entries(schemaProperties)) {
    if (fieldName === "from" || fieldName === "to") continue; // Already validated above
    if (fieldName in msg && msg[fieldName] !== undefined) {
      errors.push(...validateSchemaProperty(msg[fieldName], propSchema as Record<string, unknown>, fieldName));
    }
  }

  return { valid: errors.length === 0, errors };
}
