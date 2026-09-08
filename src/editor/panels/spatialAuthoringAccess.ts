import type {
  CreateSpatialAuthoringController,
  SpatialAuthoringApplied,
  SpatialAuthoringController,
  SpatialAuthoringDraft,
  SpatialAuthoringPreview,
  SpatialAuthoringRequest,
  SpatialAuthoringResult,
} from "@/editor/spatial/authoringTypes";
import { spatialProjectKey } from "@/editor/panels/spatialAuthoringSession";
import { assertNever } from "@/project/spatial/domain";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

type AuthoringUiSession = {
  readonly key: string;
  draft: SpatialAuthoringDraft | null;
  preview: SpatialAuthoringPreview | null;
  request: SpatialAuthoringRequest;
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
  session = { key, draft: null, preview: null, request: { operation: { kind: "edit" } } };
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
  if (!current.draft) {
    const created = controller.createDraft();
    switch (created.kind) {
      case "error": return created;
      case "ok":
        current.draft = created.value;
        break;
      default: return assertNever(created);
    }
  }
  if (current.preview) {
    const continued = controller.continueDraft(current.preview);
    switch (continued.kind) {
      case "error": return continued;
      case "ok":
        current.draft = continued.value;
        current.preview = null;
        break;
      default: return assertNever(continued);
    }
  }
  current.request = request;
  Object.assign(current.draft.project, mutate(structuredClone(current.draft.project)));
  return { kind: "ok", value: current.draft };
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
      session = { key: current.key, draft: null, preview: null, request: { operation: { kind: "edit" } } };
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
