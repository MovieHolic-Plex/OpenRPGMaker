// Native editor screenshots and genuine pen/erase/undo on canonical QA fixtures.
import {chromium} from 'playwright';
import {startHost,newEditor,stored} from '../../src/harnesses/assistant-capability/node/editorDriver.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
const projectDir=resolve(process.argv[2]),dir=resolve(process.argv[3]);mkdirSync(dir,{recursive:true});
process.env.OPRN_SHARED_CONTENT_SQLITE??=resolve('qa-runs/harnesses/assistant-capability/worldmap-film-20261005-03/shared-catalog-snapshot.sqlite');
process.env.OPRN_SHARED_CHARACTER_GRAPHICS_FILE??=resolve('qa-runs/harnesses/assistant-capability/worldmap-film-20261005-03/character-catalog-snapshot.json');
const captureOnly=process.argv[4]==='capture-only';
const removeOnly=process.argv[4]==='stamp-remove-only';
const receipt={projectDir,errors:[],captures:[],nativeEdits:[],captureOnly};
const host=await startHost(projectDir,dir),browser=await chromium.launch({headless:true,args:['--no-sandbox']});let context,page;
const persist=()=>writeFileSync(resolve(dir,'native.json'),JSON.stringify(receipt,null,2));
async function select(id){
 await page.getByTestId('sidebar-map-switcher').click();await page.getByTestId('map-tree-node-'+id).click();
 for(const key of ['sidebar-maps-close','ai-collapse'])if(await page.getByTestId(key).isVisible().catch(()=>false))await page.getByTestId(key).click();
 await page.getByTestId('editor-zoom-stepper').click();await page.getByTestId('editor-zoom-1').click();
 await page.mouse.move(450,24);await page.waitForTimeout(500);
}
async function snap(id,name){
 const m=stored(projectDir).project.maps[id],a=await page.evaluate(()=>window.__oprnEditWorldToClient(0,0));
 await page.screenshot({path:resolve(dir,name+'.png'),clip:{x:a.x,y:a.y,width:m.width*16,height:m.height*16}});
 receipt.captures.push({mapId:id,file:name+'.png',origin:a,width:m.width,height:m.height});persist();
}
async function read(id){return page.evaluate(id=>{const r=window.__oprnEditorTool('show_map_region',{mapId:id,x:0,y:0,w:64,h:40});if(!r.ok)throw Error(r.summary);return r.data;},id);}
async function click(x,y){const a=await page.evaluate(([x,y])=>window.__oprnEditWorldToClient((x+.5)*16,(y+.5)*16),[x,y]);await page.mouse.click(a.x,a.y);}
try{
 const ed=await newEditor(browser,host.url,projectDir,{}, {viewport:{width:1800,height:1100},onPage:async p=>{page=p;p.on('pageerror',e=>receipt.errors.push(e.message));await p.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','standard');localStorage.setItem('oprn:first-edit-guide:seen','1');});}});context=ed.context;page=ed.page;
 if(!removeOnly)for(const [id,name]of [['qa_coast','coast'],['qa_water','water'],['qa_forest','forest'],['qa_roads','roads']]){console.log(name);await select(id);await snap(id,name);}
 if(removeOnly){
  await select('qa_forest');await page.getByTestId('layer-upper').click();const before=await read('qa_forest');
  await page.getByTestId('tool-paint').click();await page.getByTestId('structure-kit-wmi-fantasy/town_red').click();await click(23,4);const stamped=await read('qa_forest');
  const a=await page.evaluate(()=>window.__oprnEditWorldToClient(23.5*16,4.5*16));await page.mouse.click(a.x,a.y,{button:'right'});await page.getByTestId('structure-placement-erase').click();const erased=await read('qa_forest');
  receipt.nativeEdits.push({mapId:'qa_forest',operation:'whole town stamp / context menu restore',changed:!isDeepStrictEqual(before.upper,stamped.upper),undoExact:isDeepStrictEqual(before,erased),groundExact:isDeepStrictEqual(before.lower,erased.lower)});
  await snap('qa_forest','forest-restored');
  // Both operations are reversible. Leave the saved QA map as it was even on failure.
  await page.keyboard.press('Control+z');await page.keyboard.press('Control+z');
  await page.getByTestId('toolbar-save').click();await page.waitForFunction(()=>['idle','saved'].includes(document.querySelector('[data-testid="toolbar-save"]')?.dataset.autosaveKind));
 }else if(!captureOnly){
 await select('qa_water');const wb=await read('qa_water');await page.getByTestId('layer-lower').click();await page.getByTestId('worldmap-brush-plain-grass').click();await page.getByTestId('tool-paint').click();await page.getByTestId('paint-shape-select').selectOption('pen');await click(5,10);const we=await read('qa_water');await page.keyboard.press('Control+z');const wu=await read('qa_water');
 receipt.nativeEdits.push({mapId:'qa_water',operation:'bridge remove / undo',changed:!isDeepStrictEqual(wb.lower,we.lower),undoExact:isDeepStrictEqual(wb,wu)});
 await select('qa_coast');const before=await read('qa_coast');
 await page.getByTestId('layer-lower').click();await page.getByTestId('worldmap-brush-plain-sea').click();await page.getByTestId('tool-paint').click();await page.getByTestId('paint-shape-select').selectOption('pen');await click(13,4);
 const cut=await read('qa_coast');await page.keyboard.press('Control+z');const undo=await read('qa_coast');await page.keyboard.press('Control+y');const redo=await read('qa_coast');
 receipt.nativeEdits.push({mapId:'qa_coast',operation:'sea pen / undo / redo',changed:!isDeepStrictEqual(before.lower,cut.lower),undoExact:isDeepStrictEqual(before,undo),redoExact:isDeepStrictEqual(cut,redo)});
 await snap('qa_coast','coast-native-notch');
 await select('qa_forest');await page.getByTestId('layer-upper').click();const fb=await read('qa_forest');await page.getByTestId('tool-erase').click();await click(4,6);const fe=await read('qa_forest');await page.keyboard.press('Control+z');const fu=await read('qa_forest');
 receipt.nativeEdits.push({mapId:'qa_forest',operation:'upper erase / undo',groundExact:isDeepStrictEqual(fb.lower,fe.lower),changed:!isDeepStrictEqual(fb.upper,fe.upper),undoExact:isDeepStrictEqual(fb,fu)});
 await page.getByTestId('tool-paint').click();await page.getByTestId('structure-kit-wmi-fantasy/town_red').click();await click(4,3);const stamped=await read('qa_forest');
 await page.keyboard.press('Control+z');const stampUndo=await read('qa_forest');await page.keyboard.press('Control+y');const stampRedo=await read('qa_forest');
 receipt.nativeEdits.push({mapId:'qa_forest',operation:'whole town stamp into connected forest / undo / redo',groundExact:isDeepStrictEqual(fb.lower,stamped.lower),changed:!isDeepStrictEqual(fb.upper,stamped.upper),undoExact:isDeepStrictEqual(fb,stampUndo),redoExact:isDeepStrictEqual(stamped,stampRedo)});await snap('qa_forest','forest-native-stamp');
 await page.getByTestId('toolbar-save').click();
 await page.waitForFunction(()=>['idle','saved'].includes(document.querySelector('[data-testid="toolbar-save"]')?.dataset.autosaveKind));
 for(let i=0;i<60;i++){const saved=stored(projectDir);if(isDeepStrictEqual(saved.project.maps.qa_coast.lowerTiles,redo.lower.flat())&&isDeepStrictEqual(saved.project.maps.qa_forest.upperTiles,stampRedo.upper.flat()))break;await page.waitForTimeout(1000);}
 }else{await page.getByTestId('toolbar-save').click();await page.waitForFunction(()=>['idle','saved'].includes(document.querySelector('[data-testid="toolbar-save"]')?.dataset.autosaveKind));}
 const saved=stored(projectDir);receipt.saved={projectId:saved.projectId,revision:saved.revision,sha256:saved.sha256};await context.close();context=null;
 const fresh=await newEditor(browser,host.url,projectDir,{}, {viewport:{width:1800,height:1100}});context=fresh.context;page=fresh.page;
 const loaded=fresh.loads.at(-1);receipt.loadedDocument={sha256:loaded?.sha256,revision:loaded?.revision};receipt.sameSavedDocument=loaded?.sha256===saved.sha256;
 receipt.reloaded=!!loaded&&['qa_coast','qa_water','qa_forest','qa_roads'].every(id=>isDeepStrictEqual(loaded.maps[id],saved.project.maps[id]));
 receipt.reloadDifferences=loaded?['qa_coast','qa_water','qa_forest','qa_roads'].flatMap(id=>Object.keys(saved.project.maps[id]).filter(k=>!isDeepStrictEqual(loaded.maps[id]?.[k],saved.project.maps[id][k])).map(key=>({mapId:id,key}))):[{missingLoad:true}];
 const original=Object.values(saved.project.maps).find(m=>m.name==='팔레트로 만든 새 대륙');await select(original.id);await snap(original.id,'original-map');
 receipt.passed=receipt.reloaded&&!receipt.errors.length&&receipt.nativeEdits.every(e=>e.changed&&e.undoExact&&e.groundExact!==false&&e.redoExact!==false);
 if(!receipt.passed)process.exitCode=1;console.log(receipt);
}catch(e){receipt.failure=e.message;console.log(e.message);await page?.screenshot({path:resolve(dir,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await context?.close().catch(()=>{});await browser.close();await host.close();persist();}
