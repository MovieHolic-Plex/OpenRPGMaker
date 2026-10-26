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

const NESTING_KEYS = new Set(["properties", "items", "anyOf", "oneOf", "allOf", "additionalProperties", "$defs", "definitions"]);
/** 이만큼 넘는 하위 스키마가 앞 도구와 같으면 한 줄로 바꾼다. */
const SHARED_MIN = 3000;

function stripDeepDescriptions(node: Json, depth: number): Json {
  if (Array.isArray(node)) return node.map((n) => stripDeepDescriptions(n, depth));
  if (!isObj(node)) return node;
  return Object.fromEntries(Object.entries(node)
    .filter(([k, v]) => !(k === "description" && typeof v === "string" && depth >= 2))
    .map(([k, v]) => [k, stripDeepDescriptions(v, NESTING_KEYS.has(k) ? depth + 1 : depth)]));
}

/** CLI 에 보이는 도구 목록을 가볍게 한다. 도구 순서대로 걸으며 같은 큰 하위 스키마는 처음 나온 도구만 온전히 싣는다. */
export function compactCliToolList<T extends { readonly name: string; readonly description: string; readonly inputSchema: unknown }>(list: readonly T[]): T[] {
  const seen = new Map<string, string>();
  const share = (node: Json, owner: string, path: string): Json => {
    if (Array.isArray(node)) return node.map((n, i) => share(n, owner, `${path}[${i}]`));
    if (!isObj(node)) return node;
    const text = JSON.stringify(node);
    if (text.length >= SHARED_MIN && path) {
      const first = seen.get(text);
      if (first !== undefined) {
        const type = node.type ?? (node.items ? "array" : "object");
        return { type, description: `형식은 ${first} 칸과 같다(그 도구 목록의 그 칸을 본다)` };
      }
      seen.set(text, `${owner} 도구의 ${path}`);
    }
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, share(v, owner, path ? `${path}.${k}` : k)]));
  };
  return list.map((tool) => ({ ...tool, inputSchema: share(stripDeepDescriptions(tool.inputSchema, 0), tool.name, "") }));
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
export function isCliContextExhaustedError(message: string | undefined): boolean {
  return !!message && message.startsWith(CLI_CONTEXT_EXHAUSTED_PREFIX);
}
