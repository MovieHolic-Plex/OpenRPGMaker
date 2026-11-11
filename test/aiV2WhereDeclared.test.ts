// 자리 낱말은 칸의 구조와 칩셋이 적어 둔 것으로 푼다 — 이름표의 「벽」「계단」「의자」「창」 글자가 아니다.
// 2026-11-11 자리 낱말×테마 표: 「벽돌 포장」 위의 분수·노점이 벽이어서 「한쪽」이 광장 한가운데였고(스팀펑크·서울 골목), 「바닥 · 벽 밑 그늘」 위의 사물함이 벽이어서
// 「구석」이 가구 사이였다. 「나무 옆」은 「회칠 벽(나무 격자 창)」, 「문 옆」은 걸어서 지나는 성문, 「책 옆」은 설원 목책이었고, 창 없는 무덤의 벽 앞이 「창가」로 보고됐다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { roomSpecOf } from "@/editor/handInterior/builder";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { builderFor } from "@/ai/v2/place/builders";
import { groundBlocks, objectAt } from "@/ai/v2/place/cells";
import { declaredDoorCells, placeMarks } from "@/ai/v2/place/entrances";
import { personSpotContext, personSpotCost } from "@/ai/v2/place/personSpot";
import { clearTargetFronts } from "@/ai/v2/place/reachRepairs";
import { roadCells } from "@/ai/v2/place/surface";
import { resolveWhere } from "@/ai/v2/place/where";
import { WORLDS, worldPlaceSpec } from "@/ai/v2/place/world";
import type { BuildRun } from "@/ai/v2/shared/types";

type Ctx = { project: Project };
type Meta = { label?: string } | undefined;
const SLOW = 60_000;

