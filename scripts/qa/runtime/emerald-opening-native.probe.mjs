// Native shipping player only. Private browser storage; no game-state injection.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [base='http://127.0.0.1:18571',out='/tmp/oprn-emerald-20261004/opening-native']=process.argv.slice(2);
await fs.mkdir(out,{recursive:true});
const bytes=await (await fetch(base+'/project.json')).text(),project=JSON.parse(bytes);
const record={url:base+'/player.html',projectSha256:createHash('sha256').update(bytes).digest('hex'),scope:'Unmodified shipping player, private browser context, native keys. QA BOOT observation only; no session injection.',errors:[],pages:[]};
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:720}});
page.on('pageerror',e=>record.errors.push(String(e)));
page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))record.errors.push(r.status()+' '+r.url());});
await page.route('**/player.html',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('saveNamespace:"starlight-islands-v1"','saveNamespace:"starlight-islands-v1",qaInstrumentation:true')});});
try {
  await page.goto(base+'/player.html');
  await page.getByTestId('title-screen').waitFor({timeout:90000});
  await page.screenshot({path:out+'/01-title.png'});
  record.title=await page.getByTestId('title-screen').evaluate(e=>({reference:e.dataset.monsterStyle,menu:[...e.querySelectorAll('.rm-title-menu-button')].map(b=>b.textContent),bounds:{width:e.clientWidth,height:e.clientHeight}}));
  assert.equal(record.title.reference,'emerald');
  // The authored title sequence owns confirm until it finishes. A key sent
  // immediately after node creation can be consumed by that sequence.
  await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')?.dataset.seqState==='done',{},{timeout:30000});
  await page.keyboard.press('Enter');
  await page.getByTestId('cinematic-sequence').waitFor({timeout:90000});
  const music=await page.getByTestId('cinematic-music').elementHandle();
  const professor=await page.locator('.cinematic-image').elementHandle();
  let previousTime=-1;
  for (const [index,scene] of project.system.opening.scenes.entries()) {
    await page.waitForFunction(id=>{const root=document.querySelector('[data-testid="cinematic-sequence"]');return root?.dataset.sceneId===id&&root.dataset.mediaState==='ready';},scene.id,{timeout:30000});
    await page.waitForTimeout(350);
    if(index===0) {
      await page.waitForTimeout(3000);await page.keyboard.press('w');await page.keyboard.press('a');await page.keyboard.press('s');await page.keyboard.press('d');
      assert.equal(await page.getByTestId('cinematic-sequence').getAttribute('data-scene-id'),scene.id);
    }
    const state=await page.getByTestId('cinematic-sequence').evaluate(root=>({id:root.dataset.sceneId,style:root.dataset.monsterStyle,narration:root.querySelector('.cinematic-narration').textContent,images:[...root.querySelectorAll('img')].map(i=>({class:i.className,complete:i.complete,width:i.naturalWidth,height:i.naturalHeight})),bounds:{width:root.clientWidth,height:root.clientHeight}}));
    state.music=await page.evaluate(a=>({sameElement:a===document.querySelector('[data-testid="cinematic-music"]'),connected:a.isConnected,time:a.currentTime,paused:a.paused}),music);
    state.professor=await page.evaluate(a=>({sameElement:a===document.querySelector('.cinematic-image'),connected:a.isConnected}),professor);
    assert.equal(state.id,scene.id);assert.equal(state.style,'emerald');assert.equal(state.narration,scene.narration);
    assert.equal(state.professor.sameElement,true);assert.equal(state.music.sameElement,true);assert.equal(state.music.paused,false);assert(state.music.time>previousTime);previousTime=state.music.time;
    assert(state.images.every(i=>i.complete&&i.width>0&&i.height>0));
    await page.screenshot({path:out+`/intro-${index+1}.png`});record.pages.push(state);
    if(index===1){await page.keyboard.down('Enter');await page.waitForTimeout(600);await page.keyboard.up('Enter');assert.equal(await page.getByTestId('cinematic-sequence').getAttribute('data-scene-id'),project.system.opening.scenes[index+1].id);}
    else await page.keyboard.press('Enter');
  }
  await page.getByTestId('cinematic-sequence').waitFor({state:'detached',timeout:30000});
  await page.waitForFunction(()=>window.__oprnDebug?.readState()?.currentMapId,{},{timeout:90000});
  for(let i=0;i<15&&await page.getByTestId('dialogue-box').count();i++){await page.keyboard.press('Enter');await page.waitForTimeout(500);}
  record.field=await page.evaluate(()=>{const s=window.__oprnDebug.readState();return {map:s.currentMapId,x:s.x,y:s.y,text:document.body.innerText};});
  await page.screenshot({path:out+'/08-first-field.png'});
  assert.equal(record.field.map,project.startMapId);assert.equal(await page.getByTestId('cinematic-music').count(),0);assert.equal(record.errors.length,0);
  record.completed=true;
} finally {await fs.writeFile(out+'/native.json',JSON.stringify(record,null,2));await fs.writeFile(out+'/SUMMARY.md',`# Native Emerald opening\n\nCompleted: ${record.completed===true}. Pages: ${record.pages.length}. Errors: ${record.errors.length}.\n\nInspect first: 01-title.png, intro-2.png, 08-first-field.png.\n\n${record.scope}\n`);await browser.close();}
console.log(JSON.stringify({completed:record.completed,pages:record.pages.length,field:record.field,errors:record.errors}));
