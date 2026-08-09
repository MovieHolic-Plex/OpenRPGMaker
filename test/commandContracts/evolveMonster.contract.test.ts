// test/commandContracts/evolveMonster.contract.test.ts
// G1 계약: evolveMonster (Phase 9b 몬스터 진화 커맨드).
import { describe, expect, it } from "vitest";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import type { MonsterInstance } from "@/project/session";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

function monster(instanceId = "monster_1", level = 7): MonsterInstance {
  return {
    instanceId,
    speciesId: "species_wild_slime",
    level,
    exp: 0,
    ivs: { hp: 0, atk: 0, def: 0, spd: 0 },
    friendship: 70,
    caughtAt: { mapId: "map_blank", x: 1, y: 1 },
    currentHp: 10,
    skillIds: ["skill_default"],
  };
}

function seedMonster(level = 7) {
  return (session: PlaySessionLike): void => {
    session.monsterInstances = { monster_1: monster("monster_1", level) };
    session.monsterParty = ["monster_1"];
    session.monsterBox = [];
  };
}

function requireItemEvolution(project: Project): void {
  const species = project.database.monsterSpecies?.find((record) => record.id === "species_wild_slime");
  if (!species) throw new Error("missing wild slime species");
  species.evolutions = [{ toSpeciesId: "species_king_slime", requires: { itemId: "item_capture_orb" } }];
}

function command(): Command {
  return {
    kind: "evolveMonster",
    instanceId: "monster_1",
    toSpeciesId: "species_king_slime",
    successBranch: [{ kind: "setFlag", flag: "evolve_success", value: true }],
    failureBranch: [{ kind: "setFlag", flag: "evolve_failure", value: true }],
  };
}

describe("evolveMonster 계약", () => {
  it("정상 효과: 조건을 만족하면 species를 바꾸고 성공 분기를 실행한다", () => {
    const result = runCommandContract([command()], { mutateSession: seedMonster(7) });

    expect(result.session.monsterInstances?.monster_1?.speciesId).toBe("species_king_slime");
    expect(result.session.flags.evolveMonsterSuccess).toBe(true);
    expect(result.session.flags.evolve_success).toBe(true);
    expect(result.session.flags.evolve_failure).toBeUndefined();
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("아이템 진화: 성공 시 요구 아이템을 1개 소모한다", () => {
    const result = runCommandContract([command()], {
      mutateProject: requireItemEvolution,
      mutateSession: (session) => {
        seedMonster(3)(session);
        session.inventory.item_capture_orb = 1;
      },
    });

    expect(result.session.monsterInstances?.monster_1?.speciesId).toBe("species_king_slime");
    expect(result.session.inventory.item_capture_orb).toBe(0);
    expect(result.session.flags.evolve_success).toBe(true);
    expect(result.finished).toBe(true);
  });

  it("조건 미충족: 실패 분기를 실행하고 species를 유지한다", () => {
    const result = runCommandContract([command()], {
      mutateProject: requireItemEvolution,
      mutateSession: seedMonster(3),
    });

    expect(result.session.monsterInstances?.monster_1?.speciesId).toBe("species_wild_slime");
    expect(result.session.flags.evolveMonsterSuccess).toBe(false);
    expect(result.session.flags.evolve_failure).toBe(true);
    expect(result.session.flags.evolve_success).toBeUndefined();
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
    const commands = [command()];
    const original = runCommandContract(commands, { mutateSession: seedMonster(7) });
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands, { mutateSession: seedMonster(7) });

    expect(restored.session).toEqual(original.session);
    expect(restored.finished).toBe(true);
  });

  it("pause 의미론: evolveMonster 는 non-blocking — pause 가 발생하지 않는다", () => {
    const result = runCommandContract([command()], { mutateSession: seedMonster(7) });

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
