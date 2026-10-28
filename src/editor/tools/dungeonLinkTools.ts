/**
 * 월드맵 장소 입구 ↔ 던전·마을 내부 양방향 연결 (2026-10-15, FF6급 감사 #25 · #35).
 *
 * 배경: 동굴 「입구」 야외 맵과 `author_dungeon` 광산 내부는 서로 모르는 두 맵이라, 조수가 이어 주지 않으면 던전이
 * 고아 빈 맵(orphan-empty-map)으로 남았고, 월드맵 장소 아이콘 입구에는 이벤트가 없어 걸어 들어갈 수 없었다.
 * 연결은 link_maps(`linkMapsInDraft`) 한 경로를 그대로 쓴다 — 문 칸 보정·왕복 착지 칸·봉쇄 검사·worldGraph 간선 등록이 같다.
 *
 * - 던전 쪽: author_dungeon 이 입구 위치(`stairsUp`)를 「던전 입구」 위치 표식(tags: dungeon-entrance, gate:x,y)으로 남긴다.
 * - 월드 쪽: edit_world_terrain 이 장소마다 위치 표식을 남기고, 이 도구가 입구 칸(성문, note 의 「입구(성문) x,y」)을 읽는다.
 */
import type { GameMap, MapId, MapNamedLocation, Project } from "@/project/types";
import { linkMapsInDraft, type LinkResult } from "./worldGraphTools";
import { isDoorArtCell } from "@/project/staging/doorCells";
import { isPassable } from "@/project/collision";
import { protectedHouseCells } from "./houseProtection";
import { walkableFromAnchors } from "./transferReachability";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

export const DUNGEON_ENTRANCE_TAG = "dungeon-entrance";

type Pt = { x: number; y: number };

const ENTRANCE_NOTE = /입구\(성문\)\s*(\d+)\s*,\s*(\d+)/;
const GATE_TAG = /^gate:(\d+),(\d+)$/;
const LAND_TAG = /^land:(\d+),(\d+)$/;

function reject(message: string, code = "invalid-args", extra: Record<string, unknown> = {}): never {
  throw new ToolError(message, { code, ...extra });
}

function intPoint(value: unknown, label: string): Pt {
  const rec = value as { x?: unknown; y?: unknown } | null;
  if (!rec || typeof rec !== "object" || !Number.isInteger(rec.x) || !Number.isInteger(rec.y)) reject(`${label} 은 정수 {x,y} 여야 한다.`);
  return { x: rec.x as number, y: rec.y as number };
}

function checkKeys(label: string, value: Record<string, unknown>, allowed: readonly string[]): void {
  const extra = Object.keys(value).filter((k) => !allowed.includes(k));
  if (extra.length) reject(`${label} 가 모르는 인자: ${extra.join(", ")} — 있는 것: ${allowed.join(", ")}.`);
}

export interface DungeonGateInfo { readonly gate: Pt; readonly landing?: Pt; readonly source: "marker" | "none" }

/** 던전 맵에 남긴 입구 표식에서 문 칸을 읽는다(author_dungeon 이 만든 맵). */
export function dungeonGateOf(map: GameMap): DungeonGateInfo {
  for (const location of map.locations ?? []) {
    if (!(location.tags ?? []).includes(DUNGEON_ENTRANCE_TAG)) continue;
    let gate: Pt = { x: location.x, y: location.y };
    let landing: Pt | undefined;
    for (const tag of location.tags ?? []) {
      const g = GATE_TAG.exec(tag);
      if (g) gate = { x: Number(g[1]), y: Number(g[2]) };
      const l = LAND_TAG.exec(tag);
      if (l) landing = { x: Number(l[1]), y: Number(l[2]) };
    }
    return { gate, ...(landing ? { landing } : {}), source: "marker" };
  }
  return { gate: { x: 0, y: 0 }, source: "none" };
}

/** 월드맵 장소의 입구 칸 — 위치 표식 note 의 「입구(성문) x,y」, 없으면 장소 사각형 아래 가운데. */
export function placeGateOf(location: MapNamedLocation): Pt {
  const m = ENTRANCE_NOTE.exec(location.note ?? "");
  if (m) return { x: Number(m[1]), y: Number(m[2]) };
  return { x: location.x + Math.floor(location.w / 2), y: location.y + location.h - 1 };
}

