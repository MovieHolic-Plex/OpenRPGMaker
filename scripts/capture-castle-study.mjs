import fs from 'node:fs';
import {chromium} from 'playwright';
import {startPlayerQaServer,runRuntimeQa} from './lib/runtimeQaRun.mjs';
const root='output/castle-study',proof=JSON.parse(fs.readFileSync(root+'/assembly-proof.json'));
const beats=[{id:'title',expect:{testidPresent:['title-screen']}},{id:'start',shot:true,ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{mapId:'castle-study',x:22,y:34,playerSpriteTextureLoaded:true}}];
for(const stop of proof.routes){
 beats.push({id:'walk-'+stop.id,shot:true,ops:[{kind:'playerRoute',moves:stop.moves},{kind:'waitForPosition',mapId:'castle-study',x:stop.x,y:stop.y}],expect:{mapId:'castle-study',x:stop.x,y:stop.y}});
 if(stop.id==='gate'){
  beats.push({id:'closed-gate',shot:true,ops:[{kind:'hold',dir:'up',ms:450}],expect:{mapId:'castle-study',x:stop.x,y:stop.y}});
 }else{
  beats.push({id:'talk-'+stop.id,shot:true,ops:[{kind:'face',dir:'up'},{kind:'action'},{kind:'waitFor',testid:'dialogue-box',state:'present'},{kind:'key',key:'Enter'},{kind:'waitForAttr',testid:'dialogue-box',attr:'data-dialogue-phase',value:'shown'}],expect:{testidPresent:['dialogue-box'],visibleText:{'dialogue-box':stop.id==='merchant'?'분수 왼쪽이 장터예요. 성문은 지금 닫혀 있어요.':'시계나무 그늘에서 쉬었다 가세요. 강가에서는 발밑을 조심하시고요.'}}});
  beats.push({id:'close-'+stop.id,ops:[{kind:'pressUntil',key:'Enter',testid:'dialogue-box',state:'absent'}]});
 }
}
const server=await startPlayerQaServer();const browser=await chromium.launch();
try{const page=await browser.newPage();const result=await runRuntimeQa(page,{id:'castle-study',projectFixture:root+'/sqlite-reloaded.json',viewport:{width:1280,height:900},beats},{serverUrl:server.url,outDir:root+'/runtime'});console.log(JSON.stringify(result));}finally{await browser.close();await server.close();}
