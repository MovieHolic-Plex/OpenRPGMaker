import { byName } from "@/editor/tools/toolArgCoerce";
import { MAP_TOOLS } from "@/editor/tools/mapTools";
import { resolveObject, SHARED_OBJECT_TOOLS } from "@/editor/tools/sharedObjectTools";
import { CONSTRUCTION_TOOLS_V3 } from "@/editor/tools/v3/constructionTools";
import { ToolError, type JsonSchema, type ToolExecResult } from "@/editor/tools/types";
import { blankFillTileFor } from "@/project/defaults/defaultMaps";
import { extendedLowerTiles, groundFeaturePredicate } from "@/project/mapGroundFill";
import { withKitSite } from "@/project/kitLook";
import { layerTileAt, TILE_LAYER_NOS } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import {
  assertInside, editTiles, forEachCell, getTileset, hostRegion, includesCell, offsetRect, requireTile, tileCellChanged, writeTileCell, type Rect,
} from "./22-map-tiles/region";
import { setRegionPassability } from "./22-map-tiles/passability";

export const UNIT = "22-map-tiles";

const integer = (description: string, minimum = Number.MIN_SAFE_INTEGER): JsonSchema => ({
  type: "integer", description, minimum, maximum: Number.MAX_SAFE_INTEGER,
});
const choice = (values: readonly string[], description: string): JsonSchema => ({ type: "string", enum: values, description });
const schema = (properties: Record<string, JsonSchema>, required: readonly string[]): JsonSchema => ({
  type: "object", properties, required, additionalProperties: false,
});

const coords = { x: integer("맵 왼쪽부터 센 칸 번호예요. 첫 칸은 0이에요.", 0),
  y: integer("맵 위쪽부터 센 칸 번호예요. 첫 칸은 0이에요.", 0) };
const offset = {
  dx: integer("가로로 옮길 칸 수예요. 음수는 왼쪽이에요."),
  dy: integer("세로로 옮길 칸 수예요. 음수는 위쪽이에요."),
};
const source = {
  ...coords, w: integer("원본 영역의 너비예요.", 1), h: integer("원본 영역의 높이예요.", 1), ...offset,
};
const tile = integer("현재 맵의 타일셋에서 고른 타일 번호예요.", 0);
const paintLayer = choice(["1", "2", "3", "4"], "칠할 층이에요. 기본은 1층이며 전용 층이 있는 타일은 그 층에 놓일 수 있어요.");
const sourceKeys = ["x", "y", "w", "h", "dx", "dy"];

function regionScope(mapId: string, rect: Rect) {
  return { kind: "mapRegion", mapId, rect } as const;
}

function mapRegion(ctx: PrimitiveContext) {
  const { map, rect } = hostRegion(ctx);
  return regionScope(map.id, rect);
}

function paintCell(ctx: PrimitiveContext, args: Record<string, unknown>) {
  const { map, rect } = hostRegion(ctx);
  const cell = { x: args.x as number, y: args.y as number, w: 1, h: 1 };
  assertInside(rect, cell);
  return regionScope(map.id, cell);
}

function mapShiftRegion(ctx: PrimitiveContext) {
  const { map, rect } = hostRegion(ctx, true);
  if (rect.w !== map.width || rect.h !== map.height) {
    throw new PrimitiveError("범위 밖: 맵 전체를 밀려면 맵 전체를 선택해 주세요.");
  }
  return { map, rect };
}

function mapShiftScope(ctx: PrimitiveContext) {
  const { map, rect } = mapShiftRegion(ctx);
  return regionScope(map.id, rect);
}

function primitive(
  id: string, tool: string, title: string, args: JsonSchema,
  describe: SmallTaskPrimitive["describe"], apply: SmallTaskPrimitive["apply"],
  scope: SmallTaskPrimitive["scope"] = mapRegion,
): SmallTaskPrimitive {
  return { id, unit: UNIT, title, covers: { tools: [tool] }, targets: ["map"], args, scope, describe, apply };
}

function userError(cause: unknown, message: string): never {
  if (cause instanceof ToolError) throw new PrimitiveError(message);
  throw cause;
}

