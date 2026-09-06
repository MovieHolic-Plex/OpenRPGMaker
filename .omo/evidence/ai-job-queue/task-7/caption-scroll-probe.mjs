// Evidence-only 1280x800 tileset/native-tileset caption scroll proof. No production edits.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const origin = `http://127.0.0.1:${process.env.DEV_SERVER_PORT ?? '19841'}`;
const evidence = resolve('.omo/evidence/ai-job-queue/task-7');
const labels = ['tileset', 'native-tileset'];

function bounded(promise, label, ms = 60_000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })]).finally(() => clearTimeout(timer));
}

async function domReady(page, selector) {
  await page.evaluate(selector => new Promise((resolve, reject) => {
    const check = () => { if (document.querySelector(selector)) { observer.disconnect(); clearTimeout(deadline); resolve(); } };
    const observer = new MutationObserver(check);
    observer.observe(document, { subtree: true, attributes: true, childList: true });
    const deadline = setTimeout(() => { observer.disconnect(); reject(new Error(`DOM event deadline: ${selector}`)); }, 60_000);
    check();
  }), selector);
}

async function measure(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="ai-job-report"]');
    const body = panel?.querySelector('[data-testid="ai-job-report-body"]');
    const footer = panel?.querySelector('footer');
    const caption = [...(panel?.querySelectorAll('[data-testid="ai-job-media"] figcaption') ?? [])]
      .find(node => (node.textContent ?? '').includes('전체 타일 그림판'))
      ?? panel?.querySelector('[data-testid="ai-job-media"] figcaption');
    const box = element => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const cap = box(caption), bodyBox = box(body), foot = box(footer);
    const cx = cap ? (cap.left + cap.right) / 2 : 0;
    const cy = cap ? (cap.top + cap.bottom) / 2 : 0;
    const hit = caption ? document.elementFromPoint(cx, cy) : null;
    const hitOk = Boolean(hit && caption && (hit === caption || caption.contains(hit)));
    const withinBody = Boolean(cap && bodyBox
      && cap.top >= bodyBox.top - 0.5 && cap.bottom <= bodyBox.bottom + 0.5
      && cap.left >= bodyBox.left - 0.5 && cap.right <= bodyBox.right + 0.5);
    const aboveFooter = Boolean(cap && (!foot || cap.bottom <= foot.top + 0.5));
    return {
      captionText: caption?.textContent ?? null,
      scrollTop: body?.scrollTop ?? null,
      caption: cap, body: bodyBox, footer: foot,
      withinBody, aboveFooter, hitOk,
      hitTag: hit?.tagName ?? null,
      hitTestid: hit instanceof HTMLElement ? hit.dataset.testid ?? hit.closest('[data-testid]')?.getAttribute('data-testid') ?? null : null,
      reachable: withinBody && aboveFooter && hitOk,
    };
  });
}

async function scrollCaptionIntoBody(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const body = document.querySelector('[data-testid="ai-job-report-body"]');
    const caption = [...(document.querySelectorAll('[data-testid="ai-job-media"] figcaption') ?? [])]
      .find(node => (node.textContent ?? '').includes('전체 타일 그림판'))
      ?? document.querySelector('[data-testid="ai-job-media"] figcaption');
    if (!body || !caption) { reject(new Error('Missing report body or atlas figcaption')); return; }
    const cap = caption.getBoundingClientRect(), bodyBox = body.getBoundingClientRect(), footer = document.querySelector('[data-testid="ai-job-report"] footer')?.getBoundingClientRect();
    const visible = cap.top >= bodyBox.top - 0.5 && cap.bottom <= bodyBox.bottom + 0.5 && (!footer || cap.bottom <= footer.top + 0.5);
    if (visible) { resolve({ scrolled: false, scrollTop: body.scrollTop }); return; }
    const deadline = setTimeout(() => reject(new Error('Report body scroll event deadline')), 15_000);
    body.addEventListener('scroll', () => { clearTimeout(deadline); resolve({ scrolled: true, scrollTop: body.scrollTop }); }, { once: true });
    caption.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }));
}

