import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { updateEventPage } from "@/editor/eventPages";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { modalStackEntryCountForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

let restoreDom: () => void;
let mapId: string;
beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  mapId = project.startMapId;
  project.maps[mapId].events = [{
    id: "close-lifecycle", x: 1, y: 1, trigger: { kind: "action" }, commands: [],
    pages: [{ id: "page", name: "Original", conditions: [], graphic: {},
      trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] }],
  }];
  store.replaceProject(project);
  editorState.set({ currentMapId: mapId, selectedEventId: "close-lifecycle", selectedEventPageId: "page" });
  openEventEditorModal(mapId, "close-lifecycle");
  updateEventPage(mapId, "close-lifecycle", "page", { name: "Draft" });
});
afterEach(() => {
  restoreDom();
  resetModalStackForTest();
});

function closedEvent(modal: HTMLElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("Close cleanup did not finish")), 1000);
    modal.addEventListener("oprn:event-editor-close", () => {
      clearTimeout(deadline);
      resolve();
    }, { once: true });
  });
}

describe("event editor asynchronous close document ownership", () => {
  for (const destination of ["removed", "replaced"] as const) {
    it(`finishes pending close after the global document is ${destination}`, async () => {
      const ownerDocument = document;
      const modal = ownerDocument.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
      const cancel = ownerDocument.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]');
      if (!modal || !cancel) throw new Error("Expected editor controls");
      const closed = closedEvent(modal);
      cancel.click(); // Headless confirm resolves asynchronously, as in TrustLoop.
      restoreDom();
      if (destination === "replaced") {
        restoreDom = installFakeDom();
        document.body.classList.add("event-editor-modal-open");
      }
      await closed;
      expect(ownerDocument.body.classList.contains("event-editor-modal-open")).toBe(false);
      expect(ownerDocument.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
      expect(modalStackEntryCountForTest()).toBe(0);
      const event = store.getCurrent().maps[mapId].events[0];
      expect(event.draft).toBeUndefined();
      expect(event.pages?.[0].name).toBe("Original");
      if (destination === "replaced") {
        expect(document.body.classList.contains("event-editor-modal-open")).toBe(true);
      }
    });
  }
});