function paint(ctx: PrimitiveContext, args: Record<string, unknown>, area?: Rect) {
  const { map, rect } = hostRegion(ctx);
  const tile = requireTile(ctx.project, map, args.tile);
  const paintArea = area ?? rect;
  assertInside(rect, paintArea);
  const cells: { x: number; y: number }[] = [];
  forEachCell(paintArea, (x, y) => cells.push({ x, y }));
  return editTiles(ctx.project, map, draft => {
    let result: ToolExecResult;
    try {
      result = byName(MAP_TOOLS, "paint_tiles").run(draft, { mapId: map.id, layer: args.layer ?? "1", mode: "cells", tile, cells });
    } catch (cause) {
      userError(cause, "이 영역에 타일을 칠할 수 없어요.");
    }
    const data = result.data as { skippedClusterCells?: number } | undefined;
    if (data?.skippedClusterCells) throw new PrimitiveError("범위 밖: 타일에 딸린 조각을 모두 놓을 수 없어요.");
  });
}

function erase(ctx: PrimitiveContext, args: Record<string, unknown>) {
  const { map, rect } = hostRegion(ctx);
  getTileset(ctx.project, map);
  const layer = args.layer ?? "3";
  return editTiles(ctx.project, map, (draft, next) => {
    try {
      const { data } = byName(CONSTRUCTION_TOOLS_V3, "tile_erase").run(draft, { mapId: map.id, rect, layer });
      if ((data as { skipped?: number } | undefined)?.skipped) {
        throw new PrimitiveError("범위 밖: 통행을 유지해야 하는 칸이 포함되어 있어요.");
      }
    } catch (cause) {
      userError(cause, "이 영역의 타일을 지울 수 없어요.");
    }
    forEachCell(rect, (x, y) => {
      const i = y * map.width + x;
      if (layer === "3" || layer === "all") clearTileStack(next, "upper", i);
      if (layer === "1" || layer === "all") clearTileStack(next, "lower", i);
    });
  });
}

function stampPlacement(ctx: PrimitiveContext, args: Record<string, unknown>) {
  const { map, rect } = hostRegion(ctx);
  const tileset = getTileset(ctx.project, map);
  if (typeof args.objectId !== "string" || !args.objectId.trim()) throw new PrimitiveError("놓을 물건을 골라 주세요.");
  if ((args.x === undefined) !== (args.y === undefined)) {
    throw new PrimitiveError("물건을 놓을 가로와 세로 위치를 함께 알려 주세요.");
  }
  const x = args.x === undefined ? rect.x : args.x as number;
  const y = args.y === undefined ? rect.y : args.y as number;
  const objectId = tileset.structureKits?.some(kit => kit.id === args.objectId)
    ? `kit:${tileset.id}/${args.objectId}` : args.objectId;
  let object: ReturnType<typeof resolveObject>;
  try {
    object = withKitSite(`${map.id}|${x}|${y}`, () => resolveObject(ctx.project, objectId));
  } catch (cause) {
    userError(cause, "놓을 물건을 찾을 수 없어요.");
  }
  if (object.source !== tileset || Object.keys(object.assets).length > 0) {
    throw new PrimitiveError("범위 밖: 이 맵의 타일셋에 들어 있는 물건만 놓을 수 있어요.");
  }
  const area = { x, y, w: object.pattern.width, h: object.pattern.height };
  assertInside(rect, area);
  for (const tiles of [object.pattern.lower, object.pattern.upper]) {
    for (const tile of tiles) if (tile !== -1) requireTile(ctx.project, map, tile);
  }
  return { map, objectId, object, area };
}

function stampScope(ctx: PrimitiveContext, args: Record<string, unknown>) {
  const { map, area } = stampPlacement(ctx, args);
  return regionScope(map.id, area);
}

function stamp(ctx: PrimitiveContext, args: Record<string, unknown>) {
  const { map, objectId, object, area } = stampPlacement(ctx, args);
  const { x, y, w } = area;
  return editTiles(ctx.project, map, (draft, next) => {
    try {
      byName(SHARED_OBJECT_TOOLS, "stamp_object").run(draft, { mapId: map.id, objectId, x, y });
    } catch (cause) {
      userError(cause, "이 자리에 물건을 놓을 수 없어요.");
    }
    if (draft.startPos !== ctx.project.startPos) {
      throw new PrimitiveError("게임 시작 위치를 옮겨야 하는 자리예요. 다른 자리를 골라 주세요.");
    }
    forEachCell(area, (column, row) => {
      const index = row * map.width + column;
      const patternIndex = (row - y) * w + column - x;
      const lower = object.defaultLayers === "upper" ? -1 : object.pattern.lower[patternIndex] ?? -1;
      const upper = object.defaultLayers === "lower" ? -1 : object.pattern.upper[patternIndex] ?? -1;
      const expected = [lower, -1, upper, -1] as const;
      if (TILE_LAYER_NOS.some(layer => {
        const tile = expected[layer - 1]!;
        return layerTileAt(next, layer, index) !== (tile < 0 ? layerTileAt(map, layer, index) : tile);
      })) {
        throw new PrimitiveError("범위 밖: 이 자리에 놓으려면 다른 물건도 치워야 해요.");
      }
    });
  });
}

