// Slates 50x50 village. Only original atlas rectangles are drawn; no screenshot pixels.
// Read openwiki/slates-village-authoring.md before changing recipes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const dir='verify-shots/slates-village-50';await mkdir(dir,{recursive:true});
const project=JSON.parse(await readFile('output/slates-village-50/source-project.json','utf8'));
if(project.spatialAuthoring)throw Error('Canonical spatial projects require their publication API');
const W=50,H=50,N=W*H,at=(x,y)=>y*W+x,inside=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
const cells=Array.from({length:N},()=>({lower:[57],upper:[],pass:true,upperPass:true}));
const roads=new Set(),reserved=new Set(),landmarks=[],buildings=[],trees=[];
const cell=(x,y)=>cells[at(x,y)];
function lower(x,y,ids,pass=true){if(!inside(x,y))throw Error('bounds');Object.assign(cell(x,y),{lower:ids,pass});}
function upper(x,y,ids,pass=false){if(!inside(x,y))throw Error('bounds');Object.assign(cell(x,y),{upper:ids,upperPass:pass});}
function patch(x,y,w,h,id){for(let j=0;j<h;j++)for(let i=0;i<w;i++)lower(x+i,y+j,[id]);}
function roadRect(x,y,w,h){for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(inside(x+i,y+j))roads.add(at(x+i,y+j));}
function lane(points,width=2){for(let k=1;k<points.length;k++){let[x,y]=points[k-1];const[tx,ty]=points[k];if(x!==tx&&y!==ty)throw Error('Axis aligned lanes only');while(true){roadRect(x,y,width,width);if(x===tx&&y===ty)break;x+=Math.sign(tx-x);y+=Math.sign(ty-y);}}}
function parcel(name,x,y,w,wallRows=2,style=0){
 const roofH=w/2+1,h=roofH+wallRows;const front={x:x+Math.floor(w/2)-1,y:y+h};
 const b={name,x,y,w,h,wallRows,style,front};buildings.push(b);landmarks.push({name,...front});
 for(let j=-1;j<=h;j++)for(let i=-1;i<=w;i++)if(inside(x+i,y+j))reserved.add(at(x+i,y+j));
 roadRect(x-1,y+h-1,w+2,3);return b;
}
parcel('서쪽 목수의 집',5,6,4,2,0);
parcel('북쪽 꽃집',13,4,4,3,1);
parcel('광장 북쪽 주택',21,6,4,2,1);
parcel('물버들 여관',29,3,6,3,2);
parcel('동쪽 약초점',40,7,4,2,1);
parcel('서쪽 주택',4,18,4,2,0);
parcel('빵집',11,24,4,2,1);
parcel('마을 회관',30,15,6,3,3);
parcel('동쪽 작업장',42,21,4,2,0);
parcel('강변 주택',25,27,4,2,0);
parcel('물레방앗간',34,27,4,3,1);
parcel('남쪽 농가',5,41,4,2,0);
parcel('강남 농산물 상점',41,40,4,2,2);
// Roads bend between distinct neighborhoods; two bridges form a loop.
roadRect(19,20,10,7);
lane([[0,14],[17,14],[17,21],[22,21]]);
lane([[17,14],[26,14],[26,11],[38,11],[38,17],[40,17],[40,29],[36,29],[36,43],[49,43]]);
lane([[7,25],[8,25],[8,32],[14,32],[14,43],[24,43],[24,46],[39,46],[39,43]]);
lane([[14,32],[21,32],[21,27],[23,27]]);
lane([[28,25],[31,25],[31,30],[36,30]]);
// Connect each front to existing lanes with BFS avoiding building footprints.
const backbone=new Set(roads);
// Exclude each parcel's own forecourt when looking for the street network.
for(const b of buildings)for(let y=b.y+b.h-1;y<=b.y+b.h+1;y++)for(let x=b.x-1;x<=b.x+b.w;x++)backbone.delete(at(x,y));
const footprints=new Set();for(const b of buildings)for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)footprints.add(at(x,y));
for(const b of buildings){
 const start=at(b.front.x,b.front.y+1),queue=[start],prev=new Map([[start,null]]);let end;
 for(let q=0;q<queue.length;q++){const n=queue[q],x=n%W,y=n/W|0;if(q>1&&backbone.has(n)&&Math.abs(x-b.front.x)+Math.abs(y-b.front.y)>3){end=n;break;}
  for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=at(nx,ny);if(!inside(nx,ny)||prev.has(k)||footprints.has(k)||(ny>=34&&ny<=38&&nx!==14&&nx!==15&&nx!==36&&nx!==37))continue;prev.set(k,n);queue.push(k);}
 }
 if(end===undefined)throw Error('No approach '+b.name);for(let n=end;n!==null;n=prev.get(n))roads.add(n);
}
// Road boundary selects original 3x3 edge pieces; interior intersections keep center.
for(const n of roads){const x=n%W,y=n/W|0;const l=roads.has(n-1)&&x>0,r=roads.has(n+1)&&x<49,t=roads.has(n-W),b=roads.has(n+W);const sx=!l&&r?0:!r&&l?2:1,sy=!t&&b?0:!b&&t?2:1;lower(x,y,[57,4+sx+sy*56]);}
// Plaza paving with deliberate border and a small planted central court.
for(let y=20;y<27;y++)for(let x=19;x<29;x++)lower(x,y,[12+(x===19?0:x===28?2:1)+56*(y===20?0:y===26?2:1)]);
// South brook, shore and two solid bridges. Water behind board pixels is explicit.
for(let y=34;y<=38;y++)for(let x=0;x<W;x++)lower(x,y,[243,y===34?353:y===38?241:243],false);
for(const x of [14,15,36,37])for(let y=34;y<=38;y++)lower(x,y,[243,...[0,16].map(dx=>({tile:y===34?23:y===38?135:79,rect:[8,0,16,32],dest:[dx,0]}))],true);
landmarks.push({name:'서쪽 다리 북안',x:14,y:33},{name:'서쪽 다리 남안',x:14,y:39},{name:'동쪽 다리 북안',x:36,y:33},{name:'동쪽 다리 남안',x:36,y:39},{name:'서쪽 출구',x:0,y:14},{name:'동쪽 출구',x:49,y:43});
// Houses: symmetric 45-degree roof, gable, wall rows and a backed door.
for(const b of buildings){
 const {x,y,w,h,wallRows,style}=b,roofH=h-wallRows;
 for(let j=0;j<roofH-1;j++){const span=2*(j+1),left=(w-span)/2;for(let k=0;k<span;k++){
  const id=k===0?150:k===span-1?151:k<span/2?36:39;upper(x+left+k,y+j,[id]);
 }}
 const gableY=y+roofH-1;for(let k=0;k<w;k++)upper(x+k,gableY,[k===0?204:k===w-1?205:k<w/2?196:199]);
 for(let j=0;j<wallRows;j++)for(let k=0;k<w;k++){
  const col=k===0?0:k===w-1?3:1+(k%2);let id=(j===wallRows-1?588:j===0?(style===1?648:style===2?700:644):196)+col;
  upper(x+k,y+roofH+j,[id]);
 }
 const doorX=x+Math.floor(w/2)-1;upper(doorX,y+h-1,[589,1060]);
 if(w>=4)upper(x+w-1,y+h-1,[647]);
 if(style===2)upper(x+w-1,y+h-2,[647,b.name.includes('여관')?940:942]);
 if(style===0||style===2){const cx=x+w/2-1,cy=y+Math.max(1,roofH-3);upper(cx,cy,[541]);}
 if(style===3){upper(x,y+h-2,[644,604]);upper(x+w-1,y+h-2,[647,606]);}
 if(style===1)upper(x,y+h-1,[644,167]);
 // Two trees never get placed in this yard/footprint.
}
// Market: complete counters and their goods, approachable from the plaza.
for(const [x,y,id]of[[19,17,108],[20,17,109],[23,17,110],[24,17,111],[18,19,108]]){
 lower(x,y,[69]);upper(x,y,[id]);reserved.add(at(x,y));
}
landmarks.push({name:'시장 앞',x:21,y:18},{name:'우물 옆',x:24,y:23});
roadRect(18,18,8,2); // append access as stone courtyard
patch(18,18,8,2,69);
upper(23,23,[978]); // source (26,17): water-filled well, single tile
for(const [x,y]of[[20,25],[26,25],[32,12]])upper(x,y,[1118]);
for(const [x,y,id]of[[18,17,1004],[25,17,1006],[41,27,1004],[44,27,1006],[7,46,1004],[43,46,1006]])upper(x,y,[id]);
// Two orchard plots, farm beds, and kitchen gardens.
const beds=[];
for(const [x,y,w,h]of[[18,41,4,2],[25,41,5,2],[31,42,3,2]]){
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){lower(x+i,y+j,[65]);upper(x+i,y+j,[629+(i+j)%3],true);reserved.add(at(x+i,y+j));}beds.push({x,y,w,h});
}
// Waterwheel is an original 2x3 fixed pose; source rectangle recorded, no animation claim.
for(let j=0;j<3;j++)for(let i=0;i<2;i++){upper(38+i,32+j,[(10+j)*56+48+i]);reserved.add(at(38+i,32+j));}
landmarks.push({name:'방앗간 물가',x:37,y:33});
// Trees: canopies above the character, blocking trunk only; whole sprite avoids yards/roads.
let seed=32050;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
function tree(x,y,pine=false,force=false){
 if(x<0||y<0||x+1>=W||y+2>=H)return false;
 for(let j=0;j<3;j++)for(let i=0;i<2;i++){const n=at(x+i,y+j);if(cell(x+i,y+j).upper.length||!cell(x+i,y+j).pass||roads.has(n)||reserved.has(n))return false;}
 const sx=pine?8:12;for(let j=0;j<3;j++)for(let i=0;i<2;i++)upper(x+i,y+j,[(18+j)*56+sx+i],j<2);trees.push({x,y,pine});return true;
}
// Frame the settlement with grouped woods; keep the east/west gates open.
for(let y=0;y<50;y+=3)for(let x=0;x<49;x+=2){const boundary=x<3||x>45||y<2||y>46;if(boundary&&rand()>.12)tree(x,y,rand()<.5);}
for(let y=2;y<33;y+=3)for(let x=2;x<47;x+=2){if(rand()<.23)tree(x,y,rand()<.3);}
for(const [x,y]of[[19,29],[21,29],[3,28],[5,29],[2,40],[10,40],[10,45],[18,45],[21,46],[26,46],[29,46],[31,46],[39,39],[46,40]])tree(x,y,false);
for(let i=0;i<180;i++){const x=2+(rand()*46|0),y=2+(rand()*46|0),c=cell(x,y),n=at(x,y);if(c.pass&&!c.upper.length&&!roads.has(n)&&!reserved.has(n)&&c.lower[0]===57)upper(x,y,[rand()<.8?629+(rand()*3|0):1022],true);}
// Reusable tile recipes. Collision belongs to each recipe, never inferred from alpha.
const recipes=[],byKey=new Map();const ts=structuredClone(project.tilesets.slates_32);
ts.id='slates_village_32';ts.name='Slates 32px · 물버들 마을';ts.image={type:'uploaded',id:'slates_village_atlas'};
ts.structureKits=[]; // Keep the original learned catalog and groups on source indices.
ts.passability=Array.from({length:1232},()=>({up:true,down:true,left:true,right:true}));ts.priority=Array(1232).fill('lower');
function tile(ids,layer,pass){if(!ids.length)return -1;const key=JSON.stringify([ids,layer,pass]);if(byKey.has(key))return byKey.get(key);const id=1232+recipes.length;byKey.set(key,id);recipes.push({id,sourceIds:ids,layer,passable:pass});ts.passability[id]={up:pass,down:pass,left:pass,right:pass};ts.priority[id]=layer;ts.tileMeta[id]={label:`${layer==='lower'?'바닥':'덧그림'} ${ids.map(v=>typeof v==='number'?v:v.tile+'[부분]').join('+')}`,description:'Slates v2 원본을 순서대로 합성. 마을 조립용.',source:'ai',origin:'ai',confidence:'high',defaultLayer:layer};return id;}
const map={id:'slates_village_50',name:'물버들 마을 · 50×50',width:W,height:H,tileSize:32,tilesetId:ts.id,lowerTiles:[],upperTiles:[],events:[],bgm:{mode:'none'},encounters:[]};
for(const c of cells){map.lowerTiles.push(tile(c.lower,'lower',c.pass));map.upperTiles.push(tile(c.upper,'upper',c.upperPass));}
ts.count=1232+recipes.length;ts.terrain=Array(ts.count).fill(0);
for(const b of buildings)ts.structureKits.push({id:'slates-village-'+b.x+'-'+b.y,kind:'section',name:b.name,width:b.w,height:b.h,rows:Array.from({length:b.h},(_,j)=>({tiles:map.lowerTiles.slice(at(b.x,b.y+j),at(b.x,b.y+j)+b.w),upperTiles:map.upperTiles.slice(at(b.x,b.y+j),at(b.x,b.y+j)+b.w)})),learnedFrom:'db-authored',ai:{description:'물버들 마을에서 검토한 완성 집. 문은 장식.',role:'building',repeatability:'fixed',layerHome:'perCell',origin:'ai',confidence:'medium'}});
const source='data:image/png;base64,'+(await readFile('public/assets/slates/slates-v2-32px.png')).toString('base64');
const browser=await chromium.launch();let rendered;
try{const page=await browser.newPage();rendered=await page.evaluate(async({source,recipes,cells,count})=>{
 const im=new Image();im.src=source;await im.decode();const atlas=document.createElement('canvas');atlas.width=1792;atlas.height=Math.ceil(count/56)*32;const a=atlas.getContext('2d');a.drawImage(im,0,0);
 const draw=(ctx,item,x,y)=>{const id=typeof item==='number'?item:item.tile;const [sx,sy,w,h]=item.rect??[0,0,32,32],[dx,dy]=item.dest??[0,0];ctx.drawImage(im,id%56*32+sx,(id/56|0)*32+sy,w,h,x+dx,y+dy,w,h);};
 for(const r of recipes)for(const id of r.sourceIds)draw(a,id,r.id%56*32,(r.id/56|0)*32);
 const map=document.createElement('canvas');map.width=map.height=1600;const c=map.getContext('2d');for(let n=0;n<2500;n++)for(const id of [...cells[n].lower,...cells[n].upper])draw(c,id,n%50*32,(n/50|0)*32);
 return{atlas:atlas.toDataURL(),map:map.toDataURL(),height:atlas.height};},{source,recipes,cells,count:ts.count});}finally{await browser.close();}
