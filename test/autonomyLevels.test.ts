// Autonomy-level core model mapping: level id -> LLM/session knobs.
// Tests machine-consumed values (ids, resolution fields); metadata prose is
// only checked for presence, never pinned verbatim.
import { describe, expect, it } from "vitest";
import { AUTONOMY_LEVELS, resolveAutonomy, type AutonomyLevel } from "@/ai/autonomyLevels";

const LEVELS: readonly AutonomyLevel[] = ["confirm", "balanced", "autonomous", "max"];

describe("AUTONOMY_LEVELS", () => {
  it("covers every AutonomyLevel exactly once", () => {
    expect(AUTONOMY_LEVELS.map((entry) => entry.id).sort()).toEqual([...LEVELS].sort());
  });

  it("gives every level a non-empty label and description", () => {
    for (const entry of AUTONOMY_LEVELS) {
      expect(entry.label.trim().length).toBeGreaterThan(0);
      expect(entry.description.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("resolveAutonomy", () => {
  it("maps confirm to the most conservative knobs and plan-only", () => {
    expect(resolveAutonomy("confirm")).toEqual({
      reasoningEffort: "low",
      agentMode: "chat",
      budgetCap: 6,
      planOnly: true,
    });
  });

  it("maps balanced to low reasoning with auto planning", () => {
    expect(resolveAutonomy("balanced")).toEqual({
      reasoningEffort: "low",
      agentMode: "auto",
      budgetCap: 16,
      planOnly: false,
    });
  });

  it("maps autonomous to medium reasoning with a larger budget", () => {
    expect(resolveAutonomy("autonomous")).toEqual({
      reasoningEffort: "medium",
      agentMode: "auto",
      budgetCap: 32,
      planOnly: false,
    });
  });

  it("maps max to high reasoning with the full run budget", () => {
    expect(resolveAutonomy("max")).toEqual({
      reasoningEffort: "high",
      agentMode: "auto",
      budgetCap: 48,
      planOnly: false,
    });
  });

  it("keeps budgetCap strictly increasing with autonomy", () => {
    const caps = LEVELS.map((level) => resolveAutonomy(level).budgetCap);
    expect([...caps].sort((a, b) => a - b)).toEqual(caps);
    expect(new Set(caps).size).toBe(caps.length);
  });

  it("returns a fresh object per call", () => {
    const first = resolveAutonomy("balanced");
    first.budgetCap = -1;
    expect(resolveAutonomy("balanced").budgetCap).toBe(16);
  });
});
