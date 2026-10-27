// poke-sys ② 야생 조우 보호(도망 무적 걸음 · 벌레퇴치 · 탈출 로프 · 낚싯대). 작성만 했고 실행하지 않았다(워크트리 규칙).
import { describe, expect, it } from "vitest";
import {
  applyRepel,
  escapeGraceStepsOf,
  grantEscapeGrace,
  normalizeRepelSteps,
  parseEncounterGuard,
  recordDungeonEntrance,
  repelBlocksWildLevel,
  resolveEscapeRope,
  tickEncounterGuard,
  troopWildLevel,
} from "@/project/encounterGuard";
import { normalizeItemRecord, normalizeSystemRecords } from "@/project/databaseRecordModel";
import { activeItemEffects, itemAllowsBattle, itemAllowsMenu } from "@/project/itemUsage";
import { useItemFromMenu } from "@/player/playerItemUse";
import { largestWaterRect } from "@/project/examples/monsterExpedition/fieldItems";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";

function setup() {
  const project: any = createScarloxyPokemonDemoProject();
  project.system.battleParty = "monsters";
  project.database.items.push(
    normalizeItemRecord({ id: "repel", name: "퇴치 향", type: "normalGoods", occasion: "field", scope: "none", consumable: true, repelSteps: 3 }),
    normalizeItemRecord({ id: "rope", name: "탈출 로프", type: "normalGoods", occasion: "field", scope: "none", consumable: true, escapeTo: "entrance" }),
  );
  const session: any = structuredClone(project.session);
  session.inventory = { repel: 2, rope: 1 };
  return { project, session };
}

describe("item field normalisation", () => {
  it("omits the new fields from ordinary items (unchanged bytes) and clamps steps", () => {
    const plain = normalizeItemRecord({ id: "i", name: "i" });
    for (const key of ["repelSteps", "repelBelowLead", "escapeTo"]) expect(key in plain).toBe(false);
    expect(normalizeItemRecord({ id: "i", name: "i", repelSteps: 50000 }).repelSteps).toBe(9999);
    expect("repelSteps" in normalizeItemRecord({ id: "i", name: "i", repelSteps: 0 })).toBe(false);
    expect("repelBelowLead" in normalizeItemRecord({ id: "i", name: "i", repelBelowLead: true })).toBe(false);
    expect(normalizeItemRecord({ id: "i", name: "i", repelSteps: 5, repelBelowLead: true }).repelBelowLead).toBe(true);
    expect(normalizeItemRecord({ id: "i", name: "i", escapeTo: "entrance" }).escapeTo).toBe("entrance");
    expect("escapeTo" in normalizeItemRecord({ id: "i", name: "i", escapeTo: "bogus" as never })).toBe(false);
    expect(normalizeRepelSteps(2.9)).toBe(2);
    expect(normalizeRepelSteps(-1)).toBeUndefined();
  });
  it("lets the field menu use them regardless of item type, never in battle", () => {
    const { project } = setup();
    for (const id of ["repel", "rope"]) {
      const item = activeItemEffects(project.database.items.find((entry: any) => entry.id === id));
      expect(itemAllowsMenu(item)).toBe(true);
      expect(itemAllowsBattle({ ...item, occasion: "always" })).toBe(false);
    }
  });
});

describe("escape grace after fleeing", () => {
  it("defaults to 4 steps only for monster-party games and obeys system.escapeGraceSteps", () => {
    const { project } = setup();
    expect(escapeGraceStepsOf(project)).toBe(4);
    project.system.escapeGraceSteps = 0;
    expect(escapeGraceStepsOf(project)).toBe(0);
    project.system.escapeGraceSteps = 500;
    expect(escapeGraceStepsOf(project)).toBe(99);
    delete project.system.escapeGraceSteps;
    delete project.system.battleParty; delete project.system.monsterBattleParty;
    expect(escapeGraceStepsOf(project)).toBe(0);
  });
  it("keeps an authored step count through the project save whitelist, including an explicit 0", () => {
    // Break: normalizeSystemRecords is a whitelist. A missing field vanishes on one save/load,
    // so a monster game that turned grace off (0) or set 12 silently returns to the default 4.
    expect(normalizeSystemRecords({ startActorIds: [] }).escapeGraceSteps).toBeUndefined();
    expect(normalizeSystemRecords({ startActorIds: [], escapeGraceSteps: 0 }).escapeGraceSteps).toBe(0);
    expect(normalizeSystemRecords({ startActorIds: [], escapeGraceSteps: 12.8 }).escapeGraceSteps).toBe(12);
    expect(normalizeSystemRecords({ startActorIds: [], escapeGraceSteps: 500 }).escapeGraceSteps).toBe(99);
    expect(normalizeSystemRecords({ startActorIds: [], escapeGraceSteps: Number.NaN }).escapeGraceSteps).toBeUndefined();
    const kept = normalizeSystemRecords({ startActorIds: [], escapeGraceSteps: 0, battleParty: "monsters" });
    expect(escapeGraceStepsOf({ system: kept })).toBe(0);
  });
  it("suppresses exactly N steps, then the session field disappears", () => {
    const { project, session } = setup();
    grantEscapeGrace(project, session);
    expect(session.encounterGuard).toEqual({ graceSteps: 4 });
    const results = Array.from({ length: 6 }, () => tickEncounterGuard(session).suppress);
    expect(results).toEqual([true, true, true, true, false, false]);
    expect("encounterGuard" in session).toBe(false);
  });
});

