import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

// 2026-11-10 treasure-0002(80분 측정): 길 위 전투 예산이 사본 무리 적의 maxHp 를 0.85 배씩 바닥(1)까지 깎아 미라 68→1, 동굴 거미 7→1 이 됐다.
// 능력치는 원래 값의 STAT_FLOOR(50%) 아래로 내리지 않고, 하한까지 내려도 기준을 못 맞추면 원래 값으로 되돌려 «맞추기 미완» 을 남긴다.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

const sim = vi.hoisted(() => ({ win: 0, loss: 0.9, turns: 12 }));

vi.mock("@/battle/simulate", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/battle/simulate")>();
  return { ...real, simulateBattle: () => ({ winRate: sim.win, avgHpRemaining: 1 - sim.loss, avgTurns: sim.turns }) };
});

import { fitPathBattlesIn, PATH_TROOP_PREFIX } from "@/ai/v2/story/pathBattleBudget";

function project(): Project {
  const p = createBlankProject() as Project;
  const mapId = p.startMapId;
  const map = p.maps[mapId]!;
  const troop = p.database.troops.find((t) => t.id === "troop_slime")!;
  const enemy = p.database.enemies.find((e) => e.id === troop.enemyIds[0])!;
  enemy.stats = { ...enemy.stats, maxHp: 68, attack: 20, mind: 10 };
  map.events = [...(map.events ?? []), {
    id: "ev_foe", name: "", x: 3, y: 3, trigger: { kind: "eventTouch" },
    pages: [{ id: "p0", name: "p0", conditions: [], trigger: { kind: "eventTouch" }, commands: [{ kind: "battleProcessing", troopId: troop.id, canEscape: true, canLose: false }] }],
  } as never];
  p.gameBlueprint = { request: "게임", title: "t", genre: "g", premise: "p", playerGoal: "g", steps: [{ id: "s1", place: map.name ?? mapId, event: "ev_foe", label: "l" }], ending: { name: "끝", how: "z", feeling: "w" } } as never;
  return p;
}

describe("path battle budget never grinds enemy stats to the floor", () => {
  it("restores the original stats and says the fit is incomplete when the floor cannot meet the budget", () => {
    sim.win = 0;
    sim.loss = 0.9;
    sim.turns = 12;
    const p = project();
    const counts = () => [p.database.troops.length, p.database.enemies.length, p.database.skills.length];
    const original = JSON.stringify(p.database.enemies.map((e) => [e.id, e.stats]));
    const rows = counts();
    const notes = fitPathBattlesIn(p);
    expect(notes.some((line) => line.includes("맞추기 미완"))).toBe(true);
    expect(counts()).toEqual(rows);
    expect(JSON.stringify(p.database.enemies.map((e) => [e.id, e.stats]))).toBe(original);
    expect(p.database.troops.some((t) => t.id.startsWith(PATH_TROOP_PREFIX))).toBe(false);
  });
});
