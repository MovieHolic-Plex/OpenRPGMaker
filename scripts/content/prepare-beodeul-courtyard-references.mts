import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createBlankProject} from '../../src/project/defaults.ts';
import {AUTHOR_BEODEUL_TOWN_TOOL} from '../../src/editor/tools/authorBeodeulTown.ts';
import {composeBeodeulCourtyard,COURTYARD_HOUSES} from '../../src/editor/tools/beodeulCourtyardTools.ts';
import {refineBeodeulVegetation} from '../../src/editor/tools/beodeulVegetationTools.ts';
import {renderMapPng} from '../qa-game/render.mts';
import {smallBeodeulReferencePages} from './lib/beodeul-small-reference-pages.mjs';

const p=createBlankProject();
AUTHOR_BEODEUL_TOWN_TOOL.run(p,{id:'map_courtyard_reference',houseCount:5,church:true,seed:1004});
const result=composeBeodeulCourtyard(p,'map_courtyard_reference');
const vegetation=refineBeodeulVegetation(p,'map_courtyard_reference');
const m=p.maps.map_courtyard_reference!,ts=p.tilesets.beodeul_city!;
const used=new Set([...(m.lowerTiles??[]),...(m.lowerOverlayTiles??[]),...(m.upperTiles??[]),...(m.upperOverlayTiles??[])]);
const grafts=ts.tileGrafts!.filter(g=>used.has(g.targetTile));
const example={input:{houseCount:5,church:true,seed:1004,compose:'compose_beodeul_courtyard_village',vegetation:'refine_beodeul_courtyard_vegetation'},...result.data as object,vegetation:vegetation.data,
 width:m.width,height:m.height,tileSize:16,lowerTiles:m.lowerTiles,lowerOverlayTiles:m.lowerOverlayTiles,upperTiles:m.upperTiles,upperOverlayTiles:m.upperOverlayTiles,
 targetTileset:{id:ts.id,count:ts.count,tilesPerRow:ts.tilesPerRow,grafts,graftRules:grafts.map(g=>({...g,priority:ts.priority[g.targetTile],passability:ts.passability[g.targetTile]}))}};
