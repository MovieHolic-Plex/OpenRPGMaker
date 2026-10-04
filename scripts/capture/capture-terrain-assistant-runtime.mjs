// Exported player, real collision checks, real movement, real Chromium frames.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {withTsModule} from '../ontology-ts-loader.mjs';
import {startProductionPlayerPreview} from './player-production-preview.mjs';
import {startEditorScreencast} from './editor-screencast.mjs';
const root=resolve('verify-shots/terrain-assistant-live/fixed'),out=resolve('verify-shots/terrain-assistant-live/runtime');mkdirSync(out,{recursive:true});
const project=JSON.parse(readFileSync(resolve(root,'project.json'),'utf8'));
// Same actual map, prepared through the shipping web-export contract.
project.tilesets={beodeul_city:project.tilesets.beodeul_city};
let wire;
await withTsModule(resolve('src/project/webExport.ts'),'terrain-ai-export.mjs',async({prepareWebExport})=>{wire=JSON.parse(prepareWebExport(project).projectJson);});
const trace=JSON.parse(readFileSync(resolve(root,'trace.json'),'utf8'));
const inspection=trace.filter(t=>t.name==='inspect_terrain').at(-1).data;
const access=trace.filter(t=>t.name==='check_terrain_access').at(-1).data;
if(!access.reachable||inspection.houses.length!==3||!inspection.houses.every(h=>h.flat))throw Error('Actual AI result failed before runtime capture');
const server=await startProductionPlayerPreview(),browser=await chromium.launch({args:['--no-proxy-server','--disable-background-networking','--js-flags=--max-old-space-size=8192']}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],proof={exportedPlayer:true,sourceProjectId:JSON.parse(readFileSync(resolve(root,'summary.json'),'utf8')).projectId,inspection,walks:[]};
page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.message);});
try{
 await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__runtime-qa/project.json',saveNamespace:'terrain-assistant-real',qaInstrumentation:true};});
 await page.route('**/__runtime-qa/project.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(wire)}));
 await page.goto(`${server.url}/player.html`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')||window.__oprnDebug?.readState()?.currentMapId,null,{timeout:120000});
 if(await page.getByTestId('title-screen').isVisible().catch(()=>false))await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__oprnDebug?.readState()?.currentMapId,null,{timeout:120000});await page.waitForTimeout(1000);
 const film=await startEditorScreencast(page,out,'terrain-assistant-runtime-2x.mp4',{selector:'body',cropTop:0,speed:2});
 await film.caption('AI 조수가 만든 실제 맵 · 출하 플레이어에서 통행 확인');
 for(const [index,route] of access.routes.entries()){
  await page.evaluate(({mapId,start})=>window.__oprnDebug.teleport(mapId,start.x,start.y),{mapId:'terrain_ai',start:route.path[0]});
  await page.waitForTimeout(400);
  const moves=route.path.slice(1).map((to,i)=>{const from=route.path[i];return{kind:'move',dir:to.x>from.x?'right':to.x<from.x?'left':to.y>from.y?'down':'up'};});
  const house=inspection.houses.find(h=>h.doorFront.x===route.target.x&&h.doorFront.y===route.target.y);
  await film.caption(`${index+1}번 집 · 높이 ${house.level} · 계단 없이 경사로로 올라가기`);
  // Each move passes startPlayerRouteStep's normal body/terrain/event collision checks. No through command.
  await page.evaluate(moves=>{window.__terrainWalkFrames=[];const scene=window.__oprnHooksScene;
    window.__terrainWalkObserver=()=>window.__terrainWalkFrames.push({x:scene.tileX,y:scene.tileY,playerY:scene.player?.y,through:scene.playerRoute?.through===true});
    scene.events.on('prerender',window.__terrainWalkObserver);window.__oprnDebug.playerRoute(moves);
  },moves);
  await page.waitForFunction(()=>!window.__oprnHooksScene.playerRoute&&!window.__oprnHooksScene.moving,null,{timeout:60000});
  await page.waitForTimeout(500);
  const walk=await page.evaluate(()=>{const scene=window.__oprnHooksScene;scene.events.off('prerender',window.__terrainWalkObserver);return{position:window.__oprnDebug.readLive(),frames:window.__terrainWalkFrames};});
  walk.target=route.target;walk.level=house.level;walk.reached=Math.abs(walk.position.x-route.target.x)<.05&&Math.abs(walk.position.y-route.target.y)<.05;
  proof.walks.push(walk);
  if(!walk.reached||walk.frames.some(f=>f.through))throw Error(`Actual runtime walk ${index+1} failed`);
  await page.screenshot({path:resolve(out,`house-${index+1}.png`)});console.log('reached',index+1,JSON.stringify(walk.position));
 }
 proof.film=await film.stop();proof.errors=errors;proof.passed=errors.length===0&&proof.walks.every(w=>w.reached);
 if(!proof.passed)throw Error('Runtime browser errors');
}catch(e){proof.failure=e.message;await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw e;}finally{writeFileSync(resolve(out,'observations.json'),JSON.stringify(proof,null,2));await browser.close();await server.close();}
console.log(JSON.stringify({passed:proof.passed,walks:proof.walks.length,errors}));
