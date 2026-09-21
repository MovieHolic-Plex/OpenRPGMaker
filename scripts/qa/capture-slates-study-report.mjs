import {chromium} from 'playwright';import{writeFile}from'node:fs/promises';import{resolve}from'node:path';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1080}});const errors=[],checks={};page.on('pageerror',e=>errors.push(e.message));
try{
await page.goto('file://'+resolve('reports/slates-study/index.html'));await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',{},{timeout:30000});
await page.screenshot({path:'verify-shots/slates-study/report-desktop.png'});
await page.locator('#show-regions').click();checks.regionCount=await page.locator('#region-gallery article').count();
await page.locator('#region-search').fill('그림자');checks.filteredRegions=await page.locator('#region-gallery article').count();await page.locator('#region-search').fill('');await page.locator('#show-regions').click();
await page.selectOption('#atlas-source','derived');await page.locator('#tile-number').fill('1300');checks.recipeParts=await page.locator('#tile-pieces figure').count();
await page.selectOption('#atlas-source','v2');await page.locator('#tile-number').fill('57');checks.originalTile=await page.locator('#tile-title').innerText();
await page.locator('#island-width').fill('9');await page.locator('#house-height').fill('2');checks.island=await page.locator('#island-value').innerText();checks.house=await page.locator('#house-value').innerText();
await page.locator('[data-tree="trunk"]').click();checks.tree=await page.locator('#tree-note').innerText();
await page.selectOption('#map-select','slates_study');await page.locator('#map-canvas').scrollIntoViewIfNeeded();const b=await page.locator('#map-canvas').boundingBox();await page.locator('#map-canvas').click({position:{x:b.width*21.5/30,y:b.height*10.5/23}});checks.bridgeCell=await page.locator('#map-cell-info').innerText();
await page.locator('#inspect-lower').click();checks.bridgeAtlas=await page.locator('#atlas-source').inputValue();checks.bridgePieces=await page.locator('#tile-pieces figure').count();
await page.locator('#atlas').screenshot({path:'verify-shots/slates-study/report-atlas.png'});
await page.locator('#wheel-frame').fill('3');checks.wheel=await page.locator('#wheel-label').innerText();
await page.locator('#grammar').screenshot({path:'verify-shots/slates-study/report-grammar.png'});
await page.setViewportSize({width:390,height:900});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'verify-shots/slates-study/report-mobile.png'});
checks.mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length}));
await page.setViewportSize({width:320,height:900});checks.narrow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
const observation={checks,errors};await writeFile('verify-shots/slates-study/html-observation.json',JSON.stringify(observation,null,2));console.log(observation);
if(errors.length||checks.regionCount!==46||!checks.originalTile.includes('잔디')||checks.bridgeAtlas!=='studyAtlas'||checks.bridgePieces!==2||checks.mobile.scrollWidth>390||checks.narrow.scrollWidth>320||checks.mobile.brokenImages)throw Error('HTML review needs attention; see observation');
}finally{await browser.close();}
