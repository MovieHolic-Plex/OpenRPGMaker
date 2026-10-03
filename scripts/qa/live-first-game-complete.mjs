// Explicit live-model repair after an unfinished automatic first build.
// Keep this receipt separate: repair success is not automatic-generation success.
import { firefox } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
const out = resolve('verify-shots/live-first-game');
const first = JSON.parse(readFileSync(out + '/generation.json'));
const report = { projectUrl: first.projectUrl, automaticBuildCompleted: false, requests: [], errors: [] };
const save = () => writeFileSync(out + '/completion.json', JSON.stringify(report, null, 2) + '\n');
function snapshot() {
  const db = new DatabaseSync(first.latest.dir + '/project.sqlite', { readOnly: true });
  try {
    const row = db.prepare('SELECT project_id,title,revision,current_json FROM project WHERE id=1').get();
    const maps = db.prepare('SELECT map_id,map_json FROM maps ORDER BY map_id').all();
    const document = JSON.parse(row.current_json);
    return { dir: first.latest.dir, projectId: row.project_id, revision: row.revision, title: row.title,
      brief: document.gameDesignBrief, mapsHash: createHash('sha256').update(JSON.stringify(maps)).digest('hex'),
      commits: db.prepare("SELECT COUNT(*) AS count FROM commits WHERE tool_names_json != '[]'").get().count,
      events: maps.flatMap(r => JSON.parse(r.map_json).events).map(e => ({ id: e.id,
        choices: (e.pages ?? []).flatMap(p => p.commands).filter(c => c.kind === 'choices').map(c => c.options.map(o => o.text)) })) };
  } finally { db.close(); }
}
const task = process.env.LIVE_GAME_REPAIR_TASK ?? ('저장된 확정 기획의 핵심 플레이부터 완성해 줘. 바닥과 오브젝트 배치는 이미 충분하니 이번 요청에서는 배치·타일·새 맵·그림 생성 작업을 하지 않는다. '
  + '주인공 서린의 「멈춘 시계의 기억」 첫 구간만 완성한다. 시작 맵 map_blank_start의 ev_segment_starter(12,8)를 회중시계 조사 이벤트로 바꾼다. '
  + '첫 조사에 짧은 대사와 정확히 두 선택지: 1 기억을 간직한다, 2 기억을 놓아준다. 각 선택은 서로 다른 짧은 결과 대사를 보여 주고 sw_segment_key를 켠다. '
  + '기존 동쪽 문과 map_segment_route 이동은 유지한다. map_segment_route의 ev_segment_end(22,6)는 길 끝에서 조사하면 ending_first_segment 엔딩을 보여 줘야 한다. '
  + '기존 구간 종료 스위치와 엔딩을 보존하고 조건이 부족하면 실제 도구로 보완한다. 다른 오프닝이나 타이틀 작업은 하지 않는다. '
  + '실제 upsert_event 등 저작 도구로 제작하고, 끝까지 갈 수 있는지 확인한 후 작업을 끝내라. 설명만 하는 것은 완료가 아니다.');
const browser = await firefox.launch({ firefoxUserPrefs: { 'network.notify.changed': false } });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
page.on('pageerror', e => { report.errors.push(e.message); save(); });
page.on('request', r => {
  if (!r.url().includes('/v1/agent/run') || r.method() !== 'POST') return;
  const b = r.postDataBuffer(), body = JSON.parse(b?.[0] === 31 ? gunzipSync(b) : b);
  report.requests.push({ runId: body.runId, model: body.model, mode: body.mode, characters: body.task?.length }); save();
});
try {
  report.before = snapshot(); save();
  await page.goto(first.projectUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__oprnAiBridge?.status().ready && !window.__oprnAiBridge.status().turnBusy, null, { timeout: 180000 });
  await page.getByTestId('ai-input').fill(task);
  report.sentAt = new Date().toISOString();
  await page.getByTestId('ai-send').click();
  const until = Date.now() + 10 * 60 * 1000;
  while (Date.now() < until) {
    await page.waitForTimeout(5000);
    report.chatTail = (await page.getByTestId('ai-chat-log').innerText()).slice(-4500);
    report.latest = snapshot(); save();
    if (report.requests.length && !await page.evaluate(() => window.__oprnAiBridge.status().turnBusy)) break;
  }
  const html = await (await fetch(first.base + '/index.html')).text();
  const config = JSON.parse(html.match(/window\.__OPRN_BRIDGE__=(\{[^<]+\})<\/script>/)[1]);
  const wire = await fetch(first.base + '/v1/agent/run?provider=google-antigravity&runId=' + report.requests.at(-1).runId,
    { headers: { 'x-oprn-companion-token': config.companionToken, origin: first.base }, signal: AbortSignal.timeout(5000) });
  const events = (await wire.text()).trim().split('\n').map(line => JSON.parse(line));
  report.workerCompleted = events.some(e => e.type === 'done');
  report.wire = events.filter(e => e.type === 'done' || e.type === 'error').map(e => ({ type: e.type, message: e.message, stats: e.stats }));
  await page.waitForTimeout(5000); report.beforeReload = snapshot();
  await page.screenshot({ path: out + '/completed.png' });
  await page.reload(); await page.waitForFunction(() => window.__oprnAiBridge?.status().ready, null, { timeout: 180000 });
  report.afterReload = snapshot();
  report.persisted = report.beforeReload.projectId === report.afterReload.projectId && report.beforeReload.mapsHash === report.afterReload.mapsHash;
  const choices = report.afterReload.events.find(e => e.id === 'ev_segment_starter')?.choices;
  report.passed = report.workerCompleted && report.persisted && choices?.some(o => o.length === 2)
    && report.afterReload.commits > report.before.commits && !report.errors.length;
  await page.screenshot({ path: out + '/completion-reloaded.png' });
} catch (e) { report.failure = e.message; await page.screenshot({ path: out + '/completion-failure.png', timeout: 5000 }).catch(() => {}); }
finally {
  if (!report.workerCompleted) {
    await page.evaluate(() => window.__oprnAiBridge?.abort()).catch(() => {});
    // A disconnected UI may leave the owned host run alive. Cancel explicitly.
    if (report.requests.length) {
      try {
        const html = await (await fetch(first.base + '/index.html')).text();
        const config = JSON.parse(html.match(/window\.__OPRN_BRIDGE__=(\{[^<]+\})<\/script>/)[1]);
        await fetch(first.base + '/v1/agent/cancel?provider=google-antigravity', { method: 'POST',
          headers: { 'x-oprn-companion-token': config.companionToken, origin: first.base, 'content-type': 'application/json' },
          body: JSON.stringify({ runId: report.requests.at(-1).runId }), signal: AbortSignal.timeout(5000) });
      } catch { /* The host may already be stopped. */ }
    }
  }
  save(); await browser.close();
}
console.log(JSON.stringify({ passed: report.passed, failure: report.failure, projectId: report.afterReload?.projectId, events: report.afterReload?.events }));
process.exitCode = report.passed ? 0 : 1;
