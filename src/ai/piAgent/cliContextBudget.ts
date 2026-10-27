// 로컬 CLI 엔진(Claude Code·Codex·Gemini CLI)의 문맥 아끼기 — J79(2026-10-26 hf2-school-claude-j70 2턴).
//
// 실측: v2 도구 88개 목록이 24만 자(한국어 설명이 대부분 — 토큰으로 약 16만)라 2턴 첫 요청부터 Claude 문맥 20만의 80%가 찼고,
// 도구 23번 만에 「Autocompact is thrashing」으로 끝났다. 그 글이 «최종 보고»로 남았다.
//  1) 목록: 깊은 칸(둘째 단계 아래)의 설명을 걷고, 앞 도구와 글자까지 같은 큰 하위 스키마(Command·페이지 묶음)는 «앞의 그 칸과 같다» 한 줄로 바꾼다.
//     실행 검증은 원래 스키마로 한다(실행기 argRepair) — 목록만 가볍게 한다. Gemini 경로(API)에는 쓰지 않는다(선언 안 된 칸을 안 보낸다).
//  2) 결과: 그림을 여러 장 돌려주는 짓기 동사는 첫 장만 보낸다.
//  3) CLI 가 문맥 한도 오류를 «답»으로 돌려주면 보고가 아니라 실패로 본다 — 실행기가 세션을 비우고 한 번 이어 한다.

type Json = unknown;
const isObj = (v: Json): v is Record<string, Json> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * JSON 스키마를 «스키마 자리»만 골라 걷는다(J79b: 처음 판은 properties 지도·default·enum 같은 스키마가 아닌 자리까지 걸어
 * 같은 큰 properties 지도가 두 번 나오면 그 지도를 {type, description} 으로 바꿀 수 있었다 — 틀린 스키마 하나가 요청 전체를 400 으로 막는다).
 */
const MAP_KEYS = new Set(["properties", "$defs", "definitions", "patternProperties", "dependentSchemas"]);
const ONE_KEYS = new Set(["items", "additionalProperties", "not", "if", "then", "else", "contains", "propertyNames", "unevaluatedItems", "unevaluatedProperties", "additionalItems"]);
const LIST_KEYS = new Set(["anyOf", "oneOf", "allOf", "prefixItems"]);
/** 이만큼 넘는 하위 스키마가 앞 도구와 같으면 한 줄로 바꾼다. */
const SHARED_MIN = 3000;

type Visit = (schema: Record<string, Json>, depth: number, path: string) => Json | undefined;
type Drop = (key: string, value: Json, depth: number) => boolean;
/** 스키마 하나를 걷는다. visit 가 값을 돌려주면 그 자리를 그것으로 바꾸고 안으로 들어가지 않는다. drop 이 참인 제 칸은 뺀다. */
function walkSchema(schema: Json, depth: number, path: string, visit: Visit, drop?: Drop): Json {
  if (!isObj(schema)) return schema;
  const replaced = visit(schema, depth, path);
  if (replaced !== undefined) return replaced;
  const out: Record<string, Json> = {};
  const sub = (v: Json, d: number, p: string): Json => walkSchema(v, d, p, visit, drop);
  for (const [k, v] of Object.entries(schema)) {
    if (drop?.(k, v, depth)) continue;
    if (MAP_KEYS.has(k) && isObj(v)) out[k] = Object.fromEntries(Object.entries(v).map(([name, s]) => [name, sub(s, depth + 1, `${path ? `${path}.` : ""}${name}`)]));
    else if (ONE_KEYS.has(k) && isObj(v)) out[k] = sub(v, depth + 1, `${path}${k === "items" ? "[]" : `.${k}`}`);
    else if (ONE_KEYS.has(k) && Array.isArray(v)) out[k] = v.map((s, i) => sub(s, depth + 1, `${path}[${i}]`));
    else if (LIST_KEYS.has(k) && Array.isArray(v)) out[k] = v.map((s, i) => sub(s, depth, `${path}<${i}>`));
    else out[k] = v; // default·enum·const·examples·required 같은 값 자리는 손대지 않는다.
  }
  return out;
}

/** 깊은 칸(둘째 단계 아래)의 설명 글을 걷는다. 스키마의 description 만 — 이름이 description 인 칸(properties 의 열쇠)은 그대로. */
const stripDeep = (schema: Json): Json => walkSchema(schema, 0, "", () => undefined, (key, value, depth) => key === "description" && typeof value === "string" && depth >= 2);

