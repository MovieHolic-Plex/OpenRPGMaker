/** Targeted native-store extension: four monsters, their skills, and four existing spawn slots. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { withTsModule } from '../ontology-ts-loader.mjs';

const arg = (name, fallback) => {
  const index = process.argv.indexOf('--' + name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const target = path.resolve(arg('project', '/home/main/z-project/rpg-zzu/.oprn-projects/joseon-starter-preset-20261004'));
const out = path.resolve(arg('out', 'output/jf-diversity-20261005'));
fs.mkdirSync(out, { recursive: true });
const addition = JSON.parse(fs.readFileSync('content-packs/joseon-folklore/monsters/expansion.json', 'utf8'));
const slots = [
  ['joseon_field', 'jb_hunt_8', 'troop_jf_mortar_rabbit'],
  ['joseon_field', 'jb_hunt_9', 'troop_jf_venom_toad'],
  ['joseon_cave', 'jb_cave_2', 'troop_jf_earthen_jar_fiend'],
  ['joseon_cave', 'jb_cave_7', 'troop_jf_jangseung_spirit'],
];
const plain = value => JSON.parse(JSON.stringify(value));
const withoutSpawns = maps => Object.fromEntries(Object.entries(maps).map(([id, m]) => {
  const { fieldSpawns, ...rest } = m;
  return [id, rest];
}));

await withTsModule('scripts/content/lib-joseon-folklore.ts', 'jf-variety-save.mjs', async api => {
  const db = await api.openLocalProjectStore({ projectDir: target });
  assert.equal(db.projectId, 'f84dfa19-5b71-43f1-8523-b10910d23be7', 'Target the authored example only');
  const before = db.loadSnapshot();
  assert(before);
  fs.writeFileSync(path.join(out, `before-revision-${before.revision}.oprn.json`), db.exportSerialized());
  const updated = structuredClone(before.project);
  const pack = api.createJoseonFolkloreRecords();
  const added = {};
  for (const [key, rows] of Object.entries(addition)) {
    updated.database[key] ??= [];
    added[key] = [];
    for (const input of rows) {
      if (updated.database[key].some(row => row.id === input.id)) continue;
      const normalized = pack[key].find(row => row.id === input.id);
      assert(normalized, 'Missing public record ' + input.id);
      updated.database[key].push(structuredClone(normalized));
      added[key].push(input.id);
    }
  }
  // The same public installer also registers the new enemy labels in asset selectors/AI tools.
  const installed = api.applyJoseonFolklorePack(updated);
  assert.equal(installed.added, 0, 'Only the targeted four-record collections may change');
  assert.deepEqual(updated.resourceProfiles.slice(0, before.project.resourceProfiles.length), before.project.resourceProfiles);
  const addedProfiles = updated.resourceProfiles.slice(before.project.resourceProfiles.length).map(row => row.assetId);
  for (const [mapId, spawnId, troopId] of slots) {
    const spawn = updated.maps[mapId].fieldSpawns.find(row => row.id === spawnId);
    assert(spawn, 'Missing existing spawn ' + spawnId);
    spawn.troopId = troopId;
  }
  assert.deepEqual(withoutSpawns(updated.maps), withoutSpawns(before.project.maps));
  assert.deepEqual(updated.session, before.project.session);
  for (const [key, rows] of Object.entries(before.project.database)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) assert.deepEqual(updated.database[key].find(r => r.id === row.id), row);
  }
  assert.deepEqual(api.collectProjectReferenceIssues(updated), []);
  if (!process.argv.includes('--save')) {
    db.close();
    console.log(JSON.stringify({ candidateOnly: true, projectId: db.projectId, added, slots }));
    return;
  }
  const saved = await db.saveSerialized(api.serialize(updated), before.sha256);
  assert.equal(saved.kind, 'saved');
  db.close();
  const reopened = await api.openLocalProjectStore({ projectDir: target });
  const after = reopened.loadSnapshot();
  assert(after);
  assert.deepEqual(plain(after.project.database), plain(updated.database));
  assert.deepEqual(plain(after.project.maps), plain(updated.maps));
  assert.deepEqual(plain(after.project.session), plain(before.project.session));
  for (const row of addition.enemies) {
    const profile = after.project.resourceProfiles.find(p => p.assetId === row.monsterResourceId);
    assert(profile?.kind === 'monster' && profile.name === row.name, 'Reloaded monster selector label');
  }
  assert.deepEqual(api.collectProjectReferenceIssues(after.project), []);
  fs.writeFileSync('output/joseon-folklore/starter/game.oprn.json', JSON.stringify(after.project));
  const proof = { projectId: reopened.projectId, projectDir: target, beforeRevision: before.revision,
    revision: after.revision, sha256: after.sha256, reopened: true, added, addedProfiles, slots,
    terrainAndEventsUnchanged: true, existingDatabaseRecordsUnchanged: true, sessionUnchanged: true, referenceIssues: [] };
  fs.writeFileSync(path.join(out, 'storage-proof.json'), JSON.stringify(proof, null, 2));
  reopened.close();
  console.log(JSON.stringify(proof));
});
