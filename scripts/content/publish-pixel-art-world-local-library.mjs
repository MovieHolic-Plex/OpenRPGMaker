// User-downloaded pixels stay in this user's local shared SQLite, never in a shipped asset bundle.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pngjs from 'pngjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { withTsModule } from '../ontology-ts-loader.mjs';

const [input, proofFile, out, action] = process.argv.slice(2);
if (!input || !proofFile || !out || !['--prepare', '--publish-local'].includes(action)) throw Error('Usage: <host-reloaded portable.json> <source-proof.json> <private-output> --prepare|--publish-local');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const project = await read(input), proof = await read(proofFile);
if (!proof.projectId || !proof.projectDir || !proof.sha256) throw Error('Canonical host source proof required');
if (!proof.portableSha256 || createHash('sha256').update(await fs.readFile(input)).digest('hex') !== proof.portableSha256) throw Error('Portable source does not match canonical read receipt');
const packs = (await Promise.all(['Catalog','UrbanCatalog','SchoolCatalog','FacilitiesCatalog','HomeCatalog','StaticExpansionCatalog','NativeComplementsCatalog','HospitalityComplementsCatalog'].map(n => read(`src/assets/pixelArtWorld${n}.json`)))).flat();
const school = await read('src/assets/pixelArtWorldSchoolBuilding.json');
const extras = await read('tiledata/pixel-art-world/school-building-parts.json');
const homePlans = (await read('tiledata/pixel-art-world/compact-homes.json')).maps;
const civicPlans = (await read('tiledata/pixel-art-world/compact-civic.json')).maps;
const tabletopRecipes = await read('tiledata/pixel-art-world/tabletop-composites.json');
const { PNG } = pngjs, pngs = new Map();
const key = id => { const normalized=id.replaceAll('-', '_'); return `shared_${normalized.startsWith('paw_')?normalized:'paw_'+normalized}`; };
const lib = { version:1, projectDefaults:true, roots:[], places:{}, regions:{}, tilesets:{}, assets:{}, maps:{}, sourceProjectId:proof.projectId, previews:{} };
const hash = text => createHash('sha256').update(text).digest('hex');
await fs.mkdir(out, {recursive:true});

for (const source of Object.values(project.tilesets).filter(t => t.id.startsWith('paw-'))) {
  const tile = structuredClone(source), asset = structuredClone(project.assets.uploaded[tile.image.id]);
  if (!asset?.dataUrl?.startsWith('data:image/png;base64,')) throw Error('Resolve source asset through host first: '+source.id);
  tile.id = key(source.id); asset.id = tile.id+'_image'; tile.image = {type:'uploaded',id:asset.id}; tile.structureKits = [];
  // Source document contents keep their original atlas IDs; explicit mapping is attached below.
  tile.referenceDocuments ??= [];
  tile.referenceDocuments.unshift({id:'shared-identity',name:'공용 원본과 번호',description:'다운로드한 원본의 사용자 로컬 공용 사본. 타일 번호는 바뀌지 않았다.',documents:[{id:'identity',name:'원본 대응.md',markdown:`원본 tilesetId: ${source.id}\n공용 tilesetId: \`${tile.id}\`\n칸 크기: ${tile.tileSize}px, 열 수: ${tile.tilesPerRow}, count: ${tile.count}.\n원본 참조 문서의 ${source.id}는 여기서는 \`${tile.id}\`다. 타일 번호와 레이어/통행 배열은 그대로 보존한다.\n파일 SHA256: ${hash(Buffer.from(asset.dataUrl.split(',')[1],'base64'))}\n사용자 다운로드 원본은 로컬 공용 SQLite에서만 재사용하며 Git/public/배포 번들에 넣지 않는다.`}],images:[]});
  if (tile.referenceSourceTilesetId) tile.referenceSourceTilesetId = key(tile.referenceSourceTilesetId);
  lib.tilesets[tile.id] = tile; lib.assets[asset.id] = asset;
  pngs.set(tile.id, PNG.sync.read(Buffer.from(asset.dataUrl.split(',')[1],'base64')));
}

