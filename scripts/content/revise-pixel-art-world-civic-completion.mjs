// Compile reviewed civic plans and source-pixel furniture. No database writes.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const [input,compositeFile,sourceDir,out,origin='http://127.0.0.1:9816']=process.argv.slice(2);
if(!input||!compositeFile||!sourceDir||!out)throw Error('Usage: <canonical portable> <composite library> <originals directory> <private output> [dev URL]');
const read=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const project=await read(input),library=await read(compositeFile),plan=await read('tiledata/pixel-art-world/compact-civic.json');
for(const[id,basis]of Object.entries(plan.bases)){
 const tile=project.tilesets[id],asset=project.assets.uploaded[tile.image.id];
 if(tile.count!==basis.count||createHash('sha256').update(Buffer.from(asset.dataUrl.split(',')[1],'base64')).digest('hex')!==basis.sha256)throw Error('Reviewed atlas changed '+id);
}
const clinicBase64=(await fs.readFile(sourceDir+'/ST-Hospital-I01.png')).toString('base64');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();try{
 const page=await browser.newPage();await page.route('**/__paw-civic-completion',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto(origin+'/__paw-civic-completion');
 const result=await page.evaluate(async({project,library,plan,clinicBase64})=>{
  const {canMove}=await import('/src/project/collision.ts');
  const {serialize,deserialize}=await import('/src/project/io.ts');
  const {prepareExternalTileset}=await import('/src/editor/externalTilesetImport.ts');
  const packs=(await import('/src/project/externalTilesetCatalog.ts')).EXTERNAL_TILESET_PACKS;
  const pack=packs.find(p=>p.id==='paw-clinic-interior');
  const file=new File([Uint8Array.from(atob(clinicBase64),c=>c.charCodeAt(0))],pack.filename,{type:'image/png'});
  const fresh=await prepareExternalTileset(file,pack);
  const p=structuredClone(project),maps={},tilesets=structuredClone(library.tilesets),pictures={},movement=[];
  Object.assign(p.tilesets,tilesets);Object.assign(p.assets.uploaded,library.assets);
  const clinic=p.tilesets[pack.id];tilesets[pack.id]=clinic;
  for(const prop of ['passability','priority','terrain','tileMeta'])clinic[prop][254]=fresh.tileset[prop][254];
  const chair=fresh.tileset.tileGroups.find(g=>g.id==='clinic-waiting-chair-back');
  clinic.tileGroups=[...clinic.tileGroups.filter(g=>g.id!==chair.id),chair];
  clinic.referenceDocuments=[fresh.tileset.referenceDocuments.find(c=>c.id==='paw-furniture-pilot'),...clinic.referenceDocuments.filter(c=>c.id!=='paw-furniture-pilot')];
  for(const d of clinic.referenceDocuments[0].documents)d.markdown=d.markdown.replaceAll(fresh.tileset.id,clinic.id);
  for(const[id,s]of Object.entries(plan.maps)){
   const old=p.maps[id],map={...old};
   for(const field of ['name','width','height','tilesetId','lowerTiles','upperTiles'])map[field]=structuredClone(s[field]);
   const exits=old.events.filter(e=>e.id.startsWith(id+'-exit-'));
   if(!exits.length)throw Error('Exit template missing '+id);
   const exit=structuredClone(exits[0]);Object.assign(exit,s.exitTrigger);
   map.events=[...old.events.filter(e=>!e.id.startsWith(id+'-exit-')),exit];
   p.maps[id]=map;maps[id]=map;
   const tile=p.tilesets[map.tilesetId];
   const queue=[s.spawn],seen=new Set([s.spawn.y*map.width+s.spawn.x]);
   for(let n=0;n<queue.length;n++)for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){
    const a=queue[n],x=a.x+dx,y=a.y+dy,k=y*map.width+x;
    if(!seen.has(k)&&canMove(p,map,a.x,a.y,x,y)){seen.add(k);queue.push({x,y});}
   }
   for(const target of [...s.approachCells,s.exitTrigger])if(!seen.has(target.y*map.width+target.x))throw Error('Unreachable '+id+JSON.stringify(target));
   for(let i=0;i<map.lowerTiles.length;i++)if(map.upperTiles[i]<0&&[1,6,10,0].includes(map.lowerTiles[i])&&!seen.has(i))throw Error('Isolated floor '+id+' '+i);
   const image=new Image();image.src=p.assets.uploaded[tile.image.id].dataUrl;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=map.width*32;canvas.height=map.height*32;
   const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
   for(const layer of [map.lowerTiles,map.upperTiles])layer.forEach((t,i)=>{if(t>=0){if(t>=tile.count)throw Error('Tile out of bounds');ctx.drawImage(image,t%8*32,Math.floor(t/8)*32,32,32,i%map.width*32,Math.floor(i/map.width)*32,32,32);}});
   const dataUrl=canvas.toDataURL();pictures[id]=dataUrl;
   tile.referenceDocuments=tile.referenceDocuments.filter(c=>!c.id.startsWith('scene-')&&!c.id.startsWith('assembled-'));
   tile.referenceDocuments.push({id:'assembled-'+id,name:map.name+' · 검토된 평면',description:'상판 완전 조립, 실제 직원/손님 접근칸과 연결된 천장.',documents:[{id:'layout',name:'전체 배열과 동선.md',markdown:`# ${map.name}\n\n${s.designNotes.join('\n\n')}\n\n0기준 32px. 이 배열은 현재 ${tile.id} 아틀라스 전용이다. 전체 가구는 상위, 실제 바닥과 천장은 하위. 바닥 가구 밑동은 바닥에 닿고 벽걸이만 벽 위에 둔다. 출입 이벤트는 남쪽 문턱, 출현은 그 안쪽이라 입장 즉시 되돌아가지 않는다. 앉기·결제·진료 이벤트는 추가하지 않았다.\n\n\`\`\`json\n${JSON.stringify({map,placements:s.placements,approachCells:s.approachCells,ceilingCells:s.ceilingCells,spawn:s.spawn,exitTrigger:s.exitTrigger})}\n\`\`\`\n\n![실제 배치](image:scene)`}],images:[{id:'scene',name:id+'.png',caption:'사용자 원본 픽셀로 조립한 실제 정본용 평면',dataUrl}]});
   movement.push({id,width:map.width,height:map.height,reachable:seen.size,targets:s.approachCells.length+1});
  }
  const rewrite=value=>{if(Array.isArray(value)){value.forEach(rewrite);return;}if(!value||typeof value!=='object')return;if(value.kind==='transfer'&&plan.maps[value.mapId])Object.assign(value,plan.maps[value.mapId].spawn);Object.values(value).forEach(rewrite);};
  for(const map of Object.values(p.maps)){rewrite(map.events);if(JSON.stringify(map)!==JSON.stringify(project.maps[map.id]))maps[map.id]=map;}
  const loaded=deserialize(serialize(p));if(JSON.stringify(loaded.maps)!==JSON.stringify(p.maps))throw Error('Map serialization differs');
  return{maps,tilesets,pictures,movement};
 },{project,library,plan,clinicBase64});
 for(const[id,url]of Object.entries(result.pictures))await fs.writeFile(out+'/'+id+'.png',Buffer.from(url.split(',')[1],'base64'));
 delete result.pictures;
 result.beforeMaps=Object.fromEntries(Object.keys(result.maps).map(id=>[id,project.maps[id]]));
 result.beforeTilesets=Object.fromEntries(Object.keys(result.tilesets).map(id=>[id,project.tilesets[id]]));
 result.assets=library.assets;result.beforeAssets=Object.fromEntries(Object.keys(library.assets).map(id=>[id,project.assets.uploaded[id]??null]));
 result.sourceProjectId=plan.sourceProjectId;
 await fs.writeFile(out+'/patch.json',JSON.stringify(result));console.log(result.movement);
}finally{await browser.close();}
