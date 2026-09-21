// Publish the user-approved saved village without regenerating or editing tiles.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadEnv } from 'vite';

const sourceId = 'original-grove-trunks-20260921-76a3-1789965905810';
const sourceSha = '95bc46b0e21fcd627e0a8f30afbcf3eb541d38a45cd730c135ceadd34c1723cc';
const snapshotId = 'oprn-region-river-forest-village-v1';
const slug = 'river-forest-village', mapId = 'restored_river';
const out = 'output/evidence/shared-river-forest-village';
const env = loadEnv('development', process.cwd(), '');
assert(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY, 'Supabase connection required');
const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
  'Accept-Profile': 'rpg_zzu', 'Content-Profile': 'rpg_zzu', 'Content-Type': 'application/json' };
const endpoint = `${env.VITE_SUPABASE_URL}/rest/v1/projects`;
async function read(id) {
  const response = await fetch(`${endpoint}?project_id=eq.${id}&select=current_json,current_sha256`, { headers });
  assert(response.ok, `Read failed: ${response.status}`);
  return (await response.json())[0];
}
const source = await read(sourceId);
assert.equal(source?.current_sha256, sourceSha, 'Approved source revision changed');
const project = structuredClone(source.current_json);
project.meta.title = '강변 숲마을';
const map = project.maps[mapId], tileset = project.tilesets[map.tilesetId];
assert.equal(map.width, 78); assert.equal(map.height, 44);
// Preserve all ten connected maps, events, source tilesets and graft metadata.
const sha = createHash('sha256').update(JSON.stringify(project)).digest('hex');
const existing = await read(snapshotId);
if (existing) assert.deepEqual(existing.current_json, project, 'Published snapshots are immutable');
else {
  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({
    project_id: snapshotId, title: project.meta.title, schema_version: project.version,
    current_json: project, current_sha256: sha, map_count: Object.keys(project.maps).length,
    tileset_count: Object.keys(project.tilesets).length, terrain_template_count: 0,
  }) });
  assert(response.ok, `Snapshot save failed: ${response.status}`);
}
const reloaded = await read(snapshotId);
assert.deepEqual(reloaded.current_json, project);
assert.equal(reloaded.current_sha256, sha);
assert.deepEqual(await read(sourceId), source, 'Source must remain unchanged');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`public/assets/region-references/${slug}.oprn.json`, JSON.stringify(reloaded.current_json));
fs.writeFileSync(`src/project/regionReferences/${slug}.json`, JSON.stringify({ map, tileset }));
fs.copyFileSync('.omo/evidence/restored-original-trunks/village.png', `public/assets/region-references/${slug}.png`);
const proof = { sourceProjectId: sourceId, sourceSha, snapshotProjectId: snapshotId,
  snapshotSha: sha, sourceUnchanged: true, remoteReloadEqual: true, mapId, mapCount: Object.keys(project.maps).length,
  width: map.width, height: map.height, tilesetId: tileset.id };
fs.writeFileSync(`${out}/publication-proof.json`, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof, null, 2));
