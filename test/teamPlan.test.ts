import { describe, expect, it } from "vitest";
import { applyTeamPlan, type TeamApplyDeps } from "../src/ai/teamApply";
import { buildTeamPlan, modelRoutes, type DetectedKey, type TeamInputs, type TeamPlan } from "../src/ai/teamPlan";
import { planEvidence, planSentence, planTitle } from "../src/ai/teamPlanText";
import { FAMILY_MODEL_KEYS, NEAR_BEST_POINTS, SCORE_ROWS, TEAM_MODELS, chooseTeam, type ModelFamily } from "../src/ai/teamScoreboard";
import { wizardScreen } from "../src/ai/setupWizardModel";

const cli = (id: "claude" | "codex" | "gemini", state = "ready", billing = "subscription") => ({ id, state, billing });
const oauth = (providerId: string, extra: Record<string, unknown> = {}) => ({ providerId, connected: true, authKind: "oauth", ...extra });
const key = (id: string, family: ModelFamily, models: DetectedKey["models"]): DetectedKey => ({ id, family, label: id, models });
const inputs = (partial: Partial<TeamInputs>): TeamInputs => ({ clis: [], accounts: [], keys: [], ...partial });
const shape = (plan: TeamPlan | undefined) => plan && { lead: plan.lead?.model.key, worker: plan.worker.model.key, route: plan.worker.route.kind };

