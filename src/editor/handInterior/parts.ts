// 손 도트 실내 v5 부품 찾기 — list_hand_interior_parts 의 검색·방 종류 묶음(모델 없이 테스트할 수 있게 순수 함수로 둔다).
//   검색: id·이름·분류·태그·설명·놓는 곳·종류 낱말을 모두 본다. 여러 낱말이면 모든 낱말이 맞는 것이 먼저.
//   방: 예제 26맵을 방 단위로 나눈 표(spec.rooms)에서 그 방 종류(또는 건물)에 쓰인 가구를 종류(바닥·벽 앞·걸이·무늬·탁자·줄·단)별로 센다.
import { HAND_INTERIOR_SPEC, type HandInteriorSpec } from "./builder";

type Obj = HandInteriorSpec["objects"][string];

/** 종류 id → 검색에 쓰는 낱말(한국어·영어). */
const KIND_WORDS: Record<string, string> = {
  floor: "floor 바닥 가구 막힘",
  wall: "wall 벽 앞 북쪽 벽 가구",
  hang: "hang 벽 벽면 걸이",
  flat: "flat 바닥 무늬 깔개 밟음",
};

export interface PartRow {
  readonly id: string; readonly ko: string; readonly kind: string; readonly w: number; readonly h: number;
  readonly desc?: string; readonly overhangPx?: number; readonly tags?: readonly string[]; readonly place?: string; readonly pair?: readonly string[];
  readonly surface?: true; readonly stairs?: string; readonly animated?: true; readonly hit?: string;
}

function norm(s: string): string { return s.toLocaleLowerCase().normalize("NFC"); }

/** 한 소품에서 찾을 글(가중치별). */
function fields(id: string, o: Obj): readonly (readonly [string, number])[] {
  return [
    [norm(id), 4], [norm(o.ko), 4], [norm(`${o.category} ${o.category_ko}`), 2], [norm((o.tags ?? []).join(" | ")), 2],
    [norm(KIND_WORDS[o.kind] ?? o.kind), 1], [norm(`${o.desc ?? ""} ${o.place ?? ""}`), 1],
  ];
}

export function fullRow(id: string, o: Obj, hit?: string): PartRow {
  return { id, ko: o.ko, kind: o.kind, w: o.w, h: o.h, ...(o.up ? { overhangPx: o.up } : {}), ...(o.desc ? { desc: o.desc } : {}),
    ...(o.tags?.length ? { tags: o.tags } : {}), ...(o.place ? { place: o.place } : {}), ...(o.pair?.length ? { pair: o.pair } : {}),
    ...(o.surface ? { surface: true as const } : {}), ...(o.stairs ? { stairs: o.stairs } : {}), ...(o.animated ? { animated: true as const } : {}),
    ...(hit ? { hit } : {}) };
}
export function shortRow(id: string, o: Obj, hit?: string): PartRow {
  return { id, ko: o.ko, kind: o.kind, w: o.w, h: o.h, ...(o.desc ? { desc: o.desc } : {}), ...(hit ? { hit } : {}) };
}

export interface SearchResult {
  /** 모든 낱말이 맞는 것이 있으면 그것만, 없으면 가장 많이 맞는 것부터. */
  readonly ids: readonly string[]; readonly hits: ReadonlyMap<string, number>; readonly tokens: readonly string[];
  readonly allMatch: number; readonly partial: number;
}

const POPULARITY = new WeakMap<HandInteriorSpec, Map<string, number>>();
/** 예제 방에서 쓰인 방 수 — 같은 점수면 실제로 자주 쓰인 가구가 먼저. */
function popularity(spec: HandInteriorSpec): Map<string, number> {
  let m = POPULARITY.get(spec);
  if (!m) {
    m = new Map();
    for (const [, , , items] of spec.rooms?.examples ?? []) for (const [id] of items) m.set(id, (m.get(id) ?? 0) + 1);
    POPULARITY.set(spec, m);
  }
  return m;
}

