// Real new-project UI and model, backed by an isolated canonical SQLite host.
// A completed run is a prerequisite, never a claim that gameplay/export passed.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const base = process.env.LIVE_GAME_HOST ?? 'http://127.0.0.1:18432';
const root = resolve(process.env.LIVE_GAME_ROOT ?? 'output/qa/live-first-game/project');
const out = resolve(process.env.LIVE_GAME_OUT ?? 'verify-shots/live-first-game');
mkdirSync(out, { recursive: true });
const report = { base, root, started: new Date().toISOString(), requests: [], errors: [], questions: [] };
const save = () => writeFileSync(out + '/generation.json', JSON.stringify(report, null, 2) + '\n');
const stage = value => { report.stage = value; save(); console.log('stage', value); };
const hash = value => createHash('sha256').update(value).digest('hex');
// Local hosts use the bridge token; team hosts use the browser's owner session.
// Keep both only in memory and never put them in reports.
let companionToken;
async function recordWire() {
  const html = await (await fetch(base + '/index.html', { signal: AbortSignal.timeout(5000) })).text();
  const embedded = html.match(/window\.__OPRN_BRIDGE__=(\{[^<]+\})<\/script>/);
  const token = companionToken ?? (embedded && JSON.parse(embedded[1]).companionToken);
  const cookies = await page.context().cookies(base);
  const cookie = cookies.map(row => `${row.name}=${row.value}`).join('; ');
  const receipts = [];
  for (const request of report.requests) {
    const headers = { origin: base, ...(token ? { 'x-oprn-companion-token': token } : {}), ...(cookie ? { cookie } : {}) };
    let pending = ''; const events = []; const decoder = new TextDecoder();
    const receipt = { runId: request.runId, events };
    try {
      const response = await fetch(base + '/v1/agent/run?provider=google-antigravity&runId=' + request.runId,
        { headers, signal: AbortSignal.timeout(5000) });
      receipt.status = response.status;
      for await (const chunk of response.body) {
        pending += decoder.decode(chunk, { stream: true });
        let i;
        while ((i = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, i); pending = pending.slice(i + 1);
          if (!line.trim()) continue;
          const e = JSON.parse(line), inner = e.event ?? e;
          events.push({ seq: e.seq, type: e.type, at: e.at, innerType: inner.type,
            innerAt: inner.at, agent: inner.agentId ?? e.agentId, tool: inner.toolName, bytes: line.length,
            name: inner.name, ok: inner.ok, summary: inner.summary?.slice(0, 300), message: inner.message });
        }
      }
    } catch (error) { receipt.failure = error.message; }
    receipts.push(receipt);
    if (!events.some(e => e.type === 'done')) {
      await fetch(base + '/v1/agent/cancel?provider=google-antigravity', { method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ runId: request.runId }),
        signal: AbortSignal.timeout(5000) }).catch(() => {});
    }
  }
  writeFileSync(out + '/wire.json', JSON.stringify(receipts, null, 2) + '\n');
  report.wireCompleted = receipts.length > 0 && receipts.every(r => r.events.some(e => e.type === 'done'));
  const events = receipts.flatMap(receipt => receipt.events);
  const core = events.findIndex(event => event.name === 'first_play.core_ready' && event.ok === true);
  const review = events.findIndex(event => event.name === 'first_play.review_passed' && event.ok === true);
  const decoration = events.findIndex(event => ['stamp_object', 'copy_map_region', 'author_village', 'paint_tiles'].includes(event.name ?? event.tool));
  report.coreFirstVerified = core >= 0 && review > core && (decoration < 0 || decoration > review);
  report.coreReadyAt = events[core]?.at;
  report.coreReviewedAt = events[review]?.at;
  const sceneReview = events.findIndex(event => event.name === 'first_scene.review_passed' && event.ok === true);
  report.firstSceneReviewed = sceneReview > review && events.some(event => event.name === 'map.image.delivered' && event.ok === true);
  report.firstSceneReviewedAt = events[sceneReview]?.at;
}
function snapshot() {
  const folder = new URL(report.projectUrl).searchParams.get('hostProject');
  const dir = resolve(root, '.oprn-projects', folder);
  const db = new DatabaseSync(dir + '/project.sqlite', { readOnly: true });
  try {
    const row = db.prepare('SELECT project_id,title,revision,current_json FROM project WHERE id=1').get();
    const document = JSON.parse(row.current_json);
    const maps = db.prepare('SELECT map_id,map_json FROM maps ORDER BY map_id').all();
    const commits = db.prepare("SELECT author_kind,tool_names_json,summary FROM commits WHERE tool_names_json != '[]' ORDER BY created_at").all();
    const records = db.prepare('SELECT entries_json FROM ai_conversations').all();
    const starter = maps.flatMap(m => JSON.parse(m.map_json).events ?? []).find(e => e.id === 'ev_segment_starter');
    const choice = (starter?.pages?.flatMap(p => p.commands) ?? starter?.commands ?? []).find(c => c.kind === 'choices');
    const branches = choice?.options?.map(o => ({ text: o.text, lines: o.branch.filter(c => c.kind === 'text').map(c => c.body) })) ?? [];
    return { dir, projectId: row.project_id, title: row.title, revision: row.revision, branches,
      genre: document.system.genre, brief: document.gameDesignBrief,
      documentHash: hash(row.current_json), mapsHash: hash(JSON.stringify(maps)),
      maps: maps.map(m => { const v = JSON.parse(m.map_json); return { id: m.map_id, name: v.name, events: v.events?.length ?? 0 }; }),
      commits: commits.map(c => ({ author: c.author_kind, tools: JSON.parse(c.tool_names_json), summary: c.summary })),
      records: records.map(r => JSON.parse(r.entries_json).map(e => ({ kind: e.kind, characters: JSON.stringify(e).length }))) };
  } finally { db.close(); }
}
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=6144'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
page.on('pageerror', e => { report.errors.push(e.message); save(); });
page.on('request', request => {
  if (!request.url().includes('/v1/agent/run') || request.method() !== 'POST') return;
  companionToken = request.headers()['x-oprn-companion-token'] ?? companionToken;
  try {
    const bytes = request.postDataBuffer();
    const body = JSON.parse(bytes?.[0] === 31 ? gunzipSync(bytes) : bytes);
    const task = String(body.task ?? '');
    writeFileSync(out + '/actual-first-task.txt', task + '\n');
    report.requests.push({ mode: body.mode, model: body.model, runId: body.runId,
      characters: task.length, planIncluded: task.includes('"id":"P03"'),
      premiseIncluded: task.includes('회중시계'), protagonistIncluded: task.includes('서린'),
      time: new Date().toISOString() });
    save(); console.log('model request', JSON.stringify(report.requests.at(-1)));
  } catch (e) { report.errors.push(e.message); save(); }
});
try {
  stage('initial-records');
  const initial = new DatabaseSync(root + '/project.sqlite', { readOnly: true });
  report.initialConversations = initial.prepare('SELECT COUNT(*) AS count FROM ai_conversations').get().count;
  initial.close();
  stage('welcome');
  await page.goto(base + '/index.html?forceWelcome=1');
  await page.getByTestId('editor-welcome').waitFor({ timeout: 120000 });
  await page.getByTestId('editor-welcome-skip').click();
  stage('browser-records');
  report.initialBrowserRecordDatabases = await page.evaluate(async () => (await indexedDB.databases()).map(v => v.name));
  report.initialBrowserConversations = await page.evaluate(() => Promise.race([new Promise((resolve, reject) => {
    const request = indexedDB.open('oprn-ai-records');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('conversations')) { db.close(); resolve([]); return; }
      const rows = db.transaction('conversations').objectStore('conversations').getAll();
      rows.onerror = () => { db.close(); reject(rows.error); };
      rows.onsuccess = () => { db.close(); resolve(rows.result.map(row => ({ id: row.id,
        userEntries: (row.entries ?? []).filter(entry => entry.kind === 'user').length }))); };
    };
  }), new Promise(resolve => setTimeout(() => resolve({ unavailable: 'record read exceeded 5 seconds' }), 5000))]));
  stage('new-project');
  await page.locator('.studio-project-button').click();
  await page.getByTestId('menu-project-new').click();
  await page.getByTestId('new-project-name-input').fill('멈춘 시계의 기억');
  await page.getByTestId('new-project-confirm').click();
  stage('interview');
  await page.getByTestId('project-interview').waitFor({ timeout: 30000 });
  await page.getByTestId('project-interview-genre-mystery').click();
  await page.getByTestId('project-interview-concept').fill('서린이 멈춘 회중시계를 조사하고 기억을 되찾는 짧은 회상 스토리. 회중시계 조사 → 기억을 간직하거나 놓아주는 두 선택지 → 선택에 따라 다른 대사 → 기억의 길 → 첫 구간 엔딩. 3분 안에 완주할 수 있는 작은 게임으로 실제 제작한다.');
  await page.getByTestId('project-interview-begin').click();
  for (let i = 0; i < 8 && !(await page.getByTestId('project-interview-summary').count()); i++) {
    const question = await page.locator('#project-interview-question').count()
      ? page.locator('#project-interview-question') : page.locator('#project-interview-title');
    report.questions.push({ question: await question.innerText(),
      options: await page.locator('[data-testid^="project-interview-option-"]').allInnerTexts() });
    await page.getByTestId('project-interview-option-0').click();
    await page.getByTestId('project-interview-next').click();
  }
  await page.getByTestId('project-interview-protagonist').fill('서린. 잃어버린 기억을 회중시계에서 찾는다. 외형은 미정이다.');
  await page.getByTestId('project-interview-summary').fill('서린의 회상 스토리 「멈춘 시계의 기억」. 첫 구간만 완성한다. 시작 맵에서 회중시계를 조사하면 기억을 간직한다 / 놓아준다 두 선택지가 나온다. 각 선택은 서로 다른 대사를 보여주고 기억의 길로 진행할 수 있게 한다. 마지막에서 첫 구간 엔딩을 본다. 작고 명확한 3분 게임으로 기본 제공 타일·캐릭터를 사용한다. 모든 대화와 이동 및 엔딩을 실제 이벤트로 제작하고 저장한다.');
  await page.screenshot({ path: out + '/confirmed.png' });
  report.confirmedAt = new Date().toISOString(); save();
  await page.getByTestId('project-interview-confirm').click();
  stage('automatic-generation');
  await page.waitForURL(url => url.searchParams.has('hostProject'), { timeout: 90000 });
  report.projectUrl = page.url(); save();
  await page.locator('.topbar').waitFor({ timeout: 120000 });
  const until = Date.now() + 20 * 60 * 1000;
  let tick = 0;
  while (Date.now() < until) {
    await page.waitForTimeout(5000);
    report.chatTail = (await page.getByTestId('ai-chat-log').innerText().catch(() => '')).slice(-7000);
    report.elapsedSeconds = Math.round((Date.now() - Date.parse(report.confirmedAt)) / 1000);
    report.latest = snapshot();
    if (!report.firstCommitAt && report.latest.commits.length) {
      report.firstCommitAt = new Date().toISOString();
      report.firstCommitSeconds = (Date.parse(report.firstCommitAt) - Date.parse(report.confirmedAt)) / 1000;
      await page.screenshot({ path: out + '/first-change.png' });
    }
    save();
    if (++tick % 6 === 0) console.log(JSON.stringify({ seconds: report.elapsedSeconds,
      runs: report.requests.length, commits: report.latest.commits.length, chat: report.chatTail.slice(-1600) }));
    const busy = await page.evaluate(() => window.__oprnAiBridge?.status().turnBusy ?? true);
    if (report.requests.length && !busy && report.chatTail.length > 80) { report.modelFinished = true; break; }
  }
  if (!report.modelFinished) {
    await page.evaluate(() => window.__oprnAiBridge?.abort());
    throw Error('Live first-build did not finish within 20 minutes');
  }
  await page.waitForTimeout(5000);
  report.beforeReload = snapshot();
  await page.screenshot({ path: out + '/generated.png' });
  report.taskLeakedIntoChat = (await page.getByTestId('ai-chat-log').innerText()).includes('"id":"P03"');
  await page.reload();
  await page.waitForFunction(() => window.__oprnAiBridge?.status().ready, null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  report.afterReload = snapshot();
  report.persisted = report.beforeReload.projectId === report.afterReload.projectId
    && report.beforeReload.mapsHash === report.afterReload.mapsHash
    && JSON.stringify(report.beforeReload.brief) === JSON.stringify(report.afterReload.brief);
  report.requestedBranchesAuthored = report.afterReload.branches.length === 2
    && /간직/.test(report.afterReload.branches[0].text) && /놓아/.test(report.afterReload.branches[1].text)
    && report.afterReload.branches.every(b => b.lines.length)
    && report.afterReload.branches[0].lines[0] !== report.afterReload.branches[1].lines[0];
  report.generationPrerequisitePassed = report.modelFinished && report.persisted && report.requestedBranchesAuthored
    && report.beforeReload.commits.length > 0 && !report.taskLeakedIntoChat
    && report.requests.some(r => r.planIncluded && r.premiseIncluded && r.protagonistIncluded);
  report.gameplayVerified = false; report.exportPackageVerified = false;
  await page.screenshot({ path: out + '/reloaded.png' });
} catch (e) {
  report.failure = e.message;
  await page.screenshot({ path: out + '/failure.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (report.requests.length) {
    try { await recordWire(); } catch (e) { report.wireFailure = e.message; }
  }
  report.generationPrerequisitePassed = Boolean(report.generationPrerequisitePassed && report.wireCompleted && report.coreFirstVerified && report.firstSceneReviewed);
  if (!report.generationPrerequisitePassed) process.exitCode = 1;
  save(); await browser.close();
}
console.log(JSON.stringify({ finished: report.modelFinished, prerequisite: report.generationPrerequisitePassed,
  firstCommitSeconds: report.firstCommitSeconds, failure: report.failure, projectId: report.afterReload?.projectId }));
