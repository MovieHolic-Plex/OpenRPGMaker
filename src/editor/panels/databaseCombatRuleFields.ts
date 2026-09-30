import { evaluateDamageFormula, FORMULA_PREVIEW_CONTEXT, DAMAGE_FORMULA_VARIABLES } from '@/battle/damageFormula';
import { updateDatabaseRecord } from '@/editor/databaseActions';
import { numberField, textField, selectField } from '@/editor/panels/databaseControls';
import { combatConditionFields } from '@/editor/panels/databaseCombatConditionFields';
import { sectionCard } from '@/editor/panels/databaseWorkspace';
import { store } from '@/project/store';
import type { EnemyRecord, SkillRecord } from '@/project/types';
import { el } from '@/util/dom';
import { isSkillInputKey } from '@/battle/battleInputSequence';

export function skillCombatRuleCard(record: SkillRecord, options: { readonly collapsed?: boolean } = {}): HTMLElement {
  const preview = el('p', { class: 'db-skill-card-note', dataset: { testid: 'feature16-formula-preview' }, attrs: { 'aria-live': 'polite' } });
  const context: Record<string, number> = { ...FORMULA_PREVIEW_CONTEXT, power: record.power };
  let formula = record.damageFormula ?? '';
  const refresh = (): void => {
    const result = formula.trim() ? evaluateDamageFormula(formula, context) : undefined;
    preview.textContent = result ? result.ok ? `기본 피해 미리보기: ${result.value} (분산·속성·급소 적용 전)` : `저장하지 않음: ${result.error}` : '기본 전투 공식을 사용합니다.';
  };
  const formulaField = textField('피해 수식', 'feature16-damage-formula', formula, value => {
    formula = value;
    const result = value.trim() ? evaluateDamageFormula(value, context) : undefined;
    const input = formulaField.querySelector('input')!;
    input.setCustomValidity(result && !result.ok ? result.error : '');
    input.setAttribute('aria-invalid', String(!!result && !result.ok));
    if (!result || result.ok) updateDatabaseRecord('skills', record.id, { damageFormula: value.trim() || undefined });
    refresh();
  });
  const sequence = textField('타격별 배율', 'feature16-hit-sequence', (record.hitSequence ?? [1]).join(', '), value => {
    const parts = value.split(',').map(part => part.trim());
    const values = parts.map(Number);
    const valid = parts.every(Boolean) && values.length <= 16 && values.every(n => Number.isFinite(n) && n >= 0 && n <= 10);
    sequence.querySelector('input')!.setCustomValidity(valid ? '' : '0~10 배율을 쉼표로 구분해 1~16개 입력하세요.');
    if (valid) updateDatabaseRecord('skills', record.id, { hitSequence: values });
  });
  refresh();
  return sectionCard({ title: '전투 규칙 · 피해 수식', testid: 'feature16-combat-studio', hint: options.collapsed ? '기본 전투 공식 사용 중' : '수식은 방어를 포함한 기본 피해입니다. 빈칸은 기존 공식. 비용은 행동당 한 번 소비합니다.', collapsible: true, collapsed: options.collapsed === true, children: [
    formulaField, preview,
    el('p', { class: 'db-skill-card-note', text: `허용: + − * / % ( ). ${DAMAGE_FORMULA_VARIABLES.join(', ')}. a=시전자, b=대상. 잘못된 입력은 저장하지 않습니다.` }),
    numberField('예시 위력', 'feature16-preview-power', context.power, value => { context.power = value; refresh(); }, { min: -9999, max: 9999 }),
    numberField('예시 공격력', 'feature16-preview-attack', context['a.atk'], value => { context['a.atk'] = value; refresh(); }, { min: 0, max: 99999 }),
    numberField('예시 방어력', 'feature16-preview-defense', context['b.def'], value => { context['b.def'] = value; refresh(); }, { min: 0, max: 99999 }),
    sequence,
    numberField('급소 확률 %', 'feature16-critical-rate', record.criticalRate ?? -1, value => updateDatabaseRecord('skills', record.id, { criticalRate: value < 0 ? undefined : value }), { min: -1, max: 100 }),
    el('p', { class: 'db-skill-card-note', text: '급소 확률 -1: 기존 배틀러 기본값. 명중률은 효과 카드에서 설정합니다. 대기 턴은 사용한 턴 이후의 완전한 턴 수입니다.' }),
    numberField('급소 배율', 'feature16-critical-multiplier', record.criticalMultiplier ?? 1.35, value => updateDatabaseRecord('skills', record.id, { criticalMultiplier: value }), { min: 1, max: 10, step: 0.05 }),
    numberField('재사용 대기 턴', 'feature16-cooldown', record.cooldownTurns ?? 0, value => updateDatabaseRecord('skills', record.id, { cooldownTurns: value }), { min: 0, max: 99 }),
    numberField('HP 대가 % (최대 HP)', 'feature16-hp-cost', record.hpCostPercent ?? 0, value => updateDatabaseRecord('skills', record.id, { hpCostPercent: value }), { min: 0, max: 100 }),
    numberField('흡수 % (준 피해)', 'feature16-drain', record.drainPercent ?? 0, value => updateDatabaseRecord('skills', record.id, { drainPercent: value }), { min: 0, max: 100 }),
    ...skillAreaAndComboFields(record),
    el('p', { class: 'db-skill-card-note', text: 'HP 대가: 쓸 때마다 시전자가 최대 HP 의 N% 를 잃습니다(1 밑으로는 안 깎음). 흡수: 준 피해의 N% 만큼 시전자가 회복합니다(MP 피해 기술이면 MP).' }),
  ] });
}

