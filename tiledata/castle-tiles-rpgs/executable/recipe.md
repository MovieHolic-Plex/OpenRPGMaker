# 그대로 실행하는 남향 숲 띠

대상 tilesetId=forest_harmony. 지면은 1145(통행 가능), 30열/16px입니다. 숲 영역은 완성 마감과 줄기·뿌리의 전체 사각형입니다.

조건: 높이=6, 폭=6*N+2, 정수 N=2..100. 최소 폭14. 맵 밖, 홀수 조각, 남향이 아닌 외곽, 출입구를 가리는 구역에는 적용하지 않습니다. 일반 다각형 숲 생성기는 아닙니다. 부적합한 폭은 오류로 반환하고 임의 자르기하지 않습니다.

## 왼쪽 마감 → 반복 몸통 → 오른쪽 마감
영역 원점(x,y), N=(width-2)/6.
1. forest:left(4×6)을 (x,y)에 온전히 놓습니다.
2. i=0..N-1에 forest:body(6×6)를 놓습니다. 첫 몸통은 원본 열3..5만, 마지막은 열0..2만, 중간은 열0..5를 씁니다. 목적지는 (x+1+6*i+fromColumn,y). 처음/마지막 3열은 완성 마감이 대신하므로 중복시키지 않습니다. 수직 6행은 언제나 전부 유지합니다.
3. forest:right(4×6)을 (x+width-4,y)에 온전히 놓습니다.

N=2, (3,2), 폭14 예제: 왼쪽 (3,2), 첫 몸통 원본3..5 → (7,2), 둘째 몸통 원본0..2 → (10,2), 오른쪽 (13,2). 전부 y=2..7입니다. 좌우 마감 방향을 교환하지 않습니다.

실행 함수는 src/project/tileAssemblyGuide.ts의 forestStripPlan/assembleTilePlan입니다. 다음 코드는 예제만 설명하는 의사코드가 아니라 실제 엔진 함수입니다.

