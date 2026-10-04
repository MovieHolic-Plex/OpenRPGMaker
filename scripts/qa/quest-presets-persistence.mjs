// Save only to this task's isolated QA folder, then close and reopen SQLite.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { withTsModule } from '../ontology-ts-loader.mjs';

const evidenceDir = resolve('verify-shots/quest-presets');
const projectDir = resolve('output/evidence/quest-presets/sqlite-project');
const project = JSON.parse(await readFile(resolve('output/evidence/quest-presets/project.json'), 'utf8'));
await withTsModule(resolve('electron/local-store/store.ts'), 'quest-presets-store.mjs', async module => {
  const store = await module.initLocalProjectStore({ projectDir });
  assert.equal(store.listConversations({ includeEntries: true }).length, 0);
  const saved = await store.saveProject(project);
  assert.equal(saved.kind, 'saved');
  const projectId = store.projectId;
  store.close();
  const reopened = await module.openLocalProjectStore({ projectDir });
  try {
    const snapshot = reopened.loadSnapshot();
    assert.ok(snapshot);
    assert.deepEqual(snapshot.project.quests, project.quests);
    for (const quest of project.quests) {
      const original = project.maps[project.startMapId].events.filter(event => event.id.includes(quest.key));
      const loaded = snapshot.project.maps[project.startMapId].events.filter(event => event.id.includes(quest.key));
      // Load normalization may add optional undefined branch fields; compare wire values.
      assert.deepEqual(JSON.parse(JSON.stringify(loaded)), original);
    }
    await writeFile(resolve(evidenceDir, 'sqlite-proof.json'), JSON.stringify({ projectId, projectDir, revision: snapshot.revision, sha256: snapshot.sha256, reopened: true, quests: snapshot.project.quests.map(q => ({ key: q.key, presetId: q.presetId })), eventsPreserved: true, userProjectModified: false }, null, 2));
    console.log(JSON.stringify({ projectId, projectDir, quests: snapshot.project.quests.length, reopened: true }));
  } finally { reopened.close(); }
});
