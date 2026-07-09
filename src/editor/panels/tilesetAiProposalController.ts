import { editorState } from "@/editor/editorState";
import { requestCpenTilesetMapping } from "@/editor/panels/tilesetAiCpenClient";
import { normalizeAiTileMetadata } from "@/editor/panels/tilesetAiMetadataNormalizer";
import { analyzeTilesetSelection } from "@/editor/panels/tilesetAiMappingRules";
import {
  isAiFailureText,
  mergeLockedEdits,
  parseAiMappingResult,
  readLockedEdits,
} from "@/editor/panels/tilesetAiProposalParsing";
import type { TempMapSnapshot } from "@/editor/panels/tilesetAiTerrainExample";
import type { AiSetupChoice } from "@/editor/panels/tilesetAiSetupMapping";
import { resolveTilesetTileContext } from "@/editor/panels/tilesetTileContext";
import { store } from "@/project/store";
import { recordAiAnalysisRun } from "@/project/tileMetadataDb";
import { combinedTownHarnessPrompt } from "@/project/tilesetHarness";
import type { TilesetDef } from "@/project/types";

type TilesetAiProposalControllerOptions = {
  readonly readSnapshot: () => TempMapSnapshot;
  readonly selectedTiles: readonly number[];
  readonly setupChoice: AiSetupChoice;
  readonly tileset: TilesetDef;
};

type TilesetAiAnalysisResult = {
  readonly answer: string;
  readonly failed: boolean;
  readonly invalidJson: boolean;
};

export type TilesetAiProposalController = {
  readonly analyze: (lockedAnswer: string) => Promise<TilesetAiAnalysisResult>;
};

export function createTilesetAiProposalController(options: TilesetAiProposalControllerOptions): TilesetAiProposalController {
  const mapContext = currentMapContext(options.tileset.id, options.selectedTiles);

  return {
    analyze: async (lockedAnswer) => {
      await waitForSnapshot(options.readSnapshot);
      const snapshot = options.readSnapshot();
      const prompt = cpenPrompt(options, mapContext, snapshot.summary, lockedAnswer);
      const result = await requestCpenTilesetMapping({
        imageDataUrl: snapshot.imageDataUrl,
        prompt,
      });
      await recordAiAnalysisRun({
        tilesetId: options.tileset.id,
        selectedTiles: options.selectedTiles,
        promptContext: JSON.parse(prompt),
        result,
      });
      const answer = normalizeAiTileMetadata(mergeLockedEdits(result, lockedAnswer));
      const failed = isAiFailureText(answer);
      return {
        answer,
        failed,
        invalidJson: !failed && parseAiMappingResult(answer) === null,
      };
    },
  };
}

export function buildTilesetAiProposalQuestion(tilesetId: string, tiles: readonly number[]): string {
  const analysis = analyzeTilesetSelection({ selectedTiles: tiles, tilesPerRow: 30 });
  const question = analysis.minimumQuestions[0] ? ` 최소 확인: ${analysis.minimumQuestions[0]}` : "";
  return `${currentMapContext(tilesetId, tiles)} 선택 타일 ${tiles.length}개를 AI가 블록/레이어/배치 규칙으로 매핑합니다.${question}`;
}

