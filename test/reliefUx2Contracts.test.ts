import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store, type ProjectChangeDescriptor } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { setLayerTileAt, setShadowAt } from "@/project/mapLayers";
import { emptyRelief } from "@/project/relief/edit";
import { reliefReadSignature, reliefSignature } from "@/project/relief/screen";
import type { ReliefCellChange } from "@/project/relief/changes";
import { commitReliefEdit, reliefTopGrassTile, setReliefStyle } from "@/editor/reliefActions";
import { createReliefGroundSurface, prepareReliefRead, type GroundRaster } from "@/editor/reliefGroundSurface";
import type { ReliefGroundSurface } from "@/project/relief/render";

function projectFixture() {
  const p = createBlankProject(), m = p.maps[p.startMapId]!;
  m.width = m.height = 48; m.tileSize = 16; m.events = [];
  m.lowerTiles = Array(48 * 48).fill(0); m.upperTiles = Array(48 * 48).fill(-1);
  delete m.lowerOverlayTiles; delete m.upperOverlayTiles; delete m.shadowBits;
  m.relief = emptyRelief(48, 48);
  for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) m.relief.levels[y * 48 + x] = 2;
  const t: TilesetDef = { id: "ux2-ground", name: "UX2 ground fixture", kind: "custom",
    image: { type: "bundled", id: "ux2-ground" }, tileSize: 16, tilesPerRow: 2, count: 2,
    priority: ["lower", "lower"], terrain: [0, 0],
    passability: Array.from({ length: 2 }, () => ({ up: true, down: true, left: true, right: true })) };
  p.tilesets[t.id] = t; m.tilesetId = t.id;
  store.replace(p);
  return { id: m.id, tileset: store.getCurrent().tilesets[t.id]! };
}
function atlas(): GroundRaster {
  const data = new Uint8ClampedArray(32 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4; data[i + (x < 16 ? 0 : 1)] = 200; data[i + 3] = 255;
  }
  return { width: 32, height: 16, data };
}
function sample(s: ReliefGroundSurface, x = 10 * 16 + 2, y = 10 * 16 + 2): number[] {
  const out = new Uint8ClampedArray(4); expect(s.sample(x, y, out, 0)).toBe(true); return [...out];
}

describe("relief UX2 ground/revision writer contracts", () => {
  it("retains the ground before equality and changes only lower overlay/shadow fingerprints", () => {
    const { id, tileset } = projectFixture(), image = atlas();
    let map = store.getCurrent().maps[id]!;
    const surface = createReliefGroundSurface(map, tileset, image), cells = surface.cells;
    const signature = surface.signature, i = 10 * 48 + 10, original = [...cells];
    expect(sample(surface)).toEqual([200, 0, 0, 255]);
    let reads = 0;
    map.lowerTiles = new Proxy(map.lowerTiles, { get(a, k, receiver) {
      if (/^\d+$/.test(String(k))) reads++; return Reflect.get(a, k, receiver);
    } });
    for (let n = 0; n < 100; n++) expect(createReliefGroundSurface(map, tileset, image)).toBe(surface);
    expect(reads).toBe(0);
    store.updateMapTiles(id, d => { setLayerTileAt(d, 3, i, 1); setLayerTileAt(d, 4, i, 0); },
      { cells: [{ x: 10, y: 10, layer: "upper" }] });
    store.updateMapTiles(id, d => { d.relief!.levels[i] = 3; }, { relief: true });
    map = store.getCurrent().maps[id]!;
    expect(createReliefGroundSurface(map, tileset, image)).toBe(surface);
    expect(surface.cells).toBe(cells); expect(surface.signature).toBe(signature);
    expect([...cells]).toEqual(original);
    store.updateMapTiles(id, d => setLayerTileAt(d, 2, i, 1), { cells: [{ x: 10, y: 10, layer: "lower" }] });
    map = store.getCurrent().maps[id]!;
    expect(createReliefGroundSurface(map, tileset, image)).toBe(surface);
    expect(surface.signature).not.toBe(signature);
    expect([...cells].flatMap((v, n) => v === original[n] ? [] : [n])).toEqual([i]);
    expect(sample(surface)).toEqual([0, 200, 0, 255]);
    const overlaySignature = surface.signature;
    store.updateMapTiles(id, d => setShadowAt(d, i, 1), { cells: [{ x: 10, y: 10, layer: "lower" }] });
    map = store.getCurrent().maps[id]!;
    expect(surface.signature).not.toBe(overlaySignature);
    expect(sample(surface)).toEqual(sample(createReliefGroundSurface({ ...map, id: "uncached-oracle" }, tileset, image)));
    expect(sample(surface)[1]).toBeLessThan(200);
    expect(sample(surface, 10 * 16 + 10, 10 * 16 + 2)).toEqual([0, 200, 0, 255]);
    // An unspecified map mutation must not retain a stale lower fingerprint.
    store.updateMap(id, d => setLayerTileAt(d, 2, i, -1));
    expect(createReliefGroundSurface(store.getCurrent().maps[id]!, tileset, image)).not.toBe(surface);
  });

  it("hashes once per global generation and detects draft aliases before publication", () => {
    const { id } = projectFixture();
    let map = store.getCurrent().maps[id]!, r = map.relief!;
    let reads = 0;
    r.levels = new Proxy(r.levels, { get(a, k, receiver) {
      if (/^\d+$/.test(String(k))) reads++; return Reflect.get(a, k, receiver);
    } });
    prepareReliefRead(map); const before = reliefReadSignature(r); reads = 0;
    for (let n = 0; n < 100; n++) { prepareReliefRead(map); expect(reliefReadSignature(r)).toBe(before); }
    expect(reads).toBe(0);
    const writes = [
      () => { r.levels[10 * 48 + 10] = 3; },
      () => { r.ramps = Array(48 * 48).fill(0); r.ramps[16 * 48 + 10] = 1; },
      () => { r.style = "grass-cliff"; },
      () => { r.wallDecor = [{ x: 10, y: 15, row: 1, tile: 0 }]; },
      () => { r.wallDecor![0]!.tile = 1; },
    ];
    const signatures = [before];
    for (const write of writes) {
      store.updateMapTiles(id, write, { relief: true }); // deliberately shallow in-place writer
      map = store.getCurrent().maps[id]!; prepareReliefRead(map);
      reads = 0; signatures.push(reliefReadSignature(r)); expect(reads).toBe(48 * 48);
      reads = 0; reliefReadSignature(r); expect(reads).toBe(0);
    }
    expect(new Set(signatures).size).toBe(signatures.length);
    const draft = { ...map }; prepareReliefRead(draft);
    r.wallDecor![0]!.row = 2;
    expect(reliefReadSignature(draft.relief)).not.toBe(signatures.at(-1));
    expect(reliefSignature(draft.relief)).toBe(reliefReadSignature(draft.relief));
    prepareReliefRead(map); reads = 0; reliefReadSignature(r); reliefReadSignature(r);
    expect(reads).toBe(48 * 48);
  });
});

