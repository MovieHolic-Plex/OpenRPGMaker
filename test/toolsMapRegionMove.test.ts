// test/toolsMapRegionMove.test.ts
// move_region 계약: 잘라내기+붙여넣기. 세 가지가 이 툴의 존재 이유이고 각각 아래 케이스가 잠근다.
// (1) 겹치는 같은-맵 이동에서 목적지에 쓴 칸은 비우지 않는다. (2) 원본 비우기는 layers 범위를
// 지킨다. (3) 원본 비우기도 통행 보장 칸(시작 위치·transfer 목적지)의 기록자다.
import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import type { JsonSchema, ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";

const SRC = "map_move_src";
const DST = "map_move_dst";

function context(size = 12): ToolContext {
  const context: ToolContext = { project: createBlankProject() };
  for (const [id, name] of [[SRC, "원본"], [DST, "대상"]] as const) {
    const created = runTool(context, "create_map", { name, width: size, height: size, id });
    expect(created.ok, created.summary).toBe(true);
  }
  return context;
}

/** 영역 각 칸에 고유 타일 id 를 심는다 — 이동 결과를 칸 단위로 식별하기 위한 픽스처. */
function paintUnique(context: ToolContext, mapId: string, rect: { x: number; y: number; w: number; h: number }): void {
  const map = context.project.maps[mapId];
  for (let dy = 0; dy < rect.h; dy += 1) {
    for (let dx = 0; dx < rect.w; dx += 1) {
      const index = (rect.y + dy) * map.width + rect.x + dx;
      const serial = dy * rect.w + dx;
      map.lowerTiles[index] = 200 + serial;
      map.upperTiles[index] = 100 + serial;
    }
  }
}

function lowerAt(context: ToolContext, mapId: string, x: number, y: number): number {
  const map = context.project.maps[mapId];
  return map.lowerTiles[y * map.width + x];
}

function upperAt(context: ToolContext, mapId: string, x: number, y: number): number {
  const map = context.project.maps[mapId];
  return map.upperTiles[y * map.width + x];
}

describe("move_region", () => {
  it("스키마가 strict 제공자 규약(oneOf 없음, array는 items, object는 properties)을 지킨다", () => {
    const tool = getTool("move_region");
    expect(tool, "move_region 툴이 등록되어 있어야 한다").toBeDefined();
    if (!tool) return;
    expect(tool.mode).toBe("write");
    const visit = (node: JsonSchema, path: string): void => {
      expect(node.oneOf, `${path}: oneOf 금지`).toBeUndefined();
      if (node.type === "array") expect(node.items, `${path}: array는 items 필요`).toBeDefined();
      if (node.type === "object") expect(node.properties, `${path}: object는 properties 필요`).toBeDefined();
      for (const [key, child] of Object.entries(node.properties ?? {})) visit(child, `${path}.${key}`);
      if (node.items) visit(node.items, `${path}[]`);
    };
    visit(tool.parameters, "parameters");
  });

  it("정확한 이름으로 find_tools 하면 스키마가 돌아온다", () => {
    const ctx = context();
    const found = runTool(ctx, "find_tools", { query: "move_region" });
    expect(found.ok, found.summary).toBe(true);
    expect(JSON.stringify(found.data)).toContain("move_region");
  });

  it("다른 맵으로 옮기면 목적지에 찍히고 원본은 잔디로 비워진다", () => {
    const ctx = context();
    paintUnique(ctx, SRC, { x: 2, y: 3, w: 3, h: 2 });
    const result = runTool(ctx, "move_region", {
      from: { mapId: SRC, x: 2, y: 3, w: 3, h: 2 },
      to: { mapId: DST, x: 6, y: 7 },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(lowerAt(ctx, DST, 6, 7)).toBe(200);
    expect(upperAt(ctx, DST, 8, 8)).toBe(105);
    // 원본은 비워진다 — 기본 fill 은 clear_region 과 같은 잔디다.
    expect(lowerAt(ctx, SRC, 2, 3)).toBe(TILE.GRASS);
    expect(upperAt(ctx, SRC, 2, 3)).toBe(TILE.EMPTY);
    expect(lowerAt(ctx, SRC, 4, 4)).toBe(TILE.GRASS);
  });

  it("fill:empty 는 원본 하위 레이어를 빈 칸으로 비운다", () => {
    const ctx = context();
    paintUnique(ctx, SRC, { x: 1, y: 1, w: 2, h: 2 });
    const result = runTool(ctx, "move_region", {
      from: { mapId: SRC, x: 1, y: 1, w: 2, h: 2 },
      to: { mapId: DST, x: 5, y: 5 },
      fill: "empty",
    });
    expect(result.ok, result.summary).toBe(true);
    expect(lowerAt(ctx, SRC, 1, 1)).toBe(TILE.EMPTY);
    expect(result.summary).toContain("빈 칸");
  });

  it("같은 맵에서 겹치게 옮겨도 목적지에 쓴 칸은 비우지 않는다", () => {
    const ctx = context();
    // 3×1 을 오른쪽으로 한 칸 — 목적지 두 칸이 원본과 겹친다.
    paintUnique(ctx, SRC, { x: 2, y: 5, w: 3, h: 1 });
    const result = runTool(ctx, "move_region", {
      from: { mapId: SRC, x: 2, y: 5, w: 3, h: 1 },
      to: { mapId: SRC, x: 3, y: 5 },
    });
    expect(result.ok, result.summary).toBe(true);
    // 옮긴 내용이 그대로 살아 있어야 한다(원본 rect 를 통째로 지우면 여기가 잔디가 된다).
    expect(lowerAt(ctx, SRC, 3, 5)).toBe(200);
    expect(lowerAt(ctx, SRC, 4, 5)).toBe(201);
    expect(lowerAt(ctx, SRC, 5, 5)).toBe(202);
    // 겹치지 않은 원본 첫 칸만 비워진다.
    expect(lowerAt(ctx, SRC, 2, 5)).toBe(TILE.GRASS);
  });

  it("layers:upper 는 상위만 옮기고 원본 바닥을 보존한다", () => {
    const ctx = context();
    paintUnique(ctx, SRC, { x: 4, y: 4, w: 2, h: 1 });
    const result = runTool(ctx, "move_region", {
      from: { mapId: SRC, x: 4, y: 4, w: 2, h: 1 },
      to: { mapId: SRC, x: 8, y: 4 },
      layers: "upper",
    });
    expect(result.ok, result.summary).toBe(true);
    expect(upperAt(ctx, SRC, 8, 4)).toBe(100);
    expect(upperAt(ctx, SRC, 4, 4)).toBe(TILE.EMPTY);
    // 계단만 옮겼으므로 원래 자리 바닥에 구멍이 나지 않는다.
    expect(lowerAt(ctx, SRC, 4, 4)).toBe(200);
    // 목적지 바닥도 건드리지 않는다.
    expect(lowerAt(ctx, SRC, 8, 4)).not.toBe(200);
  });

  it("맵 밖 from/to 는 region-out-of-bounds 로 거절한다", () => {
    const ctx = context();
    const badFrom = runTool(ctx, "move_region", {
      from: { mapId: SRC, x: 10, y: 10, w: 5, h: 5 },
      to: { mapId: SRC, x: 0, y: 0 },
    });
    expect(badFrom.ok).toBe(false);
    expect(badFrom.summary).toContain("12×12");
    const badTo = runTool(ctx, "move_region", {
      from: { mapId: SRC, x: 0, y: 0, w: 3, h: 3 },
      to: { mapId: SRC, x: 11, y: 11 },
    });
    expect(badTo.ok).toBe(false);
    expect(badTo.summary).toContain("12×12");
  });

  it("제자리 이동은 invalid-args 로 거절한다", () => {
    const ctx = context();
    const result = runTool(ctx, "move_region", {
      from: { mapId: SRC, x: 2, y: 2, w: 2, h: 2 },
      to: { mapId: SRC, x: 2, y: 2 },
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("오프셋");
  });

  it("다른 맵으로 이벤트를 옮기라는 요청은 거절한다", () => {
    const ctx = context();
    const result = runTool(ctx, "move_region", {
      from: { mapId: SRC, x: 2, y: 2, w: 2, h: 2 },
      to: { mapId: DST, x: 5, y: 5 },
      withEvents: true,
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("같은 맵");
  });

  it("withEvents 는 id 를 보존하며 이벤트를 옮긴다", () => {
    const ctx = context();
    const created = runTool(ctx, "place_npc", { mapId: SRC, x: 3, y: 3, name: "주민", pages: [{ lines: ["안녕"] }], id: "ev_move_me" });
    expect(created.ok, created.summary).toBe(true);
    const result = runTool(ctx, "move_region", {
      from: { mapId: SRC, x: 3, y: 3, w: 1, h: 1 },
      to: { mapId: SRC, x: 7, y: 3 },
      withEvents: true,
    });
    expect(result.ok, result.summary).toBe(true);
    const events = ctx.project.maps[SRC].events;
    expect(events.filter((event) => event.id === "ev_move_me")).toHaveLength(1);
    const moved = events.find((event) => event.id === "ev_move_me");
    expect({ x: moved?.x, y: moved?.y }).toEqual({ x: 7, y: 3 });
  });

  it("withEvents 없이 옮기면 남은 이벤트를 경고로 알린다", () => {
    const ctx = context();
    const created = runTool(ctx, "place_npc", { mapId: SRC, x: 3, y: 3, name: "주민", pages: [{ lines: ["안녕"] }], id: "ev_stays" });
    expect(created.ok, created.summary).toBe(true);
    const result = runTool(ctx, "move_region", {
      from: { mapId: SRC, x: 3, y: 3, w: 1, h: 1 },
      to: { mapId: SRC, x: 7, y: 3 },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[SRC].events.find((event) => event.id === "ev_stays")).toMatchObject({ x: 3, y: 3 });
    expect(result.diff?.warnings.join("\n")).toContain("ev_stays");
  });

  it("원본 쪽 시작 위치는 통행 불가로 비워지지 않고 경고로 보고된다", () => {
    const ctx = context();
    expect(runTool(ctx, "set_start_position", { mapId: SRC, x: 2, y: 2 }).ok).toBe(true);
    paintUnique(ctx, SRC, { x: 2, y: 2, w: 2, h: 1 });
    const result = runTool(ctx, "move_region", {
      from: { mapId: SRC, x: 2, y: 2, w: 2, h: 1 },
      to: { mapId: DST, x: 6, y: 6 },
      fill: "empty",
    });
    expect(result.ok, result.summary).toBe(true);
    // 빈 칸(-1)은 통행 불가라 시작 위치 칸은 원래 타일로 되돌아온다.
    expect(lowerAt(ctx, SRC, 2, 2)).toBe(200);
    expect(result.diff?.warnings.join("\n")).toContain("시작 위치");
    // 보호되지 않은 이웃 칸은 정상적으로 비워진다.
    expect(lowerAt(ctx, SRC, 3, 2)).toBe(TILE.EMPTY);
  });
});
