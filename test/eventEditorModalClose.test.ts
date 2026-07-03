import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { updateEventPage } from "@/editor/eventPages";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";
import { installFakeDom } from "./fakeDom";

let restoreFakeDom: () => void = () => undefined;

function eventPage(): EventPage {
  return {
    id: "page-1",
    name: "Original",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "Hello" }],
  };
}

function gameEvent(page: EventPage): GameEvent {
  return {
    id: "event-1",
    x: 2,
    y: 3,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
}

function seedOpenEventEditor(): EventPage {
  const project = createBlankProject();
  const page = eventPage();
  project.maps[project.startMapId].events = [gameEvent(page)];
  store.replace(project);
  editorState.set({ currentMapId: project.startMapId, selectedEventId: "event-1", selectedEventPageId: page.id });
  openEventEditorModal(project.startMapId, "event-1");
  return page;
}

function modal(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
  if (!node) throw new Error("Expected event editor modal");
  return node;
}

function pageName(): string | undefined {
  const project = store.getCurrent();
  return project.maps[project.startMapId].events[0]?.pages?.[0]?.name;
}

function keydown(key: string): KeyboardEvent {
  const event = new Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "key", { configurable: true, value: key });
  return event as KeyboardEvent;
}

describe("event editor modal close draft cleanup", () => {
  beforeEach(() => {
    restoreFakeDom = installFakeDom();
  });

  afterEach(() => {
    restoreFakeDom();
  });

  it("dispatches the close cleanup event before removing the modal", () => {
    seedOpenEventEditor();
    const node = modal();
    let attachedDuringClose = false;
    node.addEventListener("rpgzzu:event-editor-close", () => {
      attachedDuringClose = document.querySelector('[data-testid="event-editor-modal"]') === node;
    });

    document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();

    expect(attachedDuringClose).toBe(true);
    expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
  });

  for (const closeAttempt of ["cancel", "escape", "backdrop"] as const) {
    it(`discards existing-event drafts on ${closeAttempt}`, () => {
      const page = seedOpenEventEditor();
      updateEventPage(store.getCurrent().startMapId, "event-1", page.id, { name: "Draft" });

      if (closeAttempt === "cancel") document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();
      if (closeAttempt === "escape") modal().dispatchEvent(keydown("Escape"));
      if (closeAttempt === "backdrop") modal().click();

      expect(pageName()).toBe("Original");
      expect(store.getCurrent().maps[store.getCurrent().startMapId].events[0]?.draft).toBeUndefined();
      expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
    });
  }

  it("keeps Apply changes as the new draft baseline and discards only later edits", () => {
    const page = seedOpenEventEditor();
    updateEventPage(store.getCurrent().startMapId, "event-1", page.id, { name: "Applied" });
    document.querySelector<HTMLElement>('[data-testid="event-editor-apply"]')?.click();

    expect(pageName()).toBe("Applied");
    updateEventPage(store.getCurrent().startMapId, "event-1", page.id, { name: "Later Draft" });
    document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();

    expect(pageName()).toBe("Applied");
    expect(store.getCurrent().maps[store.getCurrent().startMapId].events[0]?.draft).toBeUndefined();
  });

  it("persists OK changes and closes without an edit draft", () => {
    const page = seedOpenEventEditor();
    updateEventPage(store.getCurrent().startMapId, "event-1", page.id, { name: "Saved" });

    document.querySelector<HTMLElement>('[data-testid="event-editor-ok"]')?.click();

    expect(pageName()).toBe("Saved");
    expect(store.getCurrent().maps[store.getCurrent().startMapId].events[0]?.draft).toBeUndefined();
    expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
  });
});
