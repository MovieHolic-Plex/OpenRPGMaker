// Real editor rendering of the saved AI result; no map replacement or model responses.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {startEditorScreencast} from './editor-screencast.mjs';
const folder=resolve('.vite-cache/terrain-ai/fixed-project'),out=resolve('verify-shots/terrain-assistant-live/editor-visible');mkdirSync(out,{recursive:true});
const snapshot=()=>{const db=new DatabaseSync(resolve(folder,'project.sqlite'),{readOnly:true});try{
 const row=db.prepare('select project_id,revision from project where id=1').get(),map=db.prepare('select map_json from maps where map_id=?').get('terrain_ai');
 return{...row,mapSha256:createHash('sha256').update(JSON.stringify(JSON.parse(map.map_json))).digest('hex')};
}finally{db.close();}};
const browser=await chromium.launch({args:['--no-proxy-server','--disable-background-networking','--disable-features=NetworkChangeNotifier','--js-flags=--max-old-space-size=8192']}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],proof={realEditor:true,modelRun:'../editor/observations.json',before:snapshot()};
page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.message);});
try{
 await page.goto('http://127.0.0.1:9844/',{waitUntil:'domcontentloaded',timeout:120000});
 if(await page.locator('#access-code').count()){
  await page.locator('#access-code').fill(readFileSync(resolve(folder,'.oprn-host-access'),'utf8').trim());
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:120000}),page.locator('form[action="/__oprn/login"] button').click()]);
 }
 await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});
 await page.waitForFunction(()=>window.__oprnAiBridge?.status().ready,null,{timeout:120000});
 const welcome=page.getByTestId('editor-welcome-skip');if(await welcome.isVisible().catch(()=>false))await welcome.click();
 await page.getByTestId('layer-upper').click();
 await page.getByTestId('editor-zoom-stepper').click();await page.getByTestId('editor-zoom-0.5').click();await page.waitForTimeout(1200);
 await page.screenshot({path:resolve(out,'01-cliff-houses-visible.png')});
 const film=await startEditorScreencast(page,out,'terrain-assistant-editor-2x.mp4',{selector:'body',cropTop:0,speed:2});
 await film.caption('실제 AI 조수가 만든 버들항 집 · 높이 4·6·9와 매끈한 경사로');await page.waitForTimeout(2500);
 await page.getByTestId('layer-relief').first().click();await page.getByTestId('terrain-tool-house').click();await page.waitForTimeout(700);
 await film.caption('에디터에도 집이 표시됨 · 버들항 집과 지붕 크기 도구');await page.waitForTimeout(2200);
 await page.screenshot({path:resolve(out,'02-native-house-tools.png')});
 proof.film=await film.stop();
 await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});
 proof.after=snapshot();proof.mapUnchanged=proof.before.mapSha256===proof.after.mapSha256;proof.errors=errors;proof.passed=proof.mapUnchanged&&!errors.length;
 if(!proof.passed)throw Error('Editor rendering or canonical map preservation failed');
}catch(e){proof.failure=e.message;await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw e;}finally{writeFileSync(resolve(out,'observations.json'),JSON.stringify(proof,null,2));await browser.close();}
console.log(JSON.stringify(proof));
