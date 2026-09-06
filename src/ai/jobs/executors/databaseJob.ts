import type { AiJobHost } from "../../../../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobInput, AiJobResult, BlobRef, JsonObject, JsonValue } from "../contracts";
import { jsonObject, jsonValue, parseProject } from "../checkpointState";
import { enumValue, parseAssistantPayload } from "../assistantPayload";
import { assert, requireBoolean, requireNumber, requireRecord, requireString } from "@/project/io/guards";
import { requestBody, parseNonStream, type AiConfig } from "../../llmClient";
import { generateAiImage, IMAGE_GENERATION_PROVIDER_ID } from "../../imageGenerationClient";
import {
  artworkPromptFor, buildRecordPrompt, existingNamesOf, generatedRecordId,
  parseGeneratedRecord, toolCallsForGeneration, type AiDatabaseKind,
} from "../../databaseGenerationCore";
import { flattenGeneratedArtwork } from "@/editor/aiArtworkCanvas";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import type { Project } from "@/project/types";

export interface DatabaseJobPayload {
  readonly kind: AiDatabaseKind;
  readonly brief: string;
  readonly config: Omit<AiConfig, "apiKey" | "baseUrl">;
  readonly withArtwork: boolean;
}
export interface DatabaseJobProposal {
  readonly kind: AiDatabaseKind;
  readonly recordId: string;
  readonly name: string;
  /** Complete normalized record, captured from the detached generated project. */
  readonly record: JsonObject;
  readonly resourceId?: string;
  readonly artwork?: DatabaseArtwork;
  readonly summary: string;
  readonly completion: "complete";
  readonly persistence: "not-applicable";
  readonly checkpoint: "private-draft";
}
export interface DatabaseArtwork {
  readonly raw: BlobRef;
  readonly processed?: BlobRef;
  readonly model: string;
  readonly provider: string;
}
interface DatabaseState {
  version: 1;
  kind: AiDatabaseKind;
  recordId: string;
  patch: JsonObject;
  artwork?: DatabaseArtwork;
  completed?: { generatedSnapshot: BlobRef; proposal: JsonObject };
}

