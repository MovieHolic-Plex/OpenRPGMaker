import { describe, expect, it } from 'vitest';
import { createExternalTileset, EXTERNAL_TILESET_PACKS, externalRecipeExample, validateExternalRecipeExample } from '../src/project/externalTilesetCatalog';

describe('user-download tileset furniture metadata', () => {
  it('does not ship artwork or embed remote images in its catalog', () => {
    const json = JSON.stringify(EXTERNAL_TILESET_PACKS);
    expect(json).not.toContain('data:image');
    for (const pack of EXTERNAL_TILESET_PACKS) {
      expect(pack.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(new URL(pack.sourcePage).hostname).toBe('yms.main.jp');
    }
  });

  it('keeps upper furniture blocked, its floor walkable, and unknown cells unreviewed', () => {
    for (const pack of EXTERNAL_TILESET_PACKS) {
      const t = createExternalTileset(pack, 'local-asset', 'local-tiles');
      expect(t.image).toEqual({ type: 'uploaded', id: 'local-asset' });
      expect(t.passability[pack.floorTile]?.down).toBe(true);
      expect(t.tileMeta?.[0]?.source).toBe('unknown');
      expect(t.passability[0]?.down).toBe(false);
      for (const recipe of pack.recipes) for (const tile of recipe.tiles.flat()) {
        expect(tile).toBeLessThan(t.count);
        expect(t.priority[tile]).toBe('upper');
        expect(t.passability[tile]).toEqual({ up: false, down: false, left: false, right: false });
        expect(t.tileMeta?.[tile]?.origin).not.toBe('user');
      }
    }
  });

  it('detects actual missing fragments, wrong layers, and blocked approaches', () => {
    for (const pack of EXTERNAL_TILESET_PACKS) for (const recipe of pack.recipes) {
      const example = externalRecipeExample(pack, recipe);
      expect(validateExternalRecipeExample(pack, recipe, example)).toEqual([]);
      const bad = structuredClone(example);
      const bottom = recipe.sourceRect.height * example.width + 1;
      bad.lowerTiles[bottom] = bad.upperTiles[bottom]!;
      bad.upperTiles[bottom] = -1;
      bad.upperTiles[example.approach.y * example.width + example.approach.x] = recipe.tiles[0]![0]!;
      const errors = validateExternalRecipeExample(pack, recipe, bad);
      expect(errors.map(e => e.code)).toEqual(expect.arrayContaining(['FLOOR_REPLACED', 'OBJECT_CELL', 'APPROACH_BLOCKED']));
      expect(errors.find(e => e.code === 'APPROACH_BLOCKED')).toMatchObject(example.approach);
    }
  });

  it('does not share mutable arrays across imported projects', () => {
    const pack = EXTERNAL_TILESET_PACKS[0]!;
    const first = createExternalTileset(pack, 'a', 'a');
    const second = createExternalTileset(pack, 'b', 'b');
    first.tileGroups![0]!.sourceRect!.x = 99;
    first.tileGroups![0]!.previewMap!.upperTiles.fill(-1);
    first.passability[pack.floorTile]!.up = false;
    expect(second.tileGroups![0]!.sourceRect!.x).not.toBe(99);
    expect(second.tileGroups![0]!.previewMap!.upperTiles.some(t => t >= 0)).toBe(true);
    expect(second.passability[pack.floorTile]!.up).toBe(true);
  });
});
