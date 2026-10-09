import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { updateEventPage } from "@/editor/eventPages";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";
import { installFakeDom } from "./fakeDom";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";

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

/** 백드롭에서 시작한 닫기 제스처 — 맵 더블클릭이 열어 둔 직후의 유령 click 과 구분한다. */
function dismissViaBackdrop(): void {
  const node = modal();
  node.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  node.click();
}

describe("event editor modal close draft cleanup", () => { beforeEach(() => {
  _resetEventDraftVaultForTest();
  restoreFakeDom = installFakeDom();
  installWindowShim();
});

afterEach(() => { document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.remove();
document.querySelector<HTMLElement>(".app-modal-overlay")?.remove();
_resetEventDraftVaultForTest();
restoreWindow();
restoreFakeDom();
    resetModalStackForTest();
  });

it("dispatches the close cleanup event before removing the modal", () => {
  seedOpenEventEditor();
  const node = modal();
  let attachedDuringClose = false;
  node.addEventListener("oprn:event-editor-close", () => {
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
    if (closeAttempt === "backdrop") dismissViaBackdrop();
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
    if (closeAttempt === "backdrop") dismissViaBackdrop();
    await Promise.resolve();

    document.querySelector<HTMLElement>('[data-testid="app-modal-cancel"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(pageName()).toBe("Draft");
    expect(document.querySelector('[data-testid="event-editor-modal"]')).not.toBeNull();
  });
}

it("닫기 확인창은 실제 푸터 버튼 이름(적용 · 저장하고 닫기)을 가리킨다", async () => {
  // 2026-09-03 실측(제안서 §4): 문구가 존재하지 않는 [반영하고 계속]·[반영하고 닫기] 를 가리켰다.
  const page = seedOpenEventEditor();
  updateEventPage(store.getCurrent().startMapId, "event-1", page.id, { name: "Draft" });
  document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();
  await Promise.resolve();

  const dialog = document.querySelector<HTMLElement>('[data-testid="app-confirm-modal"]');
  expect(dialog).toBeTruthy();
  const text = dialog?.textContent ?? "";
  expect(text).toContain("[계속 편집]");
  expect(text).toContain("[적용]");
  expect(text).toContain("[저장하고 닫기]");
  expect(text).not.toContain("[반영하고");
  const footerLabels = Array.from(document.querySelectorAll<HTMLElement>(".event-editor-modal-footer button")).map((b) => b.textContent?.trim());
  expect(footerLabels).toContain("적용");
  expect(footerLabels).toContain("저장하고 닫기");

  document.querySelector<HTMLElement>('[data-testid="app-modal-cancel"]')?.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

it("closes silently on cancel when nothing changed", () => {
  seedOpenEventEditor();
  document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();

  expect(document.querySelector('[data-testid="app-modal-confirm"]')).toBeNull();
  expect(document.querySelector('[data-testid="event-editor-modal"]')).toBeNull();
  expect(store.getCurrent().maps[store.getCurrent().startMapId].events[0]?.draft).toBeUndefined();
});

it("does not close when the opening map double-click's click lands on the backdrop", () => {
  // 스튜디오 모니터는 뷰포트 중앙이 아니다. 맵 더블클릭의 두 번째 click 은
  // pointerdown 이 캔버스에서 난 채로, 방금 열린 백드롭(창 바깥 어두운 면)에 떨어진다.
  // 그 click 으로 닫히면 편집기가 열린 것처럼 보이다가 바로 사라진다.
  seedOpenEventEditor();
  modal().click();
  expect(document.querySelector('[data-testid="event-editor-modal"]')).not.toBeNull();
  expect(document.querySelector('[data-testid="app-modal-confirm"]')).toBeNull();
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

  it("keeps Escape routing after leaving full view", () => {
    seedOpenEventEditor();
    const node = modal();
    const fullscreen = node.querySelector<HTMLElement>("[data-testid='event-editor-window-fullscreen']");
    expect(fullscreen).toBeTruthy();
    fullscreen?.click();
    expect(node.classList.contains("is-fullscreen")).toBe(true);
    expect(modalStackDepthForTest()).toBe(1);

    document.dispatchEvent(keydown("Escape"));
    expect(document.querySelector("[data-testid='event-editor-modal']")).toBe(node);
    expect(node.classList.contains("is-fullscreen")).toBe(false);
    expect(modalStackDepthForTest()).toBe(1);

    document.dispatchEvent(keydown("Escape"));
    expect(document.querySelector("[data-testid='event-editor-modal']")).toBeNull();
    expect(modalStackDepthForTest()).toBe(0);
  });
});
