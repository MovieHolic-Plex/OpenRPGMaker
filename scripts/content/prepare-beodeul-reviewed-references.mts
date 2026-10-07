// 버들항 · 허용한 건물: 참고문서 번들(src/assets/beodeulReviewedReferences.json)과 완전한 조립 예제·정상/오류 그림을 만든다.
// 순서: install.py → 이 스크립트 → stitch-beodeul-reviewed-error.py  (scripts/content/rebuild-beodeul-reviewed.sh 가 묶는다)
import fs from 'node:fs';import assert from 'node:assert/strict';
import catalog from '../../src/assets/beodeulReviewedCatalog.json';
import groundCatalog from '../../src/assets/beodeulGroundCatalog.json';
import {createBlankProject} from '../../src/project/defaults/blankProject.ts';
import {MAP_TOOLS} from '../../src/editor/tools/mapTools.ts';
import {translateTiles} from '../../src/project/objectStamp.ts';
import {layerTileAt,setLayerTileAt,compactMapLayers} from '../../src/project/mapLayers.ts';
import {canMove,isPassable} from '../../src/project/collision.ts';
import {renderMapPng} from '../qa-game/render.mts';
const data='tiledata/beodeul-reviewed',pub='public/assets/beodeul-reviewed';
const p=createBlankProject(),ts=p.tilesets.beodeul_city!;
const kits=new Map(ts.structureKits!.map(k=>[k.id,k]));
const kidOf=(id:string)=>id.slice('bd-house-rv-'.length);
const documents:{id:string;name:string;markdown:string}[]=[],images:{id:string;name:string;caption:string;dataUrl:string}[]=[];
const add=(id:string,name:string,markdown:string)=>{fs.writeFileSync(`${data}/${id}.md`,markdown);documents.push({id,name,markdown});};

// ---- 완전한 조립 예제: 64×22 거리, 건물 8채 --------------------------------------------------
const W=64,H=22,ROAD=18;                       // 건물 맨 아랫줄=17, 길 18~19
const pick=['r10-04','r2-04','r2-02','r6-02','r8-06','r3-01','r10-01','r7-08'];
const byKid=new Map(catalog.buildings.map(b=>[kidOf(b.id),b]));
const m0=MAP_TOOLS.find(t=>t.name==='create_map')!;
m0.run(p,{id:'rv_street',name:'버들항 · 허용한 건물 거리 예제',width:W,height:H,tilesetId:ts.id,border:'none'});
const m=p.maps.rv_street!;m.lowerTiles=Array(W*H).fill(737);
const index=(x:number,y:number)=>y*W+x;
const placements:{kit:string;x:number;y:number;role:string}[]=[],fronts:{kit:string;x:number;y:number}[]=[];
let cx=1;
for(const kid of pick){const b=byKid.get(kid)!;assert(b,kid);const x=cx,y=ROAD-b.height;assert(x+b.width<=W-1,'street too short for '+kid);
 for(const [role,id,layer] of [['shadow',`bd-rv-shadow-${kid}`,2],['body',`bd-house-rv-${kid}`,3],['foundation',`bd-rv-foundation-${kid}`,4]] as const){
  const k=kits.get(id)!;assert(k,id);
  for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++){const n=k.rows[dy]!.upperTiles[dx]!;
   if(n>=0&&x+dx<W&&y+dy<H){if(layer===3)assert(layerTileAt(m,3,index(x+dx,y+dy))<0,'overlap '+id);setLayerTileAt(m,layer,index(x+dx,y+dy),n);}}
  placements.push({kit:id,x,y,role});
 }
 const e=b.parts[0]!;fronts.push({kit:`bd-house-rv-${kid}`,x:x+e.dx,y:y+e.dy+e.h});cx+=b.width+1;
}
// 길: 흙 길 두 줄(beodeul_ground 의 연결 mask 흙 레시피를 target 으로 이식)
const ground=p.tilesets.beodeul_ground!,recipes=new Map((groundCatalog.recipes as any[]).map(r=>[r.id,r]));
const road=new Set<number>();for(let x=0;x<W;x++)for(const y of [ROAD,ROAD+1])road.add(index(x,y));
const tr=translateTiles(ground,ts,(groundCatalog.recipes as any[]).filter(r=>/^bdg-hamlet-soil-\d+$/.test(r.id)).flatMap(r=>r.rows.flat()));
for(const i of road){const x=i%W,y=Math.floor(i/W);let mask=0;
 for(const [dx,dy,bit] of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]] as const){if(road.has(index(x+dx,y+dy))&&x+dx>=0&&x+dx<W&&y+dy>=0&&y+dy<H)mask|=bit;}
 setLayerTileAt(m,1,i,tr.map.get(recipes.get(`bdg-hamlet-soil-${mask}`).rows[0][0])!);}