export function enemyDropFields(record: EnemyRecord): HTMLElement {
  const host = el('div', { dataset: { testid: 'feature16-drops' } });
  const current = () => store.getCurrent().database.enemies.find(enemy => enemy.id === record.id) ?? record;
  const rows = () => current().rewards.drops ?? [];
  const save = (drops: EnemyRecord['rewards']['drops']): void => updateDatabaseRecord('enemies', record.id, { rewards: { ...current().rewards, drops } });
  const render = (): void => {
    host.replaceChildren(el('p', { class: 'db-skill-card-note', text: current().rewards.drops === undefined ? '기존 단일 드롭 사용 중. 추가하면 아래 목록으로 전환합니다.' : '조건을 만족하는 각 행을 독립 추첨합니다. 위 단일 드롭은 사용하지 않습니다.' }));
    rows().forEach((drop, index) => {
      const patch = (value: Partial<typeof drop>): void => save(rows().map((row, i) => i === index ? { ...row, ...value } : row));
      host.append(el('fieldset', { class: 'db-advanced-panel', dataset: { testid: `feature16-drop-${index}` }, children: [
        el('legend', { text: `드롭 ${index + 1}` }),
        selectField('아이템', `feature16-drop-${index}-item`, drop.itemId, store.getCurrent().database.items, itemId => { if (itemId) patch({ itemId }); }),
        numberField('확률 %', `feature16-drop-${index}-rate`, drop.ratePercent, ratePercent => patch({ ratePercent }), { min: 0, max: 100 }),
        numberField('수량', `feature16-drop-${index}-quantity`, drop.quantity, quantity => patch({ quantity }), { min: 1, max: 99 }),
        combatConditionFields(drop.condition, `feature16-drop-${index}-condition`, condition => patch({ condition })),
        el('button', { text: '삭제', attrs: { type: 'button' }, dataset: { testid: `feature16-drop-${index}-remove` }, on: { click: () => { save(rows().filter((_, i) => i !== index)); render(); } } }),
      ] }));
    });
    host.append(el('button', { text: '조건부 드롭 추가', attrs: { type: 'button' }, dataset: { testid: 'feature16-drop-add' }, on: { click: () => {
      const reward = current().rewards;
      const legacy = reward.dropItemId ? [{ itemId: reward.dropItemId, ratePercent: reward.dropRatePercent, quantity: 1, condition: { kind: 'always' as const } }] : [];
      const itemId = store.getCurrent().database.items[0]?.id;
      if (itemId) save([...(reward.drops ?? legacy), { itemId, ratePercent: 100, quantity: 1, condition: { kind: 'always' } }]);
      render();
    } } }), el('button', { text: '기존 단일 드롭 사용', attrs: { type: 'button' }, dataset: { testid: 'feature16-drop-legacy' }, on: { click: () => { save(undefined); render(); } } }));
  };
  render(); return host;
}

