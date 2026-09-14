/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { battleSkillMpCost } from "@/battle/battleSkillUse";
import {
  resolveBattleTargets,
  targetScopeForCommand,
  type BattleTargetScope,
} from "@/battle/battleTargetResolver";
import type { BattleBattlerSnapshot } from "@/battle/types";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { mountBattleScene } from "@/player/battleDom";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject(): Project {
  return deserialize(JSON.stringify(battleFixture));
}

function target(id: string, name = id): BattleBattlerSnapshot {
  return {
    id,
    recordId: id,
    name,
    hp: 100,
    maxHp: 100,
    mp: 20,
    maxMp: 20,
    gauge: 0,
    defeated: false,
    defending: false,
    pose: "idle",
    stateIds: [],
    skillIds: [],
  };
}

function addSecondActor(project: Project): void {
  const source = project.database.actors[0];
  if (!source) throw new Error("missing fixture actor");
  const ally = JSON.parse(JSON.stringify(source)) as typeof source;
  ally.id = "actor_ally";
  ally.name = "동료";
  ally.learnedSkills = [];
  ally.initialEquipment = {};
  project.database.actors.push(ally);
  project.system.startActorIds = [source.id, ally.id];
  project.session.partyActorIds = [source.id, ally.id];
}

function clearLearnedSkills(project: Project): void {
  for (const actor of project.database.actors) actor.learnedSkills = [];
  for (const klass of project.database.classes) klass.learnedSkills = [];
}

function addSkill(
  project: Project,
  options: {
    id: string;
    scope: BattleTargetScope;
    effect?: "damage" | "healing" | "support";
    mpFlat?: number;
    mpPercent?: number;
    hitRate?: number;
    stateEffects?: readonly { stateId: string; chance: number; operation: "add" | "remove" }[];
  },
): void {
  const effect = options.effect ?? "damage";
  project.database.skills = project.database.skills.filter((skill) => skill.id !== options.id);
  project.database.skills.push(normalizeSkillRecord({
    id: options.id,
    name: options.id,
    scope: options.scope,
    power: effect === "healing" ? 40 : effect === "damage" ? 25 : 0,
    mpCost: { flat: options.mpFlat ?? 0, percentMax: options.mpPercent ?? 0 },
    successRate: 100,
    variance: 0,
    hitRate: options.hitRate ?? 100,
    effect: effect === "healing"
      ? { kind: "healing", statistic: "mind", affects: "hp" }
      : effect === "damage"
        ? { kind: "damage", statistic: "attack", affects: "hp" }
        : { kind: "support" },
    stateEffects: options.stateEffects ? [...options.stateEffects] : [],
  }));
}

function duplicateSlime(project: Project): void {
  const troop = project.database.troops.find((entry) => entry.id === "troop_slime");
  if (!troop) throw new Error("missing fixture troop");
  troop.enemyIds = ["enemy_slime", "enemy_slime"];
  troop.members = [
    { enemyId: "enemy_slime", x: 80, y: 90, hidden: false },
    { enemyId: "enemy_slime", x: 120, y: 90, hidden: false },
  ];
  const slime = project.database.enemies.find((entry) => entry.id === "enemy_slime");
  if (slime) slime.stats = { ...slime.stats, maxHp: 9_999 };
}

function untilActorCommand(runtime: ReturnType<typeof createBattleRuntime>): void {
  for (let index = 0; index < 200; index += 1) {
    runtime.tick(1_000);
    const snapshot = runtime.snapshot();
    if (snapshot.phase === "actorCommand" || snapshot.result) return;
  }
  throw new Error("actor command phase was not reached");
}

