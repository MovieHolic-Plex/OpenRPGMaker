import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { cellLayerTiles, cloneExtraLayers, compactMapLayers, cropExtraLayers, hasExtraLayers, layerGroup, layerTileAt, malformedExtraLayerKeys, remapExtraLayers, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { applyMapDeltas, diffMapsForDelta, mapDeltaCellCount, type PiMapDelta } from "@/ai/piAgent/mapDelta";
import type { GameMap, Project } from "@/project/types";
import { DEFAULT_TERRAIN_GAMEPLAY } from "@/project/terrainDesign";
import { summarizeAgentGhostPreviewForProjectDiff } from "@/editor/agentGhostPreview";
import { runTool } from "@/editor/tools";
import { isolateTimers } from "./mergedTeardown";

describe("mapLayers", () => {
  isolateTimers();
  function blankMap(): GameMap {
    const project = createBlankProject();
    return structuredClone(project.maps[project.startMapId]);
  }
  describe("mapLayers", () => {
    it("1층·3층은 기존 lowerTiles·upperTiles 다", () => {
      const map = blankMap();
      setLayerTileAt(map, 1, 0, 7);
      setLayerTileAt(map, 3, 0, 9);
      expect(map.lowerTiles[0]).toBe(7);
      expect(map.upperTiles[0]).toBe(9);
      expect(hasExtraLayers(map)).toBe(false);
    });

    it("2층·4층·그림자는 쓸 때만 생기고 나머지는 빈칸", () => {
      const map = blankMap();
      expect(layerTileAt(map, 2, 3)).toBe(-1);
      expect(shadowAt(map, 3)).toBe(0);
      setLayerTileAt(map, 2, 3, 11);
      setLayerTileAt(map, 4, 5, 12);
      setShadowAt(map, 6, 0b0101);
      expect(map.lowerOverlayTiles?.length).toBe(map.width * map.height);
      expect(layerTileAt(map, 2, 3)).toBe(11);
      expect(layerTileAt(map, 2, 4)).toBe(-1);
      expect(layerTileAt(map, 4, 5)).toBe(12);
      expect(shadowAt(map, 6)).toBe(5);
      expect(cellLayerTiles(map, 3)).toEqual([map.lowerTiles[3], 11, map.upperTiles[3], -1]);
    });

    it("빈칸을 쓰면 칸을 만들지 않는다", () => {
      const map = blankMap();
      setLayerTileAt(map, 2, 0, -1);
      setShadowAt(map, 0, 0);
      expect(map.lowerOverlayTiles).toBeUndefined();
      expect(map.shadowBits).toBeUndefined();
    });

    it("그림자 비트는 0..15 로 자른다", () => {
      const map = blankMap();
      setShadowAt(map, 0, 0xff);
      expect(shadowAt(map, 0)).toBe(15);
    });

    it("compact 는 모두 빈 칸을 지운다", () => {
      const map = blankMap();
      setLayerTileAt(map, 2, 0, 5);
      setLayerTileAt(map, 2, 0, -1);
      setShadowAt(map, 1, 3);
      setShadowAt(map, 1, 0);
      compactMapLayers(map);
      expect("lowerOverlayTiles" in map).toBe(false);
      expect("shadowBits" in map).toBe(false);
    });

    it("clone 은 배열을 복사한다(별칭 없음)", () => {
      const map = blankMap();
      setLayerTileAt(map, 4, 0, 5);
      const copy = cloneExtraLayers(map);
      copy.upperOverlayTiles![0] = 99;
      expect(layerTileAt(map, 4, 0)).toBe(5);
      // New maps store terrainDesign.gameplay explicitly (sight blocking OFF, defaultMaps.createBlankMap) — it is cloned too.
      expect(cloneExtraLayers(blankMap())).toEqual({ terrainDesign: { gameplay: { ...DEFAULT_TERRAIN_GAMEPLAY } } });
    });

    it("remap 은 새 크기로 옮기고 밖은 비운다", () => {
      const map = blankMap();
      const oldW = map.width;
      setLayerTileAt(map, 2, 1 * oldW + 1, 8);   // (1,1)
      setShadowAt(map, 0, 2);                    // (0,0)
      // 2×2 로 줄이면서 (1,1) → (0,0), 나머지는 원본 없음
      remapExtraLayers(map, 2, 2, (t) => (t === 0 ? 1 * oldW + 1 : -1));
      expect(map.lowerOverlayTiles).toEqual([8, -1, -1, -1]);
      expect(map.shadowBits).toBeUndefined();     // (0,0) 로 온 원본에는 그림자가 없어 모두 0 → 칸 제거
    });

    it("layerGroup", () => {
      expect([1, 2, 3, 4].map((n) => layerGroup(n as 1 | 2 | 3 | 4))).toEqual(["lower", "lower", "upper", "upper"]);
    });
    it("cropExtraLayers: 원본 좌표에서 잘라 옮기고 원본 배열은 건드리지 않는다", () => {
      const map = blankMap();
      const w = map.width;
      setLayerTileAt(map, 2, 2 * w + 3, 5);
      setShadowAt(map, 0, 4);
      const original = map.lowerOverlayTiles!;
      const copy: GameMap = { ...map, width: 3, height: 2 };
      cropExtraLayers(copy, map.width, map.height, 2, 1, 3, 2);
      expect(copy.lowerOverlayTiles).toHaveLength(6);
      expect(layerTileAt(copy, 2, 1 * 3 + 1)).toBe(5);
      expect("shadowBits" in copy).toBe(false);
      expect(map.lowerOverlayTiles).toBe(original);
      expect(layerTileAt(map, 2, 2 * w + 3)).toBe(5);
    });

    it("malformedExtraLayerKeys 는 길이가 틀린 배열만 고른다", () => {
      expect(malformedExtraLayerKeys({ lowerOverlayTiles: [1, 2], upperOverlayTiles: [1, 2, 3, 4], shadowBits: "x" }, 4)).toEqual(["lowerOverlayTiles"]);
    });

    it("Pi 고스트 증분이 크기를 바꾸면 선택 층도 새 길이로 옮긴다", () => {
      const map = blankMap();
      setLayerTileAt(map, 4, 1 * map.width + 1, 6);
      const next = applyMapDeltas({ [map.id]: map }, [{
        mapId: map.id,
        shape: { width: map.width + 2, height: map.height + 1, tilesetId: map.tilesetId, tileSize: map.tileSize, name: map.name },
      }]);
      const grown = next[map.id];
      expect(grown.upperOverlayTiles).toHaveLength((map.width + 2) * (map.height + 1));
      expect(layerTileAt(grown, 4, 1 * (map.width + 2) + 1)).toBe(6);
      expect(map.upperOverlayTiles).toHaveLength(map.width * map.height);
    });
  });
});

describe("piAgentMapDelta", () => {
  isolateTimers();
  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
  function seed(): Project {
    const ctx = { project: createBlankProject() };
    for (const [id, name] of [["map_east", "동쪽"], ["map_west", "서쪽"]] as const) {
      const result = runTool(ctx, "create_map", { id, name, width: 20, height: 16 });
      if (!result.ok) throw new Error(result.summary);
    }
    return ctx.project;
  }
  /** 워커의 섀도우 추적을 그대로 흉내 낸다 — diff 하고, 그 결과로 섀도우를 전진시킨다. */
  function relay(before: Record<string, GameMap>, after: Record<string, GameMap>): {
    deltas: PiMapDelta[];
    shadow: Record<string, GameMap>;
  } {
    const deltas = diffMapsForDelta(before, after);
    return { deltas, shadow: applyMapDeltas(before, deltas) };
  }
  describe("piAgent mapDelta", () => {
    it("타일 한 칸 변경은 그 칸만 싣고, 얹으면 원본과 같아진다", () => {
      const base = seed();
      const after = clone(base);
      after.maps.map_east!.lowerTiles[42] = 7;

      const before = clone(base.maps);
      const { deltas, shadow } = relay(before, after.maps);
      expect(deltas).toHaveLength(1);
      expect(deltas[0]!.mapId).toBe("map_east");
      expect(deltas[0]!.layers?.[0]).toMatchObject({ layer: "lower", cells: [{ i: 42, t: 7 }] });
      expect(mapDeltaCellCount(deltas)).toBe(1);
      expect(shadow.map_east!.lowerTiles).toEqual(after.maps.map_east!.lowerTiles);
      // 손대지 않은 맵은 같은 객체 그대로 — 고스트 diff 가 동일성으로 빠져나갈 수 있어야 한다.
      expect(shadow.map_west).toBe(before.map_west);
    });

    it("손대지 않은 맵은 증분에 없고 같은 객체 그대로다", () => {
      const base = seed();
      const after = clone(base);
      after.maps.map_west!.lowerTiles[3] = 9;
      const shadow = clone(base.maps);
      const east = shadow.map_east!;

      const next = applyMapDeltas(shadow, diffMapsForDelta(shadow, after.maps));
      expect(next.map_east).toBe(east);
      expect(next.map_west).not.toBe(shadow.map_west);
    });

    it("바뀐 칸이 층의 8분의 1을 넘으면 층 배열을 통째로 싣는다", () => {
      const base = seed();
      const after = clone(base);
      const tiles = after.maps.map_east!.lowerTiles;
      for (let index = 0; index < tiles.length; index += 1) tiles[index] = 3;

      const { deltas, shadow } = relay(clone(base.maps), after.maps);
      const layer = deltas[0]!.layers!.find((entry) => entry.layer === "lower")!;
      expect(layer.cells).toBeUndefined();
      expect(layer.full).toHaveLength(20 * 16);
      expect(shadow.map_east!.lowerTiles).toEqual(tiles);
    });

    it("타일 스택 추가·삭제를 나르고, null 은 그 칸의 스택을 지운다", () => {
      const base = seed();
      base.maps.map_east!.lowerTileStacks = { 5: [1, 2] };
      const after = clone(base);
      after.maps.map_east!.lowerTileStacks = { 9: [4] };

      const { deltas, shadow } = relay(clone(base.maps), after.maps);
      const stacks = deltas[0]!.layers!.find((entry) => entry.layer === "lower")!.stacks!;
      expect([...stacks].sort((a, b) => a.i - b.i)).toEqual([{ i: 5, s: null }, { i: 9, s: [4] }]);
      expect(shadow.map_east!.lowerTileStacks).toEqual({ 9: [4] });
    });

    it("이벤트 추가·이동·삭제를 나른다", () => {
      const base = seed();
      base.maps.map_east!.events = [
        { id: "ev_keep", x: 1, y: 1, trigger: "action", commands: [] },
        { id: "ev_gone", x: 2, y: 2, trigger: "action", commands: [] },
      ];
      const after = clone(base);
      after.maps.map_east!.events = [
        { id: "ev_keep", x: 4, y: 1, trigger: "action", commands: [] },
        { id: "ev_new", x: 8, y: 8, trigger: "action", commands: [] },
      ];

      const { deltas, shadow } = relay(clone(base.maps), after.maps);
      expect(deltas[0]!.events!.removed).toEqual(["ev_gone"]);
      expect(deltas[0]!.events!.upserts!.map((event) => event.id).sort()).toEqual(["ev_keep", "ev_new"]);
      expect(shadow.map_east!.events.find((event) => event.id === "ev_keep")!.x).toBe(4);
      expect(shadow.map_east!.events.some((event) => event.id === "ev_gone")).toBe(false);
    });

    it("새 맵은 뼈대와 층 전체를 싣고, 사라진 맵은 removed 다", () => {
      const base = seed();
      const after = clone(base);
      after.maps.map_new = { ...clone(after.maps.map_east!), id: "map_new", name: "새 맵" };
      delete after.maps.map_west;

      const { deltas, shadow } = relay(clone(base.maps), after.maps);
      const created = deltas.find((delta) => delta.mapId === "map_new")!;
      expect(created.shape).toMatchObject({ width: 20, height: 16, name: "새 맵" });
      expect(created.layers!.every((layer) => layer.full !== undefined)).toBe(true);
      expect(deltas.find((delta) => delta.mapId === "map_west")).toEqual({ mapId: "map_west", removed: true });
      expect(shadow.map_west).toBeUndefined();
      expect(shadow.map_new!.name).toBe("새 맵");
      expect(Object.keys(shadow)).toEqual(Object.keys(after.maps));
    });

    it("맵이 커지면 인덱스 의미가 바뀌므로 층을 통째로 싣는다", () => {
      const base = seed();
      const after = clone(base);
      const map = after.maps.map_east!;
      map.width = 24;
      map.lowerTiles = new Array<number>(24 * 16).fill(2);
      map.upperTiles = new Array<number>(24 * 16).fill(0);

      const { deltas, shadow } = relay(clone(base.maps), after.maps);
      expect(deltas[0]!.shape).toMatchObject({ width: 24, height: 16 });
      expect(deltas[0]!.layers!.find((layer) => layer.layer === "lower")!.full).toHaveLength(24 * 16);
      expect(shadow.map_east!.width).toBe(24);
      expect(shadow.map_east!.lowerTiles).toHaveLength(24 * 16);
    });

    it("툴 여러 번의 증분을 이어 얹으면 최종 상태와 같고, 고스트가 같은 칸을 본다", () => {
      const base = seed();
      // 워커: ctx.project 를 제자리에서 바꾸며 툴마다 증분을 흘린다.
      const ctx = { project: clone(base) };
      let shadow = clone(base.maps);
      let browser = { ...base.maps };
      const steps: Array<() => void> = [
        () => { ctx.project.maps.map_east!.lowerTiles[10] = 5; },
        () => { ctx.project.maps.map_east!.lowerTiles[11] = 5; ctx.project.maps.map_west!.upperTiles[0] = 6; },
        () => { ctx.project.maps.map_east!.events.push({ id: "ev_a", x: 3, y: 3, trigger: "action", commands: [] }); },
      ];
      for (const step of steps) {
        step();
        const deltas = diffMapsForDelta(shadow, ctx.project.maps);
        shadow = applyMapDeltas(shadow, deltas);
        browser = applyMapDeltas(browser, deltas);
      }
      expect(browser).toEqual(ctx.project.maps);

      // 브라우저가 복원한 초안으로 고스트를 그리면 결과 프로젝트로 그린 것과 같은 칸이 나온다.
      const fromDeltas = summarizeAgentGhostPreviewForProjectDiff(base, { ...base, maps: browser } as Project);
      const fromResult = summarizeAgentGhostPreviewForProjectDiff(base, ctx.project);
      expect(fromDeltas.map((preview) => preview.id)).toEqual(fromResult.map((preview) => preview.id));
      expect(fromDeltas.flatMap((preview) => preview.cells)).toEqual(fromResult.flatMap((preview) => preview.cells));
      expect(fromDeltas.length).toBeGreaterThan(0);
    });

    it("바뀐 것이 없으면 빈 증분이다 — 조용한 툴이 와이어를 채우지 않는다", () => {
      const base = seed();
      expect(diffMapsForDelta(base.maps, clone(base.maps))).toEqual([]);
      expect(applyMapDeltas(base.maps, [])).toBe(base.maps);
    });
  });
});
