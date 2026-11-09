import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

// 2026-11-09 monster «terminated»: 끝맺음 assembly:ship-defaults 가 필수전투 모의전으로 워커 이벤트 루프를 414초 막았다.
// 맞춤에 시간 예산(FIT_BUDGET_MS)을 둔다. 끊기면 (1) 시험 중이던 상태를 바퀴 단위로 되돌리고 (2) applied 에 한 줄 남기고 (3) session 에 기록해
// 최종 보고가 읽는다(프로젝트 객체는 체크포인트에서 바뀌므로 기록은 세션에 둔다). 완료는 막지 않는다 — 모델이 풀 수 없다(ultrabrain 검토).
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

const state = vi.hoisted(() => ({ mode: "pass" as "pass" | "mutate-then-throw" }));

vi.mock("@/ai/v2/monsterRouteLevels", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/ai/v2/monsterRouteLevels")>();
  return {
    ...real,
    // 시험 한가운데서 예산이 터지는 경우를 흉내 낸다: 적 레벨을 시험값으로 바꾸고 던진다.
    fitGateLevelCurve: (project: Project) => {
      if (state.mode === "mutate-then-throw") {
        project.database.enemies[0]!.level = 99;
        project.database.troops[0]!.name = "시험 중 이름";
        throw new real.FitBudgetExceeded(61_000);
      }
      return [];
    },
  };
});

import { applyShipDefaults } from "@/ai/v2/shipDefaults";
import { shipBlockers } from "@/ai/v2/shipChecks";
import { stage as shipDefaultsStage } from "@/ai/v2/finish/stages/ship-defaults";
import { V2Session } from "@/ai/v2/verbs";
import { beginFitBudget, checkFitBudget, FIT_BUDGET_MS, FIT_INCOMPLETE_PREFIX, FitBudgetExceeded, fitBudgetExceeded, restoreFitState, snapshotFitState } from "@/ai/v2/monsterRouteLevels";

const WHOLE = "몬스터 수집 모험 게임";
function monsterish(): Project {
  const p = createBlankProject() as Project;
  p.gameBlueprint = { request: WHOLE, title: "새싹의 모험", genre: "모험", premise: "x", playerGoal: "y", steps: [], ending: { name: "끝", how: "z", feeling: "w" } } as never;
  p.database.enemies = [{ id: "e1", name: "적", level: 5, speciesId: "sp1" } as never];
  p.database.troops = [{ id: "t1", name: "부대", enemyIds: ["e1"] } as never];
  return p;
}

describe("fit budget", () => {
  it("throws once a begun budget is spent and keeps throwing for the rest of the call", () => {
    const p = createBlankProject() as Project;
    expect(FIT_BUDGET_MS).toBe(60_000);
    expect(() => checkFitBudget(p)).not.toThrow(); // 시작 안 한 프로젝트는 예산이 없다
    beginFitBudget(p, -1);
    expect(() => checkFitBudget(p)).toThrow(FitBudgetExceeded);
    expect(fitBudgetExceeded(p)).toBeGreaterThanOrEqual(0);
    expect(() => checkFitBudget(p)).toThrow(FitBudgetExceeded);
    beginFitBudget(p);
    expect(fitBudgetExceeded(p)).toBeUndefined();
    expect(new FitBudgetExceeded(61_000).message.startsWith(FIT_INCOMPLETE_PREFIX)).toBe(true);
  });
});

describe("snapshot / restore of what the fit touches", () => {
  it("brings back enemies, troops, species learnsets and map encounter tables/events, keeping the project object", () => {
    const p = monsterish();
    const mapId = Object.keys(p.maps)[0]!;
    const before = JSON.stringify([p.database.enemies, p.database.troops, p.database.monsterSpecies, p.maps[mapId]!.encounterTable, p.maps[mapId]!.events]);
    const snap = snapshotFitState(p);
    p.database.enemies[0]!.level = 99;
    p.database.enemies.push({ id: "e2", name: "시험 종", level: 1 } as never);
    p.database.troops[0]!.enemyIds = ["e2"];
    p.maps[mapId]!.encounterTable = [{ troopId: "t1", weight: 1, levelMin: 90, levelMax: 99 } as never];
    p.maps[mapId]!.events = [...(p.maps[mapId]!.events ?? []), { id: "ev_trial" } as never];
    const identity = p;
    restoreFitState(p, snap);
    expect(p).toBe(identity);
    expect(JSON.stringify([p.database.enemies, p.database.troops, p.database.monsterSpecies, p.maps[mapId]!.encounterTable, p.maps[mapId]!.events])).toBe(before);
  });
});

describe("applyShipDefaults when the budget cuts a round", () => {
  it("restores the half-tried state, says so in the applied list, and does not throw", () => {
    const p = monsterish();
    const enemiesBefore = JSON.stringify(p.database.enemies), troopsBefore = JSON.stringify(p.database.troops);
    state.mode = "mutate-then-throw";
    try {
      const applied = applyShipDefaults(p, WHOLE);
      expect(applied.some((line) => line.startsWith(FIT_INCOMPLETE_PREFIX))).toBe(true);
      expect(JSON.stringify(p.database.enemies)).toBe(enemiesBefore);
      expect(JSON.stringify(p.database.troops)).toBe(troopsBefore);
    } finally { state.mode = "pass"; }
  });
});

describe("the finish stage records the cut on the session and never blocks finishing", () => {
  it("keeps the record when the project object is replaced afterwards, and adds no ship blocker", () => {
    const p = monsterish();
    const session = new V2Session();
    const assembled: string[] = [];
    const events: { name?: string }[] = [];
    const env = { ctx: { project: p }, request: { task: WHOLE }, emit: (e: { name?: string }) => events.push(e) } as never;
    state.mode = "mutate-then-throw";
    try { shipDefaultsStage.run({ env, session, assembled, done: [], walked: [] } as never); } finally { state.mode = "pass"; }
    expect(session.fitIncomplete?.startsWith(FIT_INCOMPLETE_PREFIX)).toBe(true);
    expect(events.some((e) => e.name === "v2.fit.incomplete")).toBe(true);
    // 체크포인트·다시 읽기가 프로젝트 객체를 바꿔도 세션 기록은 남는다.
    const replaced = structuredClone(p);
    expect(session.fitIncomplete).toBeDefined();
    expect(shipBlockers(replaced, WHOLE).map((b) => b.id)).not.toContain("fit-budget");
  });
});
