import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
const B=255/256; const seq=(v:number[],f=B)=>{let i=0;return()=>v[i++]??f;};
const project=createScarloxyPokemonDemoProject();
const enemy=project.database.enemies.find(r=>r.id==="enemy_pkmn_larvea")!;
enemy.stats={...enemy.stats,maxHp:999,attack:60,defense:100,mind:100,agility:1};
enemy.actions=[{skillId:"skill_scarloxy_scratch",priority:5,condition:{kind:"always"},switchOnAfterAction:{enabled:false},switchOffAfterAction:{enabled:false}} as any];
const mkm=(iid:string,lvl:number)=>({instanceId:iid,speciesId:scarloxySpeciesId("sparchu"),level:lvl,exp:0,skillIds:["skill_scarloxy_quick"],skillPp:{skill_scarloxy_quick:5},friendship:70,caughtAt:{mapId:"map_pkmn_town",x:1,y:1}} as any);
const potion=project.database.items.find(i=>i.type==="medicine"&&i.hpRecovery.flat>0&&i.scope==="ally");
console.log("medicine item:",potion?.id, potion?.hpRecovery);
const rt=createBattleRuntime({project,troopId:"troop_pkmn_grass_a",canEscape:true,canLose:true,battleFlow:"strict",partyMonsters:[mkm("m1",30),mkm("m2",30)],
  sessionState:{switches:{},variables:{},inventory:{[potion!.id]:3}},rng:seq([B,B,0])} as any);
let s=rt.snapshot(); console.log("actors:",s.actors.map(a=>[a.recordId,a.hp,a.maxHp]),"reserve:",s.reserveActors?.map(a=>[a.recordId,a.hp]),"activeSlots");
rt.performActorCommand({kind:"switch",targetActorId:"m2"} as any);
s=rt.snapshot(); console.log("after manual switch active:",s.actors.map(a=>a.recordId),"timeline kinds:",s.timeline.map(t=>t.kind+":"+(t.commandKind??"")).join(","));
// take damage then potion
const hpBefore=s.actors[0]!.hp;
rt.performActorCommand({kind:"item",itemId:potion!.id,targetEnemyId:"enemy-1",targetActorId:s.actors[0]!.recordId} as any);
s=rt.snapshot(); console.log("hp before/after item:",hpBefore,s.actors[0]!.hp,"maxHp",s.actors[0]!.maxHp,"result",s.result,"phase",s.phase,"forced:",s.forcedSwitchActorId, "inv", JSON.stringify(s.eventState.inventory));
// keep attacking until faint
for(let i=0;i<8 && !s.forcedSwitchActorId && !s.result;i++){ rt.performActorCommand({kind:"skill",skillId:"skill_scarloxy_quick",targetEnemyId:"enemy-1"} as any); s=rt.snapshot(); }
console.log("after rounds: active",s.actors.map(a=>[a.recordId,a.hp]),"reserve",s.reserveActors?.map(a=>[a.recordId,a.hp]),"forcedSwitchActorId",s.forcedSwitchActorId,"result",s.result);
if(s.forcedSwitchActorId){ try{ rt.performActorCommand({kind:"skill",skillId:"skill_scarloxy_quick",targetEnemyId:"enemy-1"} as any); }catch(e:any){console.log("attack during forced switch ->",String(e.message).slice(0,100));} s=rt.snapshot(); console.log("still forced?",s.forcedSwitchActorId);
 rt.performActorCommand({kind:"switch",targetActorId:s.reserveActors!.find(a=>a.hp>0)!.recordId} as any); s=rt.snapshot(); console.log("after forced switch active",s.actors.map(a=>[a.recordId,a.hp]),"forced",s.forcedSwitchActorId);}
