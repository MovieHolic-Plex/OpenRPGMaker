// Autonomy-level core model mapping: level id -> LLM/session knobs.
// Tests machine-consumed values (ids, resolution fields); metadata prose is
// only checked for presence, never pinned verbatim.
import { describe, expect, it } from "vitest";
import { AUTONOMY_LEVELS, resolveAutonomy, type AutonomyLevel } from "@/ai/autonomyLevels";

const LEVELS: readonly AutonomyLevel[] = ["readonly", "confirm", "balanced", "autonomous", "max"];

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
  // Break: the readonly level is the only manual way to force the session's ask
  // rail once the composer mode chips are gone. Dropping readOnly (or the level
  // itself) silently gives every turn write tools.
  it("maps readonly to the ask rail with no planning", () => {
    expect(resolveAutonomy("readonly")).toEqual({
      reasoningEffort: "low",
      agentMode: "chat",
      budgetCap: 4,
      piMaxTurns: 50,
      planOnly: false,
      readOnly: true,
    });
  });

  it("maps confirm to the most conservative writing knobs and plan-only", () => {
    expect(resolveAutonomy("confirm")).toEqual({
      reasoningEffort: "low",
      agentMode: "chat",
      budgetCap: 6,
      piMaxTurns: 50,
      planOnly: true,
      readOnly: false,
    });
  });

  it("maps balanced to low reasoning with auto planning", () => {
    expect(resolveAutonomy("balanced")).toEqual({
      reasoningEffort: "low",
      agentMode: "auto",
      budgetCap: 16,
      piMaxTurns: 200,
      planOnly: false,
      readOnly: false,
    });
  });

  it("maps autonomous to medium reasoning with a larger budget", () => {
    expect(resolveAutonomy("autonomous")).toEqual({
      reasoningEffort: "medium",
      agentMode: "auto",
      budgetCap: 32,
      piMaxTurns: 300,
      planOnly: false,
      readOnly: false,
    });
  });

  it("maps max to high reasoning with the full run budget", () => {
    expect(resolveAutonomy("max")).toEqual({
      reasoningEffort: "high",
      agentMode: "auto",
      budgetCap: 48,
      piMaxTurns: 600,
      planOnly: false,
      readOnly: false,
    });
  });

  // Break: marking a writing level readOnly would strip its write tools; marking
  // readonly writable would defeat the level. Only readonly may be read-only.
  it("marks exactly one level read-only", () => {
    const readOnly = LEVELS.filter((level) => resolveAutonomy(level).readOnly);
    expect(readOnly).toEqual(["readonly"]);
  });

  it("keeps budgetCap strictly increasing with autonomy", () => {
    const caps = LEVELS.map((level) => resolveAutonomy(level).budgetCap);
    expect([...caps].sort((a, b) => a - b)).toEqual(caps);
    expect(new Set(caps).size).toBe(caps.length);
  });

  // 2026-09-17 실측: budgetCap 이 그대로 Pi 의 `maxTurns` 로 실려서 「균형」(16턴)이 다이얼을
  // **안 건드린 것**(워커 기본값 40턴)보다 나빴다. 7번의 턴 상한 중단 중 4번이 이 조합이었다.
  // 다이얼을 고르는 행위가 안 고르는 것보다 나쁜 결과를 내면 그건 컨트롤이 아니다.
  const WORKER_DEFAULT_MAX_TURNS = 200; // scripts/lib/piAgentRuntime.ts
  it("실행하는 레벨의 턴 상한은 워커 기본값 아래로 내려가지 않는다", () => {
    for (const level of LEVELS) {
      const resolved = resolveAutonomy(level);
      if (resolved.readOnly || resolved.planOnly) continue; // 짓지 않는 레벨엔 짓는 예산이 필요 없다
      expect(resolved.piMaxTurns, level).toBeGreaterThanOrEqual(WORKER_DEFAULT_MAX_TURNS);
    }
  });

  // Break: 둘을 다시 한 숫자로 합치면 위 결함이 그대로 돌아온다. 한 턴은 모델 왕복 한 번이고
  // 그 안에서 도구를 여러 번 부르므로, 도구 예산과 턴 예산은 같은 수일 이유가 없다.
  it("턴 예산과 도구 호출 예산은 다른 값이다", () => {
    const executing = LEVELS.filter((level) => !resolveAutonomy(level).readOnly && !resolveAutonomy(level).planOnly);
    expect(executing.length).toBeGreaterThan(0);
    for (const level of executing) {
      const { budgetCap, piMaxTurns } = resolveAutonomy(level);
      expect(piMaxTurns, level).not.toBe(budgetCap);
    }
  });

  it("keeps piMaxTurns non-decreasing with autonomy", () => {
    const turns = LEVELS.map((level) => resolveAutonomy(level).piMaxTurns);
    expect([...turns].sort((a, b) => a - b)).toEqual(turns);
  });

  it("returns a fresh object per call", () => {
    const first = resolveAutonomy("balanced");
    first.budgetCap = -1;
    expect(resolveAutonomy("balanced").budgetCap).toBe(16);
  });
});
