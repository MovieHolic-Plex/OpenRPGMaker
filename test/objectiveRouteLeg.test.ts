// 목표 화살표는 걸어갈 길의 다음 곧은 구간 끝(성문·모퉁이)을 가리킨다 — 벽면·집 모서리·막는 이벤트를 향하지 않는다.
// 2026-11-11 fun-x1 눈가림 플레이: 「세 걸음 앞 칸」 화살표가 숙영지 성벽·궁전 정원 벽을 가리켰다(openwiki/assistant-v2.md 「목표 화살표는 길목을 가리킨다」).
import { describe, expect, it } from "vitest";
import { getTileset } from "@/project/collision";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { objectiveArrowAim, objectiveRoute, routeField, routeLeg } from "@/player/objectiveRoute";
import type { GameMap, Project } from "@/project/types";

/** 행 문자열로 만든 맵: '#' 벽, '.' 바닥. */
function world(rows: string[]): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const base = project.maps[project.startMapId]!;
  const tileset = getTileset(project, base)!;
  const floor = tileset.passability.findIndex((p) => p && p.up && p.down && p.left && p.right);
  const wall = tileset.passability.findIndex((p) => p && !p.up && !p.down && !p.left && !p.right);
  const map = createBlankMap("t", rows[0]!.length, rows.length, base.tilesetId);
  map.lowerTiles = rows.flatMap((row) => [...row].map((ch) => (ch === "#" ? wall : floor)));
  map.upperTiles = map.lowerTiles.map(() => -1);
  project.maps[map.id] = map;
  return { project, map };
}

const OFF_SCREEN = { x: 100, y: 100, right: 120, bottom: 115 };
const ON_SCREEN = { x: 0, y: 0, right: 20, bottom: 15 };
const degrees = (angle: number) => Math.round((angle * 180) / Math.PI);

