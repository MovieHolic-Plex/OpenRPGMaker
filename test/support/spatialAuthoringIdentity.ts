import type {
  SpatialAuthoringController,
  SpatialAuthoringDraft,
  SpatialAuthoringPreview,
} from "@/editor/spatial/authoringTypes";
import { compileSpaces } from "@/editor/spatial/compileSpaces";
import { requireOccurrenceAssociations } from "@/project/spatial/domain";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

/** WeakMap identity matches src/editor/spatial/actions.ts. Not a second production authority. */
export function identityAuthoringController(): SpatialAuthoringController {
  const drafts = new WeakMap<SpatialAuthoringDraft, true>();
  const previews = new WeakMap<SpatialAuthoringPreview, true>();
  const applied = new WeakSet<SpatialAuthoringPreview>();
  return {
    createDraft: () => {
      const draft = { project: structuredClone(store.getCurrent()) };
      drafts.set(draft, true);
      return { kind: "ok", value: draft };
    },
    continueDraft: (preview) => {
      if (!previews.has(preview)) {
        return { kind: "error", error: { code: "foreign-preview", message: "Preview belongs to another controller" } };
      }
      if (applied.has(preview)) {
        return { kind: "error", error: { code: "already-applied", message: "Preview has already been accepted" } };
      }
      const draft = { project: structuredClone(preview.project) };
      drafts.set(draft, true);
      return { kind: "ok", value: draft };
    },
    preview: (draft, request) => {
      if (!drafts.has(draft)) {
        return { kind: "error", error: { code: "foreign-draft", message: "Draft belongs to another controller" } };
      }
      try {
        if (request.compile) {
          const document = draft.project.spatialAuthoring;
          const occurrence = document?.occurrences[request.compile.occurrenceId];
          if (!document || !occurrence) {
            return { kind: "error", error: { code: "invalid", message: "compile.occurrenceId" } };
          }
          compileSpaces({
            project: draft.project,
            document,
            occurrence: requireOccurrenceAssociations(occurrence),
          });
        }
      } catch (error) {
        return {
          kind: "error",
          error: { code: "invalid", message: error instanceof Error ? error.message : "compile" },
        };
      }
      const preview = { project: draft.project, impact: { mapIds: [], occurrenceIds: [], events: [] } };
      previews.set(preview, true);
      return { kind: "ok", value: preview };
    },
    apply: (preview) => {
      if (!previews.has(preview)) {
        return { kind: "error", error: { code: "foreign-preview", message: "Preview belongs to another controller" } };
      }
      if (applied.has(preview)) {
        return { kind: "error", error: { code: "already-applied", message: "Preview has already been accepted" } };
      }
      store.replace(preview.project);
      applied.add(preview);
      return { kind: "ok", value: { changed: true, impact: preview.impact } };
    },
    undo: () => false,
    redo: () => false,
  };
}

export function reconstructDraft(project: Project): SpatialAuthoringDraft {
  return { project };
}
