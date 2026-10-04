// Packaged editor, actual SQLite bridge, native input and save/reload evidence.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {startEditorScreencast} from './editor-screencast.mjs';
const folder=resolve('.vite-cache/terrain-seams/project'),out=resolve('verify-shots/terrain-body-rims/editor');mkdirSync(out,{recursive:true});
const snapshot=()=>{const db=new DatabaseSync(resolve(folder,'project.sqlite'),{readOnly:true});try{
 const row=db.prepare('select project_id,revision from project where id=1').get();
 const maps=db.prepare('select map_id,map_json from maps').all();
 return{...row,sha:Object.fromEntries(maps.map(m=>[m.map_id,createHash('sha256').update(m.map_json).digest('hex')]))};
}finally{db.close();}};
const waitSaved=async predicate=>{for(let i=0;i<100;i++){const s=snapshot();if(predicate(s))return s;await new Promise(r=>setTimeout(r,150));}throw Error('Canonical save missing');};
const pixelHash=bytes=>createHash('sha256').update(PNG.sync.read(bytes).data).digest('hex');
const browser=await chromium.launch({args:['--no-proxy-server','--disable-background-networking','--js-flags=--max-old-space-size=8192']}),page=await browser.newPage({viewport:{width:1440,height:960}});
const proof={realPackagedEditor:true,canonicalStore:folder,before:snapshot(),styles:[],errors:[]};page.on('pageerror',e=>proof.errors.push(e.message));let film;
async function map(id){await page.getByTestId('sidebar-map-switcher').click();await page.getByTestId(`map-tree-node-${id}`).click();const close=page.getByTestId('sidebar-maps-close');if(await close.isVisible().catch(()=>false))await close.click();await page.waitForTimeout(700);}
const shot=name=>page.screenshot({path:resolve(out,`${name}.png`)});
try{
 await page.goto('http://127.0.0.1:9854/',{waitUntil:'domcontentloaded',timeout:120000});
 if(await page.locator('#access-code').count()){
  await page.locator('#access-code').fill(readFileSync(resolve(folder,'.oprn-host-access'),'utf8').trim());
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:120000}),page.locator('form[action="/__oprn/login"] button').click()]);
 }
 await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});
 await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready&&window.__oprnEditWorldToClient,null,{timeout:120000});
 const welcome=page.getByTestId('editor-welcome-skip');if(await welcome.isVisible().catch(()=>false))await welcome.click();
 await map('ramps_four');await page.getByTestId('layer-relief').first().click();
 await page.getByTestId('editor-zoom-stepper').click();await page.getByTestId('editor-zoom-0.5').click();await page.waitForTimeout(800);
 film=await startEditorScreencast(page,out,'terrain-rims-editor-2x.mp4',{selector:'body',cropTop:0,speed:2});
 await film.caption('절벽 위쪽 · 뒤 둑 / 안쪽 턱 / 대각 모서리');await shot('01-default-rims');
 for(const style of ['swamp-peat','tundra-snow']){
  await page.getByTestId('relief-style-select').selectOption(style);const saved=await waitSaved(s=>s.sha.ramps_four!==proof.before.sha.ramps_four);await page.waitForTimeout(800);
  await film.caption(`절벽 양식 ${style} · 원본 바닥 무늬와 외곽 유지`);await shot(style);
  proof.styles.push({style,savedRevision:saved.revision});
  await page.keyboard.press('Control+z');await waitSaved(s=>s.sha.ramps_four===proof.before.sha.ramps_four);await page.waitForTimeout(500);
 }
 await page.getByTestId('terrain-tool-surface').click();await page.getByTestId('terrain-width').selectOption('1');await page.getByTestId('terrain-material').selectOption('stone');
 const p=await page.evaluate(()=>window.__oprnEditWorldToClient(7.5*16,2.5*16));
 const clip={x:Math.floor(p.x-24),y:Math.floor(p.y-24),width:48,height:48};
 await page.mouse.move(1400,50);await page.waitForTimeout(500);const before=await page.screenshot({clip});
 await page.mouse.click(p.x,p.y);await page.mouse.move(1400,50);await waitSaved(s=>s.sha.ramps_four!==proof.before.sha.ramps_four);await page.waitForTimeout(700);
 const partial=await page.screenshot({clip});writeFileSync(resolve(out,'north-material-partial.png'),partial);
 await page.evaluate(()=>window.__oprnEditReliefRebuild());await page.waitForTimeout(700);const full=await page.screenshot({clip});writeFileSync(resolve(out,'north-material-full.png'),full);
 proof.surfaceChanged=pixelHash(before)!==pixelHash(partial);proof.partialMatchesFull=pixelHash(partial)===pixelHash(full);
 if(!proof.surfaceChanged||!proof.partialMatchesFull)throw Error('Northern rim surface refresh mismatch');
 await film.caption('위쪽 경계의 바닥 붓 · 부분 갱신 = 전체 다시 그리기');
 await page.keyboard.press('Control+z');await waitSaved(s=>s.sha.ramps_four===proof.before.sha.ramps_four);
 for(const id of ['terrain_ai','houses_native']){await map(id);await film.caption(id==='terrain_ai'?'복잡한 절벽 · 외곽 연결 확인':'절벽 위 원본 집 · 외곽과 집 모두 유지');await shot(id);}
 proof.recording=await film.stop();film=null;
 await page.reload({waitUntil:'domcontentloaded',timeout:120000});await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});
 proof.after=snapshot();proof.mapsUnchanged=Object.keys(proof.before.sha).every(id=>proof.before.sha[id]===proof.after.sha[id]);
 if(!proof.mapsUnchanged||proof.errors.length)throw Error('Editor reload/restoration failed');
 writeFileSync(resolve(out,'observations.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({partialMatchesFull:proof.partialMatchesFull,mapsUnchanged:proof.mapsUnchanged,revision:proof.after.revision,errors:proof.errors}));
}catch(e){proof.failure=e.message;await shot('failure').catch(()=>{});throw e;}
finally{if(film)await film.stop().catch(()=>{});writeFileSync(resolve(out,'observations.json'),JSON.stringify(proof,null,2));await browser.close();}
