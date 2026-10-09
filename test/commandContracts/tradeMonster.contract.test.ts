// test/commandContracts/tradeMonster.contract.test.ts
// 계약: tradeMonster (내줄 종 한 마리 → 받을 종).
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import type { MonsterInstance } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { roundtripCommands, runCommandContract } from "./harness";

function seedBat(session: PlaySessionLike): void {
  const bat: MonsterInstance = { instanceId: "monster_1", speciesId: "species_cave_bat", level: 8, exp: 0, friendship: 70, caughtAt: { mapId: "m", x: 0, y: 0 } };
  session.monsterInstances = { monster_1: bat };
  session.monsterParty = ["monster_1"];
  session.monsterBox = [];
}

describe("tradeMonster 계약", () => {
  it("정상 효과: 내준 종이 사라지고 받은 종이 같은 레벨로 들어온다", () => {
    const result = runCommandContract([{ kind: "tradeMonster", fromSpeciesId: "species_cave_bat", toSpeciesId: "species_stone_golem" }], { mutateSession: seedBat });
    const instances = Object.values(result.session.monsterInstances ?? {});
    expect(instances.map((entry) => [entry.speciesId, entry.level])).toEqual([["species_stone_golem", 8]]);
    expect(result.session.flags.tradeMonsterSuccess).toBe(true);
    expect(result.finished).toBe(true);
  });

  it("결측 참조: 내줄 종이 없거나 받을 종이 없으면 아무것도 바꾸지 않는다", () => {
    const noOffer = runCommandContract([{ kind: "tradeMonster", fromSpeciesId: "species_wild_slime", toSpeciesId: "species_stone_golem" }], { mutateSession: seedBat });
    expect(Object.keys(noOffer.session.monsterInstances ?? {})).toEqual(["monster_1"]);
    expect(noOffer.session.flags.tradeMonsterSuccess).toBe(false);
    const missing = runCommandContract([{ kind: "tradeMonster", fromSpeciesId: "species_cave_bat", toSpeciesId: "species_missing" }], { mutateSession: seedBat });
    expect(Object.keys(missing.session.monsterInstances ?? {})).toEqual(["monster_1"]);
    expect(missing.finished).toBe(true);
  });

  it("왕복 동일성 · pause 없음", () => {
    const commands: Command[] = [{ kind: "tradeMonster", fromSpeciesId: "species_cave_bat", toSpeciesId: "species_stone_golem", level: 4 }];
    expect(roundtripCommands(commands)).toEqual(commands);
    expect(runCommandContract(commands, { mutateSession: seedBat }).pauses).toEqual([]);
  });
});