function findPlace(map: GameMap, key: string): MapNamedLocation {
  const locations = map.locations ?? [];
  const byId = locations.filter((l) => l.id === key);
  const byName = locations.filter((l) => l.name === key || (l.note ?? "").includes(`키트 id ${key})`));
  const hits = byId.length ? byId : byName;
  if (hits.length === 1) return hits[0]!;
  if (hits.length > 1) reject(`장소 「${key}」 가 ${hits.length}곳이다 — 위치 id 로 지정하라: ${hits.map((l) => l.id).join(", ")}`, "ambiguous-place");
  reject(`맵 ${map.id} 에 장소 「${key}」 가 없다 — 있는 장소: ${locations.slice(0, 40).map((l) => `${l.id}(${l.name})`).join(", ") || "(없음)"}. read_world_terrain 의 places 를 보라.`, "place-not-found");
}

export interface DungeonLinkArgs {
  readonly fromMapId: string;
  readonly x?: number;
  readonly y?: number;
  readonly place?: string;
  readonly toMapId: string;
  readonly toGate?: Pt;
  readonly fade?: "black" | "white" | "none";
}

/** 야외(월드) 입구 칸 ↔ 던전(또는 마을) 문 칸을 양방향으로 잇는다. author_dungeon.entrance 와 link_world_entrance 가 같이 쓴다. */
export function linkEntranceInDraft(draft: Project, args: DungeonLinkArgs): { link: LinkResult; fromGate: Pt; toGate?: Pt; placeName?: string; notes: string[] } {
  const fromMap = draft.maps[args.fromMapId as MapId];
  if (!fromMap) reject(`맵이 없다: ${args.fromMapId}`, "map-not-found", { mapId: args.fromMapId });
  const toMap = draft.maps[args.toMapId as MapId];
  if (!toMap) reject(`맵이 없다: ${args.toMapId}`, "map-not-found", { mapId: args.toMapId });
  const notes: string[] = [];
  let fromGate: Pt;
  let placeName: string | undefined;
  if (typeof args.place === "string" && args.place.trim()) {
    const place = findPlace(fromMap, args.place.trim());
    fromGate = placeGateOf(place);
    placeName = place.name;
  } else if (Number.isInteger(args.x) && Number.isInteger(args.y)) {
    fromGate = { x: args.x as number, y: args.y as number };
  } else {
    reject("야외 쪽 입구는 place(장소 id·이름) 또는 x,y 로 준다.");
  }
  let toGate = args.toGate;
  let toLanding: Pt | undefined;
  let toDoor: Pt | undefined;
  if (!toGate) {
    const info = dungeonGateOf(toMap);
    if (info.source === "marker") { toGate = info.gate; toLanding = info.landing; }
    // 문으로 들어가는 던전(문 그림 칸은 못 걷는다, 착지 = 바로 남쪽): 연결 도구의 문 계약대로 문앞 칸을 출입구, 문 칸을 doorAt 으로 준다.
    // 그대로 주면 연결 도구가 막힌 문 칸을 문앞으로 옮겨 착지와 겹친다(transfer-retrigger, 2026-10-26 북방 요새).
    if (toGate && toLanding && toLanding.x === toGate.x && toLanding.y === toGate.y + 1 && !isPassable(draft, toMap, toGate.x, toGate.y)) {
      toDoor = toGate; toGate = toLanding; toLanding = undefined;
    }
    else notes.push(`맵 ${toMap.id} 에 던전 입구 표식이 없어 문 칸을 고르지 못했다 — 연결 도구가 맵 가장자리 중앙 문으로 보정한다. 정확히 하려면 toGate{x,y}.`);
  }
  // author_dungeon 의 자리표시 출구(바깥 맵이 없을 때 입구 계단에 둔 것)는 진짜 연결로 바꾼다.
  toMap.events = toMap.events.filter((e) => e.id !== `ev_${toMap.id}_exit_placeholder`);
  const otherExit = toMap.events.find((e) => (e.pages ?? []).some((page) => page.commands.some((c) => c.kind === "transfer"
    && (c as { mapId?: string }).mapId !== fromMap.id)) && toGate && Math.abs(e.x - toGate.x) <= 1 && Math.abs(e.y - toGate.y) <= 1);
  if (otherExit) notes.push(`던전 ${toMap.id} 의 문 칸에는 이미 다른 야외로 나가는 문(${otherExit.id})이 있다 — 한 던전은 입구 하나가 원칙이다. 두 번째 문은 가까운 다른 빈 칸에 놓였으니 위치를 확인하라(여러 입구가 필요하면 입구마다 던전을 따로 짓는다).`);
  // 굴 입구(2026-10-25 J25): 숲·들판의 맨땅 출입구로 동굴에 들어가 «풀밭에서 갑자기 동굴»로 읽혔다. 버들항 바깥 맵이면 출입구 바로 위에 갱구를 찍는다.
  const mouth = caveMouth(draft, fromMap, fromGate);
  if (mouth) notes.push(mouth);
  const from = { mapId: fromMap.id, x: fromGate.x, y: fromGate.y };
  const to = { mapId: toMap.id, ...(toGate ? { x: toGate.x, y: toGate.y } : {}), ...(toLanding ? { entry: { x: toLanding.x, y: toLanding.y } } : {}), ...(toDoor ? { doorAt: { x: toDoor.x, y: toDoor.y } } : {}) };
  const link = linkMapsInDraft(draft, { from, to, bidirectional: true, fade: args.fade ?? "black", registerEdge: true });
  return { link, fromGate, ...(toGate ? { toGate } : {}), ...(placeName ? { placeName } : {}), notes };
}

