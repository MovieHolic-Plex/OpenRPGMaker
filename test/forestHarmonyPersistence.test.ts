import { expect, it } from 'vitest';
import { createForestHarmonyTileset } from '@/project/defaults/forestHarmony';
import { validateTileset } from '@/project/io/shapeResourceFields';

it('includes trailing atlas padding in all persisted tile arrays', () => {
  const tileset = createForestHarmonyTileset();
  expect(() => validateTileset(tileset.id, tileset)).not.toThrow();
  expect(tileset.count).toBe(2550);
  expect(tileset.passability[2549]).toEqual({ up: false, down: false, left: false, right: false });
});
