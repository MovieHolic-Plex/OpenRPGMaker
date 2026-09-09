// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { bindSpatialAuthoringControllerFactory } from "@/editor/panels/spatialAuthoringAccess";
import { resetSpatialAuthoringSessions } from "@/editor/panels/spatialAuthoringSession";
import { resetSpatialObjectsTabChrome } from "@/editor/panels/spatialObjectChromeState";
import { libraryObjectCardId } from "@/editor/panels/spatialObjectDraft";
import { resetSpatialPlacesTabChrome } from "@/editor/panels/spatialPlaceChromeState";
import { resetSpatialSpacesTabChrome } from "@/editor/panels/spatialSpaceChromeState";
import { store } from "@/project/store";
import { manualBuildFixture } from "./support/spatialManualBuildFixture";

const previous = store.getCurrent();
const previousEditor = editorState.get();
let host: HTMLDivElement;

function control<T extends Element>(id: string): T {
  const node = host.querySelector<T>(`[data-testid=${JSON.stringify(id)}]`);
  if (!node) throw new TypeError(`Missing mounted control: ${id}`);
  return node;
}

beforeEach(() => {
  resetSpatialObjectsTabChrome();
  resetSpatialSpacesTabChrome();
  resetSpatialPlacesTabChrome();
  manualBuildFixture();
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null, activePaletteStamp: null });
  setDatabaseActiveTab("spatialObjects");
  host = document.createElement("div");
  document.body.append(host);
  renderDatabasePanel(host);
});

afterEach(() => {
  host.remove();
  bindSpatialAuthoringControllerFactory(null);
  resetSpatialAuthoringSessions();
  resetSpatialObjectsTabChrome();
  resetSpatialSpacesTabChrome();
  resetSpatialPlacesTabChrome();
  resetMapEditHistory();
  store.replace(previous, { preserveEventDrafts: false });
  editorState.set(previousEditor);
  setDatabaseActiveTab("overview");
});

it("preserves map field focus and caret when an input event commits an insertion", () => {
  // Given: real mounted Database with the real fixture-bound authoring controller.
  control<HTMLButtonElement>(`spatial-card-${libraryObjectCardId("hearth-design")}`).click();
  const input = control<HTMLInputElement>("spatial-build-map");
  input.focus();
  input.value = "stamp-target";
  input.setSelectionRange(5, 5);
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(5);
  input.setRangeText("X", 5, 5, "end");
  // happy-dom treats selectionMode "end" as end-of-value; the spec (and Chromium) place
  // the caret after the inserted text. Pin the spec caret before the input notification.
  if (input.selectionStart !== 6) input.setSelectionRange(6, 6);
  // When: deliver the browser's post-insertion input notification, without refocusing.
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "X" }));
  // Then: the mounted field remains the keyboard destination at the insertion caret.
  const mounted = control<HTMLInputElement>("spatial-build-map");
  expect({
    value: mounted.value,
    focused: document.activeElement === mounted,
    selectionStart: mounted.selectionStart,
    selectionEnd: mounted.selectionEnd,
  }).toEqual({ value: "stampX-target", focused: true, selectionStart: 6, selectionEnd: 6 });
});
