// Focused, opt-in observation of installed user-local scenes; no remote calls.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readSharedContent} from '../lib/sharedContentSqlite.ts';
import {installSharedContent} from '../../src/project/sharedContent.ts';
import {sharedSceneList,buildSharedScene} from '../../src/project/sharedSceneAuthoring.ts';
import {createBlankProject} from '../../src/project/defaults/blankProject.ts';
import {runTool} from '../../src/editor/tools/toolRunner.ts';
import {canMove} from '../../src/project/collision.ts';
const out=process.argv[2]??'output/paw-all-authoring/coverage';fs.mkdirSync(out,{recursive:true});
const base=createBlankProject(),snapshot=readSharedContent();await installSharedContent(snapshot);
const scenes=sharedSceneList().filter(s=>s.libraryId.startsWith('pixel-art-world'));
const results=[];
for(const scene of scenes){
 const p=structuredClone(base),before=JSON.stringify(base.maps),lib=snapshot.libraries[scene.libraryId];
 const links=scene.id==='shared_paw_city'?'include':'omit';
 const receipt=buildSharedScene(p,scene.id,'check',snapshot.revision,links,true);
 let cells=0,approaches=0;
 for(const[sourceId,id]of Object.entries(receipt.mapIds)){
  const m=p.maps[id],place=lib.places[sourceId],ts=lib.tilesets[place?.exterior?.tilesetId??lib.maps[sourceId].tilesetId];
  const kit=ts.structureKits?.find(k=>k.id===place?.exterior?.kitId);
  const original=lib.maps[sourceId]??{lowerTiles:kit!.rows.flatMap(r=>r.tiles),upperTiles:kit!.rows.flatMap(r=>r.upperTiles)};
  assert.deepEqual(m.lowerTiles,original.lowerTiles);assert.deepEqual(m.upperTiles,original.upperTiles);cells+=m.width*m.height*2;
  assert.deepEqual(p.tilesets[m.tilesetId].passability,ts.passability);
  const doc=place?.referenceDocuments?.find(c=>c.id==='room-layout')?.documents[0];
  if(doc){
   const room=JSON.parse(doc.markdown.match(/```json\n([\s\S]*?)\n```/)![1]);
   const seen=new Set([room.spawn.y*m.width+room.spawn.x]),queue=[room.spawn];
   for(let n=0;n<queue.length;n++)for(const[dx,dy]of[[0,1],[0,-1],[1,0],[-1,0]]){
    const a=queue[n],x=a.x+dx,y=a.y+dy,i=y*m.width+x;
    if(x>=0&&y>=0&&x<m.width&&y<m.height&&!seen.has(i)&&canMove(p,m,a.x,a.y,x,y)){seen.add(i);queue.push({x,y});}
   }
   for(const a of [...room.approaches,room.entry])assert(seen.has(a.y*m.width+a.x),`${sourceId}: unreachable ${JSON.stringify(a)}`);
   approaches+=room.approaches.length+1;
  }
 }
 assert.equal(JSON.stringify(Object.fromEntries(Object.keys(base.maps).map(id=>[id,p.maps[id]]))),before);
 const unchanged=JSON.stringify(p);
 assert.throws(()=>buildSharedScene(p,scene.id,'check',snapshot.revision,links));assert.equal(JSON.stringify(p),unchanged);
 assert.throws(()=>buildSharedScene(p,scene.id,'stale','stale',links));assert.equal(JSON.stringify(p),unchanged);
 results.push({id:scene.id,maps:receipt.maps.length,cells,reachableRoomApproaches:approaches,omittedEvents:receipt.omittedEvents.length,reviewPending:scene.reviewPending,pass:true});
}
const production=[];
for(const id of ['shared_paw_city','shared_paw_school_building','shared_paw_room_school_1_0','shared_paw_room_school_2_2','shared_paw_home_compact_5','shared_paw_gym_practice_and_storage']){
 const ctx={project:structuredClone(base)},r=runTool(ctx,'build_shared_scene',{id,namespace:'actual',revision:snapshot.revision,links:id==='shared_paw_city'?'include':'omit',setStart:true});
 assert(r.ok,JSON.stringify(r));production.push({id,ok:r.ok,maps:(r.data as any).maps.length});
}
const reject=structuredClone(base),before=JSON.stringify(reject);
assert.throws(()=>buildSharedScene(reject,'shared_paw_school_building','reject',snapshot.revision,'reject'));assert.equal(JSON.stringify(reject),before);
const report={revision:snapshot.revision,scenes:results.length,mapsBuilt:results.reduce((n,r)=>n+r.maps,0),comparedCells:results.reduce((n,r)=>n+r.cells,0),reachableRoomApproaches:results.reduce((n,r)=>n+r.reachableRoomApproaches,0),results,production,pass:true,scope:'Deterministic tool coverage, not live-model success rate or visual approval.'};
fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:undefined,production}));
