// Claude 로 도는 길의 기본 = Claude Sonnet 5.5 · high (오너 결정 2026-11-23: 「조수는 sonnet 5.5 high 만 쓰게」).
// 지난 Claude 기본: 2026-11-16 Opus 5.5 · medium.
// 2026-11-19 에는 공장 기본(저장 없음)과 첫 실행의 우선 계정이 ChatGPT(GPT-6.2 Sol · medium)였지만, 2026-11-23(오너 결정)에 다시 Claude 가 됐다 — test/aiDefaultModelForced.test.ts.
// 이 파일은 공장 기본·Claude 를 고른·Claude 를 가진 길이 Sonnet 5.5 · high 한 모델인지 묶는다.
//
// 이 파일은 «들어가는 길마다 기본이 무엇으로 풀리는가» 를 한 자리에 고정한다:
//   Claude 로 도는 길(구독 CLI · Anthropic 키 · 편집기 안 계정) — 계획·실행·시각·작문·시공·감독이 모두 claude-sonnet-5-5 · high 한 모델.
//     Haiku 워커·팀장 나누기는 기본이 아니다(설정에서 고를 수는 있다).
//   Claude 를 쓸 수 없는 길(ChatGPT 만 · Google 만) — 그 계정의 기본(Sol · Argon).
//   이미 저장된 설정 — 그대로. 저장값이 옛 Claude 기본과 똑같을 때만 읽을 때 새 기본으로 올린다(PR #2535 와 같은 규칙, 디스크에는 쓰지 않는다).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, loadAiConfig, saveAiConfig, type AiConfig } from "@/ai/llmClient";
import { ASSISTANT_ENGINE_STORAGE_KEY, assistantEngineLead, loadAssistantEngine, saveAssistantEngine } from "@/ai/localCliEngine";
import { modelForRole } from "@/ai/modelRoles";
import { setKnownOpenAiCompatEndpoints, type OpenAiCompatEndpointPublic } from "@/ai/openAiCompat";
import { configForPlanAccount } from "@/ai/planDefaults";
import { configForProviderSelection } from "@/ai/providerSelection";
import { applyTeamPlan } from "@/ai/teamApply";
import { buildTeamPlan, type TeamInputs } from "@/ai/teamPlan";
import { KEY_ROUTES, keyRouteAdoptModel } from "@/ai/keyRoutes";
import { configForUltrabrain } from "@/ai/ultrabrainConfig";

const OPUS = "claude-opus-5-5";
const SONNET = "claude-sonnet-5-5";
const HAIKU = "claude-haiku-5-5";
const ROLES = ["deep", "build", "vision", "writer"] as const;

let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true, writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    },
  });
  setKnownOpenAiCompatEndpoints([]);
});
afterEach(() => {
  setKnownOpenAiCompatEndpoints([]);
  Reflect.deleteProperty(globalThis, "localStorage");
});

/** 역할 넷 + 계획·감독(ultrabrain)을 `제공자/모델@강도` 로. */
function resolved(config: AiConfig): Record<string, string> {
  const brain = configForUltrabrain(config);
  return {
    ...Object.fromEntries(ROLES.map((role) => { const m = modelForRole(config, role); return [role, `${m.provider}/${m.model}@${m.thinkingLevel}`]; })),
    plan: `${brain.providerId}/${brain.model}@${brain.reasoningEffort}`,
  };
}
const every = (slot: string, plan = slot): Record<string, string> => ({ deep: slot, build: slot, vision: slot, writer: slot, plan });

const cli = (id: "claude" | "codex") => ({ id, state: "ready", billing: "subscription" });
const oauth = (providerId: string) => ({ providerId, connected: true, authKind: "oauth" });

/** 첫 실행 마법사가 하는 일 그대로: 찾은 것으로 팀을 고르고(buildTeamPlan) 저장한다(applyTeamPlan + aiSetupWizardDeps.selectProvider). */
async function firstRun(partial: Partial<TeamInputs>): Promise<AiConfig> {
  const plan = buildTeamPlan({ clis: [], accounts: [], keys: [], ...partial });
  if (!plan) throw new Error("찾은 연결이 없다");
  const result = await applyTeamPlan(plan, {
    adoptKey: async (sourceId, modelId) => {
      const endpoint = { id: "openai-compat:claude-key", name: sourceId, defaultModel: modelId, models: [modelId] } as unknown as OpenAiCompatEndpointPublic;
      setKnownOpenAiCompatEndpoints([endpoint]);
      return endpoint.id;
    },
    saveEngine: saveAssistantEngine,
    saveLead: (lead) => { if (lead) throw new Error(`기본에는 팀장이 없어야 한다: ${JSON.stringify(lead)}`); },
    selectProvider: (providerId, workerModel) => {
      const base = configForProviderSelection(loadAiConfig(), providerId);
      saveAiConfig(providerId === "openai-codex" ? configForPlanAccount(base, providerId) : { ...base, model: workerModel });
    },
  });
  expect(result).toEqual({ ok: true });
  return loadAiConfig();
}

