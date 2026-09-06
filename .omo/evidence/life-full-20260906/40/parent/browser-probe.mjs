import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = process.cwd();
const out = path.join(root, '.omo/evidence/life-full-20260906/40/parent');
const extracted = {};
for (const file of ['playtest-driver3.cjs', 'playtest-driver4.cjs', 'playtest-driver5.cjs', 'playtest-driver6.cjs', 'capture-fullscreen-scale.cjs']) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, 'scripts', file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const cleanups = [];
  let saveBlock;
  function visit(node) {
    if (ts.isForStatement(node) && node.getText(source).includes('localStorage.removeItem')) cleanups.push(node.getText(source));
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'warpVia') {
      const statements = [...node.initializer.body.statements];
      const first = statements.findIndex(s => s.getText(source).includes('armSaveWriteSignal'));
      const last = statements.findIndex(s => s.getText(source).includes('localStorage.setItem'));
      assert(first >= 0 && last > first);
      saveBlock = statements.slice(first, last + 1).map(s => s.getText(source)).join('\n');
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(cleanups.length, 1);
  extracted[file] = { cleanup: cleanups[0], saveBlock };
}
fs.writeFileSync(path.join(out, 'GREEN-extracted-source.json'), JSON.stringify(extracted, null, 2) + '\n');
const server = await createServer({
  configFile: false, envFile: false, root,
  plugins: [{ name: 'task40-private-page', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/__task40') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><button id="save">Save</button>'); }
      else next();
    });
  } }],
  cacheDir: path.join(out, 'private-vite-cache'),
  resolve: { alias: { '@': path.join(root, 'src') } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { host: '127.0.0.1', port: 42201, strictPort: true },
});
let browser;
const diagnostics = { pageErrors: [], failedRequests: [], httpErrors: [], consoleErrors: [] };
try {
  await server.listen();
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:42201' ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', request => diagnostics.failedRequests.push({ url: request.url(), failure: request.failure() }));
  page.on('response', response => { if (response.status() >= 400) diagnostics.httpErrors.push({ url: response.url(), status: response.status() }); });
  page.on('console', message => { if (message.type() === 'error') diagnostics.consoleErrors.push(message.text()); });
  await page.goto('http://127.0.0.1:42201/__task40');
  await page.evaluate(async () => {
    const saves = await import('/src/player/saveSlots.ts');
    const { createBlankProject } = await import('/src/project/defaults.ts');
    const { startSession } = await import('/src/project/session.ts');
    const project = createBlankProject();
    window.probe = { saves, snapshot: saves.createSaveSnapshot(project, startSession(project, 205)), writes: 0 };
    document.querySelector('#save').addEventListener('click', () => {
      if (!window.__saveWriteSignal) throw new Error('Save input was not prearmed');
      const result = saves.saveToSlot(localStorage, 1, window.probe.snapshot);
      if (!result.ok) throw new Error('Real public writer failed');
      window.probe.writes++;
    });
  });
  for (const [file, { cleanup }] of Object.entries(extracted)) {
    const checks = await page.evaluate(async cleanup => {
      const { saves, snapshot } = window.probe;
      localStorage.clear();
      const owned = [], preserved = [];
      for (const namespace of [null, 'custom:other']) {
        saves.setSaveSlotStorageNamespace(namespace);
        for (const slot of [1, 2, 3]) {
          if (!saves.saveToSlot(localStorage, slot, snapshot).ok) throw new Error('write failed');
          const key = saves.saveSlotKey(slot);
          if (localStorage.getItem(key) === null) throw new Error('missing writer output');
          const legacy = `${namespace ?? 'oprn'}:save-slot:${slot}`;
          localStorage.setItem(legacy, localStorage.getItem(key));
          (namespace ? preserved : owned).push(key, legacy);
        }
        const auto = saves.autosaveKey();
        localStorage.setItem(auto, 'preserve');
        preserved.push(auto);
      }
      saves.setSaveSlotStorageNamespace(null);
      localStorage.setItem('unrelated', 'preserve'); preserved.push('unrelated');
      const before = preserved.map(k => localStorage.getItem(k));
      Function(cleanup)();
      return { owned, cleared: owned.every(k => localStorage.getItem(k) === null), preserved: preserved.every((k, i) => localStorage.getItem(k) === before[i]) };
    }, cleanup);
    assert(checks.cleared && checks.preserved);
    console.log(JSON.stringify({ file, ...checks }));
  }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const [file, { saveBlock }] of Object.entries(extracted).filter(([, s]) => s.saveBlock)) {
    await page.evaluate(() => {
      const { saves, snapshot } = window.probe;
      localStorage.clear();
      localStorage.setItem('oprn:save-slot:1', JSON.stringify(snapshot));
      saves.setSaveSlotStorageNamespace('custom:other');
      if (!saves.saveToSlot(localStorage, 1, snapshot).ok) throw new Error('other namespace write failed');
      window.probe.otherKey = saves.saveSlotKey(1);
      saves.setSaveSlotStorageNamespace(null);
      window.probe.beforeSetItem = localStorage.setItem;
    });
    const execute = new AsyncFunction('page', 'clickTestId', 'clickPlay', 'mapId', 'm', 'x', 'y', 'switches', saveBlock);
    const click = async () => {
      const unrelated = await page.evaluate(async () => {
        let settled = false;
        window.__saveWriteSignal.completion.then(() => { settled = true; });
        localStorage.setItem('unrelated-write', 'not a save');
        await Promise.resolve();
        return settled;
      });
      assert.equal(unrelated, false);
      await page.locator('#save').click();
      return true;
    };
    await execute(page, click, click, 'map_probe', 'map_probe', 7, 9, { switch_probe: true });
    const result = await page.evaluate(() => {
      const { saves, snapshot, otherKey, beforeSetItem, writes } = window.probe;
      const key = saves.saveSlotKey(1);
      const text = localStorage.getItem(key);
      if (text === null) throw new Error('current save missing');
      const read = saves.readSaveSlot(localStorage, 1);
      return { key, writes, schemaVersion: JSON.parse(text).schemaVersion, readKind: read.kind, position: read.kind === 'present' && [read.snapshot.session.currentMapId, read.snapshot.session.x, read.snapshot.session.y], legacyPreserved: localStorage.getItem('oprn:save-slot:1') === JSON.stringify(snapshot), otherPreserved: localStorage.getItem(otherKey) === JSON.stringify(snapshot), disposed: !window.__saveWriteSignal && localStorage.setItem === beforeSetItem };
    });
    assert.equal(result.schemaVersion, 5);
    assert.equal(result.readKind, 'present');
    assert.deepEqual(result.position, ['map_probe', 7, 9]);
    assert(result.legacyPreserved && result.otherPreserved && result.disposed);
    console.log(JSON.stringify({ file, publicWriterAndActualSaveBlock: result }));
    const failInput = async () => { throw new Error('probe input failure'); };
    await assert.rejects(execute(page, failInput, failInput), /probe input failure/);
    assert(await page.evaluate(() => !window.__saveWriteSignal && localStorage.setItem === window.probe.beforeSetItem));
    const noWrite = async () => true;
    await assert.rejects(execute(page, noWrite, noWrite), /Save write failed: timeout/);
    assert(await page.evaluate(() => !window.__saveWriteSignal && localStorage.setItem === window.probe.beforeSetItem));
    console.log(JSON.stringify({ file, inputFailureDisposed: true, boundedNoWriteTimeoutDisposed: true }));
  }
  await context.close();
} finally {
  fs.writeFileSync(path.join(out, 'diagnostics.json'), JSON.stringify(diagnostics, null, 2) + '\n');
  console.log(JSON.stringify({ browserDiagnostics: diagnostics }));
  await browser?.close();
  await server.close();
  fs.rmSync(path.join(out, 'private-vite-cache'), { recursive: true, force: true });
  console.log('CLEANUP: private context/browser/server closed; own cache removed');
}
