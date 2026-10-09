/** @vitest-environment happy-dom */
// test/structureKitBrushConditions.test.ts
// 사람이 팔레트로 찍는 경로(TilePaintEngine)에서 배치 조건이 집행되는지 — 그리고 **말을 하는지**.
//
// 회귀 배경: 안내를 «스트로크 첫 타일»에서만 띄웠다. 그래서 유효한 자리에서 드래그를 시작해
// 조건을 어기는 자리로 넘어가면 칠이 조용히 멈췄다 — 붓이 고장 난 것처럼 보인다.
// 지금은 «스트로크의 첫 거부»에서 한 번 말하고, 그 뒤로는 같은 말을 반복하지 않는다.

import { beforeEach, describe, expect, it } from "vitest";

import { editorState } from "@/editor/editorState";
import { paletteStampFromKit } from "@/editor/harnessSuggestion/structureKitModel";
import { getMapEditHistoryState, recordProjectSnapshot, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { TilePaintEngine, type TilePaintEngineDeps } from "@/editor/TilePaintEngine";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";
import type { MapId, PlacementSurfaceCondition, SectionStructureKitDef, TilesetDef } from "@/project/types";
import { resetToastsForTest } from "@/util/toast";

const WALL_TILE = 300;
const FLOOR_TILE = 400;
const KIT_TOP = 21;
const KIT_BOTTOM = 51;
/** 벽 행. 이 아래(y=3) 한 줄만 «북쪽이 벽인 바닥»이다. */
const WALL_ROW = 2;

const NORTH_WALL: PlacementSurfaceCondition = {
  id: "pc_north_wall",
  strength: "hard",
  zone: "againstWall",
  facing: "north",
};

function stoveKit(conditions: readonly PlacementSurfaceCondition[]): SectionStructureKitDef {
  return {
    id: "kit_stove",
    kind: "section",
    name: "화덕",
    width: 1,
    height: 2,
    rows: [{ tiles: [KIT_TOP] }, { tiles: [KIT_BOTTOM] }],
    learnedFrom: "db-authored",
    ai: { description: "돌 화덕", placementRules: "부엌 북쪽 벽에 붙인다", placement: [...conditions] },
  };
}

function seed(conditions: readonly PlacementSurfaceCondition[]): { mapId: MapId; tileset: TilesetDef } {
  store.replace(createBlankProject());
  resetMapEditHistory();
  const mapId = store.getCurrent().startMapId;
  store.update((project) => {
    const map = project.maps[mapId]!;
    const tileset = project.tilesets[map.tilesetId]!;
    // 배치 면 판정은 타일 그림이 아니라 통행 플래그를 본다.
    tileset.passability[WALL_TILE] = blockedFlag();
    tileset.passability[FLOOR_TILE] = passableFlag();
    tileset.priority[WALL_TILE] = "lower";
    tileset.priority[FLOOR_TILE] = "lower";
    tileset.structureKits = [structuredClone(stoveKit(conditions))];
    map.lowerTiles.fill(FLOOR_TILE);
    // 상위는 EMPTY(-1) 여야 한다 — 0 은 실제 타일이고 상위가 하위 통행을 덮어쓴다.
    map.upperTiles.fill(TILE.EMPTY);
    for (let x = 0; x < map.width; x += 1) map.lowerTiles[WALL_ROW * map.width + x] = WALL_TILE;
  });
  const current = store.getCurrent();
  return { mapId, tileset: current.tilesets[current.maps[mapId]!.tilesetId]! };
}

/** 캔버스/Phaser 없이 붓질 경로만 재현한다 — 스트로크 한 번 = stroke() 한 번. */
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

function armKit(tileset: TilesetDef): void {
  const kit = tileset.structureKits!.find((entry) => entry.kind === "section")!;
  editorState.set({
    activePaletteStamp: paletteStampFromKit(kit),
    tool: "paint",
    layer: "lower",
  });
}

const shownToasts = () => [...document.querySelectorAll<HTMLElement>(".toast.show")];
const toastTexts = () => shownToasts().map((node) => node.textContent ?? "");

function tileAt(mapId: MapId, x: number, y: number): number {
  const map = store.getCurrent().maps[mapId]!;
  return map.lowerTiles[y * map.width + x]!;
}

beforeEach(() => {
  document.body.innerHTML = "";
  resetToastsForTest();
  editorState.set({ activePaletteStamp: null, tool: "paint", layer: "lower" });
});

describe("blocked stamp history", () => {
  it("preserves redo and undo when placement conditions block a kit", () => {
    const { mapId, tileset } = seed([NORTH_WALL]);
    recordProjectSnapshot(undefined, mapId, { kind: "map" });
    store.updateMap(mapId, (map) => { map.lowerTiles[0] = KIT_TOP; });
    const edited = structuredClone(store.getCurrent().maps[mapId]);
    expect(undoMapEdit()).toBe(true);
    const before = structuredClone(store.getCurrent().maps[mapId]);
    armKit(tileset);
    createPaintEngine(mapId, tileset).stroke([{ x: 4, y: 5 }]);
    expect(store.getCurrent().maps[mapId]).toEqual(before);
    expect(getMapEditHistoryState()).toEqual({ canUndo: false, canRedo: true });
    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId]).toEqual(edited);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId]).toEqual(before);
  });
});

