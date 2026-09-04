// test/structurePlacements.test.ts
// 구조물 배치 인스턴스화(Phase 4) — 맵에 찍은 구조물이 생타일로 녹지 않고 개체로 남는지.
//
// 검증 축:
//  1. 기록 범위: 사람 팔레트 킷 스탬프 1회 = 배치 1개(드래그로 수십 개 X), AI repeat 3 = 3개,
//     실내 오브젝트 = 0개(구조물 아님).
//  2. 재시공: 킷을 고친 뒤 반영 / 덧칠은 확인을 요구(무음 차단 X) / 커진 킷은 원점 유지 + 충돌 시 건너뜀.
//  3. 지우기: 찍기 전 타일을 날것으로 복원, 나중 배치가 덮은 칸은 건드리지 않음.
//  4. 정합성: 맵 축소로 범위를 벗어난 배치는 드롭, 킷 삭제 배치는 고아로 남고 지우기는 됨.

import { beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { paletteStampFromCells, paletteStampFromKit } from "@/editor/harnessSuggestion/structureKitModel";
import {
  eraseStructurePlacement,
  findStructureKit,
  restampStructurePlacement,
  structureKitsForTileset,
  structurePlacementIsOrphan,
} from "@/editor/structurePlacementActions";
import { TilePaintEngine, type TilePaintEngineDeps } from "@/editor/TilePaintEngine";
import { createEmptyToolProject, runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { repairProjectReferences, collectProjectReferenceIssues } from "@/project/io/references";
import {
  captureStructureTiles,
  structurePlacementAt,
  structurePlacementIsOverpainted,
  structurePlacementsOf,
  structureTilesHash,
} from "@/project/structurePlacements";
import { store } from "@/project/store";
import type { GameMap, MapId, Project, SectionStructureKitDef, TilesetDef } from "@/project/types";

/** 3×2 오두막 단면 — 등록 킷(내 스탬프)과 같은 shape. */
const HUT_KIT: SectionStructureKitDef = {
  id: "kit_hut_test",
  kind: "section",
  name: "오두막 단면",
  width: 3,
  height: 2,
  rows: [
    { tiles: [19, 19, 19] },
    { tiles: [49, 116, 49] },
  ],
  learnedFrom: "user-paint",
};

function tilesetIdOf(project: Project, mapId: MapId): string {
  return project.maps[mapId]!.tilesetId;
}

/** 등록 킷 하나를 가진 스토어 프로젝트. 사람 스탬프 경로(store 기반)용. */
function seedStoreWithKit(kit: SectionStructureKitDef = HUT_KIT): { mapId: MapId; tilesetId: string } {
  store.replace(createBlankProject());
  resetMapEditHistory();
  const mapId = store.getCurrent().startMapId;
  const tilesetId = tilesetIdOf(store.getCurrent(), mapId);
  store.update((project) => {
    project.tilesets[tilesetId]!.structureKits = [structuredClone(kit)];
  });
  return { mapId, tilesetId };
}

function currentMap(mapId: MapId): GameMap {
  return store.getCurrent().maps[mapId]!;
}

function tileAt(mapId: MapId, layer: "lower" | "upper", x: number, y: number): number {
  const map = currentMap(mapId);
  const index = y * map.width + x;
  return (layer === "upper" ? map.upperTiles[index] : map.lowerTiles[index])!;
}

/** 캔버스/Phaser 없이 사람 붓질 경로(TilePaintEngine.applyAtPointer)만 재현한다. */
function createPaintEngine(mapId: MapId, tileset: TilesetDef): {
  readonly stroke: (points: readonly { x: number; y: number }[]) => void;
} {
  const paintState = { isPainting: false, lastPaintKey: "" };
  const deps: TilePaintEngineDeps = {
    mapId: () => mapId,
    pointerToTile: (ptr) => ptr as unknown as { x: number; y: number },
    updatePointerStatus: () => {},
    eventLayerClickCount: () => 1,
    pointerClickCount: () => 1,
    offerEventLayerSwitchAt: () => false,
    showEventLayerClickFeedback: () => {},
    openExistingEventAt: () => false,
    handleEventClick: () => {},
    tilesetForMap: () => tileset,
    setLastPointerTile: () => {},
    getPaintState: () => ({ isPainting: paintState.isPainting, lastPaintKey: paintState.lastPaintKey }),
    setPaintState: (state) => {
      if (state.isPainting !== undefined) paintState.isPainting = state.isPainting;
      if (state.lastPaintKey !== undefined) paintState.lastPaintKey = state.lastPaintKey;
    },
  };
  const engine = new TilePaintEngine(deps);
  return {
    stroke: (points) => {
      paintState.lastPaintKey = "";
      for (const point of points) engine.applyAtPointer(point as never);
      paintState.lastPaintKey = "";
    },
  };
}

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
});

