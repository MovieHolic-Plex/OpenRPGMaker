import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { store } from '@/project/store';
import { renderTiles, invalidateTileLayer } from '@/player/playSceneMapRuntime';
import { syncTileCulling } from '@/player/playSceneTileCulling';
import { tilesetTextureKey } from '@/editor/tilesetImage';
import * as tilesetImage from '@/editor/tilesetImage';
import * as policy from '@/editor/tileLayerPolicy';
import { setTileBackingOverride } from '@/editor/runtimeTileMetadata';
import { legacyRenderTiles } from './tileLayerLegacyOracle';
import type { Project } from '@/project/types';

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
    const project=createBlankProject(); const map=project.maps[project.startMapId];
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
    const project=createBlankProject();const map=project.maps[project.startMapId];
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
