import type { Project } from "@/project/types";
import type { SpatialChildSlot, SpatialId, SpatialLibrary } from "@/project/spatial/types";
import { checkedDocument } from "@/project/spatial/domain";
import { FACILITY_FLOOR_MAX, isFacilityChildLevelAllowed } from "@/project/spatial/facilityLevels";
import { createNewPlace, type NewPlaceOptions } from "./spatialNewPlace";
import { freshSpatialId } from "./spatialSpaceDraft";
import { nestChild, placeFromProject, upsertPlaceDesign, type PlaceDraftTarget } from "./spatialPlaceDraft";
import { placedPlaceChildren, previewPlacedPlaceEdit } from "@/editor/spatial/placedPlaceEdits";
import { spatialAuthoringCompileScope } from "@/editor/spatial/authoringScope";
import { editAuthoringDraft, previewPreparedAuthoringDraft, spatialAuthoringErrorText } from "./spatialAuthoringAccess";
import { placeChromeState } from "./spatialPlaceChromeState";

function span(library: SpatialLibrary, source: SpatialChildSlot<"space" | "place">["source"], depth = 0): number {
  if (depth > 128) throw new Error("장소 구성이 너무 깊습니다.");
  if (source.kind === "space") {
    const room = library.spaces[source.id];
    return room.composition?.width ?? room.width + (room.environment === "interior" ? 4 : 0);
  }
  const place = library.places[source.id];
  return place.composition?.width ?? Math.max(0, ...place.children.map(child => child.x + span(library, child.source, depth + 1)));
}

export function preparePlaceRoom(project: Project, target: PlaceDraftTarget, options: NewPlaceOptions, level: number) {
  const place = placeFromProject(project, target);
  if (!place || !project.spatialAuthoring) throw new Error("방을 추가할 장소를 찾을 수 없습니다.");
  if (options.kind === "building") throw new Error("추가할 방은 실내 또는 실외로 선택해 주세요.");
  if (!Number.isInteger(level) || level < 0 || level > FACILITY_FLOOR_MAX) throw new Error(`층을 0~${FACILITY_FLOOR_MAX} 사이로 입력해 주세요.`);
  if (place.composition) throw new Error("직접 칠한 장소의 방 구성은 아직 지원하지 않습니다.");
  const created = createNewPlace(project, options);
  const source = { kind: "space" as const, id: created.source.id };
  const children = target.occurrenceId ? placedPlaceChildren(project, target.occurrenceId) : place.children;
  const right = Math.max(0, ...children.filter(child => child.level === level).map(child => {
    const library = "occurrenceId" in child ? project.spatialAuthoring!.occurrences[child.occurrenceId].snapshot.library : project.spatialAuthoring!.library;
    return child.x + span(library, child.source);
  }));
  const slot: SpatialChildSlot<"space" | "place"> = { id: freshSpatialId(created.project, "room-slot"), source, x: right ? right + 4 : 0, y: 0, level };
  if (place.kind === "facility" && !isFacilityChildLevelAllowed(created.project.spatialAuthoring!.library, slot)) {
    throw new Error(`실내는 1~${FACILITY_FLOOR_MAX}층에, 마당은 0층에 추가해 주세요.`);
  }
  if (target.occurrenceId) return { project: created.project, slot };
  const nested = nestChild(place, created.project.spatialAuthoring!.library, slot);
  if (nested.kind !== "ok") throw new Error("이 장소에 방을 추가할 수 없습니다.");
  const next = upsertPlaceDesign(created.project, { ...nested.place, revision: place.revision + 1 });
  checkedDocument(next.spatialAuthoring, next);
  return { project: next, slot };
}

export function addNewPlaceRoom(target: PlaceDraftTarget, options: NewPlaceOptions, level: number): string | null {
  let newSlot: SpatialChildSlot<"space" | "place"> | undefined;
  let rootId: SpatialId | undefined;
  const mutate = (project: Project): Project => {
    const prepared = preparePlaceRoom(project, target, options, level);
    newSlot = prepared.slot;
    return prepared.project;
  };
  const result = target.occurrenceId ? previewPreparedAuthoringDraft(mutate, (controller, draft) => {
    const preparedProject = draft.project;
    if (!newSlot) throw new Error("새 방을 찾을 수 없습니다.");
    rootId = freshSpatialId(preparedProject, "room-occurrence");
    return previewPlacedPlaceEdit(controller, draft, { edit: { kind: "add", parentId: target.occurrenceId!, rootId,
      slot: newSlot, seed: 7, generatorVersion: "place-room-editor-v1" },
      compile: spatialAuthoringCompileScope(preparedProject.spatialAuthoring!, target.occurrenceId!) });
  }) : editAuthoringDraft(mutate);
  const issue = spatialAuthoringErrorText(result);
  if (result.kind === "ok") {
    placeChromeState.selectedChildId = rootId ?? newSlot?.id ?? null;
    placeChromeState.selectedFloor = level;
    placeChromeState.previewError = null;
    placeChromeState.saveState = target.occurrenceId ? "미리보기" : "초안";
  }
  return issue;
}
