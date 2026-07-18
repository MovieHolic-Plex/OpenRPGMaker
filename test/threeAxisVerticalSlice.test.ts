import { describe, expect, it } from "vitest";
import { simulateBattle } from "@/battle/simulate";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { evolveMonster, giveMonster, monsterMaxHp } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import { interactWithFarmPlot, advanceFarmPlotsForDay, farmPlotAt, cropReady } from "@/player/farming";
import { normalizeItemRecord } from "@/project/databaseRecordModel";

/**
 * Contract: 10-minute vertical slices for the three product axes,
 * exercised through authoring tools + runtime APIs (no browser).
 */
describe("three-axis vertical slice contracts", () => {
  it("Pokemon: tools enable collection → starter gift → capture-ready troop → evolve", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;

    expect(runTool(ctx, "configure_monster_system", { enabled: true, battleParty: true }).ok).toBe(true);
    expect(ctx.project.system.monsterCollection).toBe(true);
    expect(ctx.project.system.battleParty === "monsters" || ctx.project.system.monsterBattleParty === true).toBe(true);

    expect(
      runTool(ctx, "set_type_chart", {
        types: ["fire", "water", "grass"],
        multipliers: {
          fire: { fire: 0.5, water: 0.5, grass: 2 },
          water: { fire: 2, water: 0.5, grass: 0.5 },
          grass: { fire: 0.5, water: 2, grass: 0.5 },
        },
      }).ok,
    ).toBe(true);

    const starter = runTool(ctx, "give_starter_monsters", {
      speciesIds: ["species_leafling", "species_sparkit", "species_aqualing"],
    });
    expect(starter.ok).toBe(true);
    const starterEvent = ctx.project.maps[mapId]?.events.find((e) => e.id === "ev_starter_monsters");
    expect(starterEvent?.pages?.[0]?.commands?.some((c) => c.kind === "choices")).toBe(true);

    // Runtime loop: gift slime → evolve at level gate
    const session = startSession(ctx.project, 11);
    const gift = giveMonster(ctx.project, session, { speciesId: "species_wild_slime", level: 7 });
    expect(gift.ok).toBe(true);
    if (!gift.ok) throw new Error("gift");
    const evo = evolveMonster(ctx.project, session, { instanceId: gift.instance.instanceId });
    expect(evo.ok && evo.toSpeciesId).toBe("species_king_slime");
    expect(monsterMaxHp(ctx.project, session.monsterInstances[gift.instance.instanceId])).toBeGreaterThan(0);

    // Headless monster battle path
    const battle = simulateBattle({
      project: ctx.project,
      troopId: "troop_slime",
      heroLevel: 1,
      battleFlow: "strict",
      n: 1,
      seed: 2,
      monsterParty: [session.monsterInstances[gift.instance.instanceId]!],
      maxSteps: 20,
    });
    expect(battle.participatingActorIds).toContain(gift.instance.instanceId);
  });

  it("Stardew: configure time → farm plot → till/plant/water/grow/harvest", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;

    expect(runTool(ctx, "configure_time_system", { enabled: true, minutesPerRealSecond: 60 }).ok).toBe(true);
    expect(ctx.project.system.timeSystem?.enabled).toBe(true);

    // seed + harvest items
    ctx.project.database.items.push(
      normalizeItemRecord({ id: "item_vslice_seed", name: "슬라이스 씨앗", scope: "none", price: 5 }),
      normalizeItemRecord({ id: "item_vslice_crop", name: "슬라이스 작물", scope: "none", price: 20 }),
      normalizeItemRecord({ id: "item_vslice_hoe", name: "괭이", scope: "none", price: 0, farmTool: "hoe" }),
      normalizeItemRecord({ id: "item_vslice_can", name: "물뿌리개", scope: "none", price: 0, farmTool: "wateringCan" }),
    );

    expect(
      runTool(ctx, "define_crop", {
        crop: {
          id: "crop_vslice",
          name: "슬라이스 작물",
          seedItemId: "item_vslice_seed",
          harvestItemId: "item_vslice_crop",
          stages: [{ days: 1 }, { days: 1 }],
          seasons: ["spring"],
        },
      }).ok,
    ).toBe(true);

    expect(runTool(ctx, "create_farm_plot", { mapId, area: { x: 3, y: 3, w: 2, h: 2 } }).ok).toBe(true);

    const session = startSession(ctx.project, 12);
    session.inventory.item_vslice_seed = 2;
    session.inventory.item_vslice_hoe = 1;
    session.inventory.item_vslice_can = 1;
    const map = ctx.project.maps[mapId]!;

    expect(interactWithFarmPlot(ctx.project, session, map, 3, 3).kind).toBe("tilled");
    expect(interactWithFarmPlot(ctx.project, session, map, 3, 3).kind).toBe("planted");
    expect(interactWithFarmPlot(ctx.project, session, map, 3, 3).kind).toBe("watered");
    advanceFarmPlotsForDay(ctx.project, session, 1, "spring");
    expect(farmPlotAt(session, map.id, 3, 3)?.stage).toBe(1);
    expect(interactWithFarmPlot(ctx.project, session, map, 3, 3).kind).toBe("watered");
    advanceFarmPlotsForDay(ctx.project, session, 1, "spring");
    const ready = farmPlotAt(session, map.id, 3, 3);
    expect(cropReady(ctx.project, ready)).toBe(true);
    expect(interactWithFarmPlot(ctx.project, session, map, 3, 3).kind).toBe("harvested");
    expect(session.inventory.item_vslice_crop).toBeGreaterThanOrEqual(1);
  });

  it("JRPG: hunting ground + encounter table + promotion tool path", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const troopId = ctx.project.database.troops[0]?.id;
    if (!troopId) throw new Error("missing troop");
    const classId = ctx.project.database.classes[0]?.id;
    const toClassId = ctx.project.database.classes[1]?.id ?? classId;
    if (!classId || !toClassId) throw new Error("missing class");

    expect(
      runTool(ctx, "set_encounter_table", {
        mapId,
        entries: [{ troopId, weight: 3, conditions: { region: { x: 0, y: 0, w: 6, h: 6 } } }],
      }).ok,
    ).toBe(true);

    expect(
      runTool(ctx, "make_hunting_ground", {
        mapId,
        area: { x: 1, y: 1, w: 4, h: 4 },
        troopId,
        maxAlive: 2,
        respawnSec: 5,
      }).ok,
    ).toBe(true);

    const map = ctx.project.maps[mapId]!;
    expect(map.encounterTable?.length).toBeGreaterThan(0);
    expect(JSON.stringify(map)).toMatch(/fieldSpawn|encounterTable|troop/);

    if (classId !== toClassId) {
      expect(
        runTool(ctx, "define_promotion", {
          classId,
          toClassId,
          requires: { level: 5 },
        }).ok,
      ).toBe(true);
      const klass = ctx.project.database.classes.find((c) => c.id === classId);
      expect(klass?.promotions?.some((p) => p.toClassId === toClassId)).toBe(true);
    }

    // Boss-style troop still simulatable
    const battle = simulateBattle({
      project: ctx.project,
      troopId,
      heroLevel: 10,
      battleFlow: "strict",
      n: 1,
      seed: 5,
      maxSteps: 40,
    });
    expect(battle.participatingActorIds.length).toBeGreaterThan(0);
  });
});