describe("들어가는 길마다 — Claude 로 도는 길은 모든 역할이 Sonnet 5.5 · high 한 모델", () => {
  it("새 설치(저장 없음): 공장 기본은 Claude 의 Sonnet 5.5 · high 다(2026-11-23) — ChatGPT 로 시작하지 않는다", () => {
    expect(resolved(loadAiConfig())).toEqual(every(`anthropic/${SONNET}@high`));
    expect(resolved(defaultAiConfig())).toEqual(every(`anthropic/${SONNET}@high`));
    expect(defaultAiConfig()).toMatchObject({ providerId: "anthropic", model: SONNET, liteModel: SONNET, reasoningEffort: "high" });
  });

  it("새 설치 + Claude CLI 구독: 같은 CLI 로 Sonnet 5.5 · high 하나 — 팀장도 Haiku 워커도 없다", async () => {
    const config = await firstRun({ clis: [cli("claude")] });
    expect(resolved(config)).toEqual(every(`local-cli:claude/${SONNET}@high`));
    expect(loadAssistantEngine()).toEqual({ kind: "local-cli", cli: "claude", routineModel: SONNET, deepModel: SONNET, effort: "high" });
    expect(assistantEngineLead(loadAssistantEngine())).toBeUndefined();
    expect(JSON.stringify(resolved(config))).not.toContain("haiku");
  });

  it("새 설치 + Claude CLI 와 Google 계정이 같이 있으면(ChatGPT 없음) Claude 하나로 시작한다", async () => {
    const config = await firstRun({ clis: [cli("claude")], accounts: [oauth("google-antigravity")] });
    expect(resolved(config)).toEqual(every(`local-cli:claude/${SONNET}@high`));
  });

  it("새 설치 + Claude CLI 와 ChatGPT 가 같이 있으면 Claude(Sonnet 5.5 · high) 하나로 시작한다(2026-11-23 오너 결정 — 2026-11-19 에는 ChatGPT 가 먼저였다)", async () => {
    const config = await firstRun({ clis: [cli("claude"), cli("codex")], accounts: [oauth("google-antigravity")] });
    expect(resolved(config)).toEqual(every(`local-cli:claude/${SONNET}@high`));
  });

  it("Anthropic 키: 입양한 엔드포인트의 모든 역할이 Sonnet 5.5 · high 이다", async () => {
    expect(keyRouteAdoptModel("claude")).toBe("sonnet");
    const config = await firstRun({ keys: [{ id: "ANTHROPIC_API_KEY", family: "claude", label: "ANTHROPIC_API_KEY", models: KEY_ROUTES.claude.models }] });
    expect(resolved(config)).toEqual(every(`openai-compat:claude-key/${SONNET}@high`));
    expect(loadAssistantEngine()).toBeUndefined();
  });

  it("편집기 안 Claude 계정: 다른 계정에서 Claude 로 바꾸면 모든 역할·감독이 Sonnet 5.5 · high 이다 — 「균형」 의 medium 으로 풀리지 않는다", () => {
    saveAiConfig(configForProviderSelection(loadAiConfig(), "google-antigravity"));
    const config = configForProviderSelection(loadAiConfig(), "anthropic");
    expect(resolved(config)).toEqual(every(`anthropic/${SONNET}@high`));
    expect(config.model).toBe(SONNET);
    expect(config.liteModel).toBe(SONNET);
  });
});

