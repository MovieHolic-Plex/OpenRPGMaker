import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
const ROOT='tiledata/beodeul-ground',OUT=`${ROOT}/palette-standard`,PUB='public/assets/beodeul-ground';
fs.mkdirSync(OUT,{recursive:true});
const selected=JSON.parse(fs.readFileSync(`${ROOT}/tree-palette-studies/palettes.json`,'utf8')).find(d=>d.id==='warm');
const city=JSON.parse(fs.readFileSync('src/assets/beodeulCityTileset.json','utf8'));
const ground=JSON.parse(fs.readFileSync('src/assets/beodeulGroundCatalog.json','utf8'));
const base=JSON.parse(fs.readFileSync(`${ROOT}/tree-studies/studies.json`,'utf8'))[0];
const read=p=>PNG.sync.read(fs.readFileSync(p));
const color=(im,x,y)=>Array.from(im.data.subarray((y*im.width+x)*4,(y*im.width+x)*4+4));
const light=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
const hex=c=>'#'+c.slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('');
function ramp(pixels,filter){const hist=new Map();for(const c of pixels)if(c[3]===255&&filter(c)){const k=c.join(',');hist.set(k,(hist.get(k)??0)+1);}
 const values=[...hist].map(([c,n])=>({rgba:c.split(',').map(Number),n})).sort((a,b)=>light(a.rgba)-light(b.rgba)),total=values.reduce((s,a)=>s+a.n,0);
 return [.15,.5,.85].map(f=>{let n=0;const a=values.find(a=>(n+=a.n)>=total*f);return{hex:hex(a.rgba),rgba:a.rgba};});
}
const leaf=[];for(const b of base.body)for(let y=0;y<48;y++)for(let x=0;x<b.width;x++)leaf.push(b.palette[b.pixels[y*b.width+x]]);
const colors=new Map(selected.paletteMapping.map(m=>[m.from.join(','),m.to]));
const warmLeaves=leaf.map(c=>colors.get(c.join(','))??c);
const atlas=read('public/assets/beodeul-city/beodeul-city-chipset.png'),grass=[];
for(let y=0;y<16;y++)for(let x=0;x<16;x++)grass.push(color(atlas,737%128*16+x,Math.floor(737/128)*16+y));
const house=read('public/assets/beodeul-architecture/stone.png'),roof=[],wall=[];
for(let y=0;y<house.height;y++)for(let x=0;x<house.width;x++)(y<48?roof:wall).push(color(house,x,y));
const roles={treeLeaf:{name:'나뭇잎 · 확정 따뜻한 황록',status:'approved-color-standard',ramp:ramp(warmLeaves,c=>c[1]>c[0]*1.02)},
 grass:{name:'바탕 잔디 · 밝은 원본 737',status:'retain-native',ramp:ramp(grass,()=>true)},
 roof:{name:'기와 · 원본 황토/갈색',status:'retain-native',ramp:ramp(roof,c=>c[0]>c[1]*1.1)},
 wall:{name:'벽 · 건물별 한 재질',status:'retain-concept-per-building',ramp:ramp(wall,c=>c[0]>=c[1]&&c[0]<190&&c[0]>65)}};
const standard={id:'beodeul-warm-green',approvedOn:'2026-10-05',selection:'warm',userDecision:'아 그러네. 따뜻한 황록.. 이 맞네.',
 scope:'tree leaf RGB only; atlas installation is a separate asset update',roles,
 rules:{light:'upper-left',shadow:'short-lower-right',treeAlpha:'preserve',treePixelPositions:'preserve',treeBark:'retain-native',grassSourceTile:737,houseRoof:'preserve-native',houseWalls:'one-concept-per-house',objectColor:'inherit-native-material-family'},
 paletteMapping:selected.paletteMapping};
