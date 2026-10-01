import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const project = JSON.parse(await readFile(resolve('output/evidence/quest-presets/project.json'), 'utf8'));
project.startPos = { x: 5, y: 6 };
project.session.gold = 0;
// This quest probe does not exercise the default opening or hundreds of unused
// inline media assets. Keep only media actually referenced by runtime data.
project.system.opening = { ...project.system.opening, enabled: false };
const referenced = new Set();
const scan = value => {
  if (!value || typeof value !== 'object') return;
  if (value.type === 'uploaded' && typeof value.id === 'string') referenced.add(value.id);
  for (const [key, child] of Object.entries(value)) {
    if (/resourceId$/i.test(key) && typeof child === 'string') referenced.add(child);
    else if (typeof child === 'object') scan(child);
  }
};
scan(project.maps); scan(project.database); scan(project.system); scan(project.tilesets);
project.assets.uploaded = Object.fromEntries(Object.entries(project.assets.uploaded).filter(([id]) => referenced.has(id)));
const projectFixture = resolve('output/evidence/quest-presets/runtime.json');
await writeFile(projectFixture, JSON.stringify(project));
const key = key => ({ kind: 'key', key });
const visible = testid => ({ kind: 'waitForVisible', testid });
const dismiss = { kind: 'pressUntil', key: 'Enter', testid: 'dialogue-box', state: 'absent', timeoutMs: 250, maxPresses: 20 };
const mapId = project.startMapId;
const move = (dir, x) => [{ kind: 'dir', dir }, { kind: 'waitForPosition', mapId, x, y: 6 }, { kind: 'dir', dir: null }];
export default {
  id: 'quest-presets', projectFixture, viewport: { width: 960, height: 720 },
  beats: [
    { id: 'field', ops: [key('Enter'), { kind: 'waitForRuntime' }], expect: { mapId, x: 5, y: 6 } },
    { id: 'offer', ops: [{ kind: 'face', dir: 'up' }, { kind: 'action' }, visible('dialogue-box')], expect: { testidPresent: ['dialogue-box'] }, shot: true },
    { id: 'accept', ops: [{ kind: 'pressUntil', key: 'Enter', testid: 'runtime-choices', state: 'present', timeoutMs: 250 }, key('Enter'), dismiss], expect: { switches: { sw_preset_errand_started: true }, gold: 0 } },
    { id: 'deliver', ops: [...move('right', 8), { kind: 'face', dir: 'up' }, { kind: 'action' }, visible('dialogue-box')], expect: { testidPresent: ['dialogue-box'] }, shot: true },
    { id: 'objective-done', ops: [dismiss], expect: { switches: { sw_preset_errand_step0: true }, variables: { var_preset_errand_progress: 1 }, gold: 0 } },
    { id: 'reward', ops: [...move('left', 5), { kind: 'face', dir: 'up' }, { kind: 'action' }, visible('dialogue-box')], expect: { gold: 100, switches: { sw_preset_errand_done: true }, testidPresent: ['dialogue-box'] }, shot: true },
    { id: 'repeat-report', ops: [dismiss, { kind: 'action' }, visible('dialogue-box')], expect: { gold: 100, testidPresent: ['dialogue-box'] }, shot: true },
  ],
};
