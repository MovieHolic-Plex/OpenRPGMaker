// test/commandContracts/giveMonster.contract.test.ts
// G1 계약: giveMonster (Phase 9a 몬스터 지급 커맨드).
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { MONSTER_PARTY_MAX } from "@/project/monsterCollection";
import { roundtripCommands, runCommandContract } from "./harness";

function command(speciesId = "species_wild_slime", level = 4): Command {
  return { kind: "giveMonster", speciesId, level, nickname: "계약 슬라임" };
}

describe("giveMonster 계약", () => {
  it("정상 효과: species 인스턴스를 만들고 파티에 추가한다", () => {
    const result = runCommandContract([command()]);
    const partyId = result.session.monsterParty?.[0];

    expect(result.session.monsterParty).toHaveLength(1);
    expect(result.session.monsterBox).toEqual([]);
    expect(result.session.monsterInstances?.[partyId ?? ""]).toMatchObject({
      speciesId: "species_wild_slime",
      nickname: "계약 슬라임",
      level: 4,
      exp: 0,
      friendship: 70,
    });
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("결측 참조: 없는 speciesId 는 크래시 없이 스킵한다", () => {
    const result = runCommandContract([
      { kind: "giveMonster", speciesId: "species_missing", level: 5 },
      { kind: "setSwitch", switchId: "after_missing_species", value: true },
    ]);

    expect(result.session.monsterParty).toEqual([]);
    expect(result.session.monsterBox).toEqual([]);
    expect(result.session.monsterInstances).toEqual({});
    expect(result.session.switches.after_missing_species).toBe(true);
    expect(result.finished).toBe(true);
  });

  it("파티가 6마리를 넘으면 보관함으로 보낸다", () => {
    const commands = Array.from({ length: MONSTER_PARTY_MAX + 1 }, () => command("species_wild_slime", 2));
    const result = runCommandContract(commands);

    expect(result.session.monsterParty).toHaveLength(MONSTER_PARTY_MAX);
    expect(result.session.monsterBox).toHaveLength(1);
    expect(Object.keys(result.session.monsterInstances ?? {})).toHaveLength(MONSTER_PARTY_MAX + 1);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
    const commands = [command()];
    const original = runCommandContract(commands);
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands);

    expect(restored.session).toEqual(original.session);
    expect(restored.finished).toBe(true);
  });

  it("pause 의미론: giveMonster 는 non-blocking — pause 가 발생하지 않는다", () => {
    const result = runCommandContract([command()]);

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
