// 선사 시대 원시 세계(prehistoric) 구성 도구 — compose_prehistoric_map(부족 마을·늪지·화산 골짜기·화석 계곡·실내 넷 한 장), link_prehistoric_interior(집·동굴 문 ↔ 실내 맵).
// 배치는 구성기 src/project/prehistoricComposer.ts 가 짠다(땅 계획 → 빈터 → 집·동굴 → 길 → 소품, 씨앗마다 다른 배치, 소품마다 BFS 연결 검사, 바닥은 꼭짓점 가장자리).
// 이 도구는 그 결과를 맵에 쓰고, 문 칸은 막힘·접근칸은 걸을 수 있음·시작 칸에서 모든 접근칸(실내는 출구)에 닿는지를 엔진 통행(isPassable)으로 다시 확인한다. 실패하면 맵을 바꾸지 않는다.
// 모양은 다른 테마 구성 도구(steampunk·gothic)와 같다.
import { COMPOSED_LAYOUT_TAG } from "@/ai/piAgent/layoutQuality";
import { isPrehistoricTilesetDef, PREHISTORIC_TILESET_ID } from "@/ai/prehistoricPolicy";
import { isPassable } from "@/project/collision";
import { setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { addMapLocation } from "@/project/mapNamedLocations";
import { extractTreeNode, insertTreeNode } from "@/project/mapTree";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import {
  PREHISTORIC_MIN_SIZE, PREHISTORIC_OUTDOOR_STYLES, PREHISTORIC_ROOM_STYLES, composePrehistoric, prehistoricPaletteFromTileset, type PrehistoricStyle,
} from "@/project/prehistoricComposer";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
import { claimStartIfBlank } from "./composerStart";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Cell = { readonly x: number; readonly y: number };
const ALL_STYLES: readonly string[] = [...PREHISTORIC_OUTDOOR_STYLES, ...PREHISTORIC_ROOM_STYLES];
/** newMap 기본 크기(최소 크기보다 조금 넉넉하게). */
const DEFAULT_SIZE: Readonly<Record<PrehistoricStyle, { w: number; h: number }>> = {
  village: { w: 48, h: 36 }, swamp: { w: 44, h: 34 }, volcano: { w: 44, h: 34 }, fossil: { w: 46, h: 34 },
  "cave-dwelling": { w: 18, h: 13 }, "cave-gallery": { w: 24, h: 12 }, "chieftain-hut": { w: 16, h: 13 }, "shaman-hut": { w: 13, h: 11 },
};
const STYLE_KO: Readonly<Record<PrehistoricStyle, string>> = {
  village: "원시 부족 마을", swamp: "원시 늪지", volcano: "화산 골짜기", fossil: "공룡 화석 계곡", "cave-dwelling": "동굴 거처", "cave-gallery": "동굴 벽화 회랑", "chieftain-hut": "족장 집 안", "shaman-hut": "무당 천막 안",
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

export const COMPOSE_PREHISTORIC_MAP_TOOL: ToolDefinition = {
  name: "compose_prehistoric_map",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "선사 시대 원시 세계 칩셋(prehistoric) 맵 한 장을 통째로 짠다(구성기 — 씨앗마다 다른 배치). 바닥 가장자리·집·소품 자리·문 앞 비움·통행은 도구가 정한다. "
    + "야외 style: village = 풀밭 바탕 + 모닥불 광장(화톳불·돌 의자·북·토템) + 족장 긴 집·이엉/통나무 움집·가죽 천막·뼈 집·무당 천막 + 숲가 동굴 입구 + 작업터(건조대·가죽 틀·장작) + 개울과 밧줄 다리 + 통나무 울타리 문(44×34 이상); "
    + "swamp = 진흙 늪(웅덩이·둑길) + 흙 섬 움집 + 늪 나무·갈대·연잎·타르 웅덩이(40×30 이상); volcano = 작은 화산 + 용암 웅덩이·굳은 용암·현무암 + 재 오솔길 + 현무암 동굴 + 사냥 야영지(40×32 이상); "
    + "fossil = 바위 능선 계곡 + 긴 목 공룡 뼈대 발굴터 + 갈비뼈·머리뼈 화석 + 발자국 진흙 + 타르 웅덩이 + 발굴 야영지 천막 + 동굴(42×32 이상). "
    + "실내 style: cave-dwelling 동굴 거처 · cave-gallery 동굴 벽화 회랑 · chieftain-hut 족장 집 안 · shaman-hut 무당 천막 안(남쪽 출입구 틈 2칸). "
    + "newMap:{name} 을 주면 칩셋·크기를 맞춘 새 맵을 만들어 거기에 짓는다(지금 맵이 다른 칩셋이어도 된다) — 실내는 지금 보는 맵 밑에 붙는다. "
    + "결과 data.buildings[].doors(막힌 문 칸)를 link_prehistoric_interior 에 준다. 시작 칸에서 모든 문 접근칸(실내는 출구)에 닿는지 엔진 통행으로 확인하고, 안 되면 맵을 바꾸지 않는다. 손댄 맵은 replace:true 여야 다시 깐다(이벤트는 남는다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). newMap 이 있으면 새 맵의 부모" },
      style: { type: "string", enum: [...ALL_STYLES], description: "village | swamp | volcano | fossil | cave-dwelling | cave-gallery | chieftain-hut | shaman-hut" },
      newMap: { type: "object", properties: { name: { type: "string" }, width: { type: "integer" }, height: { type: "integer" } }, required: ["name"], additionalProperties: false, description: "새 맵을 만들어 짓는다. 크기는 생략을 권한다 — style 기본 크기가 가장 알차다(크게 잡아도 집·광장은 늘지 않고 빈 땅이 숲·바위 무리로 채워질 뿐이다)" },
      seed: { type: "integer", minimum: 0, description: "배치 씨앗(생략 0)" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 깐다" },
    },
    required: ["style"],
    additionalProperties: false,
  },
  invalidArgsExample: { style: "village", newMap: { name: "원시 부족 마을" }, seed: 1 },
  run(draft: Project, args): ToolExecResult {
    const style = typeof args.style === "string" && ALL_STYLES.includes(args.style) ? args.style as PrehistoricStyle : null;
    if (!style) throw new ToolError(`style 은 ${ALL_STYLES.join("|")} 중 하나다`, { code: "invalid-args" });
    const tileset = draft.tilesets[PREHISTORIC_TILESET_ID];
    if (!tileset || !isPrehistoricTilesetDef(tileset)) throw new ToolError("이 프로젝트에 선사 칩셋(prehistoric)이 없다", { code: "tileset-not-found" });
    const min = PREHISTORIC_MIN_SIZE[style];
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 0;
    const pal = prehistoricPaletteFromTileset(tileset);
    const parentId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    const nm = args.newMap as { name?: unknown; width?: unknown; height?: unknown } | undefined;
    let mapId = parentId;
    let created: GameMap | null = null;
    if (nm && typeof nm === "object") {
      const name = typeof nm.name === "string" && nm.name.trim() ? nm.name.trim() : STYLE_KO[style];
      const w = Number.isInteger(nm.width) ? Math.max(min.w, Number(nm.width)) : DEFAULT_SIZE[style].w;
      const h = Number.isInteger(nm.height) ? Math.max(min.h, Number(nm.height)) : DEFAULT_SIZE[style].h;
      created = createBlankMap(name, w, h, PREHISTORIC_TILESET_ID, tileset.tileSize, tileset);
      mapId = created.id;
    }
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 선사 맵 id 를 주거나 newMap:{name} 으로 새 맵을 만든다", { code: "map-not-found" });
    const map = created ?? requireMap(draft, mapId);
    if (!created && !isPrehistoricTilesetDef(draft.tilesets[map.tilesetId])) throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 선사 칩셋(prehistoric)가 아니다 — newMap:{name} 을 주면 새 선사 맵을 만들어 짓는다`, { code: "wrong-tileset", mapId });
    if (map.width < min.w || map.height < min.h) throw new ToolError(`맵이 작다(${map.width}×${map.height}) — ${style} 는 ${min.w}×${min.h} 이상이어야 한다. resize_map 하거나 newMap 으로 새로 만든다`, { code: "map-too-small", mapId });
    if (!created && !isUntouched(map) && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 지우고 다시 깔려면 replace:true 를 준다(이벤트는 남는다)", { code: "map-not-blank", mapId });
    let r;
    try { r = composePrehistoric({ width: map.width, height: map.height, style, seed }, pal); }
    catch (e) { throw new ToolError(`선사 맵을 짜지 못했다 — ${(e as Error).message}`, { code: "compose-failed", mapId }); }

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
    if (errs.length) throw new ToolError(`선사 맵을 깔지 못했다 — ${errs.slice(0, 4).join(" / ")}. seed 를 바꾸거나 buildings 를 줄여 다시 부른다`, { code: "compose-failed", mapId });
    target.locations = (target.locations ?? []).filter((l) => !(l.tags ?? []).some((t) => t === "prehistoric-building" || t === "prehistoric-zone"));
    for (const d of r.buildings) {
      const door = d.doors[0]!;
      addMapLocation(target, { name: `${d.name}`, x: d.rect.x, y: d.rect.y, w: d.rect.w, h: d.rect.h, note: `문 (${door.x},${door.y}) 외 ${d.doors.length - 1}칸 · 접근칸 (${d.access[0]!.x},${d.access[0]!.y}) — 실내는 compose_prehistoric_map({style:"cave-dwelling"|"chieftain-hut"|"shaman-hut"|"cave-gallery", newMap}) 으로 짓고 link_prehistoric_interior 로 잇는다`, tags: ["prehistoric-building", d.kit] });
    }
    for (const z of r.zones) addMapLocation(target, { name: z.name, ...z.rect, note: z.use, tags: ["prehistoric-zone", COMPOSED_LAYOUT_TAG] });
    if (created) {
      const parent = parentId && next.maps[parentId] ? parentId : "";
      if (!insertTreeNode(next.mapTree, { mapId: mapId as MapId, children: [] }, parent as MapId)) insertTreeNode(next.mapTree, { mapId: mapId as MapId, children: [] }, "" as MapId);
      if (!next.maps[next.mapTree.mapId]) next.mapTree = { mapId: mapId as MapId, children: [] };
    }
    const blocked = (target.events ?? []).filter((e) => !walkable(next, target, e.x, e.y)).map((e) => `${e.name ?? e.id}(${e.x},${e.y})`);
    if (created) { draft.maps[mapId] = target; draft.mapTree = next.mapTree; }
    else draft.maps[mapId] = target;
    const indoor = (PREHISTORIC_ROOM_STYLES as readonly string[]).includes(style);
    const startClaim = indoor ? { claimed: false, note: "" } : claimStartIfBlank(draft, mapId, r.start);
    return {
      summary: `「${STYLE_KO[style]}」 한 장을 ${map.width}×${map.height} 맵 '${target.name}'(${mapId})에 짰다(seed ${seed}${created ? ", 새 맵" : ""}) — 집·동굴 ${r.buildings.length}채, 소품 ${r.props.length}개, 구역 ${r.zones.map((z) => z.name).join("·")}. `
        + (indoor ? `출구 ${r.exits.map((c) => `(${c.x},${c.y})`).join(" ")} 에서 방 안 모든 바닥에 닿음(엔진 통행). 집·동굴 문과 잇기: link_prehistoric_interior({mapId:<야외>, door, width, interiorMapId:"${mapId}"}).`
          : `시작 칸 (${r.start.x},${r.start.y}) 에서 모든 문 접근칸에 닿음(엔진 통행). 문: ${r.buildings.map((d) => `${d.name} (${d.doors.map((c) => `${c.x},${c.y}`).join(" · ")})`).join(" · ")}.`)
        + startClaim.note
        + (r.notes.length ? ` 참고: ${r.notes.join(" / ")}.` : "") + (blocked.length ? ` 경고: 막힌 칸 위 이벤트 ${blocked.join(", ")}.` : ""),
      data: { mapId, created: !!created, style, seed, start: r.start, startClaimed: startClaim.claimed, exits: r.exits, zones: r.zones, buildings: r.buildings.map((d) => ({ name: d.name, kit: d.kit, rect: d.rect, doors: d.doors, access: d.access })), props: r.props.length },
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

export const LINK_PREHISTORIC_INTERIOR_TOOL: ToolDefinition = {
  name: "link_prehistoric_interior",
  mode: "write",
  domains: ["map", "event"],
  fillsCurrentMapId: true,
  description: "선사 칩셋(prehistoric) 야외 집·동굴의 문과 이미 지은 실내 맵(compose_prehistoric_map 실내 style)을 왕복 이동으로 잇는다. 바깥은 문 바로 아래 접근칸에 들어가는 발판, 실내는 맨 아래 출입구 틈에 나오는 발판을 만든다(막힌 문 칸에는 이벤트를 두지 않는다 — create_transfer_pair 를 따로 부르지 않는다). "
    + "door = compose_prehistoric_map 결과 data.buildings[].doors 의 가장 왼쪽 칸(또는 접근칸), 문이 두 칸이면 width:2. 문 앞에 다른 이벤트가 있으면 거부한다(replace:true 면 바꾼다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "야외 선사 맵 id. 생략하면 지금 보는 맵" },
      door: { type: "object", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"], additionalProperties: false, description: "집·동굴 문 칸(가장 왼쪽) 또는 문 바로 아래 접근칸" },
      width: { type: "integer", minimum: 1, maximum: 4, description: "문 칸 수(기본 1)" },
      interiorMapId: { type: "string", description: "이미 지은 실내 맵 id" },
      replace: { type: "boolean", description: "문 앞·출입구 틈의 기존 이벤트를 바꾼다" },
    },
    required: ["door", "interiorMapId"],
    additionalProperties: false,
  },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 야외 선사 맵 id 를 준다", { code: "map-not-found" });
    const outer = requireMap(draft, mapId);
    if (!isPrehistoricTilesetDef(draft.tilesets[outer.tilesetId])) throw new ToolError(`맵 ${mapId} 의 칩셋 ${outer.tilesetId} 는 prehistoric 이 아니다 — 선사 야외 맵에서만 쓴다`, { code: "tileset-family-mismatch", mapId });
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
        if (!inside(outer, above) || isPassable(draft, outer, above.x, above.y)) throw new ToolError(`(${c.x},${c.y}) 는 집·동굴 문 칸도, 문 바로 아래 접근칸도 아니다 — compose 결과의 문 칸을 준다`, { code: "not-a-door", mapId });
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
    if (!exit.cells.length) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄에 걸을 수 있는 출입구 틈이 없다 — compose_prehistoric_map 의 실내 style 로 지은 맵을 준다`, { code: "no-interior-exit", mapId: interiorId });
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
    for (const c of fronts) { const id = uniqueEventId(draft, `ev_ph_enter_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`); enter.push(id); outer.events = [...(outer.events ?? []), gateEvent(id, `${interior.name} 들어가기`, c, { mapId: interiorId, ...inLanding })]; }
    for (const c of exit.cells) { const id = uniqueEventId(draft, `ev_ph_exit_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`); leave.push(id); interior.events = [...(interior.events ?? []), gateEvent(id, `${outer.name} 로 나가기`, c, { mapId, ...outLanding })]; }
    const node = extractTreeNode(draft.mapTree, interiorId as MapId);
    if (node && !insertTreeNode(draft.mapTree, node, mapId as MapId)) insertTreeNode(draft.mapTree, node, "");
    return {
      summary: `${outer.name} 문 앞 ${fronts.map((c) => `(${c.x},${c.y})`).join(" ")} ↔ ${interior.name}: 들어가면 실내 (${inLanding.x},${inLanding.y}), 실내 출입구 ${exit.cells.map((c) => `(${c.x},${c.y})`).join(" ")} 에서 나오면 야외 (${outLanding.x},${outLanding.y})`,
      data: { mapId, fronts, interiorMapId: interiorId, enterEventIds: enter, exitEventIds: leave, entryLanding: inLanding, exitCells: exit.cells, exitLanding: outLanding },
    };
  },
};

export const PREHISTORIC_TOOLS: readonly ToolDefinition[] = [COMPOSE_PREHISTORIC_MAP_TOOL, LINK_PREHISTORIC_INTERIOR_TOOL];
