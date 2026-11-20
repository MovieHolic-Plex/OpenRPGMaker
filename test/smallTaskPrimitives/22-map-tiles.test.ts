/** @vitest-environment happy-dom */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/22-map-tiles";
import { mapTarget } from "@/editor/smallTask/target";
import en from "@/i18n/catalogs/en.json";
import ja from "@/i18n/catalogs/ja.json";
import zh from "@/i18n/catalogs/zh.json";
import { createTranslator } from "@/i18n/translator";
import { createInterpreter } from "@/player/interpreter";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { ensureBundledTilesets, removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { createSnowNorthTileset } from "@/project/defaults/snowNorth";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { canMove, isPassableLanding } from "@/project/collision";
import { deserialize, serialize } from "@/project/io";
import { cellLayerTiles, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { captureStructureTiles, makeStructurePlacement } from "@/project/structurePlacements";
import { startSession } from "@/project/session";
import { terrainReachability } from "@/project/terrainReachability";
import type { Command, GameEvent, GameMap, Project, TilesetDef } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store";
import { expectUndoRestores, loadFixture } from "./harness";
import { startOnRetiredCombinedTown } from "../support/retiredEasyRpgTilesets";

type Selection = NonNullable<Parameters<typeof runPrimitive>[4]>;
type Rect = NonNullable<Selection["rect"]>;
type Fixture = Parameters<typeof loadFixture>[0];

const BUILT_MAP = "map_1c3b4f24-9d3d-4c31-9d24-4dbda2df705d";
const fixtures = new Map<Fixture, Project>();
const rect = (x: number, y: number, w = 1, h = 1): Rect => ({ x, y, w, h });
const block = { up: false, down: false, left: false, right: false };

function fixture(name: Fixture, mapId?: string): { project: Project; map: GameMap } {
  let project = fixtures.get(name);
  if (!project) {
    project = loadFixture(name);
    // Apply the store's normalization before runPrimitive freezes the fixture.
    ensureSwitchVariableSlots(project);
    removeLegacySpriteReferences(project);
    fixtures.set(name, project);
  }
  const map = project.maps[mapId ?? project.startMapId];
  if (!map && name === "blank") {
    const blank = { ...createBlankMap("빈 맵", 20, 15), id: "map_blank_start" };
    return { project: { ...withMap(project, blank), startMapId: blank.id,
      startPos: { x: 10, y: 8 }, mapTree: { mapId: blank.id, children: [] } }, map: blank };
  }
  if (!map) throw new Error("검사할 맵이 없습니다.");
  return { project, map };
}

function withMap(project: Project, map: GameMap): Project {
  return { ...project, maps: { ...project.maps, [map.id]: map } };
}

function prepared(singleObject = false) {
  const { project, map } = fixture("built", BUILT_MAP);
  const index = map.width * 5 + 4;
  const lowerOverlayTiles = new Array(map.width * map.height).fill(-1);
  const upperOverlayTiles = lowerOverlayTiles.slice();
  const shadowBits = new Array(lowerOverlayTiles.length).fill(0);
  lowerOverlayTiles[index] = 2;
  upperOverlayTiles[index] = 454;
  shadowBits[index] = 1;
  const lowerTileStacks = { [index]: [1, 2] };
  const next = { ...map, lowerOverlayTiles, upperOverlayTiles, shadowBits, lowerTileStacks };
  if (singleObject) {
    next.upperTiles = map.upperTiles.slice();
    setLayerTileAt(next, 3, index, 454);
    setLayerTileAt(next, 3, index + map.width, -1);
  }
  return { project: withMap(project, next), map: next, index };
}

function customFixture(count = 2) {
  const { project, map } = fixture("blank");
  const id = "custom_test_tiles";
  const tileset: TilesetDef = {
    id, name: "검수용 타일셋", image: { type: "uploaded", id: "test_sheet" },
    tileSize: map.tileSize, tilesPerRow: count, count,
    passability: Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true })),
    priority: new Array(count).fill("lower"), terrain: new Array(count).fill(0),
  };
  const upperTiles = map.upperTiles.map(() => -1);
  upperTiles[0] = 1;
  const source = { ...map, tilesetId: id, lowerTiles: map.lowerTiles.map(() => 0), upperTiles };
  return { project: { ...withMap(project, source), tilesets: { ...project.tilesets, [id]: tileset } }, map: source, tileset };
}

async function applied(
  project: Project, map: GameMap, id: string, args: Record<string, unknown>, selection?: Rect,
  inspect?: (after: GameMap, result: Project) => void,
): Promise<void> {
  const target = mapTarget(project, map.id)!;
  const beforeMap = structuredClone(map);
  const tileset = project.tilesets[map.tilesetId];
  const originalPassage = tileset.passability.map(row => ({ ...row }));
  const { after, sentence } = runPrimitive(project, target, id, args, selection && { rect: selection });
  expect(sentence).toMatch(/^[가-힣0-9 ·]+\.$/u);
  expect(sentence.length).toBeLessThanOrEqual(80);
  expect(sentence).not.toContain(id);
  expect(jsonEqual(project.maps[map.id], beforeMap)).toBe(true);
  expect(jsonEqual(project.tilesets[map.tilesetId].passability, originalPassage)).toBe(true);
  const edited = after.maps[map.id];
  expect(edited.tilesetId).toBe(map.tilesetId);
  expect(edited.events).toBe(map.events);
  expect(after.startPos).toBe(project.startPos);
  if (id !== "map.tile.setPassability") expect(after.tilesets).toBe(project.tilesets);
  inspect?.(edited, after);
  await expectUndoRestores(project, after, target);
}

function execute(project: Project, map: GameMap, id: string, args: Record<string, unknown>, selection: Rect) {
  return runPrimitive(project, mapTarget(project, map.id)!, id, args, { rect: selection }).after;
}

