// Actual assistant repair of a saved game's opening; deliberately distinct from fresh generation.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
const out = resolve(process.env.LIVE_GAME_OUT ?? 'verify-shots/opening-production');
const base = 'http://127.0.0.1:18435';
const dir = resolve('output/qa/first-presentation/project/.oprn-projects/ed85bb3b-e221-4955-8fd6-e0afdc2ce590');
const projectUrl = base + '/index.html?hostProject=ed85bb3b-e221-4955-8fd6-e0afdc2ce590';
mkdirSync(out, { recursive: true });
const report = { base, projectUrl, editorRenderer: process.env.OPENING_EDITOR_CANVAS === '1' ? 'Chromium Canvas (runtime WebGL verified separately)' : 'Chromium SwiftShader', mode: 'actual assistant storyboard, music selection/composition and layered art repair of existing saved game', requests: [], errors: [] };
const save = () => writeFileSync(out + '/completion.json', JSON.stringify(report, null, 2) + '\n');
function snapshot() {
  const db = new DatabaseSync(dir + '/project.sqlite', { readOnly: true });
  try {
    const row = db.prepare('select project_id,revision,current_json from project where id=1').get();
    const document = JSON.parse(row.current_json);
    const maps = db.prepare('select map_id,map_json from maps order by map_id').all();
    const ids = document.system.opening?.scenes.filter(s => s.kind === 'image').flatMap(s => [s.resourceId, ...(s.direction?.layers?.map(l => l.resourceId) ?? [])]) ?? [];
    if (document.system.opening?.musicResourceId) ids.push(document.system.opening.musicResourceId);
    return { dir, projectId: row.project_id, revision: row.revision, mapsHash: createHash('sha256').update(JSON.stringify(maps)).digest('hex'),
      opening: document.system.opening, title: document.system.titleScreen,
      art: ids.map(id => ({ id, name: document.assets.uploaded[id]?.name, ref: document.assets.uploaded[id]?.ref })) };
  } finally { db.close(); }
}
const task = readFileSync(process.env.LIVE_OPENING_TASK_FILE ?? out + '/task.txt', 'utf8');
const browser = await chromium.launch({ args: process.env.OPENING_EDITOR_CANVAS === '1' ? ['--disable-webgl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width:1440, height:900 } });
page.on('crash', () => { report.crashed=true; save(); });
page.on('pageerror', e => { report.errors.push(e.message); save(); });
page.on('request', r => {
  if (!r.url().includes('/v1/agent/run') || r.method() !== 'POST') return;
  const bytes=r.postDataBuffer(), body=JSON.parse(bytes?.[0]===31 ? gunzipSync(bytes) : bytes);
  report.requests.push({ runId:body.runId, model:body.model, mode:body.mode, characters:body.task?.length, requestOrigin:new URL(r.url()).origin, imageProvider:body.imageProvider, imageModel:body.imageModel }); save();
});
try {
  report.before=snapshot();
  const recordsDb=new DatabaseSync(dir+'/project.sqlite',{readOnly:true});
  try { report.previousUserRecords=recordsDb.prepare('select entries_json from ai_conversations').all().flatMap(row=>JSON.parse(row.entries_json).filter(e=>e.kind==='user').map(e=>({kind:e.kind,characters:JSON.stringify(e).length}))); } finally { recordsDb.close(); }
  save();
  await page.goto(projectUrl,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready && !window.__oprnAiBridge.status().turnBusy,null,{timeout:300000});
  report.recordDatabases=await page.evaluate(async()=> (await indexedDB.databases()).map(d=>d.name));
  if (process.env.LIVE_OPENING_IMAGE_PROVIDER) {
    await page.getByTestId('topbar-ai-settings').click();
    await page.getByTestId('ai-settings-tab-models').click();
    await page.getByTestId('ai-config-image-provider').selectOption(process.env.LIVE_OPENING_IMAGE_PROVIDER);
    await page.getByTestId('ai-settings-close').click();
  }
  await page.getByTestId('ai-input').fill(task);
  report.sentAt=new Date().toISOString();save();
  await page.getByTestId('ai-send').click();
  const until=Date.now()+30*60*1000;
  while(Date.now()<until) {
    await page.waitForTimeout(5000);
    report.chatTail=(await page.getByTestId('ai-chat-log').innerText()).slice(-3000);
    report.latest=snapshot();save();
    if (!await page.evaluate(()=>window.__oprnAiBridge.status().turnBusy) && (report.requests.length || /지시 해석 실패|worker exited/u.test(report.chatTail))) break;
  }
  if (!report.requests.length) throw new Error('Actual agent run did not start: ' + report.chatTail.slice(-700));
  const html=await(await fetch(base+'/index.html')).text();
  const config=JSON.parse(html.match(/window\.__OPRN_BRIDGE__=(\{[^<]+\})<\/script>/)[1]);
  const wire=await fetch(base+'/v1/agent/run?provider=google-antigravity&runId='+report.requests.at(-1).runId,{headers:{'x-oprn-companion-token':config.companionToken,origin:base},signal:AbortSignal.timeout(5000)});
  const events=(await wire.text()).trim().split('\n').map(line=>JSON.parse(line));
  report.workerCompleted=events.some(e=>e.type==='done');
  report.imageGenerationFailures=events.filter(e=>e.type==='tool_end'&&e.name==='generate_opening_image'&&e.ok===false).map(e=>e.summary);
  report.successfulImageGenerations=events.filter(e=>e.type==='tool_end'&&e.name==='generate_opening_image'&&e.ok===true).length;
  // Keep the structured event receipt; image bytes stay in the canonical asset store.
  writeFileSync(out+'/repair-wire.json',JSON.stringify(events,(key,value)=>key==='dataUrl'||key==='base64'?undefined:(value?.type==='image'?{type:'image',mimeType:value.mimeType,base64Length:value.data?.length}:value),2)+'\n');
  await page.waitForTimeout(3000);report.beforeReload=snapshot();
  await page.screenshot({path:out+'/authored.png'});
  await page.reload();await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready,null,{timeout:300000});
  report.afterReload=snapshot();
  const shots=report.afterReload.opening?.scenes.filter(s=>s.kind==='image')??[];
  report.originalMusicGenerated=events.filter(e=>e.type==='tool_end'&&e.name==='generate_original_bgm'&&e.ok===true).length;
  report.musicCompared=events.filter(e=>e.type==='tool_end'&&e.name==='recommend_bgm'&&e.ok===true).length;
  const calls = new Map(events.filter(e=>e.type==='tool_start').map(e=>[e.id,e]));
  report.successfulForegroundGenerations=events.filter(e=>e.type==='tool_end'&&e.name==='generate_opening_image'&&e.ok===true&&calls.get(e.id)?.args?.role==='foreground').length;
  report.layers=shots.flatMap(s=>s.direction?.layers??[]).length;
  report.persisted=JSON.stringify(report.beforeReload)===JSON.stringify(report.afterReload);
  report.passed=report.workerCompleted&&report.persisted&&report.before.mapsHash===report.afterReload.mapsHash&&shots.length>=5&&new Set(shots.map(s=>s.resourceId)).size>=5&&report.originalMusicGenerated>=1&&report.musicCompared>=1&&report.layers>=2&&report.successfulImageGenerations>=7&&report.afterReload.opening.scenes.every(s=>s.presentation?.preset)&&JSON.stringify(report.before.title)===JSON.stringify(report.afterReload.title)&&!report.errors.length;
  await page.screenshot({path:out+'/reloaded.png'});
} catch(e) { report.failure=e.message;await page.screenshot({path:out+'/failure.png',timeout:5000}).catch(()=>{}); }
finally { if(!report.workerCompleted) await Promise.race([page.evaluate(()=>window.__oprnAiBridge?.abort()).catch(()=>{}),new Promise(r=>setTimeout(r,5000))]);save();await browser.close(); }
console.log(JSON.stringify({passed:report.passed,failure:report.failure,revision:report.afterReload?.revision,shots:report.afterReload?.opening?.scenes.length,layers:report.layers,music:report.afterReload?.opening?.musicResourceId,generated:report.successfulImageGenerations}));
process.exitCode=report.passed?0:1;
