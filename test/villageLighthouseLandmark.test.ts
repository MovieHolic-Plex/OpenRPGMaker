// 등대지기 도그푸딩(2026-09-24): 「침묵의 등대」가 중심인 항구 마을에 등대 외관이 없었다.
// author_village landmark:"lighthouse" 는 마을을 끊지 않는 빈 땅에 둥근 탑 등대를 세우고 입구 좌표를 돌려준다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { canMove, isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";

function reachable(project: Project, map: GameMap, sx: number, sy: number): Set<string> {
  const seen = new Set([`${sx},${sy}`]);
  const queue: [number, number][] = [[sx, sy]];
  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const key = `${x + dx},${y + dy}`;
      if (seen.has(key) || !canMove(project, map, x, y, x + dx, y + dy)) continue;
      seen.add(key);
      queue.push([x + dx, y + dy]);
    }
  }
  return seen;
}

type Placed = { x: number; y: number; entrance: { x: number; y: number } };

function build(groundTheme?: "snow") {
  const project = createBlankProject();
  const ctx = { project };
  const mapId = project.startMapId;
  const result = runTool(ctx, "author_village", {
    target: { kind: "existing", mapId, name: "눈꽃 항구 마을" },
    houseCount: 4, countPolicy: "best-effort", interior: false, seed: 3, forestDensity: "sparse",
    landmark: "lighthouse", ...(groundTheme ? { groundTheme } : {}),
  });
  return { ctx, mapId, result };
}

describe("author_village landmark:lighthouse", () => {
  it("stands a lit round tower on open ground and reports a reachable entrance", () => {
    const { ctx, mapId, result } = build();
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    expect(result.summary).toMatch(/Lighthouse at \(\d+,\d+\), entrance \(\d+,\d+\)/);
    const placed = (result.data as { landmark?: Placed }).landmark!;
    expect(placed).toBeDefined();
    const map = ctx.project.maps[mapId]!;
    const at = (x: number, y: number) => ({ lower: map.lowerTiles[y * map.width + x], upper: map.upperTiles[y * map.width + x] });
    // combo_round_tower 층 배치: 캡·베이스 upper, 목·몸·창 lower, 목 칸 upper 에 등불.
    expect([at(placed.x, placed.y).upper, at(placed.x + 1, placed.y).upper]).toEqual([24, 25]);
    expect([at(placed.x, placed.y + 1).lower, at(placed.x + 1, placed.y + 1).lower]).toEqual([138, 139]);
    expect([at(placed.x, placed.y + 1).upper, at(placed.x + 1, placed.y + 1).upper]).toEqual([624, 624]);
    expect([at(placed.x, placed.y + 3).lower, at(placed.x + 1, placed.y + 3).lower]).toEqual([142, 143]);
    expect([at(placed.x, placed.y + 4).upper, at(placed.x + 1, placed.y + 4).upper]).toEqual([54, 55]);
    for (let dy = 0; dy < 5; dy += 1) for (let dx = 0; dx < 2; dx += 1) expect(isPassable(ctx.project, map, placed.x + dx, placed.y + dy)).toBe(false);
    // 입구 앞칸은 통행 가능하고 마을 시작점에서 걸어서 닿는다.
    expect(placed.entrance).toEqual({ x: placed.x, y: placed.y + 5 });
    const start = ctx.project.startPos;
    expect(reachable(ctx.project, map, start.x, start.y).has(`${placed.entrance.x},${placed.entrance.y}`)).toBe(true);
    // 문 이벤트·집과 겹치지 않는다.
    for (const event of map.events) {
      const inside = event.x >= placed.x && event.x < placed.x + 2 && event.y >= placed.y && event.y < placed.y + 5;
      expect(inside, event.id).toBe(false);
    }
    // 입구 좌표로 등대 맵과 이을 수 있다.
    expect(runTool(ctx, "create_map", { id: "map_lighthouse_top", name: "등대 꼭대기", width: 20, height: 15 }).ok).toBe(true);
    const pair = runTool(ctx, "create_transfer_pair", { a: { mapId, ...placed.entrance }, b: { mapId: "map_lighthouse_top", x: 10, y: 13 } });
    expect(pair.ok, pair.summary).toBe(true);
  }, 120_000);

  it("keeps the tower on the snow sheet (same tile numbers)", () => {
    const { ctx, mapId, result } = build("snow");
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    const map = ctx.project.maps[mapId]!;
    expect(map.tilesetId).toBe("forest_harmony_snow");
    const placed = (result.data as { landmark?: Placed }).landmark!;
    expect(map.upperTiles[placed.y * map.width + placed.x]).toBe(24);
  }, 120_000);

  it("rejects an unknown landmark instead of ignoring it", () => {
    const project = createBlankProject();
    const result = runTool({ project }, "author_village", {
      target: { kind: "existing", mapId: project.startMapId }, houseCount: 2, countPolicy: "best-effort", landmark: "castle",
    });
    expect(result.ok).toBe(false);
  });
});