/** 월드맵 장소 입구 칸(±1)에 이동 이벤트가 이미 있는가. */
function placeHasEntrance(map: GameMap, location: MapNamedLocation): boolean {
  const g = placeGateOf(location);
  return map.events.some((e) => Math.abs(e.x - g.x) <= 1 && Math.abs(e.y - g.y) <= 1
    && (e.pages ?? []).some((page) => page.commands.some((c) => c.kind === "transfer")));
}

/** 장소 이름·키트 id 와 이름이 같거나 맵 id 가 키트 id 를 품은 맵을 찾는다(정확히 하나일 때만). */
function matchMapForPlace(draft: Project, worldMapId: string, location: MapNamedLocation): GameMap | undefined {
  const kitId = /키트 id ([\w-]+)/.exec(location.note ?? "")?.[1];
  const hits = Object.values(draft.maps).filter((m) => m.id !== worldMapId && !m.worldmapSource
    && (m.name === location.name || m.id === location.id || (kitId && m.id === kitId) || (kitId && m.id.includes(kitId))));
  return hits.length === 1 ? hits[0] : undefined;
}

const GATE_SCHEMA: JsonSchema = {
  type: "object", additionalProperties: false, required: ["x", "y"],
  properties: { x: { type: "integer" }, y: { type: "integer" } },
};

const LINK_KEYS = ["place", "x", "y", "toMapId", "toGate"] as const;
const TOOL_KEYS = ["worldMapId", "links", "autoMatch", "fade"] as const;

export function parseEntranceOption(value: unknown): { fromMapId: string; x?: number; y?: number; place?: string; fade?: "black" | "white" | "none" } {
  if (!value || typeof value !== "object" || Array.isArray(value)) reject("entrance 는 {fromMapId, place|x,y} 객체여야 한다.");
  const rec = value as Record<string, unknown>;
  checkKeys("entrance", rec, ["fromMapId", "place", "x", "y", "fade"]);
  if (typeof rec.fromMapId !== "string" || !rec.fromMapId) reject("entrance.fromMapId(야외·월드 맵 id)가 필요하다.");
  const hasPlace = typeof rec.place === "string" && rec.place.trim() !== "";
  const hasXY = Number.isInteger(rec.x) && Number.isInteger(rec.y);
  if (!hasPlace && !hasXY) reject("entrance 에는 place(월드맵 장소 id·이름) 또는 정수 x,y 가 필요하다.");
  if (rec.fade !== undefined && !["black", "white", "none"].includes(String(rec.fade))) reject("entrance.fade 는 black·white·none 중 하나다.");
  return {
    fromMapId: rec.fromMapId,
    ...(hasPlace ? { place: String(rec.place).trim() } : {}),
    ...(hasXY ? { x: rec.x as number, y: rec.y as number } : {}),
    ...(rec.fade ? { fade: rec.fade as "black" | "white" | "none" } : {}),
  };
}

export const ENTRANCE_OPTION_SCHEMA: JsonSchema = {
  type: "object", additionalProperties: false, required: ["fromMapId"],
  description: "야외·월드맵의 입구와 이 던전을 자동으로 양방향 잇는다(고아 맵 방지). {fromMapId, place?|x,y, fade?} — place 는 월드맵 장소 id·이름(그 장소의 성문 칸), 아니면 x,y 로 입구 칸 직접.",
  properties: {
    fromMapId: { type: "string", description: "입구가 있는 야외·월드맵 id" },
    place: { type: "string", description: "월드맵 장소 id 또는 이름(위치 표식). x,y 와 둘 중 하나" },
    x: { type: "integer" }, y: { type: "integer" },
    fade: { type: "string", enum: ["black", "white", "none"] },
  },
};

