import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const out='verify-shots/slates-astra-v2';
const inputs=[];
async function read(p){inputs.push(p);return JSON.parse(await fs.readFile(p,'utf8'));}
const cat=await read('public/assets/slates/slates-mastery-catalog.json');
const fine=await read('public/assets/slates/slates-mastery-fine-recipes.json');
const exercises=await read('public/assets/slates/slates-assembly-exercises.json');
const sources=fine.sources;
const images=await Promise.all(sources.map(async p=>{inputs.push(p);return 'data:image/png;base64,'+(await fs.readFile(p)).toString('base64');}));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
await page.evaluate(async urls=>{window.atlases=await Promise.all(urls.map(url=>new Promise(r=>{let i=new Image();i.onload=()=>r(i);i.src=url;})));},images);
const modules=[];
const card=id=>cat.cards.find(c=>c.id===id);
function mod(id,w,h){const m={id,widthPx:w,heightPx:h,operations:[],anchors:{unit:'px'},fixedParts:[],repeatBands:[],joins:[],review:{status:'partial',selfAssessment:true}};modules.push(m);return m;}
function op(m,source,rect,dest,part,layer='object',extra={}){m.operations.push({source:sources[source],sourceVersion:source===0?'v2':'v1',sourceRect:rect,destination:dest,layer,part,drawOrder:m.operations.length,...extra});}
function tile(m,id,x,y,part,layer='object',r=[0,0,32,32]){op(m,0,[id%56*32+r[0],Math.floor(id/56)*32+r[1],r[2],r[3]],[x,y],part,layer);}
function recipe(m,r,x,y,part,layer='object'){let[s,sx,sy,size=16,dx=0,dy=0]=fine.rects[r];op(m,s,[sx,sy,size,size],[x+dx,y+dy],part,layer,{recipeIndex:r});}
function cell(m,id,cx,cy,x,y,part,keep=()=>true){for(const r of card(id).patches[cy][cx])if(keep(r,fine.rects[r]))recipe(m,r,x,y,part);}
function structural(r,a){const [s,x,y]=a; if(s!==0)return false;const col=Math.floor(x/32),row=Math.floor(y/32);return (((col>=28&&col<=31&&row!==1&&row<20)||(col>=36&&col<=39&&row<20)||(col>=32&&col<=35&&row>=11)))|| [268,269,270,324,325,380,381,382,383,494,498].includes(row*56+col)|| (col>=40&&col<=43&&row<=9)||(col===52&&row>=18&&row<=19);}
function floor(m){for(let y=0;y<m.heightPx;y+=32)for(let x=0;x<m.widthPx;x+=32)tile(m,69,x,y,'independent-paving','floor');}
function shadow(m,x,y,w,h){for(let yy=0;yy<h;yy+=16)for(let xx=0;xx<w;xx+=16)tile(m,568,x+xx,y+yy,'cast-shadow','shadow',[0,0,Math.min(16,w-xx),Math.min(16,h-yy)]);}
function base(m,x,y,w){tile(m,716,x,y,'foundation-left','foundation',[16,0,16,16]);for(let xx=16;xx<w-16;xx+=16)tile(m,717,x+xx,y,'foundation-middle','foundation',[0,0,16,16]);tile(m,718,x+w-16,y,'foundation-right','foundation',[0,0,16,16]);}
// Decode and check the three independent representations for every mandated card.
const decode=[];
for(const id of ['projecting-house','joined-shops','wall','parapet-corner','tower','gate','inn']){
 const c=card(id),e=exercises.examples.find(e=>e.id===id);let n=0;
 c.patches.forEach((row,y)=>row.forEach((rs,x)=>rs.forEach((r,i)=>{const [s,sx,sy,z=16,dx=0,dy=0]=fine.rects[r];const actual=e.operations[n++];if(JSON.stringify(actual.sourceRect)!==JSON.stringify([sx,sy,z,z])||actual.destination[0]!==x*16+dx||actual.destination[1]!==y*16+dy||actual.source!==sources[s])throw Error(`decode mismatch ${id}`);})));decode.push({id,review:c.review,patchRows:c.patches.length,sourceParts:c.sourceParts,operations:n});
}
await fs.writeFile(`${out}/catalog-decoding.json`,JSON.stringify(decode,null,2));
const house=mod('house',192,256);floor(house);shadow(house,48,96,112,128);
// Re-author foreground, excluding all neighboring ground and buildings.
for(let y=0;y<=10;y++)for(let x=0;x<6;x++){
 if(y===0){if(x===0)continue;if(x===1)continue;if(x===2){for(const r of [10937,10808,10938,10939])recipe(house,r,32+x*16,32,'ridge-8px');continue;}}
 cell(house,'projecting-house',x,y,32+x*16,32+y*16,y<7?'roof-gable':'timber-support',structural);
}
base(house,32,208,96);
house.anchors={unit:'px',doorBottom:[80,208],approach:[80,240],leftEave:[32,144],rightEave:[128,144],foundationY:208};
house.fixedParts=['roof silhouette 96×112, no widening','projecting central gable and support','foundation ends'];
house.joins=[{direction:'south',anchor:[80,208],matches:'32px paved approach cell (2,7)',heightTreatment:'low stone threshold'}];
house.collision={cellSize:32,blockedRects:[[1,1,3,6]],approaches:[[2,7]],doors:[[2,6]],policy:'Closed door stays blocked; approach is south adjacent cell.'};
const shops=mod('joined-shops',288,288);floor(shops);shadow(shops,48,80,224,160);
// Shared bay at source x=6..7 explains the 32px floor-height offset.
for(let y=1;y<=10;y++)for(let x=0;x<12;x++){
 if(y>=9&&x<6)continue;
 if(y===1&&(x===6||x===7))continue;
 cell(shops,'joined-shops',x,y,48+x*16,48+y*16,y<=6?'joined-roofs-and-brace':'shop-front',structural);
}
// Cap the truncated reference roof with an authored rear ridge and a left return.
for(let x=64;x<144;x+=16)tile(shops,709,x,48,'rear-roof-cap','object',[0,16,16,16]);
tile(shops,764,32,48,'closed-left-roof-slope');
tile(shops,149,144,24,'shared-spire-apex','object',[0,0,32,24]);
tile(shops,34,144,48,'shared-spire-cap');
for(let y=80;y<128;y+=16)tile(shops,767,32,y,'left-roof-return','object',[0,0,16,16]);
for(let y=128;y<192;y+=16)tile(shops,644,40,y,'left-timber-end','object',[0,0,8,16]);
base(shops,32,192,112);base(shops,144,224,96);
// A real second entrance: replace only one ground-floor bay, preserving eaves/windows above.
tile(shops,589,176,192,'second-entry-wall');tile(shops,1060,176,192,'second-entry-door');
shops.anchors={unit:'px',doorBottom:[[96,192],[192,224]],approach:[[112,208],[208,240]],leftEave:[32,128],sharedBrace:[144,128],rightEave:[240,160],foundationY:[192,224]};
shops.fixedParts=['shared vertical brace x=144..176','separate foundations with 32px depth offset','capped left end'];
shops.joins=[{direction:'east',anchor:[144,128],matches:'right roof eave at y160',heightTreatment:'32px vertical X brace, front projecting beam'},{direction:'south',anchor:[144,192],matches:'deeper shop foundation y224',heightTreatment:'separate step and exposed side pier'}];
shops.collision={cellSize:32,blockedRects:[[1,1,4,5],[4,2,4,5]],approaches:[[3,6],[6,7]],doors:[[3,5],[6,6]],policy:'Both door fronts connect through the south apron; closed door cells blocked.'};
// Authored L-shaped wall, using direction-specific parapets, not a rotated horizontal strip.
const corner=mod('wall-corner',320,256);floor(corner);
// Vertical segment and horizontal run share a 48px-wide paved top.
for(let y=32;y<160;y+=16){recipe(corner,y%32?1374:1486,32,y,'wall-top-paving','wall-top');recipe(corner,y%32?1375:1487,48,y,'wall-top-paving','wall-top');recipe(corner,137,64,y,'wall-top-paving','wall-top');}
for(let x=32;x<288;x+=16)for(let y=128;y<192;y+=16)recipe(corner,137,x,y,'wall-top-paving','wall-top');
for(let y=32;y<160;y+=16)recipe(corner,2432,24,y,'west-parapet');
for(let y=32;y<128;y+=16)tile(corner,659,80,y,'east-parapet','object',[0,0,16,16]);
// rear boundary begins after the inside corner; front boundary across full run.
for(let x=96;x<288;x+=16)recipe(corner,2321,x,128,'rear-parapet');
for(let x=32;x<288;x+=16){recipe(corner,2881,x,176,'front-parapet');recipe(corner,x%32?978:979,x,192,'vertical-face');recipe(corner,x%32?978:979,x,208,'vertical-face');}
// The directional elbow tile closes the turn at the same plane.
tile(corner,824,16,160,'outer-elbow');tile(corner,938,80,112,'inner-elbow','object',[0,0,16,16]);
corner.anchors={unit:'px',northSection:[56,32],eastSection:[288,160],innerCorner:[88,128],frontFaceY:192};
corner.fixedParts=['directional west outer corner','inner elbow','front parapet / face height'];
corner.repeatBands=[{axis:'x',rangePx:[128,160],crossSectionPx:[128,224],extraCopies:2,beforeImage:'wall-corner-before.png',afterImage:'wall-corner-complete.png',limit:'middle horizontal section only; corners remain fixed'}];
corner.joins=[{direction:'east',anchor:[288,160],matches:'horizontal wall top y128..176; front y176; face y192..224',heightTreatment:'same elevation'},{direction:'north',anchor:[56,32],matches:'vertical wall top x32..80',heightTreatment:'native vertical parapet, no rotation'}];
corner.collision={cellSize:32,blockedRects:[[0,1,3,6],[3,4,6,3]],approaches:[],policy:'Entire elevated wall is ground-level blocked. No stairs or second elevation implied.'};
const gate=mod('open-gate',320,256);floor(gate);
// Two independently authored land towers, separated by a true 64px road.
for(const x of [96,192]){
 tile(gate,33,x,32,'tower-roof');tile(gate,369,x,64,'tower-window');tile(gate,201,x,96,'tower-shaft');tile(gate,201,x,128,'tower-shaft');tile(gate,201,x,160,'tower-lower-shaft');tile(gate,482,x,192,'tower-land-foot','object',[0,0,32,16]);
}
// Wing wall sections: paved top, distinct rear/front battlements, stone wall and land termination.
for(const [a,b] of [[0,96],[224,320]])for(let x=a;x<b;x+=16){recipe(gate,2321,x,64,'rear-parapet');recipe(gate,137,x,80,'wall-top','wall-top');recipe(gate,137,x,96,'wall-top','wall-top');recipe(gate,2881,x,112,'front-parapet');recipe(gate,x%32?978:979,x,128,'wing-face');recipe(gate,x%32?978:979,x,144,'wing-face');}
// Native arch springers and lintel cover only overhead space; no portcullis or opaque fill.
tile(gate,378,128,96,'arch-left','overhead',[16,0,16,32]);tile(gate,377,176,96,'arch-right','overhead',[0,0,16,32]);tile(gate,377,144,96,'arch-crown','overhead',[0,0,32,8]);
shadow(gate,128,112,64,64);
gate.anchors={unit:'px',northApproach:[160,48],southApproach:[160,240],passage:[128,96,64,128],landFeet:[[112,208],[208,208]],leftWallJoin:[0,128],rightWallJoin:[320,128]};
gate.fixedParts=['tower diameter 32px','64px open passage','native arch ends and land tower feet'];
gate.joins=[{direction:'west/east',anchor:[0,128],matches:'wing wall cross-section at x320',heightTreatment:'tower overlaps wall termination, passage at ground elevation'}];
gate.collision={cellSize:32,blockedRects:[[0,2,4,4],[6,2,4,4],[3,1,1,6],[6,1,1,6]],approaches:[[4,1],[5,1],[4,7],[5,7]],passageCells:[[4,3],[5,3],[4,4],[5,4],[4,5],[5,5],[4,6],[5,6]],policy:'Overhead arch passable; towers and wings blocked. No closed grate. No wall-top walking.'};
// Stage 2: author two more architectural silhouettes, and local contact shadows.
const inn=mod('courtyard-inn',288,256);floor(inn);
for(const o of house.operations.filter(o=>!['floor','shadow','foundation'].includes(o.layer))){op(inn,sources.indexOf(o.source),o.sourceRect,[o.destination[0],o.destination[1]],o.part,o.layer,{derivedFrom:'house-foreground',recipeIndex:o.recipeIndex});}
// The side wing is decoded from the inn catalog roof; only original roof v1 parts survive.
for(let y=1;y<=6;y++)for(let x=7;x<=12;x++)cell(inn,'inn',x,y,32+x*16-16,32+y*16,y<5?'inn-side-roof':'inn-side-upper-wall',(r,a)=>a[0]===1?(a[1]>=1024&&a[1]<1152&&a[2]<640):structural(r,a));
for(let x=128;x<224;x+=32)tile(inn,x===128?868:589,x,144,'inn-side-ground-wall');
tile(inn,1060,192,144,'inn-side-entrance');
for(let x=128;x<224;x+=16)tile(inn,x===128?708:x===208?710:709,x,40,'side-wing-rear-ridge','object',[x===208?16:0,24,16,8]);
base(inn,32,208,96);base(inn,128,176,96);
inn.anchors={unit:'px',doorBottom:[[80,208],[208,176]],approach:[[80,240],[208,208]],foundationY:[208,176],leftEave:[32,144],rightEave:[224,128]};
inn.fixedParts=['96px foreground gable','96px lower side wing','recessed side entry'];inn.joins=[{direction:'east',anchor:[128,112],matches:'lower side roof and upper wall',heightTreatment:'foreground gable hides side roof end, side foundation 32px back'}];
inn.collision={cellSize:32,blockedRects:[[1,1,3,6],[4,1,3,5]],approaches:[[2,7],[6,6]],doors:[[2,6],[6,5]],policy:'L-shaped ground footprint; two real graphical door fronts, no interior events.'};
inn.review={status:'partial',selfAssessment:true,observations:['v1 catalog wing roof and v2 foreground gable independently assembled'],remaining:['rear ridge added and directly viewed; side roof still has a shallow straight north termination, partial']};
const workshop=mod('low-workshop',224,192);floor(workshop);
for(let i=0;i<5;i++){tile(workshop,i===0?764:i===4?766:540,32+i*32,32,'hipped-roof-top');if(i===0||i===4){tile(workshop,540,32+i*32,64,'roof-end-plane');tile(workshop,767,32+i*32+(i===0?0:16),64,'roof-side-return','object',[i===0?0:16,0,16,32]);}else tile(workshop,i%2?542:540,32+i*32,64,'roof-window-plane');tile(workshop,i===0?644:i===4?647:645,32+i*32,96,'single-storey-front');}
tile(workshop,589,96,96,'door-backing');tile(workshop,1060,96,96,'workshop-door');base(workshop,32,128,160);
workshop.anchors={unit:'px',doorBottom:[112,128],approach:[112,176],foundationY:128,leftEave:[32,96],rightEave:[192,96]};workshop.fixedParts=['160px horizontal hipped roof','single floor','native 32px roof end pair'];workshop.joins=[{direction:'south',anchor:[112,128],matches:'paved front apron',heightTreatment:'low stone threshold'}];workshop.collision={cellSize:32,blockedRects:[[1,1,5,4]],approaches:[[3,5]],doors:[[3,3]],policy:'Low building footprint is independently blocked; door approach is south.'};workshop.review={status:'partial',selfAssessment:true,observations:['low 160px roof with one storey creates fourth house silhouette'],remaining:['rejected sawtooth center replaced with plain 540; no scaled ends; corrected PNG inspected, end texture seam remains a self-review limitation']};
// Remove broad study shadows. Use a single narrow band along the actual right/bottom contact.
for(const m of [house,shops,inn,workshop]){
 m.operations=m.operations.filter(o=>o.layer!=='shadow');
 const bands=m.id==='house'?[[124,144,8,72],[44,216,80,4]]:m.id==='joined-shops'?[[236,160,8,72],[44,200,88,4],[156,232,80,4]]:m.id==='courtyard-inn'?[[124,176,8,40],[220,128,8,56],[44,216,80,4],[140,184,80,4]]:[[188,96,8,48],[44,136,144,4]];
 for(const b of bands)shadow(m,...b);
}

