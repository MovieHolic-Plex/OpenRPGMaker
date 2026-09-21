// Rendering-only contract fixture: existing map, one weather command; no authored game changes.
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const kind = process.env.WEATHER_QA_KIND ?? 'fog';
if (!['fog', 'rain', 'snow', 'storm', 'none', 'cloud'].includes(kind)) throw new Error('Unknown weather');
const project = JSON.parse(readFileSync('test/fixtures/projects/editor-authored-demo-v3.json', 'utf8'));
const map = project.maps[project.startMapId];
map.cloudShadows = { amount: Number(process.env.WEATHER_QA_AMOUNT ?? 3), enabled: kind === 'cloud', opacity: 0.26, speed: 8, angleDeg: 28, scale: 1 };
const commands = [{ kind: 'setWeather', weather: kind === 'cloud' ? 'none' : kind, intensity: 0.7, transitionMs: 0 }];
if (process.env.WEATHER_QA_ZOOM) commands.unshift({ kind: 'm2Command', commandId: 'm2-201-camera-control',
  fields: { mode: 'zoom', target: 'player', zoom: Number(process.env.WEATHER_QA_ZOOM), durationMs: 0 } });
map.events = [{ id: 'qa_weather', x: 0, y: 0, trigger: { kind: 'auto' }, commands,
  pages: [{ id: 'qa_weather_page', name: 'Weather rendering', conditions: [], trigger: { kind: 'auto' },
    graphic: { transparent: true }, movement: { type: 'fixed', speed: 3, frequency: 3 },
    priority: 'below', commands }] }];
const clearCommands = [{ kind: 'setWeather', weather: 'none', transitionMs: 1200 },
  { kind: 'text', body: 'Weather cleared' }];
map.events.push({ id: 'qa_clear_weather', ...project.startPos, trigger: { kind: 'action' }, commands: clearCommands,
  pages: [{ id: 'qa_clear_weather_page', name: 'Clear weather', conditions: [], trigger: { kind: 'action' },
    graphic: { transparent: true }, movement: { type: 'fixed', speed: 3, frequency: 3 },
    priority: 'below', commands: clearCommands }] });
const projectFixture = join(mkdtempSync(join(tmpdir(), 'oprn-weather-')), 'project.json');
writeFileSync(projectFixture, JSON.stringify(project));
export default {
  id: `weather-quality-${kind}`, projectFixture,
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: kind, note: `${kind}, intensity 0.7; actual shipping player`,
      ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }, { kind: 'pauseFrames' },
        { kind: 'stepFrames', frames: 120, deltaMs: 16 }],
      expect: { mapId: project.startMapId, playerSpriteTextureLoaded: true, testidAbsent: ['dialogue-box'] }, shot: true },
    { id: `${kind}-motion`, note: 'Same camera, 180 frames later; weather should continue drifting',
      ops: [{ kind: 'stepFrames', frames: 180, deltaMs: 16 }], shot: true },
    ...(kind === 'cloud' ? [] : [{ id: 'cleared', note: 'Weather fades out completely after the event command',
      ops: [{ kind: 'action' }, { kind: 'stepFrames', frames: 2, deltaMs: 16 }, { kind: 'waitFor', testid: 'dialogue-box', state: 'present' },
        { kind: 'stepFrames', frames: 120, deltaMs: 16 }],
      expect: { playerSpriteTextureLoaded: true, testidPresent: ['dialogue-box'] }, shot: true }]),
  ],
};
