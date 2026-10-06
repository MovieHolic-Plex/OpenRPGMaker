import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const out='verify-shots/snes-study-redraw-20261005/preview';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:736,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try {
 await page.goto('file:///home/main/.codex/visualizations/2026/10/05/01a10964-fa17-7f50-bb0b-c0431ca43982/hero-magic-revised-preview.html');
 const f=page.frameLocator('iframe');
 await f.locator('#hr-phase').filter({hasText:'소환체'}).waitFor();
 const scenes=[];
 for(const key of ['summon','holy','fire','ice','thunder']){
   await f.locator('#hr-kind').selectOption(key);
   const first=await f.locator('#hr-time').textContent();
   await f.locator('#hr-next').click();
   const next=await f.locator('#hr-time').textContent();
   if(first===next)throw new Error('Seeking did not change '+key);
   await f.locator('#hr-prev').click();
   await f.locator('#hero-redraw-1005').screenshot({path:out+'/'+key+'.png'});
   scenes.push({key,first,next});
 }
 await f.locator('#hr-kind').selectOption('fire');await f.locator('#hr-play').click();
 await page.waitForTimeout(1000);
 if(await f.locator('#hr-play').textContent()!=='처음부터 재생')throw new Error('Playback did not stop');
 const layouts=[];
 for(const width of [736,320]){
  await page.setViewportSize({width,height:1400});
  const metrics=await f.locator('#hero-redraw-1005').evaluate(root=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,canvases:root.querySelectorAll('canvas').length}));
  if(metrics.scroll>metrics.width)throw new Error('Overflow at '+width);
  await f.locator('#hr-kind').selectOption('summon');
  await f.locator('#hero-redraw-1005').screenshot({path:out+'/layout-'+width+'.png'});
  layouts.push(metrics);
 }
 await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
 await f.locator('#hero-redraw-1005').screenshot({path:out+'/dark-320.png'});
 if(errors.length)throw new Error(JSON.stringify(errors));
 await writeFile(out+'/observations.json',JSON.stringify({scenes,layouts,oneShot:true,errors},null,2));
 console.log(JSON.stringify({scenes,layouts,errors}));
} finally {await browser.close();}
