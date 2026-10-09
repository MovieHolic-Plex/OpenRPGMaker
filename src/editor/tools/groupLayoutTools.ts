import { defaultToolTilesetId } from "@/project/defaults/outdoorTileset";
import type { Project, TileGroupMetadata, TilesetDef } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
type PatternPart = PatternGrammar["parts"][number];
type LayoutAxis = "horizontal" | "vertical";
type LayoutTiles = {
  readonly bottom: number[];
  readonly left: number[];
  readonly right: number[];
  readonly top: number[];
};

const LAYOUT_AXES: readonly LayoutAxis[] = ["vertical", "horizontal"];

const setGroupLayout: ToolDefinition = {
  name: "set_group_layout",
  description:
    "타일 그룹의 실제 구성 문법(patternGrammar)을 저장한다. 세로는 위/아래, 가로는 좌/우 캡을 기록해 render_group_sample과 배치 툴이 같은 덩어리로 해석하게 한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "생략 시 시작 맵의 타일셋(없으면 숲마을)" },
      groupId: { type: "string", description: "대상 타일 그룹 id" },
      axis: { type: "string", enum: LAYOUT_AXES, description: "vertical=위/아래, horizontal=좌/우" },
      top: { type: "array", items: { type: "integer" }, description: "세로 구성의 위쪽 타일" },
      bottom: { type: "array", items: { type: "integer" }, description: "세로 구성의 아래쪽 타일" },
      left: { type: "array", items: { type: "integer" }, description: "가로 구성의 왼쪽 타일" },
      right: { type: "array", items: { type: "integer" }, description: "가로 구성의 오른쪽 타일" },
    },
    required: ["groupId", "axis"],
  },
  run(draft, args): ToolExecResult {
    const tileset = requireTileset(draft, args.tilesetId);
    const group = requireGroup(tileset, args.groupId);
    const axis = requireAxis(args.axis);
    const tiles = layoutTiles(tileset, args);
    const grammar = axis === "vertical" ? verticalGrammar(tiles) : horizontalGrammar(tiles);
    const usedTiles = grammar.parts.flatMap((part) => part.tileIds);

    group.patternGrammar = grammar;
    group.tileIds = [...new Set([...group.tileIds, ...usedTiles])];

    return {
      summary: `구성 저장: ${group.name} — ${layoutSummary(axis, grammar)}`,
      data: { axis, groupId: group.id, tilesetId: tileset.id },
    };
  },
};

export const GROUP_LAYOUT_TOOLS: readonly ToolDefinition[] = [setGroupLayout];

function requireTileset(project: Project, tilesetId: unknown): TilesetDef {
  const id = typeof tilesetId === "string" && tilesetId.trim() ? tilesetId.trim() : defaultToolTilesetId(project);
  const tileset = project.tilesets[id];
  if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${id}`, { code: "tileset-not-found" });
  return tileset;
}

function requireGroup(tileset: TilesetDef, groupIdValue: unknown): TileGroupMetadata {
  const groupId = typeof groupIdValue === "string" ? groupIdValue.trim() : "";
  if (!groupId) throw new ToolError("groupId가 비어 있습니다.", { code: "invalid-args" });
  const group = tileset.tileGroups?.find((candidate) => candidate.id === groupId);
  if (!group) throw new ToolError(`그룹을 찾을 수 없습니다: ${groupId}`, { code: "group-not-found" });
  return group;
}

function requireAxis(value: unknown): LayoutAxis {
  const axis = LAYOUT_AXES.find((candidate) => candidate === value);
  if (!axis) throw new ToolError(`axis는 vertical 또는 horizontal이어야 합니다: ${String(value)}`, { code: "invalid-args" });
  return axis;
}

function requireTileIndex(tileset: TilesetDef, value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= tileset.count) {
    throw new ToolError(`${label} 범위 밖: ${String(value)} (0~${tileset.count - 1})`, { code: "tile-out-of-range" });
  }
  return value;
}

function tileArray(tileset: TilesetDef, value: unknown, label: string): number[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ToolError(`${label} 형식이 올바르지 않습니다.`, { code: "invalid-args" });
  return value.map((tile) => requireTileIndex(tileset, tile, label));
}

function layoutTiles(tileset: TilesetDef, args: Record<string, unknown>): LayoutTiles {
  return {
    bottom: tileArray(tileset, args.bottom, "bottom"),
    left: tileArray(tileset, args.left, "left"),
    right: tileArray(tileset, args.right, "right"),
    top: tileArray(tileset, args.top, "top"),
  };
}

function verticalGrammar(tiles: LayoutTiles): PatternGrammar {
  if (tiles.top.length === 0 && tiles.bottom.length === 0) {
    throw new ToolError("세로 구성에는 top 또는 bottom이 필요합니다.", { code: "invalid-args" });
  }
  const parts: PatternPart[] = [];
  if (tiles.top.length > 0) parts.push({ role: "top", tileIds: tiles.top });
  if (tiles.bottom.length > 0) parts.push({ role: "bottom", tileIds: tiles.bottom });
  return {
    axis: "vertical",
    kind: "vertical_expandable",
    minHeight: 2,
    minWidth: 1,
    parts,
    preserveCaps: true,
    repeat: "body",
  };
}

function horizontalGrammar(tiles: LayoutTiles): PatternGrammar {
  if (tiles.left.length === 0 && tiles.right.length === 0) {
    throw new ToolError("가로 구성에는 left 또는 right가 필요합니다.", { code: "invalid-args" });
  }
  const parts: PatternPart[] = [];
  if (tiles.left.length > 0) parts.push({ role: "leftCap", tileIds: tiles.left });
  if (tiles.right.length > 0) parts.push({ role: "rightCap", tileIds: tiles.right });
  return {
    axis: "horizontal",
    kind: "horizontal_expandable",
    minHeight: 1,
    minWidth: 2,
    parts,
    preserveCaps: true,
    repeat: "body",
  };
}

function layoutSummary(axis: LayoutAxis, grammar: PatternGrammar): string {
  if (axis === "vertical") {
    return `위 ${roleTiles(grammar, "top")} / 아래 ${roleTiles(grammar, "bottom")} (세로)`;
  }
  return `왼쪽 ${roleTiles(grammar, "leftCap")} / 오른쪽 ${roleTiles(grammar, "rightCap")} (가로)`;
}

function roleTiles(grammar: PatternGrammar, role: PatternGrammar["parts"][number]["role"]): string {
  const tileIds = grammar.parts.find((part) => part.role === role)?.tileIds ?? [];
  return `[${tileIds.join(", ")}]`;
}
