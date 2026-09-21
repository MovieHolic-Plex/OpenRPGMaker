// Build the requested Slates sample only after geometry support has been inspected.
// The accompanying save script persists this document, reloads it, and captures that reload.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out='verify-shots/slates32';await mkdir(out,{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1800,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
await page.goto('http://127.0.0.1:9803/?devProject=1&freshProject=1',{waitUntil:'domcontentloaded'});
await page.waitForFunction(async()=>{const {getGame}=await import('/src/app/mode.ts');return getGame()?.scene.getScenes(true).some(s=>s.sys.settings.key==='EditScene');},null,{timeout:120000});
const project=await page.evaluate(async()=>{
const {store}=await import('/src/project/store.ts');const {editorState}=await import('/src/editor/editorState.ts');
const {createSlates32Tileset}=await import('/src/project/defaults/slates32.ts');
const project=structuredClone(store.getCurrent());const ts=createSlates32Tileset();
project.meta.title='Slates · 숲속 쉼터';project.meta.author='Tile layout: OPRN Studio · Tiles: Ivan Voirol (CC BY 4.0)';
project.tilesets={slates_32:ts};project.maps={};project.mapTree={mapId:'slates_grove',children:[]};project.startMapId='slates_grove';project.startPos={x:11,y:12};
const map={id:'slates_grove',name:'Slates 32×32 · 숲속 쉼터',width:24,height:16,tileSize:32,tilesetId:ts.id,lowerTiles:Array(384).fill(57),upperTiles:Array(384).fill(-1),events:[],bgm:{mode:'none'},encounters:[]};
const tile=(x,y)=>y*56+x;
const ground=(x,y,t)=>{if(x>=0&&x<24&&y>=0&&y<16)map.lowerTiles[y*24+x]=t;};
const overlay=(x,y,t,solid=false,above=false)=>{map.upperTiles[y*24+x]=t;ts.priority[t]='upper';ts.passability[t]=solid?{up:false,down:false,left:false,right:false}:{up:true,down:true,left:true,right:true};ts.tileMeta[t]={label:solid?'나무 밑동 / 바위':'수관 / 풀꽃',description:'Slates 숲속 쉼터에서 사용한 조각',source:'user',defaultLayer:'upper',userLocked:true,...(above?{passage:'star'}:{})};};
// Dirt path, stepping through the clearing with a wider rest area.
for(let y=0;y<16;y++)for(let x=10;x<=11;x++)ground(x,y,tile(9,1));
for(let y=8;y<=9;y++)for(let x=2;x<=21;x++)ground(x,y,tile(9,1));
for(let y=6;y<=11;y++)for(let x=8;x<=15;x++)ground(x,y,tile(9,1));
for(let y=7;y<=10;y++)for(let x=9;x<=14;x++)ground(x,y,tile(13,1));
// Multi-cell source rectangles stay together: two-column, three-row trees.
const tree=(x,y,sx)=>{for(let dy=0;dy<3;dy++)for(let dx=0;dx<2;dx++)overlay(x+dx,y+dy,tile(sx+dx,18+dy),dy===2,dy<2);};
for(const [x,y,sx] of [[1,0,12],[5,1,8],[15,0,12],[20,1,8],[1,4,8],[5,4,12],[17,4,12],[21,5,8],[1,10,12],[5,12,8],[16,12,12],[21,11,8]])tree(x,y,sx);
for(const [x,y]of [[4,1],[7,3],[17,2],[19,6],[3,7],[6,10],[17,10],[20,9],[2,14],[14,13],[19,14]])overlay(x,y,tile(15,18));
for(const [x,y,c]of [[7,1,13],[3,4,14],[8,4,15],[12,3,13],[19,3,14],[22,8,15],[4,10,13],[7,13,14],[13,12,13],[19,12,15],[9,14,14],[22,14,13]])overlay(x,y,tile(c,11));
for(const [x,y]of [[4,12],[18,8],[16,4]])overlay(x,y,tile(12,17),true);
project.maps[map.id]=map;
store.replaceProject(project);editorState.set({currentMapId:map.id,zoom:1.5,layer:'event',tool:'select',showGrid:false});
return project;
});
await writeFile(`${out}/project.json`,JSON.stringify(project));
console.log(JSON.stringify({title:project.meta.title,map:project.startMapId,tileSize:32,errors}));
}finally{await browser.close();}