fs.writeFileSync(`${OUT}/standard.json`,JSON.stringify(standard,null,2)+'\n');
const guide=`# 버들항 색 역할 기준 · 따뜻한 황록\n\n사용자가 집 옆에서 형태/뿌리/그림자를 고정한 다섯 색 시안을 비교해 warm(따뜻한 황록)을 선택했다. 이 문서는 확정 색 기준과 조수의 후속 저작 지침이다. 현재 게임 아틀라스/맵의 색을 자동 교체하는 도구는 아니다.\n\n## 역할과 기준색\n\n| 역할 | 어두운 색 | 중간색 | 밝은 색 | 적용 |\n|---|---|---|---|---|\n${Object.values(roles).map(r=>`| ${r.name} | ${r.ramp[0].hex} | ${r.ramp[1].hex} | ${r.ramp[2].hex} | ${r.status} |`).join('\n')}\n\n세 색은 실제 픽셀 분포의 15/50/85% 표본이다. 모든 픽셀을 세 색으로 양자화하는 지시가 아니다. 정확한 색 변환은 전체 from→to 목록을 사용한다.\n\n## 적용 순서\n\n1. 현재 tileset의 참고문서 beodeul-city-pieces와 이 용도의 전체 MD/실제 그림을 읽는다. tree 03a8f7/3e8732/1a786c 본체 source와 겹친 숲 body를 구별한다.\n2. 기존 실루엣/각 픽셀의 위치/알파/줄기·뿌리를 고정한다. from RGBA 색을 전체 치환표로 찾고 해당 tree body 범위 안에서만 to RGB로 바꾼다. 표시색/반투명 픽셀은 표에 그대로 남는다. 위치에 따라 같은 색을 다르게 바꾸거나 흐리게 하지 않는다.\n3. ground 그림자(2층), 기존 밝은 잔디 737(1층), 건물 기와/벽(3층), 접점 풀/기초(4층)는 각 역할을 유지한다. 숲 한 조각에 나무와 풀/땅이 섞였으면 나무 영역을 분리한 뒤 적용한다.\n4. 검수는 같은 집/바닥선/조립 좌표에서 원본과 비교한다. 원본 집·잔디·길·그늘이 픽셀 단위로 같은지 검사하고 문 앞 통행을 유지한다. 색 채택만으로 수관 입체감/배치 품질까지 합격이라고 선언하지 않는다.\n5. 게임 소재에 적용할 때에는 공용 번들/source와 만드는 코드를 함께 갱신한 뒤 실제 프로젝트에 저장/재로드한다. 문서만 추가한 현재 단계와 혼동하지 않는다.\n\n## 소품/건물 정리 기준\n\n목재·장작·통은 기존 갈색 재질, 돌·포석은 기존 회갈색, 잎/풀의 밝은 점은 한 덩어리 안에서 조절한다. 민가 한 채의 벽 재질을 통일한다. 지붕/윤곽/3/4 탑뷰는 원본을 사용한다. 새 색 조정도 기준색 역할을 하나씩 비교해 확정한다.\n\n## 재현/오류\n\nsource body PNG는 tiledata/beodeul-ground/tree-studies/current-<id>-body.png, selected는 tree-palette-studies/warm-<id>-body.png. 집 옆 한 그루 (88,40), 돌집 (4,4), 공유 지면 y=100; 세 그루는 (68,28)/(80,36)/(96,44). 모두 16px 원본 축척. palette-standard의 표본은 색 비교 이미지이며 map tile 번호로 잘라 쓰지 않는다. 기존 타일 조립/기초/통행 전체 배열은 같은 용도 bd-ground-catalog와 source별 문서에 있다.\n\n정상/오류 그림: 왼쪽 정상 따뜻한 황록 나무, 오른쪽은 동일 색조 공식을 전체 잔디에도 잘못 적용한 실제 변조. 오류 palette-scope-leak, 예제 픽셀 (0,0), 예제 local map (0,0), 층1. 지면 변화 검출은 pixel 영역 비교이며 통행 변화 검사는 아니다.\n`;
fs.writeFileSync(`${ROOT}/PALETTE-STANDARD.md`,guide);
const docs=[{id:'bd-ground-palette-standard',name:'확정 색 역할 · 따뜻한 황록/밝은 잔디/기와/벽',markdown:guide},
 {id:'bd-ground-palette-colors',name:'따뜻한 황록 · 전체 원본→확정색 사전',markdown:'# 전체 RGBA 색 치환표와 고정 조건\n\n```json\n'+JSON.stringify(standard)+'\n```'}];
