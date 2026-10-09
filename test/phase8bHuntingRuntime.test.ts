import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import {
  advanceFieldSpawns,
  createFieldSpawnRuntime,
  fieldSpawnAliveCount,
  materializeFieldSpawnEvents,
  resolveFieldSpawnVictory,
} from "@/player/fieldSpawns";
import { eligibleEncounterEntries, pickWeightedEncounterTroop } from "@/player/encounters";
import { createSaveSnapshot, applySaveSnapshot } from "@/player/saveSlots";
import { startSession } from "@/project/session";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { mulberry32 } from "@/util/rng";
import { runSceneTest } from "@/testing/sceneTestRunner";
import {
  createPhase8bHuntingFixture,
  HUNTING_PROMOTED_CLASS_ID,
  HUNTING_PROMOTION_SWITCH_ID,
  phase8bPromotionEvent,
} from "./fixtures/huntingPhase8bFixture";

describe("Phase 8b hunting encounters", () => {
  it("selects weighted encounter entries with a fixed seeded distribution", () => {
    const rng = mulberry32(20260709);
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let index = 0; index < 4000; index += 1) {
      const troopId = pickWeightedEncounterTroop([
        { troopId: "a", weight: 1 },
        { troopId: "b", weight: 3 },
      ], rng);
      if (troopId) counts[troopId] += 1;
    }

    const ratio = counts.b / counts.a;
    expect(ratio).toBeGreaterThan(2.7);
    expect(ratio).toBeLessThan(3.3);
  });

  it("filters encounters by switch, variable, party level, and region", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const hero = project.database.actors[0];
    if (!map || !hero) throw new Error("fixture missing");
    project.switches.push({ id: "sw_gate", name: "게이트" });
    project.variables.push({ id: "var_rank", name: "사냥 등급" });
    map.encounterTable = [
      { troopId: "troop_base", weight: 1 },
      { troopId: "troop_switch", weight: 1, conditions: { switchId: "sw_gate" } },
      { troopId: "troop_variable", weight: 1, conditions: { variableId: "var_rank", atLeast: 2 } },
      { troopId: "troop_level", weight: 1, conditions: { minPartyLevel: 5 } },
      { troopId: "troop_region", weight: 1, conditions: { region: { x: 4, y: 0, w: 3, h: 3 } } },
    ];
    const session = startSession(project, 1);
    session.partyActorIds = [hero.id];
    session.actorLevels[hero.id] = 1;

    expect(eligibleEncounterEntries(map, session, { x: 1, y: 1 }).map((entry) => entry.troopId)).toEqual(["troop_base"]);

    session.switches.sw_gate = true;
    session.variables.var_rank = 2;
    session.actorLevels[hero.id] = 5;
    expect(eligibleEncounterEntries(map, session, { x: 5, y: 1 }).map((entry) => entry.troopId)).toEqual([
      "troop_base",
      "troop_switch",
      "troop_variable",
      "troop_level",
      "troop_region",
    ]);
  });
});

describe("Phase 8b field spawns", () => {
  it("respects maxAlive, respawnSec, and deterministic passable-cell selection", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const troopId = project.database.troops[0]?.id;
    if (!map || !troopId) throw new Error("fixture missing");
    map.lowerTiles[1] = TILE.WALL;
    map.fieldSpawns = [{ id: "spawn_test", troopId, area: { x: 0, y: 0, w: 4, h: 1 }, maxAlive: 2, respawnSec: 2 }];

    const state = createFieldSpawnRuntime(project, map, { x: 0, y: 0 });
    expect(materializeFieldSpawnEvents(state).map((event) => [event.x, event.y])).toEqual([[2, 0], [3, 0]]);

    const firstEventId = materializeFieldSpawnEvents(state)[0]?.id;
    expect(firstEventId).toBeDefined();
    resolveFieldSpawnVictory(state, firstEventId ?? "");
    expect(fieldSpawnAliveCount(state)).toBe(1);

    expect(advanceFieldSpawns(state, project, map, { x: 0, y: 0 }, 1000)).toBe(false);
    expect(fieldSpawnAliveCount(state)).toBe(1);
    expect(advanceFieldSpawns(state, project, map, { x: 0, y: 0 }, 1000)).toBe(true);
    expect(materializeFieldSpawnEvents(state).map((event) => [event.x, event.y])).toEqual([[3, 0], [2, 0]]);
  });

  it("does not serialize field spawn runtime state and starts fresh after load", () => {
    const project = createPhase8bHuntingFixture();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("fixture missing");
    const session = startSession(project, 1);
    const state = createFieldSpawnRuntime(project, map, { x: session.x, y: session.y });
    const firstEventId = materializeFieldSpawnEvents(state)[0]?.id;
    resolveFieldSpawnVictory(state, firstEventId ?? "");
    expect(fieldSpawnAliveCount(state)).toBe(2);

    const snapshot = createSaveSnapshot(project, session);
    expect(JSON.stringify(snapshot)).not.toContain("__field_spawn__");
    const restored = applySaveSnapshot(project, snapshot);
    const fresh = createFieldSpawnRuntime(project, map, { x: restored.x, y: restored.y });
    expect(fieldSpawnAliveCount(fresh)).toBe(3);
  });
});

