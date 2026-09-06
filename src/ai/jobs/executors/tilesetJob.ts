import type { AiJobHost } from "../../../../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobInput, AiJobResult, BlobRef } from "../contracts";
import { jsonObject, jsonValue, parseProject } from "../checkpointState";
import { parseTilesetPayload, tilesetBlobRef, text, type TilesetJobPayload } from "../tilesetPayload";
import { createTilesetJobChat } from "../tilesetProvider";
import { tilesetImageDataUrl, uniqueTilesetArtifacts } from "../tilesetArtifacts";
import { validateTilesetDependency } from "../tilesetDependency";
import { executeTilesetCluster, type TilesetClusterProposal } from "../tilesetClusterExecution";
import { assert, requireRecord } from "@/project/io/guards";
import { resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { buildTilesetMappingRequest, normalizeCpenResponseText } from "@/editor/tilesetAiRequest";
import { buildStructureKitAiRequest, parseAiMetaDraft } from "@/editor/structureKitAiDraft";
import { buildTilesetProposalPrompt, normalizeTilesetProposal, tilesetProposalMapContext } from "@/editor/tilesetAiProposalDraft";
import { parseAiMappingResult, type AiMappingResult } from "@/editor/tilesetAiPure/tilesetAiProposalParsing";
import { analyzeCapturedTilesetReview } from "@/editor/tilesetAiQuestionAnalysis";
import { tilesetKnowledgeFingerprint } from "@/editor/tilesetAiNativeAnalysis";
import type { TilesetAiReviewReady } from "@/editor/tilesetAiNativeReviewModel";
import type { TilesetAiConversationTurn } from "@/editor/tilesetAiConversationSession";
import type { StructureKitAiMeta } from "@/project/types";

export { TILESET_JOB_OPERATIONS } from "../tilesetPayload";
export type { TilesetJobPayload, TilesetJobOperation } from "../tilesetPayload";
export type TilesetAnalysisProposal =
  | { kind: "knowledge-analysis" | "question-followup"; review: TilesetAiReviewReady; turns: readonly TilesetAiConversationTurn[] }
  | { kind: "proposal-draft"; answer: string; mapping: AiMappingResult }
  | { kind: "structure-kit-metadata"; kitId: string; metadata: StructureKitAiMeta };

export type TilesetJobProposal = TilesetAnalysisProposal | TilesetClusterProposal;
export type { TilesetClusterProposal } from "../tilesetClusterExecution";

type AnalysisPayload = Exclude<TilesetJobPayload, { operation: "cluster-edit" | "range-classify" | "unclassified-analysis" }>;
/** Seven captured operations, generation only. No live project application or persistence. */
export async function executeTilesetJob(input: AiJobInput & { family: "tileset" }, host: AiJobHost): Promise<AiJobResult> {
  const payload = parseTilesetPayload(input.payload);
  validateTilesetDependency(input, payload, host);
  const project = parseProject(await host.readJson(input.projectSnapshot));
  const tileset = project.tilesets[payload.tilesetId];
  assert(tileset !== undefined, "Tileset not found in captured project");
  if (payload.context.currentMapId !== undefined) assert(project.maps[payload.context.currentMapId] !== undefined, "Captured map not found");
  if (payload.operation === "cluster-edit" || payload.operation === "range-classify" || payload.operation === "unclassified-analysis") {
    return executeTilesetCluster(input, payload, project, tileset, host);
  }
  // Validate semantic targets before reading checkpoint or dispatching any provider request.
  if (payload.operation === "structure-kit-metadata") assert(tileset.structureKits?.some(k => k.id === payload.kitId && k.kind === "section") === true, "Structure kit not found");
  if (payload.operation === "proposal-draft") {
    assert(payload.selectedTiles.every(t => t < tileset.count), "Selected tile outside captured tileset");
    assert(payload.snapshot.summary.trim().length > 0, "Completed temporary-map snapshot required");
    assert(!payload.lockedAnswer || parseAiMappingResult(payload.lockedAnswer) !== null, "Invalid locked mapping answer");
  }
  if (payload.operation === "knowledge-analysis" || payload.operation === "question-followup") {
    const review = payload.review;
    if (review) {
      assert(review.tilesetId === tileset.id && review.fingerprint === tilesetKnowledgeFingerprint(tileset) && review.status !== "stale", "Captured review is stale");
      assert(review.proposals.every(p => p.tileIds.every(t => t < tileset.count)), "Review tile outside captured tileset");
    }
    if (payload.operation === "question-followup") assert(payload.review.proposals.some(p => p.id === payload.proposalId && p.status === "pending"), "Pending review question not found");
  }
  const image = capturedImage(payload);
  const imageDataUrl = image ? await tilesetImageDataUrl(host, image) : "";
  const checkpoint = await host.loadCheckpoint();
  let rawRef: BlobRef | undefined, proposalRef: BlobRef | undefined;
  if (checkpoint) {
    const state = requireRecord("tileset checkpoint", checkpoint.state);
    assert(state.version === 1 && state.operation === payload.operation, "Tileset checkpoint operation mismatch");
    rawRef = state.rawRef === undefined ? undefined : tilesetBlobRef(state.rawRef);
    proposalRef = state.proposalRef === undefined ? undefined : tilesetBlobRef(state.proposalRef);
    assert(!proposalRef || rawRef !== undefined, "Completed proposal has no raw response");
  }
  const artifacts = () => uniqueTilesetArtifacts([...input.artwork, ...(image ? [image] : []), ...(rawRef ? [rawRef] : []), ...(proposalRef ? [proposalRef] : [])]);
  const flush = async (stage: string) => { await host.saveCheckpoint({ stageKey: `tileset/${payload.operation}/${stage}`,
    state: jsonObject(jsonValue({ version: 1, operation: payload.operation, rawRef, proposalRef })), artifacts: artifacts() }); };
  const config = resolveSurfaceAiConfig(payload.operation === "structure-kit-metadata" ? "structure-kit" : "tileset-analysis", { ...payload.config, apiKey: "", baseUrl: "" });
  const chat = createTilesetJobChat(host, payload.operation, () => flush("request"));
  const request = async (request: Parameters<typeof chat>[1]): Promise<string> => {
    if (rawRef) {
      const raw = requireRecord("checkpoint response", await host.readJson(rawRef));
      assert(raw.finishReason === "stop", `TILESET_INCOMPLETE: ${text(raw.finishReason)}`);
      return text(raw.text);
    }
    const response = await chat(config, request);
    const content = response.message.content;
    const raw = typeof content === "string" ? content : (content ?? []).map(p => p.type === "text" ? p.text : "").join("\n");
    // Raw provider output survives invalid JSON, parser errors and later checkpoint failures.
    rawRef = await host.putJson({ text: raw, finishReason: response.finishReason });
    await flush("response");
    assert(response.finishReason === "stop", `TILESET_INCOMPLETE: ${response.finishReason}`);
    return raw;
  };
  let proposal: TilesetAnalysisProposal;
  switch (payload.operation) {
    case "structure-kit-metadata": {
      const kit = tileset.structureKits!.find(k => k.id === payload.kitId && k.kind === "section");
      assert(kit !== undefined && kit.kind === "section", "Structure kit must be a section");
      const names = tileset.structureKits!.filter(k => k.id !== kit.id).map(k => k.name ?? "구조물");
      const raw = await request(buildStructureKitAiRequest(kit, tileset, names, payload.context.preferenceMemorySection));
      let id = 0;
      const metadata = parseAiMetaDraft(raw, () => `${host.jobId}-${kit.id}-${id++}`);
      assert(metadata !== null, "TILESET_METADATA_INVALID: no usable structure metadata");
      proposal = { kind: payload.operation, kitId: kit.id, metadata }; break;
    }
    case "proposal-draft": {
      const prompt = buildTilesetProposalPrompt({ tileset, selectedTiles: payload.selectedTiles, setupChoice: payload.setupChoice },
        tilesetProposalMapContext(project.maps[payload.context.currentMapId ?? project.startMapId], tileset.id, payload.selectedTiles), payload.snapshot.summary, payload.lockedAnswer);
      const raw = normalizeCpenResponseText(await request(buildTilesetMappingRequest({ prompt, imageDataUrl })));
      const normalized = normalizeTilesetProposal(raw, payload.lockedAnswer);
      const mapping = parseAiMappingResult(normalized.answer);
      assert(!normalized.failed && !normalized.invalidJson && mapping !== null, "TILESET_MAPPING_INVALID: invalid mapping JSON");
      assert(!!(mapping.tiles?.length || mapping.groups?.length || mapping.patternBlocks?.length || mapping.minimumQuestions?.length), "TILESET_MAPPING_INVALID: empty mapping");
      assert((mapping.tiles ?? []).every(t => t.tile !== undefined && payload.selectedTiles.includes(t.tile)), "TILESET_MAPPING_INVALID: tile outside selection");
      assert([...(mapping.groups ?? []), ...(mapping.patternBlocks ?? [])].every(g => (g.tileIds ?? []).every(t => payload.selectedTiles.includes(t))), "TILESET_MAPPING_INVALID: group outside selection");
      proposal = { kind: payload.operation, answer: normalized.answer, mapping }; break;
    }
    case "knowledge-analysis":
    case "question-followup": {
      const analysis = await analyzeCapturedTilesetReview(tileset, { requestId: `tileset-${host.jobId}`, previous: payload.review,
        feedback: payload.operation === "knowledge-analysis" ? payload.feedback : [], imageDataUrl,
        request: async r => normalizeCpenResponseText(await request(buildTilesetMappingRequest(r))),
        question: payload.operation === "question-followup" ? { proposalId: payload.proposalId, answer: payload.answer, turns: payload.turns } : undefined,
      });
      proposal = { kind: payload.operation, ...analysis }; break;
    }
  }
  const output = jsonObject(jsonValue({ ...proposal, tilesetId: tileset.id, completion: "complete", persistence: "not-applicable", checkpoint: "private-proposal" }));
  if (proposalRef) assert(JSON.stringify(await host.readJson(proposalRef)) === JSON.stringify(output), "Checkpoint proposal does not match its raw response");
  else { proposalRef = await host.putJson(output); await flush("completed"); }
  return { version: 1, family: "tileset", jobId: host.jobId, attemptId: host.attemptId, project: input.project, baseSnapshot: input.projectSnapshot,
    generatedSnapshot: null, artifacts: artifacts(), payload: { ...output, proposalRef: jsonObject(jsonValue(proposalRef)) } };
}
function capturedImage(payload: AnalysisPayload): BlobRef | undefined {
  if (payload.operation === "knowledge-analysis" || payload.operation === "question-followup") return payload.atlas;
  return payload.operation === "proposal-draft" ? payload.snapshot.image : undefined;
}
