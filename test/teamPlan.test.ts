import { describe, expect, it } from "vitest";
import { applyTeamPlan, type TeamApplyDeps } from "../src/ai/teamApply";
import { buildTeamPlan, modelRoutes, type DetectedKey, type TeamInputs, type TeamPlan, type TeamRoute, type TeamSlot } from "../src/ai/teamPlan";
import { planEvidence, planSentence, planTitle } from "../src/ai/teamPlanText";
import { FAMILY_MODEL_KEYS, NEAR_BEST_POINTS, SCORE_ROWS, SOLO_DEFAULT_WORKERS, TEAM_MODELS, chooseTeam, type ModelFamily, type TeamModelKey } from "../src/ai/teamScoreboard";
import { wizardScreen } from "../src/ai/setupWizardModel";

const cli = (id: "claude" | "codex" | "gemini", state = "ready", billing = "subscription") => ({ id, state, billing });
const oauth = (providerId: string, extra: Record<string, unknown> = {}) => ({ providerId, connected: true, authKind: "oauth", ...extra });
const key = (id: string, family: ModelFamily, models: DetectedKey["models"]): DetectedKey => ({ id, family, label: id, models });
const inputs = (partial: Partial<TeamInputs>): TeamInputs => ({ clis: [], accounts: [], keys: [], ...partial });
const shape = (plan: TeamPlan | undefined) => plan && { lead: plan.lead?.model.key, worker: plan.worker.model.key, route: plan.worker.route.kind };
// 나눈 팀(팀장 + 워커)은 기본이 아니다(2026-11-16) — 설정에서 고른 사람의 계획을 손으로 만든다.
const CLAUDE_CLI: TeamRoute = { kind: "cli", cli: "claude" };
const slot = (model: TeamModelKey, route: TeamRoute): TeamSlot => ({ model: TEAM_MODELS[model], route, modelId: TEAM_MODELS[model].id });
const splitPlan = (lead: TeamSlot, worker: TeamSlot): TeamPlan => ({ lead, worker, routes: lead.route === worker.route ? [worker.route] : [worker.route, lead.route] });

