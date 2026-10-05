// Dedicated runtime QA against the untouched, downloaded shipping package.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { runRuntimeQa } from '../lib/runtimeQaRun.mjs';
import { installOpeningEvidence } from '../lib/runtimeOpeningEvidence.mjs';
import { webUploadedAssetPath } from '../../src/project/webUploadedAssetPath.ts';

const out = resolve(process.env.LIVE_GAME_OUT ?? 'verify-shots/live-first-game');
const root = resolve(process.env.LIVE_GAME_PACKAGE_OUT ?? 'output/qa/live-first-game', 'game-web');
const projectPath = resolve(root, 'project.json');
const json = await readFile(projectPath, 'utf8'), project = JSON.parse(json);
const completionPath = resolve(out, 'completion.json');
const completionCandidate = existsSync(completionPath) ? JSON.parse(await readFile(completionPath, 'utf8')) : null;
const recoveredPath = resolve(out, 'reloaded.json');
const recovered = existsSync(recoveredPath) ? JSON.parse(await readFile(recoveredPath, 'utf8')) : null;
const completion = completionCandidate?.passed ? completionCandidate : recovered?.passed ? recovered : JSON.parse(await readFile(resolve(out, 'generation.json'), 'utf8'));
assert(completion.passed || completion.generationPrerequisitePassed, 'The live-model result must be saved and reloaded first');
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
assert.deepEqual(project.system, canonical.document.system, 'Opening, title, dialogue settings and game rules must match canonical storage');
assert.deepEqual(project.database, canonical.document.database, 'The AI-authored protagonist and records must survive export');
assert.deepEqual(project.endings, canonical.document.endings, 'The actual authored ending must survive export');
const presentationAssets = [];
const artIds = [...new Set([project.system.titleScreen?.backgroundResourceId,
  ...(project.system.opening?.scenes ?? []).filter(scene => scene.kind === 'image').flatMap(scene => [scene.resourceId, ...(scene.direction?.layers?.map(layer => layer.resourceId) ?? [])]),
  project.system.opening?.musicResourceId, ...Object.values(project.system.titleScreen?.sounds ?? {}),
  ...Object.values(project.maps).map(map => map.bgm?.resourceId),
  ...(project.system.opening?.scenes ?? []).map(scene => scene.direction?.soundResourceId)].filter(Boolean))];
for (const id of artIds) {
  const saved = canonical.document.assets.uploaded[id];
  if (!saved) continue; // Legacy fixtures can use bundled artwork.
  const inline = saved.dataUrl?.startsWith('data:') ? Buffer.from(saved.dataUrl.split(',')[1],'base64') : null;
  assert(saved.ref || inline,'Generated artwork bytes must be present in canonical SQLite/assets');
  if (saved.ref) assert.deepEqual(project.assets.uploaded[id]?.ref,saved.ref,'The exported artwork reference must match canonical storage');
  const expectedHash = saved.ref?.sha256 ?? createHash('sha256').update(inline).digest('hex');
  const expectedBytes = saved.ref?.bytes ?? inline.length;
  const file = resolve(root,webUploadedAssetPath(saved));
  assert(existsSync(file),'The shipping package must include the actual saved artwork');
  const bytes = await readFile(file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expectedHash,'Exported artwork bytes must match the canonical hash');
  assert.equal(bytes.length,expectedBytes);
  presentationAssets.push({resourceId:id,sha256:expectedHash,bytes:bytes.length,canonicalForm:saved.ref?'asset-ref':'sqlite-inline'});
}
for (const row of canonical.maps) {
  const map = JSON.parse(row.map_json), exported = project.maps[row.map_id];
  assert(exported, 'Every saved map must be exported');
  assert.deepEqual(exported.events, map.events, 'The package must contain the actual AI-authored events');
  for (const key of ['width', 'height', 'tilesetId', 'lowerTiles', 'upperTiles',
    'lowerOverlayTiles', 'upperOverlayTiles', 'layers', 'background', 'relief', 'doodadGroups', 'bgm']) {
    assert.deepEqual(exported[key], map[key], `Authored map content must survive export: ${row.map_id}/${key}`);
  }
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
const paths = JSON.parse(execFileSync('bun', [resolve('scripts/qa/live-first-game-paths.mts'), projectPath], {encoding:'utf8'}));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
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
  automaticBuildCompleted: Boolean(completion.generationPrerequisitePassed && (completion.automaticGeneration || !completion.passed)),
  projectJsonSha256: createHash('sha256').update(json).digest('hex'),
  projectJsonBytes: (await stat(projectPath)).size, openingSkipped:false, reducedMotion:false, normalKeyboardOnly:true,
  openingSnapshots:process.env.LIVE_GAME_OPENING_VIDEO_ONLY === '1'?'extract from continuous native video after QA':'browser screenshots',
  screenshotMethod:process.env.LIVE_GAME_FAST_SHOTS === '1'?'CDP captureScreenshot (no font/animation settling)':'Playwright screenshot',
  recordedReadingPauseMs:2500, snapshotReadingPauseMs:Number(process.env.LIVE_GAME_READING_PAUSE_MS ?? 1800), recordingTimeline:[], presentationAssets, presentationEvidence: [], paths, choices: choice.options.map(o => o.text), branches: [] };
