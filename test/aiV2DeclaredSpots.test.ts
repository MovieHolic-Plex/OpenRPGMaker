// 문·계단·굴 입구는 칩셋이 적어 둔 것으로 읽는다 — 이름표의 「…문」「계단」「굴 입구」 글자가 아니다.
// 2026-11-11 단계×테마 표: 문 이름 이벤트가 걸어서 지나는 성문·목책 문 10곳에 앉았고(에도 성문·무가 대문·산문, 사막 성문, 설원 목책 문),
// 위·아래층 잇기 자리는 「계단탑 옥상」 지붕 칸이었고, 구성기 칩셋의 굴 입구(얼음 동굴·선사 동굴·피라미드 입구) 앞에는 「…입구」 단계가 한 번도 앉지 않았다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { roomSpecOf } from "@/editor/handInterior/builder";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { tilesetSurface } from "@/project/tilesetSurface";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { reachableCells, unreachableEvents } from "@/ai/v2/judge/eventReach";
import { buildingEntrances, declaredDoorCells, declaredStairCells } from "@/ai/v2/place/entrances";
import { builderFor } from "@/ai/v2/place/builders";
import { objectAt } from "@/ai/v2/place/cells";
import { repairEventReach } from "@/ai/v2/place/reachRepairs";
import { WORLDS, worldPlaceSpec } from "@/ai/v2/place/world";
import { seatEntranceSteps } from "@/ai/v2/story/stepArt";
import type { BuildRun } from "@/ai/v2/shared/types";

type Ctx = { project: Project };
const runOf = (ctx: Ctx): BuildRun => ({ ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) }) as unknown as BuildRun;
const at = (cells: readonly { x: number; y: number }[], c: { x: number; y: number }) => cells.some((d) => d.x === c.x && d.y === c.y);
const event = (id: string, name: string, x: number, y: number, page: Record<string, unknown>): GameEvent => ({
  id, name, x, y, trigger: page.trigger ?? { kind: "action" }, commands: [],
  pages: [{ id: `${id}_p0`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, ...page }],
}) as unknown as GameEvent;

function desert(kind: string, id: string, name: string): Ctx {
  const ctx = { project: createBlankProject() };
  expect(runTool(ctx, "create_map", { id, name, width: 48, height: 40, tilesetId: "desert_east" }).ok).toBe(true);
  expect(runTool(ctx, "compose_desert_east_map", { mapId: id, kind, seed: 1 }).ok).toBe(true);
  const map = ctx.project.maps[id]!;
  let start = { x: 0, y: 0 };
  for (let x = 0; x < map.width; x++) if (isPassable(ctx.project, map, x, map.height - 1)) { start = { x, y: map.height - 1 }; break; }
  ctx.project = { ...ctx.project, startMapId: id, startPos: start } as Project;
  return ctx;
}
/** 이름표가 「…문」으로 끝나는 그림 칸 — 궁전 맵에서는 걸어서 지나는 성문 기둥뿐이다. */
function gatePostCells(project: Project, map: GameMap): { x: number; y: number }[] {
  const meta = (project.tilesets[map.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if (["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"].some((k) => { const t = m[k]?.[y * map.width + x]; return typeof t === "number" && t >= 0 && /문$/u.test(String(meta[t]?.label ?? "").replace(/\s*\([^)]*\)/gu, "").trim()); })) out.push({ x, y });
  }
  return out;
}

