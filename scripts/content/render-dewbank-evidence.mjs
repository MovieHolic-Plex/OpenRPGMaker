import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {sample,validateDewbank,faultExamples,applyFault} from './validate-dewbank-village.mjs';
const dir='tiledata/tilesets/forest_harmony/dewbank-village';
const p={maps:{dewbank_village:sample.map},tilesets:{forest_harmony:sample.tileset}};
const devUrl=process.env.DEWBANK_DEV_URL??'http://127.0.0.1:9816';
const normal=await validateDewbank(p);assert.equal(normal.valid,true);const examples=[];
for(const f of faultExamples()){const copy=structuredClone(p);applyFault(copy,f);const r=await validateDewbank(copy);assert(r.errors.some(e=>e.code===f.id&&e.x===f.x&&e.y===f.y),JSON.stringify(r));examples.push({input:f,result:r});}
fs.writeFileSync(dir+'/validation-examples.json',JSON.stringify({normal,examples},null,2));
const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();await page.route('**/__reference',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));await page.goto(devUrl+'/__reference');
const outputs=await page.evaluate(async ({p,faults})=>{
const{drawMapTileLayers}=await import('/src/editor/mapTileDraw.ts');const{awaitGraftedTilesetImageUrl}=await import('/src/assets/tileGraftImageCache.ts');const{tilesetBaseImageUrl}=await import('/src/editor/tilesetImage.ts');
const m=p.maps.dewbank_village,t=p.tilesets.forest_harmony;const im=new Image();im.src=await awaitGraftedTilesetImageUrl(t,tilesetBaseImageUrl(t));await im.decode();
const render=m=>{const c=document.createElement('canvas');c.width=1408;c.height=960;drawMapTileLayers(c.getContext('2d'),im,m,t,1);return c;};const full=render(m),out={village:full.toDataURL()};
const crop=(name,x,y,w,h)=>{const c=document.createElement('canvas');c.width=w*16;c.height=h*16;c.getContext('2d').drawImage(full,x*16,y*16,w*16,h*16,0,0,c.width,c.height);out[name]=c.toDataURL();};
crop('forest',9,6,22,24);crop('square',21,27,18,17);crop('gardens',57,5,15,35);
for(const f of faults){const clone=structuredClone(m),i=f.y*88+f.x;clone[f.layer+'Tiles'][i]=f.replacement;if(f.moveToOtherLayer)clone[(f.layer==='upper'?'lower':'upper')+'Tiles'][i]=f.tile;
const bad=render(clone),c=document.createElement('canvas');c.width=576;c.height=326;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#16221d';ctx.fillRect(0,0,c.width,c.height);ctx.font='16px sans-serif';ctx.fillStyle='#fff';ctx.fillText('NORMAL',12,24);ctx.fillText('ERROR '+f.id,300,24);
const x=Math.max(0,Math.min(79,f.x-4)),y=Math.max(0,Math.min(51,f.y-4));ctx.drawImage(full,x*16,y*16,144,144,0,38,288,288);ctx.drawImage(bad,x*16,y*16,144,144,288,38,288,288);ctx.strokeStyle='#ff6969';ctx.lineWidth=2;ctx.strokeRect(288+(f.x-x)*32,38+(f.y-y)*32,32,32);out[f.id]=c.toDataURL();}
return out;},{p,faults:faultExamples()});for(const [id,url]of Object.entries(outputs))fs.writeFileSync(dir+'/images/'+id+'.png',Buffer.from(url.split(',')[1],'base64'));
}finally{await browser.close();}console.log({normal:normal.valid,faults:examples.map(e=>({id:e.input.id,x:e.input.x,y:e.input.y,codes:e.result.errors.map(e=>e.code)}))});
