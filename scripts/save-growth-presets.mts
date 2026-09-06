/** Dedicated, non-overwriting growth showcase save/reload. Run with vite-node.
 * --save is first-write only; --verify (default) is read-only and safe to repeat.
 * No environment override can select a different remote project.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { createBlankProject } from '../src/project/defaults/defaultProject.ts';
import { applyGrowthPreset, GROWTH_PRESETS } from '../src/project/growth/presets.ts';
import { assertGrowthShape, growthIssues } from '../src/project/growth/validation.ts';
import { collectProjectReferenceIssues } from '../src/project/io/references.ts';
import { serialize, deserialize } from '../src/project/io.ts';
import { loadProjectFromSupabase, saveProjectToSupabase } from '../src/project/supabaseProjectSync.ts';
import type { Project } from '../src/project/types.ts';

const projectId = 'rpg-zzu-growth-presets-20260906-wish2';
const out = 'output/evidence/growth-presets/p2';
const mode = process.argv[2] ?? '--verify';
assert(['--save', '--verify'].includes(mode), 'Use --save or --verify');
const env = loadEnv('development', process.cwd(), '');
const config = { projectId, url: env.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? '', anonKey: env.VITE_SUPABASE_ANON_KEY ?? '' };
assert(config.url && config.anonKey && env.VITE_SUPABASE_PROJECT_ID, 'Configured Supabase URL, anon key and project ID required');
// Object property order is not authored content; the loader may reorder fields.
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, (_key, item: unknown) => {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return item;
  return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
})).digest('hex');
const authored = createBlankProject();
const original = structuredClone(authored);
const applications = GROWTH_PRESETS.map(preset => applyGrowthPreset(authored, preset.id));
assert.equal(applications.length, 6);
// Presets preserve all original records/settings; only appended content is removed for this comparison.
const restored = structuredClone(authored);
restored.database.classes.splice(original.database.classes.length);
restored.database.skills.splice(original.database.skills.length);
if (original.growth) restored.growth = original.growth; else delete restored.growth;
assert.deepEqual(restored, original);
const actorTemplate = original.database.actors.find(actor => actor.id === original.session.partyActorIds[0]);
assert(actorTemplate, 'Blank project starting actor must exist');
const actors = applications.filter(entry => entry.kind === 'promotion').map(entry => {
  const root = authored.database.classes.find(record => record.id === entry.addedClassIds[0]);
  assert(root, 'Preset root must exist');
  return { ...structuredClone(actorTemplate), id: `showcase-${entry.presetId}`, name: root.name,
    classId: root.id, initialLevel: 21, maxLevel: 99 };
});
authored.database.actors.push(...actors);
authored.meta.title = '그림 성장 프리셋 쇼케이스';
authored.system.startActorIds = actors.map(actor => actor.id);
authored.session.partyActorIds = [...authored.system.startActorIds];
assert.deepEqual(authored.maps, original.maps);
assert.deepEqual(authored.database.actors.slice(0, original.database.actors.length), original.database.actors);

function inspect(project: Project) {
  assertGrowthShape(project.growth);
  assert.deepEqual(growthIssues(project), []);
  assert.deepEqual(collectProjectReferenceIssues(project), []);
  return { growth: project.growth, classes: project.database.classes, skills: project.database.skills,
    actors: project.database.actors, party: project.session.partyActorIds, startActors: project.system.startActorIds };
}
const expected = inspect(authored);
// Validate the actual wire before any remote mutation.
assert.deepEqual(inspect(deserialize(serialize(authored))), expected);
mkdirSync(out, { recursive: true });
let saveResult: { kind: string; sha256?: string } | undefined;
if (mode === '--save') {
  // Raw presence check refuses even malformed/empty existing content (never treat it as a blank target).
  const query = new URLSearchParams({ select: 'project_id', project_id: `eq.${projectId}` });
  const response = await fetch(`${config.url}/rest/v1/projects?${query}`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Accept-Profile': 'rpg_zzu' },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, 'Target preflight HTTP status');
  const rows: unknown = await response.json();
  assert.deepEqual(rows, [], 'Target already exists: refuse to overwrite; use --verify');
  assert.equal(await loadProjectFromSupabase(config), null, 'Actual loader must also confirm target absent');
  writeFileSync(`${out}/save-preflight.json`, JSON.stringify({ projectId, status: response.status, rows, checkedAt: new Date().toISOString() }, null, 2));
  const result = await saveProjectToSupabase(authored, config);
  assert.equal(result.kind, 'saved');
  saveResult = { kind: result.kind, sha256: result.sha256 };
  // Preserve receipt even if a later reload fails: an existing row must never be retried as a first write.
  writeFileSync(`${out}/save-result.json`, JSON.stringify({ projectId, ...saveResult }, null, 2));
}
const reloaded = await loadProjectFromSupabase(config);
assert(reloaded, 'Dedicated project must reload through actual persistence API');
assert.deepEqual(inspect(reloaded), expected, 'Authored growth/classes/skills/actors/refs must survive remote reload');
assert.deepEqual(reloaded.maps, authored.maps, 'No map content added or changed');
const receipt = { projectId, mode, ...(saveResult ? { save: saveResult } : {}),
  authoredDigest: digest(expected), reloadedDigest: digest(inspect(reloaded)), equality: true,
  references: 0, originalRecordsPreserved: true, applications,
  counts: { classes: reloaded.database.classes.length, skills: reloaded.database.skills.length,
    trees: reloaded.growth?.skillTrees.length, nodes: reloaded.growth?.skillTrees.reduce((n, tree) => n + tree.nodes.length, 0),
    addedClasses: 15, addedSkills: 18, demonstrationActors: actors.length, maps: Object.keys(reloaded.maps).length },
  actors: actors.map(actor => ({ id: actor.id, classId: actor.classId, initialLevel: actor.initialLevel })),
};
writeFileSync(`${out}/${mode === '--save' ? 'save' : 'reload'}-receipt.json`, JSON.stringify(receipt, null, 2));
writeFileSync(`${out}/reloaded-project.json`, serialize(reloaded));
console.log(JSON.stringify(receipt, null, 2));
