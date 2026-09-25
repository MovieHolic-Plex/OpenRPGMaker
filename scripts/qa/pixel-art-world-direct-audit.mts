// Score actual painted cells without a target layout or automatic repair.
import fs from 'node:fs';
import {PNG} from 'pngjs';
import {canMove} from '../../src/project/collision.ts';
import {inspectInteriorPlacement} from '../../src/project/interiorPlacementAudit.ts';
import {homeRequirements} from './pixel-art-world-home-requirements.ts';
const root=process.argv[2],maxArea=process.argv[3]===undefined?Infinity:Number(process.argv[3]);if(!root||!(maxArea>0))throw Error('Usage: <direct live output> [maximum area]');
const p=JSON.parse(fs.readFileSync(root+'/result-project.json','utf8')),m:any=Object.values(p.maps)[0],t=p.tilesets[m.tilesetId];
const d=JSON.parse(fs.readFileSync('tiledata/pixel-art-world/modern-interiors-compiled.json','utf8'));
const floors=new Set(Object.values(d.materials).filter((v:any)=>v.kind==='floor').flatMap((v:any)=>v.mapped.flat()));
const caseId=m.id.replace('direct-',''),wallMaterial=caseId==='clinic'?'wall-clinic':'wall-wood';
const walls=d.materials[wallMaterial].mapped.flat(),ceiling=t.autotileGroups.find((g:any)=>g.id==='paw-wall-a01').memberTileIds;
const issues:any[]=[],objects:any[]=[],covered=new Set<number>(),at=(x:number,y:number)=>y*m.width+x;
if(m.width*m.height>maxArea)issues.push({code:'EXCESS_MAP_AREA',actual:m.width*m.height,maxArea});
for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){if(!ceiling.includes(m.lowerTiles[at(x,y)])||(y+1<m.height&&ceiling.includes(m.lowerTiles[at(x,y+1)])))continue;for(let row=0;row<walls.length;row++){const yy=y+row+1;if(yy>=m.height)issues.push({code:'CEILING_WALL_OUT_OF_BOUNDS',x,y:yy,ceilingY:y});else if(m.lowerTiles[at(x,yy)]!==walls[row])issues.push({code:'CEILING_WALL_MISSING',x,y:yy,want:walls[row]});}}
for(const r of d.recipes)for(let y=0;y<=m.height-r.tiles.length;y++)for(let x=0;x<=m.width-r.tiles[0].length;x++){
 if(!r.tiles.every((row:number[],dy:number)=>row.every((n:number,dx:number)=>m.upperTiles[at(x+dx,y+dy)]===n)))continue;
 objects.push({id:r.id,x,y,width:r.tiles[0].length,height:r.tiles.length});
 r.tiles.forEach((row:number[],dy:number)=>row.forEach((n:number,dx:number)=>covered.add(at(x+dx,y+dy))));
 if(r.placementKind==='wall-mounted')r.tiles.forEach((row:number[],dy:number)=>row.forEach((n:number,dx:number)=>{if(!walls.includes(m.lowerTiles[at(x+dx,y+dy)]))issues.push({code:'WALL_MOUNT_SUPPORT',id:r.id,x:x+dx,y:y+dy});}));
 else for(const c of r.supportCells)if(!floors.has(m.lowerTiles[at(x+c.x,y+c.y)]))issues.push({code:'FURNITURE_FOOT',id:r.id,x:x+c.x,y:y+c.y});
}
m.lowerTiles.forEach((n:number,i:number)=>{if(n<0)issues.push({code:'UNPAINTED_LOWER',x:i%m.width,y:Math.floor(i/m.width)});});
m.upperTiles.forEach((n:number,i:number)=>{if(n>=0&&!covered.has(i))issues.push({code:'INCOMPLETE_OBJECT',tile:n,x:i%m.width,y:Math.floor(i/m.width)});});
const q=[p.startPos],seen=new Set<number>([at(p.startPos.x,p.startPos.y)]);
if(!floors.has(m.lowerTiles[at(p.startPos.x,p.startPos.y)])||m.upperTiles[at(p.startPos.x,p.startPos.y)]>=0)issues.push({code:'START_BLOCKED'});
for(let n=0;n<q.length;n++)for(const[dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]]){const a=q[n],x=a.x+dx,y=a.y+dy,i=at(x,y);if(x<0||y<0||x>=m.width||y>=m.height||seen.has(i))continue;if(canMove(p,m,a.x,a.y,x,y)){seen.add(i);q.push({x,y});}}
m.lowerTiles.forEach((n:number,i:number)=>{if(floors.has(n)&&m.upperTiles[i]<0&&!seen.has(i))issues.push({code:'ISOLATED_FLOOR',x:i%m.width,y:Math.floor(i/m.width)});});
for(const o of objects){
 if(/fridge|kitchen|stove|tea$|wardrobe|drawers|bookcase/.test(o.id)&&!Array.from({length:o.width},(_,i)=>seen.has(at(o.x+i,o.y+o.height))).some(Boolean))issues.push({code:'OBJECT_FRONT_BLOCKED',...o});
 if(o.id==='izakaya-counter')for(const y of [o.y-1,o.y+o.height])if(!Array.from({length:o.width},(_,i)=>seen.has(at(o.x+i,y))).some(Boolean))issues.push({code:'COUNTER_ACCESS',x:o.x,y});
}
const count=(id:string)=>objects.filter(o=>o.id===id).length;
let partition:any;
if(caseId==='ramen'){
for(const [id,want]of [['izakaya-table',2],['izakaya-chair-back',4],['izakaya-chair-east',2],['izakaya-chair-west',2]]as [string,number][])if(count(id)!==want)issues.push({code:'REQUIRED_COUNT',id,want,actual:count(id)});
for(const id of ['izakaya-kitchen','izakaya-fridge','izakaya-stove'])if(count(id)<1)issues.push({code:'MISSING_KITCHEN_EQUIPMENT',id});
for(const o of objects.filter(o=>o.id==='izakaya-chair-back')){
 if(!objects.some(c=>c.id==='izakaya-counter'&&o.y===c.y+c.height&&o.x>=c.x&&o.x<c.x+c.width))issues.push({code:'BAR_CHAIR_NOT_FACING_COUNTER',...o});
 if(!seen.has(at(o.x,o.y+1)))issues.push({code:'CHAIR_BACK_BLOCKED',...o});
}
for(const o of objects.filter(o=>['izakaya-chair-east','izakaya-chair-west'].includes(o.id))){const east=o.id.endsWith('east');
 if(!objects.some(table=>table.id==='izakaya-table'&&o.x===(east?table.x-1:table.x+table.width)&&o.y>=table.y&&o.y<table.y+table.height))issues.push({code:'TABLE_CHAIR_NOT_FACING_TABLE',...o});
 if(!seen.has(at(o.x+(east?-1:1),o.y)))issues.push({code:'CHAIR_BACK_BLOCKED',...o});
}
const partitions=[];
for(let x=2;x<m.width-2;x++){let solid=0;const gaps=[];for(let y=1;y<m.height-1;y++){const n=m.lowerTiles[at(x,y)];if(ceiling.includes(n)||walls.includes(n))solid++;else if(floors.has(n))gaps.push({x,y});}if(solid>=m.height-6&&gaps.length>=1&&gaps.length<=4&&gaps.every((g,i)=>i<2||g.y!==gaps[i-2].y+2))partitions.push({x,gaps});}
const equipment=objects.filter(o=>['izakaya-kitchen','izakaya-fridge','izakaya-stove'].includes(o.id));
partition=partitions.find(div=>equipment.every(o=>o.x+o.width<=div.x)&&objects.filter(o=>o.id==='izakaya-table').every(o=>o.x>div.x));
if(!partition)issues.push({code:'WEST_KITCHEN_NOT_SEPARATED'});
}
let roomAudit:any;
if(caseId==='home'||caseId==='clinic'){
 const calls=JSON.parse(fs.readFileSync(root+'/tool-calls.json','utf8'));
 const last=calls.filter((c:any)=>c.name==='inspect_interior_layout'&&c.args.rooms?.length).at(-1);
 const rooms=last?.args.rooms??[];
 roomAudit=inspectInteriorPlacement(p,m.id,wallMaterial,p.startPos,rooms,caseId==='home'?homeRequirements:{});issues.push(...roomAudit.issues);
 if(rooms.length!==(caseId==='home'?3:2))issues.push({code:'REQUIRED_ROOM_DECLARATIONS',actual:rooms.length});
 // Derive each room's component from actual floor cells after closing the declared cut line.
 const shut=new Set<number>(rooms.flatMap((r:any)=>r.doorways.map((v:any)=>at(v.x,v.y))));
 const component=(seed:any)=>{const q=[at(seed.x,seed.y)],s=new Set(q);for(let k=0;k<q.length;k++)for(const[dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]]){const x=q[k]%m.width+dx,y=Math.floor(q[k]/m.width)+dy,n=at(x,y);if(x<0||y<0||x>=m.width||y>=m.height||s.has(n)||shut.has(n)||!floors.has(m.lowerTiles[n]))continue;s.add(n);q.push(n);}return s;};
 const roomObjects=rooms.map((r:any)=>{const cells=component(r.seed);return {id:r.id,cells:cells.size,objects:objects.filter(o=>{const recipe=d.recipes.find((r:any)=>r.id===o.id);return recipe.supportCells.some((v:any)=>cells.has(at(o.x+v.x,o.y+v.y)));})};});
 const counts=caseId==='home'?{'personal-m-bed':1,'personal-m-wardrobe':1,'personal-m-desk':1,'personal-m-chair-back':1,'personal-m-kitchen':1,'personal-m-fridge':1,'washitu-round-table':1,'bath-toilet-closed':1,'bath-washer-front':1,'bath-tub-horizontal':1}:{'clinic-reception':1,'clinic-waiting-chair-back':6,'clinic-exam-couch':2,'clinic-monitor':1,'clinic-medicine':2,'clinic-tv':1};
 for(const [id,want]of Object.entries(counts))if(count(id)!==want)issues.push({code:'REQUIRED_COUNT',id,want,actual:count(id)});
 const contains=(r:any,id:string)=>r.objects.some((o:any)=>o.id===id);
 if(caseId==='home'){
  const cushions=count('washitu-cushion-blue')+count('washitu-cushion-pattern');if(cushions!==2)issues.push({code:'REQUIRED_CUSHIONS',want:2,actual:cushions});
  for(const o of objects.filter(o=>['personal-m-bed','bath-toilet-closed','bath-tub-horizontal'].includes(o.id)))if(o.x<m.width/2)issues.push({code:'REQUIRED_EAST_ROOM',...o});
  for(const ids of [['personal-m-bed','personal-m-wardrobe','personal-m-desk','personal-m-chair-back'],['bath-toilet-closed','bath-washer-front'],['bath-tub-horizontal']])if(!roomObjects.some((r:any)=>ids.every(id=>contains(r,id))))issues.push({code:'ROOM_EQUIPMENT_GROUP',ids});
  const tatami=new Set(d.materials.tatami?.mapped.flat()??[]);if(m.lowerTiles.some((n:number)=>tatami.has(n)))issues.push({code:'OPEN_LIVING_TATAMI_REQUIRES_SEPARATE_ROOM_REVIEW'});
 }else{
  for(const o of objects.filter(o=>o.id==='clinic-exam-couch'))if(o.x<m.width/2)issues.push({code:'REQUIRED_EAST_ROOM',...o});
  if(!roomObjects.every((r:any)=>contains(r,'clinic-exam-couch')&&contains(r,'clinic-medicine')))issues.push({code:'CLINIC_ROOM_EQUIPMENT'});
  if(!roomObjects.some((r:any)=>contains(r,'clinic-monitor')&&contains(r,'clinic-stool')))issues.push({code:'EXAM_ROOM_EQUIPMENT'});
  const tv=objects.find(o=>o.id==='clinic-tv');for(const o of objects.filter(o=>o.id==='clinic-waiting-chair-back'))if(!tv||o.y<tv.y+tv.height||Math.abs((o.x+0.5)-(tv.x+tv.width/2))>(o.y-(tv.y+tv.height)+tv.width/2)||!seen.has(at(o.x,o.y+1)))issues.push({code:'WAITING_CHAIR_TV_OR_APPROACH',...o});
 }
 roomAudit.requestRooms=roomObjects;
}
if(!Array.from({length:m.width},(_,x)=>seen.has(at(x,m.height-1))).some(Boolean))issues.push({code:'NO_SOUTH_EXIT'});
const src=PNG.sync.read(Buffer.from(p.assets.uploaded[t.image.id].dataUrl.split(',')[1],'base64')),im=new PNG({width:m.width*32,height:m.height*32});
for(const layer of [m.lowerTiles,m.upperTiles])layer.forEach((n:number,i:number)=>{if(n<0)return;for(let y=0;y<32;y++)for(let x=0;x<32;x++){const a=((Math.floor(n/8)*32+y)*src.width+n%8*32+x)*4,b=((Math.floor(i/m.width)*32+y)*im.width+i%m.width*32+x)*4,alpha=src.data[a+3]/255,beta=im.data[b+3]/255,v=alpha+beta*(1-alpha);for(let k=0;k<3;k++)im.data[b+k]=v?Math.round((src.data[a+k]*alpha+im.data[b+k]*beta*(1-alpha))/v):0;im.data[b+3]=Math.round(v*255);}});
fs.writeFileSync(root+'/actual-final.png',PNG.sync.write(im));
const result={mapId:m.id,width:m.width,height:m.height,objects,reachable:seen.size,partition,roomAudit,issues,pass:issues.length===0,scope:'Independent request/structure checks on actual model-painted cells; no expected complete map and no repair.'};
fs.writeFileSync(root+'/placement-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
