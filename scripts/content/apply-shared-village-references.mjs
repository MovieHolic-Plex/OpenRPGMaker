import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {isDeepStrictEqual as same} from 'node:util';import {chromium} from 'playwright';
const out='output/shared-village-references',host='http://127.0.0.1:9825',origin=process.env.REFERENCE_ORIGIN??'http://127.0.0.1:9852';
const db=process.env.REFERENCE_SQLITE??'/home/main/.codex/worktrees/a4e1/rpg-zzu/.oprn-projects/oprn-hill-forest-harmony-20260918-a4e1/project.sqlite';
const read=()=>JSON.parse(execFileSync('python3',['-c',"import sqlite3,pathlib,sys;c=sqlite3.connect(pathlib.Path(sys.argv[1]).resolve().as_uri()+'?mode=ro',uri=True);print(c.execute('select current_json from project').fetchone()[0])",db],{maxBuffer:100e6}));
const before=read(),refs=JSON.parse(fs.readFileSync('src/assets/sharedVillageReferences.json'));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/local-before.json',JSON.stringify(before));
const conf=JSON.parse((await(await fetch(host)).text()).match(/window\.__OPRN_BRIDGE__=(.*?)<\/script>/)[1]),bridge=await(await fetch(host+'/__oprn/bridge.js')).text();
const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox','--no-proxy-server']});
try{
 const context=await browser.newContext({viewport:{width:1600,height:1100}});
 await context.route('**/__oprn/**',async r=>{const u=new URL(r.request().url());try{await r.fulfill({response:await r.fetch({url:host+u.pathname+u.search,maxRetries:2})});}catch{await r.abort();}});
 await context.addInitScript({content:`window.__OPRN_BRIDGE__=${JSON.stringify(conf)};\n${bridge}`});await context.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','expert');localStorage.setItem('oprn:editor-welcome-dismissed','1');});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/?map=map_village_ten_terrace_gardens',{waitUntil:'domcontentloaded'});await page.getByTestId('edit-canvas').waitFor({timeout:120000});
 const receipt=await page.evaluate(async({refs,expected})=>{
  const live=p=>import(performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===p).at(-1)?.name??p);const{store}=await live('/src/project/store.ts');const{validateTilesetReferences}=await import('/src/project/tilesetReferences.ts');
  for(const c of Object.values(refs))validateTilesetReferences([c]);
  const p=store.getCurrent();if(JSON.stringify(p.maps)!==JSON.stringify(expected))throw Error('Maps changed since SQLite read');
  for(const [id,c] of [['forest_high_cliff_river',refs.village],['shared_forest_village_objects',refs.objects]]){
   const t=p.tilesets[id];if(!t||t.referenceSourceTilesetId)throw Error('Missing or indirect reference owner '+id);
   const old=t.referenceDocuments?.find(d=>d.id===c.id);if(old&&JSON.stringify(old)!==JSON.stringify(c))throw Error('Existing authored category conflict '+id);
  }
  const{recordProjectSnapshot}=await import('/src/editor/mapEditHistory.ts');recordProjectSnapshot();
  store.update(project=>{for(const[id,c]of [['forest_high_cliff_river',refs.village],['shared_forest_village_objects',refs.objects]]){
    const t=project.tilesets[id];t.referenceDocuments=[...(t.referenceDocuments??[]).filter(d=>d.id!==c.id),structuredClone(c)];
  }
  for(const profile of project.resourceProfiles??[])if(profile.assetId==='tex_shared_forest_village_objects' && profile.imageWidth===480 && profile.imageHeight===48){profile.imageWidth=96;profile.imageHeight=224;}
  },{scope:'database',origin:'ai',label:'숲마을 공용 장소·소품 AI 참고문서 등록'});
  const result = await store.flush(); return {kind:result.kind,sha256:result.sha256,receipt:result.receipt};
 },{refs,expected:before.maps});
 const saved=read();assert.ok(same(saved.maps,before.maps),'Source maps changed');for(const[id,c]of [['forest_high_cliff_river',refs.village],['shared_forest_village_objects',refs.objects]])assert.ok(same(saved.tilesets[id].referenceDocuments.find(d=>d.id===c.id),c));
 await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('edit-canvas').waitFor({timeout:120000});
 const loaded=await page.evaluate(async()=>{const p=performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname==='/src/project/store.ts').at(-1)?.name??'/src/project/store.ts';return(await import(p)).store.getCurrent();});
 for(const[id,c]of [['forest_high_cliff_river',refs.village],['shared_forest_village_objects',refs.objects]])assert.ok(same(loaded.tilesets[id].referenceDocuments.find(d=>d.id===c.id),c));
 await page.getByTestId('toolbar-database').click();const group=page.getByTestId('db-tab-group-world');if(await group.getAttribute('aria-expanded')==='false')await group.click();await page.getByTestId('db-tab-spatial-tiles').click();
 for(const[id,doc,name]of [['forest_high_cliff_river','공용 장소와 저장 안내.md','village'],['shared_forest_village_objects','공용 소품 19종 사용 기준.md','objects']]){
  await page.getByTestId('tileset-db-row-'+id).click();await page.getByTestId('tileset-section-tab-references').click();await page.getByRole('button',{name:doc,exact:true}).click();await page.screenshot({path:`${out}/${name}-references.png`});
 }
 fs.writeFileSync(out+'/sqlite-proof.json',JSON.stringify({projectId:'oprn-hill-forest-harmony-20260918-a4e1',storage:'SQLite',saved:true,reloaded:true,mapsUnchanged:true,receipt,documents:3,images:8,errors},null,2));console.log('SQLite saved/reloaded; 3 documents, 8 images; original maps unchanged');
}catch(e){const p=browser.contexts()[0]?.pages()[0];if(p){await p.screenshot({path:out+'/failure.png'}).catch(()=>{});console.log((await p.locator('body').innerText()).slice(-1500));}throw e;}finally{await browser.close();}
