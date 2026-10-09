import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, openSync, closeSync, unlinkSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { firefox } from 'playwright';
import { stored, writeRuntimeProject, newEditor } from './editorDriver.mjs';
import { withTsModule } from '../../../../scripts/ontology-ts-loader.mjs';
import { startPackagedPlayerQaServer } from '../../../../scripts/lib/packagedPlayerQaServer.mjs';
import { readOAuthClientsFromPiAi } from '../../../../scripts/lib/oauthClients.mjs';

const sleep = ms => new Promise(done => setTimeout(done, ms));
const json = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2));
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';

async function acquireSlot(root, caseId, attempt, cases) {
  for (;;) {
    // Give queued first submissions a slot before another case's repair.
    const pendingFirst = attempt > 1 && cases.some(entry => {
      const first = resolve(root, entry.id, 'attempt-1');
      return existsSync(first) && !existsSync(resolve(first, 'host.json')) && !existsSync(resolve(first, 'result.json'));
    });
    if (pendingFirst) { await sleep(10000); continue; }
    for (let slot = 0; slot < 3; slot++) {
      const file = resolve(root, `editor-slot-${slot}.lock`);
      try {
        const fd = openSync(file, 'wx');
        writeFileSync(fd, JSON.stringify({ caseId, pid: process.pid, acquiredAt: new Date().toISOString() }));
        closeSync(fd);
        return () => {
          if (existsSync(file) && JSON.parse(readFileSync(file, 'utf8')).pid === process.pid) unlinkSync(file);
        };
      } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    await sleep(10000);
  }
}

async function startCaseHost(root, entry, out) {
  const caseDir = resolve(root, entry.id), projectDir = resolve(caseDir, 'project');
  // The temporary bundled serve runtime resolves dependencies from /tmp. Read
  // installed OAuth client metadata here, where the real module path is known.
  const clients = readOAuthClientsFromPiAi();
  const oauthEnv = Object.fromEntries([
    ['OPRN_ANTIGRAVITY_CLIENT_ID', clients.antigravityClientId],
    ['OPRN_ANTIGRAVITY_CLIENT_SECRET', clients.antigravityClientSecret],
    ['OPRN_CODEX_CLIENT_ID', clients.codexClientId],
  ].filter(([, value]) => value));
  const child = spawn(process.execPath, ['scripts/oprn-serve.mjs', '--project-dir', projectDir,
    '--host', '127.0.0.1', '--port', String(entry.port)], {
    cwd: process.cwd(), env: { ...oauthEnv, ...process.env, OPRN_HOST_OWNER_AI: '1',
      OPRN_SHARED_CONTENT_SQLITE: resolve(caseDir, 'shared-content.sqlite') },
    stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  });
  let started = false;
  await new Promise((done, fail) => {
    const deadline = setTimeout(() => fail(Error('Owned host startup deadline')), 60000);
    child.stdout.on('data', data => {
      if (!started && data.toString().includes('OPRN 로컬 편집기:')) { started = true; clearTimeout(deadline); done(); }
    });
    child.stderr.on('data', () => {});
    child.once('error', error => { clearTimeout(deadline); fail(error); });
    child.once('exit', code => { if (!started) { clearTimeout(deadline); fail(Error(`Owned host exited ${code}`)); } });
  }).catch(error => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} throw error; });
  const url = `http://127.0.0.1:${entry.port}`;
  json(resolve(out, 'host.json'), { url, pid: child.pid, projectDir, privateLoopback: true });
  return { url, projectDir, async close() {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    if (child.exitCode === null) await Promise.race([new Promise(done => child.once('exit', done)), sleep(10000)]);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    json(resolve(out, 'host.json'), { url, pid: child.pid, projectDir, closed: true, exitCode: child.exitCode });
  } };
}

export async function saveEditor(page) {
  await page.getByTestId('toolbar-save').click();
  await page.waitForFunction(() => ['idle', 'saved', 'error', 'unsaved-session'].includes(
    document.querySelector('[data-testid="toolbar-save"]')?.dataset.autosaveKind), null, { timeout: 120000 });
  const kind = await page.getByTestId('toolbar-save').getAttribute('data-autosave-kind');
  if (!['idle', 'saved'].includes(kind)) throw Error(`Editor save returned ${kind}`);
  return { kind };
}

