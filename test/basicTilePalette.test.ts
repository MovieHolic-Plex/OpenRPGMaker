import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basicTileLabel, makeBasicTilePalette } from "@/editor/panels/basicTilePalette";
import { makeGridPalette } from "@/editor/panels/tilePaletteGrid";
import type { TilesetDef } from "@/project/types";
import { installFakeDom, type FakeElement } from "./fakeDom";

const tileset: TilesetDef = {
  id: "review-sheet", name: "Review sheet", kind: "rpg2k",
  image: { type: "bundled", id: "tex_easyrpg_chipset_combined_town" },
  count: 480, tileSize: 16, tilesPerRow: 30,
  priority: Array.from({ length: 480 }, () => "lower"),
  passability: [], terrain: [],
};

describe("beginner palette source and activation", () => {
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); });
  afterEach(() => restore());

  it.each(["lower", "upper"] as const)("exposes the full shared %s palette instead of 48 raw indices", (layer) => {
    const args = { tileset, selectedTile: -1, layer, onSelectTile: vi.fn() };
    const full = makeGridPalette(args);
    const basic = makeBasicTilePalette({ ...args, query: "", onQuery: vi.fn(), onSelect: args.onSelectTile });
    const ids = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>(".chipset-tile")).map(e => e.dataset.tileIndex);
    expect(ids(basic)).toEqual(ids(full));
    expect(ids(basic).length).toBeGreaterThan(48);
    expect(ids(basic).some(id => Number(id) > 80)).toBe(true);
    expect(Array.from(basic.querySelectorAll<HTMLElement>(".chipset-tile")).filter(e => e.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("preserves custom atlas cells and authored labels instead of combined-town names", () => {
    const custom = { ...tileset, kind: "custom" as const, count: 128, tilesPerRow: 16,
      image: { type: "bundled" as const, id: "custom-test" }, tileMeta: { 127: { label: "유리 창문" } } };
    const basic = makeBasicTilePalette({ tileset: custom, layer: "upper", selectedTile: 127, query: "", onQuery: vi.fn(), onSelect: vi.fn() });
    expect(basic.querySelectorAll(".chipset-tile")).toHaveLength(128);
    expect(basicTileLabel(custom, 127)).toBe("유리 창문");
    expect(basic.querySelector('[data-testid="basic-tile-127"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(basic.querySelector('[data-testid="selected-tile-status"]')?.textContent).toContain("유리 창문");
  });

  it("accepts assistive click activation and avoids duplicating physical pointer activation", () => {
    const onSelect = vi.fn();
    const basic = makeBasicTilePalette({ tileset, layer: "lower", selectedTile: -1, query: "", onQuery: vi.fn(), onSelect });
    const cell = basic.querySelector(".chipset-tile") as unknown as FakeElement;
    cell.click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    onSelect.mockClear();
    cell.dispatchEvent(new Event("pointerdown"));
    const click = new Event("click");
    Object.defineProperty(click, "detail", { value: 1 });
    cell.dispatchEvent(click);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
