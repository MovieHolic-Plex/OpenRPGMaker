// test/commandContracts/moveMonster.contract.test.ts
// G1 계약: moveMonster (Phase 9a 파티/보관함 이동 커맨드).
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import type { MonsterInstance } from "@/project/session";
import type { PlaySessionLike } from "@/player/types";
import { MONSTER_PARTY_MAX } from "@/project/monsterCollection";
import { roundtripCommands, runCommandContract } from "./harness";

function instance(instanceId: string, speciesId = "species_wild_slime"): MonsterInstance {
  return {
    instanceId,
    speciesId,
    level: 3,
    exp: 0,
    friendship: 70,
    caughtAt: { mapId: "map_blank", x: 1, y: 1 },
  };
}

function seedMonsterSession(partyIds: string[], boxIds: string[]) {
  return (session: PlaySessionLike): void => {
    const ids = [...partyIds, ...boxIds];
    session.monsterInstances = Object.fromEntries(ids.map((id) => [id, instance(id)]));
    session.monsterParty = [...partyIds];
    session.monsterBox = [...boxIds];
  };
}

describe("moveMonster 계약", () => {
  it("정상 효과: 보관함 몬스터를 파티로 이동한다", () => {
    const result = runCommandContract(
      [{ kind: "moveMonster", instanceId: "monster_boxed", to: "party" }],
      { mutateSession: seedMonsterSession([], ["monster_boxed"]) },
    );

    expect(result.session.monsterParty).toEqual(["monster_boxed"]);
    expect(result.session.monsterBox).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("정상 효과: 파티 몬스터를 보관함으로 이동한다", () => {
    const result = runCommandContract(
      [{ kind: "moveMonster", instanceId: "monster_party", to: "box" }],
      { mutateSession: seedMonsterSession(["monster_party"], []) },
    );

    expect(result.session.monsterParty).toEqual([]);
    expect(result.session.monsterBox).toEqual(["monster_party"]);
    expect(result.finished).toBe(true);
  });

  it("파티가 가득 차면 보관함에서 파티로 이동하지 않는다", () => {
    const partyIds = Array.from({ length: MONSTER_PARTY_MAX }, (_, index) => `monster_party_${index}`);
    const result = runCommandContract(
      [{ kind: "moveMonster", instanceId: "monster_boxed", to: "party" }],
      { mutateSession: seedMonsterSession(partyIds, ["monster_boxed"]) },
    );

    expect(result.session.monsterParty).toEqual(partyIds);
    expect(result.session.monsterBox).toEqual(["monster_boxed"]);
    expect(result.finished).toBe(true);
  });

  it("결측 참조: 없는 instanceId 는 크래시 없이 스킵한다", () => {
    const result = runCommandContract([
      { kind: "moveMonster", instanceId: "monster_missing", to: "box" },
      { kind: "setSwitch", switchId: "after_missing_monster", value: true },
    ]);

    expect(result.session.monsterParty).toEqual([]);
    expect(result.session.monsterBox).toEqual([]);
    expect(result.session.monsterInstances).toEqual({});
    expect(result.session.switches.after_missing_monster).toBe(true);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
    const commands: Command[] = [{ kind: "moveMonster", instanceId: "monster_boxed", to: "party" }];
    const options = { mutateSession: seedMonsterSession([], ["monster_boxed"]) };
    const original = runCommandContract(commands, options);
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands, options);

    expect(restored.session).toEqual(original.session);
    expect(restored.finished).toBe(true);
  });

  it("pause 의미론: moveMonster 는 non-blocking — pause 가 발생하지 않는다", () => {
    const result = runCommandContract(
      [{ kind: "moveMonster", instanceId: "monster_boxed", to: "party" }],
      { mutateSession: seedMonsterSession([], ["monster_boxed"]) },
    );

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
