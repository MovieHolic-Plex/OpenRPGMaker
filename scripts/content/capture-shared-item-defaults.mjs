import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const base=process.env.ITEM_CATALOG_URL??'http://127.0.0.1:9835';
const out='verify-shots/shared-item-defaults';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(45000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.addInitScript(()=>localStorage.setItem('oprn:editor-ui-mode','expert'));
 await page.goto(`${base}/?blankProject=1`,{waitUntil:'domcontentloaded'});
 for(const id of ['login-guest','standard-welcome-start','coach-mark-skip'])if(await page.getByTestId(id).isVisible())await page.getByTestId(id).click();
 await page.getByTestId('toolbar-database').click();
 if(!await page.getByTestId('db-tab-items').isVisible())await page.getByTestId('db-tab-group-party').click();
 await page.getByTestId('db-tab-items').click();
 await page.getByTestId('db-inventory-catalog').waitFor();
 const count=await page.getByTestId('db-catalog-count').getAttribute('data-total-count');
 await page.getByTestId('db-catalog-filter-items').click();
 const items=await page.locator('.db-catalog-rows [data-record-id]').count();
 await page.screenshot({path:`${out}/new-project-items.png`});
 const search=page.getByTestId('db-catalog-search');
 await search.fill('맑은 쑥 회복액');
 const result=page.locator('.db-catalog-rows [data-record-id]').first();await result.click();
 await page.screenshot({path:`${out}/new-healing-item.png`});
 const selected=await page.getByTestId('db-field-name').inputValue();
 const images=await page.locator('.db-catalog-detail img').evaluateAll(list=>list.map(i=>({src:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight,loaded:i.complete&&i.naturalWidth>0})));
 const art=JSON.parse(await readFile('output/item-catalog/art-inspection.json','utf8'));
 const manifest=JSON.parse(await readFile('assets/item-catalog/generation-manifest.json','utf8'));
 const artworkLoads=[];
 if(art.complete){
  const sources=Object.entries(manifest.entries).map(([id,entry])=>({id,url:`${base}/${entry.path.replace(/^public\//,'')}?catalogSHA=${entry.sha256}`}));
  for(let start=0;start<sources.length;start+=32){
   artworkLoads.push(...await page.evaluate(async jobs=>Promise.all(jobs.map(job=>new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>resolve({id:job.id,loaded:true,width:image.naturalWidth,height:image.naturalHeight});
    image.onerror=()=>resolve({id:job.id,loaded:false,width:0,height:0});
    image.src=job.url;
   }))),sources.slice(start,start+32)));
  }
 }
 const failedArtworkLoads=artworkLoads.filter(image=>!image.loaded||image.width!==32||image.height!==32);
 const report={base,total:Number(count),items,selected,images,errors,artworkStillInProgress:!art.complete,
  artworkLoads:{checked:artworkLoads.length,expected:art.total,failed:failedArtworkLoads}};
 await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 if(Number(count)!==1086||items!==1000||selected!=='맑은 쑥 회복액'||errors.length||images.length===0||images.some(image=>!image.loaded||image.width!==32||image.height!==32)||failedArtworkLoads.length||(art.complete&&artworkLoads.length!==art.total))process.exitCode=1;
}catch(e){await page.screenshot({path:`${out}/failure.png`});console.log(JSON.stringify({error:e.message,errors,text:(await page.locator('body').innerText()).slice(-5000)}));process.exitCode=1;}
finally{await browser.close();}
