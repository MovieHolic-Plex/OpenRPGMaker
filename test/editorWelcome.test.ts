/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDITOR_WELCOME_DISMISSED_KEY,
  EDITOR_WELCOME_TESTIDS,
  isAutomationBootContext,
  isEditorWelcomeDismissed,
  presentEditorWelcome,
  setEditorWelcomeDismissed,
  shouldPresentEditorWelcome,
  shouldSuppressEditorWelcomeForAutomation,
} from "@/editor/editorWelcome";
import { completeInterviewChoices } from "./helpers/gameDesignBrief";
import { resetModalStackForTest } from "@/editor/ui/modalStack";

function writeWelcomeSentence(host: HTMLElement, text: string): HTMLTextAreaElement {
  const input = host.querySelector<HTMLTextAreaElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptInput}']`)!;
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input;
}

function submitWelcomePreset(host: HTMLElement, index = 0, text = "몬스터 수집"): void {
  host.querySelector<HTMLButtonElement>(`[data-testid='editor-welcome-template-card-${index}']`)!.click();
  writeWelcomeSentence(host, text);
  host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptSubmit}']`)!.click();
}

function clearStorage(): void {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
}

function installMemoryStorage(): void {
  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() { return entries.size; },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => { entries.delete(key); },
    setItem: (key, value) => { entries.set(key, value); },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  vi.stubGlobal("localStorage", storage);
}

