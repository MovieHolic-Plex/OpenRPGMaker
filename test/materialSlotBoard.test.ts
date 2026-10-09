// 재료 보드 계약 — 사람이 자동 해석을 **보고 고치는** 유일한 창구.
// 핵심: 고친 것만 저장되고("자동" 은 오버라이드 삭제), 고친 값이 곧바로 생성에 반영된다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMaterialSlotOverride,
  hasMaterialSlotOverride,
  setMaterialSlotOverride,
} from "@/editor/operators/materialSlotEdit";
import { resolveMaterialSlots } from "@/editor/operators/materialSlots";
import { renderMaterialSlotBoard } from "@/editor/panels/materialSlotBoard";
import { forestPaletteFromSlots } from "@/editor/regionTask/forestWrites";
import { ensureBuildPaletteTileGroups } from "@/editor/panels/buildPaletteCore";
import { createBlankProject } from "@/project/defaults";
import type { TilesetDef } from "@/project/types";
import { type FakeElement, findByTestId, installFakeDom } from "./fakeDom";

function combinedTownTileset(): TilesetDef {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const tileset = project.tilesets[map.tilesetId]!;
  ensureBuildPaletteTileGroups(tileset);
  return tileset;
}

describe("슬롯 오버라이드 쓰기", () => {
  it("지정한 값이 자동 해석을 이긴다", () => {
    const tileset = combinedTownTileset();
    const autoGround = resolveMaterialSlots(tileset).ground!.tiles[0];
    expect(setMaterialSlotOverride(tileset, "ground", { tiles: [512] })).toBe(true);
    const slots = resolveMaterialSlots(tileset);
    expect(slots.ground!.tiles).toEqual([512]);
    expect(slots.ground!.source).toBe("user");
    expect(slots.ground!.tiles[0]).not.toBe(autoGround);
  });

  it("「자동」은 값을 다시 넣는 게 아니라 오버라이드를 지운다", () => {
    const tileset = combinedTownTileset();
    const before = resolveMaterialSlots(tileset).ground!.tiles;
    setMaterialSlotOverride(tileset, "ground", { tiles: [512] });
    expect(hasMaterialSlotOverride(tileset, "ground")).toBe(true);
    expect(clearMaterialSlotOverride(tileset, "ground")).toBe(true);
    expect(hasMaterialSlotOverride(tileset, "ground")).toBe(false);
    // 지운 뒤에는 어휘에서 다시 유도된다.
    expect(resolveMaterialSlots(tileset).ground!.tiles).toEqual(before);
  });

  it("마지막 오버라이드를 지우면 빈 객체를 남기지 않는다", () => {
    const tileset = combinedTownTileset();
    setMaterialSlotOverride(tileset, "tree", { tiles: [1] });
    clearMaterialSlotOverride(tileset, "tree");
    expect(tileset.materialSlots).toBeUndefined();
  });

  it("빈 타일 목록·음수는 저장하지 않는다", () => {
    const tileset = combinedTownTileset();
    expect(setMaterialSlotOverride(tileset, "ground", { tiles: [] })).toBe(false);
    expect(setMaterialSlotOverride(tileset, "ground", { tiles: [-1] })).toBe(false);
    expect(tileset.materialSlots).toBeUndefined();
  });

  it("고친 재료가 곧바로 생성 팔레트에 반영된다", () => {
    const tileset = combinedTownTileset();
    setMaterialSlotOverride(tileset, "ground", { tiles: [512] });
    expect(forestPaletteFromSlots(resolveMaterialSlots(tileset)).groundBase).toBe(512);
    clearMaterialSlotOverride(tileset, "ground");
    expect(forestPaletteFromSlots(resolveMaterialSlots(tileset)).groundBase).toBe(240);
  });
});

describe("보드 렌더", () => {
  let restoreDom: (() => void) | undefined;
  beforeEach(() => { restoreDom = installFakeDom(); });
  afterEach(() => { restoreDom?.(); });

  const open = (tileset: TilesetDef, currentTile = 512, onChange?: () => void): FakeElement =>
    renderMaterialSlotBoard({
      tileset,
      currentTile: () => currentTile,
      ...(onChange ? { onChange } : {}),
    }) as unknown as FakeElement;

  it("슬롯 12칸과 채움 수를 보여 준다", () => {
    const root = open(combinedTownTileset());
    expect(findByTestId(root, "material-slot-coverage")?.textContent).toContain("/ 12 채움");
    for (const id of ["ground", "path", "tree", "plaza"]) {
      expect(findByTestId(root, `material-slot-${id}`), `${id} 카드 없음`).not.toBeNull();
    }
    // 자동으로 잡힌 슬롯과 비어 있는 슬롯이 구분된다.
    expect(findByTestId(root, "material-slot-ground")?.dataset.source).toBe("bundled");
    expect(findByTestId(root, "material-slot-plaza")?.dataset.source).toBe("none");
  });

  it("「현재 타일」이 그 슬롯을 사용자 지정으로 바꾸고 다시 그린다", () => {
    const tileset = combinedTownTileset();
    const onChange = vi.fn();
    const root = open(tileset, 512, onChange);
    findByTestId(root, "material-slot-set-ground")?.click();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(tileset.materialSlots?.ground?.tiles).toEqual([512]);
    expect(findByTestId(root, "material-slot-ground")?.dataset.source).toBe("user");
  });

  it("「자동」은 사용자 지정이 있을 때만 눌린다", () => {
    const tileset = combinedTownTileset();
    const root = open(tileset);
    const reset = findByTestId(root, "material-slot-reset-ground") as unknown as { disabled: boolean };
    expect(reset.disabled).toBe(true);
    findByTestId(root, "material-slot-set-ground")?.click();
    expect((findByTestId(root, "material-slot-reset-ground") as unknown as { disabled: boolean }).disabled).toBe(false);
    findByTestId(root, "material-slot-reset-ground")?.click();
    expect(hasMaterialSlotOverride(tileset, "ground")).toBe(false);
    expect(findByTestId(root, "material-slot-ground")?.dataset.source).toBe("bundled");
  });

  it("붓 타일이 없으면(음수) 아무 것도 바꾸지 않는다", () => {
    const tileset = combinedTownTileset();
    const onChange = vi.fn();
    const root = open(tileset, -1, onChange);
    findByTestId(root, "material-slot-set-ground")?.click();
    expect(onChange).not.toHaveBeenCalled();
    expect(tileset.materialSlots).toBeUndefined();
  });

  it("수종이 여러 개면 종 수를 밝힌다", () => {
    const root = open(combinedTownTileset());
    expect(findByTestId(root, "material-slot-tree")?.textContent).toContain("종");
  });
});
