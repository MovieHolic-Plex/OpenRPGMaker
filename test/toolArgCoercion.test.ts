import { describe, expect, it } from "vitest";
import { getTool, runTool, validateArgs } from "@/editor/tools";
import { normalizeToolArgs } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { ToolContext } from "@/editor/tools";
import { withRetiredCombinedTownMaps } from "./support/retiredCombinedTownMaps";

const MAP_ID = "map_blank_start";
const WALL_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}plaster-wall-9slice`;

function approveDefaultWallVocabulary(ctx: ToolContext): void {
  const tileset = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID];
  const group = tileset.tileGroups?.find((entry) => entry.id === WALL_GROUP_ID);
  if (!group) throw new Error(`기본 벽 그룹 없음: ${WALL_GROUP_ID}`);
  group.origin = "user";
}

describe("tool argument coercion", () => {
  it("does not invent a nested destination when scene steps own flat coordinates", () => {
    const args = {
      mapId: MAP_ID,
      start: { x: 10, y: 8 },
      steps: [{ kind: "set", x: 10, y: 8 }],
    };

    expect(normalizeToolArgs("run_scene_test", args)).toEqual(args);
  });

  it("coerces numeric strings before schema validation and execution", () => {
    const ctx: ToolContext = { project: withRetiredCombinedTownMaps(createBlankProject()) };

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
    const ctx: ToolContext = { project: withRetiredCombinedTownMaps(createBlankProject()) };

    const result = runTool(ctx, "upsert_item", {
      item: "{\"id\":\"item_json_string\",\"name\":\"JSON 약\",\"price\":\"14\"}",
    }, { dryRun: false });

    expect(result.ok).toBe(true);
    const item = ctx.project.database.items.find((entry) => entry.id === "item_json_string");
    expect(item?.name).toBe("JSON 약");
    expect(item?.price).toBe(14);
  });

  it("unwraps a single object array for object fields", () => {
    const ctx: ToolContext = { project: withRetiredCombinedTownMaps(createBlankProject()) };

    const result = runTool(ctx, "upsert_item", {
      item: [{ id: "item_wrapped", name: "래핑 약", price: "7" }],
    }, { dryRun: false });

    expect(result.ok).toBe(true);
    const item = ctx.project.database.items.find((entry) => entry.id === "item_wrapped");
    expect(item?.name).toBe("래핑 약");
    expect(item?.price).toBe(7);
  });

  it("flattens rect wrapper coordinates for get_map_region", () => {
    const ctx: ToolContext = { project: withRetiredCombinedTownMaps(createBlankProject()) };

    const result = runTool(ctx, "get_map_region", {
      mapId: MAP_ID,
      rect: { x: "1", y: "2", w: "4", h: "3" },
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("(1,2)~(5,5)");
  });

  it("flattens rect wrapper coordinates for clear_region", () => {
    const ctx: ToolContext = { project: withRetiredCombinedTownMaps(createBlankProject()) };

    const result = runTool(ctx, "clear_region", {
      mapId: MAP_ID,
      rect: { x: 1, y: 2, w: 4, h: 3 },
      fill: "empty",
    }, { dryRun: false });

    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ cleared: 12 });
  });

  it("flattens width/height aliases from wrappers for show_map_region", () => {
    const ctx: ToolContext = { project: withRetiredCombinedTownMaps(createBlankProject()) };

    const result = runTool(ctx, "show_map_region", {
      mapId: MAP_ID,
      bounds: { x: 2, y: 3, width: 5, height: 4 },
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ mapId: MAP_ID, x: 2, y: 3, w: 5, h: 4 });
  });

  it("wraps flat coordinates into build_wall rect", () => {
    const ctx: ToolContext = { project: withRetiredCombinedTownMaps(createBlankProject()) };
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
    const ctx: ToolContext = { project: withRetiredCombinedTownMaps(createBlankProject()) };
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
    expect(normalized).not.toHaveProperty("w");
    expect(normalized).not.toHaveProperty("h");
  });

  it("keeps top-level coordinates ahead of wrapper coordinates", () => {
    const normalized = normalizeToolArgs("get_map_region", {
      mapId: MAP_ID,
      x: 9,
      y: 8,
      rect: { x: 1, y: 2, w: 3, h: 4 },
    });

    expect(normalized).toMatchObject({ x: 9, y: 8, w: 3, h: 4 });
    expect(normalized).not.toHaveProperty("rect");
  });

  it("drops a coordinate wrapper after copying so a strict tool accepts the call", () => {
    const normalized = normalizeToolArgs("place_field_obstacle", {
      mapId: MAP_ID,
      kind: "gap",
      bounds: { x: 4, y: 6 },
    });

    expect(normalized).toEqual({ mapId: MAP_ID, kind: "gap", x: 4, y: 6 });
    expect(validateArgs(getTool("place_field_obstacle")!.parameters, normalized)).toEqual([]);
  });

  it("keeps a wrapper that did not hold coordinates so the unknown key is still rejected", () => {
    const normalized = normalizeToolArgs("place_field_obstacle", {
      mapId: MAP_ID,
      x: 1,
      y: 2,
      kind: "tree",
      rect: { note: "not a coordinate" },
    });

    expect(normalized).toMatchObject({ rect: { note: "not a coordinate" } });
    expect(validateArgs(getTool("place_field_obstacle")!.parameters, normalized).join("\n")).toContain("허용되지 않은 인자: rect");
  });

  it("hoists nested cell wrappers, including mapId, and drops the wrapper key", () => {
    const normalized = normalizeToolArgs("author_party_split", {
      mapId: "map_tower",
      splitAt: { rect: { x: 10, y: 18, mapId: "map_tower_2" } },
      groups: [
        { actorIds: ["actor_a"], pos: { x: 3, y: 15 } },
        { actorIds: ["actor_b"], x: 17, y: 15 },
      ],
      rejoin: { x: 10, y: 2 },
    }) as { splitAt: Record<string, unknown>; groups: Record<string, unknown>[] };

    expect(normalized.splitAt).toEqual({ x: 10, y: 18, mapId: "map_tower_2" });
    expect(normalized.groups[0]).toEqual({ actorIds: ["actor_a"], x: 3, y: 15 });
  });

  it("maps nested w/h onto width/height and drops an at-wrapper", () => {
    const normalized = normalizeToolArgs("make_timed_escape", {
      mapId: "map_lake",
      exit: { x: 1, y: 2, w: 4, h: 1 },
      checkpoint: { mapId: "map_shrine", at: { x: 3, y: 4 } },
    }) as { exit: Record<string, unknown>; checkpoint: Record<string, unknown> };

    expect(normalized.exit).toEqual({ x: 1, y: 2, width: 4, height: 1 });
    expect(normalized.checkpoint).toEqual({ mapId: "map_shrine", x: 3, y: 4 });
  });

  it("drops flat coordinates after wrapping them into the single rect field", () => {
    const normalized = normalizeToolArgs("build_wall", {
      mapId: MAP_ID,
      x: 2,
      y: 5,
      w: 4,
      h: 4,
      material: "흰 집 벽",
    });

    expect(normalized).toMatchObject({ mapId: MAP_ID, material: "흰 집 벽", rect: { x: 2, y: 5, w: 4, h: 4 } });
    for (const key of ["x", "y", "w", "h", "width", "height"]) expect(normalized).not.toHaveProperty(key);
  });

  it("adds a retry example to v1 region schema validation errors", () => {
    const ctx: ToolContext = { project: withRetiredCombinedTownMaps(createBlankProject()) };

    const result = runTool(ctx, "get_map_region", { mapId: MAP_ID });

    expect(result.ok).toBe(false);
    expect(`${result.summary} ${JSON.stringify(result.issues ?? [])}`).toContain("다시 보낼 형식 예시");
    expect(result.issues?.[0]?.message).toContain("\"x\":0");
  });
});
