import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withTsModule } from '../ontology-ts-loader.mjs';

// Read the saved project through its store API. This never changes its maps or its SQLite store.
const projectDir = process.argv[2];
assert(projectDir, 'Pass the canonical Joseon project folder');
await withTsModule('scripts/content/lib-joseon-folklore.ts', 'jf-starter-source.mjs', async api => {
  const db = await api.openLocalProjectStore({ projectDir: path.resolve(projectDir) });
  const snapshot = db.loadSnapshot();
  const projectId = db.projectId;
  db.close();
  assert(snapshot, 'Saved source is missing');
  const p = snapshot.project;
  assert.deepEqual(api.collectProjectReferenceIssues(p), [], 'Saved source references');
  assert.equal(Object.keys(p.assets.uploaded).length, 0, 'Starter must use distributable bundled resources');
  assert.equal(Object.keys(p.maps).length, 6, 'Expected the six-map Joseon game');
  assert(Object.values(p.maps).every(m => m.tilesetId === 'joseon_baram'));
  const pack = api.createJoseonFolkloreRecords();
  const baseDatabase = structuredClone(p.database);
  for (const [key, rows] of Object.entries(pack)) {
    const ids = new Set(rows.map(r => r.id));
    baseDatabase[key] = (baseDatabase[key] ?? []).filter(r => !ids.has(r.id));
  }
  // Only the shared basic attack, states/elements/animations and four authored encounter
  // aliases accompany the pack. Unused generic equipment and old job trees are excluded.
  for (const key of ['classes', 'items', 'equipment', 'enemies']) baseDatabase[key] = [];
  baseDatabase.skills = baseDatabase.skills.filter(s => s.id === 'skill_attack');
  baseDatabase.battleCommands = baseDatabase.battleCommands.map(c => ({ ...c, name: c.kind === 'skill' ? '기술' : c.kind === 'item' ? '물품' : c.name }));
  // The canonical game's events are authored against these same scene coordinates,
  // but its old atlas indices predate the current harness bundle. Use the matching
  // public harness maps instead of combining old terrain indices with the new atlas.
  const shipped = JSON.parse(fs.readFileSync('src/project/regionReferences/joseon-village.json', 'utf8'));
  const interiorStarts = new Map();
  const maps = Object.fromEntries(Object.values(p.maps).map(authored => {
    const terrain = shipped.maps[authored.id] ?? shipped.maps[authored.id.replace(/_b$/, '')];
    assert(terrain, 'Missing public harness map: ' + authored.id);
    assert(authored.events.every(e => e.x >= 0 && e.y >= 0 && e.x < terrain.width && e.y < terrain.height), 'Event outside current map: ' + authored.id);
    let events = structuredClone(authored.events);
    if (authored.id.startsWith('joseon_in_')) {
      const anchors = JSON.parse(fs.readFileSync(`tiledata/joseon-village/maps/${terrain.id}.json`, 'utf8'));
      interiorStarts.set(authored.id, anchors.start);
      events = events.flatMap(event => {
        const resident = event.id.match(/_resident_(\d+)$/);
        if (resident) {
          const actor = terrain.events[Number(resident[1])];
          if (!actor) return [];
          event.x = actor.x; event.y = actor.y;
        } else if (event.id.startsWith('ev_exit_')) {
          event.x = anchors.doors[0].x; event.y = anchors.doors[0].y;
        }
        return [event];
      });
    }
    return [authored.id, { ...terrain, id: authored.id, name: authored.name, events, fieldSpawns: authored.fieldSpawns }];
  }));
  const alignInteriorEntry = value => {
    if (!value || typeof value !== 'object') return;
    if (value.kind === 'transfer' && interiorStarts.has(value.mapId)) [value.x, value.y] = interiorStarts.get(value.mapId);
    for (const nested of Object.values(value)) alignInteriorEntry(nested);
  };
  alignInteriorEntry(maps);
  const data = {
    maps, mapTree: p.mapTree, mapConnections: p.mapConnections,
    startMapId: p.startMapId, startPos: p.startPos,
    switches: p.switches, variables: p.variables, commonEvents: p.commonEvents,
    baseDatabase, system: p.system, session: p.session, terms: p.meta.terms,
    bundledTilesetLayout: JSON.parse(fs.readFileSync('src/assets/joseonBaramSheet.json', 'utf8')),
  };
  const dir = 'content-packs/joseon-folklore/starter';
  fs.mkdirSync(dir, { recursive: true });
  const text = JSON.stringify(data);
  fs.writeFileSync(path.join(dir, 'data.json'), text + '\n');
  fs.writeFileSync(path.join(dir, 'provenance.json'), JSON.stringify({
    sourceProjectId: projectId, sourceRevision: snapshot.revision, sourceSha256: snapshot.sha256,
    starterSha256: crypto.createHash('sha256').update(text).digest('hex'),
    mapSha256: Object.fromEntries(Object.values(p.maps).map(m => [m.id, crypto.createHash('sha256').update(JSON.stringify(m)).digest('hex')])),
    starterMapSha256: Object.fromEntries(Object.values(maps).map(m => [m.id, crypto.createHash('sha256').update(JSON.stringify(m)).digest('hex')])),
    terrainSource: 'src/project/regionReferences/joseon-village.json (existing joseon-baram harness maps)',
    terrainSha256: crypto.createHash('sha256').update(fs.readFileSync('src/project/regionReferences/joseon-village.json')).digest('hex'),
    resources: 'Existing bundled Joseon tiles, Actor1, faces and original Joseon folklore pack',
    terrainAuthoredHere: false,
  }, null, 2) + '\n');
  console.log(JSON.stringify({ sourceProjectId: projectId, sourceRevision: snapshot.revision, maps: Object.keys(p.maps), bytes: Buffer.byteLength(text) }));
});