/** 훔치기 표(stealItems). 위에서부터 차례로 굴려 첫 성공 하나를 준다. 적마다 한 번만 훔칠 수 있다. */
export function enemyStealFields(record: EnemyRecord): HTMLElement {
  const host = el('div', { dataset: { testid: 'mg-enemy-steal-items' } });
  const current = () => store.getCurrent().database.enemies.find(enemy => enemy.id === record.id) ?? record;
  const rows = () => current().stealItems ?? [];
  const save = (stealItems: NonNullable<EnemyRecord['stealItems']>): void => updateDatabaseRecord('enemies', record.id, { stealItems: stealItems.length ? stealItems : undefined });
  const render = (): void => {
    host.replaceChildren(el('p', { class: 'db-skill-card-note', text: '훔치기 기술이 위에서부터 차례로 확률을 굴립니다. 한 번 훔치면 그 적에게서는 더 훔칠 수 없습니다.' }));
    rows().forEach((entry, index) => {
      const patch = (value: Partial<typeof entry>): void => save(rows().map((row, i) => i === index ? { ...row, ...value } : row));
      host.append(el('fieldset', { class: 'db-advanced-panel', dataset: { testid: `mg-enemy-steal-${index}` }, children: [
        el('legend', { text: `훔칠 아이템 ${index + 1}` }),
        selectField('아이템', `mg-enemy-steal-${index}-item`, entry.itemId, store.getCurrent().database.items, itemId => { if (itemId) patch({ itemId }); }),
        numberField('확률 %', `mg-enemy-steal-${index}-rate`, entry.rate, rate => patch({ rate }), { min: 0, max: 100 }),
        el('button', { text: '삭제', attrs: { type: 'button' }, dataset: { testid: `mg-enemy-steal-${index}-remove` }, on: { click: () => { save(rows().filter((_, i) => i !== index)); render(); } } }),
      ] }));
    });
    host.append(el('button', { text: '훔칠 아이템 추가', attrs: { type: 'button' }, dataset: { testid: 'mg-enemy-steal-add' }, on: { click: () => {
      const itemId = store.getCurrent().database.items[0]?.id;
      if (itemId) save([...rows(), { itemId, rate: 50 }]);
      render();
    } } }));
  };
  render(); return host;
}

/** 입력 커맨드(inputSequence): 키 순서·제한 시간·성공/실패 배율. 키를 비우면 입력 없는 기술. */
export function skillInputSequenceFields(record: SkillRecord): HTMLElement {
  const current = () => store.getCurrent().database.skills.find(skill => skill.id === record.id) ?? record;
  const sequence = record.inputSequence;
  const save = (patch: Partial<NonNullable<SkillRecord['inputSequence']>>): void => {
    const base = current().inputSequence ?? { keys: [], timeLimitMs: 3000 };
    const next = { ...base, ...patch };
    updateDatabaseRecord('skills', record.id, { inputSequence: next.keys.length ? next : undefined });
  };
  const keysField = textField('입력 키(up/down/left/right/confirm/cancel, 쉼표)', 'mg-skill-input-keys', (sequence?.keys ?? []).join(', '), value => {
    const keys = value.split(',').map(part => part.trim()).filter(Boolean);
    const valid = keys.every(isSkillInputKey) && keys.length <= 12;
    keysField.querySelector('input')?.setCustomValidity(valid ? '' : 'up, down, left, right, confirm, cancel 중에서 12개까지 입력하세요.');
    if (valid) save({ keys: keys as NonNullable<SkillRecord['inputSequence']>['keys'] });
  });
  return sectionCard({ title: '입력 커맨드', testid: 'mg-skill-input-sequence', hint: '전투에서 대상을 고른 뒤 키 순서를 입력합니다. 제한 시간 안에 성공하면 위력이 오르고, 실패하면 약해집니다.', collapsible: true, collapsed: !sequence, children: [
    keysField,
    numberField('제한 시간(ms)', 'mg-skill-input-time', sequence?.timeLimitMs ?? 3000, timeLimitMs => save({ timeLimitMs }), { min: 300, max: 20000 }),
    numberField('성공 배율', 'mg-skill-input-success', sequence?.successMultiplier ?? 1.5, successMultiplier => save({ successMultiplier }), { min: 0, max: 10, step: 0.05 }),
    numberField('실패 배율', 'mg-skill-input-fail', sequence?.failMultiplier ?? 0.5, failMultiplier => save({ failMultiplier }), { min: 0, max: 10, step: 0.05 }),
  ] });
}

