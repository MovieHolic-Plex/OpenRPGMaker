// Actual assistant repair of a saved game's opening; deliberately distinct from fresh generation.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
const out = resolve(process.env.LIVE_GAME_OUT ?? 'verify-shots/opening-cinematic-v4');
const base = 'http://127.0.0.1:18435';
const dir = resolve('output/qa/first-presentation/project/.oprn-projects/ed85bb3b-e221-4955-8fd6-e0afdc2ce590');
const projectUrl = base + '/index.html?hostProject=ed85bb3b-e221-4955-8fd6-e0afdc2ce590';
mkdirSync(out, { recursive: true });
const report = { base, projectUrl, mode: 'explicit opening repair of existing saved game', requests: [], errors: [] };
const save = () => writeFileSync(out + '/completion.json', JSON.stringify(report, null, 2) + '\n');
function snapshot() {
  const db = new DatabaseSync(dir + '/project.sqlite', { readOnly: true });
  try {
    const row = db.prepare('select project_id,revision,current_json from project where id=1').get();
    const document = JSON.parse(row.current_json);
    const maps = db.prepare('select map_id,map_json from maps order by map_id').all();
    const ids = document.system.opening?.scenes.filter(s => s.kind === 'image').map(s => s.resourceId) ?? [];
    return { dir, projectId: row.project_id, revision: row.revision, mapsHash: createHash('sha256').update(JSON.stringify(maps)).digest('hex'),
      opening: document.system.opening, title: document.system.titleScreen,
      art: ids.map(id => ({ id, name: document.assets.uploaded[id]?.name, ref: document.assets.uploaded[id]?.ref })) };
  } finally { db.close(); }
}
const task = process.env.LIVE_OPENING_TASK_FILE ? readFileSync(process.env.LIVE_OPENING_TASK_FILE, 'utf8') : `저장된 「멈춘 시계의 기억」의 오프닝만 실제로 다시 제작해. 맵·이벤트·선택 결과·엔딩·확정 기획·기존 타이틀을 보존한다. 한 장을 확대하는 현재 오프닝은 불합격이다.
먼저 get_original_context/get_opening/show_title_opening으로 실제 기획과 원화를 본다. 이미 저장된 원경 opening_still_ba7e0a9f-9f39-4b2e-9951-76fd684cfe51를 첫 컷으로 재사용하고, 서로 다른 클로즈업과 중경 새 그림 두 장을 generate_opening_image로 생성해 세 컷으로 연결한다. 참조 resourceId는 실제 기존 opening_still_e080e045-5db1-43c0-bb73-0ddd9067fcf5 또는 새로 만든 첫 그림을 referenceResourceId로 전달한다. 실제 이미지 모델에 참조가 전달된다.
① 서재의 장소 소개: 멀리서 본 조용한 서재 전경, 책상 위에 작은 회중시계. 아직 기억의 이상 현상은 없다. 원경. ② 사건: 동일한 은색 회중시계의 정지한 바늘을 크게 클로즈업, 유리 안에서 기억의 빛이 새어나오는 상태. 원경으로 반복하지 마라. ③ 첫 행동 인계: 같은 책상과 시계를 옆에서 본 중경, 주인공 서린이 손을 뻗어 조사하려는 상황(기획과 실제 캐릭터에 맞게 외양을 유지하고 정면 얼굴을 새로 발명하지 않는다). 장소·물체·팔레트·화풍이 세 컷에서 일치해야 한다. 새로운 마을/전투/사건을 추가하지 마라. 그림에는 캡션·책의 글씨·서명·인물 이름·UI를 넣지 않는다(시계의 숫자/눈금만 허용).
모든 컷은 16:9 전체화면 그림, 각각 durationMs:4000, 총 12000ms, enabled:true/skippable:true. 자막은 컷당 25~35자 이내의 짧은 한 문장으로 장소→사건→행동을 전달한다. 기존 BGM은 유지한다. 이미지 생성 후 실제 그림을 보고 방향 좌표를 잡는다. direction으로 첫 컷은 느린 초점 이동과 창의 godRays/먼지 motes를 절제해서, 사건 컷은 cut + 시계의 glow + 적절한 실제 SE 한 번, 셋째 컷은 dissolve 500ms + 미세한 카메라 이동으로 구성한다. from/to=[x,y,zoom] 좌표0..1 배율1..1.6; 효과 glow는source, godRays/motes는source/toward(또는 motes.region) 필수. narrationDelayMs:300 정도를 사용한다. SE는 list_opening_media sound에서 실제 id를 골라 soundResourceId에 넣는다. 그림 한 장에 zoom 세 번을 붙이지 마라.
set_opening 후 show_title_opening으로 모든 그림을 다시 보고 구도 차이·동일 시계·서재·사건 전후·첫 조사 연결을 확인한다. 실패한 그림은 다시 만들고 실패를 숨기지 않는다. 실제 생성·등록·연결까지 수행하며 브라우저로 재생했다고 주장하지 마라.`;
writeFileSync(out + '/actual-repair-task.txt', task + '\n');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width:1440, height:900 } });
page.on('pageerror', e => { report.errors.push(e.message); save(); });
page.on('request', r => {
  if (!r.url().includes('/v1/agent/run') || r.method() !== 'POST') return;
  const bytes=r.postDataBuffer(), body=JSON.parse(bytes?.[0]===31 ? gunzipSync(bytes) : bytes);
  report.requests.push({ runId:body.runId, model:body.model, mode:body.mode, characters:body.task?.length, imageProvider:body.imageProvider, imageModel:body.imageModel }); save();
});
try {
  report.before=snapshot(); save();
  await page.goto(projectUrl,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready && !window.__oprnAiBridge.status().turnBusy,null,{timeout:180000});
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
  const until=Date.now()+12*60*1000;
  while(Date.now()<until) {
    await page.waitForTimeout(5000);
    report.chatTail=(await page.getByTestId('ai-chat-log').innerText()).slice(-3000);
    report.latest=snapshot();save();
    if(report.requests.length && !await page.evaluate(()=>window.__oprnAiBridge.status().turnBusy)) break;
  }
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
  await page.reload();await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready,null,{timeout:180000});
  report.afterReload=snapshot();
  const shots=report.afterReload.opening?.scenes.filter(s=>s.kind==='image')??[];
  report.persisted=JSON.stringify(report.beforeReload)===JSON.stringify(report.afterReload);
  report.passed=report.workerCompleted&&report.successfulImageGenerations>0&&!report.imageGenerationFailures.length&&report.persisted&&report.before.mapsHash===report.afterReload.mapsHash&&shots.length===3&&new Set(shots.map(s=>s.resourceId)).size===3&&shots.every(s=>s.direction)&&!report.errors.length;
  await page.screenshot({path:out+'/reloaded.png'});
} catch(e) { report.failure=e.message;await page.screenshot({path:out+'/failure.png',timeout:5000}).catch(()=>{}); }
finally { if(!report.workerCompleted) await page.evaluate(()=>window.__oprnAiBridge?.abort()).catch(()=>{});save();await browser.close(); }
console.log(JSON.stringify({passed:report.passed,failure:report.failure,revision:report.afterReload?.revision,opening:report.afterReload?.opening}));
process.exitCode=report.passed?0:1;
