// User-local composition: eight authored interiors, no downloadable pixels in Git.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {build} from 'esbuild';
const [input,sourceDir,out]=process.argv.slice(2);
if(!input||!sourceDir||!out)throw Error('Usage: <canonical portable> <user PNG directory> <private output>');
const read=async f=>JSON.parse(await fs.readFile(f,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
const project=await read(input),proof=await read(path.join(path.dirname(input),'source-proof.json'));
if(hash(await fs.readFile(input))!==proof.portableSha256)throw Error('Canonical receipt differs');
const plans=(await read('tiledata/pixel-art-world/modern-interiors-layout.json')).maps;
const catalogs=(await Promise.all(['HospitalityComplements','BathGym','NativeComplements','JapaneseInteriors','Facilities'].map(n=>read('src/assets/pixelArtWorld'+n+'Catalog.json')))).flat();
const needed=new Set(plans.flatMap(s=>s.placements.map(p=>p.recipeId)));
const recipes=catalogs.flatMap(p=>p.recipes.filter(r=>needed.has(r.id)).map(r=>({...r,sourceId:p.id,filename:p.filename,sha256:p.sha256})));
if(recipes.length!==needed.size)throw Error('Unknown or duplicate recipe');
const sourceIds=[...new Set([...recipes.map(r=>r.sourceId),'paw-izakaya'])];
const sources={};
for(const id of sourceIds){
 const pack=catalogs.find(p=>p.id===id),tile=project.tilesets[id];
 if(!tile?.referenceDocuments?.length||tile.referenceSourceTilesetId)throw Error('Read current native reference owner first: '+id);
 if(hash(await fs.readFile(path.join(sourceDir,pack.filename)))!==pack.sha256)throw Error('Source edition differs: '+id);
 sources[id]={tile,asset:project.assets.uploaded[tile.image.id],filename:pack.filename,sha256:pack.sha256};
}
const materials={
 wood:{source:'paw-izakaya',tiles:[[0,1]],kind:'floor'},entry:{source:'paw-izakaya',tiles:[[4]],kind:'floor'},kitchen:{source:'paw-izakaya',tiles:[[6]],kind:'floor'},
 tatami:{source:'paw-izakaya',tiles:[[296,297],[304,305],[312,313]],kind:'floor'},
 'sento-dry':{source:'paw-japanese-public-bath',tiles:[[1]],kind:'floor'},'sento-wet':{source:'paw-japanese-public-bath',tiles:[[224]],kind:'floor'},
 bath:{source:'paw-home-bath',tiles:[[11]],kind:'floor'},clinic:{source:'paw-clinic-interior',tiles:[[1]],kind:'floor'},gym:{source:'paw-school-gym',tiles:[[0]],kind:'floor'},
 'wall-wood':{source:'paw-izakaya',tiles:[[17],[25]],kind:'wall'},'wall-clinic':{source:'paw-clinic-interior',tiles:[[17],[25]],kind:'wall'},
 'wall-sento':{source:'paw-japanese-public-bath',tiles:[[17],[25],[33]],kind:'wall'},'wall-gym':{source:'paw-school-gym',tiles:[[16],[24],[32]],kind:'wall'},
};
await fs.mkdir(out,{recursive:true});
// Use the actual pure engine modules without depending on a long-lived dev server.
const engine=await build({stdin:{contents:`import {canMove} from './src/project/collision';
import {shapeAutotileGroupAround} from './src/project/defaults/autotileEngine';
import {validateTileset} from './src/project/io/shapeResourceFields';
import {applyCeilingWallFaces,inspectCeilingWallFaces} from './scripts/content/pixel-art-world-ceiling-walls.mjs';
globalThis.__pawCompileApi={canMove,shapeAutotileGroupAround,validateTileset,applyCeilingWallFaces,inspectCeilingWallFaces};`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'browser',format:'iife',write:false,logLevel:'silent'});
const browser=await chromium.launch();let result;
try{
 const page=await browser.newPage();await page.addScriptTag({content:engine.outputFiles[0].text});
 result=await page.evaluate(async({sources,recipes,materials,plans})=>{
  const {canMove,shapeAutotileGroupAround,validateTileset,applyCeilingWallFaces,inspectCeilingWallFaces}=globalThis.__pawCompileApi;
  const images={};for(const[id,s]of Object.entries(sources)){const im=new Image();im.src=s.asset.dataUrl;await im.decode();images[id]=im;}
  const cells=[],ids=new Map();
  const take=(source,n,kind,label)=>{const key=source+':'+n+':'+kind;if(!ids.has(key)){ids.set(key,cells.length);cells.push({source,n,kind,label});}return ids.get(key);};
  for(const[name,m]of Object.entries(materials))m.mapped=m.tiles.map(row=>row.map(n=>take(m.source,n,m.kind,name)));
  const mapped=recipes.map(r=>({...r,originalTiles:r.tiles,tiles:r.tiles.map(row=>row.map(n=>take(r.sourceId,n,'object',r.name)))}));
  const nativeGroup=sources['paw-izakaya'].tile.autotileGroups.find(g=>g.id==='paw-wall-a01');
  const remap=new Map(nativeGroup.memberTileIds.map(n=>[n,take('paw-izakaya',n,'ceiling','연결 천장')]));
  const group={...nativeGroup,memberTileIds:nativeGroup.memberTileIds.map(n=>remap.get(n)),variantMap:Object.fromEntries(Object.entries(nativeGroup.variantMap).map(([k,n])=>[k,remap.get(n)]))};
  const atlas=document.createElement('canvas');atlas.width=256;atlas.height=Math.ceil(cells.length/8)*32;
  const ctx=atlas.getContext('2d');cells.forEach((c,i)=>ctx.drawImage(images[c.source],c.n%8*32,Math.floor(c.n/8)*32,32,32,i%8*32,Math.floor(i/8)*32,32,32));
  const sourcePixels={};for(const[id,im]of Object.entries(images)){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);sourcePixels[id]=c.getContext('2d').getImageData(0,0,c.width,c.height).data;}
  const composed=ctx.getImageData(0,0,atlas.width,atlas.height).data;
  cells.forEach((c,i)=>{for(let y=0;y<32;y++)for(let x=0;x<32;x++)for(let channel=0;channel<4;channel++){
   const a=((Math.floor(c.n/8)*32+y)*256+c.n%8*32+x)*4+channel,b=((Math.floor(i/8)*32+y)*256+i%8*32+x)*4+channel;
   if(sourcePixels[c.source][a]!==composed[b])throw Error('Copied cell RGBA differs: '+i);
  }});
  const count=atlas.width/32*atlas.height/32;
  const tile={id:'paw-modern-interiors',name:'Pixel Art World · 현대 일본 실내8종',kind:'custom',image:{type:'uploaded',id:'paw-modern-interiors-source'},tileSize:32,tilesPerRow:8,count,
   passability:Array.from({length:count},(_,i)=>({up:cells[i]?.kind==='floor',down:cells[i]?.kind==='floor',left:cells[i]?.kind==='floor',right:cells[i]?.kind==='floor'})),
   priority:Array.from({length:count},(_,i)=>cells[i]?.kind==='object'?'upper':'lower'),terrain:Array(count).fill(0),
   tileMeta:Array.from({length:count},(_,i)=>({label:cells[i]?.label??'정렬 공백',description:cells[i]?`${cells[i].source} native atlas tile ${cells[i].n}. 원본 번호와 현재 번호를 혼용하지 않는다.`:'사용 금지',defaultLayer:cells[i]?.kind==='object'?'upper':'lower',passage:cells[i]?.kind==='floor'?'passable':'blocked',source:'imported'})),
   tileGroups:[],autotileGroups:[group],structureKits:[],referenceDocuments:[]};
  const floors=new Set(Object.values(materials).filter(m=>m.kind==='floor').flatMap(m=>m.mapped.flat()));
  const render=s=>{const c=document.createElement('canvas');c.width=s.width*32;c.height=s.height*32;const x=c.getContext('2d');for(const a of[s.lowerTiles,s.upperTiles])a.forEach((n,i)=>{if(n>=0)x.drawImage(atlas,n%8*32,Math.floor(n/8)*32,32,32,i%s.width*32,Math.floor(i/s.width)*32,32,32);});return c;};
  const makeCategory=(id,name,markdown,images)=>({id,name,description:'사용자 원본·전체 배열·지지·접근·정상/오류',documents:[{id:'layout',name:name+'.md',markdown}],images});
  const sourceManifest=Object.entries(sources).map(([id,s])=>({id,filename:s.filename,sha256:s.sha256}));
  tile.referenceDocuments.push(makeCategory('modern-source-map','원본과 현재 칸 번호',`# 사용자 로컬 합성\n\n현재 tilesetId ${tile.id},32px·8열. Pixel Art World / ドット絵世界, https://yms.main.jp/dotartworld/ . 원본/가공 픽셀은 사용자 로컬만, Git/public 재배포 없음.\n\n아래 n은 원본 프로젝트의 native atlas 번호, 배열 위치가 현재 번호다. 천장은 SA-WallA01.png의 검토된47변형을 paw-izakaya 480..526에서 가져왔다. 다른 칸은 각 원본 PNG의 n%8,n/8 좌표다.\n\n\`\`\`json\n${JSON.stringify({sources:sourceManifest,materials,cells,group},null,2)}\n\`\`\`\n\n천장→노출 남쪽 끝 아래 벽 전체→전체 가구 순서로 놓는다. standing의 밑동만 바닥 지지, wall-mounted는 전체 벽 받침, 모든 가구 사각은solid. 열린 문턱은 개폐문 이벤트가 아니다.`,[{id:'atlas',name:'local-atlas.png',caption:'현재 번호 순서의 실제 픽셀',dataUrl:atlas.toDataURL()}]));
  // Each remapped object owns its dictionary and a complete normal/error example.
  for(const r of mapped){
   const w=r.tiles[0].length,h=r.tiles.length,ex={width:w+2,height:h+2,lowerTiles:Array((w+2)*(h+2)).fill(materials.wood.mapped[0][0]),upperTiles:Array((w+2)*(h+2)).fill(-1)};
   if(r.placementKind==='wall-mounted')for(let y=1;y<=h;y++)for(let x=1;x<=w;x++)ex.lowerTiles[y*ex.width+x]=materials['wall-wood'].mapped[Math.min(y-1,1)][0];
   r.tiles.forEach((row,y)=>row.forEach((n,x)=>ex.upperTiles[(y+1)*ex.width+x+1]=n));
   const bad=structuredClone(ex);bad.upperTiles[h*ex.width+1]=-1;
   const image=document.createElement('canvas');image.width=ex.width*64;image.height=ex.height*32;image.getContext('2d').drawImage(render(ex),0,0);image.getContext('2d').drawImage(render(bad),ex.width*32,0);
   const doc=makeCategory('part-'+r.id,r.name,`# ${r.name}\n\n현재 ${tile.id}. 원본 ${r.filename}, SHA256 ${r.sha256}; native owner ${r.sourceId}. 원점은0기준 좌상단,32px·8열. 아래 originalTiles/sourceRect는 원본, tiles는 현재 합성 번호다. 무회전·무반전, 사각 전체 고정 조립. ${r.placementKind}, 방향 ${r.facing}. 지지칸 ${JSON.stringify(r.supportCells)}. 가구 앞 접근 또는 의자 뒤 접근은 전체 장면의 approachCells를 따른다.\n\n\`\`\`json\n${JSON.stringify({recipe:r,normal:ex,bad,issues:[{code:'OBJECT_CELL',x:1,y:h}]},null,2)}\n\`\`\`\n\n![정상/하단 조각 누락](image:comparison)`,[{id:'comparison',name:r.id+'.png',caption:'왼쪽 정상 / 오른쪽 하단 첫 칸 누락',dataUrl:image.toDataURL()}]);
   let parts=tile.referenceDocuments.find(c=>c.id==='parts-'+r.sourceId);
   if(!parts){parts={id:'parts-'+r.sourceId,name:r.filename+' · 객체 사전',description:'원본 좌표와 합성 번호·전체 객체·정상/오류',documents:[],images:[]};tile.referenceDocuments.push(parts);}
   parts.documents.push({...doc.documents[0],id:r.id,markdown:doc.documents[0].markdown.replaceAll('image:comparison','image:'+r.id)});
   parts.images.push({...doc.images[0],id:r.id});
   tile.structureKits.push({id:r.id,name:r.name,kind:'section',width:w,height:h,tileSize:32,rows:r.tiles.map(row=>({tiles:Array(w).fill(-1),upperTiles:row})),learnedFrom:'db-authored',referenceDocuments:[doc],ai:{description:r.name,placementRules:'전체 고정 배열. '+r.placementKind+' 밑동/벽 받침 '+JSON.stringify(r.supportCells),repeatability:'fixed',layerHome:'upper',origin:'ai'}});
  }
  const scenes=[],failures=[];
  for(const plan of plans){
   const s=structuredClone(plan),at=(x,y)=>{if(x<0||y<0||x>=s.width||y>=s.height)throw Error('Out of bounds '+s.id+':'+x+','+y);return y*s.width+x;};
   const mat=materials[s.floor];s.lowerTiles=Array.from({length:s.width*s.height},(_,i)=>mat.mapped[Math.floor(i/s.width)%mat.mapped.length][i%s.width%mat.mapped[0].length]);s.upperTiles=Array(s.width*s.height).fill(-1);
   for(const r of s.floorRects){const m=materials[r.material];for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)s.lowerTiles[at(r.x+x,r.y+y)]=m.mapped[y%m.mapped.length][x%m.mapped[0].length];}
   s.wallTiles=materials['wall-'+s.wall].mapped.flat();const wh=s.wallTiles.length;s.outerCeilingBottom=s.height-wh-1;
   s.spawn={x:s.exitX,y:s.outerCeilingBottom-1,direction:'up'};s.exitTrigger={x:s.exitX,y:s.height-1};s.approachCells.push(s.exitTrigger);
   const ceiling=new Set();
   for(let y=0;y<=s.outerCeilingBottom;y++)for(let x=0;x<s.width;x++)if(x===0||x===s.width-1||y===0||y===s.outerCeilingBottom)if(!(x===s.exitX&&y===s.outerCeilingBottom))ceiling.add(at(x,y));
   s.doorways.push({from:'outside',x:s.exitX,y:s.outerCeilingBottom,width:1,height:wh+1});
   for(const l of s.lines){
    for(let n=l.start;n<=l.end;n++){
     const skip=l.axis==='h'?l.doors.includes(n):l.doors.some(d=>n>=d.y-wh&&n<d.y+d.height);
     if(!skip)ceiling.add(at(l.axis==='h'?n:l.pos,l.axis==='h'?l.pos:n));
    }
    for(const d of l.doors)s.doorways.push(l.axis==='h'?{x:d,y:l.pos,width:1,height:wh+1}:{x:l.pos,y:d.y,width:1,height:d.height});
   }
   for(const r of s.ceilingRects)for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)ceiling.add(at(x,y));
   s.ceilingCells=[...ceiling].map(i=>({x:i%s.width,y:Math.floor(i/s.width)}));for(const i of ceiling)s.lowerTiles[i]=group.memberTileIds[0];
   shapeAutotileGroupAround(s,group,s.ceilingCells);applyCeilingWallFaces(s,group.memberTileIds,s.wallTiles);
   const placementIssues=[];
   for(const p of s.placements){const r=mapped.find(r=>r.id===p.recipeId);
    r.tiles.forEach((row,y)=>row.forEach((n,x)=>{const i=at(p.x+x,p.y+y);if(s.upperTiles[i]!==-1)placementIssues.push({code:'FURNITURE_OVERLAP',recipe:r.id,x:p.x+x,y:p.y+y});if(ceiling.has(i))placementIssues.push({code:'ON_CEILING',recipe:r.id,x:p.x+x,y:p.y+y});if(r.placementKind==='wall-mounted'&&!s.wallTiles.includes(s.lowerTiles[i]))placementIssues.push({code:'WALL_SUPPORT',recipe:r.id,x:p.x+x,y:p.y+y});s.upperTiles[i]=n;}));
    if(r.placementKind==='standing')for(const c of r.supportCells)if(!floors.has(s.lowerTiles[at(p.x+c.x,p.y+c.y)]))placementIssues.push({code:'FOOT_ON_WALL',recipe:r.id,x:p.x+c.x,y:p.y+c.y});
   }
   const flood=(scene,start)=>{
    const q=[start],seen=new Set([at(start.x,start.y)]);
    for(let n=0;n<q.length;n++)for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]]){const c=q[n],x=c.x+dx,y=c.y+dy,i=y*s.width+x;if(x<0||y<0||x>=s.width||y>=s.height||seen.has(i))continue;if(canMove({tilesets:{[tile.id]:tile}},{...scene,tilesetId:tile.id},c.x,c.y,x,y)){seen.add(i);q.push({x,y});}}
    return seen;
   };
   const audit=scene=>{
    const issues=inspectCeilingWallFaces(scene,group.memberTileIds,s.wallTiles),seen=flood(scene,s.spawn);
    for(const c of s.approachCells)if(!seen.has(at(c.x,c.y)))issues.push({code:'APPROACH_BLOCKED',...c});
    scene.lowerTiles.forEach((n,i)=>{if(floors.has(n)&&scene.upperTiles[i]===-1&&!seen.has(i))issues.push({code:'ISOLATED_FLOOR',x:i%s.width,y:Math.floor(i/s.width)});});
    for(const r of s.clearanceRects??[])for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)if(scene.upperTiles[at(x,y)]!==-1||!seen.has(at(x,y)))issues.push({code:'PLAY_SPACE_BLOCKED',x,y});
    return {issues,reachable:seen.size};
   };
   const good=audit(s);good.issues.unshift(...placementIssues);
   const reachable=flood(s,s.spawn);
   for(const p of s.placements){const r=mapped.find(r=>r.id===p.recipeId);
    if(!/wardrobe|drawers|bookcase|fridge|kitchen|stove|tea$|wash-station|lockers|shoe-rack|milk-machine|double-sink|toilet|washer|linen|medicine|tv$|cage|chest/.test(r.id))continue;
    const y=p.y+r.tiles.length;
    if(y>=s.height||!r.tiles[0].some((_,x)=>reachable.has(at(p.x+x,y))))good.issues.push({code:'OBJECT_FRONT_BLOCKED',recipe:r.id,x:p.x,y});
   }
   const closed=structuredClone(s);for(const d of s.doorways.filter(d=>d.from!=='outside'))for(let y=d.y;y<d.y+d.height;y++)for(let x=d.x;x<d.x+d.width;x++)closed.lowerTiles[at(x,y)]=s.wallTiles.at(-1);
   for(const id of s.isolationRooms??[]){
    const room=s.rooms.find(r=>r.id===id),within=(r,x,y)=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height;
    const seed=closed.lowerTiles.findIndex((n,i)=>floors.has(n)&&closed.upperTiles[i]===-1&&within(room,i%s.width,Math.floor(i/s.width)));
    if(seed<0){good.issues.push({code:'ROOM_HAS_NO_ACCESSIBLE_FLOOR',room:id});continue;}
    const seen=flood(closed,{x:seed%s.width,y:Math.floor(seed/s.width)});
    for(const other of s.rooms.filter(r=>r.id!==id))if([...seen].some(i=>within(other,i%s.width,Math.floor(i/s.width))))good.issues.push({code:'ROOM_BOUNDARY_LEAK',room:id,to:other.id});
   }
   s.designNotes=[s.notes];s.passableTiles=[...floors];s.lowerTileIds=[...new Set(s.lowerTiles)];
   const bad=structuredClone(s);bad.lowerTiles[at(0,s.outerCeilingBottom+1)]=materials.wood.mapped[0][0];bad.lowerTiles[at(s.exitTrigger.x,s.exitTrigger.y)]=s.wallTiles.at(-1);
   const negative=audit(bad);if(!negative.issues.some(i=>i.code==='CEILING_WALL_MISSING')||!negative.issues.some(i=>i.code==='APPROACH_BLOCKED'))throw Error('Negative example not detected');
   const image=render(s),comparison=document.createElement('canvas');comparison.width=image.width*2;comparison.height=image.height;comparison.getContext('2d').drawImage(image,0,0);comparison.getContext('2d').drawImage(render(bad),image.width,0);
   if(good.issues.length)failures.push({id:s.id,issues:good.issues});
   const markdown=`# ${s.name}\n\n현재 타일셋 ${tile.id}. 사용자 로컬 합성. 원본·치환 사전은 modern-source-map, 개별 객체는 part-* 용도를 먼저 읽는다.\n\n${s.notes}\n\n배치 순서: 방/동선→바닥 구분→외곽·내벽 천장→천장 남쪽 노출 끝 아래 ${wh}행 벽→가구 전체→밑동/벽 받침→접근·고립 바닥 검사→정본/공용 저장·재로드. 문턱은 열린 통로이며 문 개폐·도시 전이·영업 이벤트는 별도다.\n\n\`\`\`json\n${JSON.stringify(s,null,2)}\n\`\`\`\n\n![완성](image:scene)\n\n## 정상 / 오류\n왼쪽 정상, 오른쪽 남쪽 벽 한 칸 누락과 출구 봉쇄. 구조 검사는 미적 승인이나 LLM 생성 성공률이 아니다.\n\n\`\`\`json\n${JSON.stringify({bad,issues:negative.issues},null,2)}\n\`\`\`\n\n![비교](image:comparison)`;
   tile.referenceDocuments.push(makeCategory('assembled-'+s.id,s.name,markdown,[{id:'scene',name:s.id+'.png',caption:'현재 실제 타일 배열',dataUrl:image.toDataURL()},{id:'comparison',name:s.id+'-comparison.png',caption:'왼쪽 정상 / 오른쪽 벽 누락·출구 봉쇄',dataUrl:comparison.toDataURL()}]));
   scenes.push({scene:s,image:image.toDataURL(),comparison:comparison.toDataURL(),checks:{id:s.id,sourceCellRgbaPreserved:true,wallFaceCells:s.wallFaceCells.length,ceilingCells:ceiling.size,approachTargets:s.approachCells.length,isolatedRooms:s.isolationRooms,reachable:good.reachable,issues:good.issues,negativeIssues:negative.issues}});
  }
  validateTileset(tile.id,tile);
  return {tile,scenes,failures,cells,materials,recipes:mapped,sourceManifest,dataUrl:atlas.toDataURL(),height:atlas.height};
 },{sources,recipes,materials,plans});
}finally{await browser.close();}
for(const r of result.scenes)for(const kind of ['image','comparison'])await fs.writeFile(out+'/'+r.scene.id+'-'+kind+'.png',Buffer.from(r[kind].split(',')[1],'base64'));
await fs.writeFile(out+'/proof.json',JSON.stringify(result.scenes.map(r=>r.checks),null,2));
if(result.failures.length){console.log(JSON.stringify(result.failures,null,2));throw Error('Layout rejected; only private review images written, no patch');}
const tile=result.tile,asset={id:tile.image.id,name:'PAW-modern-interiors-local.png',kind:'chipset',dataUrl:result.dataUrl,meta:{tileSize:32,width:256,height:result.height,frameWidth:32,frameHeight:32,frames:tile.count}};
const patch={sourceProjectId:proof.projectId,maps:{},beforeMaps:{},tilesets:{[tile.id]:tile},beforeTilesets:{[tile.id]:project.tilesets[tile.id]??null},assets:{[asset.id]:asset},beforeAssets:{[asset.id]:project.assets.uploaded[asset.id]??null},checks:result.scenes.map(r=>r.checks)};
for(const {scene:s}of result.scenes){if(project.maps[s.id]?.events.length)throw Error('Existing map events require migration');patch.beforeMaps[s.id]=project.maps[s.id]??null;patch.maps[s.id]={id:s.id,name:s.name,width:s.width,height:s.height,tileSize:32,tilesetId:tile.id,lowerTiles:s.lowerTiles,upperTiles:s.upperTiles,events:[],encounterRate:0,climate:{mode:'indoor'}};}
await fs.writeFile('tiledata/pixel-art-world/modern-interiors-compiled.json',JSON.stringify({maps:Object.fromEntries(result.scenes.map(r=>[r.scene.id,r.scene])),cells:result.cells,materials:result.materials,recipes:result.recipes,sources:result.sourceManifest},null,2)+'\n');
await fs.writeFile(out+'/patch.json',JSON.stringify(patch));console.log(patch.checks.map(({negativeIssues,...r})=>r));
