import { describe, expect, it } from "vitest";

import { getTool } from "@/editor/tools";
import { walkerRoute, WALKER_ID_PREFIX } from "@/editor/tools/streetWalkersTool";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, MoveCommand } from "@/project/types";

function fixture() {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId]! as GameMap;
  return { project, map, mapId };
}

/** 경로를 따라 걸어 본다 — 통과를 켜지 않고 막힌 칸에 들어서면 그 칸을 돌려준다. */
function walk(project: ReturnType<typeof createBlankProject>, map: GameMap, x: number, y: number, moves: readonly MoveCommand[]) {
  const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;
  let through = false;
  const stuck: string[] = [];
  for (const m of moves) {
    if (m.kind === "setThrough") through = m.enabled;
    if (m.kind !== "move") continue;
    x += D[m.dir][0]; y += D[m.dir][1];
    if (!through && !isPassable(project, map, x, y)) stuck.push(`${x},${y}`);
  }
  return { x, y, stuck };
}

describe("add_street_walkers 행인 경로", () => {
  it("vanish 칸(막힌 문·계단 그림 칸)은 마지막 걸음 전에 통과를 켜고 들어가 사라졌다 돌아 나온다", () => {
    const { project, map } = fixture();
    map.lowerTiles[3 * map.width + 6] = TILE.WATER; // 막힌 «문» 칸
    expect(isPassable(project, map, 6, 3)).toBe(false);
    const moves = walkerRoute(project, map, [{ x: 2, y: 4 }, { x: 6, y: 3, vanish: true, waitSec: 1 }], 560)!;
    expect(moves).not.toBeNull();
    const end = walk(project, map, 2, 4, moves);
    expect(end.stuck).toEqual([]);
    expect({ x: end.x, y: end.y }).toEqual({ x: 2, y: 4 }); // 반복 경로 — 처음 자리로 돌아온다
    const fade = moves.findIndex((m) => m.kind === "changeOpacity" && m.delta < 0);
    const back = moves.findIndex((m) => m.kind === "changeOpacity" && m.delta > 0);
    expect(fade).toBeGreaterThan(0);
    expect(back).toBeGreaterThan(fade);
    // 사라지기 바로 앞 걸음은 통과를 켠 뒤다.
    const lastThroughOn = moves.slice(0, fade).map((m) => m.kind === "setThrough" && m.enabled).lastIndexOf(true);
    expect(lastThroughOn).toBeGreaterThanOrEqual(0);
  });

  it("도구는 행인 이벤트를 반복 custom 경로로 놓고, 같은 이름만 replace 로 바꾼다", () => {
    const { project, mapId, map } = fixture();
    const tool = getTool("add_street_walkers")!;
    const args = { mapId, walkers: [{ name: "출근하는 회사원", graphic: { selectionId: "charset:tex_oprn_charset_modern3:0" }, stops: [{ x: 2, y: 2 }, { x: 8, y: 2, waitSec: 2 }], speed: 4 }] };
    tool.run(project, args);
    tool.run(project, { ...args, replace: true });
    const walkers = map.events.filter((e) => e.id.startsWith(WALKER_ID_PREFIX));
    expect(walkers).toHaveLength(1);
    const mv = walkers[0]!.pages![0]!.movement!;
    expect(mv.type).toBe("custom");
    expect(mv.speed).toBe(4);
    expect((mv as { route: { repeat: boolean } }).route.repeat).toBe(true);
  });

  it("걸을 수 없는 칸을 vanish 없이 주면 거부한다", () => {
    const { project, mapId, map } = fixture();
    map.lowerTiles[2 * map.width + 8] = TILE.WATER;
    expect(() => getTool("add_street_walkers")!.run(project, { mapId, walkers: [{ name: "a", graphic: { selectionId: "charset:tex_oprn_charset_modern3:0" }, stops: [{ x: 2, y: 2 }, { x: 8, y: 2 }] }] })).toThrow();
  });
});