const linkWorldEntrance: ToolDefinition = {
  name: "link_world_entrance",
  description:
    "월드맵(또는 야외 맵)의 장소 입구와 던전·마을 맵을 양방향으로 잇는다. 월드맵 장소 아이콘의 성문 칸에 걸어 들어가는 출입구 이벤트를 만들고, 돌아 나오는 문도 같이 만든다. "
    + "{worldMapId, links:[{place|x,y, toMapId, toGate?}], fade?} — place 는 read_world_terrain 의 장소 id(또는 이름). 던전 맵은 author_dungeon 이 남긴 입구 표식으로 문 칸을 알아서 찾고, 마을·실내 맵은 toGate{x,y} 를 주지 않으면 맵 가장자리 중앙으로 간다. "
    + "같은 연결을 다시 불러도 이벤트가 겹치지 않는다. author_dungeon 을 부를 때 entrance 인자를 주면 이 도구를 따로 부를 필요가 없다.",
  mode: "write",
  domains: ["map", "world"],
  parameters: {
    type: "object", additionalProperties: false, required: ["worldMapId"],
    properties: {
      worldMapId: { type: "string", description: "입구가 있는 월드맵(야외 맵) id" },
      autoMatch: { type: "boolean", description: "true 면 이름·id 가 장소와 같은 던전·마을 맵을 찾아 links 에 없는 장소도 자동으로 잇는다(맵이 정확히 하나일 때만). 입구 없는 장소 목록은 항상 data.unlinkedPlaces 로 준다." },
      links: {
        type: "array", minItems: 1, maxItems: 40,
        items: {
          type: "object", additionalProperties: false, required: ["toMapId"],
          properties: {
            place: { type: "string", description: "월드맵 장소 id 또는 이름" },
            x: { type: "integer" }, y: { type: "integer" },
            toMapId: { type: "string", description: "들어갈 던전·마을 맵 id" },
            toGate: GATE_SCHEMA,
          },
        },
      },
      fade: { type: "string", enum: ["black", "white", "none"] },
    },
  },
  invalidArgsExample: { worldMapId: "world_map", links: [{ place: "narshe_mine", toMapId: "mine_1" }] },
  run(draft, args): ToolExecResult {
    checkKeys("link_world_entrance", args, TOOL_KEYS);
    const worldMapId = String(args.worldMapId ?? "");
    if (!draft.maps[worldMapId as MapId]) reject(`맵이 없다: ${worldMapId}`, "map-not-found", { mapId: worldMapId });
    const links = Array.isArray(args.links) ? (args.links as Record<string, unknown>[]) : [];
    const worldMap = draft.maps[worldMapId as MapId]!;
    if (!links.length && args.autoMatch !== true) reject("links 에 연결을 1개 이상 주거나 autoMatch:true 로 이름이 같은 맵을 자동으로 잇는다.");
    const fade = typeof args.fade === "string" ? (args.fade as "black" | "white" | "none") : undefined;
    const done: Record<string, unknown>[] = [];
    const warnings: string[] = [];
    for (const [i, link] of links.entries()) {
      checkKeys(`links[${i}]`, link, LINK_KEYS);
      if (typeof link.toMapId !== "string" || !link.toMapId) reject(`links[${i}].toMapId 가 필요하다.`);
      const hasXY = Number.isInteger(link.x) && Number.isInteger(link.y);
      const result = linkEntranceInDraft(draft, {
        fromMapId: worldMapId, toMapId: link.toMapId, ...(fade ? { fade } : {}),
        ...(typeof link.place === "string" ? { place: link.place } : {}),
        ...(hasXY ? { x: link.x as number, y: link.y as number } : {}),
        ...(link.toGate ? { toGate: intPoint(link.toGate, `links[${i}].toGate`) } : {}),
      });
      warnings.push(...result.notes, ...result.link.warnings);
      done.push({ place: result.placeName, from: result.fromGate, toMapId: link.toMapId, to: result.toGate, outEvent: result.link.eventIdA, backEvent: result.link.eventIdB, outLanding: result.link.landingB, backLanding: result.link.landingA });
    }
    if (args.autoMatch === true) {
      const given = new Set(links.map((l) => String(l.place ?? "")));
      for (const location of worldMap.locations ?? []) {
        if (given.has(location.id) || given.has(location.name) || placeHasEntrance(worldMap, location)) continue;
        const target = matchMapForPlace(draft, worldMapId, location);
        if (!target) continue;
        const result = linkEntranceInDraft(draft, { fromMapId: worldMapId, toMapId: target.id, place: location.id, ...(fade ? { fade } : {}) });
        warnings.push(...result.notes, ...result.link.warnings);
        done.push({ place: result.placeName, from: result.fromGate, toMapId: target.id, to: result.toGate, outEvent: result.link.eventIdA, backEvent: result.link.eventIdB, outLanding: result.link.landingB, backLanding: result.link.landingA, auto: true });
      }
    }
    const unlinkedPlaces = (worldMap.locations ?? []).filter((l) => !(l.tags ?? []).includes("dungeon-entrance") && ENTRANCE_NOTE.test(l.note ?? "") && !placeHasEntrance(worldMap, l)).map((l) => `${l.id}「${l.name}」 입구 ${placeGateOf(l).x},${placeGateOf(l).y}`);
    return {
      summary: `입구 연결 ${done.length}개 — ${done.map((d) => `${String(d.place ?? `(${(d.from as Pt).x},${(d.from as Pt).y})`)}→${String(d.toMapId)}`).join(", ")} (양방향)`,
      data: { worldMapId, links: done, unlinkedPlaces },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const DUNGEON_LINK_TOOLS: readonly ToolDefinition[] = [linkWorldEntrance];

const CAVE_MOUTH_KIT = "kit:beodeul_city/bd-pick-mining-valley-adit";

/**
 * 출입구 칸 위에 갱구(3×4, 왼쪽 위 = 출입구 −2,−4)를 찍어도 되는 자리인가. 갱구를 안 찍는 맵(버들항 바깥이 아님)은 늘 참.
 * 찍으면 그 3×4 의 밭·울타리·나무·집·길을 덮어쓴다 — 2026-10-28 jrpg 버들마을에서 시작점 곁 밀밭 울타리 안에 갱구가 박혔다.
 * 그래서 칸마다 걸을 수 있고(밀·울타리·나무·집이 아님), 바닥이 그 맵의 바탕 땅(가장 흔한 바닥 그림, 길·광장·물 아님)이고, 이벤트가 없어야 한다.
 */
export function caveMouthSpotClear(draft: Project, map: GameMap, gate: Pt): boolean {
  const role = (map as unknown as { mapRole?: string }).mapRole;
  if (map.tilesetId !== "beodeul_city" || role === "dungeon" || role === "interior" || map.climate?.mode === "indoor") return true;
  const counts = new Map<number, number>();
  for (const t of map.lowerTiles) counts.set(t, (counts.get(t) ?? 0) + 1);
  const ground = new Set([...counts].filter(([, n]) => n >= map.lowerTiles.length * 0.15).map(([t]) => t));
  // 완성된 집의 보호 칸을 건드리면 던전 짓기 전체가 거절된다(커밋 검사) — 그 칸은 처음부터 피한다.
  const guarded = new Set(protectedHouseCells(map).map((c) => c.y * map.width + c.x));
  for (let y = gate.y - 4; y <= gate.y - 1; y += 1) for (let x = gate.x - 2; x <= gate.x; x += 1) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const i = y * map.width + x;
    // 걸을 수 있는 바닥 덧그림(2·4층 풀포기·들꽃·그림자)은 덮어도 된다 — 막힌 칸(밀·울타리·나무·집)과 바탕 땅이 아닌 칸(길·광장·물)은 피한다.
    if (!ground.has(map.lowerTiles[i]!) || !isPassable(draft, map, x, y)) return false;
    // 위층(3층) 그림은 여러 칸짜리 소품의 윗부분일 수 있다(허수아비 머리 칸은 걸을 수 있다) — 반쪽만 덮이지 않게 빈 칸만.
    if ((map.upperTiles[i] ?? -1) >= 0) return false;
    if (guarded.has(i) || map.events.some((e) => Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1)) return false;
  }
  return true;
}
/** 바깥(실내·던전이 아닌) 버들항 맵의 출입구 칸 위에 문·계단 그림이 없으면 갱구(3×4, 문 칸 = 왼쪽 위+(2,3))를 출입구 바로 위에 찍는다. 못 찍으면 조용히 넘긴다(끝맺음 검사가 짚는다). */
/**
 * 던전 바깥 문 자리 고르기 — 정본 하나(author_dungeon 기본 출구 attachDefaultExit 와 조수 v2 자동 연결 transferSpot.dungeonGateSpot 이 같이 쓴다).
 * 모두 시작점·착지점에서 걸어 닿는 칸만. score 가 낮은 칸 먼저.
 *  1) 갱구(3×4)가 맞는 칸(caveMouthSpotClear) 중 길 곁 — 길이 굴 입구로 이어진다.
 *  2) 갱구가 맞는 칸 아무 데나.
 *  3) 맵 가장자리의 길 끝(바탕 풀이 아닌 걷는 바닥) — 빽빽한 마을이면 「이 길로 나가면 동굴」로 읽힌다(갱구는 자리가 없어 안 찍힌다).
 *  4) 맵 가장자리 아무 칸.
 * 2026-10-28 jrpg 버들마을: 시작점에서 가장 가까운 칸이 밀밭 울타리 바로 아래라 갱구가 밭을 덮었다.
 */
export function pickDungeonGateSpot(draft: Project, map: GameMap, score: (c: Pt) => number): (Pt & { readonly why: string }) | undefined {
  const W = map.width, H = map.height;
  const reach = walkableFromAnchors(draft, map);
  const reached = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && (!reach || reach.has(y * W + x));
  const tally = new Map<number, number>();
  for (const t of map.lowerTiles) tally.set(t, (tally.get(t) ?? 0) + 1);
  const ground = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0];
  const meta = (draft.tilesets[map.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string; tags?: string[] } | undefined)[];
  const pathTile = (t: number | undefined) => {
    if (t === undefined || t < 0) return false;
    const m = meta[t]; const tags = (m?.tags ?? []).map((x) => x.toLowerCase());
    return tags.includes("road") || tags.includes("street") || tags.includes("path") || tags.includes("sand") || (/길/u.test(m?.label ?? "") && !/풀|잔디/u.test(m?.label ?? ""));
  };
  const nearPath = (x: number, y: number) => [-1, 0, 1].some((dy) => [-1, 0, 1, 2].some((dx2) => { const yy = y + dy + 1, xx = x + dx2 - 1; return xx >= 0 && yy >= 0 && xx < W && yy < H && pathTile(map.lowerTiles[yy * W + xx]); }));
  const free = (x: number, y: number) => isPassable(draft, map, x, y) && !map.events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1);
  const tiers: [string, (x: number, y: number) => boolean][] = [
    ["갱구 자리·길 곁", (x, y) => reached(x, y) && reached(x, y + 1) && caveMouthSpotClear(draft, map, { x, y }) && nearPath(x, y)],
    ["갱구 자리", (x, y) => reached(x, y) && reached(x, y + 1) && caveMouthSpotClear(draft, map, { x, y })],
    ["가장자리 길 끝", (x, y) => (x === 0 || y === 0 || x === W - 1 || y === H - 1) && reached(x, y) && map.lowerTiles[y * W + x] !== ground],
    ["가장자리", (x, y) => (x === 0 || y === 0 || x === W - 1 || y === H - 1) && reached(x, y)],
  ];
  for (const [why, ok] of tiers) {
    let best: Pt | undefined; let bd = Infinity;
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (!free(x, y) || !ok(x, y)) continue;
      const d = score({ x, y });
      if (d < bd) { bd = d; best = { x, y }; }
    }
    if (best) return { ...best, why };
  }
  return undefined;
}

function caveMouth(draft: Project, map: GameMap, gate: Pt): string | undefined {
  const role = (map as unknown as { mapRole?: string }).mapRole;
  if (map.tilesetId !== "beodeul_city" || role === "dungeon" || role === "interior" || map.climate?.mode === "indoor") return undefined;
  if ([0, -1].some((dy) => isDoorArtCell(draft, map, gate.x, gate.y + dy))) return undefined;
  // 갱구 자리가 밭·울타리·나무·집·길·완성된 집 보호 칸을 덮으면 찍지 않는다(덮으면 밭 한가운데 굴이 박히거나 커밋이 통째로 거절된다).
  if (!caveMouthSpotClear(draft, map, gate)) return undefined;
  const tool = SHARED_OBJECT_TOOLS.find((t) => t.name === "stamp_object");
  if (!tool?.run) return undefined;
  try {
    tool.run(draft, { objectId: CAVE_MOUTH_KIT, mapId: map.id, x: gate.x - 2, y: gate.y - 4 });
    return `${map.name ?? map.id} 출입구 (${gate.x},${gate.y}) 바로 위에 굴 입구(갱구)를 찍었다.`;
  } catch {
    return undefined;
  }
}
