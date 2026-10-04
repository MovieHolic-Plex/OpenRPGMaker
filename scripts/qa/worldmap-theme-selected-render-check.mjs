import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {buildWorldmap} from '../lib/worldmapBuild.mjs';
const manifest=JSON.parse(fs.readFileSync('tiledata/worldmap-kit/selected/selected.json','utf8')).icons;
const rows=[];
for(const theme of ['fantasy','modern-sf']){
 const built=await buildWorldmap({theme});
 if(!built.ok||!built.journeyCheck?.ok)throw Error(JSON.stringify(built.ok?built.journeyCheck:built));
 const atlas=PNG.sync.read(Buffer.from(built.imageDataUrl.split(',')[1],'base64'));
 let verifiedPixels=0;
 for(const site of built.iconSelection.rendered){
  const item=manifest.find(i=>i.id===site.iconId),bytes=fs.readFileSync(path.join('tiledata/worldmap-kit/selected',item.source));
  if(createHash('sha256').update(bytes).digest('hex')!==site.sha256)throw Error('selection hash differs');
  const source=PNG.sync.read(bytes);
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
   const a=(y*source.width+x)*4,b=((site.y*16+y)*atlas.width+site.x*16+x)*4;
   if(source.data[a+3]!==255)continue;
   for(let c=0;c<3;c++)if(source.data[a+c]!==atlas.data[b+c])throw Error('selected source pixels changed: '+site.iconId);
   verifiedPixels++;
  }
 }
 rows.push({theme,journeyPassed:true,rendered:built.iconSelection.rendered.length,pending:built.iconSelection.pending.length,
  onlyHumanSelected:true,sourceHashAndOpaquePixelsMatch:true,verifiedPixels});
 console.log(JSON.stringify(rows.at(-1)));
}
fs.writeFileSync('verify-shots/worldmap-theme-readiness/selected-render-checks.json',JSON.stringify({passed:true,cases:rows},null,2));