describe("objective arrow follows the walkable leg", () => {
  // 벽 한 줄에 성문 하나(4,2). 대상은 벽 너머 (1,0).
  const walled = ["..........", "..........", "####.#####", "..........", ".........."];

  it("aims at the cell in front of the gate, not at the wall face above the hero", () => {
    const { project, map } = world(walled);
    const targets = [{ x: 1, y: 0 }];
    const route = objectiveRoute(project, map, targets, new Set());
    const aim = objectiveArrowAim(project, map, route, targets, { x: 8, y: 4 }, OFF_SCREEN)!;
    expect(aim.kind).toBe("route");
    expect(aim.cell).toEqual({ x: 4, y: 3 });
    expect(degrees(aim.angle)).toBe(-166); // 왼쪽(성문 쪽) — 위(벽면)가 아니다
  });

  it("points straight through the gate once the hero stands under it", () => {
    const { project, map } = world(walled);
    const targets = [{ x: 1, y: 0 }];
    const route = objectiveRoute(project, map, targets, new Set());
    const aim = objectiveArrowAim(project, map, route, targets, { x: 4, y: 3 }, OFF_SCREEN)!;
    expect(aim.cell).toEqual({ x: 4, y: 0 });
    expect(degrees(aim.angle)).toBe(-90);
  });

  it("every leg is a straight walk: each cell on the line is a step closer and never a wall", () => {
    const { project, map } = world(walled);
    const targets = [{ x: 1, y: 0 }];
    const field = routeField(project, map, targets);
    for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
      const d = field[y * map.width + x]!;
      if (d <= 0) continue;
      const leg = routeLeg(project, map, field, { x, y })!;
      expect(leg, `(${x},${y})`).toBeDefined();
      expect(field[leg.cell.y * map.width + leg.cell.x]).toBe(leg.left);
      // 구간 끝까지 맨해튼 거리만큼 가까워진다 = 돌아가지 않는 곧은 걸음.
      expect(d - leg.left).toBe(Math.abs(leg.cell.x - x) + Math.abs(leg.cell.y - y));
      // 화살표가 가리키는 축(크게 기운 쪽)으로 한 칸 걸으면 대상에 가까워진다.
      const dx = leg.cell.x - x, dy = leg.cell.y - y;
      const step = Math.abs(dx) >= Math.abs(dy) ? { x: x + Math.sign(dx), y } : { x, y: y + Math.sign(dy) };
      expect(field[step.y * map.width + step.x], `(${x},${y}) → (${leg.cell.x},${leg.cell.y})`).toBe(d - 1);
    }
  });

  it("shows the arrow for a visible target behind a wall and hides it when a straight walk reaches the target", () => {
    const { project, map } = world(walled);
    const targets = [{ x: 1, y: 0 }];
    const route = objectiveRoute(project, map, targets, new Set());
    // (1,4): 대상은 바로 위 4칸이지만 벽 너머다 — 예전 규칙(걸음 수 > 직선×1.5+4)은 화살표를 숨겼다.
    const behindWall = objectiveArrowAim(project, map, route, targets, { x: 1, y: 4 }, ON_SCREEN)!;
    expect(behindWall.cell).toEqual({ x: 4, y: 3 });
    expect(objectiveArrowAim(project, map, route, targets, { x: 4, y: 1 }, ON_SCREEN)).toBeUndefined();
    // 화면 밖이면 곧게 닿는 대상도 가리킨다.
    expect(objectiveArrowAim(project, map, route, targets, { x: 4, y: 1 }, OFF_SCREEN)!.cell).toEqual({ x: 1, y: 0 });
  });

  it("walks around a blocking event (a person or a locked door standing in the near gate)", () => {
    const { project, map } = world(["............", "............", "####.###.###", "............", "............"]);
    const targets = [{ x: 3, y: 0 }];
    const from = { x: 5, y: 4 };
    const open = objectiveRoute(project, map, targets, new Set());
    expect(objectiveArrowAim(project, map, open, targets, from, OFF_SCREEN)!.cell).toEqual({ x: 3, y: 0 }); // 가까운 성문 (4,2)을 곧게 지난다
    const nearGateBlocked = objectiveRoute(project, map, targets, new Set([2 * map.width + 4]));
    expect(nearGateBlocked.field[from.y * map.width + from.x]).toBeGreaterThan(open.field[from.y * map.width + from.x]!);
    expect(objectiveArrowAim(project, map, nearGateBlocked, targets, from, OFF_SCREEN)!.cell).toEqual({ x: 8, y: 3 }); // 먼 성문 앞
    // 두 성문이 다 막히면(말을 걸어야 비키는 사람) 타일 길로 그 사람 앞까지는 데려간다 — 직선으로 벽을 가리키지 않는다.
    const bothBlocked = objectiveRoute(project, map, targets, new Set([2 * map.width + 4, 2 * map.width + 8]));
    expect(bothBlocked.field[from.y * map.width + from.x]).toBe(-1);
    expect(objectiveArrowAim(project, map, bothBlocked, targets, from, OFF_SCREEN)!.kind).toBe("route");
  });

  it("measures the angle from the hero's cell centre (a target due east reads exactly east)", () => {
    const { project, map } = world(["....", "....", "...."]);
    const targets = [{ x: 3, y: 1 }];
    const route = objectiveRoute(project, map, targets, new Set());
    // 예전에는 발끝(칸 아래 끝)에서 재서 한 칸 옆 대상이 -27°(오른쪽 위)로 읽혔다.
    expect(objectiveArrowAim(project, map, route, targets, { x: 0, y: 1 }, OFF_SCREEN)!.angle).toBe(0);
    expect(objectiveArrowAim(project, map, route, targets, { x: 2, y: 1 }, OFF_SCREEN)!.angle).toBe(0);
    // 길을 못 찾으면 가장 가까운 대상으로 곧장.
    expect(objectiveArrowAim(project, map, null, targets, { x: 0, y: 1 }, OFF_SCREEN)).toMatchObject({ kind: "straight", angle: 0 });
  });

  it("does not aim through the pinch between two wall corners", () => {
    // (1,1)→(2,0) 대각선은 벽 모서리 (1,0)·(2,1) 사이 틈이다 — 그 틈으로는 못 걷는다.
    const { project, map } = world([".#...", "..#..", "....."]);
    const targets = [{ x: 4, y: 0 }];
    const route = objectiveRoute(project, map, targets, new Set());
    const aim = objectiveArrowAim(project, map, route, targets, { x: 1, y: 1 }, OFF_SCREEN)!;
    expect(aim.cell).not.toEqual({ x: 2, y: 0 });
    expect(route.field[aim.cell.y * map.width + aim.cell.x]).toBeLessThan(route.field[1 * map.width + 1]!);
  });
});