describe("맵 타일 적용과 한 번의 실행 취소", () => {
  it("눈밭 한 칸만 칠하고 같은 칸의 물건을 보존한다", async () => {
    const { project, map, index } = prepared();
    await applied(project, map, "map.tile.paint", { x: 4, y: 5, tile: 4 }, rect(4, 5), after => {
      expect(cellLayerTiles(after, index)).toEqual([4, 2, 399, 454]);
      expect(shadowAt(after, index)).toBe(1);
    });
  });

  it("위층 물건과 받침 위 물건을 지우고 바닥과 그림자를 보존한다", async () => {
    const { project, map, index } = prepared();
    await applied(project, map, "map.tile.erase", {}, rect(4, 5), after => {
      expect(cellLayerTiles(after, index)).toEqual([1, 2, -1, -1]);
      expect(shadowAt(after, index)).toBe(1);
    });
  });

  it("마왕 편의점 맵의 선택한 세 칸만 같은 타일로 채운다", async () => {
    const { project, map } = fixture("maou", "map_mk_konbini");
    const tile = 10455;
    await applied(project, map, "map.region.fill", { tile, layer: "4" }, rect(0, 0, 3), after => {
      expect(after.upperOverlayTiles?.slice(0, 4)).toEqual([tile, tile, tile, map.upperOverlayTiles?.[3] ?? -1]);
    });
  }, 180_000);

  it("현재 타일셋의 두 칸짜리 긴 의자를 찍는다", async () => {
    const { project, map } = fixture("built", BUILT_MAP);
    const index = 6 * map.width + 5;
    await applied(project, map, "map.object.stamp", { objectId: "sn-bench" }, rect(5, 6, 2), after => {
      expect(after.upperTiles.slice(index, index + 2)).toEqual([607, 608]);
    });
  });

  it("타일 네 층과 그림자와 옛 타일 더미를 옆 칸으로 복제한다", async () => {
    const { project, map, index } = prepared(true);
    await applied(project, map, "map.region.copy", { x: 4, y: 5, w: 1, h: 1, dx: 1, dy: 0 }, rect(4, 5, 2), after => {
      expect(cellLayerTiles(after, index)).toEqual([1, 2, 454, 454]);
      expect(cellLayerTiles(after, index + 1)).toEqual([1, 2, 454, 454]);
      expect(shadowAt(after, index + 1)).toBe(1);
      expect(after.lowerTileStacks?.[index + 1]).toEqual([1, 2]);
    });
  });

  it("겹치는 이동에서도 원본 두 칸을 순서대로 읽고 비워진 칸만 지운다", async () => {
    const { project, map, index } = prepared(true);
    await applied(project, map, "map.region.move", { x: 4, y: 5, w: 2, h: 1, dx: 1, dy: 0 }, rect(4, 5, 3), after => {
      expect(cellLayerTiles(after, index)).toEqual([-1, -1, -1, -1]);
      expect(cellLayerTiles(after, index + 1)).toEqual([1, 2, 454, 454]);
      expect(cellLayerTiles(after, index + 2)).toEqual(cellLayerTiles(map, index + 1));
      expect(shadowAt(after, index)).toBe(0);
      expect(shadowAt(after, index + 1)).toBe(1);
    });
  });

  it("좌우 대칭으로 타일과 칸 안의 그림자 방향까지 뒤집는다", async () => {
    const { project, map, index } = prepared(true);
    await applied(project, map, "map.region.mirror", { axis: "horizontal" }, rect(4, 5, 2), after => {
      expect(cellLayerTiles(after, index)).toEqual(cellLayerTiles(map, index + 1));
      expect(cellLayerTiles(after, index + 1)).toEqual([1, 2, 454, 454]);
      expect(shadowAt(after, index + 1)).toBe(2);
    });
  });

  it("빈 가장자리가 있는 평지에서는 네 층과 그림자를 함께 밀고 되돌린다", async () => {
    const { project, map } = customFixture(5);
    const index = map.width * 2 + 3;
    for (const layer of [1, 2, 3, 4] as const) setLayerTileAt(map, layer, index, layer);
    setShadowAt(map, index, 4);
    await applied(project, map, "map.tile.shift", { dx: 2, dy: 0 }, undefined, after => {
      expect(cellLayerTiles(after, index + 2)).toEqual([1, 2, 3, 4]);
      expect(shadowAt(after, index + 2)).toBe(4);
      expect(after.lowerTiles[map.width * 2]).toBe(0);
    });
  });

  it("상하 대칭은 칸 안에서 그림자의 위와 아래도 뒤집는다", async () => {
    const { project, map, index } = prepared(true);
    await applied(project, map, "map.region.mirror", { axis: "vertical" }, rect(4, 5, 1, 2), after => {
      expect(shadowAt(after, index)).toBe(0);
      expect(shadowAt(after, index + map.width)).toBe(4);
    });
  });

  it.each([
    ["1", [1, -1, 399, 454], 1],
    ["2", [1, -1, 399, 454], 1],
    ["4", [1, 2, 399, -1], 1],
    ["shadow", [1, 2, 399, 454], 0],
    ["all", [1, -1, -1, -1], 0],
  ] as const)("지우기 %s가 지정한 층과 그림자만 바꾸고 되돌린다", async (layer, expected, shadow) => {
    const { project, map, index } = prepared();
    await applied(project, map, "map.tile.erase", { layer }, rect(4, 5), after => {
      expect(cellLayerTiles(after, index)).toEqual(expected);
      expect(after.lowerTileStacks?.[index]).toEqual(layer === "1" || layer === "all" ? undefined : [1, 2]);
      expect(shadowAt(after, index)).toBe(shadow);
    });
  });

  it("작은 커스텀 타일셋의 빈 바닥을 밀 때 다른 타일셋의 칸 번호를 쓰지 않는다", () => {
    const { project, map } = customFixture();
    const source = { ...map, lowerTiles: map.lowerTiles.map(() => -1) };
    const before = withMap(project, source);
    const { after } = runPrimitive(before, mapTarget(before, map.id)!, "map.tile.shift", { dx: 1, dy: 0 });
    expect(after.maps[map.id].lowerTiles.slice(0, 2)).toEqual([-1, -1]);
    expect(after.maps[map.id].upperTiles.slice(0, 2)).toEqual([-1, 1]);
  });

  it("맵 전체에서는 가능한 밀기도 일부만 선택하면 거절한다", () => {
    const { project, map } = customFixture();
    const target = mapTarget(project, map.id)!;
    const shift = { dx: 1, dy: 0 };
    expect(runPrimitive(project, target, "map.tile.shift", shift).after.maps[map.id].upperTiles[1]).toBe(1);
    expect(() => runPrimitive(project, target, "map.tile.shift", shift, { rect: rect(0, 0, 3, 3) }))
      .toThrow("맵 전체를 밀려면 맵 전체를 선택해 주세요.");
  });

  it("밀기로 드러난 가장자리는 이동한 벽을 복제하지 않고 바닥을 잇는다", () => {
    const { project, map, tileset } = customFixture();
    map.lowerTiles[0] = 1;
    map.upperTiles[0] = -1;
    tileset.passability[1] = block;
    const { after } = runPrimitive(project, mapTarget(project, map.id)!, "map.tile.shift", { dx: 1, dy: 0 });
    expect(after.maps[map.id].lowerTiles.slice(0, 3)).toEqual([0, 1, 0]);
  });

  it("타일 번호 240이 있는 커스텀 타일셋도 빈 바닥을 임의로 채우지 않는다", () => {
    const { project, map } = customFixture(300);
    const source = { ...map, lowerTiles: map.lowerTiles.map(() => -1) };
    const before = withMap(project, source);
    const { after } = runPrimitive(before, mapTarget(before, map.id)!, "map.tile.shift", { dx: 1, dy: 0 });
    expect(after.maps[map.id].lowerTiles[0]).toBe(-1);
    expect(after.maps[map.id].upperTiles[1]).toBe(1);
  });

  it("선택 안에서만 쓰이는 타일의 네 방향 통행을 바꾸고 불러오기 정규화에서도 유지한다", async () => {
    const { project, map, tileset } = customFixture();
    await applied(project, map, "map.tile.setPassability", { tile: 1, passable: false }, rect(0, 0), (after, result) => {
      expect(after).toBe(map);
      const changed = result.tilesets[map.tilesetId];
      expect(changed.passability[1]).toEqual({ up: false, down: false, left: false, right: false });
      expect(changed.passability[0]).toBe(tileset.passability[0]);
      const reloaded = deserialize(serialize({ ...result, tilesets: { [map.tilesetId]: changed } }));
      ensureBundledTilesets(reloaded);
      expect(reloaded.tilesets[map.tilesetId].passability[1]).toEqual(changed.passability[1]);
    });
  });
});

