// 고정 SE 상수 변형 풀 — 같은 시드는 같고, 다른 시드는 갈리며, 기본 호출은 상수 그대로다.
import { describe, expect, it } from "vitest";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { SE_CATALOG } from "@/assets/seCatalog";
import { findSeRuntimePath, isSeCatalogResourceId } from "@/assets/seCatalogRuntime";
import {
  CHEST_OPEN_SE_POOL,
  DOOR_CLOSE_SE_POOL,
  DOOR_OPEN_SE_POOL,
  LOOT_GOLD_SE_POOL,
  LOOT_ITEM_SE_POOL,
  SE_VARIANT_POOLS,
  pickSeVariant,
} from "@/assets/seThemeVariants";
import {
  HOUSE_DOOR_CLOSE_SE,
  HOUSE_DOOR_OPEN_SE,
  createHouseDoorEvent,
  createHouseInteriorMap,
  houseDoorOpenCommands,
} from "@/editor/houseInteriors";
import {
  CHEST_OPEN_SE,
  LOOT_GOLD_SE,
  LOOT_ITEM_SE,
  chestOpenCommands,
  lootGrantCommands,
  lootRummageCommands,
} from "@/editor/lootFeedback";
import type { EventPageGraphic } from "@/project/types";

const closedChest: EventPageGraphic = {
  sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" },
  direction: "down",
  pattern: charsetFrameIndex({ characterIndex: 6, direction: "down", pattern: 1 }),
};

function catalogId(resourceId: string): string {
  expect(isSeCatalogResourceId(resourceId), `${resourceId} 가 런타임 카탈로그에 없다`).toBe(true);
  expect(SE_CATALOG.some((entry) => entry.id === resourceId), `${resourceId} 가 SE_CATALOG 에 없다`).toBe(true);
  expect(findSeRuntimePath(resourceId), resourceId).toBeDefined();
  return resourceId;
}

function playAudioId(command: { kind: string; resourceId?: string } | undefined): string {
  expect(command?.kind).toBe("playAudio");
  return catalogId(command?.resourceId ?? "");
}

function poolIdsForSeeds(pool: readonly string[], seeds: readonly number[]): string[] {
  return [...new Set(seeds.map((seed) => pickSeVariant(pool, seed)))];
}

describe("pickSeVariant", () => {
  it("같은 시드는 결정적이고, 시드가 바뀌면 풀이 여러 개일 때 다른 id 를 고른다", () => {
    for (const pool of Object.values(SE_VARIANT_POOLS)) {
      expect(pickSeVariant(pool, 42)).toBe(pickSeVariant(pool, 42));
      expect(pickSeVariant(pool, 7)).toBe(pickSeVariant(pool, 7));
      const distinct = poolIdsForSeeds(pool, [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 99, 128, 256, 777, 2026]);
      expect(distinct.length, pool[0]).toBeGreaterThan(1);
      for (const id of distinct) {
        expect(pool).toContain(catalogId(id));
      }
    }
  });

  it("exclude 는 같은 시드에서 다른 후보로 밀어내고, 빈 풀·NaN 시드에서도 죽지 않는다", () => {
    const first = pickSeVariant(CHEST_OPEN_SE_POOL, 1);
    const second = pickSeVariant(CHEST_OPEN_SE_POOL, 1, [first]);
    expect(second).not.toBe(first);
    expect(CHEST_OPEN_SE_POOL).toContain(second);
    expect(pickSeVariant([], 1)).toBe("");
    expect(pickSeVariant(CHEST_OPEN_SE_POOL, Number.NaN)).toBe(pickSeVariant(CHEST_OPEN_SE_POOL, 1));
    expect(CHEST_OPEN_SE_POOL).toContain(pickSeVariant(CHEST_OPEN_SE_POOL, 1, [...CHEST_OPEN_SE_POOL]));
  });
});