const record = { viewport: [1280, 800], origin, actions: [], cases: {}, verdict: null, error: null };
const browser = await chromium.launch({
  headless: true,
  handleSIGTERM: false,
  handleSIGINT: false,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'],
});
try {
  const fixtures = await (await fetch(origin + '/__task7/fixtures')).json();
  if (!Array.isArray(fixtures) || fixtures.length === 0) throw new Error('No seeded fixtures on the live owned server; full E2E must run first in this lifetime');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/__task7/')) return route.continue();
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch({ maxRedirects: 0, maxRetries: 1 });
    await route.fulfill({ response });
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(origin + '/?blankProject=1', { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await domReady(page, '[data-testid="ai-jobs-open"]');
  await domReady(page, '[data-testid="edit-canvas"] canvas');
  record.actions.push('real editor canvas and launcher mounted');
  await page.evaluate(async () => { const { getJobClient } = await import('/src/editor/aiJobs/jobClient.ts'); await getJobClient().refresh(); });
  record.actions.push('client refreshed against seeded jobs');

  for (const label of labels) {
    const fixture = fixtures.find(item => item.label === label);
    if (!fixture?.id) throw new Error(`Missing seeded fixture ${label}`);
    await page.getByTestId('ai-jobs-open').click();
    await domReady(page, '[data-testid="ai-jobs-list"]');
    await page.getByTestId('ai-jobs-search').fill(fixture.id);
    await page.locator(`[data-job-id="${fixture.id}"] [data-testid="ai-job-open-report"]`).click();
    await domReady(page, '[data-testid="ai-job-report"][data-revision][data-busy="false"]');
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.querySelectorAll('[data-testid="ai-job-report"] img')].map(image => image.decode()));
    });
    await bounded(page.evaluate(() => new Promise((resolve, reject) => {
      const check = () => {
        const caption = [...document.querySelectorAll('[data-testid="ai-job-media"] figcaption')]
          .find(node => (node.textContent ?? '').includes('전체 타일 그림판'));
        if (caption) { observer.disconnect(); clearTimeout(deadline); resolve(); }
      };
      const observer = new MutationObserver(check);
      observer.observe(document, { subtree: true, childList: true, attributes: true });
      const deadline = setTimeout(() => { observer.disconnect(); reject(new Error(`Atlas figcaption deadline: ${label}`)); }, 60_000);
      check();
    })), `figcaption-${label}`);
    record.actions.push(`opened ${label} report ${fixture.id}`);

    const before = await measure(page);
    const beforePath = `${evidence}/caption-${label}-1280-before.png`;
    await page.screenshot({ path: beforePath });
    const scroll = await scrollCaptionIntoBody(page);
    const after = await measure(page);
    const afterPath = `${evidence}/caption-${label}-1280-after.png`;
    await page.screenshot({ path: afterPath });
    const pass = Boolean(after.reachable);
    record.cases[label] = { id: fixture.id, before, after, scroll, pass, screenshots: { before: beforePath, after: afterPath } };
    record.actions.push(`${label} caption reachable=${pass} scrollTop ${before.scrollTop} -> ${after.scrollTop}`);
    await page.keyboard.press('Escape');
    await bounded(page.evaluate(() => new Promise((resolve, reject) => {
      const check = () => { if (!document.querySelector('[data-testid="ai-job-report"]')) { observer.disconnect(); clearTimeout(deadline); resolve(); } };
      const observer = new MutationObserver(check);
      observer.observe(document, { subtree: true, childList: true, attributes: true });
      const deadline = setTimeout(() => { observer.disconnect(); reject(new Error('Report close deadline')); }, 15_000);
      check();
    })), 'report-close');
  }

  record.pageErrors = pageErrors;
  record.verdict = Object.values(record.cases).every(item => item.pass) && pageErrors.length === 0 ? 'PASS' : 'FAIL';
  await context.close();
} catch (error) {
  record.error = String(error?.stack ?? error);
  record.verdict = 'FAIL';
} finally {
  await browser.close();
  await writeFile(`${evidence}/caption-scroll-proof.json`, JSON.stringify(record, null, 2));
  console.log(JSON.stringify({ captionProbe: record.verdict, actions: record.actions, error: record.error, cases: Object.fromEntries(Object.entries(record.cases).map(([key, value]) => [key, { pass: value.pass, scrollTop: value.after?.scrollTop, reachable: value.after?.reachable, captionText: value.after?.captionText }])) }));
}
if (record.verdict !== 'PASS') process.exit(1);