// Layer contract and source-only canvas renderer.
const layerOrder=['floor','wall-top','shadow','foundation','object','overhead'];
for(const m of modules){m.operations.sort((a,b)=>layerOrder.indexOf(a.layer)-layerOrder.indexOf(b.layer)||a.drawOrder-b.drawOrder);m.operations.forEach((o,i)=>o.drawOrder=i);m.completeImage=`${m.id}-complete.png`;m.explodedImage=`${m.id}-parts.png`;m.silhouette={image:`${m.id}-silhouette.png`,maskImage:`${m.id}-mask.png`,definition:'alpha of object, foundation, overhead and wall-top; floor and cast-shadow excluded',unit:'px'};m.collision.image=`${m.id}-collision.png`;}
async function render(m,mode){return await page.evaluate(({m,mode,sources})=>{
 const cv=document.createElement('canvas');cv.width=m.widthPx;cv.height=m.heightPx;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
 const allowed=mode==='silhouette'||mode==='mask'?new Set(['object','foundation','overhead','wall-top']):null;
 for(const o of m.operations){if(allowed&&!allowed.has(o.layer))continue;const [sx,sy,w,h]=o.sourceRect;c.drawImage(window.atlases[sources.indexOf(o.source)],sx,sy,w,h,...o.destination,w,h);}
 if(mode==='mask'){c.globalCompositeOperation='source-in';c.fillStyle='#eec86b';c.fillRect(0,0,cv.width,cv.height);}
 if(mode==='collision'){for(let y=0;y<cv.height/32;y++)for(let x=0;x<cv.width/32;x++){const blocked=m.collision.blockedRects.some(([a,b,w,h])=>x>=a&&y>=b&&x<a+w&&y<b+h);c.fillStyle=blocked?'#ed475c70':'#30ee9960';c.fillRect(x*32,y*32,32,32);c.strokeStyle='#ffffff70';c.strokeRect(x*32+.5,y*32+.5,31,31);}c.font='10px monospace';c.fillStyle='white';for(const [x,y]of m.collision.approaches){c.fillText('A',x*32+12,y*32+18);}}
 if(mode==='parts'){c.strokeStyle='#70d9ed88';c.font='8px monospace';for(let y=0;y<cv.height;y+=16)for(let x=0;x<cv.width;x+=16){c.strokeRect(x+.5,y+.5,15,15);c.fillStyle='#ffffff';c.fillText(`${x/16},${y/16}`,x+1,y+8);}}
 const zoom=document.createElement('canvas');zoom.width=cv.width*3;zoom.height=cv.height*3;const z=zoom.getContext('2d');z.imageSmoothingEnabled=false;z.drawImage(cv,0,0,zoom.width,zoom.height);return zoom.toDataURL();
 },{m,mode,sources});}
