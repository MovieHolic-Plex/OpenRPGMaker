import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";

const ADVENTURE_MAP_IDS = [
  "map_lantern_village",
  "map_moonwell_forest",
  "map_old_copper_mine",
  "map_sky_lantern_shrine",
] as const;

const ADVENTURE_SWITCH_IDS = [
  "sw_lantern_quest_started",
  "sw_lantern_forest_seal",
  "sw_lantern_mine_seal",
  "sw_lantern_boss_clear",
] as const;

describe("default editor-authored adventure game", () => {
  it("ships a multi-map RPG made from editor events, variables, battles, and ending commands", () => {
    // Given: a new user opens the editor without importing a project.
    const project = createBlankProject();

    // Then: the built-in project is a playable game, not just an empty editing sample.
    expect(project.meta.title).toBe("별등 마을과 세 개의 봉인");
    expect(project.system.titleScreen).toBeDefined();
    expect(project.system.titleScreen?.title).toBe("별등 마을");
    expect(project.startMapId).toBe("map_lantern_village");
    for (const mapId of ADVENTURE_MAP_IDS) {
      expect(project.maps[mapId], `missing adventure map ${mapId}`).toBeDefined();
    }
    for (const switchId of ADVENTURE_SWITCH_IDS) {
      expect(project.switches.some((entry) => entry.id === switchId), `missing switch ${switchId}`).toBe(true);
      expect(project.session.switches[switchId]).toBe(false);
    }
    expect(project.variables.some((entry) => entry.id === "var_lantern_shards")).toBe(true);
    expect(project.session.variables.var_lantern_shards).toBe(0);

    const allCommands = Object.values(project.maps)
      .flatMap((map) => map.events)
      .flatMap((event) => event.pages ?? [])
      .flatMap((page) => page.commands);

    expect(allCommands.some((command) => command.kind === "battleProcessing")).toBe(true);
    expect(allCommands.some((command) => command.kind === "choices")).toBe(true);
    expect(allCommands.some((command) => command.kind === "changeItem")).toBe(true);
    expect(allCommands.some((command) => command.kind === "ending")).toBe(true);
  });

  it("has enough authored runtime material for an approximately 30 minute first playthrough", () => {
    const project = createBlankProject();
    const adventureMaps = ADVENTURE_MAP_IDS.map((mapId) => project.maps[mapId]);
    const events = adventureMaps.flatMap((map) => map.events);
    const pages = events.flatMap((event) => event.pages ?? []);
    const commands = pages.flatMap((page) => page.commands);
    const dialogueCount = commands.filter((command) => command.kind === "text").length;
    const battleCount = commands.filter((command) => command.kind === "battleProcessing").length;
    const transferCount = commands.filter((command) => command.kind === "transfer").length;

    expect(events.length).toBeGreaterThanOrEqual(18);
    expect(dialogueCount).toBeGreaterThanOrEqual(24);
    expect(battleCount).toBeGreaterThanOrEqual(4);
    expect(transferCount).toBeGreaterThanOrEqual(6);
    expect(project.maps.map_moonwell_forest?.encounterRate).toBeGreaterThan(0);
    expect(project.maps.map_old_copper_mine?.encounterRate).toBeGreaterThan(0);
  });

  it("starts in a visible village beside the sea, not a bare grass test map", () => {
    const project = createBlankProject();
    const village = project.maps.map_lantern_village;
    if (!village) throw new Error("missing village map");

    const waterTiles = village.lowerTiles.filter((tile) => tile === TILE.WATER).length;
    const sandTiles = village.lowerTiles.filter((tile) => tile === TILE.SAND).length;
    const houseDoorTiles = village.lowerTiles.filter((tile) => tile === 329 || tile === 359).length;
    const marketTiles = village.upperTiles.filter((tile) => tile === 411 || tile === 412 || tile === 413).length;

    expect(waterTiles).toBeGreaterThanOrEqual(120);
    expect(sandTiles).toBeGreaterThanOrEqual(40);
    expect(houseDoorTiles).toBeGreaterThanOrEqual(6);
    expect(marketTiles).toBeGreaterThanOrEqual(3);
  });

  it("uses distinct EasyRPG character graphics for major NPC roles", () => {
    const project = createBlankProject();
    const visibleGraphics = Object.values(project.maps)
      .flatMap((map) => map.events)
      .flatMap((event) => event.pages ?? [])
      .map((page) => page.graphic)
      .filter((graphic) => !graphic.transparent)
      .map((graphic) => `${graphic.sprite?.id}:${graphic.pattern}`);

    expect(new Set(visibleGraphics).size).toBeGreaterThanOrEqual(6);
    expect(visibleGraphics.every((graphic) => graphic.startsWith("tex_easyrpg_charset_"))).toBe(true);
  });

  it("includes moving NPCs, relationship dialogue, and editable village markdown documents", () => {
    const project = createBlankProject();
    const pages = Object.values(project.maps).flatMap((map) => map.events).flatMap((event) => event.pages ?? []);
    const movingNpcPages = pages.filter((page) => !page.graphic.transparent && page.movement.type !== "fixed");
    const serializedProject = JSON.stringify(project);

    expect(movingNpcPages.length).toBeGreaterThanOrEqual(8);
    expect(serializedProject).toContain("수문장");
    expect(serializedProject).toContain("치유사");
    expect(serializedProject).toContain("정찰병");
    expect(serializedProject).toContain("훈련 교관");
    expect(project.villageInfoDocuments?.length).toBeGreaterThanOrEqual(ADVENTURE_MAP_IDS.length);
    expect(project.villageInfoDocuments?.[0]?.title).toBe("별등 마을.md");
    expect(project.villageInfoDocuments?.[0]?.markdown).toContain("새 NPC를 추가할 때는 기존 인물 중 최소 한 명");
  });
});
