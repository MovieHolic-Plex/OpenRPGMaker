// Direct production tool contracts on a copy of the saved native fixture.
// No model call is made and this is not assistant-composer evidence.
import fs from 'node:fs';
import {LAYER_TOOLS} from '../../src/editor/tools/layerTools.ts';
import {CONSTRUCTION_TOOLS_V3} from '../../src/editor/tools/v3/constructionTools.ts';
const project=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const map=project.maps.qa_forest,t=project.tilesets[map.tilesetId],kit=t.structureKits.find((k:any)=>k.id==='wmi-fantasy/town_red');
function mismatches(){let n=0;for(const g of t.autotileGroups.filter((g:any)=>g.layer==='upper')){
 const own=new Set(g.memberTileIds),all=new Set(g.connectTileIds);for(let i=0;i<map.upperTiles.length;i++)if(own.has(map.upperTiles[i])){
  const x=i%map.width,y=Math.floor(i/map.width);let mask=0;
  for(const [dx,dy,bit]of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]])if(x+dx>=0&&x+dx<map.width&&y+dy>=0&&y+dy<map.height&&all.has(map.upperTiles[(y+dy)*map.width+x+dx]))mask|=bit;
  if(g.variantMap[String(mask)]!==map.upperTiles[i])n++;
 }
}return n;}
const ground=JSON.stringify(map.lowerTiles);
const block=LAYER_TOOLS.find(t=>t.name==='stamp_layer_block')!.run(project,{mapId:map.id,x:23,y:4,layers:{'3':kit.rows.map((r:any)=>r.upperTiles)},reshape:true});
const afterStamp=mismatches(),exact=kit.rows.every((r:any,dy:number)=>r.upperTiles.every((v:number,dx:number)=>map.upperTiles[(4+dy)*map.width+23+dx]===v));
const erased=CONSTRUCTION_TOOLS_V3.find(t=>t.name==='tile_erase')!.run(project,{mapId:map.id,rect:{x:4,y:6,w:1,h:1},layer:'upper'});
const afterErase=mismatches();const report={directTools:true,newModelCall:false,stamp:{summary:block.summary,afterStamp,exact},erase:{summary:erased.summary,afterErase},groundPreserved:ground===JSON.stringify(map.lowerTiles)};
fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2));console.log(report);if(afterStamp||afterErase||!exact||!report.groundPreserved)process.exitCode=1;
