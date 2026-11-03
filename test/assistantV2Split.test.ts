import { describe, expect, it } from "vitest";
import { guardLeadChat, leadPlanMessages, parseLeadReview, parseSplitConfig, parseSplitRole, planForWorker, resolveSplitConfig, toolCatalog } from "../src/ai/v2/split";

describe("assistant v2 lead/worker split", () => {
  it("reads the lead from OPRN_V2_SPLIT (local CLI and account/model forms)", () => {
    expect(parseSplitConfig("lead:claude:claude-opus-5-5:medium,worker:claude:claude-haiku-5-5:high")?.lead)
      .toEqual({ provider: "local-cli:claude", model: "claude-opus-5-5", effort: "medium" });
    expect(parseSplitConfig("lead:openai-compat:proxy8318/gemini-4-argon@medium")?.lead)
      .toEqual({ provider: "openai-compat:proxy8318", model: "gemini-4-argon", effort: "medium" });
    expect(parseSplitRole("claude:claude-haiku-5-5")).toEqual({ provider: "local-cli:claude", model: "claude-haiku-5-5" });
  });

  it("uses the request lead only without OPRN_V2_SPLIT, and only a local-CLI lead", () => {
    const opus = { provider: "local-cli:claude", model: "claude-opus-5-5", thinkingLevel: "medium" };
    expect(resolveSplitConfig(undefined, opus)?.lead).toEqual({ provider: "local-cli:claude", model: "claude-opus-5-5", effort: "medium" });
    expect(resolveSplitConfig("", opus)?.lead.model).toBe("claude-opus-5-5");
    expect(resolveSplitConfig("off", opus)).toBeUndefined();
    expect(resolveSplitConfig("lead:openai-compat:proxy8318/gemini-4-argon@medium", opus)?.lead.model).toBe("gemini-4-argon");
    expect(resolveSplitConfig(undefined, { provider: "openai-codex", model: "gpt-6.1-sol" })).toBeUndefined();
    expect(resolveSplitConfig(undefined, undefined)).toBeUndefined();
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
