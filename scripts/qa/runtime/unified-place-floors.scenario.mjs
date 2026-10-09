/** Unit contract fixture: drawn first floor and added second floor, no remote authored content. */
import { readFileSync } from 'node:fs';
const flag = process.argv.indexOf('--project');
const projectFixture = flag >= 0 ? process.argv[flag + 1] : 'output/evidence/new-place/runtime-fixture.json';
const project = JSON.parse(readFileSync(projectFixture, 'utf8'));
const up = project.mapConnections.find(link => link.from.mapId === project.startMapId);
const down = project.mapConnections.find(link => link.from.mapId === up?.to.mapId && link.to.mapId === project.startMapId);
if (!up || !down) throw new Error('Missing generated two-way floor transfers');
export default {
  id: 'unified-place-floors', projectFixture,
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: 'painted-first-floor', ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }],
      expect: { mapId: project.startMapId, ...project.startPos, playerSpriteTextureLoaded: true }, shot: true },
    { id: 'enter-second-floor', ops: [{ kind: 'dir', dir: 'down' }, { kind: 'waitForPosition', ...up.to }, { kind: 'dir', dir: null }],
      expect: { ...up.to, playerSpriteTextureLoaded: true }, shot: true },
    { id: 'step-away-from-stairs', ops: [{ kind: 'dir', dir: 'up' }, { kind: 'waitForPosition', mapId: down.from.mapId, x: down.from.x, y: down.from.y - 1 }, { kind: 'dir', dir: null }],
      expect: { mapId: down.from.mapId, x: down.from.x, y: down.from.y - 1 } },
    { id: 'return-to-painted-floor', ops: [{ kind: 'dir', dir: 'down' }, { kind: 'waitForPosition', ...down.to }, { kind: 'dir', dir: null }],
      expect: { ...down.to, playerSpriteTextureLoaded: true }, shot: true },
  ],
};
