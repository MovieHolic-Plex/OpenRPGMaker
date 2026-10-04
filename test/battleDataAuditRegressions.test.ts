import { afterEach, describe, expect, it } from "vitest";
import { charsetBattler } from "@/assets/charsetBattlers";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { registerExportAssetBase, registerInlineAssets } from "@/assets/inlineAssetStore";
import { RETRO_ROSTER_SKILLS } from "@/assets/retroRosterSkills";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults/blankProject";
import { ensureRetroRosterRecords } from "@/project/defaults/defaultDatabase";
import { deserialize, serialize } from "@/project/io";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { prepareWebExport } from "@/project/webExport";
import { exactWebExportEntries } from "@/project/webExportZip";
import type { VerifiedPlayerDeployment } from "@/project/playerDeploymentManifest";

afterEach(() => {
  registerExportAssetBase(null);
  registerInlineAssets(null);
});

describe("battle audit data dependencies", () => {
  it("backfills a coherent custom DB, preserving author rows through two reloads", () => {
    const project = createBlankProject();
    const actor = structuredClone(project.database.actors[0]!);
    const klass = structuredClone(project.database.classes.find((row) => row.id === actor.classId)!);
    const equipment = structuredClone(project.database.equipment.find((row) => row.id === "equip_focus_charm")!);
    const state = structuredClone(project.database.states.find((row) => row.id === "state_wet")!);
    const animation = structuredClone(project.database.battleAnimations[0]!);
    const element = structuredClone(project.database.elements!.find((row) => row.id === "fire")!);
    state.name = "저자의 젖음";
    state.runtimeEffects = { physicalDefenseMultiplier: 2 };
    animation.name = "저자의 기본 연출";
    delete animation.followUps;
    element.name = "저자의 불";
    element.damageMultipliers.A = 175;
    // Reuse bundled ids to prove a default row never replaces an authored override.
    actor.id = "actor_squire";
    actor.classId = "class_squire";
    actor.initialEquipment = { accessory: equipment.id };
    actor.learnedSkills = [];
    actor.stateRates = {};
    actor.elementRates = {};
    delete actor.unarmedAnimationId;
    actor.battleCharacterResourceId = "hero";
    klass.id = actor.classId;
    klass.skillIds = [];
    klass.learnedSkills = [];
    klass.equipmentPermissions = { actorIds: [], classIds: [], equipmentIds: [equipment.id] };
    klass.stateRates = {};
    klass.elementRates = {};
    delete klass.animationId;
    equipment.name = "저자의 집중 부적";
    equipment.statBonuses.mind = 37;
    equipment.equippableActorIds = [actor.id];
    equipment.equippableClassIds = [klass.id];
    equipment.attackElementIds = [];
    equipment.elementalDefenseIds = [];
    equipment.stateInflictIds = [];
    equipment.stateDefenseIds = [];
    delete equipment.skillId;
    delete equipment.usableAsItemSkillId;
    project.database.actors = [actor];
    project.database.classes = [klass];
    project.database.equipment = [equipment];
    project.database.skills = [];
    project.database.items = [];
    project.database.enemies = [];
    project.database.troops = [];
    project.database.states = [state];
    project.database.monsterSpecies = [];
    project.database.battleAnimations = [animation];
    project.database.elements = [element];
    project.system.startActorIds = [actor.id];
    delete project.system.initialTroopId;
    project.session.partyActorIds = [actor.id];
    project.session.inventory = {};
    for (const map of Object.values(project.maps)) { map.events = []; map.encounters = []; }
    expect(collectProjectReferenceIssues(project)).toEqual([]);
    expect(() => deserialize(serialize(project))).not.toThrow();
    expect(ensureRetroRosterRecords(project)).toBe(true);
    expect(project.database.actors[0]).toBe(actor);
    expect(project.database.classes[0]).toBe(klass);
    expect(project.database.equipment[0]).toBe(equipment);
    expect(project.database.states[0]).toBe(state);
    expect(project.database.battleAnimations[0]).toBe(animation);
    expect(project.database.elements[0]).toBe(element);
    expect(collectProjectReferenceIssues(project)).toEqual([]);
    const restored = deserialize(serialize(deserialize(serialize(project))));
    expect(collectProjectReferenceIssues(restored)).toEqual([]);
    expect(restored.database.equipment.find((row) => row.id === equipment.id)).toEqual(equipment);
    expect(restored.database.states.find((row) => row.id === state.id)).toEqual(state);
    expect(restored.database.battleAnimations.find((row) => row.id === animation.id)).toEqual(animation);
    expect(restored.database.elements!.find((row) => row.id === element.id)).toEqual(element);
    expect(restored.database.actors.find((row) => row.id === actor.id)?.battleCharacterResourceId).toBe("hero");
    expect(restored.system.startActorIds).toEqual([actor.id]);
    expect(ensureRetroRosterRecords(project)).toBe(false);
  });

  it.each(["skill_squire_triple_cut", "skill_noble_triple_thrust"])("resolves three actual damage attempts for %s", (id) => {
    const project = createBlankProject();
    const actor = project.database.actors[0]!;
    const enemy = project.database.enemies[0]!;
    const troop = project.database.troops[0]!;
    actor.initialEquipment = {};
    enemy.actions = [];
    enemy.stats = { ...enemy.stats, maxHp: 9999, defense: 1 };
    troop.enemyIds = [enemy.id];
    troop.members = [{ enemyId: enemy.id, x: 100, y: 100 }];
    troop.battleEventPages = [];
    const skill = project.database.skills.find((row) => row.id === id)!;
    skill.mpCost = { flat: 0, percentMax: 0 };
    skill.hitRate = 100;
    skill.successRate = 100;
    skill.variance = 0;
    skill.criticalRate = 0;
    const runtime = createBattleRuntime({
      project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
      party: { levels: { [actor.id]: 1 }, experience: {}, partyActorIds: [actor.id], skillIds: { [actor.id]: [id] } },
    });
    runtime.performActorCommand({ kind: "skill", skillId: id, targetEnemyId: "enemy-1" });
    const hits = runtime.snapshot().timeline.filter((entry) => entry.kind === "damage" && entry.userRecordId === actor.id && entry.targetId === "enemy-1");
    expect(hits).toHaveLength(3);
    expect(hits.every((entry) => entry.hit && (entry.amount ?? 0) > 0)).toBe(true);
  });

  it("leaves an ambiguous flurry single hit while authoring clear repeated attacks", () => {
    expect(RETRO_ROSTER_SKILLS.find((row) => row.id === "skill_dancer_ribbon_lash")?.mechanic?.hits).toHaveLength(3);
    expect(RETRO_ROSTER_SKILLS.find((row) => row.id === "skill_chimera_rampage")?.mechanic?.hits).toHaveLength(3);
    expect(RETRO_ROSTER_SKILLS.find((row) => row.id === "skill_gunner_spin_fire")?.mechanic?.hits).toBeUndefined();
  });

  it("includes a mage cast companion in ZIP entries and resolves nested/inline deployments", async () => {
    const project = createBlankProject();
    const mage = project.database.actors.find((row) => row.id === "actor_mage")!;
    const charset = charsetBattler(mage.battleCharacterResourceId)!;
    const prepared = prepareWebExport(project);
    const requests: string[] = [];
    const entries = await exactWebExportEntries(prepared, {
      bundleFiles: [], runtimeAssets: [],
    } as unknown as VerifiedPlayerDeployment, async (path) => {
      requests.push(path);
      return new TextEncoder().encode(`asset:${path}`);
    });
    expect(entries.some((entry) => entry.name === charset.path)).toBe(true);
    expect(entries.some((entry) => entry.name === charset.castPath)).toBe(true);
    expect(requests).toContain(`/${charset.castPath}`);
    const id = `${charset.resourceId}-cast`;
    registerExportAssetBase(new URL("https://example.test/games/mage/"));
    expect(resolveAssetResourceUrl(id, { project })).toBe(`https://example.test/games/mage/${charset.castPath}`);
    registerInlineAssets({ [charset.castPath]: "data:image/png;base64,AQ==" });
    expect(resolveAssetResourceUrl(id, { project })).toBe("data:image/png;base64,AQ==");
  });
});
