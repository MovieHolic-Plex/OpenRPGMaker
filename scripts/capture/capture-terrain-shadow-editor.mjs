// Native packaged editor controls, own SQLite project, real height brush and reload.
import {firefox} from 'playwright';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';import {DatabaseSync} from 'node:sqlite';import {execFileSync} from 'node:child_process';
const folder=resolve('.vite-cache/terrain-shadows/project'),out=resolve('verify-shots/terrain-shadows/editor');mkdirSync(out,{recursive:true});
const snapshot=()=>{const db=new DatabaseSync(resolve(folder,'project.sqlite'),{readOnly:true});try{return {info:db.prepare('select project_id,revision from project where id=1').get(),maps:Object.fromEntries(db.prepare('select map_id,map_json from maps').all().map(r=>[r.map_id,JSON.parse(r.map_json)]))};}finally{db.close();}};
const saved=async predicate=>{for(let i=0;i<100;i++){const s=snapshot();if(predicate(s.maps.shadow_receivers))return s;await new Promise(r=>setTimeout(r,150));}throw Error('Canonical save missing');};
const browser=await firefox.launch(),context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:resolve('.vite-cache/terrain-shadows/video'),size:{width:1440,height:960}}});
const page=await context.newPage(),video=page.video(),started=Date.now();let captureStart=0;
const proof={packagedEditor:true,states:[],errors:[]},before=snapshot();page.on('pageerror',e=>proof.errors.push(e.message));
const idle=async()=>{await page.waitForFunction(()=>window.__oprnEditSunlightStats?.().pending===0,null,{timeout:90000});await page.waitForTimeout(250);};
const caption=async text=>{console.log(text);await page.evaluate(text=>{let c=document.getElementById('terrain-shadow-caption');if(!c){c=document.createElement('div');c.id='terrain-shadow-caption';Object.assign(c.style,{position:'fixed',left:'340px',bottom:'8px',zIndex:'2147483647',background:'#172535',color:'#fff',padding:'9px 14px',font:'500 16px system-ui',pointerEvents:'none'});document.body.append(c);}c.textContent=text;},text);};
const shot=async name=>{await idle();await page.mouse.move(1400,50);await page.screenshot({path:resolve(out,name+'.png')});await page.locator('.canvas-area').screenshot({path:resolve(out,name+'-canvas.png')});proof.states.push({name,stats:await page.evaluate(()=>window.__oprnEditSunlightStats())});};
const openSun=()=>page.getByTestId('terrain-sunlight-settings').click();
const sunNumber=async(name,value)=>{const c=page.getByTestId('map-sunlight-'+name+'-number');await c.fill(String(value));await c.press('Tab');};
try{
 await page.goto('http://127.0.0.1:9868/',{waitUntil:'domcontentloaded',timeout:120000});
 if(await page.locator('#access-code').count()){await page.locator('#access-code').fill(readFileSync(resolve(folder,'.oprn-host-access'),'utf8').trim());await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:120000}),page.locator('form[action="/__oprn/login"] button').click()]);}
 await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});await page.waitForFunction(()=>window.__oprnEditWorldToClient,null,{timeout:120000});
 const welcome=page.getByTestId('editor-welcome-skip');if(await welcome.isVisible().catch(()=>false))await welcome.click();
 const chooseMap=async id=>{await page.getByTestId('sidebar-map-switcher').click();await page.getByTestId('map-tree-node-'+id).click();const close=page.getByTestId('sidebar-maps-close');if(await close.isVisible().catch(()=>false))await close.click();await page.waitForTimeout(700);};
 await chooseMap('houses_native');await chooseMap('shadow_receivers');
 await page.getByTestId('layer-relief').first().click();await page.getByTestId('editor-zoom-stepper').click();await page.getByTestId('editor-zoom-0.5').click();await idle();captureStart=Date.now()-started;
 await caption('실제 에디터 · 높이 붓 지형과 도로 · 태양 65°');await shot('01-height-and-road');
 await openSun();await sunNumber('altitude',45);await saved(m=>m.sunlight.altitude===45);await page.keyboard.press('Escape');await idle();
 await page.getByTestId('terrain-tool-height').click();await page.getByTestId('relief-mode-set').click();await page.getByTestId('relief-size-M').click();
 for(let i=0;i<14;i++){const level=parseInt(await page.getByTestId('relief-level-value').textContent(),10);if(level===6)break;await page.getByTestId(level<6?'relief-level-up':'relief-level-down').click();}
 const oldBuilds=(await page.evaluate(()=>window.__oprnEditSunlightStats())).builds;
 const at=await page.evaluate(()=>window.__oprnEditWorldToClient(8.5*16,9.5*16));await caption('높이 붓으로 새 고지를 세우기 · 그림자 자동 갱신');await page.mouse.click(at.x,at.y,{delay:120});
 await saved(m=>Math.max(...m.relief.levels)>4);await idle();const afterBrush=await page.evaluate(()=>window.__oprnEditSunlightStats());
 if(afterBrush.maxTerrain<=4||afterBrush.builds<=oldBuilds)throw Error('Height brush failed to refresh sunlight geometry');
 proof.nativeHeightBrush=true;proof.brushStats=afterBrush;await shot('02-brush-shadow');await page.waitForTimeout(1000);
 await openSun();await page.getByTestId('map-sunlight-enable').uncheck();await saved(m=>!m.sunlight.enabled);await page.keyboard.press('Escape');await caption('그림자 끄기 · 도로와 높이 지형 유지');await shot('03-off');await page.waitForTimeout(700);
 await openSun();await page.getByTestId('map-sunlight-enable').check();await sunNumber('azimuth',135);await saved(m=>m.sunlight.enabled&&m.sunlight.azimuth===135);await page.keyboard.press('Escape');await caption('태양을 반대쪽으로 · 지형 그림자도 반대로');await shot('04-opposite-sun');await page.waitForTimeout(1000);
 await openSun();await sunNumber('azimuth',315);await sunNumber('altitude',65);await saved(m=>m.sunlight.azimuth===315&&m.sunlight.altitude===65);await page.keyboard.press('Escape');await shot('05-default-sun');
 const a=await page.evaluate(()=>window.__oprnEditSunlightStats());await page.waitForTimeout(1200);const b=await page.evaluate(()=>window.__oprnEditSunlightStats());if(a.builds!==b.builds||a.frames!==b.frames)throw Error('Idle rebuilt sunlight');proof.idleCache=true;
 const persisted=snapshot();await page.reload({waitUntil:'domcontentloaded',timeout:120000});await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});await idle();await caption('SQLite 저장 후 재로드 · 새 고지와 그림자 유지');await shot('06-reloaded');
 const loaded=snapshot();if(JSON.stringify(loaded.maps.shadow_receivers)!==JSON.stringify(persisted.maps.shadow_receivers))throw Error('Saved map changed after reload');
 for(const id of Object.keys(before.maps))if(id!=='shadow_receivers'&&JSON.stringify(before.maps[id])!==JSON.stringify(loaded.maps[id]))throw Error('Unrelated map changed');
 proof.canonicalReload=true;proof.projectId=loaded.info.project_id;proof.revision=loaded.info.revision;proof.otherMapsUnchanged=true;
 if(proof.errors.length)throw Error('Editor page errors');
}catch(e){proof.failure=String(e);await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw e;}
finally{writeFileSync(resolve(out,'observations.json'),JSON.stringify(proof,null,2));await context.close();const raw=await video.path();await browser.close();if(!proof.failure)execFileSync('ffmpeg',['-y','-ss',String(captureStart/1000),'-i',raw,'-vf','setpts=0.5*PTS','-an','-c:v','libx264','-pix_fmt','yuv420p','-crf','23','-movflags','+faststart',resolve(out,'terrain-shadow-editor-2x.mp4')],{stdio:'ignore'});console.log({nativeHeightBrush:proof.nativeHeightBrush,canonicalReload:proof.canonicalReload,failure:proof.failure,errors:proof.errors});}
