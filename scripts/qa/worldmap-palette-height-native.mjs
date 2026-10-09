// Follow up the native authoring film: place a one-cell mountain pass on its
// existing hill through the real palette, then save/reopen the same SQLite map.
import {chromium} from 'playwright';
import {startHost,newEditor,stored,writeRuntimeProject} from '../../src/harnesses/assistant-capability/node/editorDriver.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
const projectDir=resolve(process.argv[2]),dir=resolve(process.argv[3]);mkdirSync(resolve(dir,'video'),{recursive:true});
process.env.OPRN_SHARED_CONTENT_SQLITE??=resolve('qa-runs/harnesses/assistant-capability/worldmap-film-20261005-03/shared-catalog-snapshot.sqlite');
process.env.OPRN_SHARED_CHARACTER_GRAPHICS_FILE??=resolve('qa-runs/harnesses/assistant-capability/worldmap-film-20261005-03/character-catalog-snapshot.json');
const receipt={nativeOnly:true,projectDir,errors:[]},persist=()=>writeFileSync(resolve(dir,'receipt.json'),JSON.stringify(receipt,null,2));
const before=stored(projectDir),map=Object.values(before.project.maps).find(m=>m.name==='팔레트로 만든 새 대륙');if(!map)throw Error('Native authored map missing');receipt.mapId=map.id;
const host=await startHost(projectDir,dir),browser=await chromium.launch({headless:true,args:['--no-sandbox']}),start=Date.now();let context,page;
async function selectMap(){await page.getByTestId('sidebar-map-switcher').click();await page.getByTestId('map-tree-node-'+map.id).click();for(const id of ['sidebar-maps-close','ai-collapse'])if(await page.getByTestId(id).isVisible().catch(()=>false))await page.getByTestId(id).click();await page.getByTestId('editor-zoom-stepper').click();await page.getByTestId('editor-zoom-1').click();await page.getByTestId('layer-lower').click();}
try{
  console.log('boot');const ed=await newEditor(browser,host.url,projectDir,{}, {viewport:{width:1600,height:1004},recordVideo:{dir:resolve(dir,'video'),size:{width:1600,height:1004}},onPage:async p=>{page=p;p.on('pageerror',e=>{receipt.errors.push(e.message);persist();});p.on('crash',()=>{receipt.errors.push('Page crashed');persist();void p.close();});await p.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','standard');localStorage.setItem('oprn:first-edit-guide:seen','1');});}});page=ed.page;context=ed.context;
  await selectMap();receipt.captureStartSeconds=(Date.now()-start)/1000;console.log('native-pass');
  await page.getByTestId('worldmap-brush-slope').click();const pos=await page.evaluate(()=>window.__oprnEditWorldToClient(7.5*16,23.5*16));await page.mouse.click(pos.x,pos.y);await page.getByTestId('toolbar-save').click();
  let saved;for(let i=0;i<60;i++){saved=stored(projectDir);if(saved.project.maps[map.id]?.relief?.ramps?.some(v=>v>0))break;await page.waitForTimeout(1000);}
  const applied=saved.project.maps[map.id];receipt.ramps=applied.relief?.ramps?.filter(v=>v>0).length??0;receipt.groundUnchanged=isDeepStrictEqual(map.lowerTiles,applied.lowerTiles);receipt.propsUnchanged=isDeepStrictEqual(map.upperTiles,applied.upperTiles);receipt.levelsUnchanged=isDeepStrictEqual(map.relief.levels,applied.relief.levels);receipt.saved={projectId:saved.projectId,revision:saved.revision,sha256:saved.sha256};
  if(!receipt.ramps)throw Error('Native pass was not stored');
  await page.getByTestId('tool-paint').click();await page.getByTestId('worldmap-brush-background').selectOption('grass');await page.mouse.move(350,25);await page.waitForTimeout(2500);
  await page.screenshot({path:resolve(dir,'final-editor.png')});const origin=await page.evaluate(()=>window.__oprnEditWorldToClient(0,0));await page.screenshot({path:resolve(dir,'final-map.png'),clip:{x:origin.x,y:origin.y,width:map.width*16,height:map.height*16}});
  receipt.captureEndSeconds=(Date.now()-start)/1000;receipt.videoPath=await page.video().path();await context.close();context=null;console.log('fresh-reload');
  const fresh=await newEditor(browser,host.url,projectDir,{});page=fresh.page;context=fresh.context;await selectMap();const loaded=fresh.loads.find(l=>l.sha256===saved.sha256);receipt.freshBrowserLoadedSameMap=!!loaded&&isDeepStrictEqual(loaded.maps[map.id],applied);receipt.sameReopenedStoredMap=isDeepStrictEqual(stored(projectDir).project.maps[map.id],applied);await page.screenshot({path:resolve(dir,'reloaded-editor.png')});writeRuntimeProject(projectDir,resolve(dir,'live.json'));
  receipt.passed=receipt.ramps>0&&receipt.groundUnchanged&&receipt.propsUnchanged&&receipt.levelsUnchanged&&receipt.freshBrowserLoadedSameMap&&receipt.sameReopenedStoredMap&&!receipt.errors.length;if(!receipt.passed)process.exitCode=1;console.log(JSON.stringify(receipt));
}catch(e){receipt.failure=e.message;await page?.screenshot({path:resolve(dir,'failure.png')}).catch(()=>{});console.log(JSON.stringify(receipt));process.exitCode=1;}
finally{await context?.close().catch(()=>{});await browser.close();await host.close();persist();}
