/** Reproducible original-atlas study; no screenshot tiles or remote mutation. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createBlankProject } from '../src/project/defaults/blankProject';
import { createBlankMap } from '../src/project/defaults/defaultMaps';
import { createCastleTileset } from '../src/project/defaults/castleTileset';
import { CASTLE_MEASURED_PARTS } from '../src/project/defaults/castleMeasuredParts';
import { canMove } from '../src/project/collision';
import { charsetFrameIndex } from '../src/assets/easyrpgRtp';
const out='output/castle-study'; fs.mkdirSync(out,{recursive:true});
const p=createBlankProject(), t=createCastleTileset();
const m=createBlankMap('시계나무 성관 · 조립 학습',48,40,t.id,16); m.id='castle-study';
p.meta.title='시계나무 성관 · 타일 조립 학습';
p.maps={[m.id]:m};p.mapTree={mapId:m.id,children:[]};p.startMapId=m.id;p.startPos={x:22,y:34};
p.tilesets={[t.id]:t};
const asset='castle-study-original';
p.assets.uploaded[asset]={id:asset,name:'Castle2 · 원본 (CC BY 3.0)',kind:'chipset',dataUrl:'data:image/png;base64,'+fs.readFileSync('public/assets/opengameart-castle-tiles.png').toString('base64'),meta:{width:512,height:512,tileSize:16}};
t.image={type:'uploaded',id:asset};
p.resourceProfiles=p.resourceProfiles.filter(v=>v.kind!=='chipset');
p.resourceProfiles.push({kind:'chipset',name:'Castle2 원본',assetId:asset,tileWidth:16,tileHeight:16,imageWidth:512,imageHeight:512});
const placements:any[]=[];
function set(x:number,y:number,sx:number,sy:number,upper=false){assert(x>=0&&y>=0&&x<48&&y<40);(upper?m.upperTiles:m.lowerTiles)[y*48+x]=sy*32+sx;}
function fill(x:number,y:number,w:number,h:number,sx:number,sy:number){for(let j=0;j<h;j++)for(let i=0;i<w;i++)set(x+i,y+j,sx+i%2,sy+j%2);}
function stamp(id:string,x:number,y:number,w?:number,h?:number){
 const part=CASTLE_MEASURED_PARTS.find(v=>v.id===id)!;assert(part);const [sx,sy,sw,sh]=part.rect;w??=sw;h??=sh;
 const stretch=id==='paving'||id==='roof';assert(stretch||(w===sw&&h===sh));assert(!stretch||(w>=4&&h>=4));
 placements.push({id,x,y,w,h});
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
  if(id==='clock-tree'&&i>=4&&j<2)continue;
  const u=stretch?(i<2?i:i>=w-2?sw-(w-i):2+(i-2)%2):i;
  const v=stretch?(j<2?j:j>=h-2?sh-(h-j):2+(j-2)%2):j;
  set(x+i,y+j,sx+u,sy+v,part.layer==='upper');
 }
}
fill(0,0,48,40,0,22);
// A straight eastern bank; this study does not claim concave shoreline grammar.
fill(44,0,4,40,0,24);
for(let y=0;y<40;y++)for(let x=0;x<2;x++)set(42+x,y,4+x,28+y%2);
stamp('paving',6,19,26,16);stamp('paving',20,33,6,7);
stamp('roof',8,4,24,8);
for(let y=0;y<6;y++)for(let x=0;x<24;x++)set(8+x,12+y,x%2,y===0?6:y===5?10:8+(y-1)%2,true);
// Gate shadow behind a complete closed entrance graphic.
for(let j=0;j<6;j++)for(let i=0;i<6;i++)set(20+i,12+j,28+i%2,j<3?14:12+j);
stamp('gate',20,12);stamp('banner',12,12);stamp('banner',28,12);
stamp('roof',4,7,6,6);
for(let j=0;j<7;j++)for(let i=0;i<6;i++)set(4+i,13+j,i%2,j===0?6:j===6?10:8+(j-1)%2,true);
stamp('door',6,15);
stamp('market',7,23);stamp('market',7,29);
stamp('fountain',19,23);stamp('clock-tree',34,19);
stamp('statue',34,7);stamp('bench',35,29);stamp('well',35,33);
stamp('lamp',15,18);stamp('lamp',29,27);
function npc(id:string,name:string,x:number,y:number,index:number,body:string){m.events.push({id,name,x,y,placementRole:'npc',trigger:{kind:'action'},commands:[],pages:[{id:id+'-page',name,conditions:[],graphic:{sprite:{type:'bundled',id:'tex_easyrpg_charset_people1'},direction:'down',pattern:charsetFrameIndex({characterIndex:index,direction:'down',pattern:1})},trigger:{kind:'action'},priority:'same',overlapForbidden:true,movement:{type:'fixed',speed:3,frequency:3},commands:[{kind:'text',speaker:name,body}]}]});}
npc('study-merchant','장터 상인',12,28,1,'분수 왼쪽이 장터예요. 성문은 지금 닫혀 있어요.');
npc('study-gardener','정원 손님',33,28,3,'시계나무 그늘에서 쉬었다 가세요. 강가에서는 발밑을 조심하시고요.');
// Engine collision + occupied event cells, not merely tile labels.
const occupied=new Set(m.events.map(e=>`${e.x},${e.y}`));
function route(from:{x:number,y:number},to:{x:number,y:number}){
 const q=[{...from,moves:[] as any[]}],seen=new Set([`${from.x},${from.y}`]);
 for(let n=0;n<q.length;n++){const a=q[n];if(a.x===to.x&&a.y===to.y)return a.moves;
 for(const [dir,dx,dy] of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]] as const){const x=a.x+dx,y=a.y+dy,k=`${x},${y}`;if(seen.has(k)||occupied.has(k)||!canMove(p,m,a.x,a.y,x,y))continue;seen.add(k);q.push({x,y,moves:[...a.moves,{kind:'move',dir}]});}}
 throw Error(`Unreachable ${JSON.stringify(to)}`);
}
const stops=[{id:'merchant',x:12,y:29},{id:'gardener',x:33,y:29},{id:'gate',x:22,y:18}];let pos=p.startPos;
const routes=stops.map(stop=>{const moves=route(pos,stop);pos=stop;return {...stop,moves};});
assert(!canMove(p,m,22,18,22,17),'Gate must remain closed');
assert(!canMove(p,m,43,30,44,30),'Water must block');
fs.writeFileSync(out+'/project.json',JSON.stringify(p));fs.writeFileSync(out+'/assembly-proof.json',JSON.stringify({mapId:m.id,placements,routes,closedGate:true,waterBlocked:true},null,2));
console.log(JSON.stringify({map:m.id,size:[48,40],parts:placements.length,routes:routes.map(r=>({id:r.id,steps:r.moves.length}))}));
