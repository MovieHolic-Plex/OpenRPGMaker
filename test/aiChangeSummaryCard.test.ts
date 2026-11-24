import { describe, expect, it } from "vitest";
import { changeCountsLine, changedSinceRun, listChangeItems, revertChangeItem } from "@/editor/panels/aiChangeSummaryCard";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project, GameEvent } from "@/project/types";
import { creationCardModel, eventAppearanceId, firstPlayedMusic, firstSpokenLine } from "@/editor/panels/aiCreationCards";
import { isolateTimers } from "./mergedTeardown";

describe("aiChangeSummaryCard", () => {
  isolateTimers();
  type MapEvent = GameMap["events"][number];
  const npc = (id: string, x: number, y: number, name = id): MapEvent => ({ id, name, x, y, pages: [] } as unknown as MapEvent);
  function seed(): Project {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "create_map", { id: "map_east", name: "동쪽", width: 12, height: 10 });
    if (!result.ok) throw new Error(result.summary);
    const map = ctx.project.maps.map_east!;
    return { ...ctx.project, maps: { ...ctx.project.maps, map_east: { ...map, events: [npc("ev_a", 1, 1, "촌장")] } } };
  }
  function withMap(project: Project, mapId: string, patch: Partial<GameMap>): Project {
    return { ...project, maps: { ...project.maps, [mapId]: { ...project.maps[mapId]!, ...patch } } };
  }
  describe("listChangeItems", () => {
    it("separates a map's tiles from its events and counts by kind", () => {
      const before = seed();
      const map = before.maps.map_east!;
      const tiles = [...map.lowerTiles]; tiles[5] = 9;
      const after = withMap(before, "map_east", { lowerTiles: tiles, events: [npc("ev_a", 4, 4, "촌장"), npc("ev_b", 2, 2, "상인")] });
      const items = listChangeItems(before, after);
      expect(items.map((item) => `${item.kind}:${item.change}:${item.id}`)).toEqual(["map:modified:map_east", "event:modified:ev_a", "event:added:ev_b"]);
      expect(changeCountsLine(items)).toBe("맵 1 · 이벤트 2");
    });

    it("reports a new map once and its events", () => {
      const before = seed();
      const after = { ...before, maps: { ...before.maps, map_new: { ...before.maps.map_east!, id: "map_new", name: "숲속 마을" } } } as Project;
      const items = listChangeItems(before, after);
      expect(items.filter((item) => item.mapId === "map_new").map((item) => `${item.kind}:${item.change}`)).toEqual(["map:added", "event:added"]);
    });
  });
  describe("revertChangeItem", () => {
    it("puts one moved event back and leaves the other change alone", () => {
      const before = seed();
      const after = withMap(before, "map_east", { events: [npc("ev_a", 4, 4, "촌장"), npc("ev_b", 2, 2, "상인")] });
      const items = listChangeItems(before, after);
      const moved = items.find((item) => item.id === "ev_a")!;
      const next = revertChangeItem(after, before, moved);
      expect(next.maps.map_east!.events.map((event) => [event.id, event.x, event.y])).toEqual([["ev_a", 1, 1], ["ev_b", 2, 2]]);
    });

    it("removes an added event and an added map", () => {
      const before = seed();
      const after = { ...withMap(before, "map_east", { events: [npc("ev_a", 1, 1, "촌장"), npc("ev_b", 2, 2)] }),
        maps: { ...before.maps, map_east: { ...before.maps.map_east!, events: [npc("ev_a", 1, 1, "촌장"), npc("ev_b", 2, 2)] }, map_new: { ...before.maps.map_east!, id: "map_new" } } } as Project;
      const items = listChangeItems(before, after);
      const noEvent = revertChangeItem(after, before, items.find((item) => item.id === "ev_b")!);
      expect(noEvent.maps.map_east!.events.map((event) => event.id)).toEqual(["ev_a"]);
      const noMap = revertChangeItem(noEvent, before, items.find((item) => item.kind === "map" && item.id === "map_new")!);
      expect(Object.keys(noMap.maps)).not.toContain("map_new");
    });

    it("restores map tiles while keeping the map's current events", () => {
      const before = seed();
      const tiles = [...before.maps.map_east!.lowerTiles]; tiles[3] = 7;
      const after = withMap(before, "map_east", { lowerTiles: tiles, events: [npc("ev_a", 6, 6, "촌장")] });
      const item = listChangeItems(before, after).find((entry) => entry.kind === "map")!;
      const next = revertChangeItem(after, before, item);
      expect(next.maps.map_east!.lowerTiles[3]).toBe(before.maps.map_east!.lowerTiles[3]);
      expect(next.maps.map_east!.events[0]!.x).toBe(6);
    });
  });
  describe("changedSinceRun", () => {
    it("notices a hand edit made after the run", () => {
      const before = seed();
      const after = withMap(before, "map_east", { events: [npc("ev_a", 4, 4, "촌장")] });
      const item = listChangeItems(before, after)[0]!;
      expect(changedSinceRun(item, after, after)).toBe(false);
      expect(changedSinceRun(item, after, withMap(after, "map_east", { events: [npc("ev_a", 5, 4, "촌장")] }))).toBe(true);
    });
  });
});

