// room_parts: 모델이 방을 설계(zone.design)하기 전에 보는 재료 — 칩셋 기물 이름표(크기·놓는 곳·짝)와 그 용도 손 견본 몇 개의 배치 요약.
// 견본은 «참고»다(2026-10-18 사용자 결정 「프리셋을 그대로 깔지 말고 AI 가 참고해서, 똑같이 깔지 말고」). 그림은 verbs.ts 가 붙인다.
import { roomSpecOf, HAND_INTERIOR_TILESET_ID, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { roomTemplates, type InteriorRoomTemplate } from "@/editor/handInterior/templates";
import type { Project } from "@/project/types";
import { SHAPE_GUIDE, type RoomDesign } from "@/editor/handInterior/designRoom";

/**
 * 모양 예시 — 모델이 모양을 «고를» 재료(2026-10-29 3c: 15판 설계 14개가 rect, 모양 어휘가 한 줄 이름뿐이라 고를 수 없었다).
 * 기물은 자리 보기용 서재 물건이다 — 네 방 용도의 기물로 바꾼다. 곁방 예시(two-room)는 zones 두 개(각자 design)다. 예마다 areas(구역·초점·오갈 이유 — designAreas.ts)를 보인다.
 */
export const SHAPE_EXAMPLES: readonly { readonly shape: string; readonly ko: string; readonly zones: readonly { kind: string; purpose: string; design: RoomDesign }[] }[] = [
  { shape: "L", ko: "ㄱ자", zones: [{ kind: "study", purpose: "L-shaped study", design: { shape: "L", corner: "ne", w: 8, h: 5, door: "left", floor: "boards", wall: "plaster", areas: [{ name: "bookshelf wall", purpose: "where the owner's books are", focal: "bookshelf 3w", visit: "a missing book is a clue" }, { name: "desk", purpose: "where the owner worked", focal: "desk 3x1", visit: "inspect a note in the drawer" }, { name: "reading nook", purpose: "where guests sit", focal: "armchair", visit: "a key under the chair" }], groups: [
    { name: "bookshelf wall", at: "nw", items: [{ id: "bookshelf 3w" }, { id: "bookshelf 2w" }] },
    { name: "under the bent wall", at: "ne", items: [{ id: "globe" }, { id: "curtained window", dy: -2 }] },
    { name: "desk", at: "center", pos: 0.6, rug: "green", items: [{ id: "desk 3x1" }, { id: "chair N", dx: 1, dy: 1 }] },
    { name: "reading nook", at: "sw", items: [{ id: "armchair" }, { id: "roundtable", dx: 1 }] },
    { name: "chest", at: "se", items: [{ id: "chest" }] }] } }] },
  { shape: "U", ko: "ㄷ자", zones: [{ kind: "study", purpose: "U-shaped study", design: { shape: "U", w: 9, h: 5, door: "center", floor: "dplank", wall: "goldwood", areas: [{ name: "fireplace", purpose: "the heart of the room", focal: "fireplace", visit: "a half-burnt letter in the ashes" }, { name: "desk", purpose: "work spot", focal: "desk 3x1", visit: "read the ledger" }, { name: "guest seats", purpose: "conversation", focal: "armchair", visit: "talk to a person" }], groups: [
    { name: "west wing shelf", at: "nw", items: [{ id: "bookshelf 2w" }] },
    { name: "east wing shelf", at: "ne", items: [{ id: "bookshelf 2w" }] },
    { name: "fireplace at the recessed wall", at: "north", pos: 0.5, items: [{ id: "fireplace" }] },
    { name: "desk", at: "center", rug: "royal", items: [{ id: "desk 3x1" }, { id: "chair N", dx: 1, dy: 1 }] },
    { name: "guest seats", at: "sw", items: [{ id: "armchair" }, { id: "plant", dx: 1 }] },
    { name: "globe", at: "se", items: [{ id: "globe" }] }] } }] },
  { shape: "bay", ko: "창가 돌출", zones: [{ kind: "study", purpose: "bay-window study", design: { shape: "bay", w: 9, h: 5, door: "center", floor: "parquet", wall: "plaster", areas: [{ name: "window desk", purpose: "writing while looking outside", focal: "desk 3x1", visit: "clue outside the window, diary" }, { name: "reading nook", purpose: "resting spot", focal: "armchair", visit: "a book on the table" }], groups: [
    { name: "desk in the bay", at: "north", pos: 0.5, items: [{ id: "curtained window", dx: 1, dy: -2 }, { id: "desk 3x1" }, { id: "chair N", dx: 1, dy: 1 }] },
    { name: "shelf on the lowered west wall", at: "nw", items: [{ id: "bookshelf 2w" }] },
    { name: "shelf on the lowered east wall", at: "ne", items: [{ id: "bookshelf 2w" }] },
    { name: "reading nook", at: "sw", rug: "red", items: [{ id: "armchair" }, { id: "roundtable", dx: 1 }] },
    { name: "globe", at: "se", items: [{ id: "globe" }] }] } }] },
  { shape: "alcove", ko: "알코브", zones: [{ kind: "study", purpose: "alcove study", design: { shape: "alcove", corner: "nw", w: 8, h: 5, door: "right", floor: "boards", wall: "stone", areas: [{ name: "alcove", purpose: "hidden reading spot", focal: "armchair", visit: "a memo in the book pile" }, { name: "desk", purpose: "work spot", focal: "desk 3x1", visit: "inspect the drawer" }], groups: [
    { name: "alcove reading chair", at: "nw", rug: "red", items: [{ id: "armchair" }, { id: "book pile", dx: 1 }] },
    { name: "shelves on the lowered north wall", at: "north", pos: 1, items: [{ id: "bookshelf 3w" }, { id: "bookshelf 2w" }] },
    { name: "desk", at: "center", pos: 0.6, items: [{ id: "desk 3x1" }, { id: "chair N", dx: 1, dy: 1 }] },
    { name: "plant", at: "sw", items: [{ id: "plant" }] },
    { name: "chest", at: "se", items: [{ id: "chest" }] }] } }] },
  { shape: "T", ko: "ㅜ자", zones: [{ kind: "study", purpose: "T-shaped study", design: { shape: "T", w: 8, h: 5, door: "center", floor: "flag", wall: "stone", areas: [{ name: "bookshelf wall", purpose: "the collection", focal: "bookshelf 3w", visit: "book order puzzle" }, { name: "desk", purpose: "work spot", focal: "desk 3x1", visit: "locked drawer" }], groups: [
    { name: "bookshelf wall", at: "north", items: [{ id: "bookshelf 3w" }, { id: "bookshelf 2w" }, { id: "bookshelf 3w" }] },
    { name: "desk", at: "center", rug: "blue", items: [{ id: "desk 3x1" }, { id: "chair N", dx: 1, dy: 1 }] },
    { name: "west armchair", at: "west", pos: 0.3, items: [{ id: "armchair" }] },
    { name: "east globe", at: "east", pos: 0.3, items: [{ id: "globe" }] }] } }] },
  { shape: "two-room", ko: "곁방 딸린 2실(zones 둘)", zones: [
    { kind: "study", purpose: "main study", design: { shape: "rect", w: 7, h: 5, door: "center", floor: "boards", wall: "plaster", areas: [{ name: "desk", purpose: "the owner's workplace", focal: "desk 3x1", visit: "clue to the side-room key" }], groups: [
      { name: "bookshelf wall", at: "north", items: [{ id: "bookshelf 3w" }, { id: "bookshelf 2w" }] },
      { name: "desk", at: "center", rug: "red", items: [{ id: "desk 3x1" }, { id: "chair N", dx: 1, dy: 1 }] },
      { name: "armchair", at: "sw", items: [{ id: "armchair" }, { id: "roundtable", dx: 1 }] }] } },
    { kind: "storeroom", purpose: "side archive", design: { shape: "rect", w: 4, h: 4, floor: "dplank", wall: "plaster", areas: [{ name: "archive", purpose: "where hidden records are kept", focal: "chest", visit: "open the locked chest" }], groups: [
      { name: "bookshelf", at: "north", items: [{ id: "bookshelf 2w" }, { id: "bookshelf 1w" }] },
      { name: "chest", at: "sw", items: [{ id: "chest" }, { id: "crate", dx: 1 }] }] } }] },
];

const KIND_WORDS: readonly [RegExp, string][] = [
  [/서재|study|집무|연구실|공부/iu, "study"], [/서고|도서|library/iu, "library"], [/침실|bedroom|침방/iu, "bedroom"], [/객실|inn.?room/iu, "inn_room"],
  [/부엌|주방|kitchen/iu, "kitchen"], [/거실|living|응접/iu, "living"], [/식당|dining/iu, "dining"], [/선술집|주점|tavern|여관 홀/iu, "tavern"],
  [/창고|storeroom/iu, "storeroom"], [/연금|alchemy/iu, "alchemy"], [/대장간|forge/iu, "forge"], [/작업|workshop/iu, "workshop"], [/예배|chapel|성당/iu, "chapel"],
];
/** 어느 방에나 쓰는 일반 가구(의자 네 방향·안락의자·탁자·등·화분·상자·시계). */
const COMMON = /^(chair [NSEW]|stool|armchair|sofa|roundtable|dining 1x1|dining 2x1|potted|plant|floor lamp|lamp|candelabra|chest|clock|globe|fireplace|window|curtained window|picture|wall map|book pile|crate)\b/iu;

export function roomKindOf(purpose: string): string { return KIND_WORDS.find(([re]) => re.test(purpose))?.[1] ?? "study"; }

export interface RoomPartsOut {
  readonly tileset: string;
  readonly kind: string;
  readonly floors: string[]; readonly walls: string[]; readonly rugs: string[];
  readonly items: string[];
  readonly goods: string[];
  readonly references: { id: string; floorSize: string; items: string[] }[];
  readonly referenceIds: string[];
  /** 모양 어휘(최소 바닥 크기·쓰임)와 모양별 설계 예시(zones 그대로 make_place 에 넣을 수 있는 꼴). */
  readonly shapes: string[];
  readonly shapeExamples: { shape: string; zones: unknown }[];
}

/** 기물 한 줄: id | 한국어 | 가로×세로 | 종류 | 놓는 곳. */
const line = (id: string, S: HandInteriorSpec): string => {
  const o = S.objects[id]!;
  const kind = o.kind === "wall" ? "wall furniture (north wall only)" : o.kind === "hang" ? "hung (north wall face, dy -2)" : o.kind === "flat" ? "floor art (walkable)" : o.facing ? `floor (faces ${o.facing})` : "floor";
  return `${id} | ${o.ko} | ${o.w}×${Math.max(1, o.h)} | ${kind}${o.place ? ` | ${o.place.slice(0, 60)}` : ""}`;
};

export function roomParts(project: Project, purpose: string, query?: string, tilesetId: string = HAND_INTERIOR_TILESET_ID, limit = 90): RoomPartsOut | undefined {
  const S = roomSpecOf(project.tilesets[tilesetId]);
  if (!S) return undefined;
  const kind = roomKindOf(`${purpose} ${query ?? ""}`);
  const tpls = roomTemplates(tilesetId).filter((t) => t.kind === kind);
  const fromTemplates = new Map<string, number>();
  for (const t of tpls) for (const it of t.items) if (it.t === "o" && S.objects[it.id] && !["door", "sidedoor"].includes(S.objects[it.id]!.kind)) fromTemplates.set(it.id, (fromTemplates.get(it.id) ?? 0) + 1);
  const words = `${purpose} ${query ?? ""}`.toLowerCase().split(/[\s,·/]+/u).filter((w) => w.length >= 2);
  const scored: [string, number][] = [];
  for (const [id, o] of Object.entries(S.objects)) {
    if (o.kind === "door" || o.kind === "sidedoor" || o.stairs) continue;
    const hay = `${id} ${o.ko} ${(o.tags ?? []).join(" ")} ${o.place ?? ""} ${o.category}`.toLowerCase();
    let score = (fromTemplates.get(id) ?? 0) * 3;
    if (words.some((w) => hay.includes(w))) score += 4;
    if (hay.includes(kind)) score += 2;
    if (COMMON.test(id)) score += 1.5;
    if (score > 0) scored.push([id, score]);
  }
  scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const items = scored.slice(0, limit).map(([id]) => id).sort().map((id) => line(id, S));
  const refs = pickReferences(tpls, 3);
  return {
    tileset: tilesetId, kind,
    floors: Object.entries(S.floors).map(([id, f]) => `${id}(${f.ko})`),
    walls: Object.entries(S.walls).map(([id, w]) => `${id}(${w.ko})`),
    rugs: Object.keys(S.lines).filter((k) => k.startsWith("rug")),
    items,
    goods: Object.keys(S.goods).slice(0, 40),
    references: refs.map((t) => referenceSummary(t, S)),
    referenceIds: refs.map((t) => t.id),
    shapes: SHAPE_GUIDE.map((g) => `${g.shape} — floor ${g.min} or more — ${g.en}`).concat("several rooms — not a shape: declare one zone per room (each with id, x, y, design) plus connections; that is the room graph"),
    shapeExamples: SHAPE_EXAMPLES.map((e) => ({ shape: e.shape, zones: e.zones })),
  };
}

/** 손 견본 먼저, 크기가 다른 것으로(옛 서재 견본 authored-study 는 빼고). */
function pickReferences(tpls: readonly InteriorRoomTemplate[], n: number): InteriorRoomTemplate[] {
  // 옛 서재 사람 견본(authored-study-*)은 빼다 — 2026-10-29 맵 같음 감사에서 방탈출 방 반복의 원천으로 판정됐다(모델이 그 서재를 그대로 옮겼다).
  const ordered = [...tpls].filter((t) => !t.id.startsWith("authored-study")).sort((a, b) => Number(b.id.startsWith("authored-")) - Number(a.id.startsWith("authored-")) || a.w * a.h - b.w * b.h);
  const out: InteriorRoomTemplate[] = [];
  for (const t of ordered) { if (out.length >= n) break; if (!out.some((o) => o.w === t.w && o.h === t.h)) out.push(t); }
  return out;
}

/** 견본 하나 → 바닥 좌표(바닥 왼쪽 위 0,0) 기물 목록. 걸이는 y -2. */
export function referenceSummary(t: InteriorRoomTemplate, S: HandInteriorSpec): { id: string; floorSize: string; items: string[] } {
  const items = t.items.filter((it) => it.t === "o" || it.t === "l").map((it) => it.t === "l"
    ? `rug ${it.id} ${(it.cells ?? []).length} cells (from ${(it.cells ?? [])[0]?.[0]},${((it.cells ?? [])[0]?.[1] ?? 2) - 2})`
    : `${it.id} (${it.x},${it.y - 2})${S.objects[it.id]?.kind === "hang" ? " hung" : ""}`);
  return { id: t.id, floorSize: `${t.w}×${t.h - 2}`, items };
}
