import { evaluateDamageFormula, FORMULA_PREVIEW_CONTEXT } from '@/battle/damageFormula';
import {
  actionSkillClearProperties, actionSkillProfileSchema, authoredSkillProperties,
  combatConditionSchema, conditionalDropsSchema, mapClimateSchema,
} from './combatAuthoringSchemas';
import { ToolError, type JsonSchema } from './types';

type RecordValue = Record<string, unknown>;
function invalid(path: string, reason: string): never {
  throw new ToolError(`${path}: ${reason}`, { code: 'invalid-args' });
}
function record(value: unknown, path: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, '객체가 필요합니다.');
  return value as RecordValue;
}
/** Narrow recursive validation for the newly exposed fields, not a global schema policy change. */
function validate(value: unknown, schema: JsonSchema & { maxItems?: number }, path: string): void {
  if (schema.type === 'object') {
    const object = record(value, path);
    for (const key of schema.required ?? []) if (object[key] === undefined) invalid(`${path}.${key}`, '필수 필드입니다.');
    for (const [key, child] of Object.entries(object)) {
      const childSchema = schema.properties?.[key];
      if (!childSchema) invalid(`${path}.${key}`, '허용되지 않는 필드입니다.');
      if (child !== undefined) validate(child, childSchema, `${path}.${key}`);
    }
    return;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) invalid(path, '배열이 필요합니다.');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) invalid(path, `최대 ${schema.maxItems}개입니다.`);
    value.forEach((entry, index) => { if (schema.items) validate(entry, schema.items, `${path}[${index}]`); });
    return;
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value))) invalid(path, '유한한 숫자/정수가 필요합니다.');
    if ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)) invalid(path, `${schema.minimum}~${schema.maximum} 범위여야 합니다.`);
  } else if (typeof value !== schema.type) invalid(path, `${schema.type} 타입이 필요합니다.`);
  if (schema.enum && !schema.enum.includes(value as string | number)) invalid(path, `허용값: ${schema.enum.join(', ')}`);
  if (typeof value === 'string' && schema.maxLength !== undefined && value.length > schema.maxLength) invalid(path, `최대 ${schema.maxLength}자입니다.`);
}
function requireFields(object: RecordValue, keys: readonly string[], path: string): void {
  for (const key of keys) {
    const value = object[key];
    if (value === undefined || (typeof value === 'string' && !value.trim())) invalid(`${path}.${key}`, '필수 필드입니다.');
  }
}
function validateCondition(value: unknown, path: string): void {
  validate(value, combatConditionSchema, path);
  const condition = record(value, path);
  const fields: Record<string, string[]> = {
    always: [], turn: ['start', 'interval'], hp: ['minPercent', 'maxPercent'], mp: ['minPercent', 'maxPercent'],
    status: ['stateId', 'present'], allies: ['min', 'max'], switch: ['switchId', 'value'],
  };
  const required = fields[String(condition.kind)]!;
  requireFields(condition, required, path);
  for (const key of Object.keys(condition)) if (key !== 'kind' && !required.includes(key)) invalid(`${path}.${key}`, '조건 종류에 맞지 않는 필드입니다.');
  if ((typeof condition.minPercent === 'number' && typeof condition.maxPercent === 'number' && condition.minPercent > condition.maxPercent)
    || (typeof condition.min === 'number' && typeof condition.max === 'number' && condition.min > condition.max)) invalid(path, '최솟값이 최댓값보다 큽니다.');
}
export function validateEnemyCombatPatch(value: unknown): void {
  const patch = record(value, 'enemy');
  if (patch.actions !== undefined) {
    if (!Array.isArray(patch.actions)) invalid('enemy.actions', '배열이 필요합니다.');
    patch.actions.forEach((action, index) => {
      const entry = record(action, `enemy.actions[${index}]`);
      if (entry.condition !== undefined) validateCondition(entry.condition, `enemy.actions[${index}].condition`);
    });
  }
  if (patch.rewards !== undefined) {
    const rewards = record(patch.rewards, 'enemy.rewards');
    if (rewards.drops !== undefined) {
      validate(rewards.drops, conditionalDropsSchema, 'enemy.rewards.drops');
      (rewards.drops as unknown[]).forEach((drop, index) => {
        const path = `enemy.rewards.drops[${index}]`, entry = record(drop, path);
        requireFields(entry, ['itemId'], path);
        validateCondition(entry.condition, `${path}.condition`);
      });
    }
  }
}
export function validateSkillCombatPatch(value: unknown): void {
  const patch = record(value, 'skill');
  for (const [key, schema] of Object.entries(authoredSkillProperties)) {
    if (patch[key] !== undefined) validate(patch[key], schema, `skill.${key}`);
  }
}
/** Mutates only the fresh merged draft, before normalizeSkillRecord/upsert. */
export function finalizeSkillCombatPatch(merged: RecordValue, patchValue: unknown, args: RecordValue): void {
  const patch = record(patchValue, 'skill');
  for (const [key, schema] of Object.entries(actionSkillClearProperties)) if (args[key] !== undefined) validate(args[key], schema, key);
  if (args.clearActionSkill === true) {
    if (patch.actionSkill !== undefined || args.clearActionFieldStatus === true || args.clearActionItemCost === true) invalid('clearActionSkill', '전체 해제와 액션 설정/부분 해제를 함께 요청할 수 없습니다.');
    delete merged.actionSkill;
  } else {
    const actionPatch = patch.actionSkill === undefined ? {} : record(patch.actionSkill, 'skill.actionSkill');
    for (const [flag, field] of [['clearActionFieldStatus', 'fieldStatus'], ['clearActionItemCost', 'itemCost']] as const) {
      if (args[flag] !== true) continue;
      if (actionPatch[field] !== undefined) invalid(flag, `${field} 설정과 해제를 함께 요청할 수 없습니다.`);
      if (merged.actionSkill) delete record(merged.actionSkill, 'skill.actionSkill')[field];
    }
    if (patch.actionSkill !== undefined) {
      validate(merged.actionSkill, actionSkillProfileSchema, 'skill.actionSkill');
      const profile = record(merged.actionSkill, 'skill.actionSkill');
      requireFields(profile, ['kind', 'damage', 'range'], 'skill.actionSkill');
      if (profile.fieldStatus !== undefined) requireFields(record(profile.fieldStatus, 'skill.actionSkill.fieldStatus'), ['kind', 'durationMs'], 'skill.actionSkill.fieldStatus');
      if (profile.itemCost !== undefined) requireFields(record(profile.itemCost, 'skill.actionSkill.itemCost'), ['itemId', 'amount'], 'skill.actionSkill.itemCost');
    }
  }
  if (patch.damageFormula !== undefined && String(patch.damageFormula).trim()) {
    // Same preview contract as the editor, including normalized authored power.
    const power = typeof merged.power === 'number' ? Math.max(-9999, Math.min(9999, Math.trunc(merged.power))) : 10;
    const result = evaluateDamageFormula(String(patch.damageFormula), { ...FORMULA_PREVIEW_CONTEXT, power });
    if (!result.ok) invalid('skill.damageFormula', result.error);
  }
}
/** Optional mapTools hook: call before normalizeMapClimate so invalid weather cannot become none. */
export function validateMapClimateInput(value: unknown): void {
  validate(value, mapClimateSchema, 'climate');
  const climate = record(value, 'climate');
  if (climate.mode === 'fixed') requireFields(climate, ['weather', 'intensity'], 'climate');
  else if (climate.weather !== undefined || climate.intensity !== undefined) invalid('climate', 'weather/intensity는 fixed 모드에서만 사용합니다.');
}
