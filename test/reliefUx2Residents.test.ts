import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { emptyRelief } from "@/project/relief/edit";
import { reliefCellLiftPx } from "@/project/relief/screen";
import { prepareReliefRead } from "@/editor/reliefGroundSurface";
import { editorState } from "@/editor/editorState";
import { cameraTileWindow, renderVisibleEditSceneTiles, residentReliefTileCells, type EditSceneRenderContext, type EditSceneTileIndex } from "@/editor/editSceneRender";
import { resetCullableTiles, syncTileCulling, trackCullableTile, untrackCullableTile, tileCullingStats, type CullableImage } from "@/player/playSceneTileCulling";

// Asset loading is independent of eviction; retain the actual render/index/
// parent/chunk/cull paths, with lifecycle-aware tile objects instead of Phaser.
vi.mock("@/editor/chipsetTileRender", () => ({
  createChipsetTileObject: (scene: { add: { image(x: number, y: number): unknown } }, _m: unknown, _t: unknown, x: number, y: number) => scene.add.image(x * 16, y * 16),
  createRawChipsetTileObject: (scene: { add: { image(x: number, y: number): unknown } }, _m: unknown, _t: unknown, x: number, y: number) => scene.add.image(x * 16, y * 16),
}));

class Tile implements CullableImage {
  active = true; visible = true; depth = 0; paused = 0; resumed = 0;
  parentContainer: Container | null = null;
  private onDestroy: (() => void)[] = [];
  constructor(public x = 0, public y = 0) {}
  once(_e: "destroy", fn: () => void) { this.onDestroy.push(fn); return this; }
  setVisible(v: boolean) { if (!this.active) throw new Error("culled destroyed tile"); this.visible = v; return this; }
  setAlpha(_a: number) { return this; }
  setTint(_c: number) { return this; }
  setDepth(d: number) { this.depth = d; return this; }
  readonly anims = { pause: () => { this.paused++; }, resume: () => { this.resumed++; } };
  destroy() { if (!this.active) return; this.active = false; this.onDestroy.forEach(f => f()); this.onDestroy = []; }
}
class Container {
  readonly list: (Tile | Container)[] = [];
  parentContainer: Container | null = null; destroyed = false; active = true;
  add(child: Tile | Container) { child.parentContainer = this; this.list.push(child); return this; }
  remove(child: Tile | Container, destroy = false) {
    const i = this.list.indexOf(child);
    if (i >= 0) { this.list.splice(i, 1); child.parentContainer = null; if (destroy) child.destroy(); }
    return this;
  }
  destroy() { this.destroyed = true; this.active = false; }
}

describe("relief UX2 destruction tracking", () => {
  it("removes deaths before any cull and through same-window/outside-bucket early outs", () => {
    const host = {}, near = new Tile(), edge = new Tile(), far = new Tile(), neverVisited = new Tile();
    trackCullableTile(host, near, 0, 0); trackCullableTile(host, edge, 7, 0);
    trackCullableTile(host, far, 80, 80); trackCullableTile(host, neverVisited, 95, 95);
    neverVisited.destroy(); expect(tileCullingStats(host).tracked).toBe(3);
    const view = { x: 0, y: 0, width: 64, height: 64 };
    syncTileCulling(host, view, 16); expect(edge.visible).toBe(false); expect(edge.paused).toBe(1);
    near.destroy(); far.destroy(); syncTileCulling(host, view, 16);
    expect(tileCullingStats(host)).toEqual({ tracked: 1, buckets: 1, destroyed: 0 });
    syncTileCulling(host, { ...view, x: 16 }, 16);
    expect(edge.visible).toBe(true); expect(edge.resumed).toBe(1); // swapped coordinates/bucket survived
    const newlyFar = new Tile(); trackCullableTile(host, newlyFar, 95, 95);
    expect(newlyFar.visible).toBe(false); expect(newlyFar.paused).toBe(1);
    untrackCullableTile(host, edge); edge.destroy(); // explicit editor removal + event is idempotent
    newlyFar.destroy(); expect(tileCullingStats(host)).toEqual({ tracked: 0, buckets: 0, destroyed: 0 });
    resetCullableTiles(host);
  });
});

function residentFixture() {
  const p = createBlankProject(), map = p.maps[p.startMapId]!;
  map.width = map.height = 96; map.tileSize = 16; map.events = [];
  map.lowerTiles = Array(96 * 96).fill(0); map.upperTiles = Array(96 * 96).fill(0);
  delete map.relief; delete map.lowerOverlayTiles; delete map.upperOverlayTiles; delete map.shadowBits;
  store.replace(p); editorState.set({ currentMapId: map.id, layer: "lower" });
  const containers: Container[] = [];
  const view = { x: 0, y: 0, width: 64, height: 64 };
  const scene = { cameras: { main: { worldView: view } }, textures: { get: () => undefined },
    add: { image: (x: number, y: number) => new Tile(x, y),
      container: () => { const c = new Container(); containers.push(c); return c; } } } as unknown as Phaser.Scene;
  const lower = new Container(), upper = new Container(), relief = new Container();
  const index: EditSceneTileIndex = new Map(), chunks = new Map<string, Phaser.GameObjects.Container>();
  const context = { scene, mapId: map.id, tileLayer: lower, upperTileLayer: upper, reliefLayer: relief,
    tileIndex: index, tileChunks: chunks } as unknown as EditSceneRenderContext & { tileIndex: EditSceneTileIndex };
  return { id: map.id, context, scene, index, chunks, view, lower, upper, relief, containers };
}

