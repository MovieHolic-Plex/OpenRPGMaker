import { describe, expect, it } from "vitest";
import {
  applyArtPenalty,
  artPenalty,
  characterSheetEnemies,
  isCharacterSheetId,
  PENALTY_CAP,
  PENALTY_PER_FAMILY,
  similarMapPairs,
} from "../scripts/fs-scale/artPenalty.mjs";

type Doc = Record<string, unknown>;

function map(id: string, tiles: number[], name = id) {
  return { id, name, width: 10, height: 10, lowerTiles: tiles, upperTiles: Array(tiles.length).fill(-1), events: [] as unknown[] };
}

const forest = (seed: number) => Array.from({ length: 100 }, (_, i) => 1 + ((i + seed) % 3));
const town = () => Array.from({ length: 100 }, (_, i) => 20 + (i % 5));

function doc(maps: unknown[], extra: Doc = {}): Doc {
  return { startMapId: "start", maps: Object.fromEntries((maps as { id: string }[]).map((m) => [m.id, m])), database: { troops: [], enemies: [] }, ...extra };
}

describe("art penalty — map lookalike", () => {
  it("does not flag maps whose tile distributions differ", () => {
    const d = doc([map("start", town()), map("a", forest(0)), map("b", town().map((t) => t + 40)), map("c", forest(0).map((t) => t + 80))]);
    expect(artPenalty(d).families).toEqual([]);
    expect(artPenalty(d).penalty).toBe(0);
  });

  it("flags a game whose maps share one tile distribution: 3 or more pairs is −5 once", () => {
    const d = doc([map("start", town()), map("a", forest(0)), map("b", forest(1)), map("c", forest(2)), map("d", forest(0))]);
    const art = artPenalty(d);
    expect(art.mapLookalike.similarPairs).toBeGreaterThanOrEqual(3);
    expect(art.families).toEqual(["map-lookalike"]);
    expect(art.penalty).toBe(PENALTY_PER_FAMILY);
    expect(art.lines[0]).toContain("map-lookalike");
  });

  it("two similar pairs are not enough", () => {
    const d = doc([map("start", town()), map("a", forest(0)), map("b", forest(1)), map("c", forest(2).map((t) => t + 50))]);
    expect(similarMapPairs(d).pairs.length).toBe(1);
    expect(artPenalty(d).penalty).toBe(0);
  });

  it("excludes the start map and map_ref_ preset maps", () => {
    const d = doc([map("start", forest(0)), map("map_ref_a", forest(0)), map("map_ref_b", forest(1)), map("map_ref_c", forest(2)), map("x", town())]);
    expect(similarMapPairs(d).maps).toBe(1);
    expect(artPenalty(d).penalty).toBe(0);
  });

  it("a game with many maps is judged by the share of similar pairs, not the count", () => {
    const distinct = Array.from({ length: 12 }, (_, i) => map(`m${i}`, Array.from({ length: 100 }, (_, k) => 100 + i * 10 + (k % (2 + (i % 7))))));
    const d = doc([map("start", town()), ...distinct, map("f1", forest(0)), map("f2", forest(1)), map("f3", forest(2))]);
    const art = artPenalty(d);
    expect(art.mapLookalike.similarPairs).toBeGreaterThanOrEqual(3);
    expect(art.mapLookalike.share).toBeLessThan(0.5);
    expect(art.families).toEqual([]);
  });

  it("reports the 0.99 pairs without an extra penalty", () => {
    const d = doc([map("start", town()), map("a", forest(0)), map("b", forest(1)), map("c", forest(2)), map("d", forest(0))]);
    const art = artPenalty(d);
    expect(art.mapLookalike.extraPairs099).toBeGreaterThanOrEqual(1);
    expect(art.penalty).toBe(PENALTY_PER_FAMILY);
  });
});

describe("art penalty — NPC chipset as monster art", () => {
  const withEnemy = (monsterResourceId: string, placed = true): Doc => {
    const m = map("start", town());
    m.events = placed ? [{ id: "e1", pages: [{ commands: [{ kind: "battleProcessing", troopId: "t1" }] }] }] : [];
    return doc([m], { database: { troops: [{ id: "t1", enemyIds: ["en1"] }], enemies: [{ id: "en1", name: "적", monsterResourceId }] } });
  };

  it("recognises character sheets and keeps monster art out", () => {
    expect(isCharacterSheetId("easyrpg-charset-actor1")).toBe(true);
    expect(isCharacterSheetId("oprn-charset-modern2")).toBe(true);
    expect(isCharacterSheetId("tex_scarloxy_charset_people1")).toBe(true);
    expect(isCharacterSheetId("generated-enemy-imp-mischief")).toBe(false);
    expect(isCharacterSheetId("harness-monster-leafling-front")).toBe(false);
    expect(isCharacterSheetId(undefined)).toBe(false);
  });

  it("is zero for a game whose enemies are monster art (the hero-0074 case)", () => {
    expect(characterSheetEnemies(withEnemy("generated-enemy-demon-lord"))).toEqual([]);
    expect(artPenalty(withEnemy("generated-enemy-demon-lord")).penalty).toBe(0);
  });

  it("penalises −5 when a placed troop's enemy art is a people sheet", () => {
    const art = artPenalty(withEnemy("tex_scarloxy_charset_people1"));
    expect(art.families).toEqual(["npc-chipset"]);
    expect(art.penalty).toBe(PENALTY_PER_FAMILY);
    expect(art.npcChipset.hits).toBe(1);
  });

  it("ignores an enemy no map places", () => {
    expect(characterSheetEnemies(withEnemy("tex_scarloxy_charset_people1", false))).toEqual([]);
  });

  it("leaves a trainer preset alone: the people sheet is only the field symbol, the troop art is a monster", () => {
    const m = map("start", town());
    m.events = [{ id: "trainer", pages: [{ graphic: { sprite: { type: "bundled", id: "tex_scarloxy_charset_people1" } }, commands: [{ kind: "battleProcessing", troopId: "t1" }] }] }];
    const d = doc([m], { database: { troops: [{ id: "t1", enemyIds: ["en1"] }], enemies: [{ id: "en1", name: "새싹", monsterResourceId: "harness-monster-leafling-front" }] } });
    expect(artPenalty(d).penalty).toBe(0);
  });
});

describe("art penalty — size and cap", () => {
  it("both families cost −10 at most, and the score never goes below 0", () => {
    const m = map("start", town());
    m.events = [{ id: "e1", pages: [{ commands: [{ kind: "battleProcessing", troopId: "t1" }] }] }];
    const d = doc([m, map("a", forest(0)), map("b", forest(1)), map("c", forest(2)), map("d", forest(0))], {
      database: { troops: [{ id: "t1", enemyIds: ["en1"] }], enemies: [{ id: "en1", name: "사람", monsterResourceId: "oprn-charset-modern1" }] },
    });
    const art = artPenalty(d);
    expect(art.families).toEqual(["npc-chipset", "map-lookalike"]);
    expect(art.penalty).toBe(PENALTY_CAP);
    expect(applyArtPenalty(21.8, art)).toBe(11.8);
    expect(applyArtPenalty(6, art)).toBe(0);
  });
});
