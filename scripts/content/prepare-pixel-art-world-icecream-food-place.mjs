// Read-only authoring: portable host snapshot + current shared snapshot -> private proposal.
// No network, DB, host publication, or source art copied into the repository.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url), {PNG}=require('pngjs');
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const [portablePath,proofPath,sharedPath,foodSourcePath,outArg]=process.argv.slice(2);
if(!outArg) throw Error('Usage: node scripts/content/prepare-pixel-art-world-icecream-food-place.mjs portable.json source-proof.json shared-snapshot.json SC-F-Juice01.png private-output');
const out=resolve(outArg);if(!out.startsWith(join(repo,'output')+'/'))throw Error('Output must be private worktree output/');
await mkdir(out,{recursive:true});
const bytes=await readFile(portablePath), project=JSON.parse(bytes),proof=JSON.parse(await readFile(proofPath)),shared=JSON.parse(await readFile(sharedPath));
const spec=JSON.parse(await readFile(join(repo,'tiledata/pixel-art-world/icecream-food-place.json')));
const hash=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const ensure=(ok,message)=>{if(!ok)throw Error(message)};
ensure(hash(bytes)===proof.portableSha256,'Host portable receipt mismatch');
ensure(hash(await readFile(foodSourcePath))===spec.sources[1].sha256,'Food source SHA mismatch');
const base=project.tilesets[spec.baseTilesetId], food=project.tilesets[spec.foodTilesetId];
ensure(base&&food&&base.tileSize===32&&base.tilesPerRow===8&&base.count===160&&food.tilesPerRow===12,'Source geometry mismatch');
const assetBytes=t=>{const a=project.assets.uploaded[t.image.id];ensure(a?.dataUrl?.startsWith('data:image/png;base64,'),'Resolved PNG required');return Buffer.from(a.dataUrl.split(',')[1],'base64')};
const baseBytes=assetBytes(base),foodBytes=assetBytes(food);
ensure(hash(baseBytes)===spec.sources[0].sha256,'Base source SHA mismatch');
const baseImage=PNG.sync.read(baseBytes), foodImage=PNG.sync.read(foodBytes), atlas=new PNG({width:256,height:736});atlas.data.fill(0);
PNG.bitblt(baseImage,atlas,0,0,256,640,0,0);
const alphaBlend=(target,source,sx,sy,w,h,dx,dy)=>{for(let y=0;y<h;y++)for(let x=0;x<w;x++){const s=((sy+y)*source.width+sx+x)*4,d=((dy+y)*target.width+dx+x)*4,a=source.data[s+3]/255;for(let c=0;c<3;c++)target.data[d+c]=Math.round(source.data[s+c]*a+target.data[d+c]*(1-a));target.data[d+3]=Math.round((a+target.data[d+3]/255*(1-a))*255)}};
// Reconstruct this one accepted recipe from both exact author originals as provenance evidence.
const rawFood=PNG.sync.read(await readFile(foodSourcePath));ensure(rawFood.width===128&&rawFood.height===128,'Food source dimensions');
const reconstructed=new PNG({width:96,height:96});reconstructed.data.fill(0);
PNG.bitblt(baseImage,reconstructed,0,512,96,64,0,32);
alphaBlend(reconstructed,rawFood,11,3,9,22,44,34);
for(let y=0;y<96;y++)for(let x=0;x<96;x++){
 const a=(y*96+x)*4,b=((y+32)*foodImage.width+x)*4;
 ensure(reconstructed.data[a+3]===foodImage.data[b+3],'Derived food/table alpha differs from originals');
 if(reconstructed.data[a+3])for(let c=0;c<3;c++)ensure(reconstructed.data[a+c]===foodImage.data[b+c],'Derived food/table pixels differ from originals');
}
for(let y=0;y<3;y++)for(let x=0;x<3;x++){const s=spec.foodSourceTiles[y][x],d=spec.foodDestinationTiles[y][x];PNG.bitblt(foodImage,atlas,(s%12)*32,Math.floor(s/12)*32,32,32,(d%8)*32,Math.floor(d/8)*32)}
// Pixel evidence: original 160 cells preserved; exact 9-cell append, including transparent padding.
ensure(atlas.data.subarray(0,baseImage.data.length).equals(baseImage.data),'Base pixels changed');
for(let y=0;y<3;y++)for(let x=0;x<3;x++)for(let py=0;py<32;py++){const s=spec.foodSourceTiles[y][x],d=spec.foodDestinationTiles[y][x],a=((Math.floor(s/12)*32+py)*foodImage.width+s%12*32)*4,b=((Math.floor(d/8)*32+py)*atlas.width+d%8*32)*4;ensure(foodImage.data.subarray(a,a+128).equals(atlas.data.subarray(b,b+128)),'Appended pixels differ')}
const baseCategory=base.referenceDocuments.find(c=>c.id===spec.baseSceneCategoryId);
ensure(baseCategory,'Base scene reference missing');const baseScene=JSON.parse(baseCategory.documents[0].markdown.match(/```json\s*([\s\S]*?)```/)[1]);
ensure(baseScene.width===10&&baseScene.height===8,'Base scene dimensions changed');
const expected={width:10,height:8,lowerTiles:[...baseScene.lowerTiles],upperTiles:[...baseScene.upperTiles]};
for(const[x,y]of spec.removeUpperCells)expected.upperTiles[y*10+x]=-1;
for(let y=0;y<3;y++)for(let x=0;x<3;x++)expected.upperTiles[(spec.foodOrigin.y+y)*10+spec.foodOrigin.x+x]=spec.foodDestinationTiles[y][x];
const overlay=spec.transparentOverlay;
ensure(expected.upperTiles[spec.northChair.y*10+spec.northChair.x]===overlay.destinationFoodTile,'Chair overlap must address the approved food padding cell');
for(const sourceTile of spec.foodSourceTiles[0])for(let y=0;y<32;y++)for(let x=0;x<32;x++)ensure(foodImage.data[((Math.floor(sourceTile/12)*32+y)*foodImage.width+(sourceTile%12)*32+x)*4+3]===0,'Ensemble would erase food pixels: top row must be entirely transparent');
for(const c of[spec.northChair,spec.southChair])expected.upperTiles[c.y*10+c.x]=c.tile;
// Independent ensemble: do not claim the scene stamps the unchanged 3x3 food kit.
expected.upperTiles[3*10+5]=-1;expected.upperTiles[3*10+7]=-1;
const ensemble={width:3,height:4,lowerTiles:Array(12).fill(-1),upperTiles:[-1,51,-1,168,169,170,176,177,178,-1,59,-1]};
for(let y=0;y<4;y++)for(let x=0;x<3;x++)ensure(expected.upperTiles[(y+3)*10+x+5]===ensemble.upperTiles[y*3+x],'Place/ensemble mismatch');
const tileset=structuredClone(base);tileset.id=spec.tilesetId;tileset.name=spec.name;tileset.image={type:'uploaded',id:spec.assetId};tileset.count=184;
delete tileset.referenceSourceTilesetId;
for(const category of tileset.referenceDocuments)for(const doc of category.documents)doc.markdown=doc.markdown.replaceAll(spec.baseTilesetId,spec.tilesetId);
for(let i=160;i<184;i++){tileset.passability[i]={up:false,down:false,left:false,right:false};tileset.priority[i]='upper';tileset.terrain[i]=0;tileset.tileMeta[i]={label:'빈 예약칸 · 사용 금지',defaultLayer:'upper',passage:'blocked',source:'imported'}}
for(let y=0;y<3;y++)for(let x=0;x<3;x++){const s=spec.foodSourceTiles[y][x],d=spec.foodDestinationTiles[y][x];for(const k of ['passability','priority','terrain','tileMeta'])tileset[k][d]=structuredClone(food[k][s]);}
// Load actual engine collision authority into a private authoring artifact; no copied collision model.
await build({entryPoints:[join(repo,'src/project/collision.ts')],outfile:join(out,'engine-collision.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {canMove,isPassable}=await import(pathToFileURL(join(out,'engine-collision.mjs')).href);
const map={id:'proposal-icecream',name:spec.name,tileSize:32,tilesetId:spec.tilesetId,...expected,events:[]};
const engineProject={tilesets:{[tileset.id]:tileset}};
const paths=new Map([[`${spec.entrance.x},${spec.entrance.y}`,[spec.entrance]]]),queue=[spec.entrance];
for(let i=0;i<queue.length;i++){const from=queue[i];for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const to={x:from.x+dx,y:from.y+dy},key=`${to.x},${to.y}`;if(!paths.has(key)&&canMove(engineProject,map,from.x,from.y,to.x,to.y)){paths.set(key,[...paths.get(`${from.x},${from.y}`),to]);queue.push(to)}}}
const required=[...spec.approaches,...[2,3,4,5,6].flatMap(y=>[{x:4,y},{x:8,y}])];
for(const p of required)ensure(paths.has(`${p.x},${p.y}`),`Engine unreachable: ${JSON.stringify(p)}`);
const unreachable=[];for(let y=0;y<8;y++)for(let x=0;x<10;x++)if(isPassable(engineProject,map,x,y)&&!paths.has(`${x},${y}`))unreachable.push({x,y});ensure(!unreachable.length,'Disconnected passable floor');
for(let y=4;y<=5;y++)for(let x=5;x<=7;x++)ensure(!isPassable(engineProject,map,x,y),'Table collision missing');
const incorrect=structuredClone(expected);for(let x=5;x<=7;x++)incorrect.upperTiles[5*10+x]=-1;incorrect.upperTiles[7*10+4]=170;
const errors=[...[5,6,7].map(x=>({code:'MISSING_TABLE_LEG_ROW',x,y:5})),{code:'ENTRANCE_BLOCKED',x:4,y:7}];
ensure(!isPassable(engineProject,{...map,...incorrect},4,7),'Error case did not block entrance');
const changedErrorCells=incorrect.upperTiles.flatMap((tile,i)=>tile===expected.upperTiles[i]?[]:[{x:i%10,y:Math.floor(i/10)}]);
ensure(JSON.stringify(changedErrorCells)===JSON.stringify(errors.map(({x,y})=>({x,y}))), 'Error coordinates must match actual changed cells');
for(let y=0;y<32;y++)for(let x=0;x<32;x++)ensure(baseImage.data[(y*baseImage.width+x)*4+3]===255,'Support floor must be opaque');
function render(scene){const png=new PNG({width:scene.width*32,height:scene.height*32});png.data.fill(0);for(const layer of['lowerTiles','upperTiles'])for(let i=0;i<scene.width*scene.height;i++){const tile=scene[layer][i];if(tile>=0)alphaBlend(png,atlas,tile%8*32,Math.floor(tile/8)*32,32,32,i%scene.width*32,Math.floor(i/scene.width)*32)}return png}
ensure(expected.lowerTiles.length===80&&expected.upperTiles.length===80,'Scene array length');
for(const tile of [...expected.lowerTiles,...expected.upperTiles])ensure(Number.isInteger(tile)&&tile>=-1&&tile<184,'Scene tile range');
for(const cell of [{x:6,y:3},{x:6,y:6},...[5,6,7].map(x=>({x,y:5}))])ensure(expected.lowerTiles[cell.y*10+cell.x]===0,'Furniture base needs original opaque floor');
const normal=render(expected),wrong=render(incorrect),comparison=new PNG({width:656,height:256});comparison.data.fill(0);PNG.bitblt(normal,comparison,0,0,320,256,0,0);PNG.bitblt(wrong,comparison,0,0,320,256,336,0);
let visibleFoodAndTablePixels=0;
for(let y=0;y<96;y++)for(let x=0;x<96;x++){
 const source=(foodImage.width*(y+32)+x)*4,a=foodImage.data[source+3]/255;
 if(!a)continue;visibleFoodAndTablePixels++;
 const dest=(normal.width*(y+96)+x+160)*4,floor=(baseImage.width*(y%32)+x%32)*4;
 for(let c=0;c<3;c++)ensure(normal.data[dest+c]===Math.round(foodImage.data[source+c]*a+baseImage.data[floor+c]*(1-a)),'Placed food/table pixels differ from source');
 ensure(normal.data[dest+3]===255,'Placed food needs opaque floor');
}
const encode=p=>PNG.sync.write(p), data=p=>'data:image/png;base64,'+encode(p).toString('base64');
const md=`# ${spec.name}\n\n32px·8열. tilesetId: ${tileset.id}. 원본0..159는 보존하며 합성3×3을160..162/168..170/176..178에 복사한다. 예약칸은 사용하지 않는다. 음식 원본 번호와 합성 번호를 혼용하지 않는다.\n\n먼저 하위80칸→상위80칸 전체를 적용한다. 쇼케이스(1,3)3×2와 메뉴/창/벽/출입구(4,7)는 원본 배치를 보존한다. 기존 작은 식탁과 동쪽 화분을 제거하고 독립3×4 앙상블(5,3)을 한 번 찍는다. 이 장소는 기본 음식3×3 킷을 그대로 찍은 예제가 아니다. 실제 식탁은y4..5, 위 여백y3 양쪽은 통과이며 중앙은 의자가 차단한다. 북쪽 의자(6,3), 남쪽 의자(6,6)는 옆에서 접근한다. x4와x8 통로, 쇼케이스 앞(2,5)·뒤(2,2)는 비운다. 음식 그림에 별도 음식을 덧씌우지 않는다. 3칸 식탁은 고정 완성 객체이며 반복하지 않는다.\n\n기본 음식3×3 킷과 아틀라스9칸은 별도로 보존한다. 이 장소 전용 앙상블은 그 상단3칸(160..162, 원본 합성12..14)의 알파가 전부0임을 검사한 뒤 상단을[-1,51,-1]로 정의하고, 다음2행은 음식 식탁6칸, 마지막행은[-1,59,-1]이다. 불투명 음식/식탁 픽셀은 지우지 않는다. 이 예외를 다른 음식에 적용하지 않는다. 착석 애니메이션을 뜻하지 않는다. 주황 음료 잔1개, 식탁·양쪽 다리 전체가 원본 픽셀이다. ${spec.limitations}\n\n출처: ${spec.sources.map(s=>`${s.filename} SHA-256 ${s.sha256} [제작자](${s.page})`).join('; ')}. Pixel Art World / ドット絵世界 (yms). [이용 규약](https://yms.main.jp/dotartworld/page1/rule.html): 사용자 로컬 자료. 원본/파생 소재 재배포 금지, 작품 이용 시 출처 표기.\n\n\`\`\`json\n${JSON.stringify({tilesetId:tileset.id,sourceTiles:spec.foodSourceTiles,destinationTiles:spec.foodDestinationTiles,transparentOverlay:spec.transparentOverlay,ensemble,expected,incorrect,errors,approaches:spec.approaches},null,2)}\n\`\`\`\n\n![실제 완성](image:assembled)\n![왼쪽 정상·오른쪽 오류](image:comparison)\n\n자동 좌표 검사: 배열길이80, 원본160칸 픽셀 보존, 합성9칸 동일, 실제 엔진 canMove BFS로 출입구에서 접근칸 전부 연결, 고립 통과칸0, 식탁6칸 차단. 오류예제는 다리3칸 누락과 문앞 차단. 구조와 타일 통행만 관찰하며 플레이 이벤트/미적 품질을 자동 판정하지 않는다.\n`;
const category={id:'icecream-orange-drink-place',name:spec.name,description:'음료1개를 식탁에 놓은 완성10×8. 정적 장소; 이벤트 별도.',documents:[{id:'layout',name:'전체 배열과 배치.md',markdown:md}],images:[{id:'assembled',name:'assembled.png',caption:'실제 타일10×8 완성',dataUrl:data(normal)},{id:'comparison',name:'comparison.png',caption:'왼쪽 정상 / 오른쪽 다리 누락·출입구 차단',dataUrl:data(comparison)}]};
tileset.referenceDocuments=[...tileset.referenceDocuments,category];
const basicFood={width:3,height:3,lowerTiles:Array(9).fill(-1),upperTiles:spec.foodDestinationTiles.flat()};
const ensembleWrong=structuredClone(ensemble);ensembleWrong.upperTiles[7]=-1;
const ensembleNormalImage=render({...ensemble,lowerTiles:Array(12).fill(0)}),ensembleWrongImage=render({...ensembleWrong,lowerTiles:Array(12).fill(0)});
const ensembleComparison=new PNG({width:208,height:128});ensembleComparison.data.fill(0);PNG.bitblt(ensembleNormalImage,ensembleComparison,0,0,96,128,0,0);PNG.bitblt(ensembleWrongImage,ensembleComparison,0,0,96,128,112,0);
const ensembleDoc={id:'ensemble',name:'음료 식탁과 마주보는2석 전체 배열.md',markdown:`# 음료 식탁+마주보는2석 · 3×4\n\n독립 앙상블. 기본3×3 음식 킷을 그대로 배치한 예제가 아니다. 원본 합성 첫 행12/13/14의 실제 알파3072개가 전부0임을 확인했다. 원본 남향 의자51을 첫 행 중앙, 음료 식탁6칸을 다음2행, 북향59를 마지막행 중앙에 놓는다. 하위-1은 기존 바닥 보존. 반드시 원본 불투명 바닥0 위에 놓는다. 식탁 실제 밑동은 로컬y2, 의자는y0/y3 바닥에 닿는다. 접근은 객체 밖 좌우x=-1/3, y=0/3. 식탁 중심을 통과하지 않는다. 다른 음식 첫 행이 비어 있다고 추측하지 않는다.\n\n아래 sourceRelation의 기본3×3 킷은 아틀라스에 그대로 보존하며, 이 앙상블만 투명행을 치환했다. 픽셀 확대/재색칠/음료 중복 없음.\n\n\`\`\`json\n${JSON.stringify({tilesetId:tileset.id,sourceRelation:{basicFood,originalChairTiles:[51,59],foodSourceTiles:spec.foodSourceTiles},expected:ensemble,incorrect:ensembleWrong,errors:[{code:'MISSING_TABLE_CENTER_LEG',x:1,y:2}],approaches:[{x:-1,y:0},{x:3,y:0},{x:-1,y:3},{x:3,y:3}]},null,2)}\n\`\`\`\n\n![왼쪽 정상·오른쪽 식탁 하단 중앙 누락](image:ensemble-comparison)\n`};
category.documents.push(ensembleDoc,{id:'basic-food',name:'보존된 기본 음식3×3.md',markdown:`# 주황 음료 기본3×3 보존\n\n장소의 앙상블과 별도 킷. 이9칸은 shared_paw_food_juice_table의12/13/14,24/25/26,36/37/38을 픽셀 그대로 복사했다. 상단3칸은 완전투명, 하단2행 식탁은 차단. 하위-1은 원본 바닥 보존. 남쪽 접근(1,3)을 비운다.\n\n\`\`\`json\n${JSON.stringify({tilesetId:tileset.id,...basicFood},null,2)}\n\`\`\`\n`});
category.images.push({id:'ensemble-comparison',name:'ensemble-comparison.png',caption:'3×4 앙상블 정상과 하단 중앙 누락',dataUrl:data(ensembleComparison)});
const makeKit=(id,name,layout)=>({id,kind:'section',name,width:layout.width,height:layout.height,tileSize:32,rows:Array.from({length:layout.height},(_,y)=>({tiles:layout.lowerTiles.slice(y*layout.width,(y+1)*layout.width),upperTiles:layout.upperTiles.slice(y*layout.width,(y+1)*layout.width)})),learnedFrom:'db-authored',referenceDocuments:[category]});
const basicKit=makeKit(spec.id+'_food_basic','주황 음료 식탁 · 기본3×3',basicFood);
const ensembleKit=makeKit(spec.id+'_ensemble','주황 음료 식탁+마주보는2석 · 3×4',ensemble);
const kit={id:spec.id+'_raster',kind:'section',name:spec.name,width:10,height:8,tileSize:32,rows:Array.from({length:8},(_,y)=>({tiles:expected.lowerTiles.slice(y*10,y*10+10),upperTiles:expected.upperTiles.slice(y*10,y*10+10)})),learnedFrom:'db-authored',ai:{description:'완성 벽·쇼케이스·음료 식탁과2석, 실제10×8 고정 장소',placementRules:'전체 배열 적용. 출입구(4,7),쇼케이스 앞뒤,x4/8통로 보존. 이벤트 별도.',role:'section',repeatability:'fixed',origin:'ai'},referenceDocuments:[category]};
tileset.structureKits=[basicKit,ensembleKit,kit];
const place={id:spec.id,name:spec.name,revision:1,tags:['Pixel Art World','실내','음료 식탁','고정 조립','이벤트 별도'],provenance:{origin:'ai',sourceId:spec.basePlaceId},kind:'facility',layout:'manual',children:[],ports:[{id:spec.id+'_entry',name:'출입구',...spec.entrance}],connections:[],exterior:{tilesetId:tileset.id,kitId:kit.id},referenceDocuments:[category]};
const asset={id:spec.assetId,name:'icecream-orange-drink-local.png',kind:'chipset',meta:{tileSize:32,width:256,height:736,frameWidth:32,frameHeight:32,frames:184},dataUrl:data(atlas)};
for(const existing of Object.values(shared.libraries))ensure(!existing.places?.[place.id]&&!existing.tilesets?.[tileset.id]&&!existing.assets?.[asset.id],'New shared identity already exists; refresh proposal');
ensure(!project.tilesets[tileset.id]&&!project.assets.uploaded[asset.id],'New project identity already exists; refresh proposal');
const library={version:1,projectDefaults:true,roots:[place.id],places:{[place.id]:place},regions:{},maps:{},tilesets:{[tileset.id]:tileset},assets:{[asset.id]:asset},previews:{[place.id]:data(normal)},sourceProjectId:proof.projectId};
const baseLibrary=shared.libraries[spec.baseLibraryId],basePlace=baseLibrary?.places[spec.basePlaceId];ensure(basePlace,'Current shared base place missing');
const deps={sourceReceipt:proof,sharedRevision:shared.revision,beforeDependencies:{collisionSourceSha256:hash(await readFile(join(repo,'src/project/collision.ts'))),baseTileset:{id:base.id,sha256:hash(base)},foodTileset:{id:food.id,sha256:hash(food)},basePlace:{libraryId:spec.baseLibraryId,id:basePlace.id,sha256:hash(basePlace)},sharedBaseTileset:{id:basePlace.exterior.tilesetId,sha256:hash(baseLibrary.tilesets[basePlace.exterior.tilesetId])}},sourcePngSha256:spec.sources,derivedInputPngSha256:hash(foodBytes),resultAssetSha256:hash(encode(atlas)),policy:'Add separate place/tileset/asset only; preserve existing IDs. Re-read target and compare beforeDependencies before merging. No DB writes performed.',newIds:{place:place.id,tileset:tileset.id,asset:asset.id},exactPixelCopies:{baseTiles:160,appendedTiles:9,transparentFoodTopPixels:3072,visibleFoodAndTablePixels,sourceReconstruction:'exact original table96x64 + original juice alpha9x22 at(44,34)'},grounding:{floorTile:0,opaque:true,tableBases:[{x:5,y:5},{x:6,y:5},{x:7,y:5}],chairBases:[{x:6,y:3},{x:6,y:6}]},diagnosticErrors:errors,collision:{authority:'src/project/collision.ts canMove/isPassable',reachableCells:paths.size,unreachablePassable:unreachable,approachPaths:required.map(p=>({target:p,path:paths.get(`${p.x},${p.y}`)}))}};
for(const[name,png]of[['atlas',atlas],['assembled',normal],['incorrect',wrong],['comparison',comparison],['ensemble-comparison',ensembleComparison]])await writeFile(join(out,name+'.png'),encode(png));
for(const[name,value]of[['library',library],['proposal',{place,tileset,asset,map,expected,incorrect}],['preparation-proof',deps]])await writeFile(join(out,name+'.json'),JSON.stringify(value,null,2));
await writeFile(join(out,'layout.md'),md);console.log(JSON.stringify({out,place:place.id,dimensions:'10x8',reachable:paths.size,exactPixelCopies:deps.exactPixelCopies}));