describe("선택 범위 검증", () => {
  const cases = [
    ["map.tile.paint", { x: 2, y: 1, tile: 4 }, rect(1, 1)],
    ["map.tile.erase", {}, rect(45, 0, 2)],
    ["map.region.fill", { tile: 4 }, rect(45, 0, 2)],
    ["map.object.stamp", { objectId: "sn-bench" }, rect(5, 6)],
    ["map.region.copy", { x: 4, y: 5, w: 1, h: 1, dx: 1, dy: 0 }, rect(4, 5)],
    ["map.region.move", { x: 4, y: 5, w: 1, h: 1, dx: 1, dy: 0 }, rect(4, 5)],
    ["map.region.mirror", { axis: "vertical" }, rect(45, 0, 2)],
    ["map.tile.shift", { dx: 1, dy: 0 }, rect(4, 5)],
    ["map.tile.setPassability", { tile: 1, passable: false }, rect(0, 0)],
  ] as const;

  it.each(cases)("%s의 범위 밖 편집을 거부한다", (id, args, selection) => {
    const { project, map } = fixture("built", BUILT_MAP);
    expect(() => execute(project, map, id, args, selection)).toThrow(/범위 밖/u);
  });

  it("실제 맵 가드는 범위를 벗어난 타일이나 맵 속성 변경을 거부한다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    const target = mapTarget(project, map.id)!;
    const primitive = PRIMITIVES.find(p => p.id === "map.tile.paint")!;
    const args = { x: 0, y: 0, tile: 4 };
    const scope = primitive.scope({ project, target, selection: { rect: rect(0, 0, 3) } }, args);
    expect(scope).toEqual({ kind: "mapRegion", mapId: map.id, rect: rect(0, 0) });
    const lowerTiles = map.lowerTiles.slice();
    lowerTiles[1] = 4;
    expect(checkSmallTaskScope(project, withMap(project, { ...map, lowerTiles }), scope).ok).toBe(false);
    expect(checkSmallTaskScope(project, withMap(project, { ...map, name: "바뀐 이름" }), scope).ok).toBe(false);
  });

  it("복사의 원본과 찍을 물건 바깥 칸은 쓰기 범위에 들어가지 않는다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    const ctx = { project, target: mapTarget(project, map.id)!, selection: { rect: rect(0, 0, 8, 8) } };
    const copy = PRIMITIVES.find(p => p.id === "map.region.copy")!;
    const stamp = PRIMITIVES.find(p => p.id === "map.object.stamp")!;
    expect(copy.scope(ctx, { ...rect(0, 0, 1, 2), dx: 2, dy: 0 })).toEqual({ kind: "mapRegion", mapId: map.id, rect: rect(2, 0, 1, 2) });
    expect(stamp.scope(ctx, { objectId: "sn-bench", x: 5, y: 6 })).toEqual({ kind: "mapRegion", mapId: map.id, rect: rect(5, 6, 2) });
  });

  it("떨어진 이동 원본과 목적지 사이의 타일은 그대로 둔다", () => {
    const { project, map } = customFixture(3);
    map.upperTiles[2] = 2;
    const after = execute(project, map, "map.region.move", { ...rect(0, 0), dx: 4, dy: 0 }, rect(0, 0, 6));
    expect(after.maps[map.id].upperTiles.slice(0, 6))
      .toEqual([-1, -1, 2, -1, 1, -1]);
  });

  it("한 칸 칠하기가 선택한 다른 칸에 동반 타일을 놓으려 하면 거부한다", () => {
    const { project, map: blank } = fixture("blank");
    const before = startOnRetiredCombinedTown(
      { ...withMap(project, { ...blank }), tilesets: { ...project.tilesets } },
      { interiorHarness: false },
    );
    const map = before.maps[before.startMapId];
    expect(() => execute(before, map, "map.tile.paint", { x: 5, y: 5, tile: 290, layer: "3" }, rect(5, 4, 1, 2)))
      .toThrow(/범위 밖/u);
    expect(map.upperTiles[4 * map.width + 5]).toBe(-1);
  });

  it("없는 타일과 없는 물건을 한국어 오류로 거부한다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    expect(() => execute(project, map, "map.tile.paint", { x: 0, y: 0, tile: 99999 }, rect(0, 0)))
      .toThrow(PrimitiveError);
    expect(() => execute(project, map, "map.object.stamp", { objectId: "unknown_kit" }, rect(0, 0)))
      .toThrow("놓을 물건을 찾을 수 없어요.");
  });

  it("고정한 지형 타일은 선택에 들어 있어도 거부한다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    const next = { ...map, terrainDesign: { ...map.terrainDesign, lockedCells: [0] } };
    expect(() => execute(withMap(project, next), next, "map.tile.paint", { x: 0, y: 0, tile: 4 }, rect(0, 0)))
      .toThrow(/범위 밖.*보호된 타일/u);
  });

  it("공백 물건 이름, 좌표 하나만 있는 배치, 소수 좌표를 거부한다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    expect(() => execute(project, map, "map.object.stamp", { objectId: "  " }, rect(2, 6)))
      .toThrow("놓을 물건을 골라 주세요.");
    expect(() => execute(project, map, "map.object.stamp", { objectId: "sn-logs", x: 2 }, rect(2, 6)))
      .toThrow("가로와 세로 위치를 함께");
    expect(() => execute(project, map, "map.tile.paint", { x: 0.5, y: 0, tile: 4 }, rect(0, 0)))
      .toThrow("형식을 확인해 주세요.");
  });
});

