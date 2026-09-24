// Complete the locally owned restaurant with the user's existing XP ceiling PNG.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const [input,sourceDir,out,origin='http://127.0.0.1:9816']=process.argv.slice(2);
if(!input||!sourceDir||!out)throw Error('Usage: <canonical portable.json> <user PNG directory> <private output> [dev URL]');
const read=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const p=await read(input),proof=await read(path.join(path.dirname(input),'source-proof.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');
if(hash(await fs.readFile(input))!==proof.portableSha256)throw Error('Canonical receipt differs');
const layout=(await read('src/assets/pixelArtWorldJapaneseInteriorsLayout.json')).find(l=>l.packId==='paw-izakaya');
const plan=await read('tiledata/pixel-art-world/izakaya-kitchen-layout.json');
const baseScene=p.maps['paw-izakaya-dense'],baseTile=p.tilesets['paw-izakaya'],baseAsset=p.assets.uploaded[baseTile.image.id];
const auto=(await read('src/assets/pixelArtWorldAutotiles.json')).find(a=>a.id==='paw-wall-a01');
const bytes=await fs.readFile(path.join(sourceDir,auto.filename));
if(hash(bytes)!==auto.sha256)throw Error('Ceiling source hash differs');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();let result;
try{
 const page=await browser.newPage();await page.route('**/__paw-ceiling',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto(origin+'/__paw-ceiling');
 result=await page.evaluate(async({baseScene,baseTile,baseAsset,auto,base64,recipes,plan,passableTiles})=>{
  const {preparePixelArtWorldAutotile}=baseTile.autotileGroups?.some(g=>g.id===auto.id)?{}:await import('/src/editor/pixelArtWorldAutotileImport.ts');
  const {canMove}=await import('/src/project/collision.ts');
  const {applyCeilingWallFaces,inspectCeilingWallFaces}=await import('/scripts/content/pixel-art-world-ceiling-walls.mjs');
  const {normalizeXpAutotileMask}=await import('/src/project/pixelArtWorldAutotiles.ts');
  const {validateTileset}=await import('/src/project/io/shapeResourceFields.ts');
  const decode=async src=>{const im=new Image();im.src=src;await im.decode();return im;};
  const base=await decode(baseAsset.dataUrl);
  let prepared;
  if(baseTile.autotileGroups?.some(g=>g.id===auto.id))prepared={tileset:structuredClone(baseTile),dataUrl:baseAsset.dataUrl,width:256,height:base.height,offset:480};
  else prepared=await preparePixelArtWorldAutotile(new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],auto.filename,{type:'image/png'}),auto,baseTile,base,{referenceBackingTile:4,referenceBackingLabel:'이자카야 돌바닥'});
  const tile=prepared.tileset,group=tile.autotileGroups.find(g=>g.id===auto.id);
  if(prepared.offset!==480||tile.count!==528||group.memberTileIds.length!==47||Math.min(...group.memberTileIds)!==480)throw Error('Ceiling atlas contract differs');
  tile.image=structuredClone(baseTile.image);
  for(const id of plan.hallFloorTiles){tile.passability[id]={up:true,down:true,left:true,right:true};tile.priority[id]='lower';tile.tileMeta[id]={label:'이자카야 목재 마루',description:'원본 첫 행 x0/1. 두 칸을 가로로 반복하는 홀·문턱 바닥. 다다미는 개인실 안쪽만.',defaultLayer:'lower',passage:'passable',repeatability:'repeat',source:'imported'};}
  validateTileset(tile.id,tile);
  const atlas=await decode(prepared.dataUrl);
  function rgba(im){const c=document.createElement('canvas');c.width=256;c.height=1920;const x=c.getContext('2d');x.drawImage(im,0,0);return x.getImageData(0,0,256,1920).data;}
  const a=rgba(base),b=rgba(atlas);if(a.some((v,i)=>v!==b[i]))throw Error('Original 480-tile pixel prefix changed');
  const s=structuredClone(plan);s.lowerTiles=Array.from({length:s.width*s.height},(_,i)=>s.hallFloorTiles[i%s.width%s.hallFloorTiles.length]);s.upperTiles=Array(s.width*s.height).fill(-1);s.passableTiles=[...new Set([...passableTiles,...s.hallFloorTiles])];
  const at=(x,y)=>{if(x<0||y<0||x>=s.width||y>=s.height)throw Error('Out of bounds');return y*s.width+x;};
  for(let x=1;x<s.width-1;x++){s.lowerTiles[at(x,1)]=17;s.lowerTiles[at(x,2)]=25;}
  const k=s.kitchenFloor;for(let y=k.y;y<k.y+k.height;y++)for(let x=k.x;x<k.x+k.width;x++)s.lowerTiles[at(x,y)]=6;
  const t=s.tatamiFloor;for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++)s.lowerTiles[at(t.x+x,t.y+y)]=t.tiles[y%t.tiles.length][x%t.tiles[0].length];
  for(const w of s.wallFaces)for(let dy=0;dy<w.tiles.length;dy++)for(let x=w.x;x<w.x+w.width;x++)s.lowerTiles[at(x,w.y+dy)]=w.tiles[dy];
  for(const p of s.placements){const r=recipes.find(r=>r.id===p.recipeId);if(!r)throw Error('Unknown recipe');
   r.tiles.forEach((row,y)=>row.forEach((t,x)=>{const i=at(p.x+x,p.y+y);if(s.upperTiles[i]!==-1)throw Error('Furniture overlap');s.upperTiles[i]=t;}));
  }
  s.ceilingGroupId=auto.id;const wallSet=new Set();
  for(let y=0;y<=s.outerCeilingBottom;y++)for(let x=0;x<s.width;x++)if(x===0||x===s.width-1||y===0||y===s.outerCeilingBottom)wallSet.add(at(x,y));
  for(let y=s.entrance.roofY;y<s.height;y++)for(let x=s.entrance.x;x<s.entrance.x+s.entrance.width;x++)wallSet.delete(at(x,y));
  for(const w of s.partitionColumns)for(let y=w.y;y<w.y+w.height;y++)wallSet.add(at(w.x,y));
  for(const w of s.partitionRows)for(let x=w.x;x<w.x+w.width;x++)wallSet.add(at(x,w.y));
  for(const c of [s.exitTrigger,...s.kitchenDoorCells,...s.privateRoomDoorCells]){wallSet.delete(at(c.x,c.y));s.lowerTiles[at(c.x,c.y)]=s.hallFloorTiles[c.x%s.hallFloorTiles.length];}
  s.ceilingCells=[...wallSet].sort((a,b)=>a-b).map(i=>({x:i%s.width,y:Math.floor(i/s.width)}));
  const cells=new Set(s.ceilingCells.map(c=>c.y*s.width+c.x));
  const dirs=[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]];
  const maskAt=(x,y)=>normalizeXpAutotileMask(dirs.reduce((m,[dx,dy,bit])=>{const xx=x+dx,yy=y+dy;return xx>=0&&yy>=0&&xx<s.width&&yy<s.height&&cells.has(yy*s.width+xx)?m|bit:m;},0));
  for(const c of s.ceilingCells){const i=c.y*s.width+c.x;if(s.upperTiles[i]!==-1)throw Error('Ceiling overlaps furniture');s.lowerTiles[i]=group.variantMap[maskAt(c.x,c.y)];}
  applyCeilingWallFaces(s,group.memberTileIds,s.wallTiles);
  s.lowerTileIds=[...new Set(s.lowerTiles)];
  s.designNotes=[s.notes];
  const targets=[...new Map([...s.approachCells,s.exitTrigger].map(c=>[c.x+','+c.y,c])).values()];
  for(const placement of s.placements){const r=recipes.find(r=>r.id===placement.recipeId);for(const c of r.supportCells)if(!s.passableTiles.includes(s.lowerTiles[(placement.y+c.y)*s.width+placement.x+c.x]))throw Error('Furniture foot on wall: '+r.id);}
  const audit=scene=>{
   const issues=inspectCeilingWallFaces(scene,group.memberTileIds,s.wallTiles);
   for(const c of s.ceilingCells)if(scene.lowerTiles[c.y*s.width+c.x]!==group.variantMap[maskAt(c.x,c.y)]||scene.upperTiles[c.y*s.width+c.x]!==-1)issues.push({code:'CEILING_CONNECTION',...c});
   const q=[s.spawn],seen=new Set([s.spawn.y*s.width+s.spawn.x]);
   for(let n=0;n<q.length;n++)for(const[dx,dy]of dirs.slice(0,4)){const c=q[n],x=c.x+dx,y=c.y+dy,i=y*s.width+x;if(!seen.has(i)&&canMove({tilesets:{[tile.id]:tile}},{...scene,tilesetId:tile.id},c.x,c.y,x,y)){seen.add(i);q.push({x,y});}}
   for(const c of targets)if(!seen.has(c.y*s.width+c.x))issues.push({code:'APPROACH_BLOCKED',...c});
   return {issues,reachable:seen.size,reachableCells:[...seen]};
  };
  const good=audit(s);if(good.issues.length)throw Error(JSON.stringify(good));
  const closed=structuredClone(s);for(const c of s.kitchenDoorCells)closed.lowerTiles[at(c.x,c.y)]=s.wallTiles[1];
  const closedResult=audit(closed);const kitchenTargets=s.approachCells.filter(c=>c.x>=7&&c.y<=5);
  if(kitchenTargets.some(c=>closedResult.reachableCells.includes(at(c.x,c.y))))throw Error('Kitchen partition leaks');
  if(s.approachCells.filter(c=>c.y>=9).some(c=>!closedResult.reachableCells.includes(at(c.x,c.y))))throw Error('Kitchen closure blocks dining');
  const privateClosed=structuredClone(s);for(const c of s.privateRoomDoorCells)privateClosed.lowerTiles[at(c.x,c.y)]=s.wallTiles[1];
  const privateResult=audit(privateClosed),inside=c=>c.x>=t.x&&c.x<t.x+t.width&&c.y>=t.y&&c.y<t.y+t.height;
  if(s.approachCells.filter(inside).some(c=>privateResult.reachableCells.includes(at(c.x,c.y))))throw Error('Private room boundary leaks');
  if(s.approachCells.filter(c=>!inside(c)&&!s.privateRoomDoorCells.some(d=>d.x===c.x&&d.y===c.y)).some(c=>!privateResult.reachableCells.includes(at(c.x,c.y))))throw Error('Private closure blocks hall or kitchen');
  const leaking=structuredClone(privateClosed);leaking.lowerTiles[at(6,20)]=s.hallFloorTiles[0];
  const leakingResult=audit(leaking);
  if(!s.approachCells.filter(inside).some(c=>leakingResult.reachableCells.includes(at(c.x,c.y))))throw Error('Private boundary negative example was not detected');
  for(let i=0;i<s.lowerTiles.length;i++)if(t.tiles.flat().includes(s.lowerTiles[i])!==inside({x:i%s.width,y:Math.floor(i/s.width)}))throw Error('Tatami escapes private room or has missing floor');
  const {shapeAutotileGroupAround}=await import('/src/project/defaults/autotileEngine.ts');
  const shaped=structuredClone(s);shapeAutotileGroupAround(shaped,group,s.ceilingCells);
  if(JSON.stringify(shaped.lowerTiles)!==JSON.stringify(s.lowerTiles))throw Error('Engine autotile shape differs');
  const bad=structuredClone(closed);bad.lowerTiles[0]=4;bad.lowerTiles[at(s.exitTrigger.x,s.exitTrigger.y)]=s.wallTiles[1];bad.lowerTiles[at(6,2)]=4;const badResult=audit(bad);
  if(!badResult.issues.some(i=>i.code==='CEILING_WALL_MISSING')||!badResult.issues.some(i=>i.code==='CEILING_CONNECTION')||!badResult.issues.some(i=>i.code==='APPROACH_BLOCKED'))throw Error('Negative example was not detected');
  function render(scene){const c=document.createElement('canvas');c.width=scene.width*32;c.height=scene.height*32;const ctx=c.getContext('2d');for(const layer of [scene.lowerTiles,scene.upperTiles])layer.forEach((t,i)=>{if(t>=0)ctx.drawImage(atlas,t%8*32,Math.floor(t/8)*32,32,32,i%scene.width*32,Math.floor(i/scene.width)*32,32,32);});return c;}
  const image=render(s),before=render(baseScene),comparison=document.createElement('canvas');comparison.width=image.width*2;comparison.height=image.height;comparison.getContext('2d').drawImage(image,0,0);comparison.getContext('2d').drawImage(render(bad),image.width,0);
  const markdown=`# ${s.name} · 연결 천장 포함\n\n현재 tilesetId: ${tile.id}. 천장 원본 ${auto.filename}, SHA256 ${auto.sha256}.\n\n${s.notes}\n\n순서: 원본 이자카야+부스 합성480칸 → 사용자 천장 PNG를 같은 타일셋에 추가 → 분리 조리실·다다미 개인실·외곽·각 출입구 설계 → 천장 자동 연결과 정면 벽 → 전체 가구 → 객석 접근과 조리실/개인실 독립 분리 검사. 이 타일셋에서 천장 변형 번호는480..526이며 주택의400번을 복사하면 부스 조각이 된다. 상세 쿼터·256개 마스크 사전과 원본·47변형 그림은 paw-wall-a01 용도를 함께 읽는다.\n\n\`\`\`json\n${JSON.stringify(s,null,2)}\n\`\`\`\n\n![완성](image:assembled-scene)\n\n## 정상 / 오류\n\n왼쪽 정상, 오른쪽 북서 천장 누락(0,0) 및 출입 봉쇄(${s.exitTrigger.x},${s.exitTrigger.y}) 및 조리실 문 두 칸 봉쇄, 내벽 끝 아래 벽 누락(6,2). 구조 검사와 실제 통행이 검출하며 미적 승인·모델 성공률을 뜻하지 않는다.\n\n\`\`\`json\n${JSON.stringify({bad,issues:badResult.issues},null,2)}\n\`\`\`\n\n![정상과 오류](image:ceiling-comparison)`;
  const category={id:'scene-'+s.id,name:s.name+' · 천장 연결',description:'천장47변형·외곽·문 좌우 끝·좌석과 접근 동선. 완성 배열 및 정상/오류.',documents:[{id:'layout',name:'연결 천장과 전체 배열.md',markdown}],images:[{id:'assembled-scene',name:s.id+'.png',caption:'천장 외곽과 문 끝이 연결된 실제 배치',dataUrl:image.toDataURL()},{id:'ceiling-comparison',name:'ceiling-comparison.png',caption:'왼쪽 정상 / 오른쪽 천장 누락과 출입 봉쇄',dataUrl:comparison.toDataURL()}]};
  tile.referenceDocuments=tile.referenceDocuments.filter(c=>!['scene-'+s.id,'assembled-paw-izakaya-dense'].includes(c.id)).concat(category);
  return {scene:s,tile,dataUrl:prepared.dataUrl,image:image.toDataURL(),before:before.toDataURL(),comparison:comparison.toDataURL(),width:prepared.width,height:prepared.height,checks:{wallFaceCells:s.wallFaceCells.length,allCeilingEndsHaveWalls:true,privateRoomBoundaryBreachDetected:true,privateRoomSealedWhenDoorClosed:true,hallAndKitchenAccessibleWhenPrivateRoomClosed:true,tatamiConfinedToPrivateRoom:true,kitchenSealedWhenDoorClosed:true,diningAccessibleWhenKitchenClosed:true,engineAutoshapeStable:true,ceilingCells:cells.size,variants:group.memberTileIds.length,prefix480Unchanged:true,reachable:good.reachable,approachTargets:targets.length,negativeIssues:badResult.issues}};
 },{baseScene,baseTile,baseAsset,auto,base64:bytes.toString('base64'),recipes:layout.recipes,plan,passableTiles:layout.scenes[0].passableTiles});
}finally{await browser.close();}
const mapId='paw-izakaya-dense',old=p.maps[mapId];
if(old.events.length)throw Error('Existing events require explicit coordinate migration');
const map={...old,name:result.scene.name,width:result.scene.width,height:result.scene.height,lowerTiles:result.scene.lowerTiles,upperTiles:result.scene.upperTiles};
const asset={...baseAsset,dataUrl:result.dataUrl,meta:{...baseAsset.meta,width:result.width,height:result.height,frames:result.tile.count}};delete asset.ref;
await fs.writeFile(out+'/patch.json',JSON.stringify({sourceProjectId:proof.projectId,maps:{[mapId]:map},beforeMaps:{[mapId]:old},tilesets:{[baseTile.id]:result.tile},beforeTilesets:{[baseTile.id]:baseTile},assets:result.dataUrl===baseAsset.dataUrl?{}:{[baseAsset.id]:asset},beforeAssets:result.dataUrl===baseAsset.dataUrl?{}:{[baseAsset.id]:baseAsset},checks:result.checks}));
await fs.writeFile('tiledata/pixel-art-world/izakaya-ceiling-compiled.json',JSON.stringify({packId:baseTile.id,sourceFilename:auto.filename,sourceSha256:auto.sha256,tilesetCount:result.tile.count,ceilingGroupId:auto.id,scene:result.scene},null,2)+'\n');
const dense=await read('tiledata/pixel-art-world/dense-interiors-compiled.json');dense.maps[mapId]={...result.scene,id:mapId};await fs.writeFile('tiledata/pixel-art-world/dense-interiors-compiled.json',JSON.stringify(dense,null,2)+'\n');
for(const name of ['image','before','comparison'])await fs.writeFile(out+'/'+name+'.png',Buffer.from(result[name].split(',')[1],'base64'));
await fs.writeFile(out+'/proof.json',JSON.stringify(result.checks,null,2));console.log(result.checks);
