import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {assemblies,variants} from './slates-mastery-specs.mjs';
import {regions} from './slates-study-catalog.mjs';
import {notes,reviewOverrides} from './slates-mastery-notes.mjs';
const out='verify-shots/slates-mastery',imgDir='openwiki/images/slates/mastery';
await mkdir(out,{recursive:true});await mkdir(imgDir,{recursive:true});
const project=JSON.parse(await readFile('output/slates-mastery/source/source-project.json','utf8'));
const manifest=JSON.parse(await readFile('public/assets/slates/slates-mastery-fine-recipes.json','utf8'));
const data=async p=>'data:image/png;base64,'+(await readFile(p)).toString('base64');
const sources=await Promise.all(manifest.sources.map(data));
const references=Object.fromEntries(await Promise.all(['ville_0','NewVersion_0','chateau'].map(async name=>[name,await data(`output/slates-reference/source/${name}.png`)])));
const specs=assemblies.map(s=>({...s,patches:Array.from({length:s.rect[3]},(_,y)=>Array.from({length:s.rect[2]},(_,x)=>manifest.maps[s.source].recipes[(s.rect[1]+y)*34+s.rect[0]+x]))}));
for(const v of variants){const base=specs.find(s=>s.id===v.base);const patches=structuredClone(base.patches);if(v.axis==='x')for(const row of patches)row.splice(v.index,1,...Array.from({length:v.repeat},()=>row[v.index]));else patches.splice(v.index,1,...Array.from({length:v.repeat},()=>patches[v.index]));specs.push({...base,...v,scope:'controlled-variant',patches,pitfall:'반복 결과를 아래 이미지로 검토한다. 원본과의 픽셀 일치율은 적용하지 않는다.'});}
for(const [kind,x,y,w,h,n,dy]of[['waterwheel',48,10,2,3,4,3],['windmill',50,10,2,2,4,2]])for(let frame=0;frame<n;frame++){
 const patches=Array.from({length:h*2},(_,j)=>Array.from({length:w*2},(_,i)=>{const px=(x*2+i)*16,py=((y+frame*dy)*2+j)*16;const index=manifest.rects.findIndex(r=>r[0]===0&&r[1]===px&&r[2]===py);if(index<0)throw Error('Missing source patch');return[index];}));
 specs.push({id:`${kind}-${frame}`,name:`${kind==='waterwheel'?'물레방아':'풍차 날개'} 자세 ${frame+1}`,family:'detail',scope:'source-object',source:'atlas-v2',rect:[x,y+frame*dy,w,h],patches,rule:`${w}×${h} 원본 블록 한 개가 한 자세다. 각 자세는 따로 배치하며 다른 자세와 겹치지 않는다.`,pitfall:'회전 모양을 확인한 정지 샘플이다. 애니메이션 재생·축 정렬·설치 건물까지 검증한 것은 아니다.',repeatability:'fixed'});
}
const browser=await chromium.launch();let result;
try{const page=await browser.newPage();result=await page.evaluate(async({specs,manifest,sources,references,regions})=>{
 const load=async url=>{const im=new Image();im.src=url;await im.decode();return im;};
 const src=await Promise.all(sources.map(load)),refs=Object.fromEntries(await Promise.all(Object.entries(references).map(async([k,v])=>[k,await load(v)])));
 const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const definitions=[],unique=new Map(),tiles=[],cards=[];
 const drawPart=(ctx,id,x,y)=>{const[s,sx,sy,size=16,dx=0,dy=0]=manifest.rects[id];ctx.drawImage(src[s],sx,sy,size,size,x+dx,y+dy,size,size);};
 const add=(recipe)=>{const key=JSON.stringify(recipe);if(unique.has(key))return unique.get(key);const id=1232+tiles.length,c=canvas(32,32),ctx=c.getContext('2d');for(const p of recipe)ctx.drawImage(src[p.source],p.x,p.y,p.width,p.height,p.dx,p.dy,p.width,p.height);unique.set(key,id);tiles.push(c);definitions.push({id,recipe});return id;};
 for(const spec of specs){const ph=spec.patches.length,pw=spec.patches[0].length,w=Math.ceil(pw/2),h=Math.ceil(ph/2),assembled=canvas(pw*16,ph*16),g=assembled.getContext('2d');
  if(spec.scope==='source-object'){for(let by=0;by<ph*16;by+=32)for(let bx=0;bx<pw*16;bx+=32)g.drawImage(src[0],32,32,32,32,bx,by,32,32);}
  for(let y=0;y<ph;y++)for(let x=0;x<pw;x++)for(const part of spec.patches[y][x])drawPart(g,part,x*16,y*16);
  const rows=[];for(let y=0;y<h;y++){const row=[];for(let x=0;x<w;x++){
   const recipe=[{source:0,x:32,y:32,width:32,height:32,dx:0,dy:0}];
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)for(const p of spec.patches[y*2+dy]?.[x*2+dx]??[]){const[s,sx,sy,size=16,ox=0,oy=0]=manifest.rects[p];recipe.push({source:s,x:sx,y:sy,width:size,height:size,dx:dx*16+ox,dy:dy*16+oy});}
   row.push(add(recipe));}rows.push({tiles:row,upperTiles:Array(w).fill(-1)});}
  const sourceParts=[...new Set(spec.patches.flat(2))].sort((a,b)=>a-b).map(index=>{const[source,x,y,size=16,dx=0,dy=0]=manifest.rects[index];return{index,source,x,y,size,dest:[dx,dy],tile:Math.floor(y/32)*(source===0?56:48)+Math.floor(x/32),quadrant:[x%32,y%32]};});
  let metrics=null,reference=null,diff=null;
  if(spec.scope==='reference-context'){
   reference=canvas(pw*16,ph*16);reference.getContext('2d').drawImage(refs[spec.source],spec.rect[0]*32,spec.rect[1]*32,pw*32,ph*32,0,0,pw*16,ph*16);
   const a=g.getImageData(0,0,pw*16,ph*16).data,b=reference.getContext('2d').getImageData(0,0,pw*16,ph*16).data;diff=canvas(pw*16,ph*16);const d=diff.getContext('2d').createImageData(pw*16,ph*16);let exact=0,near=0,error=0;
   for(let i=0;i<a.length;i+=4){const e=Math.max(...[0,1,2].map(k=>Math.abs(a[i+k]-b[i+k])));exact+=e===0;near+=e<=8;for(let k=0;k<3;k++)error+=Math.abs(a[i+k]-b[i+k]);d.data[i]=e?255:22;d.data[i+1]=e?Math.min(160,e*2):28;d.data[i+2]=e?20:36;d.data[i+3]=255;}diff.getContext('2d').putImageData(d,0,0);
   metrics={exactPercent:+(exact/(pw*ph*256)*100).toFixed(2),within8Percent:+(near/(pw*ph*256)*100).toFixed(2),meanChannelError:+(error/(pw*ph*256*3)).toFixed(3)};
  }
  const cols=reference?3:1,scale=2,pad=16,titleH=56,board=canvas(cols*(pw*16*scale+pad)+pad,ph*16*scale+titleH+pad),bg=board.getContext('2d');bg.fillStyle='#17222b';bg.fillRect(0,0,board.width,board.height);bg.imageSmoothingEnabled=false;bg.font='14px sans-serif';
  [reference,assembled,diff].filter(Boolean).forEach((im,k)=>{bg.fillStyle='#f5eee1';bg.fillText(reference?['REFERENCE','SOURCE ASSEMBLY','DIFFERENCE'][k]:'SOURCE ASSEMBLY',pad+k*(pw*32+pad),22);bg.fillStyle='#a9b6c0';bg.fillText(k===1&&metrics?metrics.exactPercent+'% exact':spec.id,pad+k*(pw*32+pad),43);bg.drawImage(im,pad+k*(pw*32+pad),titleH,pw*32,ph*32);});
  // Numbered provenance: each entry is a real 16px source patch, enlarged 3x.
  const pc=12,partSheet=canvas(pc*82,Math.ceil(sourceParts.length/pc)*80),pg=partSheet.getContext('2d');pg.fillStyle='#d1d3d6';pg.fillRect(0,0,partSheet.width,partSheet.height);pg.imageSmoothingEnabled=false;pg.font='10px monospace';sourceParts.forEach((p,i)=>{const x=i%pc*82,y=(i/pc|0)*80;pg.drawImage(src[p.source],p.x,p.y,p.size,p.size,x+16,y,48,48);pg.fillStyle='#152433';pg.fillText(`v${p.source===0?2:1} #${p.tile}`,x+3,y+61);pg.fillText(`${p.quadrant}`,x+3,y+74);});
  cards.push({...spec,width:w,height:h,rows,sourceParts,metrics,image:assembled.toDataURL(),comparison:board.toDataURL(),partsImage:partSheet.toDataURL()});
 }
 const regionCards=regions.map(r=>{const[x,y,w,h]=r.rect,c=canvas(w*64,h*64),g=c.getContext('2d');g.fillStyle='#d5d7da';g.fillRect(0,0,c.width,c.height);g.imageSmoothingEnabled=false;g.drawImage(src[0],x*32,y*32,w*32,h*32,0,0,c.width,c.height);for(let j=0;j<h;j++)for(let i=0;i<w;i++){g.fillStyle='#000b';g.fillRect(i*64,j*64,34,13);g.fillStyle='#fff';g.font='10px monospace';g.fillText((y+j)*56+x+i,i*64+1,j*64+11);}const uses=cards.filter(card=>card.sourceParts.some(p=>p.source===0&&p.x>=x*32&&p.x<(x+w)*32&&p.y>=y*32&&p.y<(y+h)*32)).map(c=>c.id);return{...r,uses,image:c.toDataURL()};});
 const sheet=canvas(1792,Math.ceil((1232+tiles.length)/56)*32),sc=sheet.getContext('2d');sc.drawImage(src[0],0,0);tiles.forEach((c,i)=>sc.drawImage(c,(1232+i)%56*32,Math.floor((1232+i)/56)*32));
 return{cards,regionCards,definitions,count:1232+tiles.length,height:sheet.height,atlas:sheet.toDataURL()};
},{specs,manifest,sources,references,regions});}finally{await browser.close();}
for(const c of result.cards)c.review=reviewOverrides[c.id]??{status:c.scope==='source-object'?'source-block':'reference-context',reason:c.scope==='source-object'?'원본 자세의 고정 블록. 설치/애니메이션은 별도.':'원본 조립 문맥과 남은 차이를 비교판에서 확인. 독립 가변 템플릿 인증은 아님.'};
for(const r of result.regionCards)r.reviewNotes=notes[r.id];
const ts=structuredClone(project.tilesets.slates_32);ts.id='slates_mastery_32';ts.name='Slates · 구조 분해와 조립 표본';ts.image={type:'uploaded',id:'slates_mastery_atlas'};ts.count=result.count;
for(const d of result.definitions){ts.passability[d.id]={up:false,down:false,left:false,right:false};ts.priority[d.id]='lower';ts.terrain[d.id]=0;ts.tileMeta[d.id]={label:'구조 연구 표본 '+d.id,description:'원본 사각형으로 재조립. 문맥 포함 표본이며 배치할 때 통행·상위 레이어를 새로 저작해야 한다.',source:'ai',origin:'ai',confidence:'medium'};}
ts.structureKits=result.cards.map(c=>({id:'slates-mastery-'+c.id,kind:'section',name:(c.review.status==='hold'?'사용 보류 · ':'관찰 표본 · ')+c.name,width:c.width,height:c.height,rows:c.rows,learnedFrom:'db-authored',ai:{description:c.rule+' ['+c.review.status+'] '+c.review.reason,placementRules:c.pitfall+' 원본 배경 포함/고정 크기/통행 미저작인 관찰 표본. 실전 배치 전 분리 필요.',role:['architecture','fortification'].includes(c.family)?'building':c.family==='terrain'?'terrain':'prop',tags:['Slates','구조 연구',c.scope],repeatability:'fixed',layerHome:'lower',origin:'ai',confidence:'medium'}}));
project.tilesets[ts.id]=ts;project.assets.uploaded.slates_mastery_atlas={id:'slates_mastery_atlas',name:'Slates 구조 학습 · 원본 조립',kind:'tileset',dataUrl:result.atlas,meta:{tileSize:32,width:1792,height:result.height}};
const layouts=[];
for(const[family,name]of[['architecture','지붕·건물'],['fortification','성벽·탑·단차'],['terrain','지형·물·부두'],['detail','소품·자세']]){
 const placements=[];let x=2,y=3,rowH=0;for(const c of result.cards.filter(c=>c.family===family)){if(x+c.width+2>36){x=2;y+=rowH+3;rowH=0;}placements.push({id:c.id,name:c.name,x,y,w:c.width,h:c.height});x+=c.width+3;rowH=Math.max(rowH,c.height);}
 const H=y+rowH+3,map={id:'slates_mastery_'+family,name:'Slates 연구 · '+name,width:36,height:H,tileSize:32,tilesetId:ts.id,lowerTiles:Array(36*H).fill(57),upperTiles:Array(36*H).fill(-1),events:[],bgm:{mode:'none'},encounters:[]};
 for(const p of placements){const c=result.cards.find(c=>c.id===p.id);c.rows.forEach((row,j)=>row.tiles.forEach((tile,i)=>map.lowerTiles[(p.y+j)*36+p.x+i]=tile));}
 project.maps[map.id]=map;if(!project.mapTree.children.some(n=>n.mapId===map.id))project.mapTree.children.push({mapId:map.id,children:[]});layouts.push({mapId:map.id,name,width:36,height:H,placements});
}
for(const c of result.cards){await writeFile(`${imgDir}/${c.id}.png`,Buffer.from(c.comparison.split(',')[1],'base64'));await writeFile(`${imgDir}/${c.id}-parts.png`,Buffer.from(c.partsImage.split(',')[1],'base64'));}
for(const r of result.regionCards)await writeFile(`${imgDir}/region-${r.id}.png`,Buffer.from(r.image.split(',')[1],'base64'));
const clean=({image,comparison,partsImage,...x})=>x;
await writeFile(`${out}/project.json`,JSON.stringify(project));await writeFile(`${out}/layout.json`,JSON.stringify(layouts,null,2));
await writeFile('public/assets/slates/slates-mastery-32px.png',Buffer.from(result.atlas.split(',')[1],'base64'));
await writeFile('public/assets/slates/slates-mastery-catalog.json',JSON.stringify({sourceAtlases:manifest.sources,recipeManifest:"public/assets/slates/slates-mastery-fine-recipes.json",coordinateUnit:16,sourceObjectRectUnit:32,sourceColumns:[56,48],cards:result.cards.map(clean),regions:result.regionCards.map(clean),definitions:result.definitions},null,2));
await writeFile('output/slates-mastery/rendered.json',JSON.stringify(result));
console.log({assemblies:assemblies.length,variants:variants.length,sourceObjects:result.cards.length-assemblies.length-variants.length,regions:regions.length,count:result.count,maps:layouts.map(l=>[l.mapId,l.width,l.height]),worstMatches:result.cards.filter(c=>c.metrics).sort((a,b)=>a.metrics.exactPercent-b.metrics.exactPercent).slice(0,8).map(c=>[c.id,c.metrics])});
