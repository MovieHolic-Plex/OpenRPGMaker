import type { TileSelection } from "@/editor/editorState";
import type { SpatialAuthoringOperation, SpatialAuthoringPreview, SpatialAuthoringResult } from "@/editor/spatial/authoringTypes";
import type { SpatialCompileRequest } from "@/editor/spatial/compilerTypes";
import { assertNever, freezeSpatial } from "@/project/spatial/domain";
import type { SpatialDesignReference, SpatialId, SpatialPoint } from "@/project/spatial/types";
import { authoringBuildProposal, editAuthoringDraft, previewAuthoringDraft, setAuthoringBuildInput, visibleAuthoringProject } from "./spatialAuthoringAccess";
import type { SpatialGalleryCard } from "./spatialCatalog";

export const MANUAL_SPATIAL_BUILD_VERSION = "manual-spatial-build-v1";
export type SpatialSourceBuildInput = {
  readonly rootId: SpatialId;
  readonly seed: number;
} & (
  | { readonly source: SpatialDesignReference<"object">; readonly destination: {
    readonly kind: "map";
    readonly currentMapId: string | null;
    readonly selection: Readonly<TileSelection> | null;
    readonly entry: SpatialPoint | null;
  } }
  | { readonly source: SpatialDesignReference<"space" | "place">; readonly destination: { readonly kind: "new-maps" } }
);
export type SpatialBuildProposal = {
  /** Keep these frozen inputs displayed if the current source/map selection changes. */
  readonly input: SpatialSourceBuildInput;
  readonly preview: SpatialAuthoringPreview | null;
};

export function spatialBuildProposal(): SpatialBuildProposal | null { return authoringBuildProposal(); }

/** Explicit build, distinct from source-save Preview. Apply stays in shared access. */
export function previewSpatialSourceBuild(value: SpatialSourceBuildInput): SpatialAuthoringResult<SpatialAuthoringPreview> {
  const input = freezeSpatial(structuredClone(value));
  const pending = spatialBuildProposal();
  if (pending) {
    if (JSON.stringify(pending.input) !== JSON.stringify(input)) {
      return { kind: "error", error: { code: "unsupported", message: "build-proposal-pending" } };
    }
  }
  if (!Number.isSafeInteger(input.seed)) {
    return { kind: "error", error: { code: "invalid", message: "build-seed-integer-required" } };
  }
  let compile: SpatialCompileRequest;
  switch (input.destination.kind) {
    case "new-maps":
      compile = { occurrenceId: input.rootId };
      break;
    case "map": {
      const { currentMapId, selection, entry } = input.destination;
      if (!currentMapId || !selection || selection.mapId !== currentMapId || !entry) {
        return { kind: "error", error: { code: "invalid", message: "build-map-selection-entry-required" } };
      }
      const { x, y, width, height } = selection;
      compile = { occurrenceId: input.rootId, target: { mapId: currentMapId, rect: { x, y, width, height }, entry } };
      break;
    }
    default: return assertNever(input.destination);
  }
  const operation: SpatialAuthoringOperation = pending && visibleAuthoringProject().spatialAuthoring?.occurrences[input.rootId]
    ? { kind: "edit" }
    : { kind: "instantiate", request: {
    source: input.source, rootId: input.rootId, seed: input.seed, x: 0, y: 0, level: 0,
    generatorVersion: MANUAL_SPATIAL_BUILD_VERSION, origin: "user",
  } };
  const draft = editAuthoringDraft(project => project, { operation, compile });
  switch (draft.kind) {
    case "error": return draft;
    case "ok":
      setAuthoringBuildInput(input);
      return previewAuthoringDraft();
    default: return assertNever(draft);
  }
}

/** Presentation IDs, coincident local IDs, labels and kit IDs are not source identity. */
export function resolveSpatialBuildSource(card: SpatialGalleryCard | undefined): SpatialAuthoringResult<SpatialDesignReference<"object" | "space" | "place">> {
  if (!card?.canonicalSource || card.compatibility || card.source === "placed") {
    return { kind: "error", error: { code: "unsupported", message: "canonical-copy-required" } };
  }
  const source = card.canonicalSource;
  const library = visibleAuthoringProject().spatialAuthoring?.library;
  if (!library) return { kind: "error", error: { code: "invalid", message: "canonical-source-missing" } };
  switch (source.kind) {
    case "object": case "space": case "place": {
      const records = { object: library.objects, space: library.spaces, place: library.places };
      if (!Object.hasOwn(records[source.kind], source.id)) {
        return { kind: "error", error: { code: "invalid", message: "canonical-source-missing" } };
      }
      return { kind: "ok", value: { kind: source.kind, id: source.id } };
    }
    case "region": case "world":
      return { kind: "error", error: { code: "unsupported", message: "manual-build-kind-unsupported" } };
    default: return assertNever(source.kind);
  }
}
