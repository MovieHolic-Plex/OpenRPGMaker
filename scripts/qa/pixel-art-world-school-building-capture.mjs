// Direct player observations of the just-reloaded canonical school.
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {startPlayerQaServer} from '../lib/runtimeQaRun.mjs';
const out=process.env.PAW_SCHOOL_OUTPUT??'output/paw-school-four';
const source=JSON.parse(await readFile(`${out}/reloaded-portable.json`,'utf8'));
// Authoring documents have no player behavior; keep all map, event, collision
// and asset data while avoiding a second renderer copy of the AI image library.
for(const tileset of Object.values(source.tilesets)){delete tileset.referenceDocuments;delete tileset.structureKits;}
delete source.spatialAuthoring;
const project=JSON.stringify(source);
const report=JSON.parse(await readFile(`${out}/assembly-report.json`,'utf8'));
const blueprint=JSON.parse(await readFile('src/assets/pixelArtWorldSchoolBuilding.json','utf8'));
const server=await startPlayerQaServer();
const browser=await chromium.launch({args:['--use-gl=swiftshader','--disable-gpu']});
const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[],stairs=[],rooms=[],lockers=[];
page.on('pageerror',e=>errors.push(e.message));
const idle=()=>page.waitForFunction(()=>{const s=window.__oprnHooksScene;return s&&!s.running&&!s.moving&&!s.cameras.main.fadeEffect.isRunning;});
async function teleport(map,x,y){await idle();await page.evaluate(({map,x,y})=>window.__oprnDebug.teleport(map,x,y),{map,x,y});await page.waitForFunction(({map,x,y})=>{const s=window.__oprnDebug.readState();return s.currentMapId===map&&s.x===x&&s.y===y;},{map,x,y});await idle();}
async function walk(direction,map,x,y){await page.evaluate(d=>window.__oprnInput.dir(d),direction);try{await page.waitForFunction(({map,x,y})=>{const s=window.__oprnDebug.readState();return s.currentMapId===map&&s.x===x&&s.y===y;},{map,x,y},{timeout:12000});}finally{await page.evaluate(()=>window.__oprnInput.dir(null));}await idle();}
try{
 await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/school-local.json',saveNamespace:'paw-school-observation',qaInstrumentation:true};});
 await page.route('**/school-local.json',r=>r.fulfill({status:200,contentType:'application/json',body:project}));
 await page.goto(server.url+'/player.html',{waitUntil:'domcontentloaded'});
 await page.getByTestId('title-screen').waitFor({timeout:120000});await page.keyboard.press('Enter');await idle();
 for(const link of report.links){
  await teleport(link.from,link.approach.x,link.approach.y);
  await page.evaluate(()=>{window.__oprnInput.face('up');window.__oprnInput.action();});
  await page.waitForFunction(({to,spawn})=>{const s=window.__oprnDebug.readState();return s.currentMapId===to&&s.x===spawn.x&&s.y===spawn.y;},link,{timeout:15000});await idle();
  stairs.push(link);console.log('stairs',link.from,link.to,link.at.x);
 }
 for(const floor of blueprint.floors){
  for(const room of floor.rooms){
   const north=room.door.y>room.y,x=room.door.x,outer=north?room.door.y+room.door.height:room.door.y-1,inner=north?room.door.y-1:room.door.y+room.door.height;
   await teleport(floor.id,x,outer);await walk(north?'up':'down',floor.id,x,inner);
   if(room.kind==='classroom'){
    const y=room.y+12;
    if(y!==inner)await walk(y>inner?'down':'up',floor.id,x,y);
    await walk('left',floor.id,room.x+2,y);await walk('right',floor.id,x,y);
    if(y!==inner)await walk(y>inner?'up':'down',floor.id,x,inner);
    lockers.push({floor:floor.id,room:room.name,frontCells:[2,3,4].map(dx=>({x:room.x+dx,y})),walkedFromDoor:true});
   }
   await walk(north?'down':'up',floor.id,x,outer);rooms.push({floor:floor.id,room:room.name,bothDirections:true});
  }
  const focus=floor.rooms[floor.level===3?2:0].center;await teleport(floor.id,focus.x,focus.y);await page.waitForTimeout(500);await idle();await page.screenshot({path:`${out}/runtime-${floor.id}.png`});console.log('rooms',floor.id);
 }
 const entrance=report.cityEntrance;
 for(let dx=0;dx<2;dx++){
  await teleport('paw_city',entrance.approach.x+dx,entrance.approach.y);
  await page.evaluate(()=>{window.__oprnInput.face('up');window.__oprnInput.action();});
  await page.waitForFunction(()=>window.__oprnDebug.readState().currentMapId==='paw-school-floor-1');await idle();
  await walk(blueprint.floors[0].entrance.direction??'down','paw_city',entrance.approach.x,entrance.approach.y);
 }
 await writeFile(`${out}/runtime-observation.json`,JSON.stringify({stairs:stairs.length,rooms,lockers,cityDoors:2,errors},null,2));
 await writeFile(`${out}/SUMMARY.md`,`# School observation\n\nCanonical reload, direct player entry. ${stairs.length} stair transfers; ${rooms.length} doors walked both ways in the same map; ${lockers.length} locker fronts reached from classroom doors; 2 city door entries and exits. Browser errors: ${errors.length}.\n\n즉시 확인: runtime-paw-school-floor-1.png, runtime-paw-school-floor-3.png.\n`);
 console.log({stairs:stairs.length,rooms:rooms.length,lockers:lockers.length,cityDoors:2,errors});
}catch(error){await page.screenshot({path:`${out}/runtime-failure.png`});console.log({errors,state:await page.evaluate(()=>window.__oprnDebug?.readState())});throw error;}
finally{await browser.close();await server.close();}
