import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { ToolContext } from "@/editor/tools";

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
});
