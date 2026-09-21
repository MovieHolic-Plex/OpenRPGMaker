/** Authored fortress city. Measured tiles, explicit districts, reachable gates. */
import fs from 'node:fs';
import {PNG} from 'pngjs';
import assert from 'node:assert/strict';
import {createBlankMap} from '../src/project/defaults/defaultMaps';
import {CASTLE_MEASURED_PARTS} from '../src/project/defaults/castleMeasuredParts';
import {installCastleSurroundings,HARBOR_TILESET_ID} from './lib/castle-surroundings.mts';
import {canMove} from '../src/project/collision';
import {charsetFrameIndex} from '../src/assets/easyrpgRtp';
const out='output/castle-reference-revision';fs.mkdirSync(out,{recursive:true});
const original=JSON.parse(fs.readFileSync('output/grand-castle/before-reference-revision.json','utf8'));
const p=structuredClone(original);installCastleSurroundings(p);
const t=p.tilesets[HARBOR_TILESET_ID];
const atlas=JSON.parse(fs.readFileSync('public/assets/castle-surroundings/manifest.json','utf8'));

// Append complete source islands; keep Castle2 and existing supplemental indices intact.
const additions:any[]=[
 {id:'bare-tree',rect:[256,128,128,160],solid:true},
 {id:'autumn-tree',rect:[224,640,96,96],solid:true},
 {id:'small-tree',rect:[416,672,32,32],solid:true},
 {id:'fine-paving',rect:[32,0,32,32],solid:false},
 {id:'cliff',rect:[576,288,32,64],solid:true},
];
const oldPng=PNG.sync.read(Buffer.from(p.assets.uploaded.castle_courtyard_harbor_atlas.dataUrl.split(',')[1],'base64'));
const source=PNG.sync.read(fs.readFileSync('public/assets/castle-surroundings/sources/hyptosis-batch3.png'));
const newHeight=oldPng.height+additions.reduce((n,a)=>n+a.rect[3],0);
const extended=new PNG({width:512,height:newHeight});PNG.bitblt(oldPng,extended,0,0,512,oldPng.height,0,0);
let row=oldPng.height/16;
for(const part of additions){const [x,y,w,h]=part.rect;PNG.bitblt(source,extended,x,y,w,h,0,row*16);part.atlasRect=[0,row,w/16,h/16];atlas.parts[part.id]={rect:part.atlasRect};row+=h/16;}
for(let i=t.count;i<newHeight/16*32;i++){t.passability.push({up:false,down:false,left:false,right:false});t.priority.push('upper');t.terrain.push(0);t.tileMeta.push({label:'추가 실측 조각',defaultLayer:'upper',passage:'solid',tags:[],source:'ai'});}
t.count=newHeight/16*32;
for(const a of additions)for(let j=0;j<a.atlasRect[3];j++)for(let i=0;i<a.atlasRect[2];i++){const v=(a.atlasRect[1]+j)*32+i;t.tileMeta[v].label=a.id;if(!a.solid){t.passability[v]={up:true,down:true,left:true,right:true};t.priority[v]='lower';t.tileMeta[v].passage='passable';t.tileMeta[v].defaultLayer='lower';}}
atlas.alpha=Array.from({length:t.count},(_,i)=>{let n=0;for(let y=0;y<16;y++)for(let x=0;x<16;x++)n+=extended.data[((Math.floor(i/32)*16+y)*512+i%32*16+x)*4+3];return n===0?'E':n===65280?'O':'P';}).join('');
p.assets.uploaded.castle_courtyard_harbor_atlas.dataUrl='data:image/png;base64,'+PNG.sync.write(extended).toString('base64');
fs.writeFileSync(out+'/source-parts.json',JSON.stringify({source:'hyptosis-batch3.png',units:'source pixels; atlas cells 16px',additions},null,2));

