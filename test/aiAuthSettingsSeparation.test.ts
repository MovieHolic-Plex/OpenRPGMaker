// 인증 패널 회귀 스펙 — 두 구독 제공자(Antigravity·Codex)를 고르는 표면.
//
// 고정하는 옛 결함(전부 2026-08-21 실측):
//  ① 키 입력칸이 "ChatGPT 구독" 패널 안에 있고 "API / 게이트웨이" 패널에는 입력이 없었다.
//  ② 키 칸을 `id === "openai-codex"` 로만 숨겨 나머지 OAuth 제공자에 키 칸이 떴다 —
//     이제 두 제공자가 모두 구독 로그인이라 **키 입력칸 자체가 없다**(그 부재를 아래서 고정한다).
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
const disconnectCompanionAuth = vi.fn();
const completeOAuthPaste = vi.fn();

// 이 파일은 인증 패널 자체의 경합을 단위 검증한다. 공유 게이트 캐시 배선은
// aiAuthConnectionCache.test.ts 에서 실제 모듈끼리 통합 검증한다.
vi.mock("@/editor/panels/aiConnectionStatus", () => ({
  refreshAiConnectionStatus: vi.fn(async () => undefined),
  resetAiConnectionStatusCache: vi.fn(),
}));

vi.mock("@/ai/chatgptOAuthClient", async () => {
  const actual = await import("@/ai/chatgptOAuthClient");
  return {
    ...actual,
    fetchChatGptAuthStatus: (...args: unknown[]) => fetchChatGptAuthStatus(...args),
    startChatGptLogin: (...args: unknown[]) => startChatGptLogin(...args),
    saveCompanionApiKey: (...args: unknown[]) => saveCompanionApiKey(...args),
    refreshCompanionAuth: (...args: unknown[]) => refreshCompanionAuth(...args),
    disconnectCompanionAuth: (...args: unknown[]) => disconnectCompanionAuth(...args),
    completeOAuthPaste: (...args: unknown[]) => completeOAuthPaste(...args),
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

describe("연결 방식은 제공자 카드다", () => {
  it("죽은 「API 키」종류 카드는 없고 제공자 카드가 곧 선택이다", async () => {
    // 레지스트리의 두 제공자는 모두 oauth 다 — 예전 「연결 방식」카드는 고를 수 없는
    // 「API 키」선택지를 늘 보여 주는 죽은 UI 였다(고르면 같은 두 제공자만 다시 떴다).
    // 지금은 종류 선택이 없고, 제공자 카드가 선택과 상태 표시를 겸한다.
    const { root, dispose } = await render();

    expect(findByTestId(root, "ai-auth-oauth")).toBeNull();
    expect(findByTestId(root, "ai-auth-api-key")).toBeNull();

    const group = findByTestId(root, "ai-auth-quick");
    expect(group?.getAttribute("role")).toBe("radiogroup");
    const gemini = findByTestId(root, "ai-auth-quick-google-antigravity");
    const codex = findByTestId(root, "ai-auth-quick-openai-codex");
    expect(gemini?.getAttribute("role")).toBe("radio");
    expect(codex?.getAttribute("role")).toBe("radio");
    // 기본은 Antigravity — 선택된 것만 탭 순서에 들어간다(roving tabindex).
    expect(gemini?.getAttribute("aria-checked")).toBe("true");
    expect(gemini?.getAttribute("tabindex")).toBe("0");
    expect(codex?.getAttribute("aria-checked")).toBe("false");
    expect(codex?.getAttribute("tabindex")).toBe("-1");
    dispose();
  });

  it("제공자 목록은 두 구독 제공자 그대로다", async () => {
    // 예전 계약은 "Antigravity 하나뿐, select 는 비활성" 이었다. Codex 가 1급 선택지가 됐으므로
    // 목록은 둘이다. select 는 숨은 값·change 원천으로만 남는다 — 보이는 선택은 카드가 한다.
    const { root, dispose } = await render();
    const select = findByTestId(root, "ai-oh-my-pi-provider");

    expect(optionValues(select)).toEqual(["google-antigravity", "openai-codex"]);
    expect(select?.disabled).toBe(false);
    // fakeDom 은 hidden 속성을 속성 필드로 동기화하지 않으므로 attribute 로 본다.
    expect(select?.getAttribute("hidden")).toBe("");
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

describe("API 키 입력칸은 어느 제공자에도 없다", () => {
  // 옛 계약은 "자격 종류로 키 칸을 가른다" 였다. 레지스트리에 apiKey 제공자가 없어진 뒤로는
  // 그 칸이 영구히 숨은 死코드였고, 숨은 input 은 fakeDom·브라우저 자동완성·미래 collect 경로가
  // 값을 읽을 수 있는 표면이다. 그래서 DOM 자체를 없앴고, 그 부재를 여기서 고정한다.
  it("두 제공자 모두에서 키 입력 DOM 이 존재하지 않는다", async () => {
    const { providers } = await loadDeps();
    expect(providers.ohMyPiProvidersByAuthKind("apiKey")).toHaveLength(0);
    for (const provider of providers.OH_MY_PI_PROVIDERS) {
      const { root, dispose } = await render(provider.id);
      expect(findByTestId(root, "ai-companion-key-row"), provider.id).toBeNull();
      expect(findByTestId(root, "ai-companion-api-key"), provider.id).toBeNull();
      expect(findByTestId(root, "ai-companion-save-key"), provider.id).toBeNull();
      dispose();
    }
  });

  it("어느 상태에서도 키 입력칸이 생기지 않는다", async () => {
    // 「API 키」종류 카드 자체가 없어졌으므로, 키 칸이 뜰 경로는 존재하지 않는다.
    const { root, dispose } = await render();
    findByTestId(root, "ai-auth-quick-openai-codex")?.click();
    expect(findByTestId(root, "ai-companion-api-key")).toBeNull();
    dispose();
  });

  it("두 제공자 모두 '키는 입력하지 않는다'고 안내한다", async () => {
    for (const providerId of ["google-antigravity", "openai-codex"]) {
      const { root, dispose } = await render(providerId);
      expect(findByTestId(root, "ai-auth-provider-help")?.textContent ?? "", providerId)
        .toContain("키는 입력하지 않습니다");
      dispose();
    }
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
    // 지금은 계속 기다리되 「(5/60)」 같은 시도 횟수를 보여 주지 않는다.
    const poll = findByTestId(root, "ai-oauth-device-poll")?.textContent ?? "";
    expect(poll).toBe("로그인을 기다리는 중…");
    expect(poll).not.toMatch(/\d+\s*\/\s*\d+/u);
    expect(findByTestId(root, "ai-oauth-device-cancel")).not.toBeNull();
    expect(findByTestId(root, "ai-oauth-paste-row")?.hidden).toBe(true);
    dispose();
  });

  it("원격 루프백 로그인은 공개 origin 링크와 콜백 붙여넣기를 보여 준다", async () => {
    startChatGptLogin.mockResolvedValue({
      verificationUrl: "http://mdc-server:9888/oauth/launch?port=34031",
      userCode: "",
      pasteCallback: true,
    });
    completeOAuthPaste.mockResolvedValue(undefined);
    fetchChatGptAuthStatus
      .mockResolvedValueOnce({ connected: false })
      .mockResolvedValue({ connected: true, env: false });
    const { root, dispose } = await render();
    await Promise.resolve();

    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    await Promise.resolve();

    const link = findByTestId(root, "ai-oauth-device-url");
    expect(link?.getAttribute("href")).toBe("http://mdc-server:9888/oauth/launch?port=34031");
    const pasteRow = findByTestId(root, "ai-oauth-paste-row");
    expect(pasteRow?.hidden).toBe(false);
    const input = findByTestId(root, "ai-oauth-paste-url") as FakeElement & { value?: string };
    input.value = "http://127.0.0.1:34031/oauth-callback?code=ok";
    findByTestId(root, "ai-oauth-paste-submit")?.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(completeOAuthPaste).toHaveBeenCalledWith("http://127.0.0.1:34031/oauth-callback?code=ok");
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("연결됨");
    expect(findByTestId(root, "ai-oauth-device-step3")?.textContent ?? "").toContain("알아서");
    dispose();
  });

  it("원격 로그인 안내는 세 단계이고 ‘연결할 수 없음’ 페이지가 정상이라고 먼저 말한다", async () => {
    startChatGptLogin.mockResolvedValue({
      verificationUrl: "http://mdc-server:9888/oauth/launch?port=34031",
      userCode: "",
      pasteCallback: true,
    });
    const { root, dispose } = await render();
    await Promise.resolve();
    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    await Promise.resolve();

    const step1 = findByTestId(root, "ai-oauth-device-step1")?.textContent ?? "";
    const step2 = findByTestId(root, "ai-oauth-device-step2")?.textContent ?? "";
    const step3 = findByTestId(root, "ai-oauth-device-step3");
    expect(step1).toMatch(/^1\. /u);
    expect(step1).toContain("Google 계정으로 로그인");
    expect(step2).toMatch(/^2\. /u);
    expect(step2).toContain("‘연결할 수 없음’ 페이지가 뜨는 게 정상");
    expect(step2).toContain("주소 전체");
    expect(step3?.hidden).toBe(false);
    expect(step3?.textContent ?? "").toMatch(/^3\. /u);
    // 개발자 용어를 사용자 문구에 흘리지 않는다.
    const block = findByTestId(root, "ai-oauth-device-code")?.textContent ?? "";
    expect(block).not.toMatch(/OAuth|콜백|companion|동반 서비스/iu);
    dispose();
  });

  it("원격 로그인은 주소창을 붙여 넣으면 버튼 없이 연결한다", async () => {
    startChatGptLogin.mockResolvedValue({
      verificationUrl: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
      userCode: "",
      pasteCallback: true,
    });
    completeOAuthPaste.mockResolvedValue(undefined);
    fetchChatGptAuthStatus
      .mockResolvedValueOnce({ connected: false })
      .mockResolvedValue({ connected: true, env: false });
    const { root, dispose } = await render();
    await Promise.resolve();
    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    await Promise.resolve();

    const input = findByTestId(root, "ai-oauth-paste-url") as FakeElement;
    const event = new Event("paste", { cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { getData: () => "http://localhost:34099/oauth-callback?code=from-bar" },
    });
    input.dispatchEvent(event);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(completeOAuthPaste).toHaveBeenCalledWith("http://localhost:34099/oauth-callback?code=from-bar");
    dispose();
  });

  it("이 화면으로 돌아오면 클립보드의 localhost 주소로 연결한다", async () => {
    startChatGptLogin.mockResolvedValue({
      verificationUrl: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
      userCode: "",
      pasteCallback: true,
    });
    completeOAuthPaste.mockResolvedValue(undefined);
    fetchChatGptAuthStatus
      .mockResolvedValueOnce({ connected: false })
      .mockResolvedValue({ connected: true, env: false });
    const readText = vi.fn(async () => "http://127.0.0.1:34099/oauth-callback?code=clip");
    vi.stubGlobal("navigator", { clipboard: { readText } });
    const { root, dispose } = await render();
    await Promise.resolve();
    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(completeOAuthPaste).toHaveBeenCalledWith("http://127.0.0.1:34099/oauth-callback?code=clip");
    dispose();
  });

  it("로그인 주소는 본문 글자로 보이지 않고 다시 열기 링크와 주소 복사만 남는다", async () => {
    // 2026-09-23 실측: 600자 가까운 accounts.google.com 주소가 패널에 글자 그대로 찍혔다.
    const longUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=abc&scope=${"x".repeat(500)}`;
    startChatGptLogin.mockResolvedValue({ verificationUrl: longUrl, userCode: "" });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { root, dispose } = await render();
    await Promise.resolve();
    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    await Promise.resolve();

    const block = findByTestId(root, "ai-oauth-device-code");
    expect(block?.textContent ?? "").not.toContain("accounts.google.com");
    expect(block?.textContent ?? "").not.toContain("https://");
    expect(findByTestId(root, "ai-oauth-device-step1")?.textContent)
      .toBe("Google 로그인 창을 열었어요. 창에서 로그인을 마치면 자동으로 연결됩니다.");
    const link = findByTestId(root, "ai-oauth-device-url");
    expect(link?.textContent).toBe("로그인 창 다시 열기");
    expect(link?.getAttribute("href")).toBe(longUrl);

    findByTestId(root, "ai-oauth-copy-url")?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(longUrl);
    expect(findByTestId(root, "ai-oauth-device-poll")?.textContent ?? "").toContain("주소를 복사했어요");
    dispose();
  });

  it("로그인은 10분 동안 기다리고, 시간이 지나면 이유와 다시 시도 버튼을 보여 준다", async () => {
    const { DEVICE_LOGIN_WINDOW_MS, DEVICE_POLL_INTERVAL_MS } = await loadPanel();
    expect(DEVICE_LOGIN_WINDOW_MS).toBe(10 * 60 * 1000);
    vi.useFakeTimers();
    try {
      startChatGptLogin.mockResolvedValue({ verificationUrl: "https://example.invalid/d", userCode: "" });
      fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
      const { root, dispose } = await render();
      await vi.advanceTimersByTimeAsync(0);
      findByTestId(root, "ai-oauth-login")?.click();
      await vi.advanceTimersByTimeAsync(0);

      // 옛 상한(3분)을 한참 넘긴 9분에도 여전히 기다린다.
      await vi.advanceTimersByTimeAsync(9 * 60 * 1000);
      expect(findByTestId(root, "ai-oauth-device-code")?.hidden).toBe(false);
      expect(findByTestId(root, "ai-oauth-device-poll")?.textContent).toBe("로그인을 기다리는 중…");
      expect(findByTestId(root, "ai-oauth-timeout")?.getAttribute("hidden")).not.toBeNull();

      await vi.advanceTimersByTimeAsync(60 * 1000 + DEVICE_POLL_INTERVAL_MS);
      expect(findByTestId(root, "ai-oauth-device-code")?.hidden).toBe(true);
      const notice = findByTestId(root, "ai-oauth-timeout");
      expect(notice?.hidden).toBe(false);
      expect(notice?.textContent ?? "").toContain("시간이 지나 로그인을 멈췄어요. 다시 시도해 주세요.");

      // 다시 시도는 새 로그인을 시작하고 안내를 걷는다.
      startChatGptLogin.mockClear();
      findByTestId(root, "ai-oauth-timeout-retry")?.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(startChatGptLogin).toHaveBeenCalledTimes(1);
      expect(notice?.hidden).toBe(true);
      expect(findByTestId(root, "ai-oauth-device-code")?.hidden).toBe(false);
      dispose();
    } finally {
      vi.useRealTimers();
    }
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

  it("둘째 로그인 시작은 진행 중인 기기 흐름을 즉시 멈추고 그 취소가 재시도를 무효화하지 않게 한다", async () => {
    let resolveSecond!: (value: unknown) => void;
    startChatGptLogin
      .mockResolvedValueOnce({ verificationUrl: "https://example.invalid/first", userCode: "FIRST" })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
    const { root, dispose } = await render();
    await Promise.resolve();

    // ① 첫 로그인 → 기기 블록이 보인다.
    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve(); // restore() 의 finally 가 버튼을 되살릴 때까지 마이크로태스크를 밀어내야 한다.
    const block = findByTestId(root, "ai-oauth-device-code");
    expect(block?.hidden).toBe(false);
    expect(findByTestId(root, "ai-oauth-device-cancel")).not.toBeNull();

    // ② 둘째 로그인을 시작한다 — 결과는 아직 오지 않는 지연 프로미스.
    expect(findByTestId(root, "ai-oauth-login")?.disabled).toBe(false);
    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();

    // ③ 옛 기기 블록이 즉시(둘째 시작의 결과를 기다리지 않고) 숨겨진다 — 재시도를
    //    무효화할 수 있던 옛 취소가 화면에서 사라져 클릭할 수 없다.
    expect(block?.hidden).toBe(true);

    // ④ 재시도가 끝나면 새 기기 흐름으로 회복되고 제어권(버튼)도 되살아난다.
    resolveSecond({ verificationUrl: "https://example.invalid/second", userCode: "SECOND" });
    // restore() 의 finally 까지 마이크로태스크를 밀어내려면 3번 flush 해야 한다(위 실측).
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(findByTestId(root, "ai-oauth-device-code")?.hidden).toBe(false);
    expect(findByTestId(root, "ai-oauth-device-usercode")?.textContent).toBe("SECOND");
    expect(findByTestId(root, "ai-oauth-login")?.disabled).toBe(false);
    dispose();
  });
});

describe("키 저장 경로는 패널에서 사라졌다", () => {
  // 옛 스펙 두 개("키를 저장하면 입력칸을 비운다", "빈 키는 저장하지 않는다")가 지켰던 동작은
  // 이 화면에 더는 존재하지 않는다: 고를 수 있는 제공자가 둘 다 구독 로그인이므로 저장할 키가
  // 없다. 대신 그 경로가 되살아나지 않는다는 것을 고정한다(saveCompanionApiKey 는 동반 서비스
  // 클라이언트에 남아 있지만 패널이 부르지 않는다).
  it("패널은 어떤 조작으로도 saveCompanionApiKey 를 부르지 않는다", async () => {
    const { root, dispose } = await render();
    await Promise.resolve();

    findByTestId(root, "ai-auth-api-key")?.click();
    findByTestId(root, "ai-auth-quick-openai-codex")?.click();
    findByTestId(root, "ai-auth-oauth")?.click();
    await Promise.resolve();

    expect(saveCompanionApiKey).not.toHaveBeenCalled();
    dispose();
  });

  it("제공자 카드 블록은 항상 보인다 — 종류 전환 자체가 없어졌다 (결함 3 잔재 정리)", async () => {
    // 옛 결함은 「API 키」종류에서 '빠른 선택' 제목만 남고 카드가 숨는 것이었다. 종류 카드를
    // 없앤 지금은 블록이 항상 보이는 것이 계약이다 — 카드가 곧 선택 수단이다.
    const { root, dispose } = await render();
    const block = findByTestId(root, "ai-auth-quick-block");
    expect(block).not.toBeNull();
    expect(block?.hidden).toBe(false);
    expect(findByTestId(root, "ai-auth-quick")?.hidden).toBe(false);
    dispose();
  });
});

describe("OAuth 빠른 선택", () => {
  // fakeDom 은 KeyboardEvent 전역이 없으므로, dispatchEvent 가 읽는 필드만 갖춘 가짜 이벤트를 만든다.
  // (runtimeCursorMenu.test.ts 와 같은 관례 — key+preventDefault 만 필요하다)
  function keydown(key: string): KeyboardEvent {
    const event = new Event("keydown", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "key", { configurable: true, value: key });
    return event as KeyboardEvent;
  }

  it("퀵 그룹은 Gemini 와 Codex 두 카드를 보여 준다", async () => {
    // 감독 요구 변경: Codex 도 1급 선택지다. 두 카드 모두 실재하고, 선택된 것만 체크·탭 가능이다
    // (roving tabindex — 라디오 그룹 표준).
    const { root, dispose } = await render();
    expect(findByTestId(root, "ai-auth-quick")?.hidden).toBe(false);
    const gemini = findByTestId(root, "ai-auth-quick-google-antigravity");
    const codex = findByTestId(root, "ai-auth-quick-openai-codex");
    expect(gemini).not.toBeNull();
    expect(codex).not.toBeNull();
    expect(gemini?.getAttribute("aria-checked")).toBe("true");
    expect(gemini?.getAttribute("tabindex")).toBe("0");
    expect(codex?.getAttribute("aria-checked")).toBe("false");
    expect(codex?.getAttribute("tabindex")).toBe("-1");
    dispose();
  });

  it("Codex 로 저장돼 있으면 Codex 카드가 선택돼 있다", async () => {
    const { root, dispose } = await render("openai-codex");
    const gemini = findByTestId(root, "ai-auth-quick-google-antigravity");
    const codex = findByTestId(root, "ai-auth-quick-openai-codex");

    expect(codex?.getAttribute("aria-checked")).toBe("true");
    expect(codex?.getAttribute("tabindex")).toBe("0");
    expect(gemini?.getAttribute("aria-checked")).toBe("false");
    dispose();
  });

  it("사라진 제공자로 저장돼 있었어도 기본 제공자 카드가 선택돼 있다", async () => {
    // 옛 레지스트리 id(zai)는 parseOhMyPiProvider 가 기본 제공자로 스냅한다.
    const { root, dispose } = await render("zai");

    expect(findByTestId(root, "ai-auth-quick")?.hidden).toBe(false);
    const gemini = findByTestId(root, "ai-auth-quick-google-antigravity");
    expect(gemini?.getAttribute("aria-checked")).toBe("true");
    expect(gemini?.getAttribute("tabindex")).toBe("0");
    dispose();
  });

  it("화살표가 두 카드 사이를 순환한다", async () => {
    const { root, dispose } = await render();
    const gemini = findByTestId(root, "ai-auth-quick-google-antigravity");
    const codex = findByTestId(root, "ai-auth-quick-openai-codex");

    findByTestId(root, "ai-auth-quick")?.dispatchEvent(keydown("ArrowDown"));
    expect(codex?.getAttribute("aria-checked")).toBe("true");
    expect(codex?.getAttribute("tabindex")).toBe("0");
    expect(gemini?.getAttribute("aria-checked")).toBe("false");

    findByTestId(root, "ai-auth-quick")?.dispatchEvent(keydown("ArrowDown"));
    expect(gemini?.getAttribute("aria-checked")).toBe("true");
    expect(gemini?.getAttribute("tabindex")).toBe("0");
    dispose();
  });

  it("Codex 카드를 고르면 로그인이 startChatGptLogin('openai-codex') 로 라우팅된다", async () => {
    startChatGptLogin.mockResolvedValue({ verificationUrl: "https://example.invalid/c", userCode: "CD" });
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
    const { root, dispose } = await render();
    await Promise.resolve();

    findByTestId(root, "ai-auth-quick-openai-codex")?.click();
    await Promise.resolve();
    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(startChatGptLogin).toHaveBeenCalledWith("openai-codex");
    expect(findByTestId(root, "ai-oauth-device-code")?.hidden).toBe(false);
    dispose();
  });

  it("오래된 제공자 상태 응답이 새 선택의 상태·저장·연결 해제 크롬을 덮어쓰지 않는다 (결함 5)", async () => {
    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    fetchChatGptAuthStatus
      // 호출 순서: (1) 선택 제공자 mount 조회 (2) 비선택 카드 필 조회 (3) 카드 클릭 후 재조회.
      .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }))
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }));
    const { root, dispose } = await render("openai-codex");
    await Promise.resolve();

    findByTestId(root, "ai-auth-quick-google-antigravity")?.click();
    await Promise.resolve();

    // 이전(openai-codex) 조회가 늦게 도착 — 무시되어야 하므로 여전히 "연결 확인 중…" 이고
    // 저장되지 않았으므로 연결 해제 크롬도 없다.
    resolveA({ connected: true, env: false, planType: "free" });
    await Promise.resolve();
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("연결 확인 중");
    expect(findByTestId(root, "ai-auth-disconnect")?.hidden).toBe(true);

    // 새(google-antigravity) 조회 결과만 반영된다.
    resolveB({ connected: true, env: false });
    await Promise.resolve();
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("연결됨");
    expect(findByTestId(root, "ai-auth-disconnect")?.hidden).toBe(false);
    dispose();
  });

  it("선택 변경 시 이전 로그인의 늦은 결과가 기기 UI 를 다시 띄우지 못한다 (결함 6)", async () => {
    let resolveLogin!: (value: unknown) => void;
    startChatGptLogin.mockImplementationOnce(() => new Promise((resolve) => { resolveLogin = resolve; }));
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
    const { root, dispose } = await render("openai-codex");
    await Promise.resolve();

    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    // gemini 로 전환 — 선택 변경이 기기 블록을 숨기고 이전 로그인을 무효화한다.
    findByTestId(root, "ai-auth-quick-google-antigravity")?.click();
    await Promise.resolve();
    expect(findByTestId(root, "ai-oauth-device-code")?.hidden).toBe(true);

    // 늦은 로그인 응답은 무시된다 — 성공해도 새 선택 아래 기기 UI 를 다시 열지 않는다.
    resolveLogin({ verificationUrl: "https://example.invalid/gem", userCode: "GEM" });
    await Promise.resolve();
    expect(findByTestId(root, "ai-oauth-device-code")?.hidden).toBe(true);
    expect(findByTestId(root, "ai-oauth-device-usercode")?.textContent).not.toBe("GEM");
    dispose();
  });

  it("Gemini 퀵 카드는 3.7 Flash를 제공하는 Antigravity 로그인으로 라우팅한다", async () => {
    // Break caught: routing this convenience card to google-gemini-cli makes the
    // advertised fast default unavailable even though Antigravity supports it.
    startChatGptLogin.mockResolvedValue({ verificationUrl: "https://example.invalid/x", userCode: "AB" });
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
    const { root, dispose } = await render();
    await Promise.resolve();

    const gemini = findByTestId(root, "ai-auth-quick-google-antigravity");
    expect(gemini).not.toBeNull();
    gemini?.click();
    await Promise.resolve();
    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(startChatGptLogin).toHaveBeenCalledWith("google-antigravity");
    dispose();
  });

  it("Gemini 를 고르면 로그인이 startChatGptLogin('google-antigravity') 로 라우팅되고 기기 블록을 띄운다", async () => {
    startChatGptLogin.mockResolvedValue({ verificationUrl: "https://example.invalid/x", userCode: "AB" });
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
    const { root, dispose } = await render();
    await Promise.resolve();

    findByTestId(root, "ai-auth-quick-google-antigravity")?.click();
    await Promise.resolve();
    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(startChatGptLogin).toHaveBeenCalledWith("google-antigravity");
    expect(findByTestId(root, "ai-oauth-device-code")?.hidden).toBe(false);
    dispose();
  });

  it("제공자 select 로도 Codex 를 고를 수 있다", async () => {
    const { root, dispose } = await render();
    const select = findByTestId(root, "ai-oh-my-pi-provider");
    if (!select) throw new Error("provider select missing");
    select.value = "openai-codex";
    select.dispatchEvent(new Event("change"));

    expect(findByTestId(root, "ai-auth-quick-openai-codex")?.getAttribute("aria-checked")).toBe("true");
    expect(findByTestId(root, "ai-auth-provider-help")?.textContent ?? "").toContain("ChatGPT 계정으로 로그인합니다.");
    dispose();
  });

  it("Gemini 카드는 구독·CLI 장르 없이 Google 계정 문구를 쓴다 (결함 7)", async () => {
    const { root, dispose } = await render();
    const gemini = findByTestId(root, "ai-auth-quick-google-antigravity");
    const text = gemini?.textContent ?? "";
    expect(text).toContain("Google 계정으로 로그인합니다.");
    expect(text).toContain("Google 계정");
    expect(text).toContain("Gemini · Antigravity");
    expect(text.toLowerCase()).not.toMatch(/subscription|구독|cli\b/);
    expect(text).not.toMatch(/Gemini\s+CLI/iu);
    dispose();
  });

  it("한 제공자는 카드·패널·칩에서 같은 이름을 쓴다", async () => {
    // 2026-09-23 실측: 카드 「Google Gemini」, 패널 「Google Antigravity 계정으로…」, 칩
    // 「Google Antigravity 로그인 필요」 — 이름이 셋이었다. 계정 이름 하나로 묶는다.
    const { providers } = await loadDeps();
    const { root, dispose } = await render();
    const google = providers.getOhMyPiProvider("google-antigravity")?.label;
    const chatgpt = providers.getOhMyPiProvider("openai-codex")?.label;
    expect(google).toBe("Google");
    expect(chatgpt).toBe("ChatGPT");

    const googleCard = findByTestId(root, "ai-auth-quick-google-antigravity")?.textContent ?? "";
    const codexCard = findByTestId(root, "ai-auth-quick-openai-codex")?.textContent ?? "";
    expect(googleCard).toContain("Google 계정");
    expect(codexCard).toContain("ChatGPT 계정");
    expect(findByTestId(root, "ai-auth-card-sub-openai-codex")?.textContent).toBe("Codex");
    expect(findByTestId(root, "ai-auth-provider-help")?.textContent ?? "").toContain("Google 계정으로 로그인합니다.");
    // 옛 이름은 어디에도 제목으로 남지 않는다(보조 줄의 제품명만 허용).
    for (const text of [googleCard, codexCard, findByTestId(root, "ai-auth-provider-help")?.textContent ?? ""]) {
      expect(text).not.toMatch(/Google Gemini|Google Antigravity|OpenAI Codex/u);
    }
    dispose();
  });

  it("선택 변경이 대기 중 로그인의 버튼 비활성화를 되돌리고 늦은 finally 는 무시한다 (결함 1)", async () => {
    let resolveLogin!: (value: unknown) => void;
    startChatGptLogin.mockImplementationOnce(() => new Promise((resolve) => { resolveLogin = resolve; }));
    fetchChatGptAuthStatus.mockResolvedValue({ connected: false });
    const { root, dispose } = await render("openai-codex");
    await Promise.resolve();

    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();
    const loginBtn = findByTestId(root, "ai-oauth-login");
    expect(loginBtn?.disabled).toBe(true);

    // 새 제공자로 선택 변경 — 로그인 버튼이 되살아나야 한다.
    findByTestId(root, "ai-auth-quick-google-antigravity")?.click();
    await Promise.resolve();
    expect(loginBtn?.disabled).toBe(false);

    // 오래된 로그인의 finally 는 무시된다 — 여전히 활성화 상태를 유지한다.
    resolveLogin({ verificationUrl: "https://example.invalid/gem", userCode: "G" });
    await Promise.resolve();
    expect(loginBtn?.disabled).toBe(false);
    dispose();
  });

  it("연결 해제 중 선택 변경이 해제 버튼을 되살리고 늦은 결과는 무시된다 (결함 2)", async () => {
    let resolveDisconnect!: (value: unknown) => void;
    disconnectCompanionAuth.mockImplementationOnce(
      () => new Promise((resolve) => { resolveDisconnect = resolve; }),
    );
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, env: false, planType: "plus" });
    const { root, dispose } = await render("openai-codex");
    await Promise.resolve();
    const dbtn = findByTestId(root, "ai-auth-disconnect");
    expect(dbtn?.hidden).toBe(false);

    dbtn?.click();
    await Promise.resolve();
    expect(dbtn?.disabled).toBe(true);

    // 새 제공자로 선택 변경 — 해제 버튼이 되살아나야 한다.
    findByTestId(root, "ai-auth-quick-google-antigravity")?.click();
    await Promise.resolve();
    expect(dbtn?.disabled).toBe(false);

    // 늦은 연결 해제 성공은 새 선택 아래 무시된다 — 버튼을 비활성화로 돌리지 않는다.
    resolveDisconnect({ connected: false, authKind: "oauth" });
    await Promise.resolve();
    expect(dbtn?.disabled).toBe(false);
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").not.toContain("연결 해제 중");
    dispose();
  });
});

describe("동일 제공자 상태·로그인 경쟁 (결함 A)", () => {
  it("로그인이 먼저 resolve 돼도 이전 상태 응답이 기기 대기 크롬을 덮지 않는다", async () => {
    let resolveStatus!: (value: unknown) => void;
    let resolveLogin!: (value: unknown) => void;
    fetchChatGptAuthStatus.mockImplementationOnce(
      () => new Promise((resolve) => { resolveStatus = resolve; }),
    );
    startChatGptLogin.mockImplementationOnce(
      () => new Promise((resolve) => { resolveLogin = resolve; }),
    );
    const { root, dispose } = await render("openai-codex");
    await Promise.resolve(); // 상태 조회 시작 — 미해결

    // 같은 제공자에서 로그인 시작. 진행 중이던 상태 조회보다 로그인을 먼저 마친다.
    findByTestId(root, "ai-oauth-login")?.click();
    await Promise.resolve();

    // 로그인이 먼저 resolve — 기기 블록이 열리고 "브라우저에서 로그인 대기 중"이 된다.
    resolveLogin({ verificationUrl: "https://example.invalid/a", userCode: "AB" });
    await Promise.resolve();
    expect(findByTestId(root, "ai-oauth-device-code")?.hidden).toBe(false);
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("브라우저에서 로그인 대기 중");

    // 뒤늦게 온 이전 상태 응답은 무시되어야 한다 — 대기 상태/크롬을 덮지 않는다.
    resolveStatus({ connected: true, env: false, planType: "free" });
    await Promise.resolve();
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("브라우저에서 로그인 대기 중");
    expect(findByTestId(root, "ai-oauth-device-code")?.hidden).toBe(false);
    dispose();
  });

  it("재확인 중에는 연결 해제가 막힌다 (상호 배타 — 이전 결함 A 시나리오)", async () => {
    // 첫 조회: 저장됨 → 연결 해제 버튼이 보인다.
    fetchChatGptAuthStatus.mockResolvedValueOnce({ connected: true, env: false, planType: "plus" });
    // 두 번째 호출은 비선택 카드 필 조회다 — 이 계약과 무관하므로 미해결로 둔다.
    fetchChatGptAuthStatus.mockImplementationOnce(() => new Promise(() => undefined));
    // 재확인(로그인)이 시작하는 세 번째 조회는 미해결로 붙잡아 둔다.
    let resolveRecheck!: (value: unknown) => void;
    fetchChatGptAuthStatus.mockImplementationOnce(
      () => new Promise((resolve) => { resolveRecheck = resolve; }),
    );
    refreshCompanionAuth.mockResolvedValue({});
    const { root, dispose } = await render("openai-codex");
    await Promise.resolve();
    await Promise.resolve();
    const dbtn = findByTestId(root, "ai-auth-disconnect");
    expect(dbtn?.hidden).toBe(false);

    // "다시 확인"(재확인) 클릭 → refreshCompanionAuth resolve, follow-up refreshStatus 가
    // 미해결로 붙잡힌다. 재확인 연산이 도는 동안 해제 버튼은 눌리지 않아야 한다.
    const loginBtn = findByTestId(root, "ai-oauth-login");
    loginBtn?.click();
    await Promise.resolve(); // refreshCompanionAuth resolve
    await Promise.resolve(); // refreshStatus 시작 (미해결)
    expect(dbtn?.disabled).toBe(true);

    // 진행 중 조회가 안 끝났을 때 연결 해제를 시도 — 버튼이 비활성이라 실제로는 이뤄지지 않는다.
    dbtn?.click();
    await Promise.resolve();
    expect(disconnectCompanionAuth).not.toHaveBeenCalled();
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("확인 중");

    // 재확인 조회가 늦게 도착 — 그 조회가 현재 연산이므로 반영된다.
    resolveRecheck({ connected: true, env: false, planType: "plus" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("연결됨");
    expect(loginBtn?.disabled).toBe(false);
    expect(dbtn?.disabled).toBe(false);
    dispose();
  });

  it("연결 성공 로그인이 끝나도 follow-up refreshStatus 가 끝날 때까지 재확인·해제가 잠긴다 (회귀)", async () => {
    let resolveLogin!: (value: unknown) => void;
    let resolveFollowUp!: (value: unknown) => void;
    startChatGptLogin.mockImplementationOnce(
      () => new Promise((resolve) => { resolveLogin = resolve; }),
    );
    fetchChatGptAuthStatus
      .mockResolvedValueOnce({ connected: false })                             // 첫 render 조회
      .mockImplementationOnce(() => new Promise(() => undefined))              // 비선택 카드 필 조회
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFollowUp = resolve; })); // follow-up
    const { root, dispose } = await render("openai-codex");
    await Promise.resolve(); // 첫 상태 조회 resolve

    const loginBtn = findByTestId(root, "ai-oauth-login");
    const dbtn = findByTestId(root, "ai-auth-disconnect");
    expect(loginBtn?.disabled).toBe(false);

    loginBtn?.click();
    // 로그인이 "연결됨"으로 resolve → follow-up refreshStatus 가 미해결로 붙잡힌다.
    resolveLogin({ connected: true, planType: "plus" });
    // 결정적 재현: 마이크로태스크를 전부 소진한다. 잘못된 구현은 이 사이
    // finally(restore) 가 이미 버튼을 되살렸을 것이다. 올바른 구현은 follow-up 이
    // 끝날 때까지 잠근다 — 잠금 지속 여부가 여기서 red/green 을 갈린다.
    for (let i = 0; i < 50; i += 1) await Promise.resolve();

    // follow-up refreshStatus 가 끝날 때까지 버튼은 잠겨 있어야 한다.
    expect(loginBtn?.disabled).toBe(true);
    expect(dbtn?.disabled).toBe(true);

    // 그 창(window) 동안 합성 클릭이 연산을 대체(supersede)해선 안 된다.
    dbtn?.click();
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(disconnectCompanionAuth).not.toHaveBeenCalled();

    // follow-up 이 늦게 도착 → 그 조회가 현재 연산이므로 반영되고 버튼이 되살아난다.
    resolveFollowUp({ connected: true, env: false, planType: "plus" });
    for (let i = 0; i < 50; i += 1) await Promise.resolve();
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("연결됨");
    expect(loginBtn?.disabled).toBe(false);
    expect(dbtn?.disabled).toBe(false);
    dispose();
  });
});

describe("OAuth 액션 상호 배타 — 연결 해제 vs 재확인/로그인", () => {
  it("연결 해제가 진행되는 동안 재확인 클릭이 로그아웃을 대체하지 못하고 끝내 연결 해제 상태·사용 가능 버튼으로 남는다", async () => {
    let resolveDisconnect!: (value: unknown) => void;
    disconnectCompanionAuth.mockImplementationOnce(
      () => new Promise((resolve) => { resolveDisconnect = resolve; }),
    );
    fetchChatGptAuthStatus.mockResolvedValue({ connected: true, env: false, planType: "plus" });
    const { root, dispose } = await render("openai-codex");
    await Promise.resolve();
    await Promise.resolve();
    const loginBtn = findByTestId(root, "ai-oauth-login");
    const dbtn = findByTestId(root, "ai-auth-disconnect");
    expect(loginBtn?.disabled).toBe(false);
    expect(dbtn?.disabled).toBe(false);
    expect(dbtn?.hidden).toBe(false);

    // 연결 해제 시작 — deferred 로 붙잡아 둔다.
    dbtn?.click();
    await Promise.resolve();
    expect(dbtn?.disabled).toBe(true);

    // 재확인(로그인 버튼) 클릭은 막혀야 한다.
    loginBtn?.click();
    await Promise.resolve();
    expect(refreshCompanionAuth).not.toHaveBeenCalled();
    expect(startChatGptLogin).not.toHaveBeenCalled();
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("연결 해제 중");

    // 연결 해제 완료 → 최종 UI 는 연결 해제 상태, 버튼 사용 가능.
    resolveDisconnect({ connected: false, authKind: "oauth" });
    await Promise.resolve(); // disconnect .then → applyStatus
    await Promise.resolve(); // disconnect .then 반환
    await Promise.resolve(); // disconnect .finally → restore
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("로그인 필요");
    expect(findByTestId(root, "ai-oauth-status")?.dataset.tone).toBe("disconnected");
    expect(dbtn?.disabled).toBe(false);
    expect(loginBtn?.disabled).toBe(false);
    dispose();
  });

  it("재확인(로그인)이 status 를 끝까지 기다리는 동안 연결 해제를 막는다", async () => {
    fetchChatGptAuthStatus
      .mockResolvedValueOnce({ connected: true, env: false, planType: "plus" })
      .mockImplementationOnce(() => new Promise<void>(() => {})) // 비선택 카드 필 조회
      .mockImplementationOnce(() => new Promise<void>(() => {})); // follow-up 재확인 조회
    refreshCompanionAuth.mockResolvedValue({});
    const { root, dispose } = await render("openai-codex");
    await Promise.resolve();

    const loginBtn = findByTestId(root, "ai-oauth-login");
    const dbtn = findByTestId(root, "ai-auth-disconnect");
    expect(dbtn?.hidden).toBe(false);

    // "다시 확인"(재확인) — refreshCompanionAuth resolve, follow-up refreshStatus 가 미해결.
    loginBtn?.click();
    await Promise.resolve(); // refreshCompanionAuth resolve
    await Promise.resolve(); // refreshStatus 시작 (미해결)
    expect(loginBtn?.disabled).toBe(true);

    // 재확인이 status 를 끝까지 기다리는 동안 연결 해제 클릭은 막혀야 한다.
    dbtn?.click();
    await Promise.resolve();
    expect(disconnectCompanionAuth).not.toHaveBeenCalled();
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toContain("확인 중");
    dispose();
  });
});

describe("선택 변경은 옛 안내·오류를 즉시 숨긴다 (결함 B)", () => {
  it("제공자 A 안내가 보인 채 B 로 전환하면 둘 다 새 상태 전에 바로 숨는다", async () => {
    const { ChatGptCompanionUnreachableError } = await import("@/ai/chatgptOAuthClient");
    let resolveB!: (value: unknown) => void;
    fetchChatGptAuthStatus
      .mockImplementationOnce(
        () => Promise.reject(new ChatGptCompanionUnreachableError(undefined, "network")),
      )
      .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }));
    const { root, dispose } = await render("openai-codex");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const hint = findByTestId(root, "ai-auth-hint");
    const serverError = findByTestId(root, "ai-oauth-server-error");
    expect(hint?.hidden).toBe(false); // 제공자 A 의 안내가 보인다

    // 제공자 B 로 전환 — 새 상태가 아직 도착 안 했는데도 옛 안내/오류는 즉시 숨어야 한다.
    findByTestId(root, "ai-auth-quick-google-antigravity")?.click();
    await Promise.resolve();
    expect(hint?.hidden).toBe(true);
    expect(serverError?.hidden).toBe(true);

    // 새 상태가 settle 되어도 계속 숨어 있다.
    resolveB({ connected: false });
    await Promise.resolve();
    expect(hint?.hidden).toBe(true);
    expect(serverError?.hidden).toBe(true);
    dispose();
  });
});
