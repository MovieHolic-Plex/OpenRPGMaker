import { describe, expect, it } from "vitest";
import { applyAssistantEngine, assistantEngineLead } from "../src/ai/localCliEngine";
import { CLAUDE_SUBSCRIPTION_ENGINE, configForPlanAccount, planCandidates } from "../src/ai/planDefaults";

const cli = (id: "claude" | "codex" | "gemini", state: string, billing: string) => ({ id, state, billing });
const oauth = (providerId: string, extra: Record<string, unknown> = {}) => ({ providerId, connected: true, authKind: "oauth", ...extra });

describe("first-run plan defaults", () => {
  it("orders ChatGPT (the default, owner decision 2026-11-19), then Claude, then the rest, one card per plan", () => {
    const plans = planCandidates(
      [cli("gemini", "ready", "subscription"), cli("codex", "ready", "subscription"), cli("claude", "ready", "subscription")],
      [oauth("openai-codex"), oauth("google-antigravity")],
    );
    expect(plans.map((plan) => plan.key)).toEqual(["codex-cli", "claude-cli", "gemini-cli"]);
  });

  it("gives a Claude subscription Sonnet 5.5 high alone (no lead, no Haiku worker), and ChatGPT Sol alone", () => {
    const [codex, claude] = planCandidates([cli("claude", "ready", "subscription"), cli("codex", "ready", "subscription")], []);
    // 오너 결정 2026-11-23: Claude 기본은 Sonnet 5.5 · high 한 모델 — Haiku 워커·팀장 나누기는 기본이 아니다.
    expect(claude?.kind === "local-cli" && claude.engine).toEqual({ kind: "local-cli", cli: "claude", routineModel: "claude-sonnet-5-5", deepModel: "claude-sonnet-5-5", effort: "high" });
    expect(claude?.kind === "local-cli" && assistantEngineLead(claude.engine)).toBeUndefined();
    expect(claude?.setup).toBe("Sonnet 5.5 하나가 계획부터 만들기까지 해요.");
    expect(applyAssistantEngine({ model: "x" }, CLAUDE_SUBSCRIPTION_ENGINE)).toMatchObject({
      providerId: "local-cli:claude", model: "claude-sonnet-5-5", liteModel: "claude-sonnet-5-5",
      ultrabrainProviderId: "local-cli:claude", ultrabrainModel: "claude-sonnet-5-5", ultrabrainReasoningEffort: "high",
      roleModels: Object.fromEntries(["deep", "build", "writer", "vision"].map((role) => [role, { provider: "local-cli:claude", model: "claude-sonnet-5-5", thinkingLevel: "high" }])),
      pixelModel: { provider: "local-cli:claude", model: "claude-sonnet-5-5", thinkingLevel: "high" },
    });
    expect(codex?.kind === "local-cli" && codex.engine).toMatchObject({ cli: "codex", routineModel: "gpt-6.2-sol", deepModel: "gpt-6.2-sol", effort: "medium" });
    expect(codex?.kind === "local-cli" && assistantEngineLead(codex.engine)).toBeUndefined();
  });

  it("skips API-key logins, env keys, expired and missing logins", () => {
    expect(planCandidates(
      [cli("claude", "ready", "api"), cli("codex", "login-required", "unknown"), cli("gemini", "not-installed", "unknown")],
      [oauth("openai-codex", { env: true }), oauth("google-antigravity", { expired: true }), oauth("openai-codex", { authKind: "apiKey" })],
    )).toEqual([]);
  });

  it("falls back to an in-app ChatGPT login when the Codex CLI is not signed in", () => {
    expect(planCandidates([], [oauth("openai-codex")]).map((plan) => plan.key)).toEqual(["codex-account"]);
    const next = configForPlanAccount<Parameters<typeof configForPlanAccount>[0]>({ providerId: "openai-codex", model: "gpt-6.1-sol", roleModels: { writer: { provider: "google-antigravity", model: "gemini-4-argon", thinkingLevel: "medium" } }, modelSelectionOverrides: { vision: true } }, "openai-codex");
    expect(next.model).toBe("gpt-6.2-sol");
    expect(next.ultrabrainModel).toBe("gpt-6.2-sol");
    expect(next.ultrabrainReasoningEffort).toBe("medium");
    expect(next.roleModels?.writer?.model).toBe("gpt-6.2-sol");
    expect(next.roleModels?.vision).toBeUndefined();
  });

  it("still gives a lead to a user who splits the models in settings, and drops it once they merge them", () => {
    // 나누기는 기본이 아니지만 설정에서 고를 수 있다(Opus 팀장 + Haiku 워커는 2026-11-16 까지의 기본이었다).
    const split = { ...CLAUDE_SUBSCRIPTION_ENGINE, routineModel: "claude-haiku-5-5", deepModel: "claude-opus-5-5", teamLead: true };
    expect(assistantEngineLead(split)).toEqual({ provider: "local-cli:claude", model: "claude-opus-5-5", thinkingLevel: "medium" });
    expect(assistantEngineLead({ ...split, deepModel: split.routineModel })).toBeUndefined();
    expect(assistantEngineLead({ ...split, teamLead: false })).toBeUndefined();
  });
});
