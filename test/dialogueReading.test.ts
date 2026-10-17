/** @vitest-environment happy-dom */
// 대사창 읽기 보조 동작 — 오토·스킵·숨기기·백로그와 안전 규칙을 실제 대사 UI 로 검사한다(2026-10-17).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDialogueUI, type DialogueTextRequest, type DialogueUI } from "@/player/dialogue";
import { DEFAULT_PLAYER_PREFERENCES, updatePlayerPreferences } from "@/player/playerPreferences";
import { createBlankProject } from "@/project/defaults";
import { mergeDialogueSystem, romanceDialogueSystem, type BacklogHost, type DialogueSystemPatch } from "@/project/dialogueSystem";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

const ownedKeys = new Set<EventListenerOrEventListenerObject>();
let previous: Project;
let host: HTMLElement;
let session: BacklogHost & { variables: Record<string, number>; actorNames: Record<string, string>; gold: number };

beforeEach(() => {
  vi.useFakeTimers();
  previous = store.getCurrent();
  const add = document.addEventListener.bind(document);
  vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
    if (type === "keydown" || type === "keyup") ownedKeys.add(listener);
    add(type, listener, options);
  });
  updatePlayerPreferences({ ...DEFAULT_PLAYER_PREFERENCES, textSpeedChosen: undefined, autoSpeed: undefined, skipScope: undefined, windowOpacity: undefined });
  session = { variables: {}, actorNames: {}, gold: 0 };
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  for (const listener of ownedKeys) { document.removeEventListener("keydown", listener); document.removeEventListener("keyup", listener); }
  ownedKeys.clear();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
  store.replaceProject(previous);
});

function useSystem(patch: DialogueSystemPatch | null): Project {
  const project = createBlankProject();
  if (patch) project.meta.oprnDialogueSystem = mergeDialogueSystem(romanceDialogueSystem(), patch);
  store.replaceProject(project);
  return project;
}

function ui(): DialogueUI {
  return createDialogueUI(host);
}

function request(dialogue: DialogueUI, body: string, extra: Partial<DialogueTextRequest> = {}): { done: () => boolean; promise: Promise<void> } {
  let finished = false;
  const promise = dialogue.showText({
    body, speaker: "하루", playerTileY: 0, mapHeight: 20, reducedMotion: true,
    textContext: { session, project: store.getCurrent() }, ...extra,
  }).then(() => { finished = true; });
  return { done: () => finished, promise };
}

function press(key: string, code = "", init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true, ...init });
  document.dispatchEvent(event);
  return event;
}
const letter = (name: "a" | "s" | "h" | "l"): KeyboardEvent => press(name, `Key${name.toUpperCase()}`);
const stopOf = (): string | undefined => host.querySelector<HTMLElement>(".dialogue-overlay")?.dataset.readingStop;
const settle = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe("controls exist only for authored systems", () => {
  it("a plain project keeps the old hover button and has no tool bar, no backlog, and ignores A/S/H", async () => {
    useSystem(null);
    const dialogue = ui();
    const line = request(dialogue, "안녕");
    expect(host.querySelector('[data-testid="dialogue-bar"]')).toBeNull();
    expect(host.querySelector('[data-testid="dialogue-log-button"]')).not.toBeNull();
    letter("a"); letter("s"); letter("h");
    await settle(5000);
    expect(line.done()).toBe(false);
    expect(host.querySelector<HTMLElement>(".dialogue-overlay")?.dataset.dialogueHidden).toBeUndefined();
    expect(session.dialogueBacklog).toBeUndefined();
    press("Enter"); press("Enter");
    await line.promise;
  });

  it("an authored system draws no reading-tool buttons and no log button in the window (shortcuts still work)", async () => {
    useSystem({});
    const dialogue = ui();
    const line = request(dialogue, "안녕");
    expect(host.querySelector('[data-testid="dialogue-bar"]')).toBeNull();
    expect(host.querySelectorAll("button").length).toBe(0);
    expect(host.querySelector('[data-testid="dialogue-log-button"]')).toBeNull();
    letter("a");
    expect(dialogue.readingMode?.()).toBe("auto");
    letter("a");
    press("Enter"); press("Enter");
    await line.promise;
  });
});

