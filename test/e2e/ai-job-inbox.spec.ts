import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

test.setTimeout(1_800_000);
test.use({ trace: 'off', viewport: { width: 1280, height: 800 }, actionTimeout: 60_000, navigationTimeout: 180_000 });
test.beforeEach(async ({ context }) => {
  // Linux netlink churn causes Chromium ERR_NETWORK_CHANGED even on loopback.
  // Proxy only immutable bootstrap/static GETs through Playwright's Node wire;
  // the production API, named SSE, cookies and reconnect stay browser-native.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:19841' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/__task7/')) return route.continue();
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch({ maxRedirects: 0, maxRetries: 1 }); await route.fulfill({ response });
  });
});
const evidence = resolve('.omo/evidence/ai-job-queue/task-7');
const paths = { client: '/src/editor/aiJobs/jobClient.ts', store: '/src/project/store.ts' };
async function domReady(page: Page, selector: string): Promise<void> {
  await page.evaluate(selector => new Promise<void>((resolve, reject) => {
    const check = () => { if (document.querySelector(selector)) { observer.disconnect(); clearTimeout(deadline); resolve(); } };
    const observer = new MutationObserver(check); observer.observe(document, { subtree: true, attributes: true, childList: true });
    const deadline = setTimeout(() => { observer.disconnect(); reject(new Error(`DOM event deadline: ${selector}`)); }, 60_000); check();
  }), selector);
}
async function armState(page: Page, id: string | null, key: string, value: string): Promise<void> {
  await page.evaluate(async ({ paths, id, key, value }) => {
    const { getJobClient } = await import(paths.client), client = getJobClient();
    const signal = new Promise<void>((resolve, reject) => {
      const check = () => { const actual = id ? client.jobs.get(id)?.[key] : client[key]; if (String(actual) === value) { off(); clearTimeout(deadline); resolve(); } };
      const off = client.subscribe(check); const deadline = setTimeout(() => { off(); reject(new Error(`Client event deadline ${key}:${value}`)); }, 300_000); check();
    });
    Reflect.set(window, '__task7Signal', signal);
  }, { paths, id, key, value });
}
async function stateDone(page: Page): Promise<void> { await page.evaluate(() => Reflect.get(window, '__task7Signal')); }
async function geometry(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-testid="ai-job-report"]');
    const rect = (selector: string) => { const r = panel?.querySelector(selector)?.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height } : null; };
    const r = panel?.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth > innerWidth, viewport: [innerWidth, innerHeight], panel: r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null, header: rect('header'), footer: rect('footer'), body: rect('[data-testid="ai-job-report-body"]'), list: rect('[data-testid="ai-job-objects"]'), ownerScroll: panel ? getComputedStyle(panel.querySelector('[data-testid="ai-job-report-body"]')!).overflowY : null };
  });
}
async function submitDatabase(page: Page, mode: 'auto' | 'review') {
  return page.evaluate(async ({ paths, mode }) => {
    const { getJobClient } = await import(paths.client), { store } = await import(paths.store);
    return getJobClient().admit({ input: { version: 1, family: 'database', project: store.getLoadedProjectIdentity(), target: {}, mode, dependsOn: [], payload: { kind: 'item', brief: 'Task7 durable boundary', withArtwork: false, config: { authMode: 'chatgpt', providerId: 'google-antigravity', model: 'gemini-3.7-flash', maxToolCalls: 8, maxTokens: 4096 } } }, projectSnapshot: JSON.parse(JSON.stringify(store.getCurrent())), artwork: [] }, crypto.randomUUID());
  }, { paths, mode });
}
async function openReport(page: Page, id: string): Promise<void> {
  await page.getByTestId('ai-jobs-open').click(); await domReady(page, '[data-testid="ai-jobs-list"]');
  await page.getByTestId('ai-jobs-search').fill(id);
  await page.locator(`[data-job-id="${id}"] [data-testid="ai-job-open-report"]`).click();
  await domReady(page, '[data-testid="ai-job-report"][data-revision][data-busy="false"]');
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll<HTMLImageElement>('[data-testid="ai-job-report"] img')].map(image => image.decode())); });
}

