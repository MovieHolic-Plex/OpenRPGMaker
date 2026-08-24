import { describe, expect, it } from "vitest";
import { createScarloxyPokemonDemoProject } from "@/project/defaults";

const GEN1_TYPES = [
  "normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost",
  "fire", "water", "grass", "electric", "psychic", "ice", "dragon",
] as const;

describe("Scarloxy Gen1 authored content", () => {
  it("authors all 15 R/B types with their physical/special damage classes", () => {
    const project = createScarloxyPokemonDemoProject();
    expect(project.system.typeChart?.types).toEqual(GEN1_TYPES);
    const kinds = Object.fromEntries(project.database.elements
      .filter((element) => GEN1_TYPES.includes(element.id as typeof GEN1_TYPES[number]))
      .map((element) => [element.id, element.kind]));
    expect(kinds).toEqual({
      normal: "physical", fighting: "physical", flying: "physical", poison: "physical",
      ground: "physical", rock: "physical", bug: "physical", ghost: "physical",
      fire: "magical", water: "magical", grass: "magical", electric: "magical",
      psychic: "magical", ice: "magical", dragon: "magical",
    });
    expect(new Set((project.database.monsterSpecies ?? []).flatMap((species) => species.types)))
      .toEqual(new Set(GEN1_TYPES));
  });

  it("authors the R/B matchup table including immunities and the Ghost/Psychic bug", () => {
    const chart = createScarloxyPokemonDemoProject().system.typeChart;
    expect(chart?.multipliers.normal?.ghost).toBe(0);
    expect(chart?.multipliers.fighting?.ghost).toBe(0);
    expect(chart?.multipliers.electric?.ground).toBe(0);
    expect(chart?.multipliers.ground?.flying).toBe(0);
    expect(chart?.multipliers.ghost?.normal).toBe(0);
    expect(chart?.multipliers.ghost?.psychic).toBe(0);
    expect(chart?.multipliers.bug?.poison).toBe(2);
    expect(chart?.multipliers.poison?.bug).toBe(2);
    expect(chart?.multipliers.ice?.dragon).toBe(2);
    for (const attackType of GEN1_TYPES) {
      expect(Object.keys(chart?.multipliers[attackType] ?? {})).toEqual(GEN1_TYPES);
    }
  });

  it("authors persistent major statuses, finite PP, a Poke Ball, and trainer semantics", () => {
    const project = createScarloxyPokemonDemoProject();
    const majorStatuses = Object.fromEntries(project.database.states
      .filter((state) => state.gen1MajorStatus)
      .map((state) => [state.gen1MajorStatus, state]));
    expect(Object.keys(majorStatuses).sort()).toEqual(["burn", "freeze", "paralysis", "poison", "sleep"]);
    for (const state of Object.values(majorStatuses)) {
      expect(state.runtimeEffects?.removeOnBattleEnd).toBe(false);
    }

    const speciesSkillIds = new Set((project.database.monsterSpecies ?? [])
      .flatMap((species) => species.skillsByLevel.map((entry) => entry.skillId)));
    for (const skillId of speciesSkillIds) {
      expect(project.database.skills.find((skill) => skill.id === skillId)?.maxPp).toBeGreaterThan(0);
    }
    expect(project.database.items.find((item) => item.id === "item_capture_orb")?.captureProfile?.ballClass).toBe("poke");
    expect(project.database.troops.find((troop) => troop.id === "troop_pkmn_rival")?.trainerBattle).toBe(true);
    expect(project.database.troops
      .filter((troop) => troop.id.startsWith("troop_pkmn_grass") || troop.id === "troop_pkmn_shore")
      .every((troop) => troop.members?.length === 1)).toBe(true);
  });
});