describe("auto", () => {
  it("advances by itself after reading time once A is pressed, and stays put without it", async () => {
    useSystem({});
    const dialogue = ui();
    const idle = request(dialogue, "안녕하세요");
    await settle(6000);
    expect(idle.done()).toBe(false);
    press("Enter"); press("Enter");
    await idle.promise;
    const line = request(dialogue, "안녕하세요");
    letter("a");
    expect(dialogue.readingMode?.()).toBe("auto");
    await settle(8000);
    expect(line.done()).toBe(true);
  });

  it("waits longer for longer text", async () => {
    useSystem({});
    const dialogue = ui();
    const short = request(dialogue, "네");
    letter("a");
    await settle(1800);
    expect(short.done()).toBe(true);
    const long = request(dialogue, "아주 긴 이야기를 하고 있어요. ".repeat(3));
    await settle(1800);
    expect(long.done()).toBe(false);
    await settle(20000);
    expect(long.done()).toBe(true);
  });

  it("is stopped by a click, Enter, or Esc without advancing the line", async () => {
    useSystem({});
    const dialogue = ui();
    const line = request(dialogue, "안녕하세요");
    letter("a");
    const event = press("Escape");
    expect(event.defaultPrevented).toBe(true);
    expect(dialogue.readingMode?.()).toBe("off");
    await settle(9000);
    expect(line.done()).toBe(false);
    press("Enter"); press("Enter");
    await line.promise;
  });

  it("does not advance while the backlog is open or the tab is hidden", async () => {
    useSystem({});
    const dialogue = ui();
    const line = request(dialogue, "네");
    letter("a");
    letter("l");
    expect(host.querySelector('[data-testid="dialogue-backlog"]')).not.toBeNull();
    await settle(9000);
    expect(line.done()).toBe(false);
    press("Escape");
    expect(host.querySelector('[data-testid="dialogue-backlog"]')).toBeNull();
    press("Enter"); press("Enter");
    await line.promise;
  });
});

