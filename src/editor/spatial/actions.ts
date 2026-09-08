import { applyProjectWithHistory, redoMapEdit, undoMapEdit } from "@/editor/mapEditHistory";
import { ToolError } from "@/editor/tools/types";
import { deserialize } from "@/project/io";
import { ProjectFormatError } from "@/project/io/errors";
import { SpatialOperationError } from "@/project/spatial/domain";
import { ProjectRoutingError } from "@/project/spatial/saveRouting";
import { store } from "@/project/store";
import { sha256HexTextSync } from "@/util/sha256";
import type { SpatialAuthoringController, SpatialAuthoringDraft, SpatialAuthoringPreview, SpatialAuthoringResult } from "./authoringTypes";
import { SpatialCompileError } from "./compilerTypes";
import { previewSpatialAuthoring } from "./preview";

function baseline(): string {
  // Full logical document, source library, shared assets, target content and project identity.
  // Do not reduce this to binding digests: association-only changes must invalidate previews.
  return sha256HexTextSync(JSON.stringify([store.getProjectIdentity(), store.getCurrent()]));
}
function result<T>(action: () => T): SpatialAuthoringResult<T> {
  try { return { kind: "ok", value: action() }; }
  catch (error) {
    if (error instanceof SpatialCompileError) return { kind: "error", error: {
      code: error.code === "kind" ? "unsupported" : error.code === "ownership" ? "ownership" : "invalid",
      message: error.message, detail: error.code,
    } };
    if (error instanceof ToolError) return { kind: "error", error: {
      code: "invalid", message: error.message, detail: error.code,
    } };
    if (error instanceof ProjectFormatError || error instanceof SpatialOperationError || error instanceof ProjectRoutingError) {
      return { kind: "error", error: { code: "invalid", message: error.message } };
    }
    throw error;
  }
}

/** Weak handles only bind detached proposals to their original source, never own live state. */
export function createSpatialAuthoringController(): SpatialAuthoringController {
  const drafts = new WeakMap<SpatialAuthoringDraft, string>();
  // Only an exact issued frozen preview can establish a continuation's protected output.
  const checkpoints = new WeakMap<SpatialAuthoringDraft, SpatialAuthoringPreview>();
  const previews = new WeakMap<SpatialAuthoringPreview, string>();
  const applied = new WeakSet<SpatialAuthoringPreview>();
  // Immutable issuance edges, not source/content equality. Forks are distinct edit generations.
  type Handle = SpatialAuthoringDraft | SpatialAuthoringPreview;
  const parents = new WeakMap<Handle, Handle>();
  return {
    createDraft(from) {
      const expected = from ? drafts.get(from) : baseline();
      if (expected === undefined) return { kind: "error", error: { code: "foreign-draft", message: "Draft belongs to another controller" } };
      if (expected !== baseline()) return { kind: "error", error: { code: "stale", message: "Project changed since draft creation" } };
      return result(() => {
        const draft = { project: structuredClone(from?.project ?? store.getCurrent()) };
        drafts.set(draft, expected);
        if (from) {
          parents.set(draft, from);
          const checkpoint = checkpoints.get(from);
          if (checkpoint) checkpoints.set(draft, checkpoint);
        }
        return draft;
      });
    },
    continueDraft(preview, ancestor) {
      const expected = previews.get(preview);
      if (expected === undefined) return { kind: "error", error: { code: "foreign-preview", message: "Preview belongs to another controller" } };
      if (applied.has(preview)) return { kind: "error", error: { code: "already-applied", message: "Preview has already been accepted" } };
      if (expected !== baseline()) return { kind: "error", error: { code: "stale", message: "Project changed since preview" } };
      if (ancestor) {
        let cursor: Handle | undefined = preview;
        while (cursor && cursor !== ancestor) cursor = parents.get(cursor);
        if (!cursor) return { kind: "error", error: { code: "stale", message: "Preview superseded by shared authoring edits",
          detail: "authoring-session-lineage" } };
      }
      return result(() => {
        const draft = { project: structuredClone(preview.project) };
        drafts.set(draft, expected);
        checkpoints.set(draft, preview);
        parents.set(draft, preview);
        return draft;
      });
    },
    preview(draft, request) {
      const expected = drafts.get(draft);
      if (expected === undefined) return { kind: "error", error: { code: "foreign-draft", message: "Draft belongs to another controller" } };
      if (expected !== baseline()) return { kind: "error", error: { code: "stale", message: "Project changed since draft creation" } };
      return result(() => {
        const original = store.getCurrent();
        const preview = previewSpatialAuthoring(draft.project, request, {
          original, checkpoint: checkpoints.get(draft)?.project ?? original,
        });
        previews.set(preview, expected);
        parents.set(preview, draft);
        return preview;
      });
    },
    apply(preview) {
      const expected = previews.get(preview);
      if (expected === undefined) return { kind: "error", error: { code: "foreign-preview", message: "Preview belongs to another controller" } };
      if (applied.has(preview)) return { kind: "error", error: { code: "already-applied", message: "Preview has already been accepted" } };
      if (expected !== baseline()) return { kind: "error", error: { code: "stale", message: "Project changed since preview" } };
      return result(() => {
        const project = deserialize(JSON.stringify(preview.project));
        const before = store.getCurrent();
        let published = false;
        const release = store.subscribe(() => { published = true; });
        // Reserve before observers can undo adoption and restore this handle's baseline.
        applied.add(preview);
        try {
          const changed = applyProjectWithHistory(project, "Spatial authoring");
          return { changed, impact: preview.impact };
        } catch (error) {
          // Only a genuinely pre-adoption rejection makes the same handle retryable.
          if (!published && store.getCurrent() === before) applied.delete(preview);
          throw error;
        } finally { release(); }
      });
    },
    undo: undoMapEdit,
    redo: redoMapEdit,
  };
}
