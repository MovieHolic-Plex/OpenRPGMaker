// 옆보기 필드(GameMap.sideView): 중력·점프·사다리·낙하 피해 — player/sideViewPhysics.ts.
import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { normalizeTerrainRecords } from "@/project/databaseUtilityRecordModel";
import {
  applySideViewLanding,
  planSideViewTick,
  resolveSideViewSettings,
  sideViewFallDamage,
  sideViewGridFor,
  type SideViewGrid,
  type SideViewPlan,
  type SideViewState,
} from "@/player/sideViewPhysics";

/** '#' 벽, 'H' 사다리, '.' 빈칸. */
function gridOf(rows: string[]): SideViewGrid {
  const at = (x: number, y: number): string => rows[y]?.[x] ?? "#";
  return { solid: (x, y) => at(x, y) === "#", climbable: (x, y) => at(x, y) === "H" };
}

const SETTINGS = resolveSideViewSettings({});

/** 입력을 주며 걸음을 즉시 적용해 틱을 돌린다(씬은 걸음 한 칸이 끝날 때마다 다음 틱을 부른다). */
function run(grid: SideViewGrid, start: { x: number; y: number }, inputs: { x: number; y: number }[]) {
  const state: SideViewState = { fallTiles: 0, jumpRemaining: 0 };
  const pos = { ...start };
  const plans: SideViewPlan[] = [];
  for (const input of inputs) {
    const plan = planSideViewTick(grid, pos.x, pos.y, state, input, SETTINGS);
    plans.push(plan);
    pos.x += plan.dx;
    pos.y += plan.dy;
  }
  return { pos, plans, state };
}

const IDLE = { x: 0, y: 0 };

describe("옆보기 중력", () => {
  it("발밑이 비면 입력 없이도 바닥까지 한 칸씩 떨어진다", () => {
    const grid = gridOf([
      "#####",
      "#...#",
      "#...#",
      "#...#",
      "#####",
    ]);
    const { pos, plans } = run(grid, { x: 2, y: 1 }, [IDLE, IDLE, IDLE, IDLE]);
    expect(plans.map((p) => p.kind)).toEqual(["fall", "fall", "none", "none"]);
    expect(pos).toEqual({ x: 2, y: 3 });
    expect(plans[2].landedFallTiles).toBe(2);
  });

  it("바닥에 서 있으면 떨어지지 않고 좌우로 걷는다", () => {
    const grid = gridOf(["#####", "#...#", "#####"]);
    const { pos, plans } = run(grid, { x: 1, y: 1 }, [{ x: 1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }]);
    expect(plans.map((p) => p.kind)).toEqual(["walk", "walk", "none"]);
    expect(pos).toEqual({ x: 3, y: 1 });
  });

  it("아래 방향키로는 땅을 파고 내려가지 않는다(탑다운 이동이 아니다)", () => {
    const grid = gridOf(["#####", "#...#", "#####"]);
    const { pos } = run(grid, { x: 2, y: 1 }, [{ x: 0, y: 1 }]);
    expect(pos).toEqual({ x: 2, y: 1 });
  });
});

