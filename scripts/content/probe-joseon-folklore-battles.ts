import assert from 'node:assert/strict';
import {createBattleRuntime} from '../../src/battle/runtime';
import {advanceBattleRuntime} from '../../src/battle/battleRuntimeAdvance';
import type {Project} from '../../src/project/types';

/** Focused integration evidence using the saved game's stats, costs and job equipment. */
export function probeJoseonBattles(saved: Project) {
  const evidence = [];
  for (const [slug,level,tier] of [['bronze_dokkaebi',6,2],['bride_wraith',12,3],['mountain_tiger',19,4]] as const) {
    for (const flow of ['strict','gauge'] as const) {
      const p=structuredClone(saved);
      const party=p.database.actors.filter(a=>p.session.partyActorIds.includes(a.id));
      for(const a of party){
        const job=a.id==='actor_hero'?'warrior':a.classId.replace('class_jf_','');
        a.classId='class_jf_'+job;
        a.parameterCurves=structuredClone(p.database.classes.find(c=>c.id===a.classId)!.parameterCurves);
        a.initialEquipment={weapon:`equip_jf_${job}_weapon_${tier}`,armor:`equip_jf_${job}_body_${tier}`};
      }
      const troopId='troop_jf_'+slug;
      const rt=createBattleRuntime({project:p,troopId,canEscape:false,canLose:true,battleFlow:flow,rng:()=>0.15,
        party:{levels:Object.fromEntries(party.map(a=>[a.id,level])),experience:{},partyActorIds:party.map(a=>a.id)}});
      // Guard with genuine class stats until this boss actually announces and releases an attack.
      for(let i=0;i<240;i++){
        advanceBattleRuntime(rt);const s=rt.snapshot();
        if(s.result || (s.timeline.some(e=>e.charge)&&s.timeline.some(e=>e.skillId&&!e.charge)))break;
        if(s.phase==='actorCommand')rt.performActorCommand({kind:'defend'});
      }
      const guarded=rt.snapshot();
      const warning=guarded.timeline.find(e=>e.charge);
      assert(warning,slug+'/'+flow+' telegraph');
      const release=guarded.timeline.find(e=>e.skillId&&!e.charge&&e.sequence>warning.sequence);
      assert(release,slug+'/'+flow+' release');
      evidence.push({slug,flow,level,tier,warning:warning.message,release:release.skillId,
        actors:guarded.actors.map(a=>({name:a.name,maxHp:a.maxHp,hp:a.hp})),enemyMp:guarded.enemies[0].mp});
      const battle=createBattleRuntime({project:p,troopId,canEscape:false,canLose:true,battleFlow:flow,rng:()=>0.15,
        party:{levels:Object.fromEntries(party.map(a=>[a.id,level])),experience:{},partyActorIds:party.map(a=>a.id)}});
      for(let i=0;i<1200;i++){
        advanceBattleRuntime(battle);const s=battle.snapshot();if(s.result)break;
        if(s.phase==='actorCommand'){
          const actor=s.actors.find(a=>a.recordId===s.activeActorId)!;
          const hurt=s.actors.filter(a=>a.hp>0).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
          const dead=s.actors.find(a=>a.hp===0);
          if(actor.recordId==='actor_cleric'&&dead&&actor.mp>=12&&actor.skillIds.includes('skill_jf_revive'))
            battle.performActorCommand({kind:'skill',skillId:'skill_jf_revive',targetActorId:dead.id});
          else if(actor.recordId==='actor_cleric'&&hurt.hp/hurt.maxHp<0.65&&actor.mp>=4)
            battle.performActorCommand({kind:'skill',skillId:'skill_jf_life_water',targetActorId:hurt.id});
          else battle.performActorCommand({kind:'attack',targetEnemyId:s.enemies.find(e=>e.hp>0)!.id});
        }
      }
      const done=battle.snapshot();
      evidence.push({slug,flow,level,tier,basicAttackWithHealingResult:done.result,turn:done.turn,rewards:done.rewards,
        survivors:done.actors.filter(a=>a.hp>0).map(a=>a.name)});
      assert.equal(done.result,'victory',slug+'/'+flow+' at the authored recommended level');
      assert(done.rewards.items.length>0,slug+' guaranteed material drop');
    }
  }
  return evidence;
}
