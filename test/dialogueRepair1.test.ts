// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDialogueUI, type DialogueTextRequest, type DialogueUI } from "@/player/dialogue";
import { createPlayerOptionsDetail } from "@/player/playerOptionsDetail";
import { statusMenuControls } from "@/player/playerStatusMenu";
import { statusMenuCommandLabel } from "@/player/playerStatusMenuModel";
import { DEFAULT_PLAYER_PREFERENCES, getEffectiveReadingPreferences, normalizePlayerPreferences, updatePlayerPreferences, setAuthoredPreferenceDefaults } from "@/player/playerPreferences";
import { closeBacklogView, backlogViewIsOpen } from "@/player/dialogueBacklogView";
import { createBlankProject } from "@/project/defaults";
import { mergeDialogueSystem, romanceDialogueSystem, type BacklogHost } from "@/project/dialogueSystem";
import { resolveDialogueLook } from "@/project/dialogueStyles";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { GAME_SYSTEM_REQUEST_PATTERN } from "@/ai/piAgent/gameSystemProduction";
import { startSession } from "@/project/session";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { isolateTimers } from "./mergedTeardown";

vi.mock("@/player/audio", () => ({ getAudioEngine: () => ({ setVolume: vi.fn() }) }));

// 미연시 시스템 UI 1단계 수리(적대 리뷰 D1~D12) — 새 동작만 잠근다(2026-10-17).
describe("dialogueRepair1", () => {
  isolateTimers();
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
  describe("D6 keys", () => {
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
});

// ESC 메뉴의 백로그 화면과 설정 화면의 읽기 보조 항목 (2026-10-17).
describe("dialogueSystemMenu", () => {
  isolateTimers();
  beforeEach(() => { updatePlayerPreferences({ ...DEFAULT_PLAYER_PREFERENCES, textSpeedChosen: undefined, autoSpeed: undefined, skipScope: undefined, windowOpacity: undefined }); });
  afterEach(() => { closeBacklogView(); document.body.replaceChildren(); setAuthoredPreferenceDefaults(undefined); });
  function detailFor(project = createBlankProject(), lines = 3) {
    const session = startSession(project) as unknown as BacklogHost & ReturnType<typeof startSession>;
    session.dialogueBacklog = Array.from({ length: lines }, (_, index) => ({ kind: "line" as const, text: `대사 ${index}`, speaker: "하루" }));
    if (lines > 1) session.dialogueBacklog.push({ kind: "choice", picked: "고른 항목", prompt: "무엇을?" });
    return createStatusMenuDetail({ project, session, selectedCommand: "backlog", slots: [], waitModeEnabled: false } as never);
  }
  describe("ESC menu backlog screen", () => {
    it("opens the full-screen viewer from the first row and previews the latest lines newest first", () => {
      const project = createBlankProject();
      project.meta.oprnDialogueSystem = romanceDialogueSystem();
      const detail = detailFor(project);
      expect(detail.title).toBe("백로그");
      expect(detail.entries[0]?.testId).toBe("status-menu-backlog-open");
      expect(detail.entries[0]?.value).toBe("4줄");
      expect(detail.entries[1]?.description).toBe("고른 항목");
      expect(detail.entries.length).toBe(1 + 4);
      const stage = document.createElement("div");
      stage.className = "play-stage";
      document.body.append(stage);
      detail.entries[0]?.onActivate?.();
      expect(backlogViewIsOpen()).toBe(true);
      expect(stage.querySelector('[data-testid="dialogue-backlog"]')?.getAttribute("data-count")).toBe("4");
      expect(stage.querySelector(".is-choice")?.textContent).toContain("고른 항목");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      expect(backlogViewIsOpen()).toBe(false);
    });

    it("shows an empty message with no lines and a disabled message when the system has no backlog", () => {
      const project = createBlankProject();
      project.meta.oprnDialogueSystem = romanceDialogueSystem();
      expect(detailFor(project, 0).entries[0]?.value).toBe("0줄");
      const off = createBlankProject();
      off.meta.oprnDialogueSystem = mergeDialogueSystem(romanceDialogueSystem(), { backlog: false });
      const detail = detailFor(off);
      expect(detail.entries).toEqual([]);
      expect(detail.emptyLabel).toBe("이 게임은 대사 기록을 쓰지 않습니다.");
    });

    it("renders in the authored language", () => {
      const project = createBlankProject();
      project.meta.oprnDialogueSystem = mergeDialogueSystem(romanceDialogueSystem(), { language: "ja" });
      expect(detailFor(project).title).toBe("バックログ");
      expect(detailFor(project).entries[0]?.value).toBe("4行");
    });
  });
  describe("options screen", () => {
    const ids = (detail: ReturnType<typeof createPlayerOptionsDetail>) => detail.entries.map((entry) => entry.testId);
    it("is exactly the old screen for a plain project", () => {
      const detail = createPlayerOptionsDetail(undefined, createBlankProject());
      // 음량은 한 줄에 하나(←→ 로 조절). 빈 프로젝트의 대사창(유리)은 목소리가 없어 「대사 목소리」 줄이 없다(2026-11-14 QA minor 6).
      expect(ids(detail)).toEqual(["player-option-bgm", "player-option-se", "player-option-text-speed", "player-option-always-run", "player-option-menu-motion"]);
      const spoken = createBlankProject();
      spoken.system.dialogueStyle = "pixel-cinematic";
      expect(ids(createPlayerOptionsDetail(undefined, spoken))).toEqual(["player-option-bgm", "player-option-se", "player-option-voice", "player-option-text-speed", "player-option-always-run", "player-option-menu-motion"]);
      expect(detail.title).toBe("설정");
      expect(detail.entries.find((entry) => entry.testId === "player-option-text-speed")?.value).toBe("보통");
      expect(createPlayerOptionsDetail().entries.length).toBe(detail.entries.length);
    });

    it("adds auto speed, skip range and window opacity for an authored system and cycles them", () => {
      const project = createBlankProject();
      project.meta.oprnDialogueSystem = romanceDialogueSystem();
      const first = createPlayerOptionsDetail(undefined, project);
      expect(ids(first)).toEqual(expect.arrayContaining(["player-option-auto-speed", "player-option-skip-scope", "player-option-window-opacity"]));
      const entry = (detail: typeof first, id: string) => detail.entries.find((row) => row.testId === id)!;
      expect(entry(first, "player-option-skip-scope").value).toBe("읽은 글만");
      entry(first, "player-option-skip-scope").onActivate!();
      expect(entry(createPlayerOptionsDetail(undefined, project), "player-option-skip-scope").value).toBe("전부");
      expect(entry(first, "player-option-window-opacity").value).toBe("100%");
      entry(first, "player-option-window-opacity").onActivate!();
      expect(entry(createPlayerOptionsDetail(undefined, project), "player-option-window-opacity").value).toBe("90%");
      entry(createPlayerOptionsDetail(undefined, project), "player-option-auto-speed").onActivate!();
      expect(entry(createPlayerOptionsDetail(undefined, project), "player-option-auto-speed").value).toBe("빠르게");
    });

    it("hides the rows of disabled features, uses authored defaults until the player chooses, and localizes", () => {
      const project = createBlankProject();
      project.meta.oprnDialogueSystem = mergeDialogueSystem(romanceDialogueSystem(), { skip: false, auto: false, language: "en", defaults: { textSpeed: "fast", windowOpacity: 0.6 } });
      const detail = createPlayerOptionsDetail(undefined, project);
      expect(ids(detail)).not.toContain("player-option-auto-speed");
      expect(ids(detail)).not.toContain("player-option-skip-scope");
      expect(detail.title).toBe("Settings");
      expect(detail.entries.find((row) => row.testId === "player-option-text-speed")?.value).toBe("Fast");
      expect(detail.entries.find((row) => row.testId === "player-option-window-opacity")?.value).toBe("60%");
      detail.entries.find((row) => row.testId === "player-option-text-speed")!.onActivate!();
      // 플레이어가 고른 뒤에는 저작 시작값이 아니라 기기 설정이 이긴다.
      expect(createPlayerOptionsDetail(undefined, project).entries.find((row) => row.testId === "player-option-text-speed")?.value).toBe("Slow");
    });
  });
});
