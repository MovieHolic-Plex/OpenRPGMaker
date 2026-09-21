import { inspectReferenceEditing } from "./inspect-tileset-reference-editing.mjs";
import { inspectReferenceContract } from "./inspect-tileset-reference-contract.mjs";
import { chromium } from 'playwright';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
const dir='verify-shots/tileset-references';await mkdir(dir,{recursive:true});
const raw=await readFile(process.argv[2]??'output/tileset-references/reloaded-project.json','utf8');
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:9803/?devProject=1&freshProject=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(async()=>{try{const{getGame}=await import('/src/app/mode.ts');return getGame()?.scene.getScenes(true).some(s=>s.sys.settings.key==='EditScene');}catch{return false;}},null,{timeout:55000});
 const loaded=await page.evaluate(async(raw)=>{
  const{deserialize,serialize}=await import('/src/project/io.ts');const storeUrl=(await(await fetch('/src/editor/panels/tilesetReferencePanel.ts')).text()).match(/import \{ store \} from "([^"]+)"/)[1];const{store}=await import(storeUrl);const p=deserialize(raw);
  const again=deserialize(serialize(p));if(JSON.stringify(p.tilesets.slates_32.referenceDocuments)!==JSON.stringify(again.tilesets.slates_32.referenceDocuments))throw Error('Reference roundtrip differs');
  await import('/src/editor/panels/databaseModal.ts');
  store.replaceProject(p);
  const{setSelectedTileset}=await import('/src/editor/panels/tilesetSettingsPanel.ts');setSelectedTileset('slates_astra_v3_32');
  const{openDatabaseModal}=await import('/src/editor/panels/databaseModal.ts');openDatabaseModal('tilesets');return{liveTitle:store.getCurrent().meta.title,liveTilesets:Object.keys(store.getCurrent().tilesets),categories:p.tilesets.slates_32.referenceDocuments.length,roundtrip:true};
 },raw);
 console.log(loaded);
 await page.getByTestId('tileset-db-row-slates_astra_v3_32').click();
 if(await page.getByTestId('tileset-section-tab-references').getAttribute('aria-selected')!=='true')throw Error('References are not the default tab');
 await page.getByTestId('tileset-references').waitFor();
 await page.getByRole('button',{name:'slates-dense-town.md',exact:true}).click();
 await page.getByTestId('tileset-references').locator('img').first().waitFor();
 await page.waitForFunction(()=>document.querySelector('.tileset-reference-markdown img')?.naturalWidth>0);
 await page.screenshot({path:`${dir}/database-reference-overview.png`});
 await page.locator('.tileset-reference-markdown img').first().scrollIntoViewIfNeeded();
 await page.screenshot({path:`${dir}/database-reference-docs.png`});
 await page.locator('.tileset-reference-enlarge').first().click();
 await page.getByTestId('tileset-reference-image-dialog').waitFor();
 await page.getByTestId('tileset-reference-image-close').click();
 await page.getByRole('button',{name:'이미지 23',exact:true}).click();
 await page.locator('.tileset-reference-image-preview img').waitFor();
 await page.screenshot({path:`${dir}/database-reference-images.png`});
 await page.getByRole('button',{name:'문서 5',exact:true}).click();
 const widths=[];
 for(const width of [1440,1024]){
  await page.setViewportSize({width,height:900});
  await page.screenshot({path:`${dir}/database-reference-${width}.png`});
  widths.push(await page.locator('.tileset-library').evaluate(e=>({width:innerWidth,client:e.clientWidth,scroll:e.scrollWidth,reader:e.querySelector('.tileset-reference-reader').getBoundingClientRect().width,bodyWidth:document.body.scrollWidth})));
 }
 await page.setViewportSize({width:1440,height:960});
 for(const section of ['rules','compose','knowledge','settings']){
  await page.getByTestId(`tileset-section-tab-${section}`).click();
  if(await page.getByTestId(`tileset-section-tab-${section}`).getAttribute('aria-selected')!=='true')throw Error('Section failed: '+section);
  const text=await page.locator('.tileset-library').innerText();
  if(/AI 응답 JSON|생성 감사|AI 재감사/.test(text))throw Error('Obsolete UI remains');
  await page.screenshot({path:`${dir}/tiles-${section}.png`});
 }
 await page.getByTestId('tileset-section-tab-references').click();
 if(!process.env.REFERENCE_VISUAL_ONLY){
 const editing=await inspectReferenceEditing(page);
 await writeFile(`${dir}/editing-observation.json`,JSON.stringify(editing,null,2));
 const contracts=await inspectReferenceContract(page,raw);
 await writeFile(`${dir}/contract-observation.json`,JSON.stringify(contracts,null,2));
 console.log(contracts);
 }
 await writeFile(`${dir}/browser-observation.json`,JSON.stringify({loaded,widths,errors,title:await page.getByTestId('tileset-references').locator('h3').allTextContents()},null,2));
 console.log({loaded,errors});
}catch(e){await page.screenshot({path:`${dir}/failure.png`});await writeFile(`${dir}/failure.json`,JSON.stringify({error:String(e),errors,body:(await page.locator('body').innerText()).slice(-5000)},null,2));throw e;}finally{await browser.close();}
