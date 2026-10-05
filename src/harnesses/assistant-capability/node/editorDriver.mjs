import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import { firefox } from 'playwright';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

// Capture the actual rendered pixels even when an unrelated web font request
// never settles. The reviewer still checks text and chip visibility in the PNG.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';

export const digest = value => createHash('sha256').update(value).digest('hex');
export function stored(projectDir) {
  const db = new DatabaseSync(resolve(projectDir, 'project.sqlite'), { readOnly: true });
  try {
    const row = db.prepare('SELECT project_id,revision,current_json,current_sha256 FROM project WHERE id=1').get();
    const project = JSON.parse(row.current_json);
    project.maps = Object.fromEntries(db.prepare('SELECT map_id,map_json FROM maps ORDER BY map_id').all().map(r => [r.map_id,JSON.parse(r.map_json)]));
    return { project, projectId: row.project_id, revision: row.revision, sha256: row.current_sha256 };
  } finally { db.close(); }
}
export function writeRuntimeProject(projectDir, file, savedSnapshot) {
  const db = new DatabaseSync(resolve(projectDir,'project.sqlite'),{readOnly:true});
  try {
    const project=savedSnapshot?structuredClone(savedSnapshot):JSON.parse(db.prepare('SELECT current_json FROM project WHERE id=1').get().current_json);
    const blob=db.prepare('SELECT body FROM tileset_blobs WHERE sha256=?');
    for(const [id,ref] of Object.entries(project.tilesets))if(ref.$blob) {
      const body=blob.get(ref.$blob)?.body;
      if(!body||digest(body)!==ref.$blob)throw Error(`Saved tileset bytes missing or corrupt: ${id}`);
      project.tilesets[id]=JSON.parse(body);
    }
    writeFileSync(file,JSON.stringify(project));
  } finally {db.close();}
}
const freePort = () => new Promise((done, fail) => {
  const server = createServer(); server.once('error', fail);
  server.listen(0, '127.0.0.1', () => { const port=server.address().port;server.close(()=>done(port)); });
});
export async function startHost(projectDir, dir) {
  const port = await freePort();
  const child = spawn(process.execPath, ['scripts/oprn-serve.mjs','--project-dir',projectDir,'--host','127.0.0.1','--port',String(port)], {
    cwd: process.cwd(), env: { ...process.env, OPRN_HOST_OWNER_AI: '1',
      ...(existsSync(resolve(dir,'shared-content.sqlite')) ? { OPRN_SHARED_CONTENT_SQLITE: resolve(dir,'shared-content.sqlite') } : {}) }, stdio: ['ignore','pipe','pipe'], detached: true,
  });
  let log=''; const append = data => { log += data.toString(); };
  child.stdout.on('data', append); child.stderr.on('data', append);
  const url=await new Promise((done, fail)=>{
    const timer=setTimeout(()=>fail(Error('Project host startup deadline')),60000);
    child.on('error', error=>{clearTimeout(timer);fail(error);});
    child.on('exit', code=>{clearTimeout(timer);fail(Error(`Project host exited ${code}: ${log.slice(-1000)}`));});
    child.stdout.on('data', ()=>{if(log.includes('OPRN 로컬 편집기:')){clearTimeout(timer);done(`http://127.0.0.1:${port}`);}});
  }).catch(async error => { try { process.kill(-child.pid,'SIGTERM'); } catch {} throw error; });
  return { url, async close() {
    if (child.exitCode === null) {
      // Own process group only: host and any unfinished model workers.
      try { process.kill(-child.pid,'SIGTERM'); } catch {}
      await new Promise(done=>{
        const timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}done();},10000);
        child.once('exit',()=>{clearTimeout(timer);done();});
      });
    }
    // A root process exiting does not prove every model worker has exited.
    // Finish this task-owned group before the caller releases its case lock.
    try { process.kill(-child.pid,'SIGKILL'); } catch {}
    // Host logs may contain credentials in provider errors. Persist a redacted
    // structural receipt rather than raw stdout/stderr.
    writeFileSync(resolve(dir,'host.json'),JSON.stringify({url,exitCode:child.exitCode,closed:true},null,2));
  } };
}
export async function newEditor(browser, url, projectDir, config, captureOptions={}) {
  const {onPage,bootTimeoutMs=360000,...contextOptions}=captureOptions;
  const context=await browser.newContext({ viewport:{width:1440,height:960},reducedMotion:'reduce',...contextOptions });
  const page=await context.newPage();
  await onPage?.(page,context);
  // Bundled asset installation and SQLite flush can hold the UI main thread.
  // Keep UI action deadlines consistent with the existing load/save deadlines.
  page.setDefaultTimeout(120000);
  const loads=[];
  page.on('response',response=>{
    if(!['oprn:project.load','oprn:project.loadFolded'].includes(response.request().headers()['x-oprn-channel']))return;
    void response.json().then(body=>{
      const document=JSON.parse(body.folded??body.serialized);
      loads.push({sha256:body.sha256,revision:body.revision,maps:document.maps,database:document.database});
    }).catch(()=>{});
  });
  await page.addInitScript(config=>{
    localStorage.setItem('oprn:ai-config',JSON.stringify({configVersion:2,piTeam:false,piApply:'default',piApplyPolicyVersion:1,...config}));
    window.__capEvents=[];
    const original=window.fetch;
    window.fetch=async function(...args){
      const response=await original.apply(this,args);
      if(String(args[0]).includes('/v1/agent/run') && response.body){
        const reader=response.clone().body.getReader(),decoder=new TextDecoder();let pending='';
        const consume=line=>{try{
          const outer=JSON.parse(line.replace(/^data:\s*/,'')),event=outer.type==='agent_event'?outer.event:outer;
          if(['assistant','tool_start','tool_end','error','execution_status','done','cancelled'].includes(event?.type)){
            // Never persist reasoning, auth headers or system prompt payloads.
            window.__capEvents.push({type:event.type,name:event.name??event.toolName,id:event.id,ok:event.ok,
              text:event.type==='assistant'?event.text:undefined,summary:event.summary,message:event.message,args:event.args,
              data:['charset.image.delivered','charset.image.received'].includes(event.name)?event.data:undefined,
              runId:outer.runId,usage:event.usage,stats:event.type==='done'?event.stats:undefined,at:Date.now()});
          }
          if(outer.type==='done'&&event.type!=='done')window.__capEvents.push({type:'done',runId:outer.runId,at:Date.now()});
        }catch{}};
        void(async()=>{try{for(;;){const {done,value}=await reader.read();if(done)break;
          pending+=decoder.decode(value,{stream:true});const lines=pending.split('\n');pending=lines.pop();for(const line of lines)consume(line);
        }pending+=decoder.decode();if(pending.trim())consume(pending);window.__capEvents.push({type:'stream_closed',at:Date.now()});
        }catch(error){window.__capEvents.push({type:'stream_error',message:error.message,at:Date.now()});}})();
      }
      return response;
    };
  },config??{});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  if(await page.locator('#access-code').count()) {
    await page.locator('#access-code').fill(readFileSync(resolve(projectDir,'.oprn-host-access'),'utf8').trim());
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:120000}),page.locator('form[action="/__oprn/login"] button').click()]);
  }
  await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:bootTimeoutMs});
  await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready && document.querySelector('[data-testid="ai-input"]'),null,{timeout:120000});
  // Companion readiness precedes canvas construction in a fresh context.
  // Wait for the editor's own rendered tile residency before taking evidence.
  await page.waitForFunction(()=>window.__oprnEditReliefStats?.().residentTileCells>0,null,{timeout:120000});
  const welcome=page.getByTestId('editor-welcome-skip');if(await welcome.isVisible().catch(()=>false))await welcome.click();
  // A fresh editor now starts with the conversation folded. Open it through
  // the visible restore control before using the actual input/settings UI.
  const restore = page.getByTestId('ai-collapsed-restore');
  if (await restore.isVisible().catch(()=>false)) await restore.click();
  await page.getByTestId('ai-input').waitFor({state:'visible',timeout:120000});
  return { page,context,loads };
}
async function saveThroughUi(page) {
  await page.getByTestId('toolbar-save').click();
  await page.waitForFunction(()=>['idle','saved','error','unsaved-session'].includes(document.querySelector('[data-testid="toolbar-save"]')?.dataset.autosaveKind),null,{timeout:120000});
  const kind=await page.getByTestId('toolbar-save').getAttribute('data-autosave-kind');
  if(!['idle','saved'].includes(kind))throw Error(`Actual editor save failed: ${kind}`);
  return {kind,dirty:false};
}
export async function execute(entry, dir, timeoutMs, config) {
  const projectDir=resolve(dir,'project'), host=await startHost(projectDir,dir);
  let browser,context,phase='editor-start';const errors=[],requests=[]; const evidence=[];
  try {
    browser=await firefox.launch({firefoxUserPrefs:{'network.notify.changed':false,'network.notify.IPv6':false,'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false}});
    let editor=await newEditor(browser,host.url,projectDir,config);let page=editor.page;context=editor.context;
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{
      if(entry.check==='graphic'&&request.method()==='POST'&&/\/v1\/agent\/render(?:\?|$)/.test(request.url())) {
        try {const body=JSON.parse(request.postData());if(typeof body.png==='string') {
          const file=`candidate-preview-${evidence.filter(file=>file.startsWith('candidate-preview-')).length+1}.png`;
          writeFileSync(resolve(dir,file),Buffer.from(body.png,'base64'));evidence.push(file);
        }}catch{} // A missing preview remains a failed requirement, never a passing observation.
      }
      if(request.method()!=='POST'||!/\/v1\/(agent\/run|chat\/completions)/.test(request.url()))return;
      try{const raw=request.postDataBuffer(),b=JSON.parse(raw?.[0]===31?gunzipSync(raw):raw);
        requests.push({endpoint:new URL(request.url()).pathname,model:b.model,provider:request.headers()['x-oprn-provider'],runId:b.runId,at:Date.now()});
      }catch{requests.push({endpoint:new URL(request.url()).pathname,observationError:true});}
      // Browser loss must not erase the evidence that a real request was sent.
      writeFileSync(resolve(dir,'requests.json'),JSON.stringify(requests,null,2));
    });
    // Normalize boot-time migration through the real host before capturing the
    // task baseline, so authored changes are not confused with asset installation.
    phase='baseline';
    await saveThroughUi(page);
    const before=stored(projectDir);
    writeFileSync(resolve(dir,'before.json'),JSON.stringify(before.project));
    await page.screenshot({path:resolve(dir,'before.png')});evidence.push('before.png');
    await page.getByTestId('ai-composer-settings').click();
    await page.getByTestId('ai-composer-autonomy').selectOption(entry.mode);
    await page.getByTestId('ai-composer-settings').click();
    console.log(`${entry.id}: native input`);
    const start=Date.now();
    phase='turn';
    await page.getByTestId('ai-input').fill(entry.prompt);await page.getByTestId('ai-send').click();
    try {
      await page.waitForFunction(()=>{
        const events=window.__capEvents;
        return events.some(e=>['stream_closed','error'].includes(e.type)) && !window.__oprnAiBridge.status().turnBusy;
      },null,{timeout:timeoutMs,polling:500});
    } catch(error) {
      await page.evaluate(()=>window.__oprnAiBridge.abort()).catch(()=>{});
      throw Error(`Turn did not settle within ${timeoutMs}ms: ${error.message.slice(0,120)}`);
    }
    const events=await page.evaluate(()=>window.__capEvents);
    const answer=events.filter(e=>e.type==='assistant').map(e=>e.text??'').join('\n');
    writeFileSync(resolve(dir,'trace.json'),JSON.stringify({requests,events,errors,elapsedMs:Date.now()-start},null,2));
    phase='save';
    const flush=await saveThroughUi(page);
    const applied=stored(projectDir);
    writeFileSync(resolve(dir,'after.json'),JSON.stringify(applied.project));
    await page.screenshot({path:resolve(dir,'after.png')});evidence.push('after.png');
    if(entry.visual==='database') {
      await page.getByTestId('toolbar-database').click();
      await page.getByTestId('db-tab-items').click();
      const item=page.locator('[data-testid="db-record-row-item_potion"], [data-testid="db-record-card-item_potion"]').first();
      await item.click();
      await page.screenshot({path:resolve(dir,'database.png')});evidence.push('database.png');
    }
    // Close the entire browser context: this drops its memory adapter and caches.
    phase='reload';
    await context.close();context=null;
    editor=await newEditor(browser,host.url,projectDir,config);page=editor.page;context=editor.context;
    const reloaded=stored(projectDir);
    const loaded=editor.loads.find(load=>load.sha256===applied.sha256);
    const reloadEqual=Boolean(loaded)&&isDeepStrictEqual(applied.project.maps,loaded.maps)&&isDeepStrictEqual(applied.project.database,loaded.database);
    await page.screenshot({path:resolve(dir,'reloaded.png')});evidence.push('reloaded.png');
    const indexedDb=await page.evaluate(async()=>{
      const databases=await indexedDB.databases();
      if(!databases.some(d=>d.name==='oprn-ai-records'))return {exists:false};
      const db=await new Promise((done,fail)=>{const r=indexedDB.open('oprn-ai-records');r.onsuccess=()=>done(r.result);r.onerror=()=>fail(r.error);});
      try{if(!db.objectStoreNames.contains('conversations'))return{exists:true,conversations:0};
        return await new Promise((done,fail)=>{const r=db.transaction('conversations','readonly').objectStore('conversations').getAll();
          r.onsuccess=()=>done({exists:true,conversations:r.result.length,userEntries:r.result.reduce((n,c)=>n+(c.entries??[]).filter(e=>e.kind==='user').length,0)});r.onerror=()=>fail(r.error);});
      }finally{db.close();}
    });
    const receipt={projectId:before.projectId,projectDir,beforeRevision:before.revision,afterRevision:applied.revision,
      afterSha256:applied.sha256,reloadedSha256:reloaded.sha256,sameTarget:before.projectId===reloaded.projectId,
      sameStoredDocument:applied.sha256===reloaded.sha256,reloadEqual,flush,indexedDb};
    if(!receipt.sameStoredDocument) {
      const comparable=structuredClone(reloaded.project);
      comparable.meta.bootNormalization=applied.project.meta.bootNormalization;
      if(isDeepStrictEqual(comparable,applied.project)&&applied.project.meta.bootNormalization?.lib!==reloaded.project.meta.bootNormalization?.lib)
        receipt.libraryRevisionChange={before:applied.project.meta.bootNormalization?.lib,after:reloaded.project.meta.bootNormalization?.lib,gameContentEqual:true};
    }
    writeFileSync(resolve(dir,'persistence.json'),JSON.stringify(receipt,null,2));
    // Expand stored content in Node, outside the renderer. Reading the full
    // automation mirror would clone all reference documents and crash the UI.
    await context.close();context=null;
    writeRuntimeProject(projectDir,resolve(dir,'live.json'));
    return {before:before.project,after:applied.project,answer,events,requests,errors,receipt,evidence,
      elapsedMs:Date.now()-start,realRun:requests.some(r=>r.endpoint==='/v1/agent/run')&&events.some(e=>e.type==='done')};
  } catch(error) {
    error.harnessPhase=phase;
    let events=[];
    if(context) {
      const page=context.pages()[0];
      if(page){await page.screenshot({path:resolve(dir,'failure.png')}).catch(()=>{});
        events=await page.evaluate(()=>window.__capEvents??[]).catch(()=>[]);}
    }
    if(!existsSync(resolve(dir,'trace.json')))writeFileSync(resolve(dir,'trace.json'),JSON.stringify({requests,events,errors,harnessPhase:phase},null,2));
    throw error;
  } finally { await context?.close().catch(()=>{});await browser?.close().catch(()=>{});await host.close(); }
}

// Continue observation of a completed attempt after a probe failure. Never send
// another prompt or modify the saved content to obtain a better assistant score.
export async function observeSaved(entry, dir, config={}) {
  const projectDir=resolve(dir,'project'), prior=stored(projectDir);
  const host=await startHost(projectDir,dir);let browser,context;
  try {
    browser=await firefox.launch({firefoxUserPrefs:{'network.notify.changed':false,'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false}});
    let editor=await newEditor(browser,host.url,projectDir,config);context=editor.context;
    await saveThroughUi(editor.page);
    const applied=stored(projectDir);
    if(prior.sha256!==applied.sha256)throw Error('Observation boot changed saved output; use a new attempt');
    writeFileSync(resolve(dir,'after.json'),JSON.stringify(applied.project));
    await editor.page.screenshot({path:resolve(dir,'after.png')});
    await context.close();context=null;
    editor=await newEditor(browser,host.url,projectDir,config);context=editor.context;
    const reloaded=stored(projectDir),loaded=editor.loads.find(l=>l.sha256===applied.sha256);
    await editor.page.screenshot({path:resolve(dir,'reloaded.png')});
    const receipt={projectId:applied.projectId,projectDir,afterRevision:applied.revision,
      afterSha256:applied.sha256,reloadedSha256:reloaded.sha256,sameTarget:applied.projectId===reloaded.projectId,
      sameStoredDocument:applied.sha256===reloaded.sha256,
      reloadEqual:Boolean(loaded)&&isDeepStrictEqual(applied.project.maps,loaded.maps)&&isDeepStrictEqual(applied.project.database,loaded.database),
      flush:{kind:'saved',dirty:false},observationRecovery:true};
    writeFileSync(resolve(dir,'persistence.json'),JSON.stringify(receipt,null,2));
    return receipt;
  } finally {await context?.close().catch(()=>{});await browser?.close().catch(()=>{});await host.close();}
}

export async function captureSaved(entry, dir, refreshAfter=false) {
  const projectDir=resolve(dir,'project'),host=await startHost(projectDir,dir);
  let browser,context;
  try {
    browser=await firefox.launch({firefoxUserPrefs:{'network.notify.changed':false,'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false}});
    const editor=await newEditor(browser,host.url,projectDir,{});context=editor.context;
    const saved=stored(projectDir),loaded=editor.loads.at(-1);
    if(!loaded||!isDeepStrictEqual(saved.project.maps,loaded.maps)||!isDeepStrictEqual(saved.project.database,loaded.database))throw Error('Captured context did not load current saved output');
    await editor.page.screenshot({path:resolve(dir,'reloaded.png')});
    if(refreshAfter)await editor.page.screenshot({path:resolve(dir,'after.png')});
    if(entry.visual==='database') {
      await editor.page.getByTestId('toolbar-database').click();await editor.page.getByTestId('db-tab-items').click();
      await editor.page.locator('[data-testid="db-record-row-item_potion"], [data-testid="db-record-card-item_potion"]').first().click();
      await editor.page.screenshot({path:resolve(dir,'database.png')});
    }
    return {at:new Date().toISOString(),sha256:saved.sha256,loadedSha256:loaded.sha256,projectId:saved.projectId,readiness:'editor rendered tile residency',freshSavedOutputView:refreshAfter,newModelTurn:false};
  } finally {await context?.close().catch(()=>{});await browser?.close().catch(()=>{});await host.close();}
}
