/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDITOR_WELCOME_DISMISSED_KEY,
  EDITOR_WELCOME_TESTIDS,
  WELCOME_CHIPS,
  WELCOME_SLIDE_INTERVAL_MS,
  WELCOME_SLIDE_URLS,
  isAutomationBootContext,
  isEditorWelcomeDismissed,
  prefersReducedMotion,
  presentEditorWelcome,
  setEditorWelcomeDismissed,
  shouldPresentEditorWelcome,
  shouldSuppressEditorWelcomeForAutomation,
} from "@/editor/editorWelcome";

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
  it("chip click confirms blank pipeline and resolves with auto-send prompt", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = presentEditorWelcome(host);

    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`)).toBeTruthy();
    expect(WELCOME_SLIDE_URLS.length).toBeGreaterThanOrEqual(4);
    expect(WELCOME_CHIPS).toHaveLength(7);
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.inspirationStrip}']`)).toBeTruthy();
    expect(host.querySelectorAll(".editor-welcome-inspiration-item").length).toBeGreaterThanOrEqual(6);

    const chip = host.querySelector<HTMLButtonElement>(
      `[data-testid='${EDITOR_WELCOME_TESTIDS.chips[0]}']`
    );
    expect(chip?.textContent).toContain(WELCOME_CHIPS[0].label);
    expect(chip?.querySelector(".editor-welcome-genre-img")?.getAttribute("src")).toContain(
      "/assets/generated/welcome/"
    );
    // Select poster then confirm via hub CTA (double-click also works).
    chip?.click();
    const genreStart = host.querySelector<HTMLButtonElement>(
      `[data-testid='${EDITOR_WELCOME_TESTIDS.genreStart}']`
    );
    expect(genreStart).toBeTruthy();
    expect(genreStart?.disabled).toBe(false);
    genreStart?.click();

    // Confirm modal from showConfirm
    const confirm = document.querySelector<HTMLButtonElement>("[data-testid='app-modal-confirm']")
      ?? [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("새 뼈대"));
    expect(confirm).toBeTruthy();
    confirm?.click();

    const result = await pending;
    expect(result.action).toBe("start");
    expect(result.replaceWithBlank).toBe(true);
    expect(result.autoSend).toBe(true);
    expect(result.intent).toBe(WELCOME_CHIPS[0].label);
    expect(result.prompt).toContain(WELCOME_CHIPS[0].label);
    expect(result.prompt).toContain("승인 전 커밋 금지");
    expect(result.presetId).toBe(WELCOME_CHIPS[0].id);
    expect(result.source).toBe("chip");
    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`)).toBeNull();
  });

  it("resolves skip with null pipeline and empty start as skip", async () => {
    const host = document.createElement("div");
    document.body.append(host);

    const skipPending = presentEditorWelcome(host);
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.skip}']`)?.click();
    await expect(skipPending).resolves.toMatchObject({
      intent: null,
      prompt: null,
      autoSend: false,
      replaceWithBlank: false,
      dismiss: false,
      action: "skip",
    });

    const startPending = presentEditorWelcome(host);
    // Free-text path is collapsed by default (cinematic poster layout).
    const customToggle = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("직접 쓰기")
    );
    customToggle?.click();
    const input = host.querySelector<HTMLInputElement>(
      `[data-testid='${EDITOR_WELCOME_TESTIDS.input}']`
    );
    if (input) input.value = "   ";
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.start}']`)?.click();
    await expect(startPending).resolves.toMatchObject({
      intent: null,
      prompt: null,
      autoSend: false,
      replaceWithBlank: false,
      action: "skip",
    });
  });

  it("persists dismiss when checkbox is checked", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = presentEditorWelcome(host);
    const checkbox = host.querySelector<HTMLInputElement>(
      `[data-testid='${EDITOR_WELCOME_TESTIDS.dismiss}']`
    );
    expect(checkbox).toBeTruthy();
    if (checkbox) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.skip}']`)?.click();
    await expect(pending).resolves.toMatchObject({
      intent: null,
      dismiss: true,
      action: "skip",
    });
    expect(isEditorWelcomeDismissed()).toBe(true);
  });

  it("advances slides on interval even under reduced motion", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);

    void presentEditorWelcome(host);
    const slides = () =>
      [...host.querySelectorAll<HTMLElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.slide}']`)];

    expect(slides()[0]?.classList.contains("is-active")).toBe(true);
    expect(slides()[0]?.querySelector("img")?.getAttribute("src")).toContain("/assets/generated/welcome/");
    vi.advanceTimersByTime(WELCOME_SLIDE_INTERVAL_MS);
    expect(slides()[1]?.classList.contains("is-active")).toBe(true);
    expect(slides()[0]?.classList.contains("is-active")).toBe(false);

    // Reduced motion only softens CSS transitions — carousel still advances.
    host.replaceChildren();
    setMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);

    void presentEditorWelcome(host);
    expect(host.querySelector(".editor-welcome")?.classList.contains("is-reduced-motion")).toBe(true);
    expect(slides()[0]?.classList.contains("is-active")).toBe(true);
    vi.advanceTimersByTime(WELCOME_SLIDE_INTERVAL_MS);
    expect(slides()[1]?.classList.contains("is-active")).toBe(true);
    expect(slides()[0]?.classList.contains("is-active")).toBe(false);
  });
});