describe("들어가는 길마다 — Claude 를 쓸 수 없는 길은 그 계정의 기본", () => {
  it("ChatGPT 구독(Codex CLI)만: Sol 하나", async () => {
    expect(resolved(await firstRun({ clis: [cli("codex")] }))).toEqual(every("local-cli:codex/gpt-6.2-sol@medium"));
  });

  it("편집기 안 ChatGPT 로그인만: Sol · medium 하나(계획·감독도 medium)", async () => {
    expect(resolved(await firstRun({ accounts: [oauth("openai-codex")] }))).toEqual(every("openai-codex/gpt-6.2-sol@medium"));
  });

  it("Google 로그인만: Gemini 4 Argon medium, 계획·감독은 high", async () => {
    expect(resolved(await firstRun({ accounts: [oauth("google-antigravity")] }))).toEqual(every("google-antigravity/gemini-4-argon@medium", "google-antigravity/gemini-4-argon@high"));
  });
});

describe("이미 저장된 설정 — 건드리지 않는다", () => {
  const stored = (blob: Record<string, unknown>): void => { storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(blob)); };
  const slots = (provider: string, model: string) => Object.fromEntries(ROLES.map((role) => [role, { provider, model, thinkingLevel: "medium" }]));

  it("옛 공장 기본(Google · Argon medium · 감독 high)으로 저장된 설정은 Claude·ChatGPT 로 옮기지 않는다", () => {
    stored({ providerId: "google-antigravity", model: "gemini-4-argon", liteModel: "gemini-4-argon", reasoningEffort: "medium",
      ultrabrainProviderId: "google-antigravity", ultrabrainModel: "gemini-4-argon", ultrabrainReasoningEffort: "high",
      roleModels: slots("google-antigravity", "gemini-4-argon"), modelSelectionOverrides: {}, roleModelsPolicyVersion: 1 });
    expect(resolved(loadAiConfig())).toEqual(every("google-antigravity/gemini-4-argon@medium", "google-antigravity/gemini-4-argon@high"));
  });

  it("ChatGPT 로 저장된 설정도 그대로다", () => {
    stored({ providerId: "openai-codex", model: "gpt-6.1-sol", liteModel: "gpt-6.1-sol", ultrabrainProviderId: "openai-codex", ultrabrainModel: "gpt-6.1-sol",
      ultrabrainReasoningEffort: "high", roleModels: slots("openai-codex", "gpt-6.1-sol"), modelSelectionOverrides: {}, roleModelsPolicyVersion: 1 });
    expect(resolved(loadAiConfig())).toEqual(every("openai-codex/gpt-6.1-sol@medium", "openai-codex/gpt-6.1-sol@high"));
  });

  it("직접 고른 Terra 도 읽을 때 Sol 로 올리고 medium 이상은 유지한다", () => {
    const terra = (thinkingLevel: string) => ({ provider: "openai-codex", model: "gpt-6.1-terra", thinkingLevel });
    const raw = JSON.stringify({
      providerId: "openai-codex", model: "gpt-6.1-terra", liteModel: "gpt-6.1-terra", reasoningEffort: "off",
      ultrabrainProviderId: "openai-codex", ultrabrainModel: "gpt-6.1-terra", ultrabrainReasoningEffort: "low",
      roleModels: { deep: terra("low"), build: terra("high"), writer: terra("off"), vision: terra("minimal") },
      pixelModel: terra("high"), assistantRoles: { advisor: terra("xhigh") },
      modelSelectionOverrides: { deep: true, build: true, writer: true, vision: true, ultrabrain: true, pixel: true, advisor: true },
      roleModelsPolicyVersion: 1,
    });
    storage.set(AI_CONFIG_STORAGE_KEY, raw);
    const config = loadAiConfig();
    expect(config).toMatchObject({ model: "gpt-6.2-sol", liteModel: "gpt-6.2-sol", reasoningEffort: "medium" });
    const medium = "openai-codex/gpt-6.2-sol@medium";
    expect(resolved(config)).toEqual({ ...every(medium), build: "openai-codex/gpt-6.2-sol@high" });
    expect(config.pixelModel).toMatchObject({ model: "gpt-6.2-sol", thinkingLevel: "high" });
    expect(config.assistantRoles?.advisor).toMatchObject({ model: "gpt-6.2-sol", thinkingLevel: "xhigh" });
    expect(storage.get(AI_CONFIG_STORAGE_KEY)).toBe(raw);
    saveAiConfig(config);
    expect(loadAiConfig()).toEqual(config);
  });

  it.each([["low", "medium"], ["high", "high"]])("저장된 Codex Terra 엔진을 Sol 로 읽는다 (%s → %s)", (effort, expected) => {
    storage.set(ASSISTANT_ENGINE_STORAGE_KEY, JSON.stringify({
      kind: "local-cli", cli: "codex", routineModel: "gpt-6.1-terra", deepModel: "gpt-6.1-terra", effort, policyVersion: 2,
    }));
    expect(loadAssistantEngine()).toEqual({ kind: "local-cli", cli: "codex", routineModel: "gpt-6.2-sol", deepModel: "gpt-6.2-sol", effort: expected });
    expect(resolved(loadAiConfig())).toEqual(every(`local-cli:codex/gpt-6.2-sol@${expected}`));
  });

  it("지난 Claude 기본(Opus 5.5 medium)으로 저장된 계정 설정은 ChatGPT·Sonnet 으로 옮기지 않는다(2026-11-19 · 2026-11-23)", () => {
    stored({ providerId: "anthropic", model: OPUS, liteModel: OPUS, reasoningEffort: "medium",
      ultrabrainProviderId: "anthropic", ultrabrainModel: OPUS, ultrabrainReasoningEffort: "medium",
      roleModels: slots("anthropic", OPUS), modelSelectionOverrides: {}, roleModelsPolicyVersion: 1 });
    expect(resolved(loadAiConfig())).toEqual(every(`anthropic/${OPUS}@medium`));
  });

  it("사람이 Sonnet·Haiku 를 직접 고른 Claude 설정은 그대로다", () => {
    stored({ providerId: "anthropic", model: "claude-sonnet-5-5", liteModel: HAIKU, ultrabrainProviderId: "anthropic", ultrabrainModel: OPUS, ultrabrainReasoningEffort: "high",
      roleModels: { ...slots("anthropic", "claude-sonnet-5-5"), deep: { provider: "anthropic", model: HAIKU, thinkingLevel: "low" } },
      modelSelectionOverrides: { deep: true, build: true, vision: true, writer: true, ultrabrain: true }, roleModelsPolicyVersion: 1 });
    expect(resolved(loadAiConfig())).toEqual({ deep: `anthropic/${HAIKU}@low`, build: "anthropic/claude-sonnet-5-5@medium", vision: "anthropic/claude-sonnet-5-5@medium",
      writer: "anthropic/claude-sonnet-5-5@medium", plan: `anthropic/${OPUS}@high` });
  });
});

