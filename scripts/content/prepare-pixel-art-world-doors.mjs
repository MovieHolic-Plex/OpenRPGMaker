import { readFile, writeFile } from 'node:fs/promises';
const packs=JSON.parse(await readFile(new URL('../../tiledata/pixel-art-world/doors.json',import.meta.url),'utf8'));
const ids=new Set();
for(const p of packs){
  if(ids.has(p.id)||!/^paw-door-[a-z0-9]+$/.test(p.id)||!/^[a-f0-9]{64}$/.test(p.sha256))throw Error('Invalid door identity');ids.add(p.id);
  if(p.columns!==4||p.rows!==4||p.width!==p.frameWidth*4||p.height!==p.frameHeight*4||p.frames.length!==16)throw Error(`Invalid geometry: ${p.id}`);
  for(const [i,f]of p.frames.entries())if(f.index!==i||JSON.stringify(f.sourceRect)!==JSON.stringify([i%4*p.frameWidth,Math.floor(i/4)*p.frameHeight,p.frameWidth,p.frameHeight]))throw Error(`Invalid crop: ${p.id}/${i}`);
  for(const v of p.variants){
    if(v.openingFrames.length!==4||new Set(v.openingFrames).size!==4||v.openingFrames.some(i=>!Number.isInteger(i)||i%4!==v.sourceColumn||!p.frames[i]?.nonTransparentPixels)||JSON.stringify(v.closingFrames)!==JSON.stringify([...v.openingFrames].reverse()))throw Error(`Invalid door sequence: ${p.id}/${v.id}`);
    if(new Set(v.openingFrames.map(i=>p.frames[i].pixelSha256)).size!==4)throw Error(`Unverified animation: ${p.id}/${v.id}`);
  }
  for(const field of ['sourcePage','downloadUrl','termsUrl'])if(new URL(p[field]).hostname!=='yms.main.jp')throw Error('Unexpected source');
}
await writeFile(new URL('../../src/assets/pixelArtWorldDoors.json',import.meta.url),JSON.stringify(packs,null,2)+'\n');
console.log(`Prepared ${packs.length} door sheets / ${packs.reduce((n,p)=>n+p.variants.length,0)} verified variants, metadata only`);
