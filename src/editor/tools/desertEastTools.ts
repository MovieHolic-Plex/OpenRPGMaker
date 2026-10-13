// 사막·동양풍(desert_east) 구성 도구 — compose_desert_east_map(오아시스 마을·바자르 거리·궁전·피라미드 유적·대상 숙소 한 장), compose_desert_east_room(찻집·가게·알현실·묘실·목욕탕·여관 방 한 장),
// link_desert_east_interior(건물 문 ↔ 실내 맵). 배치는 구성기 src/project/desertEastComposer.ts 가 짠다(계획 → 땅 → 건물 → 소품, 씨앗마다 다른 배치).
// 이 도구는 결과를 맵에 쓰고, 문 칸은 막힘·접근칸은 걸을 수 있음·시작 칸에서 모든 접근칸에 닿는지를 엔진 통행(isPassable)으로 다시 확인한다. 실패하면 맵을 바꾸지 않는다.
import { isDesertEastTilesetDef } from "@/ai/desertEastPolicy";
import pieces from "@/assets/desertEastPieces.json";
import { isPassable } from "@/project/collision";
import { setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { addMapLocation } from "@/project/mapNamedLocations";
import { extractTreeNode, insertTreeNode } from "@/project/mapTree";
import {
  DESERT_KIND_LABEL, DESERT_MIN_SIZE, DESERT_ROOM_LABEL, DESERT_ROOM_MAX, DESERT_ROOM_MIN,
  composeDesertEast, composeDesertRoom, desertPaletteFromTileset, type DesertKind, type DesertRoomKind,
} from "@/project/desertEastComposer";
import type { GameEvent, GameMap, MapId, Project, TilesetDef } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Cell = { readonly x: number; readonly y: number };

const inside = (map: GameMap, c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
const eventAt = (map: GameMap, c: Cell): GameEvent | undefined => (map.events ?? []).find((e) => e.x === c.x && e.y === c.y);
const isUntouched = (map: GameMap): boolean => map.lowerTiles.every((t) => t === map.lowerTiles[0]) && map.upperTiles.every((t) => t === -1);

function walkable(project: Project, map: GameMap, x: number, y: number): boolean { return inside(map, { x, y }) && isPassable(project, map, x, y); }
function reachable(project: Project, map: GameMap, from: Cell): Set<number> {
  const seen = new Set<number>([from.y * map.width + from.x]);
  const q: Cell[] = [from];
  while (q.length) {
    const c = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy }, k = n.y * map.width + n.x;
      if (!inside(map, n) || seen.has(k) || !isPassable(project, map, n.x, n.y)) continue;
      seen.add(k); q.push(n);
    }
  }
  return seen;
}

const KINDS = Object.keys(DESERT_MIN_SIZE) as DesertKind[];
const ROOM_KINDS = Object.keys(DESERT_ROOM_MIN) as DesertRoomKind[];