describe("Phase 8b hunting tools and scene integration", () => {
  it("set_encounter_table and make_hunting_ground validate and write map hunting data", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    const troopId = context.project.database.troops[0]?.id;
    if (!troopId) throw new Error("troop missing");

    const table = runTool(context, "set_encounter_table", {
      mapId,
      entries: [{ troopId, weight: 2, conditions: { region: { x: 0, y: 0, w: 4, h: 4 } } }],
    });
    expect(table.ok, table.summary).toBe(true);
    expect(context.project.maps[mapId]?.encounterTable).toHaveLength(1);
    expect(runTool(context, "set_encounter_table", { mapId, entries: [{ troopId: "ghost", weight: 1 }] }).ok).toBe(false);

    const hunting = runTool(context, "make_hunting_ground", {
      mapId,
      area: { x: 1, y: 1, w: 3, h: 3 },
      troopId,
      maxAlive: 2,
      respawnSec: 4,
      chase: true,
    });
    expect(hunting.ok, hunting.summary).toBe(true);
    expect(context.project.maps[mapId]?.fieldSpawns?.[0]).toMatchObject({ troopId, maxAlive: 2, respawnSec: 4, chase: true });
  });

  it("run_scene_test enters battle on field-spawn contact, removes the spawn on victory, then respawns", () => {
    const project = createPhase8bHuntingFixture();
    const result = runSceneTest(project, {
      mapId: project.startMapId,
      start: { x: 1, y: 1 },
      steps: [
        { kind: "expect", fieldSpawnCount: 3 },
        { kind: "move", dir: "right" },
        { kind: "expect", fieldSpawnCount: 2 },
        { kind: "wait", ticks: 63 },
        { kind: "expect", fieldSpawnCount: 3 },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
    expect(result.session.battleResult).toBe("victory");
  });

  it("hunts repeatedly to level 5 and succeeds at first promotion headlessly", () => {
    const project = createPhase8bHuntingFixture();
    const map = project.maps[project.startMapId];
    const hero = project.database.actors[0];
    if (!map || !hero) throw new Error("fixture missing");
    map.events.push(phase8bPromotionEvent(hero.id));

    const steps = [
      { kind: "move" as const, dir: "right" as const },
      { kind: "wait" as const, ticks: 63 },
      { kind: "move" as const, dir: "right" as const },
      { kind: "wait" as const, ticks: 63 },
      { kind: "move" as const, dir: "right" as const },
      { kind: "wait" as const, ticks: 63 },
      { kind: "move" as const, dir: "right" as const },
      { kind: "interact" as const },
      { kind: "expect" as const, switchOn: HUNTING_PROMOTION_SWITCH_ID },
    ];
    const result = runSceneTest(project, { mapId: project.startMapId, start: { x: 1, y: 1 }, steps });

    expect(result.ok, result.failureReason).toBe(true);
    expect(result.session.actorLevels[hero.id]).toBe(5);
    expect(result.session.classOverrides[hero.id]).toBe(HUNTING_PROMOTED_CLASS_ID);
  });
});
