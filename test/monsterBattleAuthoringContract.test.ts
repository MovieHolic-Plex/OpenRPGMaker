import { describe, expect, it } from "vitest";
import { createBattleEventRuntime } from "@/battle/battleEvents";
import { enemyBattlers } from "@/battle/battleBattlers";
import { normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { deserialize, serialize } from "@/project/io";
import type { BattleEventPageRecord } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

const page = (patch: Partial<BattleEventPageRecord> = {}): BattleEventPageRecord => ({
  id: "page", span: "turn", conditions: [], commands: [{ kind: "changeGold", op: "+=", amount: 1 }], ...patch,
});
function setup(pages: BattleEventPageRecord[]) {
  const project = deserialize(JSON.stringify(battleFixture));
  const troop = project.database.troops[0]!;
  troop.battleEventPages = pages;
  const enemies = enemyBattlers(project, troop);
  const state = { gold: 0, switches: {}, variables: {}, inventory: {} };
  const runtime = createBattleEventRuntime({ project, troopRecord: troop, actors: [], enemies, stateIds: project.database.states.map((s) => s.id), state });
  return { project, troop, enemies, state, runtime };
}

describe("monster battle authoring contracts", () => {
  it("empty authored pages have no implicit state or reward effects", () => {
    const { enemies, state, runtime } = setup([page({ commands: [], span: "battle" })]);
    const before = structuredClone(enemies);
    runtime.applyTroopEvents({ turn: 1 });
    expect(enemies).toEqual(before);
    expect(state.gold).toBe(0);
  });

  it.each([
    ["turn", undefined, 2], ["moment", undefined, 3], ["battle", undefined, 1],
    ["battle", false, 3], ["moment", true, 1], ["turn", true, 1],
  ] as const)("%s span with runOnce=%s fires %s times", (span, runOnce, expected) => {
    const { runtime, state } = setup([page({ span, runOnce })]);
    runtime.applyTroopEvents({ turn: 1 });
    runtime.applyTroopEvents({ turn: 1 });
    runtime.applyTroopEvents({ turn: 2 });
    expect(state.gold).toBe(expected);
  });

  it("round conditions still deduplicate even with moment span", () => {
    const { runtime, state } = setup([page({ span: "moment", conditions: [{ kind: "everyRound", start: 1, interval: 1 }] })]);
    runtime.applyTroopEvents({ turn: 1 });
    runtime.applyTroopEvents({ turn: 1 });
    runtime.applyTroopEvents({ turn: 2 });
    expect(state.gold).toBe(2);
  });

  it("repairs duplicate page IDs deterministically without stealing another existing ID", () => {
    const { project, troop } = setup([page({ id: "p" }), page({ id: "p" }), page({ id: "p_2" }), page({ id: "p" })]);
    const normalized = normalizeTroopRecord(troop);
    expect(normalized.battleEventPages.map((p) => p.id)).toEqual(["p", "p_3", "p_2", "p_4"]);
    expect(normalizeTroopRecord(normalized)).toEqual(normalized);
    const loaded = deserialize(serialize(project));
    expect(loaded.database.troops[0]!.battleEventPages).toEqual(normalized.battleEventPages);
    expect(deserialize(serialize(loaded)).database.troops[0]!.battleEventPages).toEqual(normalized.battleEventPages);
  });

  it("saves, loads and evaluates the second slot independently of a duplicate enemy", () => {
    const { project, troop } = setup([page({ conditions: [{ kind: "enemyHp", enemyId: "enemy-2", minPercent: 0, maxPercent: 50 }] })]);
    const enemyId = troop.enemyIds[0]!;
    troop.members = [{ enemyId, x: 80, y: 100 }, { enemyId, x: 160, y: 100 }];
    troop.enemyIds = [enemyId, enemyId];
    const loaded = deserialize(serialize(project));
    const loadedTroop = loaded.database.troops[0]!;
    const enemies = enemyBattlers(loaded, loadedTroop);
    const state = { gold: 0, switches: {}, variables: {}, inventory: {} };
    const runtime = createBattleEventRuntime({ project: loaded, troopRecord: loadedTroop, actors: [], enemies, stateIds: [], state });
    enemies[0]!.hp = 1;
    runtime.applyTroopEvents({ turn: 1 });
    expect(state.gold).toBe(0);
    enemies[1]!.hp = 1;
    runtime.applyTroopEvents({ turn: 1 });
    expect(state.gold).toBe(1);
  });
});
