import { afterEach, describe, expect, it } from 'vitest';
import { createBlankProject, TILE } from '@/project/defaults';
import { startSession } from '@/project/session';
import { store } from '@/project/store';
import { renderTiles, syncRuntimeTileWindow, releaseRuntimeTileWindow } from '@/player/playSceneMapRuntime';
import { RuntimeTileWindow, runtimeCameraTileView } from '@/player/runtimeTileWindow';

const previous = store.getCurrent();
afterEach(() => store.replaceProject(previous));

function fixture(size = 48, tileSize = 16, tile: number = TILE.PATH) {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  Object.assign(map, { width: size, height: size, tileSize, events: [],
    lowerTiles: new Array(size * size).fill(tile), upperTiles: new Array(size * size).fill(-1) });
  store.replaceProject(project);
  const roots: Image[] = [];
  const all: Image[] = [];
  class Image {
    active = true;
    visible = true;
    depth = 0;
    origin = [0.5, 0.5];
    parent?: Image[];
    anims = { isPlaying: false, currentAnim: undefined as { key: string } | undefined,
      progress: 0, accumulator: 0, nextTick: 333, forward: true,
      getProgress() { return this.progress; }, setProgress(n: number) { this.progress = n; },
      pause() {}, resume() {} };
    constructor(readonly x: number, readonly y: number, readonly texture: string, readonly frame: string | number = 0) { all.push(this); }
    setOrigin(x: number, y: number) { this.origin = [x, y]; }
    setDepth(n: number) { this.depth = n; }
    setVisible(n: boolean) { this.visible = n; }
    play(key: string) { this.anims.isPlaying = true; this.anims.currentAnim = { key }; return this; }
    addToDisplayList() { if (!roots.includes(this)) roots.push(this); }
    destroy() {
      this.active = false;
      for (const list of [this.parent, roots]) {
        if (!list) continue;
        const index = list.indexOf(this); if (index >= 0) list.splice(index, 1);
      }
    }
  }
  const create = (x: number, y: number, key: string, frame?: string | number) => new Image(x, y, key, frame);
  const add = (x: number, y: number, key: string, frame?: string | number) => {
    const image = create(x, y, key, frame); image.addToDisplayList(); return image;
  };
  const layer = () => ({ list: [] as Image[], batches: 0,
    add(items: Image | Image[]) {
      this.batches++;
      for (const image of Array.isArray(items) ? items : [items]) {
        const index = roots.indexOf(image); if (index >= 0) roots.splice(index, 1);
        image.parent = this.list; this.list.push(image);
      }
    },
    removeAll(destroy: boolean) { for (const image of [...this.list]) if (destroy) image.destroy(); this.list.length = 0; },
  });
  const view = { x: 160, y: 160, width: 320, height: 240 };
  const scene = { map, session: startSession(project), eventPositions: {},
    cameras: { main: { worldView: view } },
    children: { list: roots, queueDepthSort() {} },
    tileLayer: layer(), upperTileLayer: layer(), eventSprites: new Map(),
    runtimeDom: { clearEventMarkers() {}, upsertEventMarker() {}, syncMissingResourceError() {} },
    missingResources: new Set<string>(),
    add: { image: add, sprite: add,
      rectangle: (x: number, y: number, w: number, h: number, color?: number, alpha?: number) => add(x, y, 'rectangle', `${w},${h},${color},${alpha}`) },
    make: { image: (c: { x: number; y: number; key: string; frame?: string | number }) => create(c.x, c.y, c.key, c.frame),
      sprite: (c: { x: number; y: number; key: string; frame?: string | number }) => create(c.x, c.y, c.key, c.frame) },
    async runEvent() {}, syncRuntimeState() {},
  };
  return { scene, roots, all, view };
}

function descriptors(images: ReturnType<typeof fixture>['roots']) {
  return images.map(({ x, y, texture, frame, depth, origin }) => ({ x, y, texture, frame, depth, origin }));
}