describe("기록 범위 — 구조물 킷 스탬프만, 스트로크당 한 번", () => {
  it("사람이 킷을 한 스트로크로 드래그해 찍어도 배치는 1개다", () => {
    const { mapId, tilesetId } = seedStoreWithKit();
    const kit = store.getCurrent().tilesets[tilesetId]!.structureKits!.find((entry) => entry.kind === "section")!;
    editorState.set({
      activePaletteStamp: paletteStampFromKit(kit),
      autoConnectMode: false,
      brushSize: 1,
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
    });

    // 한 번 누른 채 세 칸을 지나가는 드래그 = 스트로크 1회.
    createPaintEngine(mapId, store.getCurrent().tilesets[tilesetId]!).stroke([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);

    const placements = structurePlacementsOf(currentMap(mapId));
    expect(placements).toHaveLength(1);
    expect(placements[0]!.kitId).toBe(kit.id);
    expect({ x: placements[0]!.x, y: placements[0]!.y, w: placements[0]!.w, h: placements[0]!.h })
      .toEqual({ x: 2, y: 2, w: 3, h: 2 });
    // before 길이는 w*h — 지우기 복원의 전제.
    expect(placements[0]!.before.lower).toHaveLength(6);
    expect(placements[0]!.before.upper).toHaveLength(6);
  });

  it("kitId 없는 일반 드래그 스탬프는 배치를 만들지 않는다", () => {
    const { mapId, tilesetId } = seedStoreWithKit();
    editorState.set({
      activePaletteStamp: {
        cells: [{ dx: 0, dy: 0, layer: "lower", tile: 19 }],
        height: 1,
        width: 1,
        source: { endTile: 19, startTile: 19 },
      },
      autoConnectMode: false,
      brushSize: 1,
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
    });
    createPaintEngine(mapId, store.getCurrent().tilesets[tilesetId]!).stroke([{ x: 5, y: 5 }]);
    expect(structurePlacementsOf(currentMap(mapId))).toHaveLength(0);
  });

  it("실내 오브젝트 스탬프는 kitId 가 있어도 구조물이 아니라 배치가 없다", () => {
    const { mapId, tilesetId } = seedStoreWithKit();
    // 실내 오브젝트는 kitId 를 채우지만 tileset.structureKits 어디에도 없다.
    editorState.set({
      activePaletteStamp: paletteStampFromCells({
        cells: [{ dx: 0, dy: 0, layer: "upper", tile: 300 }],
        width: 1,
        height: 1,
        kitId: "bed_h",
      }),
      autoConnectMode: false,
      brushSize: 1,
      currentMapId: mapId,
      layer: "upper",
      tool: "paint",
    });
    createPaintEngine(mapId, store.getCurrent().tilesets[tilesetId]!).stroke([{ x: 6, y: 6 }]);
    expect(structurePlacementsOf(currentMap(mapId))).toHaveLength(0);
    expect(findStructureKit(store.getCurrent().tilesets[tilesetId], "bed_h")).toBeUndefined();
  });
});

describe("제거된 스탬프 호출은 배치를 남기지 않는다", () => {
  it("미등록 호출은 배치를 남기지 않는다", () => {
    const context = { project: createEmptyToolProject("배치 테스트") };
    expect(runTool(context, "create_map", { name: "배치맵", width: 20, height: 15 }).ok).toBe(true);
    const mapId = Object.keys(context.project.maps)[0]!;
    context.project.tilesets[tilesetIdOf(context.project, mapId)]!.structureKits = [structuredClone(HUT_KIT)];

    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: HUT_KIT.id,
      origin: { x: 1, y: 1 },
      repeat: 3,
    });
    expect(result.ok).toBe(false);
    expect(structurePlacementsOf(context.project.maps[mapId]!)).toHaveLength(0);
  });

  it("기본 호출도 배치를 남기지 않는다", () => {
    const context = { project: createEmptyToolProject("기본 반복") };
    runTool(context, "create_map", { name: "배치맵", width: 20, height: 15 });
    const mapId = Object.keys(context.project.maps)[0]!;
    context.project.tilesets[tilesetIdOf(context.project, mapId)]!.structureKits = [structuredClone(HUT_KIT)];
    const result = runTool(context, "stamp_structure_kit", { mapId, kitId: HUT_KIT.id, origin: { x: 0, y: 0 } });
    expect(result.ok).toBe(false);
    expect(structurePlacementsOf(context.project.maps[mapId]!)).toHaveLength(0);
  });
});