test('real editor exposes the durable inbox without blocking editing', async ({ page }) => {
  await page.goto('/?blankProject=1', { waitUntil: 'domcontentloaded' });
  await domReady(page, '[data-testid="oprn-menu-bar"]');
  await domReady(page, '[data-testid="edit-canvas"] canvas');
  // Original behavioral RED: the real shipped topbar had no launcher.
  expect(await page.getByTestId('ai-jobs-open').count()).toBe(1);
  await page.getByTestId('ai-jobs-open').click(); await domReady(page, '[data-testid="ai-jobs-list"]');
  expect(await page.getByTestId('ai-jobs-list').isVisible()).toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.getByTestId('ai-jobs-open').evaluate(element => document.activeElement === element)).toBe(true);
  expect((await geometry(page)).overflow).toBe(false);
});

test('full real editor inbox/report viewport and state matrix', async ({ page, context, request }) => {
  await mkdir(evidence, { recursive: true });
  const fixtureServer = await request.get('/__task7/counts');
  expect(fixtureServer.status(), 'Run the owned editor-fixture-server.mjs on free port 19841 for the full matrix').toBe(200);
  const measures: unknown[] = [], actions: string[] = [], browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(String(error)));
  await context.tracing.start({ screenshots: false, snapshots: true, sources: false });
  try {
    await page.goto('/?blankProject=1', { waitUntil: 'domcontentloaded' }); await domReady(page, '[data-testid="ai-jobs-open"]');
    await domReady(page, '[data-testid="edit-canvas"] canvas');
    await page.getByTestId('ai-jobs-open').click(); await domReady(page, '[data-testid="ai-jobs-empty"][data-kind="empty"]');
    for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]]) {
      await page.setViewportSize({ width, height }); expect((await geometry(page)).overflow).toBe(false);
      await page.screenshot({ path: `${evidence}/editor-empty-${width}.png` });
    }
    await page.keyboard.press('Escape'); actions.push('empty inbox in all viewports, Escape to launcher');
    const base = await page.evaluate(async paths => { const { store } = await import(paths.store); return JSON.parse(JSON.stringify(store.getCurrent())); }, paths);
    const seeded = await request.post('/__task7/seed', { data: { project: base }, timeout: 360_000 });
    expect(seeded.status(), await seeded.text()).toBe(200);
    const fixtures = await seeded.json() as { id: string; label: string; family: string; report: { sections: { kind: string; objectId: string }[] } }[];
    const countsBefore = await (await request.get('/__task7/counts')).json();
    const projectBeforeViewing = await page.evaluate(async paths => { const { store } = await import(paths.store); return JSON.stringify(store.getCurrent()); }, paths);
    await page.evaluate(async paths => { const { getJobClient } = await import(paths.client); await getJobClient().refresh(); }, paths);
    for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      for (const mode of ['beginner', 'standard', 'expert']) {
        await page.getByTestId('workspace-panels-button').click();
        await page.getByTestId(`workspace-ui-mode-${mode}`).click();
        await domReady(page, `[data-testid="oprn-menu-bar"][data-editor-ui-mode="${mode}"]`);
        expect(await page.getByTestId('ai-jobs-open').isVisible()).toBe(true);
        expect((await geometry(page)).overflow, `${mode} ${width}`).toBe(false);
        await page.screenshot({ path: `${evidence}/launcher-${mode}-${width}.png` });
        actions.push(`launcher ${mode} ${width}x${height}`);
      }
      await page.getByTestId('ai-jobs-open').click(); await domReady(page, '[data-testid="ai-jobs-list"]');
      expect(await page.locator('[data-testid="ai-jobs-list"] [data-job-id]').count()).toBeGreaterThanOrEqual(20);
      const listBox = await page.getByTestId('ai-jobs-list').boundingBox(); expect(listBox!.height).toBeGreaterThan(100);
      await page.getByTestId('ai-jobs-search').fill('no-fixture-matches'); await domReady(page, '[data-testid="ai-jobs-empty"][data-kind="no-results"]');
      await page.screenshot({ path: `${evidence}/no-results-${width}.png` }); await page.getByTestId('ai-jobs-reset').click();
      expect(await page.getByTestId('ai-jobs-search').evaluate(element => document.activeElement === element)).toBe(true);
      await page.screenshot({ path: `${evidence}/queue-large-${width}.png` }); await page.keyboard.press('Escape');
      for (const fixture of fixtures.filter(item => !item.label.startsWith('extra-'))) {
        await openReport(page, fixture.id);
        const expectedObjects = new Set(fixture.report.sections.map(section => `${section.kind}:${section.objectId}`)).size;
        expect(await page.getByTestId('ai-job-object').count()).toBe(expectedObjects);
        const metrics = await geometry(page); measures.push({ label: fixture.label, ...metrics });
        expect(metrics.overflow, `${fixture.label} ${width}`).toBe(false);
        expect(metrics.panel!.left).toBeGreaterThanOrEqual(0); expect(metrics.panel!.right).toBeLessThanOrEqual(width);
        expect(metrics.panel!.bottom).toBeLessThanOrEqual(height); expect(metrics.footer!.bottom).toBeLessThanOrEqual(metrics.panel!.bottom);
        expect(metrics.body!.height).toBeGreaterThan(100); expect(metrics.ownerScroll).toBe('auto');
        expect(await page.getByTestId('ai-job-apply').isDisabled()).toBe(true);
        if (fixture.label === 'maps') {
          const pixels = await page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>('[data-testid="ai-job-media"] img')].map(image => {
            const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0); return { sha: image.dataset.artifactSha, rgba: [...ctx.getImageData(8, 8, 1, 1).data] };
          }));
          expect(pixels.map(item => item.rgba)).toContainEqual([220, 50, 40, 255]); expect(pixels.map(item => item.rgba)).toContainEqual([40, 90, 220, 255]);
          measures.push({ label: 'pinned-map-pixels', width, pixels });
          await page.getByTestId('ai-job-object-list').click();
          if (width === 1024) expect(await page.getByTestId('ai-job-objects').isVisible()).toBe(true);
          await page.getByTestId('ai-job-object').last().click(); await domReady(page, '[data-testid="ai-job-report-body"] [data-loaded="true"]');
          measures.push({ label: 'lower-object-list', width, scrollTop: await page.getByTestId('ai-job-objects').evaluate(element => element.scrollTop) });
        }
        if (fixture.label === 'artwork' || fixture.label === 'image') {
          const pixel = await page.locator('[data-testid="ai-job-media"] img').first().evaluate((image: HTMLImageElement) => {
            const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
            return { alpha: [...ctx.getImageData(0, 0, 1, 1).data], center: [...ctx.getImageData(16, 16, 1, 1).data] };
          }); expect(pixel.alpha).toEqual([0, 0, 0, 0]); expect(pixel.center).toEqual([200, 40, 180, 255]);
        }
        if (fixture.label === 'artwork') {
          await page.getByTestId('ai-job-report-body').focus();
          await page.evaluate(() => Reflect.set(window, '__task7Scroll', new Promise<void>((resolve, reject) => {
            const body = document.querySelector('[data-testid="ai-job-report-body"]')!;
            const deadline = setTimeout(() => reject(new Error('Report scroll event deadline')), 5000);
            body.addEventListener('scroll', () => { clearTimeout(deadline); resolve(); }, { once: true });
          })));
          await page.keyboard.press('PageDown'); await page.evaluate(() => Reflect.get(window, '__task7Scroll'));
          expect(await page.getByTestId('ai-job-report-body').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
          const lower = await geometry(page); expect(lower.header).toEqual(metrics.header); expect(lower.footer).toEqual(metrics.footer);
          await page.screenshot({ path: `${evidence}/report-artwork-lower-${width}.png` });
          await page.keyboard.press('Control+Home');
        }
        if (fixture.label === 'native-tileset') {
          const choice = page.locator('[data-proposal-id="native-1"]'); await choice.check(); expect(await choice.isChecked()).toBe(true);
        }
        if (fixture.label === 'commands') {
          const toggle = page.locator('[data-testid="ai-job-review"] button').first();
          const wasExcluded = await toggle.getAttribute('aria-pressed'); await toggle.click();
          expect(await toggle.getAttribute('aria-pressed')).toBe(wasExcluded === 'true' ? 'false' : 'true');
        }
        if (fixture.label === 'interrupted') {
          await page.getByTestId('ai-job-report-retry').click(); await domReady(page, '[data-testid="app-confirm-modal"]');
          await page.keyboard.press('Escape'); expect(await page.getByTestId('ai-job-report').isVisible()).toBe(true);
        }
        await page.screenshot({ path: `${evidence}/report-${fixture.label}-${width}.png` });
        const ownedUrls = fixture.label === 'image' ? await page.locator('[data-testid="ai-job-report"] img').evaluateAll(images => images.map(image => (image as HTMLImageElement).src)) : [];
        await page.keyboard.press('Escape'); expect(await page.getByTestId('ai-jobs-open').evaluate(element => document.activeElement === element)).toBe(true);
        if (ownedUrls.length) expect(await page.evaluate(async urls => Promise.all(urls.map(url => fetch(url).then(() => true, () => false))), ownedUrls)).toEqual(ownedUrls.map(() => false));
        actions.push(`report ${fixture.label} ${width}x${height}`);
      }
    }
    const countsAfter = await (await request.get('/__task7/counts')).json(); expect(countsAfter.providerCalls).toBe(countsBefore.providerCalls);
    expect(countsAfter.jobs).toBe(countsBefore.jobs);
    expect(await page.evaluate(async paths => { const { store } = await import(paths.store); return JSON.stringify(store.getCurrent()); }, paths)).toBe(projectBeforeViewing);
    expect(browserErrors).toEqual([]);
  } finally {
    await writeFile(`${evidence}/browser-evidence.json`, JSON.stringify({ measures, actions, browserErrors, aestheticReview: 'unverified: configured models cannot view image attachments' }, null, 2));
    await context.tracing.stop({ path: `${evidence}/editor-action-trace.zip` });
  }
});

