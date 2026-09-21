import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {startPlayerQaServer,runRuntimeQa} from './lib/runtimeQaRun.mjs';
const server=await startPlayerQaServer(),browser=await chromium.launch();
try {for(const id of ['castle-courtyard','castle-small-harbor','castle-stone-lodge']){
 const fixture='public/assets/region-references/'+id+'.oprn.json',p=JSON.parse(fs.readFileSync(fixture));
 const beats=[{id:'title',expect:{testidPresent:['title-screen']}},{id:'start',shot:true,ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{mapId:id,...p.startPos,playerSpriteTextureLoaded:true}}];
 if(id!=='castle-stone-lodge'){const e=p.maps[id].events.find(e=>e.x===p.startPos.x&&e.y===p.startPos.y-1);assert(e);beats.push({id:'dialogue',shot:true,ops:[{kind:'face',dir:'up'},{kind:'action'},{kind:'waitFor',testid:'dialogue-box',state:'present'},{kind:'key',key:'Enter'},{kind:'waitForAttr',testid:'dialogue-box',attr:'data-dialogue-phase',value:'shown'}],expect:{visibleText:{'dialogue-box':e.pages[0].commands[0].body}}});}
 const page=await browser.newPage();const result=await runRuntimeQa(page,{id,projectFixture:fixture,viewport:{width:1280,height:900},beats},{serverUrl:server.url,outDir:'output/castle-scenes/runtime/'+id});fs.writeFileSync('output/castle-scenes/'+id+'-runtime.json',JSON.stringify(result,null,2));assert.equal(result.errors.length,0);assert.equal(result.beats.flatMap(b=>b.failures).length,0);await page.close();console.log(id+' runtime verified');
}}finally{await browser.close();await server.close();}
