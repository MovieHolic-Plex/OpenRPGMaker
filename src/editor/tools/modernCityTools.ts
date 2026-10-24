// 도쿄풍 도시(modern_city) 조수 도구 — compose_modern_city_street(거리 블록 한 장), link_modern_city_interior(건물 문 ↔ 실내 맵).
// 배치는 구성기 src/project/modernCityStreetComposer.ts 가 짠다(도로 단면·교차로 → 건물 키트 남향 → 공원 → 소품 → 차). 이 도구는 결과를 맵에 쓰고
// 문 칸 막힘·접근칸 걸음·시작 칸에서 모든 접근칸 도달을 엔진 통행(isPassable)으로 다시 확인한다. 실패하면 맵을 바꾸지 않는다.
import { claimStartIfBlank } from "@/editor/tools/composerStart";
import { isModernCityTilesetDef } from "@/ai/modernCityPolicy";
import { isPassable } from "@/project/collision";
import { setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import { extractTreeNode, insertTreeNode } from "@/project/mapTree";
import { composeModernCityStreet, MC_BUILDING_TYPES, MODERN_CITY_STREET_MAX, MODERN_CITY_STREET_MIN, modernCityPaletteFromTileset } from "@/project/modernCityStreetComposer";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
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

/** 가게 낱말 → 건물 종류(키트 mc-bld-<종류>). */
const SHOP_WORDS: readonly [RegExp, string][] = [
  [/편의점|konbini|conv/iu, "conv"], [/카페|커피|cafe/iu, "cafe"], [/은행|bank/iu, "bank"], [/병원|의원|hospital|clinic/iu, "hospital"],
  [/대형\s*오피스|office-wide/iu, "office-wide"], [/사무|오피스|회사|office/iu, "office"], [/호텔|hotel/iu, "hotel"], [/백화점|dept/iu, "dept"],
  [/아파트|apartment|맨션/iu, "apartment"], [/주택|집|house/iu, "house"], [/창고|warehouse/iu, "warehouse"], [/이자카야|술집|izakaya/iu, "izakaya"],
  [/빵집|베이커리|bakery/iu, "bakery"], [/우체국|post/iu, "post"], [/경찰|파출소|police/iu, "police"], [/소방|fire/iu, "fire"], [/주차|parking/iu, "parking"],
  [/상점|가게|shop/iu, "shop"], [/타워|tower/iu, "tower10"],
];
function shopType(word: string): string | null {
  const w = word.trim().replace(/^mc-bld-/, "");
  if (MC_BUILDING_TYPES[w]) return w;
  return SHOP_WORDS.find(([re]) => re.test(w))?.[1] ?? null;
}

export const COMPOSE_MODERN_CITY_STREET_TOOL: ToolDefinition = {
  name: "compose_modern_city_street",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "도쿄풍 도시 칩셋(modern_city) 거리 맵 한 장을 통째로 짠다(구성기 — 씨앗마다 다른 블록). "
    + "가로 도로 1~3줄·세로 도로 1~2줄(6칸 차도 + 노란 중앙선 + 연석 + 보도 2줄), 만나는 곳은 횡단보도·정지선이 있는 교차로, 가로 도로마다 북쪽 띠에 건물 키트를 문이 남쪽 보도로 향하게 세우고(편의점·사무 빌딩·병원·카페·은행·아파트·호텔…), "
    + "블록 하나는 공원(분수·벤치·나무), 보도에는 가로수·가로등·버스 정류장·소화전·신호등, 차도에는 정차한 차. 맵은 40×30 이상(권장 60×48), 도로·건물 수는 크기가 정한다. "
    + "shops 로 꼭 넣을 건물(편의점·카페·은행·병원·사무실·호텔·아파트·창고… 또는 키트 종류 conv·cafe·bank)을 준다. 결과 data.buildings[] 의 문 칸·program(그 건물에 맞는 실내 방 구성)을 "
    + "build_hand_interior_room({tileset:\"modern_city\", layout:{program}}) 과 link_modern_city_interior 에 쓴다. 시작 칸에서 모든 문 접근칸에 닿는지 엔진 통행으로 확인하고, 안 되면 맵을 바꾸지 않는다. 손댄 맵은 replace:true 여야 다시 깐다(이벤트는 남는다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 modern_city 여야 한다" },
      seed: { type: "integer", minimum: 0, description: "배치 씨앗(생략 0) — 바꾸면 도로 위치·건물·소품·차가 달라진다" },
      shops: { type: "array", items: { type: "string" }, description: "꼭 넣을 건물(편의점·카페·은행·병원·사무실·호텔·아파트·창고·이자카야·빵집…)" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 깐다" },
      landmark: { type: "string", description: "가장 넓은 블록 가운데 먼저 세울 랜드마크 건물(예: 오피스 타워 → tower10, 대형 오피스 → office-wide, 호텔·백화점). 결과 buildings[0]. 높이 13칸 타워는 띠가 13줄 이상이어야 서므로 맵 높이 50 이상 권장" },
      subwayExits: { type: "integer", minimum: 1, maximum: 4, description: "지하철 출구 수(기본 1). 2 이상이면 출구마다 번호 표지(1·2·3…)를 세우고 data.subwayExits[{n, stair, step}] 를 준다 — stair 칸에 이동 이벤트, step 이 나오는 칸" },
      korean: { type: "boolean", description: "한국 거리 단서: 보도 점자 블록 줄·가로수 보호판·버스 쉘터·자전거 거치대·가게 옆 한글 세로 입간판(지어낸 이름)" },
    },
    additionalProperties: false,
  },
  invalidArgsExample: { seed: 3, shops: ["편의점", "카페", "병원"] },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — modern_city 맵 id 를 준다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!isModernCityTilesetDef(tileset)) throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 modern_city 가 아니다 — create_map({tilesetId:"modern_city", width:60, height:48}) 로 새 맵을 만든다`, { code: "wrong-tileset", mapId });
    if (map.width < MODERN_CITY_STREET_MIN.w || map.height < MODERN_CITY_STREET_MIN.h) throw new ToolError(`맵이 작다(${map.width}×${map.height}) — ${MODERN_CITY_STREET_MIN.w}×${MODERN_CITY_STREET_MIN.h} 이상(권장 60×48). resize_map 한 뒤 부른다`, { code: "map-too-small", mapId });
    if (map.width > MODERN_CITY_STREET_MAX.w || map.height > MODERN_CITY_STREET_MAX.h) throw new ToolError(`맵이 크다(${map.width}×${map.height}) — ${MODERN_CITY_STREET_MAX.w}×${MODERN_CITY_STREET_MAX.h} 이하`, { code: "map-too-large", mapId });
    if (!isUntouched(map) && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 지우고 다시 깔려면 replace:true 를 준다(이벤트는 남는다)", { code: "map-not-blank", mapId });
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 0;
    const shops: string[] = [];
    for (const w of Array.isArray(args.shops) ? args.shops : []) {
      if (typeof w !== "string" || !w.trim()) continue;
      const t = shopType(w);
      if (!t) throw new ToolError(`'${w}' 에 맞는 건물이 없다 — 편의점·카페·은행·병원·사무실·호텔·백화점·아파트·주택·창고·이자카야·빵집·우체국·경찰서·소방서·주차 건물 중에서 고른다`, { code: "invalid-args" });
      shops.push(t);
    }
    const pal = modernCityPaletteFromTileset(tileset!);
    let r;
    const landmark = typeof args.landmark === "string" && args.landmark.trim() ? shopType(args.landmark) : null;
    if (typeof args.landmark === "string" && args.landmark.trim() && !landmark) throw new ToolError(`랜드마크 '${args.landmark}' 에 맞는 건물이 없다 — tower10·office-wide·hotel·dept 같은 종류나 「오피스 타워」를 준다`, { code: "invalid-args" });
    const district = { ...(landmark ? { landmark } : {}), ...(typeof args.subwayExits === "number" ? { subwayExits: args.subwayExits } : {}), ...(args.korean === true ? { korean: true } : {}) };
    try { r = composeModernCityStreet({ width: map.width, height: map.height, seed, shops, district }, pal); }
    catch (e) { throw new ToolError(`거리를 짜지 못했다 — ${(e as Error).message}`, { code: "compose-failed", mapId }); }
    const next: Project = { ...draft, maps: { ...draft.maps, [mapId]: structuredClone(map) } };
    const target = next.maps[mapId]!;
    for (let i = 0; i < target.lowerTiles.length; i++) { setLayerTileAt(target, 2, i, -1); setLayerTileAt(target, 4, i, -1); clearTileStack(target, "upper", i); clearTileStack(target, "lower", i); }
    target.lowerTiles = [...r.lower];
    target.upperTiles = [...r.upper];
    for (let i = 0; i < r.upper2.length; i++) if (r.upper2[i]! >= 0) setLayerTileAt(target, 4, i, r.upper2[i]!);
    const W = target.width, errs: string[] = [];
    if (!walkable(next, target, r.start.x, r.start.y)) errs.push(`시작 칸 (${r.start.x},${r.start.y}) 이 막혔다`);
    const seen = walkable(next, target, r.start.x, r.start.y) ? reachable(next, target, r.start) : new Set<number>();
    for (const e of r.subwayExits) if (!walkable(next, target, e.step.x, e.step.y) || !seen.has(e.step.y * W + e.step.x)) errs.push(`지하철 ${e.n}번 출구 나오는 칸 (${e.step.x},${e.step.y}) 에 시작 칸에서 닿지 못한다`);
    for (const d of r.buildings) {
      for (const c of d.doors) if (walkable(next, target, c.x, c.y)) errs.push(`${d.name} 문 칸 (${c.x},${c.y}) 이 열려 있다`);
      for (const c of d.access) {
        if (!walkable(next, target, c.x, c.y)) errs.push(`${d.name} 접근칸 (${c.x},${c.y}) 이 막혔다`);
        else if (!seen.has(c.y * W + c.x)) errs.push(`${d.name} 접근칸 (${c.x},${c.y}) 에 시작 칸에서 닿지 못한다`);
      }
    }
    if (errs.length) throw new ToolError(`거리를 깔지 못했다 — ${errs.slice(0, 4).join(" / ")}. seed 를 바꿔 다시 부른다`, { code: "compose-failed", mapId });
    target.locations = (target.locations ?? []).filter((l) => !(l.tags ?? []).includes("modern-city-building"));
    for (const d of r.buildings) {
      const door = d.doors[0]!;
      addMapLocation(target, { name: `${d.name}`, x: d.rect.x, y: d.rect.y, w: d.rect.w, h: d.rect.h,
        note: `문 (${door.x},${door.y})${d.doors.length > 1 ? ` 외 ${d.doors.length - 1}칸` : ""} · 접근칸 (${d.access[0]!.x},${d.access[0]!.y})${d.program ? ` — 실내는 build_hand_interior_room({tileset:"modern_city", layout:{program:"${d.program}"}}) 로 지어 link_modern_city_interior 로 잇는다` : " — 실내 예제 없음"}`,
        // composed-layout: 도로·보도·교차로는 용도로 비운 칸이다 — 배치 품질 권고(layoutQuality.ts)가 이 맵을 「빈 실내」로 보고
        // build_hand_interior_room replace:true 를 시켜 거리를 로비로 덮었다(2026-10-14 실조수 gpt-6.1-sol). 이름표가 있으면 그 권고에서 빠진다.
        tags: ["modern-city-building", COMPOSED_LAYOUT_TAG, d.kind, d.kit] });
    }
    target.transit = r.transit;
    const blocked = (target.events ?? []).filter((e) => !walkable(next, target, e.x, e.y)).map((e) => `${e.name ?? e.id}(${e.x},${e.y})`);
    draft.maps[mapId] = target;
    // 시작 위치: 이 맵이 시작 맵인데 시작 칸이 건물에 덮였거나, 시작 맵이 빈 기본 맵이면 거리 시작 칸으로(2026-10-14 실조수 argon:
    // 시작 칸 (10,8) 이 건물 밑이 되어 커밋이 무결성 오류로 거부됐다 → 모델이 set_start_position 후 다시 불렀다).
    const startNote = claimStartIfBlank(draft, mapId, r.start).note;
    return {
      summary: `도쿄풍 거리를 ${map.width}×${map.height} 맵(${mapId})에 짰다(seed ${seed}) — 가로 도로 ${r.roads.horizontal.length}·세로 도로 ${r.roads.vertical.length}, 건물 ${r.buildings.length}채, 소품 ${r.props.length}개, 주행·회전 차량 노선 ${r.transit.routes.length}개${r.park ? `, 공원 (${r.park.x},${r.park.y}) ${r.park.w}×${r.park.h}` : ""}, 시작 칸 (${r.start.x},${r.start.y}) 에서 모든 문 접근칸에 닿음(엔진 통행). `
        + (r.subwayExits.length > 1 ? `지하철 출구 ${r.subwayExits.map((e) => `${e.n}번 계단(${e.stair.x},${e.stair.y})→나오는 칸(${e.step.x},${e.step.y})`).join(" · ")}. ` : "")
        + `건물: ${r.buildings.map((d) => `${d.name} 문(${d.doors[0]!.x},${d.doors[0]!.y})${d.program ? `→${d.program}` : ""}`).join(" · ")}.`
        + (r.notes.length ? ` 참고: ${r.notes.join(" / ")}.` : "") + (blocked.length ? ` 경고: 막힌 칸 위 이벤트 ${blocked.join(", ")}.` : "") + startNote
        + " 좌표는 도구 인자용이다 — NPC 대사·안내 문구에는 (x,y) 대신 건물 이름·방향(「본사 정문」 「동쪽 끝」)을 쓴다.",
      data: { mapId, seed, start: r.start, roads: r.roads, park: r.park, transitRoutes: r.transit.routes.length, subwayExits: r.subwayExits, buildings: r.buildings.map((d) => ({ name: d.name, kind: d.kind, kit: d.kit, rect: d.rect, doors: d.doors, access: d.access, program: d.program ?? null })), props: r.props.length, propList: r.props },
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

export const LINK_MODERN_CITY_INTERIOR_TOOL: ToolDefinition = {
  name: "link_modern_city_interior",
  mode: "write",
  domains: ["map", "event"],
  fillsCurrentMapId: true,
  description: "modern_city 거리 건물의 문과 이미 지은 실내 맵(build_hand_interior_room, tileset:modern_city)을 왕복 이동으로 잇는다. 거리 쪽은 문 바로 아래 접근칸에 들어가는 발판, 실내 쪽은 맨 아래 출입구 틈에 나오는 발판을 만든다"
    + "(막힌 문 칸에는 이벤트를 두지 않는다 — create_transfer_pair 를 따로 부르지 않는다). door = compose_modern_city_street 결과 data.buildings[].doors 의 칸(막힌 문 칸) 또는 접근칸, 또는 list_map_locations 의 건물 이름표 note 의 문 칸. "
    + "문이 여러 칸이면 width 로 함께 잇는다. 실내 평면의 남쪽 출입구 틈은 한 군데(1~4칸)여야 한다. 문 앞에 다른 이벤트가 있으면 거부한다(replace:true 면 바꾼다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "거리(바깥) modern_city 맵 id. 생략하면 지금 보는 맵" },
      door: { type: "object", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"], additionalProperties: false, description: "건물 문 칸(가장 왼쪽 칸) 또는 문 바로 아래 접근칸" },
      width: { type: "integer", minimum: 1, maximum: 4, description: "문 칸 수(기본 1)" },
      interiorMapId: { type: "string", description: "이미 지은 실내 맵 id(tileset modern_city)" },
      replace: { type: "boolean", description: "문 앞·출입구 틈의 기존 이벤트를 바꾼다" },
    },
    required: ["door", "interiorMapId"],
    additionalProperties: false,
  },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 거리 맵 id 를 준다", { code: "map-not-found" });
    const outer = requireMap(draft, mapId);
    if (!isModernCityTilesetDef(draft.tilesets[outer.tilesetId])) throw new ToolError(`맵 ${mapId} 의 칩셋 ${outer.tilesetId} 는 modern_city 가 아니다 — modern_city 거리 맵에서만 쓴다(jp_city 는 link_jp_city_interior, 캠퍼스는 link_campus_interior)`, { code: "tileset-family-mismatch", mapId });
    const interiorId = typeof args.interiorMapId === "string" ? args.interiorMapId.trim() : "";
    const interior = requireMap(draft, interiorId);
    if (interior.id === outer.id) throw new ToolError("실내 맵이 거리 맵과 같다", { code: "invalid-args" });
    if (!isModernCityTilesetDef(draft.tilesets[interior.tilesetId])) throw new ToolError(`실내 맵 ${interiorId} 의 칩셋 ${interior.tilesetId} 는 modern_city 가 아니다 — build_hand_interior_room({tileset:"modern_city"}) 로 지은 실내를 잇는다`, { code: "tileset-family-mismatch", mapId: interiorId });
    const d = args.door as { x: number; y: number };
    const width = Number.isInteger(args.width) ? Math.max(1, Math.min(4, Number(args.width))) : 1;
    const replace = args.replace === true;
    const fronts: Cell[] = [];
    for (let i = 0; i < width; i++) {
      const c = { x: Number(d.x) + i, y: Number(d.y) };
      if (!inside(outer, c)) throw new ToolError(`문 칸 (${c.x},${c.y}) 이 맵 밖이다`, { code: "invalid-args", mapId });
      if (isPassable(draft, outer, c.x, c.y)) {
        const above = { x: c.x, y: c.y - 1 };
        if (!inside(outer, above) || isPassable(draft, outer, above.x, above.y)) throw new ToolError(`(${c.x},${c.y}) 는 건물 문 칸도, 문 바로 아래 접근칸도 아니다 — compose_modern_city_street 결과(또는 건물 이름표)의 문 칸을 준다`, { code: "not-a-door", mapId });
        fronts.push(c);
      } else {
        const front = { x: c.x, y: c.y + 1 };
        if (!inside(outer, front) || !isPassable(draft, outer, front.x, front.y)) throw new ToolError(`문 (${c.x},${c.y}) 바로 아래 (${front.x},${front.y}) 가 걸을 수 없다 — 문 앞 보도를 비운다`, { code: "DOOR_BLOCKED", mapId });
        fronts.push(front);
      }
    }
    const olds = fronts.map((c) => eventAt(outer, c)).filter((e): e is GameEvent => !!e);
    if (olds.length && !replace) throw new ToolError(`문 앞 ${olds.map((e) => `(${e.x},${e.y})`).join(" ")} 에 이미 이벤트가 있다 — replace:true 로 바꾼다`, { code: "door-event-exists", mapId });
    const front = fronts[Math.floor((fronts.length - 1) / 2)]!;
    const outLanding = [{ x: front.x, y: front.y + 1 }, { x: front.x - 1, y: front.y + 1 }, { x: front.x + 1, y: front.y + 1 }, { x: front.x - 1, y: front.y }, { x: front.x + fronts.length, y: front.y }]
      .find((c) => inside(outer, c) && isPassable(draft, outer, c.x, c.y) && !eventAt(outer, c) && !fronts.some((f) => f.x === c.x && f.y === c.y));
    if (!outLanding) throw new ToolError(`문 앞 (${front.x},${front.y}) 둘레에 나와서 설 칸이 없다 — 문 앞 보도를 두 줄 비운다`, { code: "no-exterior-landing", mapId });
    const exit = interiorExit(draft, interior);
    if (exit.runs > 1) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄에 걸음 칸 덩이가 ${exit.runs}군데라 정문을 고를 수 없다 — 출입구 틈 하나만 남긴다`, { code: "interior-exit-ambiguous", mapId: interiorId });
    if (!exit.cells.length) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄에 걸을 수 있는 출입구 틈이 없다 — build_hand_interior_room 의 평면 남쪽 틈을 확인한다`, { code: "no-interior-exit", mapId: interiorId });
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
    const tag = interiorId.replace(/[^a-z0-9]+/gi, "_");
    for (const c of fronts) { const id = uniqueEventId(draft, `ev_mci_enter_${tag}`); enter.push(id); outer.events = [...(outer.events ?? []), gateEvent(id, `${interior.name} 들어가기`, c, { mapId: interiorId, ...inLanding })]; }
    for (const c of exit.cells) { const id = uniqueEventId(draft, `ev_mci_exit_${tag}`); leave.push(id); interior.events = [...(interior.events ?? []), gateEvent(id, `${outer.name} 쪽으로 나가기`, c, { mapId, ...outLanding })]; }
    const node = extractTreeNode(draft.mapTree, interiorId as MapId);
    if (node && !insertTreeNode(draft.mapTree, node, mapId as MapId)) insertTreeNode(draft.mapTree, node, "");
    return {
      summary: `${outer.name} 문 앞 ${fronts.map((c) => `(${c.x},${c.y})`).join(" ")} ↔ ${interior.name}: 들어가면 실내 (${inLanding.x},${inLanding.y}), 실내 출입구 ${exit.cells.map((c) => `(${c.x},${c.y})`).join(" ")} 에서 나오면 거리 (${outLanding.x},${outLanding.y})`,
      data: { mapId, fronts, interiorMapId: interiorId, enterEventIds: enter, exitEventIds: leave, entryLanding: inLanding, exitCells: exit.cells, exitLanding: outLanding },
    };
  },
};

export const MODERN_CITY_TOOLS: readonly ToolDefinition[] = [COMPOSE_MODERN_CITY_STREET_TOOL, LINK_MODERN_CITY_INTERIOR_TOOL];
