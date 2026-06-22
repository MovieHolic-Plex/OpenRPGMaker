import type {
  TilesetAiConfidence,
  TilesetAiPatternGrammar,
  TilesetAiPatternGrammarKind,
  TilesetAiPatternPartRole,
  TilesetAiSourceRect,
} from "@/editor/panels/tilesetAiMappingRules";
import { analyzeTilesetSelection } from "@/editor/panels/tilesetAiMappingRules";
import { resolveTilesetTileContext } from "@/editor/panels/tilesetTileContext";
import type { TileGroupLayer, TileGroupRole, TilesetDef } from "@/project/types";

export type AiSetupIntent =
  | "autoTerrain"
  | "buildingHouse"
  | "linearPath"
  | "objectDetail"
  | "pathAutotile"
  | "unsure"
  | "wallCliff"
  | "waterAutotile";

export type AiSetupRepeatability = "allRepeat" | "auto" | "centerOnly" | "edgesAndCenter" | "noRepeat";
export type AiSetupScope = "labels" | "preview" | "rules" | "terrainTags";
export type AiSetupStructure = "animation" | "horizontal" | "mixed" | "nineSlice" | "single" | "threeByThree" | "vertical";

export type AiSetupChoice = {
  intent: AiSetupIntent;
  repeatability: AiSetupRepeatability;
  scope: AiSetupScope;
  structure: AiSetupStructure;
};

type SetupMappingTile = {
  readonly defaultLayer: TileGroupLayer;
  readonly description: string;
  readonly label: string;
  readonly placementRules: string;
  readonly repeatability: "auto" | "center" | "fixed" | "repeat";
  readonly role: "body" | "edge" | "single" | "variant";
  readonly terrainTag: number;
  readonly tile: number;
};

const NINE_SLICE_ROLES = [
  "topLeft",
  "top",
  "topRight",
  "left",
  "center",
  "right",
  "bottomLeft",
  "bottom",
  "bottomRight",
] as const satisfies readonly TilesetAiPatternPartRole[];

const NINE_SLICE_LABELS = ["좌상", "상단", "우상", "좌측", "중앙", "우측", "좌하", "하단", "우하"] as const;
const UNKNOWN_TILE_LABEL_PATTERN = /^Tile \d+$/;
const TILE_LABEL_ALIASES = new Map([
  ["Grass", "풀"],
  ["House door", "집 문"],
  ["House facade", "집 정면"],
  ["House purple stone wall", "보라 석재 집벽"],
  ["House roof", "집 지붕"],
  ["House white wall body", "흰 집벽"],
  ["House white wall lower", "흰 집벽"],
  ["House white wall upper", "흰 집벽"],
  ["House wood wall body", "나무 집벽"],
  ["House wood wall lower", "나무 집벽"],
  ["House wood wall upper", "나무 집벽"],
  ["Path", "길"],
  ["Roof", "지붕"],
  ["Water", "물"],
]);

export function buildSetupMappingAnswer(tileset: TilesetDef, selectedTiles: readonly number[], setup: AiSetupChoice): string {
  const tiles = selectedTiles.filter((tile) => Number.isInteger(tile) && tile >= 0 && tile < tileset.count);
  const analysis = analyzeTilesetSelection({ selectedTiles: tiles, tilesPerRow: tileset.tilesPerRow });
  const firstBlock = analysis.patternBlocks[0];
  const labelBase = inferTileLabelBase(tileset, tiles, setup);
  const label = groupLabel(setup, labelBase);
  const defaultLayer: TileGroupLayer = setup.intent === "objectDetail" || setup.intent === "buildingHouse" ? "upper" : "lower";
  const role: TileGroupRole = setup.intent === "waterAutotile"
    ? "water"
    : setup.intent === "wallCliff"
      ? "wall"
      : setup.intent === "buildingHouse"
        ? "building"
        : "terrain";
  const patternGrammar = setupPatternGrammar(setup, tiles);
  const sourceRect = firstBlock?.sourceRect ?? sourceRectForTiles(tiles, tileset.tilesPerRow);
  const mappingTiles = tiles.map((tile, index) => setupTileMapping(tileset, tile, index, setup, defaultLayer, labelBase));
  return JSON.stringify({
    summary: `${label}로 사용자가 확인한 타일셋 메타 초안입니다.`,
    confidence: "high" satisfies TilesetAiConfidence,
    minimumQuestions: [],
    tiles: mappingTiles,
    groups: [{
      defaultLayer,
      description: groupDescription(setup),
      name: label,
      patternGrammar,
      placementRules: groupPlacementRules(setup),
      previewMap: null,
      role,
      sourceRect,
      tileIds: tiles,
    }],
    patternBlocks: sourceRect
      ? [{
          confidence: "high" satisfies TilesetAiConfidence,
          defaultLayer,
          kind: patternGrammar.kind,
          label,
          patternGrammar,
          placementRules: groupPlacementRules(setup),
          sourceRect,
          tileIds: tiles,
        }]
      : [],
    previewMaps: [],
  });
}

