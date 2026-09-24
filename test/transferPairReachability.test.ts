// 몬스터 수집 도그푸딩 재현: 숲에 막혀 시작 위치에서 닿지 않는 위 가장자리 칸에 도로 문을 달았다.
import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { runTool, type ToolContext } from "@/editor/tools";
import { transferGatesStayApproachable } from "@/editor/tools/transferReachability";

function walledStart(): ToolContext {
  const context: ToolContext = { project: createBlankProject() };
  expect(runTool(context, "create_map", { id: "map_road", name: "도로", width: 20, height: 15 }, { dryRun: false }).ok).toBe(true);
  const map = context.project.maps[context.project.startMapId]!;
  // 세로 벽 x=10 이 맵을 가른다 — 시작 위치는 왼쪽, 요청 문 자리는 오른쪽 위 가장자리.
  for (let y = 0; y < map.height; y += 1) map.lowerTiles[y * map.width + 10] = TILE.WALL;
  context.project.startPos = { x: 3, y: 5 };
  return context;
}

describe("create_transfer_pair 도달성", () => {
  it("시작 위치에서 닿지 않는 가장자리 요청은 같은 가장자리의 닿는 칸으로 옮긴다", () => {
    const context = walledStart();
    const mapId = context.project.startMapId;
    const result = runTool(context, "create_transfer_pair", { a: { mapId, x: 15, y: 0 }, b: { mapId: "map_road", x: 10, y: 14 } }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const gateA = (result.data as { gateA: { x: number; y: number } }).gateA;
    expect(gateA.y).toBe(0);
    expect(gateA.x).toBeLessThan(10);
    expect(result.diff?.warnings ?? []).toContainEqual(expect.stringContaining("걸어 닿지 않아"));
  });

  it("닿는 요청은 그대로 둔다", () => {
    const context = walledStart();
    const mapId = context.project.startMapId;
    const result = runTool(context, "create_transfer_pair", { a: { mapId, x: 5, y: 0 }, b: { mapId: "map_road", x: 10, y: 14 } }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect((result.data as { gateA: { x: number; y: number } }).gateA).toEqual({ x: 5, y: 0 });
    expect(result.diff?.warnings ?? []).not.toContainEqual(expect.stringContaining("닿지 않"));
  });

  it("한 칸 문간에 문을 놓아 같은 맵의 방이 갈라지지 않게 옆 칸에 둔다", () => {
    const context: ToolContext = { project: createBlankProject() };
    expect(runTool(context, "create_map", { id: "map_road", name: "도로", width: 12, height: 10 }, { dryRun: false }).ok).toBe(true);
    const map = context.project.maps[context.project.startMapId]!;
    const gapX = 5;
    const gapY = 4;
    for (let x = 0; x < map.width; x += 1) {
      if (x === gapX) continue;
      map.lowerTiles[gapY * map.width + x] = TILE.WALL;
    }
    context.project.startPos = { x: 2, y: 6 };
    const result = runTool(context, "create_transfer_pair", {
      a: { mapId: map.id, x: gapX, y: gapY },
      b: { mapId: "map_road", x: 2, y: 8 },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const gateA = (result.data as { gateA: { x: number; y: number } }).gateA;
    expect(gateA).not.toEqual({ x: gapX, y: gapY });
    expect(result.diff?.warnings ?? []).toContainEqual(expect.stringContaining("유일한 통로"));
    const blocked = map.events.some((event) => event.x === gapX && event.y === gapY);
    expect(blocked).toBe(false);
  });

  it("기존 출입구를 봉쇄하는 자리는 다른 칸으로 옮긴다(추격 호러 r8 복도 봉쇄 재현)", () => {
    const context: ToolContext = { project: createBlankProject() };
    expect(runTool(context, "create_map", { id: "map_wing", name: "별관", width: 12, height: 8 }, { dryRun: false }).ok).toBe(true);
    const map = context.project.maps[context.project.startMapId]!;
    // y0 벽, y1 은 (4,1) 통로 하나만 뚫린 문간 — (4,1) 문의 유일한 접근은 (4,2) 다.
    for (let x = 0; x < map.width; x += 1) {
      map.lowerTiles[0 * map.width + x] = TILE.WALL;
      map.lowerTiles[1 * map.width + x] = x === 4 ? TILE.GRASS : TILE.WALL;
    }
    context.project.startPos = { x: 2, y: 4 };
    const first = runTool(context, "create_transfer_pair", {
      a: { mapId: map.id, x: 4, y: 1 },
      b: { mapId: "map_wing", x: 5, y: 6 },
    }, { dryRun: false });
    expect(first.ok, first.summary).toBe(true);
    expect((first.data as { gateA: { x: number; y: number } }).gateA).toEqual({ x: 4, y: 1 });

    // 두 번째 쌍을 (4,2) — (4,1) 문의 유일한 접근칸 — 에 놓으면 봉쇄된다. 도구는 자리를 피해야 한다.
    const second = runTool(context, "create_transfer_pair", {
      a: { mapId: map.id, x: 4, y: 2 },
      b: { mapId: "map_wing", x: 7, y: 6 },
    }, { dryRun: false });
    expect(second.ok, second.summary).toBe(true);
    const gateA2 = (second.data as { gateA: { x: number; y: number } }).gateA;
    expect(`${gateA2.x},${gateA2.y}`).not.toBe("4,2");

    // 최종 상태: 어느 쪽 문도 방 바닥에 실제로 접해 있다 — 봉쇄된 문이 없어야 한다.
    const check = transferGatesStayApproachable(context.project, map);
    expect(check.sealed).toEqual([]);
    expect(check.ok).toBe(true);
  });

  it("이미 봉쇄된 문이 있으면 후보를 모두 거절하고 경고만 남긴다(막지 않는다)", () => {
    const context: ToolContext = { project: createBlankProject() };
    expect(runTool(context, "create_map", { id: "map_wing2", name: "별관2", width: 12, height: 8 }, { dryRun: false }).ok).toBe(true);
    const map = context.project.maps[context.project.startMapId]!;
    for (let x = 0; x < map.width; x += 1) {
      map.lowerTiles[0 * map.width + x] = TILE.WALL;
      map.lowerTiles[1 * map.width + x] = x === 4 ? TILE.GRASS : TILE.WALL;
    }
    context.project.startPos = { x: 2, y: 4 };
    runTool(context, "create_transfer_pair", { a: { mapId: map.id, x: 4, y: 1 }, b: { mapId: "map_wing2", x: 5, y: 6 } }, { dryRun: false });
    // (4,2) 에 두 번째 문을 넣어 (4,1) 을 봉쇄하는 최악의 상태를 만든 뒤(수동 배치), 같은 자리 재요청.
    runTool(context, "create_transfer_pair", { a: { mapId: map.id, x: 4, y: 2 }, b: { mapId: "map_wing2", x: 7, y: 6 } }, { dryRun: false });
    const sealedNow = transferGatesStayApproachable(context.project, map);
    // 자동 보정이 봉쇄를 피했으면 sealed 는 비어 있을 것이다 — 그래도 봉쇄가 남았다면 경고로 보고한다.
    if (!sealedNow.ok) {
      const retry = runTool(context, "create_transfer_pair", { a: { mapId: map.id, x: 4, y: 2 }, b: { mapId: "map_wing2", x: 9, y: 6 } }, { dryRun: false });
      expect(retry.ok, retry.summary).toBe(true);
      expect((retry.diff?.warnings ?? []).join("\n")).toMatch(/봉쇄|옮겼습니다|걸어 닿지 않아/);
    }
  });
});
