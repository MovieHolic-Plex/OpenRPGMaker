import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../../scripts/lib/runtimeQaRun.mjs';
const out=resolve('output/evidence/game-over-implemented-20260922');
await mkdir(out,{recursive:true});
const source=JSON.parse(await readFile('test/fixtures/projects/editor-authored-demo-v3.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
const server=await startPlayerQaServer();
const results=JSON.parse(await readFile(resolve(out,'results.json'),'utf8').catch(()=>'[]'));
const makeProject=(settings,kind='gameOver',parallel=false)=>{
 const p=structuredClone(source);p.meta.title='Game Over Runtime Proof';delete p.system.opening;delete p.system.gameOver;
 if(settings)p.system.gameOver=settings;p.system.titleScreen.musicResourceId='';
 const map=(Array.isArray(p.maps)?p.maps:Object.values(p.maps)).find(m=>m.id===p.startMapId);map.bgm={mode:'custom',resourceId:'cc0-bgm-field'};
 const e=structuredClone(map.events[0]);e.id='review-game-over';e.x=p.startPos.x;e.y=p.startPos.y-1;
 const commands=[{kind:'checkpointSave'},{kind},{kind:'setVariable',variableId:'var_lantern_shards',op:'=',value:777},{kind:'text',body:'This must never run.'}];
 e.pages=[{...e.pages[0],id:'review-page',conditions:[],name:'Runtime proof',movement:{type:'fixed',speed:3,frequency:3},trigger:{kind:parallel?'parallel':'action'},commands}];e.commands=commands;map.events=[e];
 return p;
};
const scenarios=[
 {id:'default',record:true},
 {id:'custom',settings:{title:'다시 떠날 준비가 되었나요?',message:'등대의 불빛은 아직 남아 있습니다.',backgroundResourceId:'oprn-title-field',retryLabel:'마지막 체크포인트',titleLabel:'타이틀로'}},
 {id:'long',settings:{title:'안개 항구의 마지막 수호자가 쓰러졌습니다',message:Array(12).fill('등대를 향한 여정은 아직 끝나지 않았습니다.').join('\n')}},
 {id:'sequence',settings:{sequence:{enabled:true,skippable:true,scenes:[{id:'defeat',kind:'image',resourceId:'easyrpg-game-over-game-over',narration:'등대의 불빛이 꺼졌습니다.',durationMs:0,motion:'none'}]}}},
 {id:'no-checkpoint',noCheckpoint:true},
 {id:'parallel',parallel:true},
 {id:'missing-art',settings:{backgroundResourceId:'oprn-title-field'},breakArt:true},
];
try{
 for(const v of scenarios.filter(v=>!process.env.PROOF_VARIANTS||process.env.PROOF_VARIANTS.split(',').includes(v.id))){
 const p=makeProject(v.settings,v.id==='default'?'killPlayer':'gameOver',v.parallel);
 if(v.noCheckpoint){const e=(Array.isArray(p.maps)?p.maps:Object.values(p.maps)).find(m=>m.id===p.startMapId).events[0];e.commands=e.commands.slice(1);e.pages[0].commands=e.commands;}
 const context=await browser.newContext({viewport:{width:960,height:720},recordVideo:v.record?{dir:out,size:{width:960,height:720}}:undefined});
 const page=await context.newPage();const result={id:v.id,errors:[],beats:[]};const old=results.findIndex(x=>x.id===v.id);if(old>=0)results.splice(old,1);results.push(result);page.on('pageerror',e=>result.errors.push(String(e)));
 const beat=async name=>{result.beats.push({name,t:Date.now()});await page.screenshot({path:resolve(out,`${v.id}-${name}.png`)});};
 await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__proof/project.json',saveNamespace:'gameover-implementation',qaInstrumentation:true};});
 await page.route('**/__proof/project.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(p)}));
 if(v.breakArt)await page.route('**/oprn-title-field.png',r=>r.fulfill({status:404,body:''}));
 await page.goto(server.url+'/player.html',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-testid="title-screen"]',{timeout:90000});
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__oprnDebug?.readState?.().currentMapId,undefined,{timeout:90000});
 if(!v.parallel){
  await page.waitForTimeout(700);await beat('field');
  if(v.record){result.clipStart=Date.now();await page.waitForTimeout(1200);}
  await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
 }
 await page.waitForSelector('[data-testid="game-over-screen"]');
 if(v.id==='sequence'){
  await page.waitForSelector('[data-testid="cinematic-sequence"]');await beat('sequence');await page.keyboard.press('Enter');
 }
 await page.waitForSelector('[data-testid="return-title"]');
 await page.waitForTimeout(600);await beat('terminal');
 result.state=await page.evaluate(()=>({marker:window.__oprnDebug.readState().variables.var_lantern_shards,map:window.__oprnDebug.readState().currentMapId,audio:[...document.querySelectorAll('audio[data-oprn-audio]')].map(a=>({paused:a.paused})),art:[...document.querySelectorAll('.game-over-screen img')].map(i=>({src:i.src,loaded:i.complete&&i.naturalWidth>0})),background:getComputedStyle(document.querySelector('.game-over-screen')).backgroundColor,buttons:[...document.querySelectorAll('.game-over-choice')].map(b=>({text:b.textContent,rect:b.getBoundingClientRect().toJSON()})),afterText:document.body.textContent.includes('This must never run.')}));
 assert.equal(result.state.marker,0,'terminal must stop subsequent state mutation');assert.equal(result.state.afterText,false);assert(result.state.audio.every(a=>a.paused),'field audio must stop');assert.notEqual(result.state.background,'rgba(0, 0, 0, 0)');
 if(!v.breakArt)assert(result.state.art.every(i=>i.loaded),'art must be loaded');
 for(const b of result.state.buttons)assert(b.rect.top>=0&&b.rect.bottom<=720,'actions must fit');
 if(v.id==='long'){
  await page.keyboard.press('PageDown');result.scroll=await page.locator('.game-over-message').evaluate(e=>e.scrollTop);assert(result.scroll>0);await beat('scrolled');
 }
 if(v.record){
  await page.waitForTimeout(1300);await page.keyboard.press('ArrowDown');await beat('title-selected');await page.waitForTimeout(1000);await page.keyboard.press('ArrowUp');await page.waitForTimeout(700);await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="game-over-screen"]',{state:'detached'});await page.waitForTimeout(600);await beat('restored');
  result.restored=await page.evaluate(()=>({x:window.__oprnDebug.readState().x,y:window.__oprnDebug.readState().y,audio:[...document.querySelectorAll('audio[data-oprn-audio]')].map(a=>({paused:a.paused}))}));assert.equal(result.restored.x,14);assert.equal(result.restored.y,18);assert(result.restored.audio.some(a=>!a.paused));
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(300);await page.keyboard.press('ArrowUp');await page.waitForTimeout(300);await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="return-title"]');await page.waitForTimeout(1000);await page.keyboard.press('ArrowDown');await page.waitForTimeout(600);await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="title-screen"]');await beat('returned-title');await page.waitForTimeout(1000);result.clipEnd=Date.now();
 }
 await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));
 if(v.record)result.videoPath=await page.video().path();
 await context.close();
 console.log(v.id,JSON.stringify(result.state));
 }
}finally{await browser.close();await server.close();await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));}
await writeFile(resolve(out,'SUMMARY.md'),'# Runtime game-over verification\n\nActual player.html, current implementation. Existing demo map, memory-only event fixture.\n\nImmediate inspection: default-terminal.png, default-restored.png, custom-terminal.png, long-terminal.png, sequence-terminal.png, missing-art-terminal.png.\n\nAll scenarios: results.json. Recorded browser video is the source for the GIF.\n');