function setupTileMapping(
  tileset: TilesetDef,
  tile: number,
  index: number,
  setup: AiSetupChoice,
  defaultLayer: TileGroupLayer,
  labelBase: string,
): SetupMappingTile {
  const context = resolveTilesetTileContext(tileset, tile);
  const position = NINE_SLICE_LABELS[index] ?? `${index + 1}`;
  const isCenter = position === "중앙";
  const isNineSlice = setup.structure === "threeByThree" && index < NINE_SLICE_LABELS.length;
  const label = isNineSlice ? `${labelBase} ${position}` : `${labelBase} ${index + 1}`;
  return {
    defaultLayer,
    description: tileDescription(setup, label),
    label,
    placementRules: tilePlacementRules(setup, isCenter),
    repeatability: isNineSlice ? (isCenter || !position.includes("상") && !position.includes("하") && !position.includes("좌") && !position.includes("우") ? "repeat" : repeatabilityForPosition(position)) : repeatabilityForSetup(setup),
    role: isNineSlice ? (isCenter ? "body" : "edge") : "single",
    terrainTag: context.terrainTag,
    tile,
  };
}

function setupPatternGrammar(setup: AiSetupChoice, tiles: readonly number[]): TilesetAiPatternGrammar {
  const kind = setupGrammarKind(setup);
  if (setup.structure === "threeByThree" && tiles.length >= 9) {
    return {
      axis: "both",
      kind,
      minHeight: 3,
      minWidth: 3,
      parts: NINE_SLICE_ROLES.map((role, index) => ({ role, tileIds: [tiles[index] ?? -1] })),
      preserveCaps: true,
      repeat: setup.intent === "waterAutotile" || setup.intent === "pathAutotile" ? "center" : "body",
    };
  }
  return {
    axis: setup.structure === "vertical" ? "vertical" : setup.structure === "horizontal" ? "horizontal" : "both",
    kind,
    parts: [{ role: "repeatBody", tileIds: tiles }],
    preserveCaps: setup.repeatability !== "allRepeat",
    repeat: setup.repeatability === "centerOnly" ? "center" : "body",
  };
}

function setupGrammarKind(setup: AiSetupChoice): TilesetAiPatternGrammarKind {
  if (setup.intent === "waterAutotile" && setup.structure === "animation") return "animated_terrain";
  if (setup.intent === "waterAutotile" || setup.intent === "pathAutotile") return "autotile_3x3";
  if (setup.structure === "horizontal") return "horizontal_expandable";
  if (setup.structure === "vertical") return "vertical_expandable";
  if (setup.structure === "threeByThree" || setup.structure === "nineSlice") return "nine_slice_expandable";
  return "source_rect";
}

function sourceRectForTiles(tiles: readonly number[], tilesPerRow: number): TilesetAiSourceRect | null {
  if (tiles.length === 0) return null;
  const columns = tiles.map((tile) => tile % tilesPerRow);
  const rows = tiles.map((tile) => Math.floor(tile / tilesPerRow));
  const x = Math.min(...columns);
  const y = Math.min(...rows);
  return { x, y, width: Math.max(...columns) - x + 1, height: Math.max(...rows) - y + 1 };
}

function groupLabel(setup: AiSetupChoice, labelBase: string): string {
  if (setup.intent === "buildingHouse") return labelBase === "집" ? "집/건물 묶음" : `${labelBase} 묶음`;
  if (setup.intent === "waterAutotile") return "물 오토타일";
  if (setup.intent === "pathAutotile") return "길 오토타일";
  if (setup.intent === "wallCliff") return "벽/절벽 묶음";
  if (setup.intent === "objectDetail") return "장식 타일 묶음";
  return labelBase === "지형" ? "자동 연결 지형" : `${labelBase} 오토타일`;
}

