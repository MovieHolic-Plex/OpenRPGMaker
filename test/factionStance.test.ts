import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENEMY_FACTION_ID,
  factionAggression,
  factionColor,
  factionName,
  factionStance,
  isHittableByFaction,
  isProtectedFromNpcs,
  normalizeProjectFactions,
  PLAYER_FACTION_ID,
  resolveFactionTable,
  stanceBarColor,
  willAttackOnSight,
} from "@/project/factions";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { ProjectFactions } from "@/project/types";

const TWO_SIDES: ProjectFactions = {
  defs: [
    { id: "bandit", name: "산적", color: "#b3543f" },
    { id: "guard", name: "경비병", color: "#4f7fc0" },
  ],
  relations: [{ a: "bandit", b: "guard", stance: -1 }],
};

describe("faction stance table", () => {
  it("keeps legacy behaviour when no factions are authored", () => {
    const table = resolveFactionTable(undefined);
    expect(factionStance(table, PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID)).toBe(-1);
    expect(factionStance(table, DEFAULT_ENEMY_FACTION_ID, DEFAULT_ENEMY_FACTION_ID)).toBe(2);
  });

  it("defaults unauthored pairs to neutral and same faction to ally", () => {
    const table = resolveFactionTable(TWO_SIDES);
    expect(factionStance(table, "bandit", "guard")).toBe(-1);
    expect(factionStance(table, "bandit", "bandit")).toBe(2);
    expect(factionStance(table, PLAYER_FACTION_ID, "bandit")).toBe(0);
    expect(factionStance(table, PLAYER_FACTION_ID, "guard")).toBe(0);
  });

  it("takes the more hostile direction when the authored pair disagrees", () => {
    const table = resolveFactionTable({
      defs: TWO_SIDES.defs,
      relations: [{ a: "bandit", b: "guard", stance: 1 }],
    });
    // 저작은 대칭으로 쓰지만, 행렬 자체는 방향성이라 한쪽만 적대로 손댄 데이터도 적대로 읽어야 한다.
    const asymmetric = resolveFactionTable(TWO_SIDES);
    asymmetric.stances[asymmetric.ids.indexOf("guard") * asymmetric.size + asymmetric.ids.indexOf("bandit")] = 2;
    expect(factionStance(table, "bandit", "guard")).toBe(1);
    expect(factionStance(asymmetric, "bandit", "guard")).toBe(-1);
    expect(factionStance(asymmetric, "guard", "bandit")).toBe(-1);
  });

  it("keeps the more hostile stance when the same pair is authored twice in either order", () => {
    const hostile = { a: "guard", b: "bandit", stance: -2 } as const;
    const allied = { a: "bandit", b: "guard", stance: 2 } as const;
    const rowOrders = [[hostile, allied], [allied, hostile]];

    expect(rowOrders.map((relations) => (
      factionStance(resolveFactionTable({ defs: TWO_SIDES.defs, relations }), "guard", "bandit")
    ))).toEqual([-2, -2]);
  });

  it("falls back to the reserved enemy faction for unknown ids", () => {
    const table = resolveFactionTable(TWO_SIDES);
    expect(factionStance(table, PLAYER_FACTION_ID, "typo_faction")).toBe(-1);
    expect(factionStance(table, "typo_faction", "other_typo")).toBe(2);
    expect(factionAggression(table, "typo_faction")).toBe(1);
  });

  it("lets authored defs override reserved faction metadata without adding a slot", () => {
    const table = resolveFactionTable({
      defs: [{ id: DEFAULT_ENEMY_FACTION_ID, name: "야수", color: "#123456", aggression: 2 }],
      relations: [],
    });
    expect(table.size).toBe(2);
    expect(factionName(table, DEFAULT_ENEMY_FACTION_ID)).toBe("야수");
    expect(factionColor(table, DEFAULT_ENEMY_FACTION_ID)).toBe("#123456");
    expect(factionAggression(table, DEFAULT_ENEMY_FACTION_ID)).toBe(2);
    expect(factionStance(table, PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID)).toBe(-1);
  });

  it("clamps stance and aggression out of range", () => {
    const table = resolveFactionTable({
      defs: [{ id: "cult", name: "교단", aggression: 9 as never }],
      relations: [{ a: "cult", b: PLAYER_FACTION_ID, stance: -9 as never }],
    });
    expect(factionAggression(table, "cult")).toBe(3);
    expect(factionStance(table, "cult", PLAYER_FACTION_ID)).toBe(-2);
  });

  it("resolves the protectedFromNpcs flag per faction", () => {
    const table = resolveFactionTable({
      defs: [{ id: "villager", name: "주민", protectedFromNpcs: true }, ...TWO_SIDES.defs],
      relations: [],
    });
    expect(isProtectedFromNpcs(table, "villager")).toBe(true);
    expect(isProtectedFromNpcs(table, "bandit")).toBe(false);
    expect(isProtectedFromNpcs(table, undefined)).toBe(false);
  });
});

