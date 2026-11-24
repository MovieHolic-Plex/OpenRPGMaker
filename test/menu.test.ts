import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderCommitHistoryButton, renderIdentityTopbarControl, openLoginModalIfNeeded, openMockLoginModal, openCommitHistoryPanel, openIdentityMenu } from "@/editor/teamWorkflowUi";
import { listEditorCommands } from "@/editor/commandRegistry";
import { renderTopbar, RETIRED_TOPBAR_CONTROLS } from "@/editor/panels/menu";
import { createBlankProject } from "@/project/defaults";
import { setOwnerLabel } from "@/project/editorIdentity";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { installMemoryProjectSession, type MemoryProjectSession } from "./support/projectSession";
import { isolateTimers } from "./mergedTeardown";

describe("teamWorkflowUi", () => {
  isolateTimers();
  const COMMIT_ROWS = [
    {
      agentName: null,
      authorId: "session-1",
      authorKind: "human",
      authorLabel: "tester@example.com",
      commitId: "commit-1",
      createdAt: "2026-07-06T12:00:00.000Z",
      message: "변경 저장",
      reviewStatus: "direct",
      summary: "타일 3",
    },
  ] as const;
  const OWNER_LABEL_KEY = "oprn:editor-owner-label";
  const LAST_LOGIN_METHOD_KEY = "oprn:editor-last-login-method";
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();

    get length(): number {
      return this.values.size;
    }

    clear(): void {
      this.values.clear();
    }

    getItem(key: string): string | null {
      return this.values.get(key) ?? null;
    }

    key(index: number): string | null {
      return Array.from(this.values.keys())[index] ?? null;
    }

    removeItem(key: string): void {
      this.values.delete(key);
    }

    setItem(key: string, value: string): void {
      this.values.set(key, value);
    }
  }
  let restoreDom: (() => void) | null = null;
  let storage: MemoryStorage;
  let session: MemoryProjectSession | null = null;
  function fakeBody(): FakeElement {
    if (document.body instanceof FakeElement) return document.body;
    throw new Error("Expected fake body");
  }
  function fakeElement(node: HTMLElement): FakeElement {
    if (node instanceof FakeElement) return node;
    throw new Error("Expected fake element");
  }
  function installStorage(): void {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: storage,
    });
  }
  function installWindow(): void {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: Object.assign(new EventTarget(), {
        localStorage: storage,
        setTimeout: (handler: TimerHandler) => {
          if (typeof handler === "function") handler();
          return 0;
        },
      }),
    });
    Object.defineProperty(document, "addEventListener", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(document, "removeEventListener", {
      configurable: true,
      value: vi.fn(),
    });
  }
  beforeEach(() => {
    restoreDom = installFakeDom();
    installStorage();
    installWindow();
    // 커밋 목록은 포트가 정본이다. 예전에는 sync 모듈을 목킹했는데, 그 목은 기본 어댑터가
    // LegacyDb 일 때만 살아 있었다 — 기본값이 바뀌면 조용히 빈 목록을 검증하게 된다.
    session = installMemoryProjectSession();
    vi.spyOn(session.repository.commits, "list").mockResolvedValue([...COMMIT_ROWS]);
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    session?.dispose();
    session = null;
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "window");
    vi.restoreAllMocks();
  });
  describe("team workflow UI", () => {
    it("명시적으로 열면 이메일 신원을 저장한다 (네트워크 인증 없음)", () => {
      openMockLoginModal();
      const modal = findByTestId(fakeBody(), "login-modal");
      const email = findByTestId(fakeBody(), "login-email") as FakeElement | null;
      const submit = findByTestId(fakeBody(), "login-submit");
      if (!modal || !email || !submit) throw new Error("login modal controls missing");

      email.value = "tester@example.com";
      submit.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      const form = submit.parentElement;
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      expect(storage.getItem(OWNER_LABEL_KEY)).toBe("tester@example.com");
      expect(storage.getItem(LAST_LOGIN_METHOD_KEY)).toBe("email");
      expect(findByTestId(fakeBody(), "login-modal")).toBeNull();

      openLoginModalIfNeeded();
      expect(findByTestId(fakeBody(), "login-modal")).toBeNull();
    });

    it("부팅 게이트는 로그인 벽을 세우지 않고 게스트 신원만 확보한다", () => {
      // 2026-09-22: 이 모달은 "로그인" 이지만 실제로는 커밋 이름표만 정한다. 팀 권한과 코드 경로가
      // 겹치지 않으므로 팀을 안 쓰는 사용자에게는 의미 없는 관문이었고, 한 번 넘기면 영영 안 떠서
      // 정작 팀을 시작하려는 사람에게 안내가 없었다. 부팅에서는 묻지 않는다.
      openLoginModalIfNeeded();
      expect(findByTestId(fakeBody(), "login-modal")).toBeNull();
      expect(storage.getItem(LAST_LOGIN_METHOD_KEY)).toBe("guest");
      // 사용자가 아무것도 안 했는데 「목업 로그인 신원을 설정했습니다」가 뜨면 개발용 문구가 첫 화면에 샌다.
      expect(findByTestId(fakeBody(), "toast")).toBeNull();
    });

    it("suppresses the boot login modal in automation/dev boot contexts", () => {
      (globalThis.window as unknown as { location?: { search: string } }).location = { search: "?freshProject=1" };
      openLoginModalIfNeeded();
      expect(findByTestId(fakeBody(), "login-modal")).toBeNull();

      (globalThis.window as unknown as { location?: { search: string } }).location = { search: "?blankProject=1" };
      openLoginModalIfNeeded();
      expect(findByTestId(fakeBody(), "login-modal")).toBeNull();
    });

    it("auto-guests for deep-linked ?project= without showing login modal", () => {
      (globalThis.window as unknown as { location?: { search: string } }).location = {
        search: "?project=rpg-zzu-narrative-horror-demos",
      };
      openLoginModalIfNeeded();
      expect(findByTestId(fakeBody(), "login-modal")).toBeNull();
      expect(storage.getItem(LAST_LOGIN_METHOD_KEY)).toBe("guest");
    });

    it("switches OAuth to name-only mock flow and stores the selected provider", () => {
      // 부팅 게이트는 더 이상 모달을 열지 않으므로, OAuth 흐름은 명시적 호출로 확인한다.
      openMockLoginModal();
      findByTestId(fakeBody(), "login-oauth-google")?.click();
      const name = findByTestId(fakeBody(), "login-name") as FakeElement | null;
      if (!name) throw new Error("login-name missing");
      name.value = "Google 리뷰어";
      name.parentElement?.parentElement?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      expect(storage.getItem(OWNER_LABEL_KEY)).toBe("Google 리뷰어");
      expect(storage.getItem(LAST_LOGIN_METHOD_KEY)).toBe("google");
    });

    it("renders topbar identity and allows label edits from the identity menu", () => {
      setOwnerLabel("기존 사용자");
      const topbar = document.createElement("div");
      // 톱바는 더 이상 신원 단추를 그리지 않는다(⌘K 「편집 이름」) — 단추만 다시 그려 갱신을 본다.
      const rerender = (): void => { topbar.replaceChildren(renderIdentityTopbarControl(rerender)); };
      rerender();
      expect(findByTestId(fakeElement(topbar), "topbar-identity-label")?.textContent).toBe("기존 사용자");

      findByTestId(fakeElement(topbar), "topbar-identity")?.click();
      const input = findByTestId(fakeBody(), "identity-label-input") as FakeElement | null;
      if (!input) throw new Error("identity input missing");
      input.value = "새 사용자";
      findByTestId(fakeBody(), "identity-save")?.click();

      expect(storage.getItem(OWNER_LABEL_KEY)).toBe("새 사용자");
      expect(findByTestId(fakeElement(topbar), "topbar-identity-label")?.textContent).toBe("새 사용자");
    });

    it("loads commit history rows through the read-only LegacyDb commit API", async () => {
      const button = renderCommitHistoryButton();
      document.body.append(button);

      button.click();
      await Promise.resolve();
      await Promise.resolve();

      expect(findByTestId(fakeBody(), "commit-history-panel")).not.toBeNull();
      expect(findByTestId(fakeBody(), "commit-history-row-commit-1")?.textContent).toContain("tester@example.com");
      expect(findByTestId(fakeBody(), "commit-history-row-commit-1")?.textContent).toContain("direct");
    });

    it("⌘K 저장 기록·편집 이름 명령이 톱바 단추 없이 같은 패널·메뉴를 연다", async () => {
      // Break: 2026-11 개편으로 톱바 단추를 뺀 뒤 저장 기록·편집 이름에 닿는 길이 사라진다.
      const ids = listEditorCommands().map((command) => command.id);
      expect(ids).toContain("commit-history-toggle");
      expect(ids).toContain("topbar-identity");
      const topbar = document.createElement("div");
      renderTopbar(topbar);
      expect(findByTestId(fakeElement(topbar), "commit-history-toggle")).toBeNull();
      expect(findByTestId(fakeElement(topbar), "topbar-identity")).toBeNull();

      openCommitHistoryPanel();
      await Promise.resolve();
      await Promise.resolve();
      expect(findByTestId(fakeBody(), "commit-history-panel")).not.toBeNull();

      setOwnerLabel("기존 사용자");
      openIdentityMenu(() => undefined);
      expect(findByTestId(fakeBody(), "commit-history-panel"), "한 번에 하나만 뜬다").toBeNull();
      const input = findByTestId(fakeBody(), "identity-label-input") as FakeElement | null;
      expect(input?.value).toBe("기존 사용자");
    });

    it("renders history and identity as icon-only controls", () => {
      setOwnerLabel("게스트");
      const history = renderCommitHistoryButton();
      const identity = renderIdentityTopbarControl(() => undefined);
      document.body.append(history, identity);

      expect(history.className).toContain("is-icon-only");
      expect(history.getAttribute("aria-label")).toBe("저장 기록");
      expect(history.textContent?.includes("기록")).toBe(false);
      expect(identity.className).toContain("is-icon-only");
      expect(findByTestId(fakeElement(identity), "topbar-identity-label")?.textContent).toBe("게스트");
    });
  });
});