describe("stairs are what the chipset declares", () => {
  const blank = createBlankProject() as Project;
  const labels = (id: string) => [...tilesetSurface(blank.tilesets[id]).stairs].map((t) => String((blank.tilesets[id]!.tileMeta as unknown as ({ label?: string } | undefined)[])[t]?.label ?? ""));

  it("reads the baker's role and tags, not the word in a label", () => {
    // 「지구라트(계단 신전)」 은 건물이다. 사막의 계단 칸은 내려가는 돌계단 입구 2×2 하나뿐이다(2026-11-13 첫 판 늘리기 — 꼬리표 «계단»).
    expect(labels("desert_east")).toHaveLength(4);
    expect(labels("desert_east").every((l) => l.includes("돌계단 입구") && !l.includes("지구라트"))).toBe(true);
    expect(labels("modern_city").some((l) => l.includes("비상계단 아파트"))).toBe(false);
    // 실내 계단 둘(오르는·내려가는 2×2) + 거리의 지하 입구 해치 2×2(2026-11-13 이야기 기물 — 역할 terrain·꼬리표 «계단»).
    expect(labels("steampunk_city")).toHaveLength(12);
    expect(labels("steampunk_city").every((l) => l.includes("계단"))).toBe(true);
    // 제 꼬리표를 쓰는 번들은 표면 계약에 적는다.
    expect(tilesetSurface(blank.tilesets.joseon_baram).stairs.size).toBeGreaterThan(20);
    expect(tilesetSurface(blank.tilesets.atlas_biome_interior).stairs.size).toBeGreaterThan(0);
  });

  it("finds room-kit doors and stairs laid on a map by the kit's own object kinds", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_r", name: "방", width: 14, height: 12, tilesetId: "jp_city" }).ok).toBe(true);
    const spec = roomSpecOf(ctx.project.tilesets.jp_city)!;
    const map = structuredClone(ctx.project.maps.map_r!);
    const put = (objectId: string, x: number, y: number) => { for (const [dx, dy, tile] of spec.objects[objectId]!.cells) (map.upperTiles as number[])[(y + dy!) * map.width + x + dx!] = tile!; };
    expect(spec.objects["door-open-western"]!.kind).toBe("door");
    expect(spec.objects["stairs-up-wood"]!.stairs).toBe("up");
    put("door-open-western", 5, 2);
    put("stairs-up-wood", 9, 4);
    // 세로로 이어진 그림은 맨 아래 칸(사람이 서서 여는·오르는 쪽) 하나.
    expect(declaredDoorCells(ctx.project, map)).toEqual([{ x: 5, y: 4 }]);
    expect(declaredStairCells(ctx.project, map)).toEqual([{ x: 9, y: 4 }]);
  });
});

describe("a door-named event sits on a declared door", () => {
  it("goes to a building entrance, never to a walk-through gate", () => {
    const ctx = desert("palace", "map_p", "사막 궁전");
    const map0 = ctx.project.maps.map_p!;
    const posts = gatePostCells(ctx.project, map0);
    const doors = declaredDoorCells(ctx.project, map0);
    expect(posts.length).toBeGreaterThan(0);
    expect(doors).toHaveLength(buildingEntrances(ctx.project, map0).length);
    expect(posts.some((g) => at(doors, g))).toBe(false);
    // 걸어 닿지 못하는 칸(둘레가 모두 막힌 벽 속)에 문 이름 이벤트.
    const reach = reachableCells(ctx.project, map0)!;
    let pit: { x: number; y: number } | undefined;
    for (let y = 2; y < map0.height - 2 && !pit; y++) for (let x = 2; x < map0.width - 2 && !pit; x++) {
      if (!isPassable(ctx.project, map0, x, y) && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !reach[(y + dy!) * map0.width + x + dx!])) pit = { x, y };
    }
    expect(pit).toBeDefined();
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_p: { ...map0, events: [...map0.events, event("ev_door", "굳게 닫힌 문", pit!.x, pit!.y, { commands: [{ kind: "text", body: "…" }, { kind: "setSwitch", switchId: "sw_l", value: true }] })] } } } as Project;
    const fixed = repairEventReach(runOf(ctx), "map_p", ["ev_door"]);
    const map = ctx.project.maps.map_p!;
    const now = map.events.find((e) => e.id === "ev_door")!;
    expect(fixed.moved.join(" ")).toContain("문 그림 칸");
    expect(at(posts, now)).toBe(false);
    expect(at(declaredDoorCells(ctx.project, map), now)).toBe(true);
    expect(unreachableEvents(ctx.project, "map_p")).not.toContain("ev_door");
  }, 60_000);
});

