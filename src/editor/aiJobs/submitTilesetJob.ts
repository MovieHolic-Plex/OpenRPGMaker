import { jsonObject, jsonValue } from "@/ai/jobs/checkpointState";
import { parseTilesetPayload, type TilesetJobPayload } from "@/ai/jobs/tilesetPayload";
import type { AiJob } from "@/ai/jobs/contracts";
import type { AiSurface } from "@/ai/assistantEndpoint";
import type { AiSetupChoice } from "@/editor/panels/tilesetAiSetupMapping";
import type { TilesetAiReviewReady } from "@/editor/tilesetAiNativeReviewModel";
import type { TilesetAiConversationTurn } from "@/editor/tilesetAiConversationSession";
import { freezeSubmission, pinNamedArtwork, admissionWithPinnedAssets, type CapturedArtwork } from "./captureSubmission";
import { admitCapturedJob, type SubmitJobOptions } from "./submitAiJob";
import { assertNever } from "./jobSubmitError";

type ClusterFields = { readonly instruction?: string; readonly priorTranscript?: string; readonly sourceJobId?: string };
export type TilesetSubmitRequest = ClusterFields & { readonly tilesetId: string } & (
  | { readonly operation: "cluster-edit"; readonly groupId: string }
  | { readonly operation: "range-classify"; readonly rect: { x: number; y: number; w: number; h: number }; readonly tileIds: readonly number[] }
  | { readonly operation: "unclassified-analysis"; readonly sampleTiles: readonly number[]; readonly total: number }
  | { readonly operation: "knowledge-analysis"; readonly atlasDataUrl: string; readonly feedback: readonly string[]; readonly review?: TilesetAiReviewReady }
  | { readonly operation: "question-followup"; readonly atlasDataUrl: string; readonly review: TilesetAiReviewReady; readonly proposalId: string; readonly answer: string; readonly turns: readonly TilesetAiConversationTurn[] }
  | { readonly operation: "proposal-draft"; readonly selectedTiles: readonly number[]; readonly setupChoice: AiSetupChoice; readonly snapshotSummary: string; readonly snapshotDataUrl: string; readonly lockedAnswer: string }
  | { readonly operation: "structure-kit-metadata"; readonly kitId: string }
);

function surfaceOf(operation: TilesetSubmitRequest["operation"]): AiSurface {
  if (operation === "structure-kit-metadata") return "structure-kit";
  if (operation === "cluster-edit" || operation === "range-classify" || operation === "unclassified-analysis") return "cluster";
  return "tileset-analysis";
}

export async function submitTilesetJob(
  request: TilesetSubmitRequest,
  options: SubmitJobOptions = {},
): Promise<{ job: AiJob; created: boolean; idempotencyKey: string }> {
  const frozen = freezeSubmission(surfaceOf(request.operation), "tile");
  const artwork: CapturedArtwork[] = [];
  const base = { config: frozen.config, context: frozen.context, tilesetId: request.tilesetId, sourceJobId: request.sourceJobId };
  let payload: TilesetJobPayload;
  switch (request.operation) {
    case "cluster-edit":
      payload = { ...base, operation: request.operation, groupId: request.groupId, instruction: request.instruction, priorTranscript: request.priorTranscript };
      break;
    case "range-classify":
      payload = { ...base, operation: request.operation, rect: request.rect, tileIds: request.tileIds, instruction: request.instruction, priorTranscript: request.priorTranscript };
      break;
    case "unclassified-analysis":
      payload = { ...base, operation: request.operation, sampleTiles: request.sampleTiles, total: request.total, instruction: request.instruction, priorTranscript: request.priorTranscript };
      break;
    case "knowledge-analysis": {
      const atlas = await pinNamedArtwork(request.atlasDataUrl);
      artwork.push(atlas);
      payload = { ...base, operation: request.operation, atlas: atlas.ref, feedback: request.feedback, review: request.review };
      break;
    }
    case "question-followup": {
      const atlas = await pinNamedArtwork(request.atlasDataUrl);
      artwork.push(atlas);
      payload = { ...base, operation: request.operation, atlas: atlas.ref, review: request.review, proposalId: request.proposalId, answer: request.answer, turns: request.turns };
      break;
    }
    case "proposal-draft": {
      const snapshot = await pinNamedArtwork(request.snapshotDataUrl);
      artwork.push(snapshot);
      payload = { ...base, operation: request.operation, selectedTiles: request.selectedTiles, setupChoice: request.setupChoice, lockedAnswer: request.lockedAnswer, snapshot: { image: snapshot.ref, summary: request.snapshotSummary } };
      break;
    }
    case "structure-kit-metadata":
      payload = { ...base, operation: request.operation, kitId: request.kitId };
      break;
    default:
      return assertNever(request);
  }
  const parsed = parseTilesetPayload(jsonValue(payload));
  return admitCapturedJob(
    await admissionWithPinnedAssets(
      frozen,
      "tileset",
      jsonObject(jsonValue({ tilesetId: parsed.tilesetId, operation: parsed.operation })),
      "review",
      jsonObject(jsonValue(parsed)),
      artwork,
      parsed.sourceJobId ? [parsed.sourceJobId] : [],
    ),
    { ...options, fingerprint: options.fingerprint ?? tilesetFingerprint(request) },
  );
}

function tilesetFingerprint(request: TilesetSubmitRequest): string {
  switch (request.operation) {
    case "cluster-edit":
      return JSON.stringify({ operation: request.operation, groupId: request.groupId, instruction: request.instruction ?? "" });
    case "range-classify":
      return JSON.stringify({ operation: request.operation, rect: request.rect, instruction: request.instruction ?? "" });
    case "unclassified-analysis":
      return JSON.stringify({ operation: request.operation, sampleTiles: request.sampleTiles, instruction: request.instruction ?? "" });
    case "knowledge-analysis":
      return JSON.stringify({ operation: request.operation, feedback: request.feedback });
    case "question-followup":
      return JSON.stringify({ operation: request.operation, proposalId: request.proposalId, answer: request.answer });
    case "proposal-draft":
      return JSON.stringify({ operation: request.operation, selectedTiles: request.selectedTiles, lockedAnswer: request.lockedAnswer });
    case "structure-kit-metadata":
      return JSON.stringify({ operation: request.operation, kitId: request.kitId });
    default:
      return assertNever(request);
  }
}