describe("옛 Claude 기본과 똑같은 저장값만 읽을 때 새 기본으로 올린다 (PR #2535 와 같은 규칙)", () => {
  const LEGACY_ENGINE = { kind: "local-cli", cli: "claude", routineModel: HAIKU, deepModel: OPUS, effort: "medium", teamLead: true };

  it("Claude 구독 옛 기본(Opus 팀장 + Haiku 워커)으로 저장된 엔진 선택은 Sonnet 5.5 · high 하나로 읽는다 — 디스크는 그대로", () => {
    const raw = JSON.stringify(LEGACY_ENGINE);
    storage.set(ASSISTANT_ENGINE_STORAGE_KEY, raw);
    expect(loadAssistantEngine()).toEqual({ kind: "local-cli", cli: "claude", routineModel: SONNET, deepModel: SONNET, effort: "high" });
    expect(assistantEngineLead(loadAssistantEngine())).toBeUndefined();
    expect(resolved(loadAiConfig())).toEqual(every(`local-cli:claude/${SONNET}@high`));
    expect(storage.get(ASSISTANT_ENGINE_STORAGE_KEY)).toBe(raw);
  });

  it("2026-11-16 ~ 11-23 기본(Opus 5.5 하나 · medium, 표식 2)으로 저장된 엔진 선택은 Sonnet 5.5 · high 로 읽는다 — 표식 3 이 찍힌 같은 값은 그대로", () => {
    const opusOne = { kind: "local-cli", cli: "claude", routineModel: OPUS, deepModel: OPUS, effort: "medium" };
    const raw = JSON.stringify({ ...opusOne, policyVersion: 2 });
    storage.set(ASSISTANT_ENGINE_STORAGE_KEY, raw);
    expect(loadAssistantEngine()).toEqual({ kind: "local-cli", cli: "claude", routineModel: SONNET, deepModel: SONNET, effort: "high" });
    expect(storage.get(ASSISTANT_ENGINE_STORAGE_KEY)).toBe(raw);
    saveAssistantEngine(opusOne as Parameters<typeof saveAssistantEngine>[0]);
    expect(loadAssistantEngine()).toEqual(opusOne);
    storage.set(ASSISTANT_ENGINE_STORAGE_KEY, JSON.stringify({ ...opusOne, effort: "high", policyVersion: 2 }));
    expect(loadAssistantEngine()?.routineModel).toBe(OPUS);
  });

  it("그 뒤에 사람이 다시 고른 Opus 팀장 + Haiku 워커는 그대로 둔다(저장이 표식을 찍는다)", () => {
    saveAssistantEngine({ kind: "local-cli", cli: "claude", routineModel: HAIKU, deepModel: OPUS, effort: "medium", teamLead: true });
    expect(loadAssistantEngine()).toEqual(LEGACY_ENGINE);
    expect(assistantEngineLead(loadAssistantEngine())).toEqual({ provider: "local-cli:claude", model: OPUS, thinkingLevel: "medium" });
    expect(modelForRole(loadAiConfig(), "deep").model).toBe(HAIKU);
  });

  it("옛 기본에서 한 칸이라도 고친 엔진 선택은 그대로 둔다", () => {
    for (const edited of [{ ...LEGACY_ENGINE, effort: "high" }, { ...LEGACY_ENGINE, teamLead: false }, { ...LEGACY_ENGINE, routineModel: "sonnet" }, { ...LEGACY_ENGINE, cli: "codex" }]) {
      storage.set(ASSISTANT_ENGINE_STORAGE_KEY, JSON.stringify(edited));
      expect(loadAssistantEngine()?.routineModel, JSON.stringify(edited)).toBe(edited.routineModel);
    }
  });

  it("Claude 계정을 골랐을 때 제품이 채운 Haiku 칸은 조수 기본(Sonnet 5.5)으로 읽고, 사람이 고른 Haiku 칸은 그대로 둔다 — 강도는 저장된 대로", () => {
    const blob = (pinned: Record<string, true>) => ({ providerId: "anthropic", model: HAIKU, liteModel: HAIKU, ultrabrainProviderId: "anthropic", ultrabrainModel: OPUS, ultrabrainReasoningEffort: "high",
      roleModels: Object.fromEntries(ROLES.map((role) => [role, { provider: "anthropic", model: HAIKU, thinkingLevel: "medium" }])), modelSelectionOverrides: pinned, roleModelsPolicyVersion: 1 });
    const raw = JSON.stringify(blob({}));
    storage.set(AI_CONFIG_STORAGE_KEY, raw);
    expect(resolved(loadAiConfig())).toEqual(every(`anthropic/${SONNET}@medium`, `anthropic/${OPUS}@high`));
    expect(loadAiConfig().model).toBe(SONNET);
    expect(loadAiConfig().liteModel).toBe(SONNET);
    expect(storage.get(AI_CONFIG_STORAGE_KEY)).toBe(raw);

    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(blob({ deep: true })));
    expect(resolved(loadAiConfig())).toEqual({ ...every(`anthropic/${SONNET}@medium`, `anthropic/${OPUS}@high`), deep: `anthropic/${HAIKU}@medium` });
    expect(loadAiConfig().liteModel).toBe(HAIKU);
  });

  it("다른 계정의 Haiku(사용자 지정 엔드포인트 등)는 건드리지 않는다", () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "openai-compat:my-proxy", model: HAIKU, liteModel: HAIKU,
      roleModels: { deep: { provider: "openai-compat:my-proxy", model: HAIKU, thinkingLevel: "medium" } }, modelSelectionOverrides: {}, roleModelsPolicyVersion: 1 }));
    expect(modelForRole(loadAiConfig(), "deep")).toEqual({ provider: "openai-compat:my-proxy", model: HAIKU, thinkingLevel: "medium" });
    expect(loadAiConfig().model).toBe(HAIKU);
  });
});

