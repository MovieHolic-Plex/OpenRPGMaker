// 허용한 건물 타일셋의 참고문서 번들(profiles.json 의 bundle.references)과 완전한 조립 예제·정상/오류 그림을 만든다.
// 순서: install.py → 이 스크립트 → stitch-building-error.py  (scripts/content/rebuild-building-bundle.sh <프로필> 이 묶는다)
// 사용: vite-node scripts/content/prepare-building-references.mts [프로필 id, 기본 beodeul]
import fs from 'node:fs';import assert from 'node:assert/strict';
import {createBlankProject} from '../../src/project/defaults/blankProject.ts';
import {MAP_TOOLS} from '../../src/editor/tools/mapTools.ts';
import {translateTiles} from '../../src/project/objectStamp.ts';
import {layerTileAt,setLayerTileAt,compactMapLayers} from '../../src/project/mapLayers.ts';
import {canMove,isPassable} from '../../src/project/collision.ts';
import {renderMapPng} from '../qa-game/render.mts';
const profileId=process.argv.slice(2).find(a=>!a.startsWith('-'))??'beodeul';
const profile=(JSON.parse(fs.readFileSync('src/harnesses/beodeul-building-review/profiles.json','utf8')).profiles as any[]).find(x=>x.id===profileId);assert(profile,'unknown profile '+profileId);
const B=profile.bundle,EX=profile.example,IDS=B.ids as {house:string;shadow:string;foundation:string;docs:string};
const catalog=JSON.parse(fs.readFileSync(B.catalog,'utf8')),groundCatalog=JSON.parse(fs.readFileSync(EX.groundCatalog,'utf8'));
const data=B.tiledata as string,pub=B.publicDir as string,label=profile.label as string;
const p=createBlankProject(),ts=p.tilesets[B.hostTilesetId]!;
const kits=new Map(ts.structureKits!.map(k=>[k.id,k]));
const kidOf=(id:string)=>id.slice(IDS.house.length);
const documents:{id:string;name:string;markdown:string}[]=[],images:{id:string;name:string;caption:string;dataUrl:string}[]=[];
const add=(id:string,name:string,markdown:string)=>{fs.writeFileSync(`${data}/${id}.md`,markdown);documents.push({id,name,markdown});};

// ---- 완전한 조립 예제: 64×22 거리, 건물 8채 --------------------------------------------------
const W=EX.map.width as number,H=EX.map.height as number,ROAD=EX.map.roadRow as number;   // 건물 맨 아랫줄=ROAD-1, 길 ROAD~ROAD+1
const pick=EX.picks as string[];
const byKid=new Map<string,any>(catalog.buildings.map((b:any)=>[kidOf(b.id),b]));
const m0=MAP_TOOLS.find(t=>t.name==='create_map')!;
m0.run(p,{id:EX.map.id,name:EX.map.name,width:W,height:H,tilesetId:ts.id,border:'none'});
const m=p.maps[EX.map.id]!;m.lowerTiles=Array(W*H).fill(EX.grassTile);
const index=(x:number,y:number)=>y*W+x;
const placements:{kit:string;x:number;y:number;role:string}[]=[],fronts:{kit:string;x:number;y:number}[]=[];
let cx=1;
for(const kid of pick){const b=byKid.get(kid)!;assert(b,kid);const x=cx,y=ROAD-b.height;assert(x+b.width<=W-1,'street too short for '+kid);
 for(const [role,id,layer] of [['shadow',`${IDS.shadow}${kid}`,2],['body',`${IDS.house}${kid}`,3],['foundation',`${IDS.foundation}${kid}`,4]] as const){
  const k=kits.get(id)!;assert(k,id);
  for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++){const n=k.rows[dy]!.upperTiles[dx]!;
   if(n>=0&&x+dx<W&&y+dy<H){if(layer===3)assert(layerTileAt(m,3,index(x+dx,y+dy))<0,'overlap '+id);setLayerTileAt(m,layer,index(x+dx,y+dy),n);}}
  placements.push({kit:id,x,y,role});
 }
 const e=b.parts[0]!;fronts.push({kit:`${IDS.house}${kid}`,x:x+e.dx,y:y+e.dy+e.h});cx+=b.width+1;
}
// 길: 흙 길 두 줄(beodeul_ground 의 연결 mask 흙 레시피를 target 으로 이식)
const ground=p.tilesets[EX.groundTilesetId]!,recipes=new Map<string,any>((groundCatalog.recipes as any[]).map(r=>[r.id,r]));
const road=new Set<number>();for(let x=0;x<W;x++)for(const y of [ROAD,ROAD+1])road.add(index(x,y));
const tr=translateTiles(ground,ts,(groundCatalog.recipes as any[]).filter(r=>new RegExp(EX.roadRecipePattern).test(r.id)).flatMap(r=>r.rows.flat()));
for(const i of road){const x=i%W,y=Math.floor(i/W);let mask=0;
 for(const [dx,dy,bit] of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]] as const){if(road.has(index(x+dx,y+dy))&&x+dx>=0&&x+dx<W&&y+dy>=0&&y+dy<H)mask|=bit;}
 setLayerTileAt(m,1,i,tr.map.get(recipes.get(`${EX.roadRecipePrefix}${mask}`).rows[0][0])!);}