// Door reference documents depend on user-local sprites, not on the tile atlas.
const doors = await read('src/assets/pixelArtWorldDoors.json');
for (const pack of doors) {
  const id=key(pack.id), asset=project.assets.uploaded[id];
  const categories=Object.values(project.tilesets).filter(t=>t.id.startsWith('paw-')).flatMap(t=>t.referenceDocuments??[]).filter(c=>c.id===pack.id);
  if(!asset&&!categories.length)continue;
  if(!asset||!categories.length)throw Error('Incomplete door dependency '+pack.id);
  const meta=asset.meta;
  if(asset.kind!=='sprite'||!meta||meta.frames!==pack.frames.length||['width','height','frameWidth','frameHeight'].some(k=>meta[k]!==pack[k]))throw Error('Door geometry differs '+id);
  if(!asset.dataUrl?.startsWith('data:image/png;base64,'))throw Error('Resolve door asset through host first: '+id);
  const png=PNG.sync.read(Buffer.from(asset.dataUrl.split(',')[1],'base64'));
  if(png.width!==pack.width||png.height!==pack.height)throw Error('Door PNG dimensions differ '+id);
  for(const c of categories){
    let examples=0;
    for(const d of c.documents)for(const match of d.markdown.matchAll(/```json\s*\n([\s\S]*?)\n```/g)){
      const visit=value=>{
        if(!value||typeof value!=='object')return;
        if(value.type==='uploaded'&&typeof value.id==='string'){
          if(value.id!==id)throw Error('Door document asset differs '+value.id);
          examples++;
        }
        Object.values(value).forEach(visit);
      };
      visit(JSON.parse(match[1]));
    }
    if(!examples)throw Error('Door graphic example missing '+pack.id);
  }
  lib.assets[id]=structuredClone(asset);
}

