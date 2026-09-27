import { describe, expect, it } from "vitest";
import {
  battleFormationChances,
  contactFormation,
  formationStartRow,
  rollBattleFormation,
} from "@/battle/battleFormation";
import { createBattleRuntime } from "@/battle/runtime";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject(): Project {
  const project = deserialize(JSON.stringify(battleFixture));
  const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
  slime.stats = { ...slime.stats, maxHp: 9999 };
  return project;
}

const fixed = (value: number) => () => value;

describe("mg-l2-bflow #3 전투 개시 진형", () => {
  it("민첩 우위와 장비 선제 플래그가 선제 확률을 올리고 기습을 없앤다", () => {
    const even = battleFormationChances({ partyAgility: 10, enemyAgility: 10, preemptiveEquipment: false });
    const fast = battleFormationChances({ partyAgility: 30, enemyAgility: 10, preemptiveEquipment: false });
    const gear = battleFormationChances({ partyAgility: 10, enemyAgility: 10, preemptiveEquipment: true });
    expect(fast.preemptive).toBeGreaterThan(even.preemptive);
    expect(gear.preemptive).toBe(even.preemptive + 25);
    expect(gear.surprise).toBe(0);
    // rng 0 은 첫 구간(선제), 0.999 는 보통.
    expect(rollBattleFormation({ partyAgility: 10, enemyAgility: 10, preemptiveEquipment: false }, fixed(0))).toBe("preemptive");
    expect(rollBattleFormation({ partyAgility: 10, enemyAgility: 10, preemptiveEquipment: false }, fixed(0.999))).toBe("normal");
  });

  it("심볼 접촉: 같은 쪽을 볼 때 적 등 뒤에서 닿으면 선제, 등을 잡히면 기습, 정면은 굴림에 맡긴다", () => {
    expect(contactFormation({ x: 5, y: 5, facing: "right" }, { x: 6, y: 5, facing: "right" })).toBe("preemptive");
    expect(contactFormation({ x: 5, y: 5, facing: "right" }, { x: 4, y: 5, facing: "right" })).toBe("surprise");
    expect(contactFormation({ x: 5, y: 5, facing: "right" }, { x: 6, y: 5, facing: "left" })).toBeUndefined();
    expect(contactFormation({ x: 5, y: 5, facing: "down" }, { x: 5, y: 6, facing: undefined })).toBeUndefined();
  });

  it("선제(gauge): 아군 게이지가 가득 차 첫 틱에 명령 차례가 온다", () => {
    const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", formation: "preemptive", rng: fixed(0.5) });
    expect(runtime.snapshot().formation).toBe("preemptive");
    expect(runtime.snapshot().actors[0]?.gauge).toBe(100);
    runtime.tick(1);
    expect(runtime.snapshot().phase).toBe("actorCommand");
  });

  it("기습(gauge): 적 게이지가 가득 차 적이 먼저 행동한다", () => {
    const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", formation: "surprise", rng: fixed(0.5) });
    expect(runtime.snapshot().enemies[0]?.gauge).toBe(100);
    expect(runtime.snapshot().actors[0]?.gauge).toBe(0);
    runtime.tick(1);
    expect(runtime.snapshot().timeline.some((entry) => entry.side === "enemy" && entry.commandKind === "enemyAttack")).toBe(true);
  });

  it("선제(strict): 첫 라운드에 적이 행동하지 않고, 둘째 라운드부터 행동한다", () => {
    const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", formation: "preemptive", rng: fixed(0.5) });
    runtime.performActorCommand({ kind: "defend" });
    const first = runtime.snapshot().roundLogs[0]!;
    expect(first.actions.some((action) => action.side === "enemy")).toBe(false);
    runtime.performActorCommand({ kind: "defend" });
    expect(runtime.snapshot().roundLogs[1]!.actions.some((action) => action.side === "enemy")).toBe(true);
  });

  it("기습(strict): 첫 라운드는 명령 없이 적만 행동하고 둘째 라운드에 명령 차례가 온다", () => {
    const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", formation: "surprise", rng: fixed(0.5) });
    const first = runtime.snapshot().roundLogs[0]!;
    expect(first.actions.every((action) => action.side === "enemy")).toBe(true);
    expect(first.actions.length).toBeGreaterThan(0);
    expect(runtime.snapshot().phase).toBe("actorCommand");
    expect(runtime.snapshot().strictRound).toBe(2);
  });

  it("백어택은 대열을 뒤집는다(전열 → 후열)", () => {
    expect(formationStartRow("front", "backAttack")).toBe("back");
    expect(formationStartRow("back", "pincer")).toBe("front");
    const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, formation: "backAttack", party: { rows: { actor_hero: "front" } }, rng: fixed(0.5) });
    expect(runtime.snapshot().actors[0]?.row).toBe("back");
  });

  it("battleFormationRoll 이 꺼진 레거시 프로젝트는 항상 보통 개시다(rng 를 쓰지 않는다)", () => {
    let calls = 0;
    const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => { calls += 1; return 0; } });
    expect(runtime.snapshot().formation).toBe("normal");
    expect(calls).toBe(0);
  });

  it("battleFormationRoll + 장비 선제 플래그가 굴림을 선제로 만든다", () => {
    const project = battleProject();
    project.system.battleFormationRoll = true;
    project.database.equipment.push(normalizeEquipmentRecord({ id: "equip_scout", name: "척후 장화", slot: "accessory" }));
    project.database.equipment.find((record) => record.id === "equip_scout")!.effectFlags.preemptive = true;
    // 선제 확률(5 + 25 = 30%) 안쪽 값.
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: fixed(0.2), party: { equipment: { actor_hero: { accessory: "equip_scout" } } } });
    expect(runtime.snapshot().formation).toBe("preemptive");
    const bare = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, rng: fixed(0.2), formation: undefined });
    expect(bare.snapshot().formation).toBe("normal");
  });

  it("battleProcessing.formation 과 system.battleFormationRoll 이 저장·불러오기를 지난다", () => {
    const project = battleProject();
    project.system.battleFormationRoll = true;
    const map = Object.values(project.maps)[0]!;
    const event = map.events.find((entry) => entry.id === "battle-start")!;
    const battle = event.commands[0] as Extract<(typeof event.commands)[number], { kind: "battleProcessing" }>;
    battle.formation = "surprise";
    const reloaded = deserialize(serialize(project));
    expect(reloaded.system.battleFormationRoll).toBe(true);
    const command = Object.values(reloaded.maps)[0]!.events.find((entry) => entry.id === "battle-start")!.commands[0]!;
    expect(command).toMatchObject({ kind: "battleProcessing", formation: "surprise" });
  });
});
