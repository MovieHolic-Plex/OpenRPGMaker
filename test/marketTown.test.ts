import { describe, expect, it } from "vitest";
import { DEFAULT_ITEM_ID, TILE } from "@/project/defaults";
import { createMarketTownProject } from "@/project/defaults/defaultProject";
import { createMarketTownMap, marketTownStartPos } from "@/project/defaults/marketTownMap";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";
import type { Command, GameMap } from "@/project/types";

const DB_DOOR_TOP = 329;
const DB_DOOR_BOTTOM = 359;
const TOWN_PATH_TILES = new Set<number>(Object.values(SAND_TILE));
/** 장터 카운터 (천막 411–443 금지) */
const MARKET_COUNTER_TILES = new Set([234, 235, 236]);
const WOOD_FLOOR_BODY = 222;
const TREE_TILE = 260;
const TREE_BOTTOM_TILE = 290;
const QUEST_BOARD_SIGN_TILE = 320;

function at(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

function countLowerDoorPairs(map: GameMap): number {
  let count = 0;
  for (let index = 0; index < map.lowerTiles.length - map.width; index += 1) {
    if (map.lowerTiles[index] === DB_DOOR_TOP && map.lowerTiles[index + map.width] === DB_DOOR_BOTTOM) count += 1;
  }
  return count;
}

function mapCommands(map: GameMap): Command[] {
  const commands: Command[] = [];
  for (const event of map.events) {
    collectCommands(event.commands, commands);
    for (const page of event.pages ?? []) collectCommands(page.commands, commands);
  }
  return commands;
}

function collectCommands(source: readonly Command[], target: Command[]): void {
  for (const command of source) {
    target.push(command);
    if (command.kind === "choices") {
      for (const option of command.options) collectCommands(option.branch, target);
      if (command.cancelBranch) collectCommands(command.cancelBranch, target);
    }
    if (command.kind === "fork") {
      collectCommands(command.then, target);
      if (command.else) collectCommands(command.else, target);
    }
    if (command.kind === "loop") collectCommands(command.body, target);
    if (command.kind === "shop" && command.transactionBranch) collectCommands(command.transactionBranch, target);
  }
}

describe("market town map", () => {
  it("builds a 60x60 grid-road city centered on a market square", () => {
    const map = createMarketTownMap();

    expect(map.name).toBe("시장 마을");
    expect(map.width).toBe(60);
    expect(map.height).toBe(60);
    expect(map.tilesetId).toBe("easyrpg_chipset_combined_town");
    expect(map.lowerTiles).toHaveLength(60 * 60);
    expect(map.upperTiles).toHaveLength(60 * 60);

    // 주택 8채 → DB 도어 쌍 8개
    expect(countLowerDoorPairs(map)).toBe(8);

    // 시장 나무 데크 + 카운터 (천막 없음)
    const woodFloorCount = map.lowerTiles.filter((tile) => tile === WOOD_FLOOR_BODY).length;
    expect(woodFloorCount).toBeGreaterThanOrEqual(40);
    const counterCount = map.upperTiles.filter((tile) => MARKET_COUNTER_TILES.has(tile)).length;
    expect(counterCount).toBeGreaterThanOrEqual(8);
    const tentAwning = map.upperTiles.filter((tile) =>
      tile === 411 || tile === 412 || tile === 413 || tile === 441 || tile === 442 || tile === 443
    ).length;
    expect(tentAwning).toBe(0);
  });

  it("lays a connected grid road network with shaped sand edges", () => {
    const map = createMarketTownMap();

    // 가로/세로 주 도로 라인이 모래길로 채워져 있어야 한다.
    const sampleRoadPoints = [
      { x: 5, y: 16 }, // 가로 도로 y=15
      { x: 30, y: 31 }, // 가로 도로 y=30
      { x: 16, y: 5 }, // 세로 도로 x=15
      { x: 46, y: 30 }, // 세로 도로 x=45
    ];
    for (const point of sampleRoadPoints) {
      const tile = map.lowerTiles[at(map, point.x, point.y)] ?? TILE.EMPTY;
      expect(TOWN_PATH_TILES.has(tile)).toBe(true);
    }

    // 모래길 위에는 upper 오브젝트가 덮이지 않아야 한다 (통행 확보).
    for (let index = 0; index < map.lowerTiles.length; index += 1) {
      const lower = map.lowerTiles[index] ?? TILE.EMPTY;
      if (TOWN_PATH_TILES.has(lower)) expect(map.upperTiles[index]).toBe(TILE.EMPTY);
    }
  });

  it("frames the town with trees and decorates each neighborhood block", () => {
    const map = createMarketTownMap();

    // 외곽 테두리가 나무로 둘러싸여 있다.
    expect(map.upperTiles[at(map, 5, 0)]).toBe(TREE_TILE);
    expect(map.upperTiles[at(map, 0, 5)]).toBe(TREE_BOTTOM_TILE);
    expect(map.upperTiles[at(map, 59, 5)]).toBe(TREE_BOTTOM_TILE);
    expect(map.upperTiles[at(map, 5, 59)]).toBe(TREE_BOTTOM_TILE);

    const treeCount = map.upperTiles.filter((tile) => tile === TREE_TILE).length;
    expect(treeCount).toBeGreaterThan(100);
  });

  it("populates the market square with shopkeepers and wandering residents", () => {
    const map = createMarketTownMap();
    const start = marketTownStartPos();

    // 시작 위치가 시장 광장 입구(중앙 근처)에 있다.
    expect(start.x).toBeGreaterThanOrEqual(18);
    expect(start.x).toBeLessThanOrEqual(29);
    expect(start.y).toBeGreaterThanOrEqual(18);
    expect(start.y).toBeLessThanOrEqual(33);

    // 상점 NPC(shop 커맨드)와 마을 주민(text 커맨드) 이벤트가 모두 있다.
    const shopEvents = map.events.filter((event) => event.pages?.some((page) => page.commands?.some((command) => command.kind === "shop")));
    expect(shopEvents.length).toBeGreaterThanOrEqual(1);

    const residentEvents = map.events.filter((event) => event.id.startsWith("event_market_resident_"));
    expect(residentEvents.length).toBeGreaterThanOrEqual(8);

    for (const resident of residentEvents) {
      const page = resident.pages?.[0];
      if (!page) throw new Error(`missing event page for ${resident.id}`);
      expect(page.movement).toEqual({ type: "random", speed: 3, frequency: 4 });
      expect(page.trigger).toEqual({ kind: "action" });
      expect(page.priority).toBe("same");
      expect(page.graphic.sprite?.type).toBe("bundled");
      expect(page.graphic.sprite?.id).toContain("tex_easyrpg_charset_");
      expect(page.commands.some((command) => command.kind === "text" && Boolean(command.body))).toBe(true);
    }
  });

  it("places working shops, quest progression, rewards, and road monsters", () => {
    const project = createMarketTownProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing market town start map");
    const commands = mapCommands(map);
    const shopCommands = commands.filter((command) => command.kind === "shop");
    const battleCommands = commands.filter((command) => command.kind === "battleProcessing");
    const switchCommands = commands.filter((command) => command.kind === "setSwitch");
    const variableCommands = commands.filter((command) => command.kind === "setVariable");
    const rewardItems = commands.filter((command) => command.kind === "changeItem");
    const rewardGold = commands.filter((command) => command.kind === "changeGold");
    const databaseItemIds = new Set(project.database.items.map((item) => item.id));
    const databaseTroopIds = new Set(project.database.troops.map((troop) => troop.id));
    const switchIds = new Set(project.switches.map((entry) => entry.id));
    const variableIds = new Set(project.variables.map((entry) => entry.id));

    expect(shopCommands).toHaveLength(2);
    expect(shopCommands.flatMap((command) => command.itemIds)).toEqual(
      expect.arrayContaining([DEFAULT_ITEM_ID, "item_ether", "item_antidote"])
    );
    for (const command of shopCommands) {
      for (const itemId of command.itemIds) expect(databaseItemIds.has(itemId)).toBe(true);
    }

    expect(battleCommands.map((command) => command.troopId)).toEqual(
      expect.arrayContaining(["troop_slime_pair", "troop_bat_swarm"])
    );
    for (const command of battleCommands) expect(databaseTroopIds.has(command.troopId)).toBe(true);

    expect(commands.some((command) => command.kind === "choices")).toBe(true);
    expect(switchCommands.map((command) => command.switchId)).toEqual(
      expect.arrayContaining(["sw_0001", "sw_0002", "sw_0003", "sw_0004"])
    );
    expect(variableCommands.map((command) => command.variableId)).toContain("var_0001");
    for (const switchId of ["sw_0001", "sw_0002", "sw_0003", "sw_0004"]) expect(switchIds.has(switchId)).toBe(true);
    expect(variableIds.has("var_0001")).toBe(true);
    expect(rewardItems.some((command) => command.itemId === DEFAULT_ITEM_ID && command.amount === 2)).toBe(true);
    expect(rewardGold.some((command) => typeof command.amount === "number" && command.amount >= 120)).toBe(true);

    const monsterEvents = map.events.filter((event) => event.id.includes("monster"));
    expect(monsterEvents).toHaveLength(2);
    for (const event of monsterEvents) {
      expect(event.pages?.some((page) => page.trigger.kind === "playerTouch")).toBe(true);
      expect(event.pages?.some((page) => page.graphic.sprite?.id.startsWith("tex_easyrpg_charset_monster"))).toBe(true);
    }
  });

  it("keeps every placed character on EasyRPG charset resources", () => {
    const map = createMarketTownMap();
    for (const event of map.events) {
      for (const page of event.pages ?? []) {
        const spriteId = page.graphic.sprite?.id;
        if (spriteId) expect(spriteId).toMatch(/^tex_easyrpg_charset_/);
      }
    }
  });

  it("places event sprites on readable ground and uses a tile sign for the quest board", () => {
    const map = createMarketTownMap();
    const eventsOnProps = map.events.filter((event) => {
      if (event.id === "event_market_quest_board") return false;
      return map.upperTiles[at(map, event.x, event.y)] !== TILE.EMPTY;
    });
    expect(eventsOnProps).toEqual([]);

    const questBoard = map.events.find((event) => event.id === "event_market_quest_board");
    if (!questBoard) throw new Error("missing quest board event");
    expect(map.upperTiles[at(map, questBoard.x, questBoard.y)]).toBe(QUEST_BOARD_SIGN_TILE);
    expect(questBoard.pages?.[0]?.graphic).toEqual({ transparent: true });
  });

  it("exposes the market town as a dev showcase project", () => {
    const project = createMarketTownProject();
    expect(Object.keys(project.maps)).toHaveLength(1);
    const map = Object.values(project.maps)[0];
    expect(map.name).toBe("시장 마을");
    expect(project.startPos).toEqual(marketTownStartPos());
  });
});
