import fs from 'node:fs';import assert from 'node:assert/strict';import {firefox} from '@playwright/test';
const browser=await firefox.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:800,height:1060}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+process.cwd()+'/output/beodeul-facilities/visual-preview.html');
 const frame=page.frames().find(f=>f.parentFrame());assert(frame);
 await frame.waitForFunction(()=>document.querySelector('#beodeul-rpg-facilities canvas')?.getContext('2d').getImageData(0,0,1,1).data[3]===255);
 await page.screenshot({path:'verify-shots/beodeul-facilities/visual-whole.png'});
 const select=frame.getByRole('combobox');await select.selectOption('ferry-office');
 assert.equal(await frame.locator('canvas').getAttribute('width'),'304');assert.match(await frame.locator('[data-detail]').textContent(),/나루터/);
 await page.screenshot({path:'verify-shots/beodeul-facilities/visual-dock.png'});
 for(let i=1;i<=8;i++){
  await select.selectOption('catalog-'+i);await frame.waitForFunction(()=>document.querySelector('canvas').width===640);
  assert.equal(await frame.locator('canvas').getAttribute('height'),'640');
  assert.match(await frame.locator('[data-detail]').textContent(),/↖/);
 }
 await page.screenshot({path:'verify-shots/beodeul-facilities/visual-catalog.png'});
 await page.setViewportSize({width:320,height:820});await select.selectOption('apothecary');
 const mobile=await frame.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvasWidth:document.querySelector('canvas').getBoundingClientRect().width}));
 assert(mobile.scrollWidth<=mobile.width+1);assert(mobile.canvasWidth<=mobile.width);
 await page.screenshot({path:'verify-shots/beodeul-facilities/visual-mobile.png'});
 assert.equal(errors.length,0,JSON.stringify(errors));
 fs.writeFileSync('verify-shots/beodeul-facilities/visual-proof.json',JSON.stringify({errors,eightCatalogPagesSelectable:true,dockAndApothecaryCropsSelectable:true,mobileNoOverflow:true,mobile},null,2));
 console.log('Map, all eight catalog pages and 320px view verified');
}finally{await browser.close();}
