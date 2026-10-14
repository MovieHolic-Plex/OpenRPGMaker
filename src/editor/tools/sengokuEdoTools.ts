// 전국·에도 일본(sengoku_edo) 야외 구성 도구 — compose_sengoku_edo_map(성하마을·여관 거리·무가 저택·성·신사/절·농촌 한 장), link_sengoku_edo_interior(건물 문 ↔ 실내 맵).
// 배치는 구성기 src/project/sengokuEdoComposer.ts 가 짠다(계획 → 물·논 → 건물 → 길 → 소품 → 가장자리, 씨앗마다 다른 배치). 이 도구는 그 결과를 맵에 쓰고,
// 문 칸은 막힘·접근칸은 걸을 수 있음·시작 칸에서 모든 접근칸에 닿는지를 엔진 통행(isPassable)으로 다시 확인한다. 실패하면 다음 씨앗을 최대 3번 더 보고, 그래도 안 되면 맵을 바꾸지 않는다.
// 손대지 않은 맵이 그 용도의 최소 크기보다 작으면 기본 크기로 키운다(빈 맵만 — 칠한 맵은 resize_map 을 먼저 부르라고 거부한다).
import { isSengokuTilesetDef } from "@/ai/sengokuEdoPolicy";
import { isPassable } from "@/project/collision";
import { cropExtraLayers, setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { addMapLocation } from "@/project/mapNamedLocations";
import { extractTreeNode, insertTreeNode } from "@/project/mapTree";
import { SENGOKU_DEFAULT_SIZE, SENGOKU_MIN_SIZE, SENGOKU_STYLES, SENGOKU_STYLE_KO, composeSengokuEdo, sengokuPaletteFromTileset, type SengokuResult, type SengokuStyle } from "@/project/sengokuEdoComposer";
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

/** 구성 결과를 맵 사본에 쓰고 문·접근칸·도달을 엔진 통행으로 본다. 오류 목록(비면 합격). */
function writeAndCheck(next: Project, target: GameMap, r: SengokuResult): string[] {
  for (let i = 0; i < target.lowerTiles.length; i++) { setLayerTileAt(target, 2, i, -1); setLayerTileAt(target, 3, i, -1); setLayerTileAt(target, 4, i, -1); clearTileStack(target, "upper", i); clearTileStack(target, "lower", i); }
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
  return errs;
}

const STYLE_LINE = SENGOKU_STYLES.map((s) => `${s}=${SENGOKU_STYLE_KO[s]}(${SENGOKU_MIN_SIZE[s].w}×${SENGOKU_MIN_SIZE[s].h} 이상)`).join(" · ");

export const COMPOSE_SENGOKU_EDO_MAP_TOOL: ToolDefinition = {
  name: "compose_sengoku_edo_map",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "전국·에도 칩셋(sengoku_edo) 야외 맵 한 장을 통째로 짠다(구성기 — 씨앗마다 다른 배치). style: " + STYLE_LINE + ". "
    + "castle_town = 북쪽 해자·천수각·다리 + 남쪽 마치야·가게 거리 두 줄과 석등·노점; inn_street = 여관·찻집·가게가 늘어선 가도 + 강·다리·논; samurai = 회벽 담 안 무가 저택 두 채·다실·돌길·마른 정원; "
    + "castle = 해자로 둘린 성 한 채·대문·참배길 같은 돌길; temple = 도리이·참배길·신사 본전 + 절 본당·종루·탑·마른 정원; village = 초가 농가·곳간 + 논·강·다리. "
    + "건물은 모두 남향, 문 칸은 막힘이고 바로 아래 접근칸은 길이다 — 결과 data.buildings[].doors 를 link_sengoku_edo_interior 에 준다. "
    + "시작 칸에서 모든 접근칸에 닿는지 엔진 통행으로 확인하고, 안 되면 맵을 바꾸지 않는다. 빈 맵이 작으면 그 용도의 기본 크기로 키운다. 손댄 맵은 replace:true 여야 다시 깐다(이벤트는 남는다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 sengoku_edo 여야 한다" },
      style: { type: "string", enum: [...SENGOKU_STYLES], description: "castle_town 성하마을 | inn_street 여관 거리 | samurai 무가 저택 | castle 성 | temple 신사·절 | village 농촌" },
      seed: { type: "integer", minimum: 0, description: "배치 씨앗(생략 0). 바꾸면 다른 배치" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 깐다" },
    },
    required: ["style"],
    additionalProperties: false,
  },
  invalidArgsExample: { style: "castle_town", seed: 2 },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — sengoku_edo 맵 id 를 준다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!isSengokuTilesetDef(tileset)) throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 전국·에도(sengoku_edo)가 아니다 — create_map({tilesetId:"sengoku_edo"}) 로 새 맵을 만든다`, { code: "wrong-tileset", mapId });
    const style = (SENGOKU_STYLES as readonly string[]).includes(String(args.style)) ? args.style as SengokuStyle : null;
    if (!style) throw new ToolError(`style 은 ${SENGOKU_STYLES.join("|")} 중 하나다`, { code: "invalid-args" });
    const untouched = isUntouched(map);
    if (!untouched && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 지우고 다시 깔려면 replace:true 를 준다(이벤트는 남는다)", { code: "map-not-blank", mapId });
    const min = SENGOKU_MIN_SIZE[style], def = SENGOKU_DEFAULT_SIZE[style];
    const small = map.width < min.w || map.height < min.h;
    if (small && !untouched) throw new ToolError(`맵이 작다(${map.width}×${map.height}) — ${style} 는 ${min.w}×${min.h} 이상이어야 한다. resize_map 한 뒤 부른다`, { code: "map-too-small", mapId });
    const seed0 = typeof args.seed === "number" && Number.isInteger(args.seed) && args.seed >= 0 ? args.seed : 0;
    const pal = sengokuPaletteFromTileset(tileset!);
    const next = structuredClone(draft);
    const target = next.maps[mapId]!;
    let grew = "";
    if (small) {
      const W = Math.max(map.width, def.w), H = Math.max(map.height, def.h);
      cropExtraLayers(target, map.width, map.height, 0, 0, W, H);
      delete target.lowerTileStacks; delete target.upperTileStacks;
      target.width = W; target.height = H;
      target.lowerTiles = new Array<number>(W * H).fill(map.lowerTiles[0] ?? 0);
      target.upperTiles = new Array<number>(W * H).fill(-1);
      grew = ` 빈 맵이 작아서 ${map.width}×${map.height} → ${W}×${H} 로 키웠다.`;
    }
    let r: SengokuResult | null = null, seed = seed0, lastErr = "";
    for (let attempt = 0; attempt < 4 && !r; attempt++, seed++) {
      let cand: SengokuResult;
      try { cand = composeSengokuEdo({ width: target.width, height: target.height, style, seed }, pal); }
      catch (e) { lastErr = (e as Error).message; continue; }
      const errs = writeAndCheck(next, target, cand);
      if (errs.length) { lastErr = errs.slice(0, 4).join(" / "); continue; }
      r = cand;
    }
    if (!r) throw new ToolError(`전국·에도 맵을 깔지 못했다 — ${lastErr}. seed 를 바꾸거나 맵을 키워 다시 부른다`, { code: "compose-failed", mapId });
    seed--;
    target.locations = (target.locations ?? []).filter((l) => !(l.tags ?? []).includes("sengoku-building"));
    for (const d of r.buildings) {
      const door = d.doors[0]!;
      addMapLocation(target, { name: `${d.name}`, x: d.rect.x, y: d.rect.y, w: d.rect.w, h: d.rect.h, note: `문 (${door.x},${door.y}) · 접근칸 (${d.access[0]!.x},${d.access[0]!.y}) — 이 문에 실내를 build_hand_interior_room(tileset:sengoku_edo) 으로 지어 link_sengoku_edo_interior 로 잇는다`, tags: ["sengoku-building", d.kit] });
    }
    const blocked = (target.events ?? []).filter((e) => !walkable(next, target, e.x, e.y)).map((e) => `${e.name ?? e.id}(${e.x},${e.y})`);
    draft.maps[mapId] = target;
    return {
      summary: `${SENGOKU_STYLE_KO[style]}을(를) ${target.width}×${target.height} 맵(${mapId})에 짰다(seed ${seed}) — 건물 ${r.buildings.length}채, 소품 ${r.props.length}개, 시작 칸 (${r.start.x},${r.start.y}) 에서 모든 문 접근칸에 닿음(엔진 통행).${grew} `
        + `건물 문: ${r.buildings.map((d) => `${d.name} (${d.doors.map((c) => `${c.x},${c.y}`).join(" · ")})`).join(" · ")}. 실내가 필요한 문은 build_hand_interior_room(tileset:"sengoku_edo") 로 짓고 link_sengoku_edo_interior 로 잇는다.`
        + (r.notes.length ? ` 참고: ${r.notes.join(" / ")}.` : "") + (blocked.length ? ` 경고: 막힌 칸 위 이벤트 ${blocked.join(", ")}.` : ""),
      data: { mapId, style, seed, width: target.width, height: target.height, start: r.start, buildings: r.buildings.map((d) => ({ name: d.name, kit: d.kit, rect: d.rect, doors: d.doors, access: d.access })), props: r.props.length },
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

export const LINK_SENGOKU_EDO_INTERIOR_TOOL: ToolDefinition = {
  name: "link_sengoku_edo_interior",
  mode: "write",
  domains: ["map", "event"],
  fillsCurrentMapId: true,
  description: "전국·에도(sengoku_edo) 야외 건물의 문과 이미 지은 실내 맵(build_hand_interior_room, tileset:sengoku_edo)을 왕복 이동으로 잇는다. 거리(바깥) 쪽은 문 바로 아래 접근칸에 들어가는 발판, 실내 쪽은 맨 아래 출입구 틈에 나오는 발판을 만든다(막힌 문 칸에는 이벤트를 두지 않는다 — create_transfer_pair 를 따로 부르지 않는다). "
    + "door = compose_sengoku_edo_map 결과 data.buildings[].doors 의 칸(막힌 문 칸) 또는 접근칸. 문이 두 칸이면 width:2. 실내 평면의 남쪽 출입구 틈은 한 군데(1~4칸)여야 한다. 문 앞에 다른 이벤트가 있으면 거부한다(replace:true 면 바꾼다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "야외 전국·에도 맵 id. 생략하면 지금 보는 맵" },
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
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 야외 전국·에도 맵 id 를 준다", { code: "map-not-found" });
    const outer = requireMap(draft, mapId);
    if (!isSengokuTilesetDef(draft.tilesets[outer.tilesetId])) throw new ToolError(`맵 ${mapId} 의 칩셋 ${outer.tilesetId} 는 sengoku_edo 가 아니다 — 전국·에도 야외 맵에서만 쓴다`, { code: "tileset-family-mismatch", mapId });
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
        if (!inside(outer, above) || isPassable(draft, outer, above.x, above.y)) throw new ToolError(`(${c.x},${c.y}) 는 건물 문 칸도, 문 바로 아래 접근칸도 아니다 — compose_sengoku_edo_map 결과의 문 칸을 준다`, { code: "not-a-door", mapId });
        fronts.push(c);
      } else {
        const front = { x: c.x, y: c.y + 1 };
        if (!inside(outer, front) || !isPassable(draft, outer, front.x, front.y)) throw new ToolError(`문 (${c.x},${c.y}) 바로 아래 (${front.x},${front.y}) 가 걸을 수 없다 — 문 앞 길을 먼저 깐다`, { code: "DOOR_BLOCKED", mapId });
        fronts.push(front);
      }
    }
    const olds = fronts.map((c) => eventAt(outer, c)).filter((e): e is GameEvent => !!e);
    if (olds.length && !replace) throw new ToolError(`문 앞 ${olds.map((e) => `(${e.x},${e.y})`).join(" ")} 에 이미 이벤트가 있다 — replace:true 로 바꾼다`, { code: "door-event-exists", mapId });
    const front = fronts[Math.floor((fronts.length - 1) / 2)]!;
    const outLanding = [{ x: front.x, y: front.y + 1 }, { x: front.x - 1, y: front.y + 1 }, { x: front.x + 1, y: front.y + 1 }, { x: front.x, y: front.y + 2 }].find((c) => inside(outer, c) && isPassable(draft, outer, c.x, c.y) && !eventAt(outer, c));
    if (!outLanding) throw new ToolError(`문 앞 (${front.x},${front.y}) 둘레에 나와서 설 칸이 없다 — 문 앞 길을 두 줄 이상 깐다`, { code: "no-exterior-landing", mapId });
    const exit = interiorExit(draft, interior);
    if (exit.runs > 1) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄에 걸음 칸 덩이가 ${exit.runs}군데라 정문을 고를 수 없다 — 출입구 틈 하나만 남긴다`, { code: "interior-exit-ambiguous", mapId: interiorId });
    if (!exit.cells.length) throw new ToolError(`실내 맵 ${interiorId} 맨 아래 줄에 걸을 수 있는 출입구 틈이 없다 — build_hand_interior_room 의 exitWidth·평면 남쪽 틈을 확인한다`, { code: "no-interior-exit", mapId: interiorId });
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
    for (const c of fronts) { const id = uniqueEventId(draft, `ev_se_enter_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`); enter.push(id); outer.events = [...(outer.events ?? []), gateEvent(id, `${interior.name} 들어가기`, c, { mapId: interiorId, ...inLanding })]; }
    for (const c of exit.cells) { const id = uniqueEventId(draft, `ev_se_exit_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`); leave.push(id); interior.events = [...(interior.events ?? []), gateEvent(id, `${outer.name} 로 나가기`, c, { mapId, ...outLanding })]; }
    const node = extractTreeNode(draft.mapTree, interiorId as MapId);
    if (node && !insertTreeNode(draft.mapTree, node, mapId as MapId)) insertTreeNode(draft.mapTree, node, "");
    return {
      summary: `${outer.name} 문 앞 ${fronts.map((c) => `(${c.x},${c.y})`).join(" ")} ↔ ${interior.name}: 들어가면 실내 (${inLanding.x},${inLanding.y}), 실내 출입구 ${exit.cells.map((c) => `(${c.x},${c.y})`).join(" ")} 에서 나오면 야외 (${outLanding.x},${outLanding.y})`,
      data: { mapId, fronts, interiorMapId: interiorId, enterEventIds: enter, exitEventIds: leave, entryLanding: inLanding, exitCells: exit.cells, exitLanding: outLanding },
    };
  },
};

export const SENGOKU_EDO_TOOLS: readonly ToolDefinition[] = [COMPOSE_SENGOKU_EDO_MAP_TOOL, LINK_SENGOKU_EDO_INTERIOR_TOOL];
