import type { JsonSchema } from "@/editor/tools/types";
// build_hand_interior_room 의 «고친 곳만» 호출(edit) — 앞서 성공한 같은 mapId 짓기 인자에 덧붙이기·빼기·바꾸기를 얹어 전체 인자를 만든다.
//
// 왜(2026-10-22 실측): 1배 검토의 고치기·다듬기 바퀴마다 조수가 평면·가구 30~60개 전체 인자(2~5천 자)를 다시 써서 보냈다.
// 출력 토큰과 그 앞의 검산 생각이 바퀴 시간의 대부분이었다. 바뀐 칸만 보내면 같은 결과를 훨씬 짧게 낸다.
// 실행기(piAgentRuntime)와 편집기 패널(aiFeatureChecklist 의 lastBuilds)이 같은 함수로 합쳐 서로 어긋나지 않는다.

export interface HandInteriorEditRemove { readonly x: number; readonly y: number; readonly id?: string }

export interface HandInteriorEdit {
  /** 이 칸(발밑 왼쪽 위)에 놓인 가구·탁자·탁상 물건·단을 뺀다. id 를 주면 그 id 만. */
  readonly remove?: readonly HandInteriorEditRemove[];
  /** 이 id 의 깔개·울타리 줄(lines)을 통째로 뺀다. */
  readonly removeLines?: readonly string[];
  /** 덧붙인다(빼기 다음에). */
  readonly add?: {
    readonly objects?: readonly unknown[]; readonly tables?: readonly unknown[]; readonly lines?: readonly unknown[];
    readonly goods?: readonly unknown[]; readonly daises?: readonly unknown[]; readonly links?: readonly unknown[];
  };
  /** 통째로 바꿀 최상위 인자(plan·floor·wall·zones·ceiling·start·exitWidth·name…). */
  readonly set?: Readonly<Record<string, unknown>>;
}

const LISTS = ["objects", "tables", "goods", "daises"] as const;
const ADDABLE = ["objects", "tables", "lines", "goods", "daises", "links"] as const;
/** set 으로 바꿀 수 없는 키 — 다른 맵을 가리키거나 edit 를 겹치지 않게. */
const FIXED = new Set(["mapId", "edit", "replace"]);

const anchorOf = (entry: unknown): { x?: number; y?: number; id?: string } => {
  const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
  return { ...(typeof e.x === "number" ? { x: e.x } : {}), ...(typeof e.y === "number" ? { y: e.y } : {}),
    ...(typeof e.id === "string" ? { id: e.id } : typeof e.style === "string" ? { id: e.style } : {}) };
};

/** edit 를 base(같은 mapId 로 마지막에 성공한 짓기 인자)에 얹는다. 맞는 것이 없던 빼기는 missing 으로 알린다. */
export function applyHandInteriorEdit(base: Readonly<Record<string, unknown>>, edit: HandInteriorEdit): { args: Record<string, unknown>; missing: string[]; summary: string } {
  const args: Record<string, unknown> = { ...base };
  delete args.edit;
  const missing: string[] = [];
  let removed = 0, added = 0;
  for (const [key, value] of Object.entries(edit.set ?? {})) if (!FIXED.has(key)) args[key] = value;
  for (const r of edit.remove ?? []) {
    let hit = false;
    for (const key of LISTS) {
      const list = Array.isArray(args[key]) ? (args[key] as unknown[]) : [];
      const kept = list.filter((entry) => { const a = anchorOf(entry); const match = a.x === r.x && a.y === r.y && (!r.id || a.id === r.id); if (match) hit = true; return !match; });
      if (kept.length !== list.length) { removed += list.length - kept.length; args[key] = kept; }
    }
    if (!hit) missing.push(`(${r.x},${r.y})${r.id ? ` ${r.id}` : ""}`);
  }
  for (const id of edit.removeLines ?? []) {
    const list = Array.isArray(args.lines) ? (args.lines as unknown[]) : [];
    const kept = list.filter((entry) => anchorOf(entry).id !== id);
    if (kept.length === list.length) missing.push(`줄 ${id}`); else { removed += list.length - kept.length; args.lines = kept; }
  }
  for (const key of ADDABLE) {
    const more = edit.add?.[key];
    if (!more?.length) continue;
    args[key] = [...(Array.isArray(args[key]) ? (args[key] as unknown[]) : []), ...more];
    added += more.length;
  }
  args.mapId = base.mapId;
  args.replace = true;
  const changed = Object.keys(edit.set ?? {}).filter((k) => !FIXED.has(k));
  return { args, missing, summary: `고친 곳만: 빼기 ${removed} · 더하기 ${added}${changed.length ? ` · 바꿈 ${changed.join(",")}` : ""}${missing.length ? ` · 못 찾은 빼기 ${missing.join(" ")}` : ""}` };
}

/**
 * build_hand_interior_room 인자 스키마에 edit 를 붙인다 — 덧붙일 항목·바꿀 인자는 같은 도구의 스키마를 그대로 쓴다
 * (자유 키 객체는 Gemini 가 400 으로 거절한다).
 */
export function withHandInteriorEdit(properties: Record<string, JsonSchema>): Record<string, JsonSchema> {
  const p = properties;
  const pick = (keys: readonly string[]) => Object.fromEntries(keys.filter((k) => p[k]).map((k) => [k, p[k]]));
  return { ...properties, edit: {
    type: "object",
    description: "고친 곳만 보내기 — 이 실행에서 같은 mapId 로 성공한 마지막 짓기(다듬기면 「마지막 짓기 호출」) 인자에 얹는다. 고치기·다듬기에서는 mapId 와 edit 만 준다(plan·objects 전체를 다시 쓰지 않는다). "
      + "remove = 그 칸(발밑 왼쪽 위)의 가구·탁자·탁상 물건·단 빼기(id 를 주면 그 id 만), removeLines = 그 id 의 깔개·줄 빼기, add = 덧붙이기, set = 통째로 바꿀 인자(plan·floor·wall·zones…). 앞선 짓기가 없으면 거부한다.",
    properties: {
      remove: { type: "array", items: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, id: { type: "string" } }, required: ["x", "y"], additionalProperties: false } },
      removeLines: { type: "array", items: { type: "string" } },
      add: { type: "object", properties: pick(["objects", "tables", "lines", "goods", "daises", "links"]), additionalProperties: false },
      set: { type: "object", properties: pick(["plan", "floor", "wall", "ceiling", "zones", "start", "exitWidth", "name"]), additionalProperties: false },
    },
    additionalProperties: false,
  } as JsonSchema };
}