/** 그 칩셋에서 이름표가 맞는 첫 타일(pass 를 주면 걸을 수 있는지도 맞는 것). */
function tileOf(project: Project, tilesetId: string, label: RegExp, pass?: boolean): number {
  const tileset = project.tilesets[tilesetId]!;
  const tile = (tileset.tileMeta as unknown as Meta[]).findIndex((m, t) => !!m?.label && label.test(m.label) && (pass === undefined || Object.values(tileset.passability[t] ?? {}).some(Boolean) === pass));
  expect(tile, `${tilesetId} ${label}`).toBeGreaterThanOrEqual(0);
  return tile;
}
/** 빈 맵 한 장에 윗층 타일을 놓는다 — [x, y, 타일]. */
function mapWith(tilesetId: string, upper: readonly (readonly [number, number, number])[], make: (project: Project) => readonly (readonly [number, number, number])[] = () => upper): { project: Project; map: GameMap } {
  const ctx: Ctx = { project: createBlankProject() };
  expect(runTool(ctx, "create_map", { id: "map_t", name: "시험", width: 12, height: 8, tilesetId }).ok).toBe(true);
  const map = structuredClone(ctx.project.maps.map_t!);
  for (const [x, y, tile] of make(ctx.project)) (map.upperTiles as number[])[y * map.width + x] = tile;
  return { project: { ...ctx.project, maps: { ...ctx.project.maps, map_t: map } } as Project, map };
}
/** 세계 표의 장소 한 곳을 실제 빌더로 짓고, 들어오는 칸을 시작으로 둔다. */
function place(worldId: string, kindId: string): { project: Project; map: GameMap } {
  const world = WORLDS.find((w) => w.id === worldId)!;
  const kind = world.kinds.find((k) => k.id === kindId)!;
  const ctx: Ctx = { project: createBlankProject() };
  const run = { ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) } as unknown as BuildRun;
  const spec = { ...worldPlaceSpec(world, kind, kind.ko), salt: 7 };
  const built = builderFor(spec)!.build(run, spec);
  expect(built.ok, built.summary).toBe(true);
  const mapId = built.entrance?.mapId ?? built.mapIds[0]!;
  const map = ctx.project.maps[mapId]!;
  let start = built.entrance && isPassable(ctx.project, map, built.entrance.x, built.entrance.y) ? { x: built.entrance.x, y: built.entrance.y } : undefined;
  for (let y = map.height - 1; y >= 0 && !start; y--) for (let x = 0; x < map.width && !start; x++) if (isPassable(ctx.project, map, x, y)) start = { x, y };
  const project = { ...ctx.project, startMapId: mapId, startPos: start } as Project;
  return { project, map: project.maps[mapId]! };
}
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe("stairs, seats and windows are read from what the chipset wrote down", () => {
  it("a trapezoid roof is not a ladder, a tram shelter is not a bench", () => {
    const { project, map } = mapWith("steampunk_city", [], (p) => [
      [2, 2, tileOf(p, "steampunk_city", /^전차 정류장 지붕/u)], [4, 2, tileOf(p, "steampunk_city", /^둥근 걸상/u)], [6, 2, tileOf(p, "steampunk_city", /^오르는 나무 계단/u)],
    ]);
    const marks = placeMarks(project, map);
    expect(marks.seats[2 * map.width + 2]).toBe(0); // 「전차 정류장 지붕(무쇠 기둥 + 녹청 철판 지붕 + 벤치)」
    expect(marks.seats[2 * map.width + 4]).toBe(1);
    expect(marks.stairs[2 * map.width + 6]).toBe(1);
    const sf = mapWith("sf_station", [], (p) => [[2, 2, tileOf(p, "sf_station", /^에어록 모듈\(사다리꼴/u)]]);
    expect(placeMarks(sf.project, sf.map).stairs[2 * sf.map.width + 2]).toBe(0);
  });

  it("a window is a hung window — not a spear rack tagged 「창」, not a service counter, and the stained glass counts", () => {
    const edo = mapWith("sengoku_edo", [], (p) => [[2, 2, tileOf(p, "sengoku_edo", /^목검·창 걸이/u)], [4, 2, tileOf(p, "sengoku_edo", /^장지 창/u)]]);
    const edoMarks = placeMarks(edo.project, edo.map);
    expect(edoMarks.windows[2 * edo.map.width + 2]).toBe(0);
    expect(edoMarks.windows[2 * edo.map.width + 4]).toBe(1);
    const home = mapWith("atlas_biome_interior", [], (p) => {
      const spec = roomSpecOf(p.tilesets.atlas_biome_interior)!;
      // 「커튼 창」 · 「큰 색유리창(2칸)」(이름표는 한 낱말 — 키트의 이름 tall stained window 로 읽는다) · 「길드 접수 창구」
      return [[2, 2, spec.objects["curtained window"]!.cells[0]![2]!], [4, 2, spec.objects["tall stained window"]!.cells[0]![2]!], [6, 2, spec.objects["guild counter"]!.cells[0]![2]!]];
    });
    const marks = placeMarks(home.project, home.map);
    expect([marks.windows[2 * home.map.width + 2], marks.windows[2 * home.map.width + 4], marks.windows[2 * home.map.width + 6]]).toEqual([1, 1, 0]);
  });
});

describe("a wall is blocked ground or a building — furniture standing on walkable floor is not", () => {
  /** 벽면 테두리 안에 「… 바닥 · 벽 밑 그늘」 바닥 — 이름표에 「벽」 이 든 바닥 위에 사물함을 놓는다. */
  function room(lockers: readonly (readonly [number, number])[]): { project: Project; map: GameMap } {
    const ctx: Ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_r", name: "방", width: 10, height: 10, tilesetId: "modern_campus" }).ok).toBe(true);
    const floor = tileOf(ctx.project, "modern_campus", /바닥 · 벽 밑 그늘$/u, true), wall = tileOf(ctx.project, "modern_campus", /벽면 아랫줄$/u, false), locker = tileOf(ctx.project, "modern_campus", /사물함/u, false);
    const map = structuredClone(ctx.project.maps.map_r!);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      (map.lowerTiles as number[])[y * 10 + x] = x === 0 || y === 0 || x === 9 || y === 9 ? wall : floor;
      (map.upperTiles as number[])[y * 10 + x] = -1;
    }
    for (const [x, y] of lockers) (map.upperTiles as number[])[y * 10 + x] = locker;
    const project = { ...ctx.project, maps: { ...ctx.project.maps, map_r: map }, startMapId: "map_r", startPos: { x: 2, y: 7 } } as Project;
    return { project, map: project.maps.map_r! };
  }

  it("the corner is the room's corner, not the nook of an L of lockers", () => {
    const { project, map } = room([[4, 4], [5, 4], [4, 5]]);
    expect(groundBlocks(project, map, { x: 4, y: 4 })).toBe(false);
    expect(groundBlocks(project, map, { x: 0, y: 3 })).toBe(true);
    // 전에는 (5,5) — 서쪽·북쪽이 사물함이라 「구석」 이었다.
    const corner = resolveWhere(project, map, "구석").cell;
    expect([1, 8]).toContain(corner.x);
    expect([1, 8]).toContain(corner.y);
    for (const word of ["한쪽", "북쪽 벽", "서쪽 벽"]) {
      const c = resolveWhere(project, map, word).cell;
      expect(c.x === 1 || c.x === 8 || c.y === 1 || c.y === 8, `${word} (${c.x},${c.y})`).toBe(true);
    }
  });

  it("a person on the only cell in front of a locker blocks it — the shaded floor under it does not make it a wall picture", () => {
    const { project, map } = room([[3, 1], [4, 1], [5, 1]]);
    expect(personSpotCost(project, map, { x: 4, y: 2 }, personSpotContext(project, map))).toBeGreaterThanOrEqual(6);
  });

  it("on a brick-paved street 「한쪽」 stands by a building, not by a market stall in the square", () => {
    const { project, map } = place("steampunk_city", "street");
    const marks = placeMarks(project, map);
    for (const word of ["한쪽", "구석", "서쪽 벽"]) {
      const found = resolveWhere(project, map, word);
      if (found.fallback) continue;
      const c = found.cell;
      const walls = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => ({ x: c.x + dx!, y: c.y + dy! }))
        .filter((n) => n.x >= 0 && n.y >= 0 && n.x < map.width && n.y < map.height && !isPassable(project, map, n.x, n.y))
        .filter((n) => !objectAt(map, n) || groundBlocks(project, map, n) || !!marks.buildings[n.y * map.width + n.x]);
      expect(walls.length, `${word} (${c.x},${c.y}) ${found.how}`).toBeGreaterThan(0);
      // 드나드는 문 앞과 맵 가장자리 칸에는 서지 않는다.
      expect(declaredDoorCells(project, map).some((d) => d.x === c.x && (c.y === d.y + 1 || c.y === d.y + 2)), `${word} doorway`).toBe(false);
      expect(c.x === 0 || c.y === 0 || c.x === map.width - 1 || c.y === map.height - 1, `${word} edge`).toBe(false);
    }
    expect(resolveWhere(project, map, "한쪽").fallback).toBeUndefined();
  }, SLOW);
});

