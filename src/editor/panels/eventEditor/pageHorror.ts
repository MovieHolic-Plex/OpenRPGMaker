import { defaultChaseSight, defaultChasePursuit } from '@/project/npcBehavior';
import { updateEventPage } from '@/editor/eventPages';
import { el } from '@/util/dom';
import type { ChaseAcrossMaps, Dir, EventPage, MapId } from '@/project/types';

function field(label: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'event-horror-field', children: [el('span', { text: label }), control] });
}
function select(id: string, value: string, options: [string, string][], change: (value: string) => void): HTMLSelectElement {
  const control = el('select', { dataset: { testid: id } });
  for (const [value, text] of options) control.append(el('option', { attrs: { value }, text }));
  control.value = value;
  control.addEventListener('change', () => change(control.value));
  return control;
}

export function renderChaseSettings(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const config = page.movement.pursuit;
  if (!config) {
    return el('div', { class: 'event-page-movement-stack', children: [
      el('p', { class: 'empty-hint', text: '기존 추격 동작을 유지합니다. 문 추격과 수색 정책은 아직 설정하지 않았습니다.' }),
      el('button', { class: 'btn', text: '시야와 수색 설정 사용', attrs: { type: 'button' },
        dataset: { testid: 'event-chase-enable-policy' }, on: { click: () => updateEventPage(mapId, eventId, page.id, {
          movement: { ...page.movement, sight: page.movement.sight ?? defaultChaseSight(), pursuit: defaultChasePursuit() },
        }, '추격 시야와 수색 설정 사용') } }),
      ...renderChaseSound(mapId, eventId, page),
    ] });
  }
  const set = (patch: Partial<ChaseAcrossMaps>) => updateEventPage(mapId, eventId, page.id, { movement: { ...page.movement, pursuit: { ...config, ...patch } } });
  const wrap = el('div', { class: 'event-page-movement-stack event-horror-settings', dataset: { testid: 'event-chase-settings' } });
  wrap.append(field('놓친 뒤 추적', select('event-chase-tracking', config.tracking ?? 'lastSeen',
    [['lastSeen', '마지막 목격 위치 수색'], ['persistent', '현재 위치 계속 추적']], tracking => {
      if (tracking === 'lastSeen' || tracking === 'persistent') set({ tracking });
    })));
  wrap.append(field('추격 범위', select('event-chase-scope', config.scope, [['map', '현재 맵'], ['connected', '문으로 연결된 방']], scope => set({ scope: scope as ChaseAcrossMaps['scope'] }))));
  for (const [key, label] of [['doorDelayMs', '문 통과 대기 (초)'], ['searchMs', '놓친 뒤 수색 (초)']] as const) {
    const input = el('input', { attrs: { type: 'number', min: '0', max: '60', step: '0.1' }, dataset: { testid: `event-chase-${key}` } });
    input.value = String(config[key] / 1000);
    input.addEventListener('change', () => { if (input.checkValidity() && input.value !== '') set({ [key]: Math.round(Number(input.value) * 1000) }); });
    wrap.append(field(label, input));
  }
  wrap.append(field('수색 종료 후', select('event-chase-onLost', config.onLost, [['wait', '그 자리에서 대기'], ['return', '이 방 진입점으로 복귀']], onLost => set({ onLost: onLost as ChaseAcrossMaps['onLost'] }))));
  // 명작 공백 #28: 추격 포기·문 따라옴 순간을 스위치로 알린다(이벤트 페이지 조건으로 연출을 건다).
  for (const [key, label] of [['lostSwitchId', '포기하면 켤 스위치'], ['followSwitchId', '문 따라오면 켤 스위치']] as const) {
    const input = el('input', { attrs: { type: 'text', placeholder: '스위치 id (비우면 없음)' }, dataset: { testid: `event-chase-${key}` } }) as HTMLInputElement;
    input.value = config[key] ?? '';
    input.addEventListener('change', () => {
      const value = input.value.trim();
      const next: ChaseAcrossMaps = { ...config };
      if (value) next[key] = value;
      else delete next[key];
      updateEventPage(mapId, eventId, page.id, { movement: { ...page.movement, pursuit: next } });
    });
    wrap.append(field(label, input));
  }
  wrap.append(...renderChaseSound(mapId, eventId, page));
  wrap.append(el('p', { class: 'empty-hint', text: '문까지 이동한 시간과 대기 시간 뒤에 따라옵니다. 벽과 가구는 시야를 가리며, 숨는 모습을 본 괴물은 계속 쫓습니다.' }));
  return wrap;
}

