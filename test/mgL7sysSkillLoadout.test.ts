import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { normalizeActorRecord } from "@/project/actorModel";
import { equippedBattleSkillIds, toggleSkillLoadout } from "@/project/skillLoadout";
import { startSession } from "@/project/session";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import type { Project } from "@/project/types";

const LEARNED = ["skill_attack", "skill_sword_slash", "skill_fire", "skill_ice"] as const;

function loadoutProject(slots: number | undefined): Project {
  const project = createBlankProject();
  const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
  hero.learnedSkills = LEARNED.map((skillId) => ({ level: 1, skillId }));
  if (slots === undefined) delete hero.loadoutSlots;
  else hero.loadoutSlots = slots;
  return project;
}

function heroBattleSkills(project: Project, loadout?: readonly string[]): readonly string[] {
  const runtime = createBattleRuntime({
    project,
    troopId: "troop_slime",
    canEscape: true,
    canLose: true,
    battleFlow: "strict",
    sessionState: { switches: {}, variables: {}, inventory: {}, ...(loadout ? { actorSkillLoadouts: { actor_hero: loadout } } : {}) },
    party: { levels: { actor_hero: 1 }, experience: {}, partyActorIds: ["actor_hero"] },
  });
  return runtime.snapshot().actors.find((actor) => actor.id === "actor_hero")!.skillIds;
}

describe("actor skill loadout (#18)", () => {
  it("battle uses every learned skill when the actor has no loadout slots (legacy)", () => {
    // 직업이 주는 스킬도 함께 들어온다 — 장착 칸이 없으면 아무것도 걸러내지 않는다.
    const skills = heroBattleSkills(loadoutProject(undefined), ["skill_fire"]);
    expect(skills).toEqual(expect.arrayContaining([...LEARNED]));
    expect(skills.length).toBeGreaterThan(LEARNED.length - 1);
  });

  it("battle offers only the equipped skills when the actor has loadout slots", () => {
    const project = loadoutProject(2);
    expect(heroBattleSkills(project, ["skill_ice", "skill_attack"])).toEqual(["skill_ice", "skill_attack"]);
    // 장착하지 않은 첫 전투는 배운 순서(데이터베이스 순서) 앞에서부터 칸 수만큼.
    expect(heroBattleSkills(project)).toEqual(["skill_attack", "skill_sword_slash"]);
    // 배우지 않은 스킬은 장착 목록에 있어도 쓰지 못한다.
    expect(heroBattleSkills(project, ["skill_heal", "skill_fire"])).toEqual(["skill_fire"]);
  });

  it("toggleSkillLoadout equips up to the slot count and unequips on the second toggle", () => {
    const project = loadoutProject(2);
    const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
    const session = startSession(project, 1);
    session.actorSkillLoadouts = { actor_hero: [] };
    expect(toggleSkillLoadout(session, hero, [...LEARNED], "skill_fire")).toMatchObject({ ok: true, equipped: true });
    expect(toggleSkillLoadout(session, hero, [...LEARNED], "skill_ice")).toMatchObject({ ok: true, equipped: true });
    expect(toggleSkillLoadout(session, hero, [...LEARNED], "skill_attack")).toEqual({ ok: false, reason: "full" });
    expect(toggleSkillLoadout(session, hero, [...LEARNED], "skill_fire")).toMatchObject({ ok: true, equipped: false });
    expect(session.actorSkillLoadouts.actor_hero).toEqual(["skill_ice"]);
    expect(toggleSkillLoadout(session, hero, [...LEARNED], "skill_heal")).toEqual({ ok: false, reason: "notLearned" });
  });

  it("the menu skill screen toggles loadout and reports the equipped count", () => {
    const project = loadoutProject(2);
    const session = startSession(project, 1);
    const toggled: string[] = [];
    const detail = () => createStatusMenuDetail({
      project, session, selectedCommand: "skills", slots: [], waitModeEnabled: true,
      skillActorId: "actor_hero",
      onToggleSkillLoadout: (actorId, skillId) => {
        toggled.push(skillId);
        const hero = project.database.actors.find((actor) => actor.id === actorId)!;
        toggleSkillLoadout(session, hero, project.database.skills.filter((skill) => (LEARNED as readonly string[]).includes(skill.id)).map((skill) => skill.id), skillId);
      },
    });
    const first = detail();
    expect(first.title).toContain("(2/2)");
    const equippedRows = first.entries.filter((entry) => entry.attributes?.loadoutEquipped === "true").map((entry) => entry.testId);
    expect(equippedRows).toEqual(["status-menu-skill-actor_hero-skill_attack", "status-menu-skill-actor_hero-skill_sword_slash"]);
    first.entries.find((entry) => entry.testId === "status-menu-skill-actor_hero-skill_attack")!.onActivate!();
    expect(toggled).toEqual(["skill_attack"]);
    expect(detail().title).toContain("(1/2)");
    expect(equippedBattleSkillIds({ loadoutSlots: 2 }, [...LEARNED], session.actorSkillLoadouts?.actor_hero)).toEqual(["skill_sword_slash"]);
  });

  it("keeps loadoutSlots through actor normalize / project serialize and loadouts through save/load", () => {
    const project = loadoutProject(3);
    expect(normalizeActorRecord(project.database.actors[0]!).loadoutSlots).toBe(3);
    expect(normalizeActorRecord({ ...project.database.actors[0]!, loadoutSlots: 99 }).loadoutSlots).toBe(12);
    expect("loadoutSlots" in normalizeActorRecord(loadoutProject(undefined).database.actors[0]!)).toBe(false);
    const reloaded = deserialize(serialize(project));
    expect(reloaded.database.actors.find((actor) => actor.id === "actor_hero")!.loadoutSlots).toBe(3);

    const session = startSession(project, 1);
    session.actorSkillLoadouts = { actor_hero: ["skill_fire"] };
    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.actorSkillLoadouts).toEqual({ actor_hero: ["skill_fire"] });
  });
});
