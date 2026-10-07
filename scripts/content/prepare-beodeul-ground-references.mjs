import {smallBeodeulReferencePages} from './lib/beodeul-small-reference-pages.mjs';
import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/manifest.json','utf8'));
const example=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/example.json','utf8'));
const lines=['# 정확한 칸 배열','',`시트 ${catalog.texture}, 16px, 8열, ${catalog.count}칸. 배열은 원본 source 칸 번호다.`,
  '빈칸 -1은 기존 층을 보존한다. 일반 stamp_object 키트는 빈 잔디에만 쓴다. 집·나무 보강은 dress_beodeul_ground로 한다.',''];
for(const r of catalog.recipes){
 lines.push(`## ${r.id} · ${r.name}`,`크기 ${r.width}×${r.height}, 도구의 홈 층 ${r.layer}, 통·장작 몸통 차단 ${r.blocked}.`);
 const empty=Array.from({length:r.height},()=>Array(r.width).fill(-1));
 lines.push('```json',JSON.stringify({anchor:r.anchor,dx:r.dx,dy:r.dy,baseTile:r.baseTile,variant:r.variant,kind:r.kind,mask:r.mask,blockingCells:r.blockingCells,upperCells:r.upperCells,anchors:r.anchors,overlapPixels:r.overlapPixels,lowerTiles:r.layer===1?r.rows:empty,lowerOverlayTiles:r.layer===2?r.rows:empty,
   upperTiles:r.layer===3?r.rows:empty,upperOverlayTiles:r.layer===4?r.rows:empty},null,2),'```','');
}
lines.push('## 전체 조립 예제','버들항 시트에 밑동 칸을 이식한 3×4 완성 맵. 원본 737 잔디는 그대로다.','```json',JSON.stringify(example,null,2),'```');
const markdown=lines.join('\n')+'\n';fs.writeFileSync('tiledata/beodeul-ground/CATALOG.md',markdown);
const refs=[{id:'beodeul-ground-dressing',name:'버들항 · 밝은 잔디 접지·꾸미기',description:'얇은 기초·밑동·풀/꽃 군락과 집 곁 생활 흔적. 실제 덧그림 도구와 원본 보존.',
 documents:[{id:'bd-ground-guide',name:'접지·군락·출입 보호 지침',markdown:fs.readFileSync('tiledata/beodeul-ground/README.md','utf8')},
 {id:'bd-ground-catalog',name:'정확한 칸 배열·전체 조립',markdown}],
 images:[{id:'bd-ground-atlas',name:'실제 공용 칸 전체',caption:`8열×${catalog.count/8}행, 원본 128×${catalog.count/8*16}의 4배 최근접 확대. 아래 배열로 조립한다.`,dataUrl:'/assets/beodeul-ground/atlas.png'},
 {id:'bd-ground-errors',name:'밑동 조립 정상/오류',caption:'왼쪽 정상, 오른쪽 missing-root(1,3). 실제 시트 조립의 6배 확대.',dataUrl:'/assets/beodeul-ground/normal-error.png'}]}];
