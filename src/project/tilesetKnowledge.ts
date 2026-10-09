import type { PassFlag, TileGroupMetadata, TileGroupSourceBlock } from "@/project/types";

export type TilesetKnowledgeTemplate =
  | "desk"
  | "one-way-path"
  | "repeatable-cliff-2x3"
  | "tree"
  | "water-atlas-9x9"
  | "water-autotile-3x3";
export type TilesetKnowledgeIssue = {
  readonly code: "selection-not-rectangular" | "template-dimension-mismatch";
  readonly message: string;
};
export type TilesetKnowledgeRule = {
  readonly layer: "lower" | "upper";
  readonly passage: PassFlag;
  readonly tileId: number;
};
export type CompiledTilesetKnowledge = {
  readonly group: TileGroupMetadata;
  readonly rules: readonly TilesetKnowledgeRule[];
};
export type TilesetKnowledgeCompileResult =
  | { readonly kind: "invalid"; readonly issues: readonly TilesetKnowledgeIssue[] }
  | { readonly kind: "valid"; readonly value: CompiledTilesetKnowledge };
export type CompileTilesetKnowledgeInput = {
  readonly cellLayers?: readonly ("lower" | "upper")[];
  readonly groupId: string;
  readonly name: string;
  readonly passage: PassFlag;
  readonly template: TilesetKnowledgeTemplate;
  readonly tileCount: number;
  readonly tileIds: readonly number[];
  readonly tilesPerRow: number;
};
export function compileTilesetKnowledge(input: CompileTilesetKnowledgeInput): TilesetKnowledgeCompileResult {
  const geometry = selectionGeometry(input.tileIds, input.tilesPerRow, input.tileCount);
  if (!geometry.rectangular) {
    return { kind: "invalid", issues: [{ code: "selection-not-rectangular", message: "선택에 빈 칸이 있습니다." }] };
  }
  const expected = expectedTemplateSize(input.template);
  if (expected && (geometry.width !== expected.width || geometry.height !== expected.height)) {
    return {
      kind: "invalid",
      issues: [{ code: "template-dimension-mismatch", message: `${expected.width}×${expected.height} 선택이 필요합니다.` }],
    };
  }
  const cellLayers = knowledgeCellLayers(input, geometry.height, geometry.width);
  const group = knowledgeGroup(input, geometry, cellLayers);
  return {
    kind: "valid",
    value: {
      group,
      rules: geometry.tileIds.map((tileId, index) => ({
        layer: cellLayers[index] ?? "lower",
        passage: { ...input.passage },
        tileId,
      })),
    },
  };
}

export function repeatKnowledgeBlock(
  tileIds: readonly number[],
  blockWidth: number,
  blockHeight: number,
  outputWidth: number,
  outputHeight: number
): readonly number[] {
  if (blockWidth <= 0 || blockHeight <= 0 || outputWidth <= 0 || outputHeight <= 0) return [];
  if (tileIds.length !== blockWidth * blockHeight) return [];
  return Array.from({ length: outputHeight }, (_, y) =>
    Array.from({ length: outputWidth }, (_cell, x) => tileIds[(y % blockHeight) * blockWidth + (x % blockWidth)] ?? -1)
  ).flat();
}

type SelectionGeometry = {
  readonly height: number;
  readonly rectangular: boolean;
  readonly tileIds: readonly number[];
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

function selectionGeometry(tileIds: readonly number[], tilesPerRow: number, tileCount: number): SelectionGeometry {
  const valid = [...new Set(tileIds.filter((tile) => Number.isInteger(tile) && tile >= 0 && tile < tileCount))]
    .sort((left, right) => left - right);
  if (valid.length === 0 || tilesPerRow <= 0) return { height: 0, rectangular: false, tileIds: [], width: 0, x: 0, y: 0 };
  const x = Math.min(...valid.map((tile) => tile % tilesPerRow));
  const y = Math.min(...valid.map((tile) => Math.floor(tile / tilesPerRow)));
  const right = Math.max(...valid.map((tile) => tile % tilesPerRow));
  const bottom = Math.max(...valid.map((tile) => Math.floor(tile / tilesPerRow)));
  const width = right - x + 1;
  const height = bottom - y + 1;
  const expected = Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_cell, column) => ((y + row) * tilesPerRow) + x + column)
  ).flat();
  return {
    height,
    rectangular: expected.length === valid.length && expected.every((tile, index) => tile === valid[index]),
    tileIds: valid,
    width,
    x,
    y,
  };
}

