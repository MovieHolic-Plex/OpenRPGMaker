/** @vitest-environment happy-dom */
// 미연시 시스템 UI 1단계 수리(적대 리뷰 D1~D12) — 새 동작만 잠근다(2026-10-17).
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDialogueUI, type DialogueTextRequest, type DialogueUI } from "@/player/dialogue";
import { createPlayerOptionsDetail } from "@/player/playerOptionsDetail";
import { statusMenuControls } from "@/player/playerStatusMenu";
import { statusMenuCommandLabel } from "@/player/playerStatusMenuModel";
import { DEFAULT_PLAYER_PREFERENCES, getEffectiveReadingPreferences, normalizePlayerPreferences, updatePlayerPreferences } from "@/player/playerPreferences";
import { closeBacklogView } from "@/player/dialogueBacklogView";
import { createBlankProject } from "@/project/defaults";
import { mergeDialogueSystem, romanceDialogueSystem, type BacklogHost } from "@/project/dialogueSystem";
import { resolveDialogueLook } from "@/project/dialogueStyles";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { GAME_SYSTEM_REQUEST_PATTERN } from "@/ai/piAgent/gameSystemProduction";

vi.mock("@/player/audio", () => ({ getAudioEngine: () => ({ setVolume: vi.fn() }) }));

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
  closeBacklogView();
  for (const listener of ownedKeys) { document.removeEventListener("keydown", listener); document.removeEventListener("keyup", listener); }
  ownedKeys.clear();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
  store.replaceProject(previous);
});

function useSystem(patch: Parameters<typeof mergeDialogueSystem>[1] = {}): Project {
  const project = createBlankProject();
  project.meta.oprnDialogueSystem = mergeDialogueSystem(romanceDialogueSystem(), patch);
  store.replaceProject(project);
  return project;
}
function ui(): DialogueUI { return createDialogueUI(host); }
function request(dialogue: DialogueUI, body: string, extra: Partial<DialogueTextRequest> = {}): { done: () => boolean; promise: Promise<void> } {
  let finished = false;
  const promise = dialogue.showText({
    body, speaker: "하루", playerTileY: 0, mapHeight: 20, reducedMotion: true,
    textContext: { session, project: store.getCurrent() }, ...extra,
  }).then(() => { finished = true; });
  return { done: () => finished, promise };
}
function press(key: string, code = "", init: KeyboardEventInit = {}, target: EventTarget = document): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}
const wheel = (box: Element, deltaY: number, init: { ctrlKey?: boolean } = {}) => {
  const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true });
  // happy-dom 의 WheelEvent 는 ctrlKey 초기값을 버린다(실제 브라우저의 핀치 줌은 ctrlKey 가 참).
  if (init.ctrlKey) Object.defineProperty(event, "ctrlKey", { value: true });
  box.dispatchEvent(event);
};
const backlogOpen = (): boolean => host.querySelector('[data-testid="dialogue-backlog"]') !== null;

describe("D1 saved text speed survives the romance defaults", () => {
  it("promotes an old non-normal saved speed to a deliberate choice, once", () => {
    const old = normalizePlayerPreferences({ bgm: 0.7, se: 0.8, voice: 0.8, textSpeed: "fast", reduceMenuMotion: false });
    expect(old.textSpeedChosen).toBe(true);
    const defaults = { ...romanceDialogueSystem().defaults, textSpeed: "slow" as const };
    expect(getEffectiveReadingPreferences(defaults, old).textSpeed).toBe("fast");
    // 보통은 표식이 없으면 저작 시작값을 따른다(고르지 않은 기본과 구별할 수 없다).
    expect(getEffectiveReadingPreferences(defaults, normalizePlayerPreferences({ textSpeed: "normal" })).textSpeed).toBe("slow");
    // 이미 승격된 값은 다시 읽어도 그대로다.
    expect(normalizePlayerPreferences(old)).toEqual(old);
  });
});

describe("D2 / D6 keys", () => {
  it("Enter and Space on a focused tool button do not advance the line", async () => {
    useSystem();
    const dialogue = ui();
    const line = request(dialogue, "단추 포커스");
    const button = host.querySelector<HTMLElement>('[data-testid="dialogue-bar-auto"]')!;
    press("Enter", "Enter", {}, button);
    press(" ", "Space", {}, button);
    await vi.advanceTimersByTimeAsync(200);
    expect(line.done()).toBe(false);
    press("Enter"); press("Enter");
    await line.promise;
  });

  it("holding H hides once and does not flicker back on key repeat", async () => {
    useSystem();
    const dialogue = ui();
    const line = request(dialogue, "숨김");
    const overlay = host.querySelector<HTMLElement>(".dialogue-overlay")!;
    press("h", "KeyH");
    expect(overlay.dataset.dialogueHidden).toBe("1");
    press("h", "KeyH", { repeat: true });
    press("h", "KeyH", { repeat: true });
    expect(overlay.dataset.dialogueHidden).toBe("1");
    press("x", "KeyX");
    expect(overlay.dataset.dialogueHidden).toBeUndefined();
    press("Enter"); press("Enter");
    await line.promise;
  });
});