function render(tileId, width, height, lower, upper) {
  const tile = lib.tilesets[tileId], src = pngs.get(tileId), size = tile.tileSize;
  const dst = new PNG({width:width*size,height:height*size});
  for (const layer of [lower, upper]) layer.forEach((t,i) => {
    if (t === -1) return;
    if (!Number.isInteger(t) || t < 0 || t >= tile.count) throw Error('Bad raster tile '+t);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const si=((Math.floor(t/tile.tilesPerRow)*size+y)*src.width+t%tile.tilesPerRow*size+x)*4;
      const di=((Math.floor(i/width)*size+y)*dst.width+i%width*size+x)*4;
      const a=src.data[si+3]/255,c=dst.data[di+3]/255,v=a+c*(1-a);
      for(let k=0;k<3;k++)dst.data[di+k]=v?Math.round((src.data[si+k]*a+dst.data[di+k]*c*(1-a))/v):0;
      dst.data[di+3]=Math.round(v*255);
    }
  });
  return 'data:image/png;base64,'+PNG.sync.write(dst,{deflateStrategy:0}).toString('base64');
}
function category(id,name,markdown,image) {
  return {id,name,description:'원본·전체 배열·배치 제약·실제 타일 그림',documents:[{id:'assembly',name:name+'.md',markdown:markdown+'\n\n![실제 타일](image:assembled)'}],images:[{id:'assembled',name:id+'.png',caption:name+' · 원본 픽셀 그대로 조립',dataUrl:image}]};
}
function rows(width,height,lower,upper) {
  if(lower.length!==width*height||upper.length!==width*height)throw Error('Incomplete kit arrays');
  return Array.from({length:height},(_,y)=>({tiles:lower.slice(y*width,(y+1)*width),upperTiles:upper.slice(y*width,(y+1)*width)}));
}
function addObject(tileId,id,name,width,height,lower,upper,instructions,sourceDocs=[]) {
  const image=render(tileId,width,height,lower,upper);
  const doc=category('assembly',name,`${instructions}\n\n공용 tilesetId: \`${tileId}\`; 32px, 0기준 행 우선. -1은 덮지 않는 칸.\n\n\`\`\`json\n${JSON.stringify({width,height,lowerTiles:lower,upperTiles:upper})}\n\`\`\``,image);
  lib.tilesets[tileId].structureKits.push({id,kind:'section',name,width,height,tileSize:32,rows:rows(width,height,lower,upper),learnedFrom:'db-authored',referenceDocuments:[doc,...sourceDocs],ai:{description:name,placementRules:instructions,repeatability:'fixed',layerHome:lower.every(t=>t===-1)?'upper':'perCell',origin:'ai',tags:['Pixel Art World','사용자 다운로드','원본32px']}});
}
for(const pack of packs.filter(pack=>project.tilesets[pack.id])) for(const recipe of pack.recipes){
  const tileId=key(pack.id),width=recipe.tiles[0].length,height=recipe.tiles.length;
  const source=project.tilesets[pack.id].referenceDocuments?.flatMap(c=>c.documents.some(d=>d.id===recipe.id)?[{...c,id:'source-evidence',documents:c.documents.filter(d=>d.id===recipe.id),images:c.images.filter(i=>i.id===recipe.id)}]:[])??[];
  addObject(tileId,key(pack.id+'_'+recipe.id),recipe.name,width,height,Array(width*height).fill(-1),recipe.tiles.flat(),
    `고정 ${width}×${height} 전체를 상위에 놓고 기존 하위 바닥을 보존한다. 자르기·반전·늘이기 금지. 설치 종류 ${recipe.placementKind??'원본 문서 참조'}, 지지칸 ${JSON.stringify(recipe.supportCells??[])}. ${recipe.facing} 방향 접근칸을 비운다. 문/계단 그림만으로 이벤트가 생성되지 않는다. 원본 ${pack.filename}, SHA256 ${pack.sha256}, sourceRect ${JSON.stringify(recipe.sourceRect)}.`,source);
}
for(const recipe of tabletopRecipes){
  const source=project.tilesets[recipe.packId];
  const kit=source?.structureKits?.find(k=>k.id===recipe.id);
  if(!kit)continue;
  const lower=kit.rows.flatMap(r=>r.tiles),upper=kit.rows.flatMap(r=>r.upperTiles);
  const docs=source.referenceDocuments.filter(c=>c.id==='paw-tabletop-composites').map(c=>({...c,documents:c.documents.filter(d=>d.id===recipe.id),images:c.images.filter(i=>i.id===recipe.id)}));
  if(docs.length!==1||docs[0].documents.length!==1||docs[0].images.length!==1)throw Error('Composite source documents missing '+recipe.id);
  addObject(key(recipe.packId),key(recipe.id),recipe.name,kit.width,kit.height,lower,upper,
    `${recipe.notes} 상판 소품은 완전 가구와 이미 합성했다. 전체 상위 배열을 찍고 하위 바닥을 보존한다. 조작면 ${recipe.facing}, 가구 전체 사각형 차단. 원본 ${recipe.sourceFilename}, SHA256 ${recipe.sourceSha256}.`,docs);
}
for(const recipe of extras.recipes){
  const tileId=key('paw-school-four-composed'), width=recipe.tiles[0].length,height=recipe.tiles.length;
  const upper=recipe.tiles.flatMap((row,y)=>row.map((tile,x)=>{
    if(tile<0)return -1;
    const passage=recipe.walkCells?.some(c=>c.x===x&&c.y===y)?'passable':'blocked';
    const id=school.tiles.findIndex(t=>t.source===recipe.source&&t.tile===tile&&t.layer==='upper'&&t.passage===passage);
    if(id<0)throw Error('Missing compiled part '+recipe.id);return id;
  }));
  const floor=school.tiles.findIndex(t=>t.source==='ST-Schl-I01.png'&&t.tile===6&&t.layer==='lower');
  addObject(tileId,key('paw_'+recipe.id),recipe.name,width,height,Array(width*height).fill(recipe.id.startsWith('stairs-')?floor:-1),upper,
    `${recipe.notes} 원본 ${recipe.source}; 조립 사전 ${JSON.stringify(recipe)}. 현재 번호는 학교 합성 atlas 전용이다. 계단은 action 이벤트와 목적층 출현칸을 따로 연결한다.`);
}

