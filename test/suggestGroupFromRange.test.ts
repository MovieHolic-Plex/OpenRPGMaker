import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { Project, TilesetDef } from "@/project/types";
import { createBlankProject } from "@/project/defaults";

describe("suggest_group_from_range", () => {
  it("suggests an autotile 3x3 grammar for a 3 by 3 terrain block", () => {
    const result = runTool(ctx(makeTileset({ count: 9, tilesPerRow: 3 })), "suggest_group_from_range", {
      rect: { h: 3, w: 3, x: 0, y: 0 },
      tilesetId: "range_tileset",
    });

    expect(result.ok).toBe(true);
    expect(dataOf(result).suggestion.patternGrammar.kind).toBe("autotile_3x3");
    expect(dataOf(result).suggestion.role).toBe("terrain");
    expect(dataOf(result).tileIds).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("suggests a vertical expandable grammar for a two-cell vertical range", () => {
    const result = runTool(ctx(makeTileset({ count: 8, tilesPerRow: 4 })), "suggest_group_from_range", {
      rect: { h: 2, w: 1, x: 1, y: 0 },
      tilesetId: "range_tileset",
    });

    expect(result.ok).toBe(true);
    expect(dataOf(result).suggestion.patternGrammar.kind).toBe("vertical_expandable");
    expect(dataOf(result).suggestion.parts.map((part) => part.role)).toEqual(["top", "bottom"]);
    expect(dataOf(result).tileIds).toEqual([1, 5]);
  });

  it("suggests single prop for one upper-layer tile", () => {
    const result = runTool(ctx(makeTileset({ count: 4, priority: "upper", tilesPerRow: 4 })), "suggest_group_from_range", {
      rect: { h: 1, w: 1, x: 2, y: 0 },
      tilesetId: "range_tileset",
    });

    expect(result.ok).toBe(true);
    expect(dataOf(result).suggestion.patternGrammar.kind).toBe("single");
    expect(dataOf(result).suggestion.role).toBe("prop");
    expect(dataOf(result).tileIds).toEqual([2]);
  });

  it("clips a bottom-edge rect to existing tile ids", () => {
    const result = runTool(ctx(makeTileset({ count: 10, tilesPerRow: 4 })), "suggest_group_from_range", {
      rect: { h: 2, w: 2, x: 2, y: 1 },
      tilesetId: "range_tileset",
    });

    expect(result.ok).toBe(true);
    expect(dataOf(result).tileIds).toEqual([6, 7]);
  });
});

type SuggestionPart = {
  readonly role: string;
  readonly tileIds: readonly number[];
};

type SuggestGroupFromRangeData = {
  readonly suggestion: {
    readonly parts: readonly SuggestionPart[];
    readonly patternGrammar: { readonly kind: string };
    readonly role: string;
  };
  readonly tileIds: readonly number[];
};

function dataOf(result: ReturnType<typeof runTool>): SuggestGroupFromRangeData {
  if (!result.ok || !isSuggestData(result.data)) throw new Error("missing suggest data");
  return result.data;
}

function isSuggestData(value: unknown): value is SuggestGroupFromRangeData {
  if (typeof value !== "object" || value === null) return false;
  const record = recordValue(value);
  return Array.isArray(record.tileIds) && typeof record.suggestion === "object" && record.suggestion !== null;
}

function recordValue(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

function ctx(tileset: TilesetDef): { project: Project } {
  return { project: projectWithTileset(tileset) };
}

function projectWithTileset(tileset: TilesetDef): Project {
  const project = createBlankProject();
  project.tilesets[tileset.id] = tileset;
  return project;
}

function makeTileset(args: {
  readonly count: number;
  readonly priority?: "lower" | "upper";
  readonly tilesPerRow: number;
}): TilesetDef {
  return {
    count: args.count,
    id: "range_tileset",
    image: { id: "tex_tiles_default", type: "bundled" },
    name: "Range tileset",
    passability: Array.from({ length: args.count }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: args.count }, () => args.priority ?? "lower"),
    terrain: Array.from({ length: args.count }, () => 0),
    tileMeta: Array.from({ length: args.count }, () => ({ description: "", label: "" })),
    tileSize: 16,
    tilesPerRow: args.tilesPerRow,
  };
}
