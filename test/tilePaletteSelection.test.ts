import { beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { paintTile } from "@/editor/actions";
import { selectPaletteTile } from "@/editor/panels/tilePalette";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";

describe("tile palette selection", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    editorState.set({ currentMapId: null, layer: "upper", tool: "fill", selectedTile: TILE.GRASS });
  });

  it("switches to the tile's home layer when a lower tile is selected on the upper layer", () => {
    // RM2K3식 엄격 분류: WATER는 하위 레이어 타일이므로 선택 시 하위 레이어로 전환된다.
    selectPaletteTile(TILE.WATER);

    expect(editorState.get().selectedTile).toBe(TILE.WATER);
    expect(editorState.get().layer).toBe("lower");
    expect(editorState.get().tool).toBe("fill");
  });

  it("switches to the upper layer when an upper-home tile (fence) is selected on the lower layer", () => {
    editorState.set({ layer: "lower" });

    // 울타리(378)는 stackable 소품 — 홈 레이어가 상위다.
    selectPaletteTile(378);

    expect(editorState.get().selectedTile).toBe(378);
    expect(editorState.get().layer).toBe("upper");
  });

  it("switches to upper when tile home is upper (opaque prop 441)", () => {
    editorState.set({ layer: "lower" });

    // 441은 홈 레이어 upper — 선택 시 상위로 전환한다.
    selectPaletteTile(441);

    expect(editorState.get().selectedTile).toBe(441);
    expect(editorState.get().layer).toBe("upper");
  });

  it("switches to the upper layer when a transparent chip is selected", () => {
    editorState.set({ layer: "lower" });

    // FLOWERS는 투명 칩이라 상위 전용 — 선택 시 상위 레이어로 전환한다.
    selectPaletteTile(TILE.FLOWERS);

    expect(editorState.get().selectedTile).toBe(TILE.FLOWERS);
    expect(editorState.get().layer).toBe("upper");
  });

  it("does not leave the event layer when a tile is selected", () => {
    editorState.set({ layer: "event", tool: "event", selectedTile: TILE.GRASS });

    selectPaletteTile(TILE.FLOWERS);

    expect(editorState.get().selectedTile).toBe(TILE.FLOWERS);
    expect(editorState.get().layer).toBe("event");
    expect(editorState.get().tool).toBe("event");
  });

  it("selects the sand cluster representative and paintTile applies builtin 8-neighbor sand shaping", () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({ currentMapId: mapId, layer: "upper", tool: "select" });

    selectPaletteTile(SAND_TILE.ISOLATED);

    expect(editorState.get()).toMatchObject({
      layer: "lower",
      selectedTile: SAND_TILE.ISOLATED,
      tool: "paint",
    });
    paintTile(mapId, "lower", 1, 1, editorState.get().selectedTile);
    let map = store.getCurrent().maps[mapId];
    expect(map.lowerTiles[1 * map.width + 1]).toBe(SAND_TILE.ISOLATED);

    for (let x = 5; x <= 13; x += 1) {
      for (let y = 6; y <= 8; y += 1) paintTile(mapId, "lower", x, y, editorState.get().selectedTile);
    }
    for (let y = 3; y <= 11; y += 1) {
      for (let x = 8; x <= 10; x += 1) paintTile(mapId, "lower", x, y, editorState.get().selectedTile);
    }

    map = store.getCurrent().maps[mapId];
    for (const [x, y] of [[8, 6], [10, 6], [8, 8], [10, 8]] as const) {
      expect(map.lowerTiles[y * map.width + x], `inner (${x},${y})`).toBe(SAND_TILE.INNER_CORNER);
    }
  });
});