function regionTransfer(ctx: PrimitiveContext, args: Record<string, unknown>) {
  const { map, rect } = hostRegion(ctx);
  const from = { x: args.x as number, y: args.y as number, w: args.w as number, h: args.h as number };
  const dx = args.dx as number;
  const dy = args.dy as number;
  const to = offsetRect(from, { x: dx, y: dy });
  assertInside(rect, from);
  assertInside(rect, to);
  if (!dx && !dy) throw new PrimitiveError("원본과 다른 위치를 알려 주세요.");
  return { map, from, to, dx, dy };
}

function moveBounds(from: Rect, to: Rect, dx: number, dy: number): Rect {
  return {
    x: Math.min(from.x, to.x), y: Math.min(from.y, to.y),
    w: from.w + Math.abs(dx), h: from.h + Math.abs(dy),
  };
}

function transferScope(ctx: PrimitiveContext, args: Record<string, unknown>, move: boolean) {
  const { map, from, to, dx, dy } = regionTransfer(ctx, args);
  return regionScope(map.id, move ? moveBounds(from, to, dx, dy) : to);
}

function copyOrMove(ctx: PrimitiveContext, args: Record<string, unknown>, move: boolean) {
  const { map, from, to, dx, dy } = regionTransfer(ctx, args);
  return editTiles(ctx.project, map, (_draft, next) => {
    if (move) {
      forEachCell(from, (x, y) => {
        if (!includesCell(to, x, y)) writeTileCell(map, -1, next, y * map.width + x);
      });
    }
    forEachCell(to, (x, y) => {
      writeTileCell(map, (y - dy) * map.width + x - dx, next, y * map.width + x);
    });
    // The core checks the enclosing rectangle. Check the gap here as well.
    if (move) forEachCell(moveBounds(from, to, dx, dy), (x, y) => {
      if (!includesCell(from, x, y) && !includesCell(to, x, y) && tileCellChanged(map, next, y * map.width + x)) {
        throw new PrimitiveError("범위 밖: 원본과 옮길 자리만 고칠 수 있어요.");
      }
    });
  });
}

function mirror(ctx: PrimitiveContext, args: Record<string, unknown>) {
  const { map, rect } = hostRegion(ctx);
  const horizontal = args.axis === "horizontal";
  const shadow = horizontal
    ? (bits: number) => ((bits & 0b0101) << 1) | ((bits & 0b1010) >> 1)
    : (bits: number) => ((bits & 0b0011) << 2) | ((bits & 0b1100) >> 2);
  return editTiles(ctx.project, map, (_draft, next) => {
    forEachCell(rect, (x, y) => {
      const sx = horizontal ? 2 * rect.x + rect.w - 1 - x : x;
      const sy = horizontal ? y : 2 * rect.y + rect.h - 1 - y;
      writeTileCell(map, sy * map.width + sx, next, y * map.width + x, { shadow });
    });
  });
}

