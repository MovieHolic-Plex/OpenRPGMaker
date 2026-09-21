// Shrinks the study/comparison images shipped in `src/assets/sharedCastleReferences.json`.
//
// The castle study is read by people and models; it is never sliced into game tiles, so the shipped copies can be
// smaller than the originals in `tiledata/castle-tiles-rpgs/`. Document IDs, names, captions and markdown are part of
// what agents already reference, so this script only replaces `dataUrl` bytes.
//
// Usage: node scripts/content/prepare-castle-references.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root='tiledata/castle-tiles-rpgs';
const target='src/assets/sharedCastleReferences.json';
const outDir='public/assets/castle-references';
const dry=process.argv.includes('--dry');
const MAX_EDGE='820';
const COLORS='128';

/** shipped `name` -> source file. `name` is either a study path or a bare asset name. */
const SOURCES={
 'reference/user-castle.png':`${root}/reference/user-castle.png`,
 'reference/rejected-layout.png':`${root}/reference/rejected-layout.png`,
 'reference/revised-layout.png':`${root}/reference/revised-layout.png`,
 'audit/forecourt.png':`${root}/audit/forecourt.png`,
 'audit/courtyard.png':`${root}/audit/courtyard.png`,
 'audit/north.png':`${root}/audit/north.png`,
 'audit/approach.png':`${root}/audit/approach.png`,
 'opengameart-castle-tiles.png':'public/assets/opengameart-castle-tiles.png',
 'river-fortress-atlas.png':'public/assets/region-references/river-fortress-atlas.png',
 'improvements/density-01/forecourt.png':`${root}/improvements/density-01/forecourt.png`,
 'improvements/density-01/courtyard.png':`${root}/improvements/density-01/courtyard.png`,
 'improvements/density-01/north.png':`${root}/improvements/density-01/north.png`,
 'improvements/density-01/approach.png':`${root}/improvements/density-01/approach.png`,
 'improvements/landscape-02/forecourt.png':`${root}/improvements/landscape-02/forecourt.png`,
 'improvements/landscape-02/courtyard.png':`${root}/improvements/landscape-02/courtyard.png`,
 'improvements/landscape-02/north.png':`${root}/improvements/landscape-02/north.png`,
 'improvements/landscape-02/approach.png':`${root}/improvements/landscape-02/approach.png`,
 'improvements/landscape-02/before-after.png':`${root}/improvements/landscape-02/before-after.png`,
 'shared-place/map.png':`${root}/shared-place/map.png`,
};

const shipped=JSON.parse(fs.readFileSync(target,'utf8'));
if(!dry)fs.mkdirSync(outDir,{recursive:true});
let replaced=0;const skipped=[];let before=0;let after=0;
for(const category of shipped)for(const img of category.images){
 const src=SOURCES[img.name];
 const original=Buffer.from(img.dataUrl.split(',')[1],'base64');
 before+=original.length;
 // Small images (tile atlases, the forest strip) are already compact and must keep exact pixels.
 if(!src||!fs.existsSync(src)||original.length<=120000){
  skipped.push(`${img.name} (${Math.round(original.length/1024)}KB kept)`);
  after+=original.length;
  continue;
 }
 const out=path.join(outDir,`${img.id}.png`);
 if(!dry)execFileSync('convert',[src,'-strip','-resize',`${MAX_EDGE}x${MAX_EDGE}>`,'-define','png:compression-level=9','-colors',COLORS,out],{stdio:'ignore'});
 if(dry){after+=original.length;replaced++;continue;}
 const bytes=fs.readFileSync(out);
 img.dataUrl='data:image/png;base64,'+bytes.toString('base64');
 replaced++;after+=bytes.length;
}
if(!dry)fs.writeFileSync(target,JSON.stringify(shipped)+'\n');
console.log(JSON.stringify({target,dry,replaced,skipped,imageMB:{before:+(before/1048576).toFixed(2),after:+(after/1048576).toFixed(2)},jsonMB:+(fs.statSync(target).size/1048576).toFixed(2)},null,2));
