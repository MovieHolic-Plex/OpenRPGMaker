import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

export const discoveryTasks = Object.freeze({
  pan: '지도의 내용을 수정하지 않고, 지도 화면을 옆으로 이동해 현재 보이는 영역을 바꾸세요.',
  event: '현재 지도의 이벤트를 편집할 수 있는 상태로 전환하세요.',
  map: '현재 지도의 속성을 확인하고 수정할 수 있는 화면을 여세요.',
  database: '게임 데이터베이스를 여세요.',
});

// The subject receives only observe/act and screenshots. State checks and target
// selectors are lead-only evidence, never part of the subject's observations.
export async function createDiscoveryPilot({ baseUrl, output, executablePath }) {
  const browser = await chromium.launch({
    executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const trials = new Map();

  async function snapshot(page) {
    const state = await page.evaluate(async () => {
      const { store } = await import('/src/project/store.ts');
      const { editorState } = await import('/src/editor/editorState.ts');
      if (store.remotePersistenceEnabled !== false) throw new Error('Remote persistence must be disabled');
      const current = editorState.get();
      return {
        mode: document.body.dataset.editorUiMode,
        tool: current.tool, layer: current.layer, mapId: current.currentMapId,
        camera: window.__oprnEditCamera(),
        maps: JSON.stringify(store.getCurrent().maps),
        dialogs: [...document.querySelectorAll('[role="dialog"]')].filter(node => node.getBoundingClientRect().width > 0)
          .map(node => ({ testId: node.dataset.testid, text: node.innerText.slice(0, 800) })),
      };
    });
    const { maps, ...rest } = state;
    return { ...rest, mapsHash: createHash('sha256').update(maps).digest('hex') };
  }

  async function capture(trial, entry) {
    await trial.page.evaluate(() => document.fonts.ready);
    await trial.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const image = path.join(trial.directory, `${String(trial.log.length).padStart(2, '0')}.png`);
    await trial.page.screenshot({ path: image });
    const state = await snapshot(trial.page);
    trial.log.push({ ...entry, elapsedMs: performance.now() - trial.started, image, state });
    await writeFile(path.join(trial.directory, 'trace.json'), JSON.stringify({
      task: trial.task, instruction: discoveryTasks[trial.task], phase: trial.phase,
      limits: { milliseconds: 240000, inputs: 15, calls: 30 },
      inputs: trial.inputs, calls: trial.calls, closed: trial.closed, log: trial.log,
    }, null, 2));
    return image;
  }

  return {
    async prepare(phase, task) {
      assert(['before', 'after'].includes(phase) && Object.hasOwn(discoveryTasks, task));
      const id = `${phase}-${task}`;
      assert(!trials.has(id), 'Each subject must have a fresh unique trial');
      const directory = path.resolve(output, phase, task);
      await mkdir(directory, { recursive: true });
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.tracing.start({ screenshots: true, snapshots: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
      // Same-origin GET relay, matching sidebar-focus QA, isolates host Chromium
      // network churn. The real browser still executes the unmodified application.
      await page.route('**/*', async route => {
        const request = route.request();
        if (request.method() !== 'GET' || new URL(request.url()).origin !== new URL(baseUrl).origin) return route.continue();
        const response = await fetch(request.url(), { signal: AbortSignal.timeout(90000) });
        await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
      });
      page.setDefaultTimeout(15000);
      await page.addInitScript(() => {
        localStorage.setItem('oprn:editor-ui-mode', 'standard');
        localStorage.setItem('oprn:ai-panel-collapsed', '1');
        window.pilotReady = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Editor readiness missing')), 120000);
          let hook;
          Object.defineProperty(window, '__oprnEditWorldToClient', {
            configurable: true, get: () => hook,
            set: value => { hook = value; clearTimeout(timer); resolve(); },
          });
        });
      });
      try {
        await page.goto(`${baseUrl}/?freshProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.evaluate(() => window.pilotReady);
      } catch (error) {
        await page.screenshot({ path: path.join(directory, 'infrastructure-failure.png') });
        await writeFile(path.join(directory, 'infrastructure-failure.json'), JSON.stringify({ message: String(error), errors }, null, 2));
        await context.close();
        throw error;
      }
      assert.equal((await snapshot(page)).mode, 'standard');
      const trial = { task, phase, directory, context, page, started: performance.now(), inputs: 0, calls: 0, log: [], closed: false };
      trials.set(id, trial);
      const image = await capture(trial, { type: 'ready' });
      trial.started = performance.now();
      return { id, image, instruction: discoveryTasks[task] };
    },
    async act(id, action) {
      const trial = trials.get(id);
      assert(trial && !trial.closed, 'Trial is not active');
      assert(performance.now() - trial.started < 240000, 'Time budget exhausted');
      assert(trial.calls < 30, 'Browser-call budget exhausted');
      trial.calls++;
      if (action.type !== 'observe' && action.type !== 'done') {
        assert(trial.inputs < 15, 'Input budget exhausted');
        trial.inputs++;
      }
      let target;
      if ('x' in action) {
        target = await trial.page.evaluate(({ x, y }) => {
          const node = document.elementFromPoint(x, y)?.closest('button,a,input,select,[role="button"]');
          return node ? { text: node.innerText, title: node.title, testId: node.dataset.testid } : null;
        }, action);
      }
      switch (action.type) {
        case 'observe': break;
        case 'click': await trial.page.mouse.click(action.x, action.y); break;
        case 'doubleClick': await trial.page.mouse.dblclick(action.x, action.y); break;
        case 'hover': await trial.page.mouse.move(action.x, action.y); break;
        case 'drag':
          await trial.page.mouse.move(action.x, action.y);
          await trial.page.mouse.down({ button: action.button ?? 'left' });
          await trial.page.mouse.move(action.toX, action.toY, { steps: 12 });
          await trial.page.mouse.up({ button: action.button ?? 'left' });
          break;
        case 'key': await trial.page.keyboard.press(action.key); break;
        case 'text': await trial.page.keyboard.insertText(action.text); break;
        case 'scroll': await trial.page.mouse.wheel(action.deltaX ?? 0, action.deltaY ?? 0); break;
        case 'done': break;
        default: throw new Error(`Unsupported action ${action.type}`);
      }
      const image = await capture(trial, { action, target });
      return { image, inputs: trial.inputs, calls: trial.calls };
    },
    async finish(id) {
      const trial = trials.get(id);
      assert(trial && !trial.closed);
      await capture(trial, { type: 'lead-final' });
      await trial.context.tracing.stop({ path: path.join(trial.directory, 'browser-trace.zip') });
      await trial.context.close();
      trial.closed = true;
      await writeFile(path.join(trial.directory, 'cleanup.json'), JSON.stringify({ contextClosed: true }));
      return { id, log: trial.log, inputs: trial.inputs, calls: trial.calls, cleanup: 'context closed' };
    },
    async close() {
      for (const trial of trials.values()) {
        if (!trial.closed) {
          await trial.context.close();
          trial.closed = true;
          await writeFile(path.join(trial.directory, 'cleanup.json'), JSON.stringify({ contextClosed: true, interrupted: true }));
        }
      }
      await browser.close();
    },
  };
}
