/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIVE_MODELS_RETRY_BACKOFF_MS,
  LIVE_MODELS_STORAGE_KEY,
  getLiveModelState,
  parseLiveModelResponse,
  refreshLiveModels,
  resetLiveModelCatalogForTests,
} from "@/ai/liveModelCatalog";
import { gptModelLabel, mergeModelOptions, parseAnthropicModelList, parseCodexModelList } from "@/ai/liveModels";
import {
  isModelValidForAuthMode,
  latestModelsFor,
  modelCatalogForAuthMode,
  registerLiveModelIds,
  resetLiveModelIdsForTests,
} from "@/ai/modelCatalog";
import { LIVE_MODELS_CACHE_TTL_MS, listLiveModels, resetLiveModelCacheForTests, type LiveModelDeps } from "../scripts/lib/liveModelList.ts";

// 2026-11-28 실측한 Codex 백엔드 응답(GET /backend-api/codex/models?client_version=0.170.0)을 줄인 것.
const CODEX_PAYLOAD = {
  models: [
    { slug: "gpt-6.1-terra", visibility: "list", supported_in_api: true, priority: 3 },
    { slug: "gpt-6.2-sol", visibility: "list", supported_in_api: true, priority: 1 },
    { slug: "gpt-6.2-astra", visibility: "list", supported_in_api: true, priority: 2 },
    { slug: "gpt-reserve", visibility: "hide", supported_in_api: true, priority: 4 },
    { slug: "codex-auto-review", visibility: "hide", supported_in_api: true, priority: 12 },
    { slug: "gpt-6-private", visibility: "list", supported_in_api: false, priority: 5 },
  ],
};

const ANTHROPIC_PAYLOAD = {
  data: [
    { id: "claude-fable-5-2", display_name: "Claude Fable 5.2" },
    { id: "claude-sonnet-5-5", display_name: "Claude Sonnet 5.5" },
    { id: "claude-haiku-5-5" },
    { id: "gpt-oss-120b", display_name: "프록시가 섞어 낸 다른 계열" },
    { id: "claude-sonnet-5-5", display_name: "중복" },
  ],
  has_more: false,
};

describe("제공자 실제 모델 목록 해석(liveModels)", () => {
  it("Codex 응답은 숨김·API 미지원을 빼고 서버 priority 순으로 낸다", () => {
    const models = parseCodexModelList(CODEX_PAYLOAD);
    expect(models.map((model) => model.id)).toEqual(["gpt-6.2-sol", "gpt-6.2-astra", "gpt-6.1-terra"]);
    expect(models[0]!.label).toBe("GPT-6.2 Sol");
    expect(gptModelLabel("gpt-5.6-luna")).toBe("GPT-5.6 Luna");
    expect(parseCodexModelList({ nope: true })).toEqual([]);
    expect(parseCodexModelList(null)).toEqual([]);
  });

  it("Anthropic 응답은 claude-* 만, 서버 순서·display_name 을 지키고 중복을 걷는다", () => {
    const models = parseAnthropicModelList(ANTHROPIC_PAYLOAD);
    expect(models.map((model) => model.id)).toEqual(["claude-fable-5-2", "claude-sonnet-5-5", "claude-haiku-5-5"]);
    expect(models[0]!.label).toBe("Claude Fable 5.2");
    expect(models[2]!.label).toBe("Claude Haiku 5.5");
  });

  it("프리셋을 앞에 두고 서버에만 있는 모델을 뒤에 붙인다 — 서버 목록이 없으면 프리셋 그대로", () => {
    const presets = [{ id: "gpt-6.2-sol", label: "GPT-6.2 Sol" }, { id: "gpt-6.2-astra", label: "GPT-6.2 Astra" }];
    expect(mergeModelOptions(presets, undefined).map((option) => option.live)).toEqual([false, false]);
    const merged = mergeModelOptions(presets, parseCodexModelList(CODEX_PAYLOAD));
    expect(merged.map((option) => [option.id, option.live])).toEqual([["gpt-6.2-sol", false], ["gpt-6.2-astra", false], ["gpt-6.1-terra", true]]);
  });
});

