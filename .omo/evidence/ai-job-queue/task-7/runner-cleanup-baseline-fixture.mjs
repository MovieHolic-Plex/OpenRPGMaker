// Test-only real editor/service harness. No production endpoint or user project is changed.
import { createServer } from 'vite';
import { createBrowserRuntime } from '../../../../scripts/lib/aiJobs/browserExecutor.mjs';
import { openAiJobsService } from '../../../../scripts/lib/aiJobs/service.mjs';
import { mkdtemp, rm, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const { PNG } = createRequire(import.meta.url)('pngjs');
const root = process.cwd(), origin = 'http://127.0.0.1:19841';
const evidence = resolve(root, '.omo/evidence/ai-job-queue/task-7');
const temporary = await mkdtemp(join(tmpdir(), 'task7-editor-'));
const held = new Map(), reached = new Map(), errors = [], sseConnections = [], browserEvents = [];
const browsers = new Set();
const ownedChromium = { executablePath: () => chromium.executablePath(), async launch(options) {
  const browser = await chromium.launch({ ...options, handleSIGTERM: false, handleSIGINT: false, handleSIGHUP: false });
  browsers.add(browser); browserEvents.push({ event: 'launched', at: Date.now() });
  const close = browser.close.bind(browser);
  browser.close = async () => { try { await close(); } finally { browsers.delete(browser); browserEvents.push({ event: 'closed', at: Date.now() }); } };
  return browser;
} };
const onError = error => { errors.push(String(error.stack ?? error)); console.error('TASK7_SERVICE_ERROR', error); };
let service, server, providerCalls = 0, closing;
const runtime = await createBrowserRuntime({ origin, cacheDir: join(temporary, 'cache'), chromium: ownedChromium, dispatchProvider: async (_request, context) => {
  providerCalls++;
  reached.get(context.jobId)?.();
  await new Promise((resolve, reject) => {
    held.set(context.jobId, resolve);
    context.signal.addEventListener('abort', () => { held.delete(context.jobId); reject(context.signal.reason); }, { once: true });
  });
  held.delete(context.jobId);
  return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ name: 'Durable fixture potion', price: 37 }) } }] };
} });
function bound(promise, label) {
  let timer; return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} deadline`)), 300000); })]).finally(() => clearTimeout(timer));
}
function reportDone(id) {
  let off; const promise = new Promise(resolve => { off = service.scheduler.subscribe(event => { if (event.jobId === id && ['ready', 'partial', 'failed'].includes(event.states.report)) resolve(); }); });
  return bound(promise, 'report terminal').finally(() => off());
}
function image(width, height, pixel) { const png = new PNG({ width, height }); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixel(x, y).forEach((value, i) => { png.data[(y * width + x) * 4 + i] = value; }); return PNG.sync.write(png); }
let fixtures = [];
async function seed(base) {
  const repo = service.repository;
  const atlasBytes = image(32, 16, x => x < 16 ? [220, 50, 40, 255] : [40, 90, 220, 255]);
  const artBytes = image(96, 96, (x, y) => x < 8 || y < 8 ? [0, 0, 0, 0] : [200, 40, 180, 255]);
  const atlasRef = await repo.putBlob(atlasBytes, 'image/png'), artRef = await repo.putBlob(artBytes, 'image/png');
  const original = base.maps[base.startMapId];
  base.maps = Object.fromEntries(['map-a', 'map-b', 'map-c', ...Array.from({ length: 18 }, (_, index) => `map-extra-${index}`)].map(id => [id, { ...structuredClone(original), id, name: `불변 지도 ${id}`, width: 4, height: 4, tileSize: 16, tilesetId: 'proof-atlas', lowerTiles: Array(16).fill(0), upperTiles: Array(16).fill(-1), events: [] }]));
  base.startMapId = 'map-a'; base.startX = 1; base.startY = 1;
  base.tilesets = { 'proof-atlas': { id: 'proof-atlas', name: 'Captured atlas', kind: 'custom', image: { type: 'uploaded', id: 'proof-atlas-image' }, tileSize: 16, tilesPerRow: 2, count: 2, passability: [0, 0], priority: ['lower', 'lower'], terrain: [0, 0] } };
  base.assets.uploaded['proof-atlas-image'] = { id: 'proof-atlas-image', name: 'Pinned atlas', kind: 'tileset', dataUrl: `data:image/png;base64,${atlasBytes.toString('base64')}`, meta: { width: 32, height: 16, tileSize: 16 } };
  const baseRef = await repo.putJson(base);
  async function one(family, label, { generated = null, payload = {}, inputPayload = {}, artifacts = [], generation = 'succeeded' } = {}) {
    const input = { version: 1, family, project: { backend: 'local', projectId: `task7-${label}` }, projectSnapshot: baseRef, artwork: [atlasRef, artRef], target: {}, mode: 'review', payload: inputPayload, dependsOn: [] };
    const { job } = await repo.admit({ idempotencyKey: label, input }); const attemptId = randomUUID(), now = Date.now();
    const result = generation === 'succeeded' ? { version: 1, family, jobId: job.id, attemptId, project: input.project, baseSnapshot: baseRef, generatedSnapshot: generated ? await repo.putJson(generated) : null, artifacts, payload } : null;
    const resultRef = result ? await repo.putJson(result) : null;
    const done = reportDone(job.id);
    await service.scheduler.change(draft => {
      draft.attempts.push({ id: attemptId, jobId: job.id, stage: 'generation', status: generation, startedAt: now, finishedAt: now, error: generation === 'succeeded' ? null : 'controlled fixture failure' });
      const current = draft.jobs.find(item => item.id === job.id); current.generation = generation; current.resultRef = resultRef; current.application = generation === 'succeeded' ? 'awaiting-review' : 'not-requested';
    });
    service.scheduler.start(); await done;
    const current = service.scheduler.getJob(job.id), report = await repo.readJson(current.reportRef);
    fixtures.push({ id: job.id, label, family, report }); return { job: current, report };
  }
  const changed = structuredClone(base); for (const map of Object.values(changed.maps)) { map.lowerTiles[0] = 1; map.name += ' 생성'; }
  changed.commonEvents = [{ id: 'fixture-common', name: '분기', trigger: 'none', commands: [{ kind: 'text', body: '긴 이름과 대사 '.repeat(20) }] }];
  await one('assistant', 'maps', { generated: changed, payload: { assistantText: '세 지도와 명령을 검토하세요.' } });
  await one('region', 'region', { generated: changed, payload: { mapId: 'map-a', region: { x: 0, y: 0, width: 2, height: 2 }, review: { diagnostics: [] } } });
  const db = structuredClone(base);
  db.assets.uploaded.art = { id: 'art', name: 'Pinned artwork', kind: 'picture', dataUrl: `data:image/png;base64,${artBytes.toString('base64')}`, meta: { width: 96, height: 96 } };
  db.database.items[0].name = '보존된 물약'; db.database.items[0].iconResourceId = 'art'; db.database.items[0].imageResourceId = 'art';
  const gallery = await one('database', 'artwork', { generated: db, payload: { name: '보존된 물약', record: db.database.items[0], artwork: { raw: artRef, processed: artRef } }, artifacts: [artRef] });
  const commands = [{ kind: 'text', body: '보존된 명령' }, { kind: 'choices', prompt: '선택', options: [{ text: '진행', branch: [{ kind: 'text', body: '진행 결과' }] }], cancelBehavior: 'branch', cancelBranch: [] }];
  const proposalRef = await repo.putJson({ baseCommands: [], finalCommands: commands, review: { excludedRowIds: [] } });
  await one('event-commands', 'commands', { payload: { proposalRef }, artifacts: [proposalRef] });
  await one('tileset', 'tileset', { inputPayload: { operation: 'range-classify', tilesetId: 'proof-atlas', selectedTiles: [1], atlas: atlasRef }, payload: { kind: 'range-classify', tilesetId: 'proof-atlas', mapping: { tiles: [{ tile: 1, label: 'Captured blue tile' }] } }, artifacts: [atlasRef] });
  const nativeRef = await repo.putJson({ kind: 'knowledge-analysis', tilesetId: 'proof-atlas', review: { status: 'ready', tilesetId: 'proof-atlas', fingerprint: 'captured-fixture', summary: 'Captured review', warnings: [], proposals: [{ id: 'native-1', name: '보존된 파란 타일', tileIds: [1], confidence: 0.9, cellLayers: null, template: 'desk', status: 'pending', feedback: '', description: '실제 원본의 파란 타일', evidence: '고정된 타일 이미지', question: '', quickReplies: [], placementRules: '', passage: { up: true, down: true, left: true, right: true } }] }, turns: [] });
  await one('tileset', 'native-tileset', { inputPayload: { operation: 'knowledge-analysis', tilesetId: 'proof-atlas', selectedTiles: [1], atlas: atlasRef }, payload: { proposalRef: nativeRef, tilesetId: 'proof-atlas' }, artifacts: [atlasRef, nativeRef] });
  await one('image', 'image', { payload: { proposal: { resource: { id: 'fixture-image', name: '원본 이미지', artifact: artRef, width: 96, height: 96 }, destination: { kind: 'event-draft', draftId: 'closed-fixture', binding: 'show-picture' } } }, artifacts: [artRef] });
  await one('assistant', 'text', { generated: base, payload: { assistantText: '이미지 없는 실제 보존된 답변. '.repeat(40) } });
  // State-only immutable fixture revisions, through the same repository and manifest.
  for (const label of ['partial', 'missing', 'unsupported', 'failed', 'cancelled', 'interrupted', 'conflict', 'outcome-unknown', 'applied-unsaved', 'save-failed', 'save-unknown', 'draft', 'no-changes', 'long-label', 'extra-1', 'extra-2', 'extra-3', 'extra-4']) {
    const input = { version: 1, family: 'database', project: { backend: 'local', projectId: label === 'long-label' ? '긴프로젝트이름'.repeat(25) : `task7-${label}` }, projectSnapshot: baseRef, artwork: [artRef], target: {}, mode: 'review', payload: { brief: '긴 요청 '.repeat(200) }, dependsOn: [] };
    const { job } = await repo.admit({ idempotencyKey: label, input });
    const generation = ['failed', 'cancelled', 'interrupted'].includes(label) ? label : 'succeeded';
    const application = ['conflict', 'outcome-unknown'].includes(label) ? label : ['applied-unsaved', 'save-failed', 'save-unknown', 'draft', 'no-changes'].includes(label) ? 'applied' : 'awaiting-review';
    const save = label === 'save-failed' ? 'failed' : label === 'save-unknown' ? 'unknown' : 'unsaved';
    const report = structuredClone(gallery.report); report.jobId = job.id; report.project = input.project; report.input = job.inputRef; report.states = { generation, application, save }; report.source = generation === 'succeeded' ? 'result' : 'input';
    report.applied = { ...report.applied, noChanges: label === 'no-changes', scope: label === 'draft' ? 'draft' : null };
    if (['missing', 'unsupported', 'partial'].includes(label)) for (const section of report.sections) for (const preview of section.previews) { preview.status = label === 'partial' ? 'failed' : label; preview.artifact = null; preview.error = `controlled ${label} media boundary`; }
    if (label === 'failed') report.failure = { stage: 'renderer', message: 'controlled renderer failure' };
    const attemptId = randomUUID();
    const result = { ...await repo.readJson(gallery.job.resultRef), jobId: job.id, attemptId, project: input.project };
    const resultRef = generation === 'succeeded' ? await repo.putJson(result) : null;
    report.result = resultRef; report.generationAttemptId = generation === 'succeeded' ? attemptId : null;
    const receiptId = randomUUID(), claimId = randomUUID();
    const applicationEvidence = application === 'applied' ? { claim: { claimId, receiptId, project: input.project, resultSha256: resultRef.sha256 }, receipt: { claimId, receiptId, project: input.project, resultSha256: resultRef.sha256, application, save, evidence: { scope: label === 'draft' ? 'draft' : 'project', noChanges: label === 'no-changes' } } } : null;
    report.applicationEvidence = applicationEvidence;
    report.saveEvidence = application === 'applied' ? { updates: [{ saveAttemptId: 'fixture-initial', save, evidence: { source: 'controlled immutable UI fixture, not remote-save proof' } }] } : null;
    if (application === 'applied') report.applied = { ...report.applied, status: 'unavailable', receiptId, reason: '이 검토 자료에는 실제 반영 후 이미지가 포함되지 않았습니다.' };
    const reportRef = await repo.putJson(report);
    await service.scheduler.change(draft => {
      if (resultRef) draft.attempts.push({ id: attemptId, jobId: job.id, stage: 'generation', status: 'succeeded', startedAt: Date.now(), finishedAt: Date.now(), error: null });
      const current = draft.jobs.find(item => item.id === job.id); current.generation = generation; current.application = application; current.save = save; current.report = ['partial', 'failed'].includes(label) ? label : 'ready'; current.reportRef = reportRef; current.resultRef = resultRef; current.applicationEvidence = applicationEvidence; current.saveEvidence = report.saveEvidence;
    });
    fixtures.push({ id: job.id, label, family: 'database', report });
  }
  return fixtures;
}
async function close() {
  if (closing) return closing;
  closing = (async () => {
    for (const release of held.values()) release();
    try { await service?.close(); await server?.close(); }
    finally { await rm(temporary, { recursive: true, force: true }); await writeFile(join(evidence, 'browser-cleanup.json'), JSON.stringify({ temporary, removed: true, serverClosed: true, providerCalls, externalPaidCalls: 0, errors, activeBrowsers: browsers.size, browserEvents }, null, 2)); }
  })(); return closing;
}
try {
  service = await openAiJobsService({ directory: join(temporary, 'jobs'), origins: [origin], ...runtime, onError });
  server = await createServer({ root, configFile: false, envFile: false, cacheDir: join(temporary, 'cache'), resolve: { alias: { '@': join(root, 'src') } }, server: { host: '127.0.0.1', port: 19841, strictPort: true, fs: { allow: [root, await realpath(join(root, 'node_modules'))] } }, plugins: [{ name: 'task7-real-editor-fixtures', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (req.method === 'POST' && req.url?.startsWith('/api/ai-jobs')) res.once('finish', () => console.log('TASK7_WRITE', req.url, res.statusCode));
      if (req.url?.startsWith('/api/ai-jobs/events')) sseConnections.push({ lastEventId: req.headers['last-event-id'] ?? '', query: new URL(req.url, origin).search });
      if (!req.url?.startsWith('/__task7/')) return next();
      try {
        const chunks = []; for await (const chunk of req) chunks.push(chunk); const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        const path = req.url.slice('/__task7/'.length);
        let value;
        if (path === 'seed') value = await seed(body.project);
        else if (path === 'fixtures') value = fixtures;
        else if (path === 'release') { held.get(body.id)?.(); value = {}; }
        else if (path === 'job-ready') { if (!['ready', 'partial', 'failed'].includes(service.scheduler.getJob(body.id).report)) await reportDone(body.id); value = service.scheduler.getJob(body.id); }
        else if (path === 'provider-reached') { if (!held.has(body.id)) await bound(new Promise(resolve => reached.set(body.id, resolve)), 'provider dispatch'); value = {}; }
        else if (path === 'disconnect-sse') { service.handler.close(); value = {}; }
        else if (path === 'shutdown') { res.once('finish', () => { void close().then(() => process.exit(0), error => { console.error(error); process.exit(1); }); }); value = {}; }
        else if (path === 'counts') value = { providerCalls, jobs: service.repository.snapshot().jobs.length, events: service.repository.snapshot().events.length, sseConnections, errors, activeBrowsers: browsers.size };
        else { res.statusCode = 404; value = {}; }
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value));
      } catch (error) { res.statusCode = 500; res.end(JSON.stringify({ error: String(error) })); }
    });
    vite.middlewares.use(service.handler);
  } }] });
  await server.listen(); console.log('TASK7_EDITOR_READY');
  for (const name of ['SIGINT', 'SIGTERM']) process.once(name, () => { void close().then(() => process.exit(0), error => { console.error(error); process.exit(1); }); });
} catch (error) { console.error(error); await close(); process.exitCode = 1; }
