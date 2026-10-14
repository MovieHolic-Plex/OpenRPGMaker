// 북방 설원(snow_north) 구성 도구 — compose_snow_north_map(마을·얼어붙은 호수·얼음 동굴 입구·겨울 장터·실내 다섯 한 장), link_snow_north_interior(집 문 ↔ 실내 맵).
// 배치는 구성기 src/project/snowNorthComposer.ts 가 짠다(땅 계획 → 덩이(오토타일) → 집 → 길 → 소품, 씨앗마다 다른 배치, 소품마다 BFS 연결 검사).
// 이 도구는 그 결과를 맵에 쓰고, 문 칸은 막힘·접근칸은 걸을 수 있음·시작 칸에서 모든 접근칸(실내는 출구)에 닿는지를 엔진 통행(isPassable)으로 다시 확인한다. 실패하면 맵을 바꾸지 않는다.
// 모양은 prehistoricTools 와 같다.
import { isSnowNorthTilesetDef, SNOW_NORTH_TILESET_ID } from "@/ai/snowNorthPolicy";
import { isPassable } from "@/project/collision";
import { setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import { extractTreeNode, insertTreeNode } from "@/project/mapTree";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import {
  SNOW_NORTH_MIN_SIZE, SNOW_NORTH_OUTDOOR_STYLES, SNOW_NORTH_ROOM_STYLES, composeSnowNorth, snowNorthPaletteFromTileset, type SnowNorthStyle,
} from "@/project/snowNorthComposer";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Cell = { readonly x: number; readonly y: number };
const ALL_STYLES: readonly string[] = [...SNOW_NORTH_OUTDOOR_STYLES, ...SNOW_NORTH_ROOM_STYLES];
/** newMap 기본 크기(최소 크기보다 조금 넉넉하게). */
const DEFAULT_SIZE: Readonly<Record<SnowNorthStyle, { w: number; h: number }>> = {
  village: { w: 46, h: 36 }, lake: { w: 42, h: 32 }, cave: { w: 38, h: 30 }, market: { w: 42, h: 32 },
  cabin: { w: 12, h: 10 }, longhall: { w: 20, h: 12 }, tavern: { w: 16, h: 12 }, sauna: { w: 11, h: 9 }, "ice-cave": { w: 18, h: 12 },
};
const STYLE_KO: Readonly<Record<SnowNorthStyle, string>> = {
  village: "눈 덮인 북방 마을", lake: "얼어붙은 호수 낚시터", cave: "얼음 동굴 입구", market: "겨울 장터", cabin: "통나무 오두막 안", longhall: "씨족 회관 안", tavern: "선술집 안", sauna: "사우나 안", "ice-cave": "얼음 동굴 안",
};

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

export const COMPOSE_SNOW_NORTH_MAP_TOOL: ToolDefinition = {
  name: "compose_snow_north_map",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "북방 설원 칩셋(snow_north) 맵 한 장을 통째로 짠다(구성기 — 씨앗마다 다른 배치). 덩이 가장자리(오토타일)·집·소품 자리·문 앞 비움·통행은 도구가 정한다. "
    + "야외 style: village = 눈밭 + 북쪽 가문비 숲 띠 + 통나무 목책 고리와 남쪽 문루 + 다진 눈 광장(화로·우물·이정표) + 회관·통널 교회·오두막·대장간·창고·사우나·훈제막(굴뚝 연기) + 집 마당(장작·썰매·스키 걸이) + 얼음 못(44×34 이상); "
    + "lake = 얼어붙은 호수(얼음 덩이, 낚시 구멍 1×1~2×1) + 낚시 오두막·얼음 낚시 자리 + 호숫가 생선 건조대·뒤집힌 배·갈대 + 숲(40×30 이상); "
    + "cave = 북쪽 바위 능선 + 얼음 동굴 입구 + 얼어붙은 폭포와 여울 + 동굴로 가는 길 + 길가 야영지(천막·모닥불·가마솥)(36×28 이상); market = 진창·다진 눈 장터 마당 + 노점(생선·모피·잡화)·상자·통·자루 + 회관·오두막 + 화로(40×30 이상). "
    + "실내 style: cabin 통나무 오두막 · longhall 씨족 회관 · tavern 선술집 · sauna 사우나 · ice-cave 얼음 동굴 안(남쪽 출입구 2칸). "
    + "newMap:{name} 을 주면 칩셋·크기를 맞춘 새 맵을 만들어 거기에 짓는다(지금 맵이 다른 칩셋이어도 된다) — 실내는 지금 보는 맵 밑에 붙는다. "
    + "결과 data.buildings[].doors(막힌 문 칸)를 link_snow_north_interior 에 준다. 시작 칸에서 모든 문 접근칸(실내는 출구)에 닿는지 엔진 통행으로 확인하고, 안 되면 맵을 바꾸지 않는다. 손댄 맵은 replace:true 여야 다시 깐다(이벤트는 남는다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). newMap 이 있으면 새 맵의 부모" },
      style: { type: "string", enum: [...ALL_STYLES], description: "village | lake | cave | market | cabin | longhall | tavern | sauna | ice-cave" },
      newMap: { type: "object", properties: { name: { type: "string" }, width: { type: "integer" }, height: { type: "integer" } }, required: ["name"], additionalProperties: false, description: "새 맵을 만들어 짓는다. 크기는 생략한다 — style 기본 크기가 가장 알차다(집·광장 수는 늘지 않는다). 주더라도 기본 크기 + 8 칸에서 잘린다" },
      seed: { type: "integer", minimum: 0, description: "배치 씨앗(생략 0)" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 깐다" },
    },
    required: ["style"],
    additionalProperties: false,
  },
  invalidArgsExample: { style: "village", newMap: { name: "눈 덮인 북방 마을" }, seed: 1 },
  run(draft: Project, args): ToolExecResult {
    const style = typeof args.style === "string" && ALL_STYLES.includes(args.style) ? args.style as SnowNorthStyle : null;
    if (!style) throw new ToolError(`style 은 ${ALL_STYLES.join("|")} 중 하나다`, { code: "invalid-args" });
    const tileset = draft.tilesets[SNOW_NORTH_TILESET_ID];
    if (!tileset || !isSnowNorthTilesetDef(tileset)) throw new ToolError("이 프로젝트에 북방 설원 칩셋(snow_north)이 없다", { code: "tileset-not-found" });
    const min = SNOW_NORTH_MIN_SIZE[style];
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 0;
    const pal = snowNorthPaletteFromTileset(tileset);
    const parentId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    const nm = args.newMap as { name?: unknown; width?: unknown; height?: unknown } | undefined;
    let mapId = parentId;
    let created: GameMap | null = null;
    if (nm && typeof nm === "object") {
      const name = typeof nm.name === "string" && nm.name.trim() ? nm.name.trim() : STYLE_KO[style];
      // 크기는 기본 크기 + 8 칸까지만 — 구성기는 집·광장 수를 늘리지 않아 큰 맵은 빈 눈밭만 넓어진다(실측: 조수가 64×40 을 골라 마을이 성겼다).
      const cap = (n: number, lo: number, d: number) => Math.min(d + 8, Math.max(lo, n));
      const w = Number.isInteger(nm.width) ? cap(Number(nm.width), min.w, DEFAULT_SIZE[style].w) : DEFAULT_SIZE[style].w;
      const h = Number.isInteger(nm.height) ? cap(Number(nm.height), min.h, DEFAULT_SIZE[style].h) : DEFAULT_SIZE[style].h;
      created = createBlankMap(name, w, h, SNOW_NORTH_TILESET_ID, tileset.tileSize, tileset);
      mapId = created.id;
    }
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 북방 설원 맵 id 를 주거나 newMap:{name} 으로 새 맵을 만든다", { code: "map-not-found" });
    const map = created ?? requireMap(draft, mapId);
    if (!created && !isSnowNorthTilesetDef(draft.tilesets[map.tilesetId])) throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 북방 설원 칩셋(snow_north)이 아니다 — newMap:{name} 을 주면 새 북방 설원 맵을 만들어 짓는다`, { code: "wrong-tileset", mapId });
    if (map.width < min.w || map.height < min.h) throw new ToolError(`맵이 작다(${map.width}×${map.height}) — ${style} 는 ${min.w}×${min.h} 이상이어야 한다. resize_map 하거나 newMap 으로 새로 만든다`, { code: "map-too-small", mapId });
    if (!created && !isUntouched(map) && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 지우고 다시 깔려면 replace:true 를 준다(이벤트는 남는다)", { code: "map-not-blank", mapId });
    let r;
    try { r = composeSnowNorth({ width: map.width, height: map.height, style, seed }, pal); }
    catch (e) { throw new ToolError(`북방 설원 맵을 짜지 못했다 — ${(e as Error).message}`, { code: "compose-failed", mapId }); }

    const next = structuredClone(draft);
    if (created) next.maps[mapId] = structuredClone(created);
    const target = next.maps[mapId]!;
    for (let i = 0; i < target.lowerTiles.length; i++) { setLayerTileAt(target, 3, i, -1); setLayerTileAt(target, 4, i, -1); clearTileStack(target, "upper", i); }
    target.lowerTiles = [...r.lower];
    target.upperTiles = [...r.upper];
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
    for (const c of r.exits) if (!seen.has(c.y * W + c.x)) errs.push(`출구 (${c.x},${c.y}) 에 닿지 못한다`);
    if (errs.length) throw new ToolError(`북방 설원 맵을 깔지 못했다 — ${errs.slice(0, 4).join(" / ")}. seed 를 바꾸거나 buildings 를 줄여 다시 부른다`, { code: "compose-failed", mapId });
    target.locations = (target.locations ?? []).filter((l) => !(l.tags ?? []).some((t) => t === "snow-north-building" || t === "snow-north-zone"));
    for (const d of r.buildings) {
      const door = d.doors[0], acc = d.access[0];
      if (!door || !acc) { addMapLocation(target, { name: `${d.name}`, x: d.rect.x, y: d.rect.y, w: d.rect.w, h: d.rect.h, note: "문 없는 구조물(망루·폭포 등)", tags: ["snow-north-building", d.kit] }); continue; }
      addMapLocation(target, { name: `${d.name}`, x: d.rect.x, y: d.rect.y, w: d.rect.w, h: d.rect.h, note: `문 (${door.x},${door.y}) 외 ${d.doors.length - 1}칸 · 접근칸 (${acc.x},${acc.y}) — 실내는 compose_snow_north_map({style:"cabin"|"longhall"|"tavern"|"sauna"|"ice-cave", newMap}) 으로 짓고 link_snow_north_interior 로 잇는다`, tags: ["snow-north-building", d.kit] });
    }
    for (const z of r.zones) addMapLocation(target, { name: z.name, ...z.rect, note: z.use, tags: ["snow-north-zone", COMPOSED_LAYOUT_TAG] });
    if (created) {
      const parent = parentId && next.maps[parentId] ? parentId : "";
      if (!insertTreeNode(next.mapTree, { mapId: mapId as MapId, children: [] }, parent as MapId)) insertTreeNode(next.mapTree, { mapId: mapId as MapId, children: [] }, "" as MapId);
      if (!next.maps[next.mapTree.mapId]) next.mapTree = { mapId: mapId as MapId, children: [] };
    }
    const blocked = (target.events ?? []).filter((e) => !walkable(next, target, e.x, e.y)).map((e) => `${e.name ?? e.id}(${e.x},${e.y})`);
    if (created) { draft.maps[mapId] = target; draft.mapTree = next.mapTree; }
    else draft.maps[mapId] = target;
    const indoor = (SNOW_NORTH_ROOM_STYLES as readonly string[]).includes(style);
    return {
      summary: `「${STYLE_KO[style]}」 한 장을 ${map.width}×${map.height} 맵 '${target.name}'(${mapId})에 짰다(seed ${seed}${created ? ", 새 맵" : ""}) — 집 ${r.buildings.length}채, 소품 ${r.props.length}개, 구역 ${r.zones.map((z) => z.name).join("·")}. `
        + (indoor ? `출구 ${r.exits.map((c) => `(${c.x},${c.y})`).join(" ")} 에서 방 안 모든 바닥에 닿음(엔진 통행). 집 문과 잇기: link_snow_north_interior({mapId:<야외>, door, width, interiorMapId:"${mapId}"}).`
          : `시작 칸 (${r.start.x},${r.start.y}) 에서 모든 문 접근칸에 닿음(엔진 통행). 문: ${r.buildings.filter((d) => d.doors.length).map((d) => `${d.name} (${d.doors.map((c) => `${c.x},${c.y}`).join(" · ")})`).join(" · ")}.`)
        + (r.notes.length ? ` 참고: ${r.notes.join(" / ")}.` : "") + (blocked.length ? ` 경고: 막힌 칸 위 이벤트 ${blocked.join(", ")}.` : ""),
      data: { mapId, created: !!created, style, seed, start: r.start, exits: r.exits, zones: r.zones, buildings: r.buildings.map((d) => ({ name: d.name, kit: d.kit, rect: d.rect, doors: d.doors, access: d.access })), props: r.props.length },
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
function interiorExit(project: Project, map: GameMap): { runs: number; cells: Cell[] } {
  const y = map.height - 1; const runs: Cell[][] = [];
  for (let x = 0; x < map.width; x++) {
    if (!isPassable(project, map, x, y)) continue;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1]!.x === x - 1) last.push({ x, y }); else runs.push([{ x, y }]);
  }
  return { runs: runs.length, cells: runs.length === 1 ? runs[0]! : [] };
}

export const LINK_SNOW_NORTH_INTERIOR_TOOL: ToolDefinition = {
  name: "link_snow_north_interior",
  mode: "write",
  domains: ["map", "event"],
  fillsCurrentMapId: true,
  description: "북방 설원 칩셋(snow_north) 야외 집의 문과 이미 지은 실내 맵(compose_snow_north_map 실내 style)을 왕복 이동으로 잇는다. 바깥은 문 바로 아래 접근칸에 들어가는 발판, 실내는 맨 아래 출입구 틈에 나오는 발판을 만든다(막힌 문 칸에는 이벤트를 두지 않는다 — create_transfer_pair 를 따로 부르지 않는다). "
    + "door = compose_snow_north_map 결과 data.buildings[].doors 의 가장 왼쪽 칸(또는 접근칸), 문이 두 칸이면 width:2. 문 앞에 다른 이벤트가 있으면 거부한다(replace:true 면 바꾼다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "야외 북방 설원 맵 id. 생략하면 지금 보는 맵" },
      door: { type: "object", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"], additionalProperties: false, description: "집 문 칸(가장 왼쪽) 또는 문 바로 아래 접근칸" },
      width: { type: "integer", minimum: 1, maximum: 4, description: "문 칸 수(기본 1)" },
      interiorMapId: { type: "string", description: "이미 지은 실내 맵 id" },
      replace: { type: "boolean", description: "문 앞·출입구 틈의 기존 이벤트를 바꾼다" },
    },
    required: ["door", "interiorMapId"],
    additionalProperties: false,
  },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 야외 북방 설원 맵 id 를 준다", { code: "map-not-found" });
    const outer = requireMap(draft, mapId);
    if (!isSnowNorthTilesetDef(draft.tilesets[outer.tilesetId])) throw new ToolError(`맵 ${mapId} 의 칩셋 ${outer.tilesetId} 는 snow_north 가 아니다 — 북방 설원 야외 맵에서만 쓴다`, { code: "tileset-family-mismatch", mapId });
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
        if (!inside(outer, above) || isPassable(draft, outer, above.x, above.y)) throw new ToolError(`(${c.x},${c.y}) 는 집 문 칸도, 문 바로 아래 접근칸도 아니다 — compose 결과의 문 칸을 준다`, { code: "not-a-door", mapId });
        fronts.push(c);
      } else {
        const front = { x: c.x, y: c.y + 1 };
        if (!inside(outer, front) || !isPassable(draft, outer, front.x, front.y)) throw new ToolError(`문 (${c.x},${c.y}) 바로 아래 (${front.x},${front.y}) 가 걸을 수 없다 — 문 앞을 비운다`, { code: "DOOR_BLOCKED", mapId });
        fronts.push(front);
      }
    }
    const olds = fronts.map((c) => eventAt(outer, c)).filter((e): e is GameEvent => !!e);
    if (olds.length && !replace) throw new ToolError(`문 앞 ${olds.map((e) => `(${e.x},${e.y})`).join(" ")} 에 이미 이벤트가 있다 — replace:true 로 바꾼다`, { code: "door-event-exists", mapId });
    const front = fronts[Math.floor((fronts.length - 1) / 2)]!;
    const outLanding = [{ x: front.x, y: front.y + 1 }, { x: front.x - 1, y: front.y + 1 }, { x: front.x + 1, y: front.y + 1 }, { x: front.x, y: front.y + 2 }].find((c) => inside(outer, c) && isPassable(draft, outer, c.x, c.y) && !eventAt(outer, c));
    if (!outLanding) throw new ToolError(`문 앞 (${front.x},${front.y}) 둘레에 나와서 설 칸이 없다`, { code: "no-exterior-landing", mapId });
    const exit = interiorExit(draft, interior);
    if (exit.runs > 1) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄에 걸음 칸 덩이가 ${exit.runs}군데라 정문을 고를 수 없다`, { code: "interior-exit-ambiguous", mapId: interiorId });
    if (!exit.cells.length) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄에 걸을 수 있는 출입구 틈이 없다 — compose_snow_north_map 의 실내 style 로 지은 맵을 준다`, { code: "no-interior-exit", mapId: interiorId });
    if (exit.cells.length > 4) throw new ToolError(`실내 출입구 틈이 ${exit.cells.length}칸이다 — 4칸 이하로 줄인다`, { code: "interior-exit-too-wide", mapId: interiorId });
    const taken = exit.cells.map((c) => eventAt(interior, c)).filter((e): e is GameEvent => !!e);
    if (taken.length && !replace) throw new ToolError(`실내 출입구 틈 ${taken.map((e) => `(${e.x},${e.y})`).join(" ")} 에 이미 이벤트가 있다 — replace:true 면 바꾼다`, { code: "exit-event-exists", mapId: interiorId });
    let walk = 0;
    for (let y = 0; y < interior.height; y++) for (let x = 0; x < interior.width; x++) if (isPassable(draft, interior, x, y)) walk++;
    const mid = exit.cells[Math.floor(exit.cells.length / 2)]!;
    const exitSet = new Set(exit.cells.map((c) => `${c.x},${c.y}`));
    const inLanding = [{ x: mid.x, y: mid.y - 1 }, ...exit.cells.map((c) => ({ x: c.x, y: c.y - 1 })), ...exit.cells.map((c) => ({ x: c.x, y: c.y - 2 }))]
      .find((c) => inside(interior, c) && isPassable(draft, interior, c.x, c.y) && !exitSet.has(`${c.x},${c.y}`) && !eventAt(interior, c) && reachable(draft, interior, c).size * 2 >= walk);
    if (!inLanding) throw new ToolError("실내 출입구 틈 바로 위(두 칸까지)가 막혔거나 방 안으로 이어지지 않는다", { code: "no-interior-landing", mapId: interiorId });
    if (olds.length) outer.events = (outer.events ?? []).filter((e) => !olds.includes(e));
    if (taken.length) interior.events = (interior.events ?? []).filter((e) => !taken.includes(e));
    const enter: string[] = [], leave: string[] = [];
    for (const c of fronts) { const id = uniqueEventId(draft, `ev_sn_enter_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`); enter.push(id); outer.events = [...(outer.events ?? []), gateEvent(id, `${interior.name} 들어가기`, c, { mapId: interiorId, ...inLanding })]; }
    for (const c of exit.cells) { const id = uniqueEventId(draft, `ev_sn_exit_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`); leave.push(id); interior.events = [...(interior.events ?? []), gateEvent(id, `${outer.name} 로 나가기`, c, { mapId, ...outLanding })]; }
    const node = extractTreeNode(draft.mapTree, interiorId as MapId);
    if (node && !insertTreeNode(draft.mapTree, node, mapId as MapId)) insertTreeNode(draft.mapTree, node, "");
    return {
      summary: `${outer.name} 문 앞 ${fronts.map((c) => `(${c.x},${c.y})`).join(" ")} ↔ ${interior.name}: 들어가면 실내 (${inLanding.x},${inLanding.y}), 실내 출입구 ${exit.cells.map((c) => `(${c.x},${c.y})`).join(" ")} 에서 나오면 야외 (${outLanding.x},${outLanding.y})`,
      data: { mapId, fronts, interiorMapId: interiorId, enterEventIds: enter, exitEventIds: leave, entryLanding: inLanding, exitCells: exit.cells, exitLanding: outLanding },
    };
  },
};

export const SNOW_NORTH_TOOLS: readonly ToolDefinition[] = [COMPOSE_SNOW_NORTH_MAP_TOOL, LINK_SNOW_NORTH_INTERIOR_TOOL];
