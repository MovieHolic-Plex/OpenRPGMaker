import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {PNG} from 'pngjs';
const sheet=JSON.parse(await readFile('src/assets/worldmapAuthoringSheet.json','utf8'));
const png=PNG.sync.read(await readFile('public/assets/worldmap-icons/worldmap-authoring.png'));
const out='public/assets/worldmap-icons-references/authoring';await mkdir(out,{recursive:true});
await copyFile('tiledata/worldmap-kit/authoring/brushes.png',out+'/brushes.png');
const docs=[{id:'wmi-authoring-contract',name:'빈 지도부터 만드는 순서',markdown:`# 월드맵 연결 붓\n\nworldmap_authoring, tex_worldmap_authoring, 16px, 12열, ${sheet.count}칸. 출처는 완성 지도 크롭이 아니라 terrain_v4의 현재 질감·숲/산 사분면과 authoring/pixels.json의 새 경계·길·다리 픽셀이다. PNG SHA256=${sheet.sha256}.\n\n1. 빈 맵을 worldmap_authoring으로 만들고 바다(0)로 채운다. 편집기의 빈 월드맵은 48×36이다. 기존 생성 지도에는 이 소스가 이식되므로 이 문서의 번호를 그대로 쓰지 말고 tileGroups의 worldmap-brush-*를 찾는다.\n2. 바다 배경의 초원/사막/설원 해안 붓으로 육지와 섬을 칠한다. 외곽·오목 코너·한 칸 통로는 8방향 256 입력에서 47개 연결 상태를 고른다. 바다 붓으로 해협/만을 다시 깎으면 이웃 해안도 바뀐다.\n3. 배경을 초원·사막·설원으로 바꿔 다른 바닥/강/길을 칠한다. 이 붓은 지정한 배경을 포함한 불투명 아래층이다. 모르는 배경 위에 덮으면 그 배경을 바꾼다. 위층 숲·산은 RGBA 투명이며 현재 아래 땅을 보존한다.\n4. 강은 막힌 아래층이다. 어귀는 바다와 연결된다. 길은 사방 16가지 끝/모퉁이/T/십자로 연결되며 서로 다른 배경의 길도 만난다. 강을 건널 때 가로/세로 다리로 물 칸을 바꾼다. 다리는 수면의 47개 연결 상태를 따라 밑의 강둑을 다시 맞춘다. 가로 다리는 좌우, 세로 다리는 위아래로만 이동한다. 강·바다는 ×. 바탕에 맞는 다리(초원/사막/설원)를 고른다.\n5. 숲·산은 위층 ×. 고개/도시 자리의 위층을 지운다. 지우기와 채우기도 연결을 다시 맞춘다. 거점은 36개 사람 선택 판타지 키트 중 전체 배열로 놓는다. 원본 선택은 wmi-fantasy 문서와 실제 그림을 읽는다. 아래 지면과 이벤트는 별도다.\n6. 배경에 따른 재료 이름은 강 · 초원 / 길 · 사막처럼 구분한다. 숲·산 면은 fill_region(layer=upper), 바닥·강·길은 fill_region(layer=lower)를 쓴다. 같은 일반 타일 도구에서도 이 타일셋의 autotileGroups를 쓴다. 숲/산을 lower로 합성하거나 거점 일부 칸만 떼어 쓰지 않는다. 저장 후 같은 SQLite 대상에서 다시 읽는다.\n\n![실제 대표 붓: 배경별 지형, 숲/산, 다리](image:wmi-authoring-brushes)\n\n팔레트에 대표가 하나인 것은 모든 변형이 variantMap에 있기 때문이다. 스포이트는 실제 변형을 고른다. 기존 완성 대륙은 원본 재료로 보존되며, 새 붓으로 기존 절벽과 고원을 모두 재현한다는 뜻은 아니다. 고원·절벽/높이 지우기/고개·경사로 버튼은 에디터의 실제 relief 붓이다. 바닥 그림을 보존하며 높이 데이터를 저장한다.\n`}];
function cell(out,tile,x,y,scale=4){for(let py=0;py<16;py++)for(let px=0;px<16;px++)for(let yy=0;yy<scale;yy++)for(let xx=0;xx<scale;xx++){
const src=((Math.floor(tile/12)*16+py)*png.width+(tile%12)*16+px)*4,dst=((y+py*scale+yy)*out.width+x+px*scale+xx)*4;png.data.copy(out.data,dst,src,src+4);}}
// A normal 3×3 island has connected center/edges. The error uses isolated tiles in every cell.
const island=sheet.brushes.find(b=>b.id==='worldmap-brush-grass-sea');
const maskAt=(x,y)=>[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]].reduce((m,[dx,dy,b])=>x+dx>=0&&x+dx<3&&y+dy>=0&&y+dy<3?m|b:m,0);
const lower=Array.from({length:3},(_,y)=>Array.from({length:3},(_,x)=>island.variantMap[String(maskAt(x,y))]));
const bad=lower.map(row=>row.map(()=>island.variantMap['0']));const example=new PNG({width:400,height:192});
for(let y=0;y<3;y++)for(let x=0;x<3;x++){cell(example,lower[y][x],x*64,y*64);cell(example,bad[y][x],208+x*64,y*64);}
await writeFile(out+'/island-normal-error.png',PNG.sync.write(example));
docs[0].markdown+=`\n## 전체 배열: 연결된 3×3 섬\n\n원점 (0,0), lower=${JSON.stringify(lower)} / upper=${JSON.stringify(lower.map(row=>row.map(()=>-1)))} / 오른쪽 오류 lower=${JSON.stringify(bad)}. 자동 연결을 생략하면 각 칸이 고립된 섬이 된다. 정상과 오류 배열을 원본 시트 좌표와 대조한다.\n\n![왼쪽 연결된 섬, 오른쪽 고립 조각을 잘못 반복한 배열](image:wmi-authoring-example)\n`;
for(const b of sheet.brushes){const coords=b.tiles.map(tile=>({tile,x:tile%12,y:Math.floor(tile/12)}));
const markdown=`# ${b.name} · ${b.id}\n\n배경=${b.background} / layer=${b.layer}。${b.variantMap?`${b.neighborhood}방향 연결, 전체 입력 ${Object.keys(b.variantMap).length}가지.`:'연결이 없는 단일 조각.'} 좌표는 0기준, 픽셀 원점=(x*16,y*16).\n\n\`\`\`json\n${JSON.stringify({id:b.id,representative:b.variantMap?.['0']??b.tiles[0],cells:coords})}\n\`\`\`\n\n\`\`\`json\n${JSON.stringify({variantMap:b.variantMap??null})}\n\`\`\`\n\n연결은 autotileGroups, 투명/통행은 tileMeta/priority/passability에 있다. 기존 지도에 이식된 번호는 이 소스 번호와 다르므로 그 지도의 같은 ID 그룹을 읽는다.\n`;
docs.push({id:'wmi-authoring-'+b.id.slice(15),name:b.name+' · '+b.background,markdown});}
const refs=[{id:'wmi-authoring',name:'월드맵 · 연결 지형 저작',description:'빈 지도·47개 경계·16개 길 연결·전체 좌표와 배열',documents:docs.slice(0,60),images:[
{id:'wmi-authoring-brushes',name:'실제 연결 붓',caption:'전체 대표 붓, 8열, 원본 16px를 nearest 4배',dataUrl:'/assets/worldmap-icons-references/authoring/brushes.png'},
{id:'wmi-authoring-example',name:'섬 정상/오류',caption:'왼쪽 연결된 3×3 섬, 오른쪽 고립 조각 반복 오류',dataUrl:'/assets/worldmap-icons-references/authoring/island-normal-error.png'}]},{id:'wmi-authoring-more',name:'월드맵 · 숲·산·다리 연결 사전',description:'설원 배경과 투명 숲·산, 다리 조각의 전체 좌표/연결',documents:docs.slice(60),images:[]}];
await writeFile('src/assets/worldmapAuthoringReferences.json',JSON.stringify(refs,null,2)+'\n');
await writeFile('tiledata/worldmap-kit/authoring/README.md',docs[0].markdown);console.log({documents:docs.length,tiles:sheet.count,example:lower});
