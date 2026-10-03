// Dedicated runtime QA against the untouched, downloaded shipping package.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { firefox } from 'playwright';
import { runRuntimeQa } from '../lib/runtimeQaRun.mjs';

const out = resolve(process.env.LIVE_GAME_OUT ?? 'verify-shots/live-first-game');
const root = resolve('output/qa/live-first-game/game-web');
const projectPath = resolve(root, 'project.json');
const json = await readFile(projectPath, 'utf8'), project = JSON.parse(json);
const completion = JSON.parse(await readFile(resolve(out, 'completion.json'), 'utf8'));
assert(completion.passed, 'The live-model completion must be saved and reloaded first');
const db = new DatabaseSync(resolve(completion.afterReload.dir, 'project.sqlite'), { readOnly: true });
let canonical;
try {
  const row = db.prepare('SELECT project_id,current_json FROM project WHERE id=1').get();
  canonical = { projectId: row.project_id, document: JSON.parse(row.current_json),
    maps: db.prepare('SELECT map_id,map_json FROM maps ORDER BY map_id').all() };
} finally { db.close(); }
assert.equal(canonical.projectId, completion.afterReload.projectId);
assert.equal(project.meta.title, canonical.document.meta.title);
assert.deepEqual(project.gameDesignBrief, canonical.document.gameDesignBrief);
assert.deepEqual(project.startPos, canonical.document.startPos);
for (const row of canonical.maps) {
  const map = JSON.parse(row.map_json), exported = project.maps[row.map_id];
  assert(exported, 'Every saved map must be exported');
  assert.deepEqual(exported.events, map.events, 'The package must contain the actual AI-authored events');
  for (const key of ['width', 'height', 'tilesetId', 'lowerTiles', 'upperTiles', 'layers', 'bgm']) assert.deepEqual(exported[key], map[key]);
}
const start = project.maps[project.startMapId];
const starter = start.events.find(e => e.id === 'ev_segment_starter');
assert(starter, 'The original playable segment must survive AI authoring');
const choice = starter.pages.flatMap(p => p.commands).find(c => c.kind === 'choices');
assert(choice?.options.length === 2, 'AI must author the two requested memory choices');
assert(/간직/.test(choice.options[0].text) && /놓아/.test(choice.options[1].text), 'Requested choice order');
const lines = choice.options.map(o => o.branch.filter(c => c.kind === 'text').map(c => c.body));
assert(lines.every(l => l.length) && lines[0][0] !== lines[1][0], 'Each branch must have a different response');
const route = project.maps.map_segment_route;
const end = route.events.find(e => e.id === 'ev_segment_end');
assert(end, 'The ending event must survive');
const gate = start.events.find(e => e.pages.some(p => p.commands.some(c => c.kind === 'transfer' && c.mapId === route.id)));
const arrival = gate?.pages.flatMap(p => p.commands).find(c => c.kind === 'transfer' && c.mapId === route.id);
assert(arrival, 'The actual saved gate must connect to the memory path');
const approach = e => ({ x: e.x - (e.pages[0].priority === 'same' ? 1 : 0), y: e.y });
const titleIntro = project.system.titleScreen?.sequence !== undefined ? [
  { kind: 'key', key: 'Enter' },
  { kind: 'waitForAttr', testid: 'title-screen', attr: 'data-seq-state', value: 'done' },
] : [];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    const bytes = await readFile(path); res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream' }); res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = 'http://127.0.0.1:' + server.address().port;
const result = { projectId: canonical.projectId, title: project.meta.title, canonicalContentMatched: true,
  projectJsonSha256: createHash('sha256').update(json).digest('hex'),
  projectJsonBytes: (await stat(projectPath)).size, choices: choice.options.map(o => o.text), branches: [] };
