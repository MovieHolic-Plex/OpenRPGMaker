import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

const EXTRA_COLLECTIONS = [
  "monsterSpecies",
  "crops",
  "lifeSkills",
  "farmAnimalSpecies",
  "fishSpecies",
  "farmBuildingTypes",
  "homeDecorationTypes",
] as const;

type ExtraCollection = (typeof EXTRA_COLLECTIONS)[number];

function contextWithRecord(collection: ExtraCollection): ToolContext {
  const project = createBlankProject();
  const itemId = project.database.items[0]?.id;
  if (!itemId) throw new Error("blank project must contain an item fixture");

  switch (collection) {
    case "monsterSpecies": {
      const source = project.database.monsterSpecies?.[0];
      if (!source) throw new Error("blank project must contain a monster species fixture");
      project.database.enemies.forEach((enemy) => delete enemy.speciesId);
      project.database.monsterSpecies = [{ ...structuredClone(source), id: "record_source", name: "원본" }];
      break;
    }
    case "crops":
      project.database.crops = [{
        id: "record_source",
        name: "원본",
        seedItemId: itemId,
        harvestItemId: itemId,
        harvestCount: 1,
        stages: [{ days: 1 }],
        seasons: ["spring"],
      }];
      break;
    case "lifeSkills":
      project.database.lifeSkills = [{
        id: "record_source",
        name: "원본",
        skillType: "farming",
        maxLevel: 10,
        levelUpRewards: [],
      }];
      break;
    case "farmAnimalSpecies":
      project.database.farmAnimalSpecies = [{
        id: "record_source",
        name: "원본",
        feedItemId: itemId,
        productItemId: itemId,
        productCount: 1,
        productEveryDays: 1,
        petFriendship: 0,
      }];
      break;
    case "fishSpecies":
      project.database.fishSpecies = [{ id: "record_source", name: "원본", itemId }];
      break;
    case "farmBuildingTypes":
      project.database.farmBuildingTypes = [{
        id: "record_source",
        name: "원본",
        levels: [{
          level: 1,
          footprint: { width: 1, height: 1 },
          capacity: 1,
          graphicResourceId: "oprn-title-field",
        }],
      }];
      break;
    case "homeDecorationTypes":
      project.database.homeDecorationTypes = [{
        id: "record_source",
        name: "원본",
        placementItemId: itemId,
        footprint: { width: 1, height: 1 },
        blocksMovement: true,
        allowedOrientations: ["down"],
        graphicResourceId: "oprn-title-field",
      }];
      break;
  }
  return { project };
}

function records(project: Project, collection: ExtraCollection): readonly { id: string; name: string }[] {
  return project.database[collection] ?? [];
}

describe("database record reach", () => {
  it.each(EXTRA_COLLECTIONS)("duplicates %s with a new id", (collection) => {
    const ctx = contextWithRecord(collection);

    const result = runTool(ctx, "duplicate_database_record", {
      collection,
      id: "record_source",
      newId: "record_copy",
      name: "복제본",
    });

    expect(result.ok, result.summary).toBe(true);
    expect(records(ctx.project, collection).find((record) => record.id === "record_copy")).toMatchObject({
      id: "record_copy",
      name: "복제본",
    });
  });

  it.each(EXTRA_COLLECTIONS)("deletes %s", (collection) => {
    const ctx = contextWithRecord(collection);

    const result = runTool(ctx, "delete_database_record", { collection, id: "record_source" });

    expect(result.ok, result.summary).toBe(true);
    expect(records(ctx.project, collection).some((record) => record.id === "record_source")).toBe(false);
  });

  it.each(["duplicate_database_record", "delete_database_record"] as const)(
    "%s rejects an unknown collection and names valid values",
    (tool) => {
      const ctx = contextWithRecord("lifeSkills");
      const result = runTool(ctx, tool, {
        collection: "unknownRecords",
        id: "record_source",
        ...(tool === "duplicate_database_record" ? { newId: "record_copy" } : {}),
      });

      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.message).toContain("monsterSpecies");
      expect(result.issues?.[0]?.message).toContain("homeDecorationTypes");
    },
  );
});

describe("title screen effect reach", () => {
  it("writes background layers, particles, and intro", () => {
    const ctx: ToolContext = { project: createBlankProject() };

    const result = runTool(ctx, "set_title_screen", {
      backgroundLayers: [
        { resourceId: "title_sky", scrollXPerSec: 4, scrollYPerSec: -2, parallax: 0.5, opacity: 0.8 },
      ],
      particles: { preset: "snow", density: 0.4 },
      intro: { logo: "riseIn", menu: "slideUp", delayMs: 300, staggerMs: 80 },
    });

    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.system.titleScreen?.backgroundLayers).toEqual([
      { resourceId: "title_sky", scrollXPerSec: 4, scrollYPerSec: -2, parallax: 0.5, opacity: 0.8 },
    ]);
    expect(ctx.project.system.titleScreen?.particles).toEqual({ preset: "snow", density: 0.4 });
    expect(ctx.project.system.titleScreen?.intro).toEqual({
      logo: "riseIn",
      menu: "slideUp",
      delayMs: 300,
      staggerMs: 80,
    });
  });

  it("omitting an effect section preserves it", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const titleScreen = ctx.project.system.titleScreen;
    if (!titleScreen) throw new Error("blank project must contain title screen settings");
    titleScreen.backgroundLayers = [{ resourceId: "kept_layer", opacity: 0.6 }];
    titleScreen.particles = { preset: "fireflies", density: 12 };
    titleScreen.intro = { logo: "fadeIn", menu: "fadeIn", delayMs: 100, staggerMs: 20 };

    const result = runTool(ctx, "set_title_screen", { particles: { preset: "rain", density: 30 } });

    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.system.titleScreen?.backgroundLayers).toEqual([{ resourceId: "kept_layer", opacity: 0.6 }]);
    expect(ctx.project.system.titleScreen?.particles).toEqual({ preset: "rain", density: 30 });
    expect(ctx.project.system.titleScreen?.intro).toEqual({
      logo: "fadeIn",
      menu: "fadeIn",
      delayMs: 100,
      staggerMs: 20,
    });
  });

  it("rejects more than four background layers", () => {
    const ctx: ToolContext = { project: createBlankProject() };

    const result = runTool(ctx, "set_title_screen", {
      backgroundLayers: Array.from({ length: 5 }, (_, index) => ({ resourceId: `title_layer_${index}` })),
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.message).toContain("최대 4개");
  });

  it("rejects invalid effects and names valid particle presets", () => {
    const ctx: ToolContext = { project: createBlankProject() };

    const result = runTool(ctx, "set_title_screen", { particles: { preset: "mist" } });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.message).toContain("snow");
    expect(result.issues?.[0]?.message).toContain("rain");
    expect(result.issues?.[0]?.message).toContain("fireflies");
  });
});
