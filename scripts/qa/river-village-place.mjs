// Register the approved outdoor place, compile a real copy, save/reload, then capture Places.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const out='/home/main/river-village-place', projectId='river-village-place-20260921-414a';
fs.mkdirSync(out,{recursive:true});
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]}));
async function remote(id){
 const r=await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/projects?project_id=eq.${id}&select=current_json,current_sha256`,{headers:{apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${env.VITE_SUPABASE_ANON_KEY}`,'Accept-Profile':'rpg_zzu'}});
 if(!r.ok)throw Error(`DB ${r.status}`);return r.json();
}
const [source]=await remote('river-village-live-20260921-414a');assert.ok(source?.current_json);const [beforeTarget]=await remote(projectId);
const browser=await chromium.launch({headless:true,executablePath:'/home/main/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultTimeout(30000);
try{
 await page.route('**/__place_capture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body></body>'}));
 await page.goto('http://127.0.0.1:9839/__place_capture');
 const result=process.argv.includes('--resume') ? {project:JSON.parse(fs.readFileSync(`${out}/authored.json`,'utf8')),placeId:'river-village-reference:place_river_forest_village',builtinId:'place_river_forest_village',dataUrl:'data:image/png;base64,'+fs.readFileSync('public/assets/reviewed-places/place_river_forest_village.png').toString('base64'),preview:'previously compiled occurrence',applied:'previously applied occurrence'} : await page.evaluate(async source=>{
  const {convertLegacySpatialSnapshot}=await import('/src/project/spatial/legacyImport.ts');
  const {copyReviewedPlace,reviewedPlaceMaps,REVIEWED_PLACES}=await import('/src/project/defaults/spatial/reviewedPlaceCatalog.ts');
  const {RIVER_VILLAGE_STYLE}=await import('/src/project/defaults/riverVillageStyle.ts');
  const {runTool}=await import('/src/editor/tools/toolRunner.ts');
  const {renderHarmonyMapImages}=await import('/src/ai/ultrabrainImage.ts');
  const {serialize,deserialize}=await import('/src/project/io.ts');
  const active=convertLegacySpatialSnapshot(JSON.stringify(source)).preview;
  const copied=copyReviewedPlace(active,RIVER_VILLAGE_STYLE.placeId,'river-village-reference');
  const ctx={project:copied.project};
  const preview=runTool(ctx,'preview_spatial_build',{kind:'place',id:copied.id,occurrenceId:'river-village-reference-example',seed:17});
  if(!preview.ok)throw Error(JSON.stringify(preview));
  const applied=runTool(ctx,'apply_spatial_build',{previewId:preview.data.previewId});
  if(!applied.ok)throw Error(JSON.stringify(applied));
  const p=deserialize(serialize(ctx.project));
  for(const [id,map]of Object.entries(source.maps))if(JSON.stringify(p.maps[id].lowerTiles)!==JSON.stringify(map.lowerTiles)||JSON.stringify(p.maps[id].events)!==JSON.stringify(map.events))throw Error(`Existing map changed: ${id}`);
  const [{map,tileset}]=reviewedPlaceMaps(RIVER_VILLAGE_STYLE.placeId);
  const visual={...p,tilesets:{...p.tilesets,[tileset.id]:tileset},maps:{...p.maps,[map.id]:map}};
  const [image]=await renderHarmonyMapImages(visual,map);
  return {project:p,placeId:copied.id,builtinId:RIVER_VILLAGE_STYLE.placeId,registered:REVIEWED_PLACES.some(p=>p.id===RIVER_VILLAGE_STYLE.placeId),dataUrl:image.dataUrl,preview:preview.summary,applied:applied.summary};
 },source.current_json);
 result.registered=await page.evaluate(async id=>{const {REVIEWED_PLACES}=await import('/src/project/defaults/spatial/reviewedPlaceCatalog.ts');return REVIEWED_PLACES.some(p=>p.id===id);},result.builtinId);
 assert.ok(result.registered);assert.ok(result.project.spatialAuthoring.occurrences['river-village-reference-example'].bindings.length);
 fs.mkdirSync('public/assets/reviewed-places',{recursive:true});
 fs.writeFileSync(`public/assets/reviewed-places/${result.builtinId}.png`,Buffer.from(result.dataUrl.split(',')[1],'base64'));
 fs.writeFileSync(`${out}/authored.json`,JSON.stringify(result.project));
 let sha=beforeTarget?.current_sha256;
 if(!process.argv.includes('--resume')){
 const response=await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/publish_spatial_project`,{method:'POST',headers:{apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${env.VITE_SUPABASE_ANON_KEY}`,'Content-Profile':'rpg_zzu','Accept-Profile':'rpg_zzu','Content-Type':'application/json'},body:JSON.stringify({p_project_id:projectId,p_expected_sha256:beforeTarget?.current_sha256??null,p_project:result.project,p_operation:beforeTarget?'update':'create',p_legacy_baseline:null})});
 if(!response.ok)throw Error(`Spatial publication ${response.status}: ${(await response.text()).slice(0,700)}`);
 const receipt=await response.json();sha=receipt.sha256;
 }
 const [saved]=await remote(projectId);assert.equal(saved.current_sha256,sha);assert.deepEqual(saved.current_json,JSON.parse(JSON.stringify(result.project)));
 fs.writeFileSync(`${out}/reloaded.json`,JSON.stringify(saved.current_json));
 fs.writeFileSync(`${out}/place.png`,Buffer.from(result.dataUrl.split(',')[1],'base64'));
 fs.writeFileSync('/home/main/river-village-place.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><title>강변 숲마을 · 장소</title><style>body{max-width:1400px;margin:auto;padding:24px;font:18px/1.6 system-ui;background:#172622;color:#fff}img{width:100%;image-rendering:pixelated}</style><h1>강변 숲마을</h1><p>장소 → 마을·도시 → 강변 숲마을 · 실외 꾸밈 도안</p><img src="${result.dataUrl}"><p>중앙 강과 양안 주택 · 숲마을 나무 세트 · 기본 울타리 없음</p></html>`);
 const proof={projectId,sha,placeId:result.placeId,builtinId:result.builtinId,registered:result.registered,remoteReloadVerified:true,preview:result.preview,applied:result.applied};
 fs.writeFileSync(`${out}/proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 // The UI session is local; persistence was independently completed and reloaded above.
 await page.addInitScript(()=>{for(const k of ['oprn:editor-welcome-dismissed','oprn:standard-welcome-seen','oprn:coachmarks-basic-v1'])localStorage.setItem(k,'1');localStorage.setItem('oprn:editor-ui-mode','expert');localStorage.setItem('oprn:ai-panel-collapsed','1');});
 await page.goto('http://127.0.0.1:9839/?blankProject=1&aiBridge=0',{waitUntil:'domcontentloaded'});
 const guest=page.getByTestId('login-guest');await page.getByTestId('toolbar-database').or(guest).first().waitFor();if(await guest.isVisible())await guest.click();
 await page.getByTestId('toolbar-database').waitFor();
 await page.evaluate(async p=>{const {store}=await import('/src/project/store.ts');store.replace(p,{preserveEventDrafts:false});},saved.current_json);
 await page.getByTestId('toolbar-database').click();
 const group=page.getByTestId('db-tab-group-world');if(await group.getAttribute('aria-expanded')==='false')await group.click();
 await page.getByTestId('db-tab-spatial-places').click();
 const back=page.getByTestId('composition-back-to-list');
 if(await back.isVisible()){
  assert.equal(await page.getByTestId('composition-width').inputValue(),'78');
  assert.equal(await page.getByTestId('composition-height').inputValue(),'44');
  await page.waitForFunction(()=>{const c=document.querySelector('[data-testid=composition-board] canvas');return c&&c.getContext('2d').getImageData(2,2,1,1).data[3]>0;});
  await page.screenshot({path:`${out}/place-edit-ui.png`});
  await back.click();
 }
 await page.getByRole('tab',{name:'마을·도시',exact:true}).click();
 const defaults=page.getByTestId('spatial-source-defaults');if(await defaults.isVisible())await defaults.click();
 const card=page.getByTestId(`spatial-card-reviewed-place:${result.builtinId}`);await card.click();
 await page.waitForFunction(()=>document.querySelector('canvas.spatial-place-raster[data-loaded=true]'));
 await page.screenshot({path:`${out}/places-ui.png`});
 fs.writeFileSync(`${out}/proof.json`,JSON.stringify({...proof,placesUiVisible:true},null,2));
 console.log('Places UI captured');
}catch(e){await page.screenshot({path:`${out}/failure.png`,timeout:10000}).catch(()=>{});console.error((await page.locator('body').innerText()).slice(-1800));throw e;}finally{await browser.close();}
