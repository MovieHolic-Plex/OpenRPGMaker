// Compact single-sheet scenes. Source PNG is supplied by the user at import time.
export function addPawCivicScenes(packs){
 for(const pack of packs){
  const library=pack.id==='paw-library';if(!library&&pack.id!=='paw-office')continue;
  const width=library?12:10,height=library?10:9,lowerTiles=Array(width*height).fill(pack.floorTile),upperTiles=Array(width*height).fill(-1),placements=[],approachCells=[{x:library?5:4,y:height-1}];
  const wall=library?[17,25,33]:[17,25];
  wall.forEach((tile,y)=>{for(let x=0;x<width;x++)lowerTiles[y*width+x]=tile;});
  function place(recipeId,x,y){
   const recipe=pack.recipes.find(r=>r.id===recipeId);if(!recipe)throw Error(recipeId);
   recipe.tiles.forEach((row,dy)=>row.forEach((tile,dx)=>{const i=(y+dy)*width+x+dx;if(x+dx>=width||y+dy>=height||upperTiles[i]!==-1)throw Error('Civic scene overlap');upperTiles[i]=tile;}));
   placements.push({recipeId,x,y});approachCells.push({x:x+Math.floor(recipe.sourceRect.width/2),y:recipe.facing==='north'?y-1:y+recipe.sourceRect.height});
  }
  if(library){place('bookcase',0,1);place('bookcase',4,1);place('bookcase',8,1);place('magazines',1,5);place('low-books',7,5);place('sofa-back',7,8);}
  else{place('bookcase',6,0);place('desk-white',1,3);place('desk-wood',6,4);approachCells.splice(2,2);place('chair-blue',2,6);place('chair-blue',7,7);}
  const walk=i=>upperTiles[i]===-1&&lowerTiles[i]===pack.floorTile;
  const start=(height-1)*width+(library?5:4),queue=[start],seen=new Set(queue);
  for(let i=0;i<queue.length;i++){const x=queue[i]%width,y=Math.floor(queue[i]/width);for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(nx<0||ny<0||nx>=width||ny>=height)continue;const n=ny*width+nx;if(!seen.has(n)&&walk(n)){seen.add(n);queue.push(n);}}}
  if(approachCells.some(p=>!seen.has(p.y*width+p.x)))throw Error('Civic approach unreachable');
  pack.scenes=[{id:library?'library-compact':'office-compact',name:library?'동네 도서관 · 서가와 독서석':'작은 사무실 · 업무실',width,height,lowerTiles,upperTiles,placements,approachCells,lowerTileIds:[pack.floorTile,...wall],passableTiles:[pack.floorTile],notes:`${width}×${height} 컴팩트 시설. 남쪽 입구 (${library?5:4},${height-1}), 시작 (${library?5:4},${height-2}). 전체 lower→upper 순서로 배치. 가구 앞 1칸과 중앙 통로를 유지. 천장 테두리는 별도 XP 원본으로 방 바깥에 추가할 수 있다. 문 이동은 시설 연결 단계에서 만든다.`}];
 }
 return packs;
}
