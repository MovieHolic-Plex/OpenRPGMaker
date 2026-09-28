// npx tsx --tsconfig tsconfig.app.json scripts/qa/probe-npc-chase-pathfinding.ts
import { findChasePath } from '@/player/chaseAi';
import { updateAutonomousNPCs } from '@/player/playSceneAutonomous';
import { runtimeEventView } from '@/project/runtimeEventState';
import { pursuitPass } from '@/player/pursuitNavigation';
import { event, fixture, ticks, pos } from '../../test/fixtures/npcChasePathfinding';
function out(name: string, value: unknown) { console.log(name, JSON.stringify(value)); }

{
 const f=fixture(7,5,[event('a',1,2),event('b',5,2)],0,0);
 f.scene.autonomousNPCs.get('a').chaseTarget={x:5,y:2}; f.scene.autonomousNPCs.get('b').chaseTarget={x:1,y:2};
 ticks(f.scene,100); out('faction',{a:pos(f.scene),b:pos(f.scene,'b'),blocked:f.scene.autonomousNPCs.get('a').chasePathBlocked});
}
{
 const f=fixture(7,5,[event('a',1,2),event('block',3,1,{movement:{type:'fixed',speed:3,frequency:3}})],5,2);
 const page=f.map.events[0].pages[0];page.footprint={width:1,height:3};page.passRows=1;
 // Single legal terrain row; blocker is ABOVE that row, hence doesn't block feet.
 for(let y=0;y<5;y++)for(let x=0;x<7;x++)if(y!==2)f.map.lowerTiles[y*7+x]=1;
 const view=runtimeEventView(f.map.events[0],f.session,f.scene.eventPositions);
 const expected=findChasePath(f.project,f.map,view,{x:5,y:2},pursuitPass({...f,positions:f.scene.eventPositions},view));
 ticks(f.scene,100);out('passRows',{expected,a:pos(f.scene),blocked:f.scene.autonomousNPCs.get('a').chasePathBlocked});
}
{
 const f=fixture(7,5,[event('a',1,2)],5,2);
 f.project.database.homeDecorationTypes=[{id:'box',blocksMovement:true,footprint:{width:1,height:1}}];
 f.session.homeDecorationPlacements={box:{instanceId:'box',typeId:'box',mapId:'m',x:3,y:2,orientation:'down'}};
 const view=runtimeEventView(f.map.events[0],f.session,f.scene.eventPositions);
 const expected=findChasePath(f.project,f.map,view,{x:5,y:2},pursuitPass({...f,positions:f.scene.eventPositions},view));
 ticks(f.scene,100);out('decoration',{expected,a:pos(f.scene),remaining:f.scene.autonomousNPCs.get('a').chasePath});
}
{
 const f=fixture(8,5,[event('a',1,2,{footprint:{width:3,height:1},passRows:1})],5,2);
 ticks(f.scene,100);out('wideTouch',{a:pos(f.scene),touches:f.scene.touches});
}
{
 const es=Array.from({length:20},(_,i)=>event('s'+i,5+i,5));
 for(const [x,y]of [[49,50],[51,50],[50,49],[50,51]])es.push(event(`b${x}-${y}`,x,y,{movement:{type:'fixed',speed:3,frequency:3}}));
 const f=fixture(100,100,es,50,50);const times=[];for(let i=0;i<4;i++){const start=performance.now();updateAutonomousNPCs(f.scene,500);times.push(+(performance.now()-start).toFixed(2));}
 out('unreachableSwarmMs',{map:'100x100',chaserCount:20,solidRingAroundPlayer:4,times});
}

{
 const f=fixture(8,5,[event('a',1,2)],5,2);
 f.session.playerFootprint={width:3,height:1};f.session.playerPassRows=1;
 ticks(f.scene,100);out('widePlayerOverlap',{a:pos(f.scene),playerAnchor:{x:5,y:2},playerPassRect:{left:4,right:6,top:2,bottom:2},touches:f.scene.touches});
}