// Importer scene references are reusable place assemblies, separate from saved
// game maps. Keep the full geometry and source pixels available to AI readers.
const complements = (await Promise.all(['Native','Hospitality'].map(kind => read(`src/assets/pixelArtWorld${kind}ComplementsCatalog.json`)))).flat();
for (const pack of complements.filter(pack => project.tilesets[pack.id])) for (const scene of pack.scenes) {
  const tileId=key(pack.id), id=key(scene.id), kitId=id+'_raster';
  const image=render(tileId,scene.width,scene.height,scene.lowerTiles,scene.upperTiles);
  const guide=`# ${scene.name}\n\n원본 ${pack.filename}, SHA256 ${pack.sha256}. 공용 tilesetId: \`${tileId}\`.\n이 자료는 고정 타일 조립 장소다. 실행 맵·출입/문 개폐 이벤트는 포함하지 않는다. 실제 게임에 배치할 때 외부 출입구와 목적 맵을 연결하고 문 상태·통행을 별도로 저작한다.\n${scene.notes}\n\n전체 배열, 가구 원점, 지지/접근칸, 방 구획과 출입구:\n\n\`\`\`json\n${JSON.stringify(scene)}\n\`\`\`\n\n부품별 지지칸·방향은 같은 타일셋의 오브젝트 문서를 함께 읽는다. 벽걸이 장식과 바닥형 가구의 지지 조건을 바꾸지 않는다.`;
  const docs=[category('place-assembly',scene.name,guide,image)];
  lib.tilesets[tileId].structureKits.push({id:kitId,kind:'section',name:scene.name,width:scene.width,height:scene.height,tileSize:32,rows:rows(scene.width,scene.height,scene.lowerTiles,scene.upperTiles),learnedFrom:'db-authored',referenceDocuments:docs,ai:{description:scene.name+' 고정 조립',placementRules:'전체 배열·가구 방향·접근칸과 문턱을 보존한다. 출입과 문 상태 이벤트는 별도다.',repeatability:'fixed',layerHome:'perCell',origin:'ai'}});
  lib.places[id]={id,name:scene.name,revision:1,tags:['Pixel Art World','실내','고정 조립','이벤트 별도'],provenance:{origin:'ai',sourceId:scene.id},kind:'facility',layout:'manual',children:[],ports:(scene.doorways??[]).filter(d=>d.from==='outside'||d.to==='outside').map((d,i)=>({id:id+'_entry_'+i,name:'출입구',x:d.x,y:d.y})),connections:[],exterior:{tilesetId:tileId,kitId},referenceDocuments:docs};
  lib.previews[id]=image;
  // These source-pixel assemblies passed a separate composition review; they remain static examples with explicit event limitations.
  lib.roots.push(id);
  await fs.writeFile(`${out}/${id}.png`,Buffer.from(image.split(',')[1],'base64'));
}