describe("지우기 — 찍기 전 타일을 날것으로 복원한다", () => {
  it("복원 후 타일이 찍기 직전 스냅샷과 정확히 같다(오토타일 재개입 없음)", () => {
    const { mapId, tilesetId } = seedStoreWithKit();
    const kit = store.getCurrent().tilesets[tilesetId]!.structureKits!.find((entry) => entry.kind === "section")!;
    const rect = { x: 3, y: 3, w: 3, h: 2 };
    const beforeSnapshot = captureStructureTiles(currentMap(mapId), rect);

    editorState.set({
      activePaletteStamp: paletteStampFromKit(kit),
      autoConnectMode: false,
      brushSize: 1,
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
    });
    createPaintEngine(mapId, store.getCurrent().tilesets[tilesetId]!).stroke([{ x: 3, y: 3 }]);
    const placement = structurePlacementsOf(currentMap(mapId))[0]!;
    expect(tileAt(mapId, "lower", 4, 4)).toBe(116);

    const erased = eraseStructurePlacement(mapId, placement.id);
    expect(erased).toMatchObject({ kind: "erased", skipped: 0 });
    expect(structurePlacementsOf(currentMap(mapId))).toHaveLength(0);
    expect(captureStructureTiles(currentMap(mapId), rect)).toEqual(beforeSnapshot);
  });

  it("겹친 배치: 나중에 찍은 것이 이기고, 오래된 것을 지워도 나중 배치가 덮은 칸은 그대로다", () => {
    const { mapId, tilesetId } = seedStoreWithKit();
    const kit = store.getCurrent().tilesets[tilesetId]!.structureKits!.find((entry) => entry.kind === "section")!;
    const paint = createPaintEngine(mapId, store.getCurrent().tilesets[tilesetId]!);
    editorState.set({
      activePaletteStamp: paletteStampFromKit(kit),
      autoConnectMode: false,
      brushSize: 1,
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
    });

    paint.stroke([{ x: 2, y: 2 }]);
    editorState.set({ activePaletteStamp: paletteStampFromKit(kit) });
    paint.stroke([{ x: 3, y: 2 }]); // 한 칸 겹친다.

    const placements = structurePlacementsOf(currentMap(mapId));
    expect(placements).toHaveLength(2);
    const [first, second] = placements;
    // 겹친 칸(3,2)~(4,3) 은 나중에 찍은 두 번째 배치가 이긴다.
    expect(structurePlacementAt(currentMap(mapId), 3, 2)!.id).toBe(second!.id);
    expect(structurePlacementAt(currentMap(mapId), 2, 2)!.id).toBe(first!.id);

    const overlapTileBefore = tileAt(mapId, "lower", 4, 3);
    const erased = eraseStructurePlacement(mapId, first!.id);
    expect(erased.kind).toBe("erased");
    if (erased.kind === "erased") expect(erased.skipped).toBeGreaterThan(0);
    // 나중 배치 영역은 손대지 않았다.
    expect(tileAt(mapId, "lower", 4, 3)).toBe(overlapTileBefore);
    expect(structurePlacementsOf(currentMap(mapId)).map((entry) => entry.id)).toEqual([second!.id]);
  });

  it("되돌리기(Ctrl+Z)로 지우기 전 상태와 배치 기록이 함께 돌아온다", () => {
    const { mapId, tilesetId } = seedStoreWithKit();
    const kit = store.getCurrent().tilesets[tilesetId]!.structureKits!.find((entry) => entry.kind === "section")!;
    editorState.set({
      activePaletteStamp: paletteStampFromKit(kit),
      autoConnectMode: false,
      brushSize: 1,
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
    });
    createPaintEngine(mapId, store.getCurrent().tilesets[tilesetId]!).stroke([{ x: 4, y: 4 }]);
    const placement = structurePlacementsOf(currentMap(mapId))[0]!;

    eraseStructurePlacement(mapId, placement.id);
    expect(structurePlacementsOf(currentMap(mapId))).toHaveLength(0);
    expect(undoMapEdit()).toBe(true);
    expect(structurePlacementsOf(currentMap(mapId)).map((entry) => entry.id)).toEqual([placement.id]);
    expect(tileAt(mapId, "lower", 5, 5)).toBe(116);
  });
});

