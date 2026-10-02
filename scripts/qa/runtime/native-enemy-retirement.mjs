// Actual player.html evidence; only a recording fixture is changed, never a project store.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
import { recordingFixture } from './retro2003-gif-fixture.mjs';

const out=resolve('verify-shots/legacy-monsters/runtime');
await mkdir(out,{recursive:true});
process.env.VITE_CACHE_DIR ??= resolve('.vite-cache/native-enemy-qa');
const audit=JSON.parse(await readFile('verify-shots/legacy-monsters/asset-audit.json','utf8'));
const report={route:'player.html + exportProjectStoreShim',fixtureOnly:true,cases:[],errors:[]};
let server,browser;
try {
  server=await startPlayerQaServer({logLevel:'error'});
  browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
  for (const mode of ['retro2003','rm2000','uploaded']) {
    const fixture=await recordingFixture();
    const project=fixture.project;
    project.system.battleUiStyle=mode==='uploaded'?'retro2003':mode;
    const targets=[['generated-enemy-spider-01','동굴 거미'],['generated-enemy-ghost-01','푸른 유령'],['generated-enemy-hydra-three','삼두 히드라']];
    const sample=structuredClone(project.database.enemies[0]);
    const enemies=targets.map(([id,name],i)=>({...structuredClone(sample),id:`enemy_native_${i}`,name,monsterResourceId:id,stats:{...sample.stats,maxHp:99999,attack:1,agility:1},actions:[{skillId:'skill_attack',priority:5,condition:{kind:'always'}}]}));
    project.database.enemies.push(...enemies);
    const troop=project.database.troops.find(t=>t.id===fixture.entry.troopId);
    troop.enemyIds=enemies.map(e=>e.id);
    troop.members=enemies.map((e,i)=>({enemyId:e.id,x:[75,146,227][i],y:[144,83,145][i],hidden:false}));
    troop.autoAlign=false;
    if(mode==='uploaded') {
      const data=await readFile('public/assets/generated/pixel-enemy-portraits/golem.png');
      project.assets.uploaded[targets[0][0]]={id:targets[0][0],name:'Project upload override',kind:'monster',meta:{width:64,height:64},dataUrl:'data:image/png;base64,'+data.toString('base64')};
    }
    const context=await browser.newContext({viewport:{width:960,height:720}});
    const page=await context.newPage();
    const requests=[];
    page.on('pageerror',e=>report.errors.push(`${mode}: ${e}`));
    page.on('request',r=>{if(/\/assets\//.test(r.url()))requests.push(r.url().replace(server.url,''));});
    page.on('response',r=>{if(r.status()>=400&&/pixel-enem|monster-collect/.test(r.url()))report.errors.push(`${mode}: ${r.status()} ${r.url()}`);});
    await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__native-enemies/project.json',saveNamespace:'native-enemy-recording',qaInstrumentation:true};});
    await page.route('**/__native-enemies/project.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(project)}));
    await page.goto(server.url+'/player.html?e2eVitals=1',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('[data-testid="title-screen"]',{timeout:120000});
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>!!window.__oprnDebug?.readState?.().currentMapId,null,{timeout:120000});
    await page.evaluate(entry=>{window.__oprnDebug.setSeed(1);window.__oprnDebug.teleport(entry.mapId,entry.x,entry.y);window.__oprnInput.face('up');},fixture.entry);
    for(let i=0;i<40&&!(await page.locator('[data-testid="battle-scene"]').count());i++){await page.keyboard.press('z');await page.waitForTimeout(200);}
    await page.waitForSelector('.battle-enemy-image',{timeout:30000});
    await page.waitForFunction(()=>[...document.querySelectorAll('.battle-enemy-image')].length===3&&[...document.querySelectorAll('.battle-enemy-image')].every(n=>n.complete&&n.naturalWidth>0),null,{timeout:30000});
    // Intro silhouettes and reveal flashes are temporary; inspect the command screen.
    await page.waitForFunction(()=>{const r=document.querySelector('[data-testid="battle-scene"]');return r?.dataset.battlePhase==='actorCommand'&&r.dataset.battleSequenceBusy==='false';},null,{timeout:30000});
    await page.waitForTimeout(200);
    const displayed=await page.evaluate(()=>[...document.querySelectorAll('.battle-enemy')].map(n=>{const im=n.querySelector('img');const r=im.getBoundingClientRect();return {id:n.dataset.recordId,resourceId:n.dataset.monsterResourceId,pixelEnemy:n.dataset.pixelEnemy??null,cell:n.dataset.pixelEnemyCell??null,source:im.src.startsWith('data:')?'project upload':new URL(im.src).pathname,naturalSize:[im.naturalWidth,im.naturalHeight],background:getComputedStyle(im).backgroundImage,box:[r.x,r.y,r.width,r.height]};}));
    if(mode==='uploaded'&&(displayed[0].source!=='project upload'||displayed[0].pixelEnemy!==null))report.errors.push('Uploaded pixels were masked by a bundled pose sheet');
    if(mode==='retro2003'&&displayed.some(n=>!n.pixelEnemy))report.errors.push('Native retro pose sheet not applied');
    if(mode==='rm2000'&&displayed.some(n=>n.pixelEnemy||!n.source.includes('pixel-enemy-portraits/')))report.errors.push('Whole-image skin did not use single idle portraits');
    await page.locator('[data-testid="battle-scene"]').screenshot({path:join(out,mode+'.png')});
    if(mode==='retro2003') {
      const load=await page.evaluate(async entries=>await Promise.all(entries.map(async e=>{
        const urls=['/'+e.portraitPath,'/'+e.path];
        for(const url of urls) {
          const img=new Image();img.src=url;
          try{await img.decode();}catch{return {id:e.resourceId,error:url};}
          const expected=url.includes('portraits/')?e.cell:e.cell*3;
          if(img.naturalWidth!==expected||img.naturalHeight!==expected)return {id:e.resourceId,error:'dimensions '+url};
        }
        return {id:e.resourceId,loaded:true};
      })),audit.native);
      report.allNativeBrowserLoads=load;
      for(const row of load)if(row.error)report.errors.push(row.id+': '+row.error);
    }
    const retiredRequests=requests.filter(url=>/\/generated\/monsters\/|\/starter\/(?:idle\/)?monster-|sylph-hornet-transparent\.png/.test(url)&&!url.includes('/pixel-enem'));
    if(retiredRequests.length)report.errors.push(`${mode}: retired requests ${retiredRequests.join(', ')}`);
    report.cases.push({mode,displayed,retiredRequests,screenshot:mode+'.png'});
    await context.close();fixture.cleanup();
  }
}catch(e){report.errors.push(String(e.stack??e));}
finally{await browser?.close();await server?.close();}
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(join(out,'SUMMARY.md'),`# Native enemy retirement runtime evidence\n\n${report.errors.length?'FAIL':'PASS'} — ${report.cases.length}/3 cases, ${report.allNativeBrowserLoads?.length??0} native sheets/portraits.\n\nImmediately inspect: retro2003.png, rm2000.png, uploaded.png.\n\nRoute: player.html; recording fixture only, no canonical project writes.\n\n${report.errors.join('\n')}\n`);
console.log(JSON.stringify({cases:report.cases.length,nativeLoaded:report.allNativeBrowserLoads?.length??0,errors:report.errors},null,2));
if(report.errors.length)process.exitCode=1;