describe("맵 타일에 연결된 기존 콘텐츠", () => {
  it("부대 전투 뒤 분기가 조작하는 타일은 지우거나 옮길 수 없다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    const change: Command = { kind: "changeTile", mapId: map.id, x: 0, y: 0, layer: "upper", tile: -1 };
    const before = { ...project, database: { ...project.database, troops: [{
      ...project.database.troops[0], battleEventPages: [], afterBattle: { victory: [{ kind: "loop" as const, body: [change] }] },
    }] } };
    expect(() => execute(before, map, "map.tile.erase", {}, rect(0, 0))).toThrow("타일을 바꾸는 이벤트가 있어요.");
    expect(() => execute(before, map, "map.region.move", { ...rect(0, 0, 1, 2), dx: 3, dy: 0 }, rect(0, 0, 4, 2)))
      .toThrow("타일을 바꾸는 이벤트가 있어요.");
    expect(execute(before, map, "map.tile.paint", { x: 0, y: 0, tile: 4 }, rect(0, 0)).maps[map.id].lowerTiles[0]).toBe(4);
    expect(before.maps[map.id].upperTiles[0]).toBe(399);
  });

  it("배치 기록이나 묶음이 가리키는 타일을 그대로 보존한다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    const area = rect(0, 0);
    const placement = makeStructurePlacement(map, { kitId: "tree", rect: area, before: captureStructureTiles(map, area) });
    const placed = { ...map, structurePlacements: [placement] };
    expect(() => execute(withMap(project, placed), placed, "map.tile.erase", {}, area)).toThrow("배치한 구조물의 일부");
    const grouped = { ...map, doodadGroups: [{ id: "trees", label: "나무", kitId: "tree", cells: [{ index: 0, tile: 399, before: -1 }] }] };
    expect(() => execute(withMap(project, grouped), grouped, "map.tile.erase", {}, area)).toThrow("묶어 놓은 물건의 일부");
  });

  it("문 설정과 공용 이벤트의 문 연출이 읽는 그림을 지울 수 없다", () => {
    const { project, map } = customFixture();
    const withDoor = { ...map, doors: [{ ...rect(0, 0), style: "slide" as const, hinge: "left" as const }] };
    expect(() => execute(withMap(project, withDoor), withDoor, "map.tile.erase", {}, rect(0, 0)))
      .toThrow("문을 여닫는 데 쓰여요.");
    const command: Command = { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "doorOpen", value: "0,0" } };
    const commonEvent = { id: "ce_door", name: "문 열기", trigger: "none" as const, commands: [command] };
    const before = { ...project, commonEvents: [...project.commonEvents, commonEvent] };
    expect(() => execute(before, map, "map.tile.erase", {}, rect(0, 0))).toThrow("문을 여닫는 데 쓰여요.");
  });

  it("열린 이벤트 초안을 취소해도 원래 명령이 조작할 타일을 보존한다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    const change: Command = { kind: "changeTile", mapId: map.id, x: 0, y: 0, layer: "upper", tile: -1 };
    const original = { ...map.events[0]!, commands: [change], pages: [] };
    const event = { ...original, commands: [], draft: { kind: "edit" as const, original } };
    const source = { ...map, events: [event] };
    expect(() => execute(withMap(project, source), source, "map.tile.erase", {}, rect(0, 0)))
      .toThrow("타일을 바꾸는 이벤트가 있어요.");
  });

  it("작업 기준에 없는 열린 이벤트의 새 타일 명령도 보호한다", () => {
    const { project, map } = customFixture(3);
    const target = mapTarget(project, map.id)!;
    const change: Command = { kind: "changeTile", mapId: map.id, x: 0, y: 0, layer: "lower", tile: 2 };
    const outside: Command = { ...change, x: 1, tile: 1 };
    const event = { ...eventAt("draft_tiles", 2, 2, [change, outside]), draft: { kind: "new" as const } };
    const live = { maps: { [map.id]: { events: [event] } } };
    const selection = { rect: rect(0, 0) };
    const paint = { x: 0, y: 0, tile: 2 };
    const passage = { tile: 1, passable: false };
    expect(runPrimitive(project, target, "map.tile.paint", paint, selection).after.maps[map.id].lowerTiles[0]).toBe(2);
    expect(() => runPrimitive(project, target, "map.tile.paint", paint, selection, live))
      .toThrow("타일을 바꾸는 이벤트가 있어요.");
    expect(() => runPrimitive(project, target, "map.tile.setPassability", passage, selection, live))
      .toThrow("이벤트가 선택 영역 밖에서도 이 타일을 써요.");
    expect(project.maps[map.id].events).toEqual([]);
  });

  it("엔딩 다음 막의 시작 칸을 막는 통행 설정을 거부한다", () => {
    const { project, map } = customFixture();
    const before = { ...project, endings: [{
      id: "next", name: "다음 막", conditions: [], priority: 0, continueTo: { mapId: map.id, x: 0, y: 0 },
    }] };
    expect(() => execute(before, map, "map.tile.setPassability", { tile: 1, passable: false }, rect(0, 0)))
      .toThrow("엔딩 뒤에 이어지는 칸에서 움직일 수 없게 돼요.");
  });

  it("공용 이벤트가 읽는 지형 번호가 바뀌는 편집을 거부한다", () => {
    const { project, map, tileset } = customFixture();
    const command: Command = { kind: "m2Command", commandId: "m2-042-get-terrain-id",
      fields: { mapId: map.id, x: "0", y: "0", variableId: "var_terrain" } };
    const commonEvent = { id: "ce_read_terrain", name: "지형 확인", trigger: "none" as const, commands: [command] };
    const before = { ...project, commonEvents: [...project.commonEvents, commonEvent],
      tilesets: { ...project.tilesets, [map.tilesetId]: { ...tileset, terrain: [0, 1] } } };
    expect(() => execute(before, map, "map.tile.paint", { x: 0, y: 0, tile: 1 }, rect(0, 0)))
      .toThrow("이 칸의 지형을 읽는 이벤트가 있어요.");
  });

  it("순간이동 지점으로 등록한 칸을 막는 통행 설정을 거부한다", () => {
    const { project, map } = customFixture();
    const command: Command = { kind: "m2Command", commandId: "m2-072-set-teleportation-point",
      fields: { mapId: map.id, x: 0, y: 0 } };
    const pointEvent = { id: "ce_teleport", name: "순간이동 지점", trigger: "none" as const, commands: [command] };
    const before = { ...project, commonEvents: [...project.commonEvents, pointEvent] };
    expect(() => execute(before, map, "map.tile.setPassability", { tile: 1, passable: false }, rect(0, 0)))
      .toThrow("이벤트가 지정한 순간이동 칸에서 움직일 수 없게 돼요.");
  });

  it("공용 이벤트가 선택 밖에 같은 타일을 놓을 때 통행 변경을 거부한다", () => {
    const { project, map } = customFixture();
    const change: Command = { kind: "changeTile", mapId: map.id, x: 1, y: 1, layer: "upper2", tile: 1 };
    const commonEvent = { id: "ce_tile", name: "타일 장치", trigger: "none" as const, commands: [change] };
    const before = { ...project, commonEvents: [...project.commonEvents, commonEvent] };
    expect(() => execute(before, map, "map.tile.setPassability", { tile: 1, passable: false }, rect(0, 0)))
      .toThrow("이벤트가 선택 영역 밖에서도 이 타일을 써요.");
  });

  it("통행 값이 같아도 다른 맵에서 쓰이는 타일이나 선택에 없는 타일은 거부한다", () => {
    const { project, map } = customFixture(3);
    const other = { ...map, id: "other_map" };
    expect(() => execute(withMap(project, other), map, "map.tile.setPassability", { tile: 1, passable: true }, rect(0, 0)))
      .toThrow("선택한 영역 밖에서도 같은 타일을 써요.");
    expect(() => execute(project, map, "map.tile.setPassability", { tile: 2, passable: true }, rect(0, 0)))
      .toThrow("선택한 영역에 이 타일이 없어요.");
  });

  it("북방 설원 번들이 다시 열 때 되돌리는 통행 변경을 거부한다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    expect(() => execute(project, map, "map.tile.setPassability", { tile: 702, passable: false }, rect(16, 17)))
      .toThrow("프로젝트를 다시 열 때 통행 설정이 원래대로 돌아가요.");
  });
});

