import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { store } from '@/project/store';
import { renderEventLayer, renderTiles } from '@/player/playSceneMapRuntime';
import { characterSpriteX, characterSpriteY } from '@/player/characterDepth';
import { legacyRenderEvents } from './eventLayerLegacyOracle';
import { installFakeDom } from './fakeDom';
import { renderSceneWith, mockSprite } from './runtimeEventPageFixtures';
import { beginFurniturePush } from '@/player/furniturePushAnimation';
import { runtimeEventViewsForMap } from '@/project/runtimeEventState';
import { showSceneEmote, syncSceneEmotes, describeSceneEmotes } from '@/player/playSceneEmotes';
import { dialogueSceneHooks } from '@/player/playSceneDialogueHooks';
import type { PlaySceneContext } from '@/player/playSceneTypes';
import type { AutonomousMover } from '@/player/playSceneTypes';

let restore: () => void;
let previous: ReturnType<typeof store.getCurrent>;
beforeEach(() => { previous = store.getCurrent(); restore = installFakeDom({ animationFrames: 'manual' }); });
afterEach(() => { store.replaceProject(previous); restore(); });

function fixture(count = 1) {
  const base = renderSceneWith({ graphic: { sprite: { type: 'bundled', id: 'tex_easyrpg_charset_people1' } } });
  const template = base.map.events[0];
  template.pages![0].movement = { type: 'living', speed: 3, frequency: 3, living: { destinations: [{ mapId: base.map.id, x: 20, y: 20 }], repeat: true } };
  base.map.events = Array.from({ length: count }, (_, i) => ({ ...structuredClone(template), id: `npc${i}`, x: i % 25, y: Math.floor(i / 25) }));
  const counts = { created: 0, destroyed: 0 };
  const scene = Object.assign(base, {
    autonomousNPCs: new Map<string, AutonomousMover>(),
    eventGraphicPatternOverrides: new Map<string, number>(),
    characterShadows: new Map(),
    tweens: { getTweens: () => [] as { targets: object[] }[] },
  });
  scene.add.sprite = (x, y, texture, frame) => {
    counts.created++;
    const sprite = Object.assign(mockSprite(x, y, texture), {
      active: true, visible: true, width: 24, height: 32, scaleX: 1, scaleY: 1,
      originX: 0.5, originY: 1, displayHeight: 32,
      setOrigin(x: number, y: number) { this.origin = [x, y]; this.originX = x; this.originY = y; },
      setScrollFactor() {},
      blendMode: 0, isTinted: false, flipX: false, flipY: false, rotation: 0,
      setScale(value: number) { this.scaleX = this.scaleY = value; },
      destroy() { this.active = false; counts.destroyed++; },
    });
    sprite.setFrame(frame ?? 0);
    return sprite;
  };
  return { scene, counts };
}
function state(scene: ReturnType<typeof fixture>['scene']) {
  return [...scene.eventSprites].map(([id, s]) => ({ id, x: s.x, y: s.y, texture: s.texture.key,
    frame: s.frame, depth: s.depth, visible: (s as typeof s & { visible: boolean }).visible, alpha: s.alpha, origin: s.origin,
    scaleX: (s as typeof s & { scaleX: number }).scaleX, scaleY: (s as typeof s & { scaleY: number }).scaleY }));
}
function equivalent(scene: ReturnType<typeof fixture>['scene']) {
  const expected = { ...scene, eventSprites: new Map(), characterShadows: new Map(), missingResources: new Set<string>() };
  legacyRenderEvents(expected);
  expect(state(scene)).toEqual(state(expected));
  expect(scene.missingResources).toEqual(expected.missingResources);
}

