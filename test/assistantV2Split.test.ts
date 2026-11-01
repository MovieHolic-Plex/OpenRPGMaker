import { describe, expect, it } from "vitest";
import { leadPlanMessages, parseLeadReview, parseSplitConfig, parseSplitRole, planForWorker, toolCatalog } from "../src/ai/v2/split";

describe("assistant v2 lead/worker split", () => {
  it("reads the lead from OPRN_V2_SPLIT (local CLI and account/model forms)", () => {
    expect(parseSplitConfig("lead:claude:claude-opus-5-5:medium,worker:claude:claude-haiku-5-5:high")?.lead)
      .toEqual({ provider: "local-cli:claude", model: "claude-opus-5-5", effort: "medium" });
    expect(parseSplitConfig("lead:openai-compat:proxy8318/gemini-4-argon@medium")?.lead)
      .toEqual({ provider: "openai-compat:proxy8318", model: "gemini-4-argon", effort: "medium" });
    expect(parseSplitRole("claude:claude-haiku-5-5")).toEqual({ provider: "local-cli:claude", model: "claude-haiku-5-5" });
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
