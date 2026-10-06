// Independent semantic neighbor oracle; never calls the production mask/shape helper.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {attachWorldmapAuthoringBrushes,createWorldmapAuthoringTileset} from '../../src/project/defaults/worldmapAuthoring.ts';
import type {Project} from '../../src/project/types.ts';
const [folder,out]=process.argv.slice(2).map(p=>path.resolve(p));
const store=await openLocalProjectStore({projectDir:folder});const snapshot=store.loadSnapshot()!,info=store.info();store.close();
const project=snapshot.project as Project,sheet=JSON.parse(fs.readFileSync('src/assets/worldmapAuthoringSheet.json','utf8'));
const forests=new Set(['forest','conifer','snowforest','deadforest','jungleforest']),mountains=new Set(['mountain','snowmountain','volcano','mesa']);
const mismatches:any[]=[];let examined=0;
for(const map of Object.values(project.maps)){
 const t=project.tilesets[map.tilesetId];if(!t?.autotileGroups)continue;
 const source=(tile:number)=>{const g=t.tileGrafts?.find(g=>g.targetTile===tile);return g?(g.sourceChipset==='tex_worldmap_authoring'?g.sourceTile:undefined):t.image.type==='bundled'&&t.image.id==='tex_worldmap_authoring'?tile:undefined;};
 const kind=(tile:number)=>sheet.tiles[source(tile)??-1]?.kind;
 for(const group of t.autotileGroups.filter(g=>g.id.startsWith('worldmap-brush-'))){
  const b=sheet.brushes.find((b:any)=>b.id===group.id);if(!b)throw Error('Unknown brush '+group.id);
  const members=new Set(group.memberTileIds),tiles=group.layer==='upper'?map.upperTiles:map.lowerTiles;
  const joins=(k:string)=>b.background==='sea'?!['sea','river','lava','toxic'].includes(k):b.kind==='river'||b.kind.startsWith('bridge-')?['river','sea'].includes(k)||k.startsWith('bridge-'):b.kind==='road'?k==='road'||k.startsWith('bridge-'):forests.has(b.kind)?forests.has(k):mountains.has(b.kind)?mountains.has(k):k===b.kind;
  for(let i=0;i<tiles.length;i++)if(members.has(tiles[i])){
   let mask=0;const x=i%map.width,y=Math.floor(i/map.width);
   for(const [dx,dy,bit]of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]]){
    if(b.neighborhood===4&&bit>8)continue;const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=map.width||yy>=map.height)continue;
    const k=kind(tiles[yy*map.width+xx]);if(k&&joins(k))mask|=bit;
   }
   examined++;const expected=group.variantMap[String(mask)];if(tiles[i]!==expected)mismatches.push({mapId:map.id,x,y,group:group.id,actual:tiles[i],expected,mask});
  }
 }
}
const t=project.tilesets.worldmap_authoring,iconTiles=new Set(t.structureKits!.flatMap(k=>k.rows.flatMap(r=>r.upperTiles??[])));
const beforeIcons=[...iconTiles].map(i=>({i,pass:t.passability[i],meta:t.tileMeta![i],graft:t.tileGrafts!.find(g=>g.targetTile===i)}));
const copy=structuredClone(t);attachWorldmapAuthoringBrushes(copy);const second=attachWorldmapAuthoringBrushes(copy);
const afterIcons=[...iconTiles].map(i=>({i,pass:copy.passability[i],meta:copy.tileMeta![i],graft:copy.tileGrafts!.find(g=>g.targetTile===i)}));
const fresh=createWorldmapAuthoringTileset();const freshIdempotent=!attachWorldmapAuthoringBrushes(fresh);
const q=JSON.parse(fs.readFileSync(process.argv[4]??'tiledata/worldmap-kit/authoring/pixels.json','utf8')).quarters;
const ports=[q.outer.map((r:string)=>r[7]),q.outer[7].split(''),q.north.map((r:string)=>r[0])];
const portMismatches=ports[0].filter((c:string,i:number)=>c!==ports[2][i]).length+ports[1].filter((c:string,i:number)=>c!==ports[2][i]).length;
const report={projectId:info.projectId,revision:snapshot.revision,examined,mismatches,portMismatches,bridgeConnections:mismatches.filter(m=>m.group.startsWith('worldmap-brush-river')).length,iconTilesPreserved:isDeepStrictEqual(beforeIcons,afterIcons),existingIdempotent:!second,freshIdempotent};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log({...report,mismatches:mismatches.length});
if(mismatches.length||portMismatches||!report.iconTilesPreserved||!report.existingIdempotent||!freshIdempotent)process.exitCode=1;