function targetMap(draft: Project, args: Record<string, unknown>): { mapId: string; map: GameMap; tileset: TilesetDef } {
  const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
  if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — desert_east 맵 id 를 준다", { code: "map-not-found" });
  const map = requireMap(draft, mapId);
  const tileset = draft.tilesets[map.tilesetId];
  if (!isDesertEastTilesetDef(tileset)) throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 사막·동양풍(desert_east)이 아니다 — create_map({tilesetId:"desert_east"}) 로 새 맵을 만든다`, { code: "wrong-tileset", mapId });
  return { mapId, map, tileset: tileset! };
}
function writeLayers(next: Project, mapId: string, lower: readonly number[], upper: readonly number[]): GameMap {
  const target = next.maps[mapId]!;
  for (let i = 0; i < target.lowerTiles.length; i++) { setLayerTileAt(target, 3, i, -1); setLayerTileAt(target, 4, i, -1); clearTileStack(target, "upper", i); }
  target.lowerTiles = [...lower];
  target.upperTiles = [...upper];
  return target;
}

export const COMPOSE_DESERT_EAST_MAP_TOOL: ToolDefinition = {
  name: "compose_desert_east_map",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "사막·동양풍 칩셋(desert_east) 야외 맵 한 장을 통째로 짠다(구성기 — 씨앗마다 다른 배치). "
    + "kind: oasis = 오아시스 마을(못·풀 띠·야자 + 큰길 양쪽 흙집·돔 집 + 우물 광장 + 낙타 쉼터 + 천막 야영지·대추야자 과수원, 40×32 이상) · "
    + "bazaar = 바자르 시장 거리(포석 큰길 북쪽 노점·가게 줄, 분수 광장·회당·첨탑, 남쪽 바닥 장터 격자, 42×30 이상) · "
    + "palace = 궁전(성벽 사각·성문 + 궁전·사자 석상·화로 + 축선 길·분수 + 좌우 정원 물길·야자 + 신하 처소, 성 밖 진입로·오벨리스크·마을 줄, 44×36 이상) · "
    + "pyramid = 피라미드 유적(대피라미드 + 남쪽 입구 + 석상 늘어선 참배 길 + 작은 피라미드 둘 + 무너진 신전 터 둘 + 발굴 야영지, 44×34 이상) · "
    + "caravanserai = 대상 숙소(성벽 사각·문루 + 북쪽 방 줄 + 우물 단 + 낙타 줄·짐 구석, 36×30 이상). "
    + "땅은 모래 한 재질 + 길·포석·풀·물·사구만 모서리 왕 타일로 잇고, 트인 모래는 사구·바위·덤불로 깬다. 건물 문은 남향, 바로 아래 접근칸은 길이다 — 결과 data.buildings[].doors 를 link_desert_east_interior 에 준다. "
    + "시작 칸에서 모든 접근칸에 닿는지 엔진 통행으로 확인하고, 안 되면 맵을 바꾸지 않는다. 손댄 맵은 replace:true 여야 다시 깐다(이벤트는 남는다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 desert_east 여야 한다" },
      kind: { type: "string", enum: KINDS, description: "oasis 오아시스 마을 | bazaar 바자르 거리 | palace 궁전 | pyramid 피라미드 유적 | caravanserai 대상 숙소" },
      seed: { type: "integer", minimum: 0, description: "배치 씨앗(생략 0)" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 깐다" },
    },
    required: ["kind"],
    additionalProperties: false,
  },
  invalidArgsExample: { kind: "oasis", seed: 2 },
  run(draft: Project, args): ToolExecResult {
    const { mapId, map, tileset } = targetMap(draft, args);
    const kind = KINDS.find((k) => k === args.kind);
    if (!kind) throw new ToolError(`kind 는 ${KINDS.join("·")} 중 하나다`, { code: "invalid-args" });
    const min = DESERT_MIN_SIZE[kind];
    if (map.width < min.w || map.height < min.h) throw new ToolError(`맵이 작다(${map.width}×${map.height}) — ${DESERT_KIND_LABEL[kind]}는 ${min.w}×${min.h} 이상이어야 한다. resize_map 한 뒤 부른다`, { code: "map-too-small", mapId });
    if (map.width > min.w + 24 || map.height > min.h + 20) throw new ToolError(`맵이 너무 크다(${map.width}×${map.height}) — 빈 모래가 남는다. ${DESERT_KIND_LABEL[kind]}는 ${min.w + 24}×${min.h + 20} 이하로 resize_map 한다`, { code: "map-too-large", mapId });
    if (!isUntouched(map) && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 지우고 다시 깔려면 replace:true 를 준다(이벤트는 남는다)", { code: "map-not-blank", mapId });
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 0;
    const pal = desertPaletteFromTileset(tileset, pieces);
    let r;
    try { r = composeDesertEast({ width: map.width, height: map.height, kind, seed }, pal); }
    catch (e) { throw new ToolError(`${DESERT_KIND_LABEL[kind]}를 짜지 못했다 — ${(e as Error).message}. seed 를 바꿔 다시 부른다`, { code: "compose-failed", mapId }); }
    const next = structuredClone(draft);
    const target = writeLayers(next, mapId, r.lower, r.upper);
    const errs: string[] = [];
    const W = target.width;
    if (!walkable(next, target, r.start.x, r.start.y)) errs.push(`시작 칸 (${r.start.x},${r.start.y}) 이 막혔다`);
    const seen = walkable(next, target, r.start.x, r.start.y) ? reachable(next, target, r.start) : new Set<number>();
    for (const d of r.buildings) {
      for (const c of d.doors) if (walkable(next, target, c.x, c.y)) errs.push(`${d.name} 문 칸 (${c.x},${c.y}) 이 열려 있다`);
      for (const c of d.access) {
        if (!walkable(next, target, c.x, c.y)) errs.push(`${d.name} 접근칸 (${c.x},${c.y}) 이 막혔다`);
        else if (!seen.has(c.y * W + c.x)) errs.push(`${d.name} 접근칸 (${c.x},${c.y}) 에 시작 칸에서 닿지 못한다`);
      }
    }
    if (errs.length) throw new ToolError(`${DESERT_KIND_LABEL[kind]}를 깔지 못했다 — ${errs.slice(0, 4).join(" / ")}. seed 를 바꿔 다시 부른다`, { code: "compose-failed", mapId });
    target.locations = (target.locations ?? []).filter((l) => !(l.tags ?? []).includes("desert-east-building") && !(l.tags ?? []).includes("desert-east-zone"));
    for (const d of r.buildings) {
      const door = d.doors[0];
      if (!door) continue;
      addMapLocation(target, { name: `${d.name}`, x: d.rect.x, y: d.rect.y, w: d.rect.w, h: d.rect.h, note: `문 (${door.x},${door.y}) 외 ${d.doors.length - 1}칸 · 접근칸 (${d.access[0]!.x},${d.access[0]!.y}) — 실내는 compose_desert_east_room 으로 지어 link_desert_east_interior 로 잇는다`, tags: ["desert-east-building", d.kit] });
    }
    for (const z of r.zones) addMapLocation(target, { name: z.name, x: z.rect.x, y: z.rect.y, w: z.rect.w, h: z.rect.h, note: z.use, tags: ["desert-east-zone"] });
    const blocked = (target.events ?? []).filter((e) => !walkable(next, target, e.x, e.y)).map((e) => `${e.name ?? e.id}(${e.x},${e.y})`);
    draft.maps[mapId] = target;
    const doors = r.buildings.filter((d) => d.doors.length);
    return {
      summary: `${DESERT_KIND_LABEL[kind]}를 ${map.width}×${map.height} 맵(${mapId})에 짰다(seed ${seed}) — 건물 ${r.buildings.length}채, 소품 ${r.props.length}개, 구역 ${r.zones.map((z) => z.name).join("·")}. 시작 칸 (${r.start.x},${r.start.y}) 에서 모든 문 접근칸에 닿음(엔진 통행). `
        + `문: ${doors.slice(0, 12).map((d) => `${d.name} (${d.doors.map((c) => `${c.x},${c.y}`).join(" · ")})`).join(" · ")}${doors.length > 12 ? ` 외 ${doors.length - 12}채` : ""}. 실내는 compose_desert_east_room 으로 짓고 link_desert_east_interior 로 잇는다.`
        + (r.notes.length ? ` 참고: ${r.notes.join(" / ")}.` : "") + (blocked.length ? ` 경고: 막힌 칸 위 이벤트 ${blocked.join(", ")}.` : ""),
      data: { mapId, kind, seed, start: r.start, buildings: r.buildings.map((d) => ({ name: d.name, kit: d.kit, rect: d.rect, doors: d.doors, access: d.access })), zones: r.zones, props: r.props.length },
    };
  },
};

export const COMPOSE_DESERT_EAST_ROOM_TOOL: ToolDefinition = {
  name: "compose_desert_east_room",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "사막·동양풍 칩셋(desert_east) 실내 방 한 장을 짠다(맵 크기 = 방 크기, 맨 윗줄 천장·그 아래 두 줄 벽면·가장자리 천장 테·맨 아랫줄 가운데 문 틈). "
    + "kind: teahouse 찻집(디완·찻상·방석·사모바르 찻대·물담배·양탄자, 12×9 이상) · shop 바자르 가게(그릇 선반·계산대·향신료 자루·양탄자 더미, 10×8 이상) · "
    + "palace_hall 궁전 알현실(옥좌·화로대·금틀 긴 의자·기둥 두 줄·실내 분수, 16×13 이상) · tomb 피라미드 묘실(좁은 통로 + 석관·단지·사자 좌상·제물 상·보물 궤·화톳대·모래 더미, 13×16 이상) · "
    + "hammam 목욕탕(타일 탕·세면 대야·대리석 걸상·수건걸이, 12×10 이상) · inn 여관 방(침상 줄·궤짝·선반·화덕, 12×9 이상). 방은 24×20 이하. "
    + "문에서 모든 빈 바닥이 닿는지 확인하고 안 되면 맵을 바꾸지 않는다. 결과 data.doors(맨 아랫줄 문 틈)에서 link_desert_east_interior 가 나가는 이동을 만든다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 desert_east 여야 하고 크기가 방 크기다" },
      kind: { type: "string", enum: ROOM_KINDS, description: "teahouse | shop | palace_hall | tomb | hammam | inn" },
      seed: { type: "integer", minimum: 0, description: "배치 씨앗(생략 0)" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 짠다" },
    },
    required: ["kind"],
    additionalProperties: false,
  },
  invalidArgsExample: { kind: "teahouse", seed: 1 },
  run(draft: Project, args): ToolExecResult {
    const { mapId, map, tileset } = targetMap(draft, args);
    const kind = ROOM_KINDS.find((k) => k === args.kind);
    if (!kind) throw new ToolError(`kind 는 ${ROOM_KINDS.join("·")} 중 하나다`, { code: "invalid-args" });
    const min = DESERT_ROOM_MIN[kind];
    if (map.width < min.w || map.height < min.h || map.width > DESERT_ROOM_MAX.w || map.height > DESERT_ROOM_MAX.h)
      throw new ToolError(`맵 크기 ${map.width}×${map.height} — ${DESERT_ROOM_LABEL[kind]}는 ${min.w}×${min.h} 이상 ${DESERT_ROOM_MAX.w}×${DESERT_ROOM_MAX.h} 이하로 resize_map 한다`, { code: "map-size", mapId });
    if (!isUntouched(map) && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 다시 짜려면 replace:true", { code: "map-not-blank", mapId });
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 0;
    let r;
    try { r = composeDesertRoom({ width: map.width, height: map.height, kind, seed }, desertPaletteFromTileset(tileset, pieces)); }
    catch (e) { throw new ToolError(`${DESERT_ROOM_LABEL[kind]}를 짜지 못했다 — ${(e as Error).message}`, { code: "compose-failed", mapId }); }
    const next = structuredClone(draft);
    const target = writeLayers(next, mapId, r.lower, r.upper);
    if (!walkable(next, target, r.start.x, r.start.y)) throw new ToolError(`문 안쪽 칸 (${r.start.x},${r.start.y}) 이 막혔다 — seed 를 바꾼다`, { code: "compose-failed", mapId });
    for (const c of r.doors) if (!walkable(next, target, c.x, c.y)) throw new ToolError(`문 틈 (${c.x},${c.y}) 이 막혔다`, { code: "compose-failed", mapId });
    draft.maps[mapId] = target;
    return {
      summary: `${DESERT_ROOM_LABEL[kind]}를 ${map.width}×${map.height} 맵(${mapId})에 짰다(seed ${seed}) — 가구 ${r.props.length}개, 문 틈 ${r.doors.map((c) => `(${c.x},${c.y})`).join(" ")}. 야외 건물 문과 link_desert_east_interior 로 잇는다.`,
      data: { mapId, kind, seed, doors: r.doors, start: r.start, props: r.props.length },
    };
  },
};

function gateEvent(id: string, name: string, at: Cell, to: { mapId: string; x: number; y: number }): GameEvent {
  return {
    id, x: at.x, y: at.y, name, trigger: { kind: "playerTouch" }, commands: [],
    pages: [{ id: `${id}_page`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId: to.mapId as MapId, x: to.x, y: to.y, fade: "black" }] }],
  } as GameEvent;
}
function uniqueEventId(project: Project, base: string): string {
  const used = new Set(Object.values(project.maps).flatMap((m) => (m.events ?? []).map((e) => e.id)));
  let id = base, n = 2;
  while (used.has(id)) id = `${base}_${n++}`;
  return id;
}
/** 실내 맵 맨 아래 줄 출입구 틈(걸음 칸 덩이) — 덩이 수와 칸. */
function interiorExit(project: Project, map: GameMap): { runs: number; cells: Cell[] } {
  const y = map.height - 1; const runs: Cell[][] = [];
  for (let x = 0; x < map.width; x++) {
    if (!isPassable(project, map, x, y)) continue;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1]!.x === x - 1) last.push({ x, y }); else runs.push([{ x, y }]);
  }
  return { runs: runs.length, cells: runs.length === 1 ? runs[0]! : [] };
}

export const LINK_DESERT_EAST_INTERIOR_TOOL: ToolDefinition = {
  name: "link_desert_east_interior",
  mode: "write",
  domains: ["map", "event"],
  fillsCurrentMapId: true,
  description: "사막·동양풍(desert_east) 야외 건물의 문과 이미 지은 실내 맵(compose_desert_east_room)을 왕복 이동으로 잇는다. 거리(바깥) 쪽은 문 바로 아래 접근칸에 들어가는 발판, 실내 쪽은 맨 아래 출입구 틈에 나오는 발판을 만든다(막힌 문 칸에는 이벤트를 두지 않는다 — create_transfer_pair 를 따로 부르지 않는다). "
    + "door = compose_desert_east_map 결과 data.buildings[].doors 의 칸(막힌 문 칸) 또는 접근칸. 문이 두 칸이면 width:2. 실내 평면의 남쪽 출입구 틈은 한 군데(1~4칸)여야 한다. 문 앞에 다른 이벤트가 있으면 거부한다(replace:true 면 바꾼다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "야외 사막·동양풍 맵 id. 생략하면 지금 보는 맵" },
      door: { type: "object", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"], additionalProperties: false, description: "건물 문 칸(가장 왼쪽 칸) 또는 문 바로 아래 접근칸" },
      width: { type: "integer", minimum: 1, maximum: 4, description: "문 칸 수(기본 1)" },
      interiorMapId: { type: "string", description: "이미 지은 실내 맵 id" },
      replace: { type: "boolean", description: "문 앞·출입구 틈의 기존 이벤트를 바꾼다" },
    },
    required: ["door", "interiorMapId"],
    additionalProperties: false,
  },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 야외 사막·동양풍 맵 id 를 준다", { code: "map-not-found" });
    const outer = requireMap(draft, mapId);
    if (!isDesertEastTilesetDef(draft.tilesets[outer.tilesetId])) throw new ToolError(`맵 ${mapId} 의 칩셋 ${outer.tilesetId} 는 desert_east 가 아니다 — 사막·동양풍 야외 맵에서만 쓴다`, { code: "tileset-family-mismatch", mapId });
    const interiorId = typeof args.interiorMapId === "string" ? args.interiorMapId.trim() : "";
    const interior = requireMap(draft, interiorId);
    if (interior.id === outer.id) throw new ToolError("실내 맵이 야외 맵과 같다", { code: "invalid-args" });
    const d = args.door as { x: number; y: number };
    const width = Number.isInteger(args.width) ? Math.max(1, Math.min(4, Number(args.width))) : 1;
    const replace = args.replace === true;
    const fronts: Cell[] = [];
    for (let i = 0; i < width; i++) {
      const c = { x: Number(d.x) + i, y: Number(d.y) };
      if (!inside(outer, c)) throw new ToolError(`문 칸 (${c.x},${c.y}) 이 맵 밖이다`, { code: "invalid-args", mapId });
      if (isPassable(draft, outer, c.x, c.y)) {
        const above = { x: c.x, y: c.y - 1 };
        if (!inside(outer, above) || isPassable(draft, outer, above.x, above.y)) throw new ToolError(`(${c.x},${c.y}) 는 건물 문 칸도, 문 바로 아래 접근칸도 아니다 — compose_desert_east_map 결과의 문 칸을 준다`, { code: "not-a-door", mapId });
        fronts.push(c);
      } else {
        const front = { x: c.x, y: c.y + 1 };
        if (!inside(outer, front) || !isPassable(draft, outer, front.x, front.y)) throw new ToolError(`문 (${c.x},${c.y}) 바로 아래 (${front.x},${front.y}) 가 걸을 수 없다 — 문 앞 포석을 먼저 깐다`, { code: "DOOR_BLOCKED", mapId });
        fronts.push(front);
      }
    }
    const olds = fronts.map((c) => eventAt(outer, c)).filter((e): e is GameEvent => !!e);
    if (olds.length && !replace) throw new ToolError(`문 앞 ${olds.map((e) => `(${e.x},${e.y})`).join(" ")} 에 이미 이벤트가 있다 — replace:true 로 바꾼다`, { code: "door-event-exists", mapId });
    const front = fronts[Math.floor((fronts.length - 1) / 2)]!;
    const outLanding = [{ x: front.x, y: front.y + 1 }, { x: front.x - 1, y: front.y + 1 }, { x: front.x + 1, y: front.y + 1 }, { x: front.x, y: front.y + 2 }].find((c) => inside(outer, c) && isPassable(draft, outer, c.x, c.y) && !eventAt(outer, c));
    if (!outLanding) throw new ToolError(`문 앞 (${front.x},${front.y}) 둘레에 나와서 설 칸이 없다 — 문 앞 포석을 두 줄 이상 깐다`, { code: "no-exterior-landing", mapId });
    const exit = interiorExit(draft, interior);
    if (exit.runs > 1) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄에 걸음 칸 덩이가 ${exit.runs}군데라 정문을 고를 수 없다 — 출입구 틈 하나만 남긴다`, { code: "interior-exit-ambiguous", mapId: interiorId });
    if (!exit.cells.length) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄에 걸을 수 있는 출입구 틈이 없다 — compose_desert_east_room 으로 지은 방인지 확인한다`, { code: "no-interior-exit", mapId: interiorId });
    if (exit.cells.length > 4) throw new ToolError(`실내 출입구 틈이 ${exit.cells.length}칸이다 — 4칸 이하로 줄인다`, { code: "interior-exit-too-wide", mapId: interiorId });
    const taken = exit.cells.map((c) => eventAt(interior, c)).filter((e): e is GameEvent => !!e);
    if (taken.length && !replace) throw new ToolError(`실내 출입구 틈 ${taken.map((e) => `(${e.x},${e.y})`).join(" ")} 에 이미 이벤트가 있다 — replace:true 면 바꾼다`, { code: "exit-event-exists", mapId: interiorId });
    let walk = 0;
    for (let y = 0; y < interior.height; y++) for (let x = 0; x < interior.width; x++) if (isPassable(draft, interior, x, y)) walk++;
    const mid = exit.cells[Math.floor(exit.cells.length / 2)]!;
    const exitSet = new Set(exit.cells.map((c) => `${c.x},${c.y}`));
    const inLanding = [{ x: mid.x, y: mid.y - 1 }, ...exit.cells.map((c) => ({ x: c.x, y: c.y - 1 })), ...exit.cells.map((c) => ({ x: c.x, y: c.y - 2 }))]
      .find((c) => inside(interior, c) && isPassable(draft, interior, c.x, c.y) && !exitSet.has(`${c.x},${c.y}`) && !eventAt(interior, c) && reachable(draft, interior, c).size * 2 >= walk);
    if (!inLanding) throw new ToolError("실내 출입구 틈 바로 위(두 칸까지)가 막혔거나 방 안으로 이어지지 않는다 — 현관 안쪽 칸을 비운다", { code: "no-interior-landing", mapId: interiorId });
    if (olds.length) outer.events = (outer.events ?? []).filter((e) => !olds.includes(e));
    if (taken.length) interior.events = (interior.events ?? []).filter((e) => !taken.includes(e));
    const enter: string[] = [], leave: string[] = [];
    for (const c of fronts) { const id = uniqueEventId(draft, `ev_de_enter_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`); enter.push(id); outer.events = [...(outer.events ?? []), gateEvent(id, `${interior.name} 들어가기`, c, { mapId: interiorId, ...inLanding })]; }
    for (const c of exit.cells) { const id = uniqueEventId(draft, `ev_de_exit_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`); leave.push(id); interior.events = [...(interior.events ?? []), gateEvent(id, `${outer.name} 로 나가기`, c, { mapId, ...outLanding })]; }
    const node = extractTreeNode(draft.mapTree, interiorId as MapId);
    if (node && !insertTreeNode(draft.mapTree, node, mapId as MapId)) insertTreeNode(draft.mapTree, node, "");
    return {
      summary: `${outer.name} 문 앞 ${fronts.map((c) => `(${c.x},${c.y})`).join(" ")} ↔ ${interior.name}: 들어가면 실내 (${inLanding.x},${inLanding.y}), 실내 출입구 ${exit.cells.map((c) => `(${c.x},${c.y})`).join(" ")} 에서 나오면 야외 (${outLanding.x},${outLanding.y})`,
      data: { mapId, fronts, interiorMapId: interiorId, enterEventIds: enter, exitEventIds: leave, entryLanding: inLanding, exitCells: exit.cells, exitLanding: outLanding },
    };
  },
};

export const DESERT_EAST_TOOLS: readonly ToolDefinition[] = [COMPOSE_DESERT_EAST_MAP_TOOL, COMPOSE_DESERT_EAST_ROOM_TOOL, LINK_DESERT_EAST_INTERIOR_TOOL];
