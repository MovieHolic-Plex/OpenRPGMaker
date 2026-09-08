import { AssistantSession, type TurnResult } from "@/ai/assistantSessionCore";
import { createLlmIntentDeclarer } from "@/ai/intentDeclarationClient";
import { buildClusterEditKickoff, buildRangeClassifyKickoff, buildUnclassifiedAnalysisKickoff } from "@/ai/clusterAssistPrompt";
import { renderToolImages, type RenderedToolImage } from "@/ai/toolImageRenderer";
import { resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import type { Project, TilesetDef } from "@/project/types";
import { assert, requireArray, requireRecord, requireBoolean } from "@/project/io/guards";
import type { AiJobHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobInput, AiJobResult, BlobRef, JsonObject } from "./contracts";
import { createSessionJobHost } from "./sessionHost";
import { jsonObject, jsonValue, parseProject, parseSessionJobState, type SessionJobState } from "./checkpointState";
import { createTilesetJobChat } from "./tilesetProvider";
import { retainTilesetImage, tilesetImageDataUrl, uniqueTilesetArtifacts } from "./tilesetArtifacts";
import { text, tilesetBlobRef, type ClusterTilesetPayload } from "./tilesetPayload";

export type TilesetClusterProposal = TurnResult & {
  kind: "cluster";
  operation: ClusterTilesetPayload["operation"];
  usage: ReturnType<AssistantSession["getUsageTotals"]>;
  audit: ReturnType<AssistantSession["getAuditEntries"]>;
  previews: { index: number; status: "ready" | "missing"; images: { ref: BlobRef; label: string }[] }[];
};
type RenderRecord = { key: string; images: { ref: BlobRef; label: string }[] };
export async function executeTilesetCluster(input: AiJobInput & { family: "tileset" }, payload: ClusterTilesetPayload, baseline: Project, tileset: TilesetDef, host: AiJobHost): Promise<AiJobResult> {
  let kickoff: string;
  switch (payload.operation) {
    case "cluster-edit": {
      const group = tileset.tileGroups?.find(g => g.id === payload.groupId);
      assert(group !== undefined, "Cluster group not found in captured tileset");
      kickoff = buildClusterEditKickoff({ tilesetId: tileset.id, groupId: group.id, group: { ...group, patternGrammar: group.patternGrammar ? { kind: group.patternGrammar.kind } : null } }); break;
    }
    case "range-classify": {
      const { rect, tileIds } = payload;
      assert(rect.x + rect.w <= tileset.tilesPerRow && rect.y + rect.h <= Math.ceil(tileset.count / tileset.tilesPerRow), "Range outside captured tileset");
      assert(tileIds.every(tile => tile < tileset.count && tile % tileset.tilesPerRow >= rect.x && tile % tileset.tilesPerRow < rect.x + rect.w && Math.floor(tile / tileset.tilesPerRow) >= rect.y && Math.floor(tile / tileset.tilesPerRow) < rect.y + rect.h), "Tile outside captured range");
      kickoff = buildRangeClassifyKickoff({ ...payload }); break;
    }
    case "unclassified-analysis":
      assert(payload.total >= payload.sampleTiles.length && payload.total <= tileset.count && payload.sampleTiles.every(t => t < tileset.count), "Invalid unclassified sample");
      kickoff = buildUnclassifiedAnalysisKickoff({ ...payload }); break;
  }
  const checkpoint = await host.loadCheckpoint();
  const renders: RenderRecord[] = [];
  let state: SessionJobState;
  if (checkpoint) {
    const c = requireRecord("tileset checkpoint", checkpoint.state);
    assert(c.version === 1 && c.operation === payload.operation, "Tileset checkpoint operation mismatch");
    state = await parseSessionJobState(c.session, host);
    if (state.completed) {
      const turn = state.completed.turn;
      assert(turn.kind === "cluster" && turn.operation === payload.operation && turn.completion === "complete", "Invalid completed cluster proposal");
      text(turn.assistantText);
      for (const value of requireArray("proposedCalls", turn.proposedCalls)) {
        const call = requireRecord("proposed call", value);
        text(call.name); text(call.summary); requireRecord("call args", call.args); requireBoolean("destructive", call.destructive);
        const result = requireRecord("call result", call.result); requireBoolean("ok", result.ok); text(result.summary);
      }
      assert(turn.appliedCalls === undefined || requireArray("appliedCalls", turn.appliedCalls).length === 0, "Job checkpoint cannot claim application");
      parseProject(await host.readJson(state.completed.generatedSnapshot));
    }
    for (const value of requireArray("renders", c.renders)) {
      const r = requireRecord("render", value);
      renders.push({ key: text(r.key), images: requireArray("images", r.images).map(value => {
        const i = requireRecord("image", value); return { label: text(i.label), ref: tilesetBlobRef(i.ref, true) };
      }) });
    }
  } else state = { startedAt: new Date().toISOString(), tools: [], draft: structuredClone(baseline) };
  const imageRefs = () => renders.flatMap(r => r.images.map(i => i.ref));
  let sessionArtifacts: readonly BlobRef[] = checkpoint?.artifacts ?? [];
  const job = createSessionJobHost(host, baseline, state, { domain: "tile", ...payload.context,
    captureEnvelope: () => {
      const capturedRenders = structuredClone(renders);
      return checkpoint => {
        sessionArtifacts = checkpoint.artifacts;
        return {
          stageKey: checkpoint.stageKey.replace(/^assistant\//, `tileset/${payload.operation}/`),
          state: jsonObject(jsonValue({ version: 1, operation: payload.operation, session: checkpoint.state, renders: capturedRenders })),
          artifacts: uniqueTilesetArtifacts([...input.artwork, ...checkpoint.artifacts, ...capturedRenders.flatMap(r => r.images.map(i => i.ref))]),
        };
      };
    },
  });
  if (!state.completed) {
    await job.flush("assistant/start");
    const config = resolveSurfaceAiConfig("cluster", { ...payload.config, apiKey: "", baseUrl: "" });
    const chat = createTilesetJobChat(host, payload.operation, () => job.flush());
    let renderCursor = 0;
    const renderImages = async (project: Project, name: string, data: unknown): Promise<RenderedToolImage[]> => {
      const index = renderCursor++, key = JSON.stringify(jsonValue({ name, data })), previous = renders[index];
      if (previous) {
        assert(previous.key === key, "Checkpoint image replay mismatch");
        return Promise.all(previous.images.map(async i => ({ label: i.label, dataUrl: await tilesetImageDataUrl(host, i.ref) })));
      }
      const output = await renderToolImages(project, name, data);
      const images = await Promise.all(output.map(async i => ({ label: i.label, ref: await retainTilesetImage(host, i.dataUrl) })));
      renders.push({ key, images });
      await job.flush(`assistant/render/${index}`);
      return output;
    };
    const session = new AssistantSession(baseline, { host: job.execution, config, chat, contextOptions: payload.context,
      priorTranscript: payload.priorTranscript, declareIntent: createLlmIntentDeclarer({ getConfig: () => config, chat }),
      renderImages, yieldToUi: () => job.flush(),
    });
    job.sampleUsage(() => session.getUsageTotals());
    const instruction = payload.instruction?.trim() ? `${kickoff}\n\n${payload.instruction}` : kickoff;
    const turn = await session.sendUserMessage(instruction, job.observe);
    await job.flush("assistant/terminal");
    state.draft = session.getProposedProject();
    const typedProposal: TilesetClusterProposal = { kind: "cluster", operation: payload.operation, ...turn, usage: session.getUsageTotals(), audit: session.getAuditEntries(),
      previews: renders.map((r, index) => ({ index, status: r.images.length ? "ready" : "missing", images: r.images })) };
    const output = jsonObject(jsonValue(typedProposal));
    let failure: string | null = turn.stoppedReason === "final" ? session.getExecutionCompletionProblem() : turn.stoppedReason;
    try { chat.assertHealthy(); } catch (error) { failure = error instanceof Error ? error.message : String(error); }
    if (failure) { state.partial = { reason: failure, turn: output }; await job.flush("assistant/partial"); throw new Error(`TILESET_INCOMPLETE: ${failure}`); }
    delete state.partial;
    state.completed = { turn: { ...output, completion: "complete" }, generatedSnapshot: await job.retainDraft() };
    await job.flush("assistant/completed");
  }
  const proposal: JsonObject = { ...state.completed.turn, persistence: "not-applicable", checkpoint: "private-draft" };
  return { version: 1, family: "tileset", jobId: host.jobId, attemptId: host.attemptId, project: input.project, baseSnapshot: input.projectSnapshot,
    generatedSnapshot: state.completed.generatedSnapshot, artifacts: uniqueTilesetArtifacts([...input.artwork, ...sessionArtifacts, ...imageRefs()]), payload: proposal };
}