describe("플레이 이동 판정", () => {
  it("빈 프로젝트에서 막힌 4층을 칠하면 진입할 수 없다", () => {
    const { project, map } = fixture("blank");
    const tile = project.tilesets[map.tilesetId].passability.findIndex(flags => flags && !Object.values(flags).some(Boolean));
    expect(tile).toBeGreaterThanOrEqual(0);
    const edited = execute(project, map, "map.tile.paint", { x: 5, y: 6, tile, layer: "4" }, rect(5, 6));
    expect(canMove(project, map, 6, 6, 5, 6)).toBe(true);
    expect(canMove(edited, edited.maps[map.id], 6, 6, 5, 6)).toBe(false);
  });

  it("위층의 막힌 타일을 지우면 바닥을 다시 걸을 수 있다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    expect(canMove(project, map, 5, 6, 4, 6)).toBe(false);
    const edited = execute(project, map, "map.tile.erase", {}, rect(4, 6));
    expect(canMove(edited, edited.maps[map.id], 5, 6, 4, 6)).toBe(true);
  });

  it("통행 설정이 이웃 칸에서 드나드는 플레이 이동 양쪽에 적용된다", () => {
    const { project, map } = customFixture();
    expect(canMove(project, map, 1, 0, 0, 0)).toBe(true);
    const edited = execute(project, map, "map.tile.setPassability", { tile: 1, passable: false }, rect(0, 0));
    expect(canMove(edited, edited.maps[map.id], 1, 0, 0, 0)).toBe(false);
    expect(canMove(edited, edited.maps[map.id], 0, 0, 1, 0)).toBe(false);
  });

  it("윗층이 이미 막은 칸에서는 아랫층을 막아 달라는 요청도 거절한다", () => {
    const { project, map, tileset } = customFixture(3);
    map.lowerTiles[0] = 2;
    tileset.passability[1] = block;
    expect(() => execute(project, map, "map.tile.setPassability", { tile: 2, passable: false }, rect(0, 0)))
      .toThrow("다른 층의 타일이 결정해요.");
  });
});

function eventAt(id: string, x: number, y: number, commands: Command[]): GameEvent {
  return { id, x, y, trigger: { kind: "action" }, commands };
}

