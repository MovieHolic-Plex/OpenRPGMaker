import fs from 'node:fs';import {chromium} from 'playwright';
fs.mkdirSync('output/evidence/region-reference',{recursive:true});
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:1600,height:1050},acceptDownloads:true});
try{
 await p.addInitScript(()=>localStorage.setItem('oprn:editor-ui-mode','expert'));
 await p.goto(`${process.argv[2] ?? 'http://127.0.0.1:9999'}/?project=rpg-zzu-region-reference-walled-settlement-v1`,{waitUntil:'domcontentloaded',timeout:60000});
 for(const id of ['standard-welcome-start','coach-mark-skip']){const a=p.getByTestId(id);if(await a.isVisible().catch(()=>false))await a.click();}
 const node=p.getByTestId('map-tree-node-map_reference_gabled_houses_20260913');await node.waitFor({state:'attached',timeout:60000});
 const skip=p.getByRole('button',{name:'건너뛰기',exact:true});if(await skip.isVisible().catch(()=>false))await skip.click();
 await node.click();
 await p.getByTestId('toolbar-database').click();
 await p.getByTestId('database-modal').waitFor({state:'visible'});
 const group=p.getByTestId('db-tab-group-world');if(await group.getAttribute('aria-expanded')==='false')await group.click();
 await p.getByTestId('db-tab-spatial-regions').click();
 await p.getByTestId('spatial-card-region-reference:walled-settlement-43x45').click();
 await p.getByTestId('region-reference-preview').waitFor({state:'visible'});
 await p.getByTestId('region-reference-preview').locator('img').evaluate(img=>img.decode());
 if(await p.getByTestId('spatial-activate').isVisible().catch(()=>false))throw Error('Reference wrongly requires activation');
 const proof=await p.evaluate(async()=>{const {store}=await import('/src/project/store.ts');const {runTool}=await import('/src/editor/tools/toolRunner.ts');await (await import('/src/project/regionReferenceSnapshots.ts')).preloadRegionReference('walled-settlement-43x45');const project=store.getCurrent();const before=JSON.stringify(project);const list=runTool({project},'read_region_reference',{});const read=runTool({project},'read_region_reference',{id:'walled-settlement-43x45',row:0,rows:8});return {listOk:list.ok,readOk:read.ok,data:read.data,unchanged:JSON.stringify(project)===before};});
 if(!proof.listOk||!proof.readOk||!proof.unchanged)throw Error('AI lookup failed');
 fs.writeFileSync('output/evidence/region-reference/browser-proof.json',JSON.stringify(proof,null,2));
 await p.screenshot({path:'output/evidence/region-reference/regions-desktop.png'});
 await p.setViewportSize({width:1100,height:820});await p.waitForTimeout(500);await p.screenshot({path:'output/evidence/region-reference/regions-compact.png'});
 console.log('Screenshots saved');
}catch(e){await p.screenshot({path:'output/evidence/region-reference/capture-error.png'});console.log((await p.locator('body').innerText()).slice(0,2400));throw e;}finally{await b.close();}
