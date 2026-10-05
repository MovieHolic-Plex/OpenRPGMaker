import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve('verify-shots/shared-hand-fx-20261005/preview');await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--disable-gpu']});
const p=await browser.newPage({viewport:{width:780,height:1200}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto('http://127.0.0.1:8818');
 const f=p.frames().find(f=>f.parentFrame());
 await f.waitForSelector('#sm-canvas');await p.waitForTimeout(200);
 const inventory=await f.evaluate(()=>({choices:document.querySelector('#sm-choice').options.length,
  thumbnails:document.querySelectorAll('#sm-grid canvas').length,
  loaded:JSON.parse(document.querySelector('#sm-data').textContent).map(r=>({key:r.key,frames:r.frames}))}));
 const snapshots=[];
 for(const r of inventory.loaded){
  await f.locator('#sm-choice').selectOption(r.key);
  const a=await f.locator('#sm-canvas').evaluate(c=>c.toDataURL());
  await f.locator('#sm-next').click();
  const b=await f.locator('#sm-canvas').evaluate(c=>c.toDataURL());
  snapshots.push({key:r.key,nextChangesPixels:a!==b});
 }
 await f.locator('#sm-choice').selectOption('monk_dragon_aura');
 await p.screenshot({path:out+'/library-wide.png'});
 const layouts=[];
 for(const width of [736,320]){
  await p.setViewportSize({width,height:1400});await p.waitForTimeout(100);
  layouts.push(await f.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvasWidth:document.querySelector('#sm-canvas').getBoundingClientRect().width})));
 }
 await p.screenshot({path:out+'/library-narrow.png'});
 await f.locator('#sm-choice').selectOption('hand_guard_crystal');await f.locator('#sm-play').click();await p.waitForTimeout(850);
 const playback=await f.evaluate(()=>({label:document.querySelector('#sm-label').textContent,button:document.querySelector('#sm-play').textContent,repeat:document.querySelector('#sm-repeat').checked}));
 await writeFile(out+'/observations.json',JSON.stringify({inventory,snapshots,layouts,playback,errors},null,2)+'\n');
 console.log(JSON.stringify({choices:inventory.choices,allChanged:snapshots.every(r=>r.nextChangesPixels),layouts,playback,errors}));
}finally{await browser.close();}
