// Production dialog/resolver/cache, injected QA catalog. These are rejected source images,
// NOT evidence that a production scene has passed the art gate or been published.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const out = resolve('verify-shots/interview-scene-bank'); fs.mkdirSync(out, { recursive: true });
const records = JSON.parse(fs.readFileSync(resolve('qa-runs/harnesses/interview-scene-bank/generated-batch-1.json'), 'utf8'));
const scenes = Object.fromEntries(records.map(r => [r.key, { url: `/assets/harnesses/interview-scene-bank/qa-${r.key}.png`, sha256: 'QA-only', promptSha256: 'QA-only' }]));
const catalogSignature = JSON.parse(fs.readFileSync(resolve('src/editor/interviewSceneBank.json'), 'utf8')).catalogSignature;
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const report = { productionComponents: true, syntheticCatalog: true, imagesRejectedByNativeGate: true, artApproval: false, checks: [], requests: [], errors: [] };
page.on('pageerror', e => report.errors.push(e.message));
let requests = 0;
await page.route('**/auth/status**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ connected: false }) }));
await page.route('**/v1/images/generations', r => { requests++; return r.fulfill({ status: 503, body: '{"error":"QA custom-art failure"}', contentType: 'application/json' }); });
await page.route('**/src/editor/interviewSceneBank.json*', r => r.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify({ version: 1, styleVersion: 1, catalogSignature, planned: 1457, scenes })}` }));
await page.route('**/assets/harnesses/interview-scene-bank/qa-*.png', r => {
  const key = new URL(r.request().url()).pathname.split('/qa-')[1].replace(/\.png$/, '');
  const rec = records.find(x => x.key === key); assert.ok(rec);
  report.requests.push(key);
  return r.fulfill({ contentType: 'image/png', body: fs.readFileSync(rec.path) });
});
async function mount() {
  await page.goto((process.env.MAKER_UI_URL ?? 'http://127.0.0.1:9812') + '/start-screen.html');
  await page.evaluate(async () => {
    document.querySelector('#start-app')?.remove();
    const host = document.createElement('div'); host.id = 'scene-bank-qa'; host.className = 'start-app'; document.body.append(host);
    const { showProjectInterview } = await import('/src/editor/ui/projectInterviewDialog.ts');
    const { createInterviewScenePlan } = await import('/src/editor/interviewScenePlan.ts');
    window.__scenePlan = createInterviewScenePlan();
    window.__interview = showProjectInterview('story-cutscene', { container: host, clickThrough: true });
  });
  await page.getByTestId('project-interview').waitFor();
}
try {
  await mount();
  const plan = await page.evaluate(() => window.__scenePlan.map(s => ({ key: s.key, parent: s.parent, depth: s.depth, facts: s.facts.length, children: s.children })));
  assert.equal(plan.length, 1457); assert.equal(new Set(plan.map(s => s.key)).size, 1457);
  const keys = new Set(plan.map(s => s.key));
  for (const scene of plan) { assert.ok(scene.parent === null || keys.has(scene.parent)); assert.equal(scene.facts, scene.depth); scene.children.forEach(k => assert.ok(keys.has(k))); }
  for (const genre of ['romance', 'monster', 'adventure', 'mystery']) assert.equal(plan.filter(s => s.key === genre || s.key.startsWith(genre + '--')).length, 364);
  report.checks.push('All 1,457 stable keys are unique; all parents/children exist; every prefix has all accumulated facts');
  await page.waitForFunction(() => performance.getEntriesByType('resource').filter(r => r.name.includes('/qa-')).length >= 5);
  assert.deepEqual(new Set(report.requests), new Set(['opening', 'romance', 'monster', 'adventure', 'mystery']));
  assert.equal(requests, 0);
  await page.getByTestId('project-interview-genre-romance').click();
  await page.waitForFunction(() => document.querySelector('.cinematic-interview').dataset.sceneKey === 'romance');
  await page.waitForFunction(() => performance.getEntriesByType('resource').filter(r => /qa-romance--/.test(r.name)).length >= 3);
  await page.waitForTimeout(300);
  // Capture dataset in the same click dispatch, before promises/timers can supply a scene.
  const click = await page.getByTestId('project-interview-option-0').evaluate(button => {
    const before = performance.now(); button.click();
    return { key: document.querySelector('.cinematic-interview').dataset.sceneKey, elapsed: performance.now() - before };
  });
  assert.equal(click.key, 'romance--campus'); assert.equal(requests, 0);
  report.warmClick = click;
  report.checks.push('Warm genre and choice switch inside the click event, without generation request or debounce timer');
  await page.screenshot({ path: out + '/warm-click-qa.png' });
  const resolver = await page.evaluate(async () => {
    const { fixedInterviewSceneKey, nextInterviewBankKeys } = await import('/src/editor/interviewSceneBank.ts');
    const catalog = (await import('/src/editor/projectInterviewScenes.json')).default;
    const slots = ['experience', 'activity', 'detail', 'progression', 'scope'];
    const draft = { version: 1, genre: 'romance', concept: '', protagonist: '', notes: '', choiceIds: {} };
    const answers = {};
    const q = catalog.genres[0].questions;
    q.forEach((question, i) => { const o = question.options[0]; draft.choiceIds[slots[i]] = o.id; answers[slots[i]] = { question: question.title, label: question.label, text: `${o.label} — ${o.detail}`, source: 'user' }; });
    const full = fixedInterviewSceneKey(draft, answers);
    const edit = nextInterviewBankKeys(draft, answers, 'premise');
    const custom = fixedInterviewSceneKey({ ...draft, notes: '비가 오는 항구' }, answers);
    const text = fixedInterviewSceneKey(draft, { ...answers, detail: { ...answers.detail, text: '직접 쓴 답변' } });
    const gap = fixedInterviewSceneKey(draft, { ...answers, experience: undefined });
    const mixed = fixedInterviewSceneKey({ ...draft, secondary: 'mystery' }, answers);
    return { full, edit, custom, text, gap, mixed };
  });
  assert.equal(resolver.full, 'romance--campus--talk--warm--single--scene');
  assert.deepEqual(resolver.edit, ['campus', 'palace', 'town'].map(p => `romance--${p}--talk--warm--single--scene`));
  assert.equal(resolver.custom, undefined); assert.equal(resolver.text, undefined); assert.equal(resolver.gap, undefined); assert.equal(resolver.mixed, undefined);
  report.checks.push('Editing a prior answer preserves later choices; custom text, notes, mixed genres and incomplete prefixes cannot resolve to misleading stock art');
  // No accepted image exists for this deeper prefix in the injected QA catalog.
  await page.getByTestId('project-interview-option-1').click();
  await page.waitForFunction(() => document.querySelector('.cinematic-interview').dataset.artState === 'error');
  assert.equal(requests, 1);
  assert.match(await page.locator('.ci-backdrop img.is-visible').getAttribute('src'), /qa-romance--campus/);
  report.checks.push('Missing bank scene uses the existing custom-art path and retains last displayed scene on provider failure');
  await page.getByTestId('project-interview-cancel').click();
  const stoppedAt = report.requests.length; await page.waitForTimeout(900); assert.equal(report.requests.length, stoppedAt);
  assert.equal(await page.getByTestId('project-interview').count(), 0);
  report.checks.push('Closing dialog releases the cache and does not schedule more scene work');
  assert.deepEqual(report.errors, []); report.passed = true;
} finally { fs.writeFileSync(out + '/browser-proof.json', JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report));
