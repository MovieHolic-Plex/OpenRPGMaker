// 현대 학교·캠퍼스(modern_campus) 야외 구성 도구 — compose_campus_grounds(학교 교정·대학 쿼드 한 장), link_campus_interior(건물 문 ↔ 실내 맵).
// 배치는 구성기 src/project/campusComposer.ts 가 짠다(계획 → 건물 → 길 → 소품, 씨앗마다 다른 교정). 이 도구는 그 결과를 맵에 쓰고,
// 문 칸은 막힘·접근칸은 걸을 수 있음·시작 칸에서 모든 접근칸에 닿는지를 엔진 통행(isPassable)으로 다시 확인한다. 실패하면 맵을 바꾸지 않는다.
import { isCampusTilesetDef } from "@/ai/campusPolicy";
import { isPassable } from "@/project/collision";
import { setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import { extractTreeNode, insertTreeNode } from "@/project/mapTree";
import { CAMPUS_MIN_SIZE, campusPaletteFromTileset, composeCampus, type CampusKit, type CampusStyle } from "@/project/campusComposer";
import { campusDoorCells, campusDoorTileIds, eventTransfersToExistingMap, findCampusDeadDoors, type DeadDoor } from "@/project/campusDoors";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";
import { claimStartIfBlank } from "./composerStart";
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

/**
 * 구성기가 낸 건물 문 중 아직 실내로 이어지지 않은 것(문 앞 접근칸에 이동 이벤트가 없다).
 * 2026-10-14 실조수 검증: 모델이 본관 하나만 잇고 체육관·별관 문(13,13)·(39,13)은 말없이 죽은 문으로 남겼다 —
 * 연결은 link_campus_interior 호출이 전부라 빠져도 어느 도구도 알려 주지 않았다. 건물 위치(location)의 note 에 문 좌표가 있다.
 */
function unlinkedBuildingDoors(project: Project, outer: GameMap): { name: string; x: number; y: number }[] {
  const out: { name: string; x: number; y: number }[] = [];
  for (const loc of outer.locations ?? []) {
    if (!(loc.tags ?? []).includes("campus-building") || !(loc.tags ?? []).includes("campus-entrance")) continue;
    const m = /문 \((\d+),(\d+)\)(?: 외 (\d+)칸)?/.exec(loc.note ?? "");
    if (!m) continue;
    const x0 = Number(m[1]), y = Number(m[2]), extra = Number(m[3] ?? 0);
    let linked = false;
    for (let i = 0; i <= extra && !linked; i++) {
      linked = (outer.events ?? []).some((e) => e.x === x0 + i && e.y === y + 1 && eventTransfersToExistingMap(e, (id) => !!project.maps[id]));
    }
    if (!linked) out.push({ name: String(loc.name).replace(/ 건물$/, ""), x: x0, y });
  }
  return out;
}

export const COMPOSE_CAMPUS_GROUNDS_TOOL: ToolDefinition = {
  name: "compose_campus_grounds",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "캠퍼스 칩셋(modern_campus) 야외 맵 한 장을 통째로 짠다(구성기 — 씨앗마다 다른 배치). "
    + "style:school = 한국 학교 교정(북쪽 건물 줄 [옆동·본관·체육관] + 앞 광장 · 남쪽 벽돌 담과 교문 · 운동장(흙·흰 선·골대·스탠드) · 정원·벤치·가로등·나무, 48×36 이상); "
    + "style:university = 대학 캠퍼스(쿼드 잔디 + 십자 길 + 분수 광장 · 북쪽 세 동 · 남쪽 두 동 · 생울타리와 교문, 52×40 이상). "
    + "buildings 로 건물을 고른다(키트 끝말). school = [본관 school-12|school-8, 옆동 school-annex|school-6|cafeteria, 체육관 gym|gym-green]; "
    + "university = [북쪽 가운데 hall-12|library, 북쪽 왼쪽 hall-9|hall-7|lab, 북쪽 오른쪽 library|dorm-7|dorm-5|hall-6, 남쪽 왼쪽 admin|hall-9, 남쪽 오른쪽 union|lab|hall-7]. "
    + "seed 를 바꾸면 운동장 방향·건물·나무·소품 자리가 달라진다. "
    + "**문 그림은 안으로 이어지는 건물에만 찍는다(장식 문 금지)**: entrances 에 [{building, interiorMapId}] 로 적은 건물만 문이 나고 같은 호출에서 실내에 이어진다(실내 맵은 먼저 build_hand_interior_room 으로 지어 둔다). 안 적은 건물은 문 없는 벽면이다 — 나중에 안을 달려면 link_campus_interior({building}) 가 문을 내고 잇는다. "
    + "문 접근칸은 길이고 시작 칸에서 닿는지 엔진 통행으로 확인한다. 이음이 하나라도 실패하거나 안 닿으면 맵을 바꾸지 않는다. 손댄 맵은 replace:true 여야 다시 깐다(옛 들어가기 이벤트는 지우고 이벤트는 그 밖엔 남는다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 modern_campus 여야 한다" },
      style: { type: "string", enum: ["school", "university"], description: "school 학교 교정 | university 대학 캠퍼스" },
      buildings: { type: "array", items: { type: "string" }, description: "건물 키트 끝말 목록(설명의 슬롯 순서). 비우면 씨앗이 고른다" },
      seed: { type: "integer", minimum: 0, description: "배치 씨앗(생략 0)" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 깐다" },
      entrances: {
        type: "array", description: "문을 낼 건물과 그 실내. building = 키트 끝말(school-12·gym·library …) 또는 건물 이름(본관·체육관 …), interiorMapId = 이미 지은 실내 맵. 안 적은 건물은 문 없는 벽면(장식 문 없음)",
        items: { type: "object", properties: { building: { type: "string" }, interiorMapId: { type: "string" } }, required: ["building", "interiorMapId"], additionalProperties: false },
      },
    },
    required: ["style"],
    additionalProperties: false,
  },
  invalidArgsExample: { style: "school", buildings: ["school-12", "cafeteria", "gym"], seed: 2, entrances: [{ building: "school-12", interiorMapId: "map_main_hall" }] },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 캠퍼스 맵 id 를 준다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!isCampusTilesetDef(tileset)) throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 캠퍼스(modern_campus)가 아니다 — create_map({tilesetId:"modern_campus"}) 로 새 맵을 만든다`, { code: "wrong-tileset", mapId });
    const style: CampusStyle | null = args.style === "university" || args.style === "street" ? "university" : args.style === "school" ? "school" : null;
    if (!style) throw new ToolError("style 은 school 또는 university 이다", { code: "invalid-args" });
    const min = CAMPUS_MIN_SIZE[style];
    if (map.width < min.w || map.height < min.h) throw new ToolError(`맵이 작다(${map.width}×${map.height}) — ${style} 는 ${min.w}×${min.h} 이상이어야 한다. resize_map 한 뒤 부른다`, { code: "map-too-small", mapId });
    if (!isUntouched(map) && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 지우고 다시 깔려면 replace:true 를 준다(이벤트는 남는다)", { code: "map-not-blank", mapId });
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 0;
    const buildings = Array.isArray(args.buildings) ? args.buildings.filter((b): b is string => typeof b === "string" && !!b.trim()).map((b) => b.trim()) : [];
    const pal = campusPaletteFromTileset(tileset!);
    for (const b of buildings) {
      const id = b.startsWith("mc-") ? b : `mc-bld-${b.replace(/^bld-/, "")}`;
      if (!pal.kit(id)) throw new ToolError(`캠퍼스 칩셋에 건물 '${b}' 이 없다 — 설명의 키트 끝말(school-12·library·dorm-7 …) 중에서 고른다`, { code: "invalid-args" });
    }
    // 문을 낼 건물 — 건물 목록은 씨앗이 정하므로(buildings 를 안 줬을 때) 먼저 문 없이 한 번 짜서 이름을 풀고, 푼 키트로 다시 짠다.
    const rawEntrances = Array.isArray(args.entrances) ? args.entrances : [];
    const wanted = rawEntrances.map((e) => e as { building?: unknown; interiorMapId?: unknown });
    for (const w of wanted) if (typeof w?.building !== "string" || !w.building.trim() || typeof w?.interiorMapId !== "string" || !w.interiorMapId.trim()) throw new ToolError("entrances 항목은 {building, interiorMapId} 이다", { code: "invalid-args" });
    let r;
    let entranceKits: { kit: string; interiorMapId: string; label: string }[] = [];
    try {
      const probe = composeCampus({ width: map.width, height: map.height, style, seed, buildings }, pal);
      const norm = (v: string) => v.replace(/^mc-bld-/, "").replace(/^bld-/, "").toLowerCase();
      entranceKits = wanted.map((w) => {
        const label = String(w.building).trim();
        const hit = probe.buildings.find((b) => norm(b.kit) === norm(label) || b.name === label);
        if (!hit) throw new ToolError(`entrances 의 건물 '${label}' 이 이 교정에 없다 — 놓인 건물: ${probe.buildings.map((b) => `${b.name}(${b.kit.replace(/^mc-bld-/, "")})`).join(", ")}`, { code: "building-not-found", mapId });
        return { kit: hit.kit, interiorMapId: String(w.interiorMapId).trim(), label };
      });
      for (const e of entranceKits) if (!draft.maps[e.interiorMapId]) throw new ToolError(`entrances 의 실내 맵 '${e.interiorMapId}' 이 없다 — build_hand_interior_room 으로 먼저 지은 맵 id 를 준다(없는 곳으로 가는 문은 내지 않는다)`, { code: "map-not-found", mapId });
      if (new Set(entranceKits.map((e) => e.kit)).size !== entranceKits.length) throw new ToolError("같은 건물이 entrances 에 두 번 있다", { code: "invalid-args" });
      r = composeCampus({ width: map.width, height: map.height, style, seed, buildings, entrances: entranceKits.map((e) => e.kit) }, pal);
    } catch (e) {
      if (e instanceof ToolError) throw e;
      throw new ToolError(`캠퍼스를 짜지 못했다 — ${(e as Error).message}`, { code: "compose-failed", mapId });
    }

    const next = structuredClone(draft);
    const target = next.maps[mapId]!;
    for (let i = 0; i < target.lowerTiles.length; i++) { setLayerTileAt(target, 3, i, -1); setLayerTileAt(target, 4, i, -1); clearTileStack(target, "upper", i); }
    target.lowerTiles = [...r.lower];
    target.upperTiles = [...r.upper];
    const errs: string[] = [];
    const W = target.width;
    if (!walkable(next, target, r.start.x, r.start.y)) errs.push(`시작 칸 (${r.start.x},${r.start.y}) 이 막혔다`);
    const seen = walkable(next, target, r.start.x, r.start.y) ? reachable(next, target, r.start) : new Set<number>();
    for (const d of r.buildings) {
      if (!d.entrance) continue; // 문 없는 벽면 — 접근칸이 없다
      for (const c of d.doors) if (walkable(next, target, c.x, c.y)) errs.push(`${d.name} 문 칸 (${c.x},${c.y}) 이 열려 있다`);
      for (const c of d.access) {
        if (!walkable(next, target, c.x, c.y)) errs.push(`${d.name} 접근칸 (${c.x},${c.y}) 이 막혔다`);
        else if (!seen.has(c.y * W + c.x)) errs.push(`${d.name} 접근칸 (${c.x},${c.y}) 에 시작 칸에서 닿지 못한다`);
      }
    }
    if (errs.length) throw new ToolError(`캠퍼스를 깔지 못했다 — ${errs.slice(0, 4).join(" / ")}. seed 를 바꾸거나 buildings 를 줄여 다시 부른다`, { code: "compose-failed", mapId });
    target.locations = (target.locations ?? []).filter((l) => !(l.tags ?? []).includes("campus-building"));
    // 다시 깔면 옛 배치의 «들어가기» 이벤트는 엉뚱한 자리에 남는다 — 지운다(새 문은 아래에서 다시 잇는다).
    const staleEnter = (target.events ?? []).filter((e) => e.id.startsWith("ev_mc_enter_"));
    if (staleEnter.length) target.events = (target.events ?? []).filter((e) => !staleEnter.includes(e));
    for (const d of r.buildings) {
      const door = d.doors[0]!;
      addMapLocation(target, {
        name: `${d.name} 건물`, x: d.rect.x, y: d.rect.y, w: d.rect.w, h: d.rect.h,
        note: d.entrance ? `문 (${door.x},${door.y}) 외 ${d.doors.length - 1}칸 · 접근칸 (${d.access[0]!.x},${d.access[0]!.y})` : `문 없는 벽면(문이 있었을 자리 (${door.x},${door.y})) — 안을 달려면 build_hand_interior_room(tileset:modern_campus) 으로 실내를 짓고 link_campus_interior({building:"${d.kit.replace(/^mc-bld-/, "")}", interiorMapId}) 로 문을 내며 잇는다`,
        tags: ["campus-building", COMPOSED_LAYOUT_TAG, d.kit],
      });
    }
    // 문 그림과 이음은 한 거래 — 문이 난 건물은 같은 호출에서 실내에 잇는다. 하나라도 실패하면 next 를 버리고 맵을 바꾸지 않는다.
    const linkedSummaries: string[] = [];
    for (const e of entranceKits) {
      const b = r.buildings.find((x) => x.kit === e.kit)!;
      let plan: LinkPlan;
      try { plan = linkEntrance(next, target, e.interiorMapId, b.access, true); }
      catch (err) {
        if (err instanceof ToolError) throw new ToolError(`'${e.label}' 의 문을 실내 '${e.interiorMapId}' 에 잇지 못해 캠퍼스를 깔지 않았다(문만 있고 안이 없는 건물을 만들지 않는다) — ${err.message}`, { code: "entrance-link-failed", mapId });
        throw err;
      }
      const loc = (target.locations ?? []).find((l) => (l.tags ?? []).includes(e.kit));
      if (loc) markEntrance(loc as { note?: string; tags?: string[] }, b.doors, next.maps[e.interiorMapId]!.name);
      linkedSummaries.push(`${b.name} ↔ ${next.maps[e.interiorMapId]!.name}`);
      void plan;
    }
    // 마지막 검사 — 그려진 문 그림 전부가 접근 가능하고 실내로 이어졌는가(문 없는 벽면엔 문 그림이 없어야 한다).
    const dead = campusDeadDoorsOf(next, target, r.start);
    if (dead.length) throw new ToolError(`캠퍼스를 깔지 못했다 — 죽은 문 ${dead.length}개: ${dead.slice(0, 3).map((d) => d.message).join(" / ")}`, { code: "dead-door", mapId });
    const blocked = (target.events ?? []).filter((e) => !walkable(next, target, e.x, e.y)).map((e) => `${e.name ?? e.id}(${e.x},${e.y})`);
    draft.maps[mapId] = target;
    for (const e of entranceKits) draft.maps[e.interiorMapId] = next.maps[e.interiorMapId]!;
    if (entranceKits.length) draft.mapTree = next.mapTree;
    // 시작 위치: 이 맵이 시작 맵인데 시작 칸이 건물·벽에 덮였거나 시작 맵이 빈 기본 맵이면 교정 시작 칸으로(compose_modern_city_street 와 같다 — 새 프로젝트의 빈 시작 맵에 깔면 (10,8) 이 막혀 커밋이 거부됐다).
    const startNote = claimStartIfBlank(draft, mapId, r.start).note;
    return {
      summary: `${style === "school" ? "학교 교정" : "대학 캠퍼스"}를 ${map.width}×${map.height} 맵(${mapId})에 짰다(seed ${seed}) — 건물 ${r.buildings.length}채, 소품 ${r.props.length}개, 시작 칸 (${r.start.x},${r.start.y}) 에서 모든 문 접근칸에 닿음(엔진 통행). `
        + `건물: ${r.buildings.map((d) => d.entrance ? `${d.name} (문 ${d.doors.map((c) => `${c.x},${c.y}`).join(" · ")} → 실내에 이어짐)` : `${d.name} (문 없는 벽면)`).join(" · ")}. `
        + (r.buildings.some((d) => !d.entrance) ? "문 없는 건물은 안이 없다 — 실내를 달려면 build_hand_interior_room 으로 지은 뒤 link_campus_interior({building, interiorMapId}) 가 문과 이음을 한 번에 낸다(문만 있고 안이 없는 죽은 문은 만들지 않는다). " : "")
        + (r.notes.length ? ` 참고: ${r.notes.join(" / ")}.` : "") + (blocked.length ? ` 경고: 막힌 칸 위 이벤트 ${blocked.join(", ")}.` : "") + startNote,
      data: { mapId, style, seed, start: r.start, gate: r.gate, buildings: r.buildings.map((d) => ({ name: d.name, kit: d.kit, rect: d.rect, entrance: d.entrance, doors: d.entrance ? d.doors : [], access: d.entrance ? d.access : [] })), props: r.props.length },
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


/** 맵에 그려진 문 그림 전부의 죽은 문 검사 — 시작 칸에서의 엔진 통행 + 실내 이음. projectLint(campus-dead-door)와 같은 판정. */
function campusDeadDoorsOf(project: Project, map: GameMap, extraAnchor?: Cell): DeadDoor[] {
  const def = project.tilesets[map.tilesetId];
  const pal = campusPaletteFromTileset(def!);
  const kits = (def!.structureKits ?? []).map((raw) => pal.kit((raw as { id: string }).id)).filter((k): k is CampusKit => !!k);
  const { bottom } = campusDoorTileIds(kits);
  const start = project.startMapId === map.id ? project.startPos : undefined;
  const lands = [...(extraAnchor ? [extraAnchor] : []), ...(start ? [start] : [])];
  let seen: Set<number> | null = null;
  const anchor = lands.find((c) => walkable(project, map, c.x, c.y));
  if (anchor) seen = reachable(project, map, anchor);
  return findCampusDeadDoors({
    width: map.width, height: map.height, lowerTiles: map.lowerTiles, upperTiles: map.upperTiles, events: map.events ?? [],
    doorBottomIds: bottom, passable: (x, y) => walkable(project, map, x, y),
    reach: seen ? (x, y) => seen!.has(y * map.width + x) : null,
    mapExists: (id) => !!project.maps[id],
  });
}

interface LinkPlan { readonly data: Record<string, unknown>; readonly summary: string }

/**
 * 문 접근칸(fronts) ↔ 실내 맵 출입구를 왕복 이동으로 잇는다. 모든 검증을 마친 뒤에야 draft 를 바꾼다(실패하면 draft 불변).
 * link_campus_interior 와 compose_campus_grounds(entrances) 가 같은 이 함수를 쓴다 — 문 그림과 이음이 한 거래다.
 */
function linkEntrance(draft: Project, outer: GameMap, interiorId: string, fronts: readonly Cell[], replace: boolean): LinkPlan {
  const mapId = outer.id;
  const interior = requireMap(draft, interiorId);
  if (interior.id === outer.id) throw new ToolError("실내 맵이 야외 맵과 같다", { code: "invalid-args" });
  const olds = fronts.map((c) => eventAt(outer, c)).filter((e): e is GameEvent => !!e);
  if (olds.length && !replace) throw new ToolError(`문 앞 ${olds.map((e) => `(${e.x},${e.y})`).join(" ")} 에 이미 이벤트가 있다 — replace:true 로 바꾼다`, { code: "door-event-exists", mapId });
  const front = fronts[Math.floor((fronts.length - 1) / 2)]!;
  const outLanding = [{ x: front.x, y: front.y + 1 }, { x: front.x - 1, y: front.y + 1 }, { x: front.x + 1, y: front.y + 1 }, { x: front.x, y: front.y + 2 }].find((c) => inside(outer, c) && isPassable(draft, outer, c.x, c.y) && !eventAt(outer, c));
  if (!outLanding) throw new ToolError(`문 앞 (${front.x},${front.y}) 둘레에 나와서 설 칸이 없다 — 문 앞 포석을 두 줄 이상 깐다`, { code: "no-exterior-landing", mapId });
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
  // 여기부터 변경 — 위 검증이 모두 통과했다.
  if (olds.length) outer.events = (outer.events ?? []).filter((e) => !olds.includes(e));
  if (taken.length) interior.events = (interior.events ?? []).filter((e) => !taken.includes(e));
  const enter: string[] = [], leave: string[] = [];
  for (const c of fronts) { const id = uniqueEventId(draft, `ev_mc_enter_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`); enter.push(id); outer.events = [...(outer.events ?? []), gateEvent(id, `${interior.name} 들어가기`, c, { mapId: interiorId, ...inLanding })]; }
  for (const c of exit.cells) { const id = uniqueEventId(draft, `ev_mc_exit_${interiorId.replace(/[^a-z0-9]+/gi, "_")}`); leave.push(id); interior.events = [...(interior.events ?? []), gateEvent(id, `${outer.name} 로 나가기`, c, { mapId, ...outLanding })]; }
  const node = extractTreeNode(draft.mapTree, interiorId as MapId);
  if (node && !insertTreeNode(draft.mapTree, node, mapId as MapId)) insertTreeNode(draft.mapTree, node, "");
  return {
    summary: `${outer.name} 문 앞 ${fronts.map((c) => `(${c.x},${c.y})`).join(" ")} ↔ ${interior.name}: 들어가면 실내 (${inLanding.x},${inLanding.y}), 실내 출입구 ${exit.cells.map((c) => `(${c.x},${c.y})`).join(" ")} 에서 나오면 야외 (${outLanding.x},${outLanding.y})`,
    data: { mapId, fronts, interiorMapId: interiorId, enterEventIds: enter, exitEventIds: leave, entryLanding: inLanding, exitCells: exit.cells, exitLanding: outLanding },
  };
}

/** 위치(location)의 건물 한 채 — 문 칸을 키트에서 다시 계산한다. */
function buildingDoors(tileset: Parameters<typeof campusPaletteFromTileset>[0], loc: { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly tags?: readonly string[] }): { kit: CampusKit; doors: Cell[]; access: Cell[] } | undefined {
  const kitId = (loc.tags ?? []).find((t) => t.startsWith("mc-bld-"));
  const kit = kitId ? campusPaletteFromTileset(tileset).kit(kitId) : undefined;
  const cells = kit ? campusDoorCells(kit) : undefined;
  if (!kit || !cells) return undefined;
  const doors = Array.from({ length: cells.w }, (_, i) => ({ x: loc.x + cells.dx + i, y: loc.y + kit.height - 1 }));
  return { kit, doors, access: doors.map((c) => ({ x: c.x, y: c.y + 1 })) };
}

/** 문 없는 벽면에 키트의 문 그림을 되살린다(문을 내는 건 이음과 한 거래라 link_campus_interior 만 부른다). */
function restoreDoorArt(map: GameMap, kit: CampusKit, loc: { readonly x: number; readonly y: number }): void {
  const cells = campusDoorCells(kit);
  if (!cells) return;
  for (const row of [cells.topRow, cells.bottomRow]) for (let i = 0; i < cells.w; i++) {
    const X = loc.x + cells.dx + i, Y = loc.y + row;
    if (!inside(map, { x: X, y: Y })) continue;
    const k = Y * map.width + X, src = kit.rows[row];
    const lo = src?.tiles[cells.dx + i] ?? -1, up = src?.upperTiles?.[cells.dx + i] ?? -1;
    if (lo >= 0) map.lowerTiles[k] = lo;
    map.upperTiles[k] = up;
  }
}

function markEntrance(loc: { note?: string; tags?: string[] }, doors: readonly Cell[], interiorName: string): void {
  loc.tags = [...(loc.tags ?? []).filter((t) => t !== "campus-entrance"), "campus-entrance"];
  loc.note = `문 (${doors[0]!.x},${doors[0]!.y}) 외 ${doors.length - 1}칸 · 접근칸 (${doors[0]!.x},${doors[0]!.y + 1}) — ${interiorName} 로 이어짐(들어가기 이벤트가 접근칸에 있다)`;
}

export const LINK_CAMPUS_INTERIOR_TOOL: ToolDefinition = {
  name: "link_campus_interior",
  mode: "write",
  domains: ["map", "event"],
  fillsCurrentMapId: true,
  description: "캠퍼스(modern_campus) 야외 건물에 이미 지은 실내 맵(build_hand_interior_room, tileset:modern_campus)을 왕복 이동으로 잇는다. 거리(바깥) 쪽은 문 바로 아래 접근칸에 들어가는 발판, 실내 쪽은 맨 아래 출입구 틈에 나오는 발판을 만든다(막힌 문 칸에는 이벤트를 두지 않는다 — create_transfer_pair 를 따로 부르지 않는다). "
    + "문 그림은 안으로 이어지는 건물에만 있다: compose_campus_grounds 는 entrances 에 적은 건물만 문을 내고 나머지는 문 없는 벽면이다. 문 없는 건물에 실내를 달려면 building(키트 끝말·건물 이름) 으로 부른다 — 이 도구가 문 그림을 내고 이음까지 한 번에 한다(실패하면 문도 안 난다). "
    + "이미 문이 있는 건물은 door = compose_campus_grounds 결과 data.buildings[].doors 의 칸(막힌 문 칸) 또는 접근칸, 문이 두 칸이면 width:2. 실내 평면의 남쪽 출입구 틈은 한 군데(1~4칸)여야 한다. 문 앞에 다른 이벤트가 있으면 거부한다(replace:true 면 바꾼다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "야외 캠퍼스 맵 id. 생략하면 지금 보는 맵" },
      building: { type: "string", description: "문을 낼/잇는 건물(키트 끝말 school-12·gym 또는 건물 이름 본관·체육관). 문 없는 벽면이면 문 그림도 낸다. door 대신 쓴다" },
      door: { type: "object", properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } }, required: ["x", "y"], additionalProperties: false, description: "이미 문이 있는 건물의 문 칸(가장 왼쪽 칸) 또는 문 바로 아래 접근칸" },
      width: { type: "integer", minimum: 1, maximum: 4, description: "door 를 쓸 때 문 칸 수(기본 1)" },
      interiorMapId: { type: "string", description: "이미 지은 실내 맵 id" },
      replace: { type: "boolean", description: "문 앞·출입구 틈의 기존 이벤트를 바꾼다" },
    },
    required: ["interiorMapId"],
    additionalProperties: false,
  },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 야외 캠퍼스 맵 id 를 준다", { code: "map-not-found" });
    const outer = requireMap(draft, mapId);
    const tileset = draft.tilesets[outer.tilesetId];
    if (!isCampusTilesetDef(tileset)) throw new ToolError(`맵 ${mapId} 의 칩셋 ${outer.tilesetId} 는 modern_campus 가 아니다 — 캠퍼스 야외 맵에서만 쓴다`, { code: "tileset-family-mismatch", mapId });
    const interiorId = typeof args.interiorMapId === "string" ? args.interiorMapId.trim() : "";
    const replace = args.replace === true;
    const wantBuilding = typeof args.building === "string" ? args.building.trim() : "";
    let fronts: Cell[] = [];
    let building: { loc: NonNullable<GameMap["locations"]>[number]; kit: CampusKit; doors: Cell[] } | undefined;
    if (wantBuilding) {
      const locs = (outer.locations ?? []).filter((l) => (l.tags ?? []).includes("campus-building"));
      const norm = (v: string) => v.replace(/^mc-bld-/, "").replace(/^bld-/, "").toLowerCase();
      const loc = locs.find((l) => (l.tags ?? []).some((t) => norm(t) === norm(wantBuilding)) || String(l.name).replace(/ 건물$/, "") === wantBuilding);
      if (!loc) throw new ToolError(`건물 '${wantBuilding}' 을 이 맵에서 찾지 못했다 — ${locs.map((l) => String(l.name).replace(/ 건물$/, "")).join(", ") || "compose_campus_grounds 로 먼저 교정을 깐다"}`, { code: "building-not-found", mapId });
      const found = buildingDoors(tileset!, loc);
      if (!found) throw new ToolError(`건물 '${wantBuilding}' 의 키트에 출입구 부품이 없다`, { code: "building-no-door-part", mapId });
      building = { loc, kit: found.kit, doors: found.doors };
      fronts = found.access;
      for (const c of fronts) if (!inside(outer, c) || !isPassable(draft, outer, c.x, c.y)) throw new ToolError(`건물 '${wantBuilding}' 문 앞 (${c.x},${c.y}) 이 걸을 수 없다 — 문 앞 포석을 먼저 깐다`, { code: "DOOR_BLOCKED", mapId });
    } else {
      const d = args.door as { x: number; y: number } | undefined;
      if (!d) throw new ToolError("door({x,y}) 또는 building(키트 끝말·건물 이름) 중 하나를 준다", { code: "invalid-args" });
      const width = Number.isInteger(args.width) ? Math.max(1, Math.min(4, Number(args.width))) : 1;
      for (let i = 0; i < width; i++) {
        const c = { x: Number(d.x) + i, y: Number(d.y) };
        if (!inside(outer, c)) throw new ToolError(`문 칸 (${c.x},${c.y}) 이 맵 밖이다`, { code: "invalid-args", mapId });
        if (isPassable(draft, outer, c.x, c.y)) {
          const above = { x: c.x, y: c.y - 1 };
          if (!inside(outer, above) || isPassable(draft, outer, above.x, above.y)) throw new ToolError(`(${c.x},${c.y}) 는 건물 문 칸도, 문 바로 아래 접근칸도 아니다 — 문이 없는 건물이면 building 으로 부르면 문을 내고 잇는다`, { code: "not-a-door", mapId });
          fronts.push(c);
        } else {
          const front = { x: c.x, y: c.y + 1 };
          if (!inside(outer, front) || !isPassable(draft, outer, front.x, front.y)) throw new ToolError(`문 (${c.x},${c.y}) 바로 아래 (${front.x},${front.y}) 가 걸을 수 없다 — 문 앞 포석을 먼저 깐다`, { code: "DOOR_BLOCKED", mapId });
          fronts.push(front);
        }
      }
    }
    const linked = linkEntrance(draft, outer, interiorId, fronts, replace);
    // 문 없는 벽면이었다면 이음이 성립한 뒤에만 문 그림을 낸다(위에서 던졌다면 여기 오지 않는다).
    if (building) {
      const wasDoorless = !(building.loc.tags ?? []).includes("campus-entrance");
      if (wasDoorless) restoreDoorArt(outer, building.kit, building.loc);
      markEntrance(building.loc as { note?: string; tags?: string[] }, building.doors, requireMap(draft, interiorId).name);
    }
    const unlinked = unlinkedBuildingDoors(draft, outer);
    return {
      summary: `${linked.summary}${building ? ` — 건물 '${String(building.loc.name).replace(/ 건물$/, "")}' 문 ${(building.loc.tags ?? []).includes("campus-entrance") ? "그림 있음" : ""}` : ""}`
        + (unlinked.length
          ? `. 문 그림은 있는데 실내에 안 이어진 건물 ${unlinked.length}곳: ${unlinked.map((u) => `${u.name} (${u.x},${u.y})`).join(" · ")} — 죽은 문이다(저장 검사가 거부한다). 각각 build_hand_interior_room 으로 짓고 link_campus_interior 로 잇는다`
          : ". 문 그림이 있는 건물은 모두 실내에 이어졌다"),
      data: { ...linked.data, unlinkedDoors: unlinked },
    };
  },
};

export const CAMPUS_TOOLS: readonly ToolDefinition[] = [COMPOSE_CAMPUS_GROUNDS_TOOL, LINK_CAMPUS_INTERIOR_TOOL];
