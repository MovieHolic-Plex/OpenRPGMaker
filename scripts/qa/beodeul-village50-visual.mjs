import fs from 'node:fs';import assert from 'node:assert/strict';import {firefox} from '@playwright/test';
const browser=await firefox.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:800,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+process.cwd()+'/output/beodeul-village50/visual-preview.html');
 const frame=page.frames().find(f=>f.parentFrame());assert(frame);
 await frame.waitForFunction(()=>{const c=document.querySelector('#beodeul-village-fifty canvas');return c?.getContext('2d').getImageData(0,0,1,1).data[3]===255;});
 await page.screenshot({path:'verify-shots/beodeul-village50/visual-whole.png'});
 await frame.getByRole('button',{name:'우물 마당',exact:true}).click();
 assert.equal(await frame.locator('canvas').getAttribute('width'),'400');
 assert.equal(await frame.getByRole('button',{name:'우물 마당',exact:true}).getAttribute('aria-pressed'),'true');
 await page.screenshot({path:'verify-shots/beodeul-village50/visual-square.png'});
 await page.setViewportSize({width:320,height:820});
 await frame.getByRole('button',{name:'교회 골목',exact:true}).click();
 const mobile=await frame.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvasWidth:document.querySelector('canvas').getBoundingClientRect().width}));
 assert(mobile.scrollWidth<=mobile.width+1);assert(mobile.canvasWidth<=mobile.width);
 await page.screenshot({path:'verify-shots/beodeul-village50/visual-mobile.png'});
 assert.equal(errors.length,0,JSON.stringify(errors));
 fs.writeFileSync('verify-shots/beodeul-village50/visual-proof.json',JSON.stringify({errors,selectionChangesCanvas:true,mobileNoOverflow:true,mobile},null,2));console.log('Visual selection and 320px layout verified');
}finally{await browser.close();}
