/** Authored fortress city. Measured tiles, explicit districts, reachable gates. */
import fs from 'node:fs';
import {PNG} from 'pngjs';
import assert from 'node:assert/strict';
import {createBlankMap} from '../src/project/defaults/defaultMaps';
import {CASTLE_MEASURED_PARTS} from '../src/project/defaults/castleMeasuredParts';
import {installCastleSurroundings,HARBOR_TILESET_ID} from './lib/castle-surroundings.mts';
import {canMove} from '../src/project/collision';
import {charsetFrameIndex} from '../src/assets/easyrpgRtp';
const out='output/grand-castle';fs.mkdirSync(out,{recursive:true});
const original=JSON.parse(fs.readFileSync('output/castle-study/sqlite-reloaded.json','utf8'));
const p=structuredClone(original);installCastleSurroundings(p);
const t=p.tilesets[HARBOR_TILESET_ID];
const atlas=JSON.parse(fs.readFileSync('public/assets/castle-surroundings/manifest.json','utf8'));
const W=160,H=144,m=createBlankMap('강항 성곽 도시 · 외성과 왕성',W,H,t.id,16);m.id='grand-river-fortress';
p.maps[m.id]=m;p.mapTree.children.push({mapId:m.id,children:[]});p.startMapId=m.id;p.startPos={x:64,y:138};
p.meta.title='성채 지도집 · 강항 성곽 도시';
const placements:any[]=[],districts:any[]=[];
const tile=(x:number,y:number)=>y*32+x,at=(x:number,y:number)=>y*W+x;
function put(x:number,y:number,sx:number,sy:number,upper=false){assert(x>=0&&x<W&&y>=0&&y<H);(upper?m.upperTiles:m.lowerTiles)[at(x,y)]=tile(sx,sy);}
const terrain=new Set<string>(),paving=new Set<string>();
function rect(mask:Set<string>,x:number,y:number,w:number,h:number){assert([x,y,w,h].every(n=>n%2===0));for(let j=y;j<y+h;j+=2)for(let i=x;i<x+w;i+=2)mask.add(`${i/2},${j/2}`);}
rect(terrain,8,6,126,128);rect(terrain,56,130,20,14);
rect(terrain,144,8,14,22);rect(terrain,150,112,10,28);
for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){const a=x/2,b=y/2,land=terrain.has(`${a},${b}`);
 const left=terrain.has(`${a-1},${b}`),right=terrain.has(`${a+1},${b}`),up=terrain.has(`${a},${b-1}`),down=terrain.has(`${a},${b+1}`);
 const sx=!land?0:!left?0:!right?4:2;
 const sy=!land?24:!up?26:!down?30:28;
 for(let j=0;j<2;j++)for(let i=0;i<2;i++)put(x+i,y+j,land&&left&&right&&up&&down?i:sx+i,land&&left&&right&&up&&down?22+j:sy+j);
}
// The paving network is a union, so intersections have no repeated rim/seam.
for(const r of [[60,108,8,36],[60,78,8,32],[28,88,38,24],[62,72,18,8],[72,52,8,24],
 [44,44,52,12],[62,40,8,12],[66,90,66,8],[78,86,14,24],[92,88,22,6],[122,74,10,32],
 [100,42,12,12],[28,46,20,8],[30,84,6,10]] as const)rect(paving,...r);
for(const key of paving){const [x,y]=key.split(',').map(Number);const sx=!paving.has(`${x-1},${y}`)?12:!paving.has(`${x+1},${y}`)?16:14;const sy=!paving.has(`${x},${y-1}`)?20:!paving.has(`${x},${y+1}`)?24:22;
 for(let j=0;j<2;j++)for(let i=0;i<2;i++)put(x*2+i,y*2+j,sx+i,sy+j);}
