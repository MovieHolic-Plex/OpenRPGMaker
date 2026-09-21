/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { createBlankProject } from '@/project/defaults';
import type { TilesetDef } from '@/project/types';
import { loadBundledAssets, TEX_TILESET } from '@/assets/bundled';
import { registerUploadedTilesets, uploadedTilesetTextureKey } from '@/assets/uploadedTilesets';
import { ensureTilesetTexture, tilesetAnimationKeyForTile, tilesetTextureKey } from '@/editor/tilesetImage';

function fixture() {
  const project = createBlankProject();
  const tileset: TilesetDef = {
    id: 'reference', name: 'Reference field', kind: 'custom', image: { type: 'uploaded', id: 'field-atlas' },
    tileSize: 16, tilesPerRow: 30, count: 540,
    passability: Array.from({ length: 540 }, () => ({ up: true, down: true, left: true, right: true })),
    priority: Array(540).fill('lower'), terrain: Array(540).fill(0),
    animationStrips: [{ baseTile: 510, frames: 4, fps: 4 }],
  };
  project.tilesets[tileset.id] = tileset;
  project.assets.uploaded['field-atlas'] = { id: 'field-atlas', name: 'Atlas', kind: 'tileset', dataUrl: 'data:image/png;base64,AA==', meta: { width: 480, height: 288 } };
  return { project, tileset };
}

function textureScene(keys: string[]) {
  const frames = new Map(keys.map(key => [key, new Map<string, number[]>()]));
  const animations = new Map<string, { key: string; frameRate: number; frames: { key: string; frame: string }[] }>();
  const scene = {
    textures: {
      exists: (key: string) => frames.has(key),
      get: (key: string) => ({
        getFrameNames: () => [...frames.get(key)!.keys()],
        add: (name: string, ...rectangle: number[]) => frames.get(key)!.set(name, rectangle),
      }),
    },
    anims: { exists: (key: string) => animations.has(key), create: (value: { key: string; frameRate: number; frames: { key: string; frame: string }[] }) => animations.set(value.key, value) },
  } as unknown as Phaser.Scene;
  return { scene, frames, animations };
}

describe('uploaded tilesets in Phaser editor and player', () => {
  it('preloads the saved atlas under the exact key used to draw it, not the bundled exterior', () => {
    const { project, tileset } = fixture();
    const image = vi.fn();
    loadBundledAssets({ load: { image, on: vi.fn() } }, project);
    const key = tilesetTextureKey(tileset);
    expect(key).not.toBe(TEX_TILESET);
    expect(image).toHaveBeenCalledWith(key, project.assets.uploaded['field-atlas'].dataUrl);
    const { scene } = textureScene([key, TEX_TILESET]);
    expect(ensureTilesetTexture(scene, tileset)).toBe(key);
  });

  it('preserves the authored atlas geometry and registers tiles beyond the old 480-frame limit', () => {
    const { project, tileset } = fixture();
    const key = uploadedTilesetTextureKey(tileset);
    const { scene, frames } = textureScene([key]);
    registerUploadedTilesets(scene, project);
    expect(frames.get(key)!.get('tile_510')).toEqual([0, 0, 272, 16, 16]);
    expect(frames.get(key)!.get('tile_539')).toEqual([0, 464, 272, 16, 16]);
    expect(frames.get(key)!.size).toBe(540);
    registerUploadedTilesets(scene, project);
    expect(frames.get(key)!.size).toBe(540);
  });

  it.each([32, 48])('keeps two uploaded images and a %ipx slicing independent', (size) => {
    const { project, tileset } = fixture();
    const other = { ...tileset, id: 'other', image: { type: 'uploaded' as const, id: 'other-image' } };
    const large = { ...tileset, id: 'large', tileSize: size, tilesPerRow: 480 / size, count: (480 / size) * (288 / size), animationStrips: [] };
    project.tilesets.other = other; project.tilesets.large = large;
    const keys = [tileset, other, large].map(tilesetTextureKey);
    expect(new Set(keys).size).toBe(3);
    const { scene, frames } = textureScene(keys);
    registerUploadedTilesets(scene, project);
    expect(frames.get(keys[2])!.get('tile_16')).toEqual([0, (16 % large.tilesPerRow) * size, Math.floor(16 / large.tilesPerRow) * size, size, size]);
    expect(frames.get(keys[0])!.get('tile_16')).toEqual([0, 256, 0, 16, 16]);
  });

  it('binds an authored waterfall strip to the same uploaded frames the renderer requests', () => {
    const { project, tileset } = fixture();
    const key = tilesetTextureKey(tileset);
    const { scene, animations } = textureScene([key]);
    registerUploadedTilesets(scene, project);
    const requested = `${key}:${tilesetAnimationKeyForTile(tileset, 510)}`;
    expect(animations.get(requested)).toMatchObject({ frameRate: 4, frames: [510, 511, 512, 513].map(tile => ({ key, frame: `tile_${tile}` })) });
    expect(tilesetAnimationKeyForTile(tileset, 240)).toBeNull();
    expect(tilesetAnimationKeyForTile(tileset, 513)).toBe(tilesetAnimationKeyForTile(tileset, 510));
  });

  it('does not silently draw the default atlas when uploaded bytes are missing', () => {
    const { project, tileset } = fixture();
    delete project.assets.uploaded['field-atlas'];
    const image = vi.fn();
    loadBundledAssets({ load: { image, on: vi.fn() } }, project);
    expect(image.mock.calls.some(([key]) => key === tilesetTextureKey(tileset))).toBe(false);
    const { scene } = textureScene([TEX_TILESET]);
    expect(ensureTilesetTexture(scene, tileset)).not.toBe(TEX_TILESET);
  });
});