function tileLabelBase(setup: AiSetupChoice, inferredBase: string): string {
  if (setup.intent === "buildingHouse") return inferredBase === "지형" ? "집" : inferredBase;
  if (setup.intent === "waterAutotile") return "물";
  if (setup.intent === "pathAutotile") return "길";
  if (setup.intent === "wallCliff") return "벽";
  if (setup.intent === "objectDetail") return "장식";
  return inferredBase;
}

function inferTileLabelBase(tileset: TilesetDef, tiles: readonly number[], setup: AiSetupChoice): string {
  const fallbackBase = "지형";
  if (setup.intent !== "autoTerrain" && setup.intent !== "buildingHouse" && setup.intent !== "unsure") return tileLabelBase(setup, fallbackBase);
  const counts = new Map<string, number>();
  for (const tile of tiles) {
    const base = normalizeTileLabel(resolveTilesetTileContext(tileset, tile).currentLabel);
    if (base === null) continue;
    const displayBase = TILE_LABEL_ALIASES.get(base) ?? base;
    counts.set(displayBase, (counts.get(displayBase) ?? 0) + 1);
  }
  let bestBase = fallbackBase;
  let bestCount = 0;
  for (const [base, count] of counts) {
    if (count > bestCount) {
      bestBase = base;
      bestCount = count;
    }
  }
  return bestBase;
}

function normalizeTileLabel(label: string): string | null {
  const trimmed = label.trim();
  if (trimmed.length === 0 || UNKNOWN_TILE_LABEL_PATTERN.test(trimmed)) return null;
  for (const suffix of NINE_SLICE_LABELS) {
    const suffixWithSpace = ` ${suffix}`;
    if (trimmed.endsWith(suffixWithSpace)) return trimmed.slice(0, -suffixWithSpace.length).trim();
  }
  return trimmed;
}

function groupDescription(setup: AiSetupChoice): string {
  if (setup.intent === "buildingHouse") return "상위 레이어에서 집 외관을 조립하는 건물 타일 묶음입니다.";
  if (setup.intent === "waterAutotile") return "하위 레이어에서 자유롭게 칠하면 가장자리와 중앙이 자동으로 이어지는 물 지형입니다.";
  if (setup.intent === "pathAutotile") return "하위 레이어에서 자유롭게 칠하면 모서리, 변, 중앙이 자동으로 이어지는 길 지형입니다.";
  return "사용자 선택을 기준으로 만든 타일셋 메타 묶음입니다.";
}

function groupPlacementRules(setup: AiSetupChoice): string {
  if (setup.intent === "buildingHouse") return "집 외관의 원본 상대 위치를 유지하고 변/중앙 반복 후보만 확장합니다.";
  if (setup.intent === "waterAutotile") return "물 브러시로 자유롭게 칠하면 주변 물 타일과 연결되도록 가장자리/중앙 변형을 선택합니다.";
  if (setup.intent === "pathAutotile") return "길 브러시로 자유롭게 칠하면 주변 길 타일과 연결되도록 모서리/변/중앙 변형을 선택합니다.";
  return "원본 블록의 상대 위치와 반복 가능성을 유지합니다.";
}

function tileDescription(setup: AiSetupChoice, label: string): string {
  return `${label} 타일입니다. ${groupDescription(setup)}`;
}

function tilePlacementRules(setup: AiSetupChoice, isCenter: boolean): string {
  if (setup.intent === "waterAutotile") return isCenter ? "연결된 물 내부에서 반복합니다." : "물 경계와 모서리에 사용합니다.";
  if (setup.intent === "pathAutotile") return isCenter ? "연결된 길 내부에서 반복합니다." : "길 경계와 모서리에 사용합니다.";
  return isCenter ? "중앙 반복 후보입니다." : "원본 위치를 보존합니다.";
}

function repeatabilityForPosition(position: string): "fixed" | "repeat" {
  return position === "상단" || position === "하단" || position === "좌측" || position === "우측" ? "repeat" : "fixed";
}

function repeatabilityForSetup(setup: AiSetupChoice): "auto" | "fixed" | "repeat" {
  if (setup.repeatability === "allRepeat") return "repeat";
  if (setup.repeatability === "noRepeat") return "fixed";
  return "auto";
}