describe("SE 변형 풀", () => {
  it("모든 후보 id 가 카탈로그·런타임에서 풀린다", () => {
    for (const pool of Object.values(SE_VARIANT_POOLS)) {
      expect(pool.length).toBeGreaterThanOrEqual(3);
      for (const id of pool) catalogId(id);
    }
    expect(DOOR_OPEN_SE_POOL.length).toBe(DOOR_CLOSE_SE_POOL.length);
    expect(DOOR_OPEN_SE_POOL).not.toContain("cc0-se-orp-world-door");
    expect(DOOR_OPEN_SE_POOL).not.toContain("cc0-se-kra-creak1");
    expect(DOOR_OPEN_SE_POOL).not.toContain("cc0-se-osx-door-01");
    expect(DOOR_OPEN_SE_POOL).not.toContain("cc0-se-osx-door-02");
    expect(LOOT_ITEM_SE_POOL).not.toContain("cc0-se-kjg-8-bit-jingles-jingles-nes02");
    expect(LOOT_ITEM_SE_POOL).not.toContain("cc0-se-kjg-8-bit-jingles-jingles-nes15");
  });

  it("기본 상수는 각 풀의 첫 항목이고 시드 없는 호출은 그 상수를 쓴다", () => {
    expect(CHEST_OPEN_SE).toBe(CHEST_OPEN_SE_POOL[0]);
    expect(LOOT_GOLD_SE).toBe(LOOT_GOLD_SE_POOL[0]);
    expect(LOOT_ITEM_SE).toBe(LOOT_ITEM_SE_POOL[0]);
    expect(HOUSE_DOOR_OPEN_SE).toBe(DOOR_OPEN_SE_POOL[0]);
    expect(HOUSE_DOOR_CLOSE_SE).toBe(DOOR_CLOSE_SE_POOL[0]);

    expect(playAudioId(chestOpenCommands("ev_chest_1", closedChest)[0])).toBe(CHEST_OPEN_SE);
    expect(playAudioId(lootRummageCommands()[0])).toBe(CHEST_OPEN_SE);
    expect(playAudioId(lootGrantCommands({ gold: 10 })[0])).toBe(LOOT_GOLD_SE);
    expect(playAudioId(lootGrantCommands({ itemId: "item_potion" })[0])).toBe(LOOT_ITEM_SE);
    expect(
      playAudioId(
        houseDoorOpenCommands({ eventId: "ev_door", interiorMapId: "map_in", kitId: "bright-plaster" })[0],
      ),
    ).toBe(HOUSE_DOOR_OPEN_SE);
  });

  it("시드를 넘기면 같은 시드는 같고 다른 시드는 풀 안에서 갈린다", () => {
    const openA = playAudioId(chestOpenCommands("ev_chest_1", closedChest, { seed: 11 })[0]);
    const openB = playAudioId(chestOpenCommands("ev_chest_1", closedChest, { seed: 11 })[0]);
    expect(openA).toBe(openB);
    expect(CHEST_OPEN_SE_POOL).toContain(openA);

    const rummage = playAudioId(lootRummageCommands({ seed: 11 })[0]);
    expect(rummage).toBe(openA);

    const goldIds = new Set<string>();
    const itemIds = new Set<string>();
    const doorIds = new Set<string>();
    for (const seed of [1, 2, 3, 8, 21, 55, 99, 256, 2026]) {
      goldIds.add(playAudioId(lootGrantCommands({ gold: 5 }, { seed })[0]));
      itemIds.add(playAudioId(lootGrantCommands({ itemId: "item_potion" }, { seed })[0]));
      doorIds.add(
        playAudioId(
          houseDoorOpenCommands({
            eventId: "ev_door",
            interiorMapId: "map_in",
            kitId: "bright-plaster",
            seed,
          })[0],
        ),
      );
    }
    expect(goldIds.size).toBeGreaterThan(1);
    expect(itemIds.size).toBeGreaterThan(1);
    expect(doorIds.size).toBeGreaterThan(1);
    for (const id of goldIds) expect(LOOT_GOLD_SE_POOL).toContain(id);
    for (const id of itemIds) expect(LOOT_ITEM_SE_POOL).toContain(id);
    for (const id of doorIds) expect(DOOR_OPEN_SE_POOL).toContain(id);
  });

  it("문 열기·닫기는 같은 시드에서 같은 인덱스(짝 패밀리)다", () => {
    expect(DOOR_OPEN_SE_POOL.length).toBe(DOOR_CLOSE_SE_POOL.length);
    for (const seed of [1, 7, 42, 99, 2026]) {
      const open = pickSeVariant(DOOR_OPEN_SE_POOL, seed);
      const close = pickSeVariant(DOOR_CLOSE_SE_POOL, seed);
      expect(DOOR_OPEN_SE_POOL.indexOf(open as (typeof DOOR_OPEN_SE_POOL)[number])).toBe(
        DOOR_CLOSE_SE_POOL.indexOf(close as (typeof DOOR_CLOSE_SE_POOL)[number]),
      );
    }
  });
});

describe("집 출구 이벤트 닫힘 SE", () => {
  it("같은 시드의 문 열기 이벤트와 실내 출구는 같은 풀 인덱스다", () => {
    for (const seed of [1, 7, 42, 99, 2026]) {
      const door = createHouseDoorEvent({
        eventId: "ev_door",
        x: 4,
        y: 7,
        interiorMapId: "map_in",
        kitId: "bright-plaster",
        seed,
      });
      const interior = createHouseInteriorMap({
        id: "map_se_variety_pair",
        name: "짝 테스트 집",
        returnMapId: "map_out",
        returnX: 4,
        returnY: 8,
        exitEventId: "ev_exit",
        seed,
      });
      const openId = playAudioId(door.pages?.[0]?.commands[0]);
      const exit = interior.map.events.find((event) => event.id === "ev_exit");
      const closeId = playAudioId(exit?.pages?.[0]?.commands[0]);
      expect(DOOR_OPEN_SE_POOL.indexOf(openId as (typeof DOOR_OPEN_SE_POOL)[number])).toBe(
        DOOR_CLOSE_SE_POOL.indexOf(closeId as (typeof DOOR_CLOSE_SE_POOL)[number]),
      );
    }
  });

  it("실내 출구는 전이 앞에 닫힘 SE 를 넣고, 같은 시드는 같은 소리를 고른다", () => {
    const make = (seed: number) =>
      createHouseInteriorMap({
        id: "map_se_variety_interior",
        name: "변형 테스트 집",
        returnMapId: "map_out",
        returnX: 4,
        returnY: 8,
        exitEventId: "ev_exit",
        seed,
      });
    const first = make(77);
    const second = make(77);
    const third = make(3);
    const audioOf = (interior: ReturnType<typeof createHouseInteriorMap>) => {
      const exit = interior.map.events.find((event) => event.id === "ev_exit");
      const commands = exit?.pages?.[0]?.commands ?? [];
      expect(commands.map((command) => command.kind)).toEqual(["playAudio", "transfer"]);
      expect(commands[1]).toMatchObject({ kind: "transfer", mapId: "map_out", x: 4, y: 8, fade: "black" });
      const id = playAudioId(commands[0]);
      expect(DOOR_CLOSE_SE_POOL).toContain(id);
      return id;
    };
    expect(audioOf(first)).toBe(audioOf(second));
    expect(audioOf(first)).toBe(pickSeVariant(DOOR_CLOSE_SE_POOL, 77));
    const other = audioOf(third);
    expect(other).toBe(pickSeVariant(DOOR_CLOSE_SE_POOL, 3));
  });
});