/** CLI 에 보이는 도구 목록을 가볍게 한다. 도구 순서대로 걸으며 같은 큰 하위 스키마는 처음 나온 도구만 온전히 싣는다. */
export function compactCliToolList<T extends { readonly name: string; readonly description: string; readonly inputSchema: unknown }>(list: readonly T[]): T[] {
  const seen = new Map<string, string>();
  return list.map((tool) => {
    const light = stripDeep(tool.inputSchema);
    const shared = walkSchema(light, 0, "", (node, depth, path) => {
      if (depth === 0) return undefined;
      const text = JSON.stringify(node);
      if (text.length < SHARED_MIN) return undefined;
      const first = seen.get(text);
      if (first === undefined) { seen.set(text, `${tool.name} 도구의 ${path}`); return undefined; }
      return { ...(node.type !== undefined ? { type: node.type } : {}), description: `형식은 ${first} 칸과 같다(그 도구 목록의 그 칸을 본다)` };
    });
    // 걸은 결과가 스키마 꼴을 잃었으면(있어서는 안 되지만) 그 도구만 원래 스키마로 보낸다 — 틀린 목록 하나가 요청 전체를 400 으로 막는다.
    return { ...tool, inputSchema: schemaShapeProblem(shared) ? tool.inputSchema : shared };
  });
}

/** 스키마 꼴 검사(가벼운 것만): properties 값·items·anyOf 원소가 스키마(객체·참거짓)인가, type·required 가 맞는 꼴인가. 문제 자리를 돌려준다. */
export function schemaShapeProblem(schema: Json, path = ""): string | undefined {
  if (typeof schema === "boolean") return undefined;
  if (!isObj(schema)) return path || "(뿌리)";
  if (schema.type !== undefined && typeof schema.type !== "string" && !(Array.isArray(schema.type) && schema.type.every((t) => typeof t === "string"))) return `${path}.type`;
  if (schema.required !== undefined && !(Array.isArray(schema.required) && schema.required.every((r) => typeof r === "string"))) return `${path}.required`;
  for (const [k, v] of Object.entries(schema)) {
    if (MAP_KEYS.has(k)) {
      if (!isObj(v)) return `${path}.${k}`;
      for (const [name, sub] of Object.entries(v)) { const bad = schemaShapeProblem(sub, `${path}.${k}.${name}`); if (bad) return bad; }
    } else if (ONE_KEYS.has(k)) {
      const subs = Array.isArray(v) ? v : [v];
      for (const [i, sub] of subs.entries()) { const bad = schemaShapeProblem(sub, `${path}.${k}${Array.isArray(v) ? `[${i}]` : ""}`); if (bad) return bad; }
    } else if (LIST_KEYS.has(k)) {
      if (!Array.isArray(v)) return `${path}.${k}`;
      for (const [i, sub] of v.entries()) { const bad = schemaShapeProblem(sub, `${path}.${k}[${i}]`); if (bad) return bad; }
    }
  }
  return undefined;
}

/** 그림을 여러 장 돌려주는 짓기 동사 — CLI 에는 첫 장만 보낸다(관문이 그림 수를 세는 도구는 넣지 않는다). */
const MULTI_IMAGE_VERBS = new Set(["add_event", "make_place", "edit_place", "move_object", "add_scene", "make_game", "inspect"]);
export function capResultImages<P extends { readonly type: string; readonly text?: string }>(toolName: string, content: readonly P[]): P[] {
  const images = content.filter((part) => part.type === "image").length;
  if (images <= 1 || !MULTI_IMAGE_VERBS.has(toolName)) return [...content];
  let kept = 0;
  const out = content.filter((part) => part.type !== "image" || kept++ === 0);
  return [...out, { type: "text", text: `(그림 ${images}장 중 첫 장만 보냈다 — 문맥을 아끼려고. 다른 장은 inspect 로 맵을 다시 본다)` } as unknown as P];
}

/** CLI 가 문맥 한도로 멈추고 그 사정을 답 글로 돌려준 것인가. */
const CLI_CONTEXT_EXHAUSTED = /^\s*(?:Autocompact is thrashing|Prompt is too long|Context (?:window|limit) (?:exceeded|reached)|Conversation too long|input length and `max_tokens` exceed context limit)/iu;
export const CLI_CONTEXT_EXHAUSTED_PREFIX = "[CLI 문맥 한도]";
export function isCliContextExhaustedText(text: string): boolean {
  return CLI_CONTEXT_EXHAUSTED.test(text);
}
/** CLI 가 제공자 오류(「API Error: 400 Invalid request…」)를 답 글로 돌려준 것인가 — 보고가 아니라 실패다(J79b). */
const CLI_API_ERROR = /^\s*API Error:\s*\d{3}\b/u;
export function isCliApiErrorText(text: string): boolean {
  return CLI_API_ERROR.test(text);
}
export function isCliContextExhaustedError(message: string | undefined): boolean {
  return !!message && message.startsWith(CLI_CONTEXT_EXHAUSTED_PREFIX);
}
