import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
const rejected=process.argv.includes('--rejected-v1');
const OUT='verify-shots/slates-astra-v3'+(rejected?'/rejected-layout':''); fs.mkdirSync(OUT,{recursive:true});
const V2='public/assets/slates/slates-v2-32px.png';
const MODULES='docs/experiments/slates-astra-v2/modules.json';
const modules=JSON.parse(fs.readFileSync(MODULES)).modules;
const sources=new Map();
function source(p){if(!sources.has(p))sources.set(p,PNG.sync.read(fs.readFileSync(p)));return sources.get(p);}
const blank=(w,h)=>new PNG({width:w,height:h});
function blit(dst,src,[sx,sy,w,h],[dx,dy]){for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const tx=x+dx,ty=y+dy;if(tx<0||ty<0||tx>=dst.width||ty>=dst.height)continue;
 const si=((sy+y)*src.width+sx+x)*4,di=(ty*dst.width+tx)*4,a=src.data[si+3]/255,b=dst.data[di+3]/255,oa=a+b*(1-a);if(!oa)continue;
 for(let c=0;c<3;c++)dst.data[di+c]=Math.round((src.data[si+c]*a+dst.data[di+c]*b*(1-a))/oa);dst.data[di+3]=Math.round(oa*255);
}}
const save=(name,png)=>fs.writeFileSync(`${OUT}/${name}`,PNG.sync.write(png));
const json=(name,data)=>fs.writeFileSync(`${OUT}/${name}`,JSON.stringify(data,null,2)+'\n');
const ground=blank(1600,1600),upper=blank(1600,1600),density=blank(1600,1600);
const blocked=new Uint8Array(2500),architecturalCells=new Uint8Array(2500),operations=[],buildings=[],landmarks=[],blocks=[];
const footprintOwner=new Map(),footprintOverlaps=[];
const interiorRect=[3,4,44,42];
const exceptions=[{name:'우물 앞 쉼터',kind:'court',rect:[12,26,4,4]},{name:'동쪽 약초 정원',kind:'garden',rect:[41,18,5,5]}];
const contains=(r,x,y)=>x>=r[0]&&y>=r[1]&&x<r[0]+r[2]&&y<r[1]+r[3];
function op(o,building=false){const target=['object','overhead'].includes(o.layer)?upper:ground;blit(target,source(o.source),o.sourceRect,o.destination);operations.push({...o,drawOrder:operations.length});if(building&& !['floor','shadow'].includes(o.layer))blit(density,source(o.source),o.sourceRect,o.destination);}
function rect(id,x,y,w=1,h=1,layer='floor',part='ground'){for(let j=0;j<h;j++)for(let i=0;i<w;i++)op({source:V2,sourceVersion:'v2',sourceRect:[id%56*32,Math.floor(id/56)*32,32,32],destination:[(x+i)*32,(y+j)*32],layer,part});}
function mark(r,value=1){for(let y=r[1];y<r[1]+r[3];y++)for(let x=r[0];x<r[0]+r[2];x++)if(x>=0&&y>=0&&x<50&&y<50)blocked[y*50+x]=value;}
for(let y=0;y<50;y++)for(let x=0;x<50;x++)rect(contains(interiorRect,x,y)?16:57,x,y);
// Authored two-cell dogleg: west two cells at y14, east three at y27, return at south gate.
const mainCells=[];
for(let y=4;y<50;y++){
 let xs=rejected?[24,25]: y<=15?[24,25]:y<=17?[22,23,24,25]:y<=26?[22,23]:y<=28?[22,23,24,25,26]:y<=41?[25,26]:[24,25];
 for(const x of xs){rect(69,x,y);mainCells.push({x,y});}
}
for(const e of exceptions)rect(e.kind==='garden'?57:69,...e.rect);
function add(module,x,y,block){const m=modules.find(m=>m.id===module),offsetPx=[x*32-32,y*32-32],id=`b${String(buildings.length+1).padStart(2,'0')}`;
 const approaches=m.collision.approaches.map(([ax,ay])=>({x:x-1+ax,y:y-1+ay}));
 const footprint=m.collision.blockedRects.map(([a,b,w,h])=>[x-1+a,y-1+b,w,h]);
 buildings.push({id,module,offsetPx,block,footprint,approaches,doors:m.collision.doors.map(([a,b])=>({x:x-1+a,y:y-1+b})),review:m.review});
 const owned=new Set();for(const [a,b,w,h]of footprint)for(let j=0;j<h;j++)for(let i=0;i<w;i++)owned.add((b+j)*50+a+i);for(const k of owned){if(footprintOwner.has(k))footprintOverlaps.push({x:k%50,y:Math.floor(k/50),owners:[footprintOwner.get(k),id]});footprintOwner.set(k,id);}footprint.forEach(r=>mark(r)); approaches.forEach((p,i)=>landmarks.push({name:`${id} ${module} 문앞 ${i+1}`,...p}));
}
// Independently authored groups: body origins, not padded module rectangles.
const originalGroups=[
 ['북서 상인길',[['joined-shops',3,4],['courtyard-inn',11,4],['house',18,4],['house',21,4]]],
 ['북동 직물길',[['courtyard-inn',26,4],['joined-shops',33,4],['courtyard-inn',41,4]]],
 ['서쪽 여관골',[['courtyard-inn',3,11],['house',11,11],['house',14,11],['courtyard-inn',18,11]]],
 ['동쪽 장인골',[['courtyard-inn',26,11],['joined-shops',33,11],['low-workshop',41,12]]],
 ['서쪽 꽃창골',[['joined-shops',3,18],['courtyard-inn',11,18],['courtyard-inn',18,18]]],
 ['정원 북문골',[['house',26,18],['house',29,18],['joined-shops',33,18],['low-workshop',41,24]]],
 ['우물골',[['courtyard-inn',3,25],['low-workshop',11,30],['courtyard-inn',18,25]]],
 ['동쪽 처마골',[['courtyard-inn',26,25],['joined-shops',33,25],['courtyard-inn',41,29]]],
 ['서쪽 수공골',[['joined-shops',3,32],['house',11,35],['house',14,35],['courtyard-inn',18,32]]],
 ['동쪽 작은여관골',[['courtyard-inn',26,32],['joined-shops',33,32],['courtyard-inn',41,36]]],
 ['남서 관문골',[['courtyard-inn',3,39],['low-workshop',11,42],['courtyard-inn',18,39]]],
 ['남동 관문골',[['low-workshop',26,40],['joined-shops',33,39],['low-workshop',41,43]]],
];
const finalGroups=[
 ['북서 직물골',[['courtyard-inn',3,4],['joined-shops',9,4],['joined-shops',17,4],['joined-shops',3,11],['low-workshop',10,13],['low-workshop',17,10]]],
 ['북동 염색골',[['low-workshop',26,4],['house',31,4],['joined-shops',34,4],['courtyard-inn',41,4],['joined-shops',26,10],['low-workshop',29,17],['joined-shops',40,12],['courtyard-inn',34,13]]],
 ['서쪽 지붕골',[['courtyard-inn',3,18],['joined-shops',9,20],['joined-shops',15,15]]],
 ['동쪽 여관골',[['low-workshop',24,17],['joined-shops',24,22],['joined-shops',33,21]]],
 ['우물 굽잇길',[['courtyard-inn',16,22],['joined-shops',3,25],['house',9,31],['courtyard-inn',12,30]]],
 ['약초 정원길',[['courtyard-inn',41,23],['joined-shops',40,30]]],
 ['서쪽 수공골',[['joined-shops',18,29],['house',3,32],['courtyard-inn',9,38],['house',15,38]]],
 ['동쪽 시장골',[['low-workshop',33,28],['low-workshop',27,29],['courtyard-inn',27,34],['joined-shops',33,33],['low-workshop',33,40]]],
 ['남서 처마골',[['joined-shops',18,36],['low-workshop',3,40]]],
 ['남동 관문골',[['house',40,37],['house',44,38],['low-workshop',27,41]]],
];
const groups=rejected?originalGroups:finalGroups;
for(const [name,entries] of groups){const start=buildings.length;for(const [m,x,y]of entries)add(m,x,y,name);blocks.push({name,buildings:buildings.slice(start).map(b=>b.id),design:'independent staggered anchors; mixed depths along connected alleys; no fixed rows'});}
// Local contact correction only: roof begins below the rear shop foundation.
// Half-cell art offset, explicitly authored ground footprint and south approach.
if(!rejected){const b=buildings.find(b=>b.module==='low-workshop'&&b.offsetPx[0]===512&&b.offsetPx[1]===288);
 if(!b)throw Error('Contact correction target missing');b.offsetPx[1]+=16;b.contactCorrection={reason:'separate 285 original foundation/roof pixels',dyPx:16,roofOverhang:'upper star above independently blocked footprint'};
 b.footprint=b.footprint.map(([x,y,w,h])=>[x,y+1,w,h]);b.approaches=b.approaches.map(p=>({...p,y:p.y+1}));
 for(const p of landmarks)if(p.name.startsWith(b.id+' '))p.y++;
 // Rebuild the authored footprint union and cross-building intersection evidence.
 blocked.fill(0);footprintOwner.clear();footprintOverlaps.length=0;
 for(const a of buildings){const own=new Set();for(const [x,y,w,h]of a.footprint)for(let j=0;j<h;j++)for(let i=0;i<w;i++)own.add((y+j)*50+x+i);
  for(const k of own){if(footprintOwner.has(k))footprintOverlaps.push({x:k%50,y:Math.floor(k/50),owners:[footprintOwner.get(k),a.id]});footprintOwner.set(k,a.id);blocked[k]=1;}
 }
}
const pixelOwners=new Uint16Array(1600*1600),pixelOverlapPairs=new Map();
for(let bi=0;bi<buildings.length;bi++){
 const b=buildings[bi],m=modules.find(m=>m.id===b.module),art=blank(m.widthPx,m.heightPx);
 for(const o of m.operations)if(['foundation','object','overhead'].includes(o.layer))blit(art,source(o.source),o.sourceRect,o.destination);
 for(let y=0;y<art.height;y++)for(let x=0;x<art.width;x++){
  if(!art.data[(y*art.width+x)*4+3])continue;const X=x+b.offsetPx[0],Y=y+b.offsetPx[1];if(X<0||Y<0||X>=1600||Y>=1600)throw Error('Building outside map');
  const k=Y*1600+X,prior=pixelOwners[k];if(prior){const key=buildings[prior-1].id+':'+b.id;pixelOverlapPairs.set(key,(pixelOverlapPairs.get(key)??0)+1);}pixelOwners[k]=bi+1;
 }
}
// Render all module operations in original order, omit comparison floors.
for(const b of [...buildings].sort((a,b)=>a.offsetPx[1]-b.offsetPx[1])){const m=modules.find(m=>m.id===b.module);for(const o of m.operations.filter(o=>o.layer!=='floor').sort((a,b)=>a.drawOrder-b.drawOrder))op({...o,destination:[o.destination[0]+b.offsetPx[0],o.destination[1]+b.offsetPx[1]],owner:b.id,module:b.module,moduleDrawOrder:o.drawOrder},true);}
// Fortification: original directional 16px sections, no rotation or scaling.
const wall=modules.find(m=>m.id==='wall-corner');
for(const y of [1,46])for(let x=1;x<49;x++)for(const o of wall.operations.filter(o=>o.layer!=='floor'&&o.destination[0]>=128&&o.destination[0]<160&&o.destination[1]>=128&&o.destination[1]<224)){
 if(y===46&&x>=20&&x<30)continue;op({...o,destination:[x*32+o.destination[0]-128,y*32+o.destination[1]-128],owner:'horizontal-wall'});
}
for(const x of [1,47])for(let y=4;y<46;y++){
 rect(69,x,y,2,1,'wall-top','vertical-wall-walk');
 for(let d=0;d<32;d+=16){op({source:V2,sourceRect:[1280,336,16,16],destination:[x*32+(!rejected&&x===47?0:-8),y*32+d],layer:'object',part:'west-parapet',owner:'side-wall'});op({source:V2,sourceRect:[1376,352,16,16],destination:[x*32+48,y*32+d],layer:'object',part:'east-parapet',owner:'side-wall'});}
}
mark([1,1,48,3]);mark([1,46,48,3]);mark([1,4,2,42]);mark([47,4,2,42]);
// Full original towers shifted one cell north of wall wings: land feet remain inside 50x50.
if(!rejected){rect(69,20,46,4,2,'wall-top','gate-wing-backing');rect(69,26,46,4,2,'wall-top','gate-wing-backing');}
const gate=modules.find(m=>m.id==='open-gate');
for(const o of gate.operations.filter(o=>o.layer!=='floor')){
 const tower=o.part.startsWith('tower-'),over=o.layer==='overhead',shadow=o.layer==='shadow';
 const oy=tower||over||shadow?43:44;
 op({...o,destination:[20*32+o.destination[0],oy*32+o.destination[1]],owner:'south-gate',adaptation:'tower and arch one cell north of wall wings; unchanged source parts'});
}
mark([23,44,1,6]);mark([26,44,1,6]);mark([24,44,2,6],0);
const gates=[{name:'남문',passageCells:Array.from({length:6},(_,i)=>[24,25].map(x=>({x,y:44+i}))).flat(),inside:{x:24,y:44},outside:{x:24,y:49}}];
// Small purposeful spaces; no trees used as density filler.
rect(922,13,27,1,1,'object','well');mark([13,27,1,1]);
rect(1118,12,29,1,1,'object','court-bench');mark([12,29,1,1]);
for(const [x,y,id]of [[41,18,629],[44,18,630],[41,21,631],[44,21,629]])rect(id,x,y,1,1,'object','garden-flower');
// One tree confined to the declared garden, canopy star / trunk explicitly blocked.
for(let y=0;y<3;y++)for(let x=0;x<2;x++)rect((18+y)*56+12+x,42+x,18+y,1,1,'object',y===2?'tree-trunk':'tree-canopy');mark([42,20,2,1]);
landmarks.push({name:'우물 앞 쉼터',x:14,y:28},{name:'약초 정원',x:44,y:22},{name:'남문 안',...gates[0].inside},{name:'남문 밖',...gates[0].outside});
const spawn={x:24,y:44};
// Door visibility: audit original door-cell rectangles against later foreign upper pixels.
const doorOcclusionChecks=[];
for(let bi=0;bi<buildings.length;bi++){
 const b=buildings[bi],m=modules.find(m=>m.id===b.module),lastOwn=Math.max(...operations.filter(o=>o.owner===b.id).map(o=>o.drawOrder));
 b.doorRectsPx=m.collision.doors.map(([x,y],i)=>{const panel=m.id==='courtyard-inn'&&i===1?m.operations.find(o=>o.part==='inn-side-entrance'):null;return panel?[panel.destination[0]+b.offsetPx[0],panel.destination[1]+b.offsetPx[1],32,32]:[x*32+b.offsetPx[0],y*32+b.offsetPx[1],32,32];});
 for(const [doorIndex,r]of b.doorRectsPx.entries()){
  const covered=new Set(),foreignParts=new Set();
  const panel=m.id==='courtyard-inn'&&doorIndex===1?m.operations.find(o=>o.part==='inn-side-entrance'):null;
  const panelAlpha=(x,y)=>!panel||source(panel.source).data[((panel.sourceRect[1]+y-r[1])*source(panel.source).width+panel.sourceRect[0]+x-r[0])*4+3]>0;
  for(const o of operations){if(o.owner===b.id||o.drawOrder<=lastOwn||!['object','overhead'].includes(o.layer))continue;
   const [ox,oy]=o.destination,[sx,sy,w,h]=o.sourceRect,X=Math.max(ox,r[0]),Y=Math.max(oy,r[1]),R=Math.min(ox+w,r[0]+32),B=Math.min(oy+h,r[1]+32);if(X>=R||Y>=B)continue;
   const src=source(o.source);for(let y=Y;y<B;y++)for(let x=X;x<R;x++)if(panelAlpha(x,y)&&pixelOwners[y*1600+x]===bi+1&&src.data[((sy+y-oy)*src.width+sx+x-ox)*4+3]){covered.add(y*1600+x);foreignParts.add(o.owner??o.part);}
  }
  doorOcclusionChecks.push({building:b.id,door:doorIndex+1,rectPx:r,method:panel?'exact original door-panel alpha':'conservative authored door-cell rectangle',foreignCoverPixels:covered.size,foreignParts:[...foreignParts]});
 }
}
// Metrics: pixel alpha union, excluding shadows, terrain, wall and garden.
let alphaPixels=0,nonzeroPixels=0;const cellAlpha=new Float64Array(2500);
for(let y=128;y<1472;y++)for(let x=96;x<1504;x++){const a=density.data[(y*1600+x)*4+3]/255;alphaPixels+=a;if(a)nonzeroPixels++;cellAlpha[Math.floor(y/32)*50+Math.floor(x/32)]+=a;}
for(let i=0;i<2500;i++)if(cellAlpha[i]>0)architecturalCells[i]=1;
function flood(extra=new Set()){const seen=new Set(),queue=[spawn.y*50+spawn.x];if(blocked[queue[0]])return seen;seen.add(queue[0]);for(let h=0;h<queue.length;h++){const i=queue[h],x=i%50,y=Math.floor(i/50);for(const [a,b]of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){const j=b*50+a;if(a<0||a>=50||b<0||b>=50||blocked[j]||extra.has(j)||seen.has(j))continue;seen.add(j);queue.push(j);}}return seen;}
const reachable=flood(),sealed=flood(new Set(gates.flatMap(g=>g.passageCells.filter(p=>p.y===46).map(p=>p.y*50+p.x))));
function emptyRectangles(mask){let largest={area:0,rect:null},squares=[];for(let y=4;y<46;y++)for(let x=3;x<47;x++){
 if(mask[y*50+x])continue;let maxW=47-x;for(let h=1;y+h<=46;h++){let w=0;while(w<maxW&&!mask[(y+h-1)*50+x+w])w++;maxW=w;if(!w)break;if(w*h>largest.area)largest={area:w*h,rect:[x,y,w,h]};}
 if(x<=42&&y<=41){let empty=true;for(let dy=0;dy<5;dy++)for(let dx=0;dx<5;dx++)if(mask[(y+dy)*50+x+dx])empty=false;if(empty)squares.push({rect:[x,y,5,5],exception:exceptions.find(e=>contains(e.rect,x,y)&&contains(e.rect,x+4,y+4))?.name??null});}
}return{largest,empty5x5:squares};}
const foregroundCells=new Uint8Array(2500);for(let y=4;y<46;y++)for(let x=3;x<47;x++){let any=architecturalCells[y*50+x];for(let dy=0;dy<32&&!any;dy++)for(let dx=0;dx<32;dx++)if(upper.data[((y*32+dy)*1600+x*32+dx)*4+3]){any=1;break;}foregroundCells[y*50+x]=any;}
const counts={};for(const b of buildings)counts[b.module]=(counts[b.module]??0)+1;
const runs=[];for(const y of [...new Set(buildings.map(b=>b.offsetPx[1]))]){let prev=null,run=[];for(const b of buildings.filter(b=>b.offsetPx[1]===y).sort((a,b)=>a.offsetPx[0]-b.offsetPx[0])){if(b.module!==prev){if(run.length>=3)runs.push(run);run=[];}run.push(b.id);prev=b.module;}if(run.length>=3)runs.push(run);}
const doorChecks=landmarks.map(p=>({...p,blocked:Boolean(blocked[p.y*50+p.x]),reachable:reachable.has(p.y*50+p.x)}));
const metrics={doorOcclusionChecks,buildingPixelOverlaps:Object.fromEntries(pixelOverlapPairs),footprintOverlaps,interiorRect,denominatorPixels:44*42*1024,alphaUnionPixels:alphaPixels,alphaUnionPercent:alphaPixels/(44*42*1024)*100,nonzeroUnionPixels:nonzeroPixels,method:'source alpha-over union of building foundation/object only; exclude floor, shadow, wall, props, tree, padding',buildingCount:buildings.length,moduleCounts:counts,buildingEmpty:emptyRectangles(architecturalCells),visibleEmpty:emptyRectangles(foregroundCells),walkableEmpty:emptyRectangles(blocked),doorChecks,sealedWallLeaks:[...sealed].filter(i=>i%50===0||i%50===49||i<50||i>=2450).length,sameHeightTripleRuns:runs,frontHeightCounts:Object.fromEntries([...new Set(buildings.map(b=>b.offsetPx[1]/32+1))].sort((a,b)=>a-b).map(y=>[y,buildings.filter(b=>b.offsetPx[1]/32+1===y).length])),engineQA:'Supervisor responsibility; author mask checks only'};
json('metrics.json',metrics);
const full=blank(1600,1600);blit(full,ground,[0,0,1600,1600],[0,0]);blit(full,upper,[0,0,1600,1600],[0,0]);save('map.png',full);save('density.png',density);
const crops=[[3,13,17,15],[23,15,17,15],[30,31,17,15]];for(let i=0;i<crops.length;i++){const [x,y,w,h]=crops[i],img=blank(w*32,h*32);blit(img,full,[x*32,y*32,w*32,h*32],[0,0]);save(`crop-${i+1}.png`,img);}
// Focused native-pixel evidence for the two final contact corrections.
for(const [name,r]of [['contact-final.png',[16,8,8,6]],['east-door-north.png',[44,6,5,4]],['east-door-garden.png',[44,25,5,4]]]){const img=blank(r[2]*32,r[3]*32);blit(img,full,r.map(v=>v*32),[0,0]);save(name,img);}
// Compile two editable tile layers, retaining all 1232 original atlas slots.
const original=source(V2),tilePixels=[],priority=[],passability=[],tileMeta=[],dedupe=new Map(),tileRecipes=[];
function pack(img,px,py,layer,pass,meta){const tile=blank(32,32);blit(tile,img,[px,py,32,32],[0,0]);const key=createHash('sha256').update(tile.data).update(layer+String(pass)).digest('hex');if(dedupe.has(key))return dedupe.get(key);const id=tilePixels.length;tilePixels.push(tile);priority.push(layer);passability.push({up:pass,down:pass,left:pass,right:pass});tileMeta.push(meta);dedupe.set(key,id);return id;}
for(let i=0;i<1232;i++){const tile=blank(32,32);blit(tile,original,[i%56*32,Math.floor(i/56)*32,32,32],[0,0]);tilePixels.push(tile);priority.push('lower');passability.push({up:true,down:true,left:true,right:true});tileMeta.push({source:V2,sourceId:i,unusedOriginalSlot:true});}
const lowerTiles=[],upperTiles=[];
for(let y=0;y<50;y++)for(let x=0;x<50;x++){
 const i=y*50+x,lo=pack(ground,x*32,y*32,'lower',!blocked[i],{kind:'source-composite',layer:'lower'});lowerTiles.push(lo);let any=false;for(let dy=0;dy<32&&!any;dy++)for(let dx=0;dx<32;dx++)if(upper.data[((y*32+dy)*1600+x*32+dx)*4+3]){any=true;break;}
 const up=any?pack(upper,x*32,y*32,'upper',!blocked[i],{kind:'source-composite',layer:'upper',passPolicy:blocked[i]?'X':'star; preserves lower'}):-1;upperTiles.push(up);tileRecipes.push({x,y,lower:lo,upper:up,blocked:Boolean(blocked[i])});
}
const count=tilePixels.length,atlas=blank(1792,Math.ceil(count/56)*32);for(let i=0;i<count;i++)blit(atlas,tilePixels[i],[0,0,32,32],[i%56*32,Math.floor(i/56)*32]);// Preserve hidden RGB as well as visible RGBA in all original slots.
original.data.copy(atlas.data,0,0,original.data.length);save('atlas.png',atlas);
const bundle={map:{id:'slates_astra_v3_walled_50',name:'처마맞댄 은실성',width:50,height:50,tileSize:32,tilesetId:'slates_astra_v3_32',lowerTiles,upperTiles,events:[],bgm:{mode:'none'},encounters:[]},tileset:{id:'slates_astra_v3_32',kind:'custom',name:'은실성 Slates 32px',count,tileSize:32,tilesPerRow:56,image:{type:'uploaded',id:'slates_astra_v3_atlas'},terrain:Array(count).fill(0),priority,passability,tileMeta,tileGroups:[],structureKits:[]},asset:{id:'slates_astra_v3_atlas',name:'Ivan Voirol CC BY4.0 Slates — original source rectangle composites',kind:'tileset',dataUrl:'data:image/png;base64,'+PNG.sync.write(atlas).toString('base64'),meta:{tileSize:32,width:1792,height:atlas.height}},spawn,landmarks};
json('bundle.json',bundle);json('layout.json',{interiorRect,buildings,gates,exceptions,blocks,paths:{main:{width:2,cells:mainCells,turns:[[22,16,4,2],[22,27,5,2],[24,42,3,2]]}},landmarks,spawn,crops});json('map-operations.json',{inputs:[MODULES,...sources.keys()],attribution:'Ivan Voirol CC BY 4.0',operations,tilePacking:tileRecipes});
console.log(JSON.stringify({density:metrics.alphaUnionPercent,overlaps:footprintOverlaps,pixelOverlaps:Object.fromEntries(pixelOverlapPairs),visibleEmpty5:metrics.visibleEmpty.empty5x5,buildings:buildings.length,empty5:metrics.walkableEmpty.empty5x5,failedDoors:doorChecks.filter(p=>!p.reachable),leaks:metrics.sealedWallLeaks,triples:runs,count},null,2));