// Pointer movement is an authored opt-in. Use ordinary arrow keys for the
// unchanged game, one tile at a time, and verify each committed position.
const walk = (mapId, path, arrivalOverride) => path.steps.flatMap((step, index) => [
  {kind:'key', key:step.key, holdMs:50},
  {kind:'waitForPosition', mapId, x:step.x, y:step.y,
    ...(index === path.steps.length - 1 ? arrivalOverride : {}), timeoutMs:5000},
]);
const investigate = path => [
  ...(path.face ? [{kind:'key',key:path.face,holdMs:50}] : []),
  {kind:'key',key:'Enter'},
];
const opening = project.system.opening;
const introduction = opening?.enabled && opening.scenes?.length ? opening.scenes.map((scene,index) => ({
  id:'opening-'+(index+1),note:'실제 오프닝을 건너뛰지 않고 자연 재생',
  ops:[...(index===0?[{kind:'key',key:'Enter'}]:[]),
    {kind:'waitForAttr',testid:'cinematic-sequence',attr:'data-scene-id',value:scene.id,timeoutMs:30000},
    {kind:'waitForVisible',testid:'cinematic-sequence',timeoutMs:10000},
    ...(scene.narration?[{kind:'waitForText',testid:'cinematic-sequence',text:scene.narration,timeoutMs:10000}]:[])],
  expect:{testidPresent:['cinematic-sequence']},shot:process.env.LIVE_GAME_OPENING_VIDEO_ONLY !== '1',
})) : [{id:'in-map-introduction',note:'첫 장소가 보이는 상태에서 실제 도입과 행동 안내',
  ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'},
    {kind:'waitFor',testid:'dialogue-box',state:'present'}],
  expect:{mapId:start.id,testidPresent:['dialogue-box']},shot:true}];