const W=160,H=144,m=createBlankMap('강변 성채 · 본성과 고목 뒤뜰',W,H,t.id,16);m.id='grand-river-fortress';
p.maps[m.id]=m;p.startMapId=m.id;p.startPos={x:54,y:136};
p.meta.title='성채 지도집 · 강항 성곽 도시';
const placements:any[]=[],districts:any[]=[];
const tile=(x:number,y:number)=>y*32+x,at=(x:number,y:number)=>y*W+x;
function put(x:number,y:number,sx:number,sy:number,upper=false){assert(x>=0&&x<W&&y>=0&&y<H);(upper?m.upperTiles:m.lowerTiles)[at(x,y)]=tile(sx,sy);}
const terrain=new Set<string>(),paving=new Set<string>();
function rect(mask:Set<string>,x:number,y:number,w:number,h:number){assert([x,y,w,h].every(n=>n%2===0));for(let j=y;j<y+h;j+=2)for(let i=x;i<x+w;i+=2)mask.add(`${i/2},${j/2}`);}
// Broad eastern river and narrow western moat; land is not a rectangular island.
for(let y=0;y<H;y+=2){
 const shore=100+2*Math.round(3*Math.sin(y/13)+2*Math.cos(y/7));
 for(let x=0;x<W;x+=2){
 const east=144+2*Math.round(3*Math.sin(y/17));
 const moat=8+2*Math.round(Math.sin(y/16));
 if((x<shore && !(y<122&&y>6&&x>=moat&&x<moat+4)) || x>=east || y<16&&x>=106)rect(terrain,x,y,2,2);
 }
}
for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){const a=x/2,b=y/2,land=terrain.has(`${a},${b}`);
 const left=terrain.has(`${a-1},${b}`),right=terrain.has(`${a+1},${b}`),up=terrain.has(`${a},${b-1}`),down=terrain.has(`${a},${b+1}`);
 const sx=!land?0:!left?0:!right?4:2;
 const sy=!land?24:!up?26:!down?30:28;
 for(let j=0;j<2;j++)for(let i=0;i<2;i++)put(x+i,y+j,land&&left&&right&&up&&down?i:sx+i,land&&left&&right&&up&&down?22+j:sy+j);
}
// The paving network is a union, so intersections have no repeated rim/seam.
for(const r of [[50,114,8,30],[28,94,62,20],[26,28,8,76],[32,40,40,20],[52,28,6,16],[60,50,44,6],[88,50,8,70]])rect(paving,...r as [number,number,number,number]);
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
// Two connected long curtains, a rear hall, then the visually dominant lower keep.
building('서쪽 긴 성벽',20,16,6,100,6);
building('동쪽 성벽 북구간',86,16,6,28,6);
building('동쪽 성벽 남구간',86,56,6,60,6);
building('후문 회랑',26,18,60,8,6);
tower('북서 망루',18,10,10,8,10);tower('북동 망루',84,10,10,8,10);
gate(52,28);stamp('banner',49,28);stamp('banner',59,28);
building('본성 넓은 상부',34,66,46,20,12);
building('본성 중앙 상단',42,62,28,6,4);
tower('본성 서탑',28,78,10,8,12);tower('본성 동탑',78,78,10,8,12);
gate(52,92);for(const x of [40,45,62,68])stamp('banner',x,91);
stamp('vine',34,87);
// Lower forecourt has fine paving, unlike the roof and garden walks.
const fine=atlas.parts['fine-paving'].rect;
for(let y=98;y<114;y++)for(let x=28;x<86;x++)put(x,y,fine[0]+x%2,fine[1]+y%2);
building('남벽 서구간',24,114,26,6,8);building('남벽 동구간',58,114,28,6,8);
tower('남서 망루',18,108,10,10,12);tower('남동 망루',84,108,10,10,12);
stamp('banner',45,121);stamp('banner',60,121);
// A planted island under the central tree breaks the large paved rectangle.
for(let y=49;y<58;y++)for(let x=50;x<60;x++)if(!(x<52&&y<51||x>57&&y>55))put(x,y,x%2,22+y%2);
// Exterior approach branches around the lodge and follows the river bank.
for(let y=128;y<H;y++)for(let x=0;x<104;x++){
 const mid=52+Math.round(3*Math.sin(y/6));
 const bank=98+Math.round(2*Math.sin(y/7));
 if(Math.abs(x-mid)<4||Math.abs(x-bank)<2||y>=130&&y<134&&x>=26&&x<mid)put(x,y,fine[0]+x%2,fine[1]+y%2);
}
// Asymmetric intimate rear courtyard: one tree, one fountain, one stall.
stamp('bare-tree',51,43);stamp('fountain',38,48);stamp('market',36,39);
stamp('bench',44,42);stamp('bench',63,44);stamp('statue',45,52);
stamp('sacks',35,34);stamp('firewood',40,34);stamp('well',77,36);
stamp('clock-tree',72,53);stamp('vine',82,42);
for(const [x,y] of [[33,34],[66,34],[75,42],[37,59],[64,59],[79,62]])stamp('bush',x,y);
for(const [x,y] of [[32,51],[68,39],[75,57],[32,70],[95,69]])stamp('grass',x,y);
for(const [x,y] of [[34,60],[68,57],[77,31]])stamp('small-tree',x,y);
// A compact loading shore with two adjacent boats. No stone bridge.
const [dockX,dockY,dockW,dockH]=atlas.parts.dock.rect;
for(let j=2;j<=3;j++)for(let i=0;i<dockW;i++){const v=tile(dockX+i,dockY+j);t.passability[v]={up:true,down:true,left:true,right:true};t.priority[v]='lower';t.tileMeta[v].passage='passable';}
for(let j=0;j<6;j++)for(let i=0;i<12;i++)put(98+i,50+j,dockX+(i===0?0:i===11?5:1+(i-1)%4),dockY+j,true);
stamp('boatLeft',106,45);stamp('boatRight',106,57);stamp('sacks',93,47);stamp('firewood',95,58);
// Small kitchen beds occupy the eastern margin, not a second grand square.
const [soilX,soilY]=atlas.parts.soil.rect;
for(let y=72;y<86;y++)for(let x=94;x<102;x++)put(x,y,soilX+x%2,soilY+y%2);
for(const x of [94,98])for(const y of [72,78])stamp('corn',x,y);
// Northern rock shelf and two narrow falls feed the broad river.
const cliff=atlas.parts.cliff.rect;
for(let x=106;x<144;x+=2)for(let j=0;j<4;j++)for(let i=0;i<2;i++)put(x+i,14+j,cliff[0]+i,cliff[1]+j,true);
for(const x of [114,134]){for(let y=0;y<14;y++)for(let i=0;i<2;i++)put(x+i,y,i,24+y%2);for(let y=0;y<6;y++)for(let i=0;i<2;i++){m.upperTiles[at(x+i,14+y)]=-1;put(x+i,14+y,12+i,26+y);}}
stamp('boulders',122,4);stamp('bush',107,5);stamp('autumn-tree',138,4);
// Outside the walls: smaller lodge, staggered groves and short paths.
building('성 밖 작은 관리소',28,130,14,6,5);stamp('door',34,137);stamp('firewood',43,136);
for(const [x,y] of [[0,13],[2,41],[0,81],[3,107],[18,128],[96,100],[94,119],[146,30],[148,78],[142,117]])stamp('tree',x,y);
for(const [x,y] of [[1,0],[29,3],[67,2],[95,27],[149,56],[142,99],[72,132]])stamp('autumn-tree',x,y);
for(const [x,y] of [[3,28],[4,60],[0,69],[4,99],[4,128],[30,4],[40,5],[76,4],[97,36],[95,91],[92,133],[146,24],[151,46],[149,70],[143,93],[145,136],[64,131]])stamp('bush',x,y);
for(const [x,y] of [[2,34],[0,58],[3,74],[33,5],[43,3],[73,5],[99,39],[96,88],[90,132],[150,22],[147,51],[152,73],[146,107],[149,138]])stamp('small-tree',x,y);
for(const [x,y] of [[9,26],[9,73],[99,37],[101,64],[105,88],[105,108],[103,132],[145,39],[143,65],[140,115]])stamp('reeds',x,y);
for(const [x,y] of [[45,130],[61,129],[29,107],[82,107],[36,42],[66,46],[93,54]])stamp('lamp',x,y);
for(const [x,y] of [[31,6],[36,4],[39,8],[70,4],[74,7],[35,35],[68,35],[79,43],[3,30],[3,61],[5,64],[149,26],[148,29],[144,97],[146,99],[65,133],[67,134]])stamp('small-tree',x,y);
stamp('bench',30,101);stamp('bench',74,102);stamp('sacks',73,110);stamp('stela',40,105);
function npc(id:string,name:string,x:number,y:number,index:number,body:string){m.events.push({id,name,x,y,placementRole:'npc',trigger:{kind:'action'},commands:[],pages:[{id:id+'-page',name,conditions:[],graphic:{sprite:{type:'bundled',id:'tex_easyrpg_charset_people1'},direction:'down',pattern:charsetFrameIndex({characterIndex:index,direction:'down',pattern:1})},trigger:{kind:'action'},priority:'same',overlapForbidden:true,movement:{type:'fixed',speed:3,frequency:3},commands:[{kind:'text',speaker:name,body}]}]});}
npc('city-greeter','남문 안내인',59,132,0,'어서 오세요. 서쪽 성벽 안쪽 길을 따라가면 본성 뒤뜰로 이어집니다.');
npc('city-merchant','뒤뜰 상인',40,44,1,'나루에서 들어온 곡물이에요. 고목 그늘 아래서 쉬어 가세요.');
npc('city-recruit','성채 경비병',62,105,2,'본성 정문은 닫혀 있어요. 뒤뜰은 서쪽 길로 돌아가세요.');
npc('city-harbor','나루 관리인',96,54,5,'작은 나룻배 두 척으로 강 건너 마을과 오갑니다. 지금은 정박 중이에요.');
npc('city-courtier','뒤뜰 안내인',61,38,3,'북쪽은 후문 회랑이고, 남쪽 큰 건물이 본성이에요.');
npc('city-gardener','정원 관리인',80,58,4,'텃밭은 동쪽 성벽 바깥에 있어요. 나룻길로 나가면 보입니다.');
for(const d of [['keep','넓은 본성과 앞뜰',28,62,60,52],['courtyard','고목 뒤뜰',32,34,50,28],['harbor','두 척의 배와 작은 나루',94,44,20,18],['river','동쪽 큰 강',108,20,34,124]]){const [id,name,x,y,w,h]=d;districts.push({id,name,x,y,w,h,tags:['참고 구도 수정']});}m.locations=districts;
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
const stops=[{id:'south-gate',x:54,y:110},{id:'training',x:62,y:106,npc:'city-recruit'},
{id:'market',x:40,y:45,npc:'city-merchant'},{id:'royal-square',x:61,y:39,npc:'city-courtier'},
{id:'garden',x:80,y:59,npc:'city-gardener'},{id:'harbor',x:96,y:55,npc:'city-harbor'},
{id:'pier',x:109,y:52}];
let pos=p.startPos;const routes=stops.map(s=>{const moves=route(pos,s);pos=s;return {...s,moves};});
for(const e of m.events)route(p.startPos,{x:e.x,y:e.y+1});
assert(!canMove(p,m,109,52,110,52),'Pier must end before water');
assert(!canMove(p,m,54,98,54,97),'Keep closed doorway');
assert.deepEqual(p.maps['castle-study'],original.maps['castle-study']);
assert.deepEqual(p.tilesets[original.maps['castle-study'].tilesetId],original.tilesets[original.maps['castle-study'].tilesetId]);
fs.writeFileSync(out+'/project.json',JSON.stringify(p));
fs.writeFileSync(out+'/assembly-proof.json',JSON.stringify({mapId:m.id,size:[W,H],placements,districts,routes,oldMapUnchanged:true,pierEndsAtWater:true},null,2));
console.log(JSON.stringify({size:[W,H],placements:placements.length,npcs:m.events.length,routes:routes.map(r=>({id:r.id,steps:r.moves.length})),oldMapUnchanged:true}));
