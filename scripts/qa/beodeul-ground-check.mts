// Focused common-asset and authored-raster checks; does not write a canonical project.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createBlankProject,ensureBundledTilesets} from '../../src/project/defaults.ts';
import {createBeodeulCityTileset} from '../../src/project/defaults/beodeulCity.ts';
import {createBeodeulGroundTileset} from '../../src/project/defaults/beodeulGround.ts';
import {dressBeodeulGround} from '../../src/editor/tools/beodeulGroundTools.ts';
import {AUTHOR_BEODEUL_TOWN_TOOL} from '../../src/editor/tools/authorBeodeulTown.ts';
import {cellPassability,canMove} from '../../src/project/collision.ts';
import {layerTileAt,setLayerTileAt} from '../../src/project/mapLayers.ts';
const beforeFile=process.argv[2]??'output/beodeul-ground-apply/before-project.json';
const category='beodeul-ground-dressing';
const has=(t:any)=>t.referenceDocuments?.some((c:any)=>c.id===category);
const fresh=createBlankProject();
assert(has(fresh.tilesets.beodeul_city));assert(has(fresh.tilesets.beodeul_ground));
const p=JSON.parse(fs.readFileSync(beforeFile,'utf8'));
delete p.tilesets.beodeul_ground;
p.tilesets.beodeul_city.referenceDocuments=p.tilesets.beodeul_city.referenceDocuments.filter((c:any)=>c.id!==category);
p.tilesets.beodeul_city.referenceDocuments.push({id:category,name:'저자 추가',documents:[{id:'author-note',name:'keep',markdown:'keep'}],images:[]});
ensureBundledTilesets(p);assert(has(p.tilesets.beodeul_ground));
assert(p.tilesets.beodeul_city.referenceDocuments.find((c:any)=>c.id===category).documents.some((d:any)=>d.id==='author-note'));
const m=p.maps.map_blank_start;
// An existing overlay must survive and keep the grass area unavailable.
setLayerTileAt(m,2,0,737);setLayerTileAt(m,4,1,737);
const before=structuredClone(p),b=before.maps[m.id],r=dressBeodeulGround(p,m.id);
assert.equal(r.data.detectedHouses,1);assert.equal(r.data.detectedTrees,3);
assert.deepEqual(m.lowerTiles,b.lowerTiles);assert.deepEqual(m.upperTiles,b.upperTiles);
assert.deepEqual(m.events,b.events);assert.deepEqual(p.startPos,before.startPos);
assert.deepEqual(p.maps.map_beodeul_small_home,before.maps.map_beodeul_small_home);
let blocked=0;
for(let i=0;i<m.width*m.height;i++){
 const old=cellPassability(before.tilesets[b.tilesetId],b,i),now=cellPassability(p.tilesets[m.tilesetId],m,i);
 for(const d of ['up','down','left','right'] as const)if(!old[d])assert.equal(now[d],false,`opened ${i} ${d}`);
 if(!Object.values(old).some(Boolean))blocked++;
 for(const l of [2,4] as const)if(layerTileAt(b,l,i)>=0)assert.equal(layerTileAt(m,l,i),layerTileAt(b,l,i));
}
assert(canMove(p,m,10,8,10,7));assert(canMove(p,m,10,9,10,8));
const once=JSON.stringify(m),count=p.tilesets[m.tilesetId].count;
assert(dressBeodeulGround(p,m.id).data.alreadyApplied);
assert.equal(JSON.stringify(m),once);assert.equal(p.tilesets[m.tilesetId].count,count);
ensureBundledTilesets(p);assert.equal(JSON.stringify(m),once);assert.equal(p.tilesets[m.tilesetId].count,count);
// New town grass themes receive the same finishing step, including source registration.
const town={...fresh,tilesets:{beodeul_city:createBeodeulCityTileset(),beodeul_ground:createBeodeulGroundTileset()},maps:{},startMapId:'',startPos:{x:0,y:0}} as typeof fresh;
const river=AUTHOR_BEODEUL_TOWN_TOOL.run(town,{id:'river',width:36,height:30,theme:'river',seed:7});
assert((river.data as any).groundDressing.placements.length>0);
const snow=AUTHOR_BEODEUL_TOWN_TOOL.run(town,{mapId:'river',theme:'snow',seed:7});
assert.equal((snow.data as any).groundDressing,undefined);
const own=new Set(town.tilesets.beodeul_city.tileGrafts?.filter(g=>g.sourceChipset==='tex_beodeul_ground').map(g=>g.targetTile));
for(let i=0;i<36*30;i++)for(const l of [2,4] as const)assert(!own.has(layerTileAt(town.maps.river!,l,i)));

const report={freshAndExistingReferences:true,authoredReferencePreserved:true,blockedCellsPreserved:blocked,
 originalGroundObjectsEventsInteriorPreserved:true,existingOverlaysPreserved:true,doorApproachPassable:true,
 repeatIdempotent:true,graftsSurviveBundleEnsure:true,riverFinishingApplied:true,snowFinishingSkipped:true,rebuildRemovesOnlyOldGroundDressing:true,
 result:r.data};
fs.mkdirSync('verify-shots/beodeul-ground',{recursive:true});
fs.writeFileSync('verify-shots/beodeul-ground/scoped-checks.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,result:undefined}));
