// Shipped player.html; terrain/road receiver evidence without an editor shell.
import {firefox} from 'playwright';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {startProductionPlayerPreview} from './player-production-preview.mjs';
const out=resolve('verify-shots/terrain-shadows/player');mkdirSync(out,{recursive:true});
const wire=JSON.parse(readFileSync('.vite-cache/terrain-shadows/project/player.json','utf8'));
const server=await startProductionPlayerPreview(),browser=await firefox.launch(),page=await browser.newPage({viewport:{width:1280,height:800}});
const proof={shippingPlayer:true,editorShell:false,states:[],errors:[]};page.on('pageerror',e=>proof.errors.push(e.message));
const idle=async()=>{await page.waitForFunction(()=>window.__oprnSunlight?.().pending===0,null,{timeout:90000});await page.waitForTimeout(200);};
try{
 await page.addInitScript(()=>window.__OPENRPG_BOOT__={projectUrl:'/__runtime-qa/project.json',saveNamespace:'terrain-shadow-player-qa',qaInstrumentation:true});
 await page.route('**/__runtime-qa/project.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(wire)}));
 await page.goto(server.url+'/player.html',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')||window.__oprnDebug?.readState()?.currentMapId,null,{timeout:120000});
 if(await page.getByTestId('title-screen').isVisible().catch(()=>false))await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__oprnHooksScene&&window.__oprnSunlight,null,{timeout:120000});
 await page.evaluate(()=>window.__oprnDebug.teleport('shadow_receivers',24,30));await page.evaluate(()=>{window.__oprnHooksScene.cameras.main.setZoom(.25);});await idle();
 for(const [name,azimuth,altitude]of[['default',315,65],['northwest',315,45],['southeast',135,45]]){
  await page.evaluate(({azimuth,altitude})=>{const m=window.__oprnHooksScene.map;m.sunlight={...m.sunlight,azimuth,altitude};},{azimuth,altitude});await idle();
  const stats=await page.evaluate(()=>window.__oprnSunlight());if(stats.maxTerrain!==Math.max(...wire.maps.shadow_receivers.relief.levels)||stats.casters.length)throw Error('Native brush terrain missing or road became a caster');
  await page.screenshot({path:resolve(out,name+'.png')});const frame=await page.locator('canvas').first().screenshot();writeFileSync(resolve(out,name+'-canvas.png'),frame);
  proof.states.push({name,sha256:createHash('sha256').update(frame).digest('hex'),stats});
 }
 if(new Set(proof.states.map(s=>s.sha256)).size!==3)throw Error('Sun parameters failed to alter terrain pixels');
 const a=await page.evaluate(()=>window.__oprnSunlight());await page.waitForTimeout(1200);const b=await page.evaluate(()=>window.__oprnSunlight());if(a.builds!==b.builds||a.frames!==b.frames)throw Error('Static shadow re-baked');proof.idleCache=true;
 await page.evaluate(()=>{window.__oprnHooksScene.map.sunlight.enabled=false;});await page.waitForFunction(()=>window.__oprnSunlight().textures===0);await page.screenshot({path:resolve(out,'off.png')});proof.offCleanup=true;
 await page.evaluate(()=>window.__oprnDebug.teleport('houses_native',24,48));await page.evaluate(()=>{window.__oprnHooksScene.cameras.main.setZoom(.5);});await idle();
 const stats=await page.evaluate(()=>window.__oprnSunlight());if(!stats.nativeArt||stats.casters.length!==4)throw Error('Native Beodeul house silhouette regression');proof.houseCasters=stats.casters;
 await page.screenshot({path:resolve(out,'houses.png')});
 await page.evaluate(()=>window.__oprnDebug.teleport('terrain_ai',4,42));await idle();if((await page.evaluate(()=>window.__oprnSunlight())).textures!==0)throw Error('Map switch leaked masks');proof.mapSwitchCleanup=true;
 if(proof.errors.length)throw Error('Player page errors');
}catch(e){proof.failure=String(e);await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw e;}
finally{writeFileSync(resolve(out,'observations.json'),JSON.stringify(proof,null,2));await browser.close();await server.close();console.log({failure:proof.failure,idleCache:proof.idleCache,offCleanup:proof.offCleanup,errors:proof.errors});}
