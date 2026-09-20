import fs from 'node:fs';
import assert from 'node:assert/strict';
import { trunkPlan } from './complex-forest-plan.mjs';

const out='output/evidence/canyon-natural',p=JSON.parse(fs.readFileSync(`${out}/local-before.json`));
const source=p.maps.map_high_cliff_village,ts=p.tilesets[source.tilesetId],w=80,h=72,idx=(x,y)=>y*w+x;
const m={id:'map_cliff_forest_bridge',name:'솔바람 협곡 · 숲 위 나무다리',width:w,height:h,tileSize:16,tilesetId:ts.id,lowerTiles:Array(w*h).fill(240),upperTiles:Array(w*h).fill(-1),events:[]};
const plateau=Array(w*h).fill(false),body=Array(w*h).fill(false),cliffs=[];
function line(keys,x){for(let j=1;j<keys.length;j++){const[a,ay]=keys[j-1],[b,by]=keys[j];if(x>=a&&x<=b)return Math.round(ay+(by-ay)*(x-a)/(b-a));}throw Error('Outside contour');}
function land(name,back,front,height){const left=back[0][0],right=back.at(-1)[0];
 for(let x=left;x<=right;x++){
  const rear=line(back,x),lip=line(front,x),slope=x<right?Math.sign(line(front,x+1)-lip):0,top=lip+(slope>0?1:0),foot=lip+height+(slope>0?1:0);
  for(let y=rear;y<=foot;y++)body[idx(x,y)]=true;
  for(let y=rear;y<=lip;y++)plateau[idx(x,y)]=true;
  const l=x>left?line(back,x-1):rear+1,r=x<right?line(back,x+1):rear+1;
  m.upperTiles[idx(x,rear)]=l>rear?504:r>rear?505:559;
  if(x===left||x===right)for(let y=rear+1;y<top;y++)m.upperTiles[idx(x,y)]=x===left?588:590;
  for(let y=top;y<=foot;y++){
   const tile=y===top?(slope>0?498:slope<0?499:x===left?618:x===right?620:619):y===foot?(slope>0?528:slope<0?529:x===left?681:x===right?683:682):(slope>0?711:slope<0?712:x===left?651:x===right?653:652);
   m.upperTiles[idx(x,y)]=tile;cliffs.push({x,y,tile,plateau:name});
  }
 }
}
// Contour-first authoring inspired by Huftier et al. 2026; multiscale
// detail inspired by Schott et al. 2024. This is a discrete tile adaptation,
// not the papers' Eden growth or hydraulic erosion implementations.
function contour(keys,phase){
 const result=[];
 for(let x=keys[0][0];x<=keys.at(-1)[0];x++){
  let j=1;while(j<keys.length-1&&x>keys[j][0])j++;
  const[a,ay]=keys[j-1],[b,by]=keys[j],t=(x-a)/(b-a);
  const smooth=t*t*(3-2*t),u=(x-keys[0][0])/(keys.at(-1)[0]-keys[0][0]);
  const detail=.55*Math.sin(x*.87+phase)*Math.sin(Math.PI*u)**2;
  result.push([x,Math.round(ay+(by-ay)*smooth+detail)]);
 }
 // Exact tile grammar: neighboring top contours may differ at most one row.
 for(let i=1;i<result.length;i++)result[i][1]=Math.max(result[i-1][1]-1,Math.min(result[i-1][1]+1,result[i][1]));
 result.at(-1)[1]=keys.at(-1)[1];
 for(let i=result.length-2;i>=0;i--)result[i][1]=Math.max(result[i+1][1]-1,Math.min(result[i+1][1]+1,result[i][1]));
 return result;
}
const westFront=contour([[4,24],[11,30],[15,31],[21,37],[25,36],[28,33]],.4);
const eastFront=contour([[51,33],[56,36],[60,37],[64,35],[69,34],[73,30],[76,27]],1.6);
land('west',[[4,17],[10,11],[18,11],[24,17],[28,21]],westFront,14);
land('east',[[51,20],[57,14],[66,14],[76,24]],eastFront,14);
fs.writeFileSync(`${out}/contours.json`,JSON.stringify({westFront,eastFront},null,2));
// The only plateau-to-plateau crossing. A solid lower chasm backs the deck;
// its original wooden pixels are drawn on upper, so removing it removes passage.
const deck=[],rails=[];
for(let y=28;y<=30;y++)for(let x=27;x<=52;x++){
 if(x>=29&&x<=50)m.lowerTiles[idx(x,y)]=430;
 m.upperTiles[idx(x,y)]=x===27?171:x===52?173:172;deck.push({x,y,tile:m.upperTiles[idx(x,y)]});
}
for(let x=29;x<=50;x++){
 m.upperTiles[idx(x,27)]=379;rails.push({x,y:27,tile:379});
 m.upperTiles[idx(x,31)]=x===29?468:x===50?470:469;rails.push({x,y:31,tile:m.upperTiles[idx(x,31)]});
}
for(let y=22;y<=23;y++)for(let x=0;x<=4;x++)m.upperTiles[idx(x,y)]=-1;
for(let y=25;y<=26;y++)for(let x=76;x<w;x++)m.upperTiles[idx(x,y)]=-1;
// The short edge approaches are fenced off from the lower forest plane.
for(const[a,b,north,south]of[[0,3,21,24],[77,79,24,27]])for(let x=a;x<=b;x++)for(const y of[north,south]){m.upperTiles[idx(x,y)]=379;rails.push({x,y,tile:379});}
const forest=Array(w*h).fill(false);
const reserved=(x,y)=>(x<=6&&y>=20&&y<=26)||(x>=74&&y>=23&&y<=28)||(x>=26&&x<=53&&y>=26&&y<=34);
for(let by=0;by<h;by+=3)for(let bx=0;bx<w;bx+=2){
 let near=false;
 for(let y=Math.max(0,by-2);y<=Math.min(h-1,by+4);y++)for(let x=Math.max(0,bx-2);x<=Math.min(w-1,bx+3);x++)if(body[idx(x,y)]||reserved(x,y))near=true;
 const glade=((bx+1-40)/8)**2+((by+1.5-61)/4.8)**2<1;
 if(!near&&!glade)for(let y=by;y<Math.min(h,by+3);y++)for(let x=bx;x<Math.min(w,bx+2);x++)forest[idx(x,y)]=true;
}
// A crown of forest rises directly under the elevated bridge, then merges
// into the large lower canopy. Keep the full cliff faces visible on either side.
for(let y=32;y<=50;y++){
 const left=y<35?34:y<38?32:30,right=79-left;
 for(let x=left;x<=right;x++)if(!body[idx(x,y)]&&m.upperTiles[idx(x,y)]===-1)forest[idx(x,y)]=true;
}
let trunks,repairs=0;
for(;repairs<100;repairs++){
 trunks=trunkPlan(forest,w,h,p.maps.map_forest_cabin_autotile);if(trunks.ok)break;
 const r=trunks.run;for(let y=Math.max(0,r.y-2);y<=r.y;y++)for(let x=r.x;x<r.x+(r.width===6?2:r.width);x++)forest[idx(x,y)]=false;
}
assert.ok(trunks.ok);
for(const c of trunks.edits){const i=idx(c.x,c.y);assert.equal(m.upperTiles[i],-1,`Root intersects structure ${c.x},${c.y}`);m.lowerTiles[i]=c.tile;}
for(let i=0;i<w*h;i++)if(forest[i]){assert.equal(m.upperTiles[i],-1);m.upperTiles[i]=1617;}
const houses=[];
for(const[id,x,y,label]of[['north_home',12,14,'서쪽 숲길지기 집'],['east_home',61,18,'동쪽 협곡 쉼터']]){
 const r=source.layoutPlan.regions.find(r=>r.id===id),dx=x-r.x,dy=y-r.y;
 for(let yy=0;yy<r.h;yy++)for(let xx=0;xx<r.w;xx++){
  const i=idx(x+xx,y+yy),s=(r.y+yy)*source.width+r.x+xx;assert.ok(plateau[i]&&!forest[i]&&m.upperTiles[i]===-1&&m.lowerTiles[i]===240);
  m.lowerTiles[i]=source.lowerTiles[s];m.upperTiles[i]=source.upperTiles[s];
 }
 houses.push({...r,x,y,label,front:{x:r.front.x+dx,y:r.front.y+dy},...(r.doorAt?{doorAt:{x:r.doorAt.x+dx,y:r.doorAt.y+dy}}:{})});
}
m.layoutPlan={regions:houses,notes:'높이 14칸의 두 절벽. 26×3 목재 상판과 북쪽 난간·남쪽 받침으로 만든 단 하나의 다리. 아래 협곡은 연속 수관과 숲속 빈터. 서쪽 입구와 동쪽 출구를 다리로 연결.'};
const result={map:m,forest,trunks,plateau,body,cliffs,deck,rails,houses,entry:[0,22],exit:[79,25],routes:[[[0,22],[14,22]],[[14,22],[20,26]],[[20,26],[27,29]],[[27,29],[52,29]],[[52,29],[58,29]],[[58,29],[62,24]],[[62,24],[71,25]],[[71,25],[79,25]]],height:14,repairs};
fs.writeFileSync(`${out}/plan.json`,JSON.stringify(result));console.log(JSON.stringify({mapId:m.id,forestCells:forest.filter(Boolean).length,trunkRuns:trunks.placements.length,repairs,deck:deck.length,houses:houses.length}));
