// test/comboBrushCatalog.test.ts
// 큐레이션 Combo Brush 목록의 **계약**. 이 파일이 지키는 것은 세 가지고, 전부
// "번호 인접으로 추론하지 않는다"는 규칙을 기계적으로 강제하기 위한 것이다:
//
//  ① 모든 셀 타일은 그 조합이 인용한 CHIPSET_TILE_GROUPS 가방 안에 있어야 한다.
//     → 목록이 근거 없이 이웃 번호를 끌어오면 여기서 깨진다.
//  ② 선언한 레이어가 엔진의 실제 판정(defaultPaintLayerForTile)과 같아야 한다.
//     → 지붕 면을 upper 로 잘못 적었던 실제 사고를 다시 잡는 자리.
//  ③ dx/dy 가 선언한 width×height 를 **정확히** 채워야 한다(구멍도 중복도 없다).
//
// 목록과 이 테스트가 어긋나면 목록이 아니라 테스트가 먼저 깨진다.

import { describe, expect, it } from "vitest";

import {
  COMBO_BRUSH_CATEGORIES,
  COMBO_BRUSH_REVIEW_OWNER,
  CURATED_COMBO_BRUSHES,
  comboBrushCatalogEntry,
  comboBrushStampFromCatalog,
  curatedComboBrushesForTileset,
} from "@/editor/comboBrushCatalog";
import { comboBrushLayerSummary, isComboBrush } from "@/editor/comboBrush";
import { defaultPaintLayerForTile } from "@/editor/tileLayerClassification";
import { createBlankProject } from "@/project/defaults";
import { CHIPSET_TILE_GROUPS } from "@/project/defaults/chipsetMapping";
import type { TilesetDef } from "@/project/types";

function defaultTileset(): TilesetDef {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  return project.tilesets[map.tilesetId]!;
}

describe("curated combo brush catalog contract", () => {
  it("ships at least one combination per declared category", () => {
    for (const category of COMBO_BRUSH_CATEGORIES) {
      expect(CURATED_COMBO_BRUSHES.some((entry) => entry.category === category.id)).toBe(true);
    }
  });

  it("gives every entry a unique id, a human name and a note", () => {
    const ids = CURATED_COMBO_BRUSHES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of CURATED_COMBO_BRUSHES) {
      expect(entry.name.trim().length).toBeGreaterThan(0);
      expect(entry.note.trim().length).toBeGreaterThan(0);
      expect(entry.sourceGroups.length).toBeGreaterThan(0);
      expect(comboBrushCatalogEntry(entry.id)).toBe(entry);
    }
  });

  // ① 근거 추적 — 인용한 가방 밖 타일은 목록에 들어올 수 없다.
  it("sources every cell tile from a CHIPSET_TILE_GROUPS bag the entry cites", () => {
    for (const entry of CURATED_COMBO_BRUSHES) {
      const allowed = new Set<number>();
      for (const key of entry.sourceGroups) {
        const bag = CHIPSET_TILE_GROUPS[key];
        expect(bag, `${entry.id} cites unknown group ${String(key)}`).toBeTruthy();
        for (const tile of bag) allowed.add(tile);
      }
      for (const cell of entry.cells) {
        expect(
          allowed.has(cell.tile),
          `${entry.id}: tile ${cell.tile} is not in [${entry.sourceGroups.join(", ")}]`,
        ).toBe(true);
      }
    }
  });

  // ② 레이어 라우팅 — 목록의 선언과 엔진 판정이 같아야 한다.
  it("declares the layer each tile actually lives on", () => {
    const tileset = defaultTileset();
    const mismatches: string[] = [];
    for (const entry of CURATED_COMBO_BRUSHES) {
      for (const cell of entry.cells) {
        const actual = defaultPaintLayerForTile(tileset, cell.tile);
        if (actual !== cell.layer) mismatches.push(`${entry.id} tile ${cell.tile}: declared ${cell.layer}, engine says ${actual}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  // ③ 발자국 — 선언한 폭·높이를 구멍 없이 정확히 채운다.
  it("fills the declared width x height footprint exactly once per cell", () => {
    for (const entry of CURATED_COMBO_BRUSHES) {
      expect(entry.width).toBeGreaterThan(0);
      expect(entry.height).toBeGreaterThan(0);
      const seen = new Set<string>();
      for (const cell of entry.cells) {
        expect(cell.dx, `${entry.id} dx out of range`).toBeGreaterThanOrEqual(0);
        expect(cell.dy, `${entry.id} dy out of range`).toBeGreaterThanOrEqual(0);
        expect(cell.dx).toBeLessThan(entry.width);
        expect(cell.dy).toBeLessThan(entry.height);
        const key = `${cell.dx},${cell.dy},${cell.layer}`;
        expect(seen.has(key), `${entry.id} duplicates ${key}`).toBe(false);
        seen.add(key);
      }
      // 셀이 최소한 각 행·열을 한 번씩은 건드려야 한다 — 빈 행/열이 있으면 선언이 과장이다.
      for (let dx = 0; dx < entry.width; dx += 1) {
        expect(entry.cells.some((cell) => cell.dx === dx), `${entry.id} column ${dx} empty`).toBe(true);
      }
      for (let dy = 0; dy < entry.height; dy += 1) {
        expect(entry.cells.some((cell) => cell.dy === dy), `${entry.id} row ${dy} empty`).toBe(true);
      }
    }
  });

  it("makes every entry a real composite combo brush, never a single cell", () => {
    for (const entry of CURATED_COMBO_BRUSHES) {
      const stamp = comboBrushStampFromCatalog(entry);
      expect(isComboBrush(stamp)).toBe(true);
      expect(stamp.origin).toBe("curated");
      expect(stamp.label).toBe(entry.name);
      expect(stamp.width).toBe(entry.width);
      expect(stamp.height).toBe(entry.height);
      expect(["lower", "upper", "mixed"]).toContain(comboBrushLayerSummary(stamp));
    }
  });

  it("exposes combinations only on the default chipset and only when the tiles exist", () => {
    expect(curatedComboBrushesForTileset({ isDefaultChipset: false, tileCount: 512 })).toEqual([]);
    const all = curatedComboBrushesForTileset({ isDefaultChipset: true, tileCount: 512 });
    expect(all.length).toBe(CURATED_COMBO_BRUSHES.length);
    // 타일 수가 모자란 칩셋에서는 범위를 넘는 조합이 조용히 빠진다(엉뚱한 그림 방지).
    const tiny = curatedComboBrushesForTileset({ isDefaultChipset: true, tileCount: 100 });
    expect(tiny.length).toBeLessThan(all.length);
    for (const entry of tiny) {
      for (const cell of entry.cells) expect(cell.tile).toBeLessThan(100);
    }
  });

  it("names the review owner so new presets cannot be added silently", () => {
    expect(COMBO_BRUSH_REVIEW_OWNER).toContain("editor-pre-edit-routing.md");
  });
});
