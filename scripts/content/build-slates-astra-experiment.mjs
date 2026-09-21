import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
// Independent authoring: only the original v2 raster supplies map pixels.
const root=process.cwd(), out=path.join(root,'verify-shots/slates-astra-experiment');
await fs.mkdir(out,{recursive:true});
const original='public/assets/slates/slates-v2-32px.png';
const sourceData='data:image/png;base64,'+(await fs.readFile(path.join(root,original))).toString('base64');
const recipes=[], cache=new Map(), lower=Array(2500).fill(57),upper=Array(2500).fill(-1);
const blocked=Array(2500).fill(false),buildings=[],landmarks=[],zones=[];
const full=id=>({version:'v2',source:[id%56*32,Math.floor(id/56)*32,32,32],destination:[0,0],sourceTile:id});
function tile(parts,pass=true,layer='lower',label='합성'){parts=parts.map(p=>typeof p==='number'?full(p):p);const key=JSON.stringify([parts,pass,layer]);if(cache.has(key))return cache.get(key);const id=1232+recipes.length;recipes.push({id,label,passable:pass,layer,operations:parts});cache.set(key,id);return id;}
function put(x,y,id,pass=true,layer='lower'){if(x<0||y<0||x>=50||y>=50)throw Error('bounds');const i=y*50+x;(layer==='upper'?upper:lower)[i]=id;if(layer==='lower')blocked[i]=!pass;else if(!pass)blocked[i]=true;}
function ground(x,y,id=69){put(x,y,id,true);}
function rect(x,y,w,h,id=69){for(let j=0;j<h;j++)for(let i=0;i<w;i++)ground(x+i,y+j,id);}
function obj(x,y,id,pass=false){put(x,y,tile([id],pass,'upper','원본 소품 '+id),pass,'upper');}
function solid(x,y,id,base=69,label='건축 부재'){put(x,y,tile([base,id],false,'lower',label),false);}
function patch(x,y,w,h,base){for(let j=0;j<h;j++)for(let i=0;i<w;i++){let sx=i===0?0:i===w-1?2:1,sy=j===0?0:j===h-1?2:1;put(x+i,y+j,tile([lower[(y+j)*50+x+i],base+sy*56+sx],true,'lower','직사각 지형 경계'),true);}}
function mark(name,x,y){landmarks.push({name,x,y});}
// Paving follows blocks and courts. Narrow alleys link courts without a giant cross.
rect(6,7,38,35,61);
for(const r of [[7,16,14,3],[19,7,3,32],[7,28,13,3],[7,39,35,3],[21,18,13,5],[29,20,4,21],[33,28,10,3],[35,7,3,24],[23,32,8,10],[24,40,4,10]])rect(...r);
zones.push({name:'서쪽 공방·주거',rect:[7,7,13,32],reason:'두 줄의 작은 필지와 가로 골목, 문 앞 한 칸 확보'},{name:'우물 광장',rect:[21,18,13,5],reason:'남문에서 꺾인 주도로와 회관 접근의 결절'},{name:'동쪽 뜰·여관',rect:[33,7,10,32],reason:'정원과 여관 앞 빈 공간을 상점가보다 넓게 확보'},{name:'남문 장터',rect:[20,31,12,10],reason:'입성 직후 좌우 가판대와 넓은 대기 공간'});
// Wall cross-section: rear parapet / solid deck / front crenels / vertical face / foot.
function hwall(x,y,w){for(let i=0;i<w;i++){solid(x+i,y,601,351,'뒤 흉벽');solid(x+i,y+1,351,351,'폐쇄된 성벽 보행면');solid(x+i,y+2,769,351,'앞 흉벽');solid(x+i,y+3,i%4===1?96:208,69,'성벽 전면');solid(x+i,y+4,264,57,'성벽 기단');}}
hwall(3,2,44);hwall(3,42,21);hwall(28,42,19);
for(let y=5;y<44;y++)for(const x of [3,44]){solid(x,y,656,351,'서측 경계');solid(x+1,y,351,351,'측면 성벽 보행면');solid(x+2,y,659,351,'동측 경계');}
// Narrow original cylindrical tower is not stretched sideways; land foot uses 483.
function tower(x,y,h=7){for(let j=0;j<h;j++)solid(x,y+j,j===0?33:j===h-1?483:j===1?369:j===2?425:201,57,'원통 탑');}
for(const [x,y,h] of [[3,0,8],[5,0,8],[44,0,8],[46,0,8],[3,39,8],[5,39,8],[44,39,8],[46,39,8],[23,39,8],[28,39,8]])tower(x,y,h);
mark('열린 남문',25,44);mark('남문 바깥',25,48);mark('우물 광장',27,21);mark('동쪽 정원 입구',37,19);
// Building choices are independent widths/depths, not copies of catalog stamps.
function house(name,x,y,w=4,depth=2,style=0){
 const roofRise=w/2;let r=y;
 for(let a=0;a<roofRise;a++){let start=x+roofRise-1-a,len=2+a*2;for(let k=0;k<len;k++)solid(start+k,r,k===0?150:k===len-1?151:k<len/2?36:39,61,'뒤 지붕 시작');r++;}
 for(let d=0;d<depth;d++,r++)for(let k=0;k<w;k++)solid(x+k,r,k<w/2?36:39,61,'깊은 지붕 반복 면');
 // Front-facing gable: ends occur once, timber infill is independent of roof depth.
 for(let k=0;k<w;k++)solid(x+k,r,k===0?204:k===w-1?205:k===w/2-1?150:k===w/2?151:k<w/2?196:199,61,'앞 박공');r++;
 for(let k=0;k<w;k++)solid(x+k,r,k===0?316:k===w-1?319:k===w/2-1?644:k===w/2?647:420+(k%3),61,'박공 아래 골조');r++;
 for(let k=0;k<w;k++)solid(x+k,r,(style%2?648:700)+(k===0?0:k===w-1?3:1+(k%2)),61,'상층 창');r++;
 if(style!==2){for(let k=0;k<w;k++)solid(x+k,r,k===0?872:k===w-1?875:873,61,'돌출층 아래 받침');r++;}
 const doorX=x+Math.floor(w/2),doorY=r;
 for(let k=0;k<w;k++)solid(x+k,r,k===0?588:k===w-1?591:589,61,'1층 벽 받침');
 put(doorX,r,tile([589,1060],false,'lower','닫힌 문과 벽 받침'),false);
 for(let k=0;k<w;k++)if(k!==Math.floor(w/2))obj(x+k,r,style%2?924+(k===0?0:k===w-1?3:1):644+(k===0?0:k===w-1?3:1));
 // Border row is walkable low doorstep, not an inaccessible elevated terrace.
 r++;for(let k=0;k<w;k++)put(x+k,r,tile([69,k===0?716:k===w-1?719:717],true,'lower','기단 앞 낮은 문턱'),true);
 rect(doorX,r+1,1,1,69);mark(name+' 문 앞',doorX,r+1);
 // Right shadow is an original alpha mask, composited onto the existing floor.
 for(let sy=y+roofRise;sy<r;sy++)if(upper[sy*50+x+w]===-1&&!blocked[sy*50+x+w])put(x+w,sy,tile([lower[sy*50+x+w],624],true,'lower','동쪽 그림자'),true);
 buildings.push({name,x,y,width:w,height:r-y+1,roofDepth:depth,style,door:{x:doorX,y:doorY},approach:{x:doorX,y:r+1},reason:'지붕 깊이와 박공 폭을 분리하고 문 아래 벽·기단·접근 칸을 연결'});
 return {x,y,w,bottom:r,doorX,doorY};
}
const homes=[['서문 수선공',8,7,4,1,2],['청동 공방',14,7,4,2,1],['마을 회관',24,7,6,2,0],['북동 서고',38,7,4,1,2],['바늘 상점',8,20,4,1,1],['염색 상점',14,20,4,1,2],['여관 본동',34,22,6,2,1],['남서 주택',8,32,4,1,2],['빵집',14,32,4,1,2],['정원지기 집',36,34,4,0,2],['광장 약초방',24,24,4,0,2]];
for(const h of homes)house(...h);
// Attached, lower shop wing: one shared cornice, not interpenetrating complete houses.
function wing(name,x,y,w){for(let k=0;k<w;k++){solid(x+k,y,k===0?150:k===w-1?151:37,61,'옆동 낮은 지붕 시작');solid(x+k,y+1,k===0?36:k===w-1?39:37,61,'옆동 지붕');solid(x+k,y+2,708+k%4,61,'옆동 처마');solid(x+k,y+3,648+k%4,61,'옆동 꽃 창');solid(x+k,y+4,589,61,'옆동 벽');}
put(x+1,y+4,tile([589,1060],false,'lower','옆동 문'),false);rect(x,y+5,w,1);mark(name+' 문 앞',x+1,y+5);buildings.push({name,x,y,width:w,height:5,door:{x:x+1,y:y+4},approach:{x:x+1,y:y+5},reason:'회관에 닿는 낮은 별동, 독립 지붕을 겹치지 않고 수평 접합'});}
wing('회관 기록실',30,12,3);
// Small landscaped courts with original nine-slice grass boundary, distinct from road.
patch(36,17,7,4,0);patch(7,17,10,2,0);patch(7,30,10,2,0);
function tree(x,y,pine=false){for(let j=0;j<3;j++)for(let i=0;i<2;i++)obj(x+i,y+j,(18+j)*56+(pine?8:12)+i,j<2);}
tree(40,17);tree(7,0,true);tree(16,0,true);tree(36,0);tree(48,12,true);tree(0,22,true);tree(0,33);tree(47,31,true);
for(const [x,y] of [[37,18],[39,19],[42,19],[8,18],[10,18],[16,18],[8,30],[10,30],[15,30]])obj(x,y,629+(x%3),true);
obj(38,20,1118);obj(26,20,978);obj(23,21,1118);obj(30,20,1118);
// Market canopies above stalls, leaving a three-cell through-route.
for(const [x,y,blue]of [[21,33,false],[28,33,true],[21,37,true],[30,37,false]]){obj(x,y,blue?388:380);obj(x+1,y,blue?389:381);obj(x,y+1,108+(x%4));obj(x+1,y+1,109);mark('가판대 '+x+','+y,x,y+2);}
for(const [x,y]of [[7,23],[18,24],[41,29],[18,35],[33,35]])obj(x,y,1004);
// House fronts remain decorative: no false INN/SHOP functional promise or events.
// Deterministic reachability uses actual authored two-layer passability.
const spawn={x:25,y:48};const visited=new Set([spawn.y*50+spawn.x]),queue=[spawn.y*50+spawn.x];
for(let q=0;q<queue.length;q++){const i=queue[q],x=i%50,y=Math.floor(i/50);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy,j=b*50+a;if(a>=0&&a<50&&b>=0&&b<50&&!blocked[j]&&!visited.has(j)){visited.add(j);queue.push(j);}}}
const access=landmarks.map(p=>({...p,reachable:visited.has(p.y*50+p.x)}));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const rendered=await page.evaluate(async({sourceData,recipes,lower,upper})=>{
const img=new Image();img.src=sourceData;await img.decode();const count=1232+recipes.length,atlas=document.createElement('canvas');atlas.width=1792;atlas.height=Math.ceil(count/56)*32;const a=atlas.getContext('2d');a.imageSmoothingEnabled=false;a.drawImage(img,0,0);
for(const r of recipes)for(const op of r.operations)a.drawImage(img,...op.source,r.id%56*32+op.destination[0],Math.floor(r.id/56)*32+op.destination[1],op.source[2],op.source[3]);
const map=document.createElement('canvas');map.width=map.height=1600;const m=map.getContext('2d');m.imageSmoothingEnabled=false;for(const layer of [lower,upper])for(let i=0;i<2500;i++){const t=layer[i];if(t>=0)m.drawImage(atlas,t%56*32,Math.floor(t/56)*32,32,32,i%50*32,Math.floor(i/50)*32,32,32);}
return{atlas:atlas.toDataURL(),map:map.toDataURL(),height:atlas.height};},{sourceData,recipes,lower,upper});
await browser.close();
const count=1232+recipes.length,passability=[],priority=[],tileMeta=[];
for(let i=0;i<count;i++){const r=recipes[i-1232],pass=r?r.passable:[57,61,65,69,351].includes(i);passability.push({up:pass,down:pass,left:pass,right:pass});priority.push(r?.layer??'lower');tileMeta.push({label:r?.label??'Slates v2 원본 '+i,description:r?'원본 합성 출처 recipes.json; '+(pass?'통행 가능':'통행 불가'):'Ivan Voirol CC BY 4.0; source rect '+JSON.stringify(full(i).source),source:'ai',origin:'ai'});}
const bundle={map:{id:'slates_astra_walled_50',name:'느티관문 — 우물길 성곽마을',width:50,height:50,tileSize:32,tilesetId:'slates_astra_32',lowerTiles:lower,upperTiles:upper,events:[],bgm:{mode:'none'},encounters:[]},tileset:{id:'slates_astra_32',kind:'custom',name:'Slates Astra',count,tileSize:32,tilesPerRow:56,image:{type:'uploaded',id:'slates_astra_atlas'},terrain:Array(count).fill(0),priority,passability,tileMeta,tileGroups:[],structureKits:[]},asset:{id:'slates_astra_atlas',name:'Slates Astra — Ivan Voirol CC BY 4.0',kind:'tileset',dataUrl:rendered.atlas,meta:{tileSize:32,width:1792,height:rendered.height}},spawn,landmarks};
// Submission integrity and spatial audit; this is not a repository test/gate run.
const passAt=i=>[lower[i],upper[i]].filter(t=>t>=0).every(t=>Object.values(passability[t]).every(Boolean));
for(let i=0;i<2500;i++){if(passAt(i)===blocked[i])throw Error('collision metadata mismatch '+i);for(const t of [lower[i],upper[i]])if(!Number.isInteger(t)||t < -1||t>=count)throw Error('invalid tile '+t);}
if(access.some(p=>!p.reachable))throw Error('unreachable landmark');
// Seal only the doorway for an audit: the remaining fortifications must enclose the town.
const sealed=new Set([spawn.y*50+spawn.x]),sq=[spawn.y*50+spawn.x];
for(let q=0;q<sq.length;q++){const i=sq[q],x=i%50,y=Math.floor(i/50);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy,j=b*50+a;if(a>=0&&a<50&&b>=0&&b<50&&passAt(j)&&!(b===44&&a>=24&&a<=27)&&!sealed.has(j)){sealed.add(j);sq.push(j);}}}
if(sealed.has(21*50+27))throw Error('wall perimeter leaks');
const audit={mapSize:[50,50],imageSize:[1600,1600],tileCount:count,derivedTileCount:recipes.length,layerLengths:[lower.length,upper.length],allIdsInRange:true,passabilityMatchesPlacement:true,landmarks:access.length,reachableLandmarks:access.filter(p=>p.reachable).length,reachableCells:visited.size,blockedCells:blocked.filter(Boolean).length,wallEnclosureWhenGateSealed:!sealed.has(21*50+27),renderOrder:['all lower','all upper'],engineValidated:false,remotePersistencePerformed:false};
await fs.writeFile(path.join(out,'authoring-audit.json'),JSON.stringify(audit,null,2));
await fs.writeFile(path.join(out,'bundle.json'),JSON.stringify(bundle));
await fs.writeFile(path.join(out,'map.png'),Buffer.from(rendered.map.split(',')[1],'base64'));
await fs.writeFile(path.join(out,'atlas.png'),Buffer.from(rendered.atlas.split(',')[1],'base64'));
await fs.writeFile(path.join(out,'recipes.json'),JSON.stringify({source:{version:'v2',path:original,width:1792,height:704,columns:56,license:'CC BY 4.0',author:'Ivan Voirol',sourceUrl:'https://opengameart.org/content/slates-32x32px-orthogonal-tileset-by-ivan-voirol',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',modifications:'Bundled original title strip removed upstream; this experiment composites original 32px rectangles without rotation, scaling, recoloring or new raster art.'},originalTiles:{first:0,count:1232,sourceRectangle:'[id%56*32, floor(id/56)*32, 32, 32]'},derivedTiles:recipes},null,2));
await fs.writeFile(path.join(out,'layout.json'),JSON.stringify({name:bundle.map.name,width:50,height:50,zones,buildings,gates:[{name:'열린 쌍탑 남문',rect:[24,42,4,5],state:'always-open',reason:'hold 격자문 대신 원본 탑 사이 지상 통로. 위쪽 연결 아치와 다층 보행을 만들지 않음'}],spawn,landmarks:access,collision:{reachableCells:visited.size,blockedCells:blocked.filter(Boolean).length,unreachableLandmarks:access.filter(p=>!p.reachable),method:'원본 지면 및 파생 ID의 통행을 저작하며 lower/upper 차단 합집합의 4방향 flood fill. 실제 엔진 검증은 감독자 담당.'}},null,2));
console.log(JSON.stringify({count,buildings:buildings.length,reachable:visited.size,unreachable:access.filter(p=>!p.reachable)},null,2));

const readDocs=['docs/experiments/slates-astra/README.md','docs/experiments/slates-astra/input-manifest.json','openwiki/slates-agent-entry.md','openwiki/slates-structure-learning.md','openwiki/slates-structure-samples.md','openwiki/slates-atlas-review.md','openwiki/slates-village-authoring.md','public/assets/ATTRIBUTION.md',original];
const imageNames=['region-roof','region-battlement','region-towers','region-timber','projecting-house','projecting-house-parts','roof-deep','roof-deep-parts','wall-long','wall-parts','parapet-corner','parapet-corner-parts','region-castle-face','region-balcony','region-court-border','region-paving','region-small-props','region-single-trees','region-red-awning','region-blue-awning','gate','gate-parts','joined-shops','inn'];
const inputs=[...readDocs,...imageNames.map(n=>'openwiki/images/slates/mastery/'+n+'.png')];
const manifest=JSON.parse(await fs.readFile('docs/experiments/slates-astra/input-manifest.json','utf8'));
const inputAudit=[];
for(const p of inputs){const bytes=await fs.readFile(p),hash=createHash('sha256').update(bytes).digest('hex'),expected=manifest.files.find(f=>f.path===p);if(expected&&expected.sha256!==hash)throw Error('input hash mismatch '+p);inputAudit.push({path:p,sha256:hash,manifestMatch:expected?true:null,scope:p.includes('ATTRIBUTION')?'Slates section only visually read':p.includes('structure-samples')?'text through line 440; selected comparison PNGs only':'read'});}
await fs.writeFile(path.join(out,'read-inputs.json'),JSON.stringify({note:'Tile knowledge inputs actually opened; generated own outputs subsequently reviewed. Node/Playwright are execution dependencies, not tile knowledge.',files:inputAudit},null,2));
