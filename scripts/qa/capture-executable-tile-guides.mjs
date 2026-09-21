import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const out='output/castle-executable-guide',browser=await chromium.launch();
try{const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('oprn:editor-welcome-dismissed','1');localStorage.setItem('oprn:editor-ui-mode','expert');});
await page.goto((process.argv[2]??'http://127.0.0.1:9828')+'/?blankProject=1&aiBridge=0',{waitUntil:'domcontentloaded',timeout:120000});
await page.getByTestId('toolbar-database').click({timeout:120000});const group=page.getByTestId('db-tab-group-world');if(await group.getAttribute('aria-expanded')==='false')await group.click();await page.getByTestId('db-tab-spatial-tiles').click();
for(const id of ['opengameart_castle','forest_harmony']){
await page.getByTestId('tileset-db-row-'+id).click();await page.getByTestId('tileset-section-tab-references').click();await page.getByLabel('참고문서 용도',{exact:true}).selectOption('tile-assembly-executable');await page.getByRole('button',{name:'02-입출력 전체 예제.md',exact:true}).click();const img=page.locator('.tileset-reference-markdown img');await img.first().evaluate(i=>i.decode());await img.first().scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+id+'-guide.png'});}
assert.equal(errors.length,0);fs.writeFileSync(out+'/browser-proof.json',JSON.stringify({url:page.url(),newProject:true,tilesets:['opengameart_castle','forest_harmony'],category:'tile-assembly-executable',exampleImageDecoded:true,errors},null,2));console.log('New project: Castle and forest executable guides visible');
}catch(e){const pages=browser.contexts().flatMap(c=>c.pages());if(pages[0]){await pages[0].screenshot({path:out+'/failure.png'});fs.writeFileSync(out+'/failure.txt',(await pages[0].locator('body').innerText()).slice(0,9000));}throw e;}finally{await browser.close();}