describe("skip", () => {
  it("in read-only scope stops at unread text and marks it read; a re-seen line then skips", async () => {
    useSystem({});
    const dialogue = ui();
    const first = request(dialogue, "처음 보는 글");
    letter("s");
    await settle(3000);
    expect(first.done()).toBe(false);
    expect(stopOf()).toBe("unread");
    expect(dialogue.readingMode?.()).toBe("off");
    press("Enter"); press("Enter");
    await first.promise;
    const again = request(dialogue, "처음 보는 글");
    letter("s");
    await settle(1500);
    expect(again.done()).toBe(true);
  });

  it("all scope skips unread text but never an ending epilogue", async () => {
    useSystem({ defaults: { skipScope: "all" } });
    const dialogue = ui();
    const plain = request(dialogue, "아직 안 읽은 글");
    letter("s");
    await settle(1500);
    expect(plain.done()).toBe(true);
    const ending = request(dialogue, "그리고 둘은...", { endingEpilogue: true });
    letter("s");
    await settle(8000);
    expect(ending.done()).toBe(false);
    expect(stopOf()).toBe("ending");
    press("Enter"); press("Enter");
    await ending.promise;
  });

  it("never skips a no-skip line even in the all scope", async () => {
    useSystem({ defaults: { skipScope: "all" } });
    const dialogue = ui();
    const locked = request(dialogue, "[넘기기금지]중요한 고백");
    letter("s");
    await settle(8000);
    expect(locked.done()).toBe(false);
    expect(stopOf()).toBe("locked");
    press("Enter"); press("Enter"); press("Enter");
    await locked.promise;
  });

  it("stops at choices and never picks one by itself", async () => {
    useSystem({ defaults: { skipScope: "all" } });
    const dialogue = ui();
    const line = request(dialogue, "갈래?");
    letter("s");
    await settle(1500);
    expect(line.done()).toBe(true);
    expect(dialogue.readingMode?.()).toBe("skip");
    let chosen: number | undefined;
    const choice = dialogue.showChoices({ prompt: "어떻게?", options: [{ text: "간다" }, { text: "안 간다" }], playerTileY: 0, mapHeight: 20, textContext: { session, project: store.getCurrent() } })
      .then((index) => { chosen = index; });
    expect(dialogue.readingMode?.()).toBe("off");
    expect(stopOf()).toBe("choices");
    await settle(20000);
    expect(chosen).toBeUndefined();
    press("2");
    await choice;
    expect(chosen).toBe(1);
  });

  it("stopReading(boundary) from the interpreter ends skip, and close() ends it at the end of an event", async () => {
    useSystem({ defaults: { skipScope: "all" } });
    const dialogue = ui();
    const line = request(dialogue, "한 줄");
    letter("s");
    await settle(1500);
    await line.promise;
    expect(dialogue.readingMode?.()).toBe("skip");
    dialogue.stopReading?.("boundary");
    expect(dialogue.readingMode?.()).toBe("off");
    const next = request(dialogue, "다음 줄");
    letter("s");
    await settle(1500);
    await next.promise;
    dialogue.close();
    expect(dialogue.readingMode?.()).toBe("off");
  });

  it("holding Ctrl skips only while held, and a lost keyup is recovered by the next key", async () => {
    useSystem({ defaults: { skipScope: "all" } });
    const dialogue = ui();
    const line = request(dialogue, "길게 누르면 넘어간다");
    expect(dialogue.readingMode?.()).toBe("off");
    press("Control", "ControlLeft", { ctrlKey: true });
    expect(dialogue.readingMode?.()).toBe("skip");
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Control", code: "ControlLeft" }));
    expect(dialogue.readingMode?.()).toBe("off");
    await settle(100);
    expect(line.done()).toBe(false);
    press("Control", "ControlLeft", { ctrlKey: true });
    await settle(1500);
    expect(line.done()).toBe(true);
    const next = request(dialogue, "다음");
    press("Control", "ControlLeft", { ctrlKey: true });
    expect(dialogue.readingMode?.()).toBe("skip");
    press("x", "KeyX", { ctrlKey: false });
    expect(dialogue.readingMode?.()).toBe("off");
    press("Enter"); press("Enter");
    await next.promise;
  });

  it("skip disabled by the author: S does nothing and Ctrl does nothing", async () => {
    useSystem({ skip: false });
    const dialogue = ui();
    const line = request(dialogue, "한 줄");
    letter("s");
    press("Control", "ControlLeft", { ctrlKey: true });
    expect(dialogue.readingMode?.()).toBe("off");
    await settle(5000);
    expect(line.done()).toBe(false);
    press("Enter"); press("Enter");
    await line.promise;
  });

  it("is never started for a battle event line", async () => {
    useSystem({ defaults: { skipScope: "all" } });
    const dialogue = ui();
    const line = request(dialogue, "전투 중 대사", { reading: "off" });
    expect(host.querySelector('[data-testid="dialogue-bar"]')).toBeNull();
    letter("s"); letter("a");
    expect(dialogue.readingMode?.()).toBe("off");
    await settle(8000);
    expect(line.done()).toBe(false);
    expect(session.dialogueBacklog).toBeUndefined();
    press("Enter"); press("Enter");
    await line.promise;
  });
});

describe("hide", () => {
  it("hides the window, swallows the first key, and restores on any key", async () => {
    useSystem({});
    const dialogue = ui();
    const line = request(dialogue, "숨겨 보자");
    const overlay = host.querySelector<HTMLElement>(".dialogue-overlay")!;
    letter("h");
    expect(overlay.dataset.dialogueHidden).toBe("1");
    const enter = press("Enter");
    expect(enter.defaultPrevented).toBe(true);
    expect(overlay.dataset.dialogueHidden).toBeUndefined();
    await settle(500);
    expect(line.done()).toBe(false);
    press("Enter"); press("Enter");
    await line.promise;
  });

  it("restores on a pointer press and never advances while hidden", async () => {
    useSystem({});
    const dialogue = ui();
    const line = request(dialogue, "숨겨 보자");
    const overlay = host.querySelector<HTMLElement>(".dialogue-overlay")!;
    letter("h");
    letter("a");
    await settle(9000);
    expect(line.done()).toBe(false);
    host.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
    expect(overlay.dataset.dialogueHidden).toBeUndefined();
    press("Enter"); press("Enter");
    await line.promise;
  });

  it("an auto-advancing line cannot be hidden", async () => {
    useSystem({});
    const dialogue = ui();
    const line = request(dialogue, "자동으로 지나간다", { autoAdvance: true });
    letter("h");
    expect(host.querySelector<HTMLElement>(".dialogue-overlay")?.dataset.dialogueHidden).toBeUndefined();
    await settle(3000);
    expect(line.done()).toBe(true);
  });
});

