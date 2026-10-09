// Native controls in the packaged editor; real masks, own SQLite store and reload.
import {firefox} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const folder=resolve('.vite-cache/sunlight/project'),out=resolve(process.env.OPRN_SUNLIGHT_QA_OUT??'verify-shots/sunlight/editor');mkdirSync(out,{recursive:true});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const snapshot=()=>{const db=new DatabaseSync(resolve(folder,'project.sqlite'),{readOnly:true});try{
 const info=db.prepare('select project_id,revision from project where id=1').get(),rows=db.prepare('select map_id,map_json from maps').all();
 return {...info,maps:Object.fromEntries(rows.map(r=>[r.map_id,JSON.parse(r.map_json)]))};
}finally{db.close();}};
const saved=async predicate=>{for(let i=0;i<100;i++){const p=snapshot();if(predicate(p.maps.houses_native))return p;await new Promise(r=>setTimeout(r,150));}throw Error('SQLite save missing');};
const browser=await firefox.launch({firefoxUserPrefs:{'network.notify.changed':false,'network.captive-portal-service.enabled':false}});
const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:resolve('.vite-cache/sunlight/video'),size:{width:1440,height:960}}});
const page=await context.newPage(),video=page.video(),start=Date.now();let captureStart=0;
const proof={realPackagedEditor:true,before:snapshot(),states:[],errors:[]};page.on('pageerror',e=>proof.errors.push(e.message));
const idle=async enabled=>{await page.waitForFunction(enabled=>{const s=window.__oprnEditSunlightStats?.();return s&&s.enabled===enabled&&s.pending===0;},enabled,{timeout:90000});await page.waitForTimeout(250);};
const caption=async text=>{console.log(text);await page.evaluate(text=>{let c=document.getElementById('sunlight-film-caption');if(!c){c=document.createElement('div');c.id='sunlight-film-caption';Object.assign(c.style,{position:'fixed',bottom:'8px',left:'340px',zIndex:'2147483647',background:'#172535',color:'#fff',padding:'9px 14px',font:'500 16px system-ui',pointerEvents:'none'});document.body.append(c);}c.textContent=text;},text);};
const shot=async name=>{await page.mouse.move(1400,50);await page.waitForTimeout(250);await page.screenshot({path:resolve(out,`${name}.png`)});await page.locator('.canvas-area').screenshot({path:resolve(out,`${name}-canvas.jpg`),type:'jpeg',quality:88});};
const open=()=>page.getByTestId('terrain-sunlight-settings').click();
const close=()=>page.keyboard.press('Escape');
const number=async(testid,value)=>{const input=page.getByTestId(`map-sunlight-${testid}-number`);await input.fill(String(value));await input.press('Tab');};
try{
 let ready=false;for(let n=0;n<60;n++){try{ready=(await fetch('http://127.0.0.1:9855/',{signal:AbortSignal.timeout(2000)})).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw Error('Own QA host did not become ready');
 await page.goto('http://127.0.0.1:9855/',{waitUntil:'domcontentloaded',timeout:120000});
 if(await page.locator('#access-code').count()){await page.locator('#access-code').fill(readFileSync(resolve(folder,'.oprn-host-access'),'utf8').trim());await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:120000}),page.locator('form[action="/__oprn/login"] button').click()]);}
 await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});
 await page.waitForFunction(()=>window.__oprnEditSunlightStats&&window.__oprnEditWorldToClient,null,{timeout:120000});
 const welcome=page.getByTestId('editor-welcome-skip');if(await welcome.isVisible().catch(()=>false))await welcome.click();
 await page.getByTestId('sidebar-map-switcher').click();await page.getByTestId('map-tree-node-houses_native').click();
 const mapClose=page.getByTestId('sidebar-maps-close');if(await mapClose.isVisible().catch(()=>false))await mapClose.click();
 await page.getByTestId('layer-relief').first().click();await page.getByTestId('editor-zoom-stepper').click();await page.getByTestId('editor-zoom-0.5').click();
 await idle(true);captureStart=Date.now()-start;
 await caption('실제 에디터 · 버들항 집과 절벽 · 태양 아이콘에서 설정');await page.waitForTimeout(800);
 await open();await page.getByTestId('map-sunlight-enable').uncheck();await saved(m=>m.sunlight.enabled===false);await close();await idle(false);
 await caption('태양 그림자 끄기 · 기존 지형과 집 유지');await shot('01-off');proof.states.push({name:'off',stats:await page.evaluate(()=>window.__oprnEditSunlightStats())});await page.waitForTimeout(1300);
 await open();await page.getByTestId('map-sunlight-enable').check();await number('azimuth',315);await number('altitude',24);await number('softness',2);
 await saved(m=>m.sunlight.azimuth===315&&m.sunlight.altitude===24);await page.screenshot({path:resolve(out,'02-controls.png')});await close();await idle(true);
 await caption('북서쪽 낮은 태양 · 고지 위 집과 절벽의 긴 그림자');await shot('02-northwest-low');proof.states.push({name:'northwest-low',stats:await page.evaluate(()=>window.__oprnEditSunlightStats())});await page.waitForTimeout(1500);
 const beforeIdle=await page.evaluate(()=>window.__oprnEditSunlightStats());await page.waitForTimeout(1500);const afterIdle=await page.evaluate(()=>window.__oprnEditSunlightStats());
 if(!beforeIdle.nativeArt||beforeIdle.casters.length!==4)throw Error('Native building silhouettes not active');
 if(beforeIdle.casters.find(c=>c.id==='sp_a2ff01d4-09f0-4e24-a2c7-65a12be34406')?.components!==3)throw Error('House and detached statues merged');
 proof.nativeBuildingSilhouettes=true;
 if(beforeIdle.frames!==afterIdle.frames||beforeIdle.builds!==afterIdle.builds)throw Error('Static sun rebuilt during idle');proof.idleCache=true;
 await open();await number('azimuth',135);await saved(m=>m.sunlight.azimuth===135&&m.sunlight.altitude===24);await close();await idle(true);
 await caption('태양을 남동쪽으로 · 그림자가 반대쪽으로 이동');await shot('03-southeast-low');proof.states.push({name:'southeast-low',stats:await page.evaluate(()=>window.__oprnEditSunlightStats())});await page.waitForTimeout(1500);
 await open();await number('azimuth',315);await number('altitude',75);await saved(m=>m.sunlight.azimuth===315&&m.sunlight.altitude===75);await close();await idle(true);
 await caption('태양 고도 75° · 짧아진 그림자');await shot('04-northwest-high');proof.states.push({name:'northwest-high',stats:await page.evaluate(()=>window.__oprnEditSunlightStats())});await page.waitForTimeout(1500);
 await open();await number('altitude',35);await saved(m=>m.sunlight.altitude===35);await close();await idle(true);
 const persisted=snapshot();await caption('SQLite 저장 · 새로고침 후 같은 그림자');await page.reload({waitUntil:'domcontentloaded',timeout:120000});
 await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});await idle(true);await shot('05-reloaded');
 const reloaded=snapshot();if(hash(reloaded.maps.houses_native)!==hash(persisted.maps.houses_native))throw Error('Reload changed saved map');
 const strip=m=>{const{sunlight,...rest}=m;return rest;};
 if(hash(strip(reloaded.maps.houses_native))!==hash(strip(proof.before.maps.houses_native)))throw Error('Sun settings changed authored tiles/terrain');
 for(const id of Object.keys(proof.before.maps))if(id!=='houses_native'&&hash(proof.before.maps[id])!==hash(reloaded.maps[id]))throw Error('Unrelated map changed');
 proof.canonicalReload=true;proof.contentUnchanged=true;proof.projectId=reloaded.project_id;proof.revision=reloaded.revision;proof.savedSun=reloaded.maps.houses_native.sunlight;
 delete proof.before.maps;await page.waitForTimeout(1000);
 if(proof.errors.length)throw Error('Editor page errors');
}catch(e){proof.failure=String(e);await page.screenshot({path:resolve(out,'failure.png')});throw e;}
finally{
 writeFileSync(resolve(out,'observations.json'),JSON.stringify(proof,null,2));await context.close();const raw=await video.path();await browser.close();
 if(!proof.failure){execFileSync('ffmpeg',['-y','-ss',String(captureStart/1000),'-i',raw,'-vf','setpts=0.5*PTS','-an','-c:v','libx264','-pix_fmt','yuv420p','-crf','23','-movflags','+faststart',resolve(out,'sunlight-editor-2x.mp4')],{stdio:'ignore'});}
 console.log(JSON.stringify({...proof,before:undefined,states:proof.states.map(s=>({name:s.name,pending:s.stats.pending,textures:s.stats.textures,casters:s.stats.casters?.length}))}));
}