const reconstructed=blank(1600,1600);for(let i=0;i<2500;i++)for(const id of [lowerTiles[i],upperTiles[i]])if(id>=0)blit(reconstructed,atlas,[id%56*32,Math.floor(id/56)*32,32,32],[i%50*32,Math.floor(i/50)*32]);
let renderByteDifferences=0,originalByteDifferences=0;for(let i=0;i<full.data.length;i++)if(full.data[i]!==reconstructed.data[i])renderByteDifferences++;
for(let y=0;y<704;y++)for(let x=0;x<1792*4;x++)if(original.data[y*1792*4+x]!==atlas.data[y*1792*4+x])originalByteDifferences++;
const validation={mapDimensions:[50,50],imageDimensions:[1600,1600],cropDimensions:[544,480],tileCount:count,originalSlots:1232,appendedSlots:count-1232,atlasDimensions:[atlas.width,atlas.height],renderByteDifferences,originalByteDifferences,metadataLengths:[bundle.tileset.terrain.length,priority.length,passability.length,tileMeta.length],allTileIdsValid:lowerTiles.every(i=>i>=0&&i<count)&&upperTiles.every(i=>i>=-1&&i<count),doorCount:doorOcclusionChecks.length,coveredDoors:doorOcclusionChecks.filter(d=>d.foreignCoverPixels),allLandmarksReachable:doorChecks.every(d=>d.reachable&&!d.blocked),supervisorRuntimeStart:gates[0].outside,authoredSpawn:spawn,scope:'author geometry and bundle consistency only; no engine, DB, gates or test suite'};
json('author-validation.json',validation);
if(!rejected&&(metrics.alphaUnionPercent<50||metrics.alphaUnionPercent>65||footprintOverlaps.length||pixelOverlapPairs.size||metrics.visibleEmpty.empty5x5.some(r=>!r.exception)||metrics.walkableEmpty.empty5x5.some(r=>!r.exception)||!validation.allLandmarksReachable||validation.coveredDoors.length||metrics.sealedWallLeaks||runs.length||renderByteDifferences||originalByteDifferences||!validation.allTileIdsValid))throw Error('Author acceptance criteria failed: inspect metrics.json / author-validation.json');