function panel(x:number,y:number,w:number,h:number){
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
 const u=i<2?i:i>=w-2?8-(w-i):2+(i-2)%2;
 const v=j<2?j:j>=h-2?6-(h-j):2+(j-2)%2;put(x+i,y+j,12+u,v,true);}
}
function face(x:number,y:number,w:number,h:number){for(let j=0;j<h;j++)for(let i=0;i<w;i++)put(x+i,y+j,i%2,j===0?6:j===h-1?10:8+(j-1)%2,true);}
function building(name:string,x:number,y:number,w:number,roofH:number,wallH:number){panel(x,y,w,roofH);face(x,y+roofH,w,wallH);placements.push({name,x,y,w,h:roofH+wallH});}
function stamp(id:string,x:number,y:number){
 const measured=CASTLE_MEASURED_PARTS.find(v=>v.id===id);const part=atlas.parts[id];
 const rect=measured?.rect??part?.rect;assert(rect,'Unknown part '+id);const [sx,sy,w,h]=rect;
 placements.push({name:id,x,y,w,h});
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
 if(id==='clock-tree'&&i>=4&&j<2)continue;
 const v=tile(sx+i,sy+j);if(atlas.alpha[v]==='E')continue;
 const index=at(x+i,y+j);if(m.upperTiles[index]>=0){m.upperTileStacks??={};(m.upperTileStacks[index]??=[]).push(v);}else put(x+i,y+j,sx+i,sy+j,true);}
}
function gate(x:number,y:number){for(let j=0;j<6;j++)for(let i=0;i<6;i++){m.upperTiles[at(x+i,y+j)]=-1;if(m.upperTileStacks)delete m.upperTileStacks[at(x+i,y+j)];}for(let j=0;j<6;j++)for(let i=0;i<6;i++)put(x+i,y+j,28+i%2,j<3?14:12+j);stamp('gate',x,y);}
function tower(name:string,x:number,y:number,w=10,roofH=8,wallH=10){building(name,x,y,w,roofH,wallH);stamp('door',x+Math.floor(w/2)-1,y+roofH+wallH-4);}
// Outer fortification: leave real eight-cell gaps at the southern and eastern gates.
building('북쪽 외성벽',20,12,98,6,4);
building('서쪽 외성벽',18,20,6,96,6);
building('동쪽 외성벽 북구간',116,20,6,66,6);
building('동쪽 외성벽 남구간',116,98,6,18,6);
building('남쪽 외성벽 서구간',20,116,40,6,6);
building('남쪽 외성벽 동구간',68,116,50,6,6);
tower('북서 망루',14,10,12,10,12);tower('북동 망루',112,10,12,10,12);
tower('남서 망루',14,108,12,10,12);tower('남동 망루',112,108,12,10,12);
tower('남문 서탑',50,112);tower('남문 동탑',68,112);
stamp('banner',53,120);stamp('banner',71,120);
// The inner curtain makes a separate protected district. Its gate is offset east.
building('내성 서쪽 회랑',26,58,46,6,6);
building('내성 동쪽 회랑',80,58,36,6,6);
tower('내성 서탑',24,54,10,8,12);tower('내성문 서탑',62,54,10,8,12);
tower('내성문 동탑',80,54,10,8,12);tower('내성 동탑',106,54,10,8,12);
stamp('banner',65,63);stamp('banner',83,63);
// Asymmetric keep: broad hall, forward west wing, taller eastern watch tower.
building('왕성 본관',42,24,46,12,8);
building('서쪽 접견 날개',32,30,10,10,8);
tower('왕성 동쪽 높은 탑',88,20,14,12,14);
building('왕성 중앙 상층',58,16,16,10,6);
gate(62,38);stamp('banner',46,38);stamp('banner',80,38);stamp('door',36,44);
stamp('banner',93,38);stamp('vine',42,38);
// Lower city has different jobs and scales rather than identical giant blocks.
building('서쪽 병영',28,72,24,8,6);stamp('door',38,82);stamp('banner',30,79);stamp('banner',48,79);
building('동쪽 세관 창고',94,74,18,8,6);stamp('door',102,84);
building('항구 작업소',98,98,14,8,6);stamp('door',104,108);
stamp('vine',108,79);
// Market: produce, awnings, delivery goods, with clear aisles.
for(const [x,y] of [[30,91],[38,91],[46,91],[30,102],[42,102]])stamp('market',x,y);
stamp('produce',30,98);stamp('sacks',50,104);stamp('firewood',27,106);
stamp('well',53,90);stamp('bench',47,108);
// Drill square and store yard.
for(const y of [91,99]){stamp('stela',79,y);stamp('stela',89,y);}
stamp('sacks',95,89);stamp('sacks',100,89);stamp('firewood',109,89);
// Royal square is separate from the public market, with open access to the keep.
stamp('fountain',52,48);stamp('fountain',82,48);
stamp('statue',46,45);stamp('statue',92,45);
for(const [x,y] of [[46,52],[86,52],[29,49],[106,50]])stamp('bench',x,y);
stamp('clock-tree',102,36);stamp('well',30,49);
// Kitchen garden with narrow rows and clear access.
const [soilX,soilY]=atlas.parts.soil.rect;
for(let y=0;y<12;y++)for(let x=0;x<6;x++)put(10+x,52+y,soilX+x%2,soilY+y%2);
for(const x of [10,14]){stamp('corn',x,53);stamp('tomato',x,59);}
// Cargo and fishing piers. Only the central planks are traversable; edges stay blocked.
const [dockX,dockY,dockW,dockH]=atlas.parts.dock.rect;
for(let j=2;j<=3;j++)for(let i=0;i<dockW;i++){
 const v=tile(dockX+i,dockY+j);t.passability[v]={up:true,down:true,left:true,right:true};
 t.priority[v]='lower';t.tileMeta[v].passage='passable';
 t.tileMeta[v].description='부두 중앙 판자: 상위 O로 물 위 통행. 가장자리와 배는 막힘.';
}
// Extend interior planks, keeping the end posts once rather than repeating detached docks.
for(const y of [78,100]){placements.push({name:'연속 목조 부두',x:128,y,w:18,h:6});for(let j=0;j<6;j++)for(let i=0;i<18;i++){const u=i===0?0:i===17?5:1+(i-1)%4;put(128+i,y+j,dockX+u,dockY+j,true);}}
stamp('boatLeft',143,73);stamp('boatRight',143,94);stamp('boatLeft',136,108);
stamp('sacks',123,74);stamp('firewood',124,103);stamp('produce',120,86);
// Trees form small groves, not a uniform grid; none sits in the designed gates.
for(const [x,y] of [[8,34],[8,66],[8,91],[26,9],[104,5],[24,32],[28,111],[91,111],[120,36],[120,55],[144,10],[150,115]])stamp('tree',x,y);
for(const [x,y] of [[10,9],[10,83],[9,120],[27,126],[38,125],[78,126],[90,128],[121,120],[125,112],
 [25,43],[36,51],[99,48],[111,43],[34,10],[46,9],[80,9],[95,9],[126,30],[126,52],[124,68],[147,26],[154,134]])stamp('bush',x,y);
