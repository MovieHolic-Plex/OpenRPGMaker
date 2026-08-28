import { describe, expect, it } from "vitest";
import {
  adjustEffectiveFactionStance,
  applyPlayerKillReputation,
  effectiveFactionStance,
  factionStancePairKey,
  parseFactionStanceOverrides,
  setEffectiveFactionStance,
} from "@/project/factionRuntime";
import { factionStance, PLAYER_FACTION_ID, resolveFactionTable } from "@/project/factions";

const table = resolveFactionTable({
  defs: [
    { id: "bandit", name: "산적" },
    { id: "guard", name: "경비병" },
    { id: "watch", name: "자경단" },
  ],
  relations: [
    { a: "bandit", b: "guard", stance: -1 },
    { a: "guard", b: "watch", stance: 1 },
  ],
});

describe("runtime faction stance overlay", () => {
  it("matches authored behavior exactly when the overlay is absent", () => {
    for (const a of table.ids) {
      for (const b of table.ids) {
        expect(effectiveFactionStance(table, undefined, a, b)).toBe(factionStance(table, a, b));
      }
    }
  });

  it("uses stable unambiguous ordered-pair keys and stores only changed directions", () => {
    expect(factionStancePairKey("a|b", "c")).not.toBe(factionStancePairKey("a", "b|c"));
    const changed = setEffectiveFactionStance(table, {}, "guard", PLAYER_FACTION_ID, -1);
    expect(Object.keys(changed).sort()).toEqual([
      factionStancePairKey(PLAYER_FACTION_ID, "guard"),
      factionStancePairKey("guard", PLAYER_FACTION_ID),
    ].sort());
    expect(setEffectiveFactionStance(table, changed, "guard", PLAYER_FACTION_ID, 0)).toEqual({});
  });

  it("clamps absolute and delta updates while preserving fractional reputation", () => {
    let overrides = setEffectiveFactionStance(table, {}, "guard", PLAYER_FACTION_ID, 99);
    expect(effectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID)).toBe(2);
    overrides = adjustEffectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID, -0.25);
    expect(effectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID)).toBe(1.75);
    overrides = adjustEffectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID, -99);
    expect(effectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID)).toBe(-2);
  });

  it("takes the more hostile direction even for asymmetric loaded overlays", () => {
    const overrides = parseFactionStanceOverrides({
      [factionStancePairKey("guard", "bandit")]: 2,
      [factionStancePairKey("bandit", "guard")]: -2,
    });
    expect(effectiveFactionStance(table, overrides, "guard", "bandit")).toBe(-2);
    expect(effectiveFactionStance(table, overrides, "bandit", "guard")).toBe(-2);
  });

  it("warms enemies of the defeated faction and cools it plus its allies", () => {
    const changed = applyPlayerKillReputation(table, {}, "guard", 0.25);
    expect(effectiveFactionStance(table, changed, "bandit", PLAYER_FACTION_ID)).toBe(0.25);
    expect(effectiveFactionStance(table, changed, "guard", PLAYER_FACTION_ID)).toBe(-0.25);
    expect(effectiveFactionStance(table, changed, "watch", PLAYER_FACTION_ID)).toBe(-0.25);
  });
});