describe("modelCatalog 의 서버 목록 등록", () => {
  afterEach(() => resetLiveModelIdsForTests());

  it("새 모델은 뒤 그룹에 붙고 직접 입력 검증을 통과하지만, 첫 그룹·기본·첫 실행 목록은 프리셋 그대로다", () => {
    const before = modelCatalogForAuthMode("chatgpt", "openai-codex");
    expect(isModelValidForAuthMode("chatgpt", "gpt-6.1-terra", "openai-codex")).toBe(false);
    registerLiveModelIds("openai-codex", ["gpt-6.2-sol", "gpt-6.1-terra"]);
    const after = modelCatalogForAuthMode("chatgpt", "openai-codex");
    expect(after[0]).toEqual(before[0]);
    expect(after[1]!.models).toEqual(["gpt-6.1-terra"]);
    expect(isModelValidForAuthMode("chatgpt", "GPT-6.1-Terra", "openai-codex")).toBe(true);
    expect(isModelValidForAuthMode("chatgpt", "gpt-never-listed", "openai-codex")).toBe(false);
    expect(latestModelsFor("openai-codex")).not.toContain("gpt-6.1-terra");
    // Claude 도 같은 규칙이고, Google 은 건드리지 않는다.
    registerLiveModelIds("anthropic", ["claude-fable-5-2"]);
    expect(isModelValidForAuthMode("chatgpt", "claude-fable-5-2", "anthropic")).toBe(true);
    expect(modelCatalogForAuthMode("chatgpt", "google-antigravity")).toHaveLength(1);
  });
});

describe("동반 서비스의 목록 조회(liveModelList)", () => {
  beforeEach(() => resetLiveModelCacheForTests());

  const jwt = (claims: Record<string, unknown>) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
  const deps = (overrides: Partial<LiveModelDeps> & { calls?: Array<{ url: string; headers: Record<string, string> }>; respond?: (url: string) => Response }): LiveModelDeps => ({
    now: () => 1_000,
    codexAccessToken: async () => jwt({ "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" } }),
    anthropicCredentials: async () => [{ source: "anthropic-api", key: "sk-ant-api-test" }],
    fetchImpl: async (url, init) => {
      overrides.calls?.push({ url, headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)) });
      return overrides.respond ? overrides.respond(url) : Response.json({});
    },
    ...overrides,
  });

  it("GPT: ChatGPT 토큰·계정 id·client_version 으로 Codex 백엔드를 부르고 10분간 캐시한다", async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const d = deps({ calls, respond: () => Response.json(CODEX_PAYLOAD) });
    const first = await listLiveModels("gpt", d);
    expect(first.ok && first.source).toBe("codex-backend");
    expect(first.ok && first.models.map((model) => model.id)).toEqual(["gpt-6.2-sol", "gpt-6.2-astra", "gpt-6.1-terra"]);
    expect(calls[0]!.url).toMatch(/^https:\/\/chatgpt\.com\/backend-api\/codex\/models\?client_version=\d+\.\d+\.\d+$/u);
    expect(calls[0]!.headers["chatgpt-account-id"]).toBe("acct-1");
    expect(calls[0]!.headers.Authorization).toMatch(/^Bearer /u);
    await listLiveModels("gpt", { ...d, now: () => 1_000 + LIVE_MODELS_CACHE_TTL_MS - 1 });
    expect(calls).toHaveLength(1);
    await listLiveModels("gpt", { ...d, now: () => 1_000 + LIVE_MODELS_CACHE_TTL_MS + 1 });
    expect(calls).toHaveLength(2);
    await listLiveModels("gpt", d, { fresh: true });
    expect(calls).toHaveLength(3);
  });

  it("Claude: limit=1000 으로 요청하고 쪽이 더 있으면 이어 받으며, API 키는 x-api-key·구독 토큰은 Bearer 로 보낸다", async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const d = deps({
      calls,
      respond: (url) => url.includes("after_id=claude-sonnet-5-5")
        ? Response.json({ data: [{ id: "claude-opus-5-5", display_name: "Claude Opus 5.5" }], has_more: false })
        : Response.json({ data: [{ id: "claude-sonnet-5-5", display_name: "Claude Sonnet 5.5" }], has_more: true, last_id: "claude-sonnet-5-5" }),
    });
    const result = await listLiveModels("claude", d);
    expect(result.ok && result.models.map((model) => model.id)).toEqual(["claude-sonnet-5-5", "claude-opus-5-5"]);
    expect(calls[0]!.url).toBe("https://api.anthropic.com/v1/models?limit=1000");
    expect(calls[1]!.url).toContain("after_id=claude-sonnet-5-5");
    expect(calls[0]!.headers["x-api-key"]).toBe("sk-ant-api-test");
    resetLiveModelCacheForTests();
    const oauth = deps({ calls, anthropicCredentials: async () => [{ source: "anthropic-api", key: "sk-ant-oat01-test" }], respond: () => Response.json(ANTHROPIC_PAYLOAD) });
    await listLiveModels("claude", oauth);
    const last = calls[calls.length - 1]!;
    expect(last.headers.Authorization).toBe("Bearer sk-ant-oat01-test");
    expect(last.headers["anthropic-beta"]).toBe("oauth-2025-04-20");
  });

  it("자격이 없거나 서버가 거절·실패하면 던지지 않고 ok:false 로 돌려준다(캐시하지 않는다)", async () => {
    const noLogin = await listLiveModels("gpt", deps({ codexAccessToken: async () => undefined }));
    expect(noLogin).toMatchObject({ ok: false, reason: "no-credential" });
    const noKey = await listLiveModels("claude", deps({ anthropicCredentials: async () => [] }));
    expect(noKey).toMatchObject({ ok: false, reason: "no-credential" });
    const denied = await listLiveModels("gpt", deps({ respond: () => new Response("no", { status: 403 }) }));
    expect(denied).toMatchObject({ ok: false, reason: "upstream-error" });
    const empty = await listLiveModels("claude", deps({ respond: () => Response.json({ data: [] }) }));
    expect(empty).toMatchObject({ ok: false, reason: "upstream-error" });
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const down = deps({ calls, respond: () => { throw new Error("offline"); } });
    expect(await listLiveModels("gpt", down)).toMatchObject({ ok: false });
    expect(await listLiveModels("gpt", down)).toMatchObject({ ok: false });
    expect(calls).toHaveLength(2);
    expect(await listLiveModels("gemini", deps({}))).toMatchObject({ ok: false });
  });

  it("첫 자격이 거절되면 다음 자격(예: 환경 변수 키)으로 넘어간다", async () => {
    const d = deps({
      anthropicCredentials: async () => [{ source: "anthropic-compat", key: "bad" }, { source: "anthropic-api", key: "good" }],
      fetchImpl: async (_url, init) => ((init?.headers as Record<string, string>)["x-api-key"] === "good" ? Response.json(ANTHROPIC_PAYLOAD) : new Response("no", { status: 401 })),
    });
    const result = await listLiveModels("claude", d);
    expect(result.ok && result.source).toBe("anthropic-api");
  });
});

