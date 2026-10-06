// Adversarial authored fixtures use the shipped connection engine, then persist
// to their own real SQLite project. PNG evidence is captured in the native editor.
import fs from 'node:fs';
import path from 'node:path';
import {openLocalProjectStore,initLocalProjectStore} from '../../electron/local-store/store.ts';
import {attachWorldmapAuthoringBrushes} from '../../src/project/defaults/worldmapAuthoring.ts';
import {shapeAllAutotileGroupsAround} from '../../src/project/defaults/autotileEngine.ts';
import {createBlankMap} from '../../src/project/defaults/defaultMaps.ts';
import {setLayerTileAt,layerTileAt} from '../../src/project/mapLayers.ts';
import type {GameMap,Project} from '../../src/project/types.ts';
const [source,target,out]=process.argv.slice(2).map(x=>path.resolve(x));
const input=await openLocalProjectStore({projectDir:source});
const project=input.loadSnapshot()!.project as Project;
// A saved document with media refs must copy those bytes into its own store.
const media=await Promise.all(input.listAssets().map(async row=>({row,bytes:await input.assetBytes(row.sha256)})));input.close();
project.meta.title='월드맵 오토타일 적대적 시각 검수';
const tileset=project.tilesets.worldmap_authoring;
attachWorldmapAuthoringBrushes(tileset);
const groups=tileset.autotileGroups!;
const points=(m:GameMap)=>Array.from({length:m.width*m.height},(_,i)=>({x:i%m.width,y:Math.floor(i/m.width)}));
function map(id:string,name:string,fill:number){
 const m=createBlankMap(name,64,40,tileset.id);m.id=id;m.lowerTiles.fill(fill);
 project.maps[id]=m; return m;
}
function tile(id:string){return groups.find(g=>g.id==='worldmap-brush-'+id)?.variantMap['0']??tileset.tileGroups!.find(g=>g.id==='worldmap-brush-'+id)!.tileIds[0];}
function box(m:GameMap,id:string,x:number,y:number,w:number,h:number,layer:1|3=1){
 const t=id.startsWith('plain:')?tileset.tileGroups!.find(g=>g.id==='worldmap-brush-plain-'+id.slice(6))!.tileIds[0]:tile(id);
 for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)setLayerTileAt(m,layer,yy*m.width+xx,t);
}
function clear(m:GameMap,x:number,y:number,w:number,h:number,fill=0,layer:1|3=1){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)setLayerTileAt(m,layer,yy*m.width+xx,fill);}
const coast=map('qa_coast','QA 01 · 海岸 / 凹角 / 一格地峡',0);
box(coast,'grass-sea',2,2,14,12);clear(coast,6,5,6,5);clear(coast,2,2,4,3);
box(coast,'sand-sea',19,2,14,12);clear(coast,26,2,1,7);clear(coast,19,8,7,1);
box(coast,'snow-sea',37,2,12,12);clear(coast,41,6,4,4);
for(const [x,y]of [[2,18],[3,19],[4,20],[5,21],[6,22]])box(coast,'grass-sea',x,y,1,1);
box(coast,'grass-sea',10,18,1,15);box(coast,'grass-sea',14,25,15,1);box(coast,'grass-sea',31,19,2,13);
box(coast,'grass-sea',39,20,9,9);clear(coast,41,22,5,5);box(coast,'sand-sea',50,2,6,12);box(coast,'snow-sea',56,2,6,12);
box(coast,'grass-sea',0,34,64,6);
const water=map('qa_water','QA 02 · 河川 / 橋 / 河口 / 溶岩',1);
for(const x of [5,17,29])box(water,'river-grass',x,3,1,15);
for(const y of [6,10,14])box(water,'river-grass',3,y,29,1);
box(water,'road-grass',2,10,10,1);box(water,'bridge-horizontal',5,10,1,1);
box(water,'road-grass',17,1,1,12);box(water,'river-grass',12,6,12,1);box(water,'bridge-vertical',17,6,1,1);
box(water,'sea-grass',38,3,18,13);box(water,'river-grass',40,16,1,10);box(water,'river-grass',48,16,2,10);
box(water,'lava-grass',3,23,12,12);clear(water,6,26,6,6,1);box(water,'toxic-grass',18,23,12,12);
const forest=map('qa_forest','QA 03 · 森林 / 山脈 / 地面変更',1);
for(const [i,id]of ['forest','conifer','snowforest','mountain','snowmountain','volcano','jungleforest','deadforest','mesa'].entries()){
 const x=2+(i%3)*20,y=2+Math.floor(i/3)*12;
 box(forest,id+'-any',x,y,14,9,3);clear(forest,x+4,y+3,5,3,-1,3);clear(forest,x,y,3,2,-1,3);
 box(forest,'plain:sand',x+7,y,7,5);box(forest,'plain:snow',x+7,y+5,7,4);
}
const roads=map('qa_roads','QA 04 · 道 16接続 / 異なる地面',1);
for(let mask=0;mask<16;mask++){
 const x=3+(mask%8)*7,y=3+Math.floor(mask/8)*8;box(roads,'road-grass',x,y,1,1);
 for(const [dx,dy,bit]of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]])if(mask&bit)box(roads,'road-grass',x+dx,y+dy,1,1);
}
box(roads,'plain:sand',20,22,20,14);box(roads,'plain:snow',40,22,20,14);
box(roads,'road-grass',2,27,18,1);box(roads,'road-sand',20,27,20,1);box(roads,'road-snow',40,27,20,1);
for(const m of [coast,water,forest,roads])shapeAllAutotileGroupsAround(m,groups,points(m));
const original=Object.values(project.maps).find(m=>m.name==='팔레트로 만든 새 대륙');
if(original)shapeAllAutotileGroupsAround(original,groups,points(original));
project.startMapId=coast.id;project.startPos={x:12,y:3};
fs.mkdirSync(out,{recursive:true});
const output=fs.existsSync(path.join(target,'project.sqlite'))?await openLocalProjectStore({projectDir:target}):await initLocalProjectStore({projectDir:target});
for(const {row,bytes}of media)await output.putAsset(bytes,{mime:row.mime,extension:row.extension,originalName:row.originalName??undefined,kind:row.kind??undefined});
const save=await output.saveProject(project);if(save.kind!=='saved')throw Error(JSON.stringify(save));
const receipt={projectId:output.info().projectId,target,revision:output.info().revision,maps:[coast,water,forest,roads].map(m=>({id:m.id,name:m.name}))};output.close();
const reopened=await openLocalProjectStore({projectDir:target});const loaded=reopened.loadSnapshot()!;reopened.close();
if(JSON.stringify(loaded.project.maps)!==JSON.stringify(project.maps))throw Error('Fixture map reload changed');
fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify({...receipt,reloaded:true},null,2));console.log(receipt);
