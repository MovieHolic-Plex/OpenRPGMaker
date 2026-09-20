import type { JsonSchema } from './types';

const number = (minimum: number, maximum: number): JsonSchema => ({ type: 'number', minimum, maximum });
const integer = (minimum: number, maximum: number): JsonSchema => ({ type: 'integer', minimum, maximum });
const object = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
  type: 'object', properties, required, additionalProperties: false,
});

export const combatConditionSchema = object({
  kind: { type: 'string', enum: ['always', 'turn', 'hp', 'mp', 'status', 'allies', 'switch'] },
  start: integer(1, 999), interval: integer(1, 999),
  minPercent: number(0, 100), maxPercent: number(0, 100),
  stateId: { type: 'string' }, present: { type: 'boolean' },
  min: integer(0, 99), max: integer(0, 99),
  switchId: { type: 'string' }, value: { type: 'boolean' },
}, ['kind']);

export const conditionalDropSchema = object({
  itemId: { type: 'string' }, ratePercent: number(0, 100), quantity: integer(1, 99),
  condition: combatConditionSchema,
}, ['itemId', 'ratePercent', 'quantity', 'condition']);

export const actionSkillProfileSchema = object({
  kind: { type: 'string', enum: ['projectile', 'melee', 'dash', 'trap'] },
  damage: integer(1, 9999), range: integer(1, 20),
  speedTilesPerSec: integer(1, 30), cooldownMs: integer(50, 30000), durationMs: integer(100, 30000),
  itemCost: object({ itemId: { type: 'string' }, amount: integer(1, 99) }, ['itemId', 'amount']),
  fieldStatus: object({ kind: { type: 'string', enum: ['poison', 'slow'] }, durationMs: integer(100, 30000) }, ['kind', 'durationMs']),
}, ['kind', 'damage', 'range']);

export const authoredSkillProperties: Record<string, JsonSchema> = {
  damageFormula: { type: 'string', maxLength: 512, description: '산술식: power, a.atk/def/mind/agi/hp/mp/level, b.* 및 + - * / % 괄호. 빈 문자열은 기본 공식으로 복원.' },
  criticalRate: number(0, 100), criticalMultiplier: number(1, 10), cooldownTurns: integer(0, 99),
  hitSequence: { type: 'array', items: number(0, 10), description: '타격별 배율, 순서대로 실행. MP/PP는 스킬 사용당 한 번 소비.' },
  actionSkill: actionSkillProfileSchema,
};

export const mapClimateSchema = object({
  mode: { type: 'string', enum: ['inherit', 'indoor', 'fixed'] },
  weather: { type: 'string', enum: ['none', 'rain', 'snow', 'storm', 'fog'] },
  intensity: number(0, 1),
}, ['mode']);
