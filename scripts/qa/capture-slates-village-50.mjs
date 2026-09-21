import {chromium} from 'playwright';import{readFile,writeFile}from'node:fs/promises';
const file=process.argv[2]??'verify-shots/slates-village-50/project.json';const raw=await readFile(file,'utf8');const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1800,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
await page.goto('http://127.0.0.1:9803/?devProject=1&freshProject=1',{waitUntil:'domcontentloaded'});
await page.waitForFunction(async()=>{const{getGame}=await import('/src/app/mode.ts');return getGame()?.scene.getScenes(true).some(s=>s.sys.settings.key==='EditScene');},null,{timeout:120000});
await page.evaluate(async raw=>{const{deserialize}=await import('/src/project/io.ts');const{store}=await import('/src/project/store.ts');const{editorState}=await import('/src/editor/editorState.ts');store.replaceProject(deserialize(raw));editorState.set({currentMapId:'slates_village_50',zoom:0.5,layer:'lower',tool:'select',showGrid:false});},raw);
await page.waitForFunction(async()=>{const{getGame}=await import('/src/app/mode.ts');const {store}=await import('/src/project/store.ts');const{uploadedTilesetTextureKey}=await import('/src/assets/uploadedTilesets.ts');const g=getGame();return g?.canvas?.isConnected&&g.scene.getScenes(true).some(s=>s.mapId?.()==='slates_village_50')&&g.textures.exists(uploadedTilesetTextureKey(store.getCurrent().tilesets.slates_village_32));},null,{timeout:60000});
await page.waitForSelector('[data-testid="edit-canvas"] canvas',{state:'visible',timeout:60000});
const tab=page.getByTestId('sidebar-maps');if(await tab.count())await tab.click();
await page.waitForTimeout(600);await page.screenshot({path:'verify-shots/slates-village-50/editor.png'});
const result=await page.evaluate(async()=>{const{store}=await import('/src/project/store.ts');const{createMapScreenshot}=await import('/src/editor/mapScreenshot.ts');const project=store.getCurrent(),map=project.maps.slates_village_50;const s=await createMapScreenshot(project,map);const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(s.blob);});return{dataUrl,width:s.width,height:s.height,kits:project.tilesets.slates_village_32.structureKits.length};});
const layout=JSON.parse(await readFile('verify-shots/slates-village-50/layout.json','utf8'));
const collision=await page.evaluate(async layout=>{
 const {store}=await import('/src/project/store.ts');const{canMove,isPassable}=await import('/src/project/collision.ts');const p=store.getCurrent(),m=p.maps.slates_village_50,ts=p.tilesets[m.tilesetId];
 const idx=(x,y)=>y*m.width+x,seen=new Set([idx(p.startPos.x,p.startPos.y)]),queue=[p.startPos];
 for(let q=0;q<queue.length;q++){const a=queue[q];for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=a.x+dx,y=a.y+dy,n=idx(x,y);if(!seen.has(n)&&canMove(p,m,a.x,a.y,x,y)){seen.add(n);queue.push({x,y});}}}
 const goals=layout.landmarks.map(l=>({...l,engineReachable:seen.has(idx(l.x,l.y))}));
 const valid=m.lowerTiles.length===2500&&m.upperTiles.length===2500&&m.lowerTiles.every(t=>t>=0&&t<ts.count)&&m.upperTiles.every(t=>t>=-1&&t<ts.count);
 return{validTileArrays:valid,tileSize:m.tileSize,reachableCells:seen.size,landmarks:goals,waterBlocked:!isPassable(p,m,20,36),bridgesPassable:[14,15,36,37].every(x=>[34,35,36,37,38].every(y=>isPassable(p,m,x,y))),preservedMaps:Object.keys(p.maps).filter(id=>id!==m.id)};
},layout);
await writeFile('verify-shots/slates-village-50/collision-observation.json',JSON.stringify(collision,null,2));
if(!collision.validTileArrays||!collision.waterBlocked||!collision.bridgesPassable||collision.landmarks.some(l=>!l.engineReachable))throw Error('Engine collision audit failed');
await writeFile('verify-shots/slates-village-50/map.png',Buffer.from(result.dataUrl.split(',')[1],'base64'));
await writeFile('verify-shots/slates-village-50/editor-observation.json',JSON.stringify({source:file,width:result.width,height:result.height,kits:result.kits,errors},null,2));console.log({width:result.width,height:result.height,kits:result.kits,errors});
}finally{await browser.close();}
