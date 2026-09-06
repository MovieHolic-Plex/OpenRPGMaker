import { updateEventPage } from '@/editor/eventPages';
import { EMOTE_KINDS, EMOTE_LABELS, isEmoteKind } from '@/project/emotes';
import { defaultDetectionEncounter } from '@/project/npcBehavior';
import type { DetectionEncounter, EventPage, MapId, NpcSight } from '@/project/types';
import { el } from '@/util/dom';
import { selectWithOptions, selectedOptionValue } from './dom';

const FACING_OPTIONS = [{ value: 'any', label: '모든 방향' }, { value: 'forward', label: '정면 직선' }] as const;
const label = (text: string, control: HTMLElement) => el('label', { class: 'event-horror-field', children: [el('span', { text }), control] });

function numberField(id: string, value: number, min: number, max: number, change: (value: number) => void): HTMLInputElement {
  const input = el('input', { attrs: { type: 'number', min: String(min), max: String(max), step: '1' }, dataset: { testid: id } });
  input.value = String(value);
  input.addEventListener('change', () => {
    const next = Number(input.value);
    if (input.value !== '' && input.checkValidity() && Number.isInteger(next)) change(next);
  });
  return input;
}

function sightFields(prefix: string, sight: NpcSight, change: (patch: Partial<NpcSight>) => void): HTMLElement[] {
  const los = el('input', { attrs: { type: 'checkbox' }, dataset: { testid: `${prefix}-los` } });
  los.checked = sight.lineOfSight;
  los.addEventListener('change', () => change({ lineOfSight: los.checked }));
  const facing = selectWithOptions(FACING_OPTIONS, sight.facing, `${prefix}-facing`);
  facing.addEventListener('change', () => change({ facing: selectedOptionValue(facing, FACING_OPTIONS, sight.facing) }));
  return [label('발견 거리 (칸)', numberField(`${prefix}-range`, sight.range, 0, 999, range => change({ range }))),
    label('벽과 물체가 시야를 가림', los), label('감지 방향', facing)];
}

export function renderMovementSight(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const wrap = el('div', { class: 'event-page-movement-stack' });
  const sight = page.movement.sight;
  if (!sight) {
    wrap.append(el('p', { class: 'empty-hint', text: '명시적인 시야 설정이 없습니다. 기존 추격 감지를 유지합니다.' }));
    return wrap;
  }
  wrap.append(...sightFields('event-npc-sight', sight, patch => updateEventPage(mapId, eventId, page.id, {
    movement: { ...page.movement, sight: { ...sight, ...patch } },
  }, '추격 시야 설정')));
  return wrap;
}

export function renderDetectionEncounter(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const wrap = el('div', { class: 'event-page-movement-stack' });
  const enabled = el('input', { attrs: { type: 'checkbox' }, dataset: { testid: 'event-detection-enabled' } });
  enabled.checked = page.detectionEncounter !== undefined;
  const compatible = page.trigger.kind !== 'auto' && page.trigger.kind !== 'parallel' && page.interaction === undefined;
  enabled.disabled = !compatible && !enabled.checked;
  enabled.addEventListener('change', () => updateEventPage(mapId, eventId, page.id, {
    detectionEncounter: enabled.checked ? defaultDetectionEncounter() : undefined,
  }, '플레이어 발견 이벤트 설정'));
  wrap.append(label('플레이어를 발견하면 다가와 실행', enabled));
  if (!compatible) wrap.append(el('p', { class: 'empty-hint',
    text: '발견 이벤트는 자동·병렬 실행이나 물체 상호작용과 함께 사용할 수 없습니다. 기존 설정은 해제할 수 있습니다.' }));
  const config = page.detectionEncounter;
  if (!config) return wrap;
  const set = (patch: Partial<DetectionEncounter>) => updateEventPage(mapId, eventId, page.id, {
    detectionEncounter: { ...config, ...patch },
  }, '플레이어 발견 이벤트 설정');
  wrap.append(...sightFields('event-detection', config.sight, patch => set({ sight: { ...config.sight, ...patch } })));
  const emoteOptions = [{ value: 'none', label: '표시 안 함' }, ...EMOTE_KINDS.map(value => ({ value, label: EMOTE_LABELS[value] }))];
  const emote = selectWithOptions(emoteOptions, config.emote ?? 'none', 'event-detection-emote');
  emote.addEventListener('change', () => {
    if (emote.value === 'none') set({ emote: null });
    else if (isEmoteKind(emote.value)) set({ emote: emote.value });
  });
  wrap.append(label('발견 표시', emote),
    label('발견 후 대기 (ms)', numberField('event-detection-emoteMs', config.emoteMs, 0, 60000, emoteMs => set({ emoteMs }))),
    label('다가오는 속도', numberField('event-detection-speed', config.approachSpeed, 1, 8, approachSpeed => set({ approachSpeed }))),
    el('p', { class: 'empty-hint', text: '플레이어 옆까지 걸어온 뒤 이 페이지의 명령을 한 번 실행합니다. 전투는 명령 목록에 넣으세요. 길이 막히면 실행하지 않습니다.' }));
  return wrap;
}