describe("willAttackOnSight", () => {
  it("gates each aggression level exactly", () => {
    expect([-2, -1, 0, 1, 2].map((stance) => willAttackOnSight(stance as never, 0))).toEqual([false, false, false, false, false]);
    expect([-2, -1, 0, 1, 2].map((stance) => willAttackOnSight(stance as never, 1))).toEqual([true, true, false, false, false]);
    expect([-2, -1, 0, 1, 2].map((stance) => willAttackOnSight(stance as never, 2))).toEqual([true, true, true, false, false]);
    expect([-2, -1, 0, 1, 2].map((stance) => willAttackOnSight(stance as never, 3))).toEqual([true, true, true, true, true]);
  });
});

describe("faction readability helpers", () => {
  it("splits hostile, neutral, and friendly bar colors", () => {
    const hostile = stanceBarColor(-1);
    const neutral = stanceBarColor(0);
    const friendly = stanceBarColor(2);
    expect(new Set([hostile, neutral, friendly]).size).toBe(3);
    expect(stanceBarColor(0.25)).toBe(neutral);
    expect(stanceBarColor(-0.25)).toBe(neutral);
    expect(stanceBarColor(-2)).toBe(hostile);
    expect(stanceBarColor(1)).toBe(friendly);
  });

  it("exempts friendly stances from stray projectiles", () => {
    expect([-2, -1, 0].map(isHittableByFaction as never)).toEqual([true, true, true]);
    expect([1, 2].map(isHittableByFaction as never)).toEqual([false, false]);
  });
});

describe("normalizeProjectFactions", () => {
  it("drops empty ids, duplicate ids, and relations to unknown factions", () => {
    const normalized = normalizeProjectFactions({
      defs: [
        { id: "", name: "빈 id" },
        { id: "guard", name: "경비병" },
        { id: "guard", name: "중복" },
      ],
      relations: [
        { a: "guard", b: PLAYER_FACTION_ID, stance: 1 },
        { a: "guard", b: "ghost", stance: -1 },
      ],
    });
    expect(normalized?.defs.map((def) => def.id)).toEqual(["guard"]);
    expect(normalized?.relations).toEqual([{ a: "guard", b: PLAYER_FACTION_ID, stance: 1 }]);
  });

  it("returns undefined for empty input so blank projects stay field-free", () => {
    expect(normalizeProjectFactions(undefined)).toBeUndefined();
    expect(normalizeProjectFactions({ defs: [], relations: [] })).toBeUndefined();
  });

  it("falls back to the id when a name is missing", () => {
    const normalized = normalizeProjectFactions({ defs: [{ id: "cult", name: "" }], relations: [] });
    expect(normalized?.defs[0]?.name).toBe("cult");
  });
});

describe("project persistence", () => {
  it("survives a serialize/deserialize roundtrip without a schema bump", () => {
    const project = createBlankProject();
    const version = project.version;
    project.factions = TWO_SIDES;
    const restored = deserialize(serialize(project));
    expect(restored.version).toBe(version);
    expect(restored.factions).toEqual(TWO_SIDES);
    expect(factionStance(resolveFactionTable(restored.factions), "bandit", "guard")).toBe(-1);
  });

  it("preserves an explicitly authored default aggression across normalization and persistence", () => {
    const project = createBlankProject();
    project.factions = {
      defs: [{ id: "guard", name: "경비병", aggression: 1 }],
      relations: [],
    };
    const restored = deserialize(serialize(project));

    expect(restored.factions).toEqual(project.factions);
    expect(restored.factions?.defs[0]?.aggression).toBe(1);
  });

  it("normalizes malformed authored data on load instead of trusting it", () => {
    const project = createBlankProject();
    project.factions = {
      defs: [{ id: "guard", name: "경비병" }],
      relations: [{ a: "guard", b: "ghost", stance: -1 }],
    };
    const restored = deserialize(serialize(project));
    expect(restored.factions?.relations).toEqual([]);
  });

  it("round-trips opt-in kill reputation while absence stays field-free", () => {
    const project = createBlankProject();
    project.factions = { ...TWO_SIDES, playerKillReputation: {} };
    expect(deserialize(serialize(project)).factions?.playerKillReputation).toEqual({});
    expect(deserialize(serialize(createBlankProject())).factions).toBeUndefined();
  });

  it("rejects negative authored reputation weights", () => {
    const project = createBlankProject();
    project.factions = {
      ...TWO_SIDES,
      playerKillReputation: { weight: -0.5 },
    };
    expect(() => deserialize(serialize(project))).toThrow(/playerKillReputation\.weight/u);
  });

  it("keeps a blank project free of the field", () => {
    expect(createBlankProject().factions).toBeUndefined();
    expect(deserialize(serialize(createBlankProject())).factions).toBeUndefined();
  });
});
