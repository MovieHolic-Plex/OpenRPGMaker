// Metadata only. Original/derived pixels are never bundled.
import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../../tiledata/pixel-art-world/facility-complements.json',import.meta.url),'utf8'));
for(const pack of data.packs){
 const sources=new Map(pack.sources.map(s=>[s.id,s]));let row=1;const ids=new Set();
 const validPart=p=>{const s=sources.get(p.sourceId),r=p.sourceRect;if(!s||!Number.isInteger(r.x)||!Number.isInteger(r.y)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>s.width||r.y+r.height>s.height)throw Error('Source part bounds '+pack.id);};
 for(const p of pack.palette)validPart(p.part);
 for(const r of pack.recipes){
  if(ids.has(r.id)||r.width%32||r.height%32||r.width>256)throw Error('Recipe bounds');ids.add(r.id);
  r.outputRect={x:0,y:row,width:r.width/32,height:r.height/32};row+=r.height/32;
  for(const p of [...r.parts,...r.counterexampleParts]){validPart(p);if(p.target.x<0||p.target.y<0||p.target.x+p.sourceRect.width>r.width||p.target.y+p.sourceRect.height>r.height)throw Error('Target part bounds '+r.id);}
  for(const c of [...r.occupiedCells,...r.blockingCells,...r.supportCells])if(c.length!==2||c.some(v=>!Number.isInteger(v))||c[0]<0||c[1]<0||c[0]>=r.width/32||c[1]>=r.height/32)throw Error('Cell bounds '+r.id);
  const set=new Set(r.occupiedCells.map(c=>c.join(',')));r.upperRows=Array.from({length:r.height/32},(_,y)=>Array.from({length:r.width/32},(_,x)=>set.has(`${x},${y}`)?(r.outputRect.y+y)*8+x:-1));
 }
 pack.atlas={width:256,height:row*32,columns:8,count:row*8};
 const s=pack.scenePlan,w=s.width,h=s.height,lowerTiles=Array(w*h).fill(0),upperTiles=Array(w*h).fill(-1);
 if(s.mode==='room'||s.mode==='wall-strip')for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(y<(s.wallRows??2)||(s.mode==='room'&&(y===h-1||x===0||x===w-1)))lowerTiles[y*w+x]=y===0?2:1;
 if(s.mode==='outdoor-stone')for(let y=0;y<h;y++)for(let x=0;x<w;x++)lowerTiles[y*w+x]=(y%2)*2+x%2;
 lowerTiles[s.entry.y*w+s.entry.x]=0;
 for(const p of s.placements){const r=pack.recipes.find(r=>r.id===p.recipeId);if(!r||p.x<0||p.y<0||p.x+r.outputRect.width>w||p.y+r.outputRect.height>h)throw Error('Place bounds');for(let y=0;y<r.outputRect.height;y++)for(let x=0;x<r.outputRect.width;x++){const t=r.upperRows[y][x],i=(p.y+y)*w+p.x+x;if(t<0)continue;if(upperTiles[i]>=0)throw Error('Place object overlap');upperTiles[i]=t;}}
 for(const p of s.placements){const r=pack.recipes.find(r=>r.id===p.recipeId);const wallTiles=new Set(pack.palette.filter(t=>!t.passable).map(t=>t.tile));for(const[x,y]of r.supportCells){const wall=wallTiles.has(lowerTiles[(p.y+y)*w+p.x+x]);if((r.placementKind==='wall-mounted')!==wall)throw Error('Wrong wall/floor support '+r.id);}for(const[x,y]of r.wallSupportCells??[])if(!wallTiles.has(lowerTiles[(p.y+y)*w+p.x+x]))throw Error('Cabinet needs wall '+r.id);}
 const blocked=new Set(pack.palette.filter(p=>!p.passable).map(p=>p.tile));for(const r of pack.recipes)for(const[x,y]of r.blockingCells)blocked.add((r.outputRect.y+y)*8+x);
 const can=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&!blocked.has(lowerTiles[y*w+x])&&!blocked.has(upperTiles[y*w+x]);
 const queue=[[s.entry.x,s.entry.y]],seen=new Set([queue[0].join(',')]);if(!can(...queue[0]))throw Error('Entry blocked');for(let i=0;i<queue.length;i++)for(const[d,e]of[[1,0],[-1,0],[0,1],[0,-1]]){const[x,y]=queue[i],a=x+d,b=y+e,k=`${a},${b}`;if(can(a,b)&&!seen.has(k)){seen.add(k);queue.push([a,b]);}}
 for(const a of s.approachCells)if(!seen.has(`${a.x},${a.y}`))throw Error('Unreachable approach '+s.id);
 pack.scene={...s,lowerTiles,upperTiles,rooms:s.mode==='room'?[{id:s.id,name:s.name,x:1,y:s.wallRows??2,width:w-2,height:h-(s.wallRows??2)-1}]:[],doorways:s.mode==='room'?[{x:s.entry.x,y:s.entry.y,width:1,direction:'south',staticOpening:true}]:[],reachableCells:[...seen].map(k=>k.split(',').map(Number))};
}
await writeFile(new URL('../../src/assets/pixelArtWorldFacilityComplementsCatalog.json',import.meta.url),JSON.stringify(data,null,2)+'\n');console.log({packs:data.packs.length,recipes:data.packs.reduce((n,p)=>n+p.recipes.length,0),places:data.packs.length});