describe("재시공 — 배치별 수동, 킷의 현재 모습으로", () => {
  const alwaysConfirm = { confirmOverpaint: async () => true };

  it("킷을 고친 뒤 다시 찍으면 새 모습이 반영된다", async () => {
    const { mapId, tilesetId } = seedStoreWithKit();
    const kit = store.getCurrent().tilesets[tilesetId]!.structureKits!.find((entry) => entry.kind === "section")!;
    editorState.set({
      activePaletteStamp: paletteStampFromKit(kit),
      autoConnectMode: false,
      brushSize: 1,
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
    });
    createPaintEngine(mapId, store.getCurrent().tilesets[tilesetId]!).stroke([{ x: 2, y: 2 }]);
    const placement = structurePlacementsOf(currentMap(mapId))[0]!;
    expect(tileAt(mapId, "lower", 3, 3)).toBe(116);

    // 킷의 문(116) 을 창(49) 으로 고친다.
    store.update((project) => {
      const target = project.tilesets[tilesetId]!.structureKits![0]!;
      if (target.kind === "section") target.rows[1]!.tiles[1] = 49;
    });

    const result = await restampStructurePlacement(mapId, placement.id, alwaysConfirm);
    expect(result.kind).toBe("restamped");
    if (result.kind === "restamped") expect(result.resized).toBe(false);
    expect(tileAt(mapId, "lower", 3, 3)).toBe(49);
    // 다시 찍은 뒤에도 배치는 하나, id 는 유지된다.
    expect(structurePlacementsOf(currentMap(mapId)).map((entry) => entry.id)).toEqual([placement.id]);
  });

  it("덧칠된 배치는 확인을 요구하고, 거절하면 아무것도 바꾸지 않는다", async () => {
    const { mapId, tilesetId } = seedStoreWithKit();
    const kit = store.getCurrent().tilesets[tilesetId]!.structureKits!.find((entry) => entry.kind === "section")!;
    editorState.set({
      activePaletteStamp: paletteStampFromKit(kit),
      autoConnectMode: false,
      brushSize: 1,
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
    });
    createPaintEngine(mapId, store.getCurrent().tilesets[tilesetId]!).stroke([{ x: 2, y: 2 }]);
    const placement = structurePlacementsOf(currentMap(mapId))[0]!;
    expect(structurePlacementIsOverpainted(currentMap(mapId), placement)).toBe(false);

    // 다른 도구가 배치 위를 지나간다.
    store.updateMap(mapId, (map) => {
      map.lowerTiles[3 * map.width + 3] = 421;
    });
    expect(structurePlacementIsOverpainted(currentMap(mapId), placement)).toBe(true);

    let asked = 0;
    const declined = await restampStructurePlacement(mapId, placement.id, {
      confirmOverpaint: async () => {
        asked += 1;
        return false;
      },
    });
    expect(asked).toBe(1);
    expect(declined.kind).toBe("cancelled");
    expect(tileAt(mapId, "lower", 3, 3)).toBe(421); // 무음 차단도, 무음 덮어쓰기도 아니다.

    const accepted = await restampStructurePlacement(mapId, placement.id, {
      confirmOverpaint: async () => {
        asked += 1;
        return true;
      },
    });
    expect(asked).toBe(2);
    expect(accepted.kind).toBe("restamped");
    expect(tileAt(mapId, "lower", 3, 3)).toBe(116);
  });

  it("커진 킷은 좌상단을 유지하고, 이웃 배치와 부딪히면 건너뛴다", async () => {
    const { mapId, tilesetId } = seedStoreWithKit();
    const kit = store.getCurrent().tilesets[tilesetId]!.structureKits!.find((entry) => entry.kind === "section")!;
    const paint = createPaintEngine(mapId, store.getCurrent().tilesets[tilesetId]!);
    editorState.set({
      activePaletteStamp: paletteStampFromKit(kit),
      autoConnectMode: false,
      brushSize: 1,
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
    });
    paint.stroke([{ x: 1, y: 1 }]);
    editorState.set({ activePaletteStamp: paletteStampFromKit(kit) });
    paint.stroke([{ x: 5, y: 1 }]);
    const [first, second] = structurePlacementsOf(currentMap(mapId));

    // 킷을 3×2 → 6×2 로 키운다: 첫 배치(1,1)가 두 번째(5,1)를 침범한다.
    store.update((project) => {
      const target = project.tilesets[tilesetId]!.structureKits![0]!;
      if (target.kind !== "section") return;
      target.width = 6;
      target.rows = [
        { tiles: [19, 19, 19, 19, 19, 19] },
        { tiles: [49, 116, 49, 49, 116, 49] },
      ];
    });

    const blocked = await restampStructurePlacement(mapId, first!.id, alwaysConfirm);
    expect(blocked.kind).toBe("blocked");
    if (blocked.kind === "blocked") expect(blocked.blockedBy.map((entry) => entry.id)).toEqual([second!.id]);
    // 건너뛴 배치는 크기가 그대로다.
    expect(structurePlacementsOf(currentMap(mapId))[0]!.w).toBe(3);

    // 이웃을 지우면 원점을 유지한 채 커진 크기로 다시 찍힌다.
    eraseStructurePlacement(mapId, second!.id);
    const grown = await restampStructurePlacement(mapId, first!.id, alwaysConfirm);
    expect(grown.kind).toBe("restamped");
    if (grown.kind === "restamped") {
      expect(grown.resized).toBe(true);
      expect({ x: grown.placement.x, y: grown.placement.y, w: grown.placement.w, h: grown.placement.h })
        .toEqual({ x: 1, y: 1, w: 6, h: 2 });
    }
  });

  it("이미 겹쳐 찍힌 배치를 같은 크기로 다시 찍는 것은 막지 않는다", async () => {
    // 겹침 자체는 정상(나중이 이김)이다 — 막아야 하는 건 킷이 커져서 남의 자리를 새로 침범할 때뿐.
    const { mapId, tilesetId } = seedStoreWithKit();
    const kit = store.getCurrent().tilesets[tilesetId]!.structureKits!.find((entry) => entry.kind === "section")!;
    const paint = createPaintEngine(mapId, store.getCurrent().tilesets[tilesetId]!);
    editorState.set({
      activePaletteStamp: paletteStampFromKit(kit),
      autoConnectMode: false,
      brushSize: 1,
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
    });
    paint.stroke([{ x: 2, y: 2 }]);
    editorState.set({ activePaletteStamp: paletteStampFromKit(kit) });
    paint.stroke([{ x: 3, y: 2 }]);
    const [first] = structurePlacementsOf(currentMap(mapId));

    const result = await restampStructurePlacement(mapId, first!.id, alwaysConfirm);
    expect(result.kind).toBe("restamped");
  });

  it("맵 경계를 넘게 커진 킷은 out-of-bounds 로 건너뛴다", async () => {
    const { mapId, tilesetId } = seedStoreWithKit();
    const map = currentMap(mapId);
    const kit = store.getCurrent().tilesets[tilesetId]!.structureKits!.find((entry) => entry.kind === "section")!;
    editorState.set({
      activePaletteStamp: paletteStampFromKit(kit),
      autoConnectMode: false,
      brushSize: 1,
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
    });
    createPaintEngine(mapId, store.getCurrent().tilesets[tilesetId]!).stroke([{ x: map.width - 3, y: 1 }]);
    const placement = structurePlacementsOf(currentMap(mapId))[0]!;

    store.update((project) => {
      const target = project.tilesets[tilesetId]!.structureKits![0]!;
      if (target.kind !== "section") return;
      target.width = 6;
      target.rows = [
        { tiles: [19, 19, 19, 19, 19, 19] },
        { tiles: [49, 116, 49, 49, 116, 49] },
      ];
    });
    const result = await restampStructurePlacement(mapId, placement.id, alwaysConfirm);
    expect(result.kind).toBe("out-of-bounds");
    expect(structurePlacementsOf(currentMap(mapId))[0]!.w).toBe(3);
  });
});

