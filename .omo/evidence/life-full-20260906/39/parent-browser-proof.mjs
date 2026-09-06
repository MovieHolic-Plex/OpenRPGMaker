import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { createServer } from 'vite';
import { Window } from 'happy-dom';
import { chromium, firefox } from '@playwright/test';
import { startPlayerQaServer } from '../../../../scripts/lib/runtimeQaRun.mjs';

const browserName = process.env.TASK39_BROWSER ?? 'chromium';
const out = new URL(browserName === 'firefox' ? './parent/firefox/' : './parent/', import.meta.url);
await mkdir(out, {recursive:true});
const hash = value => createHash('sha256').update(value).digest('hex');
const result = { cwd: process.cwd(), head: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(),
  tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {encoding:'utf8'}).trim(),
  surface: 'dedicated player.html/exportProjectStoreShim; controlled failure-input fixture, not earned gameplay',
  deadlineMs: 120000, actionDeadlineMs: 10000, sourceHashes: {}, runs: [], errors: [], requestsFailed: [], httpErrors: [], consoleErrors: [] };
for (const path of ['src/player/player.ts', 'src/player/playerStatusMenuController.ts', 'test/lifePlayerSaveFailures.test.ts']) {
  result.sourceHashes[path] = hash(await readFile(path));
}
let browser, context, server, ssr, window;
let fixture, slots;

async function publicFixture() {
  window = new Window();
  ssr = await createServer({ configFile: false, root: process.cwd(), cacheDir: '/tmp/supervisor-task39-e9522cb1-public-cache',
    resolve: {alias: {'@': `${process.cwd()}/src`}}, optimizeDeps: {noDiscovery:true, include:[]},
    server: {middlewareMode:true, watch:null, hmr:false}, appType:'custom' });
  const {createBlankProject} = await ssr.ssrLoadModule('/src/project/defaults.ts');
  const {normalizeItemRecord} = await ssr.ssrLoadModule('/src/project/databaseRecordModel.ts');
  const {startSession} = await ssr.ssrLoadModule('/src/project/session.ts');
  const {isLifeRecoveryState, LifeReconciliationError} = await ssr.ssrLoadModule('/src/project/lifeRecovery.ts');
  const saves = await ssr.ssrLoadModule('/src/player/saveSlots.ts');
  const {serialize, deserialize} = await ssr.ssrLoadModule('/src/project/io.ts');
  const project = createBlankProject();
  project.meta.title = 'Task39 reconciliation refusal fixture';
  project.database.items.push(normalizeItemRecord({id:'raw',name:'Raw',scope:'none',price:10}));
  project.system.shipping = {enabled:true};
  saves.setSaveSlotStorageNamespace('task39');
  const live = startSession(project, 39);
  const older = JSON.stringify({...saves.createSaveSnapshot(project,live),schemaVersion:4});
  live.shippingQueue = {raw:3};
  live.lifeRecovery = {nextSequence:4097,claims:Object.fromEntries(Array.from({length:4096}, (_,i)=> {
    const id = `recovery:${i+1}`;
    return [id,{id,sourceKind:'shippingQueue',sourceId:'raw',reason:'removed',items:[{itemId:'raw',count:1}]}];
  }))};
  assert.equal(isLifeRecoveryState(live.lifeRecovery),true);
  const snapshot = saves.createSaveSnapshot(project,live);
  assert.equal(saves.saveToSlot(window.localStorage,1,snapshot).ok,true);
  saves.writeAutosave(window.localStorage,snapshot);
  window.localStorage.setItem('task39:save-slot:1',older);
  window.localStorage.setItem('task39:save-slot:auto',older);
  slots = Object.fromEntries(Array.from({length:window.localStorage.length},(_,i)=>{
    const key=window.localStorage.key(i);return [key,window.localStorage.getItem(key)];
  }));
  project.system.shipping = {enabled:false};
  fixture = serialize(project);
  const current = deserialize(fixture);
  const before=JSON.stringify(live), source=JSON.stringify(snapshot);
  const readers=[];
  for (const [name,read] of [['manual',saves.readSaveSlot(window.localStorage,1)],['auto',saves.readAutosave(window.localStorage)]]) {
    assert.equal(read.kind,'present');
    assert.equal(saves.snapshotLoadBlocker(current,read.snapshot),null);
    assert.throws(()=>saves.applySaveSnapshot(current,read.snapshot), error => error instanceof LifeReconciliationError && error.sourceKind==='shippingQueue' && error.sourceId==='raw' && error.reason==='capacity');
    readers.push({name,kind:read.kind,precheck:null,applyError:{name:'LifeReconciliationError',sourceKind:'shippingQueue',sourceId:'raw',reason:'capacity'}});
  }
  assert.throws(()=>saves.createSaveSnapshot(current,live), LifeReconciliationError);
  assert.equal(JSON.stringify(live),before);
  assert.equal(JSON.stringify(snapshot),source);
  for (const [key,bytes] of Object.entries(slots)) assert.equal(window.localStorage.getItem(key),bytes);
  result.public = { readers, writerRefused:true, shippingQueue:{raw:3},claims:4096,nextSequence:4097,validRecovery:true,
    snapshotCreatedShippingEnabled:true,currentShippingEnabled:false,liveAndSourceUnchanged:true,
    fixtureSha256:hash(fixture),fixtureBytes:Buffer.byteLength(fixture),slots:Object.fromEntries(Object.entries(slots).map(([key,value])=>[key,{bytes:Buffer.byteLength(value),sha256:hash(value)}])) };
  await ssr.close(); ssr = null;
  await window.close(); window = null;
}

