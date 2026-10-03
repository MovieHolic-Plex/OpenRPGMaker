// Browser pixel proof for uploaded graft snapshots. Fixtures, not authored game content.
import fs from 'node:fs';import {resolve} from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const [renderer,host,out='verify-shots/romance-scene/snapshot-proof.json']=process.argv.slice(2);
if(!renderer||!host)throw Error('Usage: node scripts/qa/tool-image-snapshot.mjs <renderer.js> <host> [proof.json]');
const browser=await chromium.launch();let proof;
try{const page=await browser.newPage({bypassCSP:true});await page.goto(new URL('/__oprn/team',host).href);await page.addScriptTag({path:resolve(renderer)});
proof=await page.evaluate(async()=>{
 const image=color=>{const c=document.createElement('canvas');c.width=32;c.height=16;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,32,16);return c.toDataURL();};
 const asset=dataUrl=>({id:'snapshot-source',name:'snapshot',type:'image',dataUrl});
 const t={id:'snapshot',name:'snapshot',tileSize:16,tilesPerRow:2,count:2,priority:['lower','lower'],image:{type:'uploaded',id:'snapshot-base'},tileGrafts:[{targetTile:1,sourceChipset:'snapshot-source',sourceTile:0}]};
 const map={id:'snapshot-map',tilesetId:t.id,width:2,height:1,lowerTiles:[0,1],upperTiles:[-1,-1],events:[]};
 const p={maps:{[map.id]:map},tilesets:{[t.id]:t},assets:{uploaded:{'snapshot-base':asset(image('#010101')),'snapshot-source':asset(image('#ff0000'))}}};
 const data={mapId:map.id,x:0,y:0,w:2,h:1,lower:[[0,1]],upper:[[-1,-1]]};
 const sample=async png=>{const i=new Image();i.src=png;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return Array.from(ctx.getImageData(48,16,1,1).data);};
 const red=await sample(await window.RomanceRender.renderPiMapImage(p,data));
 p.assets.uploaded['snapshot-source']=asset(image('#0000ff'));
 const blue=await sample(await window.RomanceRender.renderPiMapImage(p,data));
 delete p.assets.uploaded['snapshot-source'];let missingBlocked=false;
 try{await window.RomanceRender.renderPiMapImage(p,data);}catch{missingBlocked=true;}
 return {syntheticPixels:true,productionRenderer:true,red,blue,missingBlocked};
});assert.deepEqual(proof.red,[255,0,0,255]);assert.deepEqual(proof.blue,[0,0,255,255]);assert(proof.missingBlocked);proof.ok=true;fs.writeFileSync(out,JSON.stringify(proof,null,2));console.log(proof);
}finally{await browser.close();}
