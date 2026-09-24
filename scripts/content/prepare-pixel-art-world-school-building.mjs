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
 const {width:w,height:h}=layout,lowerTiles=Array(w*h).fill(-1),upperTiles=Array(w*h).fill(-1),caps=new Set(Array.from({length:w*h},(_,i)=>i)),placements=[],rooms=[],doorways=[],approaches=[];
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
 // A four-cell corridor and two aligned stair/entrance cores, all contiguous.
 rect(1,19,63,4);rect(1,15,8,23);rect(55,15,9,23);wall(1,12,8);wall(55,12,9);
 for(let slot=0;slot<6;slot++){
  const south=slot>=3,x=10+(slot%3)*15,y=south?24:1,kind=spec.kinds[slot];
  rect(x,y,14,14);wall(x,y,14);if(!south)wall(x,16,14);
  const door={x:x+12,y:south?23:15,width:2,height:4};rect(door.x,door.y,2,4);
  const room={id:`school-${spec.level}-${slot}`,name:spec.rooms[slot],kind,x,y,width:14,height:14,door,center:{x:x+12,y:y+6}};rooms.push(room);doorways.push(door);approaches.push(room.center);
  if(kind==='classroom'){school('school-clock',x+9,y+1);school('school-notice',x+4,y+1);}
  if(!south)school('school-window',x+1,y);
  if(kind==='classroom'){
   school('school-blackboard',x+5,y);school('school-lectern',x+6,y+3);
   for(let row=0;row<2;row++)for(let col=0;col<6;col++){
    const dx=x+1+col*2,dy=y+6+row*4;school('school-student-desk',dx,dy);school('school-chair-back',dx,dy+2);approaches.push({x:dx+1,y:dy+1});
   }
   approaches.push({x:x+6,y:y+5});
  }else if(kind==='nurse'){
   special('special-medical-cabinet',x+8,y+1);special('special-scale',x+6,y+2);
   for(const yy of [y+5,y+10])special('special-bed',x+1,yy);
   special('special-screen',x+4,y+6);special('special-worktable',x+8,y+6);special('special-stool',x+9,y+9);special('special-plant',x+10,y+11);
   approaches.push({x:x+3,y:y+6},{x:x+3,y:y+11},{x:x+8,y:y+8});
  }else if(kind==='science'){
   special('special-bookcase',x+5,y+2);special('special-skeleton',x+10,y+1);
   for(const xx of [x+1,x+7])for(const yy of [y+5,y+10]){special('special-worktable',xx,yy);special('special-stool',xx+1,yy+2);approaches.push({x:xx+3,y:yy+1});}
  }else if(kind==='library'){
   for(const xx of [x,x+4,x+8])library('bookcase',xx,y+1);
   library('magazines',x+1,y+5);library('low-books',x+7,y+6);library('sofa-back',x+7,y+10);
   approaches.push({x:x+2,y:y+8},{x:x+8,y:y+9});
  }else if(kind==='staff'||kind==='principal'){
   office('bookcase',x+7,y+1);
   for(const xx of [x+1,x+7])for(const yy of (kind==='staff'?[y+5,y+10]:[y+5])){office('desk-white',xx,yy);office('chair-blue',xx+1,yy+3);approaches.push({x:xx+3,y:yy+2});}
   if(kind==='principal'){library('sofa-front',x+1,y+10);office('desk-executive',x+7,y+10);}
  }else if(kind==='music'){
   put('music-piano',x+1,y+3);put('music-cello',x+6,y+5);
   for(const xx of [x+8,x+10])for(const yy of [y+6,y+9,y+12])special('special-stool',xx,yy);
   approaches.push({x:x+4,y:y+6});
  }else if(kind==='art'){
   put('art-easel',x+1,y+4);put('art-easel',x+6,y+4);special('special-bookcase',x+6,y+2);
   special('special-worktable',x+1,y+10);special('special-worktable',x+7,y+10);
   approaches.push({x:x+3,y:y+9},{x:x+8,y:y+9});
  }else if(kind==='council'){
   special('special-bookcase',x+5,y+2);school('school-blackboard',x+5,y);
   for(const yy of [y+5,y+9]){special('special-worktable',x+5,yy);for(const xx of [x+4,x+9])special('special-stool',xx,yy+1);}
   approaches.push({x:x+6,y:y+8});
  }
 }
 for(const base of [1,55]){
  if(spec.level<4)put('stairs-up',base,15);
  if(spec.level>1){for(let yy=12;yy<14;yy++)for(let xx=base+4;xx<base+7;xx++)caps.add(at(xx,yy));wall(base+4,14,3);put('stairs-down',base+4,17);}
  if(base===1){school('school-shoe-locker',base+1,27);school('school-plant',base+5,32);}
 }
 // East service wing: an enclosed washroom with two individually partitioned stalls.
 for(let x=55;x<=63;x++)caps.add(at(x,23));
 wall(55,24,9);rect(62,23,2,4);
 for(let y=27;y<=31;y++)caps.add(at(58,y));
 for(const x of [55,57,58,59,61]){caps.add(at(x,31));wall(x,32,1);}
 put('toilet',56,28);put('toilet',60,28);put('sink',59,34);
 const washDoor={x:62,y:23,width:2,height:4};
 rooms.push({id:`school-${spec.level}-washroom`,name:`${spec.level}층 화장실`,kind:'washroom',x:55,y:24,width:9,height:14,door:washDoor,center:{x:63,y:30}});
 doorways.push(washDoor);approaches.push({x:56,y:30},{x:60,y:30},{x:59,y:36});
 // First-floor entrance is the west vestibule; other floors retain its landing.
 const entrance={x:4,y:38},spawn={x:4,y:36};
 if(spec.level===1)rect(entrance.x,entrance.y,2,1);
 for(const i of caps){const x=i%w,y=Math.floor(i/w);let mask=0;for(const[dx,dy,bit]of[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]])if(x+dx>=0&&y+dy>=0&&x+dx<w&&y+dy<h&&caps.has((y+dy)*w+x+dx))mask|=bit;lowerTiles[i]=token(auto.filename,xp.masks.indexOf(xp.normalize(mask)),'lower');}
 const stairs=[];for(const base of [1,55]){if(spec.level<4)stairs.push({direction:'up',x:base+1,y:18,approach:{x:base+1,y:19},destinationLevel:spec.level+1,destination:{x:base+5,y:19}});if(spec.level>1)stairs.push({direction:'down',x:base+5,y:18,approach:{x:base+5,y:19},destinationLevel:spec.level-1,destination:{x:base+1,y:19}});}
 const walk=i=>i>=0&&i<w*h&&tiles[lowerTiles[i]].passage==='passable'&&(upperTiles[i]===-1||tiles[upperTiles[i]].passage==='passable');
 const queue=[at(spawn.x,spawn.y)],seen=new Set(queue);for(let k=0;k<queue.length;k++){const i=queue[k],x=i%w,y=Math.floor(i/w);for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;const next=at(x+dx,y+dy);if(walk(next)&&!seen.has(next)){seen.add(next);queue.push(next);}}}
 for(const cell of [...approaches,...stairs.flatMap(s=>[s,s.approach])])if(!seen.has(at(cell.x,cell.y))){console.log(Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>seen.has(y*w+x)?'.':walk(y*w+x)?'?':'#').join('')).join('\n'));throw Error(`Unreachable floor ${spec.level} ${cell.x},${cell.y}`);}
 // Every room is isolated from all other rooms when its own door is sealed.
 for(const room of rooms){const door=new Set();for(let y=room.door.y;y<room.door.y+4;y++)for(let x=room.door.x;x<room.door.x+2;x++)door.add(at(x,y));const q=[at(room.center.x,room.center.y)],s=new Set(q);for(let k=0;k<q.length;k++){const i=q[k],x=i%w,y=Math.floor(i/w);for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const j=at(nx,ny);if(walk(j)&&!door.has(j)&&!s.has(j)){s.add(j);q.push(j);}}}if(s.has(at(30,20)))throw Error('Room leaks through wall '+room.name);}
 result.push({id:`paw-school-floor-${spec.level}`,name:`햇살학교 ${spec.level}층`,level:spec.level,width:w,height:h,lowerTiles,upperTiles,rooms,doorways,placements,approaches,stairs,entrance,spawn,reachable:seen.size});
}
const blueprint={guide:await readFile('tiledata/pixel-art-world/SCHOOL-BUILDING.md','utf8'),id:layout.id,name:layout.name,rules:layout.rules,sources,tiles,recipes,floors:result};
await writeFile('src/assets/pixelArtWorldSchoolBuilding.json',JSON.stringify(blueprint,null,2)+'\n');
console.log({floors:result.length,rooms:result.flatMap(f=>f.rooms).length,classrooms:result.flatMap(f=>f.rooms).filter(r=>r.kind==='classroom').length,tiles:tiles.length});
