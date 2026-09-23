import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { initLocalProjectStore, openLocalProjectStore } from '../../electron/local-store/store';
import assert from 'node:assert/strict';

const destination = process.argv[2];
if (!destination) throw new Error('Usage: vite-node scripts/content/import-saesol-red.mts <new-project-directory>');
const projectDir = path.resolve(destination);
if (fs.existsSync(projectDir)) throw new Error(`Destination already exists: ${projectDir}`);
const fixture = fileURLToPath(new URL('../../examples/saesol-red/project.json.gz', import.meta.url));
const project = JSON.parse(gunzipSync(fs.readFileSync(fixture)).toString('utf8'));
const store = await initLocalProjectStore({ projectDir });
try { await store.saveProject(project); } finally { store.close(); }
const reopened = await openLocalProjectStore({ projectDir });
try {
  assert.deepEqual(JSON.parse(JSON.stringify(reopened.loadSnapshot()!.project)), project);
  console.log(`Saved ${project.meta.title} to ${projectDir} (SQLite readback verified)`);
} finally { reopened.close(); }