const advance = { kind: 'pressUntil', key: 'Enter', testid: 'dialogue-box', state: 'absent', maxPresses: 18, timeoutMs: 350 };
try {
  for (const [index, name] of ['keep', 'release'].entries()) {
    const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({viewport:{width:1280,height:900}, reducedMotion:'no-preference',
      ...(index===0?{recordVideo:{dir:resolve(out,'video'),size:{width:1280,height:900}}}:{})});
    const recordingStarted = Date.now();
    const page = await context.newPage();
    if (process.env.LIVE_GAME_OPENING_AUDIO === '1') await installOpeningEvidence(page, index === 0);
    await page.addInitScript(() => {
      window.__openingTimeline = [];
      let last = '';
      new MutationObserver(() => {
        const root = document.querySelector('[data-testid="cinematic-sequence"]');
        if (!root || !root.dataset.sceneId || root.dataset.transitionState !== 'playing' || root.dataset.sceneId === last) return;
        last = root.dataset.sceneId;
        const image = root.querySelector('.cinematic-shot:not([data-previous-shot]) img');
        const text = root.querySelector('.cinematic-frame:not([data-previous-frame]) .cinematic-narration');
        window.__openingTimeline.push({ id: last, at: Date.now(), kind: root.dataset.sceneKind,
          text: text?.textContent, animation: text?.dataset.animation,
          imageWidth: image?.naturalWidth, imageHeight: image?.naturalHeight,
          objectFit: image ? getComputedStyle(image).objectFit : null });
      }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-scene-id', 'data-transition-state'] });
    });
    // Software WebGL can stall animation-frame polling while the scene clock keeps running.
    // Observe the same conditions on a wall-clock interval, without changing playback.
    const waitForFunction = page.waitForFunction.bind(page);
    page.waitForFunction = (fn, arg, options) => waitForFunction(fn, arg, {polling:100, ...options});
    // Give the recorded first run a short reading pause at each real beat.
    // These pauses do not change the game, skip animation, or advance dialogue.
    const cdp = process.env.LIVE_GAME_FAST_SHOTS === '1' ? await context.newCDPSession(page) : null;
    const screenshot = cdp ? async options => {
      const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      const bytes = Buffer.from(capture.data, 'base64');
      if (options.path) await writeFile(options.path, bytes);
      return bytes;
    } : page.screenshot.bind(page);
    page.screenshot = async options => {
      if (await page.getByTestId('title-screen').count() && project.system.titleScreen?.effects?.length) {
        await page.waitForFunction(() => document.querySelector('[data-testid="title-effects"]')?.dataset.titleEffectsRenderer === 'webgl');
        const facts = await page.getByTestId('title-screen').evaluate(node => {
          const effects = node.querySelector('[data-testid="title-effects"]');
          return { kind:'title', sequence:node.dataset.seqState, effects:effects ? {...effects.dataset} : null,
            imageRendering:effects ? getComputedStyle(effects).imageRendering : null,
            canvasWidth:effects?.width,canvasHeight:effects?.height,stageWidth:node.getBoundingClientRect().width,
            text:node.textContent, defaultEditorialCopy:!!node.querySelector('[data-testid="title-kicker"]') };
        });
        assert.equal(facts.defaultEditorialCopy,false,'The generic editorial title must be replaced');
        assert(facts.effects?.titleEffectsAnimated === 'true','Normal title effects must actually animate');
        if (project.system.titleScreen.backgroundRendering === 'smooth') {
          assert.equal(facts.imageRendering,'auto','Painted artwork must use smooth canvas compositing');
          assert(facts.canvasWidth >= facts.stageWidth * Number(facts.effects.titleEffectsResolutionScale) * 0.9,'The art canvas must use the displayed stage size');
        }
        result.presentationEvidence.push({ branch:name, ...facts });
      }
      if (await page.getByTestId('cinematic-sequence').count()) {
        const kind = await page.getByTestId('cinematic-sequence').getAttribute('data-scene-kind');
        if (kind === 'image') {
          await page.waitForFunction(() => {
            const image = document.querySelector('[data-testid="cinematic-sequence"] .cinematic-shot:not([data-previous-shot]) > .cinematic-image');
            return image?.complete && image.naturalWidth > 256 && image.naturalHeight > 192;
          });
          const facts = await page.getByTestId('cinematic-sequence').evaluate(node => {
            const image = node.querySelector('.cinematic-shot:not([data-previous-shot]) > .cinematic-image');
            return { kind:'opening', sceneId:node.dataset.sceneId, width:image.naturalWidth,height:image.naturalHeight,
              motion:image.dataset.motion,objectFit:getComputedStyle(image).objectFit,narration:node.querySelector('.cinematic-frame:not([data-previous-frame]) .cinematic-narration')?.textContent,
              narrationWordBreak:getComputedStyle(node.querySelector('.cinematic-frame:not([data-previous-frame]) .cinematic-narration')).wordBreak,mediaState:node.dataset.mediaState };
          });
          result.presentationEvidence.push({ branch:name, ...facts });
          assert.equal(facts.objectFit,'cover','Opening artwork must fill the stage');
          assert.equal(facts.narrationWordBreak,'keep-all','Opening narration must preserve Korean words when wrapping');
        }
      }
      const cinematic = page.getByTestId('cinematic-sequence');
      const expectedScene = await cinematic.count() ? await cinematic.getAttribute('data-scene-id') : null;
      if (expectedScene) await page.locator('.cinematic-narration:not([hidden])').waitFor({timeout:1000});
      const bytes = await screenshot({...options, animations:'allow'});
      if (expectedScene) assert.equal(await page.getByTestId('cinematic-sequence').getAttribute('data-scene-id'), expectedScene, 'Screenshot must belong to the observed shot');
      if (index === 0) result.recordingTimeline.push({shot:basename(String(options.path)),atSec:(Date.now()-recordingStarted)/1000});
      if (index === 0) await page.waitForTimeout(Number(process.env.LIVE_GAME_READING_PAUSE_MS ?? 1800));
      return bytes;
    };
    const press = page.keyboard.press.bind(page.keyboard);
    page.keyboard.press = async (key, options) => {
      if (index === 0 && key === 'Enter' && await page.locator('[data-testid="dialogue-box"]').count()) {
        await page.waitForTimeout(2500);
      }
      return press(key, options);
    };
    const external = [], failures = [];
    await page.route('**/*', async route => {
      if (new URL(route.request().url()).origin !== url) { external.push(route.request().url()); await route.abort(); }
      else await route.continue();
    });
    page.on('requestfailed', r => failures.push({ url: r.url(), error: r.failure()?.errorText }));
    const scenario = { id: 'live-first-game-' + name, projectFixture: projectPath, viewport: { width: 1280, height: 900 },
      beats: [
        {id:'title',note:'정상 motion으로 실제 타이틀 연출 완료',
          ops:project.system.titleScreen?.sequence!==undefined?[
            {kind:'waitForAttr',testid:'title-screen',attr:'data-seq-state',value:'done',timeoutMs:30000}]:[],
          expect:{testidPresent:['title-screen']},shot:true},
        ...introduction,
        {id:'field',note:'짧은 실제 도입 완료 뒤 조작 반환',ops:[
          ...(opening?.enabled && opening.scenes?.length?[
            {kind:'waitFor',testid:'cinematic-sequence',state:'absent',timeoutMs:30000},
            {kind:'waitFor',testid:'opening-map-handoff',state:'absent',timeoutMs:30000},{kind:'waitForRuntime'},
            {kind:'waitFor',testid:'dialogue-box',state:'present',timeoutMs:30000}, advance]:[advance]),
          {kind:'waitForAttr',testid:'runtime-state-json',attr:'data-live-flags',
            value:`${start.id}|${project.startPos.x}|${project.startPos.y}|true|false`,timeoutMs:30000}],
          expect:{mapId:start.id,x:project.startPos.x,y:project.startPos.y,playerSpriteTextureLoaded:true},shot:true},
        { id: 'clock', note: '정상 이동으로 회중시계 조사', ops: [...walk(start.id, paths.clock), ...investigate(paths.clock),
          { kind: 'pressUntil', key: 'Enter', testid: 'runtime-choices', state: 'present', timeoutMs: 350, maxPresses: 18 }],
          expect: { testidPresent: ['runtime-choices'], visibleText: { 'runtime-choices': choice.options[index].text } }, shot: true },
        { id: 'response', note: '실제 선택과 각기 다른 결과 대사', ops: [{ kind: 'key', key: String(index + 1) },
          { kind: 'waitFor', testid: 'dialogue-box', state: 'present' },
          { kind: 'waitForVisible', testid: 'dialogue-box' },
          { kind: 'waitForText', testid: 'dialogue-box', text: lines[index][0] }],
          expect: { visibleText: { 'dialogue-box': lines[index][0] } }, shot: true },
        { id: 'route', note: '대사 종료 → 동쪽 문 → 기억의 길', ops: [advance,
          ...walk(start.id, paths.gate, paths.gate.trigger==='action'?undefined:{ mapId: route.id, x: arrival.x, y: arrival.y }),
          ...(paths.gate.trigger==='action'?investigate(paths.gate):[]),
          {kind:'waitForPosition',mapId:route.id,x:arrival.x,y:arrival.y}],
          expect: { mapId: route.id, playerSpriteTextureLoaded: true }, shot: true },
        { id: 'ending', note: '전환 완료 뒤 정상 이동·조사로 첫 구간 종료', ops: [
          // Destination coordinates commit before the fade and transfer interpreter finish.
          // Wait for actual field input, rather than sending a key during the transition.
          { kind: 'waitForAttr', testid: 'runtime-state-json', attr: 'data-live-flags',
            value: `${route.id}|${arrival.x}|${arrival.y}|true|false` },
          ...walk(route.id, paths.ending), ...investigate(paths.ending),
          { kind: 'pressUntil', key: 'Enter', testid: 'ending-screen', state: 'present', maxPresses: 18, timeoutMs: 350 },
          { kind: 'waitForAttr', testid: 'ending-screen', attr: 'data-phase', value: 'epilogue', timeoutMs: 30000 },
          { kind: 'waitForVisible', testid: 'ending-screen', descendant: '.ending-heading', minAlpha: 0.95 },
          { kind: 'waitForText', testid: 'ending-screen', text: project.endings[0].name }],
          expect: { testidPresent: ['ending-screen'], visibleText: { 'ending-screen': project.endings[0].name } }, shot: true },
      ] };
    const started = Date.now();
    try {
      const report = await runRuntimeQa(page, scenario, { serverUrl: url, entryPath: '/player.html', projectUrl: '/project.json', outDir: resolve(out, name) });
      result.stageBox = await page.locator('.play-stage').evaluate(node => {
        const box = node.getBoundingClientRect();
        return {x:box.x,y:box.y,width:box.width,height:box.height};
      });
      const nativeOpeningTimeline = await page.evaluate(() => window.__openingTimeline);
      assert.deepEqual(nativeOpeningTimeline.map(scene => scene.id), opening.scenes.map(scene => scene.id), 'Native recording must observe every actual opening scene in order');
      let openingEvidence;
      if (process.env.LIVE_GAME_OPENING_AUDIO === '1') {
        const audio = await page.evaluate(() => window.__oprnStopOpeningRecording());
        openingEvidence = audio.record;
        if (audio.dataUrl) {
          result.nativeAudioPath = resolve(out, 'native-audio.webm');
          await writeFile(result.nativeAudioPath, Buffer.from(audio.dataUrl.split(',')[1], 'base64'));
          result.nativeAudioStartedAt = audio.record.startedAt;
          result.nativeVideoRecordingStartedAt = recordingStarted;
        }
        assert(audio.record.audio.some(s => s.prepared && !s.paused && s.currentTime > 1), 'Selected opening music must actually play');
        if (index === 0) assert(audio.record.audio.some(s => s.rms > 0.001), 'Native opening audio must contain an audible PCM signal');
        if (opening.scenes.some(s => s.kind === 'image' && s.direction?.layers?.length)) {
          const byScene = new Map();
          for (const sample of audio.record.layers) {
            const values = byScene.get(sample.sceneId) ?? new Set();
            values.add(JSON.stringify(sample.layers)); byScene.set(sample.sceneId, values);
          }
          assert([...byScene.values()].some(values => values.size > 4), 'Independent layers must change in actual natural playback');
        }
        assert.equal(audio.record.errors.length, 0, 'Native recording must preserve audio ownership');
      }
      result.presentationEvidence.push({ branch:name, nativeOpeningTimeline:nativeOpeningTimeline.map(scene => ({...scene, atSec:(scene.at-recordingStarted)/1000})) });
      result.branches.push({ name, seconds: (Date.now() - started) / 1000,
        passed: !report.errors.length && report.beats.every(b => !b.failures.length) && !external.length,
        errors: report.errors, beats: report.beats.map(b => ({ id: b.id, failures: b.failures })), external, requestsFailed: failures, openingEvidence });
    } catch (e) { result.branches.push({ name, passed: false, failure: e.message, external, requestsFailed: failures }); }
    finally {
      const video=page.video(); await context.close();
      if(video) result.videoPath=await video.path();
      await browser.close();
    }
    await writeFile(resolve(out, 'gameplay.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result.branches.at(-1)));
  }
} finally { await new Promise(r => server.close(r)); }
result.passed = result.branches.length === 2 && result.branches.every(b => b.passed);
await writeFile(resolve(out, 'gameplay.json'), JSON.stringify(result, null, 2) + '\n');
process.exitCode = result.passed ? 0 : 1;