describe("정합성 — 고아 배치와 범위 밖 배치", () => {
  it("킷이 삭제되면 배치는 고아로 남고, 재시공은 막히고 지우기는 된다", async () => {
    const { mapId, tilesetId } = seedStoreWithKit();
    const kit = store.getCurrent().tilesets[tilesetId]!.structureKits!.find((entry) => entry.kind === "section")!;
    editorState.set({
      activePaletteStamp: paletteStampFromKit(kit),
      autoConnectMode: false,
      brushSize: 1,
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
    });
    const rect = { x: 2, y: 2, w: 3, h: 2 };
    const beforeSnapshot = captureStructureTiles(currentMap(mapId), rect);
    createPaintEngine(mapId, store.getCurrent().tilesets[tilesetId]!).stroke([{ x: 2, y: 2 }]);
    const placement = structurePlacementsOf(currentMap(mapId))[0]!;

    store.update((project) => {
      project.tilesets[tilesetId]!.structureKits = [];
    });
    expect(structurePlacementIsOrphan(mapId, placement)).toBe(true);

    const restamp = await restampStructurePlacement(mapId, placement.id, { confirmOverpaint: async () => true });
    expect(restamp.kind).toBe("kit-missing");

    // 고아라도 지우기는 된다 — 복원 정보는 배치 레코드에만 있다.
    expect(eraseStructurePlacement(mapId, placement.id).kind).toBe("erased");
    expect(captureStructureTiles(currentMap(mapId), rect)).toEqual(beforeSnapshot);
  });

  it("킷 삭제만으로는 정합성 이슈가 생기지 않는다(프로젝트가 계속 열려야 한다)", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    const rect = { x: 1, y: 1, w: 2, h: 1 };
    map.structurePlacements = [{
      id: "sp_orphan",
      kitId: "kit_deleted",
      ...rect,
      before: captureStructureTiles(map, rect),
      afterHash: structureTilesHash(captureStructureTiles(map, rect)),
    }];
    expect(collectProjectReferenceIssues(project).filter((issue) => issue.includes("structurePlacements"))).toEqual([]);
    repairProjectReferences(project);
    expect(structurePlacementsOf(project.maps[mapId]!)).toHaveLength(1);
  });

  it("맵이 줄어 범위를 벗어난 배치는 수리 단계에서 드롭된다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    const insideRect = { x: 0, y: 0, w: 2, h: 2 };
    map.structurePlacements = [
      {
        id: "sp_inside",
        kitId: "kit_x",
        ...insideRect,
        before: captureStructureTiles(map, insideRect),
        afterHash: "",
      },
      {
        id: "sp_outside",
        kitId: "kit_x",
        x: map.width - 1,
        y: 0,
        w: 4,
        h: 2,
        before: { lower: new Array(8).fill(0), upper: new Array(8).fill(0) },
        afterHash: "",
      },
    ];
    expect(collectProjectReferenceIssues(project).some((issue) => issue.includes("sp_outside") || issue.includes("out of bounds"))).toBe(true);
    repairProjectReferences(project);
    expect(structurePlacementsOf(project.maps[mapId]!).map((entry) => entry.id)).toEqual(["sp_inside"]);
    // 수리 후에는 이슈가 남지 않는다 — 로드 검증(assert)이 통과해야 한다.
    expect(collectProjectReferenceIssues(project).filter((issue) => issue.includes("structurePlacements"))).toEqual([]);
  });
});

