import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const root='output/castle-shared-place',base=process.argv[2]??'http://127.0.0.1:9828';const b=await chromium.launch();
try{const page=await b.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('oprn:editor-welcome-dismissed','1');localStorage.setItem('oprn:editor-ui-mode','expert');});
await page.goto(base+'/?blankProject=1&aiBridge=0',{waitUntil:'domcontentloaded',timeout:120000});
await page.getByTestId('toolbar-database').click({timeout:120000});const group=page.getByTestId('db-tab-group-world');if(await group.getAttribute('aria-expanded')==='false')await group.click();await page.getByTestId('db-tab-spatial-places').click();
const id='region-reference:river-fortress-160x144';await page.getByTestId('spatial-card-'+id).click({timeout:30000});
await page.getByTestId('region-reference-inspector').waitFor();await page.getByTestId('region-reference-preview').locator('img').evaluate(img=>img.decode());
await page.screenshot({path:root+'/shared-place.png'});
const download=page.waitForEvent('download');await page.getByTestId('region-reference-download').click();const d=await download;await d.saveAs(root+'/downloaded.oprn.json');
const loaded=JSON.parse(fs.readFileSync(root+'/downloaded.oprn.json'));assert(loaded.maps['grand-river-fortress']);assert(loaded.assets.uploaded.castle_courtyard_harbor_atlas.dataUrl.startsWith('data:image/png;'));
fs.writeFileSync(root+'/catalog-proof.json',JSON.stringify({url:page.url(),blankProject:true,placeId:'river-fortress-160x144',downloadIncludesMapAndAtlas:true,pageErrors:errors},null,2));assert.equal(errors.length,0);console.log('Shared place visible in blank project; portable download verified');
}finally{await b.close();}
