import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { actorBattlers } from "@/battle/battleBattlers";
import { createBattleRuntime } from "@/battle/runtime";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { normalizeActorPatch, normalizeActorRecord } from "@/project/actorModel";
import { normalizeDatabaseRecords, normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import { startSession } from "@/project/session";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { ACTOR, battleCase, mark, variables } from "./battleEventRepairFlow.fixture";
import { acknowledge, eventPause } from "./battleEventSequential.fixture";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";

// RM2003 전투 세 가지(2026-10-02): 이도류 2회 공격, 공통 이벤트를 부르는 전투 명령, 배우별 명령 목록.

function strictProject(): Project {
  return deserialize(JSON.stringify(strictFixture));
}

describe("배우별 전투 명령 (ActorRecord.battleCommandIds)", () => {
  function withGlobalCommands(project: Project): void {
    project.database.battleCommands = [
      { id: "cmd_steal", name: "훔치기", kind: "skill", skillId: "skill_fire" },
      { id: "cmd_pray", name: "기도", kind: "commonEvent", commonEventId: "ce_pray" },
    ];
    project.commonEvents.push({ id: "ce_pray", name: "기도", trigger: "none", commands: [] });
  }

  it("배우 목록이 직업 명령을 대신하고, 순서를 지킨다", () => {
    const project = strictProject();
    withGlobalCommands(project);
    const actor = project.database.actors.find((record) => record.id === ACTOR)!;
    expect(battleCommandsForActor(project, ACTOR).map((command) => command.id)).toEqual(["cmd_attack", "cmd_guard", "cmd_escape"]);
    actor.battleCommandIds = ["cmd_pray", "cmd_attack", "cmd_steal"];
    expect(battleCommandsForActor(project, ACTOR).map((command) => [command.id, command.kind])).toEqual([
      ["cmd_pray", "commonEvent"], ["cmd_attack", "attack"], ["cmd_steal", "skill"],
    ]);
  });

  it("전역·직업 어디에도 없는 id 는 「공격」으로 둔갑하지 않고 빠진다", () => {
    const project = strictProject();
    withGlobalCommands(project);
    project.database.actors.find((record) => record.id === ACTOR)!.battleCommandIds = ["cmd_deleted", "cmd_steal"];
    expect(battleCommandsForActor(project, ACTOR).map((command) => command.id)).toEqual(["cmd_steal"]);
  });

  it("전투 중 이벤트로 바꾼 명령이 배우 목록보다 앞선다", () => {
    const project = strictProject();
    withGlobalCommands(project);
    project.database.actors.find((record) => record.id === ACTOR)!.battleCommandIds = ["cmd_steal"];
    expect(battleCommandsForActor(project, ACTOR, { overrideCommandIds: ["cmd_escape"] }).map((command) => command.id)).toEqual(["cmd_escape"]);
  });

  it("공통 이벤트가 지워진 연결 명령은 메뉴에서 빠진다", () => {
    const project = strictProject();
    withGlobalCommands(project);
    project.commonEvents = project.commonEvents.filter((entry) => entry.id !== "ce_pray");
    project.database.actors.find((record) => record.id === ACTOR)!.battleCommandIds = ["cmd_pray", "cmd_attack"];
    expect(battleCommandsForActor(project, ACTOR).map((command) => command.id)).toEqual(["cmd_attack"]);
  });

  it("정규화: 빈 값·중복을 걷고 7개까지, 비면 필드 자체를 뺀다", () => {
    const base = strictProject().database.actors[0]!;
    expect(normalizeActorRecord({ ...base, battleCommandIds: [" a ", "a", "", "b", "c", "d", "e", "f", "g", "h"] }).battleCommandIds)
      .toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    expect("battleCommandIds" in normalizeActorRecord({ ...base, battleCommandIds: [] })).toBe(false);
    expect(normalizeActorPatch({ battleCommandIds: [] })).toEqual({ battleCommandIds: undefined });
  });

  it("정규화: 전역·직업 명령의 commonEvent 종류와 commonEventId 가 「공격」으로 떨어지지 않는다", () => {
    const project = strictProject();
    project.database.battleCommands = [{ id: "cmd_pray", name: "기도", kind: "commonEvent", commonEventId: "ce_pray" }];
    project.database.classes[0]!.battleCommands = [{ id: "cmd_x", name: "특수", kind: "commonEvent", commonEventId: "ce_pray" }];
    const normalized = normalizeDatabaseRecords(project.database);
    expect(normalized.battleCommands?.[0]).toMatchObject({ kind: "commonEvent", commonEventId: "ce_pray" });
    expect(normalized.classes[0]!.battleCommands[0]).toMatchObject({ kind: "commonEvent", commonEventId: "ce_pray" });
  });
});

describe("이도류 (attackHits)", () => {
  function setup(options: { readonly dualWield: boolean; readonly offTwoHanded?: boolean; readonly doubleAttackMain?: boolean }) {
    const project = strictProject();
    const sword = normalizeEquipmentRecord({ id: "eq_sword", name: "검", slot: "weapon", effectFlags: { doubleAttack: options.doubleAttackMain ?? false } as never });
    const dagger = normalizeEquipmentRecord({ id: "eq_dagger", name: "단검", slot: "weapon", twoHanded: options.offTwoHanded ?? false });
    project.database.equipment = [sword, dagger];
    const actor = project.database.actors.find((record) => record.id === ACTOR)!;
    actor.options = { ...actor.options, dualWield: options.dualWield };
    return project;
  }
  const hitsOf = (project: Project, equipment: Record<string, string>) =>
    actorBattlers(project, { partyActorIds: [ACTOR], equipment: { [ACTOR]: equipment } })[0]!.equipmentEffects?.attackHits;

  it("한손 무기 둘 = 두 번 친다", () => {
    expect(hitsOf(setup({ dualWield: true }), { weapon: "eq_sword", shield: "eq_dagger" })).toBe(2);
  });
  it("무기 하나 = 한 번, 「2회 공격」 무기를 함께 들면 그 무기만 두 번", () => {
    expect(hitsOf(setup({ dualWield: true }), { weapon: "eq_sword" })).toBe(1);
    expect(hitsOf(setup({ dualWield: true, doubleAttackMain: true }), { weapon: "eq_sword", shield: "eq_dagger" })).toBe(3);
  });
  it("이도류가 아니면 방패 칸의 무기는 무시된다(장착 규칙이 걸러 1회)", () => {
    expect(hitsOf(setup({ dualWield: false }), { weapon: "eq_sword", shield: "eq_dagger" })).toBe(1);
  });
});

for (const flow of ["gauge", "strict"] as const) describe(`공통 이벤트 전투 명령 / ${flow}`, () => {
  it("고르면 그 공통 이벤트가 돌고, 문장은 트룹 이벤트와 같은 정지·재개를 탄다", () => {
    const { project, runtime } = battleCase({ flow, commands: [] });
    project.commonEvents.push({
      id: "ce_pray", name: "기도", trigger: "none",
      commands: [mark("first"), { kind: "text", body: "신에게 기도했다" }, mark("second")],
    });
    runtime.performActorCommand({ kind: "commonEvent", commonEventId: "ce_pray" });
    expect(variables(runtime).first).toBe(1);
    expect(variables(runtime).second ?? 0, "문장이 끝나기 전에는 다음 명령이 돌면 안 된다").toBe(0);
    const pause = eventPause(runtime);
    assert.equal(pause.kind, "text");
    expect(pause.body).toBe("신에게 기도했다");
    acknowledge(runtime, pause.id, { kind: "text" });
    expect(variables(runtime).second).toBe(1);
    expect(runtime.snapshot().eventLogs.some((log) => log.pageId === "command-common-event:ce_pray" && log.kind === "fired")).toBe(true);
  });

  it("없는 공통 이벤트를 부르는 명령은 거부된다", () => {
    const { runtime } = battleCase({ flow, commands: [] });
    const before = runtime.snapshot();
    runtime.performActorCommand({ kind: "commonEvent", commonEventId: "ce_missing" });
    expect(runtime.snapshot().activeActorId).toBe(before.activeActorId);
    expect(runtime.snapshot().phase).toBe("actorCommand");
  });
});

describe("「전투 명령 변경」(m2-092) 더하기·빼기는 지금 메뉴 위에서 한다", () => {
  const run = (project: Project, session: ReturnType<typeof startSession>, fields: Record<string, string>) =>
    executeM2RuntimeCommand(session, m2CommandById("m2-092-change-battle-commands")!, {
      commandId: "m2-092-change-battle-commands", fields: { target: ACTOR, slots: "", ...fields },
    }, { project });

  it("처음 더하면 직업 명령 뒤에 붙는다(공격·방어가 사라지지 않는다)", () => {
    const project = strictProject();
    project.database.battleCommands = [{ id: "cmd_pray", name: "기도", kind: "commonEvent", commonEventId: "ce_pray" }];
    const session = startSession(project);
    run(project, session, { operation: "add", value: "cmd_pray" });
    expect(session.actorBattleCommands?.[ACTOR]).toEqual(["cmd_attack", "cmd_guard", "cmd_escape", "cmd_pray"]);
  });

  it("처음 빼면 직업 명령에서 그 명령만 빠진다", () => {
    const project = strictProject();
    const session = startSession(project);
    run(project, session, { operation: "remove", value: "cmd_guard" });
    expect(session.actorBattleCommands?.[ACTOR]).toEqual(["cmd_attack", "cmd_escape"]);
  });

  it("배우 고유 목록이 있으면 그 목록이 출발점이다", () => {
    const project = strictProject();
    project.database.actors.find((record) => record.id === ACTOR)!.battleCommandIds = ["cmd_escape", "cmd_attack"];
    const session = startSession(project);
    run(project, session, { operation: "remove", value: "cmd_attack" });
    expect(session.actorBattleCommands?.[ACTOR]).toEqual(["cmd_escape"]);
  });
});

describe("이도류 타격은 그 무기의 공격력으로 친다", () => {
  function damageWith(equipment: Record<string, string>): number {
    const project = strictProject();
    project.database.equipment = [
      normalizeEquipmentRecord({ id: "eq_sword", name: "검", slot: "weapon", statBonuses: { attack: 40 } as never }),
      normalizeEquipmentRecord({ id: "eq_dagger", name: "단검", slot: "weapon", statBonuses: { attack: 4 } as never }),
    ];
    const actor = project.database.actors.find((record) => record.id === ACTOR)!;
    actor.options = { ...actor.options, dualWield: true };
    actor.initialEquipment = equipment;
    actor.parameterCurves.agility = Array.from({ length: 99 }, () => 99);
    const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime")!;
    enemy.stats = { ...enemy.stats, maxHp: 9000, defense: 1, agility: 1 };
    enemy.actions = [];
    enemy.skillIds = [];
    const runtime = createBattleRuntime({
      project, troopId: "troop_strict_training", battleFlow: "strict", canEscape: false, canLose: true,
      party: { partyActorIds: [ACTOR], levels: { [ACTOR]: 1 }, experience: {} },
      sessionState: { switches: {}, variables: {}, inventory: {} },
      rng: () => 0.5,
    });
    const before = runtime.snapshot().enemies.reduce((sum, entry) => sum + entry.hp, 0);
    runtime.performActorCommand({ kind: "attack", targetEnemyId: runtime.snapshot().enemies[0]!.id });
    return before - runtime.snapshot().enemies.reduce((sum, entry) => sum + entry.hp, 0);
  }

  it("검+단검 두 타격 = 검 한 번 + 단검 한 번 (합산 공격력으로 두 번 치지 않는다)", () => {
    const sword = damageWith({ weapon: "eq_sword" });
    const dagger = damageWith({ weapon: "eq_dagger" });
    const dual = damageWith({ weapon: "eq_sword", shield: "eq_dagger" });
    expect(sword).toBeGreaterThan(dagger);
    expect(dual).toBe(sword + dagger);
  });

  it("타격별 무기 목록을 battler 에 싣는다", () => {
    const project = strictProject();
    project.database.equipment = [
      normalizeEquipmentRecord({ id: "eq_sword", name: "검", slot: "weapon", statBonuses: { attack: 40 } as never, attackElementIds: ["fire"] }),
      normalizeEquipmentRecord({ id: "eq_dagger", name: "단검", slot: "weapon", statBonuses: { attack: 4 } as never }),
    ];
    const actor = project.database.actors.find((record) => record.id === ACTOR)!;
    actor.options = { ...actor.options, dualWield: true };
    const swings = actorBattlers(project, { partyActorIds: [ACTOR], equipment: { [ACTOR]: { weapon: "eq_sword", shield: "eq_dagger" } } })[0]!.equipmentEffects?.attackSwings;
    expect(swings).toEqual([
      { weaponId: "eq_sword", attackOffset: -4, attackElementIds: ["fire"] },
      { weaponId: "eq_dagger", attackOffset: -40, attackElementIds: [] },
    ]);
  });
});