describe("곁 호출도 조수 기본 모델 — 기본값은 한 곳(src/ai/claudeDefault.ts) (N6, 2026-11-16)", () => {
  // r7a(조수 Opus 5.5 medium)에서 화면 검수 곁 호출 7번이 따로 박혀 있던 다른 모델로 갔다.
  // 기본값을 적는 모든 자리가 같은 상수를 보는지, 곁 호출(화면 검수 · 검토자)이 Claude 로 갈 때 조수 기본(Sonnet 5.5 · high)인지 묶는다.
  it("기본값을 적는 자리가 모두 같은 상수다", async () => {
    const { ASSISTANT_CLAUDE_MODEL, ASSISTANT_CLAUDE_EFFORT } = await import("@/ai/claudeDefault");
    const { CLAUDE_DEFAULT_MODEL, CLAUDE_DEFAULT_EFFORT } = await import("@/ai/ohMyPiProviders");
    const { LOCAL_CLI_DEFAULT_MODELS } = await import("@/ai/localCliEngine");
    const { CLAUDE_SUBSCRIPTION_ENGINE } = await import("@/ai/planDefaults");
    expect([ASSISTANT_CLAUDE_MODEL, ASSISTANT_CLAUDE_EFFORT]).toEqual([SONNET, "high"]);
    expect([CLAUDE_DEFAULT_MODEL, CLAUDE_DEFAULT_EFFORT]).toEqual([ASSISTANT_CLAUDE_MODEL, ASSISTANT_CLAUDE_EFFORT]);
    expect(LOCAL_CLI_DEFAULT_MODELS.claude).toEqual({ routine: ASSISTANT_CLAUDE_MODEL, deep: ASSISTANT_CLAUDE_MODEL });
    expect(CLAUDE_SUBSCRIPTION_ENGINE).toMatchObject({ routineModel: ASSISTANT_CLAUDE_MODEL, deepModel: ASSISTANT_CLAUDE_MODEL, effort: ASSISTANT_CLAUDE_EFFORT });
    expect(CLAUDE_SUBSCRIPTION_ENGINE.teamLead).toBeUndefined();
  });

  it("역할 표(JSON)의 Claude 칸 — 주·검토자·눈·도트의 첫 후보가 그 상수 · high 이고, 어느 칸에도 Opus·Haiku 가 먼저 서지 않는다", async () => {
    const matrix = (await import("@/ai/assistantRoleMatrix.json")).default as { families: Record<string, { routes: { providerId: string; roles: Record<string, { model: string; thinkingLevel: string }[]> }[] }> };
    const route = matrix.families.claude!.routes.find((r) => r.providerId === "local-cli:claude")!;
    for (const role of ["main", "advisor", "vision", "pixel"]) {
      expect(route.roles[role]?.[0], role).toEqual({ model: SONNET, thinkingLevel: "high" });
    }
    expect(route.roles.smol).toBeUndefined();
  });

  it("화면 검수(VQA) — 다른 계열이 답하지 못해 Claude 로 넘어가면 Sonnet 5.5 · high 이다(Opus 아님)", async () => {
    const { vqaReviewerCandidates } = await import("@/ai/v2/judge/vqa");
    const { familyOfProviderId } = await import("@/ai/assistantRoles");
    const claudeOf = (main: { provider: string; model: string }) => vqaReviewerCandidates({ main, keyed: new Set([main.provider]), familyOf: (id) => familyOfProviderId(id, [main.model]) })
      .filter((p) => p.provider === "local-cli:claude");
    // 조수가 Claude(Sonnet)로 돌 때: Claude 검수자는 Sonnet · high 하나(주 모델과 합쳐짐 — 지은 모델과 검수 모델이 같다).
    expect(claudeOf({ provider: "local-cli:claude", model: SONNET })).toEqual([{ provider: "local-cli:claude", model: SONNET, effort: "high", sameAsMain: true }]);
    // 조수가 다른 계열로 돌 때: 다른 계열 검수자로 서는 Claude 도 Sonnet · high.
    expect(claudeOf({ provider: "openai-codex", model: "gpt-6.1-terra" })).toEqual([{ provider: "local-cli:claude", model: SONNET, effort: "high", sameAsMain: false }]);
    expect(claudeOf({ provider: "google-antigravity", model: "gemini-4-argon" })[0]).toMatchObject({ model: SONNET, effort: "high" });
  });

  it("검토자(advisor) 자동 배정 — Claude 만 연결되면 Sonnet 5.5 · high", async () => {
    const { resolveAssistantRoles } = await import("@/ai/assistantRoles");
    const { mockConnectedRoutes } = await import("@/editor/panels/aiRoleMatrixSettings");
    const roles = resolveAssistantRoles(mockConnectedRoutes("claude"));
    expect(roles.advisor).toMatchObject({ status: "ok", model: { provider: "local-cli:claude", model: SONNET, thinkingLevel: "high" } });
    expect(roles.vision).toMatchObject({ status: "ok", model: { provider: "local-cli:claude", model: SONNET, thinkingLevel: "high" } });
  });
});
