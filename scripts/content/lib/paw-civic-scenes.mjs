// Compact single-sheet scenes. Source PNG is supplied by the user at import time.
export function addPawCivicScenes(packs){
 for(const pack of packs){
  const library=pack.id==='paw-library';if(!library&&pack.id!=='paw-office')continue;
  const width=10,height=library?8:9,lowerTiles=Array(width*height).fill(pack.floorTile),upperTiles=Array(width*height).fill(-1),placements=[],approachCells=[{x:library?5:4,y:height-1}];
  const wall=library?[17,25,33]:[17,25];
  wall.forEach((tile,y)=>{for(let x=0;x<width;x++)lowerTiles[y*width+x]=tile;});
  function place(recipeId,x,y,approach){
   const recipe=pack.recipes.find(r=>r.id===recipeId);if(!recipe)throw Error(recipeId);
   recipe.tiles.forEach((row,dy)=>row.forEach((tile,dx)=>{const i=(y+dy)*width+x+dx;if(x+dx>=width||y+dy>=height||upperTiles[i]!==-1)throw Error('Civic scene overlap');upperTiles[i]=tile;}));
   placements.push({recipeId,x,y});approachCells.push(approach??{x:x+Math.floor(recipe.sourceRect.width/2),y:recipe.facing==='north'?y-1:y+recipe.sourceRect.height});
  }
  if(library){place('bookcase',0,1);place('bookcase',3,1);place('loan-counter',1,5);place('librarian-chair',2,4,{x:1,y:4});place('reading-table',6,3,{x:9,y:4});place('reading-chair-back',6,6,{x:7,y:6});place('reading-chair-back',8,6,{x:7,y:6});}
  else{place('bookcase',6,0);place('desk-white',1,3);place('desk-wood',6,4);approachCells.splice(2,2);place('chair-blue-back',2,6,{x:1,y:6});place('chair-blue-back',7,7,{x:8,y:7});}
  const walk=i=>upperTiles[i]===-1&&lowerTiles[i]===pack.floorTile;
  const start=(height-1)*width+(library?5:4),queue=[start],seen=new Set(queue);
  for(let i=0;i<queue.length;i++){const x=queue[i]%width,y=Math.floor(queue[i]/width);for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(nx<0||ny<0||nx>=width||ny>=height)continue;const n=ny*width+nx;if(!seen.has(n)&&walk(n)){seen.add(n);queue.push(n);}}}
  if(approachCells.some(p=>!seen.has(p.y*width+p.x)))throw Error('Civic approach unreachable');
  pack.scenes=[{id:library?'library-compact':'office-compact',name:library?'동네 도서관 · 대출대와 독서석':'작은 사무실 · 업무실',width,height,lowerTiles,upperTiles,placements,approachCells,lowerTileIds:[pack.floorTile,...wall],passableTiles:[pack.floorTile],notes:`${width}×${height} 컴팩트 시설. 남쪽 입구 (${library?5:4},${height-1}), 시작 (${library?5:4},${height-2}). 전체 lower→upper 순서로 배치. 북향 의자는 북쪽 책상을 바라보며 좌우 접근칸을 비운다. 도서관 대출대 북쪽은 직원 자리, 남쪽은 방문객 자리다. 서가 앞 1칸과 중앙 2칸 통로를 유지. 천장 테두리는 별도 XP 원본으로 방 바깥에 추가할 수 있다. 문 이동은 시설 연결 단계에서 만든다.`}];
 }
 return packs;
}
