import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import type { ChatGptAuthStatus } from "@/ai/chatgptOAuthClient";

const fetchChatGptAuthStatus = vi.fn();
const startChatGptLogin = vi.fn();
const disconnectCompanionAuth = vi.fn();

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const pendingFetches: Deferred<ChatGptAuthStatus>[] = [];

vi.mock("@/ai/chatgptOAuthClient", async () => {
  const actual = await import("@/ai/chatgptOAuthClient");
  return {
    ...actual,
    fetchChatGptAuthStatus: (...args: unknown[]) => fetchChatGptAuthStatus(...args),
    startChatGptLogin: (...args: unknown[]) => startChatGptLogin(...args),
    disconnectCompanionAuth: (...args: unknown[]) => disconnectCompanionAuth(...args),
  };
});

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  pendingFetches.length = 0;
  fetchChatGptAuthStatus.mockImplementation(() => {
    const request = deferred<ChatGptAuthStatus>();
    pendingFetches.push(request);
    return request.promise;
  });
  restoreDom = installFakeDom();
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
      clear: () => values.clear(),
    },
  });
});

afterEach(async () => {
  const { resetAiConnectionStatusCache } = await import("@/editor/panels/aiConnectionStatus");
  resetAiConnectionStatusCache();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

async function settleNextFetch(status: ChatGptAuthStatus): Promise<void> {
  const request = pendingFetches.shift();
  expect(request, "expected an exact /auth/status request").toBeDefined();
  request?.resolve(status);
  // Production registered its await continuation before this test continuation. Awaiting the same request
  // therefore observes applyStatus/cache publication without sleeps or polling.
  await request?.promise;
}

async function renderAuthPanel(): Promise<{ root: FakeElement; dispose: () => void }> {
  const { defaultAiConfig } = await import("@/ai/llmClient");
  const { renderAiAuthSettings } = await import("@/editor/panels/aiAuthSettings");
  let view!: ReturnType<typeof renderAiAuthSettings>;
  const root = renderWithFakeDom(() => {
    view = renderAiAuthSettings(defaultAiConfig(), () => undefined);
    return view.element;
  });
  return { root, dispose: () => view.dispose() };
}

describe("인증 변경은 공유 AI gate 캐시를 즉시 갱신한다", () => {
  it("같은 제공자에서 로그인하면 reload 없이 타일셋 gate가 열리고 로그아웃하면 다시 닫힌다", async () => {
    const { refreshAiConnectionStatus } = await import("@/editor/panels/aiConnectionStatus");
    const { hasCpenTilesetApiKey } = await import("@/editor/panels/tilesetAiCpenClient");

    const bootRefresh = refreshAiConnectionStatus();
    await settleNextFetch({ connected: false });
    await bootRefresh;
    expect(hasCpenTilesetApiKey()).toBe(false);

    const { root, dispose } = await renderAuthPanel();
    await settleNextFetch({ connected: false }); // panel initial status
    await settleNextFetch({ connected: false }); // applyStatus shared-cache re-warm
    expect(findByTestId(root, "ai-oauth-status")?.dataset.tone).toBe("disconnected");

    const login = deferred<{ connected: boolean }>();
    startChatGptLogin.mockReturnValueOnce(login.promise);
    findByTestId(root, "ai-oauth-login")?.click();
    login.resolve({ connected: true });
    await login.promise;
    await settleNextFetch({ connected: true, env: false, planType: "plus" }); // login follow-up
    await settleNextFetch({ connected: true, env: false, planType: "plus" }); // shared re-warm
    expect(hasCpenTilesetApiKey()).toBe(true);

    const logout = deferred<ChatGptAuthStatus>();
    disconnectCompanionAuth.mockReturnValueOnce(logout.promise);
    expect(findByTestId(root, "ai-auth-disconnect")?.hidden).toBe(false);
    findByTestId(root, "ai-auth-disconnect")?.click();
    logout.resolve({ connected: false });
    await logout.promise;
    await settleNextFetch({ connected: false }); // shared re-warm after logout applyStatus
    expect(hasCpenTilesetApiKey()).toBe(false);

    dispose();
  });

  it("인증 변경 전 부팅 조회가 늦게 와도 새 로그인 상태를 덮지 않는다", async () => {
    const { refreshAiConnectionStatus, getAiConnectionStatus } = await import("@/editor/panels/aiConnectionStatus");
    const bootRefresh = refreshAiConnectionStatus();
    const bootRequest = pendingFetches.shift();
    expect(bootRequest).toBeDefined();

    const { dispose } = await renderAuthPanel();
    await settleNextFetch({ connected: true, env: false, planType: "plus" }); // panel status
    await settleNextFetch({ connected: true, env: false, planType: "plus" }); // reset generation re-warm
    expect(getAiConnectionStatus().kind).toBe("ready");

    bootRequest?.resolve({ connected: false });
    await bootRequest?.promise;
    await bootRefresh;
    expect(getAiConnectionStatus().kind).toBe("ready");

    dispose();
  });
});
