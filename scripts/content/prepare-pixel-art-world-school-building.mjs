// Metadata-only floor plan: no network, PNG, or project-store writes.
import {readFile,writeFile} from 'node:fs/promises';
import {withTsModule} from '../ontology-ts-loader.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const layout=await read('tiledata/pixel-art-world/school-building-layout.json');
const packs=[...await read('src/assets/pixelArtWorldSchoolCatalog.json'),...await read('src/assets/pixelArtWorldCatalog.json')];
const extra=await read('tiledata/pixel-art-world/school-building-parts.json');
const xp=await withTsModule('src/project/pixelArtWorldAutotiles.ts','school-xp.mjs',a=>({masks:a.XP_AUTOTILE_MASKS,normalize:a.normalizeXpAutotileMask}));
const auto=(await read('src/assets/pixelArtWorldAutotiles.json')).find(a=>a.id==='paw-wall-a01');
const sources=[...packs.map(p=>({filename:p.filename,sha256:p.sha256,width:p.width,height:p.height,sourcePage:p.sourcePage,downloadUrl:p.downloadUrl,format:'tileset'})),{...auto,width:96,height:128,format:'xp-autotile',variantMasks:xp.masks}];
const recipes=Object.fromEntries(packs.flatMap(p=>p.recipes.map(r=>[p.id+'/'+r.id,{...r,source:p.filename}])));
for(const r of extra.recipes)recipes[r.id]=r;
for(const s of extra.sources??[])if(!sources.some(v=>v.filename===s.filename))sources.push(s);
const tiles=[],lookup=new Map();
function token(source,tile,layer='upper',passage='blocked'){
 const key=[source,tile,layer,passage].join(':');if(lookup.has(key))return lookup.get(key);
 const s=sources.find(s=>s.filename===source);if(!s||tile<0||tile>=(s.format==='xp-autotile'?47:s.width*s.height/1024))throw Error('Unknown source tile '+key);
 const id=tiles.length;tiles.push({source,tile,layer,passage});lookup.set(key,id);return id;
}
const native='ST-Schl-I01.png',floor=token(native,6,'lower','passable');
const walls=[41,49,57].map(t=>token(native,t,'lower'));
const result=[];
for(const spec of layout.floors){
 const {width:w,height:h}=layout,lowerTiles=Array(w*h).fill(-1),upperTiles=Array(w*h).fill(-1),caps=new Set(Array.from({length:w*h},(_,i)=>i)),placements=[],rooms=[],doorways=[],approaches=[],lintels=new Set();
 const at=(x,y)=>{if(x<0||y<0||x>=w||y>=h)throw Error(`Bounds ${x},${y}`);return y*w+x;};
 const lower=(x,y,t)=>{const i=at(x,y);lowerTiles[i]=t;caps.delete(i);};
 const rect=(x,y,width,height,t=floor)=>{for(let j=0;j<height;j++)for(let i=0;i<width;i++)lower(x+i,y+j,t);};
 const wall=(x,y,width)=>walls.forEach((t,j)=>rect(x,y+j,width,1,t));
 function put(id,x,y){
  const r=recipes[id];if(!r)throw Error('Missing recipe '+id);
  const rows=r.tiles??Array.from({length:r.sourceRect.height},(_,dy)=>Array.from({length:r.sourceRect.width},(_,dx)=>(r.sourceRect.y+dy)*8+r.sourceRect.x+dx));
  rows.forEach((row,dy)=>row.forEach((t,dx)=>{if(t<0)return;const i=at(x+dx,y+dy);if(upperTiles[i]!==-1)throw Error(`Overlap ${id} ${x+dx},${y+dy}`);upperTiles[i]=token(r.source,t,'upper',r.walkCells?.some(c=>c.x===dx&&c.y===dy)?'passable':'blocked');}));
  placements.push({recipeId:id,x,y,width:rows[0].length,height:rows.length});
 }
 const school=(id,x,y)=>put('paw-school-interior/'+id,x,y),special=(id,x,y)=>put('paw-school-special/'+id,x,y),office=(id,x,y)=>put('paw-office/'+id,x,y),library=(id,x,y)=>put('paw-library/'+id,x,y);
 // Native furniture groups define room sizes; the corridor is two cells wide.
 rect(1,18,30,2);wall(1,15,30);
 for(let slot=0;slot<6;slot++){
  const south=slot>=3,kind=spec.kinds[slot],width=kind==='classroom'?6:8;
  const height=({classroom:13,nurse:10,science:11,library:8,staff:9,principal:8,music:8,art:10,council:8})[kind];
  const x=[1,8,15][slot%3],y=south?21:14-height;
  rect(x,y,width,height);wall(x,y,width);
  const door={x:x+width-1,y:south?20:14,width:1,height:4};rect(door.x,door.y,1,4);caps.add(at(door.x,door.y));lintels.add(at(door.x,door.y));
  const room={id:`school-${spec.level}-${slot}`,name:spec.rooms[slot],kind,x,y,width,height,door,center:{x:x+width-1,y:y+height-1}};rooms.push(room);doorways.push(door);approaches.push(room.center);
  if(kind==='classroom'&&south)school('school-clock',x+4,y+1);
  if(!south)school('school-window',x+(kind==='classroom'?3:0),y);
  if(kind==='classroom'){
   school('school-blackboard',x,y);school('school-lectern',x+1,y+2);
   for(let row=0;row<2;row++)for(const col of [0,2,4]){
    const dx=x+col,dy=y+4+row*3;school('school-student-desk',dx,dy);school('school-chair-back',dx,dy+2);approaches.push({x:dx+1,y:dy+2});
   }
   approaches.push({x:x+1,y:y+4});
   put('classroom-rear-lockers',x+2,y+10);
   for(let dx=0;dx<3;dx++)approaches.push({x:x+2+dx,y:y+12});
  }else if(kind==='nurse'){
   special('special-medical-cabinet',x+4,y+1);special('special-scale',x+6,y+2);
   for(const yy of [y+4,y+7])special('special-bed',x,yy);
   special('special-screen',x+3,y+4);special('special-worktable',x+4,y+7);
   approaches.push({x:x+2,y:y+5},{x:x+2,y:y+8});
  }else if(kind==='science'){
   special('special-bookcase',x+3,y+2);special('special-skeleton',x+6,y+1);
   for(const xx of [x,x+4])for(const yy of [y+4,y+7]){special('special-worktable',xx,yy);special('special-stool',xx+1,yy+2);approaches.push({x:xx+3,y:yy+1});}
  }else if(kind==='library'){
   library('bookcase',x,y+1);library('magazines',x+4,y+1);
   library('low-books',x,y+5);library('sofa-back',x+4,y+5);
   approaches.push({x:x+1,y:y+4},{x:x+5,y:y+4},{x:x+3,y:y+6});
  }else if(kind==='staff'){
   office('bookcase',x+3,y+1);
   for(const xx of [x,x+4]){office('desk-white',xx,y+4);put('office-chair-back',xx+1,y+7);approaches.push({x:xx+3,y:y+6});}
  }else if(kind==='principal'){
   office('bookcase',x,y+1);office('desk-executive',x+4,y+3);put('office-chair-back',x+5,y+5);
   library('sofa-front',x,y+5);approaches.push({x:x+3,y:y+6},{x:x+5,y:y+6});
  }else if(kind==='music'){
   put('music-piano',x,y+3);put('music-cello',x+3,y+3);
   for(const xx of [x+4,x+6])for(const yy of [y+4,y+6])special('special-stool',xx,yy);
   approaches.push({x:x+2,y:y+7},{x:x+5,y:y+5});
  }else if(kind==='art'){
   for(const xx of [x,x+2,x+4,x+6])put('art-easel',xx,y+4);
   special('special-bookcase',x+3,y+2);
   special('special-worktable',x,y+7);special('special-worktable',x+4,y+7);
   approaches.push({x:x+3,y:y+6},{x:x+7,y:y+6});
  }else if(kind==='council'){
   school('school-blackboard',x+3,y);special('special-bookcase',x,y+3);
   special('special-worktable',x+3,y+4);
   for(const xx of [x+2,x+6])special('special-stool',xx,y+5);
   for(const xx of [x+3,x+5])special('special-stool',xx,y+6);
   approaches.push({x:x+4,y:y+7});
  }
 }
 // Southeast restroom stays separate from the northeast staircase.
 rect(24,21,7,8);wall(24,21,7);rect(30,20,1,4);caps.add(at(30,20));lintels.add(at(30,20));
 put('washroom-open-stalls',24,23);put('toilet',25,23);put('toilet',27,23);put('sink',29,23);
 const washDoor={x:30,y:20,width:1,height:4};
 rooms.push({id:`school-${spec.level}-washroom`,name:`${spec.level}층 화장실`,kind:'washroom',x:24,y:21,width:7,height:8,door:washDoor,center:{x:30,y:28}});
 doorways.push(washDoor);approaches.push({x:25,y:25},{x:27,y:25},{x:29,y:25});
 // One vertically aligned stair core, entered from the end of the corridor.
 rect(24,7,7,7);wall(24,7,7);rect(27,14,1,4);caps.add(at(27,14));lintels.add(at(27,14));
 doorways.push({x:27,y:14,width:1,height:4});
 const cores=[{base:24,y:8}];
 for(const {base,y} of cores){
  if(spec.level<4){rect(base,y+1,3,2);put('stairs-up-compact',base,y);}
  if(spec.level>1){rect(base+4,y+1,3,2);put('stairs-down',base+4,y+1);}
 }
 // Connect the central partition to the north ceiling; its face stops before the shared landing.
 for(let y=7;y<=8;y++)caps.add(at(27,y));
 wall(27,9,1);
 for(const door of doorways){lower(door.x,door.y+3,token(native,1,'lower','passable'));if(upperTiles[at(door.x-1,door.y+1)]===-1)school('school-notice',door.x-1,door.y+1);}
 const entrance={x:0,y:19,width:1,height:1,direction:'left'},spawn={x:2,y:19};
 if(spec.level===1)rect(0,19,1,1);

 for(const i of caps){const x=i%w,y=Math.floor(i/w);let mask=0;for(const[dx,dy,bit]of[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]])if(x+dx>=0&&y+dy>=0&&x+dx<w&&y+dy<h&&caps.has((y+dy)*w+x+dx))mask|=bit;const tile=xp.masks.indexOf(xp.normalize(mask));if(lintels.has(i)){lowerTiles[i]=floor;upperTiles[i]=token(auto.filename,tile,'upper','passable');}else lowerTiles[i]=token(auto.filename,tile,'lower');}
 const stairs=[];for(const {base,y} of cores){if(spec.level<4)stairs.push({direction:'up',x:base+1,y:y+2,approach:{x:base+1,y:y+3},destinationLevel:spec.level+1,destination:{x:base+5,y:y+3}});if(spec.level>1)stairs.push({direction:'down',x:base+5,y:y+2,approach:{x:base+5,y:y+3},destinationLevel:spec.level-1,destination:{x:base+1,y:y+3}});}
 const walk=i=>i>=0&&i<w*h&&tiles[lowerTiles[i]].passage==='passable'&&(upperTiles[i]===-1||tiles[upperTiles[i]].passage==='passable');
 const queue=[at(spawn.x,spawn.y)],seen=new Set(queue);for(let k=0;k<queue.length;k++){const i=queue[k],x=i%w,y=Math.floor(i/w);for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;const next=at(x+dx,y+dy);if(walk(next)&&!seen.has(next)){seen.add(next);queue.push(next);}}}
 // The transparent top-center cell retains its wall; only the two tread rows are walkable.
 for(const cell of [...approaches,...stairs.flatMap(s=>[s,s.approach,...(s.direction==='up'?Array.from({length:2},(_,i)=>({x:s.x,y:s.y-i})):[])])])if(!seen.has(at(cell.x,cell.y))){console.log(Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>seen.has(y*w+x)?'.':walk(y*w+x)?'?':'#').join('')).join('\n'));throw Error(`Unreachable floor ${spec.level} ${cell.x},${cell.y}`);}
 // Every room is isolated from all other rooms when its own door is sealed.
 for(const room of rooms){const door=new Set();for(let y=room.door.y;y<room.door.y+room.door.height;y++)for(let x=room.door.x;x<room.door.x+room.door.width;x++)door.add(at(x,y));const q=[at(room.center.x,room.center.y)],s=new Set(q);for(let k=0;k<q.length;k++){const i=q[k],x=i%w,y=Math.floor(i/w);for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const j=at(nx,ny);if(walk(j)&&!door.has(j)&&!s.has(j)){s.add(j);q.push(j);}}}if(s.has(at(20,19)))throw Error('Room leaks through wall '+room.name);}
 result.push({id:`paw-school-floor-${spec.level}`,name:`햇살학교 ${spec.level}층`,level:spec.level,width:w,height:h,lowerTiles,upperTiles,rooms,doorways,placements,approaches,stairs,entrance,spawn,lintels:[...lintels].map(i=>({x:i%w,y:Math.floor(i/w)})),reachable:seen.size});
}
const blueprint={guide:await readFile('tiledata/pixel-art-world/SCHOOL-BUILDING.md','utf8'),stairwellGuide:await readFile('tiledata/pixel-art-world/SCHOOL-STAIRWELL.md','utf8'),id:layout.id,name:layout.name,rules:layout.rules,sources,tiles,recipes,floors:result};
await writeFile('src/assets/pixelArtWorldSchoolBuilding.json',JSON.stringify(blueprint,null,2)+'\n');
console.log({floors:result.length,rooms:result.flatMap(f=>f.rooms).length,classrooms:result.flatMap(f=>f.rooms).filter(r=>r.kind==='classroom').length,tiles:tiles.length});
