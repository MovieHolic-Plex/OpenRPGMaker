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

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function clearStorage(): void {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
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
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: new MemoryStorage(),
  });
  clearStorage();
  document.body.replaceChildren();
  vi.useRealTimers();
  setMatchMedia(false);
  delete (window as Window & { __RPG_ZZU_E2E_PROJECT__?: unknown }).__RPG_ZZU_E2E_PROJECT__;
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
  delete (window as Window & { __RPG_ZZU_E2E_PROJECT__?: unknown }).__RPG_ZZU_E2E_PROJECT__;
  window.history.replaceState({}, "", "/");
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

    (window as Window & { __RPG_ZZU_E2E_PROJECT__?: unknown }).__RPG_ZZU_E2E_PROJECT__ = { meta: {} };
    expect(isAutomationBootContext()).toBe(true);
    delete (window as Window & { __RPG_ZZU_E2E_PROJECT__?: unknown }).__RPG_ZZU_E2E_PROJECT__;

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
  it("mounts a canvas briefing with one question, one input, and three result cards", () => {
    const host = document.createElement("div");
    document.body.append(host);
    void presentEditorWelcome(host);

    const root = host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`);
    expect(root).toBeTruthy();
    expect(root?.classList.contains("editor-welcome-briefing")).toBe(true);
    expect(host.textContent).toContain("어떤 게임을 만들까요?");
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptInput}']`)).toBeTruthy();
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptSubmit}']`)?.textContent).toContain("만들기");
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.skip}']`)?.textContent).toContain("빈 맵으로 시작");
    expect(host.querySelectorAll("[data-testid^='editor-welcome-template-card']")).toHaveLength(3);
    expect(host.textContent).toContain("모험 마을");
    expect(host.textContent).toContain("농장 하루");
    expect(host.textContent).toContain("몬스터 수집");
    expect(host.querySelector("[data-testid='editor-welcome-inspiration']")).toBeNull();
    expect(host.querySelector("[data-testid='editor-welcome-slide']")).toBeNull();
    expect(document.querySelector("[data-testid='app-modal-confirm']")).toBeNull();
  });

  it("sends free-text to the current map without replacing the project", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = presentEditorWelcome(host);
    const input = host.querySelector<HTMLInputElement>(
      `[data-testid='${EDITOR_WELCOME_TESTIDS.promptInput}']`,
    );
    expect(input).toBeTruthy();
    if (input) input.value = "눈 내리는 마을에 여관이 있고, 여관 주인이 잠을 팔아요";
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.promptSubmit}']`)?.click();
    expect(document.querySelector("[data-testid='app-modal-confirm']")).toBeNull();

    const result = await pending;
    expect(result.action).toBe("start");
    expect(result.replaceWithBlank).toBe(false);
    expect(result.autoSend).toBe(true);
    expect(result.dismiss).toBe(true);
    expect(result.source).toBe("free-text");
    expect(result.intent).toContain("눈 내리는 마을");
    expect(result.prompt).toContain("눈 내리는 마을");
    expect(result.prompt).toContain("승인 전 커밋 금지");
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
      replaceWithBlank: false,
      dismiss: true,
    });
  });

  it("card click auto-sends that world's prompt on the current map", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = presentEditorWelcome(host);
    host.querySelector<HTMLButtonElement>("[data-testid='editor-welcome-template-card-0']")?.click();
    expect(document.querySelector("[data-testid='app-modal-confirm']")).toBeNull();
    const result = await pending;
    expect(result.action).toBe("start");
    expect(result.replaceWithBlank).toBe(false);
    expect(result.autoSend).toBe(true);
    expect(result.source).toBe("chip");
    expect(result.intent).toBe("모험 마을");
    expect(result.presetId).toBe("adventure-jrpg");
    expect(result.prompt).toContain("모험 JRPG");
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`)).toBeNull();
  });

  it("BREAK: exposes a confirmed manual starter action separately from AI", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = presentEditorWelcome(host);
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
      replaceWithBlank: false,
      presetId: "adventure-jrpg",
      source: "manual-starter",
      starterPlan: {
        packId: "adventure-jrpg",
        recipeId: "adventure-village",
        replaceOpenProject: false,
        aiRequired: false,
      },
    });
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
    expect(result.starterPlan).toBeUndefined();
  });
});
