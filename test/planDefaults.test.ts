import { describe, expect, it } from "vitest";
import { assistantEngineLead } from "../src/ai/localCliEngine";
import { CLAUDE_SUBSCRIPTION_ENGINE, configForPlanAccount, planCandidates } from "../src/ai/planDefaults";

const cli = (id: "claude" | "codex" | "gemini", state: string, billing: string) => ({ id, state, billing });
const oauth = (providerId: string, extra: Record<string, unknown> = {}) => ({ providerId, connected: true, authKind: "oauth", ...extra });

describe("first-run plan defaults", () => {
  it("orders Claude, then ChatGPT, then the rest, one card per plan", () => {
    const plans = planCandidates(
      [cli("gemini", "ready", "subscription"), cli("codex", "ready", "subscription"), cli("claude", "ready", "subscription")],
      [oauth("openai-codex"), oauth("google-antigravity")],
    );
    expect(plans.map((plan) => plan.key)).toEqual(["claude-cli", "codex-cli", "gemini-cli"]);
  });

  it("gives a Claude subscription an Opus lead over a Haiku worker, and ChatGPT Terra alone", () => {
    const [claude, codex] = planCandidates([cli("claude", "ready", "subscription"), cli("codex", "ready", "subscription")], []);
    expect(claude?.kind === "local-cli" && assistantEngineLead(claude.engine)).toEqual({ provider: "local-cli:claude", model: "claude-opus-5-5", thinkingLevel: "medium" });
    expect(claude?.kind === "local-cli" && claude.engine.routineModel).toBe("claude-haiku-5-5");
    expect(codex?.kind === "local-cli" && codex.engine).toMatchObject({ cli: "codex", routineModel: "gpt-6.1-terra", deepModel: "gpt-6.1-terra" });
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
    const next = configForPlanAccount({ providerId: "openai-codex", model: "gpt-6.1-sol", roleModels: { writer: { provider: "google-antigravity", model: "gemini-4-argon", thinkingLevel: "medium" } }, modelSelectionOverrides: { vision: true } }, "openai-codex");
    expect(next.model).toBe("gpt-6.1-terra");
    expect(next.ultrabrainModel).toBe("gpt-6.1-terra");
    expect(next.roleModels?.writer?.model).toBe("gpt-6.1-terra");
    expect(next.roleModels?.vision).toBeUndefined();
  });

  it("drops the lead once the user merges the roles in settings", () => {
    expect(assistantEngineLead({ ...CLAUDE_SUBSCRIPTION_ENGINE, deepModel: CLAUDE_SUBSCRIPTION_ENGINE.routineModel })).toBeUndefined();
    expect(assistantEngineLead({ ...CLAUDE_SUBSCRIPTION_ENGINE, teamLead: false })).toBeUndefined();
  });
});