describe('event layer reuse', () => {
  it('retains 500 NPC objects across renderTiles surface refreshes', () => {
    const { scene, counts } = fixture(500);
    renderTiles(scene);
    const old = new Map(scene.eventSprites);
    const created = counts.created;
    renderTiles(scene);
    expect(counts.created).toBe(created);
    expect(counts.destroyed).toBe(0);
    for (const [id, sprite] of old) expect(scene.eventSprites.get(id)).toBe(sprite);
    equivalent(scene);
  });
  it('updates fractional movement, direction and frames without replacing sprites', () => {
    const { scene } = fixture();
    renderEventLayer(scene);
    const old = scene.eventSprites.get('npc0');
    scene.eventPositions.npc0 = { x: 4, y: 3, direction: 'left' };
    scene.autonomousNPCs.set('npc0', { moveDurationMs: 400,
      activeMove: { fromX: 3, fromY: 2, toX: 4, toY: 3, elapsedMs: 75, durationMs: 300 } } as AutonomousMover);
    renderEventLayer(scene);
    expect(scene.eventSprites.get('npc0')).toBe(old);
    expect(old).toMatchObject({ x: characterSpriteX(3.25), y: characterSpriteY(2.25) });
    equivalent(scene);
  });
  it('replaces only changed graphics, keeps pattern overrides, and removes absent graphics', () => {
    const { scene } = fixture(3);
    renderEventLayer(scene);
    const old = new Map(scene.eventSprites);
    scene.eventGraphicPatternOverrides.set('npc0', 7);
    scene.map.events[1].pages![0].graphic.scale = 2;
    renderEventLayer(scene);
    expect(scene.eventSprites.get('npc0')).not.toBe(old.get('npc0'));
    expect(scene.eventSprites.get('npc1')).not.toBe(old.get('npc1'));
    expect(scene.eventSprites.get('npc2')).toBe(old.get('npc2'));
    expect(scene.eventSprites.get('npc0')?.frame).toBe(7);
    equivalent(scene);
    const current = scene.eventSprites.get('npc0');
    renderEventLayer(scene);
    expect(scene.eventSprites.get('npc0')).toBe(current);
    scene.map.events[0].pages![0].graphic.sprite = undefined;
    scene.session.erasedEventIds = ['npc1'];
    renderEventLayer(scene);
    expect([...scene.eventSprites.keys()]).toEqual(['npc2']);
    equivalent(scene);
  });
  it.each(['alpha', 'visible', 'blendMode', 'isTinted', 'flipX', 'rotation', 'tween', 'chain'])(
    'keeps old fresh-object semantics for transient %s and captured callbacks', key => {
      const { scene } = fixture(); renderEventLayer(scene);
      const old = scene.eventSprites.get('npc0')!;
      if (key === 'chain') scene.tweens.getTweens = () => [{ data: [{ targets: [old] }] }, { targets: null, data: null }] as never;
      else if (key === 'tween') scene.tweens.getTweens = () => [{ targets: [old] }];
      else Object.assign(old, { [key]: key === 'visible' ? false : key === 'alpha' ? 0.2 : 1 });
      renderEventLayer(scene);
      expect(scene.eventSprites.get('npc0')).not.toBe(old);
      equivalent(scene);
    });
  it('reuses shadows, hides them at the old refresh boundary, and cleans erased owners', () => {
    const { scene } = fixture(2); renderEventLayer(scene);
    const shadow = { visible: true, destroyed: false,
      setVisible(value: boolean) { this.visible = value; }, destroy() { this.destroyed = true; } };
    scene.characterShadows.set('npc0', shadow);
    renderEventLayer(scene);
    expect(scene.characterShadows.get('npc0')).toBe(shadow);
    expect(shadow).toMatchObject({ visible: false, destroyed: false });
    scene.eventSprites.get('npc0')!.destroy();
    scene.eventSprites.delete('npc0'); // erase command owns the sprite, refresh owns stale shadows
    scene.session.erasedEventIds = ['npc0'];
    renderEventLayer(scene);
    expect(shadow.destroyed).toBe(true);
    expect(scene.characterShadows.has('npc0')).toBe(false);
  });
  it('matches the frozen legacy path across in-place graphic and footprint edits', () => {
    const { scene } = fixture(20); renderEventLayer(scene);
    for (let step = 0; step < 40; step++) {
      const event = scene.map.events[step % 20];
      const graphic = event.pages![0].graphic;
      event.pages![0].footprint = { width: step % 3 + 1, height: 2 };
      scene.map.tileSize = step % 2 ? 32 : 16;
      graphic.scaleMode = step % 2 ? 'auto' : 'manual';
      graphic.pattern = step % 12;
      graphic.scale = 0.5 + step % 3;
      event.pages![0].priority = ['same', 'above', 'below'][step % 3] as 'same';
      scene.eventPositions[event.id] = { x: step / 3, y: step / 7, direction: ['up', 'left', 'down', 'right'][step % 4] as 'up' };
      renderEventLayer(scene); equivalent(scene);
    }
  });
  it('keeps furniture push coordinates and a previously opened dialogue anchor live', () => {
    const { scene } = fixture();
    Object.assign(scene, { cameras: { main: { scrollX: 0, scrollY: 0, zoom: 1 } } });
    renderEventLayer(scene);
    const original = scene.eventSprites.get('npc0');
    const hooks = dialogueSceneHooks(scene as unknown as PlaySceneContext, { currentEventId: 'npc0' });
    const view = runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)[0];
    beginFurniturePush(scene as unknown as PlaySceneContext, view, 1, 0);
    scene.eventPositions.npc0 = { x: 9, y: 9, direction: 'up' };
    renderEventLayer(scene);
    expect(scene.eventSprites.get('npc0')).toBe(original);
    expect(hooks.anchor()?.x).toBe(characterSpriteX(view.x));
    // The push pool is keyed by scene identity, so a spread oracle scene would miss it.
    const actual = state(scene);
    legacyRenderEvents(scene);
    expect(state(scene)).toEqual(actual);
  });
  it('preserves equal-depth order against other root objects after an event is replaced', () => {
    const { scene } = fixture(3);
    const children = { list: [] as unknown[], queueDepthSort() {} };
    Object.assign(scene, { children });
    const add = scene.add.sprite;
    scene.add.sprite = (...args) => {
      const sprite = add(...args);
      children.list.push(sprite);
      const destroy = sprite.destroy;
      sprite.destroy = () => { destroy.call(sprite); children.list.splice(children.list.indexOf(sprite), 1); };
      return sprite;
    };
    renderEventLayer(scene);
    const decoration = {};
    children.list.push(decoration);
    scene.map.events.reverse();
    scene.map.events[1].pages![0].graphic.pattern = 4;
    renderEventLayer(scene);
    expect(children.list).toEqual([decoration, ...scene.eventSprites.values()]);
    expect([...scene.eventSprites.keys()]).toEqual(['npc2', 'npc1', 'npc0']);
  });
  it('invalidates texture resolution, static art fitting, and transparent pages', () => {
    const { scene } = fixture(2);
    renderEventLayer(scene);
    const graphic = scene.map.events[0].pages![0].graphic;
    const previous = scene.eventSprites.get('npc0');
    graphic.sprite = { type: 'bundled', id: 'unknown_resource' };
    renderEventLayer(scene);
    expect(scene.eventSprites.get('npc0')).not.toBe(previous);
    expect(scene.missingResources.has('unknown_resource')).toBe(true);
    equivalent(scene);
    store.getCurrent().assets.uploaded.unknown_resource = { kind: 'monster' } as never;
    renderEventLayer(scene);
    expect(scene.eventSprites.get('npc0')?.frame).toBe('__BASE');
    expect(scene.missingResources.size).toBe(0);
    equivalent(scene);
    graphic.transparent = true;
    renderEventLayer(scene);
    equivalent(scene);
  });

  it('keeps emote objects through refresh and removes them when their host disappears', () => {
    const { scene, counts } = fixture();
    Object.assign(scene, { textures: { exists: () => true }, time: { delayedCall: () => ({ remove() {} }) } });
    Object.assign(scene.tweens, { add() {}, killTweensOf() {} });
    const host = scene as unknown as PlaySceneContext;
    renderEventLayer(scene);
    showSceneEmote(host, 'npc0', 'heart');
    const created = counts.created;
    scene.eventPositions.npc0 = { x: 6, y: 8, direction: 'down' };
    renderEventLayer(scene);
    syncSceneEmotes(host);
    expect(counts.created).toBe(created);
    expect(describeSceneEmotes(host)[0]).toMatchObject({ x: characterSpriteX(6), y: characterSpriteY(8) - 36 });
    scene.session.erasedEventIds = ['npc0'];
    renderEventLayer(scene);
    syncSceneEmotes(host);
    expect(describeSceneEmotes(host)).toEqual([]);
  });
  it('replaces sprites when a texture manager replaces a resource under the same key', () => {
    const { scene } = fixture();
    let texture = {};
    Object.assign(scene, { textures: { get: () => texture } });
    renderEventLayer(scene);
    const old = scene.eventSprites.get('npc0');
    texture = {};
    renderEventLayer(scene);
    expect(scene.eventSprites.get('npc0')).not.toBe(old);
    equivalent(scene);
  });

});
