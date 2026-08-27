// test/toolsMapRegionCopy.test.ts
// copy_map_region 계약(2026-08-27 all-access 감사 CONFIRMED GAP): 맵 편집기의 영역 복사/붙여넣기
// (selectTileRegion/copySelection/pasteClipboard)를 툴로 도달 가능하게 한 뒤 고정하는 계약.
// 핵심은 겹치는 같은-맵 복사 — 소스를 버퍼에 먼저 담지 않고 읽으면서 쓰면 타일이 오염된다.

import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import type { JsonSchema, ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";

const SRC = "map_copy_src";
const DST = "map_copy_dst";

function context(size = 12): ToolContext {
  const context: ToolContext = { project: createBlankProject() };
  for (const [id, name] of [[SRC, "원본"], [DST, "대상"]] as const) {
    const created = runTool(context, "create_map", { name, width: size, height: size, id });
    expect(created.ok, created.summary).toBe(true);
  }
  return context;
}

/** 영역 각 칸에 고유 타일 id를 심는다 — 복사 결과를 칸 단위로 식별하기 위한 픽스처. */
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

describe("copy_map_region", () => {
  it("스키마가 strict 제공자 규약(oneOf 없음, array는 items, object는 properties)을 지킨다", () => {
    const tool = getTool("copy_map_region");
    expect(tool, "copy_map_region 툴이 등록되어 있어야 한다").toBeDefined();
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

  it("다른 맵으로 복사하면 목적지에 소스 타일이 그대로 찍힌다", () => {
    const ctx = context();
    paintUnique(ctx, SRC, { x: 2, y: 3, w: 3, h: 2 });
    const result = runTool(ctx, "copy_map_region", {
      from: { mapId: SRC, x: 2, y: 3, w: 3, h: 2 },
      to: { mapId: DST, x: 6, y: 7 },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ copied: 6 });
    for (let dy = 0; dy < 2; dy += 1) {
      for (let dx = 0; dx < 3; dx += 1) {
        const serial = dy * 3 + dx;
        expect(lowerAt(ctx, DST, 6 + dx, 7 + dy), `lower ${dx},${dy}`).toBe(200 + serial);
        expect(upperAt(ctx, DST, 6 + dx, 7 + dy), `upper ${dx},${dy}`).toBe(100 + serial);
      }
    }
    // 원본은 그대로 남는다(복사이지 이동이 아니다).
    expect(lowerAt(ctx, SRC, 2, 3)).toBe(200);
  });

  it("같은 맵에서 겹치는 영역으로 복사해도 오염되지 않는다", () => {
    const ctx = context();
    paintUnique(ctx, SRC, { x: 2, y: 2, w: 4, h: 4 });
    const before = { lower: [...ctx.project.maps[SRC].lowerTiles], upper: [...ctx.project.maps[SRC].upperTiles] };
    const width = ctx.project.maps[SRC].width;
    const result = runTool(ctx, "copy_map_region", {
      from: { mapId: SRC, x: 2, y: 2, w: 4, h: 4 },
      to: { mapId: SRC, x: 4, y: 3 },
    });
    expect(result.ok, result.summary).toBe(true);
    for (let dy = 0; dy < 4; dy += 1) {
      for (let dx = 0; dx < 4; dx += 1) {
        const sourceIndex = (2 + dy) * width + 2 + dx;
        expect(lowerAt(ctx, SRC, 4 + dx, 3 + dy), `lower ${dx},${dy}`).toBe(before.lower[sourceIndex]);
        expect(upperAt(ctx, SRC, 4 + dx, 3 + dy), `upper ${dx},${dy}`).toBe(before.upper[sourceIndex]);
      }
    }
  });

  it("layers=lower는 하위만, layers=upper는 상위만 쓴다", () => {
    const ctx = context();
    paintUnique(ctx, SRC, { x: 1, y: 1, w: 2, h: 1 });
    const dst = ctx.project.maps[DST];
    dst.lowerTiles[5 * dst.width + 5] = TILE.SAND;
    dst.upperTiles[5 * dst.width + 5] = TILE.FLOWERS;

    const lowerOnly = runTool(ctx, "copy_map_region", {
      from: { mapId: SRC, x: 1, y: 1, w: 2, h: 1 },
      to: { mapId: DST, x: 5, y: 5 },
      layers: "lower",
    });
    expect(lowerOnly.ok, lowerOnly.summary).toBe(true);
    expect(lowerAt(ctx, DST, 5, 5)).toBe(200);
    expect(upperAt(ctx, DST, 5, 5), "layers=lower는 상위를 건드리지 않는다").toBe(TILE.FLOWERS);

    const upperOnly = runTool(ctx, "copy_map_region", {
      from: { mapId: SRC, x: 1, y: 1, w: 2, h: 1 },
      to: { mapId: DST, x: 5, y: 8 },
      layers: "upper",
    });
    expect(upperOnly.ok, upperOnly.summary).toBe(true);
    expect(upperAt(ctx, DST, 5, 8)).toBe(100);
    expect(lowerAt(ctx, DST, 5, 8), "layers=upper는 하위를 건드리지 않는다").toBe(TILE.GRASS);
  });

  it("이벤트는 withEvents일 때만 새 id·평행이동 좌표로 함께 복사된다", () => {
    const ctx = context();
    expect(runTool(ctx, "place_npc", { mapId: SRC, x: 3, y: 3, name: "주민", pages: [{ lines: ["안녕"] }], id: "ev_copy_seed" }).ok).toBe(true);

    const without = runTool(ctx, "copy_map_region", {
      from: { mapId: SRC, x: 2, y: 2, w: 4, h: 4 },
      to: { mapId: DST, x: 6, y: 6 },
    });
    expect(without.ok, without.summary).toBe(true);
    expect(ctx.project.maps[DST].events.length, "기본은 이벤트를 옮기지 않는다").toBe(0);

    const withEvents = runTool(ctx, "copy_map_region", {
      from: { mapId: SRC, x: 2, y: 2, w: 4, h: 4 },
      to: { mapId: DST, x: 6, y: 6 },
      withEvents: true,
    });
    expect(withEvents.ok, withEvents.summary).toBe(true);
    const copied = ctx.project.maps[DST].events;
    expect(copied.length).toBe(1);
    expect(copied[0].id, "새 id를 받아야 한다").not.toBe("ev_copy_seed");
    // (3,3) 은 소스 rect 기준 (+1,+1) → 목적지 원점 (6,6) + (1,1)
    expect({ x: copied[0].x, y: copied[0].y }).toEqual({ x: 7, y: 7 });
    expect(ctx.project.maps[SRC].events.length, "원본 이벤트는 남는다").toBe(1);
  });

  it("맵 밖 영역은 맵 크기를 알려주며 거부한다", () => {
    const ctx = context();
    const result = runTool(ctx, "copy_map_region", {
      from: { mapId: SRC, x: 10, y: 10, w: 5, h: 5 },
      to: { mapId: DST, x: 0, y: 0 },
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("12×12");
  });

  it("보호 칸(시작 위치)이 통행 불가로 덮이면 그 칸만 건너뛰고 경고한다", () => {
    const ctx = context();
    expect(runTool(ctx, "set_start_position", { mapId: DST, x: 5, y: 5 }).ok).toBe(true);
    const src = ctx.project.maps[SRC];
    // 소스 2×2 전부 벽(통행 불가) — 목적지 (5,5) 가 시작 칸이라 그 한 칸만 보호로 빠져야 한다.
    for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]] as const) {
      src.lowerTiles[y * src.width + x] = TILE.WALL;
    }
    const result = runTool(ctx, "copy_map_region", {
      from: { mapId: SRC, x: 1, y: 1, w: 2, h: 2 },
      to: { mapId: DST, x: 5, y: 5 },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(lowerAt(ctx, DST, 5, 5), "시작 칸은 보존된다").toBe(TILE.GRASS);
    expect(lowerAt(ctx, DST, 6, 5), "나머지 칸은 복사된다").toBe(TILE.WALL);
    expect(result.diff?.warnings.join("\n")).toContain("시작 위치");
    expect(result.data).toMatchObject({ copied: 3, skipped: 1 });
  });
});
