import type {
  CreateSpatialAuthoringController,
  SpatialAuthoringApplied,
  SpatialAuthoringController,
  SpatialAuthoringDraft,
  SpatialAuthoringPreview,
  SpatialAuthoringRequest,
  SpatialAuthoringResult,
} from "@/editor/spatial/authoringTypes";
import { patchSpatialSession, spatialProjectKey } from "@/editor/panels/spatialAuthoringSession";
import { assertNever, freezeSpatial } from "@/project/spatial/domain";
import type { SpatialBuildProposal, SpatialSourceBuildInput } from "./spatialBuildActions";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

/** Retain an external adapter's exact issued handle; never adopt its project as raw edits. */
export function retainAuthoringPreview(preview: SpatialAuthoringPreview): SpatialAuthoringResult<SpatialAuthoringPreview> {
  const controller = spatialAuthoringController();
  if (!controller) return { kind: "error", error: { code: "unsupported", message: "authoring-controller-unavailable" } };
  const current = activeSession();
  const ancestor = current.preview ?? current.draft;
  const continued = controller.continueDraft(preview, ancestor ?? undefined);
  switch (continued.kind) {
    case "error": return continued;
    case "ok": {
      if (!ancestor) return { kind: "error", error: { code: "stale", message: "No active shared authoring generation",
        detail: "authoring-session-lineage" } };
      current.draft = continued.value;
      current.preview = preview;
      current.request = { operation: { kind: "edit" } };
      return { kind: "ok", value: preview };
    }
    default: return assertNever(continued);
  }
}

type AuthoringUiSession = {
  readonly key: string;
  draft: SpatialAuthoringDraft | null;
  preview: SpatialAuthoringPreview | null;
  request: SpatialAuthoringRequest;
  buildInput: SpatialSourceBuildInput | null;
};

let factory: CreateSpatialAuthoringController | null = null;
let instance: SpatialAuthoringController | null = null;
let session: AuthoringUiSession | null = null;

export function bindSpatialAuthoringControllerFactory(next: CreateSpatialAuthoringController | null): void {
  factory = next;
  instance = null;
  session = null;
}

export function spatialAuthoringController(): SpatialAuthoringController | null {
  if (instance) return instance;
  if (!factory) return null;
  instance = factory();
  return instance;
}

function activeSession(): AuthoringUiSession {
  const key = spatialProjectKey();
  if (session?.key === key) return session;
  session = { key, draft: null, preview: null, request: { operation: { kind: "edit" } }, buildInput: null };
  return session;
}

export function visibleAuthoringProject(): Project {
  const current = activeSession();
  return current.preview?.project ?? current.draft?.project ?? store.getCurrent();
}

export function hasAuthoringDraft(): boolean {
  return activeSession().draft !== null;
}

export function hasAuthoringPreview(): boolean {
  return activeSession().preview !== null;
}

/** 미리보기만 걷어 초안으로 되돌린다 — Escape 의 "한 단계 뒤로" 계층. */
export function dismissAuthoringPreview(): void {
  const current = activeSession();
  current.preview = null;
  current.buildInput = null;
}

/** Build disclosure has the same project/session lifetime as its issued handles. */
export function authoringBuildProposal(): SpatialBuildProposal | null {
  const current = activeSession();
  return current.buildInput ? { input: current.buildInput, preview: current.preview } : null;
}

export function setAuthoringBuildInput(input: SpatialSourceBuildInput): void {
  activeSession().buildInput = freezeSpatial(structuredClone(input));
}

export function clearAuthoringSession(): void {
  const key = spatialProjectKey();
  if (session?.key === key) session = null;
}

export function editAuthoringDraft(
  mutate: (project: Project) => Project,
  request: SpatialAuthoringRequest = { operation: { kind: "edit" } },
): SpatialAuthoringResult<SpatialAuthoringDraft> {
  const controller = spatialAuthoringController();
  if (!controller) {
    return { kind: "error", error: { code: "unsupported", message: "authoring-controller-unavailable" } };
  }
  const current = activeSession();
  // Each shared edit forks an issued generation, even when contents return to an older value.
  // Existing external adapter handles retain their old ancestry rather than following mutation.
  const issued = current.preview
    ? controller.continueDraft(current.preview)
    : controller.createDraft(current.draft ?? undefined);
  switch (issued.kind) {
    case "error": return issued;
    case "ok":
      Object.assign(issued.value.project, mutate(structuredClone(issued.value.project)));
      current.draft = issued.value;
      current.preview = null;
      current.request = request;
      return issued;
    default: return assertNever(issued);
  }
}

export function previewAuthoringDraft(): SpatialAuthoringResult<SpatialAuthoringPreview> {
  const controller = spatialAuthoringController();
  const current = activeSession();
  if (!controller || !current.draft) {
    return { kind: "error", error: { code: "unsupported", message: "authoring-draft-missing" } };
  }
  const result = controller.preview(current.draft, current.request);
  switch (result.kind) {
    case "ok":
      current.preview = result.value;
      return result;
    case "error":
      current.preview = null;
      return result;
    default: return assertNever(result);
  }
}

export function applyAuthoringPreview(): SpatialAuthoringResult<SpatialAuthoringApplied> {
  const controller = spatialAuthoringController();
  const current = activeSession();
  if (!controller) {
    return { kind: "error", error: { code: "unsupported", message: "authoring-controller-unavailable" } };
  }
  if (!current.preview) {
    return { kind: "error", error: { code: "unsupported", message: "authoring-preview-missing" } };
  }
  const result = controller.apply(current.preview);
  switch (result.kind) {
    case "ok":
      if (current.buildInput && current.preview.project.spatialAuthoring?.occurrences[current.buildInput.rootId]) {
        const tabs = { object: "objects", space: "spaces", place: "places" } as const;
        patchSpatialSession({ tab: tabs[current.buildInput.source.kind], mode: "instances",
          occurrenceId: current.buildInput.rootId, designId: null });
      }
      session = { key: current.key, draft: null, preview: null, request: { operation: { kind: "edit" } }, buildInput: null };
      return result;
    case "error":
      return result;
    default: return assertNever(result);
  }
}

export function spatialAuthoringErrorText(result: SpatialAuthoringResult<unknown>): string | null {
  switch (result.kind) {
    case "ok": return null;
    case "error": return result.error.detail ?? result.error.message;
    default: return assertNever(result);
  }
}
