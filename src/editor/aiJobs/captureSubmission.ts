import type { AiSurface } from "@/ai/assistantEndpoint";
import { resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { DEFAULT_BUDGET_CHARS } from "@/ai/contextBuilder";
import { conversationScopeKey } from "@/ai/conversationStore";
import { getEditorMapViewport } from "@/editor/editorMapViewport";
import { editorState } from "@/editor/editorState";
import { buildPreferenceMemorySection } from "@/ai/preferenceMemory";
import { calibratedBudgetChars, loadTokenObservations } from "@/ai/tokenBudget";
import { parseAssistantPayload, type AssistantJobPayload } from "@/ai/jobs/assistantPayload";
import type { AiJobInput, AiProjectIdentity, BlobRef, JsonObject, JsonValue } from "@/ai/jobs/contracts";
import { jsonObject, jsonValue } from "@/ai/jobs/checkpointState";
import { activeTileGrafts } from "@/assets/tileGrafts";
import type { AiConfig } from "@/ai/llmClient";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { bundledTilesetImageUrl } from "@/editor/tilesetImage";
import { sha256HexBytes } from "@/util/sha256";
import { JobSubmitError } from "./jobSubmitError";
import type { JobAdmission } from "./jobClient";

export interface CapturedArtwork {
  readonly mediaType: string;
  readonly base64: string;
  readonly ref: BlobRef;
}

export interface FrozenSubmission {
  readonly identity: AiProjectIdentity;
  readonly epoch: number;
  readonly snapshot: JsonValue;
  readonly project: Project;
  readonly config: AssistantJobPayload["config"];
  readonly context: AssistantJobPayload["context"];
}

export function publicAiConfig(config: AiConfig): AssistantJobPayload["config"] {
  return parseAssistantPayload({
    instruction: "config",
    domain: "core",
    config: {
      authMode: config.authMode,
      providerId: config.providerId,
      model: config.model,
      liteModel: config.liteModel,
      maxToolCalls: config.maxToolCalls,
      maxTokens: config.maxTokens,
      reasoningEffort: config.reasoningEffort,
      autonomyLevel: config.autonomyLevel,
      agentMode: config.agentMode,
    },
    context: { budgetChars: 1, preferenceMemorySection: "" },
  }).config;
}

export function freezeSubmission(surface: AiSurface, domain: AssistantJobPayload["domain"] = "core"): FrozenSubmission {
  if (!store.isLoaded()) throw new JobSubmitError("not-loaded", "열린 프로젝트가 없습니다.");
  const identity = store.getLoadedProjectIdentity();
  const epoch = store.getProjectEpoch();
  const project = structuredClone(store.getCurrent());
  const snapshot = jsonValue(project);
  const currentMapId = editorState.get().currentMapId ?? project.startMapId ?? undefined;
  const projectScopeKey = conversationScopeKey(store.getProjectIdentity(), project);
  const viewport = getEditorMapViewport();
  const context: AssistantJobPayload["context"] = {
    currentMapId,
    projectScopeKey,
    viewport: viewport && (!currentMapId || viewport.mapId === currentMapId) ? viewport : undefined,
    budgetChars: calibratedBudgetChars(DEFAULT_BUDGET_CHARS, loadTokenObservations()),
    preferenceMemorySection: buildPreferenceMemorySection(projectScopeKey),
  };
  const config = publicAiConfig(resolveSurfaceAiConfig(surface));
  parseAssistantPayload({ instruction: "capture", domain, config, context });
  return { identity, epoch, snapshot, project, config, context };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export function decodeDataUrl(dataUrl: string): { mediaType: string; bytes: Uint8Array } | null {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl.trim());
  if (!match) return null;
  const binary = atob(match[2]);
  if (binary.length === 0) return null;
  return { mediaType: match[1], bytes: Uint8Array.from(binary, char => char.charCodeAt(0)) };
}

export async function artworkFromBytes(bytes: Uint8Array, mediaType: string): Promise<CapturedArtwork> {
  const sha256 = await sha256HexBytes(bytes);
  return { mediaType, base64: bytesToBase64(bytes), ref: { sha256, byteLength: bytes.byteLength, mediaType } };
}

export async function pinNamedArtwork(dataUrl: string): Promise<CapturedArtwork> {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) throw new JobSubmitError("capture-failed", "이미지를 고정하지 못했습니다.");
  return artworkFromBytes(decoded.bytes, decoded.mediaType);
}

export async function pinBundledReportAssets(project: Project): Promise<{
  readonly artwork: readonly CapturedArtwork[];
  readonly reportAssets: Record<string, BlobRef>;
}> {
  const ids = new Set<string>();
  for (const tileset of Object.values(project.tilesets)) {
    if (tileset.image.type === "bundled") ids.add(tileset.image.id);
    for (const graft of activeTileGrafts(tileset)) ids.add(graft.sourceChipset);
  }
  const artwork: CapturedArtwork[] = [];
  const reportAssets: Record<string, BlobRef> = {};
  for (const id of ids) {
    const url = bundledTilesetImageUrl(id);
    if (!url) throw new JobSubmitError("capture-failed", `이미지를 고정하지 못했습니다: ${id}`);
    let response: Response;
    try {
      response = await fetch(url, { cache: "force-cache" });
    } catch (error) {
      throw new JobSubmitError("capture-failed", `이미지를 고정하지 못했습니다: ${id} (${error instanceof Error ? error.message : String(error)})`);
    }
    if (!response.ok) throw new JobSubmitError("capture-failed", `이미지를 고정하지 못했습니다: ${id} (HTTP ${response.status})`);
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength === 0) throw new JobSubmitError("capture-failed", `이미지를 고정하지 못했습니다: ${id}`);
    const type = response.headers.get("content-type") ?? "";
    const mediaType = /^image\/(png|jpeg|webp|gif)$/.test(type) ? type : null;
    if (!mediaType) throw new JobSubmitError("capture-failed", `이미지를 고정하지 못했습니다: ${id} (${type || "unknown type"})`);
    const captured = await artworkFromBytes(buffer, mediaType);
    artwork.push(captured);
    reportAssets[id] = captured.ref;
  }
  return { artwork, reportAssets };
}

export function withReportAssets(payload: JsonObject, reportAssets: Record<string, BlobRef>): JsonObject {
  if (Object.keys(reportAssets).length === 0) return payload;
  return jsonObject(jsonValue({ ...payload, reportAssets }));
}

export function admissionOf(
  frozen: FrozenSubmission,
  family: AiJobInput["family"],
  target: JsonObject,
  mode: string,
  payload: JsonObject,
  artwork: readonly CapturedArtwork[],
  dependsOn: readonly string[] = [],
): JobAdmission {
  return {
    input: {
      version: 1,
      family,
      project: frozen.identity,
      target,
      mode,
      payload,
      dependsOn,
    },
    projectSnapshot: frozen.snapshot,
    artwork: artwork.map(item => ({ mediaType: item.mediaType, base64: item.base64 })),
  };
}

export async function admissionWithPinnedAssets(
  frozen: FrozenSubmission,
  family: AiJobInput["family"],
  target: JsonObject,
  mode: string,
  payload: JsonObject,
  extraArtwork: readonly CapturedArtwork[] = [],
  dependsOn: readonly string[] = [],
): Promise<JobAdmission> {
  const bundled = await pinBundledReportAssets(frozen.project);
  return admissionOf(
    frozen,
    family,
    target,
    mode,
    withReportAssets(payload, bundled.reportAssets),
    [...extraArtwork, ...bundled.artwork],
    dependsOn,
  );
}