function parsePayload(value: unknown): DatabaseJobPayload {
  const p = requireRecord("database payload", value);
  assert(Object.keys(p).every(key => ["kind", "brief", "config", "withArtwork"].includes(key)), "Unexpected database payload field");
  const brief = requireString("brief", p.brief).trim();
  // Reuse the captured nonsecret provider-config guard, including rejection of
  // unsupported transports. No assistant session is constructed or executed.
  const { config } = parseAssistantPayload({ instruction: brief, config: p.config, domain: "database",
    context: { budgetChars: 1, preferenceMemorySection: "" } });
  return { kind: enumValue(p.kind, ["item", "enemy"]), brief, config, withArtwork: requireBoolean("withArtwork", p.withArtwork) };
}
function parseRef(value: unknown, image = false): BlobRef {
  const r = requireRecord("database blob reference", value);
  const sha256 = requireString("sha256", r.sha256);
  const byteLength = requireNumber("byteLength", r.byteLength);
  const mediaType = requireString("mediaType", r.mediaType);
  assert(/^[a-f0-9]{64}$/.test(sha256) && Number.isSafeInteger(byteLength) && byteLength > 0, "Invalid database blob reference");
  assert(image ? /^image\/(png|jpeg|webp|gif|bmp)$/.test(mediaType) : mediaType === "application/json", "Invalid database blob media type");
  return { sha256, byteLength, mediaType };
}
function dataImage(dataUrl: string): { bytes: Uint8Array; mediaType: string } {
  const match = /^data:(image\/(?:png|jpeg|webp|gif|bmp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  assert(match !== null, "Invalid database artwork data URL");
  const decoded = atob(match[2]!);
  assert(decoded.length > 0, "Empty database artwork");
  return { bytes: Uint8Array.from(decoded, char => char.charCodeAt(0)), mediaType: match[1]! };
}
async function readImage(host: AiJobHost, ref: BlobRef): Promise<string> {
  const bytes = await host.readBlob(ref);
  assert(bytes.byteLength === ref.byteLength, "Database artwork byte length mismatch");
  // Chunking avoids argument-stack limits for provider-sized images.
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return `data:${ref.mediaType};base64,${btoa(binary)}`;
}
function records(project: Project, kind: AiDatabaseKind) {
  return kind === "item" ? project.database.items : project.database.enemies;
}
function canonicalJson(value: JsonValue): string {
  return JSON.stringify(value, (_key, child: unknown) => child !== null && typeof child === "object" && !Array.isArray(child)
    ? Object.fromEntries(Object.entries(requireRecord("JSON object", child)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
    : child);
}
function parseState(value: unknown, payload: DatabaseJobPayload, baseline: Project): DatabaseState {
  const s = requireRecord("database checkpoint", value);
  assert(s.version === 1 && s.kind === payload.kind, "Invalid database checkpoint version/kind");
  const patch = jsonObject(s.patch);
  const validated = parseGeneratedRecord(payload.kind, JSON.stringify(patch), baseline.worldCanon);
  assert(canonicalJson(jsonObject(validated)) === canonicalJson(patch), "Invalid database checkpoint patch");
  const recordId = requireString("recordId", s.recordId);
  assert(recordId === generatedRecordId(payload.kind, requireString("name", patch.name), records(baseline, payload.kind).map(r => r.id)), "Invalid database checkpoint record ID");
  let artwork: DatabaseArtwork | undefined;
  if (s.artwork !== undefined) {
    assert(payload.withArtwork, "Unexpected database checkpoint artwork");
    const a = requireRecord("database artwork", s.artwork);
    artwork = { raw: parseRef(a.raw, true), processed: a.processed === undefined ? undefined : parseRef(a.processed, true),
      model: requireString("model", a.model), provider: requireString("provider", a.provider) };
  }
  let completed: DatabaseState["completed"];
  if (s.completed !== undefined) {
    assert(!payload.withArtwork || artwork?.processed !== undefined, "Incomplete database checkpoint artwork");
    const c = requireRecord("completed database checkpoint", s.completed);
    const proposal = jsonObject(c.proposal);
    assert(proposal.kind === payload.kind && proposal.recordId === recordId && proposal.name === patch.name
      && proposal.completion === "complete" && proposal.persistence === "not-applicable" && proposal.checkpoint === "private-draft", "Invalid database checkpoint proposal");
    completed = { generatedSnapshot: parseRef(c.generatedSnapshot), proposal };
  }
  return { version: 1, kind: payload.kind, recordId, patch, artwork, completed };
}
function artifacts(state: DatabaseState): BlobRef[] {
  return state.artwork ? [state.artwork.raw, ...(state.artwork.processed ? [state.artwork.processed] : [])] : [];
}

function capturedProposal(project: Project, state: DatabaseState): DatabaseJobProposal {
  const record = records(project, state.kind).find(entry => entry.id === state.recordId);
  assert(record !== undefined && record.name === state.patch.name, "Database tool did not create the captured record");
  return { kind: state.kind, recordId: state.recordId, name: record.name, record: jsonObject(jsonValue(record)),
    resourceId: state.artwork ? `${state.recordId}_art` : undefined, artwork: state.artwork,
    summary: `AI ${state.kind === "item" ? "아이템" : "몬스터"} 생성: ${record.name}`,
    completion: "complete", persistence: "not-applicable", checkpoint: "private-draft" };
}

/** Executes against the submitted snapshot only. No live apply/save authority. */
export async function executeDatabaseJob(input: AiJobInput & { family: "database" }, host: AiJobHost): Promise<AiJobResult> {
  const payload = parsePayload(input.payload);
  const baseline = parseProject(await host.readJson(input.projectSnapshot));
  const checkpoint = await host.loadCheckpoint();
  let state = checkpoint ? parseState(checkpoint.state, payload, baseline) : undefined;
  const flush = async (stageKey: string, saved: DatabaseState) => {
    await host.saveCheckpoint({ stageKey, state: jsonObject(jsonValue(saved)),
      artifacts: [...artifacts(saved), ...(saved.completed ? [saved.completed.generatedSnapshot] : [])] });
  };
  if (!state) {
    const config: AiConfig = { ...payload.config, apiKey: "", baseUrl: "" };
    const response = await host.providerOperation({ key: "database/text", request: {
      kind: "text", provider: config.providerId ?? "google-antigravity",
      body: jsonObject(JSON.parse(requestBody(config, { messages: buildRecordPrompt(payload.kind, payload.brief,
        existingNamesOf(baseline, payload.kind), baseline.worldCanon) }, false))),
    } });
    const result = parseNonStream(requireRecord("database text response", response), config.model);
    assert(result.finishReason === "stop" && !result.message.tool_calls?.length, "Incomplete database text response");
    const content = result.message.content;
    const text = typeof content === "string" ? content : (content ?? []).map(part => part.type === "text" ? part.text : "").join("");
    const patch = jsonObject(parseGeneratedRecord(payload.kind, text, baseline.worldCanon));
    state = { version: 1, kind: payload.kind, patch,
      recordId: generatedRecordId(payload.kind, requireString("name", patch.name), records(baseline, payload.kind).map(r => r.id)) };
    await flush("database/text", state);
  }
  if (state.artwork) {
    await readImage(host, state.artwork.raw);
    if (state.artwork.processed) await readImage(host, state.artwork.processed);
  }
  if (!state.completed) {
    const name = requireString("name", state.patch.name);
    if (payload.withArtwork && !state.artwork) {
      // The actual image client's encoder/parser is retained; its only transport
      // is this durable host operation. It performs no HTTP and has no retries.
      const image = await generateAiImage({ prompt: artworkPromptFor(payload.kind, name, payload.brief) }, {
        fetch: async (_url, init) => {
          assert(typeof init?.body === "string", "Missing database artwork request");
          const response = await host.providerOperation({ key: "database/artwork", request: {
            kind: "image", provider: IMAGE_GENERATION_PROVIDER_ID, body: jsonObject(JSON.parse(init.body)),
          } });
          return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
        },
      });
      const raw = dataImage(image.dataUrl);
      state.artwork = { raw: await host.putBlob(raw.bytes, raw.mediaType), model: image.model, provider: image.provider };
      await flush("database/artwork", state);
    }
    if (state.artwork && !state.artwork.processed) {
      const flattened = dataImage(await flattenGeneratedArtwork(await readImage(host, state.artwork.raw)));
      state.artwork = { ...state.artwork, processed: await host.putBlob(flattened.bytes, flattened.mediaType) };
      await flush("database/artwork-processed", state);
    }
    const resourceId = state.artwork ? `${state.recordId}_art` : undefined;
    // Never overwrite an unrelated submitted resource with this generated binding.
    assert(!resourceId || !baseline.assets.uploaded[resourceId], "Generated database artwork resource ID collision");
    const artwork = state.artwork?.processed && resourceId
      ? { resourceId, dataUrl: await readImage(host, state.artwork.processed) } : undefined;
    const ctx: ToolContext = { project: structuredClone(baseline) };
    for (const call of toolCallsForGeneration({ kind: payload.kind, recordId: state.recordId, patch: state.patch, artwork })) {
      const result = runTool(ctx, call.name, call.args);
      assert(result.ok, `Database proposal failed: ${result.summary}`);
    }
    parseProject(ctx.project);
    state.completed = { generatedSnapshot: await host.putJson(jsonValue(ctx.project)),
      proposal: jsonObject(jsonValue(capturedProposal(ctx.project, state))) };
    await flush("database/completed", state);
  } else {
    const generated = parseProject(await host.readJson(state.completed.generatedSnapshot));
    assert(canonicalJson(jsonValue(capturedProposal(generated, state))) === canonicalJson(state.completed.proposal), "Database checkpoint proposal mismatch");
  }
  return { version: 1, family: "database", jobId: host.jobId, attemptId: host.attemptId, project: input.project,
    baseSnapshot: input.projectSnapshot, generatedSnapshot: state.completed.generatedSnapshot,
    artifacts: artifacts(state), payload: state.completed.proposal };
}
