// 칩셋 목록 카드 생성기 — 손 목록 없이 칩셋 메타데이터(roomKit 역할표 · 예제 방 표 · 조립 킷 기물)만으로 영어 목록을 만든다.
//
// 왜(2026-10-31, agent/bbox-chipsets scripts/experiments/bbox-chipsets/catalog.mts·spec.mts): roomKit 이 있는 칩셋이면 어느 것이든
// 같은 칸 배치 길로 지을 수 있게. 요청 낱말이 맞는 방 종류(spec.rooms.kinds 의 이름·별칭)의 예제 표 기물을 «이 장소에 맞는 것»으로 먼저,
// 그다음 낱말 검색(searchParts) 결과를, 그다음 칩셋 전체 목록(종류별)을 싣는다. 목록 글은 영어 id·크기·놓는 규칙뿐이다.
import { roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { searchParts } from "@/editor/handInterior/parts";
import { kitHandObjects } from "@/project/roomKit";
import type { Project, TilesetDef } from "@/project/types";
import { HAND_INTERIOR_TILESET_ID } from "@/editor/handInterior/builder";
import { layoutCatalog } from "./interiorLayout";

/** 칩셋의 실효 방 사양 — roomKit 역할표(roomSpecOf), 가구 표가 비면 조립 킷 기물(kitHandObjects). 편집기 도구 specFor 와 같은 규칙. */
export function effectiveSpec(tileset: TilesetDef | undefined): HandInteriorSpec | undefined {
  const base = roomSpecOf(tileset);
  if (!base) return undefined;
  const kits = Object.keys(base.objects).length ? {} : kitHandObjects(tileset);
  return Object.keys(kits).length ? { ...base, objects: { ...base.objects, ...kits } as HandInteriorSpec["objects"] } : base;
}

const RULE: Record<string, string> = { floor: "f", wall: "w", hang: "h", flat: "d", door: "door", sidedoor: "sidedoor" };
const entry = (S: HandInteriorSpec, id: string): string | undefined => {
  const o = S.objects[id]; if (!o) return undefined;
  const up = Math.round((o.up ?? 0) / 16);
  const k = o.stairs ? `s${o.stairs === "up" ? "u" : "d"}` : RULE[o.kind] ?? "f";
  return `${id} ${o.w}x${Math.max(1, o.h)} ${k}${up > 0 ? `^${up}` : ""}`;
};

/** 요청 낱말에 맞는 방 종류 키(이름·한국어 이름·별칭이 낱말에 들어 있다). */
export function roomKindsFor(S: HandInteriorSpec, text: string): string[] {
  const t = text.toLowerCase();
  return Object.entries(S.rooms?.kinds ?? {}).filter(([k, v]) => {
    const words = [k.replace(/_/gu, " "), v.ko, ...(v.alias ?? [])].filter((w) => w && w.length >= 2);
    return words.some((w) => t.includes(w.toLowerCase()));
  }).map(([k]) => k);
}

/** 이 장소에 맞는 기물 — 맞는 방 종류의 예제 표(많이 쓰인 순) → 낱말 검색. 최대 max 개. */
export function suggestedPieces(S: HandInteriorSpec, text: string, max = 70): { kinds: string[]; ids: string[]; sized: string[] } {
  const kinds = roomKindsFor(S, text);
  const used = new Map<string, number>(); const sized = new Set<string>();
  for (const [, , room, items] of S.rooms?.examples ?? []) if (kinds.includes(room)) for (const [id, n] of items) used.set(id, (used.get(id) ?? 0) + n);
  const ids: string[] = [];
  for (const [id] of [...used].sort((a, b) => b[1] - a[1])) {
    const m = /^([a-z-]+) (\d+)x(\d+)$/u.exec(id);
    if (S.objects[id]) ids.push(id); else if (m && S.tables[m[1]!]) sized.add(id);
  }
  if (text.trim()) {
    const r = searchParts(text, "", S);
    const ranked = [...r.hits].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    for (const id of ranked) { if (ids.length >= max) break; if (!ids.includes(id)) ids.push(id); }
  }
  return { kinds, ids: ids.slice(0, max), sized: [...sized].slice(0, 12) };
}

const cache = new Map<string, string>();
/** 목록 카드 글(영어). 같은 칩셋·같은 방 종류면 캐시한다. */
export function chipsetCatalog(tileset: TilesetDef | undefined, text = ""): string | undefined {
  const S = effectiveSpec(tileset);
  if (!tileset || !S || !Object.keys(S.objects).length) return undefined;
  const sug = suggestedPieces(S, text);
  const key = `${tileset.id}|${Object.keys(S.objects).length}|${sug.kinds.join(",")}|${sug.ids.slice(0, 8).join(",")}`;
  const hit = cache.get(key); if (hit) return hit;
  const suggested = sug.ids.map((id) => entry(S, id)).filter(Boolean);
  const out = [
    `[Interior catalog — chipset ${tileset.id}, 16px cells; exact ids for make_place spec.layout. Generated from the chipset's own room tables and pieces.]`,
    ...(suggested.length ? [`suggested for this request${sug.kinds.length ? ` (room examples: ${sug.kinds.join(", ")})` : ""}: ${suggested.join(", ")}${sug.sized.length ? `; sized pieces used there: ${sug.sized.join(", ")}` : ""}`] : []),
    layoutCatalog(S),
  ].join("\n");
  cache.set(key, out);
  return out;
}

/** 실내 칸 배치에 쓰는 칩셋 — 지금 맵의 칩셋이 방 역할표를 가진 실내 칩셋이면 그것, 아니면 손 도트 실내 v5. 목록 카드·find_pieces 가 같은 규칙을 쓴다. */
export function interiorTilesetFor(project: Project | undefined, mapId?: string): TilesetDef | undefined {
  const cur = project?.tilesets[project.maps[mapId ?? project.startMapId]?.tilesetId ?? ""];
  if (cur && cur.id !== HAND_INTERIOR_TILESET_ID && cur.roomKit && effectiveSpec(cur)) return cur;
  return project?.tilesets[HAND_INTERIOR_TILESET_ID];
}

const PLACE: Record<string, string> = { floor: "floor piece -> objects", wall: "against-wall -> wall_items, y = wall row + 3", hang: "wall-mounted -> wall_items, upper face row y = wall row + 1", flat: "walkable decal -> objects", door: "door leaf -> a door's piece", sidedoor: "side door leaf" };
/** find_pieces — 한 범주(또는 낱말에 맞는 것)의 기물 전부(영어): id · 크기 · 놓는 자리 · 솟음 · 쓰인 방 종류 · 짝. */
export function findPieces(S: HandInteriorSpec, category = "", tags: readonly string[] = [], max = 80): { categories: string[]; total: number; lines: string[] } {
  const cats = new Map<string, number>(); for (const o of Object.values(S.objects)) cats.set(o.category, (cats.get(o.category) ?? 0) + 1);
  const cat = cats.has(category) ? category : "";
  const words = tags.map((t) => String(t).trim()).filter(Boolean).join(" ");
  const ids = words ? searchParts(words, cat, S).ids : Object.keys(S.objects).filter((id) => !cat || S.objects[id]!.category === cat);
  const rooms = new Map<string, Set<string>>();
  for (const [, , room, items] of S.rooms?.examples ?? []) for (const [id] of items) (rooms.get(id) ?? rooms.set(id, new Set()).get(id)!).add(room);
  const lines = ids.filter((id) => S.objects[id]!.kind !== "door" && S.objects[id]!.kind !== "sidedoor").slice(0, max).map((id) => {
    const o = S.objects[id]!; const up = Math.round((o.up ?? 0) / 16);
    const place = o.stairs === "up" ? `STAIRS UP kit ${o.w}x3 -> wall_items on a north wall, x,y = left cell of the floor row (y = wall row + 3); the ${o.w} cells south of it stay free floor`
      : o.stairs === "down" ? `STAIRS DOWN, a ${o.w}x${Math.max(1, o.h)} hole -> objects; the row south of it stays free floor` : PLACE[o.kind] ?? "objects";
    const used = [...(rooms.get(id) ?? [])].slice(0, 4).join(", ");
    const pair = (o.pair ?? []).filter((p) => S.objects[p]).slice(0, 3).join(", ");
    return `${id} | ${o.w}x${Math.max(1, o.h)} | ${o.category} | ${place}${up > 0 ? ` | art +${up} up` : ""}${used ? ` | used in: ${used}` : ""}${pair ? ` | goes with: ${pair}` : ""}`;
  });
  return { categories: [...cats].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} (${n})`), total: ids.length, lines };
}
