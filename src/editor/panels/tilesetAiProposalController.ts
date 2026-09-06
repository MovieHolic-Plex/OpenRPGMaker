import { buildTilesetProposalPrompt, normalizeTilesetProposal, tilesetProposalMapContext } from "@/editor/tilesetAiProposalDraft";
import { editorState } from "@/editor/editorState";
import { requestCpenTilesetMapping } from "@/editor/panels/tilesetAiCpenClient";
import { analyzeTilesetSelection } from "@/editor/panels/tilesetAiMappingRules";
import type { TempMapSnapshot } from "@/editor/panels/tilesetAiTerrainExample";
import type { AiSetupChoice } from "@/editor/panels/tilesetAiSetupMapping";
import { store } from "@/project/store";
import { recordAiAnalysisRun } from "@/project/tileMetadataDb";
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
      const prompt = buildTilesetProposalPrompt(options, mapContext, snapshot.summary, lockedAnswer);
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
      return normalizeTilesetProposal(result, lockedAnswer);
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

function currentMapContext(tilesetId: string, tiles: readonly number[]): string {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  return tilesetProposalMapContext(map, tilesetId, tiles);
}