function pressKey(key: string, targetNode: Window | HTMLElement = window): void {
  targetNode.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("battle target resolver contracts", () => {
  const actorA = target("actor-a");
  const actorB = target("actor-b");
  const enemyA = target("enemy-a");
  const enemyB = target("enemy-b");
  const actors = [actorA, actorB];
  const enemies = [enemyA, enemyB];

  it.each([
    ["actor", actorA, "self", undefined, "actor", ["actor-a"], false],
    ["actor", actorA, "ally", "actor-b", "actor", ["actor-b"], true],
    ["actor", actorA, "allAllies", undefined, "actor", ["actor-a", "actor-b"], false],
    ["actor", actorA, "enemy", "enemy-b", "enemy", ["enemy-b"], true],
    ["actor", actorA, "allEnemies", undefined, "enemy", ["enemy-a", "enemy-b"], false],
    ["enemy", enemyA, "self", undefined, "enemy", ["enemy-a"], false],
    ["enemy", enemyA, "ally", "enemy-b", "enemy", ["enemy-b"], true],
    ["enemy", enemyA, "allAllies", undefined, "enemy", ["enemy-a", "enemy-b"], false],
    ["enemy", enemyA, "enemy", "actor-b", "actor", ["actor-b"], true],
    ["enemy", enemyA, "allEnemies", undefined, "actor", ["actor-a", "actor-b"], false],
  ] as const)(
    "%s caster preserves %s scope",
    (_caster, user, scope, requestedTargetId, side, expectedIds, requiresSelection) => {
      const result = resolveBattleTargets({ scope, user, actors, enemies, requestedTargetId });
      expect(result.side).toBe(side);
      expect(result.targets.map((entry) => entry.id)).toEqual(expectedIds);
      expect(result.requiresSelection).toBe(requiresSelection);
    },
  );

  it("keeps authored scope authoritative instead of inferring it from effect kind", () => {
    const project = battleProject();
    addSkill(project, { id: "skill_damage_ally", scope: "ally", effect: "damage" });
    addSkill(project, { id: "skill_heal_enemy", scope: "enemy", effect: "healing" });

    expect(targetScopeForCommand(project, { kind: "skill", skillId: "skill_damage_ally" })).toBe("ally");
    expect(targetScopeForCommand(project, { kind: "skill", skillId: "skill_heal_enemy" })).toBe("enemy");
  });
});

describe("shared MP validation and target UI", () => {
  it("uses one exact flat-plus-percent MP formula and rejects direct invalid calls as no-ops", () => {
    const project = battleProject();
    const fire = project.database.skills.find((skill) => skill.id === "skill_fire");
    if (!fire) throw new Error("missing fixture skill");
    fire.mpCost = { flat: 3, percentMax: 10 };
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: {
        levels: { actor_hero: 1 },
        experience: {},
        vitals: { actor_hero: { hp: 500, mp: 0 } },
        skillIds: { actor_hero: ["skill_fire"] },
        partyActorIds: ["actor_hero"],
      },
      rng: () => 0.5,
    });
    untilActorCommand(runtime);
    const before = runtime.snapshot();
    expect(battleSkillMpCost(fire, before.actors[0]?.maxMp ?? 0)).toBe(
      3 + Math.floor(((before.actors[0]?.maxMp ?? 0) * 10) / 100),
    );

    runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });
    runtime.performActorCommand({ kind: "skill", skillId: "missing_skill", targetEnemyId: "enemy-1" });

    const after = runtime.snapshot();
    expect(after.phase).toBe("actorCommand");
    expect(after.actors[0]?.mp).toBe(before.actors[0]?.mp);
    expect(after.enemies[0]?.hp).toBe(before.enemies[0]?.hp);
    expect(after.actionLog).toHaveLength(before.actionLog.length);
    expect(after.timeline).toHaveLength(before.timeline.length);
  });

  it("keeps insufficient skills on the cursor path and shows the cost reason on the row", () => {
    vi.useFakeTimers();
    const project = battleProject();
    clearLearnedSkills(project);
    const fire = project.database.skills.find((skill) => skill.id === "skill_fire");
    if (!fire) throw new Error("missing fixture skill");
    fire.mpCost = { flat: 4, percentMax: 25 };
    store.replace(project);
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: {
        levels: { actor_hero: 1 },
        experience: {},
        vitals: { actor_hero: { hp: 500, mp: 0 } },
        skillIds: { actor_hero: ["skill_fire"] },
        partyActorIds: ["actor_hero"],
      },
      rng: () => 0.5,
    });
    const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
    untilActorCommand(runtime);
    vi.advanceTimersByTime(250);

    const button = controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-skill']");
    const actor = runtime.snapshot().actors[0];
    const cost = battleSkillMpCost(fire, actor?.maxMp ?? 0);
    // `disabled` 가 아니라 `aria-disabled` 다 — 커서가 서야 사유를 읽는다(적대 리뷰 #3).
    expect(button?.disabled).toBe(false);
    expect(button?.getAttribute("aria-disabled")).toBe("true");
    expect(button?.dataset.battleCommandInert).toBe("true");
    // 키보드 전용 포인터 계약: 네이티브 title 툴팁은 마우스 어포던스이므로 금지다.
    // 사유와 필요 MP 는 aria-label 과 **눈에 보이는 사유 줄** 양쪽으로 전달한다
    // (battleSkillUseFailureLabel: "MP 부족 (필요 N / 현재 M)").
    expect(button?.title ?? "").toBe("");
    expect(button?.getAttribute("aria-label")).toContain(`필요 ${cost}`);
    expect(button?.getAttribute("aria-label")).toContain("MP 부족");
    expect(button?.textContent ?? "").toContain("MP 부족");

    // 커서는 비활성 행을 건너뛰지 않는다. 확인키를 눌러도 아무 일이 일어나지 않는다.
    const phaseBefore = runtime.snapshot().phase;
    const visited: string[] = [];
    for (let step = 0; step < 8; step += 1) {
      const cursor = controller.root.querySelector<HTMLButtonElement>("[data-battle-command-cursor='true']");
      if (cursor?.dataset.testid) visited.push(cursor.dataset.testid);
      if (cursor?.dataset.testid === "actor-command-skill") break;
      pressKey("ArrowDown");
    }
    expect(visited).toContain("actor-command-skill");
    pressKey("Enter");
    expect(runtime.snapshot().phase).toBe(phaseBefore);
    controller.destroy();
  });

  it.each([
    { skin: "classic", spriteCount: 0 },
    { skin: "rm2003", spriteCount: 2 },
  ] as const)("selects allies through the shared menu cursor and restores the skill submenu on cancel ($skin)", ({ skin, spriteCount }) => {
    vi.useFakeTimers();
    const project = battleProject();
    addSecondActor(project);
    addSkill(project, { id: "skill_ally_heal", scope: "ally", effect: "healing" });
    // 대상 메뉴는 아군을 숨기는 정면식과 표시하는 측면식에서 모두 동작한다.
    project.system.battleUiStyle = skin;
    store.replace(project);
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      activeSlots: 2,
      party: {
        levels: { actor_hero: 1, actor_ally: 1 },
        experience: {},
        skillIds: { actor_hero: ["skill_ally_heal"] },
        partyActorIds: ["actor_hero", "actor_ally"],
      },
      rng: () => 0.5,
    });
    const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
    untilActorCommand(runtime);
    vi.advanceTimersByTime(250);

    controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-skill']")?.click();
    controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-skill-skill_ally_heal']")?.click();

    expect(runtime.snapshot().targetSelection?.side).toBe("actor");
    expect(runtime.snapshot().targetSelection?.targetIds).toHaveLength(2);
    expect(controller.root.querySelectorAll(".battle-actor[data-battle-targetable='true']")).toHaveLength(spriteCount);
    expect(controller.root.querySelectorAll(".battle-actor-status")).toHaveLength(2);
    expect(controller.root.querySelectorAll(".battle-target-menu [data-battle-target-id]")).toHaveLength(2);

    const first = runtime.snapshot().targetSelection?.selectedTargetId;
    pressKey("ArrowRight");
    const second = runtime.snapshot().targetSelection?.selectedTargetId;
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    expect((document.activeElement as HTMLElement | null)?.dataset.battleTargetId).toBe(second);

    pressKey("Escape");
    expect(runtime.snapshot().phase).toBe("actorCommand");
    expect(controller.root.querySelector("[data-testid='actor-skill-skill_ally_heal']")).toBeTruthy();
    controller.destroy();
  });

  // 이 테스트는 예전에 "Enter 는 루트에서 아무 것도 하지 않고 네이티부 click 에 맡긴다" 를
  // 단정하고, 버라이지가 들려준다는 그 click 을 직접 `attack.click()` 로 흔들어 맞추었다.
  // 실밌우저에서는 그 click 이 안 뜰다(실측: 전투 커맨드 버튼에 포커스를 주고 Enter 를
  // 눌러도 click 이벤트가 아예 없었다). 그래서 이 단정이 곰 Enter 확정을 전투 메뉴에서만
  // 죽여 둔 결함을 가려 준 샘이었다. 진짜 계약은 "Enter 한 번 = 확정 한 번" 이다.
  it("confirms once on Enter and does not double-dispatch with the click path", () => {
    vi.useFakeTimers();
    const project = battleProject();
    store.replace(project);
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
    const begin = vi.spyOn(runtime, "beginActorCommand");
    const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
    untilActorCommand(runtime);
    vi.advanceTimersByTime(250);
    const attack = controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-attack']");
    attack?.focus();

    if (!attack) throw new Error("missing attack button");
    // Enter 한 번에 확정 한 번. preventDefault 가 네이티부 활성화를 막으므로
    // 루트/윈도우 핸들러가 직접 처리해도 이중 발화가 없다.
    pressKey("Enter", attack);
    expect(begin).toHaveBeenCalledTimes(1);
    controller.destroy();
  });
});