for(const [i,id] of ['03a8f7','3e8732','1a786c'].entries()){
 const kit=city.structureKits.find(k=>k.id==='bd-tree-'+id);
 const recipes=ground.recipes.filter(r=>r.id===`bdg-light-tree-${id}`||kit.height===3&&['bdg-tree-neck','bdg-roots'].includes(r.id));
 docs.push({id:`bd-ground-palette-source-${id}`,name:`황록 나무 ${id} · 전체 source/층/픽셀 배열`,markdown:'# 원본 native 조립과 확정 tree body 픽셀\n\ncity source 16px/128열, body는3층. 기존 ground 16px/8열의 그늘은2층, neck/roots는4층. 원본 통행/priority를 유지한다. body 픽셀은 64×80의 padding+기존 짧은 나무 목/뿌리 합성 전체이며 새 game tile 번호가 아니다.\n\n```json\n'+JSON.stringify({kit,groundRecipes:recipes,body:base.body[i],warmPalette:base.body[i].palette.map(c=>colors.get(c.join(','))??c),groundShadow:base.shadow[i]})+'\n```'});
}
const correct=read(`${ROOT}/tree-palette-studies/warm-solo.png`),bad=PNG.sync.read(PNG.sync.write(correct));let groundChanged=0;
for(let y=0;y<bad.height;y++)for(let x=0;x<bad.width;x++){
 const c=color(bad,x,y);if(c[3]!==255||c[1]<=c[0]*1.08||c[1]<=c[2]*1.15)continue;
 const rgb=[c[0]+24,c[1]-5,c[2]-13],delta=light(c)-light(rgb),next=rgb.map(v=>Math.max(0,Math.min(255,Math.round(v+delta)))).concat(c[3]);
 bad.data.set(next,(y*bad.width+x)*4);if(x<68)groundChanged++;
}
assert(groundChanged>0);assert.notDeepEqual(color(correct,0,0),color(bad,0,0));
const panel=new PNG({width:644,height:256});
for(let y=0;y<256;y++)for(let x=0;x<644;x++){
 const source=x<320?correct:x>=324?bad:null;
 panel.data.set(source?color(source,Math.floor((x<320?x:x-324)/2),Math.floor(y/2)):[0,0,0,0],(y*644+x)*4);
}
fs.copyFileSync(`${ROOT}/tree-palette-studies/warm-solo.png`,`${PUB}/palette-standard.png`);
fs.writeFileSync(`${PUB}/palette-standard-error.png`,PNG.sync.write(panel));
fs.writeFileSync(`${OUT}/errors.json`,JSON.stringify([{code:'palette-scope-leak',pixel:[0,0],exampleMapCell:[0,0],layer:1,detected:true,groundChangedPixels:groundChanged}],null,2));
const images=[{id:'bd-ground-palette-image',name:'확정 황록 · 같은 집 옆 실제 픽셀',caption:'선택한 warm 색. 원본 형태/뿌리/바닥 그늘·돌집·잔디·길 고정. 그림은 비교 참고용이며 game tile이 아니다.',dataUrl:'/assets/beodeul-ground/palette-standard.png'},
 {id:'bd-ground-palette-error',name:'정상/잔디까지 같은 색조를 적용한 오류',caption:'왼쪽 정상·오른쪽 실제 지면 RGB 변조. palette-scope-leak, 예제 픽셀/칸 (0,0),1층.',dataUrl:'/assets/beodeul-ground/palette-standard-error.png'}];
assert(docs.every(d=>d.markdown.length<=120000));
const fragment={documents:docs,images};fs.writeFileSync(`${ROOT}/palette-standard-references.json`,JSON.stringify(fragment,null,2)+'\n');
const refs=JSON.parse(fs.readFileSync('src/assets/beodeulGroundReferences.json','utf8'));
const cat=refs.find(r=>r.id==='beodeul-ground-dressing');
cat.documents=cat.documents.filter(d=>!docs.some(a=>a.id===d.id)).concat(docs);cat.images=cat.images.filter(i=>!images.some(a=>a.id===i.id)).concat(images);
fs.writeFileSync('src/assets/beodeulGroundReferences.json',JSON.stringify(refs,null,2)+'\n');
console.log(JSON.stringify({roles,documents:docs.map(d=>[d.id,d.markdown.length]),paletteScopeMutationDetected:true}));
