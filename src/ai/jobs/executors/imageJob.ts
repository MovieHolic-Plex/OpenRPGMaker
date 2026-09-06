import type { AiJobHost } from "../../../../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobInput, AiJobResult, BlobRef, JsonValue } from "../contracts";
import { jsonObject, jsonValue, parseProject } from "../checkpointState";
import { imageRef, imageString, parseImageJobDestination, parseImageJobPayload, type ImageJobDestination, type ImageJobProposal } from "../imagePayload";
import { decodeImageJobArtwork, imageJobDataUrl, postprocessImageJobArtwork } from "../imageJobArtwork";
import { generateAiImage, IMAGE_GENERATION_PROVIDER_ID } from "../../imageGenerationClient";
import { assert, requireBoolean, requireNumber, requireRecord } from "@/project/io/guards";
import { insertGeneratedPictureAsset } from "@/editor/generatedPictureAsset";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import type { Project } from "@/project/types";
export type { ImageJobPayload, ImageJobDestination, ImageJobProposal } from "../imagePayload";

/** Persistence canonicalizes object keys; identity must retain every value and
 * array position, but must not depend on insertion order at any object depth. */
function bindingIdentity(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(bindingIdentity).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${bindingIdentity(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

interface ImageStage {
  artifact: BlobRef;
  width: number;
  height: number;
  model: string;
  provider: string;
}
function parseImageStage(value: unknown): ImageStage {
  const r = requireRecord("image stage", value);
  const width = requireNumber("width", r.width), height = requireNumber("height", r.height);
  assert(Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0, "Invalid image dimensions");
  return { artifact: imageRef(r.artifact), width, height, model: imageString("model", r.model), provider: imageString("provider", r.provider) };
}
function validateDestination(project: Project, target: ImageJobDestination): void {
  if (target.kind === "database") {
    assert(project.database[target.table]?.some(r => r.id === target.recordId) === true, "Image destination record does not exist");
  } else if (target.kind === "title-layer") {
    assert(project.system.titleScreen?.backgroundLayers?.[target.index] !== undefined, "Image title layer does not exist");
  }
  // A reviewed event draft may not exist in the submitted saved project. Its
  // owner + draft ID/revision + expected command are checked by the review adapter.
}
function linkPrivateProject(project: Project, target: ImageJobDestination, resourceId: string): void {
  if (target.kind === "database") {
    switch (target.table) {
      case "actors": project.database.actors.find(r => r.id === target.recordId)!.faceResourceId = resourceId; break;
      case "enemies": project.database.enemies.find(r => r.id === target.recordId)!.monsterResourceId = resourceId; break;
      case "troops": project.database.troops.find(r => r.id === target.recordId)!.previewBackgroundResourceId = resourceId; break;
      case "terrains": project.database.terrains!.find(r => r.id === target.recordId)!.battleBackgroundResourceId = resourceId; break;
      case "monsterSpecies": project.database.monsterSpecies!.find(r => r.id === target.recordId)!.graphic.monsterResourceId = resourceId; break;
    }
  } else if (target.kind === "title-layer") {
    project.system.titleScreen!.backgroundLayers![target.index]!.resourceId = resourceId;
  } else if (target.kind === "system") {
    const title = project.system.titleScreen ??= defaultTitleScreenSettings();
    if (target.field === "titleResourceId") {
      project.system.titleResourceId = resourceId;
      title.backgroundResourceId = resourceId;
    } else if (target.field === "titleScreen.backgroundResourceId") title.backgroundResourceId = resourceId;
    else {
      title.titleGraphic ??= { mode: "text", x: title.layout.titleX, y: title.layout.titleY };
      title.titleGraphic.resourceId = resourceId;
    }
  }
}
function proposedCommand(target: ImageJobDestination, id: string) {
  if (target.kind !== "event-draft") return null;
  if (target.binding === "show-picture" || target.binding === "change-face") return { ...target.command, resourceId: id };
  const fields = jsonObject(target.command.fields);
  return { ...target.command, fields: target.binding === "parallax"
    ? { ...fields, target: id, operation: "set", value: id, resourceId: id }
    : { ...fields, value: id } };
}

/** Generation only: returns an immutable typed proposal and (except reviewed event
 * drafts) private generated project. Never inserts into a live store or saves. */
export async function executeImageJob(input: AiJobInput & { family: "image" }, host: AiJobHost): Promise<AiJobResult> {
  const payload = parseImageJobPayload(input.payload);
  const target = parseImageJobDestination(input.target, payload.kind);
  assert(input.mode === "auto" || input.mode === "review", "Unsupported image application mode");
  assert(target.kind !== "event-draft" || input.mode === "review", "Event image drafts require review mode");
  const baseline = parseProject(await host.readJson(input.projectSnapshot));
  validateDestination(baseline, target);
  assert(!Object.hasOwn(baseline.assets.uploaded, payload.resourceId)
    && !baseline.resourceProfiles.some(r => r.assetId === payload.resourceId), "Allocated image resource ID already exists");
  const binding = jsonObject(jsonValue({ payload, target, baseSnapshot: input.projectSnapshot, project: input.project }));
  let responseRef: BlobRef | null = null, image: ImageStage | null = null;
  let completed = false, generatedSnapshot: BlobRef | null = null;
  const checkpoint = await host.loadCheckpoint();
  if (checkpoint) {
    assert(checkpoint.jobId === host.jobId && checkpoint.stageKey.startsWith("image/"), "Wrong image checkpoint job or stage");
    const state = requireRecord("image checkpoint", checkpoint.state);
    assert(state.version === 1 && bindingIdentity(jsonObject(state.binding)) === bindingIdentity(binding), "Image checkpoint binding mismatch");
    responseRef = state.responseRef === null ? null : imageRef(state.responseRef, "application/json");
    image = state.image === null ? null : parseImageStage(state.image);
    completed = requireBoolean("completed", state.completed);
    generatedSnapshot = state.generatedSnapshot === null ? null : imageRef(state.generatedSnapshot, "application/json");
    assert(!image || responseRef !== null, "Image checkpoint missing paid response");
    assert(!completed || image !== null, "Completed image checkpoint missing artwork");
    assert(completed ? (target.kind === "event-draft") === (generatedSnapshot === null) : generatedSnapshot === null, "Invalid image snapshot stage");
    for (const ref of [responseRef, image?.artifact, generatedSnapshot]) {
      if (ref) assert(checkpoint.artifacts.some(a => a.sha256 === ref.sha256 && a.byteLength === ref.byteLength && a.mediaType === ref.mediaType), "Image checkpoint artifact not retained");
    }
  }
  const artifacts = () => [responseRef, image?.artifact, generatedSnapshot].filter((r): r is BlobRef => r != null);
  const flush = (stageKey: string) => host.saveCheckpoint({ stageKey,
    state: jsonObject(jsonValue({ version: 1, binding, responseRef, image, completed, generatedSnapshot })), artifacts: artifacts() });
  if (image) {
    const retained = await decodeImageJobArtwork(imageJobDataUrl(await host.readBlob(image.artifact), image.artifact.mediaType), image.artifact.mediaType);
    assert(retained.width === image.width && retained.height === image.height, "Checkpoint image dimensions mismatch");
  } else {
    await flush("image/start");
    // The existing request encoder/response parser runs with an injected transport.
    // This is the ONLY paid boundary. It never fetches the nominal client URL.
    const generated = await generateAiImage({ prompt: payload.prompt, model: payload.model }, { fetch: async (_url, init) => {
      if (!responseRef) {
        const response = await host.providerOperation({ key: "image/provider/generate", request: {
          kind: "image", provider: IMAGE_GENERATION_PROVIDER_ID, body: jsonObject(JSON.parse(String(init?.body))),
        } });
        responseRef = await host.putJson(response);
        await flush("image/provider-response");
      }
      return new Response(JSON.stringify(await host.readJson(responseRef)), { headers: { "Content-Type": "application/json" } });
    } });
    const artwork = await postprocessImageJobArtwork(generated.dataUrl, generated.mimeType, payload.postprocess === "flatten");
    image = { artifact: await host.putBlob(artwork.bytes, artwork.mediaType), width: artwork.width, height: artwork.height,
      provider: generated.provider, model: generated.model };
    await flush("image/artwork");
  }
  const proposal: ImageJobProposal = { version: 1, kind: "create-image-and-link",
    resource: { id: payload.resourceId, name: payload.name, kind: payload.kind, artifact: image.artifact, width: image.width, height: image.height },
    destination: target, command: proposedCommand(target, payload.resourceId) };
  if (!completed) {
    if (target.kind !== "event-draft") {
      const draft = structuredClone(baseline);
      const dataUrl = imageJobDataUrl(await host.readBlob(image.artifact), image.artifact.mediaType);
      const id = insertGeneratedPictureAsset(draft, { id: payload.resourceId, name: payload.name, kind: payload.kind,
        dataUrl, width: image.width, height: image.height });
      assert(id === payload.resourceId, "Generated resource ID changed");
      linkPrivateProject(draft, target, id);
      parseProject(draft);
      generatedSnapshot = await host.putJson(jsonValue(draft));
    }
    completed = true;
    await flush("image/completed");
  } else if (generatedSnapshot) parseProject(await host.readJson(generatedSnapshot));
  return { version: 1, family: "image", jobId: host.jobId, attemptId: host.attemptId, project: input.project,
    baseSnapshot: input.projectSnapshot, generatedSnapshot, artifacts: artifacts(), payload: {
      completion: "complete", persistence: "not-applicable", checkpoint: "private-draft",
      provider: image.provider, model: image.model, proposal: jsonObject(jsonValue(proposal)),
    } };
}
