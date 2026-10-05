// Focused player.html capture of the six reopened SQLite examples. No editor shell, vitest or gates.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {runRuntimeQa,startPlayerQaServer} from '../lib/runtimeQaRun.mjs';
import {canMove} from '../../src/project/collision.ts';
const out=path.resolve(process.argv[2]??'verify-shots/worldmap-structures');
const cases=JSON.parse(fs.readFileSync(path.join(out,'canonical-projects.json'),'utf8')).cases;
const selectedIndex=process.argv.indexOf('--structures');
const selected=selectedIndex>=0?process.argv[selectedIndex+1]!.split(','):null;
const server=await startPlayerQaServer();const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
const reports:any[]=[];
try{
  for(const item of cases){
    if(selected&&!selected.includes(item.structure))continue;
    const fixture=path.join(out,item.structure,'runtime-project.json'),p=JSON.parse(fs.readFileSync(fixture,'utf8')),atlas=p.worldAtlases[0];
    const start=atlas.nodes.find((n:any)=>n.id===atlas.startNodeId);
    const beats:any[]=[
      {id:'title',note:'타이틀',expect:{testidPresent:['title-screen']}},
      {id:'field',note:'정본에서 내보낸 실제 맵 시작',ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{mapId:item.startMapId,...item.startPos,playerSpriteTextureLoaded:true},shot:true},
      {id:'atlas',note:'M → 실제 세계 지도',ops:[{kind:'key',key:'m'},{kind:'waitFor',testid:'world-atlas',state:'present'},{kind:'waitForAttr',testid:'world-atlas-picture',attr:'data-atlas-ready',value:'true'}],
        expect:{mapId:item.startMapId,...item.startPos,testidPresent:['world-atlas']},shot:true},
      {id:'paused-map',note:'지도가 열린 동안 방향키로 맵이 움직이지 않는다',ops:[{kind:'hold',dir:'right',ms:350}],expect:{mapId:item.startMapId,...item.startPos,testidPresent:['world-atlas']}},
    ];
    if(['region-routes','field-overview','room-network'].includes(item.structure))beats.push({id:'pin',note:'현재 장소의 핀',ops:[{kind:'pointerClick',testid:'world-atlas-pin'},{kind:'waitForAttr',testid:'world-atlas-pin',attr:'aria-pressed',value:'true'}],expect:{switches:{[atlas.pins.find((pin:any)=>pin.nodeId===start.id).switchId]:true}},shot:true});
    beats.push({id:'close',note:'Esc 닫기',ops:[{kind:'key',key:'Escape'},{kind:'waitFor',testid:'world-atlas',state:'absent'}],expect:{testidAbsent:['world-atlas','main-menu']}});
    if(item.structure==='room-network'&&start.roomShape!==undefined){
      const map=p.maps[start.mapId],x=Math.floor(map.width*.5),y=map.height-3;
      beats.push({id:'ladder',note:'실제 사다리로 점프 높이를 넘는 위쪽 방까지 오르기',ops:[{kind:'teleport',mapId:start.mapId,x,y},{kind:'dir',dir:'up'},
        {kind:'waitForPosition',mapId:start.mapId,x,y:y-6},{kind:'dir',dir:null}],expect:{mapId:start.mapId,x,y:y-6},shot:true});
    }
    if(['region-routes','field-overview','room-network','scaled-world'].includes(item.structure)){
      const from=atlas.overviewMapId??start.mapId,edge=atlas.edges.find((e:any)=>e.from===start.id&&!e.requires.length);
      const dest=atlas.overviewMapId?start:atlas.nodes.find((n:any)=>n.id===edge.to);
      const door=atlas.overviewMapId?start.worldEntrance:edge.fromExit;
      const map=p.maps[from];
      const neighbor=[{x:door.x-1,y:door.y,dir:'right'},{x:door.x+1,y:door.y,dir:'left'},{x:door.x,y:door.y-1,dir:'down'},{x:door.x,y:door.y+1,dir:'up'}]
        .find(q=>canMove(p,map,q.x,q.y,door.x,door.y));
      if(!neighbor)throw Error('No actual door approach');
      const event=map.events.find((e:any)=>e.id===(atlas.overviewMapId?start.id+'_enter':edge.id+'_out'));
      const transfers=(list:any[]):any[]=>list.flatMap(c=>c.kind==='transfer'?[c]:c.kind==='fork'?[...transfers(c.then),...transfers(c.else??[])]:[]);
      const landing=transfers(event.pages[0].commands).find(c=>c.mapId===dest.mapId);
      beats.push({id:'physical-door',note:'실제 출입구를 밟아 연결 맵으로 이동',ops:[{kind:'teleport',mapId:from,x:neighbor.x,y:neighbor.y},{kind:'dir',dir:neighbor.dir},
        {kind:'waitForPosition',mapId:dest.mapId,x:landing.x,y:landing.y}, {kind:'dir',dir:null}],expect:{mapId:dest.mapId,switches:{[dest.visitSwitchId]:true}},shot:true});
    }
    if(['stage-nodes','run-path'].includes(item.structure)){
      const goal=p.maps[start.mapId].events.find((e:any)=>e.id===start.id+'_goal');
      const next=atlas.nodes[item.structure==='run-path'?2:1];
      beats.push(
        {id:'goal',note:'실제 관문과 대화하여 해금',ops:[{kind:'teleport',mapId:start.mapId,x:goal.x-1,y:goal.y},{kind:'face',dir:'right'},{kind:'action'},{kind:'waitFor',testid:'dialogue-box',state:'present'}],expect:{switches:{[start.clearSwitchId]:true}},shot:true},
        {id:'goal-close',note:'관문 대화를 끝까지 확인하고 닫기',ops:[{kind:'waitForText',testid:'dialogue-box',text:'지도에서 다음 길을 확인하세요.'},{kind:'pressUntil',key:'Enter',testid:'dialogue-box',state:'absent',maxPresses:4,timeoutMs:1500}]},
        {id:'travel',note:'열린 인접 장소로 실제 이동',ops:[{kind:'key',key:'m'},{kind:'waitFor',testid:'world-atlas',state:'present'},{kind:'pointerClick',testid:'world-atlas-travel-'+next.id},{kind:'waitForPosition',mapId:next.mapId,...next.entry},{kind:'waitFor',testid:'world-atlas',state:'absent'}],expect:{mapId:next.mapId,switches:{[next.visitSwitchId]:true},testidAbsent:['world-atlas']},shot:true},
      );
    }
    const page=await browser.newPage();
    const report=await runRuntimeQa(page,{id:'worldmap-structure-'+item.structure,projectFixture:fixture,beats},{serverUrl:server.url,outDir:path.join(out,'runtime',item.structure)});
    reports.push({structure:item.structure,errors:report.errors,beats:report.beats.map((b:any)=>({id:b.id,failures:b.failures}))});await page.close();
    console.log(JSON.stringify(reports.at(-1)));
  }
}finally{await browser.close();await server.close();}
const priorFile=path.join(out,'runtime-capture.json');
const prior=selected&&fs.existsSync(priorFile)?JSON.parse(fs.readFileSync(priorFile,'utf8')):[];
fs.writeFileSync(priorFile,JSON.stringify([...prior.filter((r:any)=>!reports.some(n=>n.structure===r.structure)),...reports],null,2));
if(reports.some(r=>r.errors.length||r.beats.some((b:any)=>b.failures.length)))process.exitCode=1;
