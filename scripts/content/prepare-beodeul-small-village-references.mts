import {smallBeodeulReferencePages} from './lib/beodeul-small-reference-pages.mjs';
import fs from 'node:fs';
import {createBlankProject} from '../../src/project/defaults.ts';
import {AUTHOR_BEODEUL_TOWN_TOOL} from '../../src/editor/tools/authorBeodeulTown.ts';
import {renderMapPng} from '../qa-game/render.mts';
const p=createBlankProject();
const result=AUTHOR_BEODEUL_TOWN_TOOL.run(p,{id:'map_small_village_reference',name:'버들 작은 마을',houseCount:5,seed:1004});
const m=p.maps.map_small_village_reference!,ts=p.tilesets.beodeul_city!;
const data=result.data as {housePlacements:Array<{kit:string;x:number;y:number;form:string;door:{x:number;y:number}}>};
const used=new Set([...(m.lowerTiles??[]),...(m.lowerOverlayTiles??[]),...(m.upperTiles??[]),...(m.upperOverlayTiles??[])]);
const usedGrafts=ts.tileGrafts?.filter(g=>used.has(g.targetTile));
const example={input:{houseCount:5,seed:1004},...data,width:m.width,height:m.height,tileSize:ts.tileSize,
 lowerTiles:m.lowerTiles,lowerOverlayTiles:m.lowerOverlayTiles,upperTiles:m.upperTiles,upperOverlayTiles:m.upperOverlayTiles,
 targetTileset:{id:ts.id,count:ts.count,tilesPerRow:ts.tilesPerRow,grafts:usedGrafts,
 graftRules:usedGrafts?.map(g=>({...g,priority:ts.priority[g.targetTile],passability:ts.passability[g.targetTile]}))}};
fs.writeFileSync('tiledata/beodeul-ground/small-village-example.json',JSON.stringify(example,null,2)+'\n');
fs.writeFileSync('public/assets/beodeul-ground/small-village-native.png',renderMapPng(p,m).png);
const lines=['# 작은 버들 마을 — 서로 다른 집 5채','',
 'author_beodeul_town({houseCount:5,seed:1004})는 40×30의 잔디 마을을 만든다. 3~5채를 지정할 수 있다.',
 '3/4 탑뷰는 원본 지붕 윗면을 보존한다. 측면은 필수 아님. 집 윤곽·도트 질감을 다시 그리지 않는다. 집당 문 1개, 벽 재질/색 콘셉트 1개, 기초 포함.',
 '원본 회벽·목골 별채집 7×6, 이층집 7×8, 사암 돌벽 박공집 4×6, 회벽·목골 ㄱ자집 8×8, 낮은 집 6×6. 원본 창틀 안의 창문과 중복 문만 고친다.',
 '기존 예제 5채는 refine_beodeul_village({mapId,church:true})로 보정한다. 새 마을은 author_beodeul_town({houseCount:5,church:true})로 교회를 추가할 수 있다(폭 54칸).',
 '새 마을 요청은 기존 맵을 지우지 않고 mapId를 생략한다. 집 count를 생략하면 기존 큰 테마 마을 경로다.',
 '원본 도시 칸 16px/128열. 공용 beodeul_architecture 16열과 beodeul_ground 8열 그림을 translateTiles로 이식한다. source와 map 번호는 다르다.',
 '순서: 밝은 잔디 → 원본 건물 → 우물·살림·나무 → 접지·잔디 꾸밈 → naturalize_beodeul_hamlet 큰길/광장·흙 접근로/마당·식생 구도 → 일광 보정.',
 '남쪽 집의 앞길은 벽 아래로 파고들지 않고 외곽을 돌아 샛길과 연결된다. 도구 반환 doors를 현재 canMove로 다시 확인한다.',
 '집 문 그림(parts.entrance), 문 앞 접근 칸(data.doors), 실제 실내 전이는 별개다. 이 소규모 도구는 실내·NPC·출입 이벤트를 만들지 않는다.',
 '수관 3×3 두 종류는 마지막 수관 줄의 가운데 칸에 ★ 줄기 연결을 덧그려 잘린 밑동을 잇는다. 기초 문 열은 투명이다.',
 '사막·눈·늪·포구는 해당 theme 생성기를 사용하며 이 잔디 작은 마을을 강제하지 않는다.',
 '풀 군락 사이 여백을 남긴다. 화단·빨래·장작은 집 곁, 우물은 중앙 마당, 나무는 가장자리와 집 사이 묶음으로 둔다.','',
 '| 집 | 외형 | 원점 | 문 앞 |','|---|---|---|---|',
 ...data.housePlacements.map(h=>`| ${h.kit} | ${h.form} | (${h.x},${h.y}) | (${h.door.x},${h.door.y}) |`),
 '', '## 이식된 3/4 건물 전체 배열'];
for(const h of data.housePlacements){const k=ts.structureKits!.find(k=>k.id===h.kit)!;
 lines.push(`### ${h.kit}`,`크기 ${k.width}×${k.height}, 아래층은 -1(원래 땅 보존), 홈 상위(3층). 벽/문 X, 지붕 ★는 원본 통행/우선순위를 따른다.`,
 '```json',JSON.stringify({lowerTiles:k.rows.map(r=>r.tiles),upperTiles:k.rows.map(r=>r.upperTiles),parts:k.parts},null,1),'```');}
fs.writeFileSync('tiledata/beodeul-ground/SMALL-VILLAGE.md',lines.join('\n')+'\n');
const refs=JSON.parse(fs.readFileSync('src/assets/beodeulGroundReferences.json','utf8'));
refs[0].documents=refs[0].documents.filter((d:{id:string})=>!['bd-ground-small-village','bd-ground-small-example'].includes(d.id)&&!d.id.startsWith('bd-ground-small-grafts'));
refs[0].images=refs[0].images.filter((i:{id:string})=>i.id!=='bd-ground-small-village-image');
refs[0].documents.push({id:'bd-ground-small-village',name:'집 5채의 소규모 마을·정확한 외형 사전',markdown:lines.join('\n')});
refs[0].documents.push(...smallBeodeulReferencePages(example));
refs[0].images.push({id:'bd-ground-small-village-image',name:'실제 5채 마을 전체 그림',caption:'640×480 원본 픽셀. 각 집 실루엣/문 앞길/군락/우물 마당을 확인한다.',dataUrl:'/assets/beodeul-ground/small-village-native.png'});
fs.writeFileSync('src/assets/beodeulGroundReferences.json',JSON.stringify(refs,null,2)+'\n');
console.log(JSON.stringify({houses:data.housePlacements.length,size:[m.width,m.height],grafts:ts.tileGrafts?.length}));
