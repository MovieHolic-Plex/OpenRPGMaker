// Real assistant/UI reproduction in an isolated SQLite project.
import { firefox } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const base = process.env.DIARY_QA_URL ?? 'http://127.0.0.1:18436';
const dir = resolve('output/qa/event-diary/project');
const out = resolve('verify-shots/event-diary-graphic');
mkdirSync(out, { recursive: true });
const report = { base, dir, requests: [], errors: [] };
const save = () => writeFileSync(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
function snapshot() {
  const db = new DatabaseSync(dir + '/project.sqlite', { readOnly: true });
  try {
    const row = db.prepare('select project_id,revision from project where id=1').get();
    const maps = db.prepare('select map_id,map_json from maps').all().map(r => ({ id: r.map_id, ...JSON.parse(r.map_json) }));
    const users = db.prepare('select entries_json from ai_conversations').all().flatMap(r => JSON.parse(r.entries_json).filter(e => e.kind === 'user'));
    return { ...row, maps: maps.map(m => ({ id: m.id, name: m.name, events: m.events })), users };
  } finally { db.close(); }
}
const browser = await firefox.launch({ firefoxUserPrefs: { 'network.notify.changed': false, 'network.captive-portal-service.enabled': false } });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => { report.errors.push(e.message); save(); });
page.on('request', r => {
  if (!r.url().includes('/v1/agent/run') || r.method() !== 'POST') return;
  const bytes = r.postDataBuffer();
  const body = JSON.parse(bytes[0] === 31 ? gunzipSync(bytes) : bytes);
  report.requests.push({ runId: body.runId, model: body.model, task: body.task }); save();
});
try {
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__oprnAiBridge?.status().ready, null, { timeout: 180000 });
  console.log('assistant ready', await page.evaluate(() => window.__oprnAiBridge.status()));
  await page.waitForFunction(() => window.__oprnEditMapViewport?.()?.mapId, null, { timeout: 180000 });
  await page.locator('#oprn-boot-loader').waitFor({ state: 'detached', timeout: 180000 });
  await page.waitForTimeout(5000);
  report.before = snapshot();
  report.indexedDbBefore = await page.evaluate(async () => {
    const names = await indexedDB.databases();
    if (!names.some(d => d.name === 'oprn-ai-records')) return [];
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('oprn-ai-records'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { return await new Promise((resolve, reject) => { const r = db.transaction('conversations').objectStore('conversations').getAll(); r.onsuccess = () => resolve(r.result.map(c => ({ id: c.id, users: c.entries?.filter(e => e.kind === 'user') }))); r.onerror = () => reject(r.error); }); }
    finally { db.close(); }
  });
  save(); console.log('ready', JSON.stringify(report.before));
  await page.getByTestId('ai-input').fill(process.env.DIARY_QA_PROMPT ?? '현재 맵에 그림이 보이는 일기 이벤트 하나를 깔아줘. 조사하면 짧은 일기 내용 한 줄이 나오게 해줘. 일기·노트·책에 맞는 기존 그림을 찾아 지정하고 이벤트 이름은 일기로 해줘.');
  await page.getByTestId('ai-send').click({ noWaitAfter: true });
  const until = Date.now() + 10 * 60 * 1000;
  let ticks = 0;
  while (Date.now() < until) {
    await page.waitForTimeout(5000);
    report.chat = (await page.getByTestId('ai-chat-log').innerText()).slice(-6500);
    report.after = snapshot(); save();
    if (++ticks % 6 === 0) console.log('progress', report.chat.slice(-1300));
    const busy = await page.evaluate(() => window.__oprnAiBridge.status().turnBusy);
    if (report.requests.length && !busy) break;
  }
  await page.screenshot({ path: out + '/assistant.png' });
  report.audit = await page.evaluate(() => window.__oprnAiBridge.audit());
  report.after = snapshot();
  console.log('result', JSON.stringify(report.after));
  console.log('chat', report.chat);
  console.log('event controls', await page.locator('[data-testid]').evaluateAll(nodes => nodes.map(n => ({id:n.dataset.testid,text:n.textContent?.slice(0,90)})).filter(n=>/event|layer/.test(n.id)).slice(0,50)));
  save();
} catch (e) { report.failure = e.message; save(); await page.screenshot({ path: out + '/failure.png' }).catch(() => {}); throw e; }
finally { await browser.close(); }
