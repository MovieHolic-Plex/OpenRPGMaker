import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createBrowserRuntime } from '../scripts/lib/aiJobs/browserExecutor.mjs';
import { openAiJobsService } from '../scripts/lib/aiJobs/service.mjs';

const { PNG } = createRequire(import.meta.url)('pngjs');
const root = resolve(import.meta.dirname, '..'), origin = 'http://127.0.0.1:19841';
const evidence = join(root, '.omo/evidence/ai-job-queue/task-6');
const temporary = await mkdtemp(join(tmpdir(), 'ai-job-task6-browser-'));
await mkdir(evidence, { recursive: true });
let server, service, viewerBrowser;
const errors = [], contexts = new Set(), managedBrowsers = new Set(), reports = [], traces = [];
let providerCalls = 0, traceId = 0;
const bound = (promise, label, ms = 90_000) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms); })]).finally(() => clearTimeout(timer));
};
function nextReport(jobId, predicate = () => true) {
  let off;
  const signal = new Promise(resolve => { off = service.scheduler.subscribe(e => {
    if (e.jobId === jobId && ['ready', 'partial', 'failed'].includes(e.states.report) && predicate(e)) resolve(e);
  }); });
  return bound(signal, 'exact report terminal event').finally(() => off());
}
function image(width, height, color) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const rgba = color(x, y), offset = (y * width + x) * 4;
    rgba.forEach((v, i) => { png.data[offset + i] = v; });
  }
  return PNG.sync.write(png);
}
const atlasBytes = image(32, 16, x => x < 16 ? [220, 50, 40, 255] : [40, 90, 220, 255]);
const artBytes = image(24, 24, (x, y) => x < 2 || y < 2 ? [0, 0, 0, 0] : [200, 40, 180, 255]);
const dataUrl = bytes => `data:image/png;base64,${bytes.toString('base64')}`;
const korean = '아주 긴 한국어 대사도 실제 저장된 명령과 같은 내용이어야 하며 노드 바깥으로 넘치지 않습니다. '.repeat(6);

