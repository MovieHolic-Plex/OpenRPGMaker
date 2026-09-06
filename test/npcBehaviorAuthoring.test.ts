/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/project/store';
import { deserialize, serialize } from '@/project/io';
import { beginEventEditDraft, commitEventDraft, discardEventDraft } from '@/project/eventDrafts';
import { normalizeEventPage } from '@/editor/eventPages';
import { renderPageMovement } from '@/editor/panels/eventEditor/pageMovement';
import { renderEventPageProps } from '@/editor/panels/eventEditor/pageProps';
import { encounterProject, required } from './fixtures/npcEncounterPipeline';

vi.mock('@/project/store', () => ({ store: { getCurrent: vi.fn(), update: vi.fn(), subscribe: vi.fn(() => () => undefined) } }));
let f: ReturnType<typeof encounterProject>;
beforeEach(() => {
  f = encounterProject(); vi.mocked(store.getCurrent).mockReturnValue(f.project);
  // In-memory store adapter runs the actual editor mutation callback, not a canned patch.
  vi.mocked(store.update).mockImplementation(mutator => { mutator(f.project); });
});
afterEach(() => { document.body.replaceChildren(); });

function mountMovement() {
  const root = renderPageMovement(f.map.id, f.event.id, f.page); document.body.replaceChildren(root); return root;
}

describe('NPC behavior authoring contracts', () => {
  it.each(['auto', 'parallel', 'hiding', 'pushable'] as const)('rejects detection combined with incompatible %s behavior', kind => {
    f.page.detectionEncounter = { sight: { range: 6, lineOfSight: true, facing: 'forward' },
      emote: null, emoteMs: 0, approachSpeed: 4 };
    if (kind === 'auto' || kind === 'parallel') f.page.trigger = { kind };
    else f.page.interaction = { kind };
    expect(() => deserialize(serialize(f.project))).toThrow();
  });

  it.each(['auto', 'parallel'] as const)('does not offer detector activation on a %s page', kind => {
    f.page.trigger = { kind };
    document.body.replaceChildren(renderEventPageProps(f.map.id, f.event.id, f.page, f.event));
    expect(document.querySelector<HTMLInputElement>('[data-testid="event-detection-enabled"]')?.disabled).toBe(true);
  });

  it('allows clearing an existing detector after changing to an incompatible trigger', () => {
    f.page.trigger = { kind: 'parallel' };
    f.page.detectionEncounter = { sight: { range: 6, lineOfSight: true, facing: 'forward' },
      emote: null, emoteMs: 0, approachSpeed: 4 };
    document.body.replaceChildren(renderEventPageProps(f.map.id, f.event.id, f.page, f.event));
    const enabled = required(document.querySelector<HTMLInputElement>('[data-testid="event-detection-enabled"]'));
    expect(enabled.disabled).toBe(false);
    enabled.checked = false; enabled.dispatchEvent(new Event('change', { bubbles: true }));
    expect(f.page.detectionEncounter).toBeUndefined();
  });

  it('authors explicit sight and pursuit defaults when chase is selected, then commits and roundtrips them', () => {
    beginEventEditDraft(f.project, f.map.id, f.event.id);
    const root = mountMovement();
    const type = required(root.querySelector<HTMLSelectElement>('[data-testid="event-page-movement-type"]'));
    type.value = 'chase'; type.dispatchEvent(new Event('change', { bubbles: true }));
    expect(f.page.movement).toMatchObject({ type: 'chase', pathfind: true,
      sight: { range: 8, lineOfSight: true, facing: 'any' },
      pursuit: { scope: 'map', doorDelayMs: 1200, searchMs: 4000, onLost: 'wait' } });
    commitEventDraft(f.project, f.map.id, f.event.id);
    const loaded = deserialize(serialize(f.project));
    expect(loaded.maps[f.map.id]?.events[0]?.pages?.[0]?.movement).toEqual(f.page.movement);
  });

  it('preserves explicit sensing through the real page normalizer and project serialization', () => {
    f.page.movement.sight = { range: 3, lineOfSight: false, facing: 'forward' };
    f.page.detectionEncounter = { sight: { range: 5, lineOfSight: true, facing: 'any' },
      emote: 'question', emoteMs: 250, approachSpeed: 2 };
    const normalized = normalizeEventPage(f.page);
    expect(normalized.movement).toMatchObject({ sight: f.page.movement.sight });
    expect(normalized).toMatchObject({ detectionEncounter: f.page.detectionEncounter });
    f.event.pages = [normalized];
    expect(deserialize(serialize(f.project)).maps[f.map.id]?.events[0]?.pages?.[0]).toEqual(normalized);
  });

  it('exposes trainer opt-in on a fixed page and persists edits from real controls', () => {
    beginEventEditDraft(f.project, f.map.id, f.event.id);
    const render = () => document.body.replaceChildren(renderEventPageProps(f.map.id, f.event.id, f.page, f.event));
    render();
    const enabled = document.querySelector<HTMLInputElement>('[data-testid="event-detection-enabled"]');
    expect(enabled).not.toBeNull();
    required(enabled).checked = true; required(enabled).dispatchEvent(new Event('change', { bubbles: true }));
    expect(f.page).toMatchObject({ detectionEncounter: { sight: { range: 6, lineOfSight: true, facing: 'forward' },
      emote: 'exclamation', emoteMs: 600, approachSpeed: 4 } });
    render();
    const range = required(document.querySelector<HTMLInputElement>('[data-testid="event-detection-range"]'));
    range.value = '3'; range.dispatchEvent(new Event('change', { bubbles: true }));
    commitEventDraft(f.project, f.map.id, f.event.id);
    expect(deserialize(serialize(f.project)).maps[f.map.id]?.events[0]?.pages?.[0]).toMatchObject({
      detectionEncounter: { sight: { range: 3 } }, movement: { type: 'fixed' },
    });
    render();
    expect(document.querySelector<HTMLInputElement>('[data-testid="event-detection-range"]')?.value).toBe('3');
  });

  it('does not invent modern policies or display an enabled default policy when a legacy chase is opened and cancelled', () => {
    f.page.movement.type = 'chase'; const original = structuredClone(f.event);
    beginEventEditDraft(f.project, f.map.id, f.event.id);
    const root = mountMovement();
    const scope = root.querySelector<HTMLSelectElement>('[data-testid="event-chase-scope"]');
    expect(scope === null || scope.disabled || scope.value === 'legacy').toBe(true);
    expect(f.page.movement.sight).toBeUndefined(); expect(f.page.movement.pursuit).toBeUndefined();
    expect(f.page.detectionEncounter).toBeUndefined();
    discardEventDraft(f.project, f.map.id, f.event.id);
    expect(f.map.events[0]).toEqual(original);
  });

  it.each(['range', 'facing', 'emoteMs', 'approachSpeed'] as const)('rejects malformed authored %s rather than shipping ignored behavior', field => {
    f.page.movement.sight = { range: 8, lineOfSight: true, facing: 'any' };
    f.page.detectionEncounter = { sight: { range: 6, lineOfSight: true, facing: 'forward' },
      emote: null, emoteMs: 0, approachSpeed: 4 };
    if (field === 'range') f.page.movement.sight.range = -1;
    if (field === 'facing') Object.assign(f.page.detectionEncounter.sight, { facing: 'cone' });
    if (field === 'emoteMs') f.page.detectionEncounter.emoteMs = -1;
    if (field === 'approachSpeed') f.page.detectionEncounter.approachSpeed = 9;
    expect(() => deserialize(serialize(f.project))).toThrow();
  });
});