compactMapLayers(m);

// ---- 검사: 벽은 막고 문 앞과 처마는 열려 있다 ----------------------------------------------------
const checks:any[]=[];
for(const f of fronts){const kid=kidOf(f.kit),b=byKid.get(kid)!,e=b.parts[0]!,x0=f.x-e.dx,y0=f.y-e.dy-e.h;
 assert(isPassable(p,m,f.x,f.y),`front must be open: ${kid}`);
 assert(!isPassable(p,m,f.x,f.y-1),`door cell must be solid: ${kid}`);
 assert(canMove(p,m,f.x,f.y+1,f.x,f.y),`road→front: ${kid}`);
 const blocked=new Set(b.blocked.map(([x,y]:number[])=>`${x},${y}`));let wallsSolid=0,overhangWalkable=0;
 for(let dy=0;dy<b.height;dy++)for(let dx=0;dx<b.width;dx++){if(b.rows[dy]![dx]!<0)continue;const open=isPassable(p,m,x0+dx,y0+dy);
  if(blocked.has(`${dx},${dy}`)){assert(!open,`wall must be solid ${kid} ${dx},${dy}`);wallsSolid++;}else{assert(open,`overhang must be walkable ${kid} ${dx},${dy}`);overhangWalkable++;}}
 checks.push({kit:f.kit,door:{x:f.x,y:f.y-1},front:{x:f.x,y:f.y},wallsSolid,overhangWalkable});
}
fs.writeFileSync(`${pub}/street.png`,renderMapPng({...p,startMapId:''},m).png);
// 오류: 문 앞 칸에 실제 막는 소품을 3층에 넣으면 통행이 끊긴다 — 정상은 true, 변조는 false
const f0=fronts[1]!,bad=structuredClone(p),badMap=bad.maps.rv_street!,anvil=ts.structureKits!.find(k=>k.id==='bd-pick-volcano-cave-anvil');
assert(anvil,'bd-pick-volcano-cave-anvil must exist in beodeul_city');
assert(canMove(p,m,f0.x,f0.y+1,f0.x,f0.y));setLayerTileAt(badMap,3,index(f0.x,f0.y),anvil!.rows[0]!.upperTiles[0]!);
assert(!canMove(bad,badMap,f0.x,f0.y+1,f0.x,f0.y));
fs.writeFileSync(`${pub}/error-street.png`,renderMapPng({...bad,startMapId:''},badMap).png);
fs.writeFileSync(`${data}/errors.json`,JSON.stringify({code:'blocked-rv-entrance',kit:f0.kit,x:f0.x,y:f0.y,normal:true,mutated:false},null,2));
fs.writeFileSync(`${data}/street-example.json`,JSON.stringify({map:m,placements,fronts,checks,tilesetId:ts.id}));