describe("backlog", () => {
  it("records lines and chosen options into the session ring buffer, and reopens them with L", async () => {
    useSystem({});
    const dialogue = ui();
    const a = request(dialogue, "첫 번째 말", { speaker: "하루" });
    press("Enter"); press("Enter");
    await a.promise;
    const picked = dialogue.showChoices({ prompt: "고르세요", options: [{ text: "예" }, { text: "아니오" }], playerTileY: 0, mapHeight: 20, textContext: { session, project: store.getCurrent() } });
    press("1");
    expect(await picked).toBe(0);
    const b = request(dialogue, "두 번째 말", { speaker: "소라" });
    expect(session.dialogueBacklog).toEqual([
      { kind: "line", text: "첫 번째 말", speaker: "하루", context: expect.any(String) },
      { kind: "choice", picked: "예", prompt: "고르세요" },
      { kind: "line", text: "두 번째 말", speaker: "소라", context: expect.any(String) },
    ]);
    const event = letter("l");
    expect(event.defaultPrevented).toBe(true);
    const view = host.querySelector('[data-testid="dialogue-backlog"]');
    expect(view?.getAttribute("data-count")).toBe("3");
    expect(view?.textContent).toContain("첫 번째 말");
    expect(view?.querySelector(".is-choice")?.textContent).toContain("예");
    // 백로그가 열린 동안 키는 글에 닿지 않는다: 결정 키는 뷰만 닫고 글은 그대로다.
    press("Enter");
    expect(b.done()).toBe(false);
    expect(host.querySelector('[data-testid="dialogue-backlog"]')).toBeNull();
    letter("l");
    expect(host.querySelector('[data-testid="dialogue-backlog"]')).not.toBeNull();
    press("Escape");
    expect(host.querySelector('[data-testid="dialogue-backlog"]')).toBeNull();
    press("Enter"); press("Enter");
    await b.promise;
  });

  it("wheel up over the window opens it and L reopens it", async () => {
    useSystem({});
    const dialogue = ui();
    const line = request(dialogue, "휠 시험");
    const box = host.querySelector<HTMLElement>(".dialogue-box")!;
    box.dispatchEvent(new WheelEvent("wheel", { deltaY: 40, bubbles: true, cancelable: true }));
    expect(host.querySelector('[data-testid="dialogue-backlog"]')).toBeNull();
    box.dispatchEvent(new WheelEvent("wheel", { deltaY: -40, bubbles: true, cancelable: true }));
    expect(host.querySelector('[data-testid="dialogue-backlog"]')).not.toBeNull();
    host.querySelector<HTMLElement>('[data-testid="dialogue-backlog-close"]')!.click();
    expect(host.querySelector('[data-testid="dialogue-backlog"]')).toBeNull();
    letter("l");
    expect(host.querySelector('[data-testid="dialogue-backlog"]')).not.toBeNull();
    press("Escape");
    press("Enter"); press("Enter");
    await line.promise;
  });

  it("never grows past the authored limit even over a very long session", async () => {
    useSystem({ backlogLimit: 20, defaults: { skipScope: "all" } });
    const dialogue = ui();
    for (let index = 0; index < 60; index += 1) {
      const line = request(dialogue, `줄 ${index}`);
      if (index === 0) letter("s"); // 스킵은 줄이 바뀌어도 켜져 있다
      await settle(300);
      await line.promise;
    }
    expect(session.dialogueBacklog).toHaveLength(20);
    expect((session.dialogueBacklog?.at(-1) as { text: string }).text).toBe("줄 59");
  });

  it("does not record when the author turned the backlog off", async () => {
    useSystem({ backlog: false });
    const dialogue = ui();
    const line = request(dialogue, "기록 안 함");
    expect(session.dialogueBacklog).toBeUndefined();
    press("Enter"); press("Enter");
    await line.promise;
  });
});
