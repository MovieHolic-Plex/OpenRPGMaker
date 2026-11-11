import { describe, expect, it } from "vitest";
import { guardLeadChat, leadForRequest, leadPlanMessages, parseLeadReview, parseSplitConfig, parseSplitRole, planForWorker, resolveSplitConfig, toolCatalog } from "../src/ai/v2/turn/split";

describe("assistant v2 lead/worker split", () => {
  it("reads the lead from OPRN_V2_SPLIT (local CLI and account/model forms)", () => {
    expect(parseSplitConfig("lead:claude:claude-opus-5-5:medium,worker:claude:claude-haiku-5-5:high")?.lead)
      .toEqual({ provider: "local-cli:claude", model: "claude-opus-5-5", effort: "medium" });
    expect(parseSplitConfig("lead:openai-compat:proxy8318/gemini-4-argon@medium")?.lead)
      .toEqual({ provider: "openai-compat:proxy8318", model: "gemini-4-argon", effort: "medium" });
    expect(parseSplitRole("claude:claude-haiku-5-5")).toEqual({ provider: "local-cli:claude", model: "claude-haiku-5-5" });
  });

  it("uses the request lead only without OPRN_V2_SPLIT: local CLI, custom endpoint or registry account", () => {
    const opus = { provider: "local-cli:claude", model: "claude-opus-5-5", thinkingLevel: "medium" };
    expect(resolveSplitConfig(undefined, opus)?.lead).toEqual({ provider: "local-cli:claude", model: "claude-opus-5-5", effort: "medium" });
    expect(resolveSplitConfig("", opus)?.lead.model).toBe("claude-opus-5-5");
    expect(resolveSplitConfig("off", opus)).toBeUndefined();
    expect(resolveSplitConfig("lead:openai-compat:proxy8318/gemini-4-argon@medium", opus)?.lead.model).toBe("gemini-4-argon");
    expect(resolveSplitConfig(undefined, { provider: "openai-compat:proxy8318", model: "gemini-4-argon", thinkingLevel: "high" })?.lead)
      .toEqual({ provider: "openai-compat:proxy8318", model: "gemini-4-argon", effort: "high" });
    expect(resolveSplitConfig(undefined, { provider: "anthropic", model: "claude-opus-5-5", thinkingLevel: "medium" })?.lead)
      .toEqual({ provider: "anthropic", model: "claude-opus-5-5", effort: "medium" });
    expect(resolveSplitConfig(undefined, { provider: "openrouter", model: "openai/gpt-5.5" })?.lead).toEqual({ provider: "openrouter", model: "openai/gpt-5.5" });
    expect(resolveSplitConfig("lead:claude:claude-opus-5-5", { provider: "anthropic", model: "claude-opus-5-5" })?.lead.provider).toBe("local-cli:claude");
    expect(resolveSplitConfig("off", { provider: "anthropic", model: "claude-opus-5-5" })).toBeUndefined();
    expect(resolveSplitConfig(undefined, { provider: "made-up", model: "x" })).toBeUndefined();
    expect(resolveSplitConfig(undefined, { provider: "anthropic", model: "  " })).toBeUndefined();
    expect(resolveSplitConfig(undefined, undefined)).toBeUndefined();
  });

  it("carries a request lead on another account; the engine lead only on its own engine", () => {
    const claudeLead = { provider: "anthropic", model: "claude-opus-5-5", thinkingLevel: "medium" };
    const cliLead = { provider: "local-cli:claude", model: "claude-opus-5-5", thinkingLevel: "medium" };
    const none = () => undefined;
    expect(leadForRequest({ provider: "openai-codex", lead: claudeLead }, none)).toBe(claudeLead);
    expect(leadForRequest({ provider: "local-cli:claude", assistantVersion: "v2" }, () => cliLead)).toBe(cliLead);
    expect(leadForRequest({ provider: "openai-codex", assistantVersion: "v2" }, () => cliLead)).toBeUndefined();
    expect(leadForRequest({ provider: "local-cli:claude" }, () => cliLead)).toBeUndefined();
    expect(leadForRequest({ provider: "openai-codex", lead: { provider: "made-up", model: "x", thinkingLevel: "medium" } }, none)).toBeUndefined();
  });

  it("turns the lead off for the run after one model/plan failure, so the worker continues alone", async () => {
    const replies = ["API Error: 400 unknown provider for model claude-opus-5-5", "TODO\n1. never reached"];
    let calls = 0;
    const lead = guardLeadChat(async () => replies[calls++]!);
    await expect(lead([])).rejects.toThrow(/unknown provider/u);
    await expect(lead([])).rejects.toThrow(/disabled for this run/u);
    expect(calls).toBe(1);
    const plan = "TODO\n1. Add the clue event\nSPECS\n1. the model of the lock is not found in the room yet.";
    await expect(guardLeadChat(async () => plan)([])).resolves.toBe(plan);
  });

  it("stays off without a lead", () => {
    expect(parseSplitConfig(undefined)).toBeUndefined();
    expect(parseSplitConfig("0")).toBeUndefined();
    expect(parseSplitConfig("worker:claude:claude-haiku-5-5")).toBeUndefined();
    expect(parseSplitConfig("lead:nonsense")).toBeUndefined();
  });

  it("parses the lead review; an unreadable reply never blocks the run", () => {
    expect(parseLeadReview('```json\n{"approve": false, "fixes": ["Event 자물쇠: count wrong tries"]}\n```')).toEqual({ approve: false, fixes: ["Event 자물쇠: count wrong tries"] });
    expect(parseLeadReview('{"approve": true, "fixes": ["ignored"]}')).toEqual({ approve: true, fixes: [] });
    const bad = parseLeadReview("looks fine to me");
    expect(bad.approve).toBe(true);
    expect(bad.fixes).toEqual([]);
    expect(bad.problem).toMatch(/no JSON/u);
    expect(parseLeadReview(`{"approve": false, "fixes": [${Array.from({ length: 9 }, (_, i) => `"f${i}"`).join(",")}]}`).fixes).toHaveLength(5);
  });

  it("keeps model-facing text in English and the user's request verbatim", () => {
    const messages = leadPlanMessages({ task: "「자물쇠」를 조사하면 4자리 숫자를 입력", digest: "Map m1 «서재» 10x8", tools: toolCatalog([{ name: "add_event", description: "Add or edit one event. More text." }], ["author_puzzle_chain"]) });
    expect(messages[0]!.content).toMatch(/^You are the LEAD designer/u);
    expect(messages[1]!.content).toContain("「자물쇠」를 조사하면 4자리 숫자를 입력");
    expect(messages[1]!.content).toContain("- add_event: Add or edit one event.");
    expect(messages[1]!.content).toContain("author_puzzle_chain");
    expect(planForWorker("TODO\n1. lock")).toMatch(/^\[Lead plan/u);
  });
});
