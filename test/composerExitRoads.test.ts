// 구성기 공용 출구 길 찾기(composerExitRoads) — 길 그물에서 맵 가장자리까지의 띠.
import { describe, expect, it } from "vitest";
import { exitRoadCells, exitRoadThroughWild, roadReachesEdge, type ExitRoadBoard } from "@/project/composerExitRoads";

/** '#' 길 · '.' 빈 땅 · 그 밖은 막힌 칸. */
const board = (rows: readonly string[]): ExitRoadBoard => ({
  W: rows[0]!.length, H: rows.length,
  isRoad: (x, y) => rows[y]?.[x] === "#",
  canPave: (x, y) => rows[y]?.[x] === ".",
});
// 남쪽 끝으로만 나가는 두 칸 폭 길(12×10).
const SOUTH_ROAD = ["............", "............", "............", "............", "....##......", "....##......", "....##......", "....##......", "....##......", "....##......"];
const withColumn = (rows: readonly string[], x: number, cell: (y: number) => string): string[] => rows.map((row, y) => row.slice(0, x) + cell(y) + row.slice(x + 1));

describe("composerExitRoads", () => {
  it("이미 길이 닿은 변에는 아무것도 내지 않는다", () => {
    expect(roadReachesEdge(board(SOUTH_ROAD), "south")).toBe(true);
    expect(roadReachesEdge(board(SOUTH_ROAD), "east")).toBe(false);
    expect(exitRoadCells(board(SOUTH_ROAD), "south")).toEqual([]);
  });

  it("길 그물에서 그 변의 가장자리까지 두 칸 폭의 곧은 띠를 낸다", () => {
    const cells = exitRoadCells(board(SOUTH_ROAD), "east")!;
    expect(cells.length).toBeGreaterThanOrEqual(12);
    expect(new Set(cells.map((c) => c.y)).size).toBe(2);
    expect(Math.max(...cells.map((c) => c.x))).toBe(11);
    // 남쪽 가장자리를 따라 붙어 가지 않는다(여백).
    expect(Math.max(...cells.map((c) => c.y))).toBeLessThanOrEqual(6);
    const paved = SOUTH_ROAD.map((row, y) => [...row].map((ch, x) => (cells.some((c) => c.x === x && c.y === y) ? "#" : ch)).join(""));
    expect(roadReachesEdge(board(paved), "east")).toBe(true);
  });

  it("막힌 줄은 돌아가고, 돌아갈 틈이 없으면 내지 않는다", () => {
    const wall = withColumn(SOUTH_ROAD, 8, () => "X");
    expect(exitRoadCells(board(wall), "east")).toBeUndefined();
    const gap = withColumn(SOUTH_ROAD, 8, (y) => (y <= 1 ? "." : "X"));
    const detour = exitRoadCells(board(gap), "east")!;
    expect(detour.some((c) => c.y === 0)).toBe(true);
    expect(detour.every((c) => gap[c.y]![c.x] === ".")).toBe(true);
  });

  it("흩어 둔 소품은 지나가며 걷을 번호를 돌려준다", () => {
    const rows = withColumn(SOUTH_ROAD, 8, (y) => (y === 4 || y === 5 ? "T" : "X"));
    expect(exitRoadCells(board(rows), "east")).toBeUndefined();
    const road = exitRoadThroughWild(board(rows), "east", [{ x: 8, y: 4, w: 1, h: 2 }, { x: 1, y: 1, w: 1, h: 1 }])!;
    expect(road.drop).toEqual([0]);
    expect(road.cells.filter((c) => c.x === 8).map((c) => c.y).sort()).toEqual([4, 5]);
  });
});
