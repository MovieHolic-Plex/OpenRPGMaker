import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'verify-shots/tile-geometry';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto('http://127.0.0.1:9803/?devProject=1&freshProject=1',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>typeof window.__oprnEditorTool==='function',null,{timeout:120000});
await page.waitForFunction(async()=>{const {getGame}=await import('/src/app/mode.ts');return getGame()?.scene.getScenes(true).some(s=>s.sys.settings.key==='EditScene');},null,{timeout:120000});
console.log('editor ready');
const fixture=await page.evaluate(async()=>{
const {store}=await import('/src/project/store.ts');
const {editorState}=await import('/src/editor/editorState.ts');
const project=structuredClone(store.getCurrent());
project.meta.title='Tile geometry QA';
project.maps={};project.mapTree={mapId:'geometry32',children:[{mapId:'geometry16',children:[]}]};
project.startMapId='geometry32';project.startPos={x:2,y:2};
project.tilesets={};
for(const size of [16,32]){
 const id='geometry'+size,canvas=document.createElement('canvas');canvas.width=size*3;canvas.height=size;
 const ctx=canvas.getContext('2d');
 ['#467568','#cb6254','#e8c36a'].forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(i*size,0,size,size);ctx.strokeStyle='#172e37';ctx.strokeRect(i*size+.5,.5,size-1,size-1);ctx.fillStyle='#ffffff';ctx.font=`${size/3}px sans-serif`;ctx.fillText(String(size),i*size+2,size-4);});
 project.assets.uploaded[id]={id,kind:'chipset',name:id,dataUrl:canvas.toDataURL(),meta:{tileSize:size,width:size*3,height:size,frames:3}};
 const open={up:true,down:true,left:true,right:true},closed={up:false,down:false,left:false,right:false};
 project.tilesets[id]={id,name:id,kind:'custom',image:{type:'uploaded',id},tileSize:size,tilesPerRow:3,count:3,passability:[open,closed,open],priority:['lower','lower','lower'],terrain:[0,0,0]};
 const cells=Array(20*15).fill(0);cells[2*20+4]=1;
 project.maps[id]={id,name:id,width:20,height:15,tileSize:size,tilesetId:id,lowerTiles:cells,upperTiles:Array(300).fill(-1),events:[],bgm:{mode:'none'},encounters:[]};
}
for (const size of [16,32]) {
 const map=project.maps['geometry'+size];
 map.upperTiles[6*20+5]=1;
 map.events.push({id:'door'+size,x:size===32?3:2,y:3,trigger:{kind:'action'},commands:[],pages:[{id:'page'+size,name:'Transfer',conditions:[],graphic:{transparent:true},trigger:{kind:'action'},priority:'same',overlapForbidden:true,movement:{type:'fixed',speed:3,frequency:3},commands:[{kind:'transfer',mapId:size===32?'geometry16':'geometry32',x:size===32?2:14,y:size===32?2:10,fade:'none'}]}]});
}
store.replaceProject(project);
editorState.set({currentMapId:'geometry32',zoom:2,layer:'lower',tool:'paint',selectedTile:2});
return project;
});
await writeFile(`${out}/fixture.json`,JSON.stringify(fixture));
await page.waitForFunction(async()=>{
const {getGame}=await import('/src/app/mode.ts');const game=getGame();return game?.scene.getScenes(true).some(s=>s.sys.settings.key==='EditScene' && s.mapId()==='geometry32') && game.textures.exists('uploaded_tileset:geometry32:32:3:3');},null,{timeout:30000});
const geometry=await page.evaluate(async()=>{
const {getGame}=await import('/src/app/mode.ts');const game=getGame();const scene=game.scene.getScenes(true).find(s=>s.sys.settings.key==='EditScene')??game.scene.getScenes(true)[0];
window.__geometryScene=scene;
const canvas=game.canvas.getBoundingClientRect(),camera=scene.cameras.main;const frame=game.textures.get('uploaded_tileset:geometry32:32:3:3').get('tile_2');
return {key:scene.sys.settings.key,frame:{width:frame.width,height:frame.height,cutX:frame.cutX},zoom:camera.zoom,camera:{x:camera.worldView.x,y:camera.worldView.y},click:{x:canvas.left+(5.5*32-camera.worldView.x)*camera.zoom,y:canvas.top+(4.5*32-camera.worldView.y)*camera.zoom}};
});
console.log(JSON.stringify(geometry));
await page.mouse.click(geometry.click.x,geometry.click.y);
const after=await page.evaluate(async()=>{
const {store}=await import('/src/project/store.ts');const {editorState}=await import('/src/editor/editorState.ts');return {tile:store.getCurrent().maps.geometry32.lowerTiles[4*20+5],state:editorState.get()};});
await page.screenshot({path:`${out}/editor32.png`});
await writeFile(`${out}/editor-observation.json`,JSON.stringify({geometry,paintedTile:after.tile,editorState:after.state,errors},null,2));
console.log(JSON.stringify({paintedTile:after.tile,errors}));
}finally{await browser.close();}