describe("직렬화 — 새 선택 필드는 스키마 버전을 올리지 않고 저장된다", () => {
  it("배치가 저장/로드를 왕복해도 그대로 남는다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    const rect = { x: 2, y: 3, w: 3, h: 2 };
    const before = captureStructureTiles(map, rect);
    map.structurePlacements = [{
      id: "sp_roundtrip",
      kitId: HUT_KIT.id,
      ...rect,
      stampedAt: "2026-08-30T00:00:00.000Z",
      before,
      afterHash: structureTilesHash(before),
    }];
    const loaded = deserialize(serialize(project));
    expect(structurePlacementsOf(loaded.maps[mapId]!)).toEqual(map.structurePlacements);
  });
});

describe("킷 화이트리스트 — 등록 킷 이름공간", () => {
  it("등록 킷만 구조물 킷이다", () => {
    const { tilesetId } = seedStoreWithKit();
    const tileset = store.getCurrent().tilesets[tilesetId]!;
    const kits = structureKitsForTileset(tileset);
    expect(kits.some((kit) => kit.id === HUT_KIT.id)).toBe(true);
    expect(kits.some((kit) => kit.id.startsWith("kit_house_"))).toBe(false);
    expect(kits.some((kit) => kit.id === "bed_h")).toBe(false);
  });
});
