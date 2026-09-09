import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { firefox } from 'playwright';
import { PNG } from 'pngjs';

const { values } = parseArgs({ options: { url: { type: 'string' }, evidence: { type: 'string' } } });
const url = values.url ?? 'http://127.0.0.1:9801/?blankProject=1';
assert.equal(url, 'http://127.0.0.1:9801/?blankProject=1', 'Only the isolated local contract fixture is allowed');
const out = resolve(values.evidence ?? 'output/evidence/tile-to-world/task-2');
await mkdir(out, { recursive: true });
const report = { url, viewport: { width: 1440, height: 900 }, browser: 'firefox', provider: null, model: null,
  sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), cwd: process.cwd(),
  actions: [], captures: [], remoteWrites: [], pageErrors: [], requestFailures: [], cleanup: {} };
const hash = value => createHash('sha256').update(value).digest('hex');
// The task child has no monitor API. Own and supervise the isolated process group here.
const server = spawn('bash', ['.omo/dev-worktree.sh'], { detached: true, env: { ...process.env, E2E_FREEZE_DEV_SERVER: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverClosed = once(server, 'close');
let serverLog = '';
let browser;
let page;
try {
  await new Promise((done, fail) => {
    const timeout = setTimeout(() => fail(new Error('Owned server readiness deadline')), 60000);
    const finish = callback => { clearTimeout(timeout); callback(); };
    server.once('error', error => finish(() => fail(error)));
    server.once('exit', code => finish(() => fail(new Error(`Server exited before readiness: ${code}`))));
    server.stderr.on('data', data => { serverLog += data.toString(); });
    server.stdout.on('data', data => {
      serverLog += data.toString();
      if (serverLog.includes('Local:') && serverLog.includes(':9801/')) finish(done);
    });
  });
  report.serverPid = server.pid;
  report.serverCwd = execFileSync('readlink', [`/proc/${server.pid}/cwd`], { encoding: 'utf8' }).trim();
  assert.equal(report.serverCwd, process.cwd());
  // Complete the large stylesheet transform before Firefox loads the editor graph.
  const stylesheet = await fetch(new URL('/src/styles/index.css', url), { signal: AbortSignal.timeout(120000) });
  assert.equal(stylesheet.status, 200);
  report.stylesheetBytes = (await stylesheet.arrayBuffer()).byteLength;
  // Independent Firefox avoids this host's known Chromium ERR_NETWORK_CHANGED failure.
  browser = await firefox.launch();
  page = await browser.newPage({ viewport: report.viewport });
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('requestfailed', request => report.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  page.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && /\/supabase\/|\/rest\/v1\//.test(request.url())) {
      report.remoteWrites.push({ method: request.method(), path: new URL(request.url()).pathname });
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem('rpg-zzu:editor-ui-mode', 'expert');
    window.spatialBaselineBoot = new Promise((done, fail) => {
      const timeout = setTimeout(() => { observer.disconnect(); fail(new Error('Editor Database action boot deadline')); }, 120000);
      const observer = new MutationObserver(() => {
        const action = document.querySelector('[data-testid="authoring-task-data"], [data-testid="toolbar-database"]');
        if (action) { observer.disconnect(); clearTimeout(timeout); done(action.dataset.testid); }
      });
      observer.observe(document, { childList: true, subtree: true });
    });
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const opener = await page.evaluate(() => window.spatialBaselineBoot);
  report.actions.push({ action: 'editor-boot', signal: opener });
  const initial = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    const project = store.getCurrent();
    return { remote: store.isRemotePersistenceEnabled(), projectId: null, json: JSON.stringify(project),
      mapId: editorState.get().currentMapId, tilesetId: project.maps[editorState.get().currentMapId]?.tilesetId };
  });
  assert.equal(initial.remote, false);
  report.fixture = { projectId: initial.projectId, sha256: hash(initial.json), currentMapId: initial.mapId, tilesetId: initial.tilesetId };
  await writeFile(resolve(out, 'baseline-project.json'), initial.json);
  const click = async testid => {
    await page.getByTestId(testid).click();
    report.actions.push({ action: 'click', testid });
  };
  const capture = async name => {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).filter(image => image.getBoundingClientRect().width > 0).map(image => image.decode()));
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    const file = resolve(out, name);
    await page.screenshot({ path: file, animations: 'disabled' });
    const bytes = await readFile(file);
    const image = PNG.sync.read(bytes);
    assert.equal(image.width, 1440); assert.equal(image.height, 900);
    const colors = new Set();
    let opaquePixels = 0;
    for (let offset = 0; offset < image.data.length; offset += 4) {
      colors.add(image.data.readUInt32BE(offset));
      if (image.data[offset + 3] === 255) opaquePixels++;
    }
    assert.ok(colors.size > 100, 'Capture must contain a composited editor, not a blank frame');
    const canvases = await page.locator('.database-modal-body canvas').evaluateAll(nodes => nodes.map(canvas => {
      const context = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const pixels = context && canvas.width && canvas.height ? context.getImageData(0, 0, canvas.width, canvas.height).data : [];
      return { width: canvas.width, height: canvas.height, rect: rect.toJSON(), painted: pixels.some(value => value > 0) };
    }));
    report.captures.push({ file, width: image.width, height: image.height, sha256: hash(bytes), colors: colors.size, opaquePixels, canvases });
  };
  await click(opener);
  await page.getByTestId('database-modal').waitFor({ state: 'visible' });
  const mapGroup = page.getByTestId('db-tab-group-world');
  if (await mapGroup.getAttribute('aria-expanded') === 'false') await click('db-tab-group-world');
  await click('db-tab-scratch-concepts');
  report.initialConceptTileset = await page.getByTestId('scratch-concept-tileset-select').inputValue();
  assert.equal(report.initialConceptTileset, initial.tilesetId);
  await capture('before.png');
  report.newTabs = await page.locator('[data-testid^="db-tab-spatial-"]').count();
  assert.equal(report.newTabs, 0, 'This driver characterizes the old navigation only');
  await page.getByTestId('scratch-concept-tileset-select').selectOption('easyrpg_chipset_interior');
  report.actions.push({ action: 'selectOption', testid: 'scratch-concept-tileset-select', value: 'easyrpg_chipset_interior' });
  await page.getByTestId('scratch-concept-facility-inn').waitFor({ state: 'visible' });
  await capture('concept-interior.png');
  await click('db-context-structureKits');
  await page.getByTestId('structure-kit-heading').waitFor({ state: 'visible' });
  await capture('objects-interior.png');
  await click('db-context-back');
  await click('db-context-tilesetSpaces');
  await page.getByTestId('tileset-spaces-workspace').waitFor({ state: 'visible' });
  await capture('spaces-interior.png');
  await click('db-context-back');
  await click('db-tab-tilesets');
  await capture('tilesets.png');
  assert.deepEqual(report.remoteWrites, []);
  report.outcome = 'PASS: baseline legacy views reachable; six spatial routes absent';
} catch (error) {
  if (!(error instanceof Error)) throw error;
  report.outcome = 'FAIL'; report.error = error.message;
  if (page) await page.screenshot({ path: resolve(out, 'failure.png') });
  throw error;
} finally {
  try { if (browser) await browser.close(); report.cleanup.browserClosed = true; }
  finally {
    if (server.exitCode === null && server.signalCode === null) process.kill(-server.pid, 'SIGTERM');
    report.cleanup.serverExit = await serverClosed;
    // Explicit task-required listener receipt; never kill a process found by this probe.
    const probe = createServer();
    try {
      const listening = once(probe, 'listening');
      probe.listen(9801, '127.0.0.1');
      await listening;
      report.cleanup.port9801Released = true;
    } finally { if (probe.listening) { const closed = once(probe, 'close'); probe.close(); await closed; } }
    await writeFile(resolve(out, 'server.log'), serverLog);
    await writeFile(resolve(out, 'qa.json'), JSON.stringify(report, null, 2));
    await writeFile(resolve(out, 'cleanup.md'), `# Baseline QA cleanup\n\nOwned server PID: ${server.pid}. Exit: ${JSON.stringify(report.cleanup.serverExit)}.\nBrowser closed: ${report.cleanup.browserClosed}. Port 9801 bind succeeded after teardown: ${report.cleanup.port9801Released}.\nNo user profile/cache cleared. Worktree-only Vite cache retained. Remote writes: ${report.remoteWrites.length}.\nMonitor tool unavailable in this child; the driver supervised an owned detached process group with readiness/close events.\n`);
  }
}
