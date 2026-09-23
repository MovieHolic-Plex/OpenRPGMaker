// Rebuild bundled reference documents from the committed approved sample, never from a live DB.
import fs from 'node:fs';
const dir='tiledata/tilesets/forest_harmony/dewbank-village';
const sample=JSON.parse(fs.readFileSync(dir+'/sample.json')),parts=JSON.parse(fs.readFileSync(dir+'/parts.json'));
const m=sample.map,t=sample.tileset,docs=[];
const block=o=>'```json\n'+JSON.stringify(o,null,2)+'\n```\n';
const table=(a,w)=>'```text\n'+Array.from({length:a.length/w},(_,y)=>a.slice(y*w,(y+1)*w).join(' ')).join('\n')+'\n```\n';
function doc(id,name,markdown){fs.writeFileSync(`${dir}/${id}.md`,markdown.replaceAll(/\(image:([^)]+)\)/g,'(images/$1.png)'));docs.push({id,name,markdown});}
const crop=(x,y,w,h)=>({x,y,w,h,lowerTiles:Array.from({length:h},(_,dy)=>m.lowerTiles.slice((y+dy)*88+x,(y+dy)*88+x+w)),upperTiles:Array.from({length:h},(_,dy)=>m.upperTiles.slice((y+dy)*88+x,(y+dy)*88+x+w))});
doc('guide','먼저 읽기 · 조립 순서',`# 이슬여울 마을 · 승인된 장식 조립 사전

88×60, 16px, forest_harmony (숲마을 · 거리별 잔디), 원본 tex_forest_harmony, 30열. 좌표는 모두 0기준 좌상단. i=y*88+x. 빈 타일은 -1; KEEP는 기존 하위 타일을 읽어 유지하라는 연산이며 타일 번호가 아니다.

25종/85개 장식, 건물 8채. 소품 19종은 별도 공용 shared_forest_village_objects (tex_shared_forest_village_objects, 6열)에서 47칸을 이식했다. 나머지 6종은 forest_harmony 원래 칸이다. 기본 forest_harmony 시트만 선택하면 2610번 소품이 생기는 것은 아니다.

![완성 마을](image:village)

## 그대로 실행하는 순서
1. 원본 시트와 225개 사용 타일의 이식 결합표를 확인한다. sourceChipset+sourceTile이 그림 정체성이다. 번호만 다른 시트에 복사하지 않는다.
2. 지형·강·다리·길 하위 배열을 먼저 깐다. 전체 배열 01~06은 이 승인 표본의 정답이다. 부분 저작은 해당 좌표의 하위를 KEEP한다.
3. 건물 전체 하위→전체 상위를 한 묶음으로 놓는다. 건물 문서의 8개 직사각형은 확대·반복하지 않는 고정 조각이다. 문 칸과 남쪽 접근칸을 예약하고 이벤트를 유지한다.
4. 숲 영역은 수관 마스크→남쪽 노출 경계 탐색→3행 몸통 왼쪽 마감→2열 반복 몸통→오른쪽 마감 순서. 전체가 들어갈 때만 쓴다. 맞지 않으면 노출된 수관 행을 줄여 재시도한다. 뿌리 한 행을 잘라 맞추지 않는다. 마지막으로 하위 몸통→상위 수관을 합성한다.
5. 울타리는 남쪽 열린 통로를 남기고 놓는다. 이번 표본의 나무 울타리는 2×1 고정 패널이다. 모서리 부품이나 무제한 반복 몸통으로 해석하지 않는다.
6. 장식 배치표 순서대로 각 상위 직사각형 전체를 놓는다. 일반 소품 조건: 영역 안, 하위 잔디 240, 상위 -1, 추가 스택 없음, 건물·문앞·이벤트 주변 예약 칸 제외. 벽걸이 등불만 기존 벽 하위를 KEEP하고 문 열 ±1을 피한다. 표에는 승인된 실제 좌표가 있으므로 재검색할 필요 없다.
7. 과일상자는 탁자 위 장식이 아니다. 탁자와 바구니는 각각 독립 상위 조각으로 놓는다. 우물·게시판·상자 등 상호작용할 소품은 적어도 한 면에 접근 가능 칸을 둔다. 등불은 벽 장식이라 별도 접근 검사에서 제외한다.
8. 두 레이어 전체 비교, 원본 이식 결합 검사, (36,30)에서 8개 문앞 및 소품으로의 타일 통행 검사를 수행한다. 실패하면 작업 복사본을 버리고 수정 후 다시 적용한다. 실제 프로젝트 저장→같은 SQLite 저장소 재로드가 마지막 단계다.

## 다른 프로젝트에 이식할 때
소품 47개 원본 번호를 오름차순 정렬한다. start=30*ceil(max(tileset.count,1+max(existingGraft.targetTile))/30). 정렬 위치 k의 target=start+k. 이 표본에서는 start=2610, 사용 2610..2656, count=2670이다. 기존 2550..2596 수관 이식은 유지한다. source tileMeta·passability·priority와 tileGrafts를 같이 복사한다. 충돌하는 2610번을 덮어쓰지 않는다. 기존 번호와 달라지면 모든 상위 배열과 structureKits의 참조도 대응표로 바꾼다.

이 문서의 표본 검사기는 승인된 번호/좌표 전용이다. 재배치·재이식한 다른 마을은 자기 정답 배열을 따로 만들거나 공용 inspect_tile_recipe / validate_tile_recipes 도구로 등록 조립법 단위를 검사한다. 이슬여울과 다른 배치라는 이유만으로 잘못된 마을이라고 하지 않는다.

## 건물·가구·울타리·동굴의 추가 조립
이번 표본에는 동굴이 없다. 새 동굴은 같은 타일 참고문서의 정밀조립·검증(public-assembly-v2) → cave-cliff 문서 및 inspect_tile_recipe를 사용한다. 절벽 윗면→절벽 벽→하위 받침652+동굴 입구893→남쪽 접근칸 순서. 입구893은 tex_easyrpg_chipset_retro_world 원본413 이식이며 자동 전이 이벤트가 아니다.
닫힌 울타리는 같은 자료의 fence-gate: NW378, NE380, SW438, SE410, 수평379, 수직408. 아래 조립 부록에 두 레이어 전체를 실었다. 방향을 뒤집거나 이번 2×1 소품을 모서리로 늘리지 않는다.

출처: 정본 SQLite에서 승인 후 추출. projectId ${sample.sourceProjectId}, SHA256 ${sample.sourceSha256}. sample.json은 조립 학습용 맵/타일셋 표본이며 완전한 플레이 프로젝트가 아니다. 이벤트의 내부맵 참조는 원 프로젝트에 있다. 그림 저작권/출처는 기존 tiledata/forest-villages의 출처 기록 및 저장소 타일 출처 표기을 따른다. 새 그림은 생성하지 않았다.
`);
for(let i=0;i<parts.props.length;i+=5){let md='# 소품 사전 '+(i/5+1)+'\n\n하위 KEEP, 상위 아래 전체 배열. 각 셀은 16×16. sourceX/Y는 원본 시트 칸, pixelX/Y는 원본 픽셀 좌상단. targetX/Y는 이식된 30열 시트 칸. passability와 priority는 홈 레이어와 별도이다.\n';for(const p of parts.props.slice(i,i+5))md+='\n## '+p.name+'\n'+block(p);doc('props-'+(i/5+1),'소품 사전 '+(i/5+1),md);}
let placed='# 장식 85개 · 실제 좌표와 두 레이어\n\n각 lowerTiles는 KEEP 연산 적용 후 정본에 남는 값이다. 문·접근칸은 건물 표 참조. (x,y)는 전체 맵 원점 기준이다.\n';
for(const [i,p] of parts.placements.entries())placed+='\n## '+(i+1)+'. '+p.zone+' / '+p.name+'\n'+block({...p,...crop(p.x,p.y,p.w,p.h)});
doc('placements','85개 배치표',placed);
let houses='# 건물 8채 · 고정 조립\n\n각 건물은 아래 직사각형 전체가 고정 조각이다. 하위→상위를 통째로 배치한다. 지붕 일부만 반복하지 않는다. doorAt은 문 그림·이벤트 칸, front는 남쪽 접근칸. 장식 뒤에도 front는 시작점에서 도달해야 한다.\n';
for(const h of m.layoutPlan.regions.filter(r=>r.role==='house'))houses+='\n## '+h.label+'\n'+block({...h,...crop(h.x,h.y,h.w,h.h),doorEvents:m.events.filter(e=>e.x===h.doorAt.x&&e.y===h.doorAt.y).map(e=>({id:e.id,x:e.x,y:e.y}))});
doc('houses','8채 건물 전체 배열·문앞',houses);
const left=[[1422,1423,1424],[1426,1427,1428],[1430,1431,1432]],pair=[[1425,1350],[1429,1428],[1433,1432]],right=[[1453,1454,1455],[1457,1458,1459],[1461,1462,1463]];
doc('forest','꼬불꼬불 숲 · 3행 조립과 입출력',`# 승인된 숲 몸통을 보존하는 조립

숲 외곽 모양만 변형한다. 아래 원본 몸통/뿌리 16px 그림을 다른 단독 나무로 바꾸지 않는다. 수관은 상위, 3행 몸통은 하위. 하위 첫 행은 해당 남쪽 수관 끝과 같은 y에서 시작하고 뿌리는 y+2이다.

왼쪽(3×3):\n${block(left)}
반복 몸통(2×3):\n${block(pair)}
오른쪽(3×3):\n${block(right)}

노출 구간 시작 x=s, 길이 w>4라면 span=max(8,2*ceil(w/2)). 왼쪽을 s, 반복 k=0..(span-6)/2-1을 s+3+2*k, 오른쪽을 s+span-3에 놓는다. 실패하면 원점을 s+w-span으로 바꿔 같은 전체 조각을 시도한다. 3행 모두 영역 내부·보호되지 않은 칸이며 다른 몸통과 호환되고, 첫 행 위에 수관이 있는 후보만 채택한다.
폭≤4라면 왼쪽마감=LEFT+PAIR 첫 열(4×3)을 s, 또는 오른쪽마감=PAIR 둘째 열+RIGHT(4×3)를 s+w-4에 시도한다. 폭이 좁다는 이유로 조각을 잘라서는 안 된다. 두 후보 모두 안 맞으면 그 노출 수관 행을 제거하고 경계를 다시 맞춘다. 최하단 맵 밖으로 이어지는 숲은 보이지 않는 뿌리를 강제로 그리지 않는다.

수관 모서리: N,E,S,W,NE,SE,SW,NW 순서로 bit0..7. 같은 수관이 이웃이면 비트를 켜고 아래 variantMap[mask]를 상위에 쓴다. 임의 좌우 반전 대신 정확한 이웃 mask를 쓴다.
${block(t.autotileGroups.find(g=>g.id==='forest_harmony_grove_47').variantMap)}

## 숲 영역 입력→정답 배열→완성 그림
입력은 승인 마을에서 rect=(9,6,22,24)의 숲/빈터 마스크를 재현하는 경우이다. 아래 상위 2550..2596 칸이 마스크의 true, 나머지는 false이며 하위는 기존 지형과 맞춘 전체 정답이다. 임의 사각형을 지정하면 언제나 같은 마을이 나온다는 뜻은 아니다. 자유 영역 생성 구현은 src/editor/tools/village/forestContour.ts의 paintContouredForest이며 free 예약칸과 seed를 함께 받아야 한다.
${block(crop(9,6,22,24))}
![숲 입력 영역의 실제 출력](image:forest)
`);
for(let y=0;y<60;y+=10){let md=`# 전체 배치표 y=${y}..${y+9}\n\n폭88. 각 행 좌→우 x=0..87; 행 순서 y=${y}..${y+9}. 하위/상위 각 10행, 줄을 생략하지 않았다. 타일셋과 이식 번호는 사전 결합표와 함께 사용한다.\n\n## lowerTiles\n`+table(m.lowerTiles.slice(y*88,(y+10)*88),88)+'\n## upperTiles\n'+table(m.upperTiles.slice(y*88,(y+10)*88),88);doc('layout-'+String(y/10+1).padStart(2,'0'),`전체 배열 ${y}~${y+9}행`,md);}
let bindings='# 전체 사용 타일 225개 · 원본 결합과 레이어\n\n폭·높이는 각 16×16. target 시트 30열. 원본은 tex_shared_forest_village_objects만 6열, 나머지 이 표의 원본들은 30열이다. 원본 칸=(sourceTile%열수,floor(sourceTile/열수)), 픽셀=칸×16. 아래 좌표는 그림의 원본 좌상단이다. 실제 어느 레이어에 놓이는지는 전체 배열이 정답이며, tileMeta.defaultLayer는 기본 추천이다.\n';
for(let i=0;i<parts.usedTiles.length;i+=75){const cells=parts.usedTiles.slice(i,i+75).map(c=>{const cols=c.sourceChipset==='tex_shared_forest_village_objects'?6:30;return{...c,sourceX:c.sourceTile%cols,sourceY:Math.floor(c.sourceTile/cols),pixelX:c.sourceTile%cols*16,pixelY:Math.floor(c.sourceTile/cols)*16,usedLayers:['lower','upper'].filter(l=>m[l+'Tiles'].includes(c.tile))};});doc('bindings-'+(i/75+1),'전체 타일 결합 '+(i/75+1),bindings+block(cells));}
const evidence=JSON.parse(fs.readFileSync(dir+'/validation-examples.json'));
let validation='# 자동 검증 · 정상/오류 좌표\n\n저장 전 프로젝트 JSON을 내보내 아래 읽기 전용 검사를 실행한다. 정답 표본과 같은 88×60 배치/이식 번호에만 적용한다. 다른 맵에서 나온 차이는 이 표본과 다르다는 뜻이다.\n\n```bash\nnode scripts/content/validate-dewbank-village.mjs exported-project.json dewbank_village\n```\n\n성공 exit0, 오류 exit1. errors는 최대128개, totalErrors는 전체 수. 실제 엔진 canMove 기반 타일 통행을 사용하고 이벤트 실행, NPC 충돌·전이 성공, 미적 품질은 검사하지 않는다. 외곽 오류는 승인 배열 비교이며 임의 그림의 방향 인식이 아니다. 등록 조립법은 편집기 validate_tile_recipes도 사용 가능하다.\n\n## 정상 결과\n'+block(evidence.normal);
for(const e of evidence.examples)validation+='\n## '+e.input.id+'\n'+block(e)+'\n![왼쪽 정상 / 오른쪽 오류](image:'+e.input.id+')\n';
doc('validation','자동 검증 · 5종 오류 비교',validation);
doc('layer-corrections','레이어 정정 · 패턴별 구분',`# 이전 설명 정정과 적용 범위

|오해를 부르는 설명|정확한 적용|
|---|---|
|모든 숲 줄기는 수관과 같은 행에서 시작한다|6행 forest-repeat 본체 하위는 3행째, 마감은 4행째. 이번 굽이숲의 3행 몸통은 마지막 수관과 같은 행에서 시작한다. 서로 다른 조립법이다.|
|상위 그림의 바탕 잔디까지 복사한다|소품 25종은 upper. 하위는 KEEP. 사전의 투명 조각에 미리보기 잔디를 붙이지 않는다.|
|투명 타일이면 모두 상위다|투명 여부·홈 레이어·받침·priority·통행은 별개. 몸통은 lower, 수관은 upper. 동굴893은 lower+받침652.|
|2610번은 공용 숲마을의 고정 소품 번호다|이 표본에서만 2610..2656. 원본 sourceChipset+sourceTile로 확인하고 새 시트에서는 빈 행부터 이식한다.|
|2칸 울타리를 잘라 모서리에 쓴다|이번 2×1은 고정 패널. 모서리는 공용 fence-gate의 378/380/438/410을 사용한다.|

기존 공용 문서/메타데이터의 99개 홈 레이어 정정은 recipes/layer-corrections.json, 설명 정정은 recipes/layer-prose-corrections.json 및 forestHarmony.ts가 관리한다. 이 자료집은 해당 정정을 취소하지 않는다. 사용자 편집 문서는 덮어쓰지 않는다.

![우물 쉼터](image:square)
![동쪽 정원](image:gardens)
`);
for(const id of ['house-wood','furniture-table','fence-gate','cave-cliff']){const source=fs.readFileSync(`tiledata/tilesets/forest_harmony/recipes/recipe-${id}.md`,'utf8');doc('appendix-'+id,'기본 조립 · '+id,source.replaceAll(/!\[[^\]]*\]\(image:[^)]+\)/g,'(그림은 정밀조립·검증 자료집의 같은 recipe 문서 참조)'));}
const images=fs.readdirSync(dir+'/images').filter(n=>n.endsWith('.png')).sort().map(n=>({id:n.slice(0,-4),name:n,caption:n==='village.png'?'승인 정본을 실제 타일 렌더러로 출력':n.includes('-')?'왼쪽 정상 / 오른쪽 변조, 빨간 칸이 오류 좌표':'전체 배치표에서 자른 실제 출력',dataUrl:'data:image/png;base64,'+fs.readFileSync(dir+'/images/'+n).toString('base64')}));
const category={id:'dewbank-village-v1',name:'이슬여울 · 25종 장식 조립',description:'승인 마을 88×60, 25종 85개 장식, 원본/이식 사전, 전체 레이어와 문앞, 숲 3행 조립, 5종 오류 좌표 검사',documents:docs,images};
for(const file of ['src/assets/forestHarmonyTileset.json','src/assets/sharedVillageObjects.json']){const j=JSON.parse(fs.readFileSync(file));j.referenceDocuments=[...(j.referenceDocuments??[]).filter(c=>c.id!==category.id),category];fs.writeFileSync(file,JSON.stringify(j)+'\n');}
console.log({documents:docs.length,images:images.length,maxDocument:Math.max(...docs.map(d=>d.markdown.length))});
