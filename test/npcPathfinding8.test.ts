import { afterEach, expect, it } from 'vitest';
import { store } from '@/project/store';
import { CHASE_MAX_EXPANSIONS, findChasePath, nextChaseDecision } from '@/player/chaseAi';
import { registerPageMoveRoutes } from '@/player/playScenePageMoveRoutes';
import { event, fixture, ticks, pos } from './fixtures/npcChasePathfinding';
import { invalidateTilePassabilityComponents } from '@/project/tilePassabilityComponents';
const original = store.getCurrent;
afterEach(() => { store.getCurrent = original; });
const living = (x: number, y: number) => ({ movement: { type: 'living', speed: 8, frequency: 8, living: { destinations: [{ mapId: 'm', x, y }], repeat: false } } });
function corridor(pocket: number | null, three = false, reverse = false) {
 const events = [event('a',3,1,living(8,1)), event('b',4,1,living(0,1))];
 if (three) events.push(event('c',5,1,living(1,1)));
 if (reverse) events.reverse();
 const f = fixture(9,3,events,-10,-10);
 f.map.lowerTiles.fill(1);
 for(let x=0;x<9;x++) f.map.lowerTiles[9+x]=0;
 if(pocket!==null) f.map.lowerTiles[pocket]=0;
 // Rebuild routes after the terrain fixture changes.
 f.scene.autonomousNPCs.clear(); f.scene.pageMoveRouteKeys.clear(); f.scene.pageMoveRouteEventIds.clear();
 registerPageMoveRoutes(f.scene);
 return f;
}
function run(s:any, n=500) {for(let i=0;i<n;i++){ticks(s,1);registerPageMoveRoutes(s);}}
it.each([false,true])('backs up several steps into a pocket; reverse=%s', reverse => {
 const f=corridor(1,false,reverse); run(f.scene);
 expect(pos(f.scene,'a')).toMatchObject({x:8,y:1}); expect(pos(f.scene,'b')).toMatchObject({x:0,y:1});
});
it.each([false,true])('resolves three-person chain at its free end; reverse=%s', reverse => {
 const f=corridor(2,true,reverse); run(f.scene,900);
 expect(pos(f.scene,'a')).toMatchObject({x:8,y:1}); expect(pos(f.scene,'b')).toMatchObject({x:0,y:1}); expect(pos(f.scene,'c')).toMatchObject({x:1,y:1});
});
it('impossible corridor stays still rather than oscillating',()=>{
 const f=corridor(null,true);run(f.scene,60);const before=JSON.stringify(f.scene.eventPositions);run(f.scene,400);expect(JSON.stringify(f.scene.eventPositions)).toBe(before);
});
it('fixed blocker is bypassed when a detour exists and waits otherwise',()=>{
 for(const detour of [false,true]){
  const f=fixture(7,3,[event('a',0,1,living(6,1)),event('fixed',3,1,{movement:{type:'fixed'}})],-10,-10);
  if(!detour){for(let x=0;x<7;x++){f.map.lowerTiles[x]=1;f.map.lowerTiles[14+x]=1;}}
  run(f.scene);expect(pos(f.scene,'a').x).toBe(detour?6:2);expect(pos(f.scene,'fixed').x).toBe(3);
 }
});
it.each([false,true])('pathfind=false escapes a wall without an immediate reverse step; mirrored=%s', mirrored=>{
 const f=fixture(7,7,[],5,3);for(let y=1;y<=5;y++)f.map.lowerTiles[y*7+3]=1;
 const target={x:mirrored?1:5,y:3};
 let from={x:mirrored?4:2,y:3};const mover={timer:0,moveIntervalMs:80};const trail=[from];let touched=false;
 for(let i=0;i<60;i++) {const d=nextChaseDecision({...f,from,player:target,mover,deltaMs:80,pathfind:false});if(d.kind==='touch'){touched=true;break;}if(d.kind==='move'){from={x:d.x,y:d.y};trail.push(from);}}
 for(let i=2;i<trail.length;i++)expect(trail[i]).not.toEqual(trail[i-2]);
 expect(touched).toBe(true);
});
it('caps a single unreachable A* to 2048 node expansions',()=>{
 const f=fixture(100,100,[],50,50);let queries=0;
 const path=findChasePath(f.project,f.map,{x:0,y:0},{x:50,y:50},{footprint:{width:1,height:1},passRows:1,blocked:(x,y)=>{queries++;return Math.abs(x-50)+Math.abs(y-50)===1;}},undefined,CHASE_MAX_EXPANSIONS);
 expect(path).toEqual([]);expect(queries).toBeLessThanOrEqual(2048*4);
 console.log('bounded A* passage queries',queries);
});

it('uncapped callers (schedules, coordinate moves, doors) still find long detours past 2048 expansions',()=>{
 // 100x100 serpentine: walls on every other row leave one gap, alternating ends — the path is ~5000 cells.
 const f=fixture(100,100,[],99,99);
 const blocked=(x:number,y:number)=>y%2===1&&(Math.floor(y/2)%2===0?x!==99:x!==0);
 const pass={footprint:{width:1,height:1},passRows:1,blocked};
 const path=findChasePath(f.project,f.map,{x:0,y:0},{x:99,y:98},pass);
 expect(path.length).toBeGreaterThan(2048);
 expect(path.at(-1)).toEqual({x:99,y:98});
 expect(findChasePath(f.project,f.map,{x:0,y:0},{x:99,y:98},pass,undefined,CHASE_MAX_EXPANSIONS)).toEqual([]);
});

