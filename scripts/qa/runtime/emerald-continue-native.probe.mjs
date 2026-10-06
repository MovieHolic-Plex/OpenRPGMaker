// Import a genuine existing slot into private browser storage, then use native Continue.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const [base='http://127.0.0.1:18574', slotPath='/tmp/monster-systems-20261004/native-starter/save-slot-one.json', out='/tmp/oprn-emerald-20261004/continue-native-v3'] = process.argv.slice(2);
await fs.mkdir(out,{recursive:true});
const slotBytes=await fs.readFile(slotPath,'utf8'), expected=JSON.parse(slotBytes).session;
const storageKey='starlight-islands-v1:save-slot:v5:1';
const report={scope:'Actual compiled player; native Continue; genuine predecessor slot copied byte-for-byte into isolated browser localStorage. No runtime state injection.',slotSha256:createHash('sha256').update(slotBytes).digest('hex'),storageKey,errors:[]};
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:720}});
page.on('pageerror',error=>report.errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))report.errors.push(`${response.status()} ${response.url()}`);});
await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:storageKey,value:slotBytes});
await page.route('**/player.html',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('saveNamespace:"starlight-islands-v1"','saveNamespace:"starlight-islands-v1",qaInstrumentation:true')});});
try {
  await page.goto(base+'/player.html');
  await page.getByTestId('title-screen').waitFor({timeout:90000});
  for(let i=0;i<10;i++){
    if(await page.getByTestId('title-load-game').getAttribute('aria-selected')==='true')break;
    await page.keyboard.press('ArrowDown');
  }
  assert.equal(await page.getByTestId('title-load-game').getAttribute('aria-selected'),'true');
  await page.keyboard.press('Enter');
  await page.getByTestId('save-slot-1').waitFor();
  await page.screenshot({path:out+'/01-old-slot.png'});
  await page.getByTestId('save-slot-1').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__oprnDebug?.readState()?.currentMapId,undefined,{timeout:90000});
  await page.getByTestId('play-loading-overlay').waitFor({state:'detached',timeout:90000});
  await page.waitForTimeout(450);
  const state=await page.evaluate(()=>window.__oprnDebug.readState());
  for(const key of ['currentMapId','x','y','gold','inventory','monsterParty','monsterBox'])assert.deepEqual(state[key],expected[key],key);
  for(const id of expected.monsterParty){
    for(const key of ['speciesId','level','currentHp','skillIds','skillPp'])assert.deepEqual(state.monsterInstances[id][key],expected.monsterInstances[id][key],key);
  }
  assert.equal(await page.getByTestId('cinematic-sequence').count(),0);
  report.camera=await page.evaluate(()=>{const camera=window.__oprnHooksScene.cameras.main;return {zoom:camera.zoom,width:camera.width,height:camera.height};});
  assert.equal(report.camera.zoom,2);
  report.loaded={map:state.currentMapId,x:state.x,y:state.y,gold:state.gold,party:state.monsterParty.map(id=>state.monsterInstances[id]),inventory:state.inventory};
  await page.screenshot({path:out+'/02-continued-field.png'});
  await page.keyboard.press('Escape');
  const party=page.getByTestId('status-menu-command-monsters');await party.waitFor();
  for(let i=0;i<20;i++){
    if((await party.getAttribute('class'))?.includes('selected'))break;
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Enter');
  await page.locator('[data-party-slot]').first().waitFor();
  await page.screenshot({path:out+'/03-real-party-icon.png'});
  report.icons=await page.locator('[data-testid^="status-menu-monster-art-"]').evaluateAll(nodes=>Promise.all(nodes.map(async node=>{
    const url=getComputedStyle(node).backgroundImage;
    const match=/^url\(["']?(.*?)["']?\)$/.exec(url);
    if(!match)return {loaded:false};
    const image=new Image();image.src=match[1];await image.decode();
    return {width:image.naturalWidth,height:image.naturalHeight,complete:image.complete};
  })));
  assert(report.icons.length>0&&report.icons.every(icon=>icon.width===32&&icon.height===32&&icon.complete));
  assert.equal(report.errors.length,0);
  report.completed=true;
} finally {
  await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));
  await fs.writeFile(out+'/SUMMARY.md',`# Native Emerald Continue\n\nCompleted: ${report.completed===true}. Errors: ${report.errors.length}.\n\n${report.scope}\n\nInspect first: 02-continued-field.png, 03-real-party-icon.png.\n`);
  await browser.close();
}
console.log(JSON.stringify({completed:report.completed,slotSha256:report.slotSha256,camera:report.camera,icons:report.icons,errors:report.errors}));
