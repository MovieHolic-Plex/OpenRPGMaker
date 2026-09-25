// Inspect the real assistant output; never repair its tiles in the observer.
import fs from 'node:fs';
import {isDeepStrictEqual as equal} from 'node:util';
import {canMove} from '../../src/project/collision.ts';
import {inspectCeilingWallFaces} from '../content/pixel-art-world-ceiling-walls.mjs';
const root=process.argv[2];if(!root)throw Error('Usage: <live output directory>');
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const project=read(root+'/result-project.json'),report=read(root+'/report.json');
const compiled=read('tiledata/pixel-art-world/modern-interiors-compiled.json');
const calls=read(root+'/tool-calls.json');
const results:any[]=[];
for(const [sourceId,scene]of Object.entries(compiled.maps)as [string,any][]){
 const placeId='shared_'+sourceId.replaceAll('-','_'),build=report.builds.find((b:any)=>b.args.id===placeId);
 if(!build){results.push({sourceId,issues:['MISSING_MAP']});continue;}
 const map=project.maps[build.receipt.mapIds[placeId]],tile=project.tilesets[map.tilesetId],issues:any[]=[];
 const at=(x:number,y:number)=>y*map.width+x;
 if(map.width!==scene.width||map.height!==scene.height||!equal(map.lowerTiles,scene.lowerTiles)||!equal(map.upperTiles,scene.upperTiles))issues.push({code:'ARRAY_MISMATCH'});
 issues.push(...inspectCeilingWallFaces(map,tile.autotileGroups.find((g:any)=>g.id==='paw-wall-a01').memberTileIds,scene.wallTiles));
 const floors=new Set(scene.passableTiles),occupied=new Set<number>();
 for(const p of scene.placements){
  const recipe=compiled.recipes.find((r:any)=>r.id===p.recipeId);
  for(let y=0;y<recipe.tiles.length;y++)for(let x=0;x<recipe.tiles[0].length;x++){
   const i=at(p.x+x,p.y+y);
   if(occupied.has(i)||map.upperTiles[i]!==recipe.tiles[y][x])issues.push({code:'OBJECT_CELL',recipe:recipe.id,x:p.x+x,y:p.y+y});occupied.add(i);
   if(recipe.placementKind==='wall-mounted'&&!scene.wallTiles.includes(map.lowerTiles[i]))issues.push({code:'WALL_SUPPORT',recipe:recipe.id});
  }
  if(recipe.placementKind!=='wall-mounted')for(const c of recipe.supportCells)if(!floors.has(map.lowerTiles[at(p.x+c.x,p.y+c.y)]))issues.push({code:'FURNITURE_SUPPORT',recipe:recipe.id});
 }
 function flood(m:any,start:any){
  const seen=new Set<number>([at(start.x,start.y)]),queue=[start];
  for(let n=0;n<queue.length;n++)for(const [dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]]){
   const c=queue[n],x=c.x+dx,y=c.y+dy;
   if(x<0||y<0||x>=m.width||y>=m.height||seen.has(at(x,y)))continue;
   if(canMove(project,m,c.x,c.y,x,y)){seen.add(at(x,y));queue.push({x,y});}
  }return seen;
 }
 const seen=flood(map,scene.spawn);
 for(const c of scene.approachCells)if(!seen.has(at(c.x,c.y)))issues.push({code:'APPROACH_BLOCKED',...c});
 map.lowerTiles.forEach((n:number,i:number)=>{if(floors.has(n)&&map.upperTiles[i]===-1&&!seen.has(i))issues.push({code:'ISOLATED_FLOOR',i});});
 for(const p of scene.placements){const r=compiled.recipes.find((r:any)=>r.id===p.recipeId);
  if(/wardrobe|drawers|bookcase|fridge|kitchen|stove|tea$|wash-station|lockers|shoe-rack|milk-machine|double-sink|toilet|washer|linen|medicine|tv$|cage|chest/.test(r.id)&&!r.tiles[0].some((_:unknown,x:number)=>seen.has(at(p.x+x,p.y+r.tiles.length))))issues.push({code:'OBJECT_FRONT_BLOCKED',recipe:r.id});
 }
 for(const r of scene.clearanceRects??[])for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)if(map.upperTiles[at(x,y)]!==-1||!seen.has(at(x,y)))issues.push({code:'PLAY_SPACE_BLOCKED',x,y});
 const closed=structuredClone(map);
 for(const d of scene.doorways.filter((d:any)=>d.from!=='outside'))for(let y=d.y;y<d.y+d.height;y++)for(let x=d.x;x<d.x+d.width;x++)closed.lowerTiles[at(x,y)]=scene.wallTiles.at(-1);
 for(const id of scene.isolationRooms){
  const room=scene.rooms.find((r:any)=>r.id===id),within=(r:any,x:number,y:number)=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height;
  const seed=closed.lowerTiles.findIndex((n:number,i:number)=>floors.has(n)&&closed.upperTiles[i]===-1&&within(room,i%map.width,Math.floor(i/map.width)));
  if(seed<0){issues.push({code:'ROOM_HAS_NO_FLOOR',room:id});continue;}
  const reachable=flood(closed,{x:seed%map.width,y:Math.floor(seed/map.width)});
  for(const other of scene.rooms.filter((r:any)=>r.id!==id))if([...reachable].some(i=>within(other,i%map.width,Math.floor(i/map.width))))issues.push({code:'ROOM_LEAK',room:id,to:other.id});
 }
 const buildIndex=calls.findIndex((c:any)=>c.name==='build_shared_scene'&&c.args.id===placeId&&c.result.ok);
 const reads=calls.slice(0,buildIndex).filter((c:any)=>c.name==='read_spatial_reference'&&c.args.id===placeId&&c.result.ok);
 const pages=reads.filter((c:any)=>c.args.documentId==='assembly').map((c:any)=>c.result.data.document);
 let end=0;for(const p of pages.sort((a:any,b:any)=>a.offset-b.offset)){if(p.offset>end)break;end=Math.max(end,p.offset+p.markdown.length);}
 results.push({sourceId,mapId:map.id,approachTargets:scene.approachCells.length,isolatedRooms:scene.isolationRooms.length,reachable:seen.size,issues,referenceBeforeBuild:{imageRead:reads.some((c:any)=>c.args.imageId),documentPages:pages.length,charactersRead:end,totalCharacters:pages[0]?.totalCharacters??0,complete:pages.length>0&&end>=pages[0].totalCharacters}});
}
const result={maps:results,contentPass:results.length===8&&results.every(r=>!r.issues.length),fullReferenceBeforeBuild:results.every(r=>r.referenceBeforeBuild?.complete&&r.referenceBeforeBuild?.imageRead),note:'Read coverage is reported separately: a correct copied raster does not prove the model read all paginated guidance.'};
fs.writeFileSync(root+'/placement-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.contentPass)process.exitCode=1;
