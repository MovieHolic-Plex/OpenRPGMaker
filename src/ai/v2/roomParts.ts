// room_parts: 모델이 방을 설계(zone.design)하기 전에 보는 재료 — 칩셋 기물 이름표(크기·놓는 곳·짝)와 그 용도 손 견본 몇 개의 배치 요약.
// 견본은 «참고»다(2026-10-18 사용자 결정 「프리셋을 그대로 깔지 말고 AI 가 참고해서, 똑같이 깔지 말고」). 그림은 verbs.ts 가 붙인다.
import { roomSpecOf, HAND_INTERIOR_TILESET_ID, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { roomTemplates, type InteriorRoomTemplate } from "@/editor/handInterior/templates";
import type { Project } from "@/project/types";

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
}

/** 기물 한 줄: id | 한국어 | 가로×세로 | 종류 | 놓는 곳. */
const line = (id: string, S: HandInteriorSpec): string => {
  const o = S.objects[id]!;
  const kind = o.kind === "wall" ? "벽 가구(북벽만)" : o.kind === "hang" ? "걸이(북벽 벽면, dy -2)" : o.kind === "flat" ? "바닥 그림(밟음)" : o.facing ? `바닥(${o.facing}쪽을 봄)` : "바닥";
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
  };
}

/** 손 견본 먼저, 크기가 다른 것으로. */
function pickReferences(tpls: readonly InteriorRoomTemplate[], n: number): InteriorRoomTemplate[] {
  const ordered = [...tpls].sort((a, b) => Number(b.id.startsWith("authored-")) - Number(a.id.startsWith("authored-")) || a.w * a.h - b.w * b.h);
  const out: InteriorRoomTemplate[] = [];
  for (const t of ordered) { if (out.length >= n) break; if (!out.some((o) => o.w === t.w && o.h === t.h)) out.push(t); }
  return out;
}

/** 견본 하나 → 바닥 좌표(바닥 왼쪽 위 0,0) 기물 목록. 걸이는 y -2. */
export function referenceSummary(t: InteriorRoomTemplate, S: HandInteriorSpec): { id: string; floorSize: string; items: string[] } {
  const items = t.items.filter((it) => it.t === "o" || it.t === "l").map((it) => it.t === "l"
    ? `깔개 ${it.id} 칸 ${(it.cells ?? []).length}개(${(it.cells ?? [])[0]?.[0]},${((it.cells ?? [])[0]?.[1] ?? 2) - 2}부터)`
    : `${it.id} (${it.x},${it.y - 2})${S.objects[it.id]?.kind === "hang" ? " 걸이" : ""}`);
  return { id: t.id, floorSize: `${t.w}×${t.h - 2}`, items };
}