describe("windowControls", () => {
  isolateTimers();
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();

    get length(): number {
      return this.values.size;
    }

    clear(): void {
      this.values.clear();
    }

    getItem(key: string): string | null {
      return this.values.get(key) ?? null;
    }

    key(index: number): string | null {
      return Array.from(this.values.keys())[index] ?? null;
    }

    removeItem(key: string): void {
      this.values.delete(key);
    }

    setItem(key: string, value: string): void {
      this.values.set(key, value);
    }
  }
  let restoreDom: (() => void) | null = null;
  let storage: MemoryStorage;
  function fakeElement(node: HTMLElement): FakeElement {
    if (node instanceof FakeElement) return node;
    throw new Error("Expected fake element");
  }
  function fakeBody(): FakeElement {
    if (document.body instanceof FakeElement) return document.body;
    throw new Error("Expected fake body");
  }
  function installStorage(): void {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: storage,
    });
  }
  function installFullscreenDocument(): void {
    const html = document.createElement("html");
    Object.defineProperty(document, "documentElement", {
      configurable: true,
      value: html,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      writable: true,
      value: null,
    });
    Object.defineProperty(document, "addEventListener", {
      configurable: true,
      value: vi.fn(),
    });
  }
  /**
   * 데스크톱 앱 렌더러 흉내 — 기본 vitest 환경(node)에는 window 가 없다. 프리로드가 붙이는
   * window.oprn 브릿지를 window 위에 세우고, 끝나면 지우는 함수를 돌려준다. 코드가
   * `typeof window !== "undefined"` 로 가드를 걸므로 window 자체를 정의해야 하고,
   * 없는 속성(addEventListener 등)은 no-op 함수로 돌려준다.
   */
  function installDesktopBridge(bridge: object | null): () => void {
    const base: Record<string, unknown> = bridge ? { oprn: bridge } : {};
    const win = new Proxy(base, {
      get(target, prop) {
        if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
        if (prop === "document") return document;
        if (prop in globalThis) return (globalThis as Record<string | symbol, unknown>)[prop];
        return () => {};
      },
      has() { return true; },
    });
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: win });
    return () => {
      Reflect.deleteProperty(globalThis, "window");
    };
  }
  beforeEach(() => {
    store.replace(createBlankProject());
    restoreDom = installFakeDom();
    installStorage();
    installFullscreenDocument();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    Reflect.deleteProperty(globalThis, "localStorage");
    vi.restoreAllMocks();
  });
  /**
   * 2026-11 개편: 전체화면 단추는 톱바를 떠나 ⌘K 「화면: 전체화면 전환」 명령이 집이다.
   * 명령은 menu.ts 를 실행 때 불러오므로 click() 은 한 틱 뒤에 끝난다 — 아래 단언은 그 뒤를 기다린다.
   */
  function fullscreenCommand(): { click(): void } {
    const command = listEditorCommands().find((entry) => entry.id === "window-fullscreen");
    if (!command) throw new Error("window-fullscreen command missing");
    return { click: () => command.run() };
  }
  async function settleCommand(): Promise<void> {
    await import("@/editor/panels/menu");
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  }
  describe("상단 창 컨트롤", () => {
    it("툴바 접기 버튼은 없다 — 접을 두 번째 툴바 행이 사라졌다(2026-09-03)", () => {
      // Break: 편집 모드 클래식 툴바 행이 되살아나 「─」 접기 버튼과 함께 돌아온다.
      const topbar = document.createElement("div");
      renderTopbar(topbar);

      expect(findByTestId(fakeElement(topbar), "window-toolbar-collapse")).toBeNull();
      expect(findByTestId(fakeElement(topbar), "oprn-toolbar")).toBeNull();
      expect(document.body.classList.contains("toolbar-collapsed")).toBe(false);
      // 2026-11 개편: 전체화면 단추도 톱바에 없다 — ⌘K 명령이 집이다.
      expect(findByTestId(fakeElement(topbar), "window-fullscreen")).toBeNull();
    });

    it("⌘K 전체화면 명령이 requestFullscreen을 호출한다", async () => {
      const requestFullscreen = vi.fn<() => Promise<void>>(() => Promise.resolve());
      Object.defineProperty(document.documentElement, "requestFullscreen", {
        configurable: true,
        value: requestFullscreen,
      });
      const fullscreen = fullscreenCommand();

      fullscreen.click();
      await settleCommand();

      expect(requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it("전체화면 API가 없으면 토스트를 표시하고 예외 없이 반환한다", async () => {
      const fullscreen = fullscreenCommand();

      expect(() => fullscreen.click()).not.toThrow();
      await settleCommand();
      expect(findByTestId(fakeBody(), "toast")?.textContent).toContain("전체화면");
    });

    it("데스크톱 창 브릿지가 있으면 전체화면을 창 컨트롤로 토글한다", async () => {
      // Break: 브릿지가 있는데도 브라우저 Fullscreen API 를 부르면, 네이티브 전체화면으로 뜬
      // 앱 창은 「축소」가 되지 않는다(2026-10-05 사용자 보고).
      const requestFullscreen = vi.fn<() => Promise<void>>(() => Promise.resolve());
      Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
      const windowControl = vi.fn(async () => true);
      const disposeBridge = installDesktopBridge({ windowControl });
      try {
        const fullscreen = fullscreenCommand();

        fullscreen.click();
        await settleCommand();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(windowControl).toHaveBeenCalledWith("toggle-fullscreen");
        expect(requestFullscreen).not.toHaveBeenCalled();
      } finally {
        disposeBridge();
      }
    });

    it("보관된 전체화면 단추는 데스크톱 네이티브 전체화면 상태를 구독해 aria-pressed 를 맞춘다", async () => {
      // Break: 창 컨트롤로 들어간 전체화면은 document.fullscreenElement 를 바꾸지 않아
      // 아이콘이 항상 「아님」으로 남는다.
      const listeners: Array<(fullscreen: boolean) => void> = [];
      const disposeBridge = installDesktopBridge({
        windowControl: vi.fn(async () => true),
        windowFullscreen: async () => true,
        onWindowFullscreen: (callback: (fullscreen: boolean) => void) => {
          listeners.push(callback);
          return () => { listeners.length = 0; };
        },
      });
      try {
        // 2026-11 개편으로 톱바에서 뺐지만 되살릴 수 있게 보관한 단추(RETIRED_TOPBAR_CONTROLS)가 이 계약을 지킨다.
        const fullscreen = fakeElement(RETIRED_TOPBAR_CONTROLS.fullscreen());

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(fullscreen.getAttribute("aria-pressed")).toBe("true");

        for (const listener of listeners) listener(false);
        expect(fullscreen.getAttribute("aria-pressed")).toBe("false");
      } finally {
        disposeBridge();
      }
    });
  });
});
