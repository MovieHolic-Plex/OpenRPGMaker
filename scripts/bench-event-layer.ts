/**
 * npx tsx --tsconfig tsconfig.app.json scripts/bench-event-layer.ts
 * 500 living NPCs, half mid-step; 50 warmups, 300 samples including stable depth sort.
 * Real Phaser Sprite/Frame/DisplayList/AnimationState; no GPU/DOM rendering or game loop.
 * Only the browser canvas capability probe and scene services are replaced for Node.
 */
import { createRequire } from 'node:module';
import { deepStrictEqual } from 'node:assert';
import { renderSceneWith } from '../test/runtimeEventPageFixtures';
import { renderEventLayer, renderTiles, refreshRuntimeSurfaces } from '../src/player/playSceneMapRuntime';
import { legacyRenderEvents } from '../test/eventLayerLegacyOracle';
import { installFakeDom } from '../test/fakeDom';
const require = createRequire(import.meta.url);
installFakeDom({ animationFrames: 'manual' });
globalThis.window = { devicePixelRatio: 1 } as any;
require.cache[require.resolve('phaser/src/device/CanvasFeatures.js')] = { exports: {} } as any;
const Sprite = require('phaser/src/gameobjects/sprite/Sprite.js');

const Emitter = require('eventemitter3');
const DisplayList = require('phaser/src/gameobjects/DisplayList');
const Frame = require('phaser/src/textures/Frame');
const scene = renderSceneWith({ graphic: { sprite: { type: 'bundled', id: 'tex_easyrpg_charset_people1' } } });
scene.map.width = scene.map.height = 100;
scene.map.lowerTiles = Array(10_000).fill(-1);
scene.map.upperTiles = Array(10_000).fill(-1);
const template = scene.map.events[0];
template.pages![0].movement = { type: 'living', speed: 3, frequency: 3, living: { destinations: [{ mapId: scene.map.id, x: 20, y: 20 }], repeat: true } };
scene.map.events = Array.from({length: 500}, (_,i) => ({...structuredClone(template), id: `npc${i}`, x: i%25, y: Math.floor(i/25)}));
const textures = new Map();
const sys: any = { anims: new Emitter(), events: new Emitter(), queueDepthSort() {},
  updateList: { add() {}, remove() {} }, textures: { get(key: string) {
    if(!textures.has(key)) {
      const texture: any = { key, source: [{ width: 288, height: 256, resolution: 1 }], get(name: any) {
        if(!this.frames.has(name)) this.frames.set(name, new Frame(this, name, 0, 0, 0, 24, 32));
        return this.frames.get(name);
      }, frames: new Map() };
      textures.set(key, texture);
    }
    return textures.get(key);
  } }, game: { renderer: null } };
Object.assign(scene, { sys, textures: sys.textures });
const children = new DisplayList(scene);
Object.assign(scene, { children }); sys.displayList = children;
let created = 0, destroyed = 0;
scene.add.sprite = (x,y,texture,frame) => {
  created++;
  const sprite = new Sprite(scene, x,y,texture,frame);
  sprite.on('destroy', () => destroyed++);
  children.add(sprite);
  return sprite;
};
const movers = new Map();
for (const event of scene.map.events.filter((_, i) => i % 2 === 0)) movers.set(event.id, {
  moveDurationMs: 320, activeMove: { fromX: event.x, fromY: event.y, toX: event.x + 1, toY: event.y,
    elapsedMs: 120, durationMs: 320 },
});
Object.assign(scene, { autonomousNPCs: movers });
const snapshot = () => [...scene.eventSprites].map(([id, s]: [string, any]) => ({id, x:s.x, y:s.y,
  texture:s.texture.key, frame:s.frame.name, depth:s.depth, visible:s.visible, alpha:s.alpha,
  originX:s.originX, originY:s.originY, scaleX:s.scaleX, scaleY:s.scaleY}));
// Keep dispatcher wiring real; exclude unrelated route registration/DOM/game-loop work.
Object.assign(scene, { game: { registry: { get() {} } }, registerPageMoveRoutes() {},
  renderTiles: () => renderTiles(scene) });
const surface = () => refreshRuntimeSurfaces(scene as never);
const cases = process.argv.includes('--surface-only')
  ? [['surface', surface] as const]
  : [['old-event-layer', legacyRenderEvents], ['new-event-layer', renderEventLayer], ['surface', surface]] as const;
let expected: ReturnType<typeof snapshot> | undefined;
for (const [name, run] of cases) {
 for(let i=0;i<50;i++) run(scene);
 const times=[]; created=destroyed=0;
 for(let i=0;i<300;i++){const t=performance.now();run(scene);children.depthSort();times.push(performance.now()-t);}
 if (expected) deepStrictEqual(snapshot(), expected); else expected = snapshot();
 times.sort((a,b)=>a-b);console.log(name, {median: times[150],p95: times[285],created:created/300,destroyed:destroyed/300});
}
