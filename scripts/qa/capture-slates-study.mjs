import {chromium} from 'playwright';import{readFile,writeFile}from'node:fs/promises';
const file=process.argv[2]??'verify-shots/slates-study/project.json';const raw=await readFile(file,'utf8');const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1800,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
await page.goto('http://127.0.0.1:9803/?devProject=1&freshProject=1',{waitUntil:'domcontentloaded'});
await page.waitForFunction(async()=>{const{getGame}=await import('/src/app/mode.ts');return getGame()?.scene.getScenes(true).some(s=>s.sys.settings.key==='EditScene');},null,{timeout:120000});
await page.evaluate(async raw=>{const{deserialize}=await import('/src/project/io.ts');const{store}=await import('/src/project/store.ts');const{editorState}=await import('/src/editor/editorState.ts');store.replaceProject(deserialize(raw));editorState.set({currentMapId:'slates_study',zoom:1,layer:'lower',tool:'select',showGrid:false});},raw);
await page.waitForFunction(async()=>{const{getGame}=await import('/src/app/mode.ts');const g=getGame();return g?.canvas?.isConnected&&g.scene.getScenes(true).some(s=>s.mapId?.()==='slates_study')&&g.textures.exists('uploaded_tileset:slates_study_atlas:32:56:1235');},null,{timeout:60000});
await page.waitForSelector('[data-testid="edit-canvas"] canvas',{state:'visible',timeout:60000});
const tab=page.getByTestId('sidebar-maps');if(await tab.count())await tab.click();
await page.waitForTimeout(600);await page.screenshot({path:'verify-shots/slates-study/editor.png'});
const result=await page.evaluate(async()=>{const{store}=await import('/src/project/store.ts');const{createMapScreenshot}=await import('/src/editor/mapScreenshot.ts');const project=store.getCurrent(),map=project.maps.slates_study;const s=await createMapScreenshot(project,map);const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(s.blob);});return{dataUrl,width:s.width,height:s.height,kits:project.tilesets.slates_study_32.structureKits.length};});
await writeFile('verify-shots/slates-study/map.png',Buffer.from(result.dataUrl.split(',')[1],'base64'));
await writeFile('verify-shots/slates-study/editor-observation.json',JSON.stringify({source:file,width:result.width,height:result.height,kits:result.kits,errors},null,2));console.log({width:result.width,height:result.height,kits:result.kits,errors});
}finally{await browser.close();}
