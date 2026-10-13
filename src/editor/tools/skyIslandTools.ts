// 하늘섬(sky_island) 구성 도구 — compose_sky_island_map(하늘섬 마을·신전 섬·비공정 부두·섬 사슬·실내 방 넷 한 장), link_sky_island_interior(건물 문 ↔ 실내 맵).
// 배치는 구성기 src/project/skyIslandComposer.ts 가 짠다(계획 → 섬 → 땅 → 건물 → 다리 → 소품 → 빈 땅 쓰임 → 하늘 꾸밈, 씨앗마다 다른 한 장). 이 도구는 그 결과를 맵에 쓰고,
// 문 칸은 막힘·접근칸은 걸을 수 있음·시작 칸에서 모든 접근칸·다리 끝·실내 출구에 닿는지를 엔진 통행(isPassable)으로 다시 확인한다. 실패하면 맵을 바꾸지 않는다.
import { isSkyIslandTilesetDef } from "@/ai/skyIslandPolicy";
import { isPassable } from "@/project/collision";
import { cropExtraLayers, setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { addMapLocation } from "@/project/mapNamedLocations";
import { extractTreeNode, insertTreeNode } from "@/project/mapTree";
import { SKY_MIN_SIZE, composeSkyIsland, skyPaletteFromTileset, type SkyComposeStyle } from "@/project/skyIslandComposer";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Cell = { readonly x: number; readonly y: number };

const STYLES: readonly SkyComposeStyle[] = ["village", "shrine", "dock", "archipelago", "room-cottage", "room-shrine", "room-cabin", "room-observatory"];
const STYLE_KO: Readonly<Record<SkyComposeStyle, string>> = {
  village: "하늘섬 마을", shrine: "구름 위 신전 섬", dock: "비공정 부두", archipelago: "다리로 이은 섬 사슬",
  "room-cottage": "오두막 실내", "room-shrine": "신전 실내", "room-cabin": "비공정 선실", "room-observatory": "천문대 실내",
};
/** 빈 맵을 자동으로 늘리는 크기(최소 크기보다 조금 넉넉하게). 방은 방 크기 그대로. */
const AUTO_SIZE: Readonly<Record<SkyComposeStyle, { w: number; h: number }>> = {
  village: { w: 50, h: 34 }, shrine: { w: 46, h: 40 }, dock: { w: 52, h: 30 }, archipelago: { w: 54, h: 42 },
  "room-cottage": SKY_MIN_SIZE["room-cottage"], "room-shrine": SKY_MIN_SIZE["room-shrine"], "room-cabin": SKY_MIN_SIZE["room-cabin"], "room-observatory": SKY_MIN_SIZE["room-observatory"],
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
function parseStyle(v: unknown): SkyComposeStyle | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  const alias: Record<string, SkyComposeStyle> = { cottage: "room-cottage", cabin: "room-cabin", observatory: "room-observatory", "shrine-room": "room-shrine", "shrine-interior": "room-shrine", chain: "archipelago", islands: "archipelago" };
  return (STYLES as readonly string[]).includes(s) ? s as SkyComposeStyle : alias[s] ?? null;
}

export const COMPOSE_SKY_ISLAND_MAP_TOOL: ToolDefinition = {
  name: "compose_sky_island_map",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "하늘섬 칩셋(sky_island) 맵 한 장을 통째로 짠다(구성기 — 계획 → 섬 → 건물 → 다리 → 소품, 씨앗마다 다른 배치). "
    + "style: village = 하늘섬 마을(큰 섬: 큰길 북쪽 집 줄·풍차, 남쪽 우물 광장·노점·밭·연못에서 섬 끝 폭포 + 밧줄 다리로 이은 작은 섬의 등대·탑), "
    + "shrine = 구름 위 신전(신전·앞 광장·수정 기둥·석상·깃발·참배길 → 남북 밧줄 다리 → 문 섬, 옆 정원 섬은 돌 아치 다리), "
    + "dock = 비공정 부두(섬 끝 잔교 + 계류된 비공정·부두 관리소·등대·짐 마당·바람 자루 + 밧줄 다리로 이은 창고 섬), "
    + "archipelago = 섬 넷을 밧줄 다리 셋·돌다리 하나로 이은 섬 사슬(집·풍차와 밭·우물 쉼터·천문대), "
    + "room-cottage·room-shrine·room-cabin·room-observatory = 오두막·신전·비공정 선실·천문대 실내 방(벽 두 줄 + 창, 가구는 벽 따라, 아래 출구 깔개). "
    + "빈 맵이 작으면 알맞은 크기로 늘린다(마을 50×34·신전 46×40·부두 52×30·섬 사슬 54×42, 방은 방 크기). 손댄 맵은 replace:true 여야 다시 깐다(이벤트는 남는다). "
    + "시작 칸에서 모든 건물 문 접근칸·다리 끝·실내 출구에 닿는지 엔진 통행으로 확인하고, 안 되면 맵을 바꾸지 않는다. 결과 data.buildings[].doors 를 link_sky_island_interior 에 준다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 sky_island 여야 한다" },
      style: { type: "string", enum: [...STYLES], description: "village 마을 | shrine 신전 섬 | dock 비공정 부두 | archipelago 섬 사슬 | room-cottage | room-shrine | room-cabin | room-observatory" },
      seed: { type: "integer", minimum: 0, description: "배치 씨앗(생략 0). 바꾸면 섬 모양·건물 순서·나무·소품 자리가 달라진다" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 깐다" },
    },
    required: ["style"],
    additionalProperties: false,
  },
  invalidArgsExample: { style: "village", seed: 3 },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 하늘섬 맵 id 를 준다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!isSkyIslandTilesetDef(tileset)) throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 하늘섬(sky_island)이 아니다 — create_map({tilesetId:"sky_island"}) 로 새 맵을 만든다`, { code: "wrong-tileset", mapId });
    const style = parseStyle(args.style);
    if (!style) throw new ToolError(`style 은 ${STYLES.join(" · ")} 중 하나다`, { code: "invalid-args" });
    const untouched = isUntouched(map);
    if (!untouched && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 지우고 다시 깔려면 replace:true 를 준다(이벤트는 남는다)", { code: "map-not-blank", mapId });
    const min = SKY_MIN_SIZE[style];
    const room = style.startsWith("room-");
    let W = map.width, H = map.height;
    const resize = untouched && (map.width < min.w || map.height < min.h || (room && (map.width > min.w + 6 || map.height > min.h + 6)));
    if (resize) { W = AUTO_SIZE[style].w; H = AUTO_SIZE[style].h; }
    if (W < min.w || H < min.h) throw new ToolError(`맵이 작다(${map.width}×${map.height}) — ${style} 는 ${min.w}×${min.h} 이상이어야 한다. resize_map 한 뒤 부른다`, { code: "map-too-small", mapId });
    const outEvents = (map.events ?? []).filter((e) => e.x >= W || e.y >= H);
    if (outEvents.length) throw new ToolError(`맵을 ${W}×${H} 로 맞추면 이벤트 ${outEvents.length}개가 밖으로 나간다 — 먼저 옮긴다`, { code: "events-out-of-bounds", mapId });
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 0;
    const pal = skyPaletteFromTileset(tileset!);
    let r;
    try { r = composeSkyIsland({ width: W, height: H, style, seed }, pal); }
    catch (e) { throw new ToolError(`${STYLE_KO[style]} 한 장을 짜지 못했다 — ${(e as Error).message}`, { code: "compose-failed", mapId }); }

    const next = structuredClone(draft);
    const target = next.maps[mapId]!;
    if (resize) {
      cropExtraLayers(target, target.width, target.height, 0, 0, W, H);
      target.width = W; target.height = H;
      delete target.lowerTileStacks; delete target.upperTileStacks;
      if (next.startMapId === mapId && (next.startPos.x >= W || next.startPos.y >= H)) next.startPos = { ...next.startPos, x: r.start.x, y: r.start.y };
    }
    for (let i = 0; i < W * H; i++) { setLayerTileAt(target, 3, i, -1); setLayerTileAt(target, 4, i, -1); clearTileStack(target, "upper", i); }
    target.lowerTiles = [...r.lower];
    target.upperTiles = [...r.upper];
    const errs: string[] = [];
    if (!walkable(next, target, r.start.x, r.start.y)) errs.push(`시작 칸 (${r.start.x},${r.start.y}) 이 막혔다`);
    const seen = walkable(next, target, r.start.x, r.start.y) ? reachable(next, target, r.start) : new Set<number>();
    const need = (c: Cell, what: string) => {
      if (!walkable(next, target, c.x, c.y)) errs.push(`${what} (${c.x},${c.y}) 이 막혔다`);
      else if (!seen.has(c.y * W + c.x)) errs.push(`${what} (${c.x},${c.y}) 에 시작 칸에서 닿지 못한다`);
    };
    for (const d of r.buildings) {
      for (const c of d.doors) if (walkable(next, target, c.x, c.y)) errs.push(`${d.name} 문 칸 (${c.x},${c.y}) 이 열려 있다`);
      for (const c of d.access) need(c, `${d.name} 접근칸`);
    }
    for (const b of r.bridges) { need(b.from, "다리 머리"); need(b.to, "다리 끝"); }
    for (const c of r.exits) need(c, "출구");
    if (errs.length) throw new ToolError(`${STYLE_KO[style]} 한 장을 깔지 못했다 — ${errs.slice(0, 4).join(" / ")}. seed 를 바꿔 다시 부른다`, { code: "compose-failed", mapId });
    target.locations = (target.locations ?? []).filter((l) => !(l.tags ?? []).includes("sky-island"));
    for (const d of r.buildings) {
      const door = d.doors[0];
      addMapLocation(target, {
        name: d.name, x: d.rect.x, y: d.rect.y, w: d.rect.w, h: d.rect.h,
        note: door ? `문 (${door.x},${door.y}) · 접근칸 (${d.access[0]!.x},${d.access[0]!.y}) — 실내는 compose_sky_island_map(style:"room-…") 으로 새 맵에 짓고 link_sky_island_interior 로 잇는다` : "문 없는 건물",
        tags: ["sky-island", "sky-building", d.kit],
      });
    }
    for (const z of r.zones) addMapLocation(target, { name: z.name, x: z.rect.x, y: z.rect.y, w: z.rect.w, h: z.rect.h, note: `쓰임: ${z.use}`, tags: ["sky-island", `sky-${z.use}`] });
    const blocked = (target.events ?? []).filter((e) => !walkable(next, target, e.x, e.y)).map((e) => `${e.name ?? e.id}(${e.x},${e.y})`);
    draft.maps[mapId] = target;
    if (resize) { draft.startPos = next.startPos; }
    const bridges = r.bridges.map((b) => `${b.kind === "stone" ? "돌다리" : b.kind === "pier" ? "잔교" : "밧줄 다리"} (${b.from.x},${b.from.y})→(${b.to.x},${b.to.y})`);
    return {
      summary: `${STYLE_KO[style]} 한 장을 ${W}×${H} 맵(${mapId})에 짰다(seed ${seed}${resize ? `, 빈 맵을 ${map.width}×${map.height}→${W}×${H} 로 맞춤` : ""}) — 건물 ${r.buildings.length}채, 다리 ${r.bridges.length}, 소품 ${r.props.length}개, 쓰임 구역 ${r.zones.length}. `
        + `시작 칸 (${r.start.x},${r.start.y}) 에서 모든 문 접근칸·다리 끝${r.exits.length ? "·출구" : ""}에 닿음(엔진 통행). `
        + (r.buildings.length ? `건물 문: ${r.buildings.map((d) => `${d.name} (${d.doors.map((c) => `${c.x},${c.y}`).join(" · ") || "문 없음"})`).join(" · ")}. 문마다 실내를 compose_sky_island_map(style:"room-cottage" 등) 으로 새 맵에 짓고 link_sky_island_interior 로 잇는다. ` : "")
        + (r.exits.length ? `출구 깔개 ${r.exits.map((c) => `(${c.x},${c.y})`).join(" ")} — 바깥 건물 문과 link_sky_island_interior 로 잇는다. ` : "")
        + (r.notes.length ? `참고: ${r.notes.join(" / ")}. ` : "") + (blocked.length ? `경고: 막힌 칸 위 이벤트 ${blocked.join(", ")}.` : ""),
      data: {
        mapId, style, seed, width: W, height: H, start: r.start, exits: r.exits,
        buildings: r.buildings.map((d) => ({ name: d.name, kit: d.kit, rect: d.rect, doors: d.doors, access: d.access })),
        bridges, zones: r.zones.map((z) => ({ name: z.name, use: z.use, rect: z.rect })), props: r.props.length,
      },
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
/** 실내 출구 = 출구 깔개(si-exit-mat) 칸. 없으면 맨 아래 걸음 칸 덩이 하나. */
function interiorExit(project: Project, map: GameMap): { cells: Cell[]; why?: string } {
  const def = project.tilesets[map.tilesetId];
  const mat = new Set((def?.tileGroups ?? []).filter((g) => g.id === "si:si-exit-mat").flatMap((g) => g.tileIds));
  const mats: Cell[] = [];
  map.lowerTiles.forEach((t, i) => { if (mat.has(t)) mats.push({ x: i % map.width, y: Math.floor(i / map.width) }); });
  if (mats.length) return { cells: mats.filter((c) => isPassable(project, map, c.x, c.y)) };
  const y = map.height - 1; const runs: Cell[][] = [];
  for (let x = 0; x < map.width; x++) {
    if (!isPassable(project, map, x, y)) continue;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1]!.x === x - 1) last.push({ x, y }); else runs.push([{ x, y }]);
  }
  if (runs.length !== 1) return { cells: [], why: runs.length ? `맨 아래 줄 걸음 칸 덩이가 ${runs.length}군데` : "출구 깔개도 맨 아래 걸음 칸도 없다" };
  return { cells: runs[0]! };
}

export const LINK_SKY_ISLAND_INTERIOR_TOOL: ToolDefinition = {
  name: "link_sky_island_interior",
  mode: "write",
  domains: ["map", "event"],
  fillsCurrentMapId: true,
  description: "하늘섬(sky_island) 야외 건물의 문과 이미 지은 실내 맵(compose_sky_island_map style:room-…)을 왕복 이동으로 잇는다. 바깥 쪽은 문 바로 아래 접근칸에 들어가는 발판, 실내 쪽은 출구 깔개에 나오는 발판을 만든다(막힌 문 칸에는 이벤트를 두지 않는다 — create_transfer_pair 를 따로 부르지 않는다). "
    + "door = compose_sky_island_map 결과 data.buildings[].doors 의 칸(막힌 문 칸) 또는 접근칸. 문 앞에 다른 이벤트가 있으면 거부한다(replace:true 면 바꾼다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "야외 하늘섬 맵 id. 생략하면 지금 보는 맵" },
      door: { type: "object", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"], additionalProperties: false, description: "건물 문 칸 또는 문 바로 아래 접근칸" },
      interiorMapId: { type: "string", description: "이미 지은 실내 맵 id" },
      replace: { type: "boolean", description: "문 앞·출구의 기존 이벤트를 바꾼다" },
    },
    required: ["door", "interiorMapId"],
    additionalProperties: false,
  },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 야외 하늘섬 맵 id 를 준다", { code: "map-not-found" });
    const outer = requireMap(draft, mapId);
    if (!isSkyIslandTilesetDef(draft.tilesets[outer.tilesetId])) throw new ToolError(`맵 ${mapId} 의 칩셋 ${outer.tilesetId} 는 sky_island 가 아니다 — 하늘섬 야외 맵에서만 쓴다`, { code: "tileset-family-mismatch", mapId });
    const interiorId = typeof args.interiorMapId === "string" ? args.interiorMapId.trim() : "";
    const interior = requireMap(draft, interiorId);
    if (interior.id === outer.id) throw new ToolError("실내 맵이 야외 맵과 같다", { code: "invalid-args" });
    const d = args.door as { x: number; y: number };
    const c0 = { x: Number(d?.x), y: Number(d?.y) };
    if (!inside(outer, c0)) throw new ToolError(`문 칸 (${c0.x},${c0.y}) 이 맵 밖이다`, { code: "invalid-args", mapId });
    let front: Cell;
    if (isPassable(draft, outer, c0.x, c0.y)) {
      const above = { x: c0.x, y: c0.y - 1 };
      if (!inside(outer, above) || isPassable(draft, outer, above.x, above.y)) throw new ToolError(`(${c0.x},${c0.y}) 는 건물 문 칸도, 문 바로 아래 접근칸도 아니다 — compose_sky_island_map 결과의 문 칸을 준다`, { code: "not-a-door", mapId });
      front = c0;
    } else {
      front = { x: c0.x, y: c0.y + 1 };
      if (!inside(outer, front) || !isPassable(draft, outer, front.x, front.y)) throw new ToolError(`문 (${c0.x},${c0.y}) 바로 아래 (${front.x},${front.y}) 가 걸을 수 없다`, { code: "DOOR_BLOCKED", mapId });
    }
    const replace = args.replace === true;
    const old = eventAt(outer, front);
    if (old && !replace) throw new ToolError(`문 앞 (${front.x},${front.y}) 에 이미 이벤트가 있다 — replace:true 로 바꾼다`, { code: "door-event-exists", mapId });
    const outLanding = [{ x: front.x, y: front.y + 1 }, { x: front.x - 1, y: front.y + 1 }, { x: front.x + 1, y: front.y + 1 }, { x: front.x - 1, y: front.y }, { x: front.x + 1, y: front.y }].find((c) => inside(outer, c) && isPassable(draft, outer, c.x, c.y) && !eventAt(outer, c));
    if (!outLanding) throw new ToolError(`문 앞 (${front.x},${front.y}) 둘레에 나와서 설 칸이 없다`, { code: "no-exterior-landing", mapId });
    const exit = interiorExit(draft, interior);
    if (!exit.cells.length) throw new ToolError(`실내 맵 ${interiorId} 의 출구를 못 찾았다 — ${exit.why ?? "출구 깔개가 걸을 수 없다"}. compose_sky_island_map(style:"room-…") 으로 지은 방을 준다`, { code: "no-interior-exit", mapId: interiorId });
    if (exit.cells.length > 4) throw new ToolError(`실내 출구가 ${exit.cells.length}칸이다 — 4칸 이하여야 한다`, { code: "interior-exit-too-wide", mapId: interiorId });
    const taken = exit.cells.map((c) => eventAt(interior, c)).filter((e): e is GameEvent => !!e);
    if (taken.length && !replace) throw new ToolError(`실내 출구 ${taken.map((e) => `(${e.x},${e.y})`).join(" ")} 에 이미 이벤트가 있다 — replace:true 면 바꾼다`, { code: "exit-event-exists", mapId: interiorId });
    const exitSet = new Set(exit.cells.map((c) => `${c.x},${c.y}`));
    const inLanding = exit.cells.flatMap((c) => [{ x: c.x, y: c.y - 1 }, { x: c.x, y: c.y - 2 }])
      .find((c) => inside(interior, c) && isPassable(draft, interior, c.x, c.y) && !exitSet.has(`${c.x},${c.y}`) && !eventAt(interior, c));
    if (!inLanding) throw new ToolError("실내 출구 바로 위(두 칸까지)가 막혔다 — 출구 안쪽 칸을 비운다", { code: "no-interior-landing", mapId: interiorId });
    if (old) outer.events = (outer.events ?? []).filter((e) => e !== old);
    if (taken.length) interior.events = (interior.events ?? []).filter((e) => !taken.includes(e));
    const enterId = uniqueEventId(draft, `ev_si_enter_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`);
    outer.events = [...(outer.events ?? []), gateEvent(enterId, `${interior.name} 들어가기`, front, { mapId: interiorId, ...inLanding })];
    const leave: string[] = [];
    for (const c of exit.cells) { const id = uniqueEventId(draft, `ev_si_exit_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`); leave.push(id); interior.events = [...(interior.events ?? []), gateEvent(id, `${outer.name} 로 나가기`, c, { mapId, ...outLanding })]; }
    const node = extractTreeNode(draft.mapTree, interiorId as MapId);
    if (node && !insertTreeNode(draft.mapTree, node, mapId as MapId)) insertTreeNode(draft.mapTree, node, "");
    return {
      summary: `${outer.name} 문 앞 (${front.x},${front.y}) ↔ ${interior.name}: 들어가면 실내 (${inLanding.x},${inLanding.y}), 출구 ${exit.cells.map((c) => `(${c.x},${c.y})`).join(" ")} 에서 나오면 야외 (${outLanding.x},${outLanding.y})`,
      data: { mapId, front, interiorMapId: interiorId, enterEventId: enterId, exitEventIds: leave, entryLanding: inLanding, exitCells: exit.cells, exitLanding: outLanding },
    };
  },
};

export const SKY_ISLAND_TOOLS: readonly ToolDefinition[] = [COMPOSE_SKY_ISLAND_MAP_TOOL, LINK_SKY_ISLAND_INTERIOR_TOOL];