export async function runGenreTrial(rootArg, caseId, options = {}) {
  console.log('[genre harness] Preserve original failures. Do not stop a busy native authoring turn before its declared deadline without a recorded provider/host failure. Idle classifier failures are separate from authoring capability.');
  const root = resolve(rootArg), manifest = JSON.parse(readFileSync(resolve(root, 'experiment.json'), 'utf8'));
  const entry = manifest.cases.find(item => item.id === caseId);
  if (!entry) throw Error('Unknown genre case');
  const attempt = options.attempt ?? 1;
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) throw Error('One original trial and at most two repairs');
  if (attempt > 1 && !options.prompt) throw Error('Explicit observed-defect repair prompt required');
  const caseDir = resolve(root, caseId), out = resolve(caseDir, `attempt-${attempt}`);
  if (existsSync(out)) throw Error('Original trial evidence must not be overwritten');
  mkdirSync(out, { recursive: true });
  symlinkSync(resolve(caseDir, 'project'), resolve(out, 'project'));
  const task = options.prompt ?? entry.prompt;
  writeFileSync(resolve(out, 'task.txt'), task);
  const releaseSlot = await acquireSlot(root, caseId, attempt, manifest.cases);
  const claim = resolve(caseDir, 'run.lock');
  try {
    const claimFd = openSync(claim, 'wx');
    writeFileSync(claimFd, JSON.stringify({ caseId, attempt, pid: process.pid })); closeSync(claimFd);
  } catch (error) { releaseSlot(); throw error; }
  let host, browser, context, page, timer, phase = 'startup';
  const requests = [], errors = [], startedAt = Date.now();
  const progress = data => json(resolve(out, 'progress.json'), { caseId, attempt, phase, elapsedMs: Date.now() - startedAt, ...data });
  const result = { caseId, attempt, task, inputMode: options.inputMode ?? 'natural', errors, requests,
    firstTrial: attempt === 1, directContentRepairByOperator: false };
  try {
    host = await startCaseHost(root, entry, out);
    browser = await firefox.launch({ firefoxUserPrefs: { 'network.notify.changed': false,
      'network.notify.IPv6': false, 'network.captive-portal-service.enabled': false, 'network.connectivity-service.enabled': false } });
    const setup = async activePage => {
      page = activePage;
      page.on('pageerror', error => errors.push(error.message));
      // This is the editor-input experiment; the concept feed is not part of the task.
      await page.addInitScript(() => localStorage.setItem('oprn:editor-welcome-dismissed', '1'));
      page.on('request', request => {
        if (request.method() !== 'POST' || !/\/v1\/(agent\/run|chat\/completions)/.test(request.url())) return;
        try {
          const raw = request.postDataBuffer();
          const body = JSON.parse(raw?.[0] === 31 ? gunzipSync(raw) : raw);
          const url = new URL(request.url());
          requests.push({ endpoint: url.pathname, model: body.model,
            provider: body.provider ?? url.searchParams.get('provider') ?? request.headers()['x-oprn-provider'], mode: body.mode, runId: body.runId,
            at: new Date().toISOString(), taskPrefix: String(body.task ?? '').slice(0, 100) });
        } catch { requests.push({ endpoint: new URL(request.url()).pathname, observationError: true }); }
        json(resolve(out, 'requests.json'), requests);
      });
    };
    let editor = await newEditor(browser, host.url, host.projectDir, {}, { onPage: setup });
    context = editor.context; page = editor.page;
    phase = 'baseline'; await saveEditor(page);
    const before = stored(host.projectDir);
    json(resolve(out, 'before.json'), before.project);
    json(resolve(out, 'baseline.json'), { projectId: before.projectId, revision: before.revision, sha256: before.sha256 });
    await page.screenshot({ path: resolve(out, 'before.png') });
    await page.getByTestId('ai-composer-settings').click();
    await page.getByTestId('ai-composer-autonomy').selectOption('balanced');
    await page.getByTestId('ai-composer-settings').click();
    phase = 'native-input';
    json(resolve(out, 'input-readiness.json'), await page.evaluate(() => ({
      status: window.__oprnAiBridge?.status(),
      loginOverlayVisible: Boolean(document.querySelector('[data-testid="ai-lock-scrim"]:not([hidden])')),
    })));
    const submitted = options.inputMode === 'pi-command' ? '/pi ' + task : task;
    await page.getByTestId('ai-input').fill(submitted);
    await page.getByTestId('ai-send').click();
    phase = 'internal-ai'; progress({ submitted: true });
    timer = setInterval(() => {
      void page.evaluate(() => ({ events: window.__capEvents ?? [], status: window.__oprnAiBridge?.status() }))
        .then(value => { json(resolve(out, 'trace-checkpoint.json'), { ...value, requests, errors });
          progress({ events: value.events.length, nativeRequests: requests.length, status: value.status }); }).catch(() => {});
    }, 15000);
    try {
      await page.waitForFunction(() => {
        const events = window.__capEvents ?? [];
        return events.some(event => ['stream_closed', 'error'].includes(event.type)) && !window.__oprnAiBridge?.status().turnBusy;
      }, null, { timeout: options.timeoutMs ?? manifest.turnDeadlineMs, polling: 1000 });
      result.turnSettled = true;
    } catch (error) {
      result.turnSettled = false; result.turnFailure = error.message.slice(0, 500);
      await page.evaluate(() => window.__oprnAiBridge?.abort()).catch(() => {});
      await page.waitForFunction(() => !window.__oprnAiBridge?.status().turnBusy, null, { timeout: 30000 }).catch(() => {});
    }
    clearInterval(timer); timer = null;
    const events = await page.evaluate(() => window.__capEvents ?? []);
    result.realNativeRun = requests.some(request => request.endpoint === '/v1/agent/run');
    result.modelDone = events.some(event => event.type === 'done');
    result.modelErrors = events.filter(event => event.type === 'error');
    json(resolve(out, 'trace.json'), { requests, events, errors, elapsedMs: Date.now() - startedAt });
    writeFileSync(resolve(out, 'answer.txt'), events.filter(event => event.type === 'assistant').map(event => event.text ?? '').join('\n'));
    phase = 'save'; result.save = await saveEditor(page);
    const applied = stored(host.projectDir);
    json(resolve(out, 'after.json'), applied.project);
    writeRuntimeProject(host.projectDir, resolve(out, 'live.json'), applied.project);
    await page.screenshot({ path: resolve(out, 'after.png') });
    phase = 'reload'; await context.close(); context = null;
    editor = await newEditor(browser, host.url, host.projectDir, {}, { onPage: setup });
    page = editor.page; context = editor.context;
    const reloaded = stored(host.projectDir), loaded = editor.loads.find(load => load.sha256 === applied.sha256);
    result.persistence = { projectId: before.projectId, projectDir: host.projectDir,
      beforeRevision: before.revision, afterRevision: applied.revision, reloadedRevision: reloaded.revision,
      afterSha256: applied.sha256, reloadedSha256: reloaded.sha256,
      sameProject: before.projectId === reloaded.projectId, sameStoredDocument: applied.sha256 === reloaded.sha256,
      rendererLoadObserved: Boolean(loaded),
      rendererMapsAndDatabaseEqual: Boolean(loaded) && isDeepStrictEqual(applied.project.maps, loaded.maps)
        && isDeepStrictEqual(applied.project.database, loaded.database) };
    json(resolve(out, 'persistence.json'), result.persistence);
    json(resolve(out, 'reloaded.json'), reloaded.project);
    await page.screenshot({ path: resolve(out, 'reloaded.png') });
    result.contentChanged = before.sha256 !== applied.sha256;
    result.completedMeasurement = true;
  } catch (error) {
    result.completedMeasurement = false; result.failure = error.message; result.failurePhase = phase;
    if (page) {
      await page.screenshot({ path: resolve(out, 'failure.png'), timeout: 20000 }).catch(() => {});
      const events = await page.evaluate(() => window.__capEvents ?? []).catch(() => []);
      json(resolve(out, 'trace.json'), { requests, events, errors, phase });
      writeFileSync(resolve(out, 'last-ui.txt'), (await page.locator('body').innerText().catch(() => '')).slice(-16000));
    }
    if (host && existsSync(resolve(host.projectDir, 'project.sqlite'))) {
      const checkpoint = stored(host.projectDir);
      json(resolve(out, 'checkpoint.json'), { projectId: checkpoint.projectId, revision: checkpoint.revision, sha256: checkpoint.sha256 });
      json(resolve(out, 'after.json'), checkpoint.project);
      writeRuntimeProject(host.projectDir, resolve(out, 'live.json'), checkpoint.project);
    }
  } finally {
    clearInterval(timer);
    await context?.close().catch(() => {}); await browser?.close().catch(() => {}); await host?.close();
    result.elapsedMs = Date.now() - startedAt;
    json(resolve(out, 'result.json'), result); phase = 'closed'; progress({ completedMeasurement: result.completedMeasurement });
    if (existsSync(claim) && JSON.parse(readFileSync(claim, 'utf8')).pid === process.pid) unlinkSync(claim);
    releaseSlot();
  }
  return { ...result, outputDir: out, liveProject: resolve(out, 'live.json') };
}