/** 낱말 검색. 모든 낱말이 맞는 것 → (없으면) 더 많은 낱말이 맞는 것, 그 안에서 가중 점수 → 예제 사용 방 수 순. */
export function searchParts(query: string, category = "", spec: HandInteriorSpec = HAND_INTERIOR_SPEC): SearchResult {
  const tokens = [...new Set(norm(query).split(/[\s,·/]+/).filter(Boolean))];
  const scored: { id: string; hit: number; score: number }[] = [];
  for (const [id, o] of Object.entries(spec.objects)) {
    if (category && o.category !== category) continue;
    if (!tokens.length) { scored.push({ id, hit: 0, score: 0 }); continue; }
    const fs = fields(id, o);
    let hit = 0, score = 0;
    for (const t of tokens) {
      let best = 0;
      for (const [text, w] of fs) if (text.includes(t)) best = Math.max(best, w);
      if ((o.tags ?? []).some((tag) => norm(tag) === t)) best = Math.max(best, 3); // 태그와 똑같으면(빵집 = 빵집) 「빵집 가게」 같은 방 태그보다 먼저
      if (best) { hit++; score += best; }
    }
    if (hit) scored.push({ id, hit, score });
  }
  const pop = popularity(spec);
  scored.sort((a, b) => b.hit - a.hit || b.score - a.score || (pop.get(b.id) ?? 0) - (pop.get(a.id) ?? 0) || a.id.localeCompare(b.id));
  const hits = new Map(scored.map((s) => [s.id, s.hit]));
  const all = tokens.length ? scored.filter((s) => s.hit === tokens.length) : scored;
  const ids = (all.length ? all : scored).map((s) => s.id);
  return { ids, hits, tokens, allMatch: all.length, partial: scored.length - all.length };
}

export type RoomGroupKind = "floor" | "wall" | "hang" | "flat" | "table" | "line" | "dais";
export interface RoomPart { readonly id: string; readonly ko: string; readonly w?: number; readonly h?: number; readonly rooms: number; readonly count: number; readonly desc?: string }
export interface RoomResult {
  readonly key: string; readonly ko: string; readonly mode: "room" | "building";
  /** 예제 참고문서 id(read_tileset_reference 의 documentId 그대로, 예: hand-interior-v5-map-bakery). */
  readonly exampleDocs: readonly string[];
  readonly roomCount: number;
  readonly groups: Partial<Record<RoomGroupKind, readonly RoomPart[]>>;
  /** 건물이면 방마다 가구 목록(한 줄). */
  readonly rooms?: readonly { readonly room: string; readonly ko: string; readonly items: string }[];
  /** 예제에는 없지만 태그가 맞는 소품(짧은 행). */
  readonly alsoTagged?: readonly PartRow[];
}

function groupOf(id: string, spec: HandInteriorSpec): RoomGroupKind | null {
  const o = spec.objects[id];
  if (o) return o.kind;
  if (id.startsWith("dais")) return "dais";
  if (spec.lines[id]) return "line";
  if (spec.tables[id.split(" ")[0]!]) return "table";
  return null;
}

/** room 인자 → 방 종류 key 또는 건물 id. 방 종류 key·건물 id·방 이름·건물 이름·찾는 말 순. */
export function resolveRoom(q: string, spec: HandInteriorSpec = HAND_INTERIOR_SPEC): { mode: "room" | "building"; key: string } | { mode: "alias"; keys: string[] } | null {
  const t = spec.rooms; if (!t) return null;
  const n = norm(q.trim()); if (!n) return null;
  if (t.kinds[n]) return { mode: "room", key: n };
  if (t.buildings[n]) return { mode: "building", key: n };
  for (const [k, v] of Object.entries(t.kinds)) if (norm(v.ko) === n || norm(v.ko).split("·").includes(n)) return { mode: "room", key: k };
  for (const [b, name] of Object.entries(t.buildings)) { const short = norm(name.split(" — ")[0]!); if (short === n || short.endsWith(` ${n}`) || short.startsWith(`${n} `)) return { mode: "building", key: b }; }
  const keys = Object.entries(t.kinds).filter(([, v]) => v.alias.some((a) => norm(a) === n || norm(a).includes(n) || n.includes(norm(a)))).map(([k]) => k);
  if (keys.length) return { mode: "alias", keys };
  for (const [k, v] of Object.entries(t.kinds)) if (norm(v.ko).includes(n)) return { mode: "room", key: k };
  return null;
}

