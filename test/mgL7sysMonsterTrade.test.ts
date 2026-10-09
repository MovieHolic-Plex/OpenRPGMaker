import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { giveMonster } from "@/project/monsterCollection";
import { fusionResultSpeciesId, fuseMonsters, removeMonster, tradeMonster } from "@/project/monsterTrade";
import { startSession, type PlaySession } from "@/project/session";
import { createInterpreter } from "@/player/interpreter";
import type { Command, Project } from "@/project/types";

function tradeProject(): Project {
  const project = createBlankProject();
  project.system.monsterCollection = true;
  project.system.monsterFusions = [
    { speciesA: "species_wild_slime", speciesB: "species_cave_bat", resultSpeciesId: "species_king_slime" },
  ];
  return project;
}

function give(project: Project, session: PlaySession, speciesId: string, level = 5): string {
  const result = giveMonster(project, session, { speciesId, level });
  if (!result.ok) throw new Error(`fixture ${speciesId}`);
  return result.instance.instanceId;
}

function run(commands: Command[], project: Project, session: PlaySession): void {
  const interpreter = createInterpreter(commands, session, project);
  let step = interpreter.start();
  while (step.kind !== "done") step = interpreter.resume();
}

describe("monster release / trade / fusion (#14)", () => {
  it("removeMonster releases the named instance but never the last party monster", () => {
    const project = tradeProject();
    const session = startSession(project, 1);
    const only = give(project, session, "species_wild_slime");
    expect(removeMonster(project, session, only)).toEqual({ ok: false, reason: "lastPartyMonster" });
    const second = give(project, session, "species_cave_bat");
    run([{ kind: "removeMonster", instanceId: second }], project, session);
    expect(session.flags.removeMonsterSuccess).toBe(true);
    expect(session.monsterInstances[second]).toBeUndefined();
    expect(session.monsterParty).toEqual([only]);
  });

  it("removeMonster with a blank id releases the first boxed monster", () => {
    const project = tradeProject();
    const session = startSession(project, 1);
    for (let i = 0; i < 6; i += 1) give(project, session, "species_wild_slime");
    const boxed = give(project, session, "species_cave_bat");
    expect(session.monsterBox).toEqual([boxed]);
    run([{ kind: "removeMonster", instanceId: "" }], project, session);
    expect(session.monsterBox).toEqual([]);
    expect(session.monsterInstances[boxed]).toBeUndefined();
  });

  it("tradeMonster swaps one owned monster of the offered species for the requested one in the same party slot", () => {
    const project = tradeProject();
    const session = startSession(project, 1);
    const first = give(project, session, "species_wild_slime");
    const offered = give(project, session, "species_cave_bat", 12);
    const third = give(project, session, "species_wild_slime");
    run([{ kind: "tradeMonster", fromSpeciesId: "species_cave_bat", toSpeciesId: "species_stone_golem" }], project, session);
    expect(session.flags.tradeMonsterSuccess).toBe(true);
    expect(session.monsterInstances[offered]).toBeUndefined();
    const received = session.monsterInstances[session.monsterParty[1]!]!;
    expect(session.monsterParty[0]).toBe(first);
    expect(session.monsterParty[2]).toBe(third);
    expect(received.speciesId).toBe("species_stone_golem");
    expect(received.level).toBe(12);
  });

  it("tradeMonster fails without an owned monster of the offered species and changes nothing", () => {
    const project = tradeProject();
    const session = startSession(project, 1);
    const kept = give(project, session, "species_wild_slime");
    const before = structuredClone(session.monsterInstances);
    run([{ kind: "tradeMonster", fromSpeciesId: "species_cave_bat", toSpeciesId: "species_stone_golem" }], project, session);
    expect(session.flags.tradeMonsterSuccess).toBe(false);
    expect(session.monsterInstances).toEqual(before);
    expect(session.monsterParty).toEqual([kept]);
    expect(tradeMonster(project, session, { fromSpeciesId: "species_wild_slime", toSpeciesId: "missing" })).toEqual({ ok: false, reason: "missingSpecies" });
  });

  it("fuseMonsters consumes both instances and creates the table result at their average level", () => {
    const project = tradeProject();
    const session = startSession(project, 1);
    const bat = give(project, session, "species_cave_bat", 10);
    const slime = give(project, session, "species_wild_slime", 20);
    // 표는 순서를 따지지 않는다(bat + slime 도 slime + bat 줄에 맞는다).
    expect(fusionResultSpeciesId(project, "species_cave_bat", "species_wild_slime")).toBe("species_king_slime");
    run([{ kind: "fuseMonsters", instanceIdA: bat, instanceIdB: slime }], project, session);
    expect(session.flags.fuseMonstersSuccess).toBe(true);
    expect(session.monsterInstances[bat]).toBeUndefined();
    expect(session.monsterInstances[slime]).toBeUndefined();
    expect(session.monsterParty).toHaveLength(1);
    const result = session.monsterInstances[session.monsterParty[0]!]!;
    expect(result.speciesId).toBe("species_king_slime");
    expect(result.level).toBe(15);
    // 합성 결과는 방금 지운 재료 id 를 다시 쓰지 않는다 — 재료 id 를 가리키던 명령이 새 개체를 건드리면 안 된다.
    expect([bat, slime]).not.toContain(result.instanceId);
  });

  it("fuseMonsters rejects pairs missing from the table and the same instance twice", () => {
    const project = tradeProject();
    const session = startSession(project, 1);
    const a = give(project, session, "species_wild_slime");
    const b = give(project, session, "species_wild_slime");
    expect(fuseMonsters(project, session, a, b)).toEqual({ ok: false, reason: "noRecipe" });
    expect(fuseMonsters(project, session, a, a)).toEqual({ ok: false, reason: "sameInstance" });
    expect(Object.keys(session.monsterInstances).sort()).toEqual([a, b].sort());
  });

  it("keeps the fusion table and the new commands through serialize/deserialize", () => {
    const project = tradeProject();
    const map = project.maps[project.startMapId]!;
    map.events.push({
      id: "ev_trader", x: 1, y: 1, trigger: { kind: "action" },
      commands: [
        { kind: "tradeMonster", fromSpeciesId: "species_cave_bat", toSpeciesId: "species_stone_golem", level: 3 },
        { kind: "removeMonster", instanceId: "" },
        { kind: "fuseMonsters", instanceIdA: "monster_1", instanceIdB: "monster_2" },
      ],
    });
    const reloaded = deserialize(serialize(project));
    expect(reloaded.system.monsterFusions).toEqual(project.system.monsterFusions);
    expect(reloaded.maps[project.startMapId]!.events.find((event) => event.id === "ev_trader")!.commands.map((command) => command.kind))
      .toEqual(["tradeMonster", "removeMonster", "fuseMonsters"]);
  });
});
