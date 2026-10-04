import { store } from '@/project/store';
import { parseCinematicDirection } from '@/project/cinematicDirection';
import type { CinematicLayer } from '@/project/cinematicLayers';
import type { CinematicScene } from '@/project/cinematicSettings';
import type { DatabaseCinematicActions } from './databaseCinematicActions';
import { field } from './databaseControls';
import { el } from '@/util/dom';

/** Editable actor timing; UI never asks authors to paste JSON. */
export function cinematicLayersForm(scene: Extract<CinematicScene, { kind: 'image' }>, actions: DatabaseCinematicActions, usable: () => boolean): HTMLElement {
  const root = el('div', {});
  for (const [index, layer] of (scene.direction?.layers ?? []).entries()) {
    const details = el('details', { children: [el('summary', { text: `독립 그림 ${index + 1} · ${store.getCurrent().assets.uploaded[layer.resourceId]?.name ?? layer.resourceId}` })] });
    const patch = (edit: (layer: CinematicLayer) => void, input: HTMLInputElement): void => {
      if (!usable()) return;
      const current = actions.read()?.scenes.find(s => s.id === scene.id);
      if (current?.kind !== 'image' || !current.direction?.layers?.[index]) return;
      const direction = structuredClone(current.direction);
      edit(direction.layers![index]);
      try { actions.setDirection(scene.id, parseCinematicDirection(direction)); input.setCustomValidity(''); }
      catch (error) { input.setCustomValidity(error instanceof Error ? error.message : String(error)); input.reportValidity(); }
    };
    const numeric = (label: string, value: number, min: number, max: number, testid: string, edit: (layer: CinematicLayer, value: number) => void): void => {
      const input = el('input', { value, attrs: { type: 'number', min: String(min), max: String(max), step: '0.01' }, dataset: { testid } });
      input.addEventListener('change', () => {
        const next = Number(input.value);
        if (input.value !== '' && Number.isFinite(next) && next >= min && next <= max) patch(layer => edit(layer, next), input);
      });
      details.append(field(label, input));
    };
    numeric('그림 너비 (화면 비율)', layer.width, 0.05, 1.5, `db-cinematic-layer-${index}-width`, (l, v) => { l.width = v; });
    const labels = { at: '시점 (0 시작 · 1 끝)', x: '가로 위치 (비율)', y: '세로 위치 (비율)', scale: '배율', opacity: '불투명도', rotation: '회전 (도)' };
    const ranges = { at: [0, 1], x: [-0.5, 1.5], y: [-0.5, 1.5], scale: [0.1, 3], opacity: [0, 1], rotation: [-180, 180] };
    layer.frames.forEach((frame, i) => {
      details.append(el('h4', { text: `동작 지점 ${i + 1}` }));
      for (const key of Object.keys(labels) as (keyof typeof labels)[]) numeric(labels[key], frame[key], ranges[key][0], ranges[key][1], `db-cinematic-layer-${index}-frame-${i}-${key}`, (l, v) => { l.frames[i][key] = v; });
    });
    root.append(details);
  }
  return root;
}