describe("「X 옆」 finds the thing by its name as a whole word, or by what the chipset declares", () => {
  it("「나무 옆」 is not the lattice window made of wood, 「책 옆」 is not the palisade", () => {
    const tea = place("desert_east", "teahouse");
    const tree = resolveWhere(tea.project, tea.map, "나무 옆");
    expect(tree.fallback).toBe(true);
    expect(tree.how).not.toContain("회칠 벽");
    const snow = place("snow_north", "village");
    expect(resolveWhere(snow.project, snow.map, "책 옆").how ?? "").not.toContain("목책");
  }, SLOW);

  it("「문 옆」 is beside a building's door, off the cells people walk through; 「길 옆」 is the roadside", () => {
    const { project, map } = place("desert_east", "bazaar");
    const doors = declaredDoorCells(project, map);
    expect(doors.length).toBeGreaterThan(0);
    const door = resolveWhere(project, map, "문 옆");
    expect(door.fallback).toBeUndefined();
    expect(door.how).not.toContain("문루"); // 전에는 「둥근 지붕 회당(큰 돔·아치 문루)」
    // 바자르의 문은 길로 바로 열린다 — 벽 밑 길 칸(문 앞의 옆)에 서고, 집 사이 틈(문에서 세 칸)으로 밀려나지 않는다.
    expect(Math.min(...doors.map((d) => cheb(d, door.cell)))).toBeLessThanOrEqual(1);
    expect(doors.some((d) => d.x === door.cell.x && door.cell.y === d.y + 1)).toBe(false);

    const roads = roadCells(project, map);
    for (const word of ["길 옆", "동굴 입구로 가는 길 옆"]) {
      const c = resolveWhere(project, map, word);
      expect(c.fallback, word).toBeUndefined();
      expect(roads.has(c.cell.y * map.width + c.cell.x), `${word} on the road`).toBe(false);
      expect([[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => roads.has((c.cell.y + dy!) * map.width + c.cell.x + dx!)), `${word} beside a road`).toBe(true);
    }
  }, SLOW);
});

describe("「창가」 is by a window, and says so when the map has none", () => {
  it("stands next to the teahouse's lattice window — the cell right under it holds a divan", () => {
    const { project, map } = place("desert_east", "teahouse");
    const marks = placeMarks(project, map);
    const found = resolveWhere(project, map, "창가");
    expect(found.fallback).toBeUndefined();
    expect(found.how).toContain("창가");
    let near = false;
    for (let dy = 0; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) if (marks.windows[(found.cell.y - dy) * map.width + found.cell.x + dx]) near = true;
    expect(near).toBe(true);
  }, SLOW);

  it("in a tomb with no window it goes to a wall and reports that — not 「창가」", () => {
    const { project, map } = place("desert_east", "tomb");
    const found = resolveWhere(project, map, "창가");
    expect(found.fallback).toBe(true);
    expect(found.how).not.toContain("창가");
    expect(found.note).toContain("No window");
  }, SLOW);
});

describe("clearing the cell in front of a person removes a seat, never a shelter that has a bench in its description", () => {
  const npc = (x: number, y: number): GameEvent => ({
    id: "ev_npc", name: "단서를 아는 사람", x, y, trigger: { kind: "action" }, commands: [],
    pages: [{ id: "ev_npc_p0", name: "", conditions: [], graphic: { sprite: { id: "tex_x", frame: 0 } }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "…" }] }],
  }) as unknown as GameEvent;
  function blocked(label: RegExp): { run: BuildRun; before: number } {
    const { project, map } = mapWith("steampunk_city", [], (p) => [[4, 4, tileOf(p, "steampunk_city", label, false)]]);
    const ground = tileOf(project, "steampunk_city", /^판석 보도/u, true);
    const laid = structuredClone(map);
    for (let i = 0; i < laid.width * laid.height; i++) (laid.lowerTiles as number[])[i] = ground;
    laid.events = [npc(4, 3)];
    const ctx: Ctx = { project: { ...project, maps: { ...project.maps, map_t: laid }, startMapId: "map_t", startPos: { x: 1, y: 6 } } as Project };
    return { run: { ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) } as unknown as BuildRun, before: laid.upperTiles[4 * laid.width + 4]! };
  }

  it("moves the stool away", () => {
    const { run } = blocked(/^둥근 걸상/u);
    expect(clearTargetFronts(run, "map_t").length).toBeGreaterThan(0);
    expect(isPassable(run.ctx.project, run.ctx.project.maps.map_t!, 4, 4)).toBe(true);
  });

  it("leaves the tram shelter", () => {
    const { run, before } = blocked(/^전차 정류장 지붕/u);
    expect(clearTargetFronts(run, "map_t")).toEqual([]);
    expect(run.ctx.project.maps.map_t!.upperTiles[4 * 12 + 4]).toBe(before);
  });
});