~~~ts
import catalog from '@/assets/tileAssemblyCatalog.json';
import type { GameMap, Project } from './types';
import { canMove } from './collision';
import { topTileInStack } from './mapOverlayTiles';
export type AssemblyStamp = { partId: string; x: number; y: number; fromColumn?: number; columns?: number };
export type AssemblyPlan = { stamps: AssemblyStamp[]; entrances?: { x: number; y: number; fromX: number; fromY: number }[] };
export type AssemblyIssue = { code: string; x: number; y: number; layer?: string; expected?: number; actual?: number; partId?: string; message: string };
export function assemblyPart(id: string) {
  const part=catalog.parts.find(p=>p.id===id);if(!part)throw Error(`Unknown part: ${id}`);return part;
}
function integer(n: number) { if(!Number.isSafeInteger(n))throw Error('Coordinates must be integers'); }
/** A precise south-facing forest strip, not an arbitrary region/biome generator. */
export function forestStripPlan(x: number,y: number,width: number,height: number): AssemblyPlan {
  [x,y,width,height].forEach(integer);
  const repeats=(width-2)/6;
  if(height!==6||repeats<2||repeats>100||!Number.isInteger(repeats))throw Error('Forest strip requires height=6, width=6*N+2, N=2..100; never truncate roots/caps.');
  const stamps: AssemblyStamp[]=[{partId:'forest:left',x,y}];
  for(let i=0;i<repeats;i++){
    const first=i===0?3:0,last=i===repeats-1?3:6;
    stamps.push({partId:'forest:body',x:x+1+i*6+first,y,fromColumn:first,columns:last-first});
  }
  stamps.push({partId:'forest:right',x:x+width-4,y});return {stamps};
}
function expectedCells(tilesetId: string,plan: AssemblyPlan) {
  if(!Array.isArray(plan.stamps)||plan.stamps.length>1000)throw Error('stamps must contain at most 1000 parts');
  const cells=new Map<string,{x:number;y:number;layer:'lower'|'upper';tile:number;part:ReturnType<typeof assemblyPart>;dy:number}>();
  for(const s of plan.stamps){const p=assemblyPart(s.partId);[s.x,s.y].forEach(integer);if(p.tilesetId!==tilesetId)throw Error(`Tileset mismatch: ${p.id} requires ${p.tilesetId}`);
    const first=s.fromColumn??0,count=s.columns??p.width;[first,count].forEach(integer);
    if(first<0||count<1||first+count>p.width)throw Error('Source column range invalid');
    if((first!==0||count!==p.width)&&p.id!=='forest:body')throw Error('Only forest body may use the recipe column window; caps and objects must be whole');
    for(let dy=0;dy<p.height;dy++)for(let dx=0;dx<count;dx++)for(const layer of ['lower','upper'] as const){const tile=p[layer+'Tiles' as 'lowerTiles'|'upperTiles'][dy][first+dx];
      // Empty upper cells in mixed forest patches clear stale crowns; standalone prop masks are transparent.
      if(tile<0&&!(p.layer==='mixed'&&layer==='upper'))continue;
      const x=s.x+dx,y=s.y+dy;cells.set(`${layer}:${x},${y}`,{x,y,layer,tile,part:p,dy});}
  }return [...cells.values()];
}
/** Pure output. Never truncates a part at the map edge or mutates the input map. */
export function assembleTilePlan(map: GameMap,plan: AssemblyPlan): GameMap {
  const next=structuredClone(map);
  for(const c of expectedCells(map.tilesetId,plan)){
    if(c.x<0||c.y<0||c.x>=map.width||c.y>=map.height)throw Error(`Out of bounds at ${c.x},${c.y}`);
    const i=c.y*map.width+c.x;next[c.layer==='lower'?'lowerTiles':'upperTiles'][i]=c.tile;
    const stacks=next[c.layer==='lower'?'lowerTileStacks':'upperTileStacks'];if(stacks)delete stacks[i];
  }return next;
}
/** Compare declared intent with actual cells. Does not guess objects from screenshots. */
export function validateTileAssembly(project: Project,map: GameMap,plan: AssemblyPlan) {
  const tileset=project.tilesets[map.tilesetId];
  const columns=map.tilesetId==='forest_harmony'?30:map.tilesetId==='opengameart_castle'?32:0;
  if(!tileset||!columns||tileset.tilesPerRow!==columns||tileset.tileSize!==16)throw Error('Assembly catalog requires the original 16px tileset geometry');
  const issues: AssemblyIssue[]=[];
  for(const c of expectedCells(map.tilesetId,plan)){
    const outside=c.x<0||c.y<0||c.x>=map.width||c.y>=map.height;
    const i=c.y*map.width+c.x,actual=outside?-1:(topTileInStack(map,c.layer,i)??map[c.layer==='lower'?'lowerTiles':'upperTiles'][i]);
    if(!outside&&actual===c.tile)continue;
    const root=c.part.tree&&c.dy===c.part.height-1;
    const reversed=c.part.role==='cap-left'?assemblyPart('forest:right'):c.part.role==='cap-right'?assemblyPart('forest:left'):null;
    const opposite=reversed&&[...reversed.lowerTiles.flat(),...reversed.upperTiles.flat()].includes(actual)&&actual>=0;
    issues.push({code:root?'CUT_ROOT':opposite?'REVERSED_EDGE':c.part.tree&&c.dy>=2&&c.dy<c.part.height-1?'MISSING_TRUNK':outside?'OUT_OF_BOUNDS':'PART_MISMATCH',x:c.x,y:c.y,layer:c.layer,partId:c.part.id,expected:c.tile,actual,message:outside?'Required part cell is outside map':'Restore the expected cell from the declared assembly'});
  }
  for(const e of plan.entrances??[]){[e.x,e.y,e.fromX,e.fromY].forEach(integer);if(Math.abs(e.x-e.fromX)+Math.abs(e.y-e.fromY)!==1)throw Error('Entrance approach must be an adjacent cell');
    const occupied=map.events.some(v=>v.x===e.x&&v.y===e.y&&(v.pages?.some(p=>p.priority==='same')??true));
    if(occupied||!canMove(project,map,e.fromX,e.fromY,e.x,e.y))issues.push({code:'BLOCKED_ENTRANCE',x:e.x,y:e.y,message:occupied?'Event occupies entrance (conservative: any same-priority page)':'Engine collision blocks the specified approach'});
  }
  return {valid:issues.length===0,issues,scope:'Declared parts and one-step entrance approaches only; no aesthetic approval or transfer-event validation'};
}

~~~
