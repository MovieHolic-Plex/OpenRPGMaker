import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url)), root=process.cwd();
const sourcePath=join(root,'src/project/seasonalForage.ts');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceBefore=hash(await readFile(sourcePath));
assert.equal(sourceBefore,'5c80ae0b3e413b0fac294c4ab50c821c07a4b14f3d804046465263399189e09d','Unexpected current expiry source');
const server=await createServer({configFile:false,envFile:false,root,cacheDir:join(out,'forage-date-cache'),resolve:{alias:{'@':join(root,'src')}},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
const rows=[];
try{
 const {createBlankProject}=await server.ssrLoadModule('/src/project/defaults.ts');
 const {normalizeItemRecord}=await server.ssrLoadModule('/src/project/databaseRecordModel.ts');
 const {startSession}=await server.ssrLoadModule('/src/project/session.ts');
 const forage=await server.ssrLoadModule('/src/project/seasonalForage.ts');
 for(const year of [1,Number.MAX_SAFE_INTEGER]){
  const project=createBlankProject(), map=project.maps[project.startMapId];
  project.database.items.push(normalizeItemRecord({id:'date-berry',name:'Berry',scope:'none'}));
  map.lowerTiles.fill(0);map.upperTiles.fill(-1);
  project.tilesets[map.tilesetId].passability[0]={up:true,down:true,left:true,right:true};
  project.system.timeSystem={enabled:true,dayStartHour:6,dayEndHour:26,daysPerSeason:28};
  project.system.skillSystem={enabled:false};
  const session=startSession(project,1010);
  project.system.seasonalForage={enabled:true,areas:[{id:'date-area',mapId:map.id,area:{x:1,y:1,w:1,h:1},dailySpawnCount:1,maxActive:1,despawnAfterDays:1,entries:[{id:'date-entry',itemId:'date-berry',weight:1}]}]};
  session.gameTime={year,season:'spring',day:1,hour:6,minute:0};
  const generated=forage.advanceSeasonalForage(project,session,session.gameTime);
  assert.equal(generated.ok,true);assert.equal(generated.spawned,1);
  session.gameTime={...session.gameTime,day:3};
  const before=structuredClone(session);
  const resolved=forage.resolveForageAt(project,session,map.id,1,1);
  const collected=forage.collectForageAt(project,session,map.id,1,1);
  rows.push({year,spawnedDay:1,liveDay:3,despawnAfterDays:1,generated,resolved,collected,inventory:session.inventory['date-berry']??0,stateUnchanged:JSON.stringify(session)===JSON.stringify(before)});
 }
 const sourceAfter=hash(await readFile(sourcePath));
 assert.equal(sourceAfter,sourceBefore,'Source changed while probing; result inconclusive');
 await writeFile(join(out,'forage-date-result.json'),JSON.stringify({sourceBefore,sourceAfter,rows},null,2)+'\n');
 console.log(JSON.stringify({sourceBefore,rows}));
 for(const row of rows){assert.equal(row.resolved.ok,false,'Expired forage must refuse for accepted calendar year '+row.year);assert.equal(row.collected.ok,false);assert.equal(row.stateUnchanged,true);}
}finally{await server.close();await rm(join(out,'forage-date-cache'),{recursive:true,force:true});console.log('FORAGE_DATE_CLEANUP closed');}