describe("an «…입구» step sits in front of the entrance that leads into the dungeon", () => {
  function pyramid(withTransfer: boolean) {
    const ctx = desert("pyramid", "map_y", "피라미드");
    expect(runTool(ctx, "create_map", { id: "map_dg", name: "묘실", width: 20, height: 15, tilesetId: "desert_east" }).ok).toBe(true);
    expect(runTool(ctx, "set_map_properties", { mapId: "map_dg", mapRole: "dungeon" }).ok).toBe(true);
    const map0 = ctx.project.maps.map_y!;
    const mouth = buildingEntrances(ctx.project, map0).find((e) => e.kit.includes("피라미드"))!;
    expect(mouth).toBeDefined();
    const reach = reachableCells(ctx.project, map0)!;
    // 단계: 문 앞에서 5~9걸음 떨어진, 그림이 덮이지 않은 걸어 닿는 칸.
    let spot: { x: number; y: number } | undefined;
    for (let r = 5; r <= 9 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (const dx of [r - Math.abs(dy), Math.abs(dy) - r]) {
      const x = mouth.front.x + dx, y = mouth.front.y + dy;
      if (x > 1 && y > 1 && x < map0.width - 2 && y < map0.height - 2 && reach[y * map0.width + x] && (map0.upperTiles[y * map0.width + x] ?? -1) < 0 && !map0.events.some((e) => e.x === x && e.y === y)) { spot = { x, y }; break; }
    }
    expect(spot).toBeDefined();
    const events = [...map0.events, event("ev_step", "피라미드 입구", spot!.x, spot!.y, { commands: [{ kind: "text", body: "안에서 바람이 분다." }, { kind: "setSwitch", switchId: "sw_e", value: true }] })];
    if (withTransfer) events.push(event("ev_in", "", mouth.x, mouth.y, { trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, commands: [{ kind: "transfer", mapId: "map_dg", x: 2, y: 2, direction: "down" }] }));
    ctx.project = {
      ...ctx.project, maps: { ...ctx.project.maps, map_y: { ...map0, events } },
      gameBlueprint: { title: "시험", genre: "모험", request: "모험 게임 하나 만들어 줘.", playerGoal: "끝까지 간다.", steps: [{ id: "s1", place: map0.name, event: "피라미드 입구", action: "입구를 살핀다", needs: [], gives: ["바람"] }], ending: { title: "끝", trigger: "바람" } },
    } as unknown as Project;
    const notes = seatEntranceSteps(runOf(ctx), "map_y");
    return { mouth, spot: spot!, notes, step: ctx.project.maps.map_y!.events.find((e) => e.id === "ev_step")!, project: ctx.project };
  }

  it("moves the step to the mouth's front row and keeps the way in open", () => {
    const { mouth, step, project } = pyramid(true);
    expect(step.y).toBe(mouth.front.y);
    expect(Math.abs(step.x - mouth.front.x)).toBeLessThanOrEqual(1);
    expect(unreachableEvents(project, "map_y")).not.toContain("ev_in");
  }, 60_000);

  it("leaves the step alone when no entrance on the map leads into a dungeon", () => {
    const { spot, step, notes } = pyramid(false);
    expect({ x: step.x, y: step.y }).toEqual(spot);
    expect(notes).toEqual([]);
  }, 60_000);
});

describe("an event moved to reachable ground is not parked under a picture", () => {
  it("skips walkable cells covered by a roof edge or canopy", () => {
    // 폐허 정착지: 벽 속 이벤트를 옮긴 자리가 「고철 판잣집」 지붕 밑 칸이었다 — 걸을 수는 있지만 그림에 가려 안 보인다.
    const world = WORLDS.find((w) => w.id === "wasteland")!, kind = world.kinds.find((k) => k.id === "settlement")!;
    const spec = { ...worldPlaceSpec(world, kind, kind.ko), salt: 7 };
    const ctx: Ctx = { project: createBlankProject() };
    const run = runOf(ctx);
    const built = builderFor(spec)!.build(run, spec);
    expect(built.ok, built.summary).toBe(true);
    const mapId = built.entrance?.mapId ?? built.mapIds[0]!;
    const map0 = ctx.project.maps[mapId]!;
    if (ctx.project.startMapId !== mapId && built.entrance) ctx.project = { ...ctx.project, startMapId: mapId, startPos: { x: built.entrance.x, y: built.entrance.y } } as Project;
    const reach = reachableCells(ctx.project, map0)!;
    let pit: { x: number; y: number } | undefined;
    for (let y = 2; y < map0.height - 2 && !pit; y++) for (let x = 2; x < map0.width - 2 && !pit; x++) {
      if (!isPassable(ctx.project, map0, x, y) && !map0.events.some((e) => e.x === x && e.y === y) && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !reach[(y + dy!) * map0.width + x + dx!])) pit = { x, y };
    }
    expect(pit).toBeDefined();
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, [mapId]: { ...map0, events: [...map0.events, event("ev_lost", "잠든 장치", pit!.x, pit!.y, { commands: [{ kind: "text", body: "…" }, { kind: "setSwitch", switchId: "sw_l", value: true }] })] } } } as Project;
    repairEventReach(run, mapId, ["ev_lost"]);
    const map = ctx.project.maps[mapId]!;
    const now = map.events.find((e) => e.id === "ev_lost")!;
    expect(unreachableEvents(ctx.project, mapId)).not.toContain("ev_lost");
    expect(objectAt(map, now)).toBe(false);
  }, 60_000);
});
