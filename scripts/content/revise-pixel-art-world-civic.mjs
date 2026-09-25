// Prepare corrected civic rooms from the canonical host snapshot. Saving is a separate CAS step.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const [input,sourceDir,out,origin='http://127.0.0.1:9816']=process.argv.slice(2);
if(!input||!sourceDir||!out)throw Error('Usage: <canonical portable.json> <source directory> <private output> [editor dev origin]');
const project=JSON.parse(await fs.readFile(input,'utf8'));
const packs=JSON.parse(await fs.readFile('src/assets/pixelArtWorldCatalog.json','utf8'));
const files=Object.fromEntries(await Promise.all(packs.map(async p=>[p.filename,(await fs.readFile(path.join(sourceDir,p.filename))).toString('base64')])));
await fs.mkdir(out,{recursive:true});const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.route('**/__paw-civic',r=>r.fulfill({contentType:'text/html',body:'<main>Civic rooms</main>'}));await page.goto(origin+'/__paw-civic');
 const result=await page.evaluate(async({project,packs,files})=>{
  const {prepareExternalTileset}=await import('/src/editor/externalTilesetImport.ts');
  const {normalizeXpAutotileMask,XP_AUTOTILE_MASKS}=await import('/src/project/pixelArtWorldAutotiles.ts');
  const {canMove}=await import('/src/project/collision.ts');
  const {serialize,deserialize}=await import('/src/project/io.ts');
  const p=structuredClone(project), maps={},tilesets={},pictures={},movement=[];
  for(const pack of packs){
   const id=pack.id==='paw-library'?'library-compact-1':'office-compact-7';
   const old=p.maps[id],tile=p.tilesets[old.tilesetId],scene=pack.scenes[0],w=scene.width+2,h=scene.height+2;
   const file=new File([Uint8Array.from(atob(files[pack.filename]),c=>c.charCodeAt(0))],pack.filename,{type:'image/png'});
   const prepared=await prepareExternalTileset(file,pack);
   for(const prop of ['passability','priority','terrain','tileMeta'])tile[prop].splice(0,prepared.tileset.count,...prepared.tileset[prop]);
   tile.tileGroups=prepared.tileset.tileGroups;
   const documents=prepared.tileset.referenceDocuments;
   for(const c of documents)for(const d of c.documents)d.markdown=d.markdown.replaceAll(prepared.tileset.id,tile.id);
   tile.referenceDocuments=[...documents,...tile.referenceDocuments.filter(c=>c.id==='paw-wall-a01')];
   const map={...old,name:scene.name,width:w,height:h,lowerTiles:Array(w*h).fill(-1),upperTiles:Array(w*h).fill(-1)};
   const entry={x:pack.id==='paw-library'?6:5,y:h-2};
   for(let y=0;y<scene.height;y++)for(let x=0;x<scene.width;x++){
    map.lowerTiles[(y+1)*w+x+1]=scene.lowerTiles[y*scene.width+x];map.upperTiles[(y+1)*w+x+1]=scene.upperTiles[y*scene.width+x];
   }
   const cap=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&(x===0||y===0||x===w-1||y===h-1)&&!(y>=entry.y&&x>=entry.x&&x<=entry.x+1);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(cap(x,y)){
    let mask=0;for(const[dx,dy,bit]of[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]])if(cap(x+dx,y+dy))mask|=bit;
    map.lowerTiles[y*w+x]=prepared.tileset.count+XP_AUTOTILE_MASKS.indexOf(normalizeXpAutotileMask(mask));
   }
   for(let y=entry.y;y<h;y++)for(let dx=0;dx<2;dx++)map.lowerTiles[y*w+entry.x+dx]=pack.floorTile;
   for(const event of map.events)if(event.id.startsWith(id+'-exit-'))event.y=entry.y;
   p.maps[id]=map;
   const queue=[{x:entry.x,y:entry.y-1}],seen=new Set([queue[0].y*w+queue[0].x]);
   for(let n=0;n<queue.length;n++)for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){const a=queue[n],x=a.x+dx,y=a.y+dy,k=y*w+x;if(!seen.has(k)&&canMove(p,map,a.x,a.y,x,y)){seen.add(k);queue.push({x,y});}}
   const targets=[entry,{x:entry.x+1,y:entry.y},...scene.approachCells.map(c=>({x:c.x+1,y:c.y+1}))];
   for(const t of targets)if(!seen.has(t.y*w+t.x))throw Error(`Blocked ${id}: ${t.x},${t.y}`);
   const image=new Image();image.src=p.assets.uploaded[tile.image.id].dataUrl;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=w*32;canvas.height=h*32;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
   for(const layer of [map.lowerTiles,map.upperTiles])layer.forEach((t,i)=>{if(t>=0)ctx.drawImage(image,t%8*32,Math.floor(t/8)*32,32,32,i%w*32,Math.floor(i/w)*32,32,32);});
   const dataUrl=canvas.toDataURL();pictures[id]=dataUrl;
   tile.referenceDocuments.push({id:'assembled-'+id,name:map.name+' · 수정된 실제 배치',description:'가구 방향·대출 동선·중앙 통로를 수정한 정본용 평면.',documents:[{id:'layout',name:'전체 배열과 동선.md',markdown:`# ${map.name}\n\n${scene.notes}\n\n실제 맵은 scene 좌표에 (1,1)을 더한다. 기존 출입 이벤트와 목적지는 보존한다.\n\n\`\`\`json\n${JSON.stringify({map,placements:scene.placements,approaches:targets})}\n\`\`\`\n\n![실제 배치](image:scene)`}],images:[{id:'scene',name:id+'.png',caption:'사용자 원본 픽셀 그대로 배치한 수정본',dataUrl}]});
   maps[id]=map;tilesets[tile.id]=tile;movement.push({id,reachable:seen.size,targets:targets.length,width:w,height:h});
  }
  function updateTransfer(value){
   if(Array.isArray(value)){value.forEach(updateTransfer);return;}
   if(!value||typeof value!=='object')return;
   if(value.kind==='transfer'&&maps[value.mapId]){
    const old=project.maps[value.mapId],next=maps[value.mapId];
    if(value.y===old.height-3)value.y=next.height-3;
   }
   Object.values(value).forEach(updateTransfer);
  }
  for(const map of Object.values(p.maps)){updateTransfer(map.events);if(JSON.stringify(map)!==JSON.stringify(project.maps[map.id]))maps[map.id]=map;}
  const loaded=deserialize(serialize(p));if(JSON.stringify(loaded.maps)!==JSON.stringify(p.maps))throw Error('Map roundtrip differs');
  return{maps,tilesets,pictures,movement};
 },{project,packs,files});
 for(const[id,url]of Object.entries(result.pictures))await fs.writeFile(out+'/'+id+'.png',Buffer.from(url.split(',')[1],'base64'));
 delete result.pictures;result.beforeMaps=Object.fromEntries(Object.keys(result.maps).map(id=>[id,project.maps[id]]));
 result.beforeTilesets=Object.fromEntries(Object.keys(result.tilesets).map(id=>[id,project.tilesets[id]]));
 await fs.writeFile(out+'/patch.json',JSON.stringify(result));console.log(result.movement);
}finally{await browser.close();}
