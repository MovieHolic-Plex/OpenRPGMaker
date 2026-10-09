// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as catalog from '@/assets/charsetCatalog';
import { renderNpcGraphicPicker } from '@/editor/panels/eventEditor/npcGraphicPicker';
import { editorEventMarkerTexture } from '@/editor/editSceneEventMarkers';
import { createBlankProject } from '@/project/defaults';
import { store } from '@/project/store';
import type { EventPage } from '@/project/types';
import { runTool } from '@/editor/tools/toolRunner';

const textureKey = 'tex_easyrpg_charset_people1';
let mapId: string;
const page = (): EventPage => store.getCurrent().maps[mapId]!.events[0]!.pages![0]!;
const get = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
function mount() {
  const close = vi.fn();
  document.body.replaceChildren(renderNpcGraphicPicker(mapId, 'resident', page(), close));
  return close;
}
function enter(id: string) {
  const input = get('event-graphic-direct-sprite-input') as HTMLInputElement;
  input.value = id;
  input.dispatchEvent(new Event('input'));
  return input;
}
beforeEach(() => {
  const project = createBlankProject();
  mapId = project.startMapId;
  project.characters = { resident: { displayName: 'Existing resident' } };
  project.maps[mapId]!.events = [{ id: 'resident', characterId: 'resident', x: 2, y: 2,
    trigger: { kind: 'action' }, commands: [], pages: [{ id: 'page', name: 'Existing dialogue',
      graphic: { sprite: { type: 'bundled', id: textureKey }, opacity: 180 },
      conditions: [], trigger: { kind: 'action' }, priority: 'same',
      movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [{ kind: 'text', body: 'Keep my dialogue' }],
    }] }];
  store.replace(project);
});
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

describe('character asset recovery', () => {
  it('retains an unavailable request and data, then accepts a manual choice', () => {
    const close = mount();
    const before = structuredClone(store.getCurrent());
    const input = enter('unknown-character');
    get('event-graphic-confirm').click();
    expect(close).not.toHaveBeenCalled();
    expect(store.getCurrent()).toEqual(before);
    expect(input.value).toBe('unknown-character');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(get('event-graphic-recovery').dataset.code).toBe('graphic-not-found');
    get(`event-graphic-resource-${textureKey}`).click();
    get('npc-character-slot-3').click();
    get('event-graphic-confirm').click();
    expect(close).toHaveBeenCalledOnce();
    expect(page().graphic.sprite?.id).toBe(textureKey);
    expect(page().commands).toEqual(before.maps[mapId]!.events[0]!.pages![0]!.commands);
    expect(store.getCurrent().characters).toEqual(before.characters);
  });

  it('cancels a failed selection without any project write', () => {
    const close = mount();
    const before = structuredClone(store.getCurrent());
    enter('unknown-character');
    get('event-graphic-confirm').click();
    get('event-graphic-cancel').click();
    expect(close).toHaveBeenCalledOnce();
    expect(store.getCurrent()).toEqual(before);
  });

  it('offers explicit no-image recovery in an empty catalog without crashing or assigning an ID', () => {
    vi.spyOn(catalog, 'projectCharsetAssets').mockReturnValue([]);
    const before = structuredClone(store.getCurrent());
    const close = mount();
    expect(store.getCurrent()).toEqual(before);
    expect(get('event-graphic-recovery').dataset.code).toBe('graphic-not-found');
    get('event-graphic-placeholder').click();
    expect(close).toHaveBeenCalledOnce();
    expect(page().graphic.sprite).toBeUndefined();
    expect(page().graphic.transparent).toBeUndefined();
    expect(editorEventMarkerTexture(store.getCurrent(), page().graphic)).toBeNull();
    expect(page().commands).toEqual(before.maps[mapId]!.events[0]!.pages![0]!.commands);
  });

  it.each([undefined, false, true])('preserves authored transparency %s through no-image and manual recovery', (transparent) => {
    if (transparent !== undefined) page().graphic.transparent = transparent;
    const before = structuredClone(store.getCurrent());
    const close = mount();
    get('event-graphic-placeholder').click();
    expect(close).toHaveBeenCalledOnce();
    expect(page().graphic.sprite).toBeUndefined();
    expect(editorEventMarkerTexture(store.getCurrent(), page().graphic)).toBeNull();

    const expectedPlaceholder = { ...before.maps[mapId]!.events[0]!.pages![0]!.graphic };
    delete expectedPlaceholder.sprite;
    expect(page().graphic).toEqual(expectedPlaceholder);
    const reopenedClose = mount();
    get(`event-graphic-resource-${textureKey}`).click();
    get('npc-character-slot-3').click();
    get('event-graphic-confirm').click();
    expect(reopenedClose).toHaveBeenCalledOnce();
    expect(page().graphic.sprite?.id).toBe(textureKey);
    expect(page().graphic.transparent).toBe(transparent);
    const marker = editorEventMarkerTexture(store.getCurrent(), page().graphic);
    if (transparent === true) expect(marker).toBeNull();
    else expect(marker).not.toBeNull();
    const originalPage = before.maps[mapId]!.events[0]!.pages![0]!;
    expect({ ...page(), graphic: originalPage.graphic }).toEqual(originalPage);
    expect(store.getCurrent().characters).toEqual(before.characters);
  });

  it('does not commit a removed upload from an already-open picker', () => {
    store.getCurrent().assets.uploaded.custom = { id: 'custom', kind: 'charset', name: 'Custom', dataUrl: 'data:image/png;base64,AA==' };
    const close = mount();
    get('event-graphic-resource-custom').click();
    delete store.getCurrent().assets.uploaded.custom;
    const before = structuredClone(store.getCurrent());
    get('event-graphic-confirm').click();
    expect(close).not.toHaveBeenCalled();
    expect(store.getCurrent()).toEqual(before);
  });

  it('rejects an unmatched query instead of substituting a villager, and still accepts explicit retry and transparency', () => {
    // 2026-09-27: 검색어 미매칭은 다시 거절이다 — 대체+경고는 조수가 무시해 엉뚱한 그림이 저장됐다.
    const ctx = { project: store.getCurrent() };
    const args = { mapId, id: 'new-resident', x: 3, y: 3, name: 'Requested resident', pages: [{ text: 'Keep this request' }] };
    const result = runTool(ctx, 'place_npc', { ...args, graphic: { query: 'old woman monster' } });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe('graphic-not-found');
    expect(ctx.project.maps[mapId]?.events.find((event) => event.id === 'new-resident')).toBeUndefined();
    const retry = runTool(ctx, 'place_npc', { ...args, graphic: { textureKey, characterIndex: 1 } });
    expect(retry.ok, retry.summary).toBe(true);
    const transparent = runTool(ctx, 'place_npc', { ...args, id: 'transparent-resident', graphic: { transparent: true } });
    expect(transparent.ok, transparent.summary).toBe(true);
  });
});