export async function openGenrePlayer(rootArg, caseId, options = {}) {
  console.log('[genre harness] Player observation: use native keyboard when the UI is keyboard-only; wait for movement/action completion before another input. Preserve observer failures and re-observe the same saved source. Do not replace canonical start/state.');
  const root = resolve(rootArg), attempt = options.attempt ?? 1;
  const trial = resolve(root, caseId, `attempt-${attempt}`), evidenceDir = resolve(trial, options.name ?? 'runtime');
  if (existsSync(evidenceDir)) throw Error('Keep earlier player observation; choose a new name');
  mkdirSync(evidenceDir, { recursive: true });
  const source = resolve(trial, 'live.json'), project = JSON.parse(readFileSync(source, 'utf8'));
  let prepared, uploadedAssetBytes, uploadedAssetMime;
  await withTsModule(resolve('src/project/webExport.ts'), 'genre-export.mjs', async module => { prepared = module.prepareWebExport(project); });
  await withTsModule(resolve('src/project/persistence/assetAccessors.ts'), 'genre-asset-access.mjs', async module => {
    uploadedAssetBytes = module.uploadedAssetBytes; uploadedAssetMime = module.uploadedAssetMime;
  });
  writeFileSync(resolve(evidenceDir, 'player.json'), prepared.projectJson);
  const server = await startPackagedPlayerQaServer({ projectJson: prepared.projectJson });
  const browser = await firefox.launch({ firefoxUserPrefs: { 'network.notify.changed': false,
    'network.captive-portal-service.enabled': false, 'network.connectivity-service.enabled': false } });
  const context = await browser.newContext({ viewport: { width: 960, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const assetReceipts = [];
  const assets = new Map(prepared.assets.filter(asset => asset.kind === 'uploaded')
    .map(asset => [`/${asset.zipPath}`, asset.asset]));
  await page.route('**/assets/uploaded/**', async route => {
    const asset = assets.get(decodeURIComponent(new URL(route.request().url()).pathname));
    const ref = asset?.ref;
    if (asset) {
      try {
        const body = ref ? readFileSync(resolve(root, caseId, 'project', 'assets', `${ref.sha256}.${ref.extension}`))
          : Buffer.from(await uploadedAssetBytes(asset));
        const actualSha256 = createHash('sha256').update(body).digest('hex');
        const valid = body.length > 0 && (!ref || actualSha256 === ref.sha256);
        assetReceipts.push({ assetId: asset.id, source: ref ? 'canonical-file' : 'stored-data-url',
          expectedSha256: ref?.sha256, actualSha256, valid, bytes: body.length });
        if (valid) return route.fulfill({ body, contentType: uploadedAssetMime(asset) || 'application/octet-stream' });
      } catch { assetReceipts.push({ assetId: asset.id, sha256: ref?.sha256, valid: false, missing: true }); }
    }
    errors.push('Canonical uploaded asset missing or hash mismatch');
    return route.fulfill({ status: 404, body: 'Canonical uploaded asset unavailable' });
  });
  return { page, browser, context, server, project, evidenceDir, errors,
    projectUrl: server.url + '/__runtime-qa/project.json', playerRoute: 'compiled player.html with prepareWebExport and export shim',
    async close() { json(resolve(evidenceDir, 'page-errors.json'), errors);
      json(resolve(evidenceDir, 'asset-receipts.json'), assetReceipts);
      await context.close(); await browser.close(); await server.close(); } };
}
