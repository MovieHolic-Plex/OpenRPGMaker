import fs from 'node:fs';import assert from'node:assert/strict';import{trunkPlan}from'./complex-forest-plan.mjs';
const out='output/evidence/village-ten',p=JSON.parse(fs.readFileSync(out+'/local-before.json')),source=p.maps.map_high_cliff_village,ts=p.tilesets.forest_high_cliff_river,w=80,h=72,idx=(x,y)=>y*w+x;
const specs=[
 {slug:'spring-ring',name:'샘고리 마을',theme:'중앙 샘을 두르는 고리 길',homes:[[24,16],[44,16],[54,33],[36,48],[15,36]],clear:[[38,34,24,24]],ponds:[[38,34,5,4]],entry:[8,71],exit:[68,0],ring:true},
 {slug:'crescent-lake',name:'달물 호반마을',theme:'호수 서쪽과 남쪽을 감싸는 초승달 취락',homes:[[18,13],[11,31],[21,49],[42,52],[59,43]],clear:[[24,31,16,24],[40,55,27,10],[58,40,12,16]],ponds:[[46,29,15,12]],entry:[40,71],exit:[10,0]},
 {slug:'fork-stream',name:'두갈래 물길마을',theme:'갈라지는 시냇물과 다리',homes:[[13,15],[57,10],[22,41],[58,49],[11,52]],clear:[[23,27,17,18],[59,22,14,16],[40,49,27,17]],streams:[[[[40,0],[38,30],[42,49],[38,71]],2],[[[38,35],[54,26],[70,14]],2]],bridges:[{x:32,y:30,w:15,h:3}],entry:[20,71],exit:[65,0]},
 {slug:'twin-banks',name:'나루 사이 두마을',theme:'강 양쪽의 두 취락을 하나의 다리로 연결',homes:[[13,18],[22,38],[51,17],[60,38]],clear:[[21,33,15,21],[60,32,15,21]],streams:[[[[40,0],[40,71]],3]],bridges:[{x:34,y:32,w:13,h:3}],entry:[0,48],exit:[79,23]},
 {slug:'terrace-gardens',name:'층층 정원마을',theme:'높이가 다른 두 언덕과 아래쪽 마당',homes:[[16,17],[49,27],[31,49],[13,47],[58,53]],clear:[[22,23,15,15],[55,35,17,18],[37,54,30,12]],terraces:[{left:9,right:31,back:12,lip:29,height:3,stair:24},{left:43,right:69,back:22,lip:42,height:5,stair:57}],entry:[38,71],exit:[0,39]},
 {slug:'high-meadow',name:'바람등성이 마을',theme:'대각 절벽 위의 고원과 강 건너 진입로',homes:[[22,18],[36,17],[50,22],[31,32]],clear:[[39,30,26,19],[39,54,23,6]],mountain:true,streams:[[[[5,60],[30,60],[50,59],[76,60]],2]],bridges:[{x:38,y:56,w:3,h:9}],entry:[39,71],exit:[6,53]},
 {slug:'woodland-lane',name:'긴숲 오솔마을',theme:'대각으로 굽어 내려가는 한 줄기 오솔길',homes:[[11,11],[22,24],[35,36],[48,44],[60,53]],ponds:[[48,17,6,4],[13,52,5,4]],entry:[8,0],exit:[72,71]},
 {slug:'orchard-court',name:'열매뜰 마을',theme:'과수원 둘레를 도는 마당과 생활 공간',homes:[[14,15],[49,15],[15,46],[51,45]],clear:[[37,35,28,25]],orchard:true,entry:[4,34],exit:[76,35],ring:true},
 {slug:'fishing-cove',name:'잔물결 어촌',theme:'호숫가 작업터와 짧은 나무 선착장',homes:[[12,15],[28,12],[45,17],[14,40],[34,45]],clear:[[28,31,23,24],[46,36,11,15]],ponds:[[64,45,13,19]],bridges:[{x:48,y:39,w:13,h:3}],entry:[21,71],exit:[7,0],ring:true},
 {slug:'five-groves',name:'다섯숲 숨은마을',theme:'큰 숲 덩어리 주위로 이어지는 다섯 빈터',homes:[[15,10],[49,12],[57,34],[32,52],[8,39]],ponds:[[35,24,4,3]],entry:[0,56],exit:[74,8],ring:true}
];
function distance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
function line(keys,x){for(let j=1;j<keys.length;j++){const[a,ay]=keys[j-1],[b,by]=keys[j];if(x>=a&&x<=b)return Math.round(ay+(by-ay)*(x-a)/(b-a));}return null;}
const plans=[];
for(const [n,s]of specs.entries()){
 const m={id:`map_village_ten_${s.slug.replaceAll('-','_')}`,name:`${String(n+1).padStart(2,'0')} · ${s.name}`,width:w,height:h,tileSize:16,tilesetId:ts.id,lowerTiles:Array(w*h).fill(240),upperTiles:Array(w*h).fill(-1),events:[]};
 const body=Array(w*h).fill(false),plateau=Array(w*h).fill(false),stairs=[],cliffs=[],bridges=[],houses=[],water=[];
 function cliff(back,front,height,stair){const left=back[0][0],right=back.at(-1)[0];for(let x=left;x<=right;x++){
  const rear=line(back,x),lip=line(front,x),slope=x<right?Math.sign(line(front,x+1)-lip):0,top=lip+(slope>0?1:0),foot=lip+height+(slope>0?1:0);for(let y=rear;y<=foot;y++)body[idx(x,y)]=true;for(let y=rear;y<top;y++)plateau[idx(x,y)]=true;
  const l=x>left?line(back,x-1):rear+1,r=x<right?line(back,x+1):rear+1;m.upperTiles[idx(x,rear)]=l>rear?504:r>rear?505:559;
  if(x===left||x===right)for(let y=rear+1;y<top;y++)m.upperTiles[idx(x,y)]=x===left?588:590;
  for(let y=top;y<=foot;y++){const tile=y===top?(slope>0?498:slope<0?499:x===left?618:x===right?620:619):y===foot?(slope>0?528:slope<0?529:x===left?681:x===right?683:682):(slope>0?711:slope<0?712:x===left?651:x===right?653:652);m.upperTiles[idx(x,y)]=tile;cliffs.push({x,y,tile});}
 }const lip=line(front,stair);for(let x=stair;x<stair+3;x++)for(let y=lip;y<=lip+height;y++){m.upperTiles[idx(x,y)]=-1;m.lowerTiles[idx(x,y)]=854;stairs.push({x,y,tile:854});}}
 for(const t of s.terraces??[])cliff([[t.left,t.back+4],[t.left+4,t.back],[t.right-4,t.back],[t.right,t.back+4]],[[t.left,t.lip-4],[t.left+4,t.lip],[t.right-4,t.lip],[t.right,t.lip-4]],t.height,t.stair);
 if(s.mountain)cliff([[12,22],[22,12],[54,12],[66,24]],[[12,31],[23,42],[53,42],[66,29]],8,39);
 for(let j=0;j<s.homes.length;j++){const[x,y]=s.homes[j],ids=['north_home','village_cabin','east_home','south_home','west_home'],r=source.layoutPlan.regions.find(r=>r.id===ids[j%ids.length]),dx=x-r.x,dy=y-r.y;
  for(let yy=0;yy<r.h;yy++)for(let xx=0;xx<r.w;xx++){const i=idx(x+xx,y+yy),from=idx(r.x+xx,r.y+yy);assert.equal(m.upperTiles[i],-1,`House/cliff ${s.slug} ${x+xx},${y+yy}`);m.lowerTiles[i]=source.lowerTiles[from];m.upperTiles[i]=source.upperTiles[from];}
  houses.push({...r,id:`house_${j+1}`,x,y,label:`${s.name} ${j+1}번 집`,front:{x:r.front.x+dx,y:r.front.y+dy}});
 }
 const inHouse=(x,y,margin=0)=>houses.some(r=>x>=r.x-margin&&x<r.x+r.w+margin&&y>=r.y-margin&&y<r.y+r.h+margin);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const wet=(s.ponds??[]).some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1)||(s.streams??[]).some(([points,r])=>points.slice(1).some((b,k)=>distance(x,y,points[k],b)<=r));
  if(wet&&!inHouse(x,y,1)&&!body[idx(x,y)]&&m.upperTiles[idx(x,y)]===-1){m.lowerTiles[idx(x,y)]=1563;water.push({x,y});}
 }
 for(const b of s.bridges??[])for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++){assert.equal(m.upperTiles[idx(x,y)],-1);m.upperTiles[idx(x,y)]=x===b.x?171:x===b.x+b.w-1?173:172;bridges.push({x,y,tile:m.upperTiles[idx(x,y)]});}
 const anchors=houses.map(r=>[r.front.x,r.front.y]);
 const routes=[];for(let j=1;j<anchors.length;j++)routes.push([anchors[j-1],anchors[j]]);if(s.ring)routes.push([anchors.at(-1),anchors[0]]);
 const nearest=a=>anchors.reduce((best,b)=>Math.hypot(b[0]-a[0],b[1]-a[1])<Math.hypot(best[0]-a[0],best[1]-a[1])?b:best,anchors[0]);routes.push([s.entry,nearest(s.entry)],[s.exit,nearest(s.exit)]);
 // Explicit routes into each staircase and over each bridge are visible scene anchors.
 for(const b of s.bridges??[]){const a=[b.x,Math.floor(b.y+b.h/2)],z=[b.x+b.w-1,a[1]];if(b.h>b.w){a[0]=b.x+1;a[1]=b.y;z[0]=a[0];z[1]=b.y+b.h-1;}routes.push([a,z]);}
 const forest=Array(w*h).fill(false);
 for(let by=0;by<h;by+=3)for(let bx=0;bx<w;bx+=2){const x=bx+1,y=by+1.5;
  let open=(s.clear??[]).some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1)||houses.some(r=>((x-r.x-r.w/2)/9)**2+((y-r.y-r.h/2-1)/9)**2<1)||routes.some(([a,b])=>distance(x,y,a,b)<4.2);
  for(let yy=Math.max(0,by-3);!open&&yy<=Math.min(h-1,by+5);yy++)for(let xx=Math.max(0,bx-3);xx<=Math.min(w-1,bx+4);xx++)if(body[idx(xx,yy)]||m.lowerTiles[idx(xx,yy)]===1563||m.upperTiles[idx(xx,yy)]>=0||inHouse(xx,yy,1)){open=true;break;}
  if(!open)for(let yy=by;yy<Math.min(h,by+3);yy++)for(let xx=bx;xx<Math.min(w,bx+2);xx++)forest[idx(xx,yy)]=true;
 }
 let trunks,repairs=0;for(;repairs<300;repairs++){
  trunks=trunkPlan(forest,w,h,p.maps.map_forest_cabin_autotile);
  if(!trunks.ok){const r=trunks.run;for(let y=Math.max(0,r.y-2);y<=r.y;y++)for(let x=r.x;x<r.x+(r.width===6?2:r.width);x++)forest[idx(x,y)]=false;continue;}
  const bad=trunks.edits.find(c=>m.upperTiles[idx(c.x,c.y)]!==-1||m.lowerTiles[idx(c.x,c.y)]!==240||inHouse(c.x,c.y));if(!bad)break;
  for(let y=Math.max(0,bad.y-3);y<=bad.y;y++)for(let x=Math.max(0,bad.x-2);x<=Math.min(w-1,bad.x+2);x++)forest[idx(x,y)]=false;
 }
 assert.ok(trunks.ok&&repairs<300,s.slug+' trunk repair');for(const c of trunks.edits)m.lowerTiles[idx(c.x,c.y)]=c.tile;for(let i=0;i<w*h;i++)if(forest[i])m.upperTiles[i]=1617;
 m.layoutPlan={regions:houses,notes:s.theme};plans.push({spec:s,map:m,forest,trunks,stairs,cliffs,bridges,houses,water,routes,plateau,body,repairs});
 console.log(JSON.stringify({id:m.id,forest:forest.filter(Boolean).length,homes:houses.length,water:water.length,repairs}));
}
fs.writeFileSync(out+'/plans.json',JSON.stringify(plans));