for(const m of modules)for(const mode of ['complete','silhouette','mask','collision','parts']){const url=await render(m,mode);await fs.writeFile(`${out}/${m.id}-${mode}.png`,Buffer.from(url.split(',')[1],'base64'));}
// Freeze explicit cell metadata, independent of silhouette alpha.
for(const m of modules){
 const w=m.widthPx/32,h=m.heightPx/32;const blocked=(x,y)=>m.collision.blockedRects.some(([a,b,ww,hh])=>x>=a&&y>=b&&x<a+ww&&y<b+hh);
 m.collision.rows=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>blocked(x,y)?'#':'.').join(''));
 const start=m.collision.approaches[0]??[w-1,h-1],seen=new Set([start.join(',')]),q=[start];
 for(let i=0;i<q.length;i++){const[x,y]=q[i];for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy,k=[a,b].join(',');if(a>=0&&b>=0&&a<w&&b<h&&!blocked(a,b)&&!seen.has(k)){seen.add(k);q.push([a,b]);}}}
 m.collision.connectivity={start,approachesConnected:m.collision.approaches.every(p=>seen.has(p.join(','))),reachableCells:seen.size,passageConnected:(m.collision.passageCells??[]).every(p=>seen.has(p.join(','))),evidence:'local authored mask flood fill, not engine QA'};
 m.sourcePartsImage=`${m.id}-sources.png`;m.joinImage=`${m.id}-join.png`;
 m.silhouette.shadowImage=`${m.id}-shadow.png`;
 const defs=[];const keys=new Set();for(const o of m.operations.filter(o=>!['floor','shadow'].includes(o.layer))){const k=o.source+':'+o.sourceRect;if(!keys.has(k)){keys.add(k);defs.push(o);}}
 const sheet=await page.evaluate(({defs,sources})=>{const c=document.createElement('canvas');c.width=960;c.height=Math.ceil(defs.length/8)*112;const g=c.getContext('2d');g.fillStyle='#d4d6d6';g.fillRect(0,0,c.width,c.height);g.imageSmoothingEnabled=false;g.font='10px monospace';defs.forEach((o,i)=>{const x=i%8*120,y=Math.floor(i/8)*112,[sx,sy,w,h]=o.sourceRect;g.fillStyle='#182329';g.fillText(`op ${o.drawOrder} ${o.sourceVersion}`,x+3,y+12);g.fillText(`${sx},${sy} ${w}x${h}`,x+3,y+24);g.drawImage(window.atlases[sources.indexOf(o.source)],sx,sy,w,h,x+4,y+30,w*2,h*2);g.fillText(`to ${o.destination}`,x+3,y+106);});return c.toDataURL();},{defs,sources});
 await fs.writeFile(`${out}/${m.sourcePartsImage}`,Buffer.from(sheet.split(',')[1],'base64'));
 const shadowOnly={...m,operations:m.operations.filter(o=>o.layer==='shadow')};
 await fs.writeFile(`${out}/${m.silhouette.shadowImage}`,Buffer.from((await render(shadowOnly,'complete')).split(',')[1],'base64'));
 const crop=m.id==='house'?[24,104,112,128]:m.id==='joined-shops'?[120,80,128,160]:m.id==='wall-corner'?[8,104,128,128]:[88,88,144,128];
 const join=await page.evaluate(({m,crop,sources})=>{const cv=document.createElement('canvas');cv.width=crop[2]*4;cv.height=crop[3]*4;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;for(const o of m.operations){const[sx,sy,w,h]=o.sourceRect;c.drawImage(window.atlases[sources.indexOf(o.source)],sx,sy,w,h,(o.destination[0]-crop[0])*4,(o.destination[1]-crop[1])*4,w*4,h*4);}return cv.toDataURL();},{m,crop,sources});
 await fs.writeFile(`${out}/${m.joinImage}`,Buffer.from(join.split(',')[1],'base64'));
 m.operationCounts={total:m.operations.length,rect8:m.operations.filter(o=>o.sourceRect[2]===8&&o.sourceRect[3]===8).length,rect16:m.operations.filter(o=>o.sourceRect[2]===16&&o.sourceRect[3]===16).length};
}
// Concrete short-before / extended-after comparison of the same middle wall band.
const shortWall=structuredClone(corner);shortWall.widthPx-=64;shortWall.operations=shortWall.operations.filter(o=>o.destination[0]<(o.layer==='floor'?256:224));shortWall.collision.blockedRects[1][2]-=2;
await fs.writeFile(`${out}/wall-corner-before.png`,Buffer.from((await render(shortWall,'complete')).split(',')[1],'base64'));
house.review={status:'partial',selfAssessment:true,observations:['isolated roof and supported projecting floor','new stone threshold; removed foreign top pebble','source 8px ridge and right-side timber pieces retained'],remaining:['contact shadow narrowed to right/bottom bands; street PNG visually inspected','door remains graphical; no interior event']};
shops.review={status:'partial',selfAssessment:true,observations:['left truncated roof now has a sloped return and rear ridge','shared X brace connects 32px-different facade depths','second entrance reauthored on deeper front'],remaining:['spire cap phase corrected after second visual inspection; supervisor to inspect','left roof texture transition deserves joint review','no interior events']};
corner.review={status:'partial',selfAssessment:true,observations:['native vertical and horizontal parapets meet','48px top plane preserved around elbow','middle horizontal band extended by 64px'],remaining:['western vertical outer face is visually thinner than the front masonry; no general four-direction kit claim','north/east ends are connectors, not standalone sealed ends','wall top is not playable']};
gate.review={status:'partial',selfAssessment:true,observations:['land-only curved feet, no water reflection','64px paved passage, grille omitted','arch crop corrected to avoid painting on tower shafts'],remaining:['wide shallow arch is a conservative new construction, not restoration of held gate','engine actor occlusion not yet exercised']};
await fs.writeFile(`${out}/modules.json`,JSON.stringify({version:1,stage:'1-3',units:'native pixels; previews 3x',sourceOnly:true,attribution:'Ivan Voirol — CC BY 4.0; source-rectangle assembly',modules},null,2));
const sourceSheet=await page.evaluate(ids=>{const cv=document.createElement('canvas');cv.width=800;cv.height=Math.ceil(ids.length/8)*124;const c=cv.getContext('2d');c.fillStyle='#c1c6ce';c.fillRect(0,0,cv.width,cv.height);c.imageSmoothingEnabled=false;c.font='14px monospace';ids.forEach((id,i)=>{const x=i%8*100,y=Math.floor(i/8)*124;c.drawImage(window.atlases[0],id%56*32,Math.floor(id/56)*32,32,32,x,y+22,96,96);c.fillStyle='#000';c.fillText(String(id),x+4,y+16);});return cv.toDataURL();},[36,37,38,39,92,93,94,95,540,541,542,543,33,34,149,425,424,426,427,483,368,369,370,371,480,481,482,539,604,605,606,607,716,717,718,662,376,377,378,379,432,433,434,435,708,709,710,711,764,765,766,767,824,825,938,939,600,601,602,603]);
await fs.writeFile(`${out}/source-selection.png`,Buffer.from(sourceSheet.split(',')[1],'base64'));
const recipes=[];
for(const m of modules){const cells=new Map();for(const o of m.operations){const [sx,sy,w,h]=o.sourceRect,[dx,dy]=o.destination;for(let y=dy;y<dy+h;){const hh=Math.min(dy+h-y,32-y%32);for(let x=dx;x<dx+w;){const ww=Math.min(dx+w-x,32-x%32),cx=Math.floor(x/32),cy=Math.floor(y/32),layer=['object','overhead'].includes(o.layer)?'upper':'lower',k=[cx,cy,layer].join(',');if(!cells.has(k))cells.set(k,{cell:[cx,cy],layer,operations:[]});cells.get(k).operations.push({source:o.source,sourceRect:[sx+x-dx,sy+y-dy,ww,hh],destination:[x%32,y%32],drawOrder:o.drawOrder,part:o.part});x+=ww;}y+=hh;}}recipes.push({module:m.id,cells:[...cells.values()]});}
await fs.writeFile(`${out}/recipes.json`,JSON.stringify({cellSize:32,drawContract:'all lower cells, then all upper cells; no resampling/rotation',modules:recipes},null,2));
const overview=await page.evaluate(({modules,sources})=>{const cv=document.createElement('canvas');cv.width=1280;cv.height=2000;const g=cv.getContext('2d');g.fillStyle='#17252c';g.fillRect(0,0,cv.width,cv.height);g.imageSmoothingEnabled=false;g.font='22px sans-serif';modules.forEach((m,i)=>{const ox=i%2*640,oy=Math.floor(i/2)*660;g.fillStyle='#f0e8c8';g.fillText(m.id+' / SELF REVIEW: PARTIAL',ox+16,oy+32);for(const o of m.operations){const[sx,sy,w,h]=o.sourceRect;g.drawImage(window.atlases[sources.indexOf(o.source)],sx,sy,w,h,ox+o.destination[0]*2,oy+48+o.destination[1]*2,w*2,h*2);}});return cv.toDataURL();},{modules,sources});
await fs.writeFile(`${out}/stage1-overview.png`,Buffer.from(overview.split(',')[1],'base64'));

