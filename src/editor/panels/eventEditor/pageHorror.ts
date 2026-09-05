import { updateEventPage } from '@/editor/eventPages';
import { el } from '@/util/dom';
import type { ChaseAcrossMaps, Dir, EventPage, MapId } from '@/project/types';

function field(label: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'event-page-movement-label', children: [el('span', { text: label }), control] });
}
function select(id: string, value: string, options: [string, string][], change: (value: string) => void): HTMLSelectElement {
  const control = el('select', { dataset: { testid: id } });
  for (const [value, text] of options) control.append(el('option', { attrs: { value }, text }));
  control.value = value;
  control.addEventListener('change', () => change(control.value));
  return control;
}

export function renderChaseSettings(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const config: ChaseAcrossMaps = page.movement.pursuit ?? { scope: 'map', doorDelayMs: 1200, searchMs: 4000, onLost: 'wait' };
  const set = (patch: Partial<ChaseAcrossMaps>) => updateEventPage(mapId, eventId, page.id, { movement: { ...page.movement, pursuit: { ...config, ...patch } } });
  const wrap = el('div', { class: 'event-page-movement-stack', dataset: { testid: 'event-chase-settings' } });
  wrap.append(field('추격 범위', select('event-chase-scope', config.scope, [['map', '현재 맵'], ['connected', '문으로 연결된 방']], scope => set({ scope: scope as ChaseAcrossMaps['scope'] }))));
  for (const [key, label] of [['doorDelayMs', '문 통과 대기 (초)'], ['searchMs', '놓친 뒤 수색 (초)']] as const) {
    const input = el('input', { attrs: { type: 'number', min: '0', max: '60', step: '0.1' }, dataset: { testid: `event-chase-${key}` } });
    input.value = String(config[key] / 1000);
    input.addEventListener('change', () => { if (input.checkValidity() && input.value !== '') set({ [key]: Math.round(Number(input.value) * 1000) }); });
    wrap.append(field(label, input));
  }
  wrap.append(field('수색 종료 후', select('event-chase-onLost', config.onLost, [['wait', '그 자리에서 대기'], ['return', '이 방의 진입 위치로 복귀']], onLost => set({ onLost: onLost as ChaseAcrossMaps['onLost'] }))));
  wrap.append(el('p', { class: 'empty-hint', text: '문까지 이동한 시간과 대기 시간 뒤에 따라옵니다. 벽과 가구는 시야를 가리며, 숨는 모습을 본 괴물은 계속 쫓습니다.' }));
  return wrap;
}

export function renderObjectInteraction(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const wrap = el('div', { class: 'event-page-movement-stack', dataset: { testid: 'event-object-settings' } });
  const set = (kind: string) => updateEventPage(mapId, eventId, page.id, kind === 'none' ? { interaction: undefined } : {
    interaction: { kind: kind as 'pushable' | 'hiding' },
    movement: { ...page.movement, type: 'fixed' }, trigger: { kind: 'action' }, priority: 'same', overlapForbidden: true,
  });
  wrap.append(field('물체 상호작용', select('event-object-kind', page.interaction?.kind ?? 'none', [['none', '일반 이벤트'], ['pushable', '밀 수 있는 가구'], ['hiding', '은신처']], set)));
  if (page.interaction?.kind === 'pushable') {
    const allowed = page.interaction.directions ?? ['up', 'down', 'left', 'right'];
    for (const [dir, text] of [['up', '위'], ['down', '아래'], ['left', '왼쪽'], ['right', '오른쪽']] as [Dir, string][]) {
      const input = el('input', { attrs: { type: 'checkbox' }, dataset: { testid: `event-push-${dir}` } });
      input.checked = allowed.includes(dir);
      input.addEventListener('change', () => updateEventPage(mapId, eventId, page.id, { interaction: { kind: 'pushable', directions: input.checked ? [...allowed, dir] : allowed.filter(d => d !== dir) } }));
      wrap.append(field(`${text}로 밀기`, input));
    }
    wrap.append(el('p', { class: 'empty-hint', text: '가구 그림은 이벤트에 지정하고 바닥 타일은 비워 두세요. 밀린 위치는 맵 이동과 세이브 후에도 유지됩니다.' }));
  }
  if (page.interaction?.kind === 'hiding') wrap.append(el('p', { class: 'empty-hint', text: '조사 키로 숨고 다시 누르면 나옵니다. 숨어 있는 동안 이동할 수 없습니다. 물체 동작이 일반 조사 명령보다 우선합니다.' }));
  return wrap;
}
