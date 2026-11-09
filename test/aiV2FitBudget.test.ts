import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

// 2026-11-09 monster «terminated»: 끝맺음 assembly:ship-defaults 가 필수전투 모의전으로 워커 이벤트 루프를 414초 막았다.
// 맞춤에 시간 예산(FIT_BUDGET_MS)을 두고, 넘으면 멈추되 침묵하지 않는다 — applied 한 줄 + 출하 검사 fit-budget.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

vi.mock("@/ai/v2/monsterRouteLevels", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/ai/v2/monsterRouteLevels")>();
  return {
    ...real,
    // 예산을 넘긴 모의전을 흉내 낸다 — 진짜 던지는 쪽은 아래 «budget state» 시험이 따로 본다.
    fitRequiredBattlesToStarters: (project: Project) => { throw new real.FitBudgetExceeded(61_000); void project; },
  };
});

import { applyShipDefaults } from "@/ai/v2/shipDefaults";
import { editorDefaultsLeft } from "@/ai/v2/shipChecks";
import { beginFitBudget, FIT_BUDGET_MS, FitBudgetExceeded, fitBudgetExceeded } from "@/ai/v2/monsterRouteLevels";

describe("fit budget state", () => {
  it("is unset until a fit exceeds it and is cleared by the next beginFitBudget", () => {
    const p = createBlankProject() as Project;
    expect(fitBudgetExceeded(p)).toBeUndefined();
    beginFitBudget(p, 0);
    expect(fitBudgetExceeded(p)).toBeUndefined();
    expect(FIT_BUDGET_MS).toBe(60_000);
    expect(new FitBudgetExceeded(61_000).message).toContain("required-battle fit incomplete (budget");
  });
});

describe("applyShipDefaults when the fit is cut by the budget", () => {
  it("does not throw and says so in the applied list", () => {
    const p = createBlankProject() as Project;
    p.gameBlueprint = { request: "몬스터 수집 모험 게임", title: "새싹의 모험", genre: "모험", premise: "x", playerGoal: "y", steps: [], ending: { name: "끝", how: "z", feeling: "w" } } as never;
    const applied = applyShipDefaults(p, "몬스터 수집 모험 게임");
    expect(applied.some((line) => line.includes("required-battle fit incomplete (budget"))).toBe(true);
  });
});

describe("ship check fit-budget", () => {
  it("is raised only after a fit exceeded its budget and cleared by the next begin (never silently passes)", async () => {
    const real = await vi.importActual<typeof import("@/ai/v2/monsterRouteLevels")>("@/ai/v2/monsterRouteLevels");
    const p = createBlankProject() as Project;
    expect(editorDefaultsLeft(p).map((b) => b.id)).not.toContain("fit-budget");
    real.beginFitBudget(p, -1); // 한도 -1ms: 어떤 새 모의전도 시작 전에 초과로 본다
    expect(() => real.checkFitBudget(p)).toThrow(/required-battle fit incomplete \(budget/);
    expect(real.fitBudgetExceeded(p)).toBeGreaterThanOrEqual(0);
    expect(() => real.checkFitBudget(p)).toThrow(); // 초과 뒤 남은 시뮬도 모두 멈춘다
    const found = editorDefaultsLeft(p).find((b) => b.id === "fit-budget");
    expect(found?.message).toContain("required-battle fit incomplete (budget)");
    real.beginFitBudget(p);
    expect(editorDefaultsLeft(p).map((b) => b.id)).not.toContain("fit-budget");
  });
});
