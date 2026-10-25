// 조수 v2 — 한 요청에 싣는 도구 스키마에서 같은 큰 덩어리의 «설명»을 한 번만 보낸다.
//
// 왜 (2026-10-25 조수 단독 게임 G12/G14 후속): 연애 게임 대화 요청 한 턴의 도구 56개 스키마가 21만 자였다(시스템 지시 1.7만 자,
// 읽기 결과 전부 4.3만 자). 그중 18.7만 자가 parameters 이고, 대부분은 같은 Command·페이지·조건 스키마가 도구마다(place_npc·upsert_event·
// define_ending·upsert_troop_battle_page·upsert_common_event·upsert_skill…) 설명까지 통째로 반복된 것이다. 제공자는 이 목록을 매 턴 다시 받는다
// (9턴 = 입력 71만 토큰, 대부분 캐시).
//
// 하는 일: 도구 순서대로 걸으며 큰 하위 스키마(≥ MIN 자)가 앞에서 이미 나온 것과 글자까지 같으면, 그 사본에서 description 만 걷는다.
// 필드 이름·형·enum·required 는 그대로 둔다 — Gemini 는 선언 안 된 필드를 보내지 않으므로 구조를 줄이면 안 된다(schemaShapes.withoutDescriptions 와 같은 원칙).
// 걷은 자리에는 «설명은 <처음 나온 도구> 의 같은 칸» 한 줄을 남긴다. 원본 도구 객체는 바꾸지 않는다(도구 목록은 실행 사이에 캐시된다).
const MIN = 1500;

type Json = unknown;
const isObj = (v: Json): v is Record<string, Json> => !!v && typeof v === "object" && !Array.isArray(v);

function strip(value: Json): Json {
  if (Array.isArray(value)) return value.map(strip);
  if (!isObj(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => k !== "description").map(([k, v]) => [k, strip(v)]));
}

export interface SchemaDedupeStats { readonly before: number; readonly after: number }

export function dedupeToolSchemas<T extends { readonly name: string; readonly parameters?: unknown }>(tools: readonly T[], stats?: { before: number; after: number }): T[] {
  const seen = new Map<string, string>(); // 설명 포함 덩어리 → 처음 나온 도구 이름
  const visit = (node: Json, owner: string): Json => {
    if (Array.isArray(node)) return node.map((n) => visit(n, owner));
    if (!isObj(node)) return node;
    const text = JSON.stringify(node);
    if (text.length >= MIN && text.includes("\"description\"")) {
      // 설명만 다른 같은 구조도 같은 것으로 본다(도구마다 한두 줄 설명을 바꿔 붙인 Command·페이지 스키마).
      const key = JSON.stringify(strip(node));
      const first = seen.get(key);
      if (first !== undefined) {
        const bare = strip(node) as Record<string, Json>;
        return { ...bare, description: `형식은 위와 같다 — 칸 설명은 ${first} 의 같은 칸에 있다` };
      }
      seen.set(key, owner);
    }
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, visit(v, owner)]));
  };
  return tools.map((tool) => {
    if (tool.parameters === undefined) return tool;
    const parameters = visit(tool.parameters, tool.name);
    if (stats) { stats.before += JSON.stringify(tool.parameters).length; stats.after += JSON.stringify(parameters).length; }
    return { ...tool, parameters } as T;
  });
}