// Stage 4/5 scenes: no study-floor or study-padding is copied from a module.
const town={id:'slates_astra_v2_walled_50',widthPx:1600,heightPx:1600,operations:[]};
const blocked=new Set(),buildingInstances=[],landmarks=[],gardens=[],props=[];
const blockRect=(x,y,w,h)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(xx>=0&&yy>=0&&xx<50&&yy<50)blocked.add(`${xx},${yy}`);};
for(let y=0;y<50;y++)for(let x=0;x<50;x++)tile(town,x>=3&&x<47&&y>=4&&y<46?16:57,x*32,y*32,'destination-ground','floor');
const roadRects=[[24,42,2,8],[20,40,6,2],[20,30,2,11],[18,21,14,10],[24,4,2,8],[24,11,6,2],[28,12,2,9],[5,10,14,3],[13,12,2,7],[27,10,8,3],[35,12,11,2],[30,20,9,3],[37,21,2,10],[31,30,2,9],[32,36,14,3]];
for(const[x,y,w,h]of roadRects)for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)tile(town,69,xx*32,yy*32,'authored-street','floor');
function place(id,x,y,name){const m=modules.find(m=>m.id===id),dx=x*32-32,dy=y*32-32,instance={name,module:id,x,y,offsetPx:[dx,dy],reason:'Fixed silhouette; no scaling. Front setbacks and side courtyards differ.'};
 for(const o of m.operations.filter(o=>o.layer!=='floor'))op(town,sources.indexOf(o.source),o.sourceRect,[o.destination[0]+dx,o.destination[1]+dy],o.part,o.layer,{instance:name,recipeIndex:o.recipeIndex});
 for(const[a,b,w,h]of m.collision.blockedRects)blockRect(x+a-1,y+b-1,w,h);
 instance.doorApproaches=m.collision.approaches.map(([a,b],i)=>({name:`${name} 문 앞 ${i+1}`,x:x+a-1,y:y+b-1}));landmarks.push(...instance.doorApproaches);
 for(const p of instance.doorApproaches)tile(town,69,p.x*32,p.y*32,'door-landing','floor');
 buildingInstances.push(instance);return instance;}