// Keep ground and graft pages within the reference document storage cap.
const pages=smallBeodeulReferencePages({...example,support:undefined,daylight:undefined});
for(const page of pages){page.id=page.id.replace('small','courtyard');page.name=page.name.replace('작은 마을','공동마당 마을');page.markdown=page.markdown.replaceAll('640×480','864×544').replaceAll('작은 마을','공동마당 마을');}
fs.writeFileSync('tiledata/beodeul-ground/courtyard-example.json',JSON.stringify(example,null,2)+'\n');
fs.writeFileSync('tiledata/beodeul-ground/courtyard-native.png',renderMapPng({...p,startMapId:''},m).png);
execFileSync('convert',['tiledata/beodeul-ground/courtyard-native.png','-strip','-filter','point','-resize','820x820>','-dither','None','-colors','128','public/assets/beodeul-ground/courtyard-native.png']);
const md=['# 우물 공동마당 · 원본 민가 5채와 교회','',
 '단순 색/접지 보정으로는 집 사이의 생활 관계가 생기지 않는다. 이 예제는 북쪽 세 집이 우물·벤치·빨래 마당을 공유하고 남쪽 두 집은 장작/텃밭 곁에 자리 잡는다. 큰길은 공유 마당에서 교회 앞으로 이어지고 외곽 숲 사이에 입구를 남긴다.',
 '도구: compose_beodeul_courtyard_village({mapId}). 기존 배치를 바꾸라는 명시적 요청일 때만 사용한다. 54×30 예제의 원본 민가 5채+교회 전체 배열을 먼저 대조하고 54×34로 재배치한다. 이벤트/높이/별도 기물/외부 전이 도착점이 있으면 거부. 이미 새 위치에 모두 있으면 변경하지 않는다. 임의 마을/실내 제작 기능이 아니다.',
 '새 프로젝트 시공: author_beodeul_town({id,houseCount:5,church:true,seed:1004}) → compose_beodeul_courtyard_village({mapId:id}) → refine_beodeul_courtyard_vegetation({mapId:id}). 기존 공동마당의 식생/울타리 보정은 마지막 도구만 사용한다. 이전 템플릿 역시 공용이며 자동으로 재배치하지 않는다.',
 '밝은 원본 잔디 737, 원본 지붕 윗면/정면 벽/실루엣/창문/문 한 개를 유지하며 기와 픽셀은 이전 원본으로 복원. 측면은 필수 아님. 돌집의 박공 벽 전체를 같은 돌 재질로 정리하고 중앙 원형창을 하나만 둔다. 원본 수관을 지면 접점 y 순서로 겹친 숲과 높이 있는 풀 군락, 실제 텃밭 세 변의 연결 울타리를 적용한다. 별도 식생 깊이 문서가 칸·층·통행 계약을 설명한다.',
 '순서: 원본 전체 건물/나무/생활 기물 → 텃밭(2층) → dress_beodeul_ground 기초/밑동 → 공유 흙마당과 우물/교회 포석 → 외곽 초지/군락 → harmonizeBeodeulDaylight({roads:false,meadow:false}) 땅 그림자. 3×3 나무의 목/뿌리는 4층, 문 열의 기초는 투명, 지붕 ★ 통행은 원본 그대로.',
 'soil/stone/meadow 경계는 공용 bdg-hamlet-{kind}-{mask} 전체 칸(1층), N1/E2/S4/W8. 연결된 집합의 이웃으로 mask를 구한다. source 번호와 현재 project target 번호는 다르므로 translateTiles로 이식한다. vegetation-bed는 2층, 대부분 생활/나무는 3층, 기초/뿌리/풀 장식은 4층.',
 '현재 실제 PNG와 전체 4층 배열 및 graft 통행/우선순위 문서를 함께 확인한다. 미리 보기만으로 정본 저장이나 실제 게임 통행을 대체하지 않는다. 게임 시작은 우물 곁 (18,17). 문 앞 6곳을 canMove 경로로 확인하며 이 도구 자체는 출입 이벤트를 만들지 않는다.','',
 '| 건물 | 새 원점 | 이전 원점 |','|---|---|---|',...COURTYARD_HOUSES.map(h=>`| ${h.kit} | (${h.x},${h.y}) | (${h.oldX},${h.oldY}) |`),'',
 '## 정상/오류 좌표','정상: 북쪽 세 집은 흙마당에 연속해서 붙고 문 앞은 통행 가능. 오류: 집 아래 받침을 옛 위치에 남기기, 나무를 맵 밖으로 잘라 놓기, 문 앞에 통/벤치 두기, 매 집에 동일한 독립 직사각 흙마당 만들기. 새 위도/시점 그림으로 원본 건물을 다시 그리지 않는다.'].join('\n')+'\n';
fs.writeFileSync('tiledata/beodeul-ground/COURTYARD.md',md);
const refs=JSON.parse(fs.readFileSync('src/assets/beodeulGroundReferences.json','utf8'));
refs[0].documents=refs[0].documents.filter((d:{id:string})=>!d.id.startsWith('bd-ground-courtyard'));
refs[0].images=refs[0].images.filter((d:{id:string})=>d.id!=='bd-ground-courtyard-image');
refs[0].documents.push({id:'bd-ground-courtyard-guide',name:'우물 공동마당 · 생활/숲 경계 배치 계약',markdown:md},...pages);
refs[0].images.push({id:'bd-ground-courtyard-image',name:'공동마당 마을 · 실제 조립 학습 그림',caption:'원본 864×544 전체 4층 조립의 820px/128색 학습 사본. 세 집의 공유 마당, 우물·빨래, 숲과 밭 곁 두 집, 교회와 길. 게임 타일로 잘라 쓰지 않는다.',dataUrl:'/assets/beodeul-ground/courtyard-native.png'});
fs.writeFileSync('src/assets/beodeulGroundReferences.json',JSON.stringify(refs,null,2)+'\n');
console.log(JSON.stringify({size:[m.width,m.height],pages:pages.map(x=>({id:x.id,length:x.markdown.length})),placements:(result.data as any).placements.length}));
