import { readFile, writeFile } from 'node:fs/promises';
const packs=JSON.parse(await readFile(new URL('../../tiledata/pixel-art-world/doors.json',import.meta.url),'utf8'));
const ids=new Set();
for(const p of packs){
  if(ids.has(p.id)||!/^paw-door-[a-z0-9-]+$/.test(p.id)||!/^[a-f0-9]{64}$/.test(p.sha256))throw Error('Invalid door identity');ids.add(p.id);
  if(![3,4].includes(p.columns)||p.rows!==4||p.width!==p.frameWidth*p.columns||p.height!==p.frameHeight*p.rows||p.frames.length!==p.columns*p.rows)throw Error(`Invalid geometry: ${p.id}`);
  for(const [i,f]of p.frames.entries())if(f.index!==i||JSON.stringify(f.sourceRect)!==JSON.stringify([i%p.columns*p.frameWidth,Math.floor(i/p.columns)*p.frameHeight,p.frameWidth,p.frameHeight]))throw Error(`Invalid crop: ${p.id}/${i}`);
  for(const v of p.variants){
    if(v.openingFrames.length!==(v.kind==='static'?1:4)||new Set(v.openingFrames).size!==v.openingFrames.length||v.openingFrames.some(i=>!Number.isInteger(i)||i%p.columns!==v.sourceColumn||!p.frames[i]?.nonTransparentPixels)||JSON.stringify(v.closingFrames)!==JSON.stringify([...v.openingFrames].reverse()))throw Error(`Invalid door sequence: ${p.id}/${v.id}`);
    if(v.kind!=='static'&&new Set(v.openingFrames.map(i=>p.frames[i].pixelSha256)).size!==4)throw Error(`Unverified animation: ${p.id}/${v.id}`);
  }
  const used=new Set(p.variants.flatMap(v=>v.openingFrames));
  const excluded=new Set((p.excludedFrames??[]).map(f=>f.index));
  for(const f of p.frames)if(f.nonTransparentPixels&&!used.has(f.index)&&!excluded.has(f.index))throw Error(`Unclassified frame: ${p.id}/${f.index}`);
  for(const field of ['sourcePage','downloadUrl','termsUrl'])if(new URL(p[field]).hostname!=='yms.main.jp')throw Error('Unexpected source');
}
await writeFile(new URL('../../src/assets/pixelArtWorldDoors.json',import.meta.url),JSON.stringify(packs,null,2)+'\n');
console.log(`Prepared ${packs.length} door sheets / ${packs.reduce((n,p)=>n+p.variants.length,0)} verified variants, metadata only`);

const audit=JSON.parse(await readFile(new URL('../../tiledata/pixel-art-world/doors-audit.json',import.meta.url),'utf8'));
if(audit.sources.filter(s=>s.status==='supported').length!==packs.length||audit.sources.some(s=>s.status==='supported'&&!ids.has(s.packId)))throw Error('Door audit/catalog mismatch');
await writeFile(new URL('../../src/assets/pixelArtWorldDoorAudit.json',import.meta.url),JSON.stringify(audit,null,2)+'\n');