describe("relief UX2 assistant descriptor", () => {
  it("reports grass tile writes together with, but separately from, authored height cells", () => {
    const p = createBlankProject(), m = p.maps[p.startMapId]!;
    m.width = m.height = 48; m.lowerTiles = Array(48 * 48).fill(0); m.upperTiles = Array(48 * 48).fill(-1);
    delete m.relief; delete m.terrainDesign; delete m.shadowBits; delete m.upperOverlayTiles;
    m.lowerOverlayTiles = Array(48 * 48).fill(-1);
    const grass = reliefTopGrassTile(p.tilesets[m.tilesetId]); expect(grass).toBeDefined();
    const i = 20 * 48 + 20, oldGround = grass === 0 ? 1 : 0;
    m.lowerTiles[i] = oldGround; m.lowerOverlayTiles[i] = 1;
    store.replace(p);
    const changes: (ProjectChangeDescriptor & ReliefCellChange)[] = [];
    const stop = store.subscribe((_p, c) => changes.push(c));
    try {
      commitReliefEdit(m.id, r => { r.levels[i] = 2; return true; }, { topGrass: true, label: "grass rise" });
      expect(changes.at(-1)).toMatchObject({ reliefCells: [{ x: 20, y: 20 }], cells: [{ x: 20, y: 20, layer: "lower" }] });
      expect(store.getCurrent().maps[m.id]!.lowerTiles[i]).toBe(grass);
      commitReliefEdit(m.id, r => { r.levels[i] = 0; return true; }, { topGrass: true, label: "grass restore" });
      expect(changes.at(-1)).toMatchObject({ reliefCells: [{ x: 20, y: 20 }], cells: [{ x: 20, y: 20, layer: "lower" }] });
      expect(store.getCurrent().maps[m.id]!.lowerTiles[i]).toBe(oldGround);
      expect(store.getCurrent().maps[m.id]!.lowerOverlayTiles![i]).toBe(1);
    } finally { stop(); }
  });

  it("publishes exact authored level/ramp/decor cells after locks, separately from tile cells", () => {
    const { id } = projectFixture(), map = store.getCurrent().maps[id]!, original = structuredClone(map.relief);
    const a = 10 * 48 + 10, b = 16 * 48 + 10, locked = 10 * 48 + 11;
    store.updateMap(id, d => { d.terrainDesign = { lockedCells: [locked] }; });
    const changes: (ProjectChangeDescriptor & ReliefCellChange)[] = [];
    const stop = store.subscribe((_p, c) => changes.push(c));
    try {
      expect(commitReliefEdit(id, r => {
        r.levels[a] = 3; r.levels[locked] = 4;
        r.ramps = Array(48 * 48).fill(0); r.ramps[b] = 1; r.ramps[locked] = 5;
        r.wallDecor = [{ x: 12, y: 15, row: 1, tile: 1 }, { x: 11, y: 10, row: 1, tile: 1 }];
        return true;
      }, { topGrass: false, label: "fixture relief edit" })).toBe(true);
      const change = changes.at(-1)!;
      expect(change).toMatchObject({ scope: "map", mapId: id, relief: true });
      expect(change.reliefCells).toEqual(expect.arrayContaining([{ x: 10, y: 10 }, { x: 10, y: 16 }, { x: 12, y: 15 }]));
      expect(change.reliefCells).toHaveLength(3); expect("cells" in change).toBe(false);
      expect(map.relief).toEqual(original); // editor callback receives an isolated relief copy
      const saved = store.getCurrent().maps[id]!.relief!;
      expect(saved.levels[locked]).toBe(original!.levels[locked]); expect(saved.ramps![locked]).toBe(0);
      expect(saved.wallDecor).toHaveLength(1);
      expect(setReliefStyle(id, "grass-cliff")).toBe(true);
      expect(changes.at(-1)!.reliefCells).toBeUndefined(); // style affects all cells
      commitReliefEdit(id, () => true, { topGrass: false, label: "known unchanged" });
      expect(changes.at(-1)!.reliefCells).toEqual([]);
    } finally { stop(); }
  });
});
