import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createBlankProject, TILE } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { renderTiles, invalidateTileLayer } from "@/player/playSceneMapRuntime";
import { syncTileCulling, resetCullableTiles, trackCullableTile, type CullableImage } from "@/player/playSceneTileCulling";
import { tilesetTextureKey } from "@/editor/tilesetImage";
import * as tilesetImage from "@/editor/tilesetImage";
import * as policy from "@/editor/tileLayerPolicy";
import { setTileBackingOverride } from "@/editor/runtimeTileMetadata";
import { legacyRenderTiles } from "./tileLayerLegacyOracle";
import { RETIRED_COMBINED_TOWN_TILESET_ID, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import type { Project } from "@/project/types";
import { TILE_SIZE } from "@/assets/bundled";
import { mapTileSize } from "@/project/tileGeometry";
import { characterSpriteX, characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { isolateTimers } from "./mergedTeardown";

describe("mapEntryTilePass", () => {
  isolateTimers();
  const original = store.getCurrent();
  afterEach(() => { vi.restoreAllMocks(); store.replaceProject(original); });
  function fixture(project: Project, map = project.maps[project.startMapId]) {
    // Event rendering is covered by eventLayerReuse. Keep all tile/overlay paths real.
    map = { ...map, events: [] };
    const objects: any[] = [];
    const make = (kind: string, x: number, y: number, texture: string, frame: unknown, extra = {}) => {
      const object: any = { kind, x, y, texture, frame, depth: 0, visible: true, active: true, parent: 'root', ...extra,
        setOrigin(x: number, y: number) { this.origin = [x, y]; return this; },
        setDepth(d: number) { this.depth = d; return this; },
        setAlpha(a: number) { this.alpha = a; return this; },
        setDisplaySize(w: number, h: number) { this.displaySize = [w,h]; return this; },
        setVisible(v: boolean) { this.visible = v; return this; },
        play(key: string) { this.animation = key; return this; },
        destroy() { this.active = false; },
      };
      if (kind === 'sprite') object.anims = { pause() { object.paused = true; }, resume() { object.paused = false; } };
      objects.push(object); return object;
    };
    const layer = (name: string) => ({ add(o: any) { o.parent = name; }, removeAll() { for(const o of objects) if(o.parent === name) o.destroy(); } });
    const scene = {
      map, session: startSession(project), eventPositions: {}, tileLayer: layer('lower'), upperTileLayer: layer('upper'),
      eventSprites: new Map(), missingResources: new Set(),
      runtimeDom: { clearEventMarkers() {}, upsertEventMarker() {}, syncMissingResourceError() {} },
      resolveTilesetTexture: vi.fn(tilesetTextureKey),
      add: {
        image: (x: number,y: number,t: string,f: unknown) => make('image',x,y,t,f),
        sprite: (x: number,y: number,t: string,f: unknown) => make('sprite',x,y,t,f),
        rectangle: (x: number,y: number,w: number,h: number,c: number,a: number) => make('rect',x,y,'',null,{w,h,c,alpha:a}),
      }, runEvent: async () => {}, syncRuntimeState() {},
    };
    return { scene, objects };
  }
  function snapshot(f: ReturnType<typeof fixture>) {
    // Array comparison checks insertion order too, not just the set of objects.
    return f.objects.filter(o=>o.active).map(o=>Object.fromEntries(Object.entries(o).filter(([k,v])=>typeof v !== 'function' && k !== 'anims')));
  }
  function equivalent(project: Project, map = project.maps[project.startMapId]) {
    store.replaceProject(project);
    const current = fixture(project,map), old = fixture(project,map);
    for(const f of [current,old]) {
      f.scene.session.farmPlots = {[map.id]: {'2,2': {tilled:true,watered:true}}};
      f.scene.session.placeables = {rock: {id:'rock',mapId:map.id,x:3,y:3,kind:'rock'}} as never;
    }
    renderTiles(current.scene as never); legacyRenderTiles(old.scene as never);
    expect(snapshot(current)).toEqual(snapshot(old));
    for(const view of [{x:0,y:0,width:320,height:240},{x:800,y:720,width:320,height:240},{x:0,y:0,width:160,height:120}]) {
      syncTileCulling(current.scene,view,map.tileSize); syncTileCulling(old.scene,view,map.tileSize);
      expect(snapshot(current)).toEqual(snapshot(old));
    }
    return current;
  }
  describe('map entry tile render pass',()=>{
    it('resolves texture once and repeated tile policies once per synchronous rebuild',()=>{
      const project=createBlankProject(); const map=project.maps[project.startMapId];
      map.width=100; map.height=100; map.lowerTiles=Array(10000).fill(240); map.upperTiles=Array(10000).fill(-1); map.events=[];
      const animation=vi.spyOn(tilesetImage,'tilesetAnimationKeyForTile');
      const backing=vi.spyOn(policy,'tileBackingTile');
      store.replaceProject(project); const f=fixture(project,map);
      renderTiles(f.scene as never);
      expect(f.scene.resolveTilesetTexture).toHaveBeenCalledTimes(1);
      expect(animation).toHaveBeenCalledTimes(1); expect(backing).toHaveBeenCalledTimes(1);
      const count=f.objects.length;
      renderTiles(f.scene as never); expect(f.objects).toHaveLength(count);
      expect(animation).toHaveBeenCalledTimes(1);
      invalidateTileLayer(f.scene); renderTiles(f.scene as never);
      expect(animation).toHaveBeenCalledTimes(2); expect(backing).toHaveBeenCalledTimes(2);
    });
    it.each([16,32,48])('matches legacy objects/order/culling at %ipx, including water, backing, extra layers, shadows and overlays',size=>{
      const project=createBlankProject(); const map=project.maps[project.startMapId];
      map.tileSize=size; map.width=40;map.height=30;
      const tiles=[-1,0,30,60,90,120,124,233,240,258,290,291,292,293,444,445];
      map.lowerTiles=Array.from({length:1200},(_,i)=>tiles[i%tiles.length]);
      map.upperTiles=Array.from({length:1200},(_,i)=>tiles[(i*7)%tiles.length]);
      map.lowerOverlayTiles=Array.from({length:1200},(_,i)=>i%3? -1:124);
      map.upperOverlayTiles=Array.from({length:1200},(_,i)=>i%4? -1:290);
      map.shadowBits=Array.from({length:1200},(_,i)=>i%16);
      equivalent(project,map);
    });
    it('does not retain texture/animation/backing decisions across invalidated renders or failures',()=>{
      // 290 은 옛 합본 마을의 정지 타일 번호다(버들항 기본 시트에서는 같은 번호가 애니메이션 띠라 add.image 를 안 탄다) — 그 시트를 싣는다.
      const project=withRetiredEasyRpgTilesets(createBlankProject()); const map=project.maps[project.startMapId];
      map.tilesetId=RETIRED_COMBINED_TOWN_TILESET_ID;
      map.lowerTiles.fill(290); map.upperTiles.fill(-1); store.replaceProject(project);
      const f=fixture(project,map); renderTiles(f.scene as never);
      invalidateTileLayer(f.scene); f.scene.resolveTilesetTexture.mockReturnValue('replacement');
      renderTiles(f.scene as never);
      expect(f.objects.filter(o=>o.active).every(o=>o.texture==='replacement')).toBe(true);
      invalidateTileLayer(f.scene);
      const add=f.scene.add.image; f.scene.add.image=()=>{throw new Error('texture failure');};
      expect(()=>renderTiles(f.scene as never)).toThrow('texture failure');
      f.scene.add.image=add; invalidateTileLayer(f.scene); renderTiles(f.scene as never);
      expect(f.objects.filter(o=>o.active).every(o=>o.texture==='replacement')).toBe(true);
    });
    it('rebuilds authored animation/backing metadata after invalidation, including in-place edits',()=>{
      const project=createBlankProject(); const map=project.maps[project.startMapId];
      const ts=project.tilesets[map.tilesetId];
      ts.image={type:'uploaded',id:'test-atlas'}; ts.animationStrips=[{baseTile:10,frames:3,fps:4}];
      map.lowerTiles.fill(10);map.upperTiles.fill(-1);store.replaceProject(project);
      const f=fixture(project,map);renderTiles(f.scene as never);
      const first=f.objects.filter(o=>o.active).map(o=>o.animation);
      ts.animationStrips[0].fps=8;setTileBackingOverride(ts,10,240);
      invalidateTileLayer(f.scene);renderTiles(f.scene as never);
      const old=fixture(project,map);legacyRenderTiles(old.scene as never);
      expect(snapshot(f)).toEqual(snapshot(old));
      expect(f.objects.filter(o=>o.active).map(o=>o.animation)).not.toEqual(first);
    });
    it('matches world coast quarters and observes group edits in the next pass',()=>{
      // 월드 칩셋은 2026-10-07 저작권 정리로 새 프로젝트에서 빠졌다 — 옛 저장본처럼 은퇴 시트를 다시 싣는다.
      const project=withRetiredEasyRpgTilesets(createBlankProject());const map=project.maps[project.startMapId];
      map.tilesetId='easyrpg_chipset_world';
      map.lowerTiles=map.lowerTiles.map((_,i)=>[0,30,60,90,120,240][i%6]);
      equivalent(project,map);
      const group=project.tilesets[map.tilesetId].autotileGroups![0];
      group.variantMap['255']=3;
      equivalent(project,map);
    });
    // Optional private read-only fixture; never committed or written by this test.
    it.runIf(Boolean(process.env.MAP_ENTRY_PROJECT))('matches every map in the supplied project copy',()=>{
      const project=JSON.parse(readFileSync(process.env.MAP_ENTRY_PROJECT!, 'utf8')) as Project;
      for(const map of Object.values(project.maps)) equivalent(project,map);
    });
  });
});

describe("playSceneTileCulling", () => {
  isolateTimers();
  type CullTile = CullableImage & { visible: boolean; writes: number };
  function cullTile(): CullTile {
    return {
      visible: true,
      writes: 0,
      setVisible(value: boolean) {
        this.visible = value;
        this.writes += 1;
        return this;
      },
    };
  }
  /** 320x240 화면이 (0,0) 에 있을 때의 월드 뷰. */
  const ORIGIN_VIEW = { x: 0, y: 0, width: 320, height: 240 };
  describe("playSceneTileCulling", () => {
    it("화면 밖 타일만 숨기고 여유 타일은 남긴다", () => {
      const host = {};
      const inside = cullTile();
      const margin = cullTile();
      const outside = cullTile();
      // 320x240 / 16 = 20x15 칸. 여유 2칸이라 최대 x=22, y=17 까지 살린다.
      trackCullableTile(host, inside, 5, 5);
      trackCullableTile(host, margin, 22, 17);
      trackCullableTile(host, outside, 23, 17);

      syncTileCulling(host, ORIGIN_VIEW);

      expect(inside.visible).toBe(true);
      expect(margin.visible).toBe(true);
      expect(outside.visible).toBe(false);
    });

    it("같은 타일 창이면 두 번째 호출에서 아무것도 쓰지 않는다", () => {
      const host = {};
      const tile = cullTile();
      trackCullableTile(host, tile, 60, 60);

      syncTileCulling(host, ORIGIN_VIEW);
      expect(tile.visible).toBe(false);
      const writesAfterFirst = tile.writes;

      // 카메라가 타일 경계를 넘지 않은 이동(8px)은 창을 바꾸지 않는다.
      syncTileCulling(host, { ...ORIGIN_VIEW, x: 8 });
      expect(tile.writes).toBe(writesAfterFirst);

      // 타일 경계를 넘어가야 다시 계산한다.
      syncTileCulling(host, { ...ORIGIN_VIEW, x: 60 * TILE_SIZE, y: 60 * TILE_SIZE });
      expect(tile.visible).toBe(true);
      expect(tile.writes).toBe(writesAfterFirst + 1);
    });

    it("타일 창이 한 칸 움직여도 먼 타일은 다시 쓰지 않고, 경계 타일과 물 애니메이션만 갱신한다", () => {
      const host = {};
      const far = cullTile();
      const edge = cullTile();
      let paused = 0;
      let resumed = 0;
      edge.anims = {
        pause() { paused += 1; },
        resume() { resumed += 1; },
      };
      trackCullableTile(host, far, 80, 80);
      // 320/16+여유 2 = x 22 까지 보인다. 23 은 창 바로 밖.
      trackCullableTile(host, edge, 23, 2);

      syncTileCulling(host, ORIGIN_VIEW);
      expect(far.visible).toBe(false);
      expect(edge.visible).toBe(false);
      expect(paused).toBe(1);
      const farWrites = far.writes;
      const edgeWrites = edge.writes;

      syncTileCulling(host, { ...ORIGIN_VIEW, x: TILE_SIZE });
      expect(far.writes).toBe(farWrites);
      expect(far.visible).toBe(false);
      expect(edge.visible).toBe(true);
      expect(edge.writes).toBe(edgeWrites + 1);
      expect(resumed).toBe(1);
    });

    it("카메라가 멀어지면 앞서 보였던 타일을 다시 숨긴다", () => {
      const host = {};
      const near = cullTile();
      trackCullableTile(host, near, 1, 1);

      syncTileCulling(host, ORIGIN_VIEW);
      expect(near.visible).toBe(true);

      syncTileCulling(host, { ...ORIGIN_VIEW, x: 80 * TILE_SIZE, y: 80 * TILE_SIZE });
      expect(near.visible).toBe(false);
    });

    it("setVisible 이 없는 오브젝트는 추적하지 않는다", () => {
      const host = {};
      const plain = { visible: true } as CullableImage;
      trackCullableTile(host, plain, 99, 99);
      // 추적된 타일이 없으면 syncTileCulling 은 즉시 끝난다 — 오브젝트를 만지지 않는다.
      syncTileCulling(host, ORIGIN_VIEW);
      expect(plain.visible).toBe(true);
    });

    it("망가진 viewport 로는 아무것도 숨기지 않는다", () => {
      const host = {};
      const tile = cullTile();
      trackCullableTile(host, tile, 99, 99);

      syncTileCulling(host, undefined);
      syncTileCulling(host, { x: 0, y: 0, width: 0, height: 240 });
      syncTileCulling(host, { x: 0, y: 0, width: Number.NaN, height: 240 });

      expect(tile.writes).toBe(0);
    });

    it("resetCullableTiles 는 추적 목록과 적용된 창을 함께 버린다", () => {
      const host = {};
      const stale = cullTile();
      trackCullableTile(host, stale, 99, 99);
      syncTileCulling(host, ORIGIN_VIEW);
      expect(stale.visible).toBe(false);

      resetCullableTiles(host);
      const fresh = cullTile();
      trackCullableTile(host, fresh, 99, 99);
      // 창을 버렸으므로 같은 viewport 로도 새 타일에 다시 적용된다.
      syncTileCulling(host, ORIGIN_VIEW);
      expect(fresh.visible).toBe(false);
      // 버려진 타일은 더 만지지 않는다.
      expect(stale.writes).toBe(1);
    });

    it("renderTiles 가 만든 타일은 화면 밖이면 숨는다", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      map.lowerTiles.fill(TILE.GRASS);
      map.upperTiles.fill(-1);
      store.replace(project);

      const created: Array<CullTile & { tx: number; ty: number }> = [];
      const makeImage = (x: number, y: number) => {
        const image = {
          ...cullTile(),
          tx: Math.floor(x / TILE_SIZE),
          ty: Math.floor(y / TILE_SIZE),
          setOrigin: () => undefined,
          setDepth: () => undefined,
          play() {
            return this;
          },
        };
        created.push(image as unknown as CullTile & { tx: number; ty: number });
        return image;
      };
      const scene = {
        map,
        session: startSession(project),
        eventPositions: {},
        tileLayer: { removeAll: () => undefined, add: () => undefined },
        upperTileLayer: { removeAll: () => undefined, add: () => undefined },
        eventSprites: new Map(),
        runtimeDom: {
          clearEventMarkers: () => undefined,
          upsertEventMarker: () => undefined,
          syncMissingResourceError: () => undefined,
        },
        missingResources: new Set<string>(),
        add: { image: makeImage, sprite: makeImage },
        runEvent: async () => undefined,
        syncRuntimeState: () => undefined,
      };

      renderTiles(scene as never);
      expect(created.length).toBeGreaterThan(0);

      syncTileCulling(scene, ORIGIN_VIEW);

      const visibleFar = created.filter((image) => image.visible && image.tx > 22);
      expect(visibleFar).toEqual([]);
      expect(created.some((image) => image.visible && image.tx <= 22)).toBe(true);
    });

    // 내려간 씬을 놓았는지는 GC 를 강제할 수 없어 단위 테스트로 관찰할 수 없다. 대신
    // resetCullableTiles 를 부른 뒤 추적이 처음부터 다시 시작되는지(=기억을 실제로 버렸는지)
    // 확인한다. 씬 종료 시 이 함수를 부르는 것은 PlayScene 의 shutdown/destroy 훅이다.
    it("resetCullableTiles 뒤에는 추적이 처음부터 다시 시작된다", () => {
      const host = { name: "씬" };
      const before = cullTile();
      trackCullableTile(host, before, 5, 5);
      resetCullableTiles(host);

      const after = cullTile();
      trackCullableTile(host, after, 5, 5);
      syncTileCulling(host, { x: 1000, y: 1000, width: 320, height: 240 });

      expect(after.visible, "새로 추적한 타일이 컬링되지 않았다").toBe(false);
      expect(before.writes, "버린 타일이 아직 추적 목록에 남아 있다").toBe(0);
    });
  });
});

describe("tileGeometry", () => {
  isolateTimers();
  describe("per-map tile geometry", () => {
    it("keeps legacy defaults without changing the geometry of another map", () => {
      expect(mapTileSize(undefined)).toBe(16);
      expect(mapTileSize({ tileSize: 32 })).toBe(32);
      expect(mapTileSize({ tileSize: 48 })).toBe(48);
      expect(mapTileSize({}, { tileSize: 48 })).toBe(48);
      expect(mapTileSize({ tileSize: 16 }, { tileSize: 32 })).toBe(16);
      expect(mapTileSize({}, { tileSize: 32 })).toBe(32);
      expect(mapTileSize({ tileSize: NaN })).toBe(16);
      expect(characterSpriteX(2)).toBe(40);
      expect(characterSpriteY(2)).toBe(48);
    });

    it.each([16, 32, 48])("places feet and wide bodies on the %ipx grid", (size) => {
      expect(characterSpriteX(2, size)).toBe(2.5 * size);
      expect(characterSpriteY(2, size)).toBe(3 * size);
      expect(footprintSpriteX(2, { width: 2, height: 3 }, size)).toBe(3 * size);
    });

    it("recomputes culling when the same scene switches map sizes", () => {
      const host = {};
      const image = () => ({ visible: true, setVisible(value: boolean) { this.visible = value; } });
      const near = image(), far = image();
      trackCullableTile(host, near, 10, 10);
      trackCullableTile(host, far, 20, 20);
      const viewport = { x: 320, y: 320, width: 32, height: 32 };
      syncTileCulling(host, viewport, 32);
      expect([near.visible, far.visible]).toEqual([true, false]);
      syncTileCulling(host, viewport, 16);
      expect([near.visible, far.visible]).toEqual([false, true]);
      syncTileCulling(host, { x: 480, y: 480, width: 48, height: 48 }, 48);
      expect([near.visible, far.visible]).toEqual([true, false]);
      resetCullableTiles(host);
    });
  });
});
