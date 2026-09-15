import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
const root=process.env.RPG_ZZU_QA_SOURCE_ROOT??process.cwd();
const {runRuntimeQa,startPlayerQaServer}=await import(pathToFileURL(path.join(root,'scripts/lib/runtimeQaRun.mjs')));
const out=path.resolve('output/evidence/emerald-fields');
const walks=JSON.parse(fs.readFileSync(`${out}/walks.json`,'utf8'));
const runtimeOut=path.resolve('verify-shots/runtime-qa/emerald-fields');
process.chdir(root);
const server=await startPlayerQaServer();const browser=await chromium.launch({args:['--no-sandbox']});
try{const page=await browser.newPage();const beats=[{id:'title',expect:{testidPresent:['title-screen']}},{id:'forest-entry',ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{mapId:walks[0].mapId,x:2,y:27,playerSpriteTextureLoaded:true},shot:true}];
for(const w of walks){beats.push({id:`${w.id}-walk`,ops:[{kind:'dir',dir:null},{kind:'playerRoute',moves:w.moves},{kind:'waitForPosition',mapId:w.mapId,x:w.to[0],y:w.to[1],timeoutMs:120000},{kind:'dir',dir:null}],expect:{mapId:w.mapId,x:w.to[0],y:w.to[1]},shot:true});beats.push({id:`${w.id}-transfer`,ops:[{kind:'dir',dir:'right'},{kind:'waitForPosition',mapId:w.destination,x:w.arrival[0],y:w.arrival[1],timeoutMs:15000},{kind:'dir',dir:null}],expect:{mapId:w.destination,x:w.arrival[0],y:w.arrival[1],playerSpriteTextureLoaded:true},shot:true});}
const returnWalk=fs.existsSync(`${out}/return-walk.json`)?JSON.parse(fs.readFileSync(`${out}/return-walk.json`,'utf8')):null;
beats.push({id:'return-to-falls',ops:[{kind:'dir',dir:'left'},{kind:'dir',dir:'left'},{kind:'waitForPosition',mapId:walks[1].mapId,x:returnWalk?23:41,y:returnWalk?15:27,timeoutMs:15000},{kind:'dir',dir:null}],expect:{mapId:walks[1].mapId,x:returnWalk?23:41,y:returnWalk?15:27},shot:true});
if(returnWalk){beats.push({id:'cross-back-to-west-bank',ops:[{kind:'dir',dir:null},{kind:'playerRoute',moves:returnWalk.moves},{kind:'waitForPosition',mapId:returnWalk.mapId,x:1,y:18,timeoutMs:120000},{kind:'dir',dir:null}],expect:{mapId:returnWalk.mapId,x:1,y:18},shot:true});beats.push({id:'return-to-forest',ops:[{kind:'dir',dir:'down'},{kind:'waitForPosition',mapId:returnWalk.destination,x:41,y:27,timeoutMs:15000},{kind:'dir',dir:null}],expect:{mapId:returnWalk.destination,x:41,y:27},shot:true});}
const report=await runRuntimeQa(page,{id:'emerald-fields',projectFixture:`${out}/runtime-project.json`,beats:process.argv.includes('--visual-only')?beats.slice(0,2):beats},{serverUrl:server.url,outDir:process.argv.includes('--visual-only')?`${runtimeOut}-visual-probe`:runtimeOut});

console.log(JSON.stringify({errors:report.errors,beats:report.beats.map(b=>({id:b.id,failures:b.failures}))}));
assert.deepEqual(report.errors,[]);assert.ok(report.beats.every(b=>b.failures.length===0));
if(returnWalk){
 const visualProject=JSON.parse(fs.readFileSync(`${out}/reloaded-project.json`,'utf8'));
 visualProject.startMapId=walks[1].mapId;visualProject.startPos={x:12,y:14};
 fs.writeFileSync(`${out}/runtime-visual-project.json`,JSON.stringify(visualProject));
 const visualReport=await runRuntimeQa(page,{id:'emerald-fields-visual',projectFixture:`${out}/runtime-visual-project.json`,beats:[{id:'title',expect:{testidPresent:['title-screen']}},{id:'falls',ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{mapId:walks[1].mapId,x:12,y:14,playerSpriteTextureLoaded:true},shot:true}]},{serverUrl:server.url,outDir:`${runtimeOut}-visual`});
 assert.deepEqual(visualReport.errors,[]);assert.ok(visualReport.beats.every(b=>b.failures.length===0));
 const view=await page.evaluate(()=>{const c=window.__oprnCamera();const r=document.querySelector('canvas').getBoundingClientRect();return {...c,left:r.left,top:r.top,scaleX:r.width/c.width,scaleY:r.height/c.height};});

 const shotBytes=await page.screenshot();const shot=PNG.sync.read(shotBytes);
 const expected=PNG.sync.read(fs.readFileSync(`${out}/map_field_twinfalls_20260913.png`));
 const sample=(image,x,y,px,py)=>{const sx=Math.floor((x*16+px+.5-view.scrollX)*view.zoom*view.scaleX+view.left);const sy=Math.floor((y*16+py+.5-view.scrollY)*view.zoom*view.scaleY+view.top);assert.ok(sx>=0&&sy>=0&&sx<image.width&&sy<image.height,JSON.stringify({tile:[x,y],pixel:[sx,sy],image:[image.width,image.height],view}));return (sy*image.width+sx)*4;};
 const checks=[[10,6,'cliff'],[8,14,'wooden-bridge'],[16,14,'grass']].map(([x,y,name])=>{let sum=0;for(let py=1;py<15;py++)for(let px=1;px<15;px++){const a=sample(shot,x,y,px,py),b=((y*16+py)*expected.width+x*16+px)*4;for(let c=0;c<3;c++)sum+=Math.abs(shot.data[a+c]-expected.data[b+c]);}return {name,x,y,mae:sum/(14*14*3)};});
 await page.waitForTimeout(360);
 const later=PNG.sync.read(await page.screenshot());let changed=0;
 for(let py=1;py<15;py++)for(let px=1;px<15;px++){const i=sample(shot,11,7,px,py);if(shot.data[i]!==later.data[i]||shot.data[i+1]!==later.data[i+1]||shot.data[i+2]!==later.data[i+2])changed++;}
 const visualDir=`${out}/fidelity/runtime-visual`;fs.mkdirSync(visualDir,{recursive:true});
 fs.writeFileSync(`${visualDir}/field.png`,shotBytes);
 fs.writeFileSync(`${visualDir}/proof.json`,JSON.stringify({source:'real player.html screenshot pixels',view,checks,waterfallChangedPixels:changed,visualBeats:visualReport.beats.length,primaryScope:process.argv.includes('--visual-only')?'visual-only boot':'field round trip',primaryBeats:report.beats.length},null,2));
 fs.writeFileSync(`${visualDir}/SUMMARY.md`,'# 런타임 실제 팔레트 검증\n\n전용 player.html에서 찍은 화면. 맵 ID만 확인하던 검사가 놓친 기본 타일셋 대체 결함을 재검사한다.\n\n| PNG | 확인 이유 |\n|---|---|\n| field.png | 즉시 확인 — 실제 절벽·나무다리·물가 그림과 팔레트 픽셀 대조 |\n\n픽셀 검증: '+JSON.stringify(checks)+'\n\n폭포 변화 픽셀: '+changed+'\n');
 console.log(JSON.stringify({runtimePixels:checks,waterfallChangedPixels:changed}));
 assert.ok(checks.every(c=>c.mae<5),'Player must draw the actual saved atlas, not a default texture');
 assert.ok(changed>10,'The authored waterfall must animate in the real player');
}

}finally{await browser.close();await server.close();}
