// CCA's legacy Schema.enum is repeated string, even when type is INTEGER.
// Keep canonical JSON Schema numeric; repair only the SDK's normalized payload.
// Gemini drops numeric enums during normalization, so retain source membership first.
type RecordNode = Record<string, unknown>;
type EnumField = { readonly tool: string; readonly path: readonly string[]; readonly members: readonly number[]; readonly nullable: boolean };

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

/** Capture before complete(); return the post-normalization SDK onPayload hook.
 * `tools` 는 요청마다 다시 걷는다 — Pi 에스컬레이션이 실행 중 툴을 덧붙이므로,
 * 캡처 시점 스냅샷이면 늦게 승격된 정수-enum 툴이 우회를 못 받는다(실측 계약은 요청 페이로드다). */
export function antigravityToolEnumPayload(
  model: string,
  tools: readonly { name: string; parameters: unknown }[],
): (payload: unknown) => unknown {
  function collect(node: unknown, tool: string, path: string[], fields: EnumField[]): void {
    if (!record(node)) return;
    const numericType = node.type === "integer" || node.type === "number"
      || (Array.isArray(node.type) && node.type.some(type => type === "integer" || type === "number"));
    if (Object.hasOwn(node, "enum") && (numericType || (Array.isArray(node.enum) && node.enum.some(value => typeof value === "number")))) {
      const nullable = Array.isArray(node.type) && node.type.length === 2
        && node.type.includes("integer") && node.type.includes("null") && Array.isArray(node.enum) && node.enum.includes(null);
      const members = Array.isArray(node.enum) ? node.enum.filter(value => value !== null) : [];
      if ((!nullable && node.type !== "integer") || !Array.isArray(node.enum) || members.length === 0
        || !node.enum.every(value => nullable && value === null || typeof value === "number" && Number.isSafeInteger(value))
        || new Set(node.enum).size !== node.enum.length) {
        throw new ToolSchemaTransportError(model, tool, path, "expected a nonempty integer enum of distinct safe integers");
      }
      fields.push({ tool, path, members: members as number[], nullable });
    }
    // Walk schema slots, never instance data (enum/default/examples) or property names
    // as keywords. Unsupported structural translations are caught by exact path lookup.
    for (const key of ["properties", "$defs", "definitions", "patternProperties", "dependentSchemas"]) {
      const children = node[key];
      if (record(children)) for (const [name, child] of Object.entries(children)) collect(child, tool, [...path, key, name], fields);
    }
    for (const key of ["items", "additionalProperties", "contains", "not", "if", "then", "else", "anyOf", "oneOf", "allOf", "prefixItems"]) {
      const children = node[key];
      if (Array.isArray(children)) children.forEach((child, index) => collect(child, tool, [...path, key, String(index)], fields));
      else collect(children, tool, [...path, key], fields);
    }
  }

  // 캡처 시점 검증은 유지한다 — 초기 노출의 깨진 enum 은 첫 fetch 전에 실패해야 한다(기존 계약).
  for (const tool of tools) collect(tool.parameters, tool.name, [], []);

  return (payload) => stripEmptyEnumMembers(encodeNumericEnums(payload));

  function encodeNumericEnums(payload: unknown): unknown {
    const fields: EnumField[] = [];
    for (const tool of tools) collect(tool.parameters, tool.name, [], fields);
    if (fields.length === 0) return payload;
    // Clone before any edit; errors cannot leak a partially rewritten payload.
    const copy: unknown = structuredClone(payload);
    const groups = record(copy) && record(copy.request) ? copy.request.tools : undefined;
    const declarations = Array.isArray(groups) ? groups.flatMap(group =>
      record(group) && Array.isArray(group.functionDeclarations) ? group.functionDeclarations : []) : [];
    for (const field of fields) {
      function fail(detail: string): never {
        throw new ToolSchemaTransportError(model, field.tool, field.path, detail);
      }
      const matches = declarations.filter((declaration): declaration is RecordNode => record(declaration) && declaration.name === field.tool);
      if (matches.length !== 1) fail("enum-bearing tool is missing or ambiguous after normalization");
      const declaration = matches[0];
      // This hook is NOT a JSON Schema encoder. Leave non-legacy dialects alone.
      if (!Object.hasOwn(declaration, "parameters") && Object.hasOwn(declaration, "parametersJsonSchema")) continue;
      let node = declaration.parameters;
      for (const key of field.path) {
        if ((!record(node) && !Array.isArray(node)) || !Object.hasOwn(node, key)) fail("enum-bearing field was lost during normalization");
        node = Array.isArray(node) ? node[Number(key)] : node[key];
      }
      if (!record(node) || typeof node.type !== "string" || node.type.toLowerCase() !== "integer") {
        fail("enum-bearing field changed type during normalization");
      }
      const schema = node;
      if (field.nullable) {
        if (Object.hasOwn(schema, "nullable") && schema.nullable !== true) fail("optional integer enum changed null omission semantics during normalization");
        schema.nullable = true;
      }
      const encoded = field.members.map(String);
      if (Object.hasOwn(schema, "enum")) {
        const raw = schema.enum;
        const current = field.nullable && Array.isArray(raw) ? raw.filter(value => value !== null) : raw;
        if (!Array.isArray(raw) || new Set(raw).size !== raw.length || !Array.isArray(current) || current.length !== encoded.length
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
  }
}

/** CCA 는 enum 안의 빈 문자열을 `enum[0]: cannot be empty` 로 거부하고 요청 전체를 400 으로 죽인다
 * (2026-10-05 실측: set_project_settings.fonts 한 칸 때문에 그 도구를 받은 시공 담당이 매 턴 0툴콜로 끝났다).
 * 원천 계약은 test/toolSchemaProviderCompat.test.ts 가 막는다. 여기서는 새어 나온 스키마 하나가 조수 전체를
 * 멈추지 않게 빈 멤버만 뺀다 — CCA 로는 어차피 보낼 수 없는 값이고, 나머지 바이트는 건드리지 않는다.
 * 멤버가 하나도 안 남는 enum(동적 목록이 빈 경우 포함)은 enum 키를 지워 자유 문자열로 둔다 — 실행기가 값을 검사한다. */
export function stripEmptyEnumMembers(payload: unknown): unknown {
  const schemas = (root: unknown): RecordNode[] => {
    const groups = record(root) && record(root.request) ? root.request.tools : undefined;
    if (!Array.isArray(groups)) return [];
    return groups.flatMap(group => record(group) && Array.isArray(group.functionDeclarations) ? group.functionDeclarations : [])
      // parametersJsonSchema 는 JSON Schema 방언이라 이 규칙의 대상이 아니다.
      .flatMap(declaration => record(declaration) && record(declaration.parameters) ? [declaration.parameters] : []);
  };
  // 레거시 Schema 의 스키마 자리만 걷는다 — enum/default 같은 인스턴스 값은 키워드로 보지 않는다.
  const visit = (node: unknown, onEnum: (schema: RecordNode) => void): void => {
    if (!record(node)) return;
    if (Array.isArray(node.enum) && (node.enum.length === 0 || node.enum.includes(""))) onEnum(node);
    if (record(node.properties)) for (const child of Object.values(node.properties)) visit(child, onEnum);
    visit(node.items, onEnum);
    if (Array.isArray(node.anyOf)) for (const child of node.anyOf) visit(child, onEnum);
  };
  let found = false;
  for (const schema of schemas(payload)) visit(schema, () => { found = true; });
  if (!found) return payload;
  const copy: unknown = structuredClone(payload);
  for (const schema of schemas(copy)) visit(schema, node => {
    const members = (node.enum as unknown[]).filter(value => value !== "");
    if (members.length > 0) node.enum = members;
    else delete node.enum;
  });
  return copy;
}
