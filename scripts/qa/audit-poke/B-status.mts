import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
const prng=(seed:number)=>{let sd=seed>>>0;return()=>{sd=(Math.imul(sd,1664525)+1013904223)>>>0;return ((sd>>>8)&0xffff)/65536;};};
const mon=(o:any={})=>({instanceId:"m1",speciesId:scarloxySpeciesId("sparchu"),level:50,exp:0,skillIds:["skill_scarloxy_quick","skill_scarloxy_spark","skill_scarloxy_wave"],skillPp:{skill_scarloxy_quick:30,skill_scarloxy_spark:30,skill_scarloxy_wave:30},friendship:70,caughtAt:{mapId:"map_pkmn_town",x:1,y:1},...o});
function baseProject(cfg:(p:any)=>void){
  const project:any=createScarloxyPokemonDemoProject();
  const enemy=project.database.enemies.find((r:any)=>r.id==="enemy_pkmn_larvea")!;
  enemy.stats={...enemy.stats,maxHp:999,attack:20,defense:50,mind:50,agility:1};
  enemy.actions=[{skillId:"skill_scarloxy_scratch",priority:5,condition:{kind:"always"},switchOnAfterAction:{enabled:false},switchOffAfterAction:{enabled:false}}];
  cfg(project); return project;
}
function rtFrom(project:any,o:any={}){
  return createBattleRuntime({project,troopId:"troop_pkmn_grass_a",canEscape:true,canLose:true,battleFlow:"strict",partyMonsters:o.party??[mon()],sessionState:{switches:{},variables:{},inventory:{}},rng:o.rng??prng(1)} as any);
}
const sp=(p:any,id:string)=>p.database.monsterSpecies.find((s:any)=>s.id===id);
const act=(rt:any,skill="skill_scarloxy_quick")=>{const b=rt.snapshot().timeline.length; rt.performActorCommand({kind:"skill",skillId:skill,targetEnemyId:"enemy-1"}); return rt.snapshot().timeline.slice(b);};
const hp=(rt:any)=>({a:rt.snapshot().actors[0].hp,e:rt.snapshot().enemies[0].hp});
// (1) speed buff vs turn order in gen1
{
  const project=baseProject((p)=>{ sp(p,scarloxySpeciesId("sparchu")).baseStats.agility=20; const e=p.database.enemies.find((r:any)=>r.id==="enemy_pkmn_larvea"); e.stats.agility=999; });
  const order=(states?:string[])=>{ const rt=rtFrom(project,{party:[mon({stateIds:states,skillIds:["skill_scarloxy_spark"]})]}); const t=act(rt,"skill_scarloxy_spark").filter((e:any)=>e.kind==="damage"||e.kind==="miss"); return t.map((e:any)=>e.side).join(">"); };
  console.log("S1 turn order (enemy agility 999 vs player ~25): none:",order(),"| player state_agility_up(x2):",order(["state_agility_up"]),"=> speed buff does NOT reorder in gen1 if still enemy>actor");
  const project2=baseProject((p)=>{ sp(p,scarloxySpeciesId("sparchu")).baseStats.agility=100; const e=p.database.enemies.find((r:any)=>r.id==="enemy_pkmn_larvea"); e.stats.agility=40; });
  const o2=(states?:string[])=>{ const rt=rtFrom(project2,{party:[mon({stateIds:states,skillIds:["skill_scarloxy_spark"]})]}); const t=act(rt,"skill_scarloxy_spark").filter((e:any)=>e.kind==="damage"||e.kind==="miss"); return t.map((e:any)=>e.side).join(">"); };
  const mm=rtFrom(project2,{}).snapshot(); console.log("   stats actor agi",mm.actors[0].effectiveStats.agility,"enemy agi",mm.enemies[0].effectiveStats?.agility);
  console.log("S1b actor faster: none:",o2(),"| with state_agility_down (x0.5):",o2(["state_agility_down"]),"(want enemy first if debuff worked: actor 100*.5 < 40? depends)");
}
// (2) volatile states: restrictsAction non-major (state_stop) / deep poison / regen — gen1 path
{
  const project=baseProject((p)=>{ sp(p,scarloxySpeciesId("sparchu")).types=["water"]; });
  const run=(states:string[],label:string)=>{
    const rt=rtFrom(project,{party:[mon({stateIds:states})]});
    const h0=hp(rt); const t=act(rt); const h1=hp(rt);
    const actorActed=t.some((e:any)=>e.side==="actor"&&(e.kind==="damage"||e.kind==="miss"));
    console.log(`S2 ${label}: actorActed=${actorActed} enemyHp ${h0.e}->${h1.e} actorHp ${h0.a}->${h1.a} actorStates=${JSON.stringify(rt.snapshot().actors[0].stateIds)} kinds=${t.map((e:any)=>e.side+":"+e.kind).join(",")}`);
  };
  run([],"baseline");
  run(["state_stop"],"state_stop (restrictsAction, non-major)");
  run(["state_petrify"],"state_petrify (incapacitates)");
  run(["state_deep_poison"],"state_deep_poison (hpDamage 12%/turn)");
  run(["state_regen"],"state_regen (8% heal/turn)");
  run(["state_silence"],"state_silence (blocksSkillUse)");
  run(["state_berserk"],"state_berserk");
}
// (3) gen1 major statuses: MC frequency of full paralysis, sleep length, burn/poison residual, freeze
{
  const project=baseProject((p)=>{ sp(p,scarloxySpeciesId("sparchu")).types=["water"]; });
  let para=0,N=600;
  for(let i=0;i<N;i++){ const rt=rtFrom(project,{party:[mon({stateIds:["state_paralysis"]})],rng:prng(900+i)}); const t=act(rt); if(!t.some((e:any)=>e.side==="actor"&&(e.kind==="damage"||e.kind==="miss"))) para++; }
  console.log(`S3 paralysis: actor lost turn ${(para/N*100).toFixed(1)}% (cartridge 63/256=24.6%)`);
  // poison/burn residual
  for(const st of ["state_poison","state_burn"]){ const rt=rtFrom(project,{party:[mon({stateIds:[st]})]}); const m=rt.snapshot().actors[0].maxHp; const seqHp=[rt.snapshot().actors[0].hp]; for(let i=0;i<3;i++){ act(rt); seqHp.push(rt.snapshot().actors[0].hp);} console.log(`S3 ${st}: maxHp ${m} hp by turn ${seqHp.join(",")} (enemy dmg included)`); }
  // sleep duration distribution: put actor to sleep via enemy? use stateTurns directly
  const lens:number[]=[]; for(let i=0;i<7;i++){ const rt=rtFrom(project,{party:[mon({stateIds:["state_sleep"],stateTurns:{state_sleep:i+1} as any})]}); let n=0; while(n<10){ const t=act(rt); n++; if(!rt.snapshot().actors[0].stateIds.includes("state_sleep")) break;} lens.push(n);} console.log("S3 sleep (initial turns 1..7) -> rounds until wake:",lens.join(","));
  const rt=rtFrom(project,{party:[mon({stateIds:["state_freeze"]})]}); let thawed=-1; for(let i=0;i<12;i++){ act(rt); if(!rt.snapshot().actors[0].stateIds.includes("state_freeze")){thawed=i;break;} } console.log("S3 freeze: thawed within 12 rounds?",thawed>=0?("round "+thawed):"never (cartridge Gen1 behavior)");
}
// (4) toxic/badly poisoned escalating? check state ids & escalation code
