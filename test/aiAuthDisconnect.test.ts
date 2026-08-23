// 연결 해제(자격 삭제) 경로 회귀 스펙 — C7.
//
// 고정하는 옛 결함: 저장된 키·토큰을 지우는 경로가 코드 전체에 없어서, 잘못 저장한 키를
// 지울 방법이 없었다. 상태는 계속 "연결됨"인데 모든 턴이 401 이 됐다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

const fetchChatGptAuthStatus = vi.fn();
const disconnectCompanionAuth = vi.fn();

vi.mock("@/ai/chatgptOAuthClient", async () => {
  const actual = await import("@/ai/chatgptOAuthClient");
  return {
    ...actual,
    fetchChatGptAuthStatus: (...args: unknown[]) => fetchChatGptAuthStatus(...args),
    disconnectCompanionAuth: (...args: unknown[]) => disconnectCompanionAuth(...args),
  };
});

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

async function render(): Promise<{ root: FakeElement; dispose: () => void }> {
  const { defaultAiConfig } = await import("@/ai/llmClient");
  const { renderAiAuthSettings } = await import("@/editor/panels/aiAuthSettings");
  let view!: ReturnType<typeof renderAiAuthSettings>;
  const root = renderWithFakeDom(() => {
    view = renderAiAuthSettings(defaultAiConfig(), () => undefined);
    return view.element;
  });
  return { root, dispose: () => view.dispose() };
}

describe("연결 해제", () => {
  it("자격이 없으면 버튼을 숨긴다 — 지울 것이 없는 해제 버튼은 거짓말이다", async () => {
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
    const { root, dispose } = await render();
    await vi.waitFor(() => {
      expect(findByTestId(root, "ai-oauth-status")?.dataset.tone).toBe("disconnected");
    });

    expect(findByTestId(root, "ai-auth-disconnect")?.hidden).toBe(true);
    dispose();
  });

  it("환경 변수만 있는 연결에는 버튼을 띄우지 않는다 — 에디터가 지울 수 없는 자격이다", async () => {
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, env: true });
    const { root, dispose } = await render();
    await vi.waitFor(() => {
      expect(findByTestId(root, "ai-oauth-status")?.textContent).toContain("환경 변수만");
    });

    expect(findByTestId(root, "ai-auth-disconnect")?.hidden).toBe(true);
    dispose();
  });

  it("저장된 자격이 있으면 버튼을 띄우고, 누르면 자격을 지우고 상태를 되돌린다", async () => {
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, authKind: "oauth", planType: "plus" });
    disconnectCompanionAuth.mockResolvedValue({ connected: false });
    const { root, dispose } = await render();
    const button = findByTestId(root, "ai-auth-disconnect");
    await vi.waitFor(() => {
      expect(button?.hidden).toBe(false);
    });

    button?.click();

    await vi.waitFor(() => {
      expect(findByTestId(root, "ai-oauth-status")?.dataset.tone).toBe("disconnected");
    });
    expect(disconnectCompanionAuth).toHaveBeenCalledWith("openai-codex");
    // 해제 후에는 다시 뜨지 않는다 — 남은 자격이 없다.
    expect(button?.hidden).toBe(true);
    expect(findByTestId(root, "ai-oauth-login")?.textContent).toBe("로그인");
    dispose();
  });

  it("해제가 실패하면 서버 오류를 그대로 보여주고 버튼을 되살린다", async () => {
    const { ChatGptCompanionResponseError } = await import("@/ai/chatgptOAuthClient");
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, authKind: "apiKey" });
    disconnectCompanionAuth.mockRejectedValue(new ChatGptCompanionResponseError(500, "store is read-only"));
    const { root, dispose } = await render();
    const button = findByTestId(root, "ai-auth-disconnect");
    await vi.waitFor(() => {
      expect(button?.hidden).toBe(false);
    });

    button?.click();

    await vi.waitFor(() => {
      expect(findByTestId(root, "ai-oauth-server-error")?.hidden).toBe(false);
    });
    expect(findByTestId(root, "ai-oauth-server-error")?.textContent).toContain("store is read-only");
    expect(button?.disabled).toBe(false);
    dispose();
  });
});
