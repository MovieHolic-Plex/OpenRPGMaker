import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const root='output/castle-scenes',base=process.argv[2]??'http://127.0.0.1:9828';const b=await chromium.launch();
try{const page=await b.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('oprn:editor-welcome-dismissed','1');localStorage.setItem('oprn:editor-ui-mode','expert');});
await page.goto(base+'/?blankProject=1&aiBridge=0',{waitUntil:'domcontentloaded',timeout:120000});
await page.getByTestId('toolbar-database').click({timeout:120000});const group=page.getByTestId('db-tab-group-world');if(await group.getAttribute('aria-expanded')==='false')await group.click();await page.getByTestId('db-tab-spatial-places').click();
const proof=[];
for(const scene of ['castle-courtyard','castle-small-harbor','castle-stone-lodge']){
await page.getByTestId('spatial-card-region-reference:'+scene).click({timeout:30000});
await page.getByTestId('region-reference-inspector').waitFor();await page.getByTestId('region-reference-preview').locator('img').evaluate(img=>img.decode());
await page.screenshot({path:root+'/'+scene+'-catalog.png'});
const download=page.waitForEvent('download');await page.getByTestId('region-reference-download').click();const d=await download;await d.saveAs(root+'/'+scene+'-downloaded.json');
const loaded=JSON.parse(fs.readFileSync(root+'/'+scene+'-downloaded.json'));
assert.deepEqual(loaded,JSON.parse(fs.readFileSync('public/assets/region-references/'+scene+'.oprn.json')));
assert(loaded.maps[scene]);assert(loaded.assets.uploaded.castle_courtyard_harbor_atlas.dataUrl.startsWith('data:image/png;'));
proof.push({id:scene,downloadEqualsPublished:true});
}
fs.writeFileSync(root+'/catalog-proof.json',JSON.stringify({url:page.url(),blankProject:true,places:proof,pageErrors:errors},null,2));assert.equal(errors.length,0);console.log('All three global places visible in blank project; embedded-atlas downloads verified');
}finally{await b.close();}