project.assets.uploaded.slates_village_atlas={id:'slates_village_atlas',name:'Slates v2 · 물버들 원본 조립',kind:'tileset',dataUrl:rendered.atlas,meta:{tileSize:32,width:1792,height:rendered.height}};
project.tilesets[ts.id]=ts;project.maps[map.id]=map;
if(!project.mapTree.children.some(n=>n.mapId===map.id))project.mapTree.children.push({mapId:map.id,children:[]});
project.startMapId=map.id;project.startPos={x:22,y:24};project.meta.title='Slates · 물버들 마을과 조합 도감';
// Content connectivity audit, followed separately by engine collision observation in the editor.
const pass=n=>cells[n].pass&&(!cells[n].upper.length||cells[n].upperPass);
const visited=new Set([at(22,24)]),queue=[at(22,24)];for(let q=0;q<queue.length;q++){const n=queue[q],x=n%50,y=n/50|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=at(nx,ny);if(inside(nx,ny)&&pass(k)&&!visited.has(k)){visited.add(k);queue.push(k);}}}
const audit=landmarks.map(l=>({...l,passable:pass(at(l.x,l.y)),reachable:visited.has(at(l.x,l.y))}));
await writeFile(`${dir}/project.json`,JSON.stringify(project));
await writeFile(`${dir}/layout.json`,JSON.stringify({mapId:map.id,width:W,height:H,spawn:project.startPos,buildings,beds,trees:trees.length,landmarks:audit,reachableCells:visited.size,derivedTiles:recipes.length},null,2));
await writeFile('public/assets/slates/slates-village-32px.png',Buffer.from(rendered.atlas.split(',')[1],'base64'));
await writeFile('public/assets/slates/slates-village-recipes.json',JSON.stringify({source:'slates-v2-32px.png',tileSize:32,columns:56,firstDerivedId:1232,recipes},null,2));
await writeFile(`${dir}/draft.png`,Buffer.from(rendered.map.split(',')[1],'base64'));
console.log({houses:buildings.length,trees:trees.length,derivedTiles:recipes.length,reachable:visited.size,unreachable:audit.filter(l=>!l.reachable)});
if(audit.some(l=>!l.reachable))throw Error('Landmark access must be fixed before saving');