describe("repellent", () => {
  it("uses steps, refuses stacking, announces the end and clears the guard", () => {
    const { project, session } = setup();
    const first = useItemFromMenu(project, session, "repel");
    expect(first).toMatchObject({ kind: "used" });
    expect(session.encounterGuard).toMatchObject({ repelSteps: 3, repelItemId: "repel" });
    expect(session.inventory.repel).toBe(1);
    expect(useItemFromMenu(project, session, "repel")).toMatchObject({ kind: "unusable" });
    expect(session.inventory.repel).toBe(1);
    expect(tickEncounterGuard(session)).toMatchObject({ suppress: true });
    expect(tickEncounterGuard(session)).toMatchObject({ suppress: true });
    const last = tickEncounterGuard(session);
    expect(last).toMatchObject({ suppress: true, expiredItemId: "repel" });
    expect(session.encounterGuard).toBeUndefined();
    expect(tickEncounterGuard(session).suppress).toBe(false);
  });
  it("below-lead mode never suppresses before the roll and blocks only weaker wild monsters", () => {
    const { session } = setup();
    expect(applyRepel(session, { id: "r2", name: "강한 향", repelSteps: 4, repelBelowLead: true }).kind).toBe("used");
    expect(tickEncounterGuard(session)).toMatchObject({ suppress: false, repelBelowLead: true });
    expect(repelBlocksWildLevel(5, 8)).toBe(true);
    expect(repelBlocksWildLevel(8, 8)).toBe(false);
    expect(repelBlocksWildLevel(undefined, 8)).toBe(false);
  });
  it("derives the wild level from the encounter roll first, then the troop's enemies", () => {
    const { project } = setup();
    const troop = project.database.troops[0];
    expect(troopWildLevel(project, troop.id, 7)).toBe(7);
    expect(typeof troopWildLevel(project, troop.id)).toBe("number");
    expect(troopWildLevel(project, "missing")).toBeUndefined();
  });
});

describe("escape rope", () => {
  it("only works on dungeon maps and returns to the recorded entrance", () => {
    const { project, session } = setup();
    const dungeon = Object.values<any>(project.maps)[0];
    const outdoor = { id: "outdoor_x", mapRole: "field" as const };
    project.maps.outdoor_x = { ...structuredClone(dungeon), id: "outdoor_x", mapRole: "field" };
    project.maps[dungeon.id] = { ...dungeon, mapRole: "dungeon" };
    session.currentMapId = "outdoor_x";
    expect(useItemFromMenu(project, session, "rope")).toMatchObject({ kind: "unusable" });
    expect(session.inventory.rope).toBe(1);
    recordDungeonEntrance(session, outdoor as never, project.maps[dungeon.id], { x: 4, y: 5 });
    expect(session.encounterGuard?.entrance).toEqual({ mapId: "outdoor_x", x: 4, y: 5 });
    session.currentMapId = dungeon.id;
    const used = useItemFromMenu(project, session, "rope");
    expect(used).toMatchObject({ kind: "used", transfer: { mapId: "outdoor_x", x: 4, y: 5 } });
    expect(session.inventory.rope ?? 0).toBe(0);
    // dungeon → dungeon keeps the original entrance; leaving the dungeon forgets it.
    recordDungeonEntrance(session, project.maps[dungeon.id], project.maps[dungeon.id], { x: 1, y: 1 });
    expect(session.encounterGuard?.entrance).toEqual({ mapId: "outdoor_x", x: 4, y: 5 });
    recordDungeonEntrance(session, project.maps[dungeon.id], project.maps.outdoor_x, { x: 1, y: 1 });
    expect(session.encounterGuard).toBeUndefined();
  });
  it("falls back to the start point without a recorded entrance", () => {
    const { project, session } = setup();
    const here = Object.values<any>(project.maps).find((map) => map.id !== project.startMapId)!;
    project.maps[here.id] = { ...here, mapRole: "dungeon" };
    session.currentMapId = here.id;
    const rope = resolveEscapeRope(project, session, { name: "탈출 로프", escapeTo: "entrance" });
    expect(rope).toMatchObject({ kind: "ok", destination: { mapId: project.startMapId } });
  });
});

describe("save round trip", () => {
  it("keeps only valid, non-empty guard state", () => {
    expect(parseEncounterGuard(undefined)).toBeUndefined();
    expect(parseEncounterGuard({ graceSteps: 0, repelSteps: -4 })).toBeUndefined();
    expect(parseEncounterGuard({ graceSteps: 3, repelSteps: 9, repelItemId: "x", repelBelowLead: true, entrance: { mapId: "m", x: 1, y: 2 } }))
      .toEqual({ graceSteps: 3, repelSteps: 9, repelItemId: "x", repelBelowLead: true, entrance: { mapId: "m", x: 1, y: 2 } });
    expect(parseEncounterGuard({ entrance: { mapId: "m", x: 1.5, y: 2 } })).toBeUndefined();
    const roundTrip = parseEncounterGuard(JSON.parse(JSON.stringify({ graceSteps: 2 })));
    expect(roundTrip).toEqual({ graceSteps: 2 });
  });
});

describe("fishing pond finder", () => {
  it("only returns rectangles made entirely of water cells", () => {
    const water = { passage: "solid", label: "강물(바위 둑)" };
    const grass = { passage: "passable", label: "풀밭" };
    const project: any = { tilesets: { t: { tileMeta: [grass, water] } } };
    const map: any = { tilesetId: "t", width: 5, height: 4, lowerTiles: [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0] };
    expect(largestWaterRect(project, map)).toEqual({ x: 1, y: 1, w: 3, h: 2 });
    map.lowerTiles = map.lowerTiles.map(() => 0);
    expect(largestWaterRect(project, map)).toBeUndefined();
  });
});
