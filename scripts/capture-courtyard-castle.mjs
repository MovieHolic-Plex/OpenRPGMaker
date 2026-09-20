/** Browser evidence of an exported/reloaded project. Does not write remote data. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [input, out = '/tmp/rpg-zzu-castle/courtyard-browser', origin='http://127.0.0.1:9987'] = process.argv.slice(2);
if(!input) throw Error('Usage: node scripts/capture-courtyard-castle.mjs <project.json> [output-dir] [origin]');
const raw=JSON.parse(fs.readFileSync(input,'utf8'));
const project=structuredClone(raw.current_json??raw);
project.startMapId='map_castle_keep_3';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:2480,height:2100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const consoleErrors=[];page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text().slice(0,500));});
 await page.addInitScript(({project})=>{
  window.__OPRN_E2E_PROJECT__=project;
  localStorage.setItem('oprn:editor-welcome-dismissed','1');
  localStorage.setItem('oprn:standard-welcome-seen','1');
  localStorage.setItem('oprn:editor-ui-mode','expert');
 },{project});
 await page.goto(origin+'/?aiBridge=0',{waitUntil:'domcontentloaded',timeout:120000});
 await page.getByTestId('edit-canvas').waitFor({timeout:60000});
 await page.getByTestId('editor-zoom-prev').click();
 await page.waitForTimeout(15000);
 const zoom=await page.getByTestId('editor-zoom-stepper').textContent();
 if(zoom!=='1x') throw Error('Expected full map at 1x, got '+zoom);
 await page.screenshot({path:path.join(out,'editor.png')});
 await page.getByTestId('edit-canvas').screenshot({path:path.join(out,'canvas.png')});
 const proof={mapId:project.startMapId,mapName:project.maps[project.startMapId].name,zoom,pageErrors:errors,consoleErrors};
 fs.writeFileSync(path.join(out,'browser-proof.json'),JSON.stringify(proof,null,2));
 if(errors.length) throw Error(JSON.stringify(proof));
 console.log(JSON.stringify(proof));
} finally {await browser.close();}
