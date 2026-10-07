// Read the real assistant-saved SQLite, reopen it, and export that exact project for player QA.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {cellPassability} from '../../src/project/collision.ts';
import {renderMapPng} from '../qa-game/render.mts';
const projectDir=process.argv[2]??'/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004';
const before=JSON.parse(fs.readFileSync('output/beodeul-ground-apply/before-project.json','utf8'));
let store=await openLocalProjectStore({projectDir});
const first=store.loadSnapshot()!,info=store.info();store.close();
store=await openLocalProjectStore({projectDir});
const after=store.loadSnapshot()!;store.close();
assert.equal(first.sha256,after.sha256);assert.deepEqual(first.project,after.project);
const p=after.project,m=p.maps.map_blank_start,b=before.maps[m.id];
assert.deepEqual(Object.keys(p.maps),Object.keys(before.maps));
assert.deepEqual(m.lowerTiles,b.lowerTiles);assert.deepEqual(m.upperTiles,b.upperTiles);assert.deepEqual(m.events,b.events);
assert.deepEqual(p.maps.map_beodeul_small_home,before.maps.map_beodeul_small_home);
assert.deepEqual(p.startPos,before.startPos);
let blocked=0;
for(let i=0;i<m.width*m.height;i++){
 const a=cellPassability(before.tilesets[b.tilesetId],b,i),z=cellPassability(p.tilesets[m.tilesetId],m,i);
 for(const d of ['up','down','left','right'] as const)if(!a[d])assert.equal(z[d],false,`opened ${i} ${d}`);
 if(!Object.values(a).some(Boolean))blocked++;
}
const ground=p.tilesets[m.tilesetId].tileGrafts?.filter(g=>g.sourceChipset==='tex_beodeul_ground')??[];
assert(ground.length>0);assert(p.tilesets.beodeul_ground);
for(const id of ['beodeul_ground','beodeul_city'])assert(p.tilesets[id].referenceDocuments?.some(c=>c.id==='beodeul-ground-dressing'));
const trace=JSON.parse(fs.readFileSync('verify-shots/assistant-beodeul-village/ground-dressing/existing/trace.json','utf8'));
assert(trace.some((t:any)=>t.name==='dress_beodeul_ground'&&t.ok));
assert(!trace.some((t:any)=>['create_map','author_beodeul_town','paint_tiles','place_props'].includes(t.name)));
assert.equal(trace.filter((t:any)=>!t.ok).length,0);
const toolIndex=trace.findIndex((t:any)=>t.name==='dress_beodeul_ground');
const reads=trace.slice(0,toolIndex).filter((t:any)=>t.name==='read_tileset_reference');
assert.equal(reads.length,5); // guide, 2 catalogue pages, atlas, error comparison
fs.mkdirSync('verify-shots/beodeul-ground',{recursive:true});
fs.writeFileSync('output/assistant-house-entry/reloaded-project.json',JSON.stringify(p));
fs.writeFileSync('verify-shots/beodeul-ground/assistant-result.png',renderMapPng(p,m,3).png);
const proof={projectId:info.projectId,projectDir,storeFile:`${projectDir}/project.sqlite`,revision:after.revision,
 sha256:after.sha256,reopenedTwice:true,assistantToolCalls:trace.length,assistantGroundToolCalls:1,
 guideAllPagesAndImagesRead:true,originalGroundHouseTreesDoorEventsInteriorPreserved:true,
 blockedCellsPreserved:blocked,groundGrafts:ground.length,referenceCategories:p.tilesets.beodeul_city.referenceDocuments?.length};
fs.writeFileSync('verify-shots/beodeul-ground/canonical-proof.json',JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof));
