import {
  editAuthoringDraft,
  previewAuthoringDraft,
  retainAuthoringPreview,
  spatialAuthoringController,
  spatialAuthoringErrorText,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import { MANUAL_SPATIAL_BUILD_VERSION } from "@/editor/panels/spatialBuildActions";
import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { FACILITY_FLOOR_MAX, type PlaceChildPick, type PlaceDraftTarget } from "@/editor/panels/spatialPlaceDraft";
import {
  openPlacedSpatialDestination,
  openSpatialDestination,
  pushSpatialBreadcrumb,
  selectSpatialDesign,
  spatialSession,
} from "@/editor/panels/spatialAuthoringSession";
import { libraryPlaceCardId, newConnectionId } from "@/editor/panels/spatialPlaceQuery";
import { librarySpaceCardId } from "@/editor/panels/spatialSpaceDraft";
import { spatialAuthoringCompileScope } from "@/editor/spatial/authoringScope";
import type { SpatialConnectionEdit } from "@/editor/spatial/authoringTypes";
import {
  placedPlaceChildren,
  previewPlacedPlaceEdit,
  type PlacedPlaceChild,
  type PlacedPlaceEdit,
} from "@/editor/spatial/placedPlaceEdits";
import { occurrenceSubtree } from "@/project/spatial/ownership";
import {
  assertNever,
  own,
  requireOccurrenceAssociations,
  resolveOccurrencePortId,
  spatialId,
} from "@/project/spatial/domain";
import type { PlaceDesign, SpatialConnection, SpatialId } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { genId } from "@/util/id";

export type PlacePortChoice = {
  readonly occurrenceId: SpatialId;
  readonly localPortId: SpatialId;
  readonly portId: SpatialId;
  readonly name: string;
  readonly label: string;
};

function note(result: ReturnType<typeof spatialAuthoringErrorText>, saveState?: string): void {
  placeChromeState.previewError = result;
  if (saveState !== undefined) placeChromeState.saveState = saveState;
}

function compileFor(occurrenceId: SpatialId) {
  const document = visibleAuthoringProject().spatialAuthoring;
  if (!document) throw new TypeError("missing spatialAuthoring");
  return spatialAuthoringCompileScope(document, occurrenceId);
}

export function previewPlacedPlaceChange(edit: PlacedPlaceEdit): boolean {
  const controller = spatialAuthoringController();
  if (!controller) {
    note("authoring-controller-unavailable");
    return false;
  }
  const drafted = editAuthoringDraft((project) => project);
  if (drafted.kind !== "ok") {
    note(spatialAuthoringErrorText(drafted));
    return false;
  }
  try {
    const previewed = previewPlacedPlaceEdit(controller, drafted.value, { edit, compile: compileFor(edit.parentId) });
    if (previewed.kind !== "ok") {
      note(spatialAuthoringErrorText(previewed));
      return false;
    }
    const retained = retainAuthoringPreview(previewed.value);
    note(spatialAuthoringErrorText(retained), retained.kind === "ok" ? "미리보기" : placeChromeState.saveState);
    return retained.kind === "ok";
  } catch (error) {
    note(error instanceof Error ? error.message : String(error));
    return false;
  }
}

export function addPlacedPickerChild(parentId: SpatialId, slot: PlaceChildPick): boolean {
  const seed = placeChromeState.buildSeed;
  if (seed === null) {
    note("build-seed-integer-required");
    return false;
  }
  return previewPlacedPlaceChange({
    kind: "add",
    parentId,
    rootId: spatialId(genId("place-root")),
    seed,
    generatorVersion: MANUAL_SPATIAL_BUILD_VERSION,
    slot: { ...slot, id: spatialId(genId("place-child")), x: 4, y: 4 },
  });
}

export function movePlacedChild(
  parentId: SpatialId,
  child: PlacedPlaceChild,
  position: { readonly x: number; readonly y: number; readonly level: number },
): boolean {
  return previewPlacedPlaceChange({
    kind: "move",
    parentId,
    slot: { slotId: child.slotId, index: child.index },
    position,
  });
}

export function deletePlacedChild(parentId: SpatialId, child: PlacedPlaceChild): boolean {
  return previewPlacedPlaceChange({
    kind: "delete",
    parentId,
    slot: { slotId: child.slotId, index: child.index },
    externalConnections: "reject",
  });
}

export function setPlacedChildLevel(parentId: SpatialId, child: PlacedPlaceChild, level: number, kind: PlaceDesign["kind"]): boolean {
  if (kind === "facility" && (!Number.isInteger(level) || level < 1 || level > FACILITY_FLOOR_MAX)) {
    note("floor-limit");
    return false;
  }
  return movePlacedChild(parentId, child, { x: child.x, y: child.y, level });
}

export function selectedPlacedChild(project: Project, parentId: SpatialId): PlacedPlaceChild | undefined {
  return placedPlaceChildren(project, parentId).find((child) => child.occurrenceId === placeChromeState.selectedChildId);
}

export function placedPortChoices(project: Project, parentId: SpatialId): readonly PlacePortChoice[] {
  const document = project.spatialAuthoring;
  if (!document) return [];
  const names = new Map(placedPlaceChildren(project, parentId).map((child) => [child.occurrenceId, child.name]));
  const choices: PlacePortChoice[] = [];
  for (const id of occurrenceSubtree(document, parentId)) {
    if (id === parentId) continue;
    const occurrence = document.occurrences[id];
    if (occurrence?.parentSlot === undefined) continue;
    const associated = requireOccurrenceAssociations(occurrence);
    const owner = names.get(id) ?? associated.source.id;
    for (const port of associated.snapshot.ports) {
      choices.push({
        occurrenceId: associated.id,
        localPortId: port.localPortId,
        portId: port.id,
        name: port.name,
        label: `${owner} / ${port.name}`,
      });
    }
  }
  return choices;
}

export function ordinaryPlacedConnections(project: Project, parentId: SpatialId): readonly SpatialConnection[] {
  const document = project.spatialAuthoring;
  if (!document) return [];
  const members = new Set(occurrenceSubtree(document, parentId));
  return document.connections.filter((link) => (
    link.overviewRoute === undefined
    && members.has(link.from.occurrenceId)
    && members.has(link.to.occurrenceId)
  ));
}

export function previewPlaceConnection(parentId: SpatialId, request: SpatialConnectionEdit): boolean {
  try {
    const compiled = { operation: { kind: "edit-connection" as const, request }, compile: compileFor(parentId) };
    const edited = editAuthoringDraft((project) => project, compiled);
    if (edited.kind !== "ok") {
      note(spatialAuthoringErrorText(edited));
      return false;
    }
    const previewed = previewAuthoringDraft();
    note(spatialAuthoringErrorText(previewed), previewed.kind === "ok" ? "미리보기" : placeChromeState.saveState);
    return previewed.kind === "ok";
  } catch (error) {
    note(error instanceof Error ? error.message : String(error));
    return false;
  }
}

export function submitPlacedConnection(project: Project, parentId: SpatialId): boolean {
  const from = placedPortChoices(project, parentId).find((choice) => (
    choice.occurrenceId === placeChromeState.connectFromId && choice.localPortId === placeChromeState.connectFromPort
  ));
  const to = placedPortChoices(project, parentId).find((choice) => (
    choice.occurrenceId === placeChromeState.connectToId && choice.localPortId === placeChromeState.connectToPort
  ));
  if (!from || !to) {
    note("missing-floor");
    return false;
  }
  const fromOcc = own(project.spatialAuthoring?.occurrences ?? {}, from.occurrenceId);
  const toOcc = own(project.spatialAuthoring?.occurrences ?? {}, to.occurrenceId);
  const connection = {
    id: placeChromeState.selectedConnectionId ?? newConnectionId(),
    from: { occurrenceId: from.occurrenceId, portId: resolveOccurrencePortId(fromOcc, from.localPortId) },
    to: { occurrenceId: to.occurrenceId, portId: resolveOccurrencePortId(toOcc, to.localPortId) },
    bidirectional: placeChromeState.connectBidirectional,
  };
  const existing = ordinaryPlacedConnections(project, parentId).some((link) => link.id === connection.id);
  const ok = previewPlaceConnection(parentId, existing
    ? { kind: "replace", connection }
    : { kind: "create", connection });
  if (ok) placeChromeState.selectedConnectionId = connection.id;
  return ok;
}

export function removePlacedConnection(parentId: SpatialId, connectionId: SpatialId): boolean {
  return previewPlaceConnection(parentId, { kind: "remove", connectionId });
}

export function openPlaceChild(target: PlaceDraftTarget, place: PlaceDesign, project: Project): void {
  const selected = placeChromeState.selectedChildId;
  if (!selected) return;
  if (target.occurrenceId && spatialSession().mode === "instances") {
    const child = placedPlaceChildren(project, target.occurrenceId).find((entry) => entry.occurrenceId === selected);
    if (!child) return;
    pushSpatialBreadcrumb();
    openPlacedSpatialDestination(child.destination);
    return;
  }
  const child = place.children.find((entry) => entry.id === selected);
  if (!child) return;
  pushSpatialBreadcrumb();
  switch (child.source.kind) {
    case "space":
      openSpatialDestination("spaces", librarySpaceCardId(child.source.id));
      return;
    case "place":
      selectSpatialDesign(libraryPlaceCardId(child.source.id));
      return;
    default:
      return assertNever(child.source.kind);
  }
}

export function containingPlacedChild(
  project: Project,
  parentId: SpatialId,
  occurrenceId: SpatialId,
): PlacedPlaceChild | undefined {
  const children = placedPlaceChildren(project, parentId);
  let current: SpatialId | null = occurrenceId;
  const document = project.spatialAuthoring;
  while (current && current !== parentId) {
    const match = children.find((child) => child.occurrenceId === current);
    if (match) return match;
    current = document?.occurrences[current]?.parentId ?? null;
  }
  return undefined;
}