describe("aiCreationCards", () => {
  isolateTimers();
  function run(project: Project, tool: string, args: Record<string, unknown>): Project {
    const ctx = { project };
    const result = runTool(ctx, tool, args);
    if (!result.ok) throw new Error(`${tool}: ${result.summary}`);
    return ctx.project;
  }
  describe("creation card models", () => {
    it("reads an equipment item's key stats and type from the record the tool wrote", () => {
      const before = createBlankProject();
      const after = run(before, "upsert_item", { item: { id: "item_flame_sword", name: "불꽃검", type: "weapon", price: 300, equipmentProfile: { statBonuses: { attack: 12, defense: 0, mind: 3, agility: 0 } } } });
      const item = listChangeItems(before, after).find((entry) => entry.id === "item_flame_sword")!;
      const model = creationCardModel(after, item)!;
      expect(model.title).toBe("불꽃검");
      expect(model.kindLine).toBe("장비 · 무기");
      expect(model.stats).toBe("공격 +12 · 마력 +3 · 300G");
    });

    it("gives a monster its HP/attack line", () => {
      const before = createBlankProject();
      const after = run(before, "upsert_enemy", { enemy: { id: "enemy_boss", name: "어둠 군주", monsterResourceId: "generated-enemy-slime-01", stats: { maxHp: 900, maxMp: 50, attack: 40, defense: 22, mind: 30, agility: 18 } } });
      const item = listChangeItems(before, after).find((entry) => entry.kind === "enemy" && entry.id === "enemy_boss")!;
      expect(creationCardModel(after, item)!.stats).toMatch(/^HP 900 · 공격 40 · 방어 22/u);
    });

    it("marks an item whose icon is a type stand-in, and clears the mark once a fitting icon is set", () => {
      const before = createBlankProject();
      const after = run(before, "upsert_item", { item: { id: "item_lunchbox", name: "나그네 도시락", type: "medicine" } });
      const item = listChangeItems(before, after).find((entry) => entry.id === "item_lunchbox")!;
      expect(creationCardModel(after, item)!.placeholderArt).toBe(true);
      const fixed = run(after, "upsert_item", { item: { id: "item_lunchbox", iconResourceId: "cc0-jetrel-bread" } });
      expect(creationCardModel(fixed, item)!.placeholderArt).toBeUndefined();
      const tea = run(before, "upsert_item", { item: { id: "item_tea", name: "달빛 차", type: "medicine" } });
      expect(creationCardModel(tea, listChangeItems(before, tea).find((entry) => entry.id === "item_tea")!)!.placeholderArt).toBeUndefined();
    });
  });
  describe("battle music change", () => {
    it("lists the project battle track as a music item and reverts only it", () => {
      const before = createBlankProject();
      const after = { ...before, system: { ...before.system, battleBgmResourceId: "cc0-bgm-boss-test" } } as Project;
      const items = listChangeItems(before, after);
      const music = items.find((entry) => entry.kind === "music")!;
      expect(music).toMatchObject({ id: "battleBgmResourceId", change: "modified", label: "전투 음악" });
      const reverted = revertChangeItem(after, before, music);
      expect(reverted.system.battleBgmResourceId).toBe(before.system.battleBgmResourceId);
    });
  });
  describe("firstSpokenLine", () => {
    it("finds the first text line inside nested choices, with its speaker", () => {
      const event = { id: "ev", x: 0, y: 0, pages: [{ commands: [
        { kind: "choices", options: [{ text: "네", branch: [{ kind: "text", speaker: "상인", body: "\n어서 오세요!\n둘째 줄" }] }] },
      ] }] } as unknown as GameEvent;
      expect(firstSpokenLine(event)).toEqual({ speaker: "상인", text: "어서 오세요!" });
    });
  });
  describe("firstPlayedMusic", () => {
    it("finds the boss track an event plays as background music, ignoring sound effects", () => {
      const event = { id: "ev", x: 0, y: 0, pages: [{ commands: [
        { kind: "playAudio", resourceId: "cc0-se-roar", loop: false },
        { kind: "playAudio", resourceId: "cc0-bgm-boss", loop: true },
      ] }] } as unknown as GameEvent;
      expect(firstPlayedMusic(event)).toBe("cc0-bgm-boss");
    });

    it("finds the appearance an assistant-made character event wears, so the card can follow its generated chip", () => {
      const before = createBlankProject();
      const placed = run(before, "make_villager", { mapId: before.startMapId, id: "ev_smith", name: "무기점 주인 도르간", home: { x: 3, y: 3 }, dialogue: [{ text: "어서 오게." }] });
      const linked = run(placed, "generate_walk_chip", { name: "도르간", description: "dwarf weapon-shop owner with a sword", events: [{ mapId: before.startMapId, eventId: "ev_smith" }] });
      const item = listChangeItems(before, linked).find((entry) => entry.kind === "event" && entry.id === "ev_smith")!;
      const appearanceId = linked.database.characterAppearances!.find((app) => app.name === "도르간")!.id;
      expect(eventAppearanceId(linked, item)).toBe(appearanceId);
      expect(eventAppearanceId(placed, item)).toBeUndefined();
    });
  });
});