async function observe(page, selector, trigger, readyScene=false) {
  const pending=await page.evaluateHandle(({selector,readyScene})=>{
    let cancel;
    const promise=new Promise(resolve=>{
      const finish=value=>{observer.disconnect();clearTimeout(deadline);resolve(value);};
      const check=()=>{if(document.querySelector(selector)&&(!readyScene||(!document.querySelector('[data-testid="play-loading-overlay"]')&&window.__oprnDebug)))finish({ok:true});};
      const observer=new MutationObserver(check);
      const deadline=setTimeout(()=>finish({error:'DOM signal missing: '+selector}),120000);
      cancel=()=>finish({error:'cancelled'});
      observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true});
      check();
    });return {promise,cancel:()=>cancel()};
  },{selector,readyScene});
  try {await trigger();const observed=await pending.evaluate(entry=>entry.promise);assert.equal(observed.error,undefined);}
  finally {await pending.evaluate(entry=>entry.cancel());await pending.dispose();}
}

async function refusal(page, name, trigger, running=false) {
  const before=await page.evaluate(()=>({disk:Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])),state:window.__oprnDebug?.readState()}));
  const identity=await page.evaluateHandle(()=>({canvas:document.querySelector('canvas'),debug:window.__oprnDebug}));
  // Count the actual message node installations, before keyboard activation.
  const observation=await page.evaluateHandle(()=>{
    const messages=new Set();
    let resolve;
    const promise=new Promise(done=>{resolve=done;});
    const observer=new MutationObserver(records=>{
      for(const record of records) for(const node of record.addedNodes) {
        if(!(node instanceof Element))continue;
        if(node.matches('.oprn-load-message'))messages.add(node);
        for(const message of node.querySelectorAll('.oprn-load-message'))messages.add(message);
      }
      if(messages.size)resolve({ok:true});
    });
    const deadline=setTimeout(()=>resolve({error:'failure guidance missing'}),10000);
    observer.observe(document.documentElement,{subtree:true,childList:true});
    return {promise,count:()=>messages.size,close:()=>{clearTimeout(deadline);observer.disconnect();}};
  });
  try {
    await trigger();
    const observed=await observation.evaluate(entry=>entry.promise);
    assert.equal(observed.error,undefined);
    assert.equal(await observation.evaluate(entry=>entry.count()),1);
    const after=await page.evaluate(()=>({disk:Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])),state:window.__oprnDebug?.readState(),
      messages:[...document.querySelectorAll('.oprn-load-message')].map(node=>({text:node.textContent,role:node.getAttribute('role'),children:node.children.length})),
      canvas:document.querySelectorAll('.play-stage canvas').length,editor:document.querySelectorAll('[data-testid="mode-play"]').length}));
    assert.deepEqual(after.disk,before.disk);
    assert.deepEqual(after.state,before.state);
    assert.equal(after.messages.length,1);assert.ok(after.messages[0].text);assert.equal(after.messages[0].role,'status');assert.equal(after.messages[0].children,0);
    assert.equal(after.editor,0);
    if(running) assert.equal(await identity.evaluate(old=>old.canvas===document.querySelector('canvas')&&old.debug===window.__oprnDebug),true);
    else assert.equal(after.canvas,0);
    assert.equal(await page.locator('.oprn-load-message').isVisible(), true);
    const layout = await page.locator('.oprn-load-message').evaluate(node => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, clipped: node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight };
    });
    assert(layout.x >= 0 && layout.y >= 0 && layout.width > 0 && layout.height > 0 && layout.right <= layout.viewportWidth && layout.bottom <= layout.viewportHeight && !layout.clipped);
    result.messageLayouts ??= [];
    result.messageLayouts.push({ name, ...layout });
    await page.screenshot({path:new URL(`${name}.png`,out).pathname});
    result.runs.push({name,running,actions:'real keyboard; actual shell callback/Storage/apply',message:after.messages[0],guidanceCount:1,diskUnchanged:true,qaStateUnchanged:true,currentSceneIdentityPreserved:running,noRestoredCanvas:!running});
  } finally {await observation.evaluate(entry=>entry.close());await observation.dispose();await identity.dispose();}
}