compactMapLayers(m);

// ---- 검사: 벽은 막고 문 앞과 처마는 열려 있다 ----------------------------------------------------
const checks:any[]=[];
for(const f of fronts){const kid=kidOf(f.kit),b=byKid.get(kid)!,e=b.parts[0]!,x0=f.x-e.dx,y0=f.y-e.dy-e.h;
 assert(isPassable(p,m,f.x,f.y),`front must be open: ${kid}`);
 assert(!isPassable(p,m,f.x,f.y-1),`door cell must be solid: ${kid}`);
 assert(canMove(p,m,f.x,f.y+1,f.x,f.y),`road→front: ${kid}`);
 const blocked=new Set<string>(b.blocked.map(([x,y]:number[])=>`${x},${y}`));let wallsSolid=0,overhangWalkable=0;
 for(let dy=0;dy<b.height;dy++)for(let dx=0;dx<b.width;dx++){if(b.rows[dy]![dx]!<0)continue;const open=isPassable(p,m,x0+dx,y0+dy);
  if(blocked.has(`${dx},${dy}`)){assert(!open,`wall must be solid ${kid} ${dx},${dy}`);wallsSolid++;}else{assert(open,`overhang must be walkable ${kid} ${dx},${dy}`);overhangWalkable++;}}
 checks.push({kit:f.kit,door:{x:f.x,y:f.y-1},front:{x:f.x,y:f.y},wallsSolid,overhangWalkable});
}
fs.writeFileSync(`${pub}/street.png`,renderMapPng({...p,startMapId:''},m).png);
// 오류: 문 앞 칸에 실제 막는 소품을 3층에 넣으면 통행이 끊긴다 — 정상은 true, 변조는 false
const f0=fronts[1]!,bad=structuredClone(p),badMap=bad.maps[EX.map.id]!,anvil=ts.structureKits!.find(k=>k.id===EX.blockerKit);
assert(anvil,EX.blockerKit+' must exist in '+B.hostTilesetId);
assert(canMove(p,m,f0.x,f0.y+1,f0.x,f0.y));setLayerTileAt(badMap,3,index(f0.x,f0.y),anvil!.rows[0]!.upperTiles[0]!);
assert(!canMove(bad,badMap,f0.x,f0.y+1,f0.x,f0.y));
fs.writeFileSync(`${pub}/error-street.png`,renderMapPng({...bad,startMapId:''},badMap).png);
fs.writeFileSync(`${data}/errors.json`,JSON.stringify({code:'blocked-rv-entrance',kit:f0.kit,x:f0.x,y:f0.y,normal:true,mutated:false},null,2));
fs.writeFileSync(`${data}/street-example.json`,JSON.stringify({map:m,placements,fronts,checks,tilesetId:ts.id}));