describe("first-run team defaults from what the user has", () => {
  it("gives a Claude subscription or key Sonnet alone, and every other single service the team the scoreboard rates best within one point, cheapest first", () => {
    // 오너 결정 2026-11-23: Claude 를 쓸 수 있으면 Sonnet 5.5 하나가 계획부터 만들기까지 — 점수표에 행이 없어도 점수표 조합보다 먼저 고른다.
    expect(shape(buildTeamPlan(inputs({ clis: [cli("claude")] })))).toEqual({ lead: undefined, worker: "sonnet", route: "cli" });
    expect(buildTeamPlan(inputs({ clis: [cli("claude")] }))?.choice).toBeUndefined();
    expect(shape(buildTeamPlan(inputs({ keys: [key("ANTHROPIC_API_KEY", "claude", { opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5", haiku: "claude-haiku-5-5" })] })))).toEqual({ lead: undefined, worker: "sonnet", route: "key" });
    // Sonnet 이 없는 Claude 키는 점수표의 기본 혼자 모델(Opus)로 물러난다.
    expect(shape(buildTeamPlan(inputs({ keys: [key("ANTHROPIC_API_KEY", "claude", { opus: "claude-opus-5-5", haiku: "claude-haiku-5-5" })] })))).toEqual({ lead: undefined, worker: "opus", route: "key" });
    expect(shape(buildTeamPlan(inputs({ accounts: [oauth("openai-codex")] })))).toEqual({ lead: undefined, worker: "sol62", route: "account" });
    expect(shape(buildTeamPlan(inputs({ keys: [key("DEEPSEEK_API_KEY", "deepseek", { deepseek: "deepseek-v4.1-flash" })] })))).toEqual({ lead: undefined, worker: "deepseek", route: "key" });
  });

  it("falls back to Argon without a score when only Google is signed in", () => {
    const plan = buildTeamPlan(inputs({ accounts: [oauth("google-antigravity")] }));
    expect(shape(plan)).toEqual({ lead: undefined, worker: "argon", route: "account" });
    expect(plan?.choice).toBeUndefined();
  });

  it("prefers Claude (Sonnet alone, any route) over ChatGPT when both are present — owner decision 2026-11-23, replacing ChatGPT-first of 2026-11-19", () => {
    expect(shape(buildTeamPlan(inputs({ clis: [cli("claude"), cli("codex")] })))).toEqual({ lead: undefined, worker: "sonnet", route: "cli" });
    expect(shape(buildTeamPlan(inputs({ clis: [cli("claude")], accounts: [oauth("openai-codex"), oauth("google-antigravity")] })))).toEqual({ lead: undefined, worker: "sonnet", route: "cli" });
    expect(buildTeamPlan(inputs({ clis: [cli("claude"), cli("codex")] }))?.routes).toEqual([{ kind: "cli", cli: "claude" }]);
    // 구독이 아니라 키로만 가진 Claude 도 ChatGPT 보다 앞선다.
    const claudeKey = key("ANTHROPIC_API_KEY", "claude", { opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5", haiku: "claude-haiku-5-5" });
    expect(shape(buildTeamPlan(inputs({ keys: [claudeKey], accounts: [oauth("openai-codex")] })))).toEqual({ lead: undefined, worker: "sonnet", route: "key" });
    expect(shape(buildTeamPlan(inputs({ keys: [claudeKey], clis: [cli("codex")] })))).toEqual({ lead: undefined, worker: "sonnet", route: "key" });
  });

  it("keeps Sonnet alone when Claude is present without a ChatGPT subscription — an OpenAI API key does not take over", () => {
    expect(shape(buildTeamPlan(inputs({ clis: [cli("claude")], keys: [key("OPENAI_API_KEY", "openai", { terra: "gpt-6.1-terra" })] })))).toEqual({ lead: undefined, worker: "sonnet", route: "cli" });
    expect(shape(buildTeamPlan(inputs({ clis: [cli("claude")], keys: [key("DEEPSEEK_API_KEY", "deepseek", { deepseek: "deepseek-v4.1-flash" })] })))).toEqual({ lead: undefined, worker: "sonnet", route: "cli" });
    expect(shape(buildTeamPlan(inputs({ clis: [cli("claude")], accounts: [oauth("google-antigravity")] })))).toEqual({ lead: undefined, worker: "sonnet", route: "cli" });
  });

  it("gives ChatGPT Sol alone, with or without Google", () => {
    expect(shape(buildTeamPlan(inputs({ clis: [cli("codex")] })))).toEqual({ lead: undefined, worker: "sol62", route: "cli" });
    expect(shape(buildTeamPlan(inputs({ accounts: [oauth("openai-codex"), oauth("google-antigravity")] })))).toEqual({ lead: undefined, worker: "sol62", route: "account" });
  });

  it("returns nothing when nothing usable is found", () => {
    expect(buildTeamPlan(inputs({}))).toBeUndefined();
  });

  it("does not count API-key logins, env keys, expired logins or not-ready CLIs as subscriptions", () => {
    const plan = buildTeamPlan(inputs({
      clis: [cli("claude", "ready", "api"), cli("codex", "login-required", "unknown"), cli("gemini", "not-installed", "unknown")],
      accounts: [oauth("openai-codex", { env: true }), oauth("google-antigravity", { expired: true }), oauth("openai-codex", { authKind: "apiKey" })],
    }));
    expect(plan).toBeUndefined();
  });

  it("uses a subscription route before a key route for the same model", () => {
    const routes = modelRoutes(inputs({ clis: [cli("claude")], keys: [key("ANTHROPIC_API_KEY", "claude", { opus: "claude-opus-5-5", haiku: "claude-haiku-5-5" })] }));
    expect(routes.get("opus")?.route.kind).toBe("cli");
    expect(routes.get("haiku")?.route.kind).toBe("cli");
  });

  it("lists product defaults and the models measured by the scoreboard", () => {
    expect(Object.values(TEAM_MODELS).map((model) => model.id).sort()).toEqual([
      "claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5",
      "deepseek-v4.1-flash",
      "gemini-3.8-flash", "gemini-4-argon",
      "gpt-6-astra", "gpt-6-luna", "gpt-6.1-sol", "gpt-6.1-terra", "gpt-6.2-sol",
    ]);
    expect(Object.values(FAMILY_MODEL_KEYS).flat().sort()).toEqual(Object.keys(TEAM_MODELS).sort());
  });
});

describe("score table", () => {
  it("only rates combinations built from team models and keeps costs positive", () => {
    for (const row of SCORE_ROWS) {
      expect(TEAM_MODELS[row.worker]).toBeDefined();
      if (row.lead) expect(TEAM_MODELS[row.lead]).toBeDefined();
      expect(row.costUsd).toBeGreaterThan(0);
      expect(row.n).toBeGreaterThan(0);
    }
  });

  it("prefers Opus alone in the scoreboard when available", () => {
    expect(SOLO_DEFAULT_WORKERS).toEqual(["opus"]);
    const choice = chooseTeam(new Set(["opus", "haiku"]));
    expect(choice?.lead).toBeUndefined();
    expect(choice).toMatchObject({ worker: "opus", table: "full", quality: 63.5, costUsd: 1.832, n: 33 });
    const everything = chooseTeam(new Set(Object.keys(TEAM_MODELS) as TeamModelKey[]));
    expect(everything?.lead).toBeUndefined();
    expect(everything).toMatchObject({ worker: "opus", table: "pick3", quality: 72.9 });
    // 그 표의 최고 점수(Opus 팀장 + Terra 워커 74.9)는 그대로 적는다 — 점수를 고쳐 쓰지 않는다.
    expect(everything!.bestQuality).toBe(74.9);
  });

  it("without a solo default, picks the cheapest combination within NEAR_BEST_POINTS of the best of the table it uses", () => {
    for (const set of [["haiku", "argon"], ["terra", "sol", "astra"], ["haiku", "deepseek", "astra", "terra"]] as const) {
      const available = new Set<TeamModelKey>(set);
      const choice = chooseTeam(available)!;
      const rows = SCORE_ROWS.filter((row) => row.table === choice.table && available.has(row.worker) && (!row.lead || available.has(row.lead)));
      const near = rows.filter((row) => choice.bestQuality - row.quality <= NEAR_BEST_POINTS + 1e-9);
      expect(choice.bestQuality, set.join("+")).toBe(Math.max(...rows.map((row) => row.quality)));
      expect(choice.bestQuality - choice.quality, set.join("+")).toBeLessThanOrEqual(NEAR_BEST_POINTS + 1e-9);
      expect(choice.costUsd, set.join("+")).toBe(Math.min(...near.map((row) => row.costUsd)));
    }
    expect(chooseTeam(new Set(["haiku", "argon"]))).toMatchObject({ worker: "haiku", table: "full" });
  });

  it("returns undefined for a set the scoreboard never rated", () => {
    expect(chooseTeam(new Set(["argon"]))).toBeUndefined();
    expect(chooseTeam(new Set(["sonnet", "luna"]))).toBeUndefined();
  });
});

describe("plain-language text", () => {
  it("names the service, the one model that does everything and the evidence without jargon", () => {
    const plan = buildTeamPlan(inputs({ clis: [cli("claude")] }))!;
    expect(planTitle(plan)).toBe("Claude 구독");
    expect(planSentence(plan)).toBe("계획부터 만들기까지 Sonnet 5.5 하나가 맡아요.");
    expect(planSentence(plan)).not.toContain("Haiku");
    expect(planEvidence(plan)).toContain("점수가 아직 없는");
  });

  it("names both roles for a split team", () => {
    const plan = splitPlan(slot("opus", CLAUDE_CLI), slot("haiku", CLAUDE_CLI));
    expect(planSentence(plan)).toContain("Opus 5.5");
    expect(planSentence(plan)).toContain("Haiku 5.5");
  });

  it("marks the product-default team as unmeasured", () => {
    const plan = buildTeamPlan(inputs({ accounts: [oauth("google-antigravity")] }))!;
    expect(planEvidence(plan)).toContain("점수가 아직 없는");
  });
});

describe("applying a plan", () => {
  const recorder = () => {
    const calls: { engine?: unknown; lead?: unknown; provider?: [string, string]; adopted: string[] } = { adopted: [] };
    const deps: TeamApplyDeps = {
      adoptKey: async (sourceId) => { calls.adopted.push(sourceId); return `openai-compat:${sourceId.toLowerCase()}`; },
      saveEngine: (choice) => { calls.engine = choice; },
      saveLead: (lead) => { calls.lead = lead; },
      selectProvider: (providerId, model) => { calls.provider = [providerId, model]; },
    };
    return { calls, deps };
  };

  it("turns a Claude subscription into an engine choice with Sonnet 5.5 high in every slot and no lead", async () => {
    const { calls, deps } = recorder();
    const plan = buildTeamPlan(inputs({ clis: [cli("claude")] }))!;
    expect(await applyTeamPlan(plan, deps)).toEqual({ ok: true });
    expect(calls.engine).toEqual({ kind: "local-cli", cli: "claude", routineModel: "claude-sonnet-5-5", deepModel: "claude-sonnet-5-5", effort: "high" });
    expect(calls.lead).toBeUndefined();
    expect(calls.provider).toBeUndefined();
  });

  it("adopts an Anthropic key with Sonnet 5.5 as the one model", async () => {
    const { calls, deps } = recorder();
    const plan = buildTeamPlan(inputs({ keys: [key("ANTHROPIC_API_KEY", "claude", { opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5", haiku: "claude-haiku-5-5" })] }))!;
    expect(await applyTeamPlan(plan, deps)).toEqual({ ok: true });
    expect(calls.adopted).toEqual(["ANTHROPIC_API_KEY"]);
    expect(calls.provider).toEqual(["openai-compat:anthropic_api_key", "claude-sonnet-5-5"]);
    expect(calls.lead).toBeUndefined();
    expect(calls.engine).toBeUndefined();
  });

  it("still applies a split team on one CLI as an engine choice with the lead on the same CLI", async () => {
    const { calls, deps } = recorder();
    expect(await applyTeamPlan(splitPlan(slot("opus", CLAUDE_CLI), slot("haiku", CLAUDE_CLI)), deps)).toEqual({ ok: true });
    expect(calls.engine).toEqual({ kind: "local-cli", cli: "claude", routineModel: "claude-haiku-5-5", deepModel: "claude-opus-5-5", effort: "high", teamLead: true });
    expect(calls.lead).toBeUndefined();
  });

  it("keeps the lead as its own role when the lead and worker run on different routes", async () => {
    const { calls, deps } = recorder();
    const plan = splitPlan(slot("opus", CLAUDE_CLI), slot("terra", { kind: "key", sourceId: "OPENAI_API_KEY", label: "OPENAI_API_KEY" }));
    expect(await applyTeamPlan(plan, deps)).toEqual({ ok: true });
    expect(calls.adopted).toEqual(["OPENAI_API_KEY"]);
    expect(calls.lead).toEqual({ provider: "local-cli:claude", model: "claude-opus-5-5", thinkingLevel: "medium" });
    expect(calls.provider).toEqual(["openai-compat:openai_api_key", "gpt-6.1-terra"]);
    expect(calls.engine).toBeUndefined();
  });

  it("reports a failed key adoption without saving anything", async () => {
    const { calls, deps } = recorder();
    const failing: TeamApplyDeps = { ...deps, adoptKey: async () => undefined };
    const plan = buildTeamPlan(inputs({ keys: [key("DEEPSEEK_API_KEY", "deepseek", { deepseek: "deepseek-v4.1-flash" })] }))!;
    expect((await applyTeamPlan(plan, failing)).ok).toBe(false);
    expect(calls.provider).toBeUndefined();
    expect(calls.engine).toBeUndefined();
  });
});

describe("setup wizard screens", () => {
  const base = { os: "win32" as const, finding: false, keySources: [], installable: {}, claudeInstalledNotSignedIn: false };

  const MODEL_NAME = /Opus|Haiku|Sonnet|Terra|Argon|GPT-\d|V4\.1|Flash|계획·검토|만들기 담당|irm |\| iex/u;

  it("says what was found in plain words and keeps model names behind 「자세히」", () => {
    const ready = wizardScreen({ ...base, plan: buildTeamPlan(inputs({ clis: [cli("claude")] })) });
    expect(ready.id).toBe("ready");
    expect(ready.service).toBe("claude");
    expect(ready.title).toBe("Claude로 연결돼 있어요");
    expect(ready.primary).toEqual({ id: "start-plan", label: "시작하기" });
    expect(`${ready.title} ${ready.body}`).not.toMatch(MODEL_NAME);
    expect(ready.details?.rows.map((row) => row.value).join(" ")).toMatch(/Sonnet/u);

    expect(ready.details?.rows.map((row) => `${row.label}: ${row.value}`)).toContain("맡는 AI: Sonnet 5.5");
    expect(ready.details?.rows.map((row) => row.value).join(" ")).not.toMatch(/Haiku/u);

    // ChatGPT 가 같이 있어도 Claude 하나로 시작한다(오너 결정 2026-11-23: 조수는 Sonnet 5.5 high — 2026-11-19 에는 ChatGPT 가 먼저였다).
    const withChatGpt = wizardScreen({ ...base, plan: buildTeamPlan(inputs({ clis: [cli("claude")], accounts: [oauth("openai-codex")] })) });
    expect(withChatGpt.service).toBe("claude");
    expect(withChatGpt.title).toBe("Claude로 연결돼 있어요");

    // Claude 가 없으면 ChatGPT 하나로 시작한다.
    const chatGptOnly = wizardScreen({ ...base, plan: buildTeamPlan(inputs({ accounts: [oauth("openai-codex")] })) });
    expect(chatGptOnly.service).toBe("chatgpt");
    expect(chatGptOnly.title).toBe("ChatGPT로 연결돼 있어요");

    const both = wizardScreen({ ...base, plan: splitPlan(slot("opus", CLAUDE_CLI), slot("terra", { kind: "account", providerId: "openai-codex" })) });
    expect(both.title).toBe("AI가 연결돼 있어요");
    expect(both.body).not.toMatch(MODEL_NAME);
  });

  it("offers three account choices when nothing is found, with keys tucked into a quiet link", () => {
    const choose = wizardScreen(base);
    expect(choose.id).toBe("choose");
    expect(choose.primary).toBeUndefined();
    expect(choose.choices.map((choice) => choice.arg)).toEqual(["chatgpt", "google", "claude"]);
    expect(choose.secondary.map((action) => action.id)).toEqual(["paste-key", "later"]);
  });

  it("asks for one re-login when a signed-in account has expired instead of starting over", () => {
    const screen = wizardScreen({ ...base, expired: "chatgpt" });
    expect(screen.id).toBe("expired");
    expect(screen.primary).toEqual({ id: "login-chatgpt", label: "다시 로그인하기" });
    expect(wizardScreen({ ...base, expired: "chatgpt", picking: true }).id).toBe("choose");
  });

  it("shows a failure as one alert and turns the main button into a retry", () => {
    const screen = wizardScreen({ ...base, chosen: "chatgpt", failure: "로그인이 끝나지 않았어요." });
    expect(screen.alert).toBe("로그인이 끝나지 않았어요.");
    expect(screen.body).not.toContain("끝나지 않았어요");
    expect(screen.primary).toEqual({ id: "login-chatgpt", label: "다시 시도" });
  });

  it("names the key source only inside the details", () => {
    const screen = wizardScreen({ ...base, keySources: [{ id: "DEEPSEEK_API_KEY", label: "DEEPSEEK_API_KEY (환경 변수)" }] });
    expect(screen.id).toBe("key-found");
    expect(screen.body).not.toContain("DEEPSEEK_API_KEY");
    expect(screen.details?.rows[0]?.value).toContain("DEEPSEEK_API_KEY");
    expect(screen.primary).toEqual({ id: "use-key", label: "이 키로 시작하기", arg: "DEEPSEEK_API_KEY" });
  });

  it("walks a Windows beginner through installing Claude with one copy step, then one recheck", () => {
    const guide = { command: "irm https://claude.ai/install.ps1 | iex", opens: "PowerShell", runnable: false };
    const screen = wizardScreen({ ...base, chosen: "claude", installable: { claude: guide } });
    expect(screen.primary).toEqual({ id: "copy-command", label: "복사하기", arg: "claude" });
    expect(screen.secondary.map((action) => action.id)).toEqual(["back", "later"]);
    expect(`${screen.title} ${screen.body}`).not.toMatch(MODEL_NAME);
    expect(screen.details?.command?.command).toContain("install.ps1");
    expect(wizardScreen({ ...base, chosen: "claude", copied: true, installable: { claude: guide } }).primary?.id).toBe("recheck");
  });

  it("offers the in-app installer and keeps the manual command folded until it fails", () => {
    const guide = { command: "irm https://claude.ai/install.ps1 | iex", opens: "PowerShell", runnable: true };
    const screen = wizardScreen({ ...base, chosen: "claude", installable: { claude: guide } });
    expect(screen.primary?.id).toBe("install-claude");
    expect(screen.command).toBeUndefined();
    expect(screen.details?.command?.command).toContain("install.ps1");
    expect(screen.details?.open).toBe(false);
    expect(wizardScreen({ ...base, chosen: "claude", failure: "x", installable: { claude: guide } }).details?.open).toBe(true);
  });

  it("warns that Claude needs a paid plan and offers a way back", () => {
    const screen = wizardScreen({ ...base, chosen: "claude", installable: {} });
    expect(screen.body).toContain("유료 구독");
    expect(screen.secondary.find((action) => action.id === "back")?.label).toBe("← 다른 AI");
  });
});
