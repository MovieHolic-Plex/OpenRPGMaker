import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync('src/assets/beodeulArchitectureCatalog.json','utf8'));
const lines=['# 버들항 민가·교회 — 원본 보존 사전','',
 '집당 문 하나, 벽 재질/색 콘셉트 하나. 창문은 집마다 다르다. 기와는 원본 픽셀 그대로 유지한다. stone의 삼각형 박공 벽 전체를 아래층과 같은 돌 재질로 정리하고 나무 기둥/사각 창 흔적을 제거해 중앙 원형창 하나만 둔다. 측면은 필수가 아니며 전체 재저작하지 않는다.',
 '공용 source tilesetId beodeul_architecture, image tex_beodeul_architecture, 16px/16열/'+catalog.count+'칸. source 칸 n의 픽셀 원점 (n%16*16, floor(n/16)*16).',
 '민가 5종과 교회 1종은 투명 배경 고정 키트. 홈은 3층 윗층, 아래층은 모두 -1로 기존 풀/포석을 보존한다. 기초는 원본 sourceKit별 공용 ground 레시피로 모든 집에 보강한다.',
 '작업 순서: 기존 맵/참고문서 읽기 → 새 마을은 author_beodeul_town({houseCount:5,church:true}), 기존 예제는 refine_beodeul_village({mapId,church:true}) → 화면 → 실제 canMove → 저장·재로드.',
 '새 작은 마을에 church:true를 주면 오른쪽 빈 띠에 교회와 마당을 연결하고 폭 54×30이 된다. 집 5채의 기존 원점과 문 앞은 그대로다.',
 '기존 보정은 원본 또는 이전 공용 보정 집 전체 배열이 정확히 맞는 것만 국소 보정한다. 이벤트가 달렸거나 새 지붕 자리/교회 띠가 점유돼 있으면 거부한다. 원래 문 열림/실내 시험 맵은 보정하지 않는다.',
 '이식은 translateTiles로 한다. source 칸 번호를 현재 map 번호로 추측하지 않는다. priority와 passability는 카탈로그 전체 표를 따른다. ★ 지붕/몸체 X와 문앞 접근은 별개다.',
 '문 그림은 건물 내부 parts.entrance, 문앞은 그 바로 아래. 실내·전이 이벤트는 별도이며 이 도구는 외장만 저작한다.',
 '시점 검사: npm run harness -- beodeul-architecture build → validate → review. 원본 알파 윤곽·지붕 픽셀 일치·박공 벽 마스크·허용 벽 수정 영역·시트 재조립을 비교한다. 기계 통과만으로 시각 합격을 선언하지 않는다.',
 '정상/오류: stone 중앙 원형창 vs 창을 관통하는 나무 기둥을 복구한 실제 변조. gable-post-through-window 코드, source-local 좌표 (1,3). 정상/변조 창 영역의 실제 픽셀을 대조한다. 완성 예제는 같은 용도의 작은 마을 전체 네 층 문서/이미지다.',
 '', '## source 전체 사전'];
for(const b of catalog.buildings){
 const front=b.parts.find(p=>p.kind==='entrance');
 lines.push(`### ${b.id} — ${b.name}`,`크기 ${b.width}×${b.height}, 창문 ${b.windowStyle}, 문 1개. 문 앞 상대 좌표 (${front.dx},${front.dy+front.h}).`,
 '```json',JSON.stringify({lowerTiles:b.rows.map(r=>r.map(()=>-1)),upperTiles:b.rows,parts:b.parts,perspective:b.perspective,gableCorrection:b.gableCorrection}), '```');
}
lines.push('## source 전체 우선순위/통행','```json',JSON.stringify({priority:catalog.priority,passability:catalog.passability}),'```');
fs.mkdirSync('tiledata/beodeul-architecture',{recursive:true});
fs.writeFileSync('tiledata/beodeul-architecture/README.md',lines.join('\n')+'\n');
const refs=JSON.parse(fs.readFileSync('src/assets/beodeulGroundReferences.json','utf8'));
const c=refs[0];c.documents=c.documents.filter(d=>d.id!=='bd-ground-architecture');c.images=c.images.filter(i=>!i.id.startsWith('bd-ground-architecture'));
c.documents.push({id:'bd-ground-architecture',name:'3/4 탑뷰 민가·교회·개별 창문·기초 사전',markdown:lines.join('\n')});
c.images.push({id:'bd-ground-architecture-image',name:'3/4 민가 5종과 교회',caption:'실제 source 그림. 원래 기와 픽셀/윤곽, 정리된 돌벽 박공과 중앙 원형창, 한 문, 국소 창문 보정을 확인한다.',dataUrl:'/assets/beodeul-architecture/buildings.png'},
 {id:'bd-ground-architecture-error',name:'정상/창을 관통하는 기둥 오류',caption:'왼쪽 정상·오른쪽 원형창을 관통하는 나무 기둥을 복구한 stone 집. gable-post-through-window (1,3).',dataUrl:'/assets/beodeul-architecture/normal-error.png'});
fs.writeFileSync('src/assets/beodeulGroundReferences.json',JSON.stringify(refs,null,2)+'\n');
console.log({documents:c.documents.length,images:c.images.length});