const mapIds = new Map(Object.keys(project.maps).map(id=>[id,key(id)]));
// Adversarial review findings stay explicit; these sources are not offered as reviewed roots.
const pendingReview = {
  'office-compact-7':'북향 의자로 방향은 수정했다. 두 빈 상판에 실제 업무 소품을 합성해야 업무실 역할이 더 명확해진다.',
  'clinic-waiting-exam-2':'대기석이 북벽 TV 반대쪽을 바라본다. 접수대 x2..4/y4..5 뒤 직원 통로도 없다.',
  'conveni-compact-shop-3':'카운터 x2..4/y6..7에 실제 결제 장치가 없다. ATM을 계산대로 오인하지 않는다.',
  'fastfood-compact-diner-4':'주문대 x2..10/y6..7에 결제 장치가 없다. 상판을 자르지 않고 원본 POS와 합성해야 한다.',
  'home-compact-5':'주택 2개가 동일한 평면/가구 배치다. 별도 주거 구성으로 다시 저작할 예정.',
  'home-compact-6':'첫 번째 주택과 동일한 평면/가구 배치다. 별도 주거 구성으로 다시 저작할 예정.',
};
function rewriteTransfers(value){
  if(Array.isArray(value))return value.map(rewriteTransfers);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='mapId'&&mapIds.has(v)?mapIds.get(v):rewriteTransfers(v)]));
}
for(const source of Object.values(project.maps)){
  if(!source.tilesetId.startsWith('paw-'))continue;
  const id=mapIds.get(source.id),tileId=key(source.tilesetId),map=rewriteTransfers(structuredClone(source));map.id=id;map.tilesetId=tileId;lib.maps[id]=map;
  const image=render(tileId,map.width,map.height,map.lowerTiles,map.upperTiles);lib.previews[id]=image;
  await fs.writeFile(`${out}/${id}.png`,Buffer.from(image.split(',')[1],'base64'));
  const floor=school.floors.find(f=>f.id===source.id), schoolGuide=floor?school.guide:'';
  const candidate=homePlans[source.id];
  const home=candidate&&candidate.width===map.width&&candidate.height===map.height&&JSON.stringify(candidate.lowerTiles)===JSON.stringify(map.lowerTiles)&&JSON.stringify(candidate.upperTiles)===JSON.stringify(map.upperTiles)?candidate:null;
  const civicCandidate=civicPlans[source.id];
  const civic=civicCandidate&&civicCandidate.width===map.width&&civicCandidate.height===map.height&&JSON.stringify(civicCandidate.lowerTiles)===JSON.stringify(map.lowerTiles)&&JSON.stringify(civicCandidate.upperTiles)===JSON.stringify(map.upperTiles)?civicCandidate:null;
  const guide=`# ${map.name}\n\n정본 ${proof.projectId}, revision ${proof.revision}, 원본 mapId ${source.id}.\n공용 mapId \`${id}\`, tilesetId \`${tileId}\`.\n${schoolGuide}\n\n원본 사건을 보관한 전체 맵은 library.maps에 있다. 장소 그림 킷 자체에는 이벤트가 없다. 계단/출입구는 ports/connections와 원본 events를 함께 읽고 목적 mapId를 다시 연결한다.\n이 사례 하나는 소재 전체 또는 미검토 타일의 지원 완료를 뜻하지 않는다.\n\n\`\`\`json\n${JSON.stringify({width:map.width,height:map.height,lowerTiles:map.lowerTiles,upperTiles:map.upperTiles,events:map.events,...(floor?{rooms:floor.rooms,stairs:floor.stairs,spawn:floor.spawn}:{}),...(home?{rooms:home.rooms,doorways:home.doorways,placements:home.placements,approachCells:home.approachCells,spawn:home.spawn,exitTrigger:home.exitTrigger,designNotes:home.designNotes}:{})})}\n\`\`\``;
  const docs=[category('place-layout',map.name,guide,image)];
  if(civic)docs.push(category('civic-placement',map.name+' · 가구와 동선',`${civic.designNotes.join('\n\n')}\n\n상위 소품을 같은 칸에 겹쳐 지우지 않고 완전 조립 타일을 사용한다. 각 가구 방향·밑동과 직원/손님 접근칸, 문턱을 유지한다. 결제·앉기·진료 이벤트는 별도다.\n\n\`\`\`json\n${JSON.stringify({placements:civic.placements,approachCells:civic.approachCells,spawn:civic.spawn,exitTrigger:civic.exitTrigger,ceilingCells:civic.ceilingCells})}\n\`\`\``,image));
  if(pendingReview[source.id]&&!home&&!civic) docs.unshift({id:'review-pending',name:'수정 전 사례 · 그대로 재사용 금지',description:pendingReview[source.id],documents:[{id:'findings',name:'적대적 시각 검토.md',markdown:`# 수정 대기\n\n${pendingReview[source.id]}\n\n좌표는 이 실제 저장 맵의 0기준 타일 좌표다. 아래 전체 배열/그림은 수정할 원본을 식별하는 자료이며 정상 배치의 정답이 아니다. 공용 장소의 검토 완료 목록에서는 제외한다.`}],images:[]});
  const kitId=id+'_raster';
  lib.tilesets[tileId].structureKits.push({id:kitId,kind:'section',name:map.name,width:map.width,height:map.height,tileSize:32,rows:rows(map.width,map.height,map.lowerTiles,map.upperTiles),learnedFrom:'db-authored',ai:{description:map.name+' 전체 평면',placementRules:'전체 배열과 한 칸 출입구, 좌석 접근칸, 바닥에 닿는 가구 밑동을 보존한다. 이벤트는 별도로 연결한다.',repeatability:'fixed',layerHome:'perCell',origin:'ai'},referenceDocuments:docs});
  lib.places[id]={id,name:map.name,revision:1,tags:['Pixel Art World',floor?'학교':'현대도시','다운로드 소재'],provenance:{origin:'ai',sourceId:source.id},kind:source.id==='paw_city'?'settlement':'facility',layout:'manual',children:[],ports:(floor?.stairs??[]).map(s=>({id:`${id}_${s.direction}_${s.x<30?'west':'east'}`,name:s.destinationLevel+'층',x:s.x,y:s.y})),connections:[],exterior:{tilesetId:tileId,kitId},referenceDocuments:docs};
  // New maps need an explicit visual review before joining the approved roots.
  if(['paw_city','library-compact-1'].includes(source.id)||home||civic)lib.roots.push(id);
  if(source.id==='paw_city')lib.regions[id]={id,name:map.name,kind:'completed-map',regionKind:'settlement',revision:1,width:map.width,height:map.height,tilesetId:tileId,preview:image,sourceProjectId:proof.projectId,sourceMapId:id,snapshotProjectId:proof.projectId,rules:['50×50 실제 저장 평면. 도로·건물 입구와 시설 목적맵의 연결을 보존한다.','완성도는 별도 시각 검토 대상이며 자동 구조 검사는 미적 승인이 아니다.'],limitations:'현재 도시 배치 참고. 전체 카탈로그 지원 완료가 아니다. 사용자 로컬 다운로드 원본만 포함.',referenceDocuments:docs};
}
const buildingId='shared_paw_school_building';
lib.places[buildingId]={id:buildingId,name:'햇살학교 · 4층 / 28실',revision:1,tags:['Pixel Art World','학교','4층','복도2칸'],provenance:{origin:'ai',sourceId:'paw-school-building-design'},kind:'facility',layout:'manual',children:school.floors.map(f=>({id:key(f.id)+'_slot',source:{kind:'place',id:key(f.id)},level:f.level,x:0,y:0})),ports:[],connections:[],referenceDocuments:[{id:'building-plan',name:'4층 연결과 배치 지침',description:'교실16·특별관리실8·화장실4. 원본 판본과 실제 공간 규칙.',documents:[{id:'guide',name:'조립 지침.md',markdown:school.guide}],images:[]}]};
for(const floor of school.floors.filter(f=>f.level<4))for(const side of ['west','east'])lib.places[buildingId].connections.push({id:`${buildingId}_${floor.level}_${side}`,from:{childId:key(floor.id)+'_slot',portId:`${key(floor.id)}_up_${side}`},to:{childId:key(`paw-school-floor-${floor.level+1}`)+'_slot',portId:`${key(`paw-school-floor-${floor.level+1}`)}_down_${side}`},bidirectional:true});
lib.roots.push(buildingId);lib.previews[buildingId]=lib.previews[key(school.floors[0].id)];
await fs.writeFile(out+'/library.json',JSON.stringify(lib));
// Preserve every reference pixel while avoiding the host's 64 MiB request cap.
const compressed=await promisify(execFile)('python3',['scripts/content/compress-pixel-art-world-reference-images.py',out+'/library.json']);
Object.assign(lib,await read(out+'/library.json'));
const summary={source:proof,libraryId:'pixel-art-world-local',places:Object.keys(lib.places).length,roots:lib.roots.length,regions:Object.keys(lib.regions).length,tilesets:Object.keys(lib.tilesets).length,objects:Object.values(lib.tilesets).reduce((n,t)=>n+t.structureKits.filter(k=>!k.id.endsWith('_raster')).length,0),maps:Object.keys(lib.maps).length,pixelDistribution:'user-local-only',scope:'Existing authored examples; full catalog expansion remains in progress'};
summary.referenceCompression=JSON.parse(compressed.stdout);
await withTsModule('scripts/lib/sharedContentSqlite.ts','paw-shared-publish.mjs',async api=>{
  const old=api.readSharedContent();
  for(const pack of doors){
    const id=key(pack.id);
    if(old.libraries[summary.libraryId]?.assets[id]&&!lib.assets[id])throw Error('Refuse removing an installed door from a stale source: '+id);
  }
  const expected=old.libraries[summary.libraryId]?hash(JSON.stringify(old.libraries[summary.libraryId])):null;
  if(action==='--publish-local'){
    const saved=api.publishSharedContent(summary.libraryId,lib,expected);
    Object.assign(summary,{file:saved.file,revision:saved.revision,reloadedEqual:JSON.stringify(saved.reloaded)===JSON.stringify(lib)});
    const after=api.readSharedContent();for(const[id,value]of Object.entries(old.libraries))if(id!==summary.libraryId&&JSON.stringify(after.libraries[id])!==JSON.stringify(value))throw Error('Unrelated library changed '+id);
  }
});
await fs.writeFile(out+'/proof.json',JSON.stringify(summary,null,2));console.log(summary);