describe("first-run team defaults from what the user has", () => {
  it("gives each single service the team the scoreboard rates best within one point, cheapest first", () => {
    expect(shape(buildTeamPlan(inputs({ clis: [cli("claude")] })))).toEqual({ lead: "opus", worker: "haiku", route: "cli" });
    expect(shape(buildTeamPlan(inputs({ accounts: [oauth("openai-codex")] })))).toEqual({ lead: undefined, worker: "terra", route: "account" });
    expect(shape(buildTeamPlan(inputs({ keys: [key("DEEPSEEK_API_KEY", "deepseek", { deepseek: "deepseek-v4.1-flash" })] })))).toEqual({ lead: undefined, worker: "deepseek", route: "key" });
  });

  it("falls back to Argon without a score when only Google is signed in", () => {
    const plan = buildTeamPlan(inputs({ accounts: [oauth("google-antigravity")] }));
    expect(shape(plan)).toEqual({ lead: undefined, worker: "argon", route: "account" });
    expect(plan?.choice).toBeUndefined();
  });

  it("prefers the best-rated mix when several services are present", () => {
    expect(shape(buildTeamPlan(inputs({ clis: [cli("claude"), cli("codex")] })))).toEqual({ lead: "opus", worker: "terra", route: "cli" });
    expect(shape(buildTeamPlan(inputs({ clis: [cli("claude")], keys: [key("OPENAI_API_KEY", "openai", { terra: "gpt-6.1-terra" })] })))).toEqual({ lead: "opus", worker: "terra", route: "key" });
    expect(shape(buildTeamPlan(inputs({ clis: [cli("claude")], keys: [key("DEEPSEEK_API_KEY", "deepseek", { deepseek: "deepseek-v4.1-flash" })] })))).toEqual({ lead: "opus", worker: "haiku", route: "cli" });
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

  it("only lists the latest models the owner named", () => {
    expect(Object.values(TEAM_MODELS).map((model) => model.id).sort()).toEqual([
      "claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5",
      "deepseek-v4.1-flash",
      "gemini-3.8-flash", "gemini-4-argon",
      "gpt-6-astra", "gpt-6-luna", "gpt-6.1-sol", "gpt-6.1-terra",
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

  it("picks the cheapest combination within NEAR_BEST_POINTS of the best of the table it uses", () => {
    const choice = chooseTeam(new Set(["opus", "haiku"]));
    expect(choice).toMatchObject({ lead: "opus", worker: "haiku", table: "full" });
    expect(choice!.bestQuality - choice!.quality).toBeLessThanOrEqual(NEAR_BEST_POINTS);
    expect(choice!.costUsd).toBeLessThan(1);
  });

  it("returns undefined for a set the scoreboard never rated", () => {
    expect(chooseTeam(new Set(["argon"]))).toBeUndefined();
    expect(chooseTeam(new Set(["sonnet", "luna"]))).toBeUndefined();
  });
});

describe("plain-language text", () => {
  it("names the services, the split and the evidence without jargon", () => {
    const plan = buildTeamPlan(inputs({ clis: [cli("claude")] }))!;
    expect(planTitle(plan)).toBe("Claude 구독");
    expect(planSentence(plan)).toContain("Opus 5.5");
    expect(planSentence(plan)).toContain("Haiku 5.5");
    expect(planEvidence(plan)).toContain("62.7");
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

  it("turns a Claude subscription into an engine choice with the lead on the same CLI", async () => {
    const { calls, deps } = recorder();
    const plan = buildTeamPlan(inputs({ clis: [cli("claude")] }))!;
    expect(await applyTeamPlan(plan, deps)).toEqual({ ok: true });
    expect(calls.engine).toEqual({ kind: "local-cli", cli: "claude", routineModel: "claude-haiku-5-5", deepModel: "claude-opus-5-5", effort: "medium", teamLead: true });
    expect(calls.lead).toBeUndefined();
  });

  it("keeps the lead as its own role when the lead and worker run on different routes", async () => {
    const { calls, deps } = recorder();
    const plan = buildTeamPlan(inputs({ clis: [cli("claude")], keys: [key("OPENAI_API_KEY", "openai", { terra: "gpt-6.1-terra" })] }))!;
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

  it("shows one primary action per screen and keeps advanced things collapsed", () => {
    const ready = wizardScreen({ ...base, plan: buildTeamPlan(inputs({ clis: [cli("claude")] })) });
    expect(ready.id).toBe("ready");
    expect(ready.primary?.id).toBe("start-plan");
    expect(ready.choices).toEqual([]);

    const choose = wizardScreen(base);
    expect(choose.id).toBe("choose");
    expect(choose.primary).toBeUndefined();
    expect(choose.choices.map((choice) => choice.arg)).toEqual(["chatgpt", "claude", "google", "deepseek"]);
    expect(choose.advanced.map((action) => action.id)).toEqual(["paste-key"]);
  });

  it("names the key source on the confirm button screen", () => {
    const screen = wizardScreen({ ...base, keySources: [{ id: "DEEPSEEK_API_KEY", label: "DEEPSEEK_API_KEY (환경 변수)" }] });
    expect(screen.id).toBe("key-found");
    expect(screen.body).toContain("DEEPSEEK_API_KEY");
    expect(screen.primary).toEqual({ id: "use-key", label: "이 키로 시작하기", arg: "DEEPSEEK_API_KEY" });
  });

  it("walks a Windows beginner through installing Claude with a copy button when the app cannot install it", () => {
    const screen = wizardScreen({ ...base, chosen: "claude", installable: { claude: { command: "irm https://claude.ai/install.ps1 | iex", opens: "PowerShell", runnable: false } } });
    expect(screen.primary).toEqual({ id: "copy-command", label: "설치 글 복사하기", arg: "claude" });
    expect(screen.secondary.map((action) => action.id)).toEqual(["back", "recheck"]);
    expect(screen.command?.command).toContain("install.ps1");
  });

  it("offers the in-app installer when it can run", () => {
    const screen = wizardScreen({ ...base, chosen: "claude", installable: { claude: { command: "irm https://claude.ai/install.ps1 | iex", opens: "PowerShell", runnable: true } } });
    expect(screen.primary?.id).toBe("install-claude");
    expect(screen.commandFold).toEqual({ open: false });
    expect(wizardScreen({ ...base, chosen: "claude", failure: "x", installable: { claude: { command: "c", opens: "PowerShell", runnable: true } } }).commandFold).toEqual({ open: true });
  });

  it("warns that Claude needs a paid plan and offers a way back", () => {
    const screen = wizardScreen({ ...base, chosen: "claude", installable: {} });
    expect(screen.body).toContain("유료 구독");
    expect(screen.secondary.find((action) => action.id === "back")?.label).toBe("← 다른 AI 고르기");
  });
});