describe("AUTO and ordered timeline contracts", () => {
  it("prioritizes forced switch, then recovery, then an affordable attack, and never returns an item", () => {
    const forcedProject = battleProject();
    addSecondActor(forcedProject);
    const forced = createBattleRuntime({
      project: forcedProject,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      activeSlots: 1,
      battleFlow: "strict",
      party: {
        levels: { actor_hero: 1, actor_ally: 1 },
        experience: {},
        vitals: { actor_hero: { hp: 0, mp: 0 } },
        partyActorIds: ["actor_hero", "actor_ally"],
      },
      rng: () => 0.5,
    });
    expect(forced.chooseAutoCommand()).toEqual({ kind: "switch", targetActorId: "actor_ally" });

    const recoveryProject = battleProject();
    clearLearnedSkills(recoveryProject);
    addSkill(recoveryProject, { id: "skill_auto_heal", scope: "self", effect: "healing" });
    addSkill(recoveryProject, { id: "skill_auto_attack", scope: "enemy", effect: "damage" });
    const recovery = createBattleRuntime({
      project: recoveryProject,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: {
        levels: { actor_hero: 1 },
        experience: {},
        vitals: { actor_hero: { hp: 1, mp: 999 } },
        skillIds: { actor_hero: ["skill_auto_heal", "skill_auto_attack"] },
        partyActorIds: ["actor_hero"],
      },
      rng: () => 0.5,
    });
    const recoveryCommand = recovery.chooseAutoCommand();
    expect(recoveryCommand?.kind).toBe("skill");
    expect(recoveryCommand?.kind === "skill" && recoveryCommand.skillId).toBe("skill_auto_heal");
    expect(recoveryCommand?.kind === "skill" && recoveryCommand.targetActorId).toBe("actor_hero");

    const attack = createBattleRuntime({
      project: recoveryProject,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: {
        levels: { actor_hero: 1 },
        experience: {},
        skillIds: { actor_hero: ["skill_auto_heal", "skill_auto_attack"] },
        partyActorIds: ["actor_hero"],
      },
      rng: () => 0.5,
    });
    const attackCommand = attack.chooseAutoCommand();
    expect(attackCommand?.kind).toBe("skill");
    expect(attackCommand?.kind === "skill" && attackCommand.skillId).toBe("skill_auto_attack");
    expect(attackCommand?.kind).not.toBe("item");
  });

  it("uses injected RNG only to resolve equally scored AUTO targets", () => {
    const project = battleProject();
    clearLearnedSkills(project);
    duplicateSlime(project);
    const create = (rng: () => number) => createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: { levels: { actor_hero: 1 }, experience: {}, skillIds: { actor_hero: [] }, partyActorIds: ["actor_hero"] },
      rng,
    });

    expect(create(() => 0).chooseAutoCommand()).toEqual({ kind: "attack", targetEnemyId: "enemy-1" });
    expect(create(() => 0.999).chooseAutoCommand()).toEqual({ kind: "attack", targetEnemyId: "enemy-2" });
  });

  it("filters ineffective enemy healing and uses HP utility with injected RNG only for target ties", () => {
    const invalidHealProject = battleProject();
    addSkill(invalidHealProject, { id: "skill_enemy_heal", scope: "ally", effect: "healing" });
    addSkill(invalidHealProject, { id: "skill_enemy_hit", scope: "enemy", effect: "damage" });
    const enemy = invalidHealProject.database.enemies.find((entry) => entry.id === "enemy_slime");
    if (!enemy) throw new Error("missing fixture enemy");
    enemy.stats = { ...enemy.stats, maxHp: 9_999, maxMp: 999, agility: 999 };
    enemy.actions = [
      { skillId: "skill_enemy_heal", priority: 100, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } },
      { skillId: "skill_enemy_hit", priority: 1, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } },
    ];
    const invalidHeal = createBattleRuntime({
      project: invalidHealProject,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      rng: () => 0.5,
    });
    for (let index = 0; index < 100 && !invalidHeal.snapshot().timeline.some((entry) => entry.side === "enemy"); index += 1) {
      invalidHeal.tick(1_000);
    }
    expect(invalidHeal.snapshot().timeline.find((entry) => entry.side === "enemy")?.skillName).toBe("skill_enemy_hit");

    const targetProject = battleProject();
    addSecondActor(targetProject);
    addSkill(targetProject, { id: "skill_enemy_target", scope: "enemy", effect: "damage" });
    const targetEnemy = targetProject.database.enemies.find((entry) => entry.id === "enemy_slime");
    if (!targetEnemy) throw new Error("missing fixture enemy");
    targetEnemy.stats = { ...targetEnemy.stats, maxHp: 9_999, maxMp: 999, agility: 999 };
    targetEnemy.actions = [
      { skillId: "skill_enemy_target", priority: 1, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } },
    ];
    const targeted = createBattleRuntime({
      project: targetProject,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      activeSlots: 2,
      party: {
        levels: { actor_hero: 1, actor_ally: 1 },
        experience: {},
        vitals: { actor_hero: { hp: 999, mp: 0 }, actor_ally: { hp: 1, mp: 0 } },
        partyActorIds: ["actor_hero", "actor_ally"],
      },
      rng: () => 0.5,
    });
    for (let index = 0; index < 100 && !targeted.snapshot().timeline.some((entry) => entry.side === "enemy"); index += 1) {
      targeted.tick(1_000);
    }
    expect(targeted.snapshot().timeline.find((entry) => entry.side === "enemy")?.targetId).toBe("actor_ally");

    const tied = (rng: () => number) => createBattleRuntime({
      project: targetProject,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      activeSlots: 2,
      party: {
        levels: { actor_hero: 1, actor_ally: 1 },
        experience: {},
        partyActorIds: ["actor_hero", "actor_ally"],
      },
      rng,
    });
    const first = tied(() => 0);
    const second = tied(() => 0.999);
    for (let index = 0; index < 100; index += 1) {
      if (!first.snapshot().timeline.some((entry) => entry.side === "enemy")) first.tick(1_000);
      if (!second.snapshot().timeline.some((entry) => entry.side === "enemy")) second.tick(1_000);
    }
    expect(first.snapshot().timeline.find((entry) => entry.side === "enemy")?.targetId).toBe("actor_hero");
    expect(second.snapshot().timeline.find((entry) => entry.side === "enemy")?.targetId).toBe("actor_ally");
  });

  it("records double attack plus attack-all as one append-only ordered fact per hit", () => {
    const project = battleProject();
    duplicateSlime(project);
    const sword = project.database.equipment.find((entry) => entry.id === "equip_sword");
    if (!sword) throw new Error("missing fixture equipment");
    sword.effectFlags = { ...sword.effectFlags, doubleAttack: true, attackAll: true };
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      party: {
        levels: { actor_hero: 1 },
        experience: {},
        equipment: { actor_hero: { weapon: "equip_sword" } },
        partyActorIds: ["actor_hero"],
      },
      rng: () => 0.5,
    });
    untilActorCommand(runtime);
    const start = runtime.snapshot().timeline.length;

    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

    const snapshot = runtime.snapshot();
    const hits = snapshot.timeline.slice(start).filter((entry) => entry.side === "actor" && entry.commandKind === "attack");
    expect(hits.map((entry) => entry.targetId)).toEqual(["enemy-1", "enemy-2", "enemy-1", "enemy-2"]);
    expect(snapshot.timeline.map((entry) => entry.sequence)).toEqual(snapshot.timeline.map((_, index) => index));
  });

  it("applies an all-allies item to every ally but consumes it exactly once", () => {
    const project = battleProject();
    addSecondActor(project);
    const item = project.database.items.find((entry) => entry.id === "item_bomb");
    if (!item) throw new Error("missing fixture item");
    item.scope = "allAllies";
    item.type = "medicine";
    item.occasion = "battle";
    item.occasionBattle = true;
    item.consumable = true;
    item.skillId = undefined;
    item.activateSkillId = undefined;
    item.hpRecovery = { flat: 10, percentMax: 0 };
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      activeSlots: 2,
      sessionState: { switches: {}, variables: {}, inventory: { item_bomb: 2 } },
      party: {
        levels: { actor_hero: 1, actor_ally: 1 },
        experience: {},
        vitals: { actor_hero: { hp: 1, mp: 0 }, actor_ally: { hp: 1, mp: 0 } },
        partyActorIds: ["actor_hero", "actor_ally"],
      },
      rng: () => 0.5,
    });
    untilActorCommand(runtime);
    const start = runtime.snapshot().timeline.length;

    runtime.performActorCommand({
      kind: "item",
      itemId: "item_bomb",
      targetEnemyId: "actor_hero",
      targetActorId: "actor_hero",
    });

    const snapshot = runtime.snapshot();
    const healing = snapshot.timeline.slice(start).filter((entry) => entry.kind === "healing");
    expect(healing.map((entry) => entry.targetId)).toEqual(["actor_hero", "actor_ally"]);
    expect(snapshot.eventState.inventory.item_bomb).toBe(1);
  });

  it("records miss, state add/remove, and switch facts in append order", () => {
    const stateProject = battleProject();
    clearLearnedSkills(stateProject);
    addSkill(stateProject, { id: "skill_miss", scope: "enemy", effect: "damage", hitRate: 0 });
    addSkill(stateProject, {
      id: "skill_state_cycle",
      scope: "enemy",
      effect: "support",
      stateEffects: [
        { stateId: "state_burn", chance: 100, operation: "add" },
        { stateId: "state_burn", chance: 100, operation: "remove" },
      ],
    });
    const miss = createBattleRuntime({
      project: stateProject,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      party: {
        levels: { actor_hero: 1 },
        experience: {},
        skillIds: { actor_hero: ["skill_miss"] },
        partyActorIds: ["actor_hero"],
      },
      rng: () => 0.5,
    });
    untilActorCommand(miss);
    miss.performActorCommand({ kind: "skill", skillId: "skill_miss", targetEnemyId: "enemy-1" });
    expect(miss.snapshot().timeline.at(-1)?.kind).toBe("miss");

    const states = createBattleRuntime({
      project: stateProject,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      party: {
        levels: { actor_hero: 1 },
        experience: {},
        skillIds: { actor_hero: ["skill_state_cycle"] },
        partyActorIds: ["actor_hero"],
      },
      rng: () => 0.5,
    });
    untilActorCommand(states);
    states.performActorCommand({ kind: "skill", skillId: "skill_state_cycle", targetEnemyId: "enemy-1" });
    expect(states.snapshot().timeline.slice(-3).map((entry) => entry.kind)).toEqual(["action", "stateAdded", "stateRemoved"]);

    const switchProject = battleProject();
    addSecondActor(switchProject);
    const switching = createBattleRuntime({
      project: switchProject,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      activeSlots: 1,
      party: {
        levels: { actor_hero: 1, actor_ally: 1 },
        experience: {},
        partyActorIds: ["actor_hero", "actor_ally"],
      },
      rng: () => 0.5,
    });
    untilActorCommand(switching);
    switching.performActorCommand({ kind: "switch", targetActorId: "actor_ally" });
    expect(switching.snapshot().timeline.at(-1)).toMatchObject({ kind: "switch", targetId: "actor_ally", success: true });
  });

  it("includes upkeep, incapacitation, actor action, and enemy action in the strict round timeline", () => {
    const project = battleProject();
    addSecondActor(project);
    const burn = project.database.states.find((state) => state.id === "state_burn");
    if (!burn) throw new Error("missing fixture state");
    burn.runtimeEffects = { ...burn.runtimeEffects, hpDamagePercentPerTurn: 10 };
    project.database.states.push({
      ...JSON.parse(JSON.stringify(burn)) as typeof burn,
      id: "state_stun",
      name: "기절",
      runtimeEffects: { ...burn.runtimeEffects, hpDamagePercentPerTurn: 0, restrictsAction: true },
    });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      activeSlots: 2,
      battleFlow: "strict",
      party: {
        levels: { actor_hero: 1, actor_ally: 1 },
        experience: {},
        stateIds: { actor_hero: ["state_burn"], actor_ally: ["state_stun"] },
        partyActorIds: ["actor_hero", "actor_ally"],
      },
      rng: () => 0.5,
    });

    expect(runtime.snapshot().timeline.map((entry) => entry.kind)).toEqual(expect.arrayContaining(["stateUpkeep", "incapacitated"]));
    runtime.performActorCommand({ kind: "defend" });
    const round = runtime.snapshot().roundLogs[0];
    expect(round?.timeline.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining(["stateUpkeep", "incapacitated", "action", "damage"]),
    );
    expect(round?.timeline.map((entry) => entry.sequence)).toEqual(
      [...(round?.timeline ?? [])].map((entry) => entry.sequence).sort((left, right) => left - right),
    );
  });

  it("finalizes a strict round log when setup detects a terminal state before commands", () => {
    const project = battleProject();
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: {
        levels: { actor_hero: 1 },
        experience: {},
        vitals: { actor_hero: { hp: 0, mp: 0 } },
        partyActorIds: ["actor_hero"],
      },
      rng: () => 0.5,
    });

    const snapshot = runtime.snapshot();
    expect(snapshot.result).toBe("defeat");
    expect(snapshot.turn).toBe(1);
    expect(snapshot.roundLogs).toHaveLength(1);
    expect(snapshot.roundLogs[0]?.result).toBe("defeat");
    expect(snapshot.roundLogs[0]?.timeline).toEqual([]);
  });

  it("continues the same strict round after a forced switch", () => {
    const project = battleProject();
    addSecondActor(project);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      activeSlots: 1,
      battleFlow: "strict",
      party: {
        levels: { actor_hero: 1, actor_ally: 1 },
        experience: {},
        vitals: { actor_hero: { hp: 0, mp: 0 } },
        partyActorIds: ["actor_hero", "actor_ally"],
      },
      rng: () => 0.5,
    });

    expect(runtime.snapshot()).toMatchObject({
      strictRound: 1,
      forcedSwitchActorId: "actor_hero",
      activeActorId: "actor_hero",
    });
    runtime.performActorCommand({ kind: "switch", targetActorId: "actor_ally" });
    expect(runtime.snapshot()).toMatchObject({
      phase: "actorCommand",
      strictRound: 1,
      activeActorId: "actor_ally",
      roundLogs: [],
    });

    runtime.performActorCommand({ kind: "defend" });
    const round = runtime.snapshot().roundLogs[0];
    expect(round?.round).toBe(1);
    expect(round?.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "switch", targetId: "actor_ally" }),
        expect.objectContaining({ kind: "action", commandKind: "defend" }),
      ]),
    );
    expect(round?.participatingActorIds).toEqual(expect.arrayContaining(["actor_hero", "actor_ally"]));
  });
});
