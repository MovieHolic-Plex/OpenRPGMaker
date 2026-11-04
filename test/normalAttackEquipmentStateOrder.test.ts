import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import type { Command, Project } from "@/project/types";

// 상태를 피해보다 먼저 기록하면 「방어 하락」이 타격 전에 뜨고 그 타격에 쓰러진 적에게도 뜬다(2026-11-04 ultrabrain #4202).

const HERO_ID = "actor_hero";
const ENEMY_ID = "enemy_slime";
const TROOP_ID = "troop_slime";
const WEAPON_ID = "equip_order_probe";

function project(enemyHp: number, { startAsleep = false } = {}): Project {
  const p = createBlankProject();
  p.system.battleFlow = "strict";
  p.session.partyActorIds = [HERO_ID];
  p.system.startActorIds = [HERO_ID];
  const actor = p.database.actors.find((record) => record.id === HERO_ID)!;
  actor.critical = { enabled: false, chanceDenominator: 20 };
  actor.parameterCurves.attack = actor.parameterCurves.attack.map(() => 60);
  const enemy = p.database.enemies.find((record) => record.id === ENEMY_ID)!;
  enemy.stats = { maxHp: enemyHp, maxMp: 999, attack: 40, defense: 10, mind: 10, agility: 1 };
  enemy.actions = [];
  p.database.states.find((record) => record.id === "state_sleep")!.recoverWhenHitChance = 100;
  p.database.equipment.push(normalizeEquipmentRecord({
    id: WEAPON_ID,
    name: WEAPON_ID,
    slot: "weapon",
    description: "평타 상태 순서 검증용 무기",
    statBonuses: { attack: 0, defense: 0, mind: 0, agility: 0 },
    equippableActorIds: [HERO_ID],
    stateInflictIds: ["state_defense_down"],
    stateInflictionChance: 100,
  }));
  if (startAsleep) {
    const sleepCommand = { kind: "m2Command", commandId: "m2-100-change-enemy-state", fields: { target: "enemy-1", operation: "add", value: "state_sleep" } } as unknown as Command;
    p.database.troops.find((record) => record.id === TROOP_ID)!.battleEventPages = [
      { id: "page_sleep", name: "잠든 채 시작", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 1 }], commands: [sleepCommand] },
    ];
  }
  return p;
}

function heroAttack(p: Project, { warmUpRounds = 0 } = {}): BattleTimelineEntrySnapshot[] {
  const runtime = createBattleRuntime({
    project: p,
    troopId: TROOP_ID,
    battleFlow: "strict",
    canEscape: false,
    canLose: true,
    party: { partyActorIds: [HERO_ID], levels: { [HERO_ID]: 1 }, experience: {}, equipment: { [HERO_ID]: { weapon: WEAPON_ID } } },
    rng: () => 0,
  });
  for (let i = 0; i < warmUpRounds; i += 1) runtime.performActorCommand({ kind: "defend" });
  if (warmUpRounds > 0) expect(runtime.snapshot().enemies[0]?.stateIds).toContain("state_sleep");
  const before = runtime.snapshot().timeline.length;
  runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
  return runtime.snapshot().timeline.slice(before).filter((entry) => entry.targetId === "enemy-1");
}

const order = (entries: readonly BattleTimelineEntrySnapshot[]): string[] =>
  entries
    .filter((entry) => entry.kind === "damage" || entry.kind === "stateAdded" || entry.kind === "stateRemoved")
    .map((entry) => (entry.kind === "damage" ? "damage" : `${entry.kind}:${entry.stateId}`));

describe("장비 평타 상태 부여 순서", () => {
  it("100% 상태 무기는 피해 다음에 상태를 기록한다", () => {
    expect(order(heroAttack(project(9999)))).toEqual(["damage", "stateAdded:state_defense_down"]);
  });

  it("그 타격에 쓰러진 적에게는 상태를 기록하지 않는다", () => {
    const entries = heroAttack(project(1));
    expect(entries.some((entry) => entry.kind === "damage")).toBe(true);
    expect(entries.some((entry) => entry.kind === "stateAdded")).toBe(false);
  });

  it("잠든 적은 피해 → 깸 → 상태 순서다", () => {
    const entries = heroAttack(project(9999, { startAsleep: true }), { warmUpRounds: 1 });
    expect(order(entries)).toEqual(["damage", "stateRemoved:state_sleep", "stateAdded:state_defense_down"]);
  });
});
