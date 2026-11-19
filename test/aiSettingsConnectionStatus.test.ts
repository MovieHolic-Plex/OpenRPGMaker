/** @vitest-environment happy-dom */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
  if (url.pathname === "/auth/openai-compat") return Response.json({ endpoints: [] });
  return Response.json({ connected: false });
}

function byId(id: string): FakeElement {
  const element = findByTestId(document.body as unknown as FakeElement, id);
  if (!element) throw new Error(`Missing ${id}`);
  return element;
}

describe("AI settings connection status", () => {
  it("shares the top-bar ChatGPT sign-in across both dialogs with no local CLI installed", async () => {
    await connection.refreshAiConnectionStatus();
    expect(connection.getAiConnectionStatus()).toMatchObject({ kind: "ready", providerId: "openai-codex" });
    closeStart = start.openSettingsDialog().close;
    await vi.advanceTimersByTimeAsync(0);

    expect(byId("start-settings-engine-claude").textContent).toContain("설치 필요");
    const codex = byId("start-settings-engine-codex");
    expect(codex.dataset.state).toBe("ready");
    expect(codex.textContent).toContain("ChatGPT 연결됨");
    expect(codex.textContent).not.toContain("설치 필요");
    expect(byId("start-settings").querySelector(".st-empty")?.textContent).toBe("ChatGPT 연결됨 · gpt-6.2-sol");
    expect(byId("start-settings").textContent).not.toContain("연결된 AI 프로그램이 없어요");
    expect(byId("start-settings-oauth-state").textContent).toContain("ChatGPT 연결됨");
    byId("start-settings-tab-general").click();
    byId("start-settings-tab-ai").click();
    expect(byId("start-settings-oauth-state").textContent).toContain("ChatGPT 연결됨");

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
    await vi.advanceTimersByTimeAsync(7_999);
    expect(byId("start-settings-oauth-state").textContent).toContain("확인 중");
    expect(byId("start-settings-detect").textContent).toBe("다시 확인");

    await vi.advanceTimersByTimeAsync(1);
    expect(byId("start-settings-oauth-state").textContent).toContain("연결 서비스 응답 없음");
    expect(byId("start-settings").textContent).toContain("AI 프로그램 목록을 확인하지 못했어요.");
    expect(byId("start-settings-oauth-retry").textContent).toBe("다시 시도");
    expect(byId("start-settings-detect").textContent).toBe("다시 시도");
    expect(codexRequests).toHaveLength(1);
    expect(cliRequests).toEqual(["/v1/local-agents"]);

    authResponse = () => Response.json(account);
    cliResponse = () => Response.json(noClis);
    byId("start-settings-oauth-retry").click();
    byId("start-settings-detect").click();
    await vi.advanceTimersByTimeAsync(0);
    expect(codexRequests).toHaveLength(2);
    expect(cliRequests).toEqual(["/v1/local-agents", "/v1/local-agents"]);
    expect(byId("start-settings-engine-codex").dataset.state).toBe("ready");
    expect(byId("start-settings-engine-claude").dataset.state).toBe("not-installed");
  });

  it("retries a stalled auth response body and cancels the editor's status request on close", async () => {
    authResponse = () => new Response(new ReadableStream(), { headers: { "Content-Type": "application/json" } });
    editor.openAiSettingsModal({ nativeSelects: true });
    await vi.advanceTimersByTimeAsync(8_000);
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
    await vi.advanceTimersByTimeAsync(8_000);
    expect(codexRequests).toHaveLength(2);
  });
});
