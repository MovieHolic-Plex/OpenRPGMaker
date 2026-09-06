export type TilesetAiConfidence = "high" | "low" | "medium";

export type TilesetAiSourceRect = {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

export type TilesetAiPatternGrammarKind =
  | "animated_terrain"
  | "autotile_3x3"
  | "event_required_object"
  | "horizontal_expandable"
  | "nine_slice_expandable"
  | "overlay_detail"
  | "single"
  | "source_rect"
  | "vertical_expandable";

export type TilesetAiPatternPartRole =
  | "bottom"
  | "bottomCap"
  | "bottomLeft"
  | "bottomRight"
  | "center"
  | "left"
  | "leftCap"
  | "repeatBody"
  | "right"
  | "rightCap"
  | "top"
  | "topCap"
  | "topLeft"
  | "topRight";

export type TilesetAiPatternPart = {
  readonly role: TilesetAiPatternPartRole;
  readonly tileIds: readonly number[];
};

export type TilesetAiPatternGrammar = {
  readonly axis?: "both" | "horizontal" | "vertical";
  readonly kind: TilesetAiPatternGrammarKind;
  readonly minHeight?: number;
  readonly minWidth?: number;
  readonly parts: readonly TilesetAiPatternPart[];
  readonly preserveCaps: boolean;
  readonly repeat: "body" | "center" | "source_order";
};

export type TilesetAiPatternBlock = {
  readonly confidence: TilesetAiConfidence;
  readonly kind: TilesetAiPatternGrammarKind;
  readonly label: string;
  readonly patternGrammar?: TilesetAiPatternGrammar;
  readonly sourceRect: TilesetAiSourceRect;
  readonly tileIds: readonly number[];
};

export type TilesetAiPreviewMap = {
  readonly height: number;
  readonly lowerTiles: readonly number[];
  readonly name: string;
  readonly upperTiles: readonly number[];
  readonly width: number;
};

export type TilesetSelectionAnalysisInput = {
  readonly selectedTiles: readonly number[];
  readonly tilesPerRow: number;
};

export type TilesetSelectionAnalysis = {
  readonly confidence: TilesetAiConfidence;
  readonly minimumQuestions: readonly string[];
  readonly patternBlocks: readonly TilesetAiPatternBlock[];
  readonly previewMaps: readonly TilesetAiPreviewMap[];
  readonly regions: readonly TilesetAiSourceRect[];
};

const PREVIEW_SIZE = 16;
const PREVIEW_BASE_TILE = 240;
const EMPTY_TILE = -1;

export function analyzeTilesetSelection(input: TilesetSelectionAnalysisInput): TilesetSelectionAnalysis {
  const tiles = sortedUniqueTiles(input.selectedTiles);
  const regions = contiguousSourceRects(tiles, input.tilesPerRow);
  const patternBlocks = regions.flatMap((rect) => patternBlockForRect(rect, tiles, input.tilesPerRow));
  const confidence = selectionConfidence(tiles, regions, patternBlocks);
  const minimumQuestions = minimumQuestionsForSelection(tiles, regions, patternBlocks, confidence);
  return {
    confidence,
    minimumQuestions,
    patternBlocks,
    previewMaps: previewMapsForBlocks(patternBlocks),
    regions,
  };
}

function sortedUniqueTiles(tiles: readonly number[]): readonly number[] {
  return [...new Set(tiles.filter((tile) => Number.isInteger(tile) && tile >= 0))].sort((a, b) => a - b);
}

function contiguousSourceRects(tiles: readonly number[], tilesPerRow: number): readonly TilesetAiSourceRect[] {
  const selected = new Set(tiles);
  const seen = new Set<number>();
  const rects: TilesetAiSourceRect[] = [];
  for (const tile of tiles) {
    if (seen.has(tile)) continue;
    const queue = [tile];
    const component: number[] = [];
    seen.add(tile);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      component.push(current);
      for (const neighbor of sourceNeighbors(current, tilesPerRow)) {
        if (!selected.has(neighbor) || seen.has(neighbor)) continue;
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
    rects.push(rectForTiles(component, tilesPerRow));
  }
  return rects.sort((a, b) => a.y - b.y || a.x - b.x);
}

function sourceNeighbors(tile: number, tilesPerRow: number): readonly number[] {
  const column = tile % tilesPerRow;
  const neighbors = [tile - tilesPerRow, tile + tilesPerRow];
  if (column > 0) neighbors.push(tile - 1);
  if (column < tilesPerRow - 1) neighbors.push(tile + 1);
  return neighbors;
}

function rectForTiles(tiles: readonly number[], tilesPerRow: number): TilesetAiSourceRect {
  const columns = tiles.map((tile) => tile % tilesPerRow);
  const rows = tiles.map((tile) => Math.floor(tile / tilesPerRow));
  const left = Math.min(...columns);
  const top = Math.min(...rows);
  const right = Math.max(...columns);
  const bottom = Math.max(...rows);
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

function patternBlockForRect(
  rect: TilesetAiSourceRect,
  selectedTiles: readonly number[],
  tilesPerRow: number,
): readonly TilesetAiPatternBlock[] {
  const tileIds = tilesInRect(rect, tilesPerRow).filter((tile) => selectedTiles.includes(tile));
  if (tileIds.length !== rect.width * rect.height) return [];
  if (rect.width === 6 && rect.height === 4) {
    return [{
      confidence: "high",
      kind: "source_rect",
      label: castleLikeRect(rect) ? "성벽 상단 블록" : "6x4 원본 블록",
      sourceRect: rect,
      tileIds,
    }];
  }
  if (rect.width === 3 && rect.height === 3) {
    return [{
      confidence: "medium",
      kind: "autotile_3x3",
      label: "9칸 확장 지형",
      patternGrammar: nineSliceGrammar(tileIds),
      sourceRect: rect,
      tileIds,
    }];
  }
  if (rect.width >= 3 && rect.height === 1) {
    return [{
      confidence: "medium",
      kind: "horizontal_expandable",
      label: `${rect.width}칸 가로 확장 지형`,
      patternGrammar: horizontalGrammar(tileIds),
      sourceRect: rect,
      tileIds,
    }];
  }
  if (rect.width === 1 && rect.height >= 3) {
    return [{
      confidence: "medium",
      kind: "vertical_expandable",
      label: `${rect.height}칸 세로 확장 지형`,
      patternGrammar: verticalGrammar(tileIds),
      sourceRect: rect,
      tileIds,
    }];
  }
  if (rect.width >= 2 && rect.height >= 2 && tileIds.length >= 6) {
    return [{
      confidence: "medium",
      kind: "source_rect",
      label: `${rect.width}x${rect.height} 원본 블록`,
      sourceRect: rect,
      tileIds,
    }];
  }
  if (rect.width === 1 && rect.height >= 2 && tileIds.length >= 2) {
    return [{
      confidence: "medium",
      kind: "source_rect",
      label: `${rect.height}칸 세로 원본 블록`,
      sourceRect: rect,
      tileIds,
    }];
  }
  return [];
}

function horizontalGrammar(tileIds: readonly number[]): TilesetAiPatternGrammar {
  return {
    axis: "horizontal",
    kind: "horizontal_expandable",
    minWidth: 3,
    parts: [
      { role: "leftCap", tileIds: [tileIds[0] ?? EMPTY_TILE] },
      { role: "repeatBody", tileIds: tileIds.slice(1, -1) },
      { role: "rightCap", tileIds: [tileIds[tileIds.length - 1] ?? EMPTY_TILE] },
    ],
    preserveCaps: true,
    repeat: "body",
  };
}

function verticalGrammar(tileIds: readonly number[]): TilesetAiPatternGrammar {
  return {
    axis: "vertical",
    kind: "vertical_expandable",
    minHeight: 3,
    parts: [
      { role: "topCap", tileIds: [tileIds[0] ?? EMPTY_TILE] },
      { role: "repeatBody", tileIds: tileIds.slice(1, -1) },
      { role: "bottomCap", tileIds: [tileIds[tileIds.length - 1] ?? EMPTY_TILE] },
    ],
    preserveCaps: true,
    repeat: "body",
  };
}

function nineSliceGrammar(tileIds: readonly number[]): TilesetAiPatternGrammar {
  const roles: readonly TilesetAiPatternPartRole[] = [
    "topLeft",
    "top",
    "topRight",
    "left",
    "center",
    "right",
    "bottomLeft",
    "bottom",
    "bottomRight",
  ];
  return {
    axis: "both",
    kind: "nine_slice_expandable",
    minHeight: 3,
    minWidth: 3,
    parts: roles.map((role, index) => ({ role, tileIds: [tileIds[index] ?? EMPTY_TILE] })),
    preserveCaps: true,
    repeat: "center",
  };
}

function castleLikeRect(rect: TilesetAiSourceRect): boolean {
  return rect.x === 6 && rect.y === 8 && rect.width === 6 && rect.height === 4;
}

function tilesInRect(rect: TilesetAiSourceRect, tilesPerRow: number): readonly number[] {
  const tiles: number[] = [];
  for (let y = 0; y < rect.height; y += 1) {
    for (let x = 0; x < rect.width; x += 1) {
      tiles.push((rect.y + y) * tilesPerRow + rect.x + x);
    }
  }
  return tiles;
}

function selectionConfidence(
  selectedTiles: readonly number[],
  regions: readonly TilesetAiSourceRect[],
  patternBlocks: readonly TilesetAiPatternBlock[],
): TilesetAiConfidence {
  if (patternBlocks.some((block) => block.confidence === "high")) return "high";
  if (patternBlocks.length > 0) return "medium";
  if (selectedTiles.length < 3 || regions.length > 2) return "low";
  return "medium";
}

function minimumQuestionsForSelection(
  selectedTiles: readonly number[],
  regions: readonly TilesetAiSourceRect[],
  patternBlocks: readonly TilesetAiPatternBlock[],
  confidence: TilesetAiConfidence,
): readonly string[] {
  const questions: string[] = [];
  if (patternBlocks.some((block) => block.patternGrammar?.kind === "nine_slice_expandable" || block.kind === "autotile_3x3")) {
    questions.push("이 9칸은 외곽/모서리/중앙이 있는 자동 연결 지형인가요?");
  }
  if (patternBlocks.some((block) => block.patternGrammar?.kind === "horizontal_expandable")) {
    questions.push("양끝을 보존하고 가운데를 반복하는 가로 확장 지형인가요?");
  }
  if (patternBlocks.some((block) => block.patternGrammar?.kind === "vertical_expandable")) {
    questions.push("위/아래 끝을 보존하고 가운데를 반복하는 세로 확장 지형인가요?");
  }
  if (patternBlocks.some((block) => block.kind === "source_rect" && block.sourceRect.width >= 4)) {
    questions.push("이 묶음은 원본 배열을 유지해서 찍어야 하는 구조물 블록인가요?");
  }
  if (confidence === "low") {
    questions.push("선택한 타일은 지형, 경계, 건물, 소품 중 어디에 가깝나요?");
  }
  if (questions.length === 0 && selectedTiles.length >= 6 && regions.length === 1) {
    questions.push("선택한 타일은 반복 가능한 블록인가요, 아니면 개별 장식 타일인가요?");
  }
  return questions.slice(0, 2);
}

function previewMapsForBlocks(patternBlocks: readonly TilesetAiPatternBlock[]): readonly TilesetAiPreviewMap[] {
  return patternBlocks.slice(0, 3).map((block) => previewMapForBlock(block));
}

function previewMapForBlock(block: TilesetAiPatternBlock): TilesetAiPreviewMap {
  const lowerTiles = Array.from({ length: PREVIEW_SIZE * PREVIEW_SIZE }, () => PREVIEW_BASE_TILE);
  const upperTiles = Array.from({ length: PREVIEW_SIZE * PREVIEW_SIZE }, () => EMPTY_TILE);
  if (block.patternGrammar?.kind === "horizontal_expandable") {
    stampHorizontalExpandable(lowerTiles, block.patternGrammar);
  } else if (block.patternGrammar?.kind === "vertical_expandable") {
    stampVerticalExpandable(lowerTiles, block.patternGrammar);
  } else if (block.patternGrammar?.kind === "nine_slice_expandable") {
    stampNineSliceExpandable(lowerTiles, block.patternGrammar);
  } else {
    stampSourceRect(lowerTiles, block);
  }
  return {
    height: PREVIEW_SIZE,
    lowerTiles,
    name: `${block.label} 16x16 예시`,
    upperTiles,
    width: PREVIEW_SIZE,
  };
}

function stampSourceRect(lowerTiles: number[], block: TilesetAiPatternBlock): void {
  const repeatX = block.sourceRect.width <= 6 ? 2 : 1;
  const repeatY = block.sourceRect.height <= 4 ? 2 : 1;
  const originX = Math.max(0, Math.floor((PREVIEW_SIZE - block.sourceRect.width * repeatX) / 2));
  const originY = Math.max(0, Math.floor((PREVIEW_SIZE - block.sourceRect.height * repeatY) / 2));
  for (let ry = 0; ry < repeatY; ry += 1) {
    for (let rx = 0; rx < repeatX; rx += 1) {
      for (let y = 0; y < block.sourceRect.height; y += 1) {
        for (let x = 0; x < block.sourceRect.width; x += 1) {
          const sourceIndex = y * block.sourceRect.width + x;
          const tile = block.tileIds[sourceIndex] ?? EMPTY_TILE;
          const targetX = originX + rx * block.sourceRect.width + x;
          const targetY = originY + ry * block.sourceRect.height + y;
          lowerTiles[targetY * PREVIEW_SIZE + targetX] = tile;
        }
      }
    }
  }
}

function tileForPart(grammar: TilesetAiPatternGrammar, role: TilesetAiPatternPartRole, fallback = EMPTY_TILE): number {
  return grammar.parts.find((part) => part.role === role)?.tileIds[0] ?? fallback;
}

function repeatBodyTiles(grammar: TilesetAiPatternGrammar): readonly number[] {
  const body = grammar.parts.find((part) => part.role === "repeatBody")?.tileIds ?? [];
  return body.length > 0 ? body : [EMPTY_TILE];
}

function stampHorizontalExpandable(lowerTiles: number[], grammar: TilesetAiPatternGrammar): void {
  const y = Math.floor(PREVIEW_SIZE / 2);
  const startX = 2;
  const width = PREVIEW_SIZE - 4;
  const body = repeatBodyTiles(grammar);
  lowerTiles[y * PREVIEW_SIZE + startX] = tileForPart(grammar, "leftCap");
  for (let x = 1; x < width - 1; x += 1) {
    lowerTiles[y * PREVIEW_SIZE + startX + x] = body[(x - 1) % body.length] ?? EMPTY_TILE;
  }
  lowerTiles[y * PREVIEW_SIZE + startX + width - 1] = tileForPart(grammar, "rightCap");
}

function stampVerticalExpandable(lowerTiles: number[], grammar: TilesetAiPatternGrammar): void {
  const x = Math.floor(PREVIEW_SIZE / 2);
  const startY = 2;
  const height = PREVIEW_SIZE - 4;
  const body = repeatBodyTiles(grammar);
  lowerTiles[startY * PREVIEW_SIZE + x] = tileForPart(grammar, "topCap");
  for (let y = 1; y < height - 1; y += 1) {
    lowerTiles[(startY + y) * PREVIEW_SIZE + x] = body[(y - 1) % body.length] ?? EMPTY_TILE;
  }
  lowerTiles[(startY + height - 1) * PREVIEW_SIZE + x] = tileForPart(grammar, "bottomCap");
}

function stampNineSliceExpandable(lowerTiles: number[], grammar: TilesetAiPatternGrammar): void {
  const startX = 4;
  const startY = 4;
  const width = 8;
  const height = 7;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      lowerTiles[(startY + y) * PREVIEW_SIZE + startX + x] = nineSliceTile(grammar, x, y, width, height);
    }
  }
}

function nineSliceTile(
  grammar: TilesetAiPatternGrammar,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  if (x === 0 && y === 0) return tileForPart(grammar, "topLeft");
  if (x === width - 1 && y === 0) return tileForPart(grammar, "topRight");
  if (x === 0 && y === height - 1) return tileForPart(grammar, "bottomLeft");
  if (x === width - 1 && y === height - 1) return tileForPart(grammar, "bottomRight");
  if (y === 0) return tileForPart(grammar, "top");
  if (y === height - 1) return tileForPart(grammar, "bottom");
  if (x === 0) return tileForPart(grammar, "left");
  if (x === width - 1) return tileForPart(grammar, "right");
  return tileForPart(grammar, "center");
}