for(const [x,y] of [[9,126],[142,18],[149,128]])stamp('boulders',x,y);
for(const [x,y] of [[6,38],[6,96],[130,42],[130,62],[132,113],[138,134],[146,30],[154,104]])stamp('reeds',x,y);
for(const [x,y] of [[28,114],[42,128],[84,130],[122,109],[126,46],[124,62],[26,40],[109,47]])stamp('grass',x,y);
for(const [x,y] of [[57,128],[71,128],[57,108],[69,82],[70,73],[82,73],[58,47],[72,47],[123,93]])stamp('lamp',x,y);
function npc(id:string,name:string,x:number,y:number,index:number,body:string){m.events.push({id,name,x,y,placementRole:'npc',trigger:{kind:'action'},commands:[],pages:[{id:id+'-page',name,conditions:[],graphic:{sprite:{type:'bundled',id:'tex_easyrpg_charset_people1'},direction:'down',pattern:charsetFrameIndex({characterIndex:index,direction:'down',pattern:1})},trigger:{kind:'action'},priority:'same',overlapForbidden:true,movement:{type:'fixed',speed:3,frequency:3},commands:[{kind:'text',speaker:name,body}]}]});}
npc('city-greeter','남문 안내인',69,134,0,'강항 성곽에 오신 걸 환영합니다. 남문 안 장터에서 동쪽 길을 따라가면 항구입니다.');
npc('city-merchant','장터 상인',48,97,1,'오늘 들어온 곡물과 채소입니다. 세관 창고에서 막 가져왔어요.');
npc('city-recruit','훈련병',85,104,2,'훈련장은 외성 안에 있어요. 왕성에 가려면 북쪽 내성문을 지나세요.');
npc('city-harbor','항구 관리인',126,98,5,'두 부두의 가운데 판자로 걸어가세요. 배에는 아직 오를 수 없습니다.');
npc('city-courtier','왕성 안내인',68,46,3,'여기는 내성 광장입니다. 정면이 본관, 동쪽 높은 탑 옆은 정원입니다.');
npc('city-gardener','정원 관리인',104,50,4,'시계나무 옆 벤치에서 강을 보며 쉬어 가세요.');
for(const d of [
 ['south-gate','남문과 해자 진입로',50,112,28,32],['market','외성 장터',28,88,30,24],['barracks','병영',28,72,24,14],
 ['training','훈련장',78,86,14,24],['harbor','화물 항구와 세 척의 나룻배',122,72,32,40],['inner-gate','내성문',62,54,28,22],
 ['royal-square','왕성 분수 광장',44,44,52,12],['keep','본성과 높은 탑',32,16,70,32],['garden','시계나무 정원',100,34,14,22]
 ]){const [id,name,x,y,w,h]=d;districts.push({id,name,x,y,w,h,tags:['대형 성곽']});}m.locations=districts;
