import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
const dir='verify-shots/slates-astra-experiment',file=process.argv[2]??`${dir}/project.json`,raw=await readFile(file,'utf8'),b=JSON.parse(await readFile(`${dir}/bundle.json`,'utf8'));
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1800,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:9803/?devProject=1&freshProject=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(async()=>{try{const{getGame}=await import('/src/app/mode.ts');return getGame()?.scene.getScenes(true).some(s=>s.sys.settings.key==='EditScene');}catch{return false;}},null,{timeout:120000});
 await page.evaluate(async({raw,id})=>{const{deserialize}=await import('/src/project/io.ts');const{store}=await import('/src/project/store.ts');const{editorState}=await import('/src/editor/editorState.ts');store.replaceProject(deserialize(raw));editorState.set({currentMapId:id,zoom:0.5,layer:'lower',tool:'select',showGrid:false});},{raw,id:b.map.id});
 await page.waitForFunction(async({mapId,tsId})=>{const{getGame}=await import('/src/app/mode.ts');const{store}=await import('/src/project/store.ts');const{uploadedTilesetTextureKey}=await import('/src/assets/uploadedTilesets.ts');const g=getGame();return g?.canvas?.isConnected&&g.scene.getScenes(true).some(s=>s.mapId?.()===mapId)&&g.textures.exists(uploadedTilesetTextureKey(store.getCurrent().tilesets[tsId]));},{mapId:b.map.id,tsId:b.tileset.id},{timeout:60000});
 await page.waitForSelector('[data-testid="edit-canvas"] canvas',{state:'visible',timeout:60000});
 const tab=page.getByTestId('sidebar-maps');if(await tab.count())await tab.click();
 await page.waitForTimeout(500);await page.screenshot({path:`${dir}/editor.png`});
 const result=await page.evaluate(async b=>{
  const{store}=await import('/src/project/store.ts');const{createMapScreenshot}=await import('/src/editor/mapScreenshot.ts');const{canMove,isPassable}=await import('/src/project/collision.ts');const p=store.getCurrent(),m=p.maps[b.map.id],ts=p.tilesets[m.tilesetId],idx=(x,y)=>y*m.width+x;
  const walk=(sealed=false)=>{const seen=new Set([idx(b.spawn.x,b.spawn.y)]),q=[b.spawn];for(let i=0;i<q.length;i++){const a=q[i];for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=a.x+dx,y=a.y+dy,n=idx(x,y);if(sealed&&y===44&&x>=24&&x<=27)continue;if(!seen.has(n)&&canMove(p,m,a.x,a.y,x,y)){seen.add(n);q.push({x,y});}}}return seen;};
  const seen=walk(),sealed=walk(true),s=await createMapScreenshot(p,m);
  const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(s.blob);});
  return{dataUrl,width:s.width,height:s.height,tileSize:m.tileSize,validArrays:m.lowerTiles.length===2500&&m.upperTiles.length===2500&&m.lowerTiles.every(t=>Number.isInteger(t)&&t>=0&&t<ts.count)&&m.upperTiles.every(t=>Number.isInteger(t)&&t>=-1&&t<ts.count),spawnPassable:isPassable(p,m,b.spawn.x,b.spawn.y),reachableCells:seen.size,landmarks:b.landmarks.map(l=>({...l,reachable:seen.has(idx(l.x,l.y))})),sealedGateBlocksPlaza:!sealed.has(idx(27,21)),mapCount:Object.keys(p.maps).length};
 },b);
 const{dataUrl,...observation}=result;await writeFile(`${dir}/editor-map.png`,Buffer.from(dataUrl.split(',')[1],'base64'));
 await writeFile(`${dir}/engine-observation.json`,JSON.stringify({source:file,...observation,errors},null,2));
 if(!result.validArrays||!result.spawnPassable||!result.sealedGateBlocksPlaza||result.landmarks.some(l=>!l.reachable)||errors.length)throw Error('Editor content observation failed');
 console.log({width:result.width,height:result.height,reachableCells:result.reachableCells,reachableLandmarks:result.landmarks.length,wallEnclosed:result.sealedGateBlocksPlaza,errors});
}finally{await browser.close();}
