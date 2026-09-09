import { describe, expect, it } from "vitest";
import { createSampleAdventureProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { CHIPSET_TILE_GROUPS } from "@/project/defaults/chipsetMapping";
import fixture from "@/project/defaults/fixtures/dew-village-demo.json";
import { resolveEventPage } from "@/project/io";

const DEMO_TITLE = fixture.meta.title;
const DEMO_TITLE_SHORT = fixture.system.titleScreen.title;
const SW_QUEST = "sw_0001";
const SW_BELL = "sw_0002";
const SW_DONE = "sw_0003";

describe("sample adventure demo (이슬 마을의 종)", () => {
  it("ships the editor-authored dew village fixture, not the old lantern village", () => {
    const project = createSampleAdventureProject();

    expect(project.meta.title).toBe(DEMO_TITLE);
    expect(project.system.titleScreen?.title).toBe(DEMO_TITLE_SHORT);
    expect(Object.keys(project.maps).sort()).toEqual(Object.keys(fixture.maps).sort());
    expect(project.startMapId).toBe(fixture.startMapId);
    expect(JSON.stringify(project)).not.toContain("별등");
    expect(JSON.stringify(project)).not.toContain("map_lantern");

    const maps = Object.values(project.maps);
    expect(maps.map((map) => map.id)).toEqual(expect.arrayContaining([
      "map_village_30_100x100", "map_mine_entrance", "map_bell_shrine",
    ]));

    for (const switchId of [SW_QUEST, SW_BELL, SW_DONE]) {
      expect(project.switches.some((entry) => entry.id === switchId), `missing switch ${switchId}`).toBe(true);
    }

    const allCommands = Object.values(project.maps)
      .flatMap((map) => map.events)
      .flatMap((event) => event.pages ?? [])
      .flatMap((page) => page.commands);

    expect(allCommands.some((command) => command.kind === "battleProcessing")).toBe(true);
    expect(allCommands.some((command) => command.kind === "choices")).toBe(true);
    expect(allCommands.some((command) => command.kind === "changeItem")).toBe(true);
    expect(allCommands.some((command) => command.kind === "ending")).toBe(true);
    expect(allCommands.some((command) => command.kind === "transfer")).toBe(true);
    expect(allCommands.some((command) => command.kind === "setSwitch")).toBe(true);
  });

  it("has a short playable quest loop with dialogue, battle, transfers, and ending", () => {
    const project = createSampleAdventureProject();
    const events = Object.values(project.maps).flatMap((map) => map.events);
    const pages = events.flatMap((event) => event.pages ?? []);
    const commands = pages.flatMap((page) => page.commands);
    const dialogueCount = commands.filter((command) => command.kind === "text").length;
    const battleCount = commands.filter((command) => command.kind === "battleProcessing").length;
    const transferCount = commands.filter((command) => command.kind === "transfer").length;

    expect(events.length).toBeGreaterThanOrEqual(6);
    expect(dialogueCount).toBeGreaterThanOrEqual(8);
    expect(battleCount).toBeGreaterThanOrEqual(1);
    expect(transferCount).toBeGreaterThanOrEqual(2);
    expect(pages.some((page) => page.conditions.some((c) => c.kind === "switch"))).toBe(true);
  });

  it("starts in a decorated village map with path and water, not a bare grass pad", () => {
    const project = createSampleAdventureProject();
    const village = project.maps[project.startMapId];
    if (!village) throw new Error("missing village map");

    // The current market fixture uses sand paths/plazas, not the old dirt palette tile.
    const pathTiles = village.lowerTiles.filter((tile) => CHIPSET_TILE_GROUPS.sandGround.some((candidate) => candidate === tile)).length;
    const waterTiles = village.lowerTiles.filter((tile) => tile === TILE.WATER).length;
    expect(pathTiles).toBeGreaterThanOrEqual(20);
    expect(waterTiles).toBeGreaterThanOrEqual(10);
  });

  it("uses distinct EasyRPG character graphics for major NPC roles", () => {
    const project = createSampleAdventureProject();
    const visibleGraphics = Object.values(project.maps)
      .flatMap((map) => map.events)
      .flatMap((event) => event.pages ?? [])
      .map((page) => page.graphic)
      .filter((graphic) => !graphic.transparent)
      .map((graphic) => `${graphic.sprite?.id}:${graphic.pattern}`);

    expect(new Set(visibleGraphics).size).toBeGreaterThanOrEqual(3);
    expect(visibleGraphics.every((graphic) => graphic.startsWith("tex_easyrpg_charset_"))).toBe(true);
  });

  it("includes quest NPCs and aftermath dialogue", () => {
    const project = createSampleAdventureProject();
    const elder = project.maps[project.startMapId].events.find((event) => event.id === "ev_mir_elder");
    const boss = project.maps.map_bell_shrine.events.find((event) => event.id === "ev_boss");
    if (!elder || !boss) throw new Error("Missing quest actors");
    const session = { switches: { sw_0005: true, sw_0006: false }, variables: {}, inventory: {}, partyActorIds: [] };
    const encounter = resolveEventPage(boss, session);
    expect(encounter?.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "battleProcessing" }),
      expect.objectContaining({ kind: "setSwitch", switchId: "sw_0006", value: true }),
      expect.objectContaining({ kind: "ending" }),
    ]));
    session.switches.sw_0006 = true;
    expect(resolveEventPage(boss, session)?.commands.map((command) => command.kind)).toEqual(["text"]);
    expect(resolveEventPage(elder, session)?.id).toBe("p6");
    expect(resolveEventPage(elder, session)?.commands.map((command) => command.kind)).toEqual(["text"]);
  });
});
