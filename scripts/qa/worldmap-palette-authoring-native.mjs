// Native UI evidence: start from a blank map, never import or rebuild a continent.
import {firefox,chromium} from 'playwright';
import {startHost,newEditor,stored,writeRuntimeProject} from '../../src/harnesses/assistant-capability/node/editorDriver.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
const projectDir=resolve(process.argv[2]??'qa-runs/worldmap-authoring-20261005/project-r3');
const dir=resolve(process.argv[3]??'qa-runs/worldmap-authoring-20261005/native-r1');mkdirSync(dir,{recursive:true});
process.env.OPRN_SHARED_CONTENT_SQLITE??=resolve('qa-runs/harnesses/assistant-capability/worldmap-film-20261005-03/shared-catalog-snapshot.sqlite');
process.env.OPRN_SHARED_CHARACTER_GRAPHICS_FILE??=resolve('qa-runs/harnesses/assistant-capability/worldmap-film-20261005-03/character-catalog-snapshot.json');
const receipt={projectDir,steps:[],errors:[],nativeOnly:true};const started=Date.now();
const save=()=>writeFileSync(resolve(dir,'receipt.json'),JSON.stringify(receipt,null,2));
const stage=name=>{receipt.steps.push({name,seconds:(Date.now()-started)/1000});save();console.log(name);};
const host=await startHost(projectDir,dir),browser=await (process.env.OPRN_QA_BROWSER==='chromium'?chromium.launch({headless:true,args:['--no-sandbox']}):firefox.launch({headless:true,firefoxUserPrefs:{'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false}}));
let context,page,mapId;
// Read just map arrays through existing read tools. The whole-project mirror includes
// every bundled reference/asset and can exhaust the browser's memory.
async function current(){return page.evaluate(()=>{
  const summary=window.__oprnEditorTool('get_project_summary',{});if(!summary.ok)throw Error(summary.summary);
  const map=summary.data.maps.find(m=>m.name==='팔레트로 만든 새 대륙');if(!map)throw Error('Native new map missing');
  const region=window.__oprnEditorTool('show_map_region',{mapId:map.id,x:0,y:0,w:map.width,h:map.height});
  if(!region.ok)throw Error(region.summary);
  return {maps:{[map.id]:{...map,lowerTiles:region.data.lower.flat(),upperTiles:region.data.upper.flat()}}};
});}
const sameTiles=(a,b)=>!!a&&!!b&&isDeepStrictEqual(a.lowerTiles,b.lowerTiles)&&isDeepStrictEqual(a.upperTiles,b.upperTiles);
async function xy(x,y){return page.evaluate(([x,y])=>window.__oprnEditWorldToClient((x+.5)*16,(y+.5)*16),[x,y]);}
async function clickCell(x,y){const p=await xy(x,y);await page.mouse.click(p.x,p.y);}
async function brush(id,bg,layer='lower'){
  await page.getByTestId('layer-'+layer).click();if(bg)await page.getByTestId('worldmap-brush-background').selectOption(bg);
  await page.getByTestId(id).click();await page.getByTestId('tool-paint').click();
}
async function area(id,bg,x1,y1,x2,y2,layer='lower',shape='round'){
  await brush(id,bg,layer);await page.getByTestId('paint-shape-select').selectOption(shape);
  const a=await xy(x1,y1),b=await xy(x2,y2);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.up();
}
async function path(id,bg,points,layer='lower'){
  await brush(id,bg,layer);await page.getByTestId('paint-shape-select').selectOption('pen');
  const a=await xy(...points[0]);await page.mouse.move(a.x,a.y);await page.mouse.down();
  for(const point of points.slice(1)){const b=await xy(...point);await page.mouse.move(b.x,b.y,{steps:Math.ceil(Math.max(8,Math.abs(b.x-a.x)/6))});}await page.mouse.up();
}
async function icon(id,x,y){await page.getByTestId('layer-upper').click();await page.getByTestId('tool-paint').click();await page.getByTestId('structure-kit-wmi-fantasy/'+id).click();await clickCell(x,y);}
try{
  stage('boot');receipt.videoBeganSeconds=(Date.now()-started)/1000;const ed=await newEditor(browser,host.url,projectDir,{}, {viewport:{width:1600,height:1004},recordVideo:{dir:resolve(dir,'video'),size:{width:1600,height:1004}},onPage:async p=>{page=p;await p.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','standard');localStorage.setItem('oprn:first-edit-guide:seen','1');});p.on('requestfailed',r=>{(receipt.networkFailures??=[]).push({path:new URL(r.url()).pathname,error:r.failure()?.errorText});save();});p.on('pageerror',e=>receipt.errors.push(e.message));p.on('console',async m=>{if(m.type()==='error'){(receipt.consoleErrors??=[]).push(m.text());if(m.text().includes('Project load failed'))receipt.loadError=await Promise.all(m.args().map(arg=>arg.evaluate(v=>({message:v?.message,name:v?.name,errorMessage:v?.errorMessage,error:v?.error,stack:v?.stack})).catch(()=>null)));save();}});}});context=ed.context;page=ed.page;
  receipt.captureStartSeconds=(Date.now()-started)/1000;stage('native-blank-map-dialog');
  await page.getByTestId('sidebar-map-switcher').click();await page.getByTestId('map-add').click();
  await page.getByTestId('map-create-worldmap-blank').click();await page.getByTestId('map-create-name').fill('팔레트로 만든 새 대륙');await page.getByTestId('map-create-confirm').click();
  const close=page.getByTestId('sidebar-maps-close');if(await close.isVisible().catch(()=>false))await close.click();
  const collapseAi=page.getByTestId('ai-collapse');if(await collapseAi.isVisible().catch(()=>false))await collapseAi.click();
  await page.getByTestId('worldmap-brush-grass-sea').waitFor();
  let p=await current();mapId=Object.keys(p.maps).find(id=>p.maps[id].name==='팔레트로 만든 새 대륙');receipt.mapId=mapId;
  receipt.blank={width:p.maps[mapId].width,height:p.maps[mapId].height,allSea:p.maps[mapId].lowerTiles.every(t=>t===0),allUpperEmpty:p.maps[mapId].upperTiles.every(t=>t===-1)};
  if(!receipt.blank.allSea||!receipt.blank.allUpperEmpty)throw Error('Native blank worldmap is not empty');
  await page.getByTestId('editor-zoom-stepper').click();await page.getByTestId('editor-zoom-1').click();await page.waitForTimeout(1000);
  await page.screenshot({path:resolve(dir,'01-empty.png')});stage('land-coasts-islands');
  await area('worldmap-brush-grass-sea','sea',4,4,31,32);
  await area('worldmap-brush-grass-sea','sea',25,23,33,31);
  await area('worldmap-brush-sand-sea','sea',35,14,44,30);
  await area('worldmap-brush-snow-sea','sea',36,3,42,9);
  await area('worldmap-brush-grass-sea','sea',2,27,5,31);
  await page.screenshot({path:resolve(dir,'02-coast.png')});stage('biomes-rivers');
  await area('worldmap-brush-snow-grass','grass',11,6,24,11);
  await area('worldmap-brush-tundra-grass','grass',9,10,23,14);
  await area('worldmap-brush-sand-grass','grass',6,23,17,30);
  await area('worldmap-brush-ash-sand','sand',36,18,43,25);
  await path('worldmap-brush-river-grass','grass',[[18,12],[18,16],[20,16],[20,18],[18,18],[18,25],[21,25],[21,32]]);
  await path('worldmap-brush-river-grass','grass',[[13,18],[16,18],[16,21],[18,21]]);
  await page.screenshot({path:resolve(dir,'03-terrain-river.png')});stage('transparent-forest-mountains');
  await area('worldmap-brush-forest-any',null,7,13,11,18,'upper');
  await area('worldmap-brush-forest-any',null,13,15,16,17,'upper');
  await area('worldmap-brush-snowforest-any',null,20,7,25,10,'upper');
  await path('worldmap-brush-mountain-any',null,[[25,11],[25,14]],'upper');
  await path('worldmap-brush-mountain-any',null,[[25,22],[27,24],[27,26]],'upper');
  await area('worldmap-brush-volcano-any',null,37,16,41,19,'upper');
  p=await current();const lowerBefore=p.maps[mapId].lowerTiles,upperBefore=p.maps[mapId].upperTiles;
  await page.getByTestId('tool-erase').click();await clickCell(9,16);const removed=await current();
  receipt.erasePreservesGround=isDeepStrictEqual(lowerBefore,removed.maps[mapId].lowerTiles);
  receipt.eraseReshapesNeighbor=upperBefore.some((tile,i)=>i!==16*48+9&&removed.maps[mapId].upperTiles[i]!==tile);
  await page.keyboard.press('Control+z');p=await current();receipt.undoRestoresForest=isDeepStrictEqual(upperBefore,p.maps[mapId].upperTiles);
  await page.keyboard.press('Control+y');stage('roads-bridge');
  await path('worldmap-brush-road-grass','grass',[[10,21],[25,21]]);
  await path('worldmap-brush-road-grass','grass',[[14,21],[14,12],[14,10]]);
  await path('worldmap-brush-road-snow','snow',[[14,10],[14,9]]);
  await path('worldmap-brush-road-sand','sand',[[10,23],[10,26]]);
  await path('worldmap-brush-road-grass','grass',[[10,21],[10,23]]);
  await brush('worldmap-brush-bridge-horizontal','grass');await clickCell(18,21);
  await page.getByTestId('layer-upper').click();await page.getByTestId('tool-erase').click();for(const y of [14,15,16,17,18])await clickCell(14,y);
  await path('worldmap-brush-road-grass','grass',[[25,21],[29,21],[29,27]]);
  await page.screenshot({path:resolve(dir,'04-roads-bridge.png')});stage('whole-approved-settlements');
  await icon('town_red',9,18);await icon('city_capital',22,15);await icon('log_village',13,6);await icon('desert_temple',9,26);await icon('harbor_town',28,27);await icon('flame_fortress',38,21);
  await page.getByTestId('layer-lower').click();await page.getByTestId('worldmap-brush-background').selectOption('grass');
  stage('native-plateau-slope');p=await current();const beforeHeight=[...p.maps[mapId].lowerTiles];
  await page.getByTestId('worldmap-brush-plateau').click();await page.keyboard.down('Shift');await clickCell(7,22);await page.keyboard.up('Shift');
  await page.getByTestId('worldmap-brush-slope').click();await clickCell(7,23);p=await current();
  receipt.plateau={sameGround:isDeepStrictEqual(beforeHeight,p.maps[mapId].lowerTiles)};
  await page.getByTestId('tool-paint').click();
  stage('native-save');await page.getByTestId('toolbar-save').click();
  const live=await current();for(let i=0;i<60;i++){if(sameTiles(stored(projectDir).project.maps[mapId],live.maps[mapId]))break;await page.waitForTimeout(1000);}
  const saved=stored(projectDir);receipt.saved={projectId:saved.projectId,revision:saved.revision,sha256:saved.sha256,sameMap:sameTiles(saved.project.maps[mapId],live.maps[mapId]),tilesetId:saved.project.maps[mapId]?.tilesetId};
  const relief=saved.project.maps[mapId]?.relief;Object.assign(receipt.plateau,{levels:relief?.levels.filter(v=>v>0).length??0,ramps:relief?.ramps?.filter(v=>v>0).length??0});
  if(!receipt.saved.sameMap)throw Error('Canonical SQLite differs from native UI');
  await page.screenshot({path:resolve(dir,'05-final.png')});writeRuntimeProject(projectDir,resolve(dir,'live.json'));receipt.videoPath=await page.video().path();await context.close();context=null;
  stage('fresh-browser-reload');const fresh=await newEditor(browser,host.url,projectDir,{});context=fresh.context;page=fresh.page;
  await page.getByTestId('sidebar-map-switcher').click();await page.getByTestId('map-tree-node-'+mapId).click();if(await page.getByTestId('sidebar-maps-close').isVisible().catch(()=>false))await page.getByTestId('sidebar-maps-close').click();
  if(await page.getByTestId('ai-collapse').isVisible().catch(()=>false))await page.getByTestId('ai-collapse').click();
  const loaded=fresh.loads.find(l=>l.sha256===saved.sha256);receipt.freshBrowserLoadedSameMap=!!loaded&&isDeepStrictEqual(loaded.maps[mapId],saved.project.maps[mapId]);
  receipt.reopenedStoredSameMap=isDeepStrictEqual(stored(projectDir).project.maps[mapId],saved.project.maps[mapId]);
  await page.screenshot({path:resolve(dir,'06-reloaded.png')});receipt.passed=receipt.saved.sameMap&&receipt.freshBrowserLoadedSameMap&&receipt.reopenedStoredSameMap&&receipt.erasePreservesGround&&receipt.eraseReshapesNeighbor&&receipt.undoRestoresForest&&receipt.plateau.levels>0&&receipt.plateau.ramps>0&&receipt.plateau.sameGround&&receipt.errors.length===0;
  stage(receipt.passed?'complete':'incomplete');if(!receipt.passed)process.exitCode=1;console.log(JSON.stringify(receipt));
}catch(e){receipt.failure=e.message;receipt.failureStack=e.stack;save();await page?.screenshot({path:resolve(dir,'failure.png')}).catch(()=>{});console.log(JSON.stringify(receipt));process.exitCode=1;}
finally{await context?.close().catch(()=>{});await browser.close();await host.close();save();}
