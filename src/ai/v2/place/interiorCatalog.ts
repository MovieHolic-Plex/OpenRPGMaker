// 칩셋 목록 카드 생성기 — 손 목록 없이 칩셋 메타데이터(roomKit 역할표 · 예제 방 표 · 조립 킷 기물)만으로 영어 목록을 만든다.
//
// 왜(2026-10-31, agent/bbox-chipsets scripts/experiments/bbox-chipsets/catalog.mts·spec.mts): roomKit 이 있는 칩셋이면 어느 것이든
// 같은 칸 배치 길로 지을 수 있게. 요청 낱말이 맞는 방 종류(spec.rooms.kinds 의 이름·별칭)의 예제 표 기물을 «이 장소에 맞는 것»으로 먼저,
// 그다음 낱말 검색(searchParts) 결과를, 그다음 칩셋 전체 목록(종류별)을 싣는다. 목록 글은 영어 id·크기·놓는 규칙뿐이다.
import { roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { isBareTileMap } from "../blankStart";
import { searchParts } from "@/editor/handInterior/parts";
import { kitHandObjects } from "@/project/roomKit";
import type { Project, TilesetDef } from "@/project/types";
import { HAND_INTERIOR_TILESET_ID } from "@/editor/handInterior/builder";
import { layoutCatalog } from "./interiorLayout";
import { gameColour, paletteFamilies } from "./interiorPalette";

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
function roomKindsFor(S: HandInteriorSpec, text: string): string[] {
  const t = text.toLowerCase();
  return Object.entries(S.rooms?.kinds ?? {}).filter(([k, v]) => {
    const words = [k.replace(/_/gu, " "), v.ko, ...(v.alias ?? [])].filter((w) => w && w.length >= 2);
    return words.some((w) => t.includes(w.toLowerCase()));
  }).map(([k]) => k);
}

/** 이 장소에 맞는 기물 — 맞는 방 종류의 예제 표(많이 쓰인 순) → 낱말 검색. 최대 max 개. */
function suggestedPieces(S: HandInteriorSpec, text: string, max = 70, key = ""): { kinds: string[]; ids: string[]; sized: string[] } {
  const kinds = roomKindsFor(S, text);
  const used = new Map<string, number>(); const sized = new Set<string>();
  for (const [, , room, items] of S.rooms?.examples ?? []) if (kinds.includes(room)) for (const [id, n] of items) used.set(id, (used.get(id) ?? 0) + n);
  const ids: string[] = [];
  // 게임 열쇠가 있으면 예제 방 기물의 차례를 그 열쇠로 섞는다 — 많이 쓰인 순 그대로면 같은 방 종류의 요청은 늘 같은 기물이 맨 앞이었고,
  // 모델이 그 앞머리를 그대로 옮겼다(2026-11-16 r7 대성당: 앞 스물셋 가운데 열하나). 실리는 기물의 무리는 같다 — 차례만 다르다.
  const mix = (id: string) => { let h = 0x811c9dc5; for (const c of `suggest|${key}|${id}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } h ^= h >>> 15; return Math.imul(h, 0x2c1b3c6d) >>> 0; };
  for (const [id] of [...used].sort((a, b) => (key.trim() ? mix(a[0]) - mix(b[0]) : 0) || b[1] - a[1])) {
    const m = /^([a-z-]+) (\d+)x(\d+)$/u.exec(id);
    if (S.objects[id]) ids.push(id); else if (m && S.tables[m[1]!]) sized.add(id);
  }
  if (text.trim()) {
    const r = searchParts(text, "", S);
    const ranked = [...r.hits].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    for (const id of ranked) { if (ids.length >= max) break; if (!ids.includes(id)) ids.push(id); }
  }
  return { kinds, ids: colourFirst(S, ids, kinds, key).slice(0, max), sized: [...sized].slice(0, 12) };
}

/**
 * 이 게임의 천 색(interiorPalette.ts gameColour)을 한 벌마다 맨 앞으로 — 목록에 한 벌의 식구가 있으면 그 자리에 이 게임 색의 식구를 먼저 싣는다
 * (없으면 넣는다). 모델은 «이 요청에 맞는 기물» 의 앞머리를 옮겨 적는다 — 짓기는 받은 id 를 그대로 깐다. 방 종류가 맞을 때만(평면 줄과 같은 조건).
 */
function colourFirst(S: HandInteriorSpec, ids: readonly string[], kinds: readonly string[], key: string): string[] {
  const game = kinds.length ? gameColour(S, key) : undefined;
  if (!game) return [...ids];
  const familyOf = new Map<string, Map<string, string>>();
  for (const members of paletteFamilies(S).values()) for (const id of members.values()) familyOf.set(id, members);
  const out: string[] = [];
  for (const id of ids) {
    const members = familyOf.get(id);
    const mine = members?.get(game.colour);
    if (mine && S.objects[mine] && !out.includes(mine)) out.push(mine);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * 이 게임의 평면 한 줄 — 같은 방 종류의 요청이 게임마다 같은 뼈대가 되지 않게(2026-11-16 실모델 탐침: «바닷가 마을과 성당» 세 판의 성당이 모두
 * 신랑 + 동쪽 2/3 자리 세로 칸막이 + 곁방 둘 위아래 + 북쪽 벽 가운데 제단이었다 — 모델은 room_parts 를 부르지 않고 목록 카드만 읽는다).
 * 낱말은 손으로 적지 않는다: 곁방 쓰임 = 칩셋 예제 표에서 그 방 종류가 든 건물의 다른 방들, 랜드마크 쪽 = 그 예제 방 기물의 facing(E/W 기물이 있을 때만 동·서 끝).
 * 쪽(서·동·북)과 입구 자리(남쪽 벽의 왼·가운데·오른)는 평면의 축이라 표가 아니다. 게임 열쇠가 없으면(사람 편집·옛 호출·지시문 상한 시험의 열쇠 없는 판) 싣지 않는다.
 * 요청이 말한 것이 이긴다 — 줄에 그렇게 적는다. 칸 배치는 여전히 모델이 쓰고, 코드는 받은 그대로 깐다(뒤집지 않는다: 뒤집으면 모델이 적어 둔 좌표 — 잇기·고치기 — 가 어긋난다).
 * 이 게임의 천 색(깔개·깃발·침대·꽃병 — 칩셋 표의 색 한 벌)도 이 줄에 싣는다: 짓기가 모델의 id 를 바꾸지 않으므로 색은 모델이 적게 한다.
 */
function planLine(S: HandInteriorSpec, kinds: readonly string[], key: string): string | undefined {
  if (!key.trim() || !kinds.length) return undefined;
  const ex = S.rooms?.examples ?? [];
  const h = (s: string) => { let x = 0x811c9dc5; for (const c of `plan|${key}|${s}`) { x ^= c.charCodeAt(0); x = Math.imul(x, 0x01000193) >>> 0; } x ^= x >>> 15; return Math.imul(x, 0x2c1b3c6d) >>> 0; };
  const pick = <T,>(xs: readonly T[], what: string): T => xs[h(what) % xs.length]!;
  // 이 방 종류 하나(첫째)만 본다. 곁방 쓰임 = 그 종류가 든 예제 건물(같은 건물 이름)의 다른 방 — 길목(entrance·corridor)은 쓰임이 아니라 뺀다.
  const kind = kinds[0]!;
  const own = ex.filter(([, , room]) => room === kind);
  const buildings = new Set(own.map(([b]) => b));
  const side = [...new Set(ex.filter(([b, , room]) => buildings.has(b) && room !== kind && room !== "entrance" && room !== "corridor").map(([, , room]) => room))]
    .sort((a, b) => h(`side|${a}`) - h(`side|${b}`) || a.localeCompare(b)).slice(0, 1 + (h("count") % 2)).map((r) => r.replace(/_/gu, " "));
  // 랜드마크가 동·서 끝에 설 수 있는 방 = 그 예제 방에 그 쪽을 보는 기물이 둘 이상(제단과 회중석처럼 방 전체가 그쪽을 본다). 의자 하나로는 방의 축이 아니다.
  const facing = new Map<string, Set<string>>();
  for (const [, , , items] of own) for (const [id] of items) { const f = S.objects[id]?.facing; if (f === "E" || f === "W") (facing.get(f) ?? facing.set(f, new Set()).get(f)!).add(id); }
  const ends = ["north wall", ...(["E", "W"] as const).filter((f) => (facing.get(f)?.size ?? 0) >= 2).map((f) => (f === "E" ? "east end" : "west end"))];
  const end = pick(ends, "end");
  const sides = ["west", "east", "north"].filter((s) => !end.startsWith(s) && !(s === "north" && end === "north wall"));
  const turned = end === "east end" ? [...facing.get("E")!] : end === "west end" ? [...facing.get("W")!] : [];
  const cloth = gameColour(S, key);
  return `plan for this game (seeded per game so two games' ${kind.replace(/_/gu, " ")} rooms differ; anything the request names wins): landmark at the ${end}${turned.length ? ` (pieces that face it: ${turned.join(", ")})` : ""}`
    + `${side.length ? `; side rooms: ${side.join(", ")}, on the ${pick(sides, "side")} side` : ""}; entrance ${pick(["left of centre", "at the centre", "right of centre"], "door")} of the south wall.${cloth?.ids.length ? ` This game's cloth colour: ${cloth.colour} (${cloth.ids.join(", ")}).` : ""}`;
}

/** 깔개 줄 목록(«carpets (…): rug red, rug royal, …»)에서 이 게임 색의 깔개를 맨 앞으로 — 깔개 줄은 기물이 아니라 «이 요청에 맞는 기물» 에 실리지 않는다. */
function carpetsFirst(catalog: string, game: { colour: string; ids: string[] } | undefined): string {
  if (!game) return catalog;
  return catalog.split("\n").map((line) => {
    const m = /^(carpets[^:]*: )(.*)$/u.exec(line);
    if (!m) return line;
    const items = m[2]!.split(", ");
    const mine = items.filter((id) => game.ids.includes(id));
    return mine.length ? m[1] + [...mine, ...items.filter((id) => !mine.includes(id))].join(", ") : line;
  }).join("\n");
}

const cache = new Map<string, string>();
/** 목록 카드 글(영어). 같은 칩셋·같은 방 종류면 캐시한다. */
export function chipsetCatalog(tileset: TilesetDef | undefined, text = "", key = ""): string | undefined {
  const S = effectiveSpec(tileset);
  if (!tileset || !S || !Object.keys(S.objects).length) return undefined;
  const sug = suggestedPieces(S, text, 70, key);
  const plan = planLine(S, sug.kinds, key);
  const cacheKey = `${tileset.id}|${Object.keys(S.objects).length}|${sug.kinds.join(",")}|${sug.ids.join(",")}|${plan ?? ""}`;
  const hit = cache.get(cacheKey); if (hit) return hit;
  const suggested = sug.ids.map((id) => entry(S, id)).filter(Boolean);
  const out = [
    `[Interior catalog — chipset ${tileset.id}, 16px cells; exact ids for make_place spec.layout. Generated from the chipset's own room tables and pieces.]`,
    ...(suggested.length ? [`suggested for this request${sug.kinds.length ? ` (room examples: ${sug.kinds.join(", ")})` : ""}: ${suggested.join(", ")}${sug.sized.length ? `; sized pieces used there: ${sug.sized.join(", ")}` : ""}`] : []),
    ...(plan ? [plan] : []),
    carpetsFirst(layoutCatalog(S), sug.kinds.length ? gameColour(S, key) : undefined),
  ].join("\n");
  cache.set(cacheKey, out);
  return out;
}

/** 실내 칸 배치에 쓰는 칩셋 — 지금 맵의 칩셋이 방 역할표를 가진 실내 칩셋이면 그것, 아니면 손 도트 실내 v5. 목록 카드·find_pieces 가 같은 규칙을 쓴다. */
export function interiorTilesetFor(project: Project | undefined, mapId?: string): TilesetDef | undefined {
  const map = project?.maps[mapId ?? project.startMapId];
  const cur = project?.tilesets[map?.tilesetId ?? ""];
  // 바깥 칩셋이 방 표를 같이 든 것(모습 표 looks — 버들항)은 그 맵에 무엇이 지어져 있을 때만 따른다: 빈 프로젝트의 잔디 한 장(시작 맵)은 버들항 마을이 아니다 —
  // 거기서 「독서실」「알현실」을 청하면 종전대로 v5(화풍 낱말이 고르는 칩셋)다.
  if (cur && cur.id !== HAND_INTERIOR_TILESET_ID && cur.roomKit && effectiveSpec(cur) && !(effectiveSpec(cur)?.looks && map && isBareTileMap(map))) return cur;
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