// ---- 문서 ---------------------------------------------------------------------------------------
const n=catalog.buildings.length;
add('bd-rv-guide','허용한 건물 · 시공 순서',`# 버들항 · 사람이 허용한 건물 ${n}채

beodeul-building-review 검수 화면에서 **사람이 현재 그림 해시에 허용**한 건물만 들어 있다(결정 로그 harness-data/beodeul-building-review/decisions.json). 거절·미선택 그림은 없다. 시트 beodeul_reviewed(tex_beodeul_reviewed, 16px, 16열, ${catalog.count}칸), 모든 프로젝트의 beodeul_city 에는 \`ensureBeodeulReviewed\`(translateTiles)로 이식되어 있다. 칸 번호를 다른 시트와 섞지 않는다 — 현재 프로젝트의 키트 id(bd-house-rv-*)로 놓는다.

## 조립 순서(건물 한 채)
1. 본체 width×height 와 **문 아래 한 칸**(접근칸)을 평지에 예약한다. 잘라서 줄이거나 반복하지 않는 고정 키트.
2. 같은 원점에 **2층 bd-rv-shadow-<id>(바닥 그림자) → 3층 bd-house-rv-<id>(본체) → 4층 bd-rv-foundation-<id>(기초)** 를 놓는다. 그림자·기초는 w+1,h+1 칸이고 통행에 영향이 없다. 그림자·기초를 빼면 건물이 땅에서 떠 보인다.
3. 아래 1층에는 밝은 잔디(beodeul_city 737)와 흙/포석 길을 놓는다. 문 앞에서 길 칸까지 canMove 경로를 확보한다.
4. 건물끼리는 사각형이 겹치면 안 된다(본체 칸 3층 충돌 금지). 같은 키트를 연속으로 놓지 말고 폭·지붕 색·층수를 섞는다.

## 통행과 문
- **벽 칸은 막힘, 지붕 처마 칸은 걸을 수 있음.** 벽 칸은 칸별 밝은 회벽/돌 색 비율로 가려 열별 지면에서 위로 이어 붙였고, 문 칸과 맨 아래 줄은 항상 막힘이다. 통나무집은 지붕 아래 벽 띠 전체가 막힘이다.
- 키트 한 채마다 입구 한 곳(parts.entrance, 문 그림 칸). **문 그림·문 앞 접근칸·출입구·전이 이벤트는 다르다** — 이 키트는 그림과 통행만 준다. 문 안으로 들어가는 전이 이벤트는 맵에 따로 만든다.
- 문 앞 칸(문 y + h)은 키트 밖이므로 길로 비워 둔다. 소품·나무로 막지 않는다.

## 정확한 예제와 검사
64×22 거리 예제(건물 8채): bd-rv-street-plan(배치), bd-rv-street-layer-1~4(전체 층 배열), 실제 mapTileDraw 출력은 그림 bd-rv-street. 검사: 모든 문 앞이 열려 있고 문 칸이 막혀 있으며 벽 칸 전부가 막히고 처마 칸 전부가 걸을 수 있음을 canMove/isPassable 로 확인했다. 자동 검사는 구조와 통행만 본다. 이벤트 실행·미적 품질·저가 모델 성공률은 이것으로 주장하지 않는다.

## 정상/오류
blocked-rv-entrance: ${fronts[1]!.kit} 문 앞 (${f0.x},${f0.y})에 실제 anvil 소품을 3층에 넣으면 정상 canMove=true, 변조 false. 그림 bd-rv-error 의 왼쪽이 정상, 오른쪽이 변조다.

## 목록
${catalog.buildings.map(b=>`- ${b.id} · ${b.name} · ${b.width}×${b.height} · 문 (${b.parts[0]!.dx},${b.parts[0]!.dy}) · ${b.material==='log'?'통나무':'목골·돌'} · 원본 ${b.source}`).join('\n')}

원본 그림은 tiledata/beodeul-reviewed/sources/, 설치는 \`npm run harness -- beodeul-building-review install\`, 이 자료는 scripts/content/rebuild-beodeul-reviewed.sh.
`);
for(const b of catalog.buildings){const kid=kidOf(b.id),total=b.rows.flat().filter((v:number)=>v>=0).length;
 add('bd-rv-'+kid,b.name,`# ${b.name}\n\n키트 ${b.id}, 원본 후보 ${b.source}(그림 해시 ${b.sha256.slice(0,12)}…). ${b.width}×${b.height}칸(${b.width*16}×${b.height*16}px), ${b.material==='log'?'통나무':'목골·돌'} 벽, 한 입구: 문 (${b.parts[0]!.dx},${b.parts[0]!.dy}) ${b.parts[0]!.w}×${b.parts[0]!.h}, 문 앞 (${b.parts[0]!.dx},${b.parts[0]!.dy+b.parts[0]!.h}). 층: 2=bd-rv-shadow-${kid}, 3=본체, 4=bd-rv-foundation-${kid}, 같은 원점. 막힌 칸 ${b.blocked.length}, 걸을 수 있는 처마 ${total-b.blocked.length}.\n\n\`\`\`json\n${JSON.stringify({id:b.id,width:b.width,height:b.height,entrance:b.parts[0],blockedCells:b.blocked,rows:b.rows,shadowRows:b.shadowRows,foundationRows:b.foundationRows,groundLines:b.groundLines})}\n\`\`\`\n\n칸 번호는 beodeul_reviewed 시트의 것이다. beodeul_city 에서는 \`ensureBeodeulReviewed\` 이식 번호이므로 kit 키트 id 로 놓는다.\n\n![허용한 건물 전체](image:bd-rv-gallery)\n`);
}
add('bd-rv-street-plan','거리 예제 전체 배치',`# 64×22 거리 예제\n\n건물 아랫줄 y=17, 길 y=18~19. 각 건물은 shadow→body→foundation 을 같은 원점에 놓았다.\n\n\`\`\`json\n${JSON.stringify({placements,fronts,checks})}\n\`\`\``);
for(const [layer,field] of [[1,'lowerTiles'],[2,'lowerOverlayTiles'],[3,'upperTiles'],[4,'upperOverlayTiles']] as const)
 add('bd-rv-street-layer-'+layer,'거리 예제 '+layer+'층 정답',`# target 맵 ${layer}층\n\n이 저장본 예제 전용 beodeul_city 번호(${field}). ${W}×${H}.\n\n\`\`\`json\n${JSON.stringify(Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>layerTileAt(m,layer as 1|2|3|4,y*W+x))))}\n\`\`\``);