const AREA_SHAPE_OPTIONS = [{ id: '', name: '없음 (단일)' }, { id: 'circle', name: '원 (주 대상 둘레)' }, { id: 'line', name: '직선 (가로 띠)' }] as const;
const AREA_DEFAULT_RADIUS = 48;
/** 배우를 한 명만 골랐을 땐 아직 연계기가 아니라 레코드에 저장되지 않는다. 패널이 다시 그려져도 고른 칸이 사라지지 않게 임시로 들고 있는다. */
const pendingComboSlots = new Map<string, string[]>();

/** 위치 범위기(area)와 연계기(comboActorIds) — 로스터 스킬이 쓰지만 예전엔 조수 도구로만 고칠 수 있었다. */
function skillAreaAndComboFields(record: SkillRecord): HTMLElement[] {
  const current = (): SkillRecord => store.getCurrent().database.skills.find(skill => skill.id === record.id) ?? record;
  const shape = current().area?.shape ?? '';
  const radius = numberField('범위 반경 (px)', 'skill-area-radius', current().area?.radius ?? AREA_DEFAULT_RADIUS,
    value => { const area = current().area; if (area) updateDatabaseRecord('skills', record.id, { area: { shape: area.shape, radius: Math.max(1, value) } }); },
    { min: 1, max: 640 });
  radius.hidden = !shape;
  const shapeField = selectField('범위', 'skill-area-shape', shape, [...AREA_SHAPE_OPTIONS], value => {
    if (value !== 'circle' && value !== 'line') { updateDatabaseRecord('skills', record.id, { area: undefined }); radius.hidden = true; return; }
    updateDatabaseRecord('skills', record.id, { area: { shape: value, radius: current().area?.radius ?? AREA_DEFAULT_RADIUS } });
    radius.hidden = false;
  });
  const actors = store.getCurrent().database.actors;
  const options = [{ id: '', name: '(없음)' }, ...actors.map(actor => ({ id: actor.id, name: actor.name }))];
  const saved = current().comboActorIds ?? [];
  const pending = saved.length ? undefined : pendingComboSlots.get(record.id);
  const slots = [0, 1, 2].map(index => (pending ?? saved)[index] ?? '');
  const comboNote = el('p', { class: 'db-skill-card-note', dataset: { testid: 'skill-combo-note' } });
  const refreshNote = (): void => {
    const picked = new Set(slots.filter(Boolean));
    comboNote.textContent = picked.size === 0 ? '연계기 아님. 배우를 2~3명 고르면 전원이 참전·생존·준비 상태일 때 메뉴에 열리고 각자 MP·턴을 씁니다.'
      : picked.size === 1 ? '한 명 더 골라야 연계기가 됩니다(2~3명, 중복 불가).' : `연계기: ${picked.size}명 (${[...picked].map(id => actors.find(actor => actor.id === id)?.name ?? id).join(' · ')})`;
  };
  const save = (): void => {
    const ids = [...new Set(slots.filter(Boolean))];
    if (ids.length >= 2) pendingComboSlots.delete(record.id); else pendingComboSlots.set(record.id, [...slots]);
    updateDatabaseRecord('skills', record.id, { comboActorIds: ids.length >= 2 ? ids : undefined });
    refreshNote();
  };
  const slotFields = slots.map((value, index) => selectField(`연계 배우 ${index + 1}`, `skill-combo-actor-${index + 1}`, value, options, next => { slots[index] = next; save(); }));
  refreshNote();
  return [shapeField, radius, ...slotFields, comboNote];
}
