/** @vitest-environment happy-dom */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPANION_TIMEOUT_MS } from "@/ai/chatgptOAuthClient";
import { LOCAL_AGENTS_STATUS_TIMEOUT_MS } from "@/start/settings/localAgents";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

vi.mock("@/editor/panels/aiRoleMatrixSettings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/editor/panels/aiRoleMatrixSettings")>()),
  fetchConnectedRoutes: async () => [],
}));

let start: typeof import("@/start/settings/settingsDialog");
let editor: typeof import("@/editor/panels/aiSettingsModal");
let connection: typeof import("@/editor/panels/aiConnectionStatus");
let closeStart: (() => void) | undefined;
let restoreDom: () => void;

beforeAll(async () => {
  [start, editor, connection] = await Promise.all([
    import("@/start/settings/settingsDialog"),
    import("@/editor/panels/aiSettingsModal"),
    import("@/editor/panels/aiConnectionStatus"),
  ]);
});

beforeEach(() => {
  vi.useFakeTimers();
  restoreDom = installFakeDom();
  const storage = new Map<string, string>([
    ["oprn:ai-config", JSON.stringify({ providerId: "openai-codex", model: "gpt-6.2-sol" })],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("fetch", fetchResponse);
  codexRequests.length = 0;
  cliRequests.length = 0;
  healthRequests.length = 0;
  authResponse = () => Response.json(account);
  cliResponse = () => Response.json(noClis);
});

afterEach(() => {
  editor.closeAiSettingsModal();
  closeStart?.();
  closeStart = undefined;
  connection.resetAiConnectionStatusCache();
  restoreDom();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const account = { connected: true, authKind: "oauth", accountEmail: "player@example.invalid" };
const noClis = {
  clis: [
    { id: "claude", label: "Claude Code" },
    { id: "codex", label: "Codex (ChatGPT)" },
    { id: "gemini", label: "Gemini CLI" },
  ].map((row) => ({
    ...row, state: "not-installed", stateLabel: "설치 필요", found: false,
    install: { command: "", help: "", url: "" }, login: { command: "", help: "" },
    models: [], defaults: { routine: "", deep: "" }, billing: "unknown",
  })),
};
const codexRequests: RequestInit[] = [];
const cliRequests: string[] = [];
const healthRequests: unknown[] = [];
const never = (): Promise<never> => new Promise(() => undefined);
let authResponse: () => Response | Promise<Response>;
let cliResponse: () => Response | Promise<Response>;

async function fetchResponse(input: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input, "http://oprn.invalid");
  if (url.pathname === "/auth/status" && url.searchParams.get("provider") === "openai-codex") {
    codexRequests.push(init);
    return authResponse();
  }
  if (url.pathname === "/v1/local-agents") {
    cliRequests.push(url.pathname + url.search);
    return cliResponse();
  }
  if (url.pathname === "/v1/local-agents/health") {
    healthRequests.push(JSON.parse(String(init.body)));
    return Response.json({ ok: true, ms: 12 });
  }
  if (url.pathname === "/auth/openai-compat") return Response.json({ endpoints: [] });
  return Response.json({ connected: false });
}

function byId(id: string): FakeElement {
  const element = findByTestId(document.body as unknown as FakeElement, id);
  if (!element) throw new Error(`Missing ${id}`);
  return element;
}

function openLocalPrograms(): void {
  byId("ai-settings-other-ways").parentElement?.setAttribute("open", "");
  const programs = byId("ai-settings-local-programs");
  programs.setAttribute("open", "");
  programs.dispatchEvent(new Event("toggle"));
}

describe("AI settings connection status", () => {
  it("shares the top-bar ChatGPT sign-in across both dialogs with no local CLI installed", async () => {
    await connection.refreshAiConnectionStatus();
    expect(connection.getAiConnectionStatus()).toMatchObject({ kind: "ready", providerId: "openai-codex" });
    closeStart = start.openSettingsDialog().close;
    const accountRow = byId("ai-settings-chatgpt-account");
    expect(accountRow.hidden).toBe(false);
    expect(accountRow.textContent).toContain(account.accountEmail);
    // #4940(자동 연결 고르기) 뒤로 설정을 열면 고르기가 길을 모으며 로컬 프로그램을 «한 번, 캐시 허용(fresh 아님)» 묻는다 — 설계된 동작이다.
    // 이 시험이 지키는 것은 설정 창이 펼치기 전에 따로(다시 확인·fresh) 묻지 않는다는 것이다.
    expect(cliRequests.filter((request) => request !== "/v1/local-agents")).toEqual([]);
    expect(cliRequests.length).toBeLessThanOrEqual(1);

    byId("start-settings-tab-general").click();
    byId("start-settings-tab-ai").click();
    expect(byId("ai-settings-chatgpt-account")).toBe(accountRow);
    openLocalPrograms();
    await vi.advanceTimersByTimeAsync(0);
    expect(byId("start-settings-engine-claude").textContent).toContain("설치 필요");
    expect(byId("start-settings-engine-codex").dataset.state).toBe("not-installed");
    expect(accountRow.hidden).toBe(false);
    closeStart();

    authResponse = never;
    editor.openAiSettingsModal({ nativeSelects: true });
    expect(byId("ai-settings-chatgpt-hero").hidden).toBe(true);
    expect(byId("ai-settings-chatgpt-account").hidden).toBe(false);
    expect(byId("ai-settings-chatgpt-account").textContent).toContain(account.accountEmail);
  });

  it("times out and retries both stuck status checks in start settings", async () => {
    authResponse = never;
    cliResponse = never;
    closeStart = start.openSettingsDialog().close;
    openLocalPrograms();
    await vi.advanceTimersByTimeAsync(COMPANION_TIMEOUT_MS - 1);
    expect(byId("ai-settings-chatgpt-checking").hidden).toBe(false);
    expect(byId("start-settings-detect").textContent).toBe("다시 확인");

    await vi.advanceTimersByTimeAsync(1);
    expect(byId("ai-settings-chatgpt-checking").hidden).toBe(true);
    expect(byId("ai-oauth-status").textContent).toBe("연결 서비스 응답 없음");
    expect(byId("ai-settings-chatgpt-check-retry").textContent).toBe("다시 시도");
    expect(byId("start-settings-detect").textContent).toBe("다시 확인");

    await vi.advanceTimersByTimeAsync(LOCAL_AGENTS_STATUS_TIMEOUT_MS - COMPANION_TIMEOUT_MS);
    expect(byId("start-settings").textContent).toContain("AI 프로그램 목록을 확인하지 못했어요.");
    expect(byId("start-settings-detect").textContent).toBe("다시 시도");
    expect(codexRequests).toHaveLength(1);
    // 펼침 확인 한 번 + 자동 연결 고르기(#4940)가 길을 모으며 하는 캐시 허용 조회(있을 수 있다). 모두 fresh 가 아니다.
    expect(cliRequests.every((request) => request === "/v1/local-agents")).toBe(true);
    const beforeRetry = cliRequests.length;
    expect(beforeRetry).toBeGreaterThanOrEqual(1);

    authResponse = () => Response.json(account);
    cliResponse = () => Response.json(noClis);
    byId("ai-settings-chatgpt-check-retry").click();
    byId("start-settings-detect").click();
    await vi.advanceTimersByTimeAsync(0);
    expect(codexRequests.length).toBeGreaterThan(1);
    // 「다시 시도」는 조회를 정확히 한 번 더 한다.
    expect(cliRequests).toEqual([...Array(beforeRetry + 1)].map(() => "/v1/local-agents"));
    expect(byId("ai-settings-chatgpt-account").hidden).toBe(false);
    expect(byId("start-settings-engine-codex").dataset.state).toBe("not-installed");
    expect(byId("start-settings-engine-claude").dataset.state).toBe("not-installed");
  });

  it("saves, tests and clears an explicitly selected local program", async () => {
    const { loadEngineChoice } = await import("@/start/settings/localAgents");
    cliResponse = () => Response.json({ clis: noClis.clis.map(row => row.id === "codex"
      ? { ...row, state: "ready", stateLabel: "연결됨", found: true }
      : row) });
    closeStart = start.openSettingsDialog().close;
    openLocalPrograms();
    await vi.advanceTimersByTimeAsync(0);
    byId("start-settings-engine-codex").click();
    expect(loadEngineChoice()).toMatchObject({
      cli: "codex", routineModel: "gpt-6.2-sol", deepModel: "gpt-6.2-sol", effort: "medium",
    });
    byId("start-settings-test").click();
    await vi.advanceTimersByTimeAsync(0);
    expect(healthRequests).toEqual([{ cli: "codex" }]);
    expect(byId("start-settings-test-result").textContent).toBe("연결 시험에 성공했어요.");
    byId("settings-engine-reset").click();
    expect(loadEngineChoice()).toBeNull();
  });

  it("retries a stalled auth response body and cancels the editor's status request on close", async () => {
    authResponse = () => new Response(new ReadableStream(), { headers: { "Content-Type": "application/json" } });
    editor.openAiSettingsModal({ nativeSelects: true });
    await vi.advanceTimersByTimeAsync(COMPANION_TIMEOUT_MS);
    expect(byId("ai-oauth-status").textContent).toBe("연결 서비스 응답 없음");
    expect(byId("ai-settings-chatgpt-check-error").hidden).toBe(false);
    expect(byId("ai-settings-chatgpt-check-retry").textContent).toBe("다시 시도");
    expect(codexRequests).toHaveLength(1);
    expect(codexRequests[0]?.signal?.aborted).toBe(true);

    authResponse = never;
    byId("ai-settings-chatgpt-check-retry").click();
    expect(codexRequests).toHaveLength(2);
    expect(codexRequests[1]?.signal?.aborted).toBe(false);
    editor.closeAiSettingsModal();
    expect(codexRequests[1]?.signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(COMPANION_TIMEOUT_MS);
    expect(codexRequests).toHaveLength(2);
  });
});
