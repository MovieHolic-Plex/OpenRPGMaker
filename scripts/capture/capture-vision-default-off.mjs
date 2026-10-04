import {chromium} from 'playwright';
import fs from 'node:fs';
// Fresh installed editor in an isolated blank project; never writes the user's maps.
const browser=await chromium.launch({args:['--no-proxy-server','--js-flags=--max-old-space-size=12288']});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.message);});
page.on('crash',()=>console.log('page crash'));
try{
 const response=await page.goto('http://mdc-server:9888/?blankProject=1',{waitUntil:'domcontentloaded',timeout:120000});
 console.log('HTTP',response.status());
 if(await page.locator('#access-code').count()){
  await page.locator('#access-code').fill(fs.readFileSync('/home/main/.local/share/oprn/web-workspace/.oprn-host-access','utf8').trim());
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:120000}),page.locator('form[action="/__oprn/login"] button').click()]);
 }
 await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:240000});
 console.log('native boot ready');
 await page.locator('[data-testid="layer-relief"]:visible').first().click({timeout:120000});
 await page.getByTestId('terrain-design-toggle').click();
 await page.getByTestId('terrain-design-gameplay').evaluate(n=>n.open=true);
 const block=page.getByTestId('terrain-design-vision-blocking'),preview=page.getByTestId('terrain-design-vision-preview');
 await block.scrollIntoViewIfNeeded();
 const proof={url:page.url(),visionBlocking:await block.isChecked(),preview:await preview.isChecked(),highGroundVision:await page.getByTestId('terrain-design-high-ground-vision').isChecked(),instructions:await page.getByTestId('terrain-design-gameplay').locator('p').allTextContents(),isolatedDefaultProject:true,authoredContentChanged:false,errors};
 if(proof.visionBlocking||proof.preview||proof.highGroundVision||!proof.instructions.some(t=>t.includes('선택 기능이며 기본은 꺼짐'))||errors.length)throw new Error('Installed default OFF verification failed');
 proof.aiRecords=await page.evaluate(async()=>{const databases=await indexedDB.databases();if(!databases.some(d=>d.name==='oprn-ai-records'))return{databasePresent:false};const db=await new Promise((yes,no)=>{const r=indexedDB.open('oprn-ai-records');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});const counts={};for(const name of db.objectStoreNames)counts[name]=await new Promise((yes,no)=>{const r=db.transaction(name).objectStore(name).count();r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});db.close();return{databasePresent:true,counts};});
 fs.mkdirSync('verify-shots/vision-default-off',{recursive:true});
 await page.screenshot({path:'verify-shots/vision-default-off/default-off.png'});
 fs.writeFileSync('.vite-cache/vision-default-off-host-check.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}finally{await browser.close();}
