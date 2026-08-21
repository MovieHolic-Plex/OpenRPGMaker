// 인증 패널의 OAuth / API 키 분리 회귀 스펙.
//
// 고정하는 옛 결함(전부 2026-08-21 실측):
//  ① 키 입력칸이 "ChatGPT 구독" 패널 안에 있고 "API / 게이트웨이" 패널에는 입력이 없었다.
//  ② 키 칸을 `id === "openai-codex"` 로만 숨겨 나머지 OAuth 제공자 13종에 키 칸이 떴다.
//  ③ 제공자 68종을 종류 구분 없이 나열하고 옵션 텍스트에 영어 enum(`· oauth`)이 샜다.
//  ④ 안내문(companionHint)에 hidden 이 없어 열 때마다 번쩍이고, 성공 경로에서도 미로그인
//     사용자에게 "서비스가 안 켜졌다"고 오진했다.
//  ⑤ 감독 결정: env 자격은 무시한다 — 셸 환경 변수만 있는 상태를 "연결됨"이라 말하지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

const fetchChatGptAuthStatus = vi.fn();
const startChatGptLogin = vi.fn();
const saveCompanionApiKey = vi.fn();
const refreshCompanionAuth = vi.fn();

vi.mock("@/ai/chatgptOAuthClient", async () => {
  const actual = await import("@/ai/chatgptOAuthClient");
  return {
    ...actual,
    fetchChatGptAuthStatus: (...args: unknown[]) => fetchChatGptAuthStatus(...args),
    startChatGptLogin: (...args: unknown[]) => startChatGptLogin(...args),
    saveCompanionApiKey: (...args: unknown[]) => saveCompanionApiKey(...args),
    refreshCompanionAuth: (...args: unknown[]) => refreshCompanionAuth(...args),
  };
});

async function loadPanel() {
  return await import("@/editor/panels/aiAuthSettings");
}

async function loadDeps() {
  return {
    llm: await import("@/ai/llmClient"),
    providers: await import("@/ai/ohMyPiProviders"),
    kind: await import("@/ai/aiConnectionKind"),
  };
}

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  restoreDom = installFakeDom();
  fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  vi.unstubAllGlobals();
});

/** 패널을 렌더하고 루트를 돌려준다. providerId 를 지정하면 그 제공자로 시작한다. */
async function render(providerId?: string): Promise<{ root: FakeElement; dispose: () => void }> {
  const { llm } = await loadDeps();
  const { renderAiAuthSettings } = await loadPanel();
  const config = { ...llm.defaultAiConfig(), ...(providerId ? { providerId } : {}) };
  let view!: ReturnType<typeof renderAiAuthSettings>;
  const root = renderWithFakeDom(() => {
    view = renderAiAuthSettings(config, () => undefined);
    return view.element;
  });
  return { root, dispose: () => view.dispose() };
}

function optionValues(select: FakeElement | null): readonly string[] {
  return (select?.querySelectorAll("option") ?? []).map((option) => option.getAttribute("value") ?? "");
}

function optionTexts(select: FakeElement | null): readonly string[] {
  return (select?.querySelectorAll("option") ?? []).map((option) => option.textContent ?? "");
}