// ---- 문서 ---------------------------------------------------------------------------------------
const n=catalog.buildings.length;
add(IDS.docs+'guide','허용한 건물 · 시공 순서',`# ${label} · 사람이 허용한 건물 ${n}채

건물 검수 화면에서 **사람이 현재 그림 해시에 허용**한 건물만 들어 있다(결정 로그 harness-data/beodeul-building-review/decisions.json, 프로필 ${profileId}). 거절·미선택 그림은 없다. 시트 ${B.tilesetId}(${B.texture}, 16px, 16열, ${catalog.count}칸), 모든 프로젝트의 ${B.hostTilesetId} 에는 \`ensureBeodeulReviewed\`(translateTiles)로 이식되어 있다. 칸 번호를 다른 시트와 섞지 않는다 — 현재 프로젝트의 키트 id(${IDS.house}*)로 놓는다.

## 조립 순서(건물 한 채)
1. 본체 width×height 와 **문 아래 한 칸**(접근칸)을 평지에 예약한다. 잘라서 줄이거나 반복하지 않는 고정 키트.
2. 같은 원점에 **2층 ${IDS.shadow}<id>(바닥 그림자) → 3층 ${IDS.house}<id>(본체) → 4층 ${IDS.foundation}<id>(기초)** 를 놓는다. 그림자·기초는 w+1,h+1 칸이고 통행에 영향이 없다. 그림자·기초를 빼면 건물이 땅에서 떠 보인다.
3. 아래 1층에는 밝은 잔디(${B.hostTilesetId} ${EX.grassTile})와 흙/포석 길을 놓는다. 문 앞에서 길 칸까지 canMove 경로를 확보한다.
4. 건물끼리는 사각형이 겹치면 안 된다(본체 칸 3층 충돌 금지). 같은 키트를 연속으로 놓지 말고 폭·지붕 색·층수를 섞는다.

## 통행과 문
- **벽 칸은 막힘, 지붕 처마 칸은 걸을 수 있음.** 벽 칸은 칸별 밝은 회벽/돌 색 비율로 가려 열별 지면에서 위로 이어 붙였고, 문 칸과 맨 아래 줄은 항상 막힘이다. 통나무집은 지붕 아래 벽 띠 전체가 막힘이다.
- 키트 한 채마다 입구 한 곳(parts.entrance, 문 그림 칸). **문 그림·문 앞 접근칸·출입구·전이 이벤트는 다르다** — 이 키트는 그림과 통행만 준다. 문 안으로 들어가는 전이 이벤트는 맵에 따로 만든다.
- 문 앞 칸(문 y + h)은 키트 밖이므로 길로 비워 둔다. 소품·나무로 막지 않는다.

## 정확한 예제와 검사
${W}×${H} 거리 예제(건물 ${pick.length}채): ${IDS.docs}street-plan(배치), ${IDS.docs}street-layer-1~4(전체 층 배열), 실제 mapTileDraw 출력은 그림 ${IDS.docs}street. 검사: 모든 문 앞이 열려 있고 문 칸이 막혀 있으며 벽 칸 전부가 막히고 처마 칸 전부가 걸을 수 있음을 canMove/isPassable 로 확인했다. 자동 검사는 구조와 통행만 본다. 이벤트 실행·미적 품질·저가 모델 성공률은 이것으로 주장하지 않는다.

## 정상/오류
blocked-rv-entrance: ${fronts[1]!.kit} 문 앞 (${f0.x},${f0.y})에 실제 anvil 소품을 3층에 넣으면 정상 canMove=true, 변조 false. 그림 ${IDS.docs}error 의 왼쪽이 정상, 오른쪽이 변조다.

## 목록
${catalog.buildings.map(b=>`- ${b.id} · ${b.name} · ${b.width}×${b.height} · 문 (${b.parts[0]!.dx},${b.parts[0]!.dy}) · ${b.material==='log'?'통나무':'목골·돌'} · 원본 ${b.source}`).join('\n')}

원본 그림은 ${data}/sources/, 설치는 \`npm run harness -- beodeul-building-review install --profile ${profileId}\`, 이 자료는 scripts/content/rebuild-building-bundle.sh ${profileId}.
`);
// 문서 한도(분류당 64)가 있으므로 건물 설명은 6채씩 한 문서로 묶는다.
const sections=catalog.buildings.map((b:any)=>{const kid=kidOf(b.id),total=b.rows.flat().filter((v:number)=>v>=0).length;
 return `## ${b.name}\n\n키트 ${b.id}, 원본 후보 ${b.source}(그림 해시 ${b.sha256.slice(0,12)}…). ${b.width}×${b.height}칸(${b.width*16}×${b.height*16}px), ${b.material==='log'?'통나무':'목골·돌'} 벽, 한 입구: 문 (${b.parts[0]!.dx},${b.parts[0]!.dy}) ${b.parts[0]!.w}×${b.parts[0]!.h}, 문 앞 (${b.parts[0]!.dx},${b.parts[0]!.dy+b.parts[0]!.h}). 층: 2=${IDS.shadow}${kid}, 3=본체, 4=${IDS.foundation}${kid}, 같은 원점. 막힌 칸 ${b.blocked.length}, 걸을 수 있는 처마 ${total-b.blocked.length}.\n\n\`\`\`json\n${JSON.stringify({id:b.id,width:b.width,height:b.height,entrance:b.parts[0],blockedCells:b.blocked,rows:b.rows,shadowRows:b.shadowRows,foundationRows:b.foundationRows,groundLines:b.groundLines})}\n\`\`\`\n\n칸 번호는 ${B.tilesetId} 시트의 것이다. ${B.hostTilesetId} 에서는 \`ensureBeodeulReviewed\` 이식 번호이므로 kit 키트 id 로 놓는다.\n\n![허용한 건물 전체](image:${IDS.docs}gallery)\n`;});
