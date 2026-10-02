// Save only to this task's isolated QA folder, then close and reopen SQLite.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { withTsModule } from '../ontology-ts-loader.mjs';

const evidenceDir = resolve('verify-shots/quest-library');
const projectDir = resolve('output/evidence/quest-library/sqlite-project');
const project = JSON.parse(await readFile(resolve('output/evidence/quest-library/project.json'), 'utf8'));
await withTsModule(resolve('electron/local-store/store.ts'), 'quest-library-store.mjs', async module => {
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
    for (const [mapId, map] of Object.entries(project.maps)) {
      const loaded = snapshot.project.maps[mapId];
      assert.deepEqual(JSON.parse(JSON.stringify(loaded.events)), map.events);
    }
    assert.deepEqual(snapshot.project.system.craftRecipes, project.system.craftRecipes);
    await writeFile(resolve(evidenceDir, 'sqlite-proof.json'), JSON.stringify({ projectId, projectDir, revision: snapshot.revision, sha256: snapshot.sha256, reopened: true, quests: snapshot.project.quests.map(q => ({ key: q.key, presetId: q.presetId })), eventsPreserved: true, userProjectModified: false }, null, 2));
    console.log(JSON.stringify({ projectId, projectDir, quests: snapshot.project.quests.length, reopened: true }));
  } finally { reopened.close(); }
});
