// User-local authoring: load exact downloaded sources, assemble maps, emit a private save input.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const sourceDir=process.argv[2],origin=process.argv[3]??'http://127.0.0.1:9816';
if(!sourceDir)throw Error('Usage: node scripts/content/author-pixel-art-world-city.mjs <download-folder> [local-editor-origin]');
const packs=(await Promise.all(['Catalog','UrbanCatalog','SchoolCatalog','FacilitiesCatalog','HomeCatalog'].map(async name=>JSON.parse(await readFile(`src/assets/pixelArtWorld${name}.json`,'utf8'))))).flat();
const plan=JSON.parse(await readFile('src/assets/pixelArtWorldCity.json','utf8'));
const auto=JSON.parse(await readFile('src/assets/pixelArtWorldAutotiles.json','utf8')).find(a=>a.id==='paw-wall-a01');
const files={};
for(const source of [...packs,...plan.sources,auto]){
 const bytes=await readFile(path.join(sourceDir,source.filename));
 if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw Error('Source version differs: '+source.filename);
 files[source.filename]=bytes.toString('base64');
}
await mkdir('output/paw-city',{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage();
try{
 await page.route('**/__paw-author',route=>route.fulfill({contentType:'text/html',body:'<main>Local tile authoring</main>'}));
 await page.goto(origin+'/__paw-author');
 const result=await page.evaluate(async({files,plan,auto})=>{
  const {createBlankProject}=await import('/src/project/defaults/blankProject.ts');
  const {EXTERNAL_TILESET_PACKS}=await import('/src/project/externalTilesetCatalog.ts');
  const {prepareExternalTileset}=await import('/src/editor/externalTilesetImport.ts');
  const {preparePixelArtWorldAutotile}=await import('/src/editor/pixelArtWorldAutotileImport.ts');
  const {xpAutotileQuarters,normalizeXpAutotileMask,XP_AUTOTILE_MASKS}=await import('/src/project/pixelArtWorldAutotiles.ts');
  const {pixelArtWorldCityGuide}=await import('/src/project/pixelArtWorldCity.ts');
  const {serialize,deserialize}=await import('/src/project/io.ts');
  const {canMove}=await import('/src/project/collision.ts');
  const load=async src=>{const im=new Image();im.src=src;await im.decode();return im;};
  const png=name=>'data:image/png;base64,'+files[name];
  const file=name=>new File([Uint8Array.from(atob(files[name]),c=>c.charCodeAt(0))],name,{type:'image/png'});
  const images=Object.fromEntries(await Promise.all(Object.keys(files).map(async n=>[n,await load(png(n))])));
  const p=createBlankProject();p.tilesets={};p.maps={};p.assets.uploaded={};p.mapConnections=[];
  p.meta.title='Pixel Art World · 도시 50×50';p.meta.author='Pixel Art World / ドット絵世界 · 조립: OPRN';
  const sprites={},roomSpecs={},rendered={},roomAssets={};
  const entries={'school-classroom-north':[6,12],'school-nurse-compact':[5,10],'school-lab-compact':[6,10],'clinic-waiting-exam':[6,11],'conveni-compact-shop':[6,11],'fastfood-compact-diner':[6,11],'library-compact':[5,9],'office-compact':[4,8],'home-compact':[6,10]};
  for(const pack of EXTERNAL_TILESET_PACKS){
   let prepared=await prepareExternalTileset(file(pack.filename),pack);let t=prepared.tileset;
   const previousId=t.id;t.id=pack.id;for(const c of t.referenceDocuments)for(const d of c.documents)d.markdown=d.markdown.replaceAll(previousId,t.id);
   const scenes=(pack.scenes??[]).filter(s=>entries[s.id]);let offset;
   if(scenes.length){
    const appended=await preparePixelArtWorldAutotile(file(auto.filename),auto,t,images[pack.filename]);
    offset=appended.offset;prepared=appended;t=appended.tileset;
   }
   p.tilesets[t.id]=t;
   const asset={id:prepared.assetId,name:pack.filename,kind:'chipset',dataUrl:prepared.dataUrl,meta:{tileSize:32,width:256,height:t.count/8*32,frameWidth:32,frameHeight:32,frames:t.count}};
   p.assets.uploaded[asset.id]=asset;sprites[t.id]=await load(asset.dataUrl);
   for(const scene of scenes){
    const w=scene.width+2,h=scene.height+2,lowerTiles=Array(w*h).fill(-1),upperTiles=Array(w*h).fill(-1);
    const [ex,ey]=entries[scene.id],entry={x:ex+1,y:ey+1},spawn={x:ex+1,y:ey};
    for(let y=0;y<scene.height;y++)for(let x=0;x<scene.width;x++){const i=y*scene.width+x,j=(y+1)*w+x+1;lowerTiles[j]=scene.lowerTiles[i];upperTiles[j]=scene.upperTiles[i];}
    const ceiling=(x,y)=>{
     if(x<0||y<0||x>=w||y>=h)return false;
     if(y>=entry.y&&x>=entry.x&&x<=entry.x+1)return false;
     if(y===h-1)return x<entry.x||x>entry.x+1;
     if(x===0||y===0||x===w-1)return true;
     const old=(y-1)*scene.width+x-1;
     return (x===1||x===w-2||y===1||y===h-2)&&scene.lowerTiles[old]===0&&!(scene.passableTiles??[]).includes(0)&&scene.upperTiles[old]===-1;
    };
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(ceiling(x,y)){
     let mask=0;for(const[dx,dy,bit]of[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]])if(ceiling(x+dx,y+dy))mask|=bit;
     lowerTiles[y*w+x]=offset+XP_AUTOTILE_MASKS.indexOf(normalizeXpAutotileMask(mask));
    }
    for(let y=entry.y;y<h;y++)for(let dx=0;dx<2;dx++){
     const i=y*w+entry.x+dx;
     if(upperTiles[i]!==-1)throw Error('Exit would cut a facility object: '+scene.id);
     lowerTiles[i]=pack.floorTile;
    }
    roomSpecs[scene.id]={scene,pack,map:{id:scene.id,name:scene.name,width:w,height:h,tileSize:32,tilesetId:t.id,lowerTiles,upperTiles,events:[],encounterRate:0,climate:{mode:'indoor'}},entry,spawn};
    roomAssets[scene.id]=t.id;
   }
  }
  const atlas=document.createElement('canvas'),columns=16,count=Math.ceil(plan.tiles.length/columns)*columns;
  atlas.width=columns*32;atlas.height=count/columns*32;const ctx=atlas.getContext('2d');ctx.imageSmoothingEnabled=false;
  plan.tiles.forEach((tile,i)=>{
   const source=plan.sources.find(s=>s.filename===tile.source),im=images[tile.source],x=i%columns*32,y=Math.floor(i/columns)*32;
   if(source.format==='xp-autotile')for(const q of xpAutotileQuarters(source.variantMasks[tile.tile]))ctx.drawImage(im,q.sx,q.sy,16,16,x+q.dx,y+q.dy,16,16);
   else ctx.drawImage(im,tile.tile%8*32,Math.floor(tile.tile/8)*32,32,32,x,y,32,32);
  });
  const cityTs={id:'paw-city-composed',name:'햇살동 · 사용자 합성',kind:'custom',image:{type:'uploaded',id:'paw-city-atlas'},tileSize:32,tilesPerRow:columns,count,passability:[],priority:[],terrain:Array(count).fill(0),tileMeta:[],tileGroups:[],autotileGroups:[],referenceDocuments:[]};
  for(let i=0;i<count;i++){const spec=plan.tiles[i],pass=spec?.passage==='passable';cityTs.passability.push({up:pass,down:pass,left:pass,right:pass});cityTs.priority.push(spec?.layer??'lower');cityTs.tileMeta.push({label:spec?`${spec.source} · ${spec.tile}`:'빈 칸',description:spec?'공용 도시 청사진의 원본 번호/레이어/통행 사전 참조.':'행 정렬 여백',source:spec?'imported':'unknown',...(spec?{defaultLayer:spec.layer,passage:spec.passage}: {})});}
  const city={id:'paw_city',name:plan.name,width:50,height:50,tileSize:32,tilesetId:cityTs.id,lowerTiles:[...plan.lowerTiles],upperTiles:[...plan.upperTiles],events:[],encounterRate:0};
  p.tilesets[cityTs.id]=cityTs;p.assets.uploaded['paw-city-atlas']={id:'paw-city-atlas',name:'paw-city-local-atlas.png',kind:'chipset',dataUrl:atlas.toDataURL(),meta:{tileSize:32,width:atlas.width,height:atlas.height,frames:count,frameWidth:32,frameHeight:32}};
  sprites[cityTs.id]=await load(atlas.toDataURL());p.maps[city.id]=city;p.startMapId=city.id;p.startPos=plan.start;
  function event(id,name,x,y,commands,touch=false){return {id,name,x,y,trigger:{kind:touch?'touch':'action'},commands,pages:[{id:id+'-page',name,conditions:[],graphic:{},trigger:{kind:touch?'touch':'action'},priority:touch?'below':'same',movement:{type:'fixed',speed:3,frequency:3},commands}]};}
  const links=[];
  for(const [index,building]of plan.entrances.entries()){
   const scenes=building.room==='school-classroom-north'?['school-classroom-north','school-nurse-compact','school-lab-compact']:[building.room];
   const options=[];
   for(const sceneId of scenes){
    const spec=roomSpecs[sceneId];if(!spec)throw Error('Missing facility '+sceneId);
    const map=structuredClone(spec.map);map.id=`${sceneId}-${index}`;map.name=sceneId==='home-compact'?`${building.name} · 주거 공간`:spec.scene.name;
    const returnCommand={kind:'transfer',mapId:city.id,...building.approach,direction:'down',fade:'black'};
    for(let dx=0;dx<2;dx++)map.events.push(event(`${map.id}-exit-${dx}`,'거리로 나가기',spec.entry.x+dx,spec.entry.y,[returnCommand],true));
    const transfer={kind:'transfer',mapId:map.id,...spec.spawn,direction:'up',fade:'black'};
    options.push({text:map.name,branch:[transfer]});p.maps[map.id]=map;
    links.push({building:building.name,from:city.id,entrance:building.entrance,approach:building.approach,to:map.id,spawn:spec.spawn,exit:spec.entry,sceneId,entranceWidth:building.entranceWidth});
   }
   const commands=options.length===1?options[0].branch:[{kind:'choices',prompt:building.name,options,cancelBehavior:'branch',cancelBranch:[]}];
   for(let leaf=0;leaf<building.entranceWidth;leaf++)city.events.push(event(`door-${index}-${leaf}`,building.name,building.entrance.x+leaf,building.entrance.y,commands));
  }
  p.mapTree={mapId:city.id,children:Object.keys(p.maps).filter(id=>id!==city.id).map(mapId=>({mapId,children:[]}))};
  const render=map=>{const c=document.createElement('canvas');c.width=map.width*32;c.height=map.height*32;const cctx=c.getContext('2d'),ts=p.tilesets[map.tilesetId],im=sprites[ts.id];cctx.imageSmoothingEnabled=false;for(const layer of [map.lowerTiles,map.upperTiles])layer.forEach((tile,i)=>{if(tile>=0)cctx.drawImage(im,tile%ts.tilesPerRow*32,Math.floor(tile/ts.tilesPerRow)*32,32,32,i%map.width*32,Math.floor(i/map.width)*32,32,32);});return c.toDataURL();};
  for(const map of Object.values(p.maps)){
   rendered[map.id]=render(map);
   p.tilesets[map.tilesetId].referenceDocuments.push({id:'assembled-'+map.id,name:map.name+' · 실제 완성 배치',description:'사용자 원본으로 합성한 실제 맵. 전체 배열과 이동 이벤트를 포함한다.',documents:[{id:'layout',name:'전체 배열과 이동.md',markdown:`# ${map.name}\n\n원점(0,0),32px,lower→upper 순서. 시설 입구/출구의 빈 칸을 유지한다.\n\n\`\`\`json\n${JSON.stringify(map)}\n\`\`\`\n\n![실제 조립](image:scene)`}],images:[{id:'scene',name:map.id+'.png',caption:'실제 원본 픽셀로 조립. 칠한 모형 이미지가 아님.',dataUrl:rendered[map.id]}]});
  }
  cityTs.referenceDocuments.unshift(pixelArtWorldCityGuide('ST-Convi-E01.png',png('ST-Convi-E01.png')));
  // Check the real engine collision contract, not only metadata's advisory flags.
  const movement=[];
  for(const map of Object.values(p.maps)){
   const seed=map.id===city.id?plan.start:links.find(l=>l.to===map.id).spawn,queue=[seed],seen=new Set([seed.y*map.width+seed.x]);
   for(let q=0;q<queue.length;q++)for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){const a=queue[q],x=a.x+dx,y=a.y+dy,index=y*map.width+x;if(!seen.has(index)&&canMove(p,map,a.x,a.y,x,y)){seen.add(index);queue.push({x,y});}}
   const link=links.find(l=>l.to===map.id);
   const targets=map.id===city.id?links.flatMap(l=>Array.from({length:l.entranceWidth},(_,dx)=>({x:l.approach.x+dx,y:l.approach.y}))):[link.exit,{x:link.exit.x+1,y:link.exit.y},...roomSpecs[link.sceneId].scene.approachCells.map(a=>({x:a.x+1,y:a.y+1}))];
   for(const target of targets)if(!seen.has(target.y*map.width+target.x))throw Error(`Engine collision blocks ${map.id} at ${target.x},${target.y}`);
   movement.push({mapId:map.id,reachable:seen.size,targets:targets.length});
  }
  const serialized=serialize(p),again=deserialize(serialized);
  return {project:JSON.parse(serialized),rendered,links,movement,roundtripMaps:JSON.stringify(again.maps)===JSON.stringify(p.maps)};
 },{files,plan,auto});
 await writeFile('output/paw-city/authored.json',JSON.stringify(result.project));
 for(const[id,url]of Object.entries(result.rendered))await writeFile(`output/paw-city/${id}.png`,Buffer.from(url.split(',')[1],'base64'));
 await writeFile('output/paw-city/assembly-report.json',JSON.stringify({links:result.links,movement:result.movement,roundtripMaps:result.roundtripMaps},null,2));
 console.log({maps:Object.keys(result.project.maps).length,assets:Object.keys(result.project.assets.uploaded).length,roundtripMaps:result.roundtripMaps,movement:result.movement});
}finally{await browser.close();}
