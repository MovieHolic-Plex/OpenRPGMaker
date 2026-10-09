// test/commandContracts/removeMonster.contract.test.ts
// 계약: removeMonster (놓아주기 — 파티 마지막 한 마리는 지키고, 빈 id 는 보관함 첫 개체).
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import type { MonsterInstance } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { roundtripCommands, runCommandContract } from "./harness";

function instance(instanceId: string): MonsterInstance {
  return { instanceId, speciesId: "species_wild_slime", level: 3, exp: 0, friendship: 70, caughtAt: { mapId: "m", x: 0, y: 0 } };
}

function seed(party: string[], box: string[]) {
  return (session: PlaySessionLike): void => {
    session.monsterInstances = Object.fromEntries([...party, ...box].map((id) => [id, instance(id)]));
    session.monsterParty = [...party];
    session.monsterBox = [...box];
  };
}

describe("removeMonster 계약", () => {
  it("정상 효과: 지정 개체를 지운다", () => {
    const result = runCommandContract([{ kind: "removeMonster", instanceId: "monster_2" }], { mutateSession: seed(["monster_1", "monster_2"], []) });
    expect(result.session.monsterParty).toEqual(["monster_1"]);
    expect(result.session.monsterInstances?.monster_2).toBeUndefined();
    expect(result.session.flags.removeMonsterSuccess).toBe(true);
    expect(result.finished).toBe(true);
  });

  it("파티의 마지막 한 마리는 놓아주지 않는다", () => {
    const result = runCommandContract([{ kind: "removeMonster", instanceId: "monster_1" }], { mutateSession: seed(["monster_1"], []) });
    expect(result.session.monsterParty).toEqual(["monster_1"]);
    expect(result.session.flags.removeMonsterSuccess).toBe(false);
  });

  it("결측 참조: 없는 개체는 크래시 없이 실패한다", () => {
    const result = runCommandContract([{ kind: "removeMonster", instanceId: "monster_missing" }]);
    expect(result.session.flags.removeMonsterSuccess).toBe(false);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성 · pause 없음", () => {
    const commands: Command[] = [{ kind: "removeMonster", instanceId: "" }];
    expect(roundtripCommands(commands)).toEqual(commands);
    expect(runCommandContract(commands, { mutateSession: seed(["monster_1"], ["monster_2"]) }).pauses).toEqual([]);
  });
});
