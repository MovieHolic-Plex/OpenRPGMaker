import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderCommitHistoryButton, renderIdentityTopbarControl, openLoginModalIfNeeded, openMockLoginModal } from "@/editor/teamWorkflowUi";
import { renderTopbar } from "@/editor/panels/menu";
import { createBlankProject } from "@/project/defaults";
import { setOwnerLabel } from "@/project/editorIdentity";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { installMemoryProjectSession, type MemoryProjectSession } from "./support/projectSession";

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
    topbar.append(renderIdentityTopbarControl(() => renderTopbar(topbar)));
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

  it("renders history and identity as icon-only controls", () => {
    setOwnerLabel("게스트");
    const history = renderCommitHistoryButton();
    const identity = renderIdentityTopbarControl(() => undefined);
    document.body.append(history, identity);

    expect(history.className).toContain("is-icon-only");
    expect(history.getAttribute("aria-label")).toBe("커밋 히스토리");
    expect(history.textContent?.includes("히스토리")).toBe(false);
    expect(identity.className).toContain("is-icon-only");
    expect(findByTestId(fakeElement(identity), "topbar-identity-label")?.textContent).toBe("게스트");
  });
});
