// Rebuild two distinct homes from reviewed source-pixel plans. Save via CAS separately.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const [input,preparedHome,out,origin='http://127.0.0.1:9816']=process.argv.slice(2);
if(!input||!preparedHome||!out)throw Error('Usage: <canonical portable.json> <fresh home prepared.json> <private output> [dev URL]');
const read=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const project=await read(input),plan=await read('tiledata/pixel-art-world/compact-homes.json'),prepared=await read(preparedHome);
const original=project.tilesets[plan.tilesetId],asset=project.assets.uploaded[original.image.id];
if(original.count!==plan.tilesetCount||original.tilesPerRow!==plan.tilesPerRow||createHash('sha256').update(Buffer.from(asset.dataUrl.split(',')[1],'base64')).digest('hex')!==plan.tilesetImageSha256)throw Error('Canonical home atlas differs from reviewed source');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();try{
 const page=await browser.newPage();await page.route('**/__paw-homes',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto(origin+'/__paw-homes');
 const result=await page.evaluate(async({project,plan,prepared})=>{
  const {canMove}=await import('/src/project/collision.ts');
  const {serialize,deserialize}=await import('/src/project/io.ts');
  const p=structuredClone(project),tile=p.tilesets[plan.tilesetId],maps={},pictures={},movement=[];
  const furniture=structuredClone(prepared.tileset.referenceDocuments.find(c=>c.id==='paw-furniture-pilot'));
  for(const d of furniture.documents)d.markdown=d.markdown.replaceAll(prepared.tileset.id,tile.id);
  tile.referenceDocuments=[furniture,...tile.referenceDocuments.filter(c=>c.id==='paw-wall-a01')];
  const image=new Image();image.src=p.assets.uploaded[tile.image.id].dataUrl;await image.decode();
  for(const [id,s]of Object.entries(plan.maps)){
   const map={...p.maps[id]};
   for(const key of ['name','width','height','tileSize','tilesetId','lowerTiles','upperTiles','events'])map[key]=structuredClone(s[key]);
   p.maps[id]=map;maps[id]=map;
   const queue=[s.spawn],seen=new Set([s.spawn.y*map.width+s.spawn.x]);
   for(let n=0;n<queue.length;n++)for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){const a=queue[n],x=a.x+dx,y=a.y+dy,k=y*map.width+x;if(!seen.has(k)&&canMove(p,map,a.x,a.y,x,y)){seen.add(k);queue.push({x,y});}}
   for(const target of [...s.approachCells,s.exitTrigger])if(!seen.has(target.y*map.width+target.x))throw Error('Unreachable home target '+id+JSON.stringify(target));
   const city=p.maps.paw_city,event=city.events.find(e=>e.id===s.eventPlan.incomingCityEventId);if(!event)throw Error('City door missing '+id);
   for(const commands of [event.commands,...event.pages.map(page=>page.commands)])for(const command of commands)if(command.kind==='transfer'&&command.mapId===id)Object.assign(command,s.eventPlan.incomingTarget);
   const canvas=document.createElement('canvas');canvas.width=map.width*32;canvas.height=map.height*32;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
   for(const layer of [map.lowerTiles,map.upperTiles])layer.forEach((t,i)=>{if(t>=0)ctx.drawImage(image,t%8*32,Math.floor(t/8)*32,32,32,i%map.width*32,Math.floor(i/map.width)*32,32,32);});
   const dataUrl=canvas.toDataURL();pictures[id]=dataUrl;
   tile.referenceDocuments.push({id:'assembled-'+id,name:map.name,description:'서로 다른 다실 주택. 전체 배열·방/문·가구 원점과 실제 출입 연결.',documents:[{id:'layout',name:'전체 배열과 방 연결.md',markdown:`# ${map.name}\n\n${s.designNotes.join('\n')}\n\n0기준 32px. 천장 그룹은 paw-wall-a01이며 본 배열은 현재 paw-home 합성 아틀라스 전용이다. 가구 사각형은 전부 막히고 밑동은 바닥4/11에 닿는다. 침실 발치 통로와 문을 보존한다. 그림의 방 구분은 실제 벽과 통행 틈이다. 잠금·수면·요리 이벤트는 추가하지 않았다.\n\n\`\`\`json\n${JSON.stringify({map,rooms:s.rooms,doorways:s.doorways,placements:s.placements,approachCells:s.approachCells,ceilingCells:s.ceilingCells,spawn:s.spawn,exitTrigger:s.exitTrigger})}\n\`\`\`\n\n![실제 배치](image:scene)`}],images:[{id:'scene',name:id+'.png',caption:'정본용 다실 주택 · 원본 픽셀과 연결된 천장',dataUrl}]});
   movement.push({id,width:map.width,height:map.height,reachable:seen.size,targets:s.approachCells.length+1});
  }
  maps.paw_city=p.maps.paw_city;
  const loaded=deserialize(serialize(p));if(JSON.stringify(loaded.maps)!==JSON.stringify(p.maps))throw Error('Map roundtrip differs');
  return {maps,tilesets:{[tile.id]:tile},pictures,movement};
 },{project,plan,prepared});
 for(const[id,url]of Object.entries(result.pictures))await fs.writeFile(out+'/'+id+'.png',Buffer.from(url.split(',')[1],'base64'));
 delete result.pictures;
 result.beforeMaps=Object.fromEntries(Object.keys(result.maps).map(id=>[id,project.maps[id]]));result.beforeTilesets={[original.id]:original};
 await fs.writeFile(out+'/patch.json',JSON.stringify(result));console.log(result.movement);
}finally{await browser.close();}
