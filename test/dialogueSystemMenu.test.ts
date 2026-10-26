/** @vitest-environment happy-dom */
// ESC 메뉴의 백로그 화면과 설정 화면의 읽기 보조 항목 (2026-10-17).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { createPlayerOptionsDetail } from "@/player/playerOptionsDetail";
import { DEFAULT_PLAYER_PREFERENCES, setAuthoredPreferenceDefaults, updatePlayerPreferences } from "@/player/playerPreferences";
import { backlogViewIsOpen, closeBacklogView } from "@/player/dialogueBacklogView";
import { mergeDialogueSystem, romanceDialogueSystem, type BacklogHost } from "@/project/dialogueSystem";

vi.mock("@/player/audio", () => ({ getAudioEngine: () => ({ setVolume: vi.fn() }) }));

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
    expect(ids(detail)).toEqual(["player-option-bgm-down", "player-option-bgm-up", "player-option-se-down", "player-option-se-up", "player-option-voice-down", "player-option-voice-up", "player-option-text-speed", "player-option-always-run", "player-option-menu-motion"]); // 달리기 고정은 f8adba2eac(모바일 터치 감각)에서 더해졌다
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
