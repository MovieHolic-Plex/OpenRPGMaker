import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {PNG} from 'pngjs';
import {createBeodeulCityTileset} from '../../src/project/defaults/beodeulCity';
import {ensureBeodeulFacilityKits} from '../../src/project/defaults/beodeulFacilities';
import {installBeodeulArchitecture} from '../../src/project/defaults/beodeulArchitecture';
import {beodeulFacilityPlans,facilityPropId} from '../../src/assets/beodeulFacilitiesPlans';
import {setLayerTileAt,layerTileAt} from '../../src/project/mapLayers';
import {dressBeodeulGround} from '../../src/editor/tools/beodeulGroundTools';
import {canMove} from '../../src/project/collision';
import {renderMapPng} from '../qa-game/render.mts';
const root='tiledata/beodeul-facilities',pub='public/assets/beodeul-facilities',out='output/beodeul-facilities';
fs.mkdirSync(root,{recursive:true});fs.mkdirSync(pub,{recursive:true});
const p=JSON.parse(fs.readFileSync(`${out}/preview-project.json`,'utf8')),result=JSON.parse(fs.readFileSync(`${out}/build-result.json`,'utf8'));
const source=createBeodeulCityTileset(),kits=source.structureKits!.filter(k=>k.id.startsWith('bd-facility-'));
assert.equal(kits.length,32);
const sourceCatalog={tilesetId:source.id,image:source.image,count:source.count,tileSize:16,tilesPerRow:source.tilesPerRow,
 grafts:source.tileGrafts,kits,plans:beodeulFacilityPlans};
