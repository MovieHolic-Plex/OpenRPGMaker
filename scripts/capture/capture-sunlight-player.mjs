// Shipping player.html, independent of editor play. QA fixture changes only sun settings.
import {firefox} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {startProductionPlayerPreview} from './player-production-preview.mjs';
import {execFileSync} from 'node:child_process';
import {PNG} from 'pngjs';
const out=resolve('verify-shots/sunlight/player');mkdirSync(out,{recursive:true});
const wire=JSON.parse(readFileSync('.vite-cache/sunlight/project/player.json','utf8'));
wire.maps.ramps_four.sunlight={...wire.maps.houses_native.sunlight};
const server=await startProductionPlayerPreview();
const browser=await firefox.launch({firefoxUserPrefs:{'network.notify.changed':false,'network.captive-portal-service.enabled':false}});
const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:resolve('.vite-cache/sunlight/player-video'),size:{width:1440,height:960}}});
const page=await context.newPage(),video=page.video(),start=Date.now();let captureStart=0;
const proof={shippingPlayer:true,editorShell:false,qaSunSettingsOnly:true,states:[],ramps:[],errors:[]};
page.on('pageerror',e=>proof.errors.push(e.message));let film;
const idle=async()=>{await page.waitForFunction(()=>window.__oprnSunlight?.().pending===0,null,{timeout:90000});await page.waitForTimeout(300);};
const moved=async(x,y)=>{await page.waitForFunction(({x,y})=>{const s=window.__oprnHooksScene;return s.tileX===x&&s.tileY===y&&!s.moving;},{x,y},{timeout:10000});};
try{
 await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__runtime-qa/project.json',saveNamespace:'sunlight-player-qa',qaInstrumentation:true};});
 await page.route('**/__runtime-qa/project.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(wire)}));
 await page.goto(`${server.url}/player.html`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')||window.__oprnDebug?.readState()?.currentMapId,null,{timeout:120000});
 if(await page.getByTestId('title-screen').isVisible().catch(()=>false))await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__oprnHooksScene&&window.__oprnSunlight,null,{timeout:120000});
 await page.evaluate(()=>window.__oprnDebug.teleport('houses_native',24,45));await moved(24,45);await idle();
 captureStart=Date.now()-start;
 film={caption:async text=>{console.log(text);await page.evaluate(text=>{let c=document.getElementById('sunlight-film-caption');if(!c){c=document.createElement('div');c.id='sunlight-film-caption';Object.assign(c.style,{position:'fixed',left:'24px',bottom:'16px',zIndex:'2147483647',background:'#172535',color:'#fff',padding:'10px 14px',font:'500 18px system-ui',pointerEvents:'none'});document.body.append(c);}c.textContent=text;},text);await page.waitForTimeout(700);},stop:async()=>({speed:2,realFrames:true})};
 for(const [name,azimuth,altitude]of[['northwest-low',315,24],['southeast-low',135,24],['northwest-high',315,75]]){
  await page.evaluate(({azimuth,altitude})=>{const s=window.__oprnHooksScene;s.map.sunlight={...s.map.sunlight,azimuth,altitude};},{azimuth,altitude});await idle();
  await film.caption(`출하 플레이어 · 태양 ${azimuth}° / 고도 ${altitude}°`);
  await page.screenshot({path:resolve(out,`${name}.png`)});const canvas=await page.locator('canvas').first().screenshot();
  proof.states.push({name,sha:createHash('sha256').update(canvas).digest('hex'),stats:await page.evaluate(()=>window.__oprnSunlight())});
 }
 if(new Set(proof.states.map(s=>s.sha)).size!==3)throw Error('Player sun settings did not change actual frames');
 const before=await page.evaluate(()=>window.__oprnSunlight());await page.waitForTimeout(1300);const after=await page.evaluate(()=>window.__oprnSunlight());
 if(before.builds!==after.builds||before.frames!==after.frames)throw Error('Static player sun re-baked during idle');proof.idleCache=true;
 const cases=JSON.parse(readFileSync('.vite-cache/terrain-seams/cases.json','utf8'));
 for(const c of cases){
  await page.evaluate(start=>window.__oprnDebug.teleport('ramps_four',start.x,start.y),c.start);await moved(c.start.x,c.start.y);await idle();
  await film.caption(`그림자를 켠 상태 · ${c.dir.toUpperCase()} 경사로 왕복`);
  let steps=0;
  for(const target of[c.target,c.start]){
   let pos=await page.evaluate(()=>({x:window.__oprnHooksScene.tileX,y:window.__oprnHooksScene.tileY}));
   while(pos.x!==target.x||pos.y!==target.y){
    const next={x:pos.x+Math.sign(target.x-pos.x),y:pos.y+Math.sign(target.y-pos.y)};
    const key=next.x>pos.x?'ArrowRight':next.x<pos.x?'ArrowLeft':next.y>pos.y?'ArrowDown':'ArrowUp';
    await page.keyboard.down(key);await page.waitForFunction(()=>window.__oprnHooksScene.moving,null,{timeout:3000});await page.keyboard.up(key);await moved(next.x,next.y);
    const moving=await page.evaluate(()=>({through:window.__oprnHooksScene.playerRoute?.through===true,playerActive:window.__oprnHooksScene.player.active}));
    if(moving.through||!moving.playerActive)throw Error('Sunlight affected actual walking');steps++;pos=next;
   }
  }
  proof.ramps.push({dir:c.dir,steps});await page.screenshot({path:resolve(out,`ramp-${c.dir}.png`)});
  if(c.dir==='e'){
   // Exact row starts on a flat shaded receiver: the previous Canvas half-pixel expansion left these unshaded.
   const points=await page.evaluate(()=>{const s=window.__oprnHooksScene,c=s.cameras.main,r=s.game.canvas.getBoundingClientRect();return [12,13,14,15].map(row=>({row,x:Math.floor(r.left+((31.5*16-c.scrollX)*c.zoom+c.x)*r.width/s.scale.width),y:Math.floor(r.top+((row*16-c.scrollY)*c.zoom+c.y)*r.height/s.scale.height)}));});
   const on=PNG.sync.read(await page.screenshot());const previous=await page.evaluate(()=>({...window.__oprnHooksScene.map.sunlight}));
   await page.evaluate(()=>window.__oprnHooksScene.map.sunlight.enabled=false);await page.waitForFunction(()=>window.__oprnSunlight().textures===0);await page.waitForTimeout(200);
   const off=PNG.sync.read(await page.screenshot());
   proof.rowSeams=points.map(p=>({...p,darkening:off.data[(p.y*off.width+p.x)*4+1]-on.data[(p.y*on.width+p.x)*4+1]}));
   if(proof.rowSeams.some(p=>p.darkening<20))throw Error('Unshaded stripe at a native Canvas row boundary');
   await page.evaluate(sun=>window.__oprnHooksScene.map.sunlight=sun,previous);await idle();
  }
 }
 const beforeSwitch=await page.evaluate(()=>window.__oprnSunlight());
 await page.evaluate(()=>window.__oprnDebug.teleport('terrain_ai',4,42));await moved(4,42);await idle();
 const disabled=await page.evaluate(()=>window.__oprnSunlight());if(disabled.enabled||disabled.textures!==0)throw Error('Map switch leaked sun textures');
 proof.mapSwitchCleanup=true;proof.beforeSwitchTextures=beforeSwitch.textures;proof.offStats=disabled;
 await film.caption('태양 설정 없는 지도 · 그림자 텍스처 정리');proof.recording=await film.stop();film=null;
 if(proof.errors.length)throw Error('Player page errors');
}catch(e){proof.failure=String(e);await page.screenshot({path:resolve(out,'failure.png')});throw e;}
finally{if(film)await film.stop().catch(()=>{});writeFileSync(resolve(out,'observations.json'),JSON.stringify(proof,null,2));await context.close();const raw=await video.path();await browser.close();await server.close();if(!proof.failure)execFileSync('ffmpeg',['-y','-ss',String(captureStart/1000),'-i',raw,'-vf','setpts=0.5*PTS','-an','-c:v','libx264','-pix_fmt','yuv420p','-crf','23','-movflags','+faststart',resolve(out,'sunlight-player-2x.mp4')],{stdio:'ignore'});console.log(JSON.stringify({...proof,states:proof.states.map(s=>({name:s.name,pending:s.stats.pending,textures:s.stats.textures})),recording:undefined}));}