describe("D5 wheel", () => {
  it("ignores pinch zoom, ignores the moment after closing, and needs a real scroll", async () => {
    useSystem();
    const dialogue = ui();
    const line = request(dialogue, "휠");
    const box = host.querySelector<HTMLElement>(".dialogue-box")!;
    wheel(box, -120, { ctrlKey: true });
    expect(backlogOpen()).toBe(false);
    wheel(box, -10);
    expect(backlogOpen()).toBe(false);
    wheel(box, -50);
    expect(backlogOpen()).toBe(true);
    press("Escape");
    expect(backlogOpen()).toBe(false);
    wheel(box, -200);
    expect(backlogOpen()).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    wheel(box, -200);
    expect(backlogOpen()).toBe(true);
    press("Escape");
    await vi.advanceTimersByTimeAsync(600);
    press("Enter"); press("Enter");
    await line.promise;
  });
});

describe("D11 ambient lines stay out of the saved backlog", () => {
  it("a corner/bark line is not written to the session ring", async () => {
    const project = useSystem();
    const dialogue = ui();
    const look = { ...resolveDialogueLook(project, { speaker: "행인" }), container: "corner" as const };
    void dialogue.showText({
      body: "순찰 중", speaker: "행인", playerTileY: 0, mapHeight: 20, reducedMotion: true, look,
      textContext: { session, project: store.getCurrent() },
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(session.dialogueBacklog ?? []).toEqual([]);
    const line = request(dialogue, "본 대사");
    press("Enter"); press("Enter");
    await line.promise;
    expect(session.dialogueBacklog?.map((entry) => (entry.kind === "line" ? entry.text : ""))).toEqual(["본 대사"]);
  });
});

describe("D3 window opacity row", () => {
  it("is hidden for the classic window skin (the picture fills the box) and shown otherwise", () => {
    const glass = useSystem();
    expect(createPlayerOptionsDetail(undefined, glass).entries.some((entry) => entry.testId === "player-option-window-opacity")).toBe(true);
    const classic = useSystem();
    classic.system.dialogueStyle = "classic";
    expect(createPlayerOptionsDetail(undefined, classic).entries.some((entry) => entry.testId === "player-option-window-opacity")).toBe(false);
  });
});

describe("D8 menu text follows the authored language", () => {
  it("translates the rail backlog label and footer controls only when a dialogue system exists", () => {
    const en = useSystem({ language: "en" });
    expect(statusMenuCommandLabel("backlog", false, en)).toBe("Backlog");
    expect(statusMenuControls("function", 1, false, en.meta.oprnDialogueSystem)).toContain("Enter confirm");
    expect(statusMenuControls("main", 2, false, en.meta.oprnDialogueSystem)).toContain("Esc to game");
    // 시스템이 없으면 예전 한국어 그대로.
    expect(statusMenuControls("function")).toBe("↑↓ 항목 이동   Enter 결정   ← 메뉴   Esc 뒤로");
    expect(statusMenuControls("main", 1, true)).toBe("↑↓ 이동 · Enter 선택\nEsc 닫기");
  });
});

describe("D12 assistant system-tool declaration words", () => {
  it.each(["add a visual novel backlog", "turn on auto-play and skip", "enable the message log", "バックログを付けて", "オートとスキップ", "加上对话记录和跳过", "개선 백로그"])("matches %s", (text) => {
    expect(GAME_SYSTEM_REQUEST_PATTERN.test(text)).toBe(true);
  });
  it("does not match an unrelated sentence", () => {
    expect(GAME_SYSTEM_REQUEST_PATTERN.test("make the hero taller")).toBe(false);
  });
});

describe("D4 / D7 style rules exist", () => {
  const css = readFileSync("src/styles/dialogueReading.css", "utf8");
  it("gives touch screens a real tap area and flips the bar away from a right bust", () => {
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 600px\)[\s\S]*min-height: calc\(44px \/ var\(--play-scale, 1\)\)/);
    expect(css).toMatch(/\.dialogue-box\.bust-right \.dialogue-bar[\s\S]*left: 4px;[\s\S]*right: auto;/);
  });
});