function expectedTemplateSize(template: TilesetKnowledgeTemplate): { readonly height: number; readonly width: number } | null {
  switch (template) {
    case "water-autotile-3x3":
    case "one-way-path":
      return { height: 3, width: 3 };
    case "water-atlas-9x9":
      return { height: 9, width: 9 };
    case "repeatable-cliff-2x3":
      return { height: 3, width: 2 };
    case "desk":
    case "tree":
      return null;
  }
}

function knowledgeCellLayers(
  input: CompileTilesetKnowledgeInput,
  height: number,
  width: number
): readonly ("lower" | "upper")[] {
  if (input.cellLayers?.length === input.tileIds.length) return [...input.cellLayers];
  if (input.template === "desk") return input.tileIds.map(() => "upper");
  if (input.template === "tree") {
    return input.tileIds.map((_tile, index) => Math.floor(index / width) === height - 1 ? "lower" : "upper");
  }
  return input.tileIds.map(() => "lower");
}

function knowledgeGroup(
  input: CompileTilesetKnowledgeInput,
  geometry: SelectionGeometry,
  cellLayers: readonly ("lower" | "upper")[]
): TileGroupMetadata {
  const common = {
    cellLayers: [...cellLayers],
    confidence: "high" as const,
    description: "",
    id: input.groupId,
    name: input.name,
    origin: "user" as const,
    placementRules: "",
    source: "user" as const,
    sourceRect: { height: geometry.height, width: geometry.width, x: geometry.x, y: geometry.y },
    tileIds: [...geometry.tileIds],
  };
  switch (input.template) {
    case "water-autotile-3x3":
    case "one-way-path":
      return {
        ...common,
        defaultLayer: "lower",
        layerHome: "lower",
        patternGrammar: {
          axis: "both",
          kind: "autotile_3x3",
          minHeight: 3,
          minWidth: 3,
          parts: nineGridParts(geometry.tileIds),
          preserveCaps: true,
          repeat: "center",
        },
        role: input.template === "water-autotile-3x3" ? "water" : "terrain",
      };
    case "water-atlas-9x9":
      return {
        ...common,
        defaultLayer: "lower",
        layerHome: "lower",
        patternGrammar: sourceRectGrammar(geometry.tileIds),
        role: "water",
        sourceBlocks: waterAtlasBlocks(geometry, input.tilesPerRow),
      };
    case "desk":
      return {
        ...common,
        defaultLayer: "upper",
        layerHome: "upper",
        patternGrammar: sourceRectGrammar(geometry.tileIds),
        role: "prop",
      };
    case "tree":
      return {
        ...common,
        defaultLayer: "mixed",
        layerHome: "perCell",
        patternGrammar: sourceRectGrammar(geometry.tileIds),
        role: "prop",
      };
    case "repeatable-cliff-2x3":
      return {
        ...common,
        defaultLayer: "lower",
        layerHome: "lower",
        patternGrammar: {
          axis: "both",
          blockHeight: 3,
          blockWidth: 2,
          kind: "repeatable_block",
          minHeight: 3,
          minWidth: 2,
          parts: [{ role: "repeatBody", tileIds: [...geometry.tileIds] }],
          preserveCaps: false,
          repeat: "source_order",
        },
        role: "wall",
      };
  }
}

function sourceRectGrammar(tileIds: readonly number[]): NonNullable<TileGroupMetadata["patternGrammar"]> {
  return {
    axis: "both",
    kind: "source_rect",
    parts: [{ role: "repeatBody", tileIds: [...tileIds] }],
    preserveCaps: false,
    repeat: "source_order",
  };
}

function nineGridParts(tileIds: readonly number[]): NonNullable<TileGroupMetadata["patternGrammar"]>["parts"] {
  const roles = ["topLeft", "top", "topRight", "left", "center", "right", "bottomLeft", "bottom", "bottomRight"] as const;
  return roles.map((role, index) => ({ role, tileIds: tileIds[index] === undefined ? [] : [tileIds[index]] }));
}

function waterAtlasBlocks(geometry: SelectionGeometry, tilesPerRow: number): TileGroupSourceBlock[] {
  const blocks: TileGroupSourceBlock[] = [];
  for (let blockRow = 0; blockRow < 3; blockRow += 1) {
    for (let blockColumn = 0; blockColumn < 3; blockColumn += 1) {
      const x = geometry.x + (blockColumn * 3);
      const y = geometry.y + (blockRow * 3);
      blocks.push({
        column: blockColumn,
        row: blockRow,
        sourceRect: { height: 3, width: 3, x, y },
        tileIds: Array.from({ length: 3 }, (_, row) =>
          Array.from({ length: 3 }, (_cell, column) => ((y + row) * tilesPerRow) + x + column)
        ).flat(),
      });
    }
  }
  return blocks;
}
