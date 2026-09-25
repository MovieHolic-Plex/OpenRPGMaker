// 도그푸딩 「등대지기의 겨울」: 생성된 보스(HP 280·공 22·민 16)가 Lv1 파티(HP 514)에게 4타 만에 쓰러지고
// 4~7 피해만 줬다(한 판은 한 번도 공격하지 않았다). 보스로 선언된 적은 시작 파티 기준 하한까지 올린다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { simulateBattle } from "@/battle/simulate";
import type { Project } from "@/project/types";

const WEAK_BOSS = {
  id: "enemy_blizzard_spirit", name: "눈보라 정령", monsterResourceId: "generated-enemy-sylph-air",
  stats: { maxHp: 280, maxMp: 50, attack: 22, defense: 18, mind: 25, agility: 16 },
  rewards: { exp: 80, gold: 120 },
};

function write(role?: "boss" | "normal", enemy: Record<string, unknown> = WEAK_BOSS): { project: Project; result: ReturnType<typeof runTool> } {
  const ctx = { project: createBlankProject() };
  const result = runTool(ctx, "upsert_enemy", { enemy, ...(role ? { role } : {}) });
  return { project: ctx.project, result };
}

function bossFight(project: Project) {
  project.database.troops.push({ id: "troop_boss", name: "보스", enemyIds: ["enemy_blizzard_spirit"], battleEventPages: [] } as never);
  const partyHp = 514 * project.session.partyActorIds.length;
  const sim = simulateBattle({ project, troopId: "troop_boss", heroLevel: 1, n: 20, seed: 7 });
  return { sim, partyHp };
}

describe("upsert_enemy role:boss scales a weak boss to the start party", () => {
  it("raises HP/attack/agility so the boss takes real HP but stays beatable", () => {
    const { project, result } = write("boss");
    expect(result.ok, result.summary).toBe(true);
    const enemy = project.database.enemies.find(entry => entry.id === "enemy_blizzard_spirit")!;
    expect(enemy.stats.maxHp).toBeGreaterThan(280);
    expect(enemy.stats.attack).toBeGreaterThan(22);
    expect(enemy.stats.agility).toBeGreaterThan(16);
    expect(result.summary).toContain("보스 위협 하한");
    expect(JSON.stringify(result)).toContain("attack 22→");
    const { sim } = bossFight(project);
    expect(sim.winRate).toBeGreaterThanOrEqual(0.85);
    const party = project.database.actors.filter(actor => project.session.partyActorIds.includes(actor.id));
    expect(party.length).toBeGreaterThan(0);
    // 파티가 실제로 HP 를 잃는다(예전 보스는 514 중 4~7).
    expect(sim.avgHpRemaining).toBeLessThan(514 * party.length * 0.85);
  });

  it("a boss id/name implies the role", () => {
    const { project } = write(undefined, { ...WEAK_BOSS, id: "enemy_boss_blizzard" });
    expect(project.database.enemies.find(entry => entry.id === "enemy_boss_blizzard")!.stats.attack).toBeGreaterThan(22);
  });

  it("never lowers authored stats and leaves normal enemies alone", () => {
    const strong = { ...WEAK_BOSS, stats: { maxHp: 99999, maxMp: 50, attack: 999, defense: 18, mind: 999, agility: 999 } };
    const { project: strongProject } = write("boss", strong);
    expect(strongProject.database.enemies.find(entry => entry.id === "enemy_blizzard_spirit")!.stats).toMatchObject(strong.stats);
    const { project, result } = write("normal");
    expect(project.database.enemies.find(entry => entry.id === "enemy_blizzard_spirit")!.stats).toMatchObject(WEAK_BOSS.stats);
    expect(result.summary).not.toContain("보스 위협 하한");
  });

  it("leaves no probe troop behind", () => {
    const { project } = write("boss");
    expect(project.database.troops.some(troop => troop.id.startsWith("__"))).toBe(false);
  });
});

describe("troop balance warning also flags a near-harmless troop", () => {
  it("warns when the troop only scratches the party", () => {
    const ctx = { project: createBlankProject() };
    runTool(ctx, "upsert_enemy", { enemy: WEAK_BOSS, role: "normal" });
    const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_weak", name: "약한 무리", enemyIds: ["enemy_blizzard_spirit"] } });
    expect(result.ok, result.summary).toBe(true);
    expect(JSON.stringify(result)).toContain("밸런스");
  });
});

describe("troop balance warning flags the other side — a troop the party cannot beat", () => {
  const BRUTE = {
    id: "enemy_brute", name: "광산 거인", monsterResourceId: "generated-enemy-golem-01",
    stats: { maxHp: 9000, maxMp: 10, attack: 400, defense: 300, mind: 50, agility: 90 },
    rewards: { exp: 10, gold: 10 },
  };

  it("warns with the joined party and a raised level when every run is a wipe", () => {
    const ctx = { project: createBlankProject() };
    runTool(ctx, "upsert_enemy", { enemy: BRUTE, role: "normal" });
    const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_brute", name: "거인 무리", enemyIds: ["enemy_brute"] } });
    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("전멸");
    const text = JSON.stringify(result.diff?.warnings ?? []);
    expect(text).toContain("Lv5");
    expect(text).toContain("partyActorIds");
  });

  it("does not warn for an ordinary troop the party beats with some damage", () => {
    const ctx = { project: createBlankProject() };
    const fair = { ...BRUTE, id: "enemy_fair", name: "코볼트", stats: { maxHp: 300, maxMp: 10, attack: 90, defense: 40, mind: 20, agility: 45 } };
    runTool(ctx, "upsert_enemy", { enemy: fair, role: "normal" });
    const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_fair", name: "코볼트", enemyIds: ["enemy_fair"] } });
    expect(JSON.stringify(result.diff?.warnings ?? [])).not.toContain("전멸");
  });
});
