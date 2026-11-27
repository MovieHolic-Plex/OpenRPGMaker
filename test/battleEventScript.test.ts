import { beforeAll, describe, expect, it } from "vitest";
import { createBattleEventRuntime, type BattleEventRuntimeState } from "@/battle/battleEvents";
import type { MutableBattler } from "@/battle/battleBattlers";
import { preloadScriptEngine } from "@/player/script/engine";
import { createBlankProject } from "@/project/defaults";
import type { TroopRecord } from "@/project/types/database";

function makeBattler(id: string, recordId: string, name: string, hp: number, maxHp: number): MutableBattler {
  return {
    id,
    recordId,
    name,
    level: 5,
    hp,
    mp: 30,
    maxHp,
    maxMp: 30,
    attack: 20,
    defense: 10,
    mind: 12,
    agility: 14,
    gauge: 0,
    defending: false,
    stateIds: [],
    skillIds: [],
  };
}

describe("battleEvents QuickJS script sandbox", () => {
  beforeAll(async () => {
    await preloadScriptEngine();
  });

  it("executes battle script reading/writing switches, variables, stringVariables, items, gold, and battle context", () => {
    const project = createBlankProject();
    project.switches.push({ id: "sw_phase2", name: "보스 2페이즈" });
    project.variables.push({ id: "var_turn_seen", name: "기록 턴" });
    project.database.items.push({
      id: "item_elixir",
      name: "엘릭서",
      description: "",
      price: 100,
      consumable: true,
      scope: "ally",
      effects: [],
    } as unknown as (typeof project.database.items)[number]);
    project.scriptLibrary = [
      {
        id: "boss_helper",
        source: "export const bonusGold = (turn: number) => turn * 25;",
        compiled: "exports.bonusGold = function(turn) { return turn * 25; };",
      },
    ];

    const compiled = `
      const { bonusGold } = require("@lib/boss_helper");
      const ctx = game.battleContext();
      game.setSwitch("보스 2페이즈", true);
      game.setVar("var_turn_seen", ctx.turn);
      game.addVar("var_turn_seen", 10);
      game.setText("boss_taunt", "Phase 2 on turn " + ctx.turn + " (" + ctx.enemies[0].name + ")");
      game.addGold(bonusGold(ctx.turn));
      game.addItem("item_elixir", 2);
      game.setEnemyHp("enemy_1", 50);
      game.setHp("actor_hero", 80);
      console.log("boss script executed");
    `;

    const troop: TroopRecord = {
      id: "troop_boss",
      name: "보스 부대",
      members: [],
      battleEventPages: [
        {
          id: "page_script",
          name: "페이즈 스크립트",
          conditions: [{ kind: "onRound", round: 2 }],
          span: "battle",
          commands: [{ kind: "script", name: "bossPhase", source: compiled, compiled }],
        },
      ],
    };

    const actors = [makeBattler("b_actor_1", "actor_hero", "아리아", 40, 100)];
    const enemies = [makeBattler("enemy_1", "enemy_dragon", "고대룡", 200, 200)];
    const state: BattleEventRuntimeState = {
      switches: {},
      variables: {},
      stringVariables: {},
      inventory: {},
      gold: 100,
      partyActorIds: ["actor_hero"],
    };

    const runtime = createBattleEventRuntime({
      project,
      troopRecord: troop,
      actors,
      enemies,
      stateIds: [],
      state,
    });

    const result = runtime.applyTroopEvents({ turn: 2, activeActorId: "actor_hero" });
    expect(result.kind).toBe("complete");
    expect(state.switches["sw_phase2"]).toBe(true);
    expect(state.variables["var_turn_seen"]).toBe(12);
    expect(state.stringVariables?.["boss_taunt"]).toBe("Phase 2 on turn 2 (고대룡)");
    expect(state.gold).toBe(150);
    expect(state.inventory["item_elixir"]).toBe(2);
    expect(enemies[0]!.hp).toBe(50);
    expect(actors[0]!.hp).toBe(80);
    expect(runtime.logs().some((l) => l.kind === "message" && l.detail?.includes("boss script executed"))).toBe(true);
  });

  it("isolates unsupported async/awaitable calls and unresolved promises into clear error logs without crashing battle", () => {
    const project = createBlankProject();
    const troop: TroopRecord = {
      id: "troop_async_err",
      name: "비동기 차단 테스트",
      members: [],
      battleEventPages: [
        {
          id: "page_async_api",
          name: "비동기 호출",
          conditions: [],
          span: "battle",
          commands: [
            {
              kind: "script",
              name: "callShowMessage",
              source: 'await game.showMessage("hi");',
              compiled: 'await game.showMessage("hi");',
            },
            {
              kind: "script",
              name: "hangPromise",
              source: "await new Promise(() => {});",
              compiled: "await new Promise(() => {});",
            },
            {
              kind: "setSwitch",
              switchId: "sw_after_error",
              value: true,
            },
          ],
        },
      ],
    };
    const state: BattleEventRuntimeState = { switches: {}, variables: {}, inventory: {} };
    const runtime = createBattleEventRuntime({
      project,
      troopRecord: troop,
      actors: [],
      enemies: [],
      stateIds: [],
      state,
    });

    const result = runtime.applyTroopEvents({ turn: 1 });
    expect(result.kind).toBe("complete");
    // Subsequent command still ran because script errors are isolated
    expect(state.switches["sw_after_error"]).toBe(true);
    const errors = runtime.logs().filter((l) => l.kind === "unsupported");
    expect(errors.some((e) => e.detail?.includes("game.showMessage() is an async/awaitable command"))).toBe(true);
    expect(errors.some((e) => e.detail?.includes("Async/await operations that suspend execution are not supported"))).toBe(true);
  });
});
