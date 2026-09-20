import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startPlayerQaServer,runRuntimeQa} from './lib/runtimeQaRun.mjs';
const root=process.argv[2]??'output/grand-castle',proof=JSON.parse(fs.readFileSync(root+'/assembly-proof.json'));
const project=JSON.parse(fs.readFileSync(root+'/sqlite-reloaded.json'));
const mapId=proof.mapId;
const beats=[{id:'title',expect:{testidPresent:['title-screen']}},{id:'start',note:'SQLite 재로드본의 남쪽 진입로',shot:true,ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{mapId,...project.startPos,playerSpriteTextureLoaded:true}}];
for(const stop of proof.routes){
 beats.push({id:'walk-'+stop.id,note:stop.id+'까지 실제 이동 경로 '+stop.moves.length+'칸',shot:true,ops:[{kind:'playerRoute',moves:stop.moves},{kind:'waitForPosition',mapId,x:stop.x,y:stop.y,timeoutMs:60000}],expect:{mapId,x:stop.x,y:stop.y,playerSpriteTextureLoaded:true}});
 if(stop.npc){
 const event=project.maps[mapId].events.find(e=>e.id===stop.npc),line=event.pages[0].commands[0].body;
 beats.push({id:'talk-'+stop.id,note:event.name+'와 대화',shot:true,ops:[{kind:'face',dir:'up'},{kind:'action'},{kind:'waitFor',testid:'dialogue-box',state:'present'},{kind:'key',key:'Enter'},{kind:'waitForAttr',testid:'dialogue-box',attr:'data-dialogue-phase',value:'shown'}],expect:{testidPresent:['dialogue-box'],visibleText:{'dialogue-box':line}}});
 beats.push({id:'close-'+stop.id,ops:[{kind:'pressUntil',key:'Enter',testid:'dialogue-box',state:'absent'}]});
 }
 if(stop.id==='pier'&&root==='output/grand-castle')beats.push({id:'pier-water-block',note:'부두 끝에서 물로 떨어지지 않음',shot:true,ops:[{kind:'hold',dir:'right',ms:700}],expect:{mapId,x:stop.x+1,y:stop.y}});
 // Return one real step to the authored route origin after the edge probe.
 if(stop.id==='pier'&&root==='output/grand-castle')beats.push({id:'pier-back',ops:[{kind:'playerRoute',moves:[{kind:'move',dir:'left'}]},{kind:'waitForPosition',mapId,x:stop.x,y:stop.y}],expect:{mapId,x:stop.x,y:stop.y}});
}
const server=await startPlayerQaServer();const browser=await chromium.launch();
try{const page=await browser.newPage();const result=await runRuntimeQa(page,{id:'grand-castle',projectFixture:root+'/sqlite-reloaded.json',viewport:{width:1280,height:900},beats},{serverUrl:server.url,outDir:root+'/runtime'});fs.writeFileSync(root+'/runtime-result.json',JSON.stringify(result,null,2));assert.equal(result.errors.length,0);assert.equal(result.beats.flatMap(b=>b.failures).length,0);console.log(JSON.stringify({beats:result.beats.length,failures:0,errors:0}));}finally{await browser.close();await server.close();}