const H='house',S='joined-shops',I='courtyard-inn',W='low-workshop';
const plan=[
 [I,5,4,'돌샘 길드 본동'],[I,12,4,'길드 서고와 객실'],[H,19,6,'서기의 집'],[W,4,13,'길드 제본 공방'],[H,10,12,'인장 장인의 집'],[H,15,14,'회랑지기 집'],
 [S,28,4,'북쪽 약초·직물점'],[S,35,6,'계단길 제과·양초점'],[H,43,5,'상인 조합장 집'],[W,26,13,'시장 도량형 공방'],[S,31,14,'꺾인길 유리·향신료점'],[S,39,16,'동쪽 가죽·약방'],[I,39,25,'동문길 여행 여관'],[H,34,24,'길 안내인의 집'],
 [H,4,22,'정원사 집'],[H,9,24,'화가의 집'],[I,4,33,'나무그늘 여관'],[H,12,36,'정원 관리인의 집'],[W,15,33,'정원 목공방'],
 [S,24,32,'남문 식량·지도점'],[W,33,32,'대장간 작업동'],[W,40,32,'수레 제작동'],[H,28,39,'석공의 집'],[H,33,39,'철공의 집'],[W,38,41,'남문 수리 공방'],[H,43,39,'문지기 집']
];
for(const p of plan)place(...p);
// Public spaces differ in shape, ground, furnishing and circulation.
const gardenRects=[[3,28,14,5],[3,33,9,12],[12,41,5,4]];
for(const[x,y,w,h]of gardenRects){gardens.push({name:'서남 나무그늘 정원',rect:[x,y,w,h]});for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)tile(town,57,xx*32,yy*32,'garden-continuous-grass','floor');}
for(const[x,y,w,h]of [[3,32,14,1],[10,32,1,13],[3,40,12,1]])for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)tile(town,69,xx*32,yy*32,'garden-walking-path','floor');
for(let y=36;y<39;y++)for(let x=33;x<46;x++)tile(town,65,x*32,y*32,'craft-court-earth','floor');
for(const[x,y,kind]of [[5,29,'leaf'],[12,29,'leaf'],[4,41,'leaf'],[8,41,'pine']]){op(town,0,[kind==='leaf'?384:256,576,64,96],[x*32,y*32],kind+'-tree','object');blockRect(x,y+2,2,1);props.push({kind:kind+'-tree',x,y,groundFootprint:[x,y+2,2,1]});}
for(const[x,y]of [[3,29],[10,29],[15,30],[7,43],[13,43],[15,42],[16,44]]){if(blocked.has(`${x},${y}`))continue;tile(town,574,x*32,y*32,'garden-flowers','object');props.push({kind:'flowers',x,y});}
for(const[x,y]of [[3,35],[3,38],[14,29],[16,31]]){tile(town,1022,x*32,y*32,'garden-shrub','object');blockRect(x,y,1,1);props.push({kind:'shrub',x,y});}
for(const[x,y]of [[19,22],[20,22],[21,22],[28,28],[29,28],[30,28]]){tile(town,108+(x%3),x*32,y*32,'market-counter','object');blockRect(x,y,1,1);props.push({kind:'market-counter',x,y});}
tile(town,922,24*32,24*32,'central-stone-well','object');blockRect(24,24,1,1);props.push({kind:'well',x:24,y:24});
for(const[x,y]of [[21,29],[30,23],[15,11],[11,41]]){tile(town,1118,x*32,y*32,'public-bench','object');blockRect(x,y,1,1);props.push({kind:'bench',x,y});}
for(const[x,y]of [[34,37],[40,37],[44,37]]){tile(town,1004,x*32,y*32,'craft-stock','object');blockRect(x,y,1,1);props.push({kind:'stock',x,y});}
for(const p of landmarks)tile(town,69,p.x*32,p.y*32,'door-landing-restored','floor');
landmarks.push({name:'돌샘 시장 광장 중심',x:24,y:26},{name:'광장 서쪽 접근',x:18,y:27},{name:'광장 북쪽 접근',x:27,y:21},{name:'길드 중정',x:16,y:11},{name:'북쪽 주거리 끝',x:24,y:4},{name:'정원 북쪽 산책로',x:9,y:32},{name:'정원 남쪽 산책로',x:10,y:43},{name:'공방 작업 중정',x:37,y:37},{name:'남문길 굽이',x:21,y:40});
// Consistent fortification section: rear at y, 32px deck, front at y+48, masonry y+64..96.
function horizontalWall(y,south){for(let x=32;x<1568;x+=16){if(south&&x>=640&&x<960)continue;
 for(let yy=y;yy<y+64;yy+=16)recipe(town,137,x,yy,'wall-deck','wall-top');
 recipe(town,2321,x,y,'wall-rear');recipe(town,2881,x,y+48,'wall-front');
 if(south||x>=96&&x<1504){recipe(town,x%32?978:979,x,y+64,'wall-face');recipe(town,x%32?978:979,x,y+80,'wall-foot');}
 }}
