import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {startPlayerQaServer} from '../lib/runtimeQaRun.mjs';
const out='verify-shots/slates-reference';
const project=JSON.parse(await readFile(`${out}/reloaded-project.json`,'utf8'));
const {maps}=JSON.parse(await readFile(`${out}/layout.json`,'utf8'));
const browser=await chromium.launch({args:['--use-gl=swiftshader','--disable-gpu']});
const errors=[],observations=[];let server;
try{
 if(!process.argv.includes('--runtime-only')){
 const page=await browser.newPage({viewport:{width:1800,height:1100}});page.on('pageerror',e=>errors.push({surface:'editor',message:e.message}));
 await page.goto('http://127.0.0.1:9803/?devProject=1&freshProject=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(async()=>{const{getGame}=await import('/src/app/mode.ts');return getGame()?.scene.getScenes(true).some(s=>s.sys.settings.key==='EditScene');},null,{timeout:120000});
 await page.evaluate(async project=>{const{deserialize}=await import('/src/project/io.ts');const{store}=await import('/src/project/store.ts');const{editorState}=await import('/src/editor/editorState.ts');store.replaceProject(deserialize(JSON.stringify(project)));editorState.set({currentMapId:project.startMapId,zoom:1.5,layer:'lower',tool:'select',showGrid:false});},project);
 const mapTab=page.getByTestId("sidebar-maps");if(await mapTab.count())await mapTab.click();
 for(const spec of maps){
  await page.evaluate(async id=>{const{editorState}=await import('/src/editor/editorState.ts');editorState.set({currentMapId:id,zoom:1.5,layer:'lower',tool:'select',showGrid:false});},spec.id);
  await page.waitForFunction(async id=>{const{getGame}=await import('/src/app/mode.ts');const{store}=await import('/src/project/store.ts');const{uploadedTilesetTextureKey}=await import('/src/assets/uploadedTilesets.ts');const g=getGame(),ts=store.getCurrent().tilesets.slates_reference_32;return g?.canvas?.isConnected&&g.scene.getScenes(true).some(s=>s.mapId?.()===id)&&g.textures.exists(uploadedTilesetTextureKey(ts));},spec.id,{timeout:60000});
  await page.waitForSelector('[data-testid="edit-canvas"] canvas',{state:'visible',timeout:60000});
  await page.waitForTimeout(700);
  await page.screenshot({path:`${out}/${spec.id}-editor.png`});
  const png=await page.evaluate(async id=>{const{store}=await import('/src/project/store.ts');const{createMapScreenshot}=await import('/src/editor/mapScreenshot.ts');const project=store.getCurrent();const result=await createMapScreenshot(project,project.maps[id]);return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(result.blob);});},spec.id);
  await writeFile(`${out}/${spec.id}-map.png`,Buffer.from(png.split(',')[1],'base64'));
  console.log('editor captured',spec.id);
 }
 await page.close();
 }
 server=await startPlayerQaServer();
 for(const spec of maps){
  const p=await browser.newPage({viewport:{width:1088,height:960}});p.on('pageerror',e=>errors.push({surface:spec.id,message:e.message}));
  const doc={...project,startMapId:spec.id,startPos:spec.start};
  await p.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/slates-reference.json',saveNamespace:'slates-reference-preview',qaInstrumentation:true};});
  await p.route('**/slates-reference.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(doc)}));
  await p.goto(server.url+'/player.html',{waitUntil:'domcontentloaded'});
  await p.waitForSelector('[data-testid="title-screen"]',{timeout:30000}).catch(async()=>{
   console.log('retry player boot',spec.id,await p.locator('body').innerText().then(t=>t.slice(0,500)));
   await p.reload({waitUntil:'domcontentloaded'});
   await p.waitForSelector('[data-testid="title-screen"]',{timeout:60000});
  });await p.keyboard.press('Enter');
  await p.waitForFunction(id=>window.__oprnDebug?.readState().currentMapId===id,spec.id,{timeout:60000});
  await p.waitForTimeout(400);
  const observed=await p.evaluate(()=>({state:window.__oprnDebug.readState(),sprite:window.__oprnPlayerSprite()}));
  observations.push({mapId:spec.id,...observed});
  await p.screenshot({path:`${out}/${spec.id}-runtime.png`});
  console.log('runtime captured',spec.id,JSON.stringify(observed.sprite));await p.close();
 }
 await writeFile(`${out}/observations.json`,JSON.stringify({observations,errors},null,2));
 await writeFile(`${out}/SUMMARY.md`,`# Slates reference maps\n\nSupabase project: rpg-zzu-slates32-38e6; captures use reloaded-project.json.\nThree editable 17×15 maps, 32px cells; original grove preserved.\nSource Slates atlases + source-rectangle recipes, no screenshot pixels in map artwork.\nRuntime captures use the dedicated player.html/export shim.\nPage errors: ${errors.length}.\n\n즉시 확인:\n${maps.map(s=>`- ${s.id}-map.png (editor map PNG export), ${s.id}-editor.png (editor), ${s.id}-runtime.png (player)`).join('\n')}\n\nSave/reload proof: persistence.json.\nFull test suites / typecheck were not run under session rules.\n`);
 console.log(JSON.stringify({errors}));
}finally{await browser.close();await server?.close();}
