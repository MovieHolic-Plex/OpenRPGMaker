// Source-pixel observation for reviewed standing furniture, including the rejected layout.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import pngjs from 'pngjs';
import {withTsModule} from '../ontology-ts-loader.mjs';
const folder=process.argv[2],beforePath=process.argv[3];
if(!folder)throw Error('Usage: node scripts/content/review-pixel-art-world-grounding.mjs <original-png-folder> [before-project.json]');
const before=beforePath?JSON.parse(await readFile(beforePath,'utf8')):null;
const packs=(await Promise.all(['Catalog','SchoolCatalog','FacilitiesCatalog','HomeCatalog'].map(async name=>JSON.parse(await readFile(`src/assets/pixelArtWorld${name}.json`,'utf8'))))).flat();
await withTsModule('src/project/externalTileGrounding.ts','paw-footing.mjs',async api=>{
 const report={after:[],before:[],scope:'Only explicitly classified standing furniture and its actual lowest opaque pixel row. Sprite completeness, room meaning and overall appearance still require visual review.'};
 for(const pack of packs){
  const png=pngjs.PNG.sync.read(await readFile(join(folder,pack.filename)));
  for(const scene of pack.scenes??[]){
   const issues=api.inspectExternalTileGrounding(pack,scene,png.data);
   report.after.push({scene:scene.id,standing:scene.placements.filter(p=>pack.recipes.find(r=>r.id===p.recipeId)?.placementKind==='standing').length,issues});
   const md=before?.tilesets[pack.id]?.referenceDocuments?.find(c=>c.id==='scene-'+scene.id)?.documents[0]?.markdown;
   const body=md?.match(/```json\n([\s\S]*?)\n```/)?.[1];
   if(body)report.before.push({scene:scene.id,issues:api.inspectExternalTileGrounding(pack,JSON.parse(body),png.data)});
  }
 }
 await writeFile('output/paw-city-review/grounding-review.json',JSON.stringify(report,null,2));
 const after=report.after.flatMap(r=>r.issues),old=report.before.flatMap(r=>r.issues);
 console.log({standingPlacements:report.after.reduce((n,r)=>n+r.standing,0),beforeIssues:old.length,afterIssues:after.length});
 if(after.length)throw Error(JSON.stringify(after));
});