const used=[...new Set([1,2,3,4].flatMap(l=>Array.from({length:W*H},(_,i)=>layerTileAt(m,l as 1|2|3|4,i))))].filter(v=>v>=0);
add('bd-rv-street-tiles','예제에 쓴 칸의 출처와 통행',`# 사용한 target 칸\n\n\`\`\`json\n${JSON.stringify(used.map(v=>({targetTile:v,graft:ts.tileGrafts?.find(g=>g.targetTile===v)??null,priority:ts.priority[v],passability:ts.passability[v]})))}\n\`\`\``);
const pic=(id:string,name:string,path:string,caption:string)=>images.push({id,name,caption,dataUrl:path});
pic('bd-rv-gallery','허용한 건물 전체 · 원본 해상도',`/assets/beodeul-reviewed/gallery.png`,`허용 ${n}채, 그림자·본체·기초를 층 순서대로 1:1 합성(잔디 위). 라벨은 키트 id 의 뒷부분.`);
pic('bd-rv-street','거리 예제 · 8채','/assets/beodeul-reviewed/street.png','실제 mapTileDraw 출력, 64×22. 건물마다 그림자·기초가 붙어 땅에 선다.');
pic('bd-rv-error','정상 / 막힌 문 앞','/assets/beodeul-reviewed/normal-error.png',`왼쪽 정상, 오른쪽은 ${f0.kit} 문 앞(${f0.x},${f0.y})에 anvil 을 놓은 실제 변조.`);
const refs=[{id:'beodeul-reviewed',name:'버들항 · 사람이 허용한 건물 '+n+'채',description:'검수 화면에서 사람이 허용한 건물만. 본체·바닥 그림자·기초 3층 조립, 벽 막힘·처마 통행, 문 앞 접근칸, 64×22 거리 예제와 막힌 문 앞 오류.',documents,images}];
fs.writeFileSync(`${data}/references.json`,JSON.stringify(refs,null,2)+'\n');fs.writeFileSync('src/assets/beodeulReviewedReferences.json',JSON.stringify(refs)+'\n');
console.log(JSON.stringify({documents:documents.length,images:images.length,buildings:n,fronts:fronts.length,doorsSolid:true,wallsSolidAndOverhangWalkable:true,actualMutationBlocksDoor:true}));
