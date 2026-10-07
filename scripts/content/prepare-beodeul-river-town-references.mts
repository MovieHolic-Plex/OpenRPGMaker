import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {renderMapPng} from '../qa-game/render.mts';
import {canMove} from '../../src/project/collision.ts';
import {layerTileAt,setLayerTileAt} from '../../src/project/mapLayers.ts';
const p=JSON.parse(fs.readFileSync('output/beodeul-river-town/preview-project.json','utf8'));
const result=JSON.parse(fs.readFileSync('output/beodeul-river-town/build-result.json','utf8'));
const m=p.maps[result.mapId],ts=p.tilesets[m.tilesetId];
const root='tiledata/beodeul-ground',publicDir='public/assets/beodeul-ground';
fs.writeFileSync(`${root}/river-town-native.png`,renderMapPng({...p,startMapId:''},m).png);
execFileSync('convert',[`${root}/river-town-native.png`,'-strip','-filter','point','-resize','820x820>','-dither','None','-colors','128',`${publicDir}/river-town-native.png`]);
const used=new Set([...(m.lowerTiles??[]),...(m.lowerOverlayTiles??[]),...(m.upperTiles??[]),...(m.upperOverlayTiles??[])]);
const grafts=ts.tileGrafts.filter(g=>used.has(g.targetTile));
const sourceKits=ts.structureKits.filter(k=>result.placements.some(a=>a.kit===k.id));
const guide=`# 물굽이 마을 · 건물군/세 갈래 큰길/세 다리\n\n사용자 제공 마을 구도 그림에서 길의 위계와 물길로 나뉜 구역 관계를 적용한 버들항 실제 맵이다. 원본 그림을 게임 소재로 잘라 쓰거나 건물 그림을 재저작하지 않는다.\n\n76×70, 16px. 건물 ${result.fronts.length}개(민가/회관/주막/대장간/교회), 다리 3개. 집을 떨어뜨린 잔디 필지가 아니라 2~4개 건물이 붙은 작은 건물군과 공유 흙마당으로 구성한다. 큰 포석 길은 서문-중앙 우물-동쪽 분기/남쪽 고리, 북쪽 큰길은 회관 곁으로 이어진다. 흙 골목은 좁게 만들며 모든 실제 문앞을 연결한다. 물굽이 서쪽 교회 구역과 주거 구역이 다리로 연결된다. 외곽 합성 숲/완전한 원본 줄기 나무는 길/물/건물의 실제 윗층을 덮지 않는다.\n\n재현 입구: scripts/content/lib/beodeul-river-town.mts의 buildBeodeulRiverTown(project,newMapId). 반드시 새 맵으로 만든다. 기존 맵을 재시공하지 않는다. 기존 기와/stone 박공 정리/문 1개/3/4 탑뷰를 그대로 사용한다. 기존 source 조각은 현재 프로젝트 참고문서 beodeul-city-pieces와 beodeul-ground-dressing에서 MD 전체와 실제 그림을 먼저 읽는다.\n\n시공: 물/큰길 예약 → 완전한 건물 → 길/사유 접근로/연속 마당 → 예약 물을 named material 버들항 강·운하 물로 fill_region → 아치 다리 완전체 → 식생/기물 → 공용 기초/짧은 일광 그림자. 오토타일의 자동 틈 메움 때문에 물 그림은 길 다음에 적용한다. 물을 거쳐 가는 문앞 접근로로 집 배치 오류를 숨기지 않는다.\n\n아치 다리 bd-bridge-arch는 4×5이며 동서 갑판은 원점 y+1/y+2의 두 줄뿐이다. 세 원점: ${JSON.stringify(result.bridges)}. 이 강은 각 다리 자리에서 남북 4칸 폭이다. 굽이를 가로지르는 비스듬한 다리, 다리 없는 물 건너 길은 이 표본에 없다. 갑판/양쪽 둑 실제 canMove와 모든 문앞 착지 칸을 검사한다.\n\n목표를 source 번호로 현재 map에 직접 칠하지 않는다. 아래 층별 target 배열은 이 정확한 예제 전용이며 사용한 모든 graft의 source 텍스처/칸/우선순위/통행을 별도 문서로 제공한다. 공용 조각은 translateTiles로 이식한다. 기와/건물은 3층, 기초/접점 풀은 4층, 낮은 그림자는 2층, 길/물/다리 갑판은 1층이다.\n\n정상/오류: bridge-deck-missing, 첫 다리 target-local (24,12). 실제 맵의 4×2 갑판을 원래 물 칸으로 교체한 오류와 정상 다리를 같은 좌표로 렌더한다. 정상 canMove (23,12)→(24,12)는 true, 오류는 false다.\n\n시작 (${result.start.x},${result.start.y}). 외장/길 예제이며 새 실내/전이 이벤트는 별도로 만든다. 화면 검수 후 실제 프로젝트 SQLite 저장/재로드가 완료 조건이다.\n\n## 모든 입구\n\n| 건물 | 문앞 x | 문앞 y | 구역 |\n|---|---|---|---|\n${result.fronts.map(f=>`| ${f.kit} | ${f.x} | ${f.y} | ${f.district} |`).join('\n')}\n`;
const docs=[{id:'bd-ground-river-town-guide',name:'조밀한 물굽이 마을 · 시공/다리/구역 지침',markdown:guide}];
for(const [layer,key] of [[1,'lowerTiles'],[2,'lowerOverlayTiles'],[3,'upperTiles'],[4,'upperOverlayTiles']] as const){
 docs.push({id:`bd-ground-river-town-layer-${layer}`,name:`물굽이 마을 전체 ${layer}층 배열`,markdown:`# ${layer}층 전체 target 배열\n\n76×70, 16px. 빈 칸 -1. 배열 인덱스 y*76+x. source 이식표/우선순위/통행은 동일 접두어 문서를 모두 읽는다.\n\n\x60\x60\x60json\n${JSON.stringify({mapId:m.id,width:m.width,height:m.height,tilesetId:m.tilesetId,layer,tiles:m[key]??Array(m.width*m.height).fill(-1)})}\n\x60\x60\x60`});
}
docs.push({id:'bd-ground-river-town-kits',name:'물굽이 마을 사용 키트/입구/전체 조각 배열',markdown:'# 사용 target 키트 전체\n\nparts와 전체 rows를 생략하지 않는다. 각 문 앞은 entrance.dy+h다.\n```json\n'+JSON.stringify({placements:result.placements,kits:sourceKits})+'\n```'});
for(let i=0;i<grafts.length;i+=300)docs.push({id:`bd-ground-river-town-grafts-${i/300+1}`,name:`물굽이 마을 source 이식 규칙 ${i/300+1}`,markdown:'# 사용한 모든 source→target 칸\n\n다음 번호 문서까지 모두 읽는다. source 좌표는 각 텍스처의 tileSize/tilesPerRow로 계산한다.\n```json\n'+JSON.stringify({tilesetId:ts.id,count:ts.count,tilesPerRow:ts.tilesPerRow,offset:i,total:grafts.length,graftRules:grafts.slice(i,i+300).map(g=>({...g,priority:ts.priority[g.targetTile],passability:ts.passability[g.targetTile]}))})+'\n```'});
assert(docs.every(d=>d.markdown.length<=120000));
const bad=structuredClone(p),bm=bad.maps[m.id],b=result.bridges[0],waterTile=layerTileAt(m,1,(b.y-1)*m.width+b.x);
assert(canMove(p,m,b.x-1,b.y+1,b.x,b.y+1));
for(let y=b.y+1;y<=b.y+2;y++)for(let x=b.x;x<b.x+4;x++)setLayerTileAt(bm,1,y*m.width+x,waterTile);
assert(!canMove(bad,bm,b.x-1,b.y+1,b.x,b.y+1));
fs.writeFileSync('output/beodeul-river-town/bad-bridge.png',renderMapPng({...bad,startMapId:''},bm).png);
execFileSync('python',['-c',`from PIL import Image\na=Image.open('${root}/river-town-native.png');b=Image.open('output/beodeul-river-town/bad-bridge.png');box=(23*16,10*16,29*16,17*16);a=a.crop(box);b=b.crop(box);c=Image.new('RGB',(200,112),'#588a39');c.paste(a,(0,0));c.paste(b,(104,0));c.resize((600,336),Image.Resampling.NEAREST).save('${publicDir}/river-town-normal-error.png')`]);
const images=[{id:'bd-ground-river-town-image',name:'물굽이 마을 실제 전체 조립',caption:'실제 1216×1120 네 층 조립의 820px/128색 학습 사본. 건물군/공유 마당/길 위계/세 다리/교회 구역. 게임 타일로 잘라 쓰지 않는다.',dataUrl:'/assets/beodeul-ground/river-town-native.png'},
 {id:'bd-ground-river-town-error',name:'다리 정상/갑판 누락 오류',caption:'왼쪽 정상·오른쪽 같은 map (24,12)의 4×2 갑판을 실제 물로 교체. bridge-deck-missing, 실제 canMove true→false.',dataUrl:'/assets/beodeul-ground/river-town-normal-error.png'}];
fs.writeFileSync(`${root}/RIVER-TOWN.md`,guide);fs.writeFileSync(`${root}/river-town-example.json`,JSON.stringify({result,map:m,sourceKits,grafts},null,2));
fs.writeFileSync(`${root}/river-town-references.json`,JSON.stringify({documents:docs,images},null,2));
const refs=JSON.parse(fs.readFileSync('src/assets/beodeulGroundReferences.json','utf8'));
refs[0].documents=refs[0].documents.filter(d=>!d.id.startsWith('bd-ground-river-town'));refs[0].images=refs[0].images.filter(i=>!i.id.startsWith('bd-ground-river-town'));
refs[0].documents.push(...docs);refs[0].images.push(...images);fs.writeFileSync('src/assets/beodeulGroundReferences.json',JSON.stringify(refs,null,2)+'\n');
console.log(JSON.stringify({pages:docs.map(d=>[d.id,d.markdown.length]),images:images.length,bridgeMutationDetected:true}));
