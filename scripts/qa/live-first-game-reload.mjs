// Recover observation of an already completed run. Never submit another AI task
// or edit the game, and preserve the original generation failure report.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const out = resolve(process.env.LIVE_GAME_OUT ?? 'verify-shots/live-first-game');
const initial = JSON.parse(readFileSync(out + '/generation.json', 'utf8'));
const report = { started: new Date().toISOString(), projectUrl: initial.projectUrl,
  requests: initial.requests, originalObserverFailure: initial.failure,
  automaticGeneration: true, additionalModelRequests: 0, errors: [] };
const save = () => writeFileSync(out + '/reloaded.json', JSON.stringify(report, null, 2) + '\n');
const hash = value => createHash('sha256').update(value).digest('hex');
function snapshot() {
  const dir = resolve(initial.root, '.oprn-projects', new URL(initial.projectUrl).searchParams.get('hostProject'));
  const db = new DatabaseSync(dir + '/project.sqlite', { readOnly: true });
  try {
    const row = db.prepare('SELECT project_id,title,revision,current_json FROM project WHERE id=1').get();
    const document = JSON.parse(row.current_json);
    const maps = db.prepare('SELECT map_id,map_json FROM maps ORDER BY map_id').all();
    const starter = maps.flatMap(m => JSON.parse(m.map_json).events ?? []).find(e => e.id === 'ev_segment_starter');
    const choice = starter?.pages.flatMap(p => p.commands).find(c => c.kind === 'choices');
    return { dir, projectId: row.project_id, title: row.title, revision: row.revision,
      brief: document.gameDesignBrief, documentHash: hash(row.current_json), mapsHash: hash(JSON.stringify(maps)),
      branches: choice?.options.map(o => ({text:o.text, lines:o.branch.filter(c => c.kind === 'text').map(c => c.body)})),
      maps: maps.map(m => {const v = JSON.parse(m.map_json); return {id:m.map_id,name:v.name,events:v.events.length};}) };
  } finally { db.close(); }
}
const browser = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
page.on('pageerror', e => {report.errors.push(e.message);save();});
page.on('request', r => {
  if (new URL(r.url()).pathname === '/v1/agent/run' && r.method() === 'POST') {
    report.additionalModelRequests++; save();
  }
});
try {
  report.beforeReload = snapshot(); save();
  // The owner's normal response supplies credentials only in memory.
  const response = await fetch(initial.base + '/index.html');
  const html = await response.text();
  const embedded = html.match(/window\.__OPRN_BRIDGE__=(\{[^<]+\})<\/script>/);
  const token = embedded && JSON.parse(embedded[1]).companionToken;
  const cookie = response.headers.getSetCookie().map(s => s.split(';')[0]).join('; ');
  const captured = existsSync(out + '/wire.json') ? readFileSync(out + '/wire.json', 'utf8') : null;
  const receipts = captured ? JSON.parse(captured) : [];
  report.wireSource = captured ? 'previously captured original server receipts' : 'original server run';
  if (captured) report.wireSha256 = hash(captured);
  for (const request of captured ? [] : initial.requests) {
    const wire = await fetch(initial.base + '/v1/agent/run?provider=google-antigravity&runId=' + request.runId,
      {headers:{origin:initial.base,...(token?{'x-oprn-companion-token':token}:{}),...(cookie?{cookie}:{})},
        signal:AbortSignal.timeout(15000)});
    assert.equal(wire.status, 200);
    const events = (await wire.text()).split('\n').filter(Boolean).map(line => {
      const e = JSON.parse(line), inner = e.event ?? e;
      return {seq:e.seq,type:e.type,at:e.at,innerType:inner.type,agent:inner.agentId??e.agentId,
        tool:inner.toolName,name:inner.name,ok:inner.ok,summary:inner.summary?.slice(0,300),
        message:inner.message,stats:inner.stats?{turns:inner.stats.turns,toolCalls:inner.stats.toolCalls}:undefined};
    });
    receipts.push({runId:request.runId,status:wire.status,events});
    assert(events.some(e => e.type === 'done'), 'The original run must have reached terminal completion');
  }
  assert.deepEqual(receipts.map(r => r.runId), initial.requests.map(r => r.runId));
  assert(receipts.every(r => r.status === 200 && r.events.some(e => e.type === 'done')));
  writeFileSync(out + '/wire.json', JSON.stringify(receipts,null,2)+'\n');
  const events = receipts.flatMap(r => r.events);
  const core = events.findIndex(e => e.name === 'first_play.core_ready' && e.ok);
  const reviewed = events.findIndex(e => e.name === 'first_play.review_passed' && e.ok);
  const decorated = events.findIndex(e => ['stamp_object','copy_map_region','author_village','paint_tiles'].includes(e.name??e.tool));
  report.wireCompleted = receipts.length > 0;
  report.coreFirstVerified = core >= 0 && reviewed > core && (decorated < 0 || decorated > reviewed);
  report.firstSceneReviewed = events.some((e,i) => i > reviewed && e.name === 'first_scene.review_passed' && e.ok)
    && events.some(e => e.name === 'map.image.delivered' && e.ok);
  assert(report.coreFirstVerified && report.firstSceneReviewed, 'Automatic core and actual first-scene image reviews must pass');
  await page.goto(initial.projectUrl,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.__oprnAiBridge?.status().ready,null,{timeout:180000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.__oprnAiBridge?.status().ready,null,{timeout:180000});
  // The AI panel registers before the map's lazy Phaser scene has booted.
  await page.waitForFunction(() => window.__oprnEditMapViewport?.()?.mapId,null,{timeout:180000});
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  report.afterReload = snapshot();
  assert.equal(report.afterReload.projectId, report.beforeReload.projectId);
  assert.equal(report.afterReload.mapsHash, report.beforeReload.mapsHash);
  assert.deepEqual(report.afterReload.brief, report.beforeReload.brief);
  assert.equal(report.additionalModelRequests, 0, 'Recovery must not rerun or repair the game');
  assert.equal(report.errors.length,0);
  assert.equal(report.afterReload.branches.length,2);
  assert(/간직/.test(report.afterReload.branches[0].text) && /놓아/.test(report.afterReload.branches[1].text));
  assert(report.afterReload.branches.every(b => b.lines.length));
  assert.notEqual(report.afterReload.branches[0].lines[0],report.afterReload.branches[1].lines[0]);
  assert(initial.requests.length === 1 && initial.requests[0].planIncluded && initial.requests[0].premiseIncluded && initial.requests[0].protagonistIncluded);
  await page.screenshot({path:out+'/reloaded.png'});
  report.persisted = true; report.passed = true; report.generationPrerequisitePassed = true;
  report.gameplayVerified = false; report.exportPackageVerified = false;
} catch (e) {
  report.failure=e.message;report.passed=false;process.exitCode=1;
  await page.screenshot({path:out+'/reload-failure.png'}).catch(()=>{});
} finally {save();await browser.close();}
console.log(JSON.stringify({passed:report.passed,projectId:report.afterReload?.projectId,
  additionalModelRequests:report.additionalModelRequests,failure:report.failure}));