// Preserve the additional small-village source pages when rebuilding the basic reference pack.
if(fs.existsSync('tiledata/beodeul-ground/SMALL-VILLAGE.md')&&fs.existsSync('tiledata/beodeul-ground/small-village-example.json')){
 refs[0].documents.push({id:'bd-ground-small-village',name:'집 5채의 소규모 마을·정확한 외형 사전',markdown:fs.readFileSync('tiledata/beodeul-ground/SMALL-VILLAGE.md','utf8')});
 refs[0].documents.push(...smallBeodeulReferencePages(JSON.parse(fs.readFileSync('tiledata/beodeul-ground/small-village-example.json','utf8'))));
 refs[0].images.push({id:'bd-ground-small-village-image',name:'실제 5채 마을 전체 그림',caption:'640×480 원본 픽셀. 각 집 실루엣/문 앞길/군락/우물 마당을 확인한다.',dataUrl:'/assets/beodeul-ground/small-village-native.png'});
}
if(fs.existsSync('tiledata/beodeul-architecture/README.md')){
 refs[0].documents.push({id:'bd-ground-architecture',name:'3/4 탑뷰 민가·교회·개별 창문·기초 사전',markdown:fs.readFileSync('tiledata/beodeul-architecture/README.md','utf8')});
 refs[0].images.push({id:'bd-ground-architecture-image',name:'3/4 민가 5종과 교회',caption:'실제 source 그림. 원래 지붕·윤곽·도트, 한 문, 국소 창문 보정을 확인한다.',dataUrl:'/assets/beodeul-architecture/buildings.png'},
 {id:'bd-ground-architecture-error',name:'정상/원본 지붕 변경 오류',caption:'왼쪽 정상·오른쪽 원본 지붕을 부분 재칠한 brick 집. native-roof-changed (1,1).',dataUrl:'/assets/beodeul-architecture/normal-error.png'});
}
if(fs.existsSync('tiledata/beodeul-ground/DAYLIGHT.md')){
 refs[0].documents.push({id:'bd-ground-daylight',name:'일광·접촉 그림자·연석·잔디 변화',markdown:fs.readFileSync('tiledata/beodeul-ground/DAYLIGHT.md','utf8')});
 refs[0].images.push({id:'bd-ground-daylight-image',name:'원본 집·나무와 실제 땅 그림자',caption:'왼쪽 위 광원, 짧은 투사 그림자와 짙은 밑동 접촉. 실제 공용 source 픽셀을 원본과 합성했다.',dataUrl:'/assets/beodeul-ground/lighting-preview.png'},
 {id:'bd-ground-daylight-error',name:'정상/그림자 누락 오류',caption:'실제 source 그림자 칸(0,1)을 지운 변조. 예제 맵(0,6)의 집 밑 그늘이 끊긴다. missing-cast-shadow.',dataUrl:'/assets/beodeul-ground/lighting-normal-error.png'});
}
if(fs.existsSync('tiledata/beodeul-ground/COURTYARD.md')&&fs.existsSync('tiledata/beodeul-ground/courtyard-example.json')){
 const example=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/courtyard-example.json','utf8'));
 refs[0].documents.push({id:'bd-ground-courtyard-guide',name:'우물 공동마당 · 생활/숲 경계 배치 계약',markdown:fs.readFileSync('tiledata/beodeul-ground/COURTYARD.md','utf8')});
 const pages=smallBeodeulReferencePages({...example,support:undefined,daylight:undefined});
 for(const p of pages){p.id=p.id.replace('small','courtyard');p.name=p.name.replace('작은 마을','공동마당 마을');p.markdown=p.markdown.replaceAll('640×480','864×544').replaceAll('작은 마을','공동마당 마을');}
 refs[0].documents.push(...pages);
 refs[0].images.push({id:'bd-ground-courtyard-image',name:'공동마당 마을 · 실제 조립 학습 그림',caption:'원본 864×544 전체 4층 조립의 820px/128색 학습 사본. 세 집의 공유 마당, 우물·빨래, 숲과 밭 곁 두 집, 교회와 길. 게임 타일로 잘라 쓰지 않는다.',dataUrl:'/assets/beodeul-ground/courtyard-native.png'});
}
if(fs.existsSync('tiledata/beodeul-ground/HAMLET.md')){
 refs[0].documents.push({id:'bd-ground-hamlet',name:'작은 마을 · 큰길/흙 접근로/마당/식생 구도',markdown:fs.readFileSync('tiledata/beodeul-ground/HAMLET.md','utf8')});
 refs[0].images.push({id:'bd-ground-hamlet-error',name:'흙마당 정상/잔디 경계 누락 오류',caption:'왼쪽 정상, 오른쪽 좌상단의 edge mask6을 interior15로 바꾼 실제 오류. grass-transition-missing (0,0).',dataUrl:'/assets/beodeul-ground/hamlet-normal-error.png'});
}
if(fs.existsSync('tiledata/beodeul-ground/river-town-references.json')){
 const river=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/river-town-references.json','utf8'));
 refs[0].documents.push(...river.documents);refs[0].images.push(...river.images);
}
if(fs.existsSync('tiledata/beodeul-ground/village50-references.json')){
 const village=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/village50-references.json','utf8'));
 refs[0].documents.push(...village.documents);refs[0].images.push(...village.images);
}
if(fs.existsSync('tiledata/beodeul-ground/palette-standard-references.json')){
 const palette=JSON.parse(fs.readFileSync('tiledata/beodeul-ground/palette-standard-references.json','utf8'));
 refs[0].documents.push(...palette.documents);refs[0].images.push(...palette.images);
}
if(fs.existsSync('tiledata/beodeul-ground/WOODLAND.md')){
 refs[0].documents.push({id:'bd-ground-woodland',name:'나무 겹침·풀 높이·연결 울타리·단일 돌벽',markdown:fs.readFileSync('tiledata/beodeul-ground/WOODLAND.md','utf8')});
 refs[0].images.push({id:'bd-ground-woodland-error',name:'수관 앞뒤 합성 정상/오류',caption:'왼쪽 정상 · 오른쪽 동일 나무를 역순으로 합성해 뒤 수관이 앞 나무를 덮은 오류. source-local 좌표는 woodland-errors.json.',dataUrl:'/assets/beodeul-ground/woodland-normal-error.png'});
}
fs.writeFileSync('src/assets/beodeulGroundReferences.json',JSON.stringify(refs,null,2)+'\n');