const PER_DOC=6;
for(let k=0;k*PER_DOC<sections.length;k++){const first=catalog.buildings[k*PER_DOC],last=catalog.buildings[Math.min(sections.length,(k+1)*PER_DOC)-1];
 add(IDS.docs+'list-'+(k+1),`건물 ${k*PER_DOC+1}~${Math.min(sections.length,(k+1)*PER_DOC)} (${kidOf(first.id)} … ${kidOf(last.id)})`,`# 건물 ${k*PER_DOC+1}~${Math.min(sections.length,(k+1)*PER_DOC)}\n\n`+sections.slice(k*PER_DOC,(k+1)*PER_DOC).join('\n\n'));}
add(IDS.docs+'street-plan','거리 예제 전체 배치',`# ${W}×${H} 거리 예제\n\n건물 아랫줄 y=${ROAD-1}, 길 y=${ROAD}~${ROAD+1}. 각 건물은 shadow→body→foundation 을 같은 원점에 놓았다.\n\n\`\`\`json\n${JSON.stringify({placements,fronts,checks})}\n\`\`\``);
for(const [layer,field] of [[1,'lowerTiles'],[2,'lowerOverlayTiles'],[3,'upperTiles'],[4,'upperOverlayTiles']] as const)
 add(IDS.docs+'street-layer-'+layer,'거리 예제 '+layer+'층 정답',`# target 맵 ${layer}층\n\n이 저장본 예제 전용 ${B.hostTilesetId} 번호(${field}). ${W}×${H}.\n\n\`\`\`json\n${JSON.stringify(Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>layerTileAt(m,layer as 1|2|3|4,y*W+x))))}\n\`\`\``);
const used=[...new Set([1,2,3,4].flatMap(l=>Array.from({length:W*H},(_,i)=>layerTileAt(m,l as 1|2|3|4,i))))].filter(v=>v>=0);
add(IDS.docs+'street-tiles','예제에 쓴 칸의 출처와 통행',`# 사용한 target 칸\n\n\`\`\`json\n${JSON.stringify(used.map(v=>({targetTile:v,graft:ts.tileGrafts?.find(g=>g.targetTile===v)??null,priority:ts.priority[v],passability:ts.passability[v]})))}\n\`\`\``);
const pic=(id:string,name:string,path:string,caption:string)=>images.push({id,name,caption,dataUrl:path});
pic(IDS.docs+'gallery','허용한 건물 전체 · 원본 해상도',`${B.publicUrl}/gallery.png`,`허용 ${n}채, 그림자·본체·기초를 층 순서대로 1:1 합성(잔디 위). 라벨은 키트 id 의 뒷부분.`);
pic(IDS.docs+'street',`거리 예제 · ${pick.length}채`,`${B.publicUrl}/street.png`,`실제 mapTileDraw 출력, ${W}×${H}. 건물마다 그림자·기초가 붙어 땅에 선다.`);
pic(IDS.docs+'error','정상 / 막힌 문 앞',`${B.publicUrl}/normal-error.png`,`왼쪽 정상, 오른쪽은 ${f0.kit} 문 앞(${f0.x},${f0.y})에 anvil 을 놓은 실제 변조.`);
const refs=[{id:B.referencesId,name:`${label} · 사람이 허용한 건물 ${n}채`,description:'검수 화면에서 사람이 허용한 건물만. 본체·바닥 그림자·기초 3층 조립, 벽 막힘·처마 통행, 문 앞 접근칸, 64×22 거리 예제와 막힌 문 앞 오류.',documents,images}];
fs.writeFileSync(`${data}/references.json`,JSON.stringify(refs,null,2)+'\n');fs.writeFileSync(B.references,JSON.stringify(refs)+'\n');
console.log(JSON.stringify({documents:documents.length,images:images.length,buildings:n,fronts:fronts.length,doorsSolid:true,wallsSolidAndOverhangWalkable:true,actualMutationBlocksDoor:true}));
