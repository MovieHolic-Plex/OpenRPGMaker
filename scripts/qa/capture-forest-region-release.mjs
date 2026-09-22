import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from '@playwright/test';
const out='.omo/evidence/forest-village-trails',origin=process.env.OPRN_REGION_QA_ORIGIN??'http://127.0.0.1:9816',host=process.env.OPRN_REGION_QA_HOST??'http://127.0.0.1:9825',mapId='map_forest_cliff_village',referenceId='forest-cliff-village-80x72';
const expected=JSON.parse(fs.readFileSync('public/assets/region-references/forest-cliff-village.oprn.json'));
const conf=JSON.parse((await(await fetch(host)).text()).match(/window\.__OPRN_BRIDGE__=(.*?)<\/script>/)[1]),bridge=await(await fetch(host+'/__oprn/bridge.js')).text();
const browser=await chromium.launch({executablePath:process.env.OPRN_QA_CHROME??'/opt/google/chrome/chrome',args:['--no-sandbox','--no-proxy-server']});
try{
 const proofs=[];for(const name of (process.argv.includes('--existing')?['existing']:['new','existing'])){
  const context=await browser.newContext({viewport:{width:1500,height:1050},acceptDownloads:true});
  if(name==='existing'){
   await context.route('**/__oprn/**',async r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())){const reads=new Set(['oprn:project.open','oprn:project.status','oprn:project.probe','oprn:project.load','oprn:project.dataVersion','oprn:commits.list','oprn:commits.listSync','oprn:ai.listActivity','oprn:ai.listConversations','oprn:ai.loadConversation','oprn:assets.list','oprn:assets.read','oprn:start.recentProjects']);if(!reads.has(r.request().postDataJSON()?.channel)){console.log('Read-only QA blocked channel',r.request().postDataJSON()?.channel);return r.abort();}}const u=new URL(r.request().url());try{await r.fulfill({response:await r.fetch({url:host+u.pathname+u.search,maxRetries:2})});}catch{console.log('Local host unavailable for '+u.pathname);await r.abort();}});
   await context.addInitScript({content:`window.__OPRN_BRIDGE__=${JSON.stringify(conf)};\n${bridge}`});
  }
  await context.route('**/rest/v1/**',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
  await context.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','expert');localStorage.setItem('oprn:ai-panel-collapsed','1');for(const k of ['oprn:editor-welcome-dismissed','oprn:standard-welcome-seen','oprn:coachmarks-basic-v1'])localStorage.setItem(k,'1');});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message)});await page.goto(origin+(name==='new'?'/?blankProject=1&aiBridge=0':'/?map='+mapId),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__oprnProjectE2E?.currentProject()?.project,null,{timeout:60000}).catch(async e=>{await page.screenshot({path:out+'/'+name+'-failure.png'});console.log((await page.locator('body').innerText()).slice(0,2000));throw e;});console.log(name+': editor ready');
  for(const id of ['standard-welcome-start','coach-mark-skip'])if(await page.getByTestId(id).isVisible())await page.getByTestId(id).click();
  const before=await page.evaluate(()=>window.__oprnProjectE2E.currentProject().project);
  if(name==='existing')assert.deepEqual(before.maps[mapId],expected.maps[mapId]);else assert.equal(before.maps[mapId],undefined);
  await page.getByTestId('toolbar-database').click();await page.getByTestId('database-modal').waitFor();const world=page.getByTestId('db-tab-group-world');if(await world.getAttribute('aria-expanded')==='false')await world.click();await page.getByTestId('db-tab-spatial-regions').click();await page.getByTestId('spatial-source-defaults').click();
  await page.getByTestId('spatial-card-region-reference:'+referenceId).click();await page.getByTestId('region-reference-preview').locator('img').evaluate(img=>img.decode());
  const download=page.getByTestId('region-reference-download');if(!await download.isVisible())await page.getByTestId('spatial-inspector-toggle').click();await download.waitFor();
  const received=page.waitForEvent('download');await download.click();const file=await received;const bytes=fs.readFileSync(await file.path());assert.deepEqual(JSON.parse(bytes),expected);assert.equal(file.suggestedFilename(),'굽이숲 절벽마을.oprn.json');
  const preview=await page.getByTestId('region-reference-preview').boundingBox();assert.ok(preview.width>100&&preview.height>100);await page.screenshot({path:out+'/'+name+'-region.png'});
  const lookup=await page.evaluate(async id=>{const live=p=>import(performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===p).at(-1)?.name??p);const{readRegionReference}=await live('/src/project/regionReferenceSnapshots.ts');let row=0;const lower=[],upper=[];while(row!==null){const result=readRegionReference(id,row,8);lower.push(...result.map.lowerTiles);upper.push(...result.map.upperTiles);row=result.map.nextRow;}return{lower,upper};},referenceId);
  assert.deepEqual(lookup.lower,expected.maps[mapId].lowerTiles);assert.deepEqual(lookup.upper,expected.maps[mapId].upperTiles);const after=await page.evaluate(()=>window.__oprnProjectE2E.currentProject().project);assert.deepEqual(after.maps,before.maps);assert.deepEqual(errors,[]);
  proofs.push({case:name,sharedRegion:true,preview:true,downloadExact:true,downloadFilename:file.suggestedFilename(),rowLookupExact:true,mapUnchanged:true,errors});console.log(JSON.stringify(proofs.at(-1)));await context.close();
 }
 fs.writeFileSync(out+(process.argv.includes('--existing')?'/existing-gallery-proof.json':'/gallery-proof.json'),JSON.stringify(proofs,null,2));
}finally{await browser.close();}
