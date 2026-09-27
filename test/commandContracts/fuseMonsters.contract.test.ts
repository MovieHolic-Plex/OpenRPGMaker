// test/commandContracts/fuseMonsters.contract.test.ts
// 계약: fuseMonsters (system.monsterFusions 표로 두 개체 → 결과 종 한 마리).
import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import type { MonsterInstance } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { roundtripCommands, runCommandContract } from "./harness";

function withTable(project: Project): void {
  project.system.monsterFusions = [{ speciesA: "species_wild_slime", speciesB: "species_cave_bat", resultSpeciesId: "species_king_slime" }];
}

function seedPair(session: PlaySessionLike): void {
  const make = (instanceId: string, speciesId: string, level: number): MonsterInstance => ({ instanceId, speciesId, level, exp: 0, friendship: 70, caughtAt: { mapId: "m", x: 0, y: 0 } });
  session.monsterInstances = { monster_1: make("monster_1", "species_cave_bat", 6), monster_2: make("monster_2", "species_wild_slime", 10) };
  session.monsterParty = ["monster_1", "monster_2"];
  session.monsterBox = [];
}

describe("fuseMonsters 계약", () => {
  it("정상 효과: 두 재료가 사라지고 결과 종이 평균 레벨로 생긴다", () => {
    const result = runCommandContract([{ kind: "fuseMonsters", instanceIdA: "monster_1", instanceIdB: "monster_2" }], { mutateProject: withTable, mutateSession: seedPair });
    const instances = Object.values(result.session.monsterInstances ?? {});
    expect(instances.map((entry) => [entry.speciesId, entry.level])).toEqual([["species_king_slime", 8]]);
    expect(result.session.flags.fuseMonstersSuccess).toBe(true);
    expect(result.finished).toBe(true);
  });

  it("표에 없는 조합이면 재료를 지키고 실패한다", () => {
    const result = runCommandContract([{ kind: "fuseMonsters", instanceIdA: "monster_1", instanceIdB: "monster_2" }], { mutateSession: seedPair });
    expect(Object.keys(result.session.monsterInstances ?? {}).sort()).toEqual(["monster_1", "monster_2"]);
    expect(result.session.flags.fuseMonstersSuccess).toBe(false);
  });

  it("결측 참조: 없는 개체는 크래시 없이 실패한다", () => {
    const result = runCommandContract([{ kind: "fuseMonsters", instanceIdA: "monster_x", instanceIdB: "monster_y" }], { mutateProject: withTable });
    expect(result.session.flags.fuseMonstersSuccess).toBe(false);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성 · pause 없음", () => {
    const commands: Command[] = [{ kind: "fuseMonsters", instanceIdA: "monster_1", instanceIdB: "monster_2" }];
    expect(roundtripCommands(commands, withTable)).toEqual(commands);
    expect(runCommandContract(commands, { mutateProject: withTable, mutateSession: seedPair }).pauses).toEqual([]);
  });
});