describe("편집기 쪽 목록 보관소(liveModelCatalog)", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    resetLiveModelCatalogForTests();
    resetLiveModelIdsForTests();
    storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      removeItem: (key: string) => storage.delete(key),
    });
  });

  afterEach(() => {
    resetLiveModelCatalogForTests();
    resetLiveModelIdsForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("엉뚱한 응답 모양(옛 동반 서비스)은 목록으로 받지 않는다", () => {
    expect(parseLiveModelResponse("gpt", { connected: false })).toBeNull();
    expect(parseLiveModelResponse("gpt", { ok: true, models: [] })).toBeNull();
    expect(parseLiveModelResponse("gpt", { ok: false, reason: "no-credential", message: "로그인 없음" })).toMatchObject({ ok: false, reason: "no-credential" });
  });

  it("받은 목록을 localStorage 에 남기고 modelCatalog 에 등록하며, 실패해도 마지막 성공 목록을 지우지 않는다", async () => {
    let body: unknown = { ok: true, family: "gpt", source: "codex-backend", fetchedAt: Date.now(), models: [{ id: "gpt-6.1-terra", label: "GPT-6.1 Terra" }] };
    const fetchMock = vi.fn(async () => Response.json(body));
    vi.stubGlobal("fetch", fetchMock);
    const ok = await refreshLiveModels("gpt");
    expect(ok.status).toBe("ok");
    expect(JSON.parse(storage.get(LIVE_MODELS_STORAGE_KEY)!).gpt.models[0].id).toBe("gpt-6.1-terra");
    expect(isModelValidForAuthMode("chatgpt", "gpt-6.1-terra", "openai-codex")).toBe(true);
    // 신선한 캐시는 다시 받지 않는다.
    await refreshLiveModels("gpt");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 다음 실행(모듈 상태가 비어도) localStorage 에서 되살린다.
    resetLiveModelCatalogForTests();
    resetLiveModelIdsForTests();
    expect(getLiveModelState("gpt").models.map((model) => model.id)).toEqual(["gpt-6.1-terra"]);
    expect(isModelValidForAuthMode("chatgpt", "gpt-6.1-terra", "openai-codex")).toBe(true);
    // 수동 새로고침이 실패해도 목록은 남고 상태만 failed.
    body = { ok: false, family: "gpt", reason: "upstream-error", message: "서버 거절", fetchedAt: Date.now() };
    const failed = await refreshLiveModels("gpt", { force: true });
    expect(failed).toMatchObject({ status: "failed", message: "서버 거절" });
    expect(failed.models.map((model) => model.id)).toEqual(["gpt-6.1-terra"]);
  });

  it("실패 뒤 자동 재시도는 백오프 동안 요청하지 않는다(수동 새로고침은 항상 요청한다)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fetchMock = vi.fn(async () => Response.json({ ok: false, family: "claude", reason: "no-credential", message: "키 없음", fetchedAt: Date.now() }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await refreshLiveModels("claude")).status).toBe("failed");
    await refreshLiveModels("claude");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + LIVE_MODELS_RETRY_BACKOFF_MS + 1);
    await refreshLiveModels("claude");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await refreshLiveModels("claude", { force: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getLiveModelState("claude").models).toEqual([]);
  });
});
