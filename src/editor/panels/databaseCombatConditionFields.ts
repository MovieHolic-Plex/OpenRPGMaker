import { numberField, selectField, selectLiteral } from '@/editor/panels/databaseControls';
import { store } from '@/project/store';
import type { EnemyActionCondition } from '@/project/types';
import { el } from '@/util/dom';

export function combatConditionFields(initial: EnemyActionCondition, id: string, onChange: (condition: EnemyActionCondition) => void): HTMLElement {
  let condition = initial;
  const kindId = id === "feature16-enemy-condition" ? "db-enemy-action-condition-type" : `${id}-kind`;
  const details = el('div', { class: 'db-enemy-condition-detail' });
  const commit = (next: EnemyActionCondition): void => { condition = next; onChange(next); };
  const render = (): void => {
    const c = condition;
    const range = (low: string, high: string, min: number, max: number, limit: number, update: (min: number, max: number) => void): HTMLElement[] => [
      numberField(low, id === "feature16-enemy-condition" && c.kind === "turn" ? "db-enemy-action-turn-start" : `${id}-min`, min, value => { min = value; update(min, max); }, { min: 0, max: limit }),
      numberField(high, id === "feature16-enemy-condition" && c.kind === "turn" ? "db-enemy-action-turn-interval" : `${id}-max`, max, value => { max = value; update(min, max); }, { min: 0, max: limit }),
    ];
    if (c.kind === 'hp' || c.kind === 'mp') details.replaceChildren(...range('최소 %', '최대 %', c.minPercent, c.maxPercent, 100, (minPercent, maxPercent) => commit({ kind: c.kind, minPercent, maxPercent })));
    else if (c.kind === 'allies') details.replaceChildren(...range('생존 동료 최소', '생존 동료 최대', c.min, c.max, 99, (min, max) => commit({ kind: 'allies', min, max })));
    else if (c.kind === 'turn') details.replaceChildren(...range('시작 턴', '반복 간격', c.start, c.interval, 999, (start, interval) => commit({ kind: 'turn', start: Math.max(1, start), interval: Math.max(1, interval) })));
    else if (c.kind === 'switch') details.replaceChildren(
      selectField('스위치', `${id}-switch`, c.switchId, store.getCurrent().switches, switchId => commit({ ...condition as Extract<EnemyActionCondition, { kind: 'switch' }>, switchId })),
      selectLiteral('값', `${id}-value`, c.value ? 'ON' : 'OFF', ['ON', 'OFF'], value => commit({ ...condition as Extract<EnemyActionCondition, { kind: 'switch' }>, value: value === 'ON' })),
    );
    else if (c.kind === 'status') details.replaceChildren(
      selectField('상태', `${id}-state`, c.stateId, store.getCurrent().database.states, stateId => commit({ ...condition as Extract<EnemyActionCondition, { kind: 'status' }>, stateId })),
      selectLiteral('상태 유무', `${id}-present`, c.present ? '있음' : '없음', ['있음', '없음'], value => commit({ ...condition as Extract<EnemyActionCondition, { kind: 'status' }>, present: value === '있음' })),
    ); else details.replaceChildren();
  };
  const kinds = ['always', 'turn', 'hp', 'mp', 'status', 'allies', 'switch'] as const;
  const type = selectLiteral('조건', kindId, condition.kind, kinds, kind => {
    commit(kind === 'hp' || kind === 'mp' ? { kind, minPercent: 0, maxPercent: 50 } : kind === 'status' ? { kind, stateId: store.getCurrent().database.states[0]?.id ?? '', present: true } : kind === 'allies' ? { kind, min: 0, max: 0 } : kind === 'turn' ? { kind, start: 1, interval: 1 } : kind === 'switch' ? { kind, switchId: store.getCurrent().switches[0]?.id ?? '', value: true } : { kind: 'always' });
    render();
  });
  const labels = ['항상', '턴', 'HP 비율', 'MP 비율', '상태 유무', '생존 동료 수 (자신 제외)', '스위치'];
  type.querySelectorAll('option').forEach(option => { const index = kinds.indexOf(option.value as typeof kinds[number]); if (index >= 0) option.textContent = labels[index]; });
  render();
  return el('div', { dataset: { testid: id }, children: [type, details] });
}
