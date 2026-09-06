/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { historyHotkeyOwnedByPanel, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { openEventEditorModal, openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { updateEventPage } from "@/editor/eventPages";
import { deleteEditorEvent } from "@/editor/eventDeletion";
import { showConfirm } from "@/editor/ui/modal";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

let mapId: string;
const destinationMapId = "window-map-b";
function node(id: string): HTMLElement {
  const result = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!result) throw new Error(`Missing ${id}`);
  return result;
}
beforeEach(() => {
  const project = createBlankProject();
  mapId = project.startMapId;
  project.maps[mapId].events = [{ id: "window-event", x: 1, y: 1,
    trigger: { kind: "action" }, commands: [], pages: [{
      id: "window-page", name: "Window event", conditions: [], graphic: {},
      trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
    }] }];
  project.maps[mapId].events.push({ ...structuredClone(project.maps[mapId].events[0]), id: "other-event" });
  const secondMap = structuredClone(project.maps[mapId]);
  const pages = project.maps[mapId].events[0].pages;
  const destinationPage = secondMap.events[0].pages?.[0];
  if (!pages || !destinationPage) throw new Error("Expected two-map fixture pages");
  secondMap.id = destinationMapId;
  secondMap.events = [{ ...structuredClone(secondMap.events[0]), id: "destination-event",
    pages: [{ ...structuredClone(destinationPage), id: "destination-page" }] }];
  project.maps[destinationMapId] = secondMap;
  pages.push({ ...structuredClone(pages[0]), id: "window-page-2", name: "Second page" });
  store.replaceProject(project);
  editorState.set({ currentMapId: mapId, selectedEventId: "window-event", selectedEventPageId: "window-page" });
  openEventEditorModal(mapId, "window-event");
});
afterEach(() => {
  document.querySelector('[data-testid="event-editor-modal"]')?.dispatchEvent(new CustomEvent("oprn:event-editor-close"));
  document.body.replaceChildren();
  resetModalStackForTest();
  vi.restoreAllMocks();
});
function draft() { return store.getCurrent().maps[mapId].events.find(event => event.id === "window-event"); }
function key(target: EventTarget, key: string, altKey = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, altKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}
function changedUntil(check: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!check()) return;
      observer.disconnect();
      clearTimeout(deadline);
      resolve();
    });
    const deadline = setTimeout(() => { observer.disconnect(); reject(new Error("Expected DOM transition")); }, 5000);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  });
}
describe("event editor window controls", () => {
  for (const target of ["existing", "new"] as const) {
    for (const dirty of [false, true]) {
      it(`keeps the destination map when opening a ${target} event after ${dirty ? "approved dirty" : "unchanged"} cross-map switching`, async () => {
        if (dirty) updateEventPage(mapId, "window-event", "window-page", { name: "Dirty" });
        const previous = node("event-editor-modal");
        node("event-editor-window-minimize").click();
        expect(selectEditorMap(destinationMapId)).toBe(true);
        expect(editorState.get().currentMapId).toBe(destinationMapId);
        if (target === "existing") openEventEditorModal(destinationMapId, "destination-event");
        else openNewEventEditorModal(destinationMapId, 3, 4);
        if (dirty) {
          const switched = changedUntil(() => node("event-editor-modal") !== previous);
          node("app-modal-confirm").click();
          await switched;
        }
        const modal = node("event-editor-modal");
        expect(modal).not.toBe(previous);
        expect(modal.dataset.mapId).toBe(destinationMapId);
        expect(editorState.get().currentMapId).toBe(destinationMapId);
        const opened = store.getCurrent().maps[destinationMapId].events.find(event => event.id === modal.dataset.eventId);
        expect(opened?.draft?.kind).toBe(target === "existing" ? "edit" : "new");
        expect(editorState.get().selectedEventId).toBe(opened?.id);
        expect(editorState.get().selectedEventPageId).toBe(opened?.pages?.[0].id);
        if (target === "existing") expect(opened?.id).toBe("destination-event");
        else expect(opened).toMatchObject({ x: 3, y: 4 });
        expect(draft()?.draft).toBeUndefined();
        expect(draft()?.pages?.[0].name).toBe("Window event");
        expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
        expect(modalStackDepthForTest()).toBe(1);
      });
    }

    it(`retains the original map and page when cancelling a dirty cross-map switch to a ${target} event`, async () => {
      editorState.set({ selectedEventPageId: "window-page-2" });
      updateEventPage(mapId, "window-event", "window-page-2", { name: "Dirty second page" });
      const original = structuredClone(draft());
      const destination = structuredClone(store.getCurrent().maps[destinationMapId]);
      const modal = node("event-editor-modal");
      node("event-editor-window-minimize").click();
      selectEditorMap(destinationMapId);
      if (target === "existing") openEventEditorModal(destinationMapId, "destination-event");
      else expect(openNewEventEditorModal(destinationMapId, 3, 4)).toBe("");
      expect(modal.hidden).toBe(false);
      expect(modalStackDepthForTest()).toBe(2);
      const cancelled = changedUntil(() => modal.dataset.switchGuard !== "true");
      node("app-modal-cancel").click();
      await cancelled;
      expect(node("event-editor-modal")).toBe(modal);
      expect(editorState.get()).toMatchObject({ currentMapId: mapId, selectedEventId: "window-event", selectedEventPageId: "window-page-2" });
      expect(draft()).toEqual(original);
      expect(store.getCurrent().maps[destinationMapId]).toEqual(destination);
      expect(modalStackDepthForTest()).toBe(1);
    });
  }

  for (const restore of ["chip", "same-event"] as const) {
    it(`restores the original map and nondefault page via ${restore} after selecting another map`, () => {
      editorState.set({ selectedEventPageId: "window-page-2" });
      const modal = node("event-editor-modal");
      node("event-editor-window-minimize").click();
      selectEditorMap(destinationMapId);
      if (restore === "chip") node("event-editor-window-restore").click();
      else openEventEditorModal(mapId, "window-event");
      expect(node("event-editor-modal")).toBe(modal);
      expect(modal.hidden).toBe(false);
      expect(editorState.get()).toMatchObject({ currentMapId: mapId, selectedEventId: "window-event", selectedEventPageId: "window-page-2" });
    });
  }

  it("minimizes without discarding pending input and restores the same editor", () => {
    const modal = node("event-editor-modal");
    const input = node("event-editor-name");
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected input");
    input.focus();
    input.value = "Pending draft";
    input.setSelectionRange(3, 7);
    node("event-editor-window-minimize").click();
    expect(modal.hidden).toBe(true);
    expect(modalStackDepthForTest()).toBe(0);
    expect(document.body.classList.contains("event-editor-modal-open")).toBe(false);
    const restore = node("event-editor-window-restore");
    expect(document.activeElement).toBe(restore);
    expect(historyHotkeyOwnedByPanel()).toBe(false);
    expect(shouldIgnoreEditorShortcut(key(restore, "ArrowRight"))).toBe(false);
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    restore.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
    restore.click();
    expect(node("event-editor-modal")).toBe(modal);
    expect(modal.hidden).toBe(false);
    expect(node("event-editor-name")).toBe(input);
    expect(input.value).toBe("Pending draft");
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(7);
    expect(document.activeElement).toBe(input);
    expect(modalStackDepthForTest()).toBe(1);
  });
  it("keeps full-view state and saved normal geometry across minimize and map reopen", () => {
    const modal = node("event-editor-modal");
    const windowEl = modal.querySelector<HTMLElement>(".event-editor-modal-window");
    if (!windowEl) throw new Error("Expected window");
    Object.assign(windowEl.style, { width: "900px", height: "650px", transform: "translate(12px, 8px)" });
    node("event-editor-window-fullscreen").click();
    expect(node("event-editor-window-fullscreen").style.display).not.toBe("none");
    node("event-editor-window-minimize").click();
    editorState.set({ selectedEventId: "other-event", selectedEventPageId: null });
    openEventEditorModal(mapId, "window-event");
    expect(node("event-editor-modal")).toBe(modal);
    expect(modal.hidden).toBe(false);
    expect(modal.classList.contains("is-fullscreen")).toBe(true);
    expect(editorState.get().selectedEventPageId).toBe("window-page");
    key(document, "Escape");
    expect(windowEl.style.width).toBe("900px");
    expect(windowEl.style.height).toBe("650px");
    expect(windowEl.style.transform).toBe("translate(12px, 8px)");
    expect(modalStackDepthForTest()).toBe(1);
    key(document, "Escape");
    expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
  });

  it("does not rebuild pending dynamic fields on background map and selection changes", () => {
    const field = node("event-command-search");
    if (!(field instanceof HTMLInputElement)) throw new Error("Expected search input");
    field.focus();
    field.value = "pending search";
    node("event-editor-window-minimize").click();
    store.updateMap(mapId, map => { map.name = "Background edit"; });
    editorState.set({ selectedEventId: "other-event", selectedEventPageId: null });
    node("event-editor-window-restore").click();
    expect(node("event-command-search")).toBe(field);
    expect(field.value).toBe("pending search");
    expect(document.activeElement).toBe(field);
  });

  it("restores a minimized new draft without resetting or discarding it", () => {
    node("event-editor-cancel").click();
    const eventId = openNewEventEditorModal(mapId, 2, 2);
    const modal = node("event-editor-modal");
    node("event-editor-window-minimize").click();
    openEventEditorModal(mapId, eventId);
    expect(node("event-editor-modal")).toBe(modal);
    expect(modal.hidden).toBe(false);
    expect(store.getCurrent().maps[mapId].events.find(event => event.id === eventId)?.draft?.kind).toBe("new");
  });

  it("guards switching dirty minimized drafts, then discards only on approval", async () => {
    updateEventPage(mapId, "window-event", "window-page", { name: "Dirty" });
    const modal = node("event-editor-modal");
    node("event-editor-window-minimize").click();
    openEventEditorModal(mapId, "other-event");
    expect(modal.hidden).toBe(false);
    expect(modalStackDepthForTest()).toBe(2);
    const cancelled = changedUntil(() => modal.dataset.switchGuard !== "true");
    node("app-modal-cancel").click();
    await cancelled;
    expect(draft()?.pages?.[0].name).toBe("Dirty");
    expect(modalStackDepthForTest()).toBe(1);
    openEventEditorModal(mapId, "other-event");
    const switched = changedUntil(() => document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.dataset.eventId === "other-event");
    node("app-modal-confirm").click();
    await switched;
    expect(draft()?.draft).toBeUndefined();
    expect(draft()?.pages?.[0].name).toBe("Window event");
    expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
    expect(modalStackDepthForTest()).toBe(1);
  });

  it("keeps Apply and save semantics after restore", () => {
    updateEventPage(mapId, "window-event", "window-page", { name: "Applied" });
    node("event-editor-window-minimize").click();
    node("event-editor-window-restore").click();
    node("event-editor-apply").click();
    expect(draft()?.pages?.[0].name).toBe("Applied");
    expect(draft()?.draft?.kind).toBe("edit");
    updateEventPage(mapId, "window-event", "window-page", { name: "Saved" });
    node("event-editor-save").click();
    expect(draft()?.pages?.[0].name).toBe("Saved");
    expect(draft()?.draft).toBeUndefined();
    expect(modalStackDepthForTest()).toBe(0);
  });

  it("closes a dormant draft on deletion rather than resurrecting it from the vault", () => {
    node("event-editor-window-minimize").click();
    expect(deleteEditorEvent(mapId, "window-event", { silent: true })).toBe(true);
    expect(draft()).toBeUndefined();
    expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
    expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
    expect(modalStackDepthForTest()).toBe(0);
  });

  it("ends ownership on same-ID project replacement without touching the incoming draft", () => {
    node("event-editor-window-minimize").click();
    const replacement = structuredClone(store.getCurrent());
    const incoming = replacement.maps[mapId].events[0];
    if (!incoming.pages?.[0]) throw new Error("Expected page");
    incoming.pages[0].name = "Incoming";
    store.replaceProject(replacement);
    expect(draft()?.pages?.[0].name).toBe("Incoming");
    expect(draft()?.draft).toBeDefined();
    expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
    expect(document.querySelector('[data-testid="event-editor-window-restore"]')).toBeNull();
    expect(modalStackDepthForTest()).toBe(0);
  });

  it("tears down its pending close guard on project replacement", async () => {
    updateEventPage(mapId, "window-event", "window-page", { name: "Dirty" });
    node("event-editor-modal-close").click();
    const replacement = structuredClone(store.getCurrent());
    store.replaceProject(replacement);
    expect(document.querySelector('[data-testid="app-confirm-modal"]')).toBeNull();
    expect(modalStackDepthForTest()).toBe(0);
    await Promise.resolve();
    expect(draft()?.pages?.[0].name).toBe("Dirty");
    expect(modalStackDepthForTest()).toBe(0);
  });

  it("does not steal focus or Escape from another modal while minimized", async () => {
    node("event-editor-window-minimize").click();
    const result = showConfirm({ message: "Other operation" });
    openEventEditorModal(mapId, "window-event");
    expect(node("event-editor-modal").hidden).toBe(true);
    expect(document.activeElement).toBe(node("app-modal-cancel"));
    key(document, "Escape");
    expect(await result).toBe(false);
    expect(node("event-editor-modal").hidden).toBe(true);
    node("event-editor-window-restore").click();
    expect(modalStackDepthForTest()).toBe(1);
  });

  it("disposes draft subscriptions and restore UI on external DOM teardown", async () => {
    node("event-editor-cancel").click();
    const subscribe = store.subscribe.bind(store);
    const disposers: Array<() => void> = [];
    vi.spyOn(store, "subscribe").mockImplementation(listener => {
      const dispose = vi.fn(subscribe(listener));
      disposers.push(dispose);
      return dispose;
    });
    openEventEditorModal(mapId, "window-event");
    const modal = node("event-editor-modal");
    node("event-editor-window-minimize").click();
    const disposed = changedUntil(() => !document.querySelector('[data-testid="event-editor-window-restore"]'));
    modal.remove();
    await disposed;
    expect(draft()?.draft).toBeUndefined();
    expect(modalStackDepthForTest()).toBe(0);
    store.updateMap(mapId, map => { map.name = "After teardown"; });
    expect(disposers.length).toBeGreaterThan(0);
    for (const dispose of disposers) expect(dispose).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
  });

  it("maximizes on immediate titlebar double-click but not on nested button SVGs", () => {
    const modal = node("event-editor-modal");
    node("event-editor-titlebar").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    expect(modal.classList.contains("is-fullscreen")).toBe(true);
    const path = node("event-editor-window-fullscreen").querySelector("path");
    if (!path) throw new Error("Expected SVG path");
    path.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    expect(modal.classList.contains("is-fullscreen")).toBe(true);
    key(modal, "Enter", true);
    expect(modal.classList.contains("is-fullscreen")).toBe(false);
  });

});