it('the trailing end yields first when only that end has spare space',()=>{
 const f=corridor(6,true);f.map.lowerTiles[7]=0;run(f.scene,1200);
 expect(pos(f.scene,'a')).toMatchObject({x:8,y:1});expect(pos(f.scene,'b')).toMatchObject({x:0,y:1});expect(pos(f.scene,'c')).toMatchObject({x:1,y:1});
});
// Oracle captured from ef5375b2fa, seed 928, LCG 1664525/1013904223; 70/80 targets reachable.
it('keeps legacy A* bytes on 80 deterministic small maps', async()=>{
 const {default:cases}=await import('./fixtures/npcChasePathfinding8Oracle.json');
 for(const sample of cases){const f=fixture(12,12,[],11,11);f.map.lowerTiles=sample.tiles;expect(JSON.stringify(findChasePath(f.project,f.map,{x:0,y:0},{x:11,y:11}))).toBe(JSON.stringify(sample.path));}
});
it('does not park on a peer destination even when that side pocket is nearer',()=>{
 const f=corridor(1);f.map.lowerTiles[2]=0;
 f.map.events.find((e:any)=>e.id==='b').pages[0].movement=living(2,0).movement;
 registerPageMoveRoutes(f.scene);run(f.scene,700);
 expect(pos(f.scene,'a')).toMatchObject({x:8,y:1});expect(pos(f.scene,'b')).toMatchObject({x:2,y:0});
});
it('backs up a wide body into a full-width pocket, never the narrow opening',()=>{
 const body={footprint:{width:2,height:1},passRows:1};
 const f=fixture(11,3,[event('a',4,1,{...living(9,1),...body}),event('b',6,1,{...living(0,1),...body})],-10,-10);
 f.map.lowerTiles.fill(1);for(let x=0;x<11;x++)f.map.lowerTiles[11+x]=0;for(const x of [2,3,4])f.map.lowerTiles[x]=0;
 f.scene.autonomousNPCs.clear();f.scene.pageMoveRouteKeys.clear();f.scene.pageMoveRouteEventIds.clear();registerPageMoveRoutes(f.scene);
 run(f.scene,700);expect(pos(f.scene,'a')).toMatchObject({x:9,y:1});expect(pos(f.scene,'b')).toMatchObject({x:0,y:1});
});

it('capped chase A* widens its cap on following frames and still reaches a 198-cell detour',()=>{
 // Adversarial review repro: a 100x100 wall with one gap at the far end. The first capped search fails;
 // before the fix every 500ms retry repeated the same 2048 cap and the chaser waited forever.
 const f=fixture(100,100,[],51,1);for(let y=0;y<99;y++)f.map.lowerTiles[y*100+50]=1;
 const player={x:51,y:1};let from={x:49,y:1};const mover:any={timer:0,moveIntervalMs:80};let touched=false;let searchesFrame1=0;
 for(let i=0;i<600&&!touched;i++){const d=nextChaseDecision({...f,from,player,mover,deltaMs:80});if(i===0)searchesFrame1=mover.chaseExpansionCap??0;if(d.kind==='touch')touched=true;else if(d.kind==='move')from={x:d.x,y:d.y};}
 expect(searchesFrame1).toBe(CHASE_MAX_EXPANSIONS*2);
 expect(touched).toBe(true);
});

it('pathfind=false keeps touching an adjacent stationary target',()=>{
 const f=fixture(5,3,[],2,1);const mover={timer:0,moveIntervalMs:80};const kinds:string[]=[];
 for(let i=0;i<8;i++)kinds.push(nextChaseDecision({...f,from:{x:1,y:1},player:{x:2,y:1},mover,deltaMs:500,pathfind:false}).kind);
 expect(kinds).toEqual(Array(8).fill('touch'));
});

it('a yielder resumes once a detour opens even when the peer parks on its original cell',()=>{
 // Adversarial review repro: width-2 bodies, b's destination is a's original cell.
 const body={footprint:{width:2,height:1},passRows:1};
 const f=fixture(11,3,[event('a',4,1,{...living(9,1),...body}),event('b',6,1,{...living(4,1),...body})],-10,-10);
 f.map.lowerTiles.fill(1);for(let x=0;x<11;x++)f.map.lowerTiles[11+x]=0;for(const x of [2,3,4,5])f.map.lowerTiles[x]=0;
 f.scene.autonomousNPCs.clear();f.scene.pageMoveRouteKeys.clear();f.scene.pageMoveRouteEventIds.clear();registerPageMoveRoutes(f.scene);
 for(let i=0;i<1000;i++){if(i===200){for(let x=6;x<11;x++)f.map.lowerTiles[x]=0;invalidateTilePassabilityComponents(f.map);}ticks(f.scene,1);registerPageMoveRoutes(f.scene);}
 expect(pos(f.scene,'a')).toMatchObject({x:9,y:1});expect(pos(f.scene,'b')).toMatchObject({x:4,y:1});
});

it.each([32,33])('a %i-NPC head-on line still resolves (group cap falls back to the pair)',n=>{
 const start=n+1,w=2*n+5,events=[event('a',start,1,living(w-1,1))];for(let k=1;k<n;k++)events.push(event('e'+k,start+k,1,living(k-1,1)));
 const f=fixture(w,3,events,-10,-10);f.map.lowerTiles.fill(1);for(let x=0;x<w;x++)f.map.lowerTiles[w+x]=0;f.map.lowerTiles[start]=0;
 f.scene.autonomousNPCs.clear();f.scene.pageMoveRouteKeys.clear();f.scene.pageMoveRouteEventIds.clear();registerPageMoveRoutes(f.scene);
 for(let i=0;i<3500;i++){ticks(f.scene,1);registerPageMoveRoutes(f.scene);}
 const reached=events.filter(e=>{const p=pos(f.scene,e.id),d=(e.pages[0] as any).movement.living.destinations[0];return p.x===d.x&&p.y===d.y}).length;
 expect(reached).toBe(n);
},120_000);
