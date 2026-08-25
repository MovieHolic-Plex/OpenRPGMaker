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
const disconnectCompanionAuth = vi.fn();

vi.mock("@/ai/chatgptOAuthClient", async () => {
  const actual = await import("@/ai/chatgptOAuthClient");
  return {
    ...actual,
    fetchChatGptAuthStatus: (...args: unknown[]) => fetchChatGptAuthStatus(...args),
    startChatGptLogin: (...args: unknown[]) => startChatGptLogin(...args),
    saveCompanionApiKey: (...args: unknown[]) => saveCompanionApiKey(...args),
    refreshCompanionAuth: (...args: unknown[]) => refreshCompanionAuth(...args),
    disconnectCompanionAuth: (...args: unknown[]) => disconnectCompanionAuth(...args),
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

  it("빈 키는 저장하지 않고 이전 상태를 유지하며 입력 옆에 '키를 입력하세요.'를 띄운다 (회귀)", async () => {
    saveCompanionApiKey.mockResolvedValue({ connected: true, env: false, authKind: "apiKey" });
    const { root, dispose } = await render("zai");
    await Promise.resolve();
    await Promise.resolve();
    const input = findByTestId(root, "ai-companion-api-key") as unknown as HTMLInputElement;
    input.value = "   ";
    const help = findByTestId(root, "ai-auth-provider-help");
    const statusBefore = findByTestId(root, "ai-oauth-status")?.textContent ?? "";

    findByTestId(root, "ai-companion-save-key")?.click();

    expect(saveCompanionApiKey).not.toHaveBeenCalled();
    expect(help?.textContent ?? "").toContain("키를 입력하세요.");
    expect(findByTestId(root, "ai-oauth-status")?.textContent ?? "").toBe(statusBefore);
    dispose();
  });

  it("API 키 종류에서는 퀵 블록 전체(제목 포함)가 숨는다 (결함 3)", async () => {
    const { root, dispose } = await render("zai");
    const block = findByTestId(root, "ai-auth-quick-block");
    expect(block).not.toBeNull();
    expect(block?.hidden).toBe(true);
    // 자식 카드뿐 아니라 제목이 든 블록 자체가 숨는다 — '빠른 선택' 제목이 화면에 남으면 결함.
    expect(findByTestId(root, "ai-auth-quick")?.hidden).toBe(true);
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

  it("기본(OAuth)에서 퀵 그룹이 숨지 않고 ChatGPT·Gemini 가 보인다 (결함 1)", async () => {
    const { root, dispose } = await render();
    expect(findByTestId(root, "ai-auth-quick")?.hidden).toBe(false);
    const chatgpt = findByTestId(root, "ai-auth-quick-openai-codex");
    const gemini = findByTestId(root, "ai-auth-quick-google-antigravity");
    expect(chatgpt).not.toBeNull();
    expect(gemini).not.toBeNull();
    expect(chatgpt?.hidden).toBe(false);
    expect(gemini?.hidden).toBe(false);
    dispose();
  });

  it("API 키 종류에서 OAuth 로 바꾸면 퀵 카드가 기본 google-antigravity 와 동기화된다 (결함 2)", async () => {
    const { root, dispose } = await render("zai");
    expect(findByTestId(root, "ai-auth-quick")?.hidden).toBe(true);

    findByTestId(root, "ai-auth-oauth")?.click();

    expect(findByTestId(root, "ai-auth-quick")?.hidden).toBe(false);
    const chatgpt = findByTestId(root, "ai-auth-quick-openai-codex");
    const gemini = findByTestId(root, "ai-auth-quick-google-antigravity");
    expect(gemini?.getAttribute("aria-checked")).toBe("true");
    expect(gemini?.getAttribute("tabindex")).toBe("0");
    expect(chatgpt?.getAttribute("aria-checked")).toBe("false");
    expect(chatgpt?.getAttribute("tabindex")).toBe("-1");
    dispose();
  });

  it("드롭다운으로 비퀵 OAuth 제공자를 고르면 첫 카드만 탭 가능하고 둘 다 체크 해제로 남는다 (결함 3)", async () => {
    const { root, dispose } = await render();
    const select = findByTestId(root, "ai-oh-my-pi-provider");
    expect(select).not.toBeNull();
    select!.value = "anthropic";
    select!.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();

    const chatgpt = findByTestId(root, "ai-auth-quick-openai-codex");
    const gemini = findByTestId(root, "ai-auth-quick-google-antigravity");
    expect(chatgpt?.getAttribute("aria-checked")).toBe("false");
    expect(gemini?.getAttribute("aria-checked")).toBe("false");
    expect(chatgpt?.getAttribute("tabindex")).toBe("0");
    expect(gemini?.getAttribute("tabindex")).toBe("-1");
    dispose();
  });

  it("화살표 키가 옆 퀵 라디오를 선택하고 포커스도 옮긴다 (결함 4)", async () => {
    const { root, dispose } = await render("openai-codex");
    const chatgpt = findByTestId(root, "ai-auth-quick-openai-codex");
    const gemini = findByTestId(root, "ai-auth-quick-google-antigravity");

    chatgpt?.dispatchEvent(keydown("ArrowRight"));

    expect(chatgpt?.getAttribute("aria-checked")).toBe("false");
    expect(gemini?.getAttribute("aria-checked")).toBe("true");
    expect(gemini?.getAttribute("tabindex")).toBe("0");
    expect(chatgpt?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(gemini);
    dispose();
  });

  it("현재 제공자가 퀵 카드에 없으면 화살표가 결정적으로 첫 카드를 고른다 (결함 4b)", async () => {
    const { root, dispose } = await render();
    const select = findByTestId(root, "ai-oh-my-pi-provider");
    expect(select).not.toBeNull();
    select!.value = "anthropic";
    select!.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();

    findByTestId(root, "ai-auth-quick")?.dispatchEvent(keydown("ArrowDown"));

    const chatgpt = findByTestId(root, "ai-auth-quick-openai-codex");
    expect(chatgpt?.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(chatgpt);
    dispose();
  });

  it("오래된 제공자 상태 응답이 새 선택의 상태·저장·연결 해제 크롬을 덮어쓰지 않는다 (결함 5)", async () => {
    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    fetchChatGptAuthStatus
      .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }))
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

  it("Gemini 카드는 구독·CLI 장르 없이 Google 계정 문구를 쓴다 (결함 7)", async () => {
    const { root, dispose } = await render();
    const gemini = findByTestId(root, "ai-auth-quick-google-antigravity");
    const text = gemini?.textContent ?? "";
    expect(text).toContain("Google 계정으로 로그인합니다.");
    expect(text).toMatch(/Google Gemini/iu);
    expect(text.toLowerCase()).not.toMatch(/subscription|구독|cli\b/);
    expect(text).not.toMatch(/Gemini\s+CLI/iu);
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
    // 재확인(로그인)이 시작하는 두 번째 조회는 미해결로 붙잡아 둔다.
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
      .mockImplementationOnce(() => new Promise<void>(() => {}));
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
