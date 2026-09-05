// Minimal layout contract fixture; never authored product content.
import { firefox } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser=await firefox.launch();
const page=await browser.newPage({viewport:{width:1600,height:1000}});
page.setDefaultTimeout(120000);
try {
 await page.addInitScript(()=>localStorage.setItem('oprn:editor-ui-mode','expert'));
 await page.goto(`${process.env.GROWTH_QA_BASE ?? 'http://127.0.0.1:54041'}/?freshProject=1`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.getByTestId('toolbar-database').waitFor();
 await page.evaluate(async()=>{
  const {store}=await import('/src/project/store.ts');
  const names=['방패 숙련','수호 자세','강철 의지','방패 밀치기','아군 보호','최후의 수호'];
  store.update(p=>{p.growth={initialPoints:5,pointsPerLevel:1,classPositions:{},skillTrees:[{id:'layout-contract',name:'수호자의 길',description:'레이아웃 계약 테스트',classIds:[],allowReset:true,nodes:names.map((name,i)=>({id:'layout-'+i,name,description:'',cost:1,maxRank:3,level:1,x:56+[0,248,248,496,496,744][i],y:56+[0,0,152,0,152,0][i],prerequisites:[[],['layout-0'],['layout-0'],['layout-1'],['layout-2'],['layout-3','layout-4']][i],effect:{kind:'parameter',parameter:'defense',amount:5}}))}]};},{scope:'project',label:'레이아웃 계약 fixture'});
 });
 await page.getByTestId('toolbar-database').click();
 if (!await page.getByTestId('db-tab-skill-trees').isVisible()) await page.getByTestId('db-tab-group-party').click();
 await page.getByTestId('db-tab-skill-trees').click();
 await page.getByTestId('growth-node-layout-0').click();
 const measurements=[];
 for(const [width,height] of [[1600,1000],[1280,800],[1024,768]]) {
  await page.setViewportSize({width,height});
  const m=await page.locator('.growth-catalog').evaluate(e=>{
   const input=e.querySelector('input'),button=e.querySelector('[data-testid="growth-add-tree"]'),select=e.querySelector('select');
   return {inputBottom:input.getBoundingClientRect().bottom,buttonTop:button.getBoundingClientRect().top,selectWidth:select.getBoundingClientRect().width};
  });
  assert.ok(m.inputBottom<=m.buttonTop,JSON.stringify(m));assert.ok(m.selectWidth>100);
  measurements.push({width,height,...m});
  await page.screenshot({path:`output/evidence/growth-tree/skill-${width}.png`});
 }
 await writeFile('output/evidence/growth-tree/layout-report.json',JSON.stringify(measurements,null,2));
 console.log('Layout checks passed');
} finally {await browser.close();}
