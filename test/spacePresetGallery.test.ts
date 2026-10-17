// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { openMapCreateDialog } from "@/editor/panels/mapCreateDialog";
import { createSpacePresetSidebarPanel } from "@/editor/panels/spacePresetSidebarPanel";
import {
  applySpacePresetToMap,
  createMapWithSpacePreset,
  executeSpacePresetOnDraft,
  findSpacePresetById,
  presetsByCategory,
  SPACE_PRESET_CATALOG,
  SPACE_PRESET_CATEGORIES,
  SPACE_PRESET_STYLE_VARIANTS,
} from "@/editor/spacePresetCatalog";
import { createDraft, finishDraftTilesets } from "@/editor/tools/changeset";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

describe("Space Preset Gallery & Parametric Style Variants (A/B/C/D)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    const blank = createBlankProject();
    store.replace(blank);
    editorState.set({ currentMapId: blank.startMapId });
  });

  it("exposes 20 categorized presets across modern_interior, modern_outdoor, and fantasy_murim_dungeon", () => {
    expect(SPACE_PRESET_CATALOG.length).toBe(20);
    expect(SPACE_PRESET_CATEGORIES.map((c) => c.id)).toEqual([
      "modern_interior",
      "modern_outdoor",
      "fantasy_murim_dungeon",
    ]);
    expect(presetsByCategory("modern_interior").length).toBe(10);
    expect(presetsByCategory("modern_outdoor").length).toBe(4);
    expect(presetsByCategory("fantasy_murim_dungeon").length).toBe(6);
    expect(SPACE_PRESET_STYLE_VARIANTS.map((v) => v.id)).toEqual(["A", "B", "C", "D"]);
  });

  it("produces 4 distinct structural/style variants (A/B/C/D) for representative interior and outdoor presets", () => {
    const base = store.getCurrent();
    for (const presetId of [
      "office-lobby",
      "university-lecture",
      "department-store",
      "subway-station",
      "hospital-ward",
      "museum-gallery",
      "riverside-promenade",
    ]) {
      const preset = findSpacePresetById(presetId)!;
      expect(preset).toBeDefined();
      const signatures = new Set<string>();
      for (const [idx, sv] of [
        [1, "A"],
        [2, "B"],
        [3, "C"],
        [4, "D"],
      ] as const) {
        const draft = createDraft(base);
        const mapId = `m_${presetId}_${sv}`;
        const res = executeSpacePresetOnDraft(draft, preset, mapId, {
          styleVariant: sv,
          variantSeed: idx,
        });
        finishDraftTilesets(draft);
        const built = draft.maps[mapId]!;
        expect(res.styleVariant).toBe(sv);
        expect(built.width).toBeGreaterThanOrEqual(15);
        expect(built.height).toBeGreaterThanOrEqual(11);
        const sig = `${built.width}x${built.height}|${built.lowerTiles.slice(0, 240).join(",")}|${(built.upperTiles ?? []).slice(0, 240).join(",")}`;
        signatures.add(sig);
      }
      expect(signatures.size).toBe(4);
    }
  });

  it("renders Space Preset Gallery inside New Map modal and creates a multi-zone map with selected variant", () => {
    openMapCreateDialog();
    const gallery = document.querySelector<HTMLElement>('[data-testid="map-create-space-gallery"]');
    expect(gallery).not.toBeNull();

    const cycleBtn = document.querySelector<HTMLButtonElement>('[data-testid="space-preset-cycle-variant"]');
    expect(cycleBtn).not.toBeNull();
    cycleBtn!.click(); // A -> B

    const card = document.querySelector<HTMLElement>('[data-testid="space-preset-card-office-lobby"]');
    expect(card).not.toBeNull();
    card!.click();

    const confirmBtn = document.querySelector<HTMLButtonElement>('[data-testid="map-create-confirm"]');
    expect(confirmBtn?.textContent).toContain("오피스 로비");
    expect(confirmBtn?.textContent).toContain("구조 B");
    confirmBtn!.click();

    const currentMapId = editorState.get().currentMapId;
    const createdMap = store.getCurrent().maps[currentMapId]!;
    expect(createdMap.name).toBe("오피스 로비");
    expect(createdMap.tilesetId).toBe("modern_city");
    expect(createdMap.locations?.length).toBeGreaterThanOrEqual(3);
  });

  it("applies preset from Left Sidebar Stamp Place panel and cycles variants on repeated click", () => {
    const panel = createSpacePresetSidebarPanel({ defaultExpanded: true, testidPrefix: "sidebar-space-preset" });
    document.body.append(panel);

    const startId = store.getCurrent().startMapId;
    const chip = panel.querySelector<HTMLButtonElement>('[data-testid="sidebar-space-preset-chip-university-lecture"]');
    expect(chip).not.toBeNull();

    // 1st click -> Variant A
    chip!.click();
    const mapA = structuredClone(store.getCurrent().maps[startId]!);
    expect(mapA.tilesetId).toBe("modern_campus");

    // 2nd click on same chip -> automatically cycles to Variant B
    const chipAgain = panel.querySelector<HTMLButtonElement>('[data-testid="sidebar-space-preset-chip-university-lecture"]')!;
    chipAgain.click();
    const mapB = store.getCurrent().maps[startId]!;
    expect(
      `${mapA.width}x${mapA.height}|${mapA.lowerTiles.slice(0, 150).join(",")}`,
    ).not.toBe(
      `${mapB.width}x${mapB.height}|${mapB.lowerTiles.slice(0, 150).join(",")}`,
    );

    // Direct API checks
    const created = createMapWithSpacePreset(findSpacePresetById("riverside-promenade")!, {
      styleVariant: "C",
      variantSeed: 3,
    });
    expect(created.ok).toBe(true);
    const applied = applySpacePresetToMap(created.mapId, findSpacePresetById("riverside-promenade")!, {
      styleVariant: "D",
      variantSeed: 4,
    });
    expect(applied.ok).toBe(true);
    expect(applied.styleVariant).toBe("D");
  });
});