try {
  // Instrument the real managed realm lifecycle without replacing browser rendering.
  const managedChromium = {
    executablePath: () => chromium.executablePath(),
    async launch(options) {
      const browser = await chromium.launch(options); managedBrowsers.add(browser);
      const createContext = browser.newContext.bind(browser), closeBrowser = browser.close.bind(browser);
      browser.close = async () => { try { await closeBrowser(); } finally { managedBrowsers.delete(browser); } };
      browser.newContext = async options => {
        const context = await createContext(options); contexts.add(context);
        const capturedTrace = ++traceId === 1;
        const path = join(evidence, 'browser-worker-trace.zip');
        if (capturedTrace) { await context.tracing.start({ screenshots: true, snapshots: true, sources: true }); traces.push(path); }
        const close = context.close.bind(context); let closing;
        context.close = () => closing ??= (async () => {
          try { if (capturedTrace) await context.tracing.stop({ path }); }
          finally { try { await close(); } finally { contexts.delete(context); } }
        })();
        return context;
      };
      return browser;
    },
  };
  const runtime = await createBrowserRuntime({ origin, cacheDir: join(temporary, 'vite-cache'), chromium: managedChromium,
    dispatchProvider: async () => { providerCalls++; throw new Error('No paid provider authority in report proof'); } });
  assert.equal(typeof runtime.renderReport, 'function');
  service = await openAiJobsService({ directory: join(temporary, 'jobs'), origins: [origin], onError: e => errors.push(String(e)),
    renderReport: (result, host, signal) => {
      assert.equal('providerOperation' in host, false);
      assert.equal('saveCheckpoint' in host, false);
      return runtime.renderReport(result, host, signal);
    }, dispatchProvider: runtime.dispatchProvider });
  server = await createServer({ root, configFile: false, envFile: false, envDir: false, cacheDir: join(temporary, 'vite-cache'),
    resolve: { alias: { '@': join(root, 'src') } }, server: { host: '127.0.0.1', port: 19841, strictPort: true },
    plugins: [{ name: 'task6-isolated-report-proof', configureServer(vite) {
      vite.middlewares.use(service.handler);
      vite.middlewares.use('/task6-proof', (_req, res) => { res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>Immutable AI report artifact proof</title></head><body><main id="proof"></main></body></html>'); });
    } }],
  });
  await server.listen();
  viewerBrowser = await chromium.launch({ headless: true });
  const context = await viewerBrowser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(String(e)));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { errors.push(`Foreign viewer request: ${url.origin}`); return route.abort(); }
    if (url.pathname === '/@vite/client') return route.fulfill({ contentType: 'text/javascript', body: '' });
    const response = await route.fetch({ maxRedirects: 0, maxRetries: 1 });
    await route.fulfill({ response });
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  await page.goto(`${origin}/task6-proof`, { waitUntil: 'domcontentloaded' });
  const base = await page.evaluate(async () => {
    const { createBlankProject } = await import('/src/project/defaults.ts');
    return JSON.parse(JSON.stringify(createBlankProject()));
  });
  const originalMap = base.maps[base.startMapId];
  base.maps = Object.fromEntries(['map-a', 'map-b', 'map-c'].map(id => [id, { ...structuredClone(originalMap),
    id, name: id, width: 4, height: 4, tileSize: 16, tilesetId: 'proof-atlas', lowerTiles: Array(16).fill(0), upperTiles: Array(16).fill(-1), events: [] }]));
  base.startMapId = 'map-a'; base.startX = 1; base.startY = 1;
  base.tilesets = { 'proof-atlas': { id: 'proof-atlas', name: 'Captured red/blue atlas', kind: 'custom', image: { type: 'uploaded', id: 'proof-atlas-image' },
    tileSize: 16, tilesPerRow: 2, count: 2, passability: [0, 0], priority: ['lower', 'lower'], terrain: [0, 0] } };
  base.assets.uploaded['proof-atlas-image'] = { id: 'proof-atlas-image', name: 'Pinned fixture atlas', kind: 'tileset', dataUrl: dataUrl(atlasBytes), meta: { width: 32, height: 16, tileSize: 16 } };
  base.switches.push({ id: 'proof-switch', name: 'Quest completion' });
  const repository = service.repository;
  const atlasRef = await repository.putBlob(atlasBytes, 'image/png'), artRef = await repository.putBlob(artBytes, 'image/png');
  const baseRef = await repository.putJson(base);
  async function seed(family, label, { generated = null, payload = {}, inputPayload = {}, artifacts = [], status = 'succeeded', checkpoint = null } = {}) {
    const input = { version: 1, family, project: { backend: 'local', projectId: 'isolated-task6-proof' }, projectSnapshot: baseRef,
      artwork: [atlasRef, artRef], target: {}, mode: 'review', payload: inputPayload, dependsOn: [] };
    const { job } = await repository.admit({ idempotencyKey: label, input });
    const attemptId = randomUUID(), now = Date.now();
    const result = status === 'succeeded' ? { version: 1, family, jobId: job.id, attemptId, project: input.project, baseSnapshot: baseRef,
      generatedSnapshot: generated ? await repository.putJson(generated) : null, artifacts, payload } : null;
    const resultRef = result ? await repository.putJson(result) : null;
    const checkpointRef = checkpoint ? await repository.putJson({ version: 1, jobId: job.id, attemptId, inputSha256: job.inputRef.sha256,
      stageKey: checkpoint.stageKey, state: checkpoint.state, artifacts: checkpoint.artifacts }) : null;
    await repository.transaction(draft => {
      draft.attempts.push({ id: attemptId, jobId: job.id, stage: 'generation', status, startedAt: now, finishedAt: now, error: status === 'succeeded' ? null : 'controlled downstream failure' });
      const current = draft.jobs.find(j => j.id === job.id);
      current.generation = status; current.resultRef = resultRef; current.checkpointRef = checkpointRef;
      if (result) { current.application = 'awaiting-review'; current.save = 'unsaved'; }
    });
    const done = nextReport(job.id); service.scheduler.start(); await done;
    const report = await repository.readJson(service.scheduler.getJob(job.id).reportRef);
    assert.equal(report.failure, null, JSON.stringify(report.failure));
    assert.equal(report.states.generation, status);
    assert.equal(JSON.stringify(report).includes('data:image/'), false);
    reports.push({ label, jobId: job.id, report });
    return { jobId: job.id, input, result, report };
  }
  const changed = structuredClone(base);
  for (const map of Object.values(changed.maps)) { map.lowerTiles[0] = 1; map.name += ' generated'; }
  changed.commonEvents = [{ id: 'proof-common', name: '실제 이벤트 명령', trigger: 'none', commands: [
    { kind: 'text', body: korean }, { kind: 'fork', condition: { kind: 'switch', switchId: 'proof-switch', value: true }, then: [{ kind: 'text', body: '조건이 맞는 실제 분기' }], else: [] },
  ] }];
  changed.quests = [{ kind: 'graph', id: 'proof-quest', title: 'Captured quest', nodes: [
    { id: 'start', description: korean, completesWhen: { kind: 'switch', switchId: 'proof-switch', value: true } },
    { id: 'end', description: '완료 조건', completesWhen: { kind: 'switch', switchId: 'proof-switch', value: true } },
  ], edges: [{ from: 'start', to: 'end' }] }];
  const assistant = await seed('assistant', 'assistant-map-event-quest', { generated: changed, payload: { text: 'Captured assistant result with three affected maps', completion: 'complete' } });
  assert.equal(assistant.report.sections.filter(s => s.kind === 'map').length, 6);
  const regionProject = structuredClone(base); regionProject.maps['map-a'].lowerTiles[0] = 1; regionProject.maps['map-b'].lowerTiles[0] = 1;
  await seed('region', 'region-aligned', { generated: regionProject, payload: { mapId: 'map-a', region: { x: 0, y: 0, width: 2, height: 2 }, review: { diagnostics: [] } } });
  const db = structuredClone(base);
  for (let i = 0; i < 2; i++) {
    const id = `proof-art-${i}`;
    db.assets.uploaded[id] = { id, name: `Captured gallery artwork ${i}`, kind: 'picture', dataUrl: dataUrl(artBytes), meta: { width: 24, height: 24 } };
    db.database.items[i].name = `Captured item ${i}`; db.database.items[i].iconResourceId = id; db.database.items[i].imageResourceId = id;
  }
  await seed('database', 'database-art-gallery', { generated: db, payload: { name: 'Captured item 0', record: db.database.items[0], artwork: { raw: artRef, processed: artRef } }, artifacts: [artRef] });
  const commands = [{ kind: 'text', body: korean }, { kind: 'choices', prompt: '실제 선택', options: [{ text: '진행', branch: [{ kind: 'text', body: '진행한 결과' }] }], cancelBehavior: 'branch', cancelBranch: [{ kind: 'text', body: '취소한 결과' }] }];
  const proposalRef = await repository.putJson({ baseCommands: [], finalCommands: commands, review: { excludedRowIds: [] } });
  await seed('event-commands', 'event-command-flow', { payload: { proposalRef }, artifacts: [proposalRef] });
  for (const operation of ['cluster-edit', 'range-classify', 'unclassified-analysis', 'knowledge-analysis', 'question-followup', 'proposal-draft', 'structure-kit-metadata']) {
    await seed('tileset', `tileset-${operation}`, { inputPayload: { operation, tilesetId: 'proof-atlas', selectedTiles: [1], atlas: atlasRef },
      payload: { kind: operation, tilesetId: 'proof-atlas', mapping: { tiles: [{ tile: 1, label: 'Captured blue tile' }] } }, artifacts: [atlasRef] });
  }
  await seed('image', 'image-output', { payload: { proposal: { resource: { id: 'proof-image', name: 'Actual image output', artifact: artRef, width: 24, height: 24 },
    destination: { kind: 'event-draft', draftId: 'proof-draft', binding: 'show-picture' } }, model: 'fixture-wire-model' }, artifacts: [artRef] });
  const readOnly = await seed('assistant', 'read-only-answer', { generated: base, payload: { text: 'Actual read-only answer. No gameplay test or save was performed.' } });
  assert.deepEqual(readOnly.report.sections, []); assert.equal(readOnly.report.usage, null);
  for (const status of ['failed', 'cancelled']) await seed('database', `staged-${status}`, { status,
    checkpoint: { stageKey: 'database/artwork', state: { patch: { name: 'Completed text retained' }, failure: { stage: 'postprocess' } }, artifacts: [artRef] } });

  // Apply evidence arrives after the first report. Upload exact canonical bytes via
  // the real receipt API, without touching a user ProjectStore or remote database.
  const session = await fetch(`${origin}/api/ai-jobs/session`), { csrfToken } = await session.json();
  const headers = { Origin: origin, Cookie: session.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json', 'X-AI-Jobs-CSRF': csrfToken };
  const post = async (path, body) => { const response = await fetch(`${origin}/api/ai-jobs/${assistant.jobId}/application/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data; };
  const oldRef = service.scheduler.getJob(assistant.jobId).reportRef, oldBytes = await repository.readBlob(oldRef);
  const appliedProject = structuredClone(changed); appliedProject.maps['map-a'].lowerTiles[0] = 0; appliedProject.maps['map-a'].name = 'Actual synchronous applied snapshot';
  const serialized = await page.evaluate(async project => {
    const { canonicalJson, canonicalProject } = await import('/src/ai/jobs/resultPatch.ts'); return canonicalJson(canonicalProject(project));
  }, appliedProject);
  const appliedHash = createHash('sha256').update(serialized).digest('hex');
  const binding = { claimId: randomUUID(), receiptId: randomUUID(), project: assistant.input.project, resultSha256: service.scheduler.getJob(assistant.jobId).resultRef.sha256 };
  await post('prepare', { ...binding, baselineSha256: baseRef.sha256 });
  const { artifact } = await post('artifact', { ...binding, snapshotSha256: appliedHash, serialized });
  const appliedDone = nextReport(assistant.jobId, e => e.states.application === 'applied');
  await post('evidence', { ...binding, application: 'applied', save: 'unsaved', evidence: { appliedSnapshotSha256: appliedHash,
    appliedArtifact: artifact, hashScheme: 'project-canonical-json-no-event-drafts-v1', scope: 'project', noChanges: false }, saveEvidence: null });
  await appliedDone;
  const refreshed = await repository.readJson(service.scheduler.getJob(assistant.jobId).reportRef);
  assert.equal(refreshed.applied.artifact.sha256, appliedHash); assert.equal(refreshed.states.save, 'unsaved');
  assert.deepEqual(await repository.readBlob(oldRef), oldBytes);
  reports.push({ label: 'receipt-bound-applied-after', jobId: assistant.jobId, report: refreshed });
  async function pixel(preview, x, y) {
    const png = PNG.sync.read(Buffer.from(await repository.readBlob(preview.artifact)));
    assert.equal(png.width, preview.width); assert.equal(png.height, preview.height);
    return [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4)];
  }
  const mapPreview = (phase, report = refreshed) => report.sections.find(s => s.kind === 'map' && s.objectId === 'map-a' && s.phase === phase).previews[0];
  assert.deepEqual(await pixel(mapPreview('before'), 8, 8), [220, 50, 40, 255]);
  assert.deepEqual(await pixel(mapPreview('generated'), 8, 8), [40, 90, 220, 255]);
  assert.deepEqual(await pixel(mapPreview('applied'), 8, 8), [220, 50, 40, 255]);
  const tile = reports.find(r => r.label === 'tileset-range-classify').report.sections[0].previews.find(p => p.id === 'tile/1');
  assert.deepEqual(await pixel(tile, 8, 8), [40, 90, 220, 255]);
  const dbReport = reports.find(r => r.label === 'database-art-gallery').report;
  const dbArt = dbReport.sections.find(s => s.kind === 'artwork').previews[0];
  assert.equal(dbArt.artifact.sha256, artRef.sha256);
  assert.deepEqual(await pixel(dbArt, 8, 8), [200, 40, 180, 255]);
  assert.deepEqual(await pixel(dbArt, 0, 0), [0, 0, 0, 0]);
  for (const { report } of reports) for (const section of report.sections) for (const preview of section.previews) assert.equal(preview.status, 'ready', JSON.stringify(preview));

  const displayLabels = new Set(['receipt-bound-applied-after', 'database-art-gallery', 'event-command-flow', 'tileset-range-classify', 'image-output', 'read-only-answer', 'staged-failed']);
  const display = reports.filter(r => displayLabels.has(r.label));
  const assets = {};
  for (const { report } of display) for (const section of report.sections) for (const preview of section.previews) {
    if (!assets[preview.artifact.sha256]) assets[preview.artifact.sha256] = { mediaType: preview.artifact.mediaType,
      base64: Buffer.from(await repository.readBlob(preview.artifact)).toString('base64') };
  }
  const geometry = await page.evaluate(async ({ display, assets }) => {
    const style = document.createElement('style'); style.textContent = 'body{margin:0;background:#f8f9fc;color:#182230;font:15px system-ui}main{padding:28px}h1{margin:0 0 12px}article{background:white;border:1px solid #d9deea;border-radius:10px;padding:18px;margin:18px 0}.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{min-width:0;background:#f4f6fb;padding:12px;border-radius:6px}.card img{max-width:100%;height:auto;image-rendering:pixelated}.phase{color:#4338ca;font-weight:700}pre{white-space:pre-wrap;overflow-wrap:anywhere}svg{max-width:100%;height:auto}'; document.head.append(style);
    const main = document.querySelector('#proof'); main.innerHTML = '<h1>Immutable report artifacts - actual managed Chromium output</h1><p>Generated / applied / saved are independent. Schematics are not gameplay QA.</p>';
    const loads = [], bounds = [];
    for (const entry of display) {
      const article = document.createElement('article'), h = document.createElement('h2'); h.textContent = entry.label; article.append(h);
      const status = document.createElement('p'); status.dataset.states = 'true'; status.textContent = `${entry.report.source} | generation: ${entry.report.states.generation} | application: ${entry.report.states.application} | save: ${entry.report.states.save} | usage: ${entry.report.usage === null ? 'unknown' : 'captured'}`; article.append(status);
      const gallery = document.createElement('div'); gallery.className = 'gallery'; article.append(gallery);
      for (const section of entry.report.sections) {
        if (entry.label === 'receipt-bound-applied-after' && !(section.kind === 'map' && section.objectId === 'map-a')) continue;
        const card = document.createElement('div'); card.className = 'card'; card.dataset.phase = section.phase;
        const title = document.createElement('h3'); title.textContent = section.title; card.append(title);
        const phase = document.createElement('p'); phase.className = 'phase'; phase.textContent = section.phase; card.append(phase);
        for (const preview of section.previews) {
          const asset = assets[preview.artifact.sha256];
          if (asset.mediaType === 'image/svg+xml') {
            const svg = new DOMParser().parseFromString(new TextDecoder().decode(Uint8Array.from(atob(asset.base64), c => c.charCodeAt(0))), 'image/svg+xml').documentElement;
            card.append(document.importNode(svg, true));
          } else {
            const image = new Image(); image.alt = `${section.phase}: ${section.title} / ${preview.id}`;
            loads.push(new Promise((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error(image.alt)); }));
            image.src = `data:${asset.mediaType};base64,${asset.base64}`; image.dataset.sha256 = preview.artifact.sha256; card.append(image);
          }
        }
        gallery.append(card);
      }
      if (!entry.report.sections.length) { const text = document.createElement('pre'); text.textContent = entry.report.output.text; article.append(text); }
      main.append(article);
    }
    await Promise.all(loads); await document.fonts.ready;
    for (const svg of document.querySelectorAll('svg svg')) for (const text of svg.querySelectorAll('text')) {
      const box = text.getBBox(), width = Number(svg.getAttribute('width'));
      bounds.push({ text: text.textContent, right: box.x + box.width, width });
      if (box.x + box.width > width) throw new Error(`SVG label overflow: ${text.textContent}`);
    }
    return { images: [...document.images].map(i => ({ sha256: i.dataset.sha256, width: i.naturalWidth, height: i.naturalHeight, alt: i.alt })), bounds,
      states: [...document.querySelectorAll('[data-states]')].map(e => e.textContent), scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth };
  }, { display, assets });
  assert.ok(geometry.bounds.some(b => b.text.includes('...')), 'Long Korean labels visibly truncate; full text remains in source/section');
  assert.ok(geometry.states.some(s => s.includes('application: applied') && s.includes('save: unsaved')));
  assert.ok(geometry.states.some(s => s.includes('checkpoint') && s.includes('generation: failed')));
  assert.equal(geometry.scrollWidth, geometry.viewport);
  await page.screenshot({ path: join(evidence, 'browser-report-artifacts.png'), fullPage: true });
  await context.tracing.stop({ path: join(evidence, 'browser-viewer-trace.zip') });
  const [inboxA, inboxB] = await Promise.all([fetch(`${origin}/api/ai-jobs/inbox`).then(r => r.json()), fetch(`${origin}/api/ai-jobs/inbox`).then(r => r.json())]);
  assert.deepEqual(inboxA, inboxB);
  assert.equal(inboxA.inbox.filter(i => i.jobId === assistant.jobId).length, 2, 'One generation outcome plus one applied outcome; no preview notifications');
  assert.equal(providerCalls, 0); assert.deepEqual(errors, []);
  assert.equal(contexts.size, 0); assert.equal(managedBrowsers.size, 0);
  await writeFile(join(evidence, 'browser-evidence.json'), JSON.stringify({ origin, providerCalls, reportCount: reports.length, managedRealms: traceId,
    labels: reports.map(r => r.label), pixelAssertions: { before: [220, 50, 40, 255], generated: [40, 90, 220, 255], applied: [220, 50, 40, 255],
      tilesetCrop: [40, 90, 220, 255], dbArtwork: [200, 40, 180, 255], transparent: [0, 0, 0, 0] }, geometry,
    reports: reports.map(r => ({ label: r.label, jobId: r.jobId, sections: r.report.sections.length, states: r.report.states, applied: r.report.applied })), errors }, null, 2));
  console.log(JSON.stringify({ reportCount: reports.length, managedRealms: traceId, providerCalls, errors, pixelAssertions: 'passed', koreanLabels: 'bounded', screenshot: 'browser-report-artifacts.png' }));
} finally {
  const cleanupErrors = [];
  for (const close of [() => viewerBrowser?.close(), () => service?.close(), () => server?.close(),
    ...[...contexts].map(context => () => context.close()), ...[...managedBrowsers].map(browser => () => browser.close()),
    () => rm(temporary, { recursive: true, force: true })]) {
    try { await close(); } catch (error) { cleanupErrors.push(String(error)); }
  }
  await writeFile(join(evidence, 'browser-cleanup.json'), JSON.stringify({ temporary, temporaryRemoved: cleanupErrors.length === 0, managedContextsRemaining: contexts.size,
    managedBrowsersRemaining: managedBrowsers.size, cleanupErrors }, null, 2));
  if (cleanupErrors.length) throw new Error(`Browser proof cleanup failed: ${cleanupErrors.join('; ')}`);
}