// Bake authored upper stacks into project-owned composite cells for the hosted
// editor, whose older renderer omits these overlays. Original source pixels and
// tile indices are retained; collision metadata follows the visible top tile.
const sourcePng=PNG.sync.read(Buffer.from(p.assets.uploaded.castle_courtyard_harbor_atlas.dataUrl.split(',')[1],'base64'));
const composites=new Map<string,number>(),recipes:number[][]=[];
for(const [key,stack] of Object.entries(m.upperTileStacks??{}) as [string,number[]][]){
 const i=Number(key),recipe=[m.upperTiles[i],...stack],signature=recipe.join(',');
 let index=composites.get(signature);
 if(index===undefined){index=t.count+recipes.length;composites.set(signature,index);recipes.push(recipe);}
 m.upperTiles[i]=index;
}
const packed=new PNG({width:512,height:Math.ceil((t.count+recipes.length)/32)*16});
PNG.bitblt(sourcePng,packed,0,0,512,sourcePng.height,0,0);
for(let n=0;n<recipes.length;n++){
 const index=t.count+n,dx=index%32*16,dy=Math.floor(index/32)*16,recipe=recipes[n];
 for(const cell of recipe){if(cell<0)continue;const sx=cell%32*16,sy=Math.floor(cell/32)*16;
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){
 const a=((sy+y)*512+sx+x)*4,b=((dy+y)*512+dx+x)*4,sa=sourcePng.data[a+3]/255,da=packed.data[b+3]/255,alpha=sa+da*(1-sa);
 if(alpha===0)continue;for(let c=0;c<3;c++)packed.data[b+c]=Math.round((sourcePng.data[a+c]*sa+packed.data[b+c]*da*(1-sa))/alpha);packed.data[b+3]=Math.round(alpha*255);
 }}
 const top=recipe.at(-1)!;t.passability.push({...t.passability[top]});t.priority.push(t.priority[top]);t.terrain.push(t.terrain[top]);t.tileMeta.push({...t.tileMeta[top],label:'겹침 보존 · '+t.tileMeta[top].label,description:'원본 타일 합성: '+recipe.join(' → ')});
}
t.count+=recipes.length;delete m.upperTileStacks;
p.assets.uploaded.castle_courtyard_harbor_atlas.dataUrl='data:image/png;base64,'+PNG.sync.write(packed).toString('base64');
p.assets.uploaded.castle_courtyard_harbor_atlas.meta.height=packed.height;
const profile=p.resourceProfiles.find((v:any)=>v.assetId==='castle_courtyard_harbor_atlas');profile.imageHeight=packed.height;
fs.writeFileSync(out+'/composite-recipes.json',JSON.stringify({originalTileCount:atlas.count,recipes},null,2));

// Verify actual routes with the same collision function the game uses.
const occupied=new Set(m.events.map(e=>`${e.x},${e.y}`));
function route(from:{x:number,y:number},to:{x:number,y:number}){
 const queue=[from],parent=new Map<string,{key:string,dir:string}|null>([[`${from.x},${from.y}`,null]]);let n=0;
 while(n<queue.length){const a=queue[n++],key=`${a.x},${a.y}`;if(a.x===to.x&&a.y===to.y){const moves=[];let k=key;while(parent.get(k)){const v=parent.get(k)!;moves.push({kind:'move',dir:v.dir});k=v.key;}return moves.reverse();}
 for(const [dir,dx,dy] of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]] as const){const x=a.x+dx,y=a.y+dy,k=`${x},${y}`;if(parent.has(k)||occupied.has(k)||!canMove(p,m,a.x,a.y,x,y))continue;parent.set(k,{key,dir});queue.push({x,y});}}
 throw Error('Unreachable '+JSON.stringify(to));
}
const stops=[{id:'south-gate',x:64,y:110},{id:'market',x:48,y:98,npc:'city-merchant'},
 {id:'training',x:85,y:105,npc:'city-recruit'},{id:'harbor',x:126,y:99,npc:'city-harbor'},
 {id:'pier',x:144,y:102},{id:'inner-gate',x:76,y:52},{id:'royal-square',x:68,y:47,npc:'city-courtier'},
 {id:'keep',x:64,y:44},{id:'garden',x:104,y:51,npc:'city-gardener'}];
let pos=p.startPos;const routes=stops.map(s=>{const moves=route(pos,s);pos=s;return {...s,moves};});
for(const e of m.events)route(p.startPos,{x:e.x,y:e.y+1});
assert(!canMove(p,m,145,102,146,102),'Pier must end before water');
assert(!canMove(p,m,64,44,64,43),'Keep closed doorway');
assert.deepEqual(p.maps['castle-study'],original.maps['castle-study']);
assert.deepEqual(p.tilesets[original.maps['castle-study'].tilesetId],original.tilesets[original.maps['castle-study'].tilesetId]);
fs.writeFileSync(out+'/project.json',JSON.stringify(p));
fs.writeFileSync(out+'/assembly-proof.json',JSON.stringify({mapId:m.id,size:[W,H],placements,districts,routes,oldMapUnchanged:true,pierEndsAtWater:true},null,2));
console.log(JSON.stringify({size:[W,H],placements:placements.length,npcs:m.events.length,routes:routes.map(r=>({id:r.id,steps:r.moves.length})),oldMapUnchanged:true}));
