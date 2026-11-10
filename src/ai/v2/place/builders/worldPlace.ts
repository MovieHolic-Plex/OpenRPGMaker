// 조수 v2 세계 장소 빌더 — 게임 세계(world.ts)의 장소 종류 하나를 그 칩셋의 결정론 구성기 한 번으로 짓는다(style "world:<세계>:<종류>").
// 새 그림·새 시공기는 없다: 맵을 만들고(구성기가 스스로 만드는 세계는 newMap) compose_*_map 을 부른 뒤, 잇기에 쓸 들어오는 칸과 집 문 앞 칸을 결과에 싣는다.
import { isPassable } from "@/project/collision";
import { isUntouchedMap } from "@/project/projectBlankness";
import type { GameMap, Project } from "@/project/types";
import { parseWorldStyle, type WorldKind, type WorldSetting } from "../../world";
import type { BuildRun, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../../types";
import { onePassRefusal } from "../onePass";

type Cell = { readonly x: number; readonly y: number };
type Door = Cell & { readonly kit?: string };
/** 구성기마다 씨앗에 따라 짜지 못하는 판이 있다 — 씨앗을 바꿔 몇 번 더. */
const SEED_TRIES = 4;

const cellOf = (v: unknown): Cell | undefined => {
  const c = v as { x?: unknown; y?: unknown } | undefined;
  return c && Number.isInteger(c.x) && Number.isInteger(c.y) ? { x: Number(c.x), y: Number(c.y) } : undefined;
};
const walkable = (project: Project, map: GameMap, c: Cell | undefined): c is Cell => !!c && c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height && isPassable(project, map, c.x, c.y);

/** 맨 아래에서 위로, 가운데에서 바깥으로 처음 만나는 걸을 수 있는 칸 — 실내는 아래 출입구 틈, 바깥은 남쪽 길 끝. */
function lowestWalk(project: Project, map: GameMap): Cell | undefined {
  const cx = Math.floor(map.width / 2);
  for (let y = map.height - 1; y >= 0; y--) for (let d = 0; d < map.width; d++) for (const x of [cx + d, cx - d]) {
    if (x >= 0 && x < map.width && isPassable(project, map, x, y)) return { x, y };
  }
  return undefined;
}

/**
 * 구성기 결과에서 집 문 앞 칸(걸어 설 수 있는 접근 칸)과 그 집 이름 — 구성기마다 모양이 다르다:
 * buildings[{name, kit, doors[], access[]}](북방·에도·사막·하늘섬·증기·선사) 또는 areas[{name, tag, door, access?}](해적·SF·황무지).
 */
function doorsOf(project: Project, map: GameMap, data: Record<string, unknown>): Door[] {
  const doors: Door[] = [];
  const add = (cell: Cell | undefined, kit: string) => { if (walkable(project, map, cell) && !doors.some((d) => d.x === cell.x && d.y === cell.y)) doors.push({ ...cell, kit }); };
  for (const b of (Array.isArray(data.buildings) ? data.buildings : []) as Record<string, unknown>[]) {
    const kit = `${String(b.kit ?? "")} ${String(b.name ?? "")}`.trim();
    const access = (Array.isArray(b.access) ? b.access : []).map(cellOf);
    const door = (Array.isArray(b.doors) ? b.doors : []).map(cellOf)[0];
    add(access[0] ?? (door ? { x: door.x, y: door.y + 1 } : undefined), kit);
  }
  for (const a of (Array.isArray(data.areas) ? data.areas : []) as Record<string, unknown>[]) {
    if (a.tag === "exit") continue;   // 방 자신의 나가는 문 — 들어오는 칸(exitCell)으로 쓴다
    const door = cellOf(a.door);
    add(cellOf(a.access) ?? (door ? { x: door.x, y: door.y + 1 } : undefined), `${String(a.tag ?? "")} ${String(a.name ?? "")}`.trim());
  }
  return doors;
}

/** 해적 실내처럼 나가는 문을 areas[{tag:"exit", door}] 로 돌려주는 구성기의 그 칸. */
function exitCell(project: Project, map: GameMap, data: Record<string, unknown>): Cell | undefined {
  for (const a of (Array.isArray(data.areas) ? data.areas : []) as Record<string, unknown>[]) {
    if (a.tag !== "exit") continue;
    const hit = [cellOf(a.door), cellOf(a.access)].find((c): c is Cell => walkable(project, map, c));
    if (hit) return hit;
  }
  return undefined;
}

function compose(run: BuildRun, world: WorldSetting, kind: WorldKind, name: string, seed0: number): { map?: GameMap; data: Record<string, unknown>; seed: number; error?: string } {
  const composer = world.composer!, c = kind.compose!;
  const tool = c.tool ?? composer.tool;
  let mapId: string | undefined;
  let error = "";
  for (let t = 0; t < SEED_TRIES; t++) {
    const seed = (seed0 + t * 97) % 9000 + 1;
    let res;
    if (composer.newMap && !mapId) res = run.call(tool, { [composer.param]: c.value, newMap: { name }, seed });
    else {
      if (!mapId) {
        const made = run.call("create_map", { name, width: c.size[0], height: c.size[1], tilesetId: world.tilesetId });
        mapId = (made.data as { mapId?: string } | undefined)?.mapId;
        if (!made.ok || !mapId) return { data: {}, seed, error: `create_map: ${String(made.summary ?? "").slice(0, 200)}` };
      }
      res = run.call(tool, { mapId, [composer.param]: c.value, seed, ...(t > 0 ? { replace: true } : {}) });
    }
    const data = (res.data ?? {}) as Record<string, unknown>;
    const builtId = (data.mapId as string | undefined) ?? mapId;
    const map = builtId ? run.ctx.project.maps[builtId] : undefined;
    if (res.ok && map) return { map, data, seed };
    error = String(res.summary ?? "").slice(0, 240);
  }
  // 짜지 못한 채 남은 빈 맵은 치운다(세는 맵도 아니고 길도 없는 맵이 프로젝트에 남는다).
  if (mapId && run.ctx.project.maps[mapId] && isUntouchedMap(run.ctx.project.maps[mapId]!)) run.call("remove_map", { mapId });
  return { data: {}, seed: seed0, error };
}

function build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const first = run.calls.length;
  const fail = (summary: string): PlaceBuildResult => ({ ok: false, mapIds: previous?.result.mapIds ?? [], summary, warnings: [], missingArt: [], calls: run.calls.slice(first) });
  const parsed = parseWorldStyle(spec.style);
  if (!parsed) return fail(`unknown world place style «${spec.style ?? ""}».`);
  const { world, kind } = parsed;
  if (previous) return fail(onePassRefusal(spec.name));
  if (!run.ctx.project.tilesets[world.tilesetId]) return fail(`this project has no ${world.tilesetId} chipset — the ${world.name} world cannot be built here.`);
  const made = compose(run, world, kind, spec.name, spec.salt ?? 1);
  if (!made.map) return fail(`${world.name} ${kind.id} «${spec.name}» could not be composed: ${made.error ?? ""}`);
  const mapId = made.map.id;
  if (made.map.name !== spec.name) run.call("set_map_properties", { mapId, name: spec.name });
  // 위험한 종류는 맵 성격을 적어 둔다 — 이름에 «도시»·«마을»이 들면(「폐허 도시」) 이름 추정이 마을로 보아 보이는 적을 거절했다.
  if (kind.danger) run.call("set_map_properties", { mapId, mapRole: kind.indoor ? "dungeon" : "field" });
  const project = run.ctx.project, map = project.maps[mapId]!;
  // 들어오는 칸: 실내는 아래 출입구 틈(구성기 exits, 없으면 맨 아래 걸음 칸), 바깥은 구성기 시작 칸.
  const exits = (Array.isArray(made.data.exits) ? made.data.exits : []).map(cellOf).filter((c): c is Cell => walkable(project, map, c));
  const start = [cellOf(made.data.start), cellOf(made.data.spawn)].find((c): c is Cell => walkable(project, map, c));
  const entry = (kind.indoor ? exits[0] ?? exitCell(project, map, made.data) ?? lowestWalk(project, map) : start ?? exits[0] ?? lowestWalk(project, map)) ?? { x: 0, y: 0 };
  const startMap = project.maps[project.startMapId];
  if (project.startMapId !== mapId && (!startMap || isUntouchedMap(startMap))) {
    const spot = start ?? entry;
    run.call("set_start_position", { mapId, x: spot.x, y: spot.y });
  }
  const doors = kind.indoor ? [] : doorsOf(run.ctx.project, run.ctx.project.maps[mapId]!, made.data);
  return {
    ok: true,
    mapIds: [mapId],
    entrance: { mapId, x: entry.x, y: entry.y },
    summary: `${spec.name}: ${world.name} ${kind.id} ${map.width}×${map.height} (${mapId}, seed ${made.seed})${doors.length ? `, ${doors.length} house doors` : ""}`,
    warnings: [],
    missingArt: [],
    calls: run.calls.slice(first),
    state: { tilesetId: world.tilesetId, world: world.id, kind: kind.id, seed: made.seed, doors, start: start ?? entry },
  };
}

export const WORLD_PLACE_BUILDER: PlaceBuilder = {
  id: "world",
  onePass: true,
  accepts: (spec) => !!parseWorldStyle(spec.style),
  build,
};