async function waitForSnapshot(readSnapshot: () => TempMapSnapshot): Promise<void> {
  for (let count = 0; count < 20; count += 1) {
    const snapshot = readSnapshot();
    if (snapshot.summary && snapshot.imageDataUrl) return;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

function cpenPrompt(
  model: TilesetAiProposalControllerOptions,
  mapContext: string,
  tempMapSummary: string,
  lockedAnswer: string,
): string {
  const selectionAnalysis = analyzeTilesetSelection({
    selectedTiles: model.selectedTiles,
    tilesPerRow: model.tileset.tilesPerRow,
  });
  return JSON.stringify({
    task: "tileset_mapping_json",
    outputContract:
      "Return exactly one valid JSON object. No markdown, prose, code fences, comments, or schema quotes. Include summary, confidence, minimumQuestions, tiles, groups, patternBlocks, and previewMaps as needed. Each tiles entry must include tile, label, description, terrainTag, defaultLayer, role, repeatability, and placementRules. Each previewMap lowerTiles and upperTiles array must contain exactly width*height numbers.",
    rules: [
      "tiles must contain one entry for every selected tile.",
      "For a 3x3 terrain block, individual tile labels must be position-specific. Use 좌상단, 상단, 우상단, 좌측, 중앙, 우측, 좌하단, 하단, 우하단 in source order. Do not repeat the group name as every tile label.",
      "For a 3x3 terrain block in source order, set role/repeatability by position: corners 좌상단/우상단/좌하단/우하단 use role=edge and repeatability=fixed; sides 상단/좌측/우측/하단 use role=edge and repeatability=repeat; center 중앙 uses role=body and repeatability=repeat.",
      "minimumQuestions must contain at most two short Korean questions. If confidence is low, ask before final mapping. If the selection is a 3x3 outer/body terrain block, ask whether it is an auto-connecting bordered terrain.",
      "If selectionAnalysis has patternBlocks, preserve each sourceRect and relative source tile order. Never freely shuffle a source_rect block.",
      "patternBlocks must describe source-preserving blocks before individual tile labels. Use neutral visual names from the selected image and metadata; never infer castle, wall, road, house, or object meaning from tile numbers alone.",
      "If selectionAnalysis.patternBlocks contains patternGrammar, copy that patternGrammar into the matching patternBlock and group. Valid terrain grammar kinds include animated_terrain, autotile_3x3, horizontal_expandable, vertical_expandable, and nine_slice_expandable.",
      "patternGrammar.parts must explain which tiles are caps, repeated body, corners, edges, and center. Do not hide this inside prose.",
      "previewMaps may be omitted when patternGrammar is enough. If you include previewMaps, use one compact complete 8x8-12x12 example using tile ids, not prose. lowerTiles and upperTiles must each contain exactly width*height numbers and must not be truncated.",
      "label must be short Korean text, 18 characters or less. group.name may be generic, but tiles[].label must distinguish the tile's exact position or purpose.",
      "description must be Korean and must not include JSON, markdown, or chatty follow-up text.",
      "placementRules must be concise Korean rules for editor metadata.",
      "terrainTag must be a number. Prefer the provided terrainTag unless the map example proves otherwise.",
      "defaultLayer must be lower, upper, event, or mixed.",
      "role must be one of body, edge, detail, object, variant, single.",
      "repeatability must be one of auto, fixed, repeat, or center. Use fixed for non-repeatable caps/corners, repeat for stretchable side/body tiles, center only when only the center tile may repeat.",
      "metadataSource=unknown means there is no trusted semantic knowledge. For unknown tilesets, rely on tile images, user setup, and userQuestionAnswers instead of tile numbers.",
      "If lockedUserEdits contains tiles with userLocked true, preserve those labels, roles, layers, repeatability, and placementRules unless they conflict with the selected tile ids.",
      "Use userQuestionAnswers as direct human answers to your prior questions. Answers may be free-form Korean text, not only yes/no/unknown; treat a specific free-form answer as stronger than a quick select answer.",
      "If userQuestionAnswers mentions 물, 수면, 강, 오토타일, 자동 연결, 자유롭게 칠하기, or 주변 타일과 이어짐, treat the selected tiles as auto-connecting water terrain unless the image clearly contradicts it.",
      "For auto-connecting water terrain, prefer defaultLayer=lower and placementRules that say free painting should choose edge/center variants so adjacent water tiles merge visually. Use patternGrammar kind autotile_3x3 for a bordered block or animated_terrain when frames/animation are evident.",
      "Do not ask the user to write JSON.",
    ],
    selectionAnalysis,
    userSetup: {
      intent: setupIntentText(model.setupChoice.intent),
      repeatability: setupRepeatabilityText(model.setupChoice.repeatability),
      structure: setupStructureText(model.setupChoice.structure),
      scope: setupScopeText(model.setupChoice.scope),
    },
    tilesetHarness: combinedTownHarnessPrompt(model.tileset),
    mapContext,
    knownGroups: model.tileset.tileGroups
      ?.filter((group) => group.tileIds.some((tile) => model.selectedTiles.includes(tile)))
      .map((group) => ({
        name: group.name,
        role: group.role,
        defaultLayer: group.defaultLayer,
        tileIds: group.tileIds,
        placementRules: group.placementRules,
        source: group.source ?? "user",
      })) ?? [],
    selectedTiles: model.selectedTiles.map((tile) => {
      const description = resolveTilesetTileContext(model.tileset, tile);
      return {
        tile,
        currentLabel: description.currentLabel,
        currentAiLabel: description.currentAiLabel,
        layer: description.layer,
        repeatRole: description.repeatRole,
        terrainTag: description.terrainTag,
        tags: description.tags,
        metadataSource: description.metadataSource,
        userLocked: description.userLocked,
      };
    }),
    lockedUserEdits: readLockedEdits(lockedAnswer),
    tempMap: tempMapSummary,
  });
}

function setupIntentText(intent: AiSetupChoice["intent"]): string {
  if (intent === "autoTerrain") return "자동 연결 지형";
  if (intent === "pathAutotile") return "길 오토타일";
  if (intent === "waterAutotile") return "물 오토타일";
  if (intent === "buildingHouse") return "집/건물";
  if (intent === "linearPath") return "길/강/울타리";
  if (intent === "wallCliff") return "벽/절벽";
  if (intent === "objectDetail") return "장식/소품";
  return "모르겠음";
}

function setupRepeatabilityText(repeatability: AiSetupChoice["repeatability"]): string {
  if (repeatability === "edgesAndCenter") return "모서리는 고정, 변과 중앙은 반복 가능";
  if (repeatability === "centerOnly") return "중앙만 반복 가능";
  if (repeatability === "noRepeat") return "반복 배치하지 않음";
  if (repeatability === "allRepeat") return "모든 타일을 반복 후보로 검토";
  return "AI가 반복 가능성을 판단";
}

function setupStructureText(structure: AiSetupChoice["structure"]): string {
  if (structure === "single") return "단일 칩";
  if (structure === "threeByThree") return "3x3 지형";
  if (structure === "horizontal") return "가로 반복";
  if (structure === "vertical") return "세로 반복";
  if (structure === "nineSlice") return "모서리+중앙";
  if (structure === "animation") return "애니메이션";
  return "혼합";
}

function setupScopeText(scope: AiSetupChoice["scope"]): string {
  if (scope === "labels") return "이름/설명만";
  if (scope === "rules") return "묶음+배치 규칙";
  if (scope === "preview") return "예시 맵 포함";
  return "지형 번호 추천";
}

function currentMapContext(tilesetId: string, tiles: readonly number[]): string {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  if (!map) return "현재 맵 없음.";
  const lowerCount = countTileUses(map.lowerTiles, tiles);
  const upperCount = countTileUses(map.upperTiles, tiles);
  const tilesetMatch = map.tilesetId === tilesetId ? "현재 타일셋" : `맵 타일셋 ${map.tilesetId}`;
  return `${map.name} ${map.width}x${map.height}, ${tilesetMatch}, 맵 사용량 하위 ${lowerCount} / 상위 ${upperCount}.`;
}

function countTileUses(layerTiles: readonly number[], tiles: readonly number[]): number {
  const selected = new Set(tiles);
  return layerTiles.reduce((count, tile) => count + (selected.has(tile) ? 1 : 0), 0);
}