describe("relief UX2 resident editor cells/chunks", () => {
  it("bounds transition candidates before expansion and includes old offscreen residents", () => {
    const f = residentFixture();
    f.view.x = f.view.y = 32 * 16;
    const flat = store.getCurrent().maps[f.id]!;
    f.index.set("upper:95,95", []); f.index.set("lower:95,95", []);
    const raised = { ...flat, relief: emptyRelief(96, 96) };
    raised.relief.levels[40 * 96 + 34] = 4;
    const candidates = residentReliefTileCells(f.scene, raised, f.index), w = cameraTileWindow(f.scene, raised);
    expect(candidates).toHaveLength((w.maxX - w.minX + 1) * (w.maxY - w.minY + 1) + 1);
    expect(candidates).toContainEqual({ x: 95, y: 95 });
    expect(candidates).toContainEqual({ x: 34, y: 40 }); // source row lifts into view
    expect(candidates.length).toBeLessThan(256);
    expect(residentReliefTileCells(f.scene, flat, f.index).length).toBeLessThan(candidates.length);
  });

  it("evicts both planes' empty chunks and destroyed tracking on repeated pan, including visual Y", () => {
    const f = residentFixture();
    const positions = [0, 16, 32, 48, 64, 80, 0];
    for (let lap = 0; lap < 3; lap++) for (const x of positions) {
      f.view.x = f.view.y = x * 16;
      renderVisibleEditSceneTiles(f.context); syncTileCulling(f.scene, f.view, 16);
      const count = [...f.index.values()].reduce((n, objects) => n + objects.length, 0);
      expect(tileCullingStats(f.scene).tracked).toBe(count);
      expect(tileCullingStats(f.scene).destroyed).toBe(0);
      expect([...f.chunks.values()].every(c => c.list.length > 0)).toBe(true);
      expect(f.chunks.size).toBeLessThanOrEqual(8);
      expect(f.lower.list.length + f.upper.list.length).toBe(f.chunks.size);
    }
    expect(f.containers.some(c => c.destroyed)).toBe(true);
    store.updateMap(f.id, d => {
      d.relief = emptyRelief(96, 96);
      for (let y = 16; y < 24; y++) for (let x = 0; x < 8; x++) d.relief.levels[y * 96 + x] = 4;
    });
    // Stored row 18 belongs to visual row 14, in a different chunk. Lower is
    // carried by reliefLayer; upper remains in its own visual-Y chunk.
    f.view.y = 14 * 16; renderVisibleEditSceneTiles(f.context);
    const upper = f.index.get("upper:3,18")![0]! as unknown as Tile;
    const oldParent = upper.parentContainer!;
    expect(oldParent).not.toBe(f.upper); expect(upper.y).toBe(14 * 16);
    f.view.x = f.view.y = 80 * 16; renderVisibleEditSceneTiles(f.context);
    expect(oldParent.active).toBe(false);
    expect([...f.chunks.values()].every(c => c.list.length > 0)).toBe(true);
    expect(tileCullingStats(f.scene).destroyed).toBe(0);
    expect(tileCullingStats(f.scene).tracked).toBe([...f.index.values()].reduce((n, a) => n + a.length, 0));
    resetCullableTiles(f.scene);
  });

  it("updates the editor lift after a same-object first/last hill", () => {
    const f = residentFixture();
    // Create the flat object after store normalization so it survives by identity.
    store.updateMapTiles(f.id, d => { d.relief = emptyRelief(96, 96); }, { relief: true });
    let map = store.getCurrent().maps[f.id]!, relief = map.relief!;
    prepareReliefRead(map); expect(reliefCellLiftPx(relief, 10, 10, 16)).toBe(0);
    store.updateMapTiles(f.id, () => {
      for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) relief.levels[y * 96 + x] = 2;
    }, { relief: true });
    map = store.getCurrent().maps[f.id]!; prepareReliefRead(map);
    expect(map.relief).toBe(relief); expect(reliefCellLiftPx(relief, 10, 10, 16)).toBe(32);
    store.updateMapTiles(f.id, () => relief.levels.fill(0), { relief: true });
    prepareReliefRead(store.getCurrent().maps[f.id]!);
    expect(reliefCellLiftPx(relief, 10, 10, 16)).toBe(0);
  });
});
