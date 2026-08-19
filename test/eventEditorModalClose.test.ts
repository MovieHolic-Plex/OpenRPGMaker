import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { updateEventPage } from "@/editor/eventPages";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";
import { installFakeDom } from "./fakeDom";

let restoreFakeDom: () => void = () => undefined;
let restoreWindow: () => void = () => undefined;

/** showConfirm 의 domAvailable() 이 window 유무를 보므로(없으면 자동 확인) 브라우저처럼 window 를 흉내낸다. */
function installWindowShim(): void {
  const hadWindow = "window" in globalThis;
  const previous = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {} });
  restoreWindow = () => {
    if (hadWindow) (globalThis as { window?: unknown }).window = previous;
    else Reflect.deleteProperty(globalThis, "window");
  };
}

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
  store.replaceProject(project);
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
    _resetEventDraftVaultForTest();
    restoreFakeDom = installFakeDom();
    installWindowShim();
  });

  afterEach(() => {
    document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.remove();
    document.querySelector<HTMLElement>(".app-modal-overlay")?.remove();
    _resetEventDraftVaultForTest();
    restoreWindow();
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

  // 2026-08-19 닫기 의미론 변경: 미적용 변경이 있으면 ESC/취소/백드롭이 즉시 버리지 않고
  // 확인 다이얼로그(버리고 닫기/계속 편집)를 먼저 띄운다. 무변경이면 여전히 조용히 닫힌다.
  for (const closeAttempt of ["cancel", "escape", "backdrop"] as const) {
    it(`asks before discarding dirty drafts on ${closeAttempt}, then discards on confirm`, async () => {
      const page = seedOpenEventEditor();
      updateEventPage(store.getCurrent().startMapId, "event-1", page.id, { name: "Draft" });

      if (closeAttempt === "cancel") document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();
      if (closeAttempt === "escape") modal().dispatchEvent(keydown("Escape"));
      if (closeAttempt === "backdrop") modal().click();
      await Promise.resolve();

      // 가드 다이얼로그가 뜨고 모달은 아직 살아 있어야 한다(무경고 데이터 손실 금지).
      const confirmBtn = document.querySelector<HTMLElement>('[data-testid="app-modal-confirm"]');
      expect(confirmBtn).toBeTruthy();
      expect(document.querySelector('[data-testid="event-editor-modal"]')).not.toBeNull();
      expect(pageName()).toBe("Draft");

      confirmBtn?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(pageName()).toBe("Original");
      expect(store.getCurrent().maps[store.getCurrent().startMapId].events[0]?.draft).toBeUndefined();
      expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
    });

    it(`keeps editing when the ${closeAttempt} guard is declined`, async () => {
      const page = seedOpenEventEditor();
      updateEventPage(store.getCurrent().startMapId, "event-1", page.id, { name: "Draft" });

      if (closeAttempt === "cancel") document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();
      if (closeAttempt === "escape") modal().dispatchEvent(keydown("Escape"));
      if (closeAttempt === "backdrop") modal().click();
      await Promise.resolve();

      document.querySelector<HTMLElement>('[data-testid="app-modal-cancel"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(pageName()).toBe("Draft");
      expect(document.querySelector('[data-testid="event-editor-modal"]')).not.toBeNull();
    });
  }

  it("closes silently on cancel when nothing changed", () => {
    seedOpenEventEditor();
    document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();

    expect(document.querySelector('[data-testid="app-modal-confirm"]')).toBeNull();
    expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
    expect(store.getCurrent().maps[store.getCurrent().startMapId].events[0]?.draft).toBeUndefined();
  });

  it("keeps Apply changes as the new draft baseline and discards only later edits", async () => {
    const page = seedOpenEventEditor();
    updateEventPage(store.getCurrent().startMapId, "event-1", page.id, { name: "Applied" });
    document.querySelector<HTMLElement>('[data-testid="event-editor-apply"]')?.click();

    expect(pageName()).toBe("Applied");
    updateEventPage(store.getCurrent().startMapId, "event-1", page.id, { name: "Later Draft" });
    document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();
    await Promise.resolve();
    document.querySelector<HTMLElement>('[data-testid="app-modal-confirm"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

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
