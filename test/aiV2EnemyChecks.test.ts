import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { enemyIdentityProblems } from "@/ai/v2/enemyChecks";
import { gameContentProblems } from "@/ai/v2/judge/gameChecks";
import { v2ExtraToolNames } from "@/ai/v2/request/readers";
import type { Project } from "@/project/types";

const WHOLE = "용사가 마왕을 잡으러 가는 짧은 RPG 만들어줘";

/** 이벤트 전투로 쓰이는 적 무리를 만든다 — foes: 이름 → 기술 이름들(기본 공격은 늘 있다). */
function battleProject(foes: Record<string, string[]>, boss?: { name: string; skills: string[] }): Project {
  const p = createBlankProject() as Project;
  const base = structuredClone(p.database.enemies[0]!) as unknown as Record<string, unknown>;
  const skillTemplate = structuredClone(p.database.skills[0]!) as unknown as Record<string, unknown>;
  const mkSkill = (id: string, name: string) => { if (!p.database.skills.some((s) => s.id === id)) p.database.skills.push({ ...skillTemplate, id, name } as never); };
  const all: [string, string[], boolean][] = [...Object.entries(foes).map(([n, s]) => [n, s, false] as [string, string[], boolean]), ...(boss ? [[boss.name, boss.skills, true] as [string, string[], boolean]] : [])];
  const map = p.maps[p.startMapId]!;
  all.forEach(([name, skills, isBoss], i) => {
    const skillIds = ["skill_attack", ...skills.map((s) => { mkSkill(`skill_x_${s}`, s); return `skill_x_${s}`; })];
    const enemyId = isBoss ? `enemy_boss_${i}` : `enemy_foe_${i}`;
    p.database.enemies.push({ ...base, id: enemyId, name, skillIds, actions: skillIds.map((skillId) => ({ skillId, priority: 5, condition: { kind: "always" } })) } as never);
    p.database.troops.push({ id: `troop_${i}`, name: isBoss ? `${name} 보스` : name, enemyIds: [enemyId], autoAlign: true, battleEventPages: [] } as never);
    map.events.push({ id: `ev_fight_${i}`, name: `전투 ${i}`, x: 2 + i, y: 3, pages: [{ ...structuredClone(map.events[0]?.pages?.[0] ?? {}), conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: `troop_${i}`, canEscape: true, canLose: false }] }] } as never);
  });
  return p;
}

describe("v2 enemy identity check (fs-use-tools E1)", () => {
  it("passes a game with no battles at all", () => {
    expect(enemyIdentityProblems(createBlankProject() as Project)).toEqual([]);
  });

  it("flags several ordinary foes whose skills are all the same, and clears once one differs", () => {
    const flat = battleProject({ 해골: ["맹독 이빨", "뼈 저주"], 갑옷: ["맹독 이빨", "뼈 저주"] });
    expect(enemyIdentityProblems(flat).filter((m) => m.includes("자기 기술이 없다"))).toHaveLength(1);
    const varied = battleProject({ 해골: ["맹독 이빨", "뼈 저주"], 갑옷: ["방패 밀치기"] });
    expect(enemyIdentityProblems(varied)).toEqual([]);
  });

  it("does not fire for a single ordinary foe kind", () => {
    expect(enemyIdentityProblems(battleProject({ 슬라임: [] }))).toEqual([]);
  });

  it("flags a boss that only has the basic attack, and clears once it has its own skill", () => {
    const flat = battleProject({}, { name: "마왕", skills: [] });
    expect(enemyIdentityProblems(flat).filter((m) => m.includes("자기 기술이 없다"))).toHaveLength(1);
    expect(enemyIdentityProblems(battleProject({}, { name: "마왕", skills: ["암흑 파동"] }))).toEqual([]);
  });

  it("checks each map on its own: a varied forest does not hide a demon castle whose foes share one skill set", () => {
    const p = battleProject({ 늑대: ["맹독 이빨"], 식물: ["수면 포자"], 임프: ["검격", "약화"], 기사: ["검격", "약화"] });
    const [forestA, forestB, demonA, demonB] = [0, 1, 2, 3].map((i) => p.maps[p.startMapId]!.events.find((e) => e.id === `ev_fight_${i}`)!);
    const castle = structuredClone(p.maps[p.startMapId]!) as typeof p.maps[string];
    castle.id = "map_castle"; castle.name = "마왕성"; castle.events = [demonA!, demonB!];
    p.maps[p.startMapId]!.events = p.maps[p.startMapId]!.events.filter((e) => [forestA, forestB].includes(e));
    p.maps.map_castle = castle;
    const msgs = enemyIdentityProblems(p);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("마왕성");
    expect(msgs[0]).toContain("임프");
  });

  it("flags a boss whose skills are all shared with the foes of its map, and clears once it owns one", () => {
    expect(enemyIdentityProblems(battleProject({ 해골: ["검격"], 갑옷: ["방패 밀치기"] }, { name: "마왕", skills: ["검격"] })).some((m) => m.includes("보스"))).toBe(true);
    expect(enemyIdentityProblems(battleProject({ 해골: ["검격"], 갑옷: ["방패 밀치기"] }, { name: "마왕", skills: ["검격", "암흑 파동"] }))).toEqual([]);
  });

  it("tells the model to fix it with upsert_enemy and names unused skills as candidates", () => {
    const p = battleProject({ 해골: ["맹독 이빨"], 갑옷: ["맹독 이빨"] });
    p.database.skills.push({ ...structuredClone(p.database.skills[0]!), id: "skill_spare_bolt", name: "여분 마법탄", scope: "enemy", power: 40 } as never);
    const msg = enemyIdentityProblems(p)[0] ?? "";
    expect(msg).toContain("upsert_enemy");
    expect(msg).toContain("skill_spare_bolt");
  });

  it("reaches the finish gate only for a whole-game request", () => {
    const after = battleProject({}, { name: "마왕", skills: [] });
    const before = createBlankProject() as Project;
    expect(gameContentProblems(before, after, WHOLE).some((m) => m.startsWith("[게임 검사 적 개성]"))).toBe(true);
    expect(gameContentProblems(before, after, "촌장 대사를 바꿔 줘").some((m) => m.startsWith("[게임 검사 적 개성]"))).toBe(false);
  });
});

describe("v2 whole-game tool exposure (fs-use-tools E1)", () => {
  it("offers the enemy and skill tools for an exploration game request that names no battle words", () => {
    const names = v2ExtraToolNames("귀여운 고양이가 주인공인 탐험 게임 만들어줘");
    for (const tool of ["upsert_enemy", "upsert_skill", "upsert_equipment"]) expect(names).toContain(tool);
  });
  it("does not offer them for a small map-only edit", () => {
    expect(v2ExtraToolNames("마을 지도 길을 넓혀줘")).not.toContain("upsert_enemy");
  });
});
