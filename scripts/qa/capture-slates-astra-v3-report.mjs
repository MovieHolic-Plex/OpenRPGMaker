import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();const results=[];
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:9803/reports/slates-astra-v3/index.html',{waitUntil:'networkidle'});
 await page.locator('img').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 for(const button of await page.locator('[data-view],[data-crop]').all()){await button.click();await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));}
 await page.locator('[data-view="map.png"]').click();await page.locator('[data-crop="1"]').click();await page.evaluate(()=>scrollTo(0,0));
 const r=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>!i.naturalWidth).length,viewButtons:document.querySelectorAll('[data-view]').length,cropButtons:document.querySelectorAll('[data-crop]').length}));
 results.push({width,...r,errors});if(r.overflow||r.brokenImages||errors.length)throw Error('Report QA failed');
 if(width===1440)await page.screenshot({path:'reports/slates-astra-v3/page.png',fullPage:true});
 await page.close();
}await writeFile('docs/experiments/slates-astra-v3/html-observation.json',JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close();}
