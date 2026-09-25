// Compile two shops from current project-owned recipes and user-local PNGs.
// Preparation only; save through the canonical host and publish to local shared SQLite afterwards.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const [input,sourceDir,out,origin='http://127.0.0.1:9816']=process.argv.slice(2);
if(!input||!sourceDir||!out)throw Error('Usage: <canonical portable> <user PNG directory> <private output> [dev URL]');
const read=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const project=await read(input),proof=await read(path.join(path.dirname(input),'source-proof.json'));
if(hash(await fs.readFile(input))!==proof.portableSha256)throw Error('Canonical receipt differs');
const plans=(await read('tiledata/pixel-art-world/retail-interiors-layout.json')).maps;
const packs=(await Promise.all(['Catalog','HospitalityComplementsCatalog'].map(n=>read(`src/assets/pixelArtWorld${n}.json`)))).flat();
const auto=(await read('src/assets/pixelArtWorldAutotiles.json')).find(a=>a.id==='paw-wall-a01');
const autoBytes=await fs.readFile(path.join(sourceDir,auto.filename));if(hash(autoBytes)!==auto.sha256)throw Error('Ceiling source differs');
const inputs=[];
for(const plan of plans){
 const tile=project.tilesets[plan.tilesetId],pack=packs.find(p=>p.id===plan.tilesetId);
 if(!tile||!pack||tile.referenceSourceTilesetId)throw Error('Current native tileset/reference owner required');
 if(hash(await fs.readFile(path.join(sourceDir,pack.filename)))!==pack.sha256)throw Error('Source edition differs');
 inputs.push({plan,pack,baseTile:tile,baseAsset:project.assets.uploaded[tile.image.id]});
}
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();let results;
try{
 const page=await browser.newPage();await page.route('**/__paw-retail',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto(origin+'/__paw-retail');
 results=await page.evaluate(async({inputs,auto,base64})=>{
  const {canMove}=await import('/src/project/collision.ts');
  const {shapeAutotileGroupAround}=await import('/src/project/defaults/autotileEngine.ts');
  const {applyCeilingWallFaces,inspectCeilingWallFaces}=await import('/scripts/content/pixel-art-world-ceiling-walls.mjs');
  const decode=async src=>{const im=new Image();im.src=src;await im.decode();return im;};
  const results=[];
  for(const {plan,pack,baseTile,baseAsset}of inputs){
   const original=await decode(baseAsset.dataUrl);let tile=structuredClone(baseTile),dataUrl=baseAsset.dataUrl;
   if(!tile.autotileGroups?.some(g=>g.id===auto.id)){
    const {preparePixelArtWorldAutotile}=await import('/src/editor/pixelArtWorldAutotileImport.ts');
    const result=await preparePixelArtWorldAutotile(new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],auto.filename,{type:'image/png'}),auto,tile,original,{referenceBackingTile:pack.floorTile,referenceBackingLabel:pack.name+' 바닥'});
    tile=result.tileset;dataUrl=result.dataUrl;tile.image=structuredClone(baseTile.image);
   }
   const atlas=await decode(dataUrl),group=tile.autotileGroups.find(g=>g.id===auto.id);
   const pixels=im=>{const c=document.createElement('canvas');c.width=original.width;c.height=original.height;c.getContext('2d').drawImage(im,0,0);return c.getContext('2d').getImageData(0,0,c.width,c.height).data;};
   const before=pixels(original),after=pixels(atlas);if(before.some((v,i)=>v!==after[i]))throw Error('Existing pixels changed');
   const s=structuredClone(plan);s.lowerTiles=Array(s.width*s.height).fill(pack.floorTile);s.upperTiles=Array(s.width*s.height).fill(-1);s.passableTiles=[pack.floorTile];s.ceilingGroupId=group.id;
   const at=(x,y)=>{if(x<0||y<0||x>=s.width||y>=s.height)throw Error('Out of bounds');return y*s.width+x;};
   const points=[];
   for(let y=0;y<=s.outerCeilingBottom;y++)for(let x=0;x<s.width;x++)if(x===0||x===s.width-1||y===0||y===s.outerCeilingBottom){if(y===s.entrance.roofY&&x>=s.entrance.x&&x<s.entrance.x+s.entrance.width)continue;s.lowerTiles[at(x,y)]=group.memberTileIds[0];points.push({x,y});}
   shapeAutotileGroupAround(s,group,points);s.ceilingCells=points;
   applyCeilingWallFaces(s,group.memberTileIds,s.wallTiles);
   for(const p of s.placements){
    const recipe=pack.recipes.find(r=>r.id===p.recipeId);if(!recipe)throw Error('Unknown recipe '+p.recipeId);
    recipe.tiles.forEach((row,y)=>row.forEach((t,x)=>{const i=at(p.x+x,p.y+y);if(s.upperTiles[i]!==-1)throw Error('Overlapping objects');if(group.memberTileIds.includes(s.lowerTiles[i]))throw Error('Furniture on ceiling');s.upperTiles[i]=t;
     if(recipe.placementKind==='wall-mounted'&&!s.wallTiles.includes(s.lowerTiles[i]))throw Error('Wall mounting lacks wall');
    }));
    if(recipe.placementKind==='standing')for(const c of recipe.supportCells)if(s.lowerTiles[at(p.x+c.x,p.y+c.y)]!==pack.floorTile)throw Error('Foot on wall: '+recipe.id);
   }
   const audit=scene=>{
    const issues=inspectCeilingWallFaces(scene,group.memberTileIds,s.wallTiles);
    const queue=[s.spawn],seen=new Set([at(s.spawn.x,s.spawn.y)]);
    for(let n=0;n<queue.length;n++)for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]]){
     const a=queue[n],x=a.x+dx,y=a.y+dy,i=y*s.width+x;
     if(!seen.has(i)&&canMove({tilesets:{[tile.id]:tile}},{...scene,tilesetId:tile.id},a.x,a.y,x,y)){seen.add(i);queue.push({x,y});}
    }
    for(const c of s.approachCells)if(!seen.has(at(c.x,c.y)))issues.push({code:'APPROACH_BLOCKED',...c});
    scene.lowerTiles.forEach((t,i)=>{if(t===pack.floorTile&&scene.upperTiles[i]===-1&&!seen.has(i))issues.push({code:'ISOLATED_FLOOR',x:i%s.width,y:Math.floor(i/s.width)});});
    return {issues,reachable:seen.size};
   };
   const good=audit(s);if(good.issues.length)throw Error(s.id+JSON.stringify(good));
   const bad=structuredClone(s);bad.lowerTiles[at(0,s.outerCeilingBottom+1)]=pack.floorTile;bad.upperTiles[at(s.exitTrigger.x,s.exitTrigger.y)]=pack.recipes.find(r=>r.placementKind==='standing').tiles.at(-1)[0];
   const negative=audit(bad);if(!negative.issues.some(i=>i.code==='CEILING_WALL_MISSING')||!negative.issues.some(i=>i.code==='APPROACH_BLOCKED'))throw Error('Negative example not detected');
   s.lowerTileIds=[...new Set(s.lowerTiles)];
   const render=scene=>{const c=document.createElement('canvas');c.width=scene.width*32;c.height=scene.height*32;const ctx=c.getContext('2d');for(const layer of[scene.lowerTiles,scene.upperTiles])layer.forEach((t,i)=>{if(t>=0)ctx.drawImage(atlas,t%8*32,Math.floor(t/8)*32,32,32,i%scene.width*32,Math.floor(i/scene.width)*32,32,32);});return c;};
   const image=render(s),comparison=document.createElement('canvas');comparison.width=image.width*2;comparison.height=image.height;comparison.getContext('2d').drawImage(image,0,0);comparison.getContext('2d').drawImage(render(bad),image.width,0);
   const markdown=`# ${s.name}\n\n원본 ${pack.filename}, SHA256 ${pack.sha256}. tilesetId ${tile.id}, 32px·8열. 사용자 로컬에서만 조립한다.\n\n${s.notes}\n\n순서: 같은 원본·판본과 개별 가구 문서 확인 → 사용자 천장 원본을 현재 아틀라스에 추가(이미 있으면 재사용) → 외곽과 문 틈 → 모든 천장 끝 아래 두 행 벽면 → 전체 가구와 밑동 → 접근 검사 → 저장·재로드. 현재 천장 번호 ${Math.min(...group.memberTileIds)}..${Math.max(...group.memberTileIds)}, 타일 수 ${tile.count}. 다른 시트의 천장 번호를 복사하지 않는다.\n\n전체 청사진·하위/상위 배열:\n\n\`\`\`json\n${JSON.stringify(s,null,2)}\n\`\`\`\n\n![완성](image:scene)\n\n## 정상/오류\n왼쪽 정상. 오른쪽은 남쪽 천장 아래 벽 한 칸을 바닥으로 바꾸고 출구에 가구를 놓은 오류다. 아래 검사는 벽/통행 구조 확인이며 판매·착석 이벤트나 새 AI 모델의 생성 성공률을 뜻하지 않는다.\n\n\`\`\`json\n${JSON.stringify({bad,issues:negative.issues},null,2)}\n\`\`\`\n\n![비교](image:comparison)`;
   const category={id:'assembled-'+s.id,name:s.name,description:'천장 아래 벽 필수·가구 전체·직원/손님 동선·정상/오류',documents:[{id:'layout',name:s.id+'.md',markdown}],images:[{id:'scene',name:s.id+'.png',caption:'현재 사용자 타일로 조립',dataUrl:image.toDataURL()},{id:'comparison',name:s.id+'-comparison.png',caption:'왼쪽 정상 / 오른쪽 벽 누락·출입 봉쇄',dataUrl:comparison.toDataURL()}]};
   tile.referenceDocuments=tile.referenceDocuments.filter(c=>c.id!==category.id).concat(category);
   results.push({scene:s,tile,dataUrl,image:image.toDataURL(),comparison:comparison.toDataURL(),assetWidth:atlas.width,assetHeight:atlas.height,checks:{id:s.id,existingPixelsUnchanged:true,ceilingCells:points.length,wallFaceCells:s.wallFaceCells.length,allCeilingEndsHaveWalls:true,approachTargets:s.approachCells.length,reachable:good.reachable,negativeIssues:negative.issues}});
  }
  return results;
 },{inputs,auto,base64:autoBytes.toString('base64')});
}finally{await browser.close();}
const patch={sourceProjectId:proof.projectId,maps:{},beforeMaps:{},tilesets:{},beforeTilesets:{},assets:{},beforeAssets:{},checks:results.map(r=>r.checks)};
const compiled={maps:{}};
for(const r of results){
 const s=r.scene,base=project.tilesets[s.tilesetId],baseAsset=project.assets.uploaded[base.image.id],old=project.maps[s.id];
 if(old?.events.length)throw Error('Existing map events need explicit migration');
 patch.maps[s.id]={id:s.id,name:s.name,width:s.width,height:s.height,tileSize:32,tilesetId:base.id,lowerTiles:s.lowerTiles,upperTiles:s.upperTiles,events:[],encounterRate:0,climate:{mode:'indoor'}};
 patch.beforeMaps[s.id]=old??null;patch.tilesets[base.id]=r.tile;patch.beforeTilesets[base.id]=base;
 if(r.dataUrl!==baseAsset.dataUrl){const asset={...baseAsset,dataUrl:r.dataUrl,meta:{...baseAsset.meta,width:r.assetWidth,height:r.assetHeight,frames:r.tile.count}};delete asset.ref;patch.assets[asset.id]=asset;patch.beforeAssets[asset.id]=baseAsset;}
 compiled.maps[s.id]=s;
 for(const kind of['image','comparison'])await fs.writeFile(out+'/'+s.id+'-'+kind+'.png',Buffer.from(r[kind].split(',')[1],'base64'));
}
await fs.writeFile('tiledata/pixel-art-world/retail-interiors-compiled.json',JSON.stringify(compiled,null,2)+'\n');
await fs.writeFile(out+'/patch.json',JSON.stringify(patch));await fs.writeFile(out+'/proof.json',JSON.stringify(patch.checks,null,2));console.log(patch.checks);
