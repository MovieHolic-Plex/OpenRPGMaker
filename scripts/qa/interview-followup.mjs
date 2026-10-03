// Continue only the QA-owned interview project; verify a live content write, then reload.
import { firefox } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';

const out = 'verify-shots/interview-live-handoff';
const first = JSON.parse(readFileSync(out + '/report.json'));
if (!first.passed) throw Error('Initial interview handoff has not passed');
const report = { errors: [], requests: [], started: new Date().toISOString() };
const browser = await firefox.launch({ firefoxUserPrefs: { 'network.notify.changed': false } });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(120000);
page.on('pageerror', error => report.errors.push(error.message));
page.on('request', request => {
  if (!request.url().includes('/v1/agent/run') || request.method() !== 'POST') return;
  const buffer = request.postDataBuffer();
  const body = JSON.parse(buffer?.[0] === 31 ? gunzipSync(buffer) : buffer);
  report.requests.push({ mode: body.mode, model: body.model, runId: body.runId });
});
const save = () => writeFileSync(out + '/followup.json', JSON.stringify(report, null, 2) + '\n');
const read = () => {
  const db = new DatabaseSync(first.afterReload.dir + '/project.sqlite', { readOnly: true });
  try {
    const row = db.prepare('SELECT project_id,revision,current_json FROM project WHERE id=1').get();
    const map = db.prepare("SELECT map_json FROM maps WHERE map_id='map_blank_start'").get();
    return {
      id: row.project_id, revision: row.revision,
      brief: JSON.parse(row.current_json).gameDesignBrief,
      event: JSON.parse(map.map_json).events.find(event => event.id === 'ev_interview_qa_neighbor') ?? null,
    };
  } finally { db.close(); }
};
const stop = async () => {
  if (await page.evaluate(() => window.__oprnAiBridge?.status().turnBusy ?? false)) {
    await page.evaluate(() => window.__oprnAiBridge.abort());
    await page.waitForFunction(() => !window.__oprnAiBridge.status().turnBusy, null, { timeout: 30000 });
  }
};

try {
  save();
  await page.goto(first.newFolderUrl);
  await page.waitForFunction(() => window.__oprnAiBridge?.status().ready, null, { timeout: 180000 });
  report.before = read();
  // The public bridge's send uses AssistantSession for external/DB surfaces.
  // Exercise the actual composer, which routes /pi through the shipped Pi path.
  await page.getByTestId('ai-input').fill(readFileSync('scripts/qa/interview-content-prompt.txt', 'utf8'));
  await page.getByTestId('ai-send').click();
  const until = Date.now() + 12 * 60000;
  while (Date.now() < until) {
    await page.waitForTimeout(5000);
    report.after = read();
    // Initial proposal capture can occupy the renderer longer than locator's 30s
    // deadline. Storage is the oracle; the diagnostic text must not abort the run.
    report.chatTail = (await page.evaluate(() => document.body.innerText)).slice(-2500);
    save();
    if (report.after.event) { report.applied = true; break; }
    if (report.requests.length && !await page.evaluate(() => window.__oprnAiBridge?.status().turnBusy ?? true)) {
      report.finished = true; break;
    }
  }
  await stop();
  report.status = await page.evaluate(() => window.__oprnAiBridge.status());
  await page.waitForTimeout(3000);
  report.beforeReload = read();
  await page.screenshot({ path: out + '/content-assistant.png', timeout: 120000 });
  await page.reload();
  await page.waitForFunction(() => window.__oprnAiBridge?.status().ready, null, { timeout: 180000 });
  // The AI dock mounts before map textures finish decoding.
  await page.waitForTimeout(12000);
  report.afterReload = read();
  const event = JSON.stringify(report.afterReload.event);
  report.requestedContent = ['지우, 이웃에 오신 걸 환영해요.', '반갑게 인사한다', '조심스럽게 묻는다']
    .every(text => event.includes(text));
  report.sameBrief = JSON.stringify(report.before.brief) === JSON.stringify(report.afterReload.brief);
  report.passed = report.requests.length > 0 && !!report.afterReload.event && report.requestedContent && report.sameBrief
    && report.beforeReload.id === report.afterReload.id
    && JSON.stringify(report.beforeReload.event) === event && report.errors.length === 0;
  await page.screenshot({ path: out + '/content-reloaded.png', timeout: 120000 });
} catch (error) {
  report.failure = error.message;
  report.body = (await page.locator('body').innerText().catch(() => '')).slice(-1800);
  await page.screenshot({ path: out + '/followup-failure.png' }).catch(() => {});
  throw error;
} finally {
  await stop().catch(() => {});
  save();
  await browser.close();
}
console.log(JSON.stringify(report));
process.exitCode = report.passed ? 0 : 1;
