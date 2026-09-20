import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
const out='verify-shots/runtime-qa/field-hud-composer';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1560,height:1100}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('[autosave]'))console.error(m.text().slice(0,400));});
 await page.addInitScript(()=>localStorage.setItem('oprn:editor-ui-mode','expert'));
 await page.goto(`${process.env.HUD_EDITOR_URL??'http://127.0.0.1:9829'}/?freshProject=1&aiBridge=0`,{waitUntil:'domcontentloaded'});
 await page.getByTestId('edit-canvas').waitFor({timeout:120000});
 for(const id of ['login-guest','standard-welcome-start','coach-mark-skip'])if(await page.getByTestId(id).isVisible())await page.getByTestId(id).click();
 await page.getByTestId('toolbar-database').click();await page.getByTestId('db-tab-group-system').click();await page.getByTestId('db-tab-system').click();await page.getByTestId('db-system-nav-hud').click();
 const saved=()=>page.evaluate(async()=>{const{store}=await import('/src/project/store.ts');const{serialize,deserialize}=await import('/src/project/io.ts');return deserialize(serialize(store.getCurrent())).system.fieldHud;});
 await page.getByTestId('db-hud-theme-farm').click();await page.waitForFunction(async()=>{const {store}=await import('/src/project/store.ts');return !!store.getCurrent().system.fieldHud;});const preset=await saved();assert.equal(preset.widgets.length,5);
 await page.getByTestId('hud-select-energy').click();await page.getByTestId('hud-field-shape').selectOption('ring');await page.getByTestId('hud-field-width').fill('44');await page.getByTestId('hud-field-width').press('Tab');
 assert.equal((await saved()).widgets.find(w=>w.id==='energy').shape,'ring');
 await page.getByTestId('hud-duplicate').click();assert.equal((await saved()).widgets.length,6);await page.getByTestId('hud-delete').click();assert.equal((await saved()).widgets.length,5);
 await page.getByTestId('hud-add-kind').selectOption('gauge');await page.getByTestId('hud-add').click();
 await page.getByTestId('hud-field-label').fill('허기');await page.getByTestId('hud-field-label').press('Tab');await page.getByTestId('hud-field-source').selectOption('variable');
 const variable=await page.getByTestId('hud-field-variableId').locator('option').nth(1).getAttribute('value');await page.getByTestId('hud-field-variableId').selectOption(variable);
 await page.getByTestId('hud-field-shape').selectOption('ring');await page.getByTestId('hud-field-condition').selectOption('nonzero');
 assert((await saved()).widgets.some(w=>w.label==='허기'&&w.source==='variable'&&w.variableId===variable&&w.shape==='ring'&&w.condition==='nonzero'));
 await page.getByTestId('db-hud-theme-survival').click();await page.getByTestId('hud-select-stamina').click();
 const before=await saved();await page.getByTestId('hud-preview-action').click();assert.deepEqual(await saved(),before,'preview must not save fake stamina');
 await page.getByTestId('hud-select-clock').click();const clock=page.getByTestId('hud-widget-clock'),box=await clock.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-65,box.y+box.height/2+35,{steps:6});await page.mouse.up();
 const moved=(await saved()).widgets.find(w=>w.id==='clock');assert.equal(moved.anchor,'top-left');assert(moved.y>10);
 await clock.focus();await page.keyboard.press('ArrowRight');assert.equal((await saved()).widgets.find(w=>w.id==='clock').x,moved.x+1);
 // Restore a readable preset for the final evidence; persistence is exercised through the actual controls.
 await page.getByTestId('db-hud-theme-survival').click();await page.getByTestId('hud-select-stamina').click();await page.getByTestId('hud-preview-action').click();
 await page.screenshot({path:`${out}/editor.png`});
 const config=await saved();await page.getByTestId('db-system-nav-menu').click();await page.getByTestId('db-system-nav-hud').click();assert.deepEqual(await saved(),config);
 assert.deepEqual(errors,[]);await writeFile(`${out}/editor-checks.json`,JSON.stringify({add:true,duplicate:true,remove:true,variableBinding:true,drag:true,keyboardMove:true,previewDoesNotPersist:true,serializeReload:true,errors},null,2));console.log('HUD editor authoring checks passed');
}finally{await browser.close();}