describe("리뷰에서 확인한 맵 타일 경계", () => {
  it.each(["ground", "tile", "shadow", "stack"] as const)("맵 밖으로 밀릴 %s가 있으면 그대로 둔다", content => {
    const { project, map } = customFixture(12);
    map.lowerTiles.fill(10);
    const edge = map.width - 1;
    if (content === "ground") setLayerTileAt(map, 1, edge, 11);
    if (content === "tile") setLayerTileAt(map, 4, edge, 1);
    if (content === "shadow") setShadowAt(map, edge, 1);
    if (content === "stack") map.upperTileStacks = { [edge]: [1] };
    const original = structuredClone(map);
    expect(() => runPrimitive(project, mapTarget(project, map.id)!, "map.tile.shift", { dx: 1, dy: 0 }))
      .toThrow("맵 밖으로 밀려나요.");
    expect(map).toEqual(original);
  });

  it.each(["event", "draft", "relief", "location"] as const)("타일만 밀면 %s의 좌표가 어긋나는 맵은 거부한다", content => {
    const { project, map } = customFixture(12);
    map.lowerTiles.fill(10);
    if (content === "event") map.events = [eventAt("npc", 1, 1, [])];
    if (content === "relief") map.relief = { width: map.width, height: map.height, levels: map.lowerTiles.map((_, i) => i === 0 ? 1 : 0) };
    if (content === "location") map.locations = [
      { id: "market", name: "장터", ...rect(1, 1) },
    ];
    const draft = { ...eventAt("draft", 1, 1, []), draft: { kind: "new" as const } };
    const live = content === "draft" ? { maps: { [map.id]: { events: [draft] } } } : undefined;
    expect(() => runPrimitive(project, mapTarget(project, map.id)!, "map.tile.shift", { dx: 1, dy: 0 }, undefined, live))
      .toThrow("타일과 함께 옮겨야 할");
  });

  it("시작 칸에서 한 칸 걸을 수 있어도 기존 출구로 가는 유일한 길을 막을 수 없다", () => {
    const { project, map, tileset } = customFixture(3);
    tileset.passability[1] = { up: false, down: false, left: false, right: false };
    tileset.ledgeDirections = { "2": "right" };
    map.upperTiles.fill(-1);
    map.lowerTiles.fill(1);
    map.lowerTiles.fill(0, 0, map.width);
    map.lowerTiles[3] = 2;
    const exit = { ...map, id: "exit" };
    const before = { ...withMap(project, exit), startPos: { x: 0, y: 0 }, mapConnections: [{
      id: "leave", from: { mapId: map.id, x: 5, y: 0 }, to: { mapId: exit.id, x: 1, y: 0 },
      playerEnabled: true, npcEnabled: false,
    }, {
      id: "enter", from: { mapId: exit.id, x: 0, y: 0 }, to: { mapId: map.id, x: 1, y: 0 },
      playerEnabled: true, npcEnabled: false,
    }] };
    const blocked = { ...map, upperTiles: map.upperTiles.slice() };
    blocked.upperTiles[2] = 1;
    expect(isPassableLanding(before, blocked, 0, 0)).toBe(true);
    expect(terrainReachability(before, map, before.startPos)[5]).toBe(1);
    expect(terrainReachability(before, map, { x: 5, y: 0 })[0]).toBe(0);
    expect(terrainReachability(before, blocked, before.startPos)[5]).toBe(0);
    expect(() => execute(before, map, "map.tile.paint", { x: 2, y: 0, tile: 1, layer: "4" }, rect(2, 0)))
      .toThrow("기존 이벤트나 출구로 가는 길이 끊겨요.");
  });

  it.each(["draft", "teleport"] as const)("초안 이벤트와 지정된 순간이동에서 길이 끊기지 않게 한다 (%s)", mode => {
    const { project, map, tileset } = customFixture();
    tileset.passability[1] = block;
    map.upperTiles.fill(-1);
    map.lowerTiles.fill(1);
    map.lowerTiles.fill(0, 0, map.width);
    const destination = eventAt("end_of_path", 5, 0, [{ kind: "text", body: "도착" }]);
    const draft = { ...destination, draft: { kind: "new" as const } };
    const live = mode === "draft" ? { maps: { [map.id]: { events: [draft] } } } : undefined;
    const before = { ...project, startPos: { x: 0, y: 0 } };
    if (mode === "teleport") {
      const other = { ...map, id: "other" };
      before.maps = { ...before.maps, [other.id]: other };
      before.startMapId = other.id;
      map.events = [destination];
      before.commonEvents = [{ id: "warp", name: "순간이동", trigger: "none", commands: [{
        kind: "m2Command", commandId: "m2-072-set-teleportation-point", fields: { mapId: map.id, x: 0, y: 0 },
      }] }];
    }
    const args = { x: 2, y: 0, tile: 1, layer: "4" };
    const selection = { rect: rect(2, 0) };
    const target = mapTarget(before, map.id)!;
    if (mode === "draft") expect(runPrimitive(before, target, "map.tile.paint", args, selection).after).not.toBe(before);
    expect(() => runPrimitive(before, target, "map.tile.paint", args, selection, live))
      .toThrow("기존 이벤트나 출구로 가는 길이 끊겨요.");
  });

  it("갈래 안에서 상위 위치 표시로 돌아가 열리는 문 타일을 보호한다", () => {
    const { project, map } = customFixture();
    const owner = { ...map, id: "owner", events: [eventAt("reenter", 1, 1, [
      { kind: "label", name: "door" },
      { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "doorOpen", value: "0,0" } },
      { kind: "transfer", mapId: map.id, x: 3, y: 3, fade: "black" },
      { kind: "choices", options: [{ text: "돌아가기", branch: [{ kind: "gotoLabel", name: "door" }] }] },
    ])] };
    expect(() => execute(withMap(project, owner), map, "map.tile.erase", {}, rect(0, 0)))
      .toThrow("문을 여닫는 데 쓰여요.");
  });

  it("다른 맵의 파티를 불러온 뒤 열 수 있는 문 타일을 보호한다", () => {
    const { project, map } = customFixture();
    const door: Command = { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "doorOpen", value: "0,0" } };
    const owner = { ...map, id: "owner", events: [eventAt("recall", 1, 1, [
      { kind: "recallParty", partySetId: "reserve" }, door,
    ])] };
    expect(() => execute(withMap(project, owner), map, "map.tile.erase", {}, rect(0, 0)))
      .toThrow("문을 여닫는 데 쓰여요.");
  });

  it.each([
    ["m2-202-screen-effect", { effect: "doorOpen", value: "0,0" }, "문을 여닫는 데 쓰여요."],
    ["m2-042-get-terrain-id", { x: 0, y: 0, variableId: "var_terrain" }, "지형을 읽는 이벤트가 있어요."],
    ["m2-072-set-teleportation-point", { x: 0, y: 0 }, "순간이동 칸에서 움직일 수 없게 돼요."],
  ] as const)("분기에서 이동한 뒤 %s가 읽는 현재 맵을 보호한다", (commandId, fields, reason) => {
    const { project, map, tileset } = customFixture();
    tileset.terrain[1] = 2;
    const reference: Command = { kind: "m2Command", commandId, fields };
    const transfer: Command = { kind: "transfer", mapId: map.id, x: 3, y: 3, fade: "black" };
    const owner = { ...map, id: "owner",
      lowerTiles: commandId === "m2-042-get-terrain-id" ? map.lowerTiles.map(() => 1) : map.lowerTiles,
      upperTiles: map.upperTiles.map(() => -1), events: [
      eventAt("transfer_event", 1, 1, [{ kind: "choices", options: [{ text: "이동", branch: [transfer] }] }, reference]),
    ] };
    const before = withMap(project, owner);
    if (commandId === "m2-072-set-teleportation-point") {
      expect(() => execute(before, map, "map.tile.setPassability", { tile: 1, passable: false }, rect(0, 0))).toThrow(reason);
    } else if (commandId === "m2-042-get-terrain-id") {
      const session = startSession(before, 1);
      session.currentMapId = owner.id;
      const interpreter = createInterpreter([transfer, reference], session, before, { continueAfterTransfer: true });
      expect(interpreter.start()).toMatchObject({ kind: "transfer", mapId: map.id });
      session.currentMapId = map.id;
      interpreter.resume(undefined);
      expect(session.variables.var_terrain).toBe(0);
      expect(() => execute(before, map, "map.tile.paint", { x: 0, y: 0, tile: 1 }, rect(0, 0))).toThrow(reason);
    } else {
      expect(() => execute(before, map, "map.tile.erase", {}, rect(0, 0))).toThrow(reason);
      const commands = [reference, transfer];
      const earlier = { ...owner, events: [eventAt("transfer_event", 1, 1, commands)] };
      expect(execute(withMap(project, earlier), map, "map.tile.erase", {}, rect(0, 0)).maps[map.id].upperTiles[0]).toBe(-1);
    }
  });

  it("공용 이벤트 호출이 맵을 이동할 때만 뒤에 이어지는 문 연출의 범위가 넓어진다", () => {
    const { project, map } = customFixture();
    const owner = { ...map, id: "owner", upperTiles: map.upperTiles.map(() => -1), events: [
      eventAt("owner_door", 1, 1, [
        { kind: "callCommonEvent", commonEventId: "ce_transfer" },
        { kind: "m2Command", commandId: "m2-202-screen-effect", fields: { effect: "doorOpen", value: "0,0" } },
      ]),
    ] };
    const commonEvent = { id: "ce_transfer", name: "공용 호출", trigger: "none" as const };
    const transfer: Command = { kind: "transfer", mapId: map.id, x: 3, y: 3 };
    const before = { ...withMap(project, owner), commonEvents: [{ ...commonEvent, commands: [transfer] }] };
    expect(() => execute(before, map, "map.tile.erase", {}, rect(0, 0))).toThrow("문을 여닫는 데 쓰여요.");
    const local = { ...before, commonEvents: [{ ...commonEvent, commands: [] }] };
    expect(execute(local, map, "map.tile.erase", {}, rect(0, 0)).maps[map.id].upperTiles[0]).toBe(-1);
  });

  it("도구가 다른 위층 기물을 덮어쓰고 경고만 반환하면 도장을 취소한다", () => {
    const { project, map, tileset } = customFixture(3);
    tileset.structureKits = [{
      kind: "section", id: "sign", name: "바닥에 붙인 표지", tileSize: map.tileSize, width: 1, height: 1,
      rows: [{ tiles: [0], upperTiles: [2] }], learnedFrom: "db-authored", createdAt: "2026-11-20T00:00:00Z",
    }];
    expect(() => execute(project, map, "map.object.stamp", { objectId: "sign" }, rect(0, 0)))
      .toThrow("다른 타일이나 통행에 영향이 있어요.");
    expect(map.upperTiles[0]).toBe(1);
  });

  it("기물이 시작점을 막아 시작점 이동을 제안하면 취소한다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    const before = { ...project, startMapId: map.id, startPos: { x: 5, y: 6 } };
    expect(() => execute(before, map, "map.object.stamp", { objectId: "sn-bench" }, rect(5, 6, 2)))
      .toThrow("게임 시작 위치를 옮겨야 하는 자리예요.");
    expect(before.startPos).toEqual({ x: 5, y: 6 });
  });

  it("배치 기록이 없는 긴 의자의 반쪽을 복사하거나 옮기거나 덮을 수 없다", () => {
    const { project, map } = fixture("built", BUILT_MAP);
    const stamped = execute(project, map, "map.object.stamp", { objectId: "sn-bench" }, rect(5, 6, 2));
    const source = stamped.maps[map.id];
    for (const id of ["map.region.copy", "map.region.move"]) {
      expect(() => execute(stamped, source, id, { ...rect(5, 6), dx: 3, dy: 0 }, rect(5, 6, 4)))
        .toThrow("물건의 일부만");
    }
    expect(() => execute(stamped, source, "map.region.copy", { ...rect(7, 6), dx: -1, dy: 0 }, rect(5, 6, 3)))
      .toThrow("물건의 일부만");
    expect(() => execute(stamped, source, "map.region.mirror", { axis: "horizontal" }, rect(5, 6, 2)))
      .toThrow("물건의 그림이 조각나요.");
    const moved = execute(stamped, source, "map.region.move", { ...rect(5, 6, 2), dx: 1, dy: 0 }, rect(5, 6, 3));
    const index = source.width * 6 + 5;
    expect(moved.maps[map.id].upperTiles.slice(index, index + 3)).toEqual([-1, 607, 608]);
  });

  it("배치 기록 없이 hard 짝 규칙으로 연결된 조각도 따로 복사할 수 없다", () => {
    const { project, map, tileset } = customFixture(3);
    const index = map.width + 2;
    map.upperTiles[index] = 1;
    map.upperTiles[index + map.width] = 2;
    tileset.tileGroups = [{
      id: "two_part", name: "두 조각", role: "prop", defaultLayer: "upper",
      tileIds: [1, 2], description: "", placementRules: "",
      rules: [{ id: "pair", kind: "adjacency", strength: "hard", params: { a: 1, b: 2, relation: "aAboveB" } }],
    }];
    expect(() => execute(project, map, "map.region.copy", { ...rect(2, 1), dx: 1, dy: 0 }, rect(2, 1, 2)))
      .toThrow("타일에 딸린 조각을 함께 선택해 주세요.");
  });

  it("배치 기록 없이 1층에 이어진 구조물의 일부를 복사하거나 옮기거나 덮을 수 없다", () => {
    const { project, map, tileset } = customFixture(4);
    const index = map.width + 2;
    map.lowerTiles[index] = 1;
    map.lowerTiles[index + 1] = 2;
    map.lowerTiles[index + 3] = 3;
    map.lowerTiles[index + 4] = 2;
    tileset.structureKits = [{
      kind: "section", id: "floor-kit", name: "두 칸 바닥", tileSize: map.tileSize, width: 2, height: 1,
      rows: [{ tiles: [1, 2] }], learnedFrom: "db-authored", createdAt: "2026-11-20T00:00:00Z",
    }];
    for (const id of ["map.region.copy", "map.region.move"]) {
      expect(() => execute(project, map, id, { ...rect(2, 1), dx: 2, dy: 0 }, rect(2, 1, 3)))
        .toThrow("물건의 일부만");
    }
    expect(() => execute(project, map, "map.region.copy", { ...rect(5, 1, 2), dx: -3, dy: 0 }, rect(2, 1, 5)))
      .toThrow("물건의 그림이 조각나요.");
    const replaced = execute(project, map, "map.region.copy", { ...rect(7, 1, 2), dx: -5, dy: 0 }, rect(2, 1, 7));
    expect(replaced.maps[map.id].lowerTiles.slice(index, index + 2)).toEqual([0, 0]);
    const mixedMap = { ...map, upperTiles: map.upperTiles.slice() };
    mixedMap.upperTiles[index] = mixedMap.upperTiles[index - 1] = 3;
    const mixedTileset = { ...tileset, structureKits: tileset.structureKits.map(kit =>
      ({ ...kit, rows: [{ tiles: [1, 2], upperTiles: [3, -1] }] })) };
    const mixed = withMap({ ...project, tilesets: { ...project.tilesets, [tileset.id]: mixedTileset } }, mixedMap);
    expect(() => execute(mixed, mixedMap, "map.region.copy", { ...rect(1, 1), dx: 1, dy: 0 }, rect(1, 1, 2)))
      .toThrow("물건의 일부만");
  });

  it("칠하기와 지우기가 선택 밖 오토타일을 재성형하면 둘 다 원자적으로 거부한다", () => {
    const { project, map, tileset } = customFixture(4);
    tileset.priority = ["lower", "upper", "upper", "upper"];
    tileset.autotileGroups = [{
      id: "worldmap-brush-test", name: "연결 타일", layer: "upper",
      memberTileIds: [1, 2, 3], variantMap: { "0": 1, "1": 2, "2": 2, "4": 2, "8": 2 },
    }];
    const index = map.width * 5 + 5;
    map.upperTiles[index] = 1;
    expect(() => execute(project, map, "map.tile.paint", { x: 6, y: 5, tile: 1, layer: "3" }, rect(6, 5)))
      .toThrow("칠하려면 이웃 타일도 함께");
    expect(map.upperTiles.slice(index, index + 2)).toEqual([1, -1]);
    const connected = { ...map, upperTiles: map.upperTiles.slice() };
    setLayerTileAt(connected, 3, index, 2);
    setLayerTileAt(connected, 3, index + 1, 2);
    expect(() => execute(withMap(project, connected), connected, "map.tile.erase", {}, rect(6, 5)))
      .toThrow("지우려면 이웃 타일도 함께");
    expect(connected.upperTiles.slice(index, index + 2)).toEqual([2, 2]);
  });
});

