import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const out='output/shared-castle-references',browser=await chromium.launch();
try{const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('oprn:editor-welcome-dismissed','1');localStorage.setItem('oprn:editor-ui-mode','expert');});
await page.goto((process.argv[2]??'http://127.0.0.1:9828')+'/?blankProject=1&aiBridge=0',{waitUntil:'domcontentloaded',timeout:120000});
await page.getByTestId('toolbar-database').click({timeout:120000});const group=page.getByTestId('db-tab-group-world');if(await group.getAttribute('aria-expanded')==='false')await group.click();await page.getByTestId('db-tab-spatial-tiles').click();
await page.getByTestId('tileset-db-row-opengameart_castle').click();await page.getByTestId('tileset-section-tab-references').click();
await page.getByRole('button',{name:'00-읽기-순서.md',exact:true}).click();await page.screenshot({path:out+'/database-guide.png'});
assert((await page.getByTestId('tileset-references').innerText()).includes('큰 돌다리'));
const counts=[];
for(const id of ['castle-art-direction','castle-assembly','castle-revisions']){await page.getByLabel('참고문서 용도',{exact:true}).selectOption(id);counts.push(await page.getByLabel('참고문서 용도',{exact:true}).inputValue());
 {await page.getByRole('button',{name:id==='castle-assembly'?'원본과 파생 아틀라스.md':'그림과 비교 증거.md',exact:true}).click();const imgs=page.locator('.tileset-reference-markdown img');await imgs.first().waitFor();await imgs.evaluateAll(async list=>{await Promise.all(list.map(img=>img.decode()));});await page.screenshot({path:out+'/'+id+'.png'});}
}
await page.getByTestId('tileset-db-row-opengameart_castle').click();await page.getByLabel('참고문서 용도',{exact:true}).selectOption('castle-art-direction');await page.getByRole('button',{name:'00-읽기-순서.md',exact:true}).click();await page.screenshot({path:out+'/database-original.png'});
assert.equal(errors.length,0);fs.writeFileSync(out+'/browser-proof.json',JSON.stringify({url:page.url(),newBlankProject:true,importedExistingProject:false,categories:counts,imagesDecoded:true,errors},null,2));console.log('New blank project: shared castle documents and embedded images verified');
}catch(e){const pages=browser.contexts().flatMap(c=>c.pages());if(pages[0]){await pages[0].screenshot({path:out+'/failure.png'});fs.writeFileSync(out+'/failure.txt',(await pages[0].locator('body').innerText()).slice(0,9000));}throw e;}finally{await browser.close();}
