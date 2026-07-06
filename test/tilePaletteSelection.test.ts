import { beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { selectPaletteTile } from "@/editor/panels/tilePalette";
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

  it("keeps the current layer for opaque mixed-home tiles", () => {
    editorState.set({ layer: "lower" });

    // 441(불투명 mixed 소품)은 양쪽 레이어 모두 허용 — 레이어를 바꾸지 않는다.
    selectPaletteTile(441);

    expect(editorState.get().selectedTile).toBe(441);
    expect(editorState.get().layer).toBe("lower");
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
});
