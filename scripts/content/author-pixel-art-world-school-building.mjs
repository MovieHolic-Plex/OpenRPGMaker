// Private source pixels -> editor maps. Input must be a canonical reload, never a blank project.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import pngjs from 'pngjs';
import {withTsModule} from '../ontology-ts-loader.mjs';
import {schoolStairReference} from './pixel-art-world-school-stair-reference.mjs';
const [input,folder]=process.argv.slice(2);
if(!input||!folder)throw Error('Usage: node scripts/content/author-pixel-art-world-school-building.mjs <canonical-portable.json> <original-folder>');
const p=JSON.parse(await readFile(input,'utf8')),b=JSON.parse(await readFile('src/assets/pixelArtWorldSchoolBuilding.json','utf8'));
const out=process.env.PAW_SCHOOL_OUTPUT??'output/paw-school-four';await mkdir(out,{recursive:true});
const {PNG}=pngjs,images={};
for(const s of b.sources){const bytes=await readFile(path.join(folder,s.filename));if(createHash('sha256').update(bytes).digest('hex')!==s.sha256)throw Error('Source changed '+s.filename);images[s.filename]=PNG.sync.read(bytes);}
const quarters=await withTsModule('src/project/pixelArtWorldAutotiles.ts','school-quarter.mjs',a=>a.xpAutotileQuarters);
const columns=16,count=Math.ceil(b.tiles.length/columns)*columns,atlas=new PNG({width:columns*32,height:count/columns*32});
function blit(src,dst,sx,sy,w,h,dx,dy){for(let y=0;y<h;y++)for(let x=0;x<w;x++){const si=((sy+y)*src.width+sx+x)*4,di=((dy+y)*dst.width+dx+x)*4,a=src.data[si+3]/255,c=dst.data[di+3]/255,v=a+c*(1-a);for(let z=0;z<3;z++)dst.data[di+z]=v?Math.round((src.data[si+z]*a+dst.data[di+z]*c*(1-a))/v):0;dst.data[di+3]=Math.round(v*255);}}
b.tiles.forEach((t,i)=>{const s=b.sources.find(s=>s.filename===t.source),im=images[t.source],dx=i%columns*32,dy=Math.floor(i/columns)*32;if(s.format==='xp-autotile')for(const q of quarters(s.variantMasks[t.tile]))blit(im,atlas,q.sx,q.sy,16,16,dx+q.dx,dy+q.dy);else blit(im,atlas,t.tile%8*32,Math.floor(t.tile/8)*32,32,32,dx,dy);});
const assetId='paw-school-four-atlas',tsId='paw-school-four-composed';
p.assets.uploaded[assetId]={id:assetId,name:'학교 4층 · 사용자 조립',kind:'chipset',dataUrl:'data:image/png;base64,'+PNG.sync.write(atlas).toString('base64'),meta:{tileSize:32,width:atlas.width,height:atlas.height,frameWidth:32,frameHeight:32,frames:count}};
const ts={id:tsId,name:'햇살학교 · 4층 건물 조립',kind:'custom',image:{type:'uploaded',id:assetId},tileSize:32,tilesPerRow:columns,count,passability:[],priority:[],terrain:Array(count).fill(0),tileMeta:[],tileGroups:[],autotileGroups:[],referenceDocuments:[]};
for(let i=0;i<count;i++){const t=b.tiles[i],ok=t?.passage==='passable';ts.passability.push({up:ok,down:ok,left:ok,right:ok});ts.priority.push(t?.layer??'lower');ts.tileMeta.push({label:t?`${t.source} · ${t.tile}`:'빈 칸',description:'학교 건물 청사진의 원본 사전 참조.',source:'imported',...(t?{defaultLayer:t.layer,passage:ok?'passable':'blocked'}:{})});}
p.tilesets[tsId]=ts;
const event=(id,name,x,y,commands,touch=false)=>({id,name,x,y,trigger:{kind:touch?'touch':'action'},commands,pages:[{id:id+'-page',name,conditions:[],graphic:{},trigger:{kind:touch?'touch':'action'},priority:touch?'below':'same',movement:{type:'fixed',speed:3,frequency:3},commands}]});
const cityPlan=JSON.parse(await readFile('src/assets/pixelArtWorldCity.json','utf8')),school=cityPlan.entrances.find(e=>e.room.startsWith('school'));
const links=[],grounding=[];
for(const f of b.floors){
 const map={id:f.id,name:f.name,width:f.width,height:f.height,tileSize:32,tilesetId:tsId,lowerTiles:f.lowerTiles,upperTiles:f.upperTiles,events:[],encounterRate:0,climate:{mode:'indoor'}};
 for(const [i,s]of f.stairs.entries()){const transfer={kind:'transfer',mapId:`paw-school-floor-${s.destinationLevel}`,...s.destination,direction:'down',fade:'black'};map.events.push(event(`${f.id}-stairs-${i}`,`${s.destinationLevel}층으로 ${s.direction==='up'?'올라가기':'내려가기'}`,s.x,s.y,[transfer]));links.push({from:f.id,to:transfer.mapId,at:{x:s.x,y:s.y},approach:s.approach,spawn:s.destination});}
 if(f.level===1)for(let dx=0;dx<(f.entrance.width??2);dx++)map.events.push(event('school-exit-'+dx,'학교 밖으로',f.entrance.x+dx,f.entrance.y,[{kind:'transfer',mapId:'paw_city',...school.approach,direction:'down',fade:'black'}],true));
 for(const r of f.rooms)map.events.push(event(r.id+'-name',r.name,r.door.x-1,r.door.y+3,[{kind:'text',text:r.name}]));
 p.maps[f.id]=map;
 // Actual compiled stamp feet: repeated stairs do not use sourceRect height.
 for(const place of f.placements){const r=b.recipes[place.recipeId];if(r.placementKind!=='standing')continue;const rows=r.tiles??[];const feet=r.supportCells??[{x:0,y:place.height-1}];for(const cell of feet){const x=place.x+cell.x,y=place.y+cell.y;if(b.tiles[f.lowerTiles[y*f.width+x]].passage!=='passable')throw Error(`Unsupported furniture ${f.id}/${place.recipeId} at ${x},${y}`);}grounding.push({floor:f.id,recipe:place.recipeId,x:place.x,y:place.y});}
}
// Replace this task's earlier single-room school while preserving all non-school maps.
const retired=['school-hallway-0','school-classroom-north-0','school-nurse-compact-0','school-lab-compact-0'];
for(const id of retired)delete p.maps[id];
for(const e of p.maps.paw_city.events)for(const commands of [e.commands,...(e.pages??[]).map(p=>p.commands)])for(const c of commands)if(c.kind==='transfer'&&(retired.includes(c.mapId)||c.mapId==='paw-school-floor-1')){c.mapId=b.floors[0].id;Object.assign(c,b.floors[0].spawn);}
p.mapTree.children=p.mapTree.children.filter(n=>!retired.includes(n.mapId)&&!b.floors.some(f=>f.id===n.mapId));
p.mapTree.children.unshift({mapId:b.floors[0].id,children:b.floors.slice(1).map(f=>({mapId:f.id,children:[]}))});
const base=(id,name)=>({id,name,revision:1,tags:['Pixel Art World','학교','4층'],provenance:{origin:'ai'}});
const emptyHash=createHash('sha256').update('{}').digest('hex');
p.spatialAuthoring??={version:1,library:{objects:{},spaces:{},places:{},regions:{},worlds:{}},occurrences:{},rootOccurrenceIds:[],connections:[],legacyImport:{version:1,sourceHash:emptyHash,mapping:[],backup:{encoding:'raw-json',json:'{}',sha256:emptyHash}}};
const children=[],connections=[];
for(const f of b.floors){
 const id=f.id+'-design',ports=f.stairs.map(s=>({id:`${id}-${s.direction}-${s.x<f.width/2?'west':'east'}`,name:`${s.destinationLevel}층 계단`,x:s.x,y:s.y}));
 const tiles=[];for(const layer of ['lower','upper'])f[layer+'Tiles'].forEach((tile,i)=>{if(tile>=0)tiles.push({x:i%f.width,y:Math.floor(i/f.width),layer,tile});});
 p.spatialAuthoring.library.spaces[id]={...base(id,f.name),environment:'interior',role:'room',tilesetId:tsId,shape:'rect',width:f.width,height:f.height,floor:'school-green',wall:'school-cream',objectSlots:[],ports,interiorLayout:{rooms:f.rooms.map(({id,name,x,y,width,height})=>({id,name,x,y,width,height})),doorways:f.doorways.flatMap(d=>Array.from({length:d.height},(_,y)=>Array.from({length:d.width},(_,x)=>({x:d.x+x,y:d.y+y}))).flat())},composition:{tilesetId:tsId,width:f.width,height:f.height,tiles,members:[]}};
 children.push({id:f.id+'-slot',source:{kind:'space',id},level:f.level,x:0,y:0});
 if(f.level<4)for(const side of ['east'])connections.push({id:`school-level-${f.level}-${side}`,from:{childId:f.id+'-slot',portId:`${id}-up-${side}`},to:{childId:`paw-school-floor-${f.level+1}-slot`,portId:`paw-school-floor-${f.level+1}-design-down-${side}`},bidirectional:true});
}
p.spatialAuthoring.library.places['paw-school-building-design']={...base('paw-school-building-design','햇살학교 · 4층 / 28실'),kind:'facility',layout:'manual',children,ports:[],connections};
const guide=await readFile('tiledata/pixel-art-world/SCHOOL-BUILDING.md','utf8');
ts.referenceDocuments.push(schoolStairReference(b,b.stairwellGuide,(width,height,lower,upper)=>{
 const im=new PNG({width:width*32,height:height*32});
 for(const a of [lower,upper])a.forEach((t,i)=>{if(t>=0)blit(atlas,im,t%columns*32,Math.floor(t/columns)*32,32,32,i%width*32,Math.floor(i/width)*32);});
 return 'data:image/png;base64,'+PNG.sync.write(im).toString('base64');
}));
ts.referenceDocuments.push({id:'school-building-plan',name:'학교 · 4층 구조와 부품',description:'교실16·특별/관리실8·화장실4. 같은 층의 방과 복도는 연속 보행.',documents:[{id:'guide',name:'먼저 읽기.md',markdown:guide},{id:'sources',name:'원본과 조립 사전.md',markdown:'```json\n'+JSON.stringify({sources:b.sources,tiles:b.tiles,recipes:b.recipes})+'\n```'}],images:[]});
// The new cabinet owns a complete, source-derived normal/error assembly.
{
 const id='classroom-rear-lockers',recipe=b.recipes[id],width=5,height=4;
 const floor=b.tiles.findIndex(t=>t.source==='ST-Schl-I01.png'&&t.tile===6&&t.layer==='lower');
 const wall=b.tiles.findIndex(t=>t.source==='ST-Schl-I01.png'&&t.tile===57&&t.layer==='lower');
 const lowerTiles=Array(width*height).fill(floor),upperTiles=Array(width*height).fill(-1);
 recipe.tiles.forEach((row,y)=>row.forEach((tile,x)=>{const index=b.tiles.findIndex(t=>t.source===recipe.source&&t.tile===tile&&t.layer==='upper');if(index<0)throw Error('Cabinet token missing');upperTiles[(y+1)*width+x+1]=index;}));
 const badLower=[...lowerTiles];for(let x=1;x<=3;x++)badLower[2*width+x]=wall;
 const images=[];
 for(const [variant,lower]of [['normal',lowerTiles],['error',badLower]]){const im=new PNG({width:width*32,height:height*32});for(const a of [lower,upperTiles])a.forEach((t,i)=>{if(t>=0)blit(atlas,im,t%columns*32,Math.floor(t/columns)*32,32,32,i%width*32,Math.floor(i/width)*32);});const bytes=PNG.sync.write(im);await writeFile(`${out}/locker-${variant}.png`,bytes);images.push({id:variant,name:`locker-${variant}.png`,caption:variant==='normal'?'정상: 밑동은 바닥, 남쪽 조작면은 빈 칸':'오류: 밑동 세 칸을 벽이 받침',dataUrl:'data:image/png;base64,'+bytes.toString('base64')});}
 ts.referenceDocuments.push({id:'school-part-'+id,name:recipe.name,description:'전체3×2·밑동·접근면 정상/오류',documents:[{id:'assembly',name:'목재 사물함 조립.md',markdown:`${recipe.notes}\n\n합성 atlas 전용 전체 배열. 정상 원점(1,1), 밑동(1..3,2), 접근(1..3,3). 오류는 밑동을 벽으로 바꾼 경우다.\n\n\`\`\`json\n${JSON.stringify({recipe,width,height,lowerTiles,upperTiles,invalidLowerTiles:badLower})}\n\`\`\`\n\n![정상](image:normal)\n\n![오류](image:error)`}],images});
}
for(const f of b.floors){const im=new PNG({width:f.width*32,height:f.height*32});for(const a of [f.lowerTiles,f.upperTiles])a.forEach((t,i)=>{if(t>=0)blit(atlas,im,t%columns*32,Math.floor(t/columns)*32,32,32,i%f.width*32,Math.floor(i/f.width)*32);});const bytes=PNG.sync.write(im);await writeFile(`${out}/${f.id}.png`,bytes);ts.referenceDocuments.push({id:f.id,name:f.name,description:'실제 벽·문·가구·계단과 전체 배열',documents:[{id:'layout',name:'배치.md',markdown:'```json\n'+JSON.stringify(f)+'\n```\n\n![실제 배치](image:floor)'}],images:[{id:'floor',name:f.id+'.png',caption:'사용자 원본으로 조립한 실제 층 평면.',dataUrl:'data:image/png;base64,'+bytes.toString('base64')}]});}
await withTsModule('src/project/io.ts','school-io.mjs',async api=>{const serialized=api.serialize(p),again=api.deserialize(serialized);for(const f of b.floors)if(JSON.stringify(again.maps[f.id])!==JSON.stringify(p.maps[f.id]))throw Error('Map roundtrip changed '+f.id);if(!again.spatialAuthoring?.library.places['paw-school-building-design'])throw Error('Spatial plan dropped');await writeFile(`${out}/authored.json`,serialized);});
await withTsModule('src/project/collision.ts','school-collision.mjs',api=>{for(const f of b.floors){const map=p.maps[f.id],q=[f.spawn],seen=new Set([f.spawn.y*f.width+f.spawn.x]);for(let k=0;k<q.length;k++)for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){const a=q[k],x=a.x+dx,y=a.y+dy,i=y*f.width+x;if(!seen.has(i)&&api.canMove(p,map,a.x,a.y,x,y)){seen.add(i);q.push({x,y});}}for(const c of [...f.approaches,...f.stairs.map(s=>s.approach)])if(!seen.has(c.y*f.width+c.x))throw Error(`Engine blocked ${f.id} ${c.x},${c.y}`);}});
await writeFile(`${out}/assembly-report.json`,JSON.stringify({floors:b.floors.map(f=>({id:f.id,rooms:f.rooms,stairs:f.stairs,spawn:f.spawn,entrance:f.entrance})),links,groundedPlacements:grounding.length,cityEntrance:school},null,2));
console.log({floors:4,rooms:28,classrooms:16,seats:b.floors.flatMap(f=>f.placements).filter(p=>p.recipeId.endsWith('/school-student-desk')).length,stairs:links.length,groundedPlacements:grounding.length,maps:Object.keys(p.maps).length});
