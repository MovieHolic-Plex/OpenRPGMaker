import { applyProjectWithHistory, getMapEditHistoryEntries, getMapEditHistoryMarker, hasRevertDraftConflict, revertToHistoryMarker, undoMapEdit } from "@/editor/mapEditHistory";
import { eventDraftHasUserChanges, eventWithoutDraft, projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import { store } from "@/project/store";
import type { GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { PrimitiveError } from "./primitives/errors";
import { assertUnit20DraftReferences } from "./primitives/units/20-db-enemies-troops/references";
import { refuseReferencedRemoval } from "./primitives/units/30-common-events/validation";
import { SmallTaskError, type SmallTaskTarget } from "./target";

function withEvent(project: Project, mapId: string, event: GameEvent): Project {
  const map = project.maps[mapId];
  const exists = map.events.some(e => e.id === event.id);
  const events = exists ? map.events.map(e => e.id === event.id ? event : e) : [...map.events, event];
  return { ...project, maps: { ...project.maps, [mapId]: { ...map, events } } };
}

/** The model sees the working event the user sees, without draft metadata or other open drafts. */
export function smallTaskBase(live: Project, target: SmallTaskTarget): Project {
  const base = projectViewWithoutEventDrafts(live);
  if (target.kind !== "event") return base;
  const event = live.maps[target.mapId]?.events.find(e => e.id === target.eventId);
  return event?.draft ? withEvent(base, target.mapId, eventWithoutDraft(event)) : base;
}

export function commitSmallTask(live: Project, before: Project, after: Project, target: SmallTaskTarget) {
  if (store.getCurrent() !== live) throw new SmallTaskError("작업 중 프로젝트가 바뀌었어요. 다시 요청해 주세요.");
  if (jsonEqual(before, after)) return null;
  if (before.commonEvents !== after.commonEvents) {
    const remaining = new Set(after.commonEvents.map(event => event.id));
    try {
      for (const event of before.commonEvents) {
        if (!remaining.has(event.id)) refuseReferencedRemoval(after, event.id, live);
      }
    } catch (error) {
      if (error instanceof PrimitiveError) throw new SmallTaskError(error.message);
      throw error;
    }
  }
  if (target.kind === "dbEntry" && live !== before) assertUnit20DraftReferences(before, after, live, target);
  const event = target.kind === "event" ? live.maps[target.mapId].events.find(e => e.id === target.eventId) : undefined;
  let proposal = after;
  if (target.kind === "event" && event?.draft) {
    const edited = after.maps[target.mapId].events.find(e => e.id === event.id);
    if (!edited) throw new SmallTaskError("편집 중인 이벤트를 찾을 수 없어요.");
    // A clean editor reflects the new canonical event. Keep unsaved hand edits/new events in their original draft.
    const clean = event.draft.kind === "edit" && !event.draft.conflict && !eventDraftHasUserChanges(live, target.mapId, event.id);
    const draft = clean ? { ...event.draft, original: eventWithoutDraft(edited) } : event.draft;
    proposal = withEvent(after, target.mapId, { ...edited, draft });
  }
  const mapId = target.kind === "dbEntry" ? undefined : target.mapId;
  const afterEvents = mapId ? new Map(after.maps[mapId].events.map(event => [event.id, event])) : null;
  const refreshCleanEventDrafts = mapId ? before.maps[mapId].events
    .filter(event => !jsonEqual(event, afterEvents?.get(event.id)))
    .map(event => ({ mapId, eventId: event.id })) : [];
  const marker = getMapEditHistoryMarker();
  const lineage = store.getVersionToken().lineage;
  const applied = applyProjectWithHistory(proposal, `작은 일 · ${target.label}`, {
    origin: "ai", separateStep: true, mapId, refreshCleanEventDrafts,
    workingEvent: event?.draft && target.kind === "event" ? target : undefined,
  });
  if (!applied) return null;
  const committed = store.getCurrent();
  return {
    async undo(confirmLaterEdits: () => Promise<boolean>, onDraftConflict?: () => void): Promise<boolean> {
      const find = () => store.getVersionToken().lineage === lineage && getMapEditHistoryEntries().find(e => e.at === marker);
      const entry = find();
      if (!entry) return false;
      if (hasRevertDraftConflict(entry.index)) {
        onDraftConflict?.();
        return false;
      }
      const current = store.getCurrent();
      if (entry.steps === 1 && (committed === current
        || jsonEqual(projectViewWithoutEventDrafts(committed), projectViewWithoutEventDrafts(current)))) return undoMapEdit();
      const version = store.getVersionToken();
      if (!await confirmLaterEdits() || !find() || !jsonEqual(version, store.getVersionToken())) return false;
      return revertToHistoryMarker(marker);
    },
  };
}
