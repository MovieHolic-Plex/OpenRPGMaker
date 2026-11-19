import { describe, expect, it } from "vitest";
import { vqaReviewerCandidates } from "@/ai/v2/judge/vqa";
import { familyOfProviderId } from "@/ai/assistantRoles";

// 2026-11-12 측정(Haiku 5.5 high 실행, GPT 할당량 없음 · Gemini CLI 는 그림을 못 봄): 다른 계열 검수자가 모두 답하지 못하자 Haiku 가 제 화면을 검수했다.
// 같은 계열의 검수용 모델(Sonnet)은 후보에 없었다. 지은 모델이 제 화면을 보는 것은 맨 마지막이어야 한다.
const order = (main: { provider: string; model: string }, keyed: string[] = [main.provider]) =>
  vqaReviewerCandidates({ main, keyed: new Set(keyed), familyOf: (id) => familyOfProviderId(id, [main.model]) }).map((p) => `${p.provider}/${p.model}${p.sameAsMain ? " (같은 계열)" : ""}`);

// 2026-11-16 실모델 확인 r7a(Opus 5.5 medium 실행, N6): 다른 계열이 답하지 못한 뒤의 Claude 검수자가 Sonnet 으로 박혀 있어 화면 검수 7번이 Sonnet 으로 갔다.
// 오너 결정 「조수는 Opus 5.5 medium」 — Claude 검수자는 Opus 5.5 · medium 이다. Opus 로 지으면 지은 모델과 검수 모델이 같다(«같은 계열 검수», 약한 증거).
const picks = (main: { provider: string; model: string }) =>
  vqaReviewerCandidates({ main, keyed: new Set([main.provider]), familyOf: (id) => familyOfProviderId(id, [main.model]) });

describe("화면 검수자 차례 — 자기 자신은 맨 마지막", () => {
  it("Haiku 가 지으면: 다른 계열(Codex · Gemini) → 같은 계열의 Opus 5.5 → Haiku 자신", () => {
    expect(order({ provider: "local-cli:claude", model: "claude-haiku-5-5" })).toEqual([
      "local-cli:codex/gpt-6.2-sol", "local-cli:gemini/gemini-4-argon",
      "local-cli:claude/claude-opus-5-5 (같은 계열)", "local-cli:claude/claude-haiku-5-5 (같은 계열)",
    ]);
  });

  it("Opus 5.5 가 지으면(출하 기본): 다른 계열 → Opus 5.5 · medium 한 번 — Sonnet 으로 가지 않고, 같은 모델을 두 번 넣지 않는다", () => {
    expect(order({ provider: "local-cli:claude", model: "claude-opus-5-5" })).toEqual([
      "local-cli:codex/gpt-6.2-sol", "local-cli:gemini/gemini-4-argon", "local-cli:claude/claude-opus-5-5 (같은 계열)",
    ]);
    const claude = picks({ provider: "local-cli:claude", model: "claude-opus-5-5" }).filter((p) => p.provider === "local-cli:claude");
    expect(claude).toEqual([{ provider: "local-cli:claude", model: "claude-opus-5-5", effort: "medium", sameAsMain: true }]);
  });

  it("Sonnet 이 지으면(사람이 고름): 같은 계열의 Opus 5.5 가 먼저, Sonnet 자신은 맨 끝", () => {
    const got = order({ provider: "local-cli:claude", model: "claude-sonnet-5-5" });
    expect(got.filter((p) => p.startsWith("local-cli:claude/"))).toEqual(["local-cli:claude/claude-opus-5-5 (같은 계열)", "local-cli:claude/claude-sonnet-5-5 (같은 계열)"]);
  });

  it("GPT 가 지으면(Terra): 다른 계열(Claude Opus 5.5 · Gemini)이 먼저, 같은 계열의 검수용 모델이 자기 자신 앞", () => {
    const got = order({ provider: "openai-codex", model: "gpt-6.2-sol" });
    expect(got.slice(0, 2)).toEqual(["local-cli:claude/claude-opus-5-5", "local-cli:gemini/gemini-4-argon"]);
    expect(got.slice(-2)).toEqual(["local-cli:codex/gpt-6.2-sol (같은 계열)", "openai-codex/gpt-6.2-sol (같은 계열)"]);
    expect(picks({ provider: "openai-codex", model: "gpt-6.2-sol" })[0]).toMatchObject({ model: "claude-opus-5-5", effort: "medium", sameAsMain: false });
  });

  it("다른 계열 후보에는 «같은 계열» 표시가 붙지 않고, 같은 계열 후보에는 늘 붙는다", () => {
    const picks = vqaReviewerCandidates({ main: { provider: "local-cli:claude", model: "claude-haiku-5-5" }, keyed: new Set(["local-cli:claude"]), familyOf: (id) => familyOfProviderId(id) });
    for (const p of picks) expect(p.sameAsMain).toBe(familyOfProviderId(p.provider) === "claude");
  });
});
