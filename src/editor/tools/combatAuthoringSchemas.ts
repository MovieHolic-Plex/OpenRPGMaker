import type { JsonSchema } from './types';

export const MAX_SKILL_HITS = 16;
export const MAX_CONDITIONAL_DROPS = 64;
const number = (minimum: number, maximum: number): JsonSchema => ({ type: 'number', minimum, maximum });
const integer = (minimum: number, maximum: number): JsonSchema => ({ type: 'integer', minimum, maximum });
const object = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
  type: 'object', properties, required, additionalProperties: false,
});

export const combatConditionSchema = object({
  kind: { type: 'string', enum: ['always', 'turn', 'hp', 'mp', 'status', 'allies', 'switch'] },
  start: integer(1, 999), interval: integer(1, 999),
  minPercent: integer(0, 100), maxPercent: integer(0, 100),
  stateId: { type: 'string' }, present: { type: 'boolean' },
  min: integer(0, 99), max: integer(0, 99),
  switchId: { type: 'string' }, value: { type: 'boolean' },
}, ['kind']);

export const conditionalDropSchema = object({
  itemId: { type: 'string' }, ratePercent: integer(0, 100), quantity: integer(1, 99),
  condition: combatConditionSchema,
}, ['itemId', 'ratePercent', 'quantity', 'condition']);

export const conditionalDropsSchema: JsonSchema & { maxItems: number } = {
  type: 'array', items: conditionalDropSchema, maxItems: MAX_CONDITIONAL_DROPS,
};
const hitSequenceSchema: JsonSchema & { maxItems: number } = {
  type: 'array', items: number(0, 10), maxItems: MAX_SKILL_HITS,
  description: '타격별 배율 0~10, 최대 16개. 빈 배열은 기본 타격으로 복원. MP/PP는 사용당 한 번 소비.',
};

// Upsert accepts partial objects; the merged profile is checked before normalization.
export const actionSkillProfileSchema = object({
  kind: { type: 'string', enum: ['projectile', 'melee', 'dash', 'trap'] },
  damage: integer(1, 9999), range: integer(1, 20),
  speedTilesPerSec: integer(1, 30), cooldownMs: integer(50, 30000), durationMs: integer(100, 30000),
  itemCost: object({ itemId: { type: 'string' }, amount: integer(1, 99) }),
  fieldStatus: object({ kind: { type: 'string', enum: ['poison', 'slow'] }, durationMs: integer(100, 30000) }),
});

export const authoredSkillProperties: Record<string, JsonSchema> = {
  damageFormula: { type: 'string', maxLength: 512, description: '산술식: power, a.atk/def/mind/agi/hp/mp/level, b.* 및 + - * / % 괄호. 빈 문자열은 기본 공식으로 복원.' },
  criticalRate: integer(0, 100), criticalMultiplier: number(1, 10), cooldownTurns: integer(0, 99),
  hitSequence: hitSequenceSchema,
  actionSkill: { ...actionSkillProfileSchema, description: '기존 액션은 변경할 필드만 전달. 처음 설정하거나 kind를 바꾸면 kind/damage/range 필수. 해제는 최상위 clearActionSkill/clearActionFieldStatus/clearActionItemCost 사용.' },
};

export const mapClimateSchema = object({
  mode: { type: 'string', enum: ['inherit', 'indoor', 'fixed'] },
  weather: { type: 'string', enum: ['none', 'rain', 'snow', 'storm', 'fog'] },
  intensity: number(0, 1),
}, ['mode']);

/** Tool arguments only: never persisted in SkillRecord. Conflicting set/clear is rejected. */
export const actionSkillClearProperties: Record<string, JsonSchema> = {
  clearActionSkill: { type: 'boolean', description: 'true: 필드 액션 전체 해제. actionSkill 패치와 동시 사용 불가.' },
  clearActionFieldStatus: { type: 'boolean', description: 'true: 필드 상태만 해제. fieldStatus 패치와 동시 사용 불가.' },
  clearActionItemCost: { type: 'boolean', description: 'true: 탄약 비용만 해제. itemCost 패치와 동시 사용 불가.' },
};