try {
  await publicFixture();
  server=await startPlayerQaServer();
  result.url=server.url+'/player.html';result.port=server.port;
  result.browserName=browserName;
  browser=browserName === 'firefox'
    ? await firefox.launch({headless:true})
    : await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
  result.browserVersion=browser.version();
  context=await browser.newContext({viewport:{width:1280,height:960}});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  page.on('pageerror',error=>result.errors.push(error.message));
  page.on('requestfailed',request=>result.requestsFailed.push({url:request.url(),failure:request.failure()}));
  page.on('response',response=>{if(response.status()>=400)result.httpErrors.push({url:response.url(),status:response.status()});});
  page.on('console',message=>{if(message.type()==='error')result.consoleErrors.push(message.text());});
  await page.addInitScript(({slots})=>{
    window.__OPENRPG_BOOT__={projectUrl:'/__task39/project.json',saveNamespace:'task39',qaInstrumentation:true};
    for(const [key,value] of Object.entries(slots))localStorage.setItem(key,value);
    window.__own39Title=new Promise(resolve=>{
      const finish=value=>{observer.disconnect();clearTimeout(deadline);resolve(value);};
      const observer=new MutationObserver(()=>{if(document.querySelector('[data-testid="title-new-game"]'))finish({ok:true});});
      const deadline=setTimeout(()=>finish({error:'title did not boot'}),120000);
      observer.observe(document,{subtree:true,childList:true});
    });
  },{slots});
  await page.route('**/__task39/project.json',route=>route.fulfill({status:200,contentType:'application/json',body:fixture}));
  // Navigation is not application readiness. The prearmed title DOM signal owns
  // the existing 120s boot deadline; do not gate module loading on an action timeout.
  const response=await page.goto(result.url,{waitUntil:'commit'});result.navigationStatus=response.status();
  assert.equal((await page.evaluate(()=>window.__own39Title)).error,undefined);
  await page.keyboard.press('ArrowDown'); // Existing title resume route.
  await refusal(page,'title-autosave',()=>page.keyboard.press('Enter'));
  await observe(page,'[data-testid="title-new-game"]',()=>page.keyboard.press('Escape'));
  await page.keyboard.press('ArrowDown'); // Resume -> load.
  await observe(page,'[data-testid="player-load-window"]',()=>page.keyboard.press('Enter'));
  await page.keyboard.press('ArrowDown'); // Autosave -> manual slot 1.
  await refusal(page,'title-manual',()=>page.keyboard.press('Enter'));
  await observe(page,'[data-testid="title-new-game"]',()=>page.keyboard.press('Escape'));
  await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');
  await observe(page,'.play-stage canvas',()=>page.keyboard.press('Enter'),true);
  await observe(page,'[data-testid="main-menu"]',()=>page.keyboard.press('Escape'));
  await page.keyboard.press('ArrowUp'); // Items -> last rail entry, system.
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown'); // Save -> load in the system group.
  await observe(page,'[data-testid="load-slot-1"]',()=>page.keyboard.press('Enter'));
  await refusal(page,'running-manual',()=>page.keyboard.press('Enter'),true);
  // The failure panel's first selectable card is the actual autosave callback.
  await refusal(page,'running-autosave',()=>page.keyboard.press('Enter'),true);
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.requestsFailed,[]);assert.deepEqual(result.httpErrors,[]);assert.deepEqual(result.consoleErrors,[]);
  result.ok=true;
} catch(error) {
  result.error=String(error.stack??error);
  if(context) {
    const page=context.pages()[0];
    try {await page.screenshot({path:new URL('failure.png',out).pathname});result.failureHtml=await page.content();}
    catch(diagnosticError){result.diagnosticError=String(diagnosticError);}
  }
  process.exitCode=1;
} finally {
  await context?.close();await browser?.close();await server?.close();await ssr?.close();await window?.close();
  await rm('/tmp/supervisor-task39-e9522cb1-public-cache',{recursive:true,force:true});
  await rm('/tmp/supervisor-task39-e9522cb1-browser-cache',{recursive:true,force:true});
  const closed=server?await new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port:server.port});socket.once('error',error=>resolve(error.code));socket.once('connect',()=>{socket.destroy();resolve('STILL_LISTENING');});}):'not-started';
  result.cleanup={contextsClosed:true,browserClosed:true,serversClosed:true,portProbe:closed,ownCachesRemoved:true,remoteWrites:0};
  await writeFile(new URL('browser-results.json',out),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({...result, failureHtml:result.failureHtml?'retained in browser-results.json':undefined}));
}
