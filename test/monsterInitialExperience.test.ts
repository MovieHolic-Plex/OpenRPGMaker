import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { totalExpForLevel } from "@/project/actorModel";
import { giveMonster, applyMonsterExperienceAndEvolution, DEFAULT_MONSTER_EXP_CURVE } from "@/project/monsterCollection";

describe("new monster cumulative experience", () => {
  it("needs only the next-level gap after a high-level capture/gift", () => {
    const project = createBlankProject();
    const species = project.database.monsterSpecies![0]!;
    species.expCurve = { base: 3, extra: 1, acceleration: 1 };
    species.evolutions = [];
    const session = startSession(project);
    const gift = giveMonster(project, session, { speciesId: species.id, level: 24 });
    if (!gift.ok) throw new Error("Fixture species missing");
    const floor = totalExpForLevel(species.expCurve, 24);
    const gap = totalExpForLevel(species.expCurve, 25) - floor;
    expect(gift.instance.exp).toBe(floor);
    applyMonsterExperienceAndEvolution(project, session, gap - 1, [gift.instance.instanceId]);
    expect(session.monsterInstances[gift.instance.instanceId]!.level).toBe(24);
    applyMonsterExperienceAndEvolution(project, session, 1, [gift.instance.instanceId]);
    expect(session.monsterInstances[gift.instance.instanceId]!.level).toBe(25);
  });

  it("preserves explicit experience and uses the fallback curve with the clamped level", () => {
    const project = createBlankProject();
    const species = project.database.monsterSpecies![0]!;
    species.expCurve = undefined;
    const session = startSession(project);
    for (const [level, exp, expected] of [[24, 0, 0], [24, 42, 42], [0, undefined, totalExpForLevel(DEFAULT_MONSTER_EXP_CURVE, 1)], [150, undefined, totalExpForLevel(DEFAULT_MONSTER_EXP_CURVE, 99)]] as const) {
      const gift = giveMonster(project, session, { speciesId: species.id, level, exp });
      if (!gift.ok) throw new Error("Fixture species missing");
      expect(gift.instance.exp).toBe(expected);
    }
  });
});
