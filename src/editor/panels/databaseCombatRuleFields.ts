import { evaluateDamageFormula, FORMULA_PREVIEW_CONTEXT, DAMAGE_FORMULA_VARIABLES } from '@/battle/damageFormula';
import { updateDatabaseRecord } from '@/editor/databaseActions';
import { numberField, textField, selectField } from '@/editor/panels/databaseControls';
import { combatConditionFields } from '@/editor/panels/databaseCombatConditionFields';
import { sectionCard } from '@/editor/panels/databaseWorkspace';
import { store } from '@/project/store';
import type { EnemyRecord, SkillRecord } from '@/project/types';
import { el } from '@/util/dom';

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