describe("연결 방식은 두 종류다", () => {
  it("radiogroup 으로 두 종류를 제공하고 기본은 구독 로그인이다", async () => {
    const { root, dispose } = await render();
    const oauth = findByTestId(root, "ai-auth-oauth");
    const apiKey = findByTestId(root, "ai-auth-api-key");

    expect(oauth?.getAttribute("role")).toBe("radio");
    expect(apiKey?.getAttribute("role")).toBe("radio");
    expect(oauth?.getAttribute("aria-checked")).toBe("true");
    expect(apiKey?.getAttribute("aria-checked")).toBe("false");
    // 선택된 것만 탭 순서에 들어간다(roving tabindex) — 라디오 그룹의 표준 동작이다.
    expect(oauth?.getAttribute("tabindex")).toBe("0");
    expect(apiKey?.getAttribute("tabindex")).toBe("-1");
    dispose();
  });

  it("종류를 바꾸면 제공자 목록이 그 종류로 갈린다", async () => {
    const { root, dispose } = await render();
    const select = findByTestId(root, "ai-oh-my-pi-provider");
    const { kind } = await loadDeps();

    expect(optionValues(select)).toEqual(kind.providersForKind("oauth").map((row) => row.id));
    expect(optionValues(select)).toHaveLength(14);

    findByTestId(root, "ai-auth-api-key")?.click();

    expect(optionValues(select)).toEqual(kind.providersForKind("apiKey").map((row) => row.id));
    expect(optionValues(select)).toHaveLength(54);
    dispose();
  });

  it("옵션 텍스트에 영어 enum 을 흘리지 않는다", async () => {
    const { root, dispose } = await render();
    for (const text of optionTexts(findByTestId(root, "ai-oh-my-pi-provider"))) {
      expect(text).not.toMatch(/·\s*(oauth|apiKey|local)\s*$/u);
    }
    dispose();
  });
});

describe("키 입력칸은 자격 종류로 갈린다", () => {
  it("OAuth 제공자 14종 전부에서 키 칸이 숨는다", async () => {
    const { providers } = await loadDeps();
    for (const provider of providers.ohMyPiProvidersByAuthKind("oauth")) {
      const { root, dispose } = await render(provider.id);
      expect(findByTestId(root, "ai-companion-key-row")?.hidden, provider.id).toBe(true);
      dispose();
    }
  });

  it("API 키 제공자에서는 키 칸이 보인다", async () => {
    const { root, dispose } = await render("zai");
    expect(findByTestId(root, "ai-companion-key-row")?.hidden).toBe(false);
    expect(findByTestId(root, "ai-companion-api-key")).not.toBeNull();
    expect(findByTestId(root, "ai-companion-save-key")).not.toBeNull();
    dispose();
  });

  it("로컬 서버 제공자는 키가 필요 없다고 알리고 칸을 숨긴다", async () => {
    const { root, dispose } = await render("ollama");
    expect(findByTestId(root, "ai-companion-key-row")?.hidden).toBe(true);
    expect(findByTestId(root, "ai-auth-provider-help")?.textContent ?? "").toContain("키가 필요 없");
    dispose();
  });
});

describe("안내와 오류를 구분하고 오진하지 않는다", () => {
  it("열자마자 '서비스를 실행하세요' 안내가 번쩍이지 않는다", async () => {
    const { root, dispose } = await render();
    expect(findByTestId(root, "ai-auth-hint")?.hidden).toBe(true);
    expect(findByTestId(root, "ai-oauth-server-error")?.hidden).toBe(true);
    dispose();
  });

  it("응답이 왔는데 미로그인이면 '서비스가 안 켜졌다'고 말하지 않는다", async () => {
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
    const { root, dispose } = await render();
    await Promise.resolve();
    await Promise.resolve();

    expect(findByTestId(root, "ai-auth-hint")?.hidden).toBe(true);
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("로그인 필요");
    dispose();
  });

  it("도달 불가일 때만 서비스 실행 안내를 띄운다", async () => {
    const { ChatGptCompanionUnreachableError } = await import("@/ai/chatgptOAuthClient");
    fetchChatGptAuthStatus.mockRejectedValue(new ChatGptCompanionUnreachableError(undefined, "network"));
    const { root, dispose } = await render();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const hint = findByTestId(root, "ai-auth-hint");
    expect(hint?.hidden).toBe(false);
    expect(hint?.textContent ?? "").toContain("ai:oauth");
    dispose();
  });
});

