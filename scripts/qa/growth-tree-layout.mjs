// Minimal layout contract fixture; never authored product content.
import { firefox } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
// 승급 트리·스킬 트리는 레일 칸이 아니라 직업·스킬 탭의 보기다(2026-09-23) — 부모 탭을 연 뒤 보기 전환 줄을 누른다.
const GROWTH_SUBVIEW = { 'db-tab-promotion-tree': ['db-tab-classes', 'db-subview-promotion-tree'], 'db-tab-skill-trees': ['db-tab-skills', 'db-subview-skill-trees'] };
async function openGrowthSubview(page, id) {
  const [parent, sub] = GROWTH_SUBVIEW[id] ?? [id, null];
  if (!await page.getByTestId(parent).isVisible()) await page.getByTestId('db-tab-group-party').click();
  await page.getByTestId(parent).click();
  if (sub) await page.getByTestId(sub).click();
}

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
 await openGrowthSubview(page, 'db-tab-skill-trees');
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
