import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { deserialize, serialize } from '@/project/io';
import { applyGrowthPreset } from '@/project/growth/presets';
import { growthIssues } from '@/project/growth/validation';
import { loadProjectFromSupabase, saveProjectToSupabase } from '@/project/supabaseProjectSync';

// Explicit isolated QA content. Never save to the configured authoring project.
const projectId = 'rpg-zzu-growth-integrated-qa-20260906';
const env = loadEnv('development', process.cwd(), '');
assert.ok(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY, 'Supabase configuration required');
assert.notEqual(projectId, env.VITE_SUPABASE_PROJECT_ID);
const config = {
  projectId,
  url: env.VITE_SUPABASE_URL,
  anonKey: env.VITE_SUPABASE_ANON_KEY,
};
const out = resolve('.omo/evidence/growth-integrated/persistence');
const input = resolve('.omo/evidence/growth-integrated/browser-presets/applied-bundle.json');
const project = deserialize(await readFile(input, 'utf8'));
const root = project.database.classes.find(c => c.id.startsWith('bundle-vanguard-') && c.promotions?.length === 2);
assert.ok(root, 'Input must contain the bundle applied by real editor QA');
const classFormProof = JSON.parse(await readFile(resolve('.omo/evidence/growth-integrated/browser-presets/class-form-proof.json'), 'utf8'));
assert.equal(classFormProof.requires.level, 6);
assert.ok(root.promotions?.[0]);
root.promotions[0].requires.level = 6;
assert.deepEqual(JSON.parse(JSON.stringify(root.promotions[0].requires)), classFormProof.requires, 'Persist the exact gate edited through the ordinary Classes form');
const firstActor = project.database.actors[0];
assert.ok(firstActor, 'QA actor required');
const beforeActor = { id: firstActor.id, classId: firstActor.classId, initialLevel: firstActor.initialLevel };
// This assignment is explicit QA authoring, not an effect of applying a preset.
firstActor.classId = root.id;
firstActor.initialLevel = 12;
project.session.partyActorIds = [firstActor.id];
project.meta.title = '직업·스킬 연결 성장 검증';
const otherBundles = ['bundle-arcane', 'bundle-ranger'].map(id => applyGrowthPreset(project, id));
assert.deepEqual(growthIssues(project), []);
const expected = deserialize(serialize(project));
const saved = await saveProjectToSupabase(expected, config);
assert.equal(saved.kind, 'saved');
const loaded = await loadProjectFromSupabase(config);
assert.ok(loaded, 'Saved QA project must reload from Supabase');
assert.deepEqual(loaded.growth, expected.growth);
const classIds = expected.database.classes.filter(c => c.id.startsWith('bundle-')).map(c => c.id);
assert.deepEqual(loaded.database.classes.filter(c => classIds.includes(c.id)), expected.database.classes.filter(c => classIds.includes(c.id)));
assert.deepEqual(loaded.database.skills.filter(s => s.id.startsWith('bundle-')), expected.database.skills.filter(s => s.id.startsWith('bundle-')));
assert.deepEqual(growthIssues(loaded), []);
await mkdir(out, { recursive: true });
await writeFile(`${out}/reloaded-project.json`, serialize(loaded));
const first = root.promotions?.[0];
assert.ok(first);
const middle = loaded.database.classes.find(c => c.id === first.toClassId);
const last = middle?.promotions?.[0];
assert.ok(middle && last);
const route = [root.id, middle.id, last.toClassId].map(classId => {
  const tree = loaded.growth?.skillTrees.find(t => t.classIds.includes(classId));
  assert.ok(tree);
  const foundation = tree.nodes.find(n => n.effect.kind === 'parameter');
  const technique = tree.nodes.find(n => n.effect.kind === 'skill');
  assert.ok(foundation && technique);
  return { classId, treeId: tree.id, foundation: foundation.id, technique: technique.id };
});
const proof = {
  projectId,
  saved: saved.kind,
  sha256: saved.kind === 'saved' ? saved.sha256 : undefined,
  reloaded: true,
  growthEqual: true,
  legacyClassFormGatesPreserved: true,
  classCount: classIds.length,
  treeCount: loaded.growth?.skillTrees.length,
  source: input,
  additionalBundles: otherBundles.map(bundle => bundle.presetId),
  explicitQaActorAssignment: { before: beforeActor, after: { id: firstActor.id, classId: firstActor.classId, initialLevel: firstActor.initialLevel } },
  actorId: firstActor.id,
  route,
};
await writeFile(`${out}/proof.json`, JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ projectId, saved: saved.kind, reloaded: true, trees: proof.treeCount, classes: proof.classCount }));