test('real reconnect, browser-close completion, auto application, cancel/retry and save-only controls', async ({ page, context, request }) => {
  const actions: string[] = [], browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(String(error)));
  await context.tracing.start({ screenshots: false, snapshots: true, sources: false });
  try {
    await page.goto('/?blankProject=1', { waitUntil: 'domcontentloaded' });
    await domReady(page, '[data-testid="edit-canvas"] canvas');
    await domReady(page, '[data-testid="ai-jobs-open"]');
    actions.push('real editor canvas and launcher mounted');
    // Native SSE reconnect retains search input and server unread acknowledgement.
    await page.getByTestId('ai-jobs-open').click(); await page.getByTestId('ai-jobs-search').fill('retained offline input');
    await page.evaluate(() => document.fonts.ready); actions.push('queue input and online fonts ready');
    await armState(page, null, 'connection', 'offline'); await context.setOffline(true); await stateDone(page); actions.push('browser offline event observed');
    expect(await page.getByTestId('ai-jobs-search').inputValue()).toBe('retained offline input');
    // Offline text may request an uncached subset font. Capture actual rendered
    // fallback pixels, rather than Playwright's impossible wait for online fonts.
    const offlineCapture = await context.newCDPSession(page);
    try { const shot = await offlineCapture.send('Page.captureScreenshot', { format: 'png' }); await writeFile(`${evidence}/offline-retained.png`, Buffer.from(shot.data, 'base64')); }
    finally { await offlineCapture.detach(); }
    actions.push('actual offline compositor screenshot captured');
    await armState(page, null, 'connection', 'connected'); await context.setOffline(false); await stateDone(page); actions.push('online recovery event observed');
    expect(await page.getByTestId('ai-jobs-search').inputValue()).toBe('retained offline input'); await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // This is the reusable admission API, not a claim that Task8 migrated existing family submitters.
    const admitted = await submitDatabase(page, 'review');
    expect((await request.post('/__task7/provider-reached', { data: { id: admitted.job.id }, timeout: 330_000 })).status()).toBe(200);
    await page.getByTestId('ai-jobs-open').click(); await page.keyboard.press('Escape'); await page.close();
    const finished = request.post('/__task7/job-ready', { data: { id: admitted.job.id }, timeout: 330_000 });
    await request.post('/__task7/release', { data: { id: admitted.job.id } }); expect((await finished).status()).toBe(200);
    const reopened = await context.newPage();
    reopened.on('pageerror', error => browserErrors.push(String(error)));
    try {
      await reopened.emulateMedia({ reducedMotion: 'reduce' });
      expect(await reopened.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      await reopened.goto('/?blankProject=1', { waitUntil: 'domcontentloaded' }); await domReady(reopened, '[data-testid="ai-jobs-open"]');
      await armState(reopened, admitted.job.id, 'report', 'ready'); await stateDone(reopened);
      await openReport(reopened, admitted.job.id); expect(await reopened.getByTestId('ai-job-states').getAttribute('data-generation')).toBe('succeeded');
      expect(await reopened.getByTestId('ai-job-apply').isDisabled()).toBe(true);
      await reopened.screenshot({ path: `${evidence}/browser-close-completion.png` });
      await reopened.keyboard.press('Tab'); expect(await reopened.getByTestId('ai-job-report').evaluate(element => element.contains(document.activeElement))).toBe(true);
      expect(await reopened.evaluate(() => parseFloat(getComputedStyle(document.activeElement!).outlineWidth))).toBeGreaterThan(0);
      await reopened.keyboard.press('Escape'); expect(await reopened.getByTestId('ai-jobs-open').evaluate(element => element === document.activeElement)).toBe(true);
      const inbox = await (await request.get('/api/ai-jobs/inbox')).json(); expect(inbox.inbox.filter((item: { jobId: string; readAt: number | null }) => item.jobId === admitted.job.id).every((item: { readAt: number | null }) => item.readAt !== null)).toBe(true);
      actions.push('real HTTP admission, provider boundary held, submitting tab closed, server completion, reopened report, server read ack, reduced motion keyboard');
      const beforeReplay = await (await request.get('/__task7/counts')).json();
      await armState(reopened, null, 'connection', 'offline'); await request.post('/__task7/disconnect-sse'); await stateDone(reopened);
      await armState(reopened, null, 'connection', 'connected'); await stateDone(reopened);
      const replay = await (await request.get('/__task7/counts')).json();
      expect(Number(replay.sseConnections.at(-1).lastEventId)).toBeGreaterThan(0); expect(replay.sseConnections.at(-1).query).toBe('');
      expect(replay.providerCalls).toBe(beforeReplay.providerCalls); expect(replay.jobs).toBe(beforeReplay.jobs);
      actions.push('native named SSE reconnect sent durable Last-Event-ID without after query; no admission or provider dispatch on replay');
      const automatic = await submitDatabase(reopened, 'auto');
      expect((await request.post('/__task7/provider-reached', { data: { id: automatic.job.id }, timeout: 330_000 })).status()).toBe(200);
      await armState(reopened, automatic.job.id, 'application', 'applied');
      await request.post('/__task7/release', { data: { id: automatic.job.id } }); await stateDone(reopened);
      expect(await reopened.getByTestId('ai-job-report').count()).toBe(0);
      expect(await reopened.evaluate(async paths => { const { store } = await import(paths.store); return store.getCurrent().database.items.some((item: { name: string }) => item.name === 'Durable fixture potion'); }, paths)).toBe(true);
      await armState(reopened, automatic.job.id, 'report', 'ready'); await stateDone(reopened);
      await openReport(reopened, automatic.job.id);
      const beforeSave = await (await request.get('/__task7/counts')).json();
      await armState(reopened, automatic.job.id, 'save', 'unknown'); await reopened.getByTestId('ai-job-save').click(); await stateDone(reopened);
      expect((await (await request.get('/__task7/counts')).json()).providerCalls).toBe(beforeSave.providerCalls);
      await reopened.screenshot({ path: `${evidence}/actual-auto-applied-save-only.png` });
      actions.push('opted-in auto mode applied without report opening; save-only retry reports no remote proof and no generation');
      await reopened.keyboard.press('Escape');
      const cancellable = await submitDatabase(reopened, 'review');
      expect((await request.post('/__task7/provider-reached', { data: { id: cancellable.job.id }, timeout: 330_000 })).status()).toBe(200);
      const queued = await submitDatabase(reopened, 'review');
      expect(queued.job.generation).toBe('queued');
      await reopened.getByTestId('ai-jobs-open').click();
      await reopened.screenshot({ path: `${evidence}/actual-running-and-queued.png` });
      await reopened.locator(`[data-job-id="${queued.job.id}"] [data-testid="ai-job-cancel"]`).click(); await domReady(reopened, '[data-testid="app-confirm-modal"]');
      await armState(reopened, queued.job.id, 'generation', 'cancelled'); await reopened.getByTestId('app-modal-confirm').click(); await stateDone(reopened);
      expect((await (await request.get(`/api/ai-jobs/${queued.job.id}`)).json()).operations).toHaveLength(0);
      await reopened.getByTestId('ai-jobs-search').fill(cancellable.job.id);
      await reopened.locator(`[data-job-id="${cancellable.job.id}"] [data-testid="ai-job-cancel"]`).click(); await domReady(reopened, '[data-testid="app-confirm-modal"]');
      await armState(reopened, cancellable.job.id, 'generation', 'cancelled'); await reopened.getByTestId('app-modal-confirm').click(); await stateDone(reopened);
      await reopened.keyboard.press('Escape');
      await armState(reopened, cancellable.job.id, 'report', 'ready'); await stateDone(reopened); await openReport(reopened, cancellable.job.id);
      await reopened.screenshot({ path: `${evidence}/actual-cancelled.png` });
      const redispatched = request.post('/__task7/provider-reached', { data: { id: cancellable.job.id }, timeout: 330_000 });
      await reopened.getByTestId('ai-job-report-retry').click(); await domReady(reopened, '[data-testid="app-confirm-modal"]');
      await reopened.getByTestId('app-modal-confirm').click(); expect((await redispatched).status()).toBe(200);
      await armState(reopened, cancellable.job.id, 'report', 'ready'); await request.post('/__task7/release', { data: { id: cancellable.job.id } }); await stateDone(reopened);
      expect(await reopened.getByTestId('ai-job-apply').isDisabled()).toBe(true);
      await reopened.screenshot({ path: `${evidence}/actual-stale-retry-report.png` });
      await reopened.getByTestId('ai-job-refresh-report').click(); await domReady(reopened, '[data-testid="ai-job-report"][data-matching-result="true"][data-busy="false"]');
      expect(await reopened.getByTestId('ai-job-apply').isEnabled()).toBe(true);
      await reopened.getByTestId('ai-job-apply').click(); await domReady(reopened, '[data-testid="app-confirm-modal"]');
      await armState(reopened, cancellable.job.id, 'application', 'applied'); await reopened.getByTestId('app-modal-confirm').click(); await stateDone(reopened);
      await reopened.screenshot({ path: `${evidence}/actual-reviewed-application.png` });
      actions.push('real cancellation; explicit duplicate-spend retry consent; stale checkpoint review disabled until refreshed; explicit guarded apply through report control');
      await reopened.keyboard.press('Escape');
    } finally { await reopened.close(); }
    expect(browserErrors).toEqual([]);
  } finally {
    await writeFile(`${evidence}/browser-recovery-evidence.json`, JSON.stringify({ actions, browserErrors }, null, 2));
    const cleanup = await Promise.allSettled([context.setOffline(false), context.tracing.stop({ path: `${evidence}/editor-recovery-trace.zip` })]);
    const failures = cleanup.filter((item): item is PromiseRejectedResult => item.status === 'rejected');
    await writeFile(`${evidence}/browser-context-cleanup.json`, JSON.stringify({ failures: failures.map(item => String(item.reason)) }, null, 2));
    if (failures.length) throw new AggregateError(failures.map(item => item.reason), 'Browser context cleanup failed');
  }
});
