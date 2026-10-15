import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
import { startSession } from "../../../src/project/session";
import { giveMonster, monsterCurrentHp } from "../../../src/project/monsterCollection";
import { createDefeatRecovery } from "../../../src/player/defeatRecovery";
import { applyBattleRewardsToSession } from "../../../src/player/battleRewardsToSession";
const B=255/256; function seq(v:number[],f=B){let i=0;return()=>v[i++]??f;}
function mk(setup:(p:any)=>void, rng?:()=>number){
  const project:any=createScarloxyPokemonDemoProject(); setup(project);
  const pm={instanceId:"m1",speciesId:scarloxySpeciesId("sparchu"),level:60,exp:0,skillIds:["skill_scarloxy_quick"],skillPp:{skill_scarloxy_quick:30},friendship:70,caughtAt:{mapId:"map_pkmn_town",x:1,y:1}} as any;
  const rt:any=createBattleRuntime({project,troopId:"troop_pkmn_grass_a",canEscape:true,canLose:true,battleFlow:"strict",partyMonsters:[pm],sessionState:{switches:{},variables:{v_shakes:0},inventory:{item_capture_orb:5}},rng:rng??seq([B,B,0])} as any);
  return {project,rt,pm};
}
// 1) blackout gold
{ const project:any=createScarloxyPokemonDemoProject(); const s:any=startSession(project); s.gold=1001;
  const a:any=createDefeatRecovery(project,s,{outcome:"recover",presentation:"blackout"} as any);
  const b:any=createDefeatRecovery(project,s,{outcome:"recover",presentation:"blackout",goldLossPercent:50} as any);
  console.log("blackout gold 1001 -> default",a.gold,"| goldLossPercent 50:",b.gold); }
// 2) capture shakes -> variable
{ const {rt}=mk(p=>{p.variables.push({id:"v_shakes",name:"v_shakes"});p.system.captureShakesVariableId="v_shakes"; const e=p.database.enemies.find((r:any)=>r.id==="enemy_pkmn_larvea"); e.stats={...e.stats,maxHp:100,defense:100,attack:1};}, seq([0.9,0.9,0.9,0.9,0.9,0.9]));
  rt.performActorCommand({kind:"capture",captureItemId:"item_capture_orb",targetEnemyId:"enemy-1"});
  const s=rt.snapshot(); console.log("capture:",JSON.stringify(s.lastCaptureResult),"-> variable v_shakes =",s.eventState.variables.v_shakes); }
// 3) trainer prize formula + 4) exp share
for (const policy of [undefined,{trainerPrizePerLevel:20,expShare:true}]) {
  const {project,rt,pm}=mk(p=>{ if(policy)p.system.rewardPolicy=policy; p.database.troops.find((t:any)=>t.id==="troop_pkmn_grass_a").trainerBattle=true; const e=p.database.enemies.find((r:any)=>r.id==="enemy_pkmn_larvea"); e.stats={...e.stats,maxHp:5,defense:1}; e.rewards={...e.rewards,gold:7,exp:40}; e.level=12; });
  for(let i=0;i<6&&!rt.snapshot().result;i++){ try{ rt.performActorCommand({kind:"skill",skillId:"skill_scarloxy_quick",targetEnemyId:"enemy-1"}); }catch(e:any){ console.log("cmd err",e.message); break; } }
  const s=rt.snapshot(); console.log("policy",JSON.stringify(policy??null),"result",s.result,"rewards.gold",s.rewards.gold,"exp",s.rewards.exp);
  // exp share
  const sess:any=startSession(project); sess.monsterInstances={}; sess.monsterParty=[];
  const a:any=giveMonster(project,sess,{speciesId:scarloxySpeciesId("sparchu"),level:10}); const b:any=giveMonster(project,sess,{speciesId:scarloxySpeciesId("sparchu"),level:10});
  const ida=a.instance.instanceId, idb=b.instance.instanceId;
  applyBattleRewardsToSession(sess, { result:"victory", canLose:true, rewards:{exp:200,gold:0,items:[],enemyLevel:12,levelUps:[],monsterLevelUps:[]}, actors:[], eventState:s.eventState, capturedMonsters:[], participatingActorIds:[ida], monsterPartyMode:true } as any, project);
  console.log("   expShare:",policy?.expShare?"on":"off","| fighter exp",sess.monsterInstances[ida].exp,"lv",sess.monsterInstances[ida].level,"| bench exp",sess.monsterInstances[idb].exp,"lv",sess.monsterInstances[idb].level);
}
