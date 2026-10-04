// Shipping player, actual keyboard/pointer inputs and rendered foot positions.
// Each teleport below is declared scenario initialization; traversals never teleport or use through.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {withTsModule} from '../ontology-ts-loader.mjs';
import {startProductionPlayerPreview} from './player-production-preview.mjs';
import {startEditorScreencast} from './editor-screencast.mjs';
const arg=(n,f)=>{const i=process.argv.indexOf(`--${n}`);return i<0?f:process.argv[i+1];};
const source=resolve(arg('source','.vite-cache/terrain-seams/live')),out=resolve(arg('out','verify-shots/terrain-seams/runtime'));
mkdirSync(out,{recursive:true});
const project=JSON.parse(readFileSync(resolve(source,'project.json'),'utf8')),saved=JSON.parse(readFileSync(resolve(source,'summary.json'),'utf8'));
if(!saved.reloadMapEqual)throw Error('Canonical SQLite reload proof missing');
const cases=JSON.parse(readFileSync(resolve(arg('cases','.vite-cache/terrain-seams/cases.json')),'utf8'));
let wire;await withTsModule(resolve('src/project/webExport.ts'),'terrain-seams-export.mjs',async({prepareWebExport})=>{wire=JSON.parse(prepareWebExport(project).projectJson);});
const server=await startProductionPlayerPreview(),browser=await chromium.launch({args:['--no-proxy-server','--disable-background-networking','--js-flags=--max-old-space-size=8192']}),page=await browser.newPage({viewport:{width:1440,height:960}});
const proof={exportedPlayer:true,projectId:saved.projectId,revision:saved.revision,scenarioInitializations:[],ramps:[],houses:[],errors:[]};
page.on('pageerror',e=>proof.errors.push(e.message));let film;
const idle=()=>page.waitForFunction(()=>!window.__oprnHooksScene.moving&&!window.__oprnHooksScene.playerRoute,null,{timeout:15000});
async function keyboardWalk(from,to){
 let pos=from;while(pos.x!==to.x||pos.y!==to.y){
  const key=pos.x<to.x?'ArrowRight':pos.x>to.x?'ArrowLeft':pos.y<to.y?'ArrowDown':'ArrowUp';
  const dest={x:pos.x+(key==='ArrowRight'?1:key==='ArrowLeft'?-1:0),y:pos.y+(key==='ArrowDown'?1:key==='ArrowUp'?-1:0)};
  await page.keyboard.down(key);await page.waitForFunction(()=>window.__oprnHooksScene.moving,null,{timeout:3000});await page.keyboard.up(key);await idle();
  const landed=await page.evaluate(()=>({x:window.__oprnHooksScene.tileX,y:window.__oprnHooksScene.tileY}));
  if(landed.x!==dest.x||landed.y!==dest.y)throw Error(`Keyboard walk landed ${JSON.stringify(landed)}, expected ${JSON.stringify(dest)}`);pos=dest;
 }
}
async function clickCell(target,lift,zoom){
 await page.evaluate(zoom=>{const s=window.__oprnHooksScene,c=s.cameras.main,rect=s.game.canvas.getBoundingClientRect();c.setZoom(zoom/(rect.width/c.width));},zoom);
 await page.waitForTimeout(300);
 const point=await page.evaluate(({target,lift})=>{
  const s=window.__oprnHooksScene,c=s.cameras.main,rect=s.game.canvas.getBoundingClientRect();
  return{x:rect.left+((target.x+.5)*16-c.worldView.x)*c.zoom*rect.width/c.width,y:rect.top+((target.y+.5-lift)*16-c.worldView.y)*c.zoom*rect.height/c.height};
 },{target,lift});
 if(point.x<0||point.x>=1440||point.y<0||point.y>=960)throw Error('Click target outside actual viewport');
 await page.mouse.click(point.x,point.y);
 await page.waitForFunction(target=>window.__oprnHooksScene.tileX===target.x&&window.__oprnHooksScene.tileY===target.y&&!window.__oprnHooksScene.moving&&!window.__oprnHooksScene.playerRoute,target,{timeout:15000});
 return await page.evaluate(()=>document.querySelector('[data-pointer-move]')?.dataset.pointerMove);
}
try{
 await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__runtime-qa/project.json',saveNamespace:'terrain-seams-real',qaInstrumentation:true};});
 await page.route('**/__runtime-qa/project.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(wire)}));
 await page.goto(`${server.url}/player.html`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')||window.__oprnDebug?.readState()?.currentMapId,null,{timeout:120000});
 if(await page.getByTestId('title-screen').isVisible().catch(()=>false))await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__oprnDebug?.readState()?.currentMapId,null,{timeout:120000});await page.waitForTimeout(800);
 film=await startEditorScreencast(page,out,'terrain-seams-runtime-2x.mp4',{selector:'body',cropTop:0,speed:2});
 for(const c of cases){
  proof.scenarioInitializations.push({mapId:'ramps_four',position:c.start});
  await page.evaluate(start=>window.__oprnDebug.teleport('ramps_four',start.x,start.y),c.start);await page.waitForTimeout(500);
  await page.evaluate(c=>{const s=window.__oprnHooksScene;window.__rampFrames=[];window.__rampObserve=()=>{
   const p=s.moving?s.moveProgress:0,x=s.moving?s.movingFrom.x+(s.movingTo.x-s.movingFrom.x)*p:s.tileX,y=s.moving?s.movingFrom.y+(s.movingTo.y-s.movingFrom.y)*p:s.tileY;
   window.__rampFrames.push({groundX:(x+.5)*16,groundY:(y+1)*16,renderedX:s.player.x,renderedY:s.player.y,x,y,moving:s.moving,through:s.playerRoute?.through===true});
  };s.events.on('postupdate',window.__rampObserve);const rect=s.game.canvas.getBoundingClientRect();s.cameras.main.setZoom(3/(rect.width/s.cameras.main.width));},c);
  await film.caption(`${c.dir.toUpperCase()} 방향 경사로 · 키보드 왕복 · 클릭 이동`);
  await keyboardWalk(c.start,c.target);await page.screenshot({path:resolve(out,`ramp-${c.dir}-crest.png`)});
  await keyboardWalk(c.target,c.start);
  const up=await clickCell(c.target,3,2),down=await clickCell(c.start,0,3);
  const frames=await page.evaluate(()=>{window.__oprnHooksScene.events.off('postupdate',window.__rampObserve);return window.__rampFrames;});
  let maxFootError=0,maxMovingDelta=0;
  for(let i=0;i<frames.length;i++){
   const f=frames[i],x=f.groundX/16,y=f.groundY/16;
   // Expected physical surface from this independently authored 0→3, four-cell scenario.
   const inside=x>=c.x&&x<c.x+c.w&&y>c.y&&y<=c.y+c.h;
   const t=c.dir==='n'?(c.y+c.h-y)/c.h:c.dir==='s'?(y-c.y)/c.h:c.dir==='e'?(x-c.x)/c.w:(c.x+c.w-x)/c.w;
   let height=inside?Math.max(0,Math.min(1,t))*3:0;
   const [px,py,pw,ph]=c.rect;if(x>=px&&x<px+pw&&y>py&&y<=py+ph)height=3;
   maxFootError=Math.max(maxFootError,Math.abs(f.groundY-height*16-f.renderedY));
   if(i&&f.moving&&frames[i-1].moving)maxMovingDelta=Math.max(maxMovingDelta,Math.abs(f.renderedY-frames[i-1].renderedY));
  }
  if(maxFootError>1||frames.some(f=>f.through))throw Error(`${c.dir} rendered foot mismatch: ${maxFootError}`);
  // A side entry halfway up the ramp must stay blocked under actual keyboard input.
  const side=c.dir==='n'||c.dir==='s'?{x:c.x-1,y:c.y+1}:{x:c.x+1,y:c.y-1},key=c.dir==='n'||c.dir==='s'?'ArrowRight':'ArrowDown';
  proof.scenarioInitializations.push({mapId:'ramps_four',position:side,purpose:'blocked side entry'});
  await page.evaluate(side=>window.__oprnDebug.teleport('ramps_four',side.x,side.y),side);await page.waitForTimeout(200);
  await page.keyboard.down(key);await page.waitForTimeout(250);await page.keyboard.up(key);await idle();
  const blocked=await page.evaluate(side=>window.__oprnHooksScene.tileX===side.x&&window.__oprnHooksScene.tileY===side.y,side);
  if(!blocked)throw Error(`${c.dir} side entry allowed`);
  proof.ramps.push({dir:c.dir,keyboardAscent:true,keyboardDescent:true,clickAscent:up,clickDescent:down,displayScales:[2,3],sideBlocked:blocked,frames:frames.length,maxFootErrorPx:maxFootError,maxMovingDeltaPx:maxMovingDelta});
  writeFileSync(resolve(out,`ramp-${c.dir}-frames.json`),JSON.stringify(frames));
 }
 const trace=JSON.parse(readFileSync(resolve(source,'trace.json'),'utf8')),inspection=trace.filter(t=>t.name==='inspect_terrain').at(-1).data,access=trace.filter(t=>t.name==='check_terrain_access').at(-1).data;
 if(!access.reachable||inspection.houses.length!==3||!inspection.houses.every(h=>h.flat))throw Error('Native houses failed terrain access');
 for(const [n,route]of access.routes.entries()){
  const house=inspection.houses.find(h=>h.doorFront.x===route.target.x&&h.doorFront.y===route.target.y);
  proof.scenarioInitializations.push({mapId:'houses_native',position:route.path[0]});
  await page.evaluate(start=>window.__oprnDebug.teleport('houses_native',start.x,start.y),route.path[0]);await page.waitForTimeout(300);
  await film.caption(`버들항 원본 ${house.kitId} · 높이 ${house.level} · 실제 현관까지 걷기`);
  const moves=route.path.slice(1).map((to,i)=>{const from=route.path[i];return{kind:'move',dir:to.x>from.x?'right':to.x<from.x?'left':to.y>from.y?'down':'up'};});
  await page.evaluate(moves=>window.__oprnDebug.playerRoute(moves),moves);await page.waitForFunction(()=>!window.__oprnHooksScene.playerRoute&&!window.__oprnHooksScene.moving,null,{timeout:60000});
  const reached=await page.evaluate(target=>window.__oprnHooksScene.tileX===target.x&&window.__oprnHooksScene.tileY===target.y,route.target);
  if(!reached)throw Error(`Native house ${house.kitId} unreachable`);
  await page.waitForTimeout(500);await page.screenshot({path:resolve(out,`native-house-${n+1}.png`)});proof.houses.push({kitId:house.kitId,level:house.level,doorFront:route.target,reached});
 }
 proof.film=await film.stop();film=null;proof.passed=proof.errors.length===0;if(!proof.passed)throw Error('Runtime page errors');
}catch(e){proof.failure=e.message;await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw e;}
finally{writeFileSync(resolve(out,'observations.json'),JSON.stringify(proof,null,2));await browser.close();await server.close();}
console.log(JSON.stringify(proof));
