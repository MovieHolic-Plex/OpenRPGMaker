import { describe, expect, it } from "vitest";
import { ownsMonsterSpecies, type MonsterOwnershipState } from "../src/project/monsterOwnership";

describe("live monster species ownership", () => {
  const instances = {
    starter: { speciesId: "burrlock", hp: 0 },
    captured: { speciesId: "merin" },
    released: { speciesId: "howler" },
  };
  const state: MonsterOwnershipState = {
    monsterInstances: instances,
    monsterParty: ["starter"],
    monsterBox: ["captured", "missing"],
  };

  it("counts party members even when fainted and counts boxed captures", () => {
    expect(ownsMonsterSpecies(state, "burrlock")).toBe(true);
    expect(ownsMonsterSpecies(state, "merin")).toBe(true);
  });

  it("does not mistake an orphan instance for an owned monster", () => {
    expect(ownsMonsterSpecies(state, "howler")).toBe(false);
    expect(ownsMonsterSpecies(state, "missing")).toBe(false);
  });

  it("preserves ownership through party-to-box transfer and loses it on release", () => {
    const boxed = { ...state, monsterParty: [], monsterBox: ["starter", "captured"] };
    expect(ownsMonsterSpecies(boxed, "burrlock")).toBe(true);
    expect(ownsMonsterSpecies({ ...boxed, monsterBox: ["captured"] }, "burrlock")).toBe(false);
  });

  it("handles old saves and compares exact species IDs rather than instance IDs", () => {
    expect(ownsMonsterSpecies({}, "burrlock")).toBe(false);
    expect(ownsMonsterSpecies(state, "starter")).toBe(false);
    expect(ownsMonsterSpecies(state, "BURRLOCK")).toBe(false);
    expect(ownsMonsterSpecies(state, "")).toBe(false);
  });

  it("ignores inherited records even if a damaged membership list references them", () => {
    const inherited = Object.create({ ghost: { speciesId: "howler" } });
    expect(ownsMonsterSpecies({ monsterInstances: inherited, monsterParty: ["ghost"] }, "howler")).toBe(false);
  });
});
