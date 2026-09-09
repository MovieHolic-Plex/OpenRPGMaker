import { tilesetProposalMapContext } from "@/editor/tilesetAiProposalDraft";
import { editorState } from "@/editor/editorState";
import { submitTilesetJob } from "@/editor/aiJobs/submitTilesetJob";
import { JobSubmitError } from "@/editor/aiJobs/jobSubmitError";
import { readJobResult, whenJobGeneration } from "@/editor/aiJobs/jobViewBinding";
import { parseAiMappingResult } from "@/editor/panels/tilesetAiProposalParsing";
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
  return {
    analyze: async (lockedAnswer) => {
      const snapshot = options.readSnapshot();
      if (!snapshot.summary || !snapshot.imageDataUrl) {
        throw new JobSubmitError("not-ready", "스냅샷이 아직 준비되지 않았습니다.");
      }
      const receipt = await submitTilesetJob({
        operation: "proposal-draft",
        tilesetId: options.tileset.id,
        selectedTiles: options.selectedTiles,
        setupChoice: options.setupChoice,
        snapshotSummary: snapshot.summary,
        snapshotDataUrl: snapshot.imageDataUrl,
        lockedAnswer,
      }, { owner: options });
      const job = await whenJobGeneration(receipt.job.id, ["succeeded", "failed", "cancelled"]);
      if (job.generation !== "succeeded") {
        await recordAiAnalysisRun({
          tilesetId: options.tileset.id,
          selectedTiles: options.selectedTiles,
          promptContext: { jobId: receipt.job.id },
          result: "",
        });
        return { answer: "", failed: true, invalidJson: false };
      }
      const result = await readJobResult(job);
      const answer = typeof result?.payload.answer === "string"
        ? result.payload.answer
        : result?.payload.mapping && typeof result.payload.mapping === "object"
          ? JSON.stringify(result.payload.mapping)
          : "";
      const mapping = parseAiMappingResult(answer);
      await recordAiAnalysisRun({
        tilesetId: options.tileset.id,
        selectedTiles: options.selectedTiles,
        promptContext: { jobId: receipt.job.id },
        result: answer,
      });
      return { answer, failed: answer.length === 0, invalidJson: mapping === null };
    },
  };
}

export function buildTilesetAiProposalQuestion(tilesetId: string, tiles: readonly number[]): string {
  const analysis = analyzeTilesetSelection({ selectedTiles: tiles, tilesPerRow: 30 });
  const question = analysis.minimumQuestions[0] ? ` 최소 확인: ${analysis.minimumQuestions[0]}` : "";
  return `${currentMapContext(tilesetId, tiles)} 선택 타일 ${tiles.length}개를 AI가 블록/레이어/배치 규칙으로 매핑합니다.${question}`;
}

function currentMapContext(tilesetId: string, tiles: readonly number[]): string {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  return tilesetProposalMapContext(map, tilesetId, tiles);
}