horizontalWall(32,false);horizontalWall(1472,true);
for(let y=32;y<1520;y+=16){for(const x of [48,64,1520,1536])recipe(town,137,x,y,'vertical-wall-deck','wall-top');recipe(town,2432,32,y,'west-outer-parapet');recipe(town,2432,1504,y,'east-inner-parapet');
 if(y>=80&&y<1472)tile(town,659,80,y,'west-inner-parapet','object',[0,0,16,16]);tile(town,659,1552,y,'east-outer-parapet','object',[0,0,16,16]);}
// Explicit directional corner pieces remain visible; no corner towers cover the joints.
tile(town,600,32,32,'northwest-native-corner');tile(town,603,1536,32,'northeast-native-corner');tile(town,824,32,1504,'southwest-native-corner');tile(town,827,1536,1504,'southeast-native-corner');
blockRect(1,1,48,3);blockRect(1,1,2,48);blockRect(47,1,2,48);blockRect(1,46,48,3);
// South gate occupies x20..29, base y42, without its exercise floor.
for(const [a,b] of [[640,736],[864,960]])for(let x=a;x<b;x+=16)for(let y=1472;y<1536;y+=16)recipe(town,137,x,y,'gate-wall-continuous-backing','wall-top');
for(const o of gate.operations.filter(o=>o.layer!=='floor'&&o.part!=='tower-lower-shaft'))op(town,sources.indexOf(o.source),o.sourceRect,[o.destination[0]+640,o.destination[1]+1408-(o.part==='tower-land-foot'?32:0)],o.part,o.layer,{instance:'남문'});
blockRect(20,46,4,3);blockRect(26,46,4,3);blockRect(23,45,1,5);blockRect(26,45,1,5);
const passageCells=[];for(let y=46;y<=49;y++)for(let x=24;x<=25;x++){blocked.delete(`${x},${y}`);passageCells.push({x,y});tile(town,69,x*32,y*32,'gate-passage-floor','floor');}
landmarks.push({name:'남문 안쪽',x:24,y:45},{name:'남문 통로',x:24,y:46},{name:'남문 바깥 착지',x:24,y:49});
const spawn={x:24,y:49};
const layout={name:'돌샘 굽이 마을',units:'tile coordinates unless field ends Px',interiorRect:[3,4,44,42],buildings:buildingInstances,gardens,props,roads:roadRects,districts:[{name:'북서 길드 회랑',bounds:[4,4,18,16],courtRects:[[5,10,14,3],[13,12,2,7]],character:'paired guild and archive, small L-shaped paved courts'},{name:'동북 붙은 상점 거리',bounds:[26,4,20,27],character:'stepped shop pairs around a crooked shopping lane'},{name:'서남 나무그늘 정원',bounds:[3,22,17,23],courtRects:gardenRects,character:'L-shaped garden, trees, flowers, walking paths and lodge'},{name:'동남 장인 중정',bounds:[33,32,13,14],courtRects:[[33,36,13,3]],character:'wide shallow earth work court between workshops and homes'}],plaza:{rect:[18,21,14,10],reason:'Independent market square with well and two counter clusters; the gate road bends west twice before entering it.'},gates:[{name:'남문',module:'open-gate',offsetPx:[640,1408],towerBodyShortenedPx:32,passageCells,inside:{x:24,y:45},outside:spawn,review:'partial: new shallow arch; not restoration of held portcullis'}],wallSections:{horizontal:{rearOffset:0,deckOffsets:[16,48],frontOffset:48,faceOffsets:[64,96]},corners:'native directional pieces, no rotations and no masking towers',review:'partial: western side surface remains thin'},landmarks,design:'District-led redesign: guild/archive L courts northwest, stepped joined-shop street northeast, independent central market square, L garden southwest, shallow work court southeast. No repeated cross-town street bands. All house dimensions remain fixed.'};
// Collect operations in engine order. All lower first, then all upper.
const engineLayer=o=>['object','overhead'].includes(o.layer)?'upper':'lower';
town.operations.sort((a,b)=>(engineLayer(a)==='upper')-(engineLayer(b)==='upper')||layerOrder.indexOf(a.layer)-layerOrder.indexOf(b.layer)||a.drawOrder-b.drawOrder);town.operations.forEach((o,i)=>o.drawOrder=i);
// Small street is a deliberate local scene, independently laid out before town QA.
const street={id:'street',widthPx:800,heightPx:544,operations:[]};
for(let y=0;y<544;y+=32)for(let x=0;x<800;x+=32)tile(street,16,x,y,'street-study-destination','floor');
const streetPlaces=[['house',32,64],['joined-shops',192,48],['courtyard-inn',480,64],['low-workshop',64,352]];
for(const[id,x,y]of streetPlaces){const m=modules.find(a=>a.id===id);for(const o of m.operations.filter(o=>o.layer!=='floor'))op(street,sources.indexOf(o.source),o.sourceRect,[o.destination[0]+x-32,o.destination[1]+y-32],o.part,o.layer,{instance:id});}
for(let x=0;x<800;x+=32)for(let y=288;y<352;y+=32)tile(street,69,x,y,'two-cell-street','floor');
street.operations.sort((a,b)=>(engineLayer(a)==='upper')-(engineLayer(b)==='upper')||layerOrder.indexOf(a.layer)-layerOrder.indexOf(b.layer)||a.drawOrder-b.drawOrder);
async function scenePNG(scene,scale=1){const data=await page.evaluate(({scene,sources,scale})=>{const cv=document.createElement('canvas');cv.width=scene.widthPx*scale;cv.height=scene.heightPx*scale;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;for(const o of scene.operations){const[sx,sy,w,h]=o.sourceRect;c.drawImage(window.atlases[sources.indexOf(o.source)],sx,sy,w,h,o.destination[0]*scale,o.destination[1]*scale,w*scale,h*scale);}return cv.toDataURL();},{scene,sources,scale});return Buffer.from(data.split(',')[1],'base64');}
await fs.writeFile(`${out}/street.png`,await scenePNG(street,2));
await fs.writeFile(`${out}/map.png`,await scenePNG(town));
// Bake actual two-layer cell images, deduplicate by RGBA+passability, retain original 1232 slots.
const baked=await page.evaluate(({town,sources,blockedCells,instances,modules})=>{
 const blocked=new Set(blockedCells),layers={};for(const key of ['lower','upper']){const cv=document.createElement('canvas');cv.width=cv.height=1600;layers[key]=cv;}
 for(const o of town.operations){const key=['object','overhead'].includes(o.layer)?'upper':'lower';const[sx,sy,w,h]=o.sourceRect;layers[key].getContext('2d').drawImage(window.atlases[sources.indexOf(o.source)],sx,sy,w,h,...o.destination,w,h);}
 const atlas=document.createElement('canvas');atlas.width=1792;atlas.height=704+Math.ceil(5000/56)*32;const ac=atlas.getContext('2d');ac.drawImage(window.atlases[0],0,0);
 const metadata=[],arrays={},lookup=new Map();let count=1232;
 for(const layer of ['lower','upper']){arrays[layer]=[];const c=layers[layer].getContext('2d');for(let y=0;y<50;y++)for(let x=0;x<50;x++){const data=c.getImageData(x*32,y*32,32,32).data;let nonempty=false;for(let i=3;i<data.length;i+=4)if(data[i]){nonempty=true;break;}if(!nonempty&&layer==='upper'){arrays[layer].push(-1);continue;}const pass=!blocked.has(`${x},${y}`);let raw='';for(let i=0;i<data.length;i++)raw+=String.fromCharCode(data[i]);const key=layer+pass+btoa(raw);let id=lookup.get(key);if(id===undefined){id=count++;lookup.set(key,id);ac.drawImage(layers[layer],x*32,y*32,32,32,id%56*32,Math.floor(id/56)*32,32,32);metadata.push({id,layer,pass,exampleCell:[x,y]});}arrays[layer].push(id);}}
 const final=document.createElement('canvas');final.width=1792;final.height=Math.ceil(count/56)*32;final.getContext('2d').drawImage(atlas,0,0);
 const bm=document.createElement('canvas');bm.width=bm.height=1600;const bc=bm.getContext('2d');
 for(const i of instances){const m=modules.find(m=>m.id===i.module);for(const o of m.operations.filter(o=>!['floor','shadow'].includes(o.layer))){const[sx,sy,w,h]=o.sourceRect;bc.drawImage(window.atlases[sources.indexOf(o.source)],sx,sy,w,h,o.destination[0]+i.offsetPx[0],o.destination[1]+i.offsetPx[1],w,h);}}
 const pixels=bc.getImageData(96,128,1408,1344).data;let area=0,coverage=0;for(let i=3;i<pixels.length;i+=4){area+=pixels[i]/255;if(pixels[i]>0)coverage++;}
 bc.globalCompositeOperation='source-in';bc.fillStyle='#f2b95f';bc.fillRect(0,0,1600,1600);
 return {count,height:final.height,atlas:final.toDataURL(),metadata,lower:arrays.lower,upper:arrays.upper,silhouetteAreaPx:area,silhouetteCoveragePx:coverage,buildingMask:bm.toDataURL()};
},{town,sources,blockedCells:[...blocked],instances:buildingInstances,modules});
await fs.writeFile(`${out}/atlas.png`,Buffer.from(baked.atlas.split(',')[1],'base64'));
await fs.writeFile(`${out}/building-mask.png`,Buffer.from(baked.buildingMask.split(',')[1],'base64'));
const count=baked.count,terrain=Array(count).fill(0),priority=Array(count).fill('lower'),passability=Array.from({length:count},()=>({up:false,down:false,left:false,right:false})),tileMeta=Array.from({length:count},(_,i)=>({label:`Slates v2 原 ${i}`,description:'Ivan Voirol CC BY 4.0; original source slot, not automatically walkable.',source:'ai',origin:'ai'}));
for(const m of baked.metadata){priority[m.id]=m.layer;passability[m.id]={up:m.pass,down:m.pass,left:m.pass,right:m.pass};tileMeta[m.id]={label:`돌샘 ${m.layer} ${m.id}`,description:`Source-rectangle composite; example map cell ${m.exampleCell}; ${m.pass?'walkable':'blocked'}; see recipes.json.`,source:'ai',origin:'ai'};}
const bundle={map:{id:'slates_astra_v2_walled_50',name:'돌샘 굽이 마을',width:50,height:50,tileSize:32,tilesetId:'slates_astra_v2_32',lowerTiles:baked.lower,upperTiles:baked.upper,events:[],bgm:{mode:'none'},encounters:[]},tileset:{id:'slates_astra_v2_32',kind:'custom',name:'Slates Astra v2',count,tileSize:32,tilesPerRow:56,image:{type:'uploaded',id:'slates_astra_v2_atlas'},terrain,priority,passability,tileMeta,tileGroups:[],structureKits:[]},asset:{id:'slates_astra_v2_atlas',name:'Slates Astra — Ivan Voirol CC BY 4.0',kind:'tileset',dataUrl:baked.atlas,meta:{tileSize:32,width:1792,height:baked.height}},spawn,landmarks};
// Read exactly the published IDs and four-direction flags, not the planning blocked set.
const directions=[[0,-1,'up','down'],[0,1,'down','up'],[-1,0,'left','right'],[1,0,'right','left']];
function allowed(x,y,dir,seal=false){if(x<0||y<0||x>=50||y>=50)return false;if(seal&&passageCells.some(p=>p.x===x&&p.y===y))return false;const k=y*50+x;return [baked.lower[k],baked.upper[k]].filter(i=>i>=0).every(i=>passability[i][dir]);}
function flood(start,seal=false){const seen=new Set([`${start.x},${start.y}`]),q=[start];for(let i=0;i<q.length;i++){const{x,y}=q[i];for(const[dx,dy,a,b]of directions){const xx=x+dx,yy=y+dy,k=`${xx},${yy}`;if(!seen.has(k)&&allowed(x,y,a,seal)&&allowed(xx,yy,b,seal)){seen.add(k);q.push({x:xx,y:yy});}}}return seen;}
const reached=flood(spawn),sealed=flood({x:24,y:26},true),boundary=[...sealed].filter(k=>{const[x,y]=k.split(',').map(Number);return x===0||y===0||x===49||y===49;});
const metrics={structuralReview:'partial; corrected workshop no longer repeats triangular middle pieces; inn rear cap and wall side/arch retain limits',compositionReview:'partial: district-led redesign directly inspected; 28.5% density is below the proposed 45-60%, not a full composition pass',interiorPixels:1408*1344,buildingSilhouettePixels:baked.silhouetteAreaPx,buildingCoveragePixels:baked.silhouetteCoveragePx,silhouetteMeasurement:'alpha-weighted union and alpha>0 coverage; building objects/foundations only; excludes floor, cast shadows, plants and props',buildingOccupancyPercent:100*baked.silhouetteAreaPx/(1408*1344),buildingTypes:[...new Set(plan.map(p=>p[0]))],buildingCount:buildingInstances.length,countsByType:Object.fromEntries([H,S,I,W].map(id=>[id,plan.filter(p=>p[0]===id).length])),landmarkCount:landmarks.length,walkableReached:reached.size,unreachableLandmarks:landmarks.filter(p=>!reached.has(`${p.x},${p.y}`)),gatePassageReachable:passageCells.every(p=>reached.has(`${p.x},${p.y}`)),gateSealedExteriorLeakCells:boundary,gateSealedReachable:sealed.size,collisionSource:'bundle map tile IDs -> tileset.passability in both source and destination directions, lower and upper combined',sourceRectOnly:true,stored:false,storageOwner:'supervisor',atlasCount:count,atlasHeight:baked.height};
// Every final atlas cell references the exact clipped source operations for its example cell.
const atlasRecipes=baked.metadata.map(m=>{const [cx,cy]=m.exampleCell,ops=[];for(const o of town.operations){if(engineLayer(o)!==m.layer)continue;const[sx,sy,w,h]=o.sourceRect,[dx,dy]=o.destination,x=Math.max(cx*32,dx),y=Math.max(cy*32,dy),r=Math.min(cx*32+32,dx+w),b=Math.min(cy*32+32,dy+h);if(r>x&&b>y)ops.push({source:o.source,sourceRect:[sx+x-dx,sy+y-dy,r-x,b-y],destination:[x-cx*32,y-cy*32],drawOrder:o.drawOrder,part:o.part,instance:o.instance});}return {tileId:m.id,layer:m.layer,passability:passability[m.id],exampleCell:m.exampleCell,operations:ops};});
await fs.writeFile(`${out}/recipes.json`,JSON.stringify({cellSize:32,originalSlots:1232,sources,drawContract:'all lower then all upper; equal-sized alpha-over; source rectangles split at cell boundaries',moduleCells:recipes,atlasRecipes},null,2));
await fs.writeFile(`${out}/bundle.json`,JSON.stringify(bundle));await fs.writeFile(`${out}/layout.json`,JSON.stringify(layout,null,2));await fs.writeFile(`${out}/metrics.json`,JSON.stringify(metrics,null,2));
const collisionPNG=await page.evaluate(({town,sources,blockedCells,landmarks})=>{const c=document.createElement('canvas');c.width=c.height=1600;const g=c.getContext('2d');for(const o of town.operations){const[sx,sy,w,h]=o.sourceRect;g.drawImage(window.atlases[sources.indexOf(o.source)],sx,sy,w,h,...o.destination,w,h);}g.fillStyle='#ea365066';for(const k of blockedCells){const[x,y]=k.split(',').map(Number);g.fillRect(x*32,y*32,32,32);}g.font='14px monospace';for(const p of landmarks){g.fillStyle='#35ffae';g.fillRect(p.x*32+10,p.y*32+10,12,12);}return c.toDataURL();},{town,sources,blockedCells:[...blocked],landmarks});
await fs.writeFile(`${out}/map-collision.png`,Buffer.from(collisionPNG.split(',')[1],'base64'));

