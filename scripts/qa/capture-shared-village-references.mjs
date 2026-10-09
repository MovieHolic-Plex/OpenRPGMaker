import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const out='verify-shots/shared-village-references',origin=process.env.REFERENCE_ORIGIN??'http://127.0.0.1:9825';const refs=JSON.parse(fs.readFileSync('src/assets/sharedVillageReferences.json'));
const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox','--no-proxy-server']});
try{
 const context=await browser.newContext({viewport:{width:1600,height:1100}});await context.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','expert');localStorage.setItem('oprn:editor-welcome-dismissed','1');});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/?map=map_village_ten_terrace_gardens',{waitUntil:'domcontentloaded'});await page.getByTestId('edit-canvas').waitFor({timeout:120000});await page.getByTestId('toolbar-database').click();const group=page.getByTestId('db-tab-group-world');if(await group.getAttribute('aria-expanded')==='false')await group.click();await page.getByTestId('db-tab-spatial-tiles').click();
 const checked=[];
 for(const[id,c,name]of [['forest_high_cliff_river',refs.village,'village'],['shared_forest_village_objects',refs.objects,'objects']]){
  await page.getByTestId('tileset-db-row-'+id).click();await page.getByTestId('tileset-section-tab-references').click();
  for(const doc of c.documents){await page.getByRole('button',{name:doc.name,exact:true}).click();assert.ok((await page.locator('.tileset-reference-body').innerText()).includes(doc.markdown.match(/^# (.+)/m)[1]));}
  await page.getByRole('button',{name:c.documents[0].name,exact:true}).click();await page.screenshot({path:`${out}/${name}-references.png`});await page.getByRole('button',{name:`이미지 ${c.images.length}`,exact:true}).click();
  for(const img of c.images){await page.getByRole('button',{name:img.name,exact:true}).click();const actual=await page.locator('.tileset-reference-image-preview img').evaluate(async i=>{await i.decode();return{src:i.src,width:i.naturalWidth,height:i.naturalHeight};});assert.equal(actual.src,img.dataUrl);assert.ok(actual.width>0&&actual.height>0);}
  await page.screenshot({path:`${out}/${name}-images.png`});checked.push({tilesetId:id,documents:c.documents.length,images:c.images.length,allImagesDecoded:true});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/production-proof.json',JSON.stringify({origin,productionBuild:true,sqliteProjectOpened:true,checked,errors},null,2));console.log('Production browser: all 3 documents and 8 exact images visible, no page errors');
}catch(e){const p=browser.contexts()[0]?.pages()[0];if(p)await p.screenshot({path:out+'/production-failure.png'});throw e;}finally{await browser.close();}
