import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { withTsModule } from '../ontology-ts-loader.mjs';

const args = process.argv.slice(2);
const projectDir = args[args.indexOf('--project') + 1];
assert(args.includes('--project') && projectDir, 'Pass --project <new project folder>');
// A new example must not replace somebody's saved game.
const exists = fs.existsSync(path.join(projectDir, 'project.sqlite'));
assert(!exists || args.includes('--refresh-example'), 'Target already has a project store; explicit --refresh-example is required');
const out = path.resolve('output/joseon-folklore/starter');
fs.mkdirSync(out, { recursive: true });
await withTsModule('scripts/content/lib-joseon-folklore-starter.ts', 'jf-save-starter.mjs', async api => {
  const seed = await api.createProjectStartSeed('adventure-jrpg', '버들마을', 'example', 'classic', 'joseon-folklore');
  const expected = api.deserialize(api.serialize(seed));
  assert.deepEqual(api.collectProjectReferenceIssues(expected), []);
  const db = exists ? await api.openLocalProjectStore({ projectDir: path.resolve(projectDir) }) : await api.initLocalProjectStore({ projectDir: path.resolve(projectDir) });
  const previous = db.loadSnapshot();
  if (previous) {
    assert(previous.project.flags.joseonFolkloreStarter, 'Only a Joseon starter example can be refreshed');
    fs.writeFileSync(path.join(out, `before-revision-${previous.revision}.oprn.json`), JSON.stringify(previous.project));
  }
  const saved = await db.saveSerialized(api.serialize(expected), previous?.sha256);
  assert.equal(saved.kind, 'saved');
  db.close();
  const reopened = await api.openLocalProjectStore({ projectDir: path.resolve(projectDir) });
  const loaded = reopened.loadSnapshot();
  assert(loaded);
  assert.equal(api.serializeForComparison(loaded.project), api.serializeForComparison(expected), 'Saved seed reload');
  assert.deepEqual(api.collectProjectReferenceIssues(loaded.project), []);
  const proof = { projectId: reopened.projectId, projectDir: reopened.projectDir, revision: loaded.revision, sha256: loaded.sha256, reopened: true, maps: Object.keys(loaded.project.maps), genre: loaded.project.system.genre, battleMethod: api.battleMethodOf(loaded.project), classes: loaded.project.database.classes.map(c => c.name), equipment: loaded.project.database.equipment.length, enemies: loaded.project.database.enemies.length, referenceIssues: [] };
  fs.writeFileSync(path.join(out, 'game.oprn.json'), JSON.stringify(loaded.project));
  fs.writeFileSync(path.join(out, 'storage-proof.json'), JSON.stringify(proof, null, 2));
  reopened.close();
  console.log(JSON.stringify(proof));
});