describe('runtime viewport tile residency', () => {
  it('uses a teleported or zoomed camera immediately, before worldView refreshes', () => {
    const camera = { scrollX: 3000, scrollY: 2000, width: 640, height: 480, zoomX: 2, zoomY: 2,
      worldView: { x: 0, y: 0, width: 640, height: 480 } };
    expect(runtimeCameraTileView(camera)).toEqual({ x: 3160, y: 2120, width: 320, height: 240 });
  });
  it.each([512, 1024])('keeps only the camera neighborhood even on a %i map, reuses overlap, evicts roots and containers', size => {
    const { scene, all, view, roots } = fixture(size);
    scene.map.upperTiles.fill(TILE.TREE);
    renderTiles(scene as never);
    expect(all.length).toBeLessThan(6000);
    expect(scene.tileLayer.batches).toBe(1);
    const original = [...scene.tileLayer.list];
    syncRuntimeTileWindow(scene, view);
    expect(scene.tileLayer.list).toEqual(original);
    const created = all.length;
    view.x += 16;
    syncRuntimeTileWindow(scene, view);
    expect(all.length - created).toBeLessThan(300);
    expect(scene.tileLayer.list.some(image => original.includes(image))).toBe(true);
    for (let i = 0; i < 40; i++) {
      Object.assign(view, { x: (30 + i * 7) * 16, y: (30 + i * 5) * 16 });
      syncRuntimeTileWindow(scene, view);
      expect(scene.tileLayer.list.length + scene.upperTileLayer.list.length + roots.length).toBeLessThan(6000);
    }
    expect(original.every(image => !image.active)).toBe(true);
    expect(roots.every(image => image.active)).toBe(true);
    releaseRuntimeTileWindow(scene);
  });

  it.each([16, 32])('matches complete-map draw order, quarters, four layers, shadows and root depths at tile size %s', tileSize => {
    const { scene, roots, view } = fixture(48, tileSize);
    scene.map.lowerOverlayTiles = scene.map.lowerTiles.map((_, i) => i % 4 === 0 ? TILE.FLOWERS : -1);
    scene.map.upperTiles = scene.map.lowerTiles.map((_, i) => i % 5 === 0 ? TILE.TREE : i % 7 === 0 ? TILE.WALL : -1);
    scene.map.upperOverlayTiles = scene.map.lowerTiles.map((_, i) => i % 6 === 0 ? TILE.FLOWERS : -1);
    scene.map.shadowBits = scene.map.lowerTiles.map((_, i) => i % 3 === 0 ? 15 : 0);
    // Camera-less complete-map renderer is an independent rendering oracle.
    const expected = fixture(48, tileSize);
    Object.assign(expected.scene.map, structuredClone(scene.map));
    renderTiles({ ...expected.scene, cameras: undefined } as never);
    renderTiles(scene as never);
    const overlay = scene.add.image(0, 0, 'farm-overlay'); scene.tileLayer.add(overlay);
    const compare = () => {
      const minX = Math.max(0, Math.floor(view.x / tileSize) - 4), minY = Math.max(0, Math.floor(view.y / tileSize) - 4);
      const maxX = Math.min(47, Math.ceil((view.x + view.width) / tileSize) + 4), maxY = Math.min(47, Math.ceil((view.y + view.height) / tileSize) + 4);
      const inside = (image: typeof overlay) => {
        const x = Math.floor(image.x / tileSize), y = Math.floor(image.y / tileSize);
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
      };
      expect(descriptors(scene.tileLayer.list.filter(image => image !== overlay))).toEqual(descriptors(expected.scene.tileLayer.list.filter(inside)));
      expect(descriptors(scene.upperTileLayer.list)).toEqual(descriptors(expected.scene.upperTileLayer.list.filter(inside)));
      expect(descriptors([...roots].sort((a, b) => a.depth - b.depth))).toEqual(descriptors(expected.roots.filter(inside).sort((a, b) => a.depth - b.depth)));
      expect(scene.tileLayer.list.at(-1)).toBe(overlay);
    };
    compare();
    for (const next of [{ x: 512, y: 384 }, { x: 0, y: 0 }, { x: 160, y: 160, width: 640, height: 480 }]) {
      Object.assign(view, next); syncRuntimeTileWindow(scene, view); compare();
    }
    releaseRuntimeTileWindow(scene);
  });

  it('recreates changed tiles on return and resets resident cells on tile refresh', () => {
    const { scene, view } = fixture(64, 16, TILE.GRASS);
    renderTiles(scene as never);
    const old = [...scene.tileLayer.list];
    scene.map.lowerTiles[12 * 64 + 12] = TILE.FLOWERS;
    renderTiles(scene as never);
    expect(old.every(image => !image.active)).toBe(true);
    expect(scene.tileLayer.list.find(image => image.x === 12 * 16 && image.y === 12 * 16)?.frame).toBe(`tile_${TILE.FLOWERS}`);
    Object.assign(view, { x: 700, y: 700 }); syncRuntimeTileWindow(scene, view);
    scene.map.lowerTiles[12 * 64 + 12] = TILE.GRASS;
    Object.assign(view, { x: 160, y: 160 }); syncRuntimeTileWindow(scene, view);
    expect(scene.tileLayer.list.find(image => image.x === 12 * 16 && image.y === 12 * 16)?.frame).toBe(`tile_${TILE.GRASS}`);
    releaseRuntimeTileWindow(scene);
    const count = scene.tileLayer.list.length;
    Object.assign(view, { x: 700, y: 700 }); syncRuntimeTileWindow(scene, view);
    expect(scene.tileLayer.list.length).toBe(count);
  });

  it('new water sprites inherit the retained visible animation frame and fractional time', () => {
    const { scene, all, view } = fixture(64, 16, TILE.WATER);
    renderTiles(scene as never);
    const playing = all.filter(image => image.anims.currentAnim);
    expect(playing.length).toBeGreaterThan(0);
    for (const image of playing) { image.anims.progress = 0.5; image.anims.accumulator = 123; }
    const count = all.length;
    view.x += 16; syncRuntimeTileWindow(scene, view);
    const fresh = all.slice(count).filter(image => image.anims.currentAnim);
    expect(fresh.length).toBeGreaterThan(0);
    for (const image of fresh) {
      expect(image.anims.progress).toBe(0.5);
      expect(image.anims.accumulator).toBe(123);
    }
    releaseRuntimeTileWindow(scene);
  });

  it('ignores invalid views without discarding the last resident window', () => {
    const resident = new RuntimeTileWindow(512, 512, 16);
    let destroyed = 0;
    resident.sync({ x: 0, y: 0, width: 320, height: 240 }, () => [{}], () => destroyed++);
    const size = resident.cells.size;
    expect(resident.sync({ x: NaN, y: 0, width: 0, height: 240 }, () => [], () => destroyed++)).toBe(false);
    expect(resident.cells.size).toBe(size);
    expect(destroyed).toBe(0);
  });
});