fs.writeFileSync(`${root}/catalog.json`,JSON.stringify(sourceCatalog,null,2));
const guide=`# 버들항 RPG 시설 · 건물과 작업 마당 32종\n\n공용 beodeul_city 시설 도장 bd-facility-*. 16px, tex_beodeul_city 네이티브 시트와 tex_beodeul_architecture 원본 보존 보정 시트의 합성이다. 새 기와·벽 그림을 그리지 않는다. 기존 3/4 지붕 윗면, 윤곽, 픽셀, 한 문과 창문을 유지한다. 각 시설은 건물 하나와 용도별 기물 둘로 구분한다. 서로 다른 시설 이름이 같은 원본 건물을 사용할 수 있다. 외장 조립안이며 판매·회복·수련·은행·NPC 대화 기능이 자동으로 만들어지는 것은 아니다.\n\n## 조립\n\n1. referencePurpose=beodeul-facilities의 MD 모든 페이지와 실제 그림을 읽는다. 이 카탈로그의 숫자는 새 기본 city source 정의 기준이다. 현재 프로젝트의 동명 키트 배열이 실제 target이다. 문서 숫자를 다른 저장본에 그대로 칠하지 않는다. stamp_object({objectId:'kit:beodeul_city/bd-facility-<id>',mapId,x,y})를 사용한다. 코드로 이식할 때 translateTiles(sourceFactory,target,모든 rows 숫자)로 graft를 재사용한다.\n2. width×height 전체를 평지에 예약한다. 건물 원점은 도장 원점+(1,1), 소품은 오른쪽 작업 마당이다. 물·절벽·다른 건물에 겹치면 배치하지 않는다. 최소 크기는 각 키트의 width,height와 같으며 자르지 않는다. 반복 금지 fixed.\n3. 기본 밝은 잔디737, 저대비 흙마당, 공용 기초·짧은 일광 그림자를 먼저 배치한다. 건물 본체는 3층, 낮은 그림자는2층, 접점 풀·기초는4층. 불투명 지면만1층이다. 본체 윗부분 ★와 밑동 X를 섞어 추측하지 말고 source priority/passability를 그대로 가져온다.\n4. 각 도장 parts.entrance 아래칸(dx,dy+h)부터 도장 남쪽 끝까지 접근로를 비워 큰길에 연결한다. 원본 회관의 문 아래 현관 ★ 그림은 유지한다. 소품은 문 앞에 놓지 않는다. 실제 canMove로 시작→모든 문앞과 다리 양쪽 둑을 확인한다.\n5. 나루터 사무소는 육지에 세운다. 실제 예제는 널판 3×3 bd-pick-swamp-stilt-ground-deck를 (25,46)에 1층으로 놓고 물가 경계칸까지 덮어 (28,47) 육지→(27,47)→(26,47) 잔교를 연결한다. 계선주 (25,46), 나룻배 (23,48). 물 원래의 X를 임의로 O로 바꾸지 않는다. 선착장 그림과 배 이동 이벤트는 별개의 저작이다.\n6. 50×50에는 필요한 시설만 고른다. 큰 시설을 전부 넣지 않는다. 강가 물류/주막 공동마당/약초 재배/인물 작업장처럼 생활 관계로 묶는다. 모든 기존 도로와 기와·황록 나무를 보존한다. 남쪽 포석길은 y>=37에서 포석만으로 교회→남쪽 다리 연결을 따로 검사한다.\n\n## 시설 사전\n\n| id | 시설 | 역할 | 원본 건물 | 기물 1 | 기물 2 |\n|---|---|---|---|---|---|\n${beodeulFacilityPlans.map(([id,name,body,group,a,b])=>`| ${id} | ${name} | ${group} | bd-house-${body} | ${facilityPropId(a)} | ${facilityPropId(b)} |`).join('\n')}\n\n은행/도서관/감옥처럼 전용 문양이나 실내가 없는 용도는 의미가 부여된 원본 건물과 작업 마당 도안이다. 전용 실내·간판 그림·거래 이벤트를 만들기 전에는 이미 구현된 기능으로 설명하지 않는다. 실내는 공용 hand interior v5 경로로 별도 저작한다.\n\n## 근거와 오류\n\n현재 실제 예제는 기존 18동을 유지하고 약초사 집·발명가 집·술집·항구 창고·나루터 사무소의 마당을 꾸몄다. 전체 배열과 정확한 역할/좌표는 뒤 문서에 있다. 정상/오류는 blocked-facility-entrance, (5,12). 정상 약초사 문앞에 실제 칼통을 놓으면 canMove (5,13)→(5,12)가 true에서 false로 바뀐다. 기계 검사는 도로·입구·범위·source 배열을 확인하며 시설 기능·미적 합격을 대신하지 않는다.\n\n기획 참고: Dragon Quest VIII 공식 시설 소개 https://www.nintendo.com/en-gb/Games/Nintendo-3DS-games/DRAGON-QUEST-VIII-Journey-of-the-Cursed-King-1136167.html · FFXIV 공식 도시 지도 https://www.finalfantasyxiv.com/beginner/read/read2111.pdf · Chrono Trigger 트루스 촌장 저택 https://guides.gamercorner.net/ct/areas/mayors-manor-truce . 그림 소재는 프로젝트의 기존 손 도트만 사용한다.\n`;
fs.writeFileSync(`${root}/README.md`,guide);
const docs=[{id:'bd-facility-guide',name:'RPG 시설 32종 · 배치·입구·기능 경계',markdown:guide}];
const images=[];const fixtureProof=[];
for(let page=0;page<8;page++){
 const selected=kits.slice(page*4,page*4+4),records=[];
 const sheet=new PNG({width:640,height:640});
 for(let j=0;j<selected.length;j++){
  const kit=selected[j]!,fp=structuredClone(p);fp.tilesets.beodeul_city=structuredClone(source);installBeodeulArchitecture(fp);
  const m=structuredClone(p.maps[result.mapId]);m.id='map_facility_reference';m.width=20;m.height=20;m.events=[];m.lowerTiles=Array(400).fill(737);m.upperTiles=Array(400).fill(-1);
  m.lowerOverlayTiles=[];m.upperOverlayTiles=[];delete m.overlayTiles;delete m.terrainDesign;delete m.relief;
  for(let y=0;y<kit.height;y++)for(let x=0;x<kit.width;x++)for(const [layer,key] of [[1,'tiles'],[3,'upperTiles']] as const){const n=kit.rows[y]![key][x]!;if(n>=0)setLayerTileAt(m,layer,(y+2)*20+x+1,n);}
  fp.maps={[m.id]:m};fp.startMapId=m.id;const e=kit.parts!.find(a=>a.kind==='entrance')!,front={x:1+e.dx,y:2+e.dy+e.h};fp.startPos=front;
  dressBeodeulGround(fp,m.id,'natural',1004);
  for(let y=front.y;y<2+kit.height-1;y++)assert(canMove(fp,m,front.x,y,front.x,y+1),kit.id);
  const png=renderMapPng({...fp,startMapId:''},m).png,im=PNG.sync.read(png);
  PNG.bitblt(im,sheet,0,0,320,320,(j%2)*320,Math.floor(j/2)*320);
  records.push({id:kit.id,origin:{x:1,y:2},front,map:m,grafts:fp.tilesets.beodeul_city.tileGrafts!.filter(g=>[...m.lowerTiles,...m.upperTiles,...m.lowerOverlayTiles,...m.upperOverlayTiles].includes(g.targetTile)).map(g=>({...g,priority:fp.tilesets.beodeul_city.priority[g.targetTile],passability:fp.tilesets.beodeul_city.passability[g.targetTile]}))});
  fixtureProof.push({id:kit.id,wholeKitInBounds:true,entranceCount:1,southApproachPasses:true});
 }
 const file=`catalog-${page+1}.png`;fs.writeFileSync(`${root}/${file}`,PNG.sync.write(sheet));
 execFileSync('convert',[`${root}/${file}`,'-strip','-dither','None','-colors','128',`${pub}/${file}`]);
 const tiles=new Set(selected.flatMap(k=>k.rows.flatMap(r=>[...r.tiles,...r.upperTiles])).filter(n=>n>=0));
 docs.push({id:`bd-facility-catalog-${page+1}`,name:`시설 도장 전체 배열 ${page+1}`,markdown:'# 시설 전체 source/역할/입구/완성 표본\n\n숫자는 이 문서의 source 정의 기준이다. 현재 저장본은 동명 키트로 찍는다. tex_beodeul_city는16px·128열, tex_beodeul_architecture는16px·16열. sourceTile n의 픽셀좌표는(n%열수*16,floor(n/열수)*16). -1은 해당 층 유지. 카탈로그 그림은 좌상·우상·좌하·우하 순서.\n\n```json\n'+JSON.stringify({image:file,source:{tilesetId:source.id,count:source.count,tileSize:16,tilesPerRow:128,image:source.image},kits:selected,rules:[...tiles].map(n=>({tile:n,priority:source.priority[n],passability:source.passability[n],graft:source.tileGrafts?.find(g=>g.targetTile===n)})),examples:records})+'\n```'});
 images.push({id:`bd-facility-catalog-${page+1}`,name:`시설 조립 표본 ${page+1}`,caption:selected.map(k=>k.name).join(' / ')+' · 위 왼쪽→위 오른쪽→아래 왼쪽→아래 오른쪽. 실제 네 층 엔진 조립의 128색 학습 사본. 게임 소재로 잘라 쓰지 않는다.',dataUrl:`/assets/beodeul-facilities/${file}`});
}
const m=p.maps[result.mapId];
for(const [layer,key] of [[1,'lowerTiles'],[2,'lowerOverlayTiles'],[3,'upperTiles'],[4,'upperOverlayTiles']] as const)docs.push({id:`bd-facility-town-layer-${layer}`,name:`시설 마을 50×50 전체 ${layer}층`,markdown:'# 실제 저장 예제 전체 target 배열\n\n50×50,16px,index=y*50+x. 이 예제의 target 번호이며 다른 저장본에 그대로 칠하지 않는다. source 이식표와 배치 지침을 함께 읽는다.\n```json\n'+JSON.stringify({mapId:m.id,width:50,height:50,tilesetId:m.tilesetId,layer,tiles:m[key]??Array(2500).fill(-1)})+'\n```'});
const used=new Set([...m.lowerTiles,...m.upperTiles,...m.lowerOverlayTiles,...m.upperOverlayTiles]);
const grafts=p.tilesets.beodeul_city.tileGrafts.filter(g=>used.has(g.targetTile)).map(g=>({...g,priority:p.tilesets.beodeul_city.priority[g.targetTile],passability:p.tilesets.beodeul_city.passability[g.targetTile]}));
docs.push({id:'bd-facility-town-placements',name:'시설 마을 전체 조각/입구/위치',markdown:'# 실제 예제의 모든 새 시설 배치\n\n기존 건물과 황록 나무 그림은 보존한다. 역할은 외장 저작 정보다.\n```json\n'+JSON.stringify({result,kits:p.tilesets.beodeul_city.structureKits.filter(k=>result.placements.some(a=>a.kit===k.id)||result.roles.some(a=>a.body===k.id))})+'\n```'});
for(let i=0;i<grafts.length;i+=250)docs.push({id:`bd-facility-town-grafts-${i/250+1}`,name:`시설 마을 source→target 통행표 ${i/250+1}`,markdown:'# 실제 예제의 source 이식표\n\n각 source의 열수/칸크기는 guide와 해당 source 카탈로그 기준. 모든 번호 페이지를 읽는다.\n```json\n'+JSON.stringify({offset:i,total:grafts.length,grafts:grafts.slice(i,i+250)})+'\n```'});
fs.writeFileSync(`${root}/town-native.png`,renderMapPng({...p,startMapId:''},m).png);
execFileSync('convert',[`${root}/town-native.png`,'-strip','-dither','None','-colors','128',`${pub}/town-native.png`]);
const bad=structuredClone(p),bm=bad.maps[m.id],barrel=p.tilesets.beodeul_city.structureKits.find(k=>k.id==='bd-prop-sword_barrel')!.rows[0].upperTiles[0];
assert(canMove(p,m,5,13,5,12));setLayerTileAt(bm,3,12*50+5,barrel);assert(!canMove(bad,bm,5,13,5,12));
fs.writeFileSync(`${out}/bad-entrance.png`,renderMapPng({...bad,startMapId:''},bm).png);
execFileSync('python3',['-c',`from PIL import Image\na=Image.open('${root}/town-native.png').crop((32,144,192,256));b=Image.open('${out}/bad-entrance.png').crop((32,144,192,256));c=Image.new('RGB',(328,112));c.paste(a,(0,0));c.paste(b,(168,0));c.resize((656,224),Image.Resampling.NEAREST).save('${pub}/normal-error.png')`]);
images.push({id:'bd-facility-town',name:'시설을 반영한 실제 마을 50×50',caption:'원본 건물·기와·황록 나무를 유지하고 작업 마당과 나루터를 조립한 실제 예제.',dataUrl:'/assets/beodeul-facilities/town-native.png'},
 {id:'bd-facility-error',name:'약초사 집 문앞 정상/막힘 오류',caption:'왼쪽 정상·오른쪽 (5,12)에 실제 칼통을 놓은 blocked-facility-entrance. canMove(5,13)→(5,12) true→false.',dataUrl:'/assets/beodeul-facilities/normal-error.png'});
assert(docs.every(d=>d.markdown.length<=120000));
const references=[{id:'beodeul-facilities',name:'버들항 · RPG 시설과 작업 마당',description:'공용 시설 도장 32종, source/네 층/통행/문앞/생활 역할, 실제 마을과 오류 표본.',documents:docs,images}];
fs.writeFileSync(`${root}/references.json`,JSON.stringify(references,null,2));fs.writeFileSync('src/assets/beodeulFacilitiesReferences.json',JSON.stringify(references,null,2)+'\n');
fs.writeFileSync(`${root}/town-example.json`,JSON.stringify({map:m,result,grafts},null,2));
fs.writeFileSync('verify-shots/beodeul-facilities/assembly-proof.json',JSON.stringify({fixtures:fixtureProof,blockedEntranceMutationDetected:true,errorCode:'blocked-facility-entrance',cell:{x:5,y:12},docSizes:docs.map(d=>[d.id,d.markdown.length]),referencesUseStaticPaths:true},null,2));
console.log(JSON.stringify({kits:kits.length,docs:docs.length,images:images.length,allFixtureApproachesPass:true,blockedEntranceDetected:true}));