// Pointer movement is an authored opt-in. Use ordinary arrow keys for the
// unchanged game, one tile at a time, and verify each committed position.
const walk = (map, from, to, arrivalOverride) => {
  const ops = [], position = { x: from.x, y: from.y };
  for (const [axis, positive, negative] of [['x', 'ArrowRight', 'ArrowLeft'], ['y', 'ArrowDown', 'ArrowUp']]) {
    while (position[axis] !== to[axis]) {
      const step = Math.sign(to[axis] - position[axis]); position[axis] += step;
      const final = position.x === to.x && position.y === to.y;
      ops.push({ kind: 'key', key: step > 0 ? positive : negative, holdMs: 50 },
        { kind: 'waitForPosition', mapId: map, ...position, ...(final ? arrivalOverride : {}), timeoutMs: 5000 });
    }
  }
  return ops;
};
const advance = { kind: 'pressUntil', key: 'Enter', testid: 'dialogue-box', state: 'absent', maxPresses: 18, timeoutMs: 350 };
try {
  for (const [index, name] of ['keep', 'release'].entries()) {
    const browser = await firefox.launch({ firefoxUserPrefs: { 'network.notify.changed': false } });
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const external = [], failures = [];
    await page.route('**/*', async route => {
      if (new URL(route.request().url()).origin !== url) { external.push(route.request().url()); await route.abort(); }
      else await route.continue();
    });
    page.on('requestfailed', r => failures.push({ url: r.url(), error: r.failure()?.errorText }));
    const scenario = { id: 'live-first-game-' + name, projectFixture: projectPath, viewport: { width: 1280, height: 900 },
      beats: [
        { id: 'title', note: '다운로드한 ZIP의 실제 player.html 및 project.json 부팅', expect: { testidPresent: ['title-screen'] }, shot: true },
        { id: 'opening', note: '저장된 오프닝', ops: [...titleIntro,
          { kind: 'key', key: 'Enter' }, { kind: 'waitFor', testid: 'cinematic-sequence', state: 'present' }],
          expect: { testidPresent: ['cinematic-sequence'] }, shot: true },
        { id: 'field', note: '실제 시작 맵과 디코딩된 플레이어 그림', ops: [{ kind: 'key', key: 'Escape' }, { kind: 'waitForRuntime' }],
          expect: { mapId: start.id, x: project.startPos.x, y: project.startPos.y, playerSpriteTextureLoaded: true }, shot: true },
        { id: 'clock', note: '정상 이동으로 회중시계 조사', ops: [...walk(start.id, project.startPos, approach(starter)),
          { kind: 'face', dir: 'right' }, { kind: 'action' },
          { kind: 'pressUntil', key: 'Enter', testid: 'runtime-choices', state: 'present', timeoutMs: 350, maxPresses: 18 }],
          expect: { testidPresent: ['runtime-choices'], visibleText: { 'runtime-choices': choice.options[index].text } }, shot: true },
        { id: 'response', note: '실제 선택과 각기 다른 결과 대사', ops: [{ kind: 'key', key: String(index + 1) },
          { kind: 'waitFor', testid: 'dialogue-box', state: 'present' }, { kind: 'key', key: 'Enter' },
          { kind: 'waitForVisible', testid: 'dialogue-box' }],
          expect: { visibleText: { 'dialogue-box': lines[index][0] } }, shot: true },
        { id: 'route', note: '대사 종료 → 동쪽 문 → 기억의 길', ops: [advance,
          ...walk(start.id, approach(starter), gate, { mapId: route.id, x: arrival.x, y: arrival.y })],
          expect: { mapId: route.id, playerSpriteTextureLoaded: true }, shot: true },
        { id: 'ending', note: '전환 완료 뒤 정상 이동·조사로 첫 구간 종료', ops: [
          // Destination coordinates commit before the fade and transfer interpreter finish.
          // Wait for actual field input, rather than sending a key during the transition.
          { kind: 'waitForAttr', testid: 'runtime-state-json', attr: 'data-live-flags',
            value: `${route.id}|${arrival.x}|${arrival.y}|true|false` },
          ...walk(route.id, arrival, approach(end)),
          { kind: 'face', dir: 'right' }, { kind: 'action' },
          { kind: 'pressUntil', key: 'Enter', testid: 'ending-screen', state: 'present', maxPresses: 18, timeoutMs: 350 }],
          expect: { testidPresent: ['ending-screen'] }, shot: true },
      ] };
    const started = Date.now();
    try {
      const report = await runRuntimeQa(page, scenario, { serverUrl: url, entryPath: '/player.html', projectUrl: '/project.json', outDir: resolve(out, name) });
      result.branches.push({ name, seconds: (Date.now() - started) / 1000,
        passed: !report.errors.length && report.beats.every(b => !b.failures.length) && !external.length,
        errors: report.errors, beats: report.beats.map(b => ({ id: b.id, failures: b.failures })), external, requestsFailed: failures });
    } catch (e) { result.branches.push({ name, passed: false, failure: e.message, external, requestsFailed: failures }); }
    finally { await browser.close(); }
    await writeFile(resolve(out, 'gameplay.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result.branches.at(-1)));
  }
} finally { await new Promise(r => server.close(r)); }
result.passed = result.branches.length === 2 && result.branches.every(b => b.passed);
await writeFile(resolve(out, 'gameplay.json'), JSON.stringify(result, null, 2) + '\n');
process.exitCode = result.passed ? 0 : 1;
