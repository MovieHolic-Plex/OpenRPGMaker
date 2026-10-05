import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const out='verify-shots/hand-magic-20261005/preview';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:800,height:1000},colorScheme:'dark'});
const errors=[];
page.on('pageerror',e=>errors.push(e.stack));
await page.goto('http://127.0.0.1:8818/');
const iframe=page.frameLocator('iframe');
const canvas=iframe.locator('#hm-after');
await canvas.waitFor();
await page.waitForTimeout(300);
const observations=[];
for(const id of ['fire','ice','thunder','summon']) {
  await iframe.locator('#hm-spell').selectOption(id);
  const first=await canvas.evaluate(c=>c.toDataURL());
  const firstLabel=await iframe.locator('#hm-frame-label').textContent();
  await iframe.locator('#hm-next').click();
  const next=await canvas.evaluate(c=>c.toDataURL());
  if(first===next) throw new Error(id+': stepping did not update the image');
  await iframe.locator('#hm-prev').click();
  const colors=await canvas.evaluate(c=>{
    const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const colors=new Set();
    for(let i=0;i<p.length;i+=4) colors.add(p.slice(i,i+4).join(','));
    return colors.size;
  });
  if(colors<4) throw new Error(id+': image is blank');
  observations.push({id,firstLabel,colors,steppingChangedImage:true});
  await iframe.locator('#hero-magic-1005').screenshot({path:out+'/'+id+'.png'});
}
await iframe.locator('#hm-spell').selectOption('fire');
await iframe.locator('#hm-play').click();
await page.waitForTimeout(950);
if(await iframe.locator('#hm-play').textContent()!=='재생') throw new Error('one-shot playback did not finish');
await iframe.locator('#hm-loop').check();
await iframe.locator('#hm-play').click();
await page.waitForTimeout(1400);
if(await iframe.locator('#hm-play').textContent()!=='일시정지') throw new Error('repeat playback stopped');
await iframe.locator('#hm-play').click();
await iframe.locator('#hm-loop').uncheck();
await iframe.locator('#hm-speed').selectOption('0.25');
await iframe.locator('#hm-spell').selectOption('summon');
const layouts=[];
for(const width of [736,320]) {
  await page.setViewportSize({width,height:1300});
  await page.waitForTimeout(100);
  const size=await iframe.locator('#hero-magic-1005').evaluate(root=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,root:root.getBoundingClientRect().width}));
  if(size.scroll>size.client) throw new Error('horizontal overflow at '+width);
  layouts.push({width,...size});
  await iframe.locator('#hero-magic-1005').screenshot({path:out+'/layout-'+width+'.png'});
}
await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
await iframe.locator('#hero-magic-1005').screenshot({path:out+'/light-320.png'});
const errorText=await iframe.locator('#hm-error').textContent();
if(errors.length||errorText) throw new Error(JSON.stringify({errors,errorText}));
await writeFile(out+'/observations.json',JSON.stringify({observations,layouts,oneShot:true,repeat:true,errors},null,2));
await browser.close();
console.log(JSON.stringify({observations,layouts,errors}));
