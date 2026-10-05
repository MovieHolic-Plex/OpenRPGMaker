// Native user gestures, observed semantic materials and a fresh canonical reload.
import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright';import {isDeepStrictEqual} from 'node:util';
import {startHost,newEditor,stored,writeRuntimeProject} from '../../src/harnesses/assistant-capability/node/editorDriver.mjs';
const dir=path.resolve(process.argv[2]),projectDir=path.join(dir,'project');
process.env.OPRN_SHARED_CONTENT_SQLITE??=path.resolve('qa-runs/harnesses/assistant-capability/worldmap-film-20261005-03/shared-catalog-snapshot.sqlite');
process.env.OPRN_SHARED_CHARACTER_GRAPHICS_FILE??=path.resolve('qa-runs/harnesses/assistant-capability/worldmap-film-20261005-03/character-catalog-snapshot.json');
const verticalOnly=process.argv[3]==='vertical-only';
const report={errors:[],checks:[]};let browser,context,page;
const host=await startHost(projectDir,dir);
async function click(x,y){const p=await page.evaluate(([x,y])=>window.__oprnEditWorldToClient((x+.5)*16,(y+.5)*16),[x,y]);await page.mouse.click(p.x,p.y);}
async function save(){await page.getByTestId('toolbar-save').click();await page.waitForFunction(()=>['idle','saved'].includes(document.querySelector('[data-testid="toolbar-save"]')?.dataset.autosaveKind));return stored(projectDir);}
async function read(){await save();writeRuntimeProject(projectDir,path.join(dir,'live.json'),stored(projectDir).project);return JSON.parse(fs.readFileSync(path.join(dir,'live.json')));}
function check(name,ok){report.checks.push({name,ok});if(!ok)throw Error(name);}
async function screenshot(name){await page.mouse.move(500,24);await page.screenshot({path:path.join(dir,name+'.png')});const p=await page.evaluate(()=>window.__oprnEditWorldToClient(0,0));await page.screenshot({path:path.join(dir,name+'-map.png'),clip:{x:p.x,y:p.y,width:960,height:576}});}
try{
 browser=await chromium.launch({args:['--no-sandbox']});let ed=await newEditor(browser,host.url,projectDir,{}, {viewport:{width:1800,height:1100},onPage:async p=>{page=p;p.on('pageerror',e=>report.errors.push(e.message));await p.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','standard');localStorage.setItem('oprn:first-edit-guide:seen','1');});}});context=ed.context;
 // No force click: the expanded conversation must leave zoom usable.
 await page.getByTestId('editor-zoom-stepper').click({timeout:10000});await page.getByTestId('editor-zoom-1').click();check('조수를 펼친 채 배율 선택',true);
 await page.getByTestId('ai-collapse').click();
 if(verticalOnly) {
   await page.getByTestId('worldmap-brush-river-grass').click();for(let x=45;x<=55;x++)await click(x,30);
   await page.getByTestId('worldmap-brush-road-grass').click();for(let y=27;y<=33;y++)await click(53,y);
   const p=await read(),m=p.maps.ux_world,t=p.tilesets[m.tilesetId],tile=m.lowerTiles[30*60+53],meta=t.tileMeta[tile],pass=t.passability[tile];
   check('가로 강 횡단 세로 다리·설원 바탕 자동',meta.tags[1]==='bridge-vertical'&&meta.tags[2]==='snow');
   check('세로 다리 통행 축',pass.up&&pass.down&&!pass.left&&!pass.right);await screenshot('03-vertical-bridge');
 } else {
 await page.getByTestId('worldmap-brush-road-grass').click();
 for(let x=4;x<=55;x++)await click(x,18);
 let p=await read(),m=p.maps.ux_world,t=p.tilesets[m.tilesetId];
 const mat=(tile)=>t.tileMeta[tile]?.tags;
 check('세 바탕 길·세 다리 자동 배치',Array.from({length:52},(_,i)=>{const x=i+4,a=mat(m.lowerTiles[18*60+x]);return a[1]===([12,31,49].includes(x)?'bridge-horizontal':'road')&&a[2]===(x<20?([12].includes(x)?'water':'grass'):x<40?'sand':'snow');}).every(Boolean));
 const lower=m.lowerTiles.slice();await page.getByTestId('worldmap-brush-forest-any').click();await click(7,6);await click(8,6);
 p=await read();m=p.maps.ux_world;t=p.tilesets[m.tilesetId];check('숲 선택 시 층 전환·바닥 보존',isDeepStrictEqual(lower,m.lowerTiles)&&t.tileMeta[m.upperTiles[6*60+7]].tags[1]==='forest');
 await page.getByTestId('worldmap-category-icons').click();await page.getByTestId('structure-kit-wmi-fantasy/village_wood').click();await click(6,14);p=await read();m=p.maps.ux_world;t=p.tilesets[m.tilesetId];const kit=t.structureKits.find(k=>k.id==='wmi-fantasy/village_wood');check('거점 탭에서 전체 아이콘 선택',kit.rows.every((r,dy)=>r.upperTiles.every((tile,dx)=>m.upperTiles[(14+dy)*60+6+dx]===tile)));
 await screenshot('01-auto-placement');
 await page.getByTestId('worldmap-category-terrain').click();await page.screenshot({path:path.join(dir,'terrain-palette.png')});await page.getByTestId('layer-lower').click();await page.getByTestId('tool-erase').click();await click(31,18);
 p=await read();m=p.maps.ux_world;t=p.tilesets[m.tilesetId];check('다리 지우면 사막 강 복원',t.tileMeta[m.lowerTiles[18*60+31]].tags[1]==='river'&&t.tileMeta[m.lowerTiles[18*60+31]].tags[2]==='sand');
 await page.keyboard.press('Control+z');p=await read();m=p.maps.ux_world;t=p.tilesets[m.tilesetId];check('되돌리기 후 다리 복원',t.tileMeta[m.lowerTiles[18*60+31]].tags[1]==='bridge-horizontal');
 await page.getByTestId('worldmap-brush-road-grass').click();await page.getByTestId('worldmap-brush-background').evaluate(e=>e.closest('details').open=true);await page.getByTestId('worldmap-brush-background').selectOption('snow');await page.getByTestId('worldmap-brush-road-snow').click();await click(6,24);
 p=await read();m=p.maps.ux_world;t=p.tilesets[m.tilesetId];check('직접 바탕 지정 유지',t.tileMeta[m.lowerTiles[24*60+6]].tags[2]==='snow');
 await page.getByTestId('worldmap-brush-background').evaluate(e=>e.closest('details').open=true);await page.getByTestId('worldmap-brush-background').selectOption('auto');await screenshot('02-controls');
 }
 const saved=await save();await context.close();context=null;ed=await newEditor(browser,host.url,projectDir,{});context=ed.context;const loaded=ed.loads.find(l=>l.sha256===saved.sha256);check('SQLite 저장 후 새 브라우저 재로드',Boolean(loaded)&&isDeepStrictEqual(saved.project.maps,loaded.maps));report.projectId=saved.projectId;report.revision=saved.revision;report.sha256=saved.sha256;report.projectDir=projectDir;
}catch(e){report.failure=e.message;console.error(e);await page?.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});process.exitCode=1;}finally{fs.writeFileSync(path.join(dir,verticalOnly?'axes.json':'native.json'),JSON.stringify(report,null,2));await context?.close().catch(()=>{});await browser?.close().catch(()=>{});await host.close();console.log(report);}