function setMatchMedia(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  resetModalStackForTest();
  installMemoryStorage();
  clearStorage();
  document.body.replaceChildren();
  vi.useRealTimers();
  setMatchMedia(false);
  delete (window as Window & { __OPRN_E2E_PROJECT__?: unknown }).__OPRN_E2E_PROJECT__;
  Object.defineProperty(navigator, "webdriver", {
    configurable: true,
    get: () => false,
  });
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
  clearStorage();
  document.body.replaceChildren();
  document.body.classList.remove("director-briefing-open");
  delete (window as Window & { __OPRN_E2E_PROJECT__?: unknown }).__OPRN_E2E_PROJECT__;
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("editor welcome dismiss storage", () => {
  it("defaults to not dismissed and persists '1' when set", () => {
    expect(isEditorWelcomeDismissed()).toBe(false);
    setEditorWelcomeDismissed(true);
    expect(localStorage.getItem(EDITOR_WELCOME_DISMISSED_KEY)).toBe("1");
    expect(isEditorWelcomeDismissed()).toBe(true);
    setEditorWelcomeDismissed(false);
    expect(localStorage.getItem(EDITOR_WELCOME_DISMISSED_KEY)).toBeNull();
    expect(isEditorWelcomeDismissed()).toBe(false);
  });
});

describe("shouldPresentEditorWelcome", () => {
  it("requires unmounted mode shell and rejects dismissed/automation", () => {
    expect(shouldPresentEditorWelcome({ modeShellMounted: true })).toBe(false);
    expect(shouldPresentEditorWelcome({ modeShellMounted: false, dismissed: true })).toBe(false);
    expect(shouldPresentEditorWelcome({ modeShellMounted: false, automation: true })).toBe(false);
    expect(shouldPresentEditorWelcome({ modeShellMounted: false, dismissed: false, automation: false })).toBe(true);
  });

  it("reads live dismissed flag when option omitted", () => {
    expect(shouldPresentEditorWelcome({ modeShellMounted: false, automation: false })).toBe(true);
    setEditorWelcomeDismissed(true);
    expect(shouldPresentEditorWelcome({ modeShellMounted: false, automation: false })).toBe(false);
  });

  it("skips welcome when URL deep-links a project", () => {
    window.history.replaceState({}, "", "/?project=rpg-zzu-narrative-horror-demos");
    expect(shouldPresentEditorWelcome({ modeShellMounted: false, dismissed: false, automation: false })).toBe(false);
    expect(shouldPresentEditorWelcome({ modeShellMounted: false, dismissed: false, automation: false, deepLinkedProject: true })).toBe(false);
    window.history.replaceState({}, "", "/");
    expect(shouldPresentEditorWelcome({ modeShellMounted: false, dismissed: false, automation: false })).toBe(true);
  });
});

describe("automation boot context", () => {
  it("detects e2e project flag, webdriver, and URL params", () => {
    expect(isAutomationBootContext()).toBe(false);
    expect(shouldSuppressEditorWelcomeForAutomation()).toBe(false);

    (window as Window & { __OPRN_E2E_PROJECT__?: unknown }).__OPRN_E2E_PROJECT__ = { meta: {} };
    expect(isAutomationBootContext()).toBe(true);
    delete (window as Window & { __OPRN_E2E_PROJECT__?: unknown }).__OPRN_E2E_PROJECT__;

    Object.defineProperty(navigator, "webdriver", {
      configurable: true,
      get: () => true,
    });
    expect(isAutomationBootContext()).toBe(true);
    Object.defineProperty(navigator, "webdriver", {
      configurable: true,
      get: () => false,
    });

    for (const param of ["freshProject", "devProject", "blankProject", "aiBridge", "softConfirm", "sc2", "sc3"]) {
      window.history.replaceState({}, "", `/?${param}=1`);
      expect(isAutomationBootContext()).toBe(true);
      window.history.replaceState({}, "", "/");
    }
  });
});

describe("presentEditorWelcome", () => {
  it("shows only the three supported start genres", () => {
    const host = document.createElement("div");
    document.body.append(host);
    void presentEditorWelcome(host);

    const packNodes = Array.from(host.querySelectorAll<HTMLElement>("[data-pack-id]"));
    expect(packNodes.map((node) => node.dataset.packId)).toEqual([
      "monster-collect",
      "story-cutscene",
      "adventure-jrpg",
    ]);
    expect(host.querySelectorAll("[data-testid^='editor-welcome-template-card-']")).toHaveLength(3);
    expect(host.querySelector("#editor-welcome-more-grid")).toBeNull();
    expect(host.textContent).not.toContain("이런 세계도 있어요");
    for (const presetId of ["partner-raise", "school-horror", "horror-gallery", "farm-life", "action-rpg"]) {
      expect(host.querySelector(`[data-preset-id='${presetId}']`)).toBeNull();
    }
  });

  it("opens world previews before revealing the first sentence, with explicit manual starts", () => {
    const host = document.createElement("div");
    document.body.append(host);
    void presentEditorWelcome(host);

    const root = host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`);
    expect(root).toBeTruthy();
    expect(root?.classList.contains("editor-welcome-briefing")).toBe(true);
    expect(host.textContent).toContain("만들고 싶은 세계에,");
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptInput}']`)).toBeTruthy();
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptSubmit}']`)?.textContent).toContain("이 이야기로 시작");
    expect(host.querySelector<HTMLElement>(".first-world-composer")!.hidden).toBe(true);
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.skip}']`)?.textContent).toContain("빈 맵으로 시작");
    const featured = host.querySelector(".editor-welcome-briefing-cards");
    expect(featured?.querySelectorAll("[data-testid^='editor-welcome-template-card']")).toHaveLength(3);
    for (const caption of ["몬스터 수집", "모험 JRPG", "회상 스토리"]) {
      expect(featured?.textContent).toContain(caption);
    }
    for (const caption of ["이브 같은", "갤러리 호러", "아오오니 같은", "학교 호러", "파트너 육성", "농장 생활", "2D 액션 RPG"]) {
      expect(host.textContent).not.toContain(caption);
    }
    // Each poster exposes an explicit AI-independent starter action.
    expect(host.querySelectorAll("[data-testid^='editor-welcome-starter-card-']")).toHaveLength(3);
    expect(featured?.querySelectorAll("[data-testid^='editor-welcome-starter-card-']")).toHaveLength(3);
    expect(host.querySelector("[data-testid='editor-welcome-starter-card-0']")?.textContent).not.toContain("빈 프로젝트");
    expect(document.querySelector("[data-testid='app-modal-confirm']")).toBeNull();
  });

  it("does not mount an extra-worlds tier", () => {
    const host = document.createElement("div");
    document.body.append(host);
    void presentEditorWelcome(host);

    expect(host.querySelector("#editor-welcome-more-grid")).toBeNull();
    expect(host.querySelector(".editor-welcome-more-toggle")).toBeNull();
    for (const img of Array.from(host.querySelectorAll<HTMLImageElement>(".first-world-poster-img"))) {
      expect(img.src).toContain("/assets/project-interview/");
    }
  });

  it("sends free-text to the current map without replacing the project", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = presentEditorWelcome(host);
    host.querySelector<HTMLButtonElement>("[data-testid='first-world-free']")!.click();
    const input = writeWelcomeSentence(host, "눈 내리는 마을에 여관이 있고, 여관 주인이 잠을 팔아요");
    expect(input).toBeTruthy();
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptSubmit}']`)?.click();
    expect(document.querySelector("[data-testid='app-modal-confirm']")).toBeNull();

    const result = await pending;
    expect(result.action).toBe("start");
    // 프로젝트 교체 경로가 아니다 — 시스템 프리셋 계획이 없으면 열린 프로젝트를 그대로 쓴다.
    expect(result.systemPresetPlan).toBeUndefined();
    expect(result.autoSend).toBe(true);
    expect(result.dismiss).toBe(true);
    expect(result.source).toBe("free-text");
    expect(result.intent).toContain("눈 내리는 마을");
    expect(result.prompt).toContain("눈 내리는 마을");
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`)).toBeNull();
    expect(isEditorWelcomeDismissed()).toBe(true);
  });

  it("does not skip when 만들기 is empty", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = presentEditorWelcome(host);
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptSubmit}']`)?.click();
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`)).toBeTruthy();
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.skip}']`)?.click();
    await expect(pending).resolves.toMatchObject({
      action: "skip",
      prompt: null,
      autoSend: false,
      dismiss: true,
    });
  });

  it("creates the preset project before releasing its auto-send prompt", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    let finishProject!: () => void;
    const projectReady = new Promise<void>((resolve) => { finishProject = resolve; });
    const applySystemPreset = vi.fn(() => projectReady);
    const delivered = vi.fn();
    const pending = presentEditorWelcome(host, { applySystemPreset });
    void pending.then(delivered);
    submitWelcomePreset(host);
    expect(document.querySelector("[data-testid='app-modal-confirm']")).toBeNull();
    expect(applySystemPreset).not.toHaveBeenCalled();
    await completeInterviewChoices();
    expect(applySystemPreset).toHaveBeenCalledWith(expect.objectContaining({ packId: "monster-collect" }), expect.objectContaining({ presetId: "monster-collect" }));
    expect(delivered).not.toHaveBeenCalled();
    expect(isEditorWelcomeDismissed()).toBe(false);
    // Enter must not bypass disabled buttons during project preparation.
    const input = host.querySelector<HTMLTextAreaElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptInput}']`)!;
    input.value = "other request";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
    host.querySelector<HTMLButtonElement>("[data-testid='editor-welcome-template-card-1']")?.click();
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`)).toBeTruthy();
    expect(applySystemPreset).toHaveBeenCalledOnce();
    finishProject();
    const result = await pending;
    expect(result.action).toBe("start");
    expect(result.systemPresetPlan).toBeUndefined();
    expect(result.autoSend).toBe(true);
    expect(result.source).toBe("chip");
    expect(result.intent).toBe("몬스터 수집");
    expect(result.presetId).toBe("monster-collect");
    expect(result.prompt).toBeTruthy();
    expect(delivered).toHaveBeenCalledOnce();
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`)).toBeNull();
  });

  it("BREAK: exposes a confirmed manual starter action separately from AI", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const applySystemPreset = vi.fn(async () => undefined);
    const pending = (presentEditorWelcome as unknown as (
      host: HTMLElement,
      options: { applySystemPreset: (plan: unknown) => Promise<void> },
    ) => ReturnType<typeof presentEditorWelcome>)(host, { applySystemPreset });
    const manual = host.querySelector<HTMLButtonElement>("[data-testid='editor-welcome-starter-card-0']");

    expect(manual).toBeTruthy();
    manual?.click();
    const confirm = document.querySelector<HTMLButtonElement>("[data-testid='app-modal-confirm']");
    expect(confirm).toBeTruthy();
    confirm?.click();

    await expect(pending).resolves.toMatchObject({
      action: "start",
      prompt: null,
      autoSend: false,
      presetId: "monster-collect",
      source: "manual-system-preset",
      systemPresetPlan: {
        kind: "blank-project-system-preset",
        packId: "monster-collect",
        recipeId: "monster-system",
        preservesOpenProjectUntilRemoteVerified: true,
        aiRequired: false,
      },
    });
    expect(applySystemPreset).toHaveBeenCalledOnce();
  });

  it.each(["starter", "template"])("prevents AI submission when %s project preparation fails", async (card) => {
    const host = document.createElement("div");
    document.body.append(host);
    const applySystemPreset = vi.fn(async () => {
      throw new Error("remote reload failed");
    });
    const pending = (presentEditorWelcome as unknown as (
      host: HTMLElement,
      options: { applySystemPreset: (plan: unknown) => Promise<void> },
    ) => ReturnType<typeof presentEditorWelcome>)(host, { applySystemPreset });

    const error = host.querySelector<HTMLElement>("[data-testid='editor-welcome-system-preset-error']")!;
    const errorShown = new Promise<void>((resolve, reject) => {
      const observer = new MutationObserver(() => {
        if (!error.hidden) {
          observer.disconnect();
          clearTimeout(timeout);
          resolve();
        }
      });
      const timeout = setTimeout(() => { observer.disconnect(); reject(new Error("Missing preparation error")); }, 2000);
      observer.observe(error, { attributes: true, attributeFilter: ["hidden"] });
    });
    host.querySelector<HTMLButtonElement>(`[data-testid='editor-welcome-${card}-card-0']`)?.click();
    if (card === "template") { writeWelcomeSentence(host, "몬스터 수집"); host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptSubmit}']`)!.click(); await completeInterviewChoices(); }
    document.querySelector<HTMLButtonElement>("[data-testid='app-modal-confirm']")?.click();
    await errorShown;
    expect(applySystemPreset).toHaveBeenCalledOnce();

    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`)).toBeTruthy();
    expect(host.querySelector("[data-testid='editor-welcome-system-preset-error']")?.getAttribute("role")).toBe("alert");
    expect(isEditorWelcomeDismissed()).toBe(false);

    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.skip}']`)?.click();
    await expect(pending).resolves.toMatchObject({ action: "skip", prompt: null, autoSend: false });
  });

  it("keeps the welcome open when manual starter confirmation is cancelled", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = presentEditorWelcome(host);
    host.querySelector<HTMLButtonElement>("[data-testid='editor-welcome-starter-card-1']")?.click();
    document.querySelector<HTMLButtonElement>("[data-testid='app-modal-cancel']")?.click();
    await Promise.resolve();

    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`)).toBeTruthy();
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.skip}']`)?.click();
    const result = await pending;
    expect(result.action).toBe("skip");
    expect(result.systemPresetPlan).toBeUndefined();
  });

  it("AI 미연결이면 만들기를 보내지 않고 안내와 설정 버튼을 보여준다", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    let settled = false;
    const opened: string[] = [];
    const pending = presentEditorWelcome(host, {
      canGenerate: () => false,
      openAiSettings: () => { opened.push("settings"); },
    }).then((result) => { settled = true; return result; });

    host.querySelector<HTMLButtonElement>("[data-testid='first-world-free']")!.click();
    const notice = host.querySelector<HTMLElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.aiNotice}']`)!;
    expect(notice.hidden).toBe(true);

    writeWelcomeSentence(host, "눈 내리는 마을");
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptSubmit}']`)!.click();
    await Promise.resolve();

    // 보내지 않는다 — 보내면 채팅 패널이 "의도 읽는 중…" 에서 조용히 멈춘다(실측 30초+).
    expect(settled).toBe(false);
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toContain("AI를 연결하면");
    // 다음 행동을 말해야 한다 — "AI 설정이 필요합니다" 만으로는 어디를 누를지 모른다.
    expect(notice.textContent).toContain("AI 없이 직접 만들기");

    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.aiNoticeAction}']`)!.click();
    expect(opened).toEqual(["settings"]);

    // 빈 맵으로 시작은 여전히 열려 있어야 한다 — 막다른 길을 만들지 않는다.
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.skip}']`)!.click();
    const result = await pending;
    expect(result.action).toBe("skip");
  });

  it("장르 미리보기는 AI 연결을 요구하지 않고 첫 문장 제출에서 안내한다", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const applySystemPreset = vi.fn(async () => undefined);
    const pending = presentEditorWelcome(host, { canGenerate: () => false, applySystemPreset });
    host.querySelector<HTMLButtonElement>("[data-testid='editor-welcome-template-card-0']")!.click();
    await Promise.resolve();
    expect(document.querySelector("[data-testid='project-interview']")).toBeNull();
    expect(applySystemPreset).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.aiNotice}']`)!.hidden).toBe(true);
    writeWelcomeSentence(host, "풀숲에서 만나는 친구들");
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptSubmit}']`)!.click();
    expect(host.querySelector<HTMLElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.aiNotice}']`)!.hidden).toBe(false);
    expect(document.activeElement).toBe(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.aiNoticeAction}']`));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await expect(pending).resolves.toMatchObject({ action: "skip" });
  });

  it("AI 가 준비되면 안내를 띄우지 않고 그대로 보낸다", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = presentEditorWelcome(host, { canGenerate: () => true });

    host.querySelector<HTMLButtonElement>("[data-testid='first-world-free']")!.click();
    writeWelcomeSentence(host, "눈 내리는 마을");
    // settle 이 오버레이를 DOM 에서 걷어내므로, 안내의 상태는 보내기 **전에** 확인한다.
    const noticeBefore = host.querySelector<HTMLElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.aiNotice}']`)!;
    expect(noticeBefore.hidden).toBe(true);
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptSubmit}']`)!.click();

    const result = await pending;
    expect(result.action).toBe("start");
    expect(result.autoSend).toBe(true);
    // 보내기 전에 안내가 뜨지 않았다는 것이 계약이다 — 뜨면 AI 가 있는데도 겁을 준다.
    expect(noticeBefore.hidden).toBe(true);
  });

  it("연결을 미루면 첫 문장과 장르를 보존하고, 다시 제출하면 인터뷰에 그대로 전달한다", async () => {
    const host = document.createElement("div"); document.body.append(host);
    const ensureAiConnected = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const applySystemPreset = vi.fn(async () => undefined);
    const pending = presentEditorWelcome(host, { ensureAiConnected, applySystemPreset });
    host.querySelector<HTMLButtonElement>("[data-testid='editor-welcome-template-card-0']")!.click();
    expect(ensureAiConnected).not.toHaveBeenCalled();
    const text = "하늘섬에서 작은 친구와 함께 떠나는 모험";
    const input = writeWelcomeSentence(host, text);
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptSubmit}']`)!.click();
    await vi.waitFor(() => expect(input.disabled).toBe(false));
    expect(input.value).toBe(text);
    expect(host.querySelector("[data-testid='editor-welcome-template-card-0']")!.getAttribute("aria-pressed")).toBe("true");
    expect(applySystemPreset).not.toHaveBeenCalled();
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptSubmit}']`)!.click();
    await vi.waitFor(() => expect(document.querySelector("[data-testid='project-interview-concept']")).not.toBeNull());
    expect(document.querySelector<HTMLTextAreaElement>("[data-testid='project-interview-concept']")!.value).toBe(text);
    document.querySelector<HTMLButtonElement>("[data-testid='project-interview-cancel']")!.click();
    await vi.waitFor(() => expect(input.disabled).toBe(false));
    expect(input.value).toBe(text);
    expect(applySystemPreset).not.toHaveBeenCalled();
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.skip}']`)!.click();
    await expect(pending).resolves.toMatchObject({ action: "skip" });
  });
});
