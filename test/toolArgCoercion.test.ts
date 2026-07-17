import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { normalizeToolArgs } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { ToolContext } from "@/editor/tools";

const MAP_ID = "map_blank_start";
const WALL_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}plaster-wall-9slice`;

function approveDefaultWallVocabulary(ctx: ToolContext): void {
  const tileset = ctx.project.tilesets[DEFAULT_TILESET_ID];
  const group = tileset.tileGroups?.find((entry) => entry.id === WALL_GROUP_ID);
  if (!group) throw new Error(`기본 벽 그룹 없음: ${WALL_GROUP_ID}`);
  group.origin = "user";
}

describe("tool argument coercion", () => {
  it("coerces numeric strings before schema validation and execution", () => {
    const ctx: ToolContext = { project: createBlankProject() };

    const result = runTool(ctx, "create_map", {
      id: "map_numeric_strings",
      name: "숫자 문자열 맵",
      width: "14",
      height: "9",
    }, { dryRun: false });

    expect(result.ok).toBe(true);
    const map = ctx.project.maps.map_numeric_strings;
    expect(map?.width).toBe(14);
    expect(map?.height).toBe(9);
  });

  it("coerces JSON-string object arguments and nested numeric strings", () => {
    const ctx: ToolContext = { project: createBlankProject() };

    const result = runTool(ctx, "upsert_item", {
      item: "{\"id\":\"item_json_string\",\"name\":\"JSON 약\",\"price\":\"14\"}",
    }, { dryRun: false });

    expect(result.ok).toBe(true);
    const item = ctx.project.database.items.find((entry) => entry.id === "item_json_string");
    expect(item?.name).toBe("JSON 약");
    expect(item?.price).toBe(14);
  });

  it("unwraps a single object array for object fields", () => {
    const ctx: ToolContext = { project: createBlankProject() };

    const result = runTool(ctx, "upsert_item", {
      item: [{ id: "item_wrapped", name: "래핑 약", price: "7" }],
    }, { dryRun: false });

    expect(result.ok).toBe(true);
    const item = ctx.project.database.items.find((entry) => entry.id === "item_wrapped");
    expect(item?.name).toBe("래핑 약");
    expect(item?.price).toBe(7);
  });

  it("flattens rect wrapper coordinates for get_map_region", () => {
    const ctx: ToolContext = { project: createBlankProject() };

    const result = runTool(ctx, "get_map_region", {
      mapId: MAP_ID,
      rect: { x: "1", y: "2", w: "4", h: "3" },
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("(1,2)~(5,5)");
  });

  it("flattens rect wrapper coordinates for clear_region", () => {
    const ctx: ToolContext = { project: createBlankProject() };

    const result = runTool(ctx, "clear_region", {
      mapId: MAP_ID,
      rect: { x: 1, y: 2, w: 4, h: 3 },
      fill: "empty",
    }, { dryRun: false });

    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ cleared: 12 });
  });

  it("flattens width/height aliases from wrappers for show_map_region", () => {
    const ctx: ToolContext = { project: createBlankProject() };

    const result = runTool(ctx, "show_map_region", {
      mapId: MAP_ID,
      bounds: { x: 2, y: 3, width: 5, height: 4 },
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ mapId: MAP_ID, x: 2, y: 3, w: 5, h: 4 });
  });

  it("wraps flat coordinates into build_wall rect", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    approveDefaultWallVocabulary(ctx);

    const result = runTool(ctx, "build_wall", {
      mapId: MAP_ID,
      x: 2,
      y: 5,
      w: 4,
      h: 4,
      material: "흰 집 벽",
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ wallRegion: { x: 2, y: 5, w: 4, h: 4 }, cells: 16 });
  });

  it("maps width/height aliases to wrapped w/h coordinates", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    approveDefaultWallVocabulary(ctx);

    const result = runTool(ctx, "build_wall", {
      mapId: MAP_ID,
      x: 3,
      y: 6,
      width: "5",
      height: "3",
      material: "흰 집 벽",
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ wallRegion: { x: 3, y: 6, w: 5, h: 3 }, cells: 15 });
  });

  it("maps w/h aliases to flat width/height fields", () => {
    const normalized = normalizeToolArgs("create_map", {
      id: "map_alias_size",
      name: "별칭 크기 맵",
      w: "13",
      h: "8",
    });

    expect(normalized).toMatchObject({ width: 13, height: 8 });
  });

  it("keeps top-level coordinates ahead of wrapper coordinates", () => {
    const normalized = normalizeToolArgs("get_map_region", {
      mapId: MAP_ID,
      x: 9,
      y: 8,
      rect: { x: 1, y: 2, w: 3, h: 4 },
    });

    expect(normalized).toMatchObject({ x: 9, y: 8, w: 3, h: 4 });
  });

  it("adds a retry example to v1 region schema validation errors", () => {
    const ctx: ToolContext = { project: createBlankProject() };

    const result = runTool(ctx, "get_map_region", { mapId: MAP_ID });

    expect(result.ok).toBe(false);
    expect(`${result.summary} ${JSON.stringify(result.issues ?? [])}`).toContain("다시 보낼 형식 예시");
    expect(result.issues?.[0]?.message).toContain("\"x\":0");
  });
});
