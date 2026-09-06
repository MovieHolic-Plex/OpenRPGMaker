import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createBrowserRuntime } from '../scripts/lib/aiJobs/browserExecutor.mjs';
import { openAiJobsService } from '../scripts/lib/aiJobs/service.mjs';

const { PNG } = createRequire(import.meta.url)('pngjs');
const root = resolve(import.meta.dirname, '..');
const evidence = join(root, '.omo/evidence/ai-job-queue/report-bootstrap');
const runLabel = process.argv[2] ?? 'green';
assert.match(runLabel, /^[a-z-]+$/);
const buildRoot = process.argv[3] ? resolve(process.argv[3]) : null;
const manifest = buildRoot ? JSON.parse(await readFile(join(buildRoot, '.vite/manifest.json'), 'utf8')) : null;
const modulePath = source => `/${manifest ? manifest[source].file : source}`;
const builtGeneration = new Set(Object.entries(manifest ?? {}).filter(([source]) =>
  /src\/ai\/jobs\/executors\/|^_(?:assistantSession(?:Core)?|sessionHost)-/.test(source)).map(([, entry]) => `/${entry.file}`));
const builtFiles = new Set(Object.values(manifest ?? {}).map(entry => `/${entry.file}`));
await mkdir(evidence, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), 'ai-report-bootstrap-'));
const origin = 'http://127.0.0.1:19842';
const errors = [], realms = [], contexts = new Set(), browsers = new Set();
let server, service, viewer, activeStage = 'report', reportProviderCalls = 0, generationProviderCalls = 0;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const generationModules = urls => urls.filter(url => builtGeneration.has(new URL(url).pathname)
  || /\/src\/ai\/(?:jobs\/executors\/|assistantSession(?:Core)?\.ts|jobs\/sessionHost\.ts)/.test(url));
