// Bounded data smoke, not Vitest. Uses the actual current engine normalizers.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { normalizeEnemyRecord, normalizeTroopRecord } from '@/project/databaseEnemyTroopRecordModel';

const base = new URL('../', import.meta.url);
const raw = readFileSync(new URL('data.json', base), 'utf8');
const input = JSON.parse(raw);
const ids = JSON.parse(readFileSync(new URL('../../ids.json', import.meta.url), 'utf8'));
const sheets = JSON.parse(readFileSync(new URL('sheets.json', base), 'utf8'));
const normalized = {
  enemies: input.enemies.map(normalizeEnemyRecord),
  troops: input.troops.map(normalizeTroopRecord),
};
assert.equal(normalized.enemies.length, 15);
assert.equal(normalized.troops.length, 15);
assert.deepEqual(normalized.enemies.map(e => e.id), input.enemies.map(e => e.id));
assert.equal(new Set(normalized.enemies.map(e => e.id)).size, 15);
assert.equal(new Set(normalized.troops.map(e => e.id)).size, 15);
assert.deepEqual(new Set(normalized.enemies.map(e => e.id)), new Set(Object.values(ids.enemies)));
const materialIds = new Set(Object.values(ids.materials));
for (const enemy of normalized.enemies) {
  const before = input.enemies.find(e => e.id === enemy.id);
  assert.ok(Object.values(ids.enemies).includes(enemy.id));
  assert.deepEqual(enemy.stats, before.stats);
  assert.deepEqual(enemy.rewards, before.rewards);
  // Optional switchId: undefined is emitted in memory and omitted on JSON save.
  assert.deepEqual(JSON.parse(JSON.stringify(enemy.actions)), before.actions);
  assert.deepEqual(enemy.skillIds, ['skill_attack']);
  assert.ok(materialIds.has(enemy.rewards.dropItemId));
  assert.ok(sheets.some(s => s.resourceId === enemy.monsterResourceId));
  assert.equal(enemy.graphicHue, 0);
  assert.equal(enemy.transparent, false);
}
for (const troop of normalized.troops) {
  const before = input.troops.find(t => t.id === troop.id);
  assert.deepEqual(troop.members, before.members);
  assert.deepEqual(troop.enemyIds, before.enemyIds);
  assert.equal(troop.uncapturable, true);
  assert.ok(['battle-scenery-forest','battle-scenery-cave'].includes(troop.previewBackgroundResourceId));
  assert.equal(troop.members.length, 1);
  assert.ok(normalized.enemies.some(e => e.id === troop.members[0].enemyId));
}
// JSON save/load cycle of local inputs only. No canonical SQLite or registry claim.
const reloaded = JSON.parse(JSON.stringify(normalized));
assert.deepEqual({
  enemies: reloaded.enemies.map(normalizeEnemyRecord),
  troops: reloaded.troops.map(normalizeTroopRecord),
}, normalized);
const report = {
  passed: true,
  scope: 'actual normalizeEnemyRecord/normalizeTroopRecord + local JSON roundtrip only',
  counts: { enemies: 15, troops: 15, fallbackActions: 15, reservedMaterialDrops: 15 },
  inputSha256: createHash('sha256').update(raw).digest('hex'),
  normalizedSha256: createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),
  normalizerSource: 'src/project/databaseEnemyTroopRecordModel.ts',
  normalizerSourceSha256: createHash('sha256').update(readFileSync(new URL('../../../../src/project/databaseEnemyTroopRecordModel.ts', import.meta.url))).digest('hex'),
  notes: ['normalizer adds existing default neutral element rates', 'no live DB, no runtime registration, no integrated combat played'],
};
writeFileSync(new URL('review/normalize-smoke.json', base), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