describe("env 자격은 연결로 인정하지 않는다 (감독 결정)", () => {
  it("환경 변수만 있으면 로그인 필요로 말한다", async () => {
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, env: true });
    const { root, dispose } = await render();
    await Promise.resolve();
    await Promise.resolve();

    const text = findByTestId(root, "ai-oauth-status")?.textContent ?? "";
    expect(text).toContain("환경 변수");
    expect(findByTestId(root, "ai-oauth-status")?.dataset.tone).toBe("disconnected");
    dispose();
  });

  it("저장된 자격이면 연결됨이다", async () => {
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, env: false, planType: "plus" });
    const { root, dispose } = await render();
    await Promise.resolve();
    await Promise.resolve();

    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("연결됨");
    expect(findByTestId(root, "ai-oauth-status")?.dataset.tone).toBe("connected");
    dispose();
  });

  it("만료된 자격은 연결됨이 아니다", async () => {
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, expired: true });
    const { root, dispose } = await render();
    await Promise.resolve();
    await Promise.resolve();

    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("만료");
    dispose();
  });
});

describe("기기 로그인", () => {
  it("코드와 주소를 링크로 보여 주고 취소를 제공한다", async () => {
    startChatGptLogin.mockResolvedValue({
      verificationUrl: "https://example.invalid/device",
      userCode: "ABCD-EFGH",
    });
    const { root, dispose } = await render();
    await Promise.resolve();

    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    await Promise.resolve();

    const block = findByTestId(root, "ai-oauth-device-code");
    expect(block?.hidden).toBe(false);
    expect(findByTestId(root, "ai-oauth-device-usercode")?.textContent).toBe("ABCD-EFGH");
    const link = findByTestId(root, "ai-oauth-device-url");
    expect(link?.getAttribute("href")).toBe("https://example.invalid/device");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(findByTestId(root, "ai-oauth-copy-code")).not.toBeNull();
    // 옛 구현은 5초 뒤 한 번만 확인하고 끝나서, 그보다 오래 걸리면 영구히 "대기 중"이었다.
    expect(findByTestId(root, "ai-oauth-device-poll")?.textContent ?? "").toContain("/60");
    expect(findByTestId(root, "ai-oauth-device-cancel")).not.toBeNull();
    dispose();
  });

  it("취소하면 폴링을 멈추고 그렇게 말한다", async () => {
    startChatGptLogin.mockResolvedValue({ verificationUrl: "https://example.invalid/d", userCode: "X" });
    const { root, dispose } = await render();
    await Promise.resolve();
    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    await Promise.resolve();

    findByTestId(root, "ai-oauth-device-cancel")?.click();

    expect(findByTestId(root, "ai-oauth-device-code")?.hidden).toBe(true);
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("취소");
    dispose();
  });
});

describe("API 키 저장은 동반 서비스로 간다", () => {
  it("키를 저장하면 입력칸을 비우고 상태를 갱신한다", async () => {
    saveCompanionApiKey.mockResolvedValue({ connected: true, env: false, authKind: "apiKey" });
    const { root, dispose } = await render("zai");
    await Promise.resolve();
    const input = findByTestId(root, "ai-companion-api-key") as unknown as HTMLInputElement;
    input.value = "sk-secret";

    findByTestId(root, "ai-companion-save-key")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(saveCompanionApiKey).toHaveBeenCalledWith("zai", "sk-secret");
    // 브라우저에 키를 남기지 않는다 — 저장 후 입력칸을 비운다.
    expect(input.value).toBe("");
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("연결됨");
    dispose();
  });

  it("빈 키는 상태 문구를 덮어쓰지 않고 입력 옆에서 알린다", async () => {
    const { root, dispose } = await render("zai");
    await Promise.resolve();
    await Promise.resolve();
    const statusBefore = findByTestId(root, "ai-oauth-status")?.textContent;

    findByTestId(root, "ai-companion-save-key")?.click();

    expect(saveCompanionApiKey).not.toHaveBeenCalled();
    expect(findByTestId(root, "ai-oauth-status")?.textContent).toBe(statusBefore);
    expect(findByTestId(root, "ai-auth-provider-help")?.textContent ?? "").toContain("키를 입력하세요");
    dispose();
  });
});
