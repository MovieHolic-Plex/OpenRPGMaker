// CCA's legacy Schema.enum is repeated string, even when type is INTEGER.
// Keep canonical JSON Schema numeric; repair only the SDK's normalized payload.
// Gemini drops numeric enums during normalization, so retain source membership first.
type RecordNode = Record<string, unknown>;
type EnumField = { tool: string; path: string[]; members: number[] };

function record(value: unknown): value is RecordNode {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export class ToolSchemaTransportError extends Error {
  readonly status = 400;
  readonly code = "tool-schema-transport";

  constructor(model: string, tool: string, path: readonly string[], detail: string) {
    super(`tool-schema-transport: google-antigravity/${model} tool=${tool} parameters.${path.join(".")}: ${detail}`);
    this.name = "ToolSchemaTransportError";
  }
}

/** Capture before complete(); return the post-normalization SDK onPayload hook. */
export function antigravityToolEnumPayload(
  model: string,
  tools: readonly { name: string; parameters: unknown }[],
): (payload: unknown) => unknown {
  const fields: EnumField[] = [];
  function collect(node: unknown, tool: string, path: string[]): void {
    if (!record(node)) return;
    const numericType = node.type === "integer" || node.type === "number"
      || (Array.isArray(node.type) && node.type.some(type => type === "integer" || type === "number"));
    if (Object.hasOwn(node, "enum") && (numericType || (Array.isArray(node.enum) && node.enum.some(value => typeof value === "number")))) {
      if (node.type !== "integer" || !Array.isArray(node.enum) || node.enum.length === 0
        || !node.enum.every(value => typeof value === "number" && Number.isSafeInteger(value))
        || new Set(node.enum).size !== node.enum.length) {
        throw new ToolSchemaTransportError(model, tool, path, "expected a nonempty integer enum of distinct safe integers");
      }
      fields.push({ tool, path, members: [...node.enum] });
    }
    // Walk schema slots, never instance data (enum/default/examples) or property names
    // as keywords. Unsupported structural translations are caught by exact path lookup.
    for (const key of ["properties", "$defs", "definitions", "patternProperties", "dependentSchemas"]) {
      const children = node[key];
      if (record(children)) for (const [name, child] of Object.entries(children)) collect(child, tool, [...path, key, name]);
    }
    for (const key of ["items", "additionalProperties", "contains", "not", "if", "then", "else", "anyOf", "oneOf", "allOf", "prefixItems"]) {
      const children = node[key];
      if (Array.isArray(children)) children.forEach((child, index) => collect(child, tool, [...path, key, String(index)]));
      else collect(children, tool, [...path, key]);
    }
  }
  for (const tool of tools) collect(tool.parameters, tool.name, []);

  return (payload) => {
    if (fields.length === 0) return payload;
    // Clone before any edit; errors cannot leak a partially rewritten payload.
    const copy: unknown = structuredClone(payload);
    const groups = record(copy) && record(copy.request) ? copy.request.tools : undefined;
    const declarations = Array.isArray(groups) ? groups.flatMap(group =>
      record(group) && Array.isArray(group.functionDeclarations) ? group.functionDeclarations : []) : [];
    for (const field of fields) {
      const fail = (detail: string): never => {
        throw new ToolSchemaTransportError(model, field.tool, field.path, detail);
      };
      const matches = declarations.filter(declaration => record(declaration) && declaration.name === field.tool);
      if (matches.length !== 1) fail("enum-bearing tool is missing or ambiguous after normalization");
      const declaration = matches[0] as RecordNode;
      // This hook is NOT a JSON Schema encoder. Leave non-legacy dialects alone.
      if (!Object.hasOwn(declaration, "parameters") && Object.hasOwn(declaration, "parametersJsonSchema")) continue;
      let node = declaration.parameters;
      for (const key of field.path) {
        if ((!record(node) && !Array.isArray(node)) || !Object.hasOwn(node, key)) fail("enum-bearing field was lost during normalization");
        node = (node as RecordNode)[key];
      }
      if (!record(node) || typeof node.type !== "string" || node.type.toLowerCase() !== "integer") {
        fail("enum-bearing field changed type during normalization");
      }
      const schema = node as RecordNode;
      const encoded = field.members.map(String);
      if (Object.hasOwn(schema, "enum")) {
        const current = schema.enum;
        if (!Array.isArray(current) || current.length !== encoded.length
          || !(current.every(value => typeof value === "number") || current.every(value => typeof value === "string"))
          || new Set<string | number>(current).size !== current.length
          || current.some(value => !encoded.includes(String(value)))) {
          fail("enum membership changed during normalization");
        }
      }
      // Absent on Gemini, numeric on Claude, already encoded on repeated invocation.
      schema.enum = encoded;
    }
    return copy;
  };
}