function graph(urls) {
  const unique = [...new Set(urls)].sort();
  const categories = {};
  for (const url of unique) {
    const path = new URL(url).pathname;
    const category = path.startsWith('/src/') ? path.split('/').slice(1, 3).join('/')
      : path.startsWith('/@fs/') ? 'optimizer/dependencies' : path.split('/')[1];
    categories[category] = (categories[category] ?? 0) + 1;
  }
  return { count: unique.length, categories, generationModules: generationModules(unique), urls: unique };
}
function bound(promise, label, ms = 120_000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  })]).finally(() => clearTimeout(timer));
}
const atlas = new PNG({ width: 32, height: 16 });
for (let y = 0; y < atlas.height; y++) for (let x = 0; x < atlas.width; x++) {
  atlas.data.set(x < 16 ? [220, 50, 40, 255] : [40, 90, 220, 255], (y * atlas.width + x) * 4);
}
const atlasBytes = PNG.sync.write(atlas);
const proof = { origin, temporary, buildRoot, builtGeneration: [...builtGeneration], realms, errors };
try {
  // Observe the actual production managed runtime, including its readiness binding.
  // No module response, renderer, executor, or host-capability check is replaced.
  const managedChromium = {
    executablePath: () => chromium.executablePath(),
    async launch(options) {
      const browser = await chromium.launch(options); browsers.add(browser);
      const newContext = browser.newContext.bind(browser), closeBrowser = browser.close.bind(browser);
      browser.close = async () => { try { await closeBrowser(); } finally { browsers.delete(browser); } };
      browser.newContext = async options => {
        const context = await newContext(options); contexts.add(context);
        const realm = { stage: activeStage, requests: [], loaded: [], ready: null, hostMethods: [] }; realms.push(realm);
        context.on('request', request => realm.requests.push(request.url()));
        context.on('response', response => {
          if (response.request().resourceType() === 'script' && response.ok()) realm.loaded.push(response.url());
          if (!response.ok()) errors.push(`HTTP ${response.status()}: ${response.url()}`);
        });
        context.on('page', page => {
          page.on('pageerror', error => errors.push(String(error)));
          const expose = page.exposeBinding.bind(page);
          page.exposeBinding = (name, callback, options) => expose(name, (source, ...args) => {
            if (name === '__aiJobReady') realm.ready = graph(realm.loaded);
            if (name === '__aiJobHost') realm.hostMethods.push(args[0]);
            return callback(source, ...args);
          }, options);
        });
        const close = context.close.bind(context); let closing;
        context.close = () => closing ??= (async () => {
          realm.complete = graph(realm.loaded);
          try { await close(); } finally { contexts.delete(context); }
        })();
        return context;
      };
      return browser;
    },
  };
  const runtime = await createBrowserRuntime({ origin, cacheDir: join(temporary, 'vite-cache'), chromium: managedChromium,
    dispatchProvider: async () => { reportProviderCalls++; throw new Error('Report must not dispatch a provider'); } });
  assert.equal(typeof runtime.renderReport, 'function');
  service = await openAiJobsService({ directory: join(temporary, 'jobs'), origins: [origin], onError: error => errors.push(String(error)),
    renderReport: (result, host, signal) => {
      assert.equal('providerOperation' in host, false);
      assert.equal('saveCheckpoint' in host, false);
      return runtime.renderReport(result, host, signal);
    }, dispatchProvider: runtime.dispatchProvider });
  server = await createServer({ root, configFile: false, envFile: false, envDir: false, cacheDir: join(temporary, 'vite-cache'),
    resolve: { alias: { '@': join(root, 'src') } }, server: { host: '127.0.0.1', port: 19842, strictPort: true, watch: null, hmr: false },
    plugins: [{ name: 'report-bootstrap-proof', configureServer(vite) {
      vite.middlewares.use(service.handler);
      if (buildRoot) vite.middlewares.use((request, response, next) => {
        const path = new URL(request.url, origin).pathname;
        if (path !== '/ai-job-worker.html' && !path.startsWith('/assets/')) return next();
        if (path !== '/ai-job-worker.html' && !builtFiles.has(path)) {
          response.statusCode = 404; response.end(); return;
        }
        readFile(join(buildRoot, path.slice(1))).then(bytes => {
          response.setHeader('Content-Type', path.endsWith('.html') ? 'text/html' : 'text/javascript');
          response.end(bytes);
        }).catch(next);
      });
      vite.middlewares.use('/bootstrap-proof', (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><title>Report bootstrap artifact proof</title><main></main>');
      });
    } }],
  });
  await server.listen();
  viewer = await chromium.launch({ headless: true });
  const context = await viewer.newContext({ serviceWorkers: 'block', viewport: { width: 900, height: 500 } });
  // Same static-GET Node transport workaround as Task 6; no remote network access.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    assert.equal(url.origin, origin);
    assert.equal(route.request().method(), 'GET');
    if (url.pathname === '/@vite/client') return route.fulfill({ contentType: 'text/javascript', body: '' });
    await route.fulfill({ response: await route.fetch({ maxRedirects: 0, maxRetries: 1 }) });
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/bootstrap-proof`, { waitUntil: 'domcontentloaded' });
  const base = await page.evaluate(async () => {
    const { createBlankProject } = await import('/src/project/defaults.ts');
    return JSON.parse(JSON.stringify(createBlankProject()));
  });
  const mapId = base.startMapId;
  base.maps = { [mapId]: { ...base.maps[mapId], width: 4, height: 4, tileSize: 16, tilesetId: 'proof-atlas',
    lowerTiles: Array(16).fill(0), upperTiles: Array(16).fill(-1), events: [] } };
  base.startX = 1; base.startY = 1;
  base.tilesets = { 'proof-atlas': { id: 'proof-atlas', name: 'Captured atlas', kind: 'custom', image: { type: 'uploaded', id: 'proof-atlas-image' },
    tileSize: 16, tilesPerRow: 2, count: 2, passability: [0, 0], priority: ['lower', 'lower'], terrain: [0, 0] } };
  base.assets.uploaded['proof-atlas-image'] = { id: 'proof-atlas-image', name: 'Captured atlas', kind: 'tileset',
    dataUrl: `data:image/png;base64,${atlasBytes.toString('base64')}`, meta: { width: 32, height: 16, tileSize: 16 } };
  const repository = service.repository;
  const baseRef = await repository.putJson(base), atlasRef = await repository.putBlob(atlasBytes, 'image/png');
  const generated = structuredClone(base); generated.maps[mapId].lowerTiles[0] = 1;
  const input = { version: 1, family: 'assistant', project: { backend: 'local', projectId: 'isolated-bootstrap-proof' },
    projectSnapshot: baseRef, artwork: [atlasRef], target: {}, mode: 'review', payload: {}, dependsOn: [] };
  const { job } = await repository.admit({ idempotencyKey: 'bootstrap-report', input });
  const attemptId = randomUUID(), now = Date.now();
  const result = { version: 1, family: input.family, jobId: job.id, attemptId, project: input.project, baseSnapshot: baseRef,
    generatedSnapshot: await repository.putJson(generated), artifacts: [], payload: { assistantText: 'Captured result', completion: 'complete' } };
  const resultRef = await repository.putJson(result);
  await repository.transaction(draft => {
    draft.attempts.push({ id: attemptId, jobId: job.id, stage: 'generation', status: 'succeeded', startedAt: now, finishedAt: now, error: null });
    Object.assign(draft.jobs.find(item => item.id === job.id), { generation: 'succeeded', resultRef, application: 'awaiting-review', save: 'unsaved' });
  });
  let unsubscribe;
  const terminal = new Promise(resolve => { unsubscribe = service.scheduler.subscribe(event => {
    if (event.jobId === job.id && ['ready', 'partial', 'failed'].includes(event.states.report)) resolve(event);
  }); });
  try { service.scheduler.start(); await bound(terminal, 'report terminal event'); } finally { unsubscribe(); }
  const completed = service.scheduler.getJob(job.id);
  assert.equal(completed.report, 'ready', JSON.stringify(completed));
  const reportBytes = await repository.readBlob(completed.reportRef), report = JSON.parse(Buffer.from(reportBytes));
  assert.equal(hash(reportBytes), completed.reportRef.sha256);
  assert.deepEqual(report.states, { generation: 'succeeded', application: 'awaiting-review', save: 'unsaved' });
  assert.equal(report.applied.status, 'not-applied');
  const previews = [];
  for (const [phase, expected] of [['before', [220, 50, 40, 255]], ['generated', [40, 90, 220, 255]]]) {
    const section = report.sections.find(section => section.kind === 'map' && section.objectId === mapId && section.phase === phase);
    assert.ok(section);
    const preview = section.previews[0]; assert.equal(preview.status, 'ready');
    const bytes = Buffer.from(await repository.readBlob(preview.artifact)), png = PNG.sync.read(bytes);
    assert.equal(hash(bytes), preview.artifact.sha256);
    assert.equal(png.width, preview.width); assert.equal(png.height, preview.height);
    const pixel = [...png.data.subarray((8 * png.width + 8) * 4, (8 * png.width + 8) * 4 + 4)];
    assert.deepEqual(pixel, expected);
    previews.push({ phase, artifact: preview.artifact, width: png.width, height: png.height, pixel, base64: bytes.toString('base64') });
  }
  await page.evaluate(async ({ previews, states }) => {
    document.body.style.cssText = 'font:18px system-ui;padding:24px;background:#f8f9fc;color:#182230';
    const main = document.querySelector('main');
    const heading = document.createElement('h1'); heading.textContent = 'Actual immutable report previews'; main.append(heading);
    const status = document.createElement('p'); status.textContent = JSON.stringify(states); main.append(status);
    await Promise.all(previews.map(async preview => {
      const figure = document.createElement('figure'); figure.style.cssText = 'display:inline-block;margin:16px';
      const label = document.createElement('figcaption'); label.textContent = preview.phase; figure.append(label);
      const image = new Image(); image.style.cssText = 'width:192px;image-rendering:pixelated';
      const loaded = new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      image.src = `data:image/png;base64,${preview.base64}`; figure.append(image); main.append(figure); await loaded;
      if (image.naturalWidth !== preview.width || image.naturalHeight !== preview.height) throw new Error('Preview decode mismatch');
    }));
  }, { previews, states: report.states });
  await page.screenshot({ path: join(evidence, `${runLabel}-previews.png`) });
  Object.assign(proof, { reportRef: completed.reportRef, states: report.states, previews: previews.map(({ base64, ...preview }) => preview), reportProviderCalls });
  assert.equal(reportProviderCalls, 0); assert.deepEqual(errors, []);
  const reportRealm = realms[0]; assert.equal(realms.length, 1); assert.ok(reportRealm.ready);
  // Write RED evidence before the discriminating assertion. Successful report/pixels
  // above distinguish an eager-loading regression from syntax/import/bootstrap failure.
  await writeFile(join(evidence, `${runLabel}-browser.json`), JSON.stringify(proof, null, 2));
  assert.deepEqual(generationModules(reportRealm.requests), [], 'Report-only request graph must exclude generation executors and assistant session');
  assert.deepEqual(reportRealm.ready.generationModules, []);
  assert.ok(reportRealm.complete.urls.some(url => new URL(url).pathname === modulePath('src/ai/jobs/renderJobReport.ts')));
  if (buildRoot) assert.ok(reportRealm.requests.every(url => !new URL(url).pathname.startsWith('/src/')), 'Built worker must not fall back to source modules');
  assert.ok(reportRealm.hostMethods.every(method => ['readBlob', 'readJson', 'putBlob', 'putJson', 'saveReport'].includes(method)));

  // A fresh real managed generation realm must still import and execute its branch.
  activeStage = 'generation';
  let checkpoint = null;
  const generationInput = { ...input, family: 'database', payload: { kind: 'item', brief: 'Create a potion', withArtwork: false,
    config: { authMode: 'chatgpt', providerId: 'google-antigravity', model: 'gemini-3.7-flash', maxToolCalls: 8, maxTokens: 4096 } } };
  const generationHost = { jobId: 'bootstrap-generation', attemptId: 'bootstrap-generation-attempt', dependencies: [],
    readJson: ref => repository.readJson(ref), putJson: value => repository.putJson(value),
    readBlob: ref => repository.readBlob(ref), putBlob: (bytes, type) => repository.putBlob(bytes, type),
    loadCheckpoint: async () => checkpoint,
    saveCheckpoint: async value => {
      checkpoint = { version: 1, jobId: generationHost.jobId, attemptId: generationHost.attemptId, inputSha256: (await repository.putJson(generationInput)).sha256, ...value };
      return repository.putJson(checkpoint);
    },
    providerOperation: async operation => {
      generationProviderCalls++; assert.equal(operation.key, 'database/text');
      return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ name: 'Bootstrap Potion', price: 37 }) } }] };
    },
  };
  const generatedResult = await bound(runtime.executeJob(generationInput, generationHost, new AbortController().signal), 'real generation result');
  assert.equal(generatedResult.family, 'database'); assert.ok(generatedResult.generatedSnapshot);
  const privateProject = await repository.readJson(generatedResult.generatedSnapshot);
  assert.equal(privateProject.database.items.find(item => item.name === 'Bootstrap Potion')?.price, 37);
  assert.equal((await repository.readJson(baseRef)).database.items.some(item => item.name === 'Bootstrap Potion'), false);
  assert.equal(generatedResult.payload.persistence, 'not-applicable'); assert.equal(generationProviderCalls, 1);
  assert.ok(realms[1].complete.urls.some(url => new URL(url).pathname === modulePath('src/ai/jobs/executors/databaseJob.ts')));
  assert.deepEqual(realms[1].ready.generationModules, []);
  assert.deepEqual(errors, []); assert.equal(contexts.size, 0); assert.equal(browsers.size, 0);
  Object.assign(proof, { generationProviderCalls, generationResult: generatedResult });
  await writeFile(join(evidence, `${runLabel}-browser.json`), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ reportReady: reportRealm.ready.count, reportComplete: reportRealm.complete.count,
    reportGenerationModules: reportRealm.complete.generationModules, previews: proof.previews, generationProviderCalls, reportProviderCalls, errors }));
} finally {
  const cleanupErrors = []; let temporaryRemoved = false;
  for (const close of [() => viewer?.close(), () => service?.close(), () => server?.close(),
    ...[...contexts].map(context => () => context.close()), ...[...browsers].map(browser => () => browser.close()),
    async () => { await rm(temporary, { recursive: true, force: true }); temporaryRemoved = true; }]) {
    try { await close(); } catch (error) { cleanupErrors.push(String(error)); }
  }
  // Remove only this invocation's mkdtemp root, never a shared cache or supplied build.
  await writeFile(join(evidence, `${runLabel}-cleanup.json`), JSON.stringify({ temporary, temporaryRemoved,
    managedContextsRemaining: contexts.size, managedBrowsersRemaining: browsers.size, cleanupErrors }, null, 2));
  assert.deepEqual(cleanupErrors, []);
}