describe("붓질 — 필수 배치 조건", () => {
  it("조건에 맞는 자리에는 찍힌다", () => {
    const { mapId, tileset } = seed([NORTH_WALL]);
    armKit(tileset);
    createPaintEngine(mapId, tileset).stroke([{ x: 4, y: WALL_ROW }]);

    // 킷 좌상단이 벽 행이면 발밑(y=3)이 «북쪽이 벽인 바닥» — 통과.
    expect(tileAt(mapId, 4, WALL_ROW + 1)).toBe(KIT_BOTTOM);
    expect(toastTexts().join(" ")).not.toContain("놓을 수 없습니다");
  });

  it("조건을 어긴 자리에서는 한 칸도 바뀌지 않고 이유를 말한다", () => {
    const { mapId, tileset } = seed([NORTH_WALL]);
    armKit(tileset);
    const before = tileAt(mapId, 4, 6);

    createPaintEngine(mapId, tileset).stroke([{ x: 4, y: 5 }]);

    expect(tileAt(mapId, 4, 6)).toBe(before);
    const text = toastTexts().join(" ");
    expect(text).toContain("화덕");
    expect(text).toContain("놓을 수 없습니다");
    // 규칙 이름만 되뇌지 않는다 — 지금 이 자리가 왜 안 되는지까지.
    expect(text).toContain("벽이 아닙니다");
  });

  it("유효한 자리에서 시작해 어긴 자리로 드래그하면 **그때** 말한다 — 조용히 멈추지 않는다", () => {
    const { mapId, tileset } = seed([NORTH_WALL]);
    armKit(tileset);

    createPaintEngine(mapId, tileset).stroke([
      { x: 4, y: WALL_ROW }, // 유효 — 찍힌다
      { x: 4, y: 5 }, // 위반 — 여기서 처음 거부된다
      { x: 5, y: 5 }, // 위반 — 같은 말을 또 하지 않는다
      { x: 6, y: 5 },
    ]);

    expect(tileAt(mapId, 4, WALL_ROW + 1)).toBe(KIT_BOTTOM);
    expect(tileAt(mapId, 4, 6)).toBe(FLOOR_TILE);
    expect(tileAt(mapId, 5, 6)).toBe(FLOOR_TILE);
    const refusals = toastTexts().filter((text) => text.includes("놓을 수 없습니다"));
    expect(refusals).toHaveLength(1);
  });

  it("어긴 자리를 길게 드래그해도 안내는 한 번뿐이다 — 스택을 채우지 않는다", () => {
    const { mapId, tileset } = seed([NORTH_WALL]);
    armKit(tileset);

    createPaintEngine(mapId, tileset).stroke(
      Array.from({ length: 8 }, (_unused, index) => ({ x: index, y: 5 }))
    );

    expect(toastTexts().filter((text) => text.includes("놓을 수 없습니다"))).toHaveLength(1);
  });

  it("다음 스트로크에서는 다시 말한다 — 스트로크마다 새로 알린다", () => {
    const { mapId, tileset } = seed([NORTH_WALL]);
    armKit(tileset);
    const engine = createPaintEngine(mapId, tileset);

    engine.stroke([{ x: 4, y: 5 }]);
    engine.stroke([{ x: 5, y: 5 }]);

    expect(toastTexts().filter((text) => text.includes("놓을 수 없습니다"))).toHaveLength(2);
  });
});

describe("붓질 — 권장 조건과 조건 없음", () => {
  it("권장 조건은 막지 않고 경고만 남긴다", () => {
    const { mapId, tileset } = seed([{ ...NORTH_WALL, strength: "soft" }]);
    armKit(tileset);

    createPaintEngine(mapId, tileset).stroke([{ x: 4, y: 5 }]);

    expect(tileAt(mapId, 4, 6)).toBe(KIT_BOTTOM);
    const text = toastTexts().join(" ");
    expect(text).toContain("벽에 붙은 바닥");
    expect(text).not.toContain("놓을 수 없습니다");
  });

  it("조건이 없는 킷은 아무 말 없이 아무 자리에나 찍힌다 — 하위 호환", () => {
    const { mapId, tileset } = seed([]);
    armKit(tileset);

    createPaintEngine(mapId, tileset).stroke([{ x: 4, y: 5 }]);

    expect(tileAt(mapId, 4, 6)).toBe(KIT_BOTTOM);
    expect(toastTexts()).toHaveLength(0);
  });
});
