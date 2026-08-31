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
import { GENRE_PACK_IDS } from "@/project/genrePackId";

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
  installMemoryStorage();
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
  // BREAK: variant worlds (이브/아오오니) were grey sub-chips under a pack card, so the title the user
  // actually arrives with was the weakest thing on screen. Every preset is now a peer poster, and
  // data-pack-id marks the one anchor poster per official pack.
  it("gives every genre a peer poster and anchors each official pack exactly once", () => {
    const host = document.createElement("div");
    document.body.append(host);
    void presentEditorWelcome(host);

    const packNodes = Array.from(host.querySelectorAll<HTMLElement>("[data-pack-id]"));
    expect(packNodes.map((node) => node.dataset.packId).sort()).toEqual([...GENRE_PACK_IDS].sort());
    for (const packId of GENRE_PACK_IDS) {
      expect(host.querySelectorAll(`[data-pack-id='${packId}']`)).toHaveLength(1);
    }
    expect(host.querySelectorAll("[data-testid^='editor-welcome-template-card-']")).toHaveLength(7);
    const featured = host.querySelector(".editor-welcome-briefing-cards");
    expect(featured?.querySelectorAll("[data-testid^='editor-welcome-template-card-']")).toHaveLength(3);
    const more = host.querySelector("#editor-welcome-more-grid");
    expect(more?.querySelectorAll("[data-testid^='editor-welcome-template-card-']")).toHaveLength(4);
    for (const presetId of ["partner-raise", "school-horror"]) {
      const variant = host.querySelector<HTMLElement>(`[data-preset-id='${presetId}']`);
      expect(variant).toBeTruthy();
      expect(variant?.closest(".editor-welcome-briefing-cards")).toBeNull();
      expect(variant?.closest("#editor-welcome-more-grid")).toBeTruthy();
      // A variant is a top-level poster, not nested under — and not an anchor for — its pack.
      expect(variant?.dataset.packId).toBeUndefined();
      expect(variant?.closest("[data-pack-id]")).toBeNull();
    }
  });

  it("mounts a canvas briefing with one question, one input, and three featured genre posters", () => {
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
    const featured = host.querySelector(".editor-welcome-briefing-cards");
    expect(featured?.querySelectorAll("[data-testid^='editor-welcome-template-card']")).toHaveLength(3);
    for (const caption of ["몬스터 수집", "모험 JRPG", "회상 스토리"]) {
      expect(featured?.textContent).toContain(caption);
    }
    for (const caption of ["이브 같은", "갤러리 호러", "아오오니 같은", "학교 호러", "파트너 육성", "농장 생활"]) {
      expect(featured?.textContent).not.toContain(caption);
      expect(host.textContent).toContain(caption);
    }
    // The system-preset action is one gear per poster, not a repeated full-width button.
    expect(host.querySelectorAll("[data-testid^='editor-welcome-starter-card-']")).toHaveLength(7);
    expect(featured?.querySelectorAll("[data-testid^='editor-welcome-starter-card-']")).toHaveLength(3);
    expect(host.querySelector("[data-testid='editor-welcome-starter-card-0']")?.textContent).not.toContain("빈 프로젝트");
    expect(document.querySelector("[data-testid='app-modal-confirm']")).toBeNull();
  });

  it("keeps the free-text second tier collapsed until asked for", () => {
    const host = document.createElement("div");
    document.body.append(host);
    void presentEditorWelcome(host);

    const toggle = host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.moreToggle}']`);
    const grid = host.querySelector<HTMLElement>("#editor-welcome-more-grid");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(grid?.hidden).toBe(true);
    expect(host.querySelectorAll(`[data-testid^='${EDITOR_WELCOME_TESTIDS.moreCard}-']`).length).toBeGreaterThanOrEqual(10);
    // Hidden posters must not fetch ~1MB art each before the tier is opened.
    for (const img of Array.from(host.querySelectorAll<HTMLImageElement>(".editor-welcome-poster-img"))) {
      expect(img.getAttribute("loading")).toBe("lazy");
    }

    toggle?.click();
    expect(grid?.hidden).toBe(false);
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
  });

  it("second-tier poster sends its intent through the free-text path", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = presentEditorWelcome(host);
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.moreToggle}']`)?.click();
    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.moreCard}-0']`)?.click();

    const result = await pending;
    expect(result.source).toBe("free-text");
    expect(result.autoSend).toBe(true);
    expect(result.presetId).toBeUndefined();
    expect(result.intent).toBeTruthy();
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

  it("card click auto-sends that world's prompt on the current map", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const pending = presentEditorWelcome(host);
    host.querySelector<HTMLButtonElement>("[data-testid='editor-welcome-template-card-0']")?.click();
    expect(document.querySelector("[data-testid='app-modal-confirm']")).toBeNull();
    const result = await pending;
    expect(result.action).toBe("start");
    expect(result.systemPresetPlan).toBeUndefined();
    expect(result.autoSend).toBe(true);
    expect(result.source).toBe("chip");
    expect(result.intent).toBe("몬스터 수집");
    expect(result.presetId).toBe("monster-collect");
    expect(result.prompt).toContain("포획·도감·야생 조우");
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

  it("BREAK: keeps project welcome state visible and reports remote preparation failure", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const applySystemPreset = vi.fn(async () => {
      throw new Error("remote reload failed");
    });
    const pending = (presentEditorWelcome as unknown as (
      host: HTMLElement,
      options: { applySystemPreset: (plan: unknown) => Promise<void> },
    ) => ReturnType<typeof presentEditorWelcome>)(host, { applySystemPreset });

    host.querySelector<HTMLButtonElement>("[data-testid='editor-welcome-starter-card-0']")?.click();
    document.querySelector<HTMLButtonElement>("[data-testid='app-modal-confirm']")?.click();
    await vi.waitFor(() => expect(applySystemPreset).toHaveBeenCalledOnce());

    expect(host.querySelector(`[data-testid='${EDITOR_WELCOME_TESTIDS.host}']`)).toBeTruthy();
    expect(host.querySelector("[data-testid='editor-welcome-system-preset-error']")?.getAttribute("role")).toBe("alert");
    expect(isEditorWelcomeDismissed()).toBe(false);

    host.querySelector<HTMLButtonElement>(`[data-testid='${EDITOR_WELCOME_TESTIDS.skip}']`)?.click();
    await expect(pending).resolves.toMatchObject({ action: "skip" });
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
});