/** 말풍선 끄기(sightAlert.emote null + quietBreath)와 발소리(movement.footsteps.se) — 호러 추격자의 소리·연출. */
function renderChaseSound(mapId: MapId, eventId: string, page: EventPage): HTMLElement[] {
  const quiet = el('input', { attrs: { type: 'checkbox' }, dataset: { testid: 'event-chase-quiet-emotes' } }) as HTMLInputElement;
  quiet.checked = page.movement.quietBreath === true;
  quiet.addEventListener('change', () => {
    const { quietBreath: _q, ...rest } = page.movement;
    const alert = rest.sightAlert ? { ...rest.sightAlert, emote: quiet.checked ? null : rest.sightAlert.emote ?? 'exclamation' } : undefined;
    updateEventPage(mapId, eventId, page.id, { movement: { ...rest, ...(alert ? { sightAlert: alert } : {}), ...(quiet.checked ? { quietBreath: true } : {}) } }, '추격 말풍선 설정');
  });
  const se = el('input', { attrs: { type: 'text', placeholder: '효과음 id (비우면 발소리 없음)' }, dataset: { testid: 'event-chase-footsteps-se' } }) as HTMLInputElement;
  se.value = page.movement.footsteps?.se ?? '';
  se.addEventListener('change', () => {
    const value = se.value.trim();
    const { footsteps: before, ...rest } = page.movement;
    updateEventPage(mapId, eventId, page.id, { movement: value ? { ...rest, footsteps: { ...before, se: value } } : rest }, '추격자 발소리 설정');
  });
  return [field('「!」·땀 말풍선 끄기', quiet), field('걸을 때 발소리', se)];
}

/** 은신처 소리: 숨을 때·나올 때 한 번, 숨어 있는 동안 고리(심장 고동). */
function renderHidingSound(mapId: MapId, eventId: string, page: EventPage): HTMLElement[] {
  const interaction = page.interaction;
  if (interaction?.kind !== 'hiding') return [];
  return ([['enterSe', '숨을 때 소리'], ['exitSe', '나올 때 소리'], ['heldSe', '숨어 있는 동안 소리(반복)']] as const).map(([key, label]) => {
    const input = el('input', { attrs: { type: 'text', placeholder: '효과음 id (비우면 없음)' }, dataset: { testid: `event-hiding-${key}` } }) as HTMLInputElement;
    input.value = interaction[key] ?? '';
    input.addEventListener('change', () => {
      const value = input.value.trim();
      const next = { ...interaction };
      if (value) next[key] = value; else delete next[key];
      updateEventPage(mapId, eventId, page.id, { interaction: next }, '은신처 소리 설정');
    });
    return field(label, input);
  });
}

export function renderObjectInteraction(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const wrap = el('div', { class: 'event-page-movement-stack event-horror-settings', dataset: { testid: 'event-object-settings' } });
  const set = (kind: string) => updateEventPage(mapId, eventId, page.id, kind === 'none' ? { interaction: undefined } : {
    interaction: { kind: kind as 'pushable' | 'hiding' },
    movement: { ...page.movement, type: 'fixed' }, trigger: { kind: 'action' }, priority: 'same', overlapForbidden: true,
  });
  wrap.append(field('물체 상호작용', select('event-object-kind', page.interaction?.kind ?? 'none', [['none', '일반 이벤트'], ['pushable', '밀 수 있는 가구'], ['hiding', '은신처']], set)));
  if (page.interaction?.kind === 'pushable') {
    const allowed = page.interaction.directions ?? ['up', 'down', 'left', 'right'];
    // 방향마다 한 문장. 「왼쪽」에 「로」를 붙이면 「왼쪽로 밀기」가 되고,
    // 「{0}로 밀기」는 화면 밀기(Pan)로 오역된다.
    for (const [dir, label] of [
      ['up', '위로 밀기'],
      ['down', '아래로 밀기'],
      ['left', '왼쪽으로 밀기'],
      ['right', '오른쪽으로 밀기'],
    ] as [Dir, string][]) {
      const input = el('input', { attrs: { type: 'checkbox' }, dataset: { testid: `event-push-${dir}` } });
      input.checked = allowed.includes(dir);
      input.addEventListener('change', () => updateEventPage(mapId, eventId, page.id, { interaction: { kind: 'pushable', directions: input.checked ? [...allowed, dir] : allowed.filter(d => d !== dir) } }));
      wrap.append(field(label, input));
    }
    wrap.append(el('p', { class: 'empty-hint', text: '가구 그림은 이벤트에 지정하고 바닥 타일은 비워 두세요. 밀린 위치는 맵 이동과 세이브 후에도 유지됩니다.' }));
  }
  if (page.interaction?.kind === 'hiding') {
    wrap.append(...renderHidingSound(mapId, eventId, page));
    wrap.append(el('p', { class: 'empty-hint', text: '조사 키로 숨고 다시 누르면 나옵니다. 숨어 있는 동안 이동할 수 없습니다. 물체 동작이 일반 조사 명령보다 우선합니다. 「숨어 있음」 페이지 조건으로 숨은 동안의 연출을 걸 수 있습니다.' }));
  }
  return wrap;
}
