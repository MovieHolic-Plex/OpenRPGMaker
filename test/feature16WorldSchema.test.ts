import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import { normalizeActionSkillProfile, isActionCombatMap } from "@/project/actionCombat";
import { normalizeMapClimate } from "@/project/mapClimate";
import { serialize, deserialize } from "@/project/io";

describe("feature16 world persistence", () => {
  it("keeps unset legacy climate absent through save/load", () => {
    const project = createBlankProject();
    const loaded = deserialize(serialize(project));
    expect(loaded.maps[loaded.startMapId]).not.toHaveProperty("climate");
    expect(isActionCombatMap(loaded, loaded.maps[loaded.startMapId])).toBe(false);
  });
  it.each(["inherit", "indoor", "fixed"] as const)("round trips %s climate and every skill profile", (mode) => {
    const project = createBlankProject();
    project.maps[project.startMapId]!.climate = mode === "fixed" ? { mode, weather: "snow", intensity: 0.8 } : { mode };
    const skills = (["projectile", "melee", "dash", "trap"] as const).map((kind) => normalizeSkillRecord({
      id: `feature16_${kind}`, name: kind,
      actionSkill: { kind, damage: 23, range: 3, cooldownMs: 650, durationMs: 4000, fieldStatus: { kind: "poison", durationMs: 2000 } },
    }));
    project.database.skills.push(...skills);
    const loaded = deserialize(serialize(project));
    expect(loaded.maps[loaded.startMapId]!.climate).toEqual(project.maps[project.startMapId]!.climate);
    for (const skill of skills) expect(loaded.database.skills.find((s) => s.id === skill.id)?.actionSkill).toEqual(skill.actionSkill);
  });
  it("bounds malformed optional authoring without enabling unknown profiles", () => {
    expect(normalizeMapClimate({ mode: "fixed", weather: "snow", intensity: Infinity })).toEqual({ mode: "fixed", weather: "snow", intensity: 0.5 });
    expect(normalizeMapClimate({ mode: "indoor", weather: "rain" })).toEqual({ mode: "indoor" });
    expect(normalizeMapClimate({ mode: "typo" })).toBeUndefined();
    expect(normalizeActionSkillProfile({ kind: "trap", range: 99, damage: -1, durationMs: Infinity,
      fieldStatus: { kind: "slow", durationMs: 90000 } })).toMatchObject({ range: 20, damage: 1, durationMs: 5000, fieldStatus: { durationMs: 30000 } });
  });
});