describe("옆보기 점프", () => {
  it("위 키는 점프 높이만큼 오른 뒤 다시 떨어져 착지한다", () => {
    const grid = gridOf([
      "#####",
      "#...#",
      "#...#",
      "#...#",
      "#####",
    ]);
    const up = { x: 0, y: -1 };
    const { plans, pos } = run(grid, { x: 2, y: 3 }, [up, IDLE, IDLE, IDLE, IDLE]);
    expect(plans.map((p) => p.kind)).toEqual(["jump", "jump", "fall", "fall", "none"]);
    expect(pos).toEqual({ x: 2, y: 3 });
  });

  it("점프하며 옆으로 가면 턱 위에 올라선다", () => {
    const grid = gridOf([
      "######",
      "#....#",
      "#....#",
      "#..###",
      "######",
    ]);
    // (2,3) 에서 오른쪽 턱(x 3..4) 위로: 위+오른쪽으로 뛰고 계속 오른쪽을 누르면 턱 위 (4,2) 에 선다.
    const { pos, plans } = run(grid, { x: 2, y: 3 }, [{ x: 1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, IDLE]);
    expect(plans.map((p) => p.kind)).toEqual(["jump", "jump", "fall", "none"]);
    expect(pos).toEqual({ x: 4, y: 2 });
  });

  it("천장에 머리가 닿으면 상승을 멈춘다", () => {
    const grid = gridOf(["#####", "#...#", "#####"]);
    const { plans } = run(grid, { x: 2, y: 1 }, [{ x: 0, y: -1 }]);
    expect(plans[0].kind).toBe("none");
  });

  it("점프 높이 0 인 맵은 뛰지 않는다", () => {
    const grid = gridOf(["#####", "#...#", "#...#", "#####"]);
    const settings = resolveSideViewSettings({ sideViewJumpTiles: 0 });
    const state: SideViewState = { fallTiles: 0, jumpRemaining: 0 };
    expect(planSideViewTick(grid, 2, 2, state, { x: 0, y: -1 }, settings).kind).toBe("none");
  });
});

describe("옆보기 사다리", () => {
  it("사다리 칸에서는 떨어지지 않고 위아래로 오른다", () => {
    const grid = gridOf([
      "#####",
      "#.H.#",
      "#.H.#",
      "#.H.#",
      "#####",
    ]);
    const up = { x: 0, y: -1 };
    const climbed = run(grid, { x: 2, y: 3 }, [up, up, IDLE, IDLE]);
    expect(climbed.plans.map((p) => p.kind)).toEqual(["climb", "climb", "none", "none"]);
    expect(climbed.pos).toEqual({ x: 2, y: 1 });
    const down = run(grid, { x: 2, y: 1 }, [{ x: 0, y: 1 }]);
    expect(down.plans[0].kind).toBe("climb");
    expect(down.pos).toEqual({ x: 2, y: 2 });
  });

  it("사다리 꼭대기 위 칸에 서 있으면 사다리를 발판으로 딛는다", () => {
    const grid = gridOf(["#####", "#...#", "#.H.#", "#####"]);
    const { plans } = run(grid, { x: 2, y: 1 }, [IDLE]);
    expect(plans[0].kind).toBe("none");
  });
});

describe("옆보기 낙하 피해", () => {
  it("기준 칸 수를 넘은 만큼만 칸당 피해", () => {
    expect(sideViewFallDamage(4, SETTINGS)).toBe(0);
    expect(sideViewFallDamage(6, SETTINGS)).toBe(20);
    expect(sideViewFallDamage(3, resolveSideViewSettings({ sideViewFallTiles: 1, sideViewFallDamage: 5 }))).toBe(10);
  });

  it("긴 낙하 끝 착지가 파티 HP 를 깎는다", () => {
    const rows = ["#####", ...Array.from({ length: 8 }, () => "#...#"), "#####"];
    const { plans } = run(gridOf(rows), { x: 2, y: 1 }, Array.from({ length: 9 }, () => IDLE));
    const landing = plans.find((p) => p.landedFallTiles !== undefined);
    expect(landing?.landedFallTiles).toBe(7);

    const project = createBlankProject();
    const actorId = project.database.actors[0].id;
    const session = { partyActorIds: [actorId], actorVitals: {} as Record<string, { hp: number; mp: number }> };
    const result = applySideViewLanding(project, session as never, 7, SETTINGS);
    expect(result.damage).toBe(30);
    const vitals = session.actorVitals[actorId];
    expect(vitals).toBeDefined();
    expect(result.defeated).toBe(vitals.hp <= 0);
  });
});

describe("옆보기 프로젝트 격자", () => {
  it("타일 통행과 지형 climbable 을 읽고, climbable 은 불러오기 정규화에서 살아남는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const tileset = project.tilesets[map.tilesetId];
    map.lowerTiles.fill(TILE.GRASS);
    map.lowerTiles[0] = TILE.WATER;
    tileset.tileMeta ??= {};
    tileset.tileMeta[TILE.PATH] = { ...(tileset.tileMeta[TILE.PATH] ?? {}), terrainTag: 1 };
    map.lowerTiles[map.width + 1] = TILE.PATH;
    const terrains = normalizeTerrainRecords([{ id: "ladder", name: "사다리", climbable: true }]);
    expect(terrains[0].climbable).toBe(true);
    expect(normalizeTerrainRecords([{ id: "ground", name: "땅" }])[0]).not.toHaveProperty("climbable");
    project.database.terrains = terrains;
    const grid = sideViewGridFor(project, map);
    expect(grid.solid(0, 0)).toBe(true);
    expect(grid.solid(-1, 0)).toBe(true);
    expect(grid.solid(2, 2)).toBe(false);
    expect(grid.climbable(1, 1)).toBe(true);
    expect(grid.climbable(2, 2)).toBe(false);
  });
});
