// Actual shipping-player frames, including the opaque lower half of a moving sprite.
// Unlike foot-coordinate checks, this detects a floor drawn over the character.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {withTsModule} from '../ontology-ts-loader.mjs';
import {startProductionPlayerPreview} from './player-production-preview.mjs';
import {startEditorScreencast} from './editor-screencast.mjs';
const arg=(n,f)=>{const i=process.argv.indexOf(`--${n}`);return i<0?f:process.argv[i+1];};
const label=arg('label','after'),out=resolve(arg('out',`verify-shots/terrain-body-rims/${label}`));
mkdirSync(out,{recursive:true});
const source=resolve(arg('source','.vite-cache/terrain-body-rims/source'));
const project=JSON.parse(readFileSync(resolve(source,'project.json'),'utf8'));
const saved=JSON.parse(readFileSync(resolve(source,'summary.json'),'utf8'));
if(!saved.canonicalReload&&!saved.reloadMapEqual)throw Error('Missing canonical SQLite reload evidence');
const cases=JSON.parse(readFileSync('.vite-cache/terrain-seams/cases.json','utf8'));
let wire;await withTsModule(resolve('src/project/webExport.ts'),'terrain-body-export.mjs',async({prepareWebExport})=>{wire=JSON.parse(prepareWebExport(project).projectJson);});
const server=await startProductionPlayerPreview(),browser=await chromium.launch({args:['--no-proxy-server','--disable-background-networking','--js-flags=--max-old-space-size=8192']});
const page=await browser.newPage({viewport:{width:1440,height:960}});
const proof={label,exportedPlayer:true,projectId:saved.projectId,revision:saved.revision,canonicalStore:saved.storage,sourceProjectId:saved.sourceProjectId,sourceRevision:saved.sourceRevision,sourceMapsEqual:saved.sourceMapsEqual,errors:[],ramps:[],samples:[]};
page.on('pageerror',e=>proof.errors.push(e.message));let film;
const idle=()=>page.waitForFunction(()=>!window.__oprnHooksScene.moving&&!window.__oprnHooksScene.playerRoute,null,{timeout:15000});
// Ask the real WebGL renderer for the next frame; compare source opaque pixels to
// that rendered frame, accounting for the camera and the actual animation frame.
async function probeMove(from,to,name){
 await page.evaluate(()=>{
  const s=window.__oprnHooksScene;window.__bodyProbe=null;
  const observe=()=>{
   if(!s.moving||s.moveProgress<.4||s.moveProgress>.85)return;
   s.events.off('postupdate',observe);
   const p=s.player,f=p.frame,c=s.cameras.main;
   const expected=document.createElement('canvas');expected.width=f.cutWidth;expected.height=f.cutHeight;
   const ctx=expected.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(f.texture.getSourceImage(),f.cutX,f.cutY,f.cutWidth,f.cutHeight,0,0,f.cutWidth,f.cutHeight);
   const source=ctx.getImageData(0,0,f.cutWidth,f.cutHeight).data;
   const body={x:p.x,y:p.y,depth:p.depth,scaleX:p.scaleX,scaleY:p.scaleY,originX:p.originX,originY:p.originY,progress:s.moveProgress,through:s.playerRoute?.through===true};
   // Snapshot's Image.onload can run after another game frame. Freeze the camera
   // from the frame being read back, rather than comparing to its later scroll.
   let camera;s.cameras.main.once('postrender',()=>{camera={x:c.x,y:c.y,viewX:c.worldView.x,viewY:c.worldView.y,zoom:c.zoom};});
   s.game.renderer.snapshot(image=>{
    if(!camera)throw Error('Snapshot camera frame missing');
    const actual=document.createElement('canvas');actual.width=image.width;actual.height=image.height;
    const a=actual.getContext('2d',{willReadFrequently:true});a.drawImage(image,0,0);
    const pixels=a.getImageData(0,0,actual.width,actual.height).data;
    const left=body.x-body.originX*f.cutWidth*body.scaleX,top=body.y-body.originY*f.cutHeight*body.scaleY;
    let opaque=0,visible=0;
    for(let y=Math.floor(f.cutHeight/2);y<f.cutHeight;y++)for(let x=0;x<f.cutWidth;x++){
     const o=(y*f.cutWidth+x)*4;if(source[o+3]!==255)continue;opaque++;
     const sx=Math.floor((left+(x+.5)*body.scaleX-camera.viewX)*camera.zoom+camera.x),sy=Math.floor((top+(y+.5)*body.scaleY-camera.viewY)*camera.zoom+camera.y);
     let match=false;
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const X=sx+dx,Y=sy+dy;if(X<0||Y<0||X>=actual.width||Y>=actual.height)continue;
      const j=(Y*actual.width+X)*4;
      if(Math.max(Math.abs(pixels[j]-source[o]),Math.abs(pixels[j+1]-source[o+1]),Math.abs(pixels[j+2]-source[o+2]))<=12)match=true;
     }
     if(match)visible++;
    }
    const bounds={x:Math.max(0,Math.floor((left-camera.viewX)*camera.zoom+camera.x)-24),y:Math.max(0,Math.floor((top-camera.viewY)*camera.zoom+camera.y)-24),w:Math.ceil(f.cutWidth*body.scaleX*camera.zoom)+48,h:Math.ceil(f.cutHeight*body.scaleY*camera.zoom)+48};
    const crop=document.createElement('canvas');crop.width=bounds.w;crop.height=bounds.h;
    crop.getContext('2d').drawImage(actual,bounds.x,bounds.y,bounds.w,bounds.h,0,0,bounds.w,bounds.h);
    window.__bodyProbe={...body,opaque,visible,visibleFraction:visible/opaque,frame:f.name,image:crop.toDataURL('image/png')};
   });
  };s.events.on('postupdate',observe);
 });
 const key=to.x>from.x?'ArrowRight':to.x<from.x?'ArrowLeft':to.y>from.y?'ArrowDown':'ArrowUp';
 await page.keyboard.down(key);await page.waitForFunction(()=>window.__oprnHooksScene.moving,null,{timeout:3000});await page.keyboard.up(key);
 await page.waitForFunction(()=>window.__bodyProbe,null,{timeout:6000});
 const sample=await page.evaluate(()=>window.__bodyProbe);await idle();
 const landed=await page.evaluate(()=>({x:window.__oprnHooksScene.tileX,y:window.__oprnHooksScene.tileY}));
 if(landed.x!==to.x||landed.y!==to.y||sample.through||!sample.opaque)throw Error(`Invalid actual walk: ${name}`);
 writeFileSync(resolve(out,`${name}.png`),Buffer.from(sample.image.split(',')[1],'base64'));delete sample.image;
 const record={name,from,to,...sample};proof.samples.push(record);return record;
}
try{
 await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__runtime-qa/project.json',saveNamespace:'terrain-body-real',qaInstrumentation:true};});
 await page.route('**/__runtime-qa/project.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(wire)}));
 await page.goto(`${server.url}/player.html`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')||window.__oprnDebug?.readState()?.currentMapId,null,{timeout:120000});
 if(await page.getByTestId('title-screen').isVisible().catch(()=>false))await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__oprnDebug?.readState()?.currentMapId,null,{timeout:120000});await page.waitForTimeout(500);
 film=await startEditorScreencast(page,out,'terrain-body-rims-2x.mp4',{selector:'body',cropTop:0,speed:2});
 for(const c of cases){
  // Teleport is only scenario initialization; every checked frame uses keyboard movement.
  await page.evaluate(start=>window.__oprnDebug.teleport('ramps_four',start.x,start.y),c.start);await page.waitForTimeout(300);
  await page.evaluate(()=>{const s=window.__oprnHooksScene,rect=s.game.canvas.getBoundingClientRect();s.cameras.main.setZoom(4/(rect.width/s.cameras.main.width));});await page.waitForTimeout(300);
  await film.caption(`${label==='before'?'수정 전':'수정 후'} · ${c.dir.toUpperCase()} 경사로 · 하반신 실제 렌더 확인`);
  let pos=c.start;
  for(const [phase,target]of [['up',c.target],['down',c.start]])while(pos.x!==target.x||pos.y!==target.y){
   const next={x:pos.x+Math.sign(target.x-pos.x),y:pos.y+Math.sign(target.y-pos.y)};
   await probeMove(pos,next,`${c.dir}-${phase}-${next.x}-${next.y}`);pos=next;
  }
  const samples=proof.samples.filter(s=>s.name.startsWith(`${c.dir}-`));
  proof.ramps.push({dir:c.dir,steps:samples.length,minLowerBodyVisible:Math.min(...samples.map(s=>s.visibleFraction))});
  await page.screenshot({path:resolve(out,`ramp-${c.dir}.png`)});
 }
 await page.evaluate(()=>window.__oprnDebug.teleport('ramps_four',43,4));await page.waitForTimeout(400);
 await film.caption('높은 절벽 뒤 · 앞 지형에 가려지는 동작 유지');
 const hidden=await probeMove({x:43,y:4},{x:44,y:4},'behind-cliff');
 proof.foregroundWallOccludes=hidden.visibleFraction<.3;
 proof.recording=await film.stop();film=null;
 writeFileSync(resolve(out,'observations.json'),JSON.stringify(proof,null,2));
 if(label!=='before'&&(proof.ramps.some(r=>r.minLowerBodyVisible<.95)||!proof.foregroundWallOccludes||proof.errors.length))throw Error('Rendered body visibility or foreground occlusion failed');
 console.log(JSON.stringify({ramps:proof.ramps,foregroundWallOccludes:proof.foregroundWallOccludes,errors:proof.errors}));
}finally{if(film)await film.stop().catch(()=>{});await browser.close();await server.close();}
