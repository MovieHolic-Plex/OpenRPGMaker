import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
const file=process.argv[2]??'verify-shots/slates32/project.json';
const raw=await readFile(file,'utf8');
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1800,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
await page.goto('http://127.0.0.1:9803/?devProject=1&freshProject=1',{waitUntil:'domcontentloaded'});
await page.waitForFunction(async()=>{const{getGame}=await import('/src/app/mode.ts');return getGame()?.scene.getScenes(true).some(s=>s.sys.settings.key==='EditScene');},null,{timeout:120000});
const geometry=await page.evaluate(async(raw)=>{
const{deserialize}=await import('/src/project/io.ts');const{store}=await import('/src/project/store.ts');const{editorState}=await import('/src/editor/editorState.ts');
const project=deserialize(raw);store.replaceProject(project);editorState.set({currentMapId:project.startMapId,zoom:1.5,layer:'lower',tool:'select',showGrid:false});return{tileSize:project.maps[project.startMapId].tileSize,tilesetSize:project.tilesets.slates_32.tileSize};
},raw);
await page.waitForFunction(async()=>{const{getGame}=await import('/src/app/mode.ts');return getGame()?.scene.getScenes(true).some(s=>s.mapId?.()==='slates_grove') && getGame().textures.exists('tex_slates_32');});
await page.waitForFunction(async()=>{const{getGame}=await import('/src/app/mode.ts');const g=getGame();const c=g?.canvas;return c?.isConnected && c.getBoundingClientRect().width>100 && g.loop.frame>5 && g.scene.getScenes(true).some(s=>s.mapId?.()==='slates_grove');},null,{timeout:60000});
await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
await page.waitForSelector('[data-testid="edit-canvas"] canvas',{state:'visible',timeout:60000});
await page.screenshot({path:'verify-shots/slates32/editor.png'});
await writeFile('verify-shots/slates32/editor-observation.json',JSON.stringify({source:file,geometry,errors},null,2));
console.log(JSON.stringify({geometry,errors}));
}finally{await browser.close();}
