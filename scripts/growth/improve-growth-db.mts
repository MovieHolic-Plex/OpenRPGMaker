/** Adversarial-review improvement pass over the saved growth-preset showcase project.
 * Loads the live project, applies data-only fixes, validates, saves, reloads, and writes a receipt.
 * Run with: npx vite-node scripts/qa/tmp/improve-growth-db.mts [--save]
 * Default mode is --verify (read-only). --save performs the remote write.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { deserialize, serialize } from '../../../src/project/io.ts';
import { assertGrowthShape, growthIssues } from '../../../src/project/growth/validation.ts';
import { collectProjectReferenceIssues } from '../../../src/project/io/references.ts';
import { loadProjectFromSupabase, saveProjectToSupabase } from '../../../src/project/supabaseProjectSync.ts';
import type { Project } from '../../../src/project/types.ts';

const projectId = 'rpg-zzu-growth-presets-20260906-wish2';
const out = 'output/evidence/growth-db-review';
const mode = process.argv[2] ?? '--verify';
assert(['--save', '--verify'].includes(mode), 'Use --save or --verify');
const env = loadEnv('development', process.cwd(), '');
const config = { projectId, url: env.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? '', anonKey: env.VITE_SUPABASE_ANON_KEY ?? '' };
assert(config.url && config.anonKey, 'Supabase URL and anon key required');

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, (_key, item: unknown) => {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return item;
  return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
})).digest('hex');

const loaded = await loadProjectFromSupabase(config);
assert(loaded, 'Showcase project must load through the real persistence API');
const project = loaded;
const before = structuredClone(project);

// ---- I1: fill empty passive node descriptions with effect-accurate text ----
const PARAM_LABEL: Record<string, string> = { maxHp: '최대 HP', maxMp: '최대 MP', attack: '공격력', defense: '방어력', mind: '정신력', agility: '민첩성' };
let filledDescs = 0;
for (const tree of project.growth?.skillTrees ?? []) {
  for (const node of tree.nodes) {
    if (node.description?.trim()) continue;
    if (node.effect.kind === 'parameter') {
      node.description = `${PARAM_LABEL[node.effect.parameter] ?? node.effect.parameter}이(가) 등급당 ${node.effect.amount} 오릅니다.`;
      filledDescs++;
    }
  }
}

// ---- I4: append point-economy hint to each shared skill-tree description ----
for (const tree of project.growth?.skillTrees ?? []) {
  if (/포인트/.test(tree.description)) continue;
  const total = tree.nodes.reduce((n, node) => n + node.cost * node.maxRank, 0);
  tree.description = `${tree.description} 전체 ${total} 포인트 경로입니다.`;
}

// ---- I2: wire promotion gates to the skill trees (bundle contract) ----
// role -> shared tree id and its node ids
const roleTree = (role: string) => ({
  treeId: `skill-${role}-tree`,
  root: `skill-${role}-root`,
  mastery: `skill-${role}-mastery`,
  capstoneSkill: `skill-${role}-skill-2`,
});
let wiredPromos = 0;
for (const klass of project.database.classes) {
  const m = klass.id.match(/^promotion-(vanguard|arcane|ranger)-class-(\d)$/);
  if (!m) continue;
  const [, role, idx] = m;
  const t = roleTree(role);
  for (const edge of klass.promotions ?? []) {
    const tier1 = idx === '0'; // class-0 -> class-1/2
    const tier2 = idx === '1' || idx === '2'; // class-1->3, class-2->4
    if (!tier1 && !tier2) continue;
    edge.requires.requiredNodes = [{ treeId: t.treeId, nodeId: t.root, rank: 2 }];
    edge.requires.requiredTreePoints = [{ treeId: t.treeId, points: tier1 ? 3 : 9 }];
    if (tier2) edge.requires.requiredSkillIds = [t.capstoneSkill];
    wiredPromos++;
  }
}

// ---- I3: lower showcase actors so the demo starts with real point choices ----
let lowered = 0;
for (const actor of project.database.actors) {
  if (actor.id.startsWith('showcase-') && actor.initialLevel === 21) { actor.initialLevel = 12; lowered++; }
}

// ---- Validate the mutated project ----
function inspect(p: Project) {
  assertGrowthShape(p.growth);
  assert.deepEqual(growthIssues(p), []);
  assert.deepEqual(collectProjectReferenceIssues(p), []);
  return { growth: p.growth, classes: p.database.classes, skills: p.database.skills, actors: p.database.actors };
}
const expected = inspect(project);
// Wire roundtrip before any remote mutation.
assert.deepEqual(inspect(deserialize(serialize(project))), expected);

// Regression: only intended deltas — counts unchanged, untouched records deep-equal.
assert.equal(project.database.classes.length, before.database.classes.length);
assert.equal(project.database.skills.length, before.database.skills.length);
assert.equal(project.growth?.skillTrees.length, before.growth?.skillTrees.length);
assert.deepEqual(project.maps, before.maps);
assert.deepEqual(project.database.items, before.database.items);
assert.equal(filledDescs, 12, 'expected 12 empty passive descriptions filled');
assert.equal(wiredPromos, 12, 'expected 12 promotion edges wired');
assert.equal(lowered, 3, 'expected 3 showcase actors lowered');

mkdirSync(out, { recursive: true });
let saveResult: { kind: string; sha256?: string } | undefined;
if (mode === '--save') {
  const result = await saveProjectToSupabase(project, config);
  assert.equal(result.kind, 'saved');
  saveResult = { kind: result.kind, sha256: result.sha256 };
  writeFileSync(`${out}/save-result.json`, JSON.stringify({ projectId, ...saveResult }, null, 2));
}

const reloaded = await loadProjectFromSupabase(config);
assert(reloaded, 'Project must reload through the real persistence API');
if (mode === '--save') {
  assert.deepEqual(inspect(reloaded), expected, 'Improvements must survive remote reload');
}
const receipt = {
  projectId, mode, ...(saveResult ? { save: saveResult } : {}),
  authoredDigest: digest(expected), reloadedDigest: digest(inspect(reloaded)),
  equality: mode === '--save',
  changes: { filledDescs, wiredPromos, loweredActors: lowered },
  counts: { classes: reloaded.database.classes.length, skills: reloaded.database.skills.length,
    trees: reloaded.growth?.skillTrees.length, nodes: reloaded.growth?.skillTrees.reduce((n, t) => n + t.nodes.length, 0) },
};
writeFileSync(`${out}/${mode === '--save' ? 'GREEN-save' : 'verify'}-receipt.json`, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
