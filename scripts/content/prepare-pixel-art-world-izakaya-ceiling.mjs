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
const baseScene=layout.scenes[0],baseTile=p.tilesets['paw-izakaya'],baseAsset=p.assets.uploaded[baseTile.image.id];
const auto=(await read('src/assets/pixelArtWorldAutotiles.json')).find(a=>a.id==='paw-wall-a01');
const bytes=await fs.readFile(path.join(sourceDir,auto.filename));
if(hash(bytes)!==auto.sha256)throw Error('Ceiling source hash differs');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();let result;
try{
 const page=await browser.newPage();await page.route('**/__paw-ceiling',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto(origin+'/__paw-ceiling');
 result=await page.evaluate(async({baseScene,baseTile,baseAsset,auto,base64,recipes})=>{
  const {preparePixelArtWorldAutotile}=await import('/src/editor/pixelArtWorldAutotileImport.ts');
  const {canMove}=await import('/src/project/collision.ts');
  const {normalizeXpAutotileMask}=await import('/src/project/pixelArtWorldAutotiles.ts');
  const {validateTileset}=await import('/src/project/io/shapeResourceFields.ts');
  const decode=async src=>{const im=new Image();im.src=src;await im.decode();return im;};
  const base=await decode(baseAsset.dataUrl);
  let prepared;
  if(baseTile.autotileGroups?.some(g=>g.id===auto.id))prepared={tileset:structuredClone(baseTile),dataUrl:baseAsset.dataUrl,width:256,height:base.height,offset:480};
  else prepared=await preparePixelArtWorldAutotile(new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],auto.filename,{type:'image/png'}),auto,baseTile,base,{referenceBackingTile:4,referenceBackingLabel:'이자카야 돌바닥'});
  const tile=prepared.tileset,group=tile.autotileGroups.find(g=>g.id===auto.id);
  if(prepared.offset!==480||tile.count!==528||group.memberTileIds.length!==47||Math.min(...group.memberTileIds)!==480)throw Error('Ceiling atlas contract differs');
  tile.image=structuredClone(baseTile.image);validateTileset(tile.id,tile);
  const atlas=await decode(prepared.dataUrl);
  function rgba(im){const c=document.createElement('canvas');c.width=256;c.height=1920;const x=c.getContext('2d');x.drawImage(im,0,0);return x.getImageData(0,0,256,1920).data;}
  const a=rgba(base),b=rgba(atlas);if(a.some((v,i)=>v!==b[i]))throw Error('Original 480-tile pixel prefix changed');
  const s=structuredClone(baseScene);s.height++;s.lowerTiles=Array(s.width).fill(4).concat(baseScene.lowerTiles);s.upperTiles=Array(s.width).fill(-1).concat(baseScene.upperTiles);
  for(const key of ['placements','approachCells','rooms','doorways'])s[key]=s[key].map(v=>({...v,y:v.y+1}));
  s.spawn={x:4,y:14,direction:'up'};s.exitTrigger={x:4,y:15};s.ceilingGroupId=auto.id;s.ceilingCells=[];
  for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)if((x===0||x===s.width-1||y===0||y===s.height-1)&&!(x===4&&y===15))s.ceilingCells.push({x,y});
  const cells=new Set(s.ceilingCells.map(c=>c.y*s.width+c.x));
  const dirs=[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]];
  const maskAt=(x,y)=>normalizeXpAutotileMask(dirs.reduce((m,[dx,dy,bit])=>{const xx=x+dx,yy=y+dy;return xx>=0&&yy>=0&&xx<s.width&&yy<s.height&&cells.has(yy*s.width+xx)?m|bit:m;},0));
  for(const c of s.ceilingCells){const i=c.y*s.width+c.x;if(s.upperTiles[i]!==-1)throw Error('Ceiling overlaps furniture');s.lowerTiles[i]=group.variantMap[maskAt(c.x,c.y)];}
  s.lowerTileIds=[...new Set(s.lowerTiles)];
  s.notes='10×16. 천장 한 행만 북쪽에 추가했다. 내부 바닥·가구·한 칸 통로는 종전10×15에서 y+1로 그대로 옮겼다. 부스2(1,3 및1,9), 방석6(5,10), 북향 바 의자3(5..7,8). 주통로x4, 직원행y5, 의자 뒤y9, 좌식 남쪽y14. 남쪽 출입(4,15). SA-WallA01의47변형을 기존480칸 뒤480..526에 등록했다. 모든 외곽 천장과 문 좌우 끝은 lower/solid 및 같은8방 연결 그룹이다. 527은 행 정렬 공백이며 배치 금지. 흰벽17/목재벽25는 북천장 아래 두 행에 보존한다. 벽 위에 가구 밑동을 두거나 출입 틈을 천장으로 막지 않는다. 부스 완전체는 자르지 않는다. 주문·착석·도시 전이는 별도다.';
  s.designNotes=[s.notes];
  const targets=[...new Map([...s.approachCells,s.exitTrigger].map(c=>[c.x+','+c.y,c])).values()];
  for(const placement of s.placements){const r=recipes.find(r=>r.id===placement.recipeId);for(const c of r.supportCells)if(!s.passableTiles.includes(s.lowerTiles[(placement.y+c.y)*s.width+placement.x+c.x]))throw Error('Furniture foot on wall: '+r.id);}
  const audit=scene=>{
   const issues=[];
   for(const c of s.ceilingCells)if(scene.lowerTiles[c.y*s.width+c.x]!==group.variantMap[maskAt(c.x,c.y)]||scene.upperTiles[c.y*s.width+c.x]!==-1)issues.push({code:'CEILING_CONNECTION',...c});
   const q=[s.spawn],seen=new Set([s.spawn.y*s.width+s.spawn.x]);
   for(let n=0;n<q.length;n++)for(const[dx,dy]of dirs.slice(0,4)){const c=q[n],x=c.x+dx,y=c.y+dy,i=y*s.width+x;if(!seen.has(i)&&canMove({tilesets:{[tile.id]:tile}},{...scene,tilesetId:tile.id},c.x,c.y,x,y)){seen.add(i);q.push({x,y});}}
   for(const c of targets)if(!seen.has(c.y*s.width+c.x))issues.push({code:'APPROACH_BLOCKED',...c});
   return {issues,reachable:seen.size};
  };
  const good=audit(s);if(good.issues.length)throw Error(JSON.stringify(good));
  const bad=structuredClone(s);bad.lowerTiles[0]=4;bad.lowerTiles[15*s.width+4]=group.variantMap[0];const badResult=audit(bad);
  if(!badResult.issues.some(i=>i.code==='CEILING_CONNECTION')||!badResult.issues.some(i=>i.code==='APPROACH_BLOCKED'))throw Error('Negative example was not detected');
  function render(scene){const c=document.createElement('canvas');c.width=scene.width*32;c.height=scene.height*32;const ctx=c.getContext('2d');for(const layer of [scene.lowerTiles,scene.upperTiles])layer.forEach((t,i)=>{if(t>=0)ctx.drawImage(atlas,t%8*32,Math.floor(t/8)*32,32,32,i%scene.width*32,Math.floor(i/scene.width)*32,32,32);});return c;}
  const image=render(s),before=render(baseScene),comparison=document.createElement('canvas');comparison.width=image.width*2;comparison.height=image.height;comparison.getContext('2d').drawImage(image,0,0);comparison.getContext('2d').drawImage(render(bad),image.width,0);
  const markdown=`# ${s.name} · 연결 천장 포함\n\n현재 tilesetId: ${tile.id}. 천장 원본 ${auto.filename}, SHA256 ${auto.sha256}.\n\n${s.notes}\n\n순서: 원본 이자카야+부스 합성480칸 → 사용자 천장 PNG를 같은 타일셋에 추가 → 북쪽 한 행과 외곽 연결 → 전체 가구 → 접근 검사. 이 타일셋에서 천장 변형 번호는480..526이며 주택의400번을 복사하면 부스 조각이 된다. 상세 쿼터·256개 마스크 사전과 원본·47변형 그림은 paw-wall-a01 용도를 함께 읽는다.\n\n\`\`\`json\n${JSON.stringify(s,null,2)}\n\`\`\`\n\n![완성](image:assembled-scene)\n\n## 정상 / 오류\n\n왼쪽 정상, 오른쪽 북서 천장 누락(0,0) 및 출입 봉쇄(4,15). 구조 검사와 실제 통행이 검출하며 미적 승인·모델 성공률을 뜻하지 않는다.\n\n\`\`\`json\n${JSON.stringify({bad,issues:badResult.issues},null,2)}\n\`\`\`\n\n![정상과 오류](image:ceiling-comparison)`;
  const category={id:'scene-'+s.id,name:s.name+' · 천장 연결',description:'천장47변형·외곽·문 좌우 끝·좌석과 접근 동선. 완성 배열 및 정상/오류.',documents:[{id:'layout',name:'연결 천장과 전체 배열.md',markdown}],images:[{id:'assembled-scene',name:s.id+'.png',caption:'천장 외곽과 문 끝이 연결된 실제 배치',dataUrl:image.toDataURL()},{id:'ceiling-comparison',name:'ceiling-comparison.png',caption:'왼쪽 정상 / 오른쪽 천장 누락과 출입 봉쇄',dataUrl:comparison.toDataURL()}]};
  tile.referenceDocuments=tile.referenceDocuments.filter(c=>!['scene-'+s.id,'assembled-paw-izakaya-dense'].includes(c.id)).concat(category);
  return {scene:s,tile,dataUrl:prepared.dataUrl,image:image.toDataURL(),before:before.toDataURL(),comparison:comparison.toDataURL(),width:prepared.width,height:prepared.height,checks:{ceilingCells:cells.size,variants:group.memberTileIds.length,prefix480Unchanged:true,reachable:good.reachable,approachTargets:targets.length,negativeIssues:badResult.issues}};
 },{baseScene,baseTile,baseAsset,auto,base64:bytes.toString('base64'),recipes:layout.recipes});
}finally{await browser.close();}
const mapId='paw-izakaya-dense',old=p.maps[mapId];
if(old.events.length)throw Error('Existing events require explicit coordinate migration');
const map={...old,width:result.scene.width,height:result.scene.height,lowerTiles:result.scene.lowerTiles,upperTiles:result.scene.upperTiles};
const asset={...baseAsset,dataUrl:result.dataUrl,meta:{...baseAsset.meta,width:result.width,height:result.height,frames:result.tile.count}};delete asset.ref;
await fs.writeFile(out+'/patch.json',JSON.stringify({sourceProjectId:proof.projectId,maps:{[mapId]:map},beforeMaps:{[mapId]:old},tilesets:{[baseTile.id]:result.tile},beforeTilesets:{[baseTile.id]:baseTile},assets:{[baseAsset.id]:asset},beforeAssets:{[baseAsset.id]:baseAsset},checks:result.checks}));
await fs.writeFile('tiledata/pixel-art-world/izakaya-ceiling-compiled.json',JSON.stringify({packId:baseTile.id,sourceFilename:auto.filename,sourceSha256:auto.sha256,tilesetCount:result.tile.count,ceilingGroupId:auto.id,scene:result.scene},null,2)+'\n');
const dense=await read('tiledata/pixel-art-world/dense-interiors-compiled.json');dense.maps[mapId]={...result.scene,id:mapId};await fs.writeFile('tiledata/pixel-art-world/dense-interiors-compiled.json',JSON.stringify(dense,null,2)+'\n');
for(const name of ['image','before','comparison'])await fs.writeFile(out+'/'+name+'.png',Buffer.from(result[name].split(',')[1],'base64'));
await fs.writeFile(out+'/proof.json',JSON.stringify(result.checks,null,2));console.log(result.checks);
