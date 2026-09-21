// Build the shipped references from executable data. Does not write to a remote database.
import fs from 'node:fs';
const root='tiledata/castle-tiles-rpgs/executable',catalog=JSON.parse(fs.readFileSync('src/assets/tileAssemblyCatalog.json'));
const read=n=>fs.readFileSync(root+'/'+n,'utf8'),json=n=>'```json\n'+read(n)+'\n```';
const intro=`# 정확한 부품으로 조립하고 좌표로 검증하기

단위는 픽셀이 아니라 0부터 시작하는 맵/아틀라스 셀입니다. Castle2는 16px·32열, forest_harmony는 16px·30열입니다. 번호를 서로 복사하지 않습니다. 원본과 파생 아틀라스도 구별합니다.

## 작업 순서
1. 해당 칩셋의 참고문서를 모든 페이지와 이미지까지 읽습니다. 이 용도 ID는 tile-assembly-executable 입니다.
2. get_tile_assembly_part(partId)로 필요한 부품의 현재 고정 배열을 받습니다. sourceCells는 각 타일의 실제 아틀라스 x/y이며 비연속 조각도 생략하지 않습니다.
3. 입력 영역이 조립 조건을 만족하는지 확인합니다. 폭/높이를 맞추려고 마감·줄기·뿌리를 자르지 않습니다.
4. preview_forest_strip으로 배치 계획과 출력 배열을 받습니다. 이 도구는 미리보기만 하며 실제 맵을 변경하지 않습니다.
5. 정상 타일 편집 도구로 lower/upper를 적용합니다. 저장 전에 validate_tile_assembly로 같은 plan과 실제 mapId를 대조합니다.
6. 오류의 x/y/layer를 고쳐 재검사합니다. 전체 그림과 실제 통행도 별도로 확인합니다.

## 부품 배열 계약
lowerTiles와 upperTiles는 행 우선 2차원 배열입니다. flat[y*width+x]가 같은 셀입니다. sourceRect가 있는 성채 부품은 원본의 연속 사각형이며, sourceCells는 마스크 적용 후의 정확한 좌표입니다.
- -1은 빈 슬롯입니다. 단독 성채 소품에서는 그 칸을 덮지 않습니다.
- 숲 혼합 레이어 패치는 lower 배열을 쓰고 upper=-1도 비웁니다. 예전 수관이 뿌리 위에 남으면 안 됩니다.
- 합성 스택이 있으면 해당 셀의 스택도 비웁니다. 검증은 스택 맨 위까지 확인합니다.
- 문 부품은 외관입니다. 문을 그렸다는 이유로 통행/전송이 생기지 않습니다.

## 검증 한계
선언한 plan의 부품을 검사합니다. 선언하지 않은 나무를 이미지 인식으로 찾아내는 기능은 아닙니다. 출입구는 명시한 인접 from 좌표에서 입구로 한 칸 이동 가능한지 canMove로 검사합니다. 전체 경로 연결과 전송 이벤트는 별도 검증해야 합니다. NPC는 조건과 무관하게 same 우선순위 페이지가 하나라도 있으면 보수적으로 막힘으로 보고합니다.
`;
const recipe=`# 그대로 실행하는 남향 숲 띠

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
${fs.readFileSync('src/project/tileAssemblyGuide.ts','utf8')}
~~~
`;
const examples='# 입력·출력 전체 예제\n\n20×12 맵의 지면은 모두 1145, upper는 모두 -1에서 시작합니다. 입력은 아래와 같습니다. 생략된 배열 요소가 없습니다.\n\n'+json('input.json')+'\n\n## 실행 계획\n'+json('plan.json')+'\n\n## 기대 최종 맵 배열\n'+json('output.json')+'\n\n## 배열에서 실제 타일을 그린 완성 이미지\n![남향 숲 조립 완성](image:forest-strip-output)\n\n검증된 조립 표본이며 자연스러운 마을 전체의 완성도 승인을 뜻하지 않습니다.\n';
const validation='# 오류를 좌표로 돌려주는 자동 검증\n\nvalidate_tile_assembly({mapId,plan})를 실제 편집 중 맵에 호출합니다.\n\n- CUT_ROOT: 필수 마지막 뿌리 행의 불일치 또는 맵 밖 잘림.\n- MISSING_TRUNK: 선언된 나무 중간 행 불일치(삭제·대체 포함).\n- REVERSED_EDGE: 왼쪽 마감에 오른쪽 마감 타일을 사용하거나 그 반대.\n- BLOCKED_ENTRANCE: 엔진 통행 또는 이벤트 점유가 지정 접근을 막음.\n- PART_MISMATCH/OUT_OF_BOUNDS: 기타 부품 누락·잘못된 좌표.\n\nexpected/actual은 타일 번호, x/y는 실제 맵 좌표입니다. 출입구 오류는 그림 번호가 아닌 통행 판정이므로 expected/actual 대신 이유가 반환됩니다. valid는 이 계획의 검사 범위에만 적용됩니다.\n\n## 정상 및 실제 오류 주입 결과\n'+json('validation-examples.json');
const docs=[['start','00-실행 순서.md',intro],['recipe','01-숲 조립법.md',recipe],['example','02-입출력 전체 예제.md',examples],['validation','03-자동 검증과 오류 좌표.md',validation]].map(([id,name,markdown])=>({id,name,markdown}));
for(const p of catalog.parts)docs.push({id:p.id.replace(':','-'),name:p.id+' 부품 사전.md',markdown:'# '+p.id+'\n\n원본 좌표, 전체 크기, 레이어, 마스크와 타일 배열:\n\n```json\n'+JSON.stringify(p,null,2)+'\n```'});
for(const d of docs){if(d.markdown.length>120000)throw Error('Document too large');fs.writeFileSync(root+'/'+d.id+'.md',d.markdown);}
const category={id:'tile-assembly-executable',name:'실행형 부품·조립·검증',description:'성채/공용 숲의 정확한 셀 사전, 남향 숲 띠 실행 코드, 완성 배열과 이미지, 네 가지 오류의 좌표 반환.',documents:docs,images:[{id:'forest-strip-output',name:'숲 조립 완성.png',caption:'forest_harmony · (3,2,14,6) 남향 숲, 20×12 전체 배열 렌더',dataUrl:'data:image/png;base64,'+fs.readFileSync(root+'/forest-output.png').toString('base64')}]};
fs.writeFileSync(root+'/category.json',JSON.stringify(category));
for(const file of ['src/assets/sharedCastleReferences.json','src/assets/forestHarmonyTileset.json']){const p=JSON.parse(fs.readFileSync(file)),refs=Array.isArray(p)?p:p.referenceDocuments;const next=[...refs.filter(c=>c.id!==category.id),category];fs.writeFileSync(file,JSON.stringify(Array.isArray(p)?next:{...p,referenceDocuments:next}));}
for(const name of fs.readdirSync('public/assets/region-references').filter(n=>n.endsWith('.oprn.json'))){const file='public/assets/region-references/'+name,p=JSON.parse(fs.readFileSync(file));let changed=false;for(const t of Object.values(p.tilesets??{})){if(!['opengameart_castle','castle_courtyard_harbor','forest_harmony'].includes(t.id)||t.referenceSourceTilesetId)continue;t.referenceDocuments=[...(t.referenceDocuments??[]).filter(c=>c.id!==category.id),category];changed=true;}if(changed)fs.writeFileSync(file,JSON.stringify(p));}
console.log('Shipped executable category: '+docs.length+' documents / 1 rendered image');
