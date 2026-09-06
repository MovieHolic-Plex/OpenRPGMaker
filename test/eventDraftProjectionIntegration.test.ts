/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it } from "vitest";
import { createDefaultGameEvent } from "@/editor/eventActions";
import { editorState } from "@/editor/editorState";
import { validateEventDraft } from "@/editor/eventDraftValidator";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { store } from "@/project/store";

let mapId: string;
const eventId = "projection-integration";
function control(id: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
}
beforeEach(() => {
  resetModalStackForTest();
  const project = createBlankProject();
  mapId = project.startMapId;
  const event = createDefaultGameEvent(2, 2);
  event.id = eventId;
  event.characterId = "alice";
  project.characters = { alice: { displayName: "Before" } };
  const map = project.maps[mapId];
  if (!map) throw new Error("Missing map");
  map.events = [event];
  store.replaceProject(project);
  editorState.set({ currentMapId: mapId, selectedEventId: eventId, selectedEventPageId: event.pages?.[0]?.id ?? null });
  openEventEditorModal(mapId, eventId);
  resetMapEditHistory();
});
afterEach(() => {
  document.querySelector('[data-testid="event-editor-modal"]')?.dispatchEvent(new CustomEvent("oprn:event-editor-close"));
  document.body.replaceChildren();
  resetModalStackForTest();
  resetMapEditHistory();
});

it("renders the staged name in the NPC rail without changing canonical profiles", () => {
  // Given: a mounted editor linked to an existing profile.
  const input = control("event-character-display-name-input");
  if (!(input instanceof HTMLInputElement)) throw new Error("Expected name input");
  // When: the actual name control stages an edit.
  input.value = "Staged name";
  input.dispatchEvent(new Event("change", { bubbles: true }));
  // Then: rail and working input agree while canonical data stays isolated.
  expect(control("evt-rail-meta-npc").textContent).toBe("Staged name");
  expect(projectWithoutEventDrafts(store.getCurrent()).characters?.alice?.displayName).toBe("Before");
});

it("validates a newly staged switch and commits it through parent Apply", () => {
  // Given: the actual field-template dialog over the event editor.
  control("event-command-toolbar-field-monster").click();
  const input = control("field-monster-template-clear-switch");
  if (!(input instanceof HTMLInputElement)) throw new Error("Expected switch input");
  input.value = "projection_new_switch";
  control("field-monster-template-apply").click();
  const before = store.getCurrent();
  expect(before.switches.some(entry => entry.id === "projection_new_switch")).toBe(false);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
  // When: parent validation consumes the same transaction that Apply will commit.
  expect(validateEventDraft(before, mapId, eventId).canCommit).toBe(true);
  control("event-editor-apply").click();
  // Then: the switch and template pages commit atomically, not a fatal-reference refusal.
  const canonical = projectWithoutEventDrafts(store.getCurrent());
  expect(canonical.switches.some(entry => entry.id === "projection_new_switch")).toBe(true);
  expect(canonical.maps[mapId]?.events.find(entry => entry.id === eventId)?.pages).toHaveLength(2);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
});