describe("통행 설정 저장과 표시", () => {
  it("상위 별과 4층에 가려 실제로 열리지 않는 칸은 거부한다", () => {
    const { project, map, tileset } = customFixture(3);
    tileset.priority[1] = "upper";
    tileset.passability[1] = block;
    tileset.passability[2] = block;
    setLayerTileAt(map, 1, 0, 2);
    expect(() => execute(project, map, "map.tile.setPassability", { tile: 1, passable: true }, rect(0, 0)))
      .toThrow("다른 층의 타일이 결정해요.");
    const covered = { ...map, lowerTiles: map.lowerTiles.slice(), upperOverlayTiles: map.upperOverlayTiles?.slice() };
    setLayerTileAt(covered, 1, 0, 0);
    setLayerTileAt(covered, 4, 0, 2);
    expect(() => execute(withMap(project, covered), covered, "map.tile.setPassability", { tile: 1, passable: true }, rect(0, 0)))
      .toThrow("다른 층의 타일이 결정해요.");
  });

  it("막힌 타일을 열고 SQLite를 닫았다 다시 열어도 양쪽 이동이 된다", async () => {
    const { project, map, tileset } = customFixture();
    tileset.passability[1] = block;
    expect(canMove(project, map, 1, 0, 0, 0)).toBe(false);
    const after = execute(project, map, "map.tile.setPassability", { tile: 1, passable: true }, rect(0, 0));
    await expectUndoRestores(project, after, mapTarget(project, map.id)!);
    const projectDir = await mkdtemp(join(tmpdir(), "oprn-tile-passage-"));
    try {
      const database = await initLocalProjectStore({ projectDir });
      try {
        await database.saveProject({ ...after, tilesets: { [tileset.id]: after.tilesets[tileset.id] } });
      } finally {
        database.close();
      }
      const reopened = await openLocalProjectStore({ projectDir });
      try {
        const loaded = reopened.loadSnapshot()!.project;
        ensureBundledTilesets(loaded);
        expect(canMove(loaded, loaded.maps[map.id], 1, 0, 0, 0)).toBe(true);
        expect(canMove(loaded, loaded.maps[map.id], 0, 0, 1, 0)).toBe(true);
      } finally {
        reopened.close();
      }
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });

  it.each(["workshop_piece", "tex_easyrpg_chipset_retro_house"])("다시 열기에서 %s의 칸 번호가 바뀌어도 같은 그림의 통행을 유지한다", sourceChipset => {
    const { project, map } = customFixture();
    const tileset = createSnowNorthTileset();
    const tile = tileset.count - 1;
    const originalGraft = { sourceChipset, sourceTile: 0, targetTile: tile };
    tileset.tileGrafts = [originalGraft];
    tileset.priority[tile] = "lower";
    tileset.passability[tile] = { up: true, down: true, left: true, right: true };
    map.lowerTiles.fill(727);
    map.upperTiles[0] = tile;
    map.tilesetId = tileset.id;
    map.events = [eventAt("grafted_tile", 0, 0, [{ kind: "changeTile", mapId: map.id, x: 0, y: 0, layer: "upper", tile }])];
    const before = { ...project, tilesets: { [tileset.id]: tileset } };
    const original = structuredClone(map);
    const after = execute(before, map, "map.tile.setPassability", { tile, passable: false }, rect(0, 0));
    expect(map).toEqual(original);
    expect(after.tilesets[tileset.id].tileGrafts?.[0]).toEqual(originalGraft);

    const probe = structuredClone(after);
    ensureBundledTilesets(probe);
    const nextTile = probe.tilesets[tileset.id].tileGrafts?.find(graft => graft.sourceChipset === sourceChipset)?.targetTile;
    expect(nextTile).toBeGreaterThan(tile);
    expect(probe.maps[map.id].upperTiles[0]).toBe(nextTile);
    expect(probe.tilesets[tileset.id].passability[nextTile!]).toEqual(block);
  });

  it.each([["영어", en], ["일본어", ja], ["중국어", zh]] as const)("%s 카탈로그가 통행 거부 사유를 번역한다", (_language, catalog) => {
    const translator = createTranslator(catalog);
    for (const message of [
      "공용 타일셋의 통행 설정은 프로젝트에 저장할 수 없어요.",
      "이 타일셋은 프로젝트를 다시 열 때 통행 설정이 원래대로 돌아가요.",
      "이 칸의 통행은 높이 지형이나 다른 층의 타일이 결정해요.",
    ]) {
      const translation = translator.translate(message);
      expect(translation).toMatch(/\S/u);
      expect(translation).not.toBe(message);
    }
  });
});