export function roomParts(q: string, perGroup = 12, spec: HandInteriorSpec = HAND_INTERIOR_SPEC): RoomResult | null {
  const t = spec.rooms; if (!t) return null;
  const r = resolveRoom(q, spec); if (!r) return null;
  const roomKeys = r.mode === "alias" ? r.keys : r.mode === "room" ? [r.key] : null;
  const rows = t.examples.filter(([, b, room]) => (roomKeys ? roomKeys.includes(room) : b === (r as { key: string }).key));
  const use = new Map<string, { rooms: number; count: number }>();
  const maps: string[] = [];
  for (const [mapId, , , items] of rows) {
    if (!maps.includes(mapId)) maps.push(mapId);
    for (const [id, n] of items) { const u = use.get(id) ?? { rooms: 0, count: 0 }; u.rooms++; u.count += n; use.set(id, u); }
  }
  const groups: Partial<Record<RoomGroupKind, RoomPart[]>> = {};
  const sorted = [...use].sort((a, b) => b[1].rooms - a[1].rooms || b[1].count - a[1].count || a[0].localeCompare(b[0]));
  for (const [id, u] of sorted) {
    const g = groupOf(id, spec); if (!g) continue;
    const list = (groups[g] ??= []);
    if (list.length >= perGroup) continue;
    const o = spec.objects[id];
    list.push({ id, ko: o?.ko ?? spec.lines[id]?.ko ?? spec.tables[id.split(" ")[0]!]?.ko ?? id, ...(o ? { w: o.w, h: o.h } : {}), rooms: u.rooms, count: u.count, ...(o?.desc ? { desc: o.desc } : {}) });
  }
  // 예제에 없는 소품 중 태그가 이 방 이름·찾는 말과 맞는 것
  const words = new Set<string>();
  if (roomKeys) for (const k of roomKeys) { words.add(t.kinds[k]!.ko); for (const a of t.kinds[k]!.alias) words.add(a); }
  else words.add(t.buildings[(r as { key: string }).key]!.split(" — ")[0]!);
  const alsoTagged = Object.entries(spec.objects)
    .filter(([id, o]) => !use.has(id) && (o.tags ?? []).some((tag) => [...words].some((w) => tag === w || tag.includes(w))))
    .slice(0, perGroup).map(([id, o]) => shortRow(id, o));
  const key = r.mode === "alias" ? r.keys.join("+") : r.key;
  const ko = r.mode === "building" ? t.buildings[r.key]!.split(" — ")[0]! : (roomKeys ?? []).map((k) => t.kinds[k]!.ko).join(" + ");
  return {
    key, ko, mode: r.mode === "building" ? "building" : "room", exampleDocs: maps.map((m) => `hand-interior-v5-map-${m}`), roomCount: rows.length, groups,
    ...(r.mode === "building" ? { rooms: rows.map(([, , room, items]) => ({ room, ko: t.kinds[room]?.ko ?? room, items: items.map(([id, n]) => (n > 1 ? `${id}×${n}` : id)).join(", ") })) } : {}),
    ...(alsoTagged.length ? { alsoTagged } : {}),
  };
}

/** 방 종류·건물 목록(인자 없는 호출에 싣는 한 줄 표). */
export function roomIndex(spec: HandInteriorSpec = HAND_INTERIOR_SPEC): { rooms: string; buildings: string } {
  const t = spec.rooms;
  if (!t) return { rooms: "", buildings: "" };
  const used = new Set(t.examples.map((e) => e[2]));
  return {
    rooms: Object.entries(t.kinds).filter(([k]) => used.has(k)).map(([k, v]) => `${k}=${v.ko}`).join(", "),
    buildings: Object.entries(t.buildings).map(([k, v]) => `${k}=${v.split(" — ")[0]}`).join(", "),
  };
}
