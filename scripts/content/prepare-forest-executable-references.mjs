import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {withTsModule} from '../ontology-ts-loader.mjs';
const dir='tiledata/tilesets/forest_harmony/recipes';fs.mkdirSync(dir,{recursive:true});
const target='src/assets/forestHarmonyTileset.json', t=JSON.parse(fs.readFileSync(target));
const atlasBytes=fs.readFileSync('public/assets/forest-harmony/chipset.png'),atlas=PNG.sync.read(atlasBytes);
const images=[],examples=[];
await withTsModule('src/project/forestRecipes.ts','recipes.mjs',async m=>{
 const ids=[...Object.values(m.FOREST_RECIPE_PARTS),'forest-repeat:body','forest-repeat:left','forest-repeat:right'];
 const parts={tilesetId:t.id,tileSize:16,columns:30,count:t.count,atlasSha256:createHash('sha256').update(atlasBytes).digest('hex'),parts:ids.map(id=>{const p=t.tileGroups.find(g=>g.id===id).previewMap;return {id,tilesetId:t.id,...p,sourceTiles:[...new Set([...p.lowerTiles,...p.upperTiles].filter(tile=>tile>=0))].map(tile=>({tile,col:tile%30,row:Math.floor(tile/30),pixelX:tile%30*16,pixelY:Math.floor(tile/30)*16,width:16,height:16}))};})};
 fs.writeFileSync(dir+'/parts.json',JSON.stringify(parts,null,2)+'\n');
 for(const input of [{recipeId:'strip',x:2,y:2,repeats:2},{recipeId:'northwest',x:2,y:2},{recipeId:'tree',x:2,y:2}]){
  const p=m.compileForestRecipe(t,input);examples.push({input,expected:p});
  const img=new PNG({width:(p.width+4)*16,height:(p.height+4)*16});
  const draw=(id,x,y)=>{if(id<0)return;const sx=(id%30)*16,sy=Math.floor(id/30)*16;for(let dy=0;dy<16;dy++)for(let dx=0;dx<16;dx++){const from=((sy+dy)*atlas.width+sx+dx)*4,to=((y*16+dy)*img.width+x*16+dx)*4,a=atlas.data[from+3]/255;for(let c=0;c<3;c++)img.data[to+c]=Math.round(atlas.data[from+c]*a+img.data[to+c]*(1-a));img.data[to+3]=255;}};
  for(let y=0;y<p.height+4;y++)for(let x=0;x<p.width+4;x++)draw(1141,x,y);
  for(const layer of ['lowerTiles','upperTiles'])for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)draw(p[layer][y*p.width+x],x+2,y+2);
  const bytes=PNG.sync.write(img),name=input.recipeId+'.png';fs.writeFileSync(dir+'/'+name,bytes);images.push({id:'recipe-'+input.recipeId,name,caption:`16px 원본 칩을 확대/보간 없이 합성. ${p.width}×${p.height}칸. 실제 플레이 화면 아님.`,dataUrl:'data:image/png;base64,'+bytes.toString('base64')});
 }
 fs.writeFileSync(dir+'/examples.json',JSON.stringify(examples,null,2)+'\n');
 const instructions=`# 공용 숲 실행 조립법\n\n대상은 forest_harmony, 16×16px, 30열입니다. 다른 칩셋이나 파생판에는 실행하지 마세요.\n\n## 실행 순서\n1. 이 카테고리의 문서와 이미지를 읽습니다.\n2. inspect_forest_recipe로 필요한 영역과 부품 좌표를 확인합니다.\n3. stamp_forest_recipe를 호출합니다. 타일 번호를 직접 재생성하지 않습니다.\n4. 같은 인수로 inspect_forest_recipe에 checkPlaced:true를 주어 valid:true, mismatchCount:0인지 확인합니다.\n\n예시(실제 mapId로 교체):\n\n\`\`\`json\n{"mapId":"대상맵","recipeId":"strip","x":2,"y":2,"repeats":2,"referencePurpose":"forest-executable-v1"}\n\`\`\`\n\nreferencePurpose는 쓰기 도구에 지정합니다. inspect에는 넣지 않습니다. 출입구/집 앞 실제 좌표 2~16개를 accessPoints:[{x:0,y:0},{x:1,y:0}] 형태로 지정하면 배치 후 타일 통행 연결을 확인합니다. 위 좌표는 형식 예시이며 실제 맵 출입구를 조회해 교체해야 합니다. 생략하면 연결을 검증하지 않습니다.\n\n## 정확한 조립 규칙\n- strip: repeats=N(1~16), 전체 폭=6N+2, 높이=6. 본체는 (x+1+6i,y), i=0..N-1에 먼저 배치합니다. 그 다음 왼쪽 4×6 마감을 (x,y), 오른쪽 4×6 마감을 (x+6N-2,y)에 덮습니다. 각 마감은 본체와 3열 겹칩니다.\n- tree, small-bush, northwest, northeast, east, southeast, southwest: parts.json에 해당하는 온전한 패턴을 배치합니다. repeats는 주지 않습니다.\n- lowerTiles와 upperTiles는 행 우선 배열입니다. index=localY*width+localX. -1은 비우기이며 생략이 아닙니다. 줄기·뿌리를 자르거나 수관 방향을 추측하지 않습니다.\n- 기존 이벤트는 항상 보존합니다. 기존 길/오브젝트가 있으면 거부합니다. overwrite:true는 확인한 사각형 전체를 지우고 덮으므로 사용자 배치와 겹치지 않는 위치를 우선 선택합니다.\n- 오류가 나면 해당 좌표와 code를 읽고 위치/입력만 수정합니다. 실패한 배치는 일부만 남기지 않습니다.\n\n## 검증과 한계\ncheckPlaced는 원본 조립 결과와 두 레이어 모든 칸을 비교해 틀린 좌표·기대값·실제값을 반환합니다(최대64개 상세, 총개수 별도). 이는 조립 규칙 일치 검사이며 미적 품질 보증이 아닙니다. accessPoints 검사는 타일 통행만 다루며 NPC·이벤트 조건은 별도 플레이 검수가 필요합니다. 지원되지 않는 임의 곡선, 대각 숲, 새 마을 전체를 자동으로 설계하는 도구가 아닙니다. 저가 모델 자체의 성공률은 아직 측정하지 않았습니다.\n\n## 원본 해상도 조립 예시\n${images.map(i=>`![${i.name}](image:${i.id})`).join('\n\n')}\n`;
 fs.writeFileSync(dir+'/LEGACY-FOREST.md',instructions);
 const category={id:'forest-executable-v1',name:'실행 조립법',description:'16px 원본 배열, 결정론적 부품 조립, 입력/출력 예시와 좌표별 검증.',documents:[{id:'forest-recipe-guide',name:'실행 순서와 검증.md',markdown:instructions},{id:'forest-recipe-parts',name:'정확한 부품 배열.md',markdown:'# 정확한 부품 배열\n\n```json\n'+JSON.stringify(parts)+'\n```'},{id:'forest-recipe-examples',name:'입력과 정답 배열.md',markdown:'# 입력과 정답 배열\n\nexpected의 x/y는 맵 원점, 각 배열은 조립 사각형 내부 행 우선입니다.\n\n```json\n'+JSON.stringify(examples,null,2)+'\n```'}],images};
 t.referenceDocuments=[...(t.referenceDocuments??[]).filter(c=>c.id!==category.id),category];fs.writeFileSync(target,JSON.stringify(t)+'\n');
});
console.log('Embedded 3 documents, 3 native-resolution examples, 10 exact parts.');