// Re-render the published atlas/arrays, compare against the authoring canvas, and save the evidence.
const renderEvidence=await page.evaluate(async({bundle,town,sources})=>{
 const atlas=await new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i);i.src=bundle.asset.dataUrl;});
 const actual=document.createElement('canvas');actual.width=actual.height=1600;const g=actual.getContext('2d');
 for(const layer of ['lowerTiles','upperTiles'])bundle.map[layer].forEach((id,k)=>{if(id<0)return;g.drawImage(atlas,id%56*32,Math.floor(id/56)*32,32,32,k%50*32,Math.floor(k/50)*32,32,32);});
 const expected=document.createElement('canvas');expected.width=expected.height=1600;const e=expected.getContext('2d');for(const o of town.operations){const[sx,sy,w,h]=o.sourceRect;e.drawImage(window.atlases[sources.indexOf(o.source)],sx,sy,w,h,...o.destination,w,h);}
 const a=g.getImageData(0,0,1600,1600).data,b=e.getImageData(0,0,1600,1600).data;let differences=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let different=false;for(let ch=0;ch<4;ch++){const d=Math.abs(a[i+ch]-b[i+ch]);maxChannelDelta=Math.max(maxChannelDelta,d);different ||= d>0;}if(different)differences++;}
 const zoom=document.createElement('canvas');zoom.width=960;zoom.height=576;const z=zoom.getContext('2d');z.imageSmoothingEnabled=false;z.drawImage(actual,576,1408,480,192,0,0,960,384);z.fillStyle='#182930';z.fillRect(0,384,960,192);z.fillStyle='white';z.font='20px sans-serif';z.fillText('South gate / continuous backing / 2 walkable columns',16,420);z.fillText('Native horizontal bands: rear -> deck -> front -> masonry',16,454);
 return {differentPixels:differences,maxChannelDelta,published:actual.toDataURL(),gateZoom:zoom.toDataURL()};
},{bundle,town,sources});
await fs.writeFile(`${out}/map.png`,Buffer.from(renderEvidence.published.split(',')[1],'base64'));
await fs.writeFile(`${out}/map-from-bundle.png`,Buffer.from(renderEvidence.published.split(',')[1],'base64'));
await fs.writeFile(`${out}/gate-join-final.png`,Buffer.from(renderEvidence.gateZoom.split(',')[1],'base64'));
await fs.writeFile(`${out}/map-render-check.json`,JSON.stringify({authoringVsPackedDifferentPixels:renderEvidence.differentPixels,maxChannelDelta:renderEvidence.maxChannelDelta,canonicalPreview:'map.png is exact published atlas/arrays render',method:'Canvas renderer of exact published atlas and lower/upper arrays; not app/player QA',arrayLengths:[baked.lower.length,baked.upper.length],metadataCounts:[terrain.length,priority.length,passability.length,tileMeta.length],allIdsInRange:[...baked.lower,...baked.upper].every(i=>i===-1||(Number.isInteger(i)&&i>=0&&i<count)),atlasDimensions:[1792,baked.height]},null,2));
const overlays=await page.evaluate(({town,sources,layout})=>{const c=document.createElement('canvas');c.width=c.height=1600;const g=c.getContext('2d');for(const o of town.operations){const[sx,sy,w,h]=o.sourceRect;g.drawImage(window.atlases[sources.indexOf(o.source)],sx,sy,w,h,...o.destination,w,h);}g.lineWidth=3;g.font='bold 23px sans-serif';for(const[d,i]of layout.districts.map((d,i)=>[d,i])){const[x,y,w,h]=d.bounds;g.strokeStyle=['#68d7ff','#f7b65d','#63ed9c','#d694f4'][i];g.strokeRect(x*32,y*32,w*32,h*32);g.fillStyle='#17252cdd';g.fillRect(x*32,y*32,330,34);g.fillStyle='white';g.fillText(`${i+1}. ${d.name}`,x*32+8,y*32+25);}g.strokeStyle='#f4e68e';const[x,y,w,h]=layout.plaza.rect;g.strokeRect(x*32,y*32,w*32,h*32);return c.toDataURL();},{town,sources,layout});
await fs.writeFile(`${out}/districts.png`,Buffer.from(overlays.split(',')[1],'base64'));
// Street zooms use this session's authored scene, never reference screenshot pixels.
const streetFocus={...street,widthPx:480,heightPx:304,operations:street.operations.map(o=>({...o,destination:[o.destination[0]-176,o.destination[1]-16]}))};
await fs.writeFile(`${out}/street-joins.png`,await scenePNG(streetFocus,3));
metrics.authoringVsPackedDifferentPixels=renderEvidence.differentPixels;metrics.maxChannelDelta=renderEvidence.maxChannelDelta;metrics.canonicalPreview='map.png from exact bundle atlas and arrays';
metrics.reviews={structure:{status:'partial',reason:'Fixed-width house/shop structures reviewed; workshop reject corrected; inn rear termination and fortification sides/arch retain limitations'},composition:{status:'partial',reason:'Repeated bands discarded; four distinct neighborhoods plus market; measured density below proposal'},passage:{status:'partial',localPass:true,reason:'All landmarks reached and sealed gate has no exterior leak using published directional metadata; app/player not exercised'},storage:{status:'partial',pending:true,reason:'No DB/.env access or persistence claim'}};
await fs.writeFile(`${out}/metrics.json`,JSON.stringify(metrics,null,2));
console.log(JSON.stringify(metrics,null,2));
await browser.close();
console.log('Wrote stage 1-5 source-only modules and town deliverables.');
