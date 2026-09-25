// Coordinate metadata only; source art is supplied by the user at import time.
import { writeFile } from 'node:fs/promises';
const base='https://yms.main.jp/dotartworld/';
const recipe=(id,name,x,y,width,height)=>({id,name,sourceRect:{x,y,width,height},facing:'south',tiles:Array.from({length:height},(_,dy)=>Array.from({length:width},(_,dx)=>(y+dy)*8+x+dx))});
const urban={
 id:'paw-urban-convenience',name:'Pixel Art World · 도시 상가',sourcePage:base+'page2/tile-conveni01.html',downloadUrl:base+'sozai/tileset/ST-Convi-E01.png',termsUrl:base+'page1/rule.html',credit:'Pixel Art World / ドット絵世界 — '+base,
 filename:'ST-Convi-E01.png',width:256,height:1728,tileSize:32,sha256:'52c0e10cf764d8de1e8c816f56ec1a1729ea9b7353297ed8c21640af6f2fccde',checkedAt:'2026-09-24',floorTile:4,
 notes:'도시 외관용. 유리·외벽·차양을 구분한다. 차양은 벽/유리 앞에 그리며, 같은 상위 칸의 투명 유리와 벽을 동시에 놓으려면 로컬 합성 또는 별도 레이어 전략이 필요하다. 거리 예제는 같은 원본의 불투명 전면 조각을 사용한다. 문 그림은 전이 이벤트가 아니다. 자동문/깃발/옥상 오토타일은 별도 원본이다.',
 recipes:[recipe('store-front','편의점 전면 유리',0,44,4,3),recipe('store-door','넓은 상점 출입구',4,47,2,3),recipe('vending-red','빨간 자판기',0,29,2,3),recipe('street-bench','거리 벤치',4,21,3,1),recipe('traffic-light','가로 신호등',0,24,3,4),recipe('small-window','건물 창문',3,38,3,2)],
};
const town={
 id:'paw-urban-residential',name:'Pixel Art World · 주택가 소품',sourcePage:base+'page2/tile-townE01.html',downloadUrl:base+'sozai/tileset/ST-Town-E01.png',termsUrl:base+'page1/rule.html',credit:'Pixel Art World / ドット絵世界 — '+base,
 filename:'ST-Town-E01.png',width:256,height:1600,tileSize:32,sha256:'d28c556e346a833c14caf3e4668bf1fcec67c7862bc7b63f9b2279207fe7a13e',checkedAt:'2026-09-24',floorTile:4,
 notes:'주택가 원본 중 창문·문·자전거·관목·어닝을 먼저 지원한다. 검토하지 않은 복합 기와지붕을 임의의 사각형으로 복사하지 않는다. 샘플의 개는 RTP이므로 이 지원에 포함하지 않는다. 아파트 차양은 앞쪽 레이어로 합성해야 한다.',
 recipes:[recipe('sliding-window','가로 미닫이 창',5,30,3,2),recipe('blue-window','파란 2칸 창',6,32,2,2),recipe('gray-door','회색 주택 문',4,32,1,2),recipe('bicycle','자전거',0,22,3,1),recipe('hedge','3칸 관목',0,17,3,2),recipe('striped-awning','줄무늬 어닝',0,30,3,2)],
};
function cityScene(){
 const width=28,height=27,lowerTiles=Array(width*height).fill(4),upperTiles=Array(width*height).fill(-1),approachCells=[];
 const tile=(x,y,sx,sy,lower=false)=>{if(x<0||y<0||x>=width||y>=height)throw Error('city bounds');(lower?lowerTiles:upperTiles)[y*width+x]=sy*8+sx;};
 const rect=(x,y,sx,sy,w,h)=>{for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)tile(x+dx,y+dy,sx+dx,sy+dy);};
 const fill=(x,y,w,h,sx,sy)=>{for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)tile(x+dx,y+dy,sx,sy);};
 const roof=(x,y,w,h)=>{for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++){tile(x+dx,y+dy,1,41,true);if(dx===0||dx===w-1||dy===0||dy===h-1)tile(x+dx,y+dy,dx===0?0:dx===w-1?2:1,40+(dy===0?0:dy===h-1?2:1));}};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if((y>=12&&y<=15)||(x>=13&&x<=16))tile(x,y,3,1,true);
 function shop(x,y,w,roofH){
  roof(x,y,w,roofH);const front=y+roofH;
  fill(x,front,w,4,1,36);
  for(let dx=1;dx<w-1;dx++)for(let dy=0;dy<3;dy++)tile(x+dx,front+1+dy,dx%2,44+dy);
  const door=x+Math.floor(w/2)-1;rect(door,front+1,4,47,2,3);
  for(let dx=0;dx<w;dx++)tile(x+dx,front,dx===2?2:0,43);
  approachCells.push({x:door,y:front+4},{x:door+1,y:front+4});
 }
 function apartments(x,y,w){
  roof(x,y,w,3);fill(x,y+3,w,6,1,32);
  for(const row of [y+3,y+6])for(let dx=1;dx<w-1;dx+=3)rect(x+dx,row,4,41,1,2);
  for(const row of [y+5,y+8])for(let dx=0;dx<w;dx++)tile(x+dx,row,1,33);
  rect(x+w-2,y+7,7,42,1,2);approachCells.push({x:x+w-2,y:y+9});
 }
 shop(1,1,10,4);apartments(18,1,9);shop(1,19,10,3);shop(18,19,9,3);
 // The source contains actual road/parking paint; preserve the original cells.
 for(const y of [12,13,14,15])for(const x of [9,10,11,18,19,20])tile(x,y,6,0);
 for(const x of [13,14,15,16])for(const y of [9,10,17,18])tile(x,y,6,1);
 rect(0,8,0,29,2,3);rect(18,10,4,21,3,1);rect(22,10,4,21,3,1);
 rect(10,8,0,24,3,4);rect(25,15,0,24,3,4);
 rect(1,16,0,16,3,2);rect(5,16,0,16,3,2);
 rect(23,16,0,16,3,2);
 const passableTiles=[4,11,6,14];
 // Entry thresholds are decorative and kept walkable in this example.
 for(const {x,y} of approachCells){if(y>=height)throw Error('approach bounds');if(upperTiles[y*width+x]>=0)throw Error('blocked approach');}
 const walkable=i=>passableTiles.includes(lowerTiles[i])&&(upperTiles[i]===-1||passableTiles.includes(upperTiles[i]));
 const queue=[approachCells[0].y*width+approachCells[0].x],seen=new Set(queue);
 for(let i=0;i<queue.length;i++){
  const x=queue[i]%width,y=Math.floor(queue[i]/width);
  for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
   if(nx<0||ny<0||nx>=width||ny>=height)continue;
   const n=ny*width+nx;if(!seen.has(n)&&walkable(n)){seen.add(n);queue.push(n);}
  }
 }
 if(approachCells.some(({x,y})=>!seen.has(y*width+x)))throw Error('unreachable city entrance');
 return {id:'urban-crossroads',name:'도시 사거리 · 상가와 공동주택',width,height,lowerTiles,upperTiles,approachCells,placements:[],passableTiles,lowerTileIds:[4,11,329],notes:'한 원본 ST-Convi-E01로 조립한 현대 거리. 상가 3동과 공동주택 1동, 교차로·보도·횡단 표시·벤치·자판기·관목. 옥상은 시트의 (0,40)~(2,42) 3×3 조각 중 중앙 타일329를 하위의 불투명 받침으로 채우고, 투명 모서리/가장자리만 상위에 놓았다. 테두리만 보도 위에 놓으면 보도가 지붕 안으로 비치는 오류가 난다. 별도 XP 옥상 파일은 이 예제의 필수 입력이 아니다. 출입구 그림에는 전이 이벤트가 없고 접근칸만 예약한다. 차량·신호 주기·NPC는 생성하지 않는다. 통행은 지면/노면표시만 통과, 건물과 가구는 보수적으로 차단. 폭4칸 도로와 보도를 건물로 덮지 않는다.'};
}
urban.scenes=[cityScene()];
const packs=[urban,town];
for(const pack of packs){const count=pack.width*pack.height/1024;for(const s of pack.scenes??[]){if(s.lowerTiles.length!==s.width*s.height||s.upperTiles.length!==s.width*s.height)throw Error('scene shape');for(const n of [...s.lowerTiles,...s.upperTiles])if(!Number.isInteger(n)||n< -1||n>=count)throw Error('scene tile bounds');}}
await writeFile(new URL('../../tiledata/pixel-art-world/urban.json',import.meta.url),JSON.stringify(packs,null,2)+'\n');
await writeFile(new URL('../../src/assets/pixelArtWorldUrbanCatalog.json',import.meta.url),JSON.stringify(packs,null,2)+'\n');
console.log('Prepared 2 urban source packs, 12 parts, 1 complete street example; no artwork.');