function shift(ctx: PrimitiveContext, args: Record<string, unknown>) {
  const { map, rect } = mapShiftRegion(ctx);
  const dx = args.dx as number;
  const dy = args.dy as number;
  if (!dx && !dy) throw new PrimitiveError("밀어 옮길 방향과 칸 수를 알려 주세요.");
  if (Math.abs(dx) >= rect.w || Math.abs(dy) >= rect.h) {
    throw new PrimitiveError("범위 밖: 타일이 맵 밖으로 모두 밀려나요.");
  }
  const tileset = getTileset(ctx.project, map);
  const isFeature = groundFeaturePredicate(map, ctx.project.tilesets);
  const validGround = (tile: number) => Number.isSafeInteger(tile) && tile >= 0 && tile < tileset.count && !isFeature(tile);
  const ground = map.lowerTiles.some(validGround)
    ? extendedLowerTiles(map, rect.w, rect.h, tile => !validGround(tile), dx, dy)
    : undefined;
  const fallback = blankFillTileFor(tileset.id, -1, tileset);
  return editTiles(ctx.project, map, (_draft, next) => {
    forEachCell(rect, (x, y) => {
      const i = y * map.width + x;
      const sx = x - dx;
      const sy = y - dy;
      const from = includesCell(rect, sx, sy) ? sy * map.width + sx : -1;
      const vacated = ground?.[i] ?? (fallback < tileset.count ? fallback : -1);
      writeTileCell(map, from, next, i, { ground: vacated });
    });
  });
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  primitive("map.tile.paint", "paint_tiles", "타일 칠하기",
    schema({ ...coords, tile, layer: paintLayer }, ["x", "y", "tile"]),
    () => "지정한 칸에 타일을 칠해요.",
    (ctx, args) => paint(ctx, args, paintCell(ctx, args).rect), paintCell),
  primitive("map.tile.erase", "tile_erase", "타일 지우기",
    schema({ layer: choice(["1", "2", "3", "4", "shadow", "all"],
      "기본은 3층과 4층이에요. 1은 바닥을 채우고 2층을 지워요. 3은 3층과 4층을 지워요. shadow는 그림자, all은 바닥 복원과 나머지 층 지우기예요.") }, []),
    (_ctx, args) => {
      if (args.layer === "shadow") return "선택한 영역의 그림자를 지워요.";
      if (args.layer === "1") return "선택한 영역의 바닥을 채우고 2층을 지워요.";
      if (args.layer === "all") return "선택한 영역의 바닥을 채우고 나머지 타일과 그림자를 지워요.";
      return args.layer === "2" || args.layer === "4" ? `선택한 영역의 ${args.layer}층 타일을 지워요.`
        : "선택한 영역의 3층과 4층 타일을 지워요.";
    }, erase),
  primitive("map.region.fill", "fill_region", "영역 채우기",
    schema({ tile, layer: paintLayer }, ["tile"]),
    () => "선택한 영역을 같은 타일로 채워요.", (ctx, args) => paint(ctx, args)),
  primitive("map.object.stamp", "stamp_object", "물건 찍기",
    schema({ objectId: { type: "string", minLength: 1, description: "현재 맵 타일셋에서 고른 물건의 식별자예요." }, ...coords }, ["objectId"]),
    () => "선택한 영역에 물건을 놓아요.", stamp, stampScope),
  primitive("map.region.copy", "copy_map_region", "영역 복사",
    schema(source, sourceKeys), () => "영역 안의 타일과 그림자를 지정한 위치에 복사해요.",
    (ctx, args) => copyOrMove(ctx, args, false), (ctx, args) => transferScope(ctx, args, false)),
  primitive("map.region.move", "move_region", "영역 옮기기",
    schema(source, sourceKeys), () => "영역 안의 타일과 그림자를 지정한 위치로 옮겨요.",
    (ctx, args) => copyOrMove(ctx, args, true), (ctx, args) => transferScope(ctx, args, true)),
  primitive("map.region.mirror", "mirror_region", "영역 뒤집기",
    schema({ axis: choice(["horizontal", "vertical"], "좌우 뒤집기 또는 상하 뒤집기를 골라요.") }, ["axis"]),
    (_ctx, args) => args.axis === "horizontal" ? "선택한 영역의 타일과 그림자를 좌우로 뒤집어요." : "선택한 영역의 타일과 그림자를 상하로 뒤집어요.",
    mirror),
  primitive("map.tile.shift", "shift_map", "맵 타일 밀기",
    schema(offset, ["dx", "dy"]), () => "맵 전체의 타일과 그림자를 지정한 방향으로 밀어요.",
    shift, mapShiftScope),
  primitive("map.tile.setPassability", "set_tile_passability", "통행 설정",
    schema({ tile, passable: { type: "boolean", description: "선택 영역에서만 쓰이는 타일의 네 방향 통행을 정해요." } }, ["tile", "passable"]),
    (_ctx, args) => args.passable === true ? "선택한 타일의 통행을 허용해요." : "선택한 타일의 통행을 막아요.",
    setRegionPassability),
];
