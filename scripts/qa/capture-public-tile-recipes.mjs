import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const out='verify-shots/public-tile-recipes';const expected=JSON.parse(fs.readFileSync('src/assets/forestHarmonyTileset.json')).referenceDocuments.find(c=>c.id==='public-assembly-v2');
const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox','--no-proxy-server']});const results=[];
try{
 for(const[mode,origin]of [['fresh','http://127.0.0.1:9830'],['existing','http://127.0.0.1:9825']]){
  const context=await browser.newContext({viewport:{width:1600,height:1100}});await context.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','expert');localStorage.setItem('oprn:editor-welcome-dismissed','1');});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin,{waitUntil:'domcontentloaded'});await page.getByTestId('edit-canvas').waitFor({timeout:120000});await page.getByTestId('toolbar-database').click();const world=page.getByTestId('db-tab-group-world');if(await world.getAttribute('aria-expanded')==='false')await world.click();await page.getByTestId('db-tab-spatial-tiles').click();await page.getByTestId('tileset-db-row-forest_harmony').click();await page.getByTestId('tileset-section-tab-references').click();await page.getByLabel('참고문서 용도',{exact:true}).selectOption('public-assembly-v2');
  for(const d of expected.documents){await page.getByRole('button',{name:d.name,exact:true}).click();assert.ok((await page.locator('.tileset-reference-body').innerText()).includes(d.markdown.match(/^# (.+)/m)[1]));}
  await page.getByRole('button',{name:expected.documents[0].name,exact:true}).click();await page.screenshot({path:`${out}/${mode}-public-documents.png`});
  await page.getByRole('button',{name:'이미지 14',exact:true}).click();
  for(const i of expected.images){await page.getByRole('button',{name:i.name,exact:true}).click();const actual=await page.locator('.tileset-reference-image-preview img').evaluate(async img=>{await img.decode();return img.src;});assert.equal(actual,i.dataUrl);}
  await page.getByRole('button',{name:'forest-strip-cut-root.png',exact:true}).click();await page.screenshot({path:`${out}/${mode}-public-images.png`});assert.deepEqual(errors,[]);results.push({mode,origin,tilesetId:'forest_harmony',documents:19,images:14,allImagesExact:true,sqliteBacked:true,errors});console.log(mode,'public forest_harmony: 19 docs and 14 images verified');await context.close();
 }
 fs.writeFileSync(out+'/browser-proof.json',JSON.stringify(results,null,2));
}catch(e){for(const c of browser.contexts())for(const p of c.pages()){await p.screenshot({path:out+'/failure.png'}).catch(()=>{});console.log((await p.locator('body').innerText()).slice(-1400));}throw e;}finally{await browser.close();}
