// Bounded quantitative probe, not a battle simulation or an integrated game QA.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { applySkillLike } from '@/battle/battleDamage';
import type { MutableBattler } from '@/battle/battleBattlers';

const base = new URL('../', import.meta.url);
const raw = readFileSync(new URL('source/balance-inputs.json',base),'utf8');
const inputs = JSON.parse(raw);
const data = JSON.parse(readFileSync(new URL('data.json',base),'utf8'));
const bossIds=['enemy_jf_bronze_dokkaebi','enemy_jf_bride_wraith','enemy_jf_mountain_tiger'];
function battler(s): MutableBattler {
  return {id:'probe',recordId:'probe',name:'probe',maxHp:s.maxHp,maxMp:s.maxMp??0,
    hp:s.maxHp,mp:s.maxMp??0,attackPower:s.attack,defense:s.defense,mind:s.mind,agility:s.agility??10,
    chargeRate:1,skillIds:[],hidden:false,gauge:0,stateIds:[],stateTurns:{},row:'front',
    defending:false} as MutableBattler;
}
function damage(from,to,rng=0.5){
  return applySkillLike(battler(from),battler(to),{
    power:inputs.fallbackSkill.power,statistic:'attack',effect:'damage',affects:'hp',
    hitRate:100,criticalRate:0,variance:inputs.fallbackSkill.variance,rng:()=>rng,
  }).amount;
}
const levels=[];
for(const enemy of data.enemies){
  const level=enemy.level;
  const tier=level>=15?4:level>=10?3:level>=5?2:1;
  const targets=[];
  let nakedPartyDamage=0;let equippedPartyDamage=0;
  for(const cls of inputs.classes){
    const naked=Object.fromEntries(Object.entries(cls.parameterCurves).map(([k,v])=>[k,v[level-1]]));
    const role=cls.id.replace('class_jf_','');
    const equipped={...naked};
    for(const slot of ['weapon','body']){
      const gear=inputs.equipment.find(g=>g.id===`equip_jf_${role}_${slot}_${tier}`);
      assert.ok(gear,`${role} tier${tier} ${slot}`);
      for(const [k,v] of Object.entries(gear.statBonuses))equipped[k]=(equipped[k]??0)+v;
    }
    const worstNaked=damage(enemy.stats,naked,0.999);
    const worstEquipped=damage(enemy.stats,equipped,0.999);
    assert.ok(worstNaked>0 && worstNaked<naked.maxHp*0.35,`${enemy.id} vs ${cls.id}`);
    const nakedDamage=damage(naked,enemy.stats);const equippedDamage=damage(equipped,enemy.stats);
    nakedPartyDamage+=nakedDamage;equippedPartyDamage+=equippedDamage;
    targets.push({classId:cls.id,hp:naked.maxHp,defense:naked.defense,equippedDefense:equipped.defense,
      worstNakedDamage:worstNaked,worstEquippedDamage:worstEquipped,
      worstNakedHpPercent:Math.round(worstNaked/naked.maxHp*1000)/10,
      actorBasicDamage:nakedDamage,equippedActorBasicDamage:equippedDamage});
  }
  levels.push({enemyId:enemy.id,level,boss:bossIds.includes(enemy.id),hp:enemy.stats.maxHp,
    exp:enemy.rewards.exp,gold:enemy.rewards.gold,tier,targets,
    nakedBasicOnlyFourActorRounds:Math.ceil(enemy.stats.maxHp/nakedPartyDamage),
    equippedBasicOnlyFourActorRounds:Math.ceil(enemy.stats.maxHp/equippedPartyDamage)});
}
const bosses=levels.filter(e=>e.boss);
assert.deepEqual(bosses.map(e=>e.level),[6,12,19]);
assert.ok(bosses.every((e,i)=>i===0||e.hp>bosses[i-1].hp&&e.exp>bosses[i-1].exp&&e.gold>bosses[i-1].gold));
const report={passed:true,scope:'actual applySkillLike rm2k3 basic attack; captured four class curves + tier gear',
  counts:{enemies:15,targetClasses:4,levelRange:[1,20],probedAssignedLevels:15},
  inputsSha256:createHash('sha256').update(raw).digest('hex'),sources:inputs.sources,
  assumptions:['front row, full HP, no buffs/states, no crit, skill_attack power from current prototype',
    'worst means maximum positive variance; party-round estimate uses median variance',
    'four living actors each basic-attack once per round; no healing, skills, ATB or enemy interruption modeled'],
  levels,limitations:['actual integrated behavior/skills, ATB and resource consumption still require supervisor balance QA',
    'basic-only round estimate is a benchmark, not a measured win time; boss skills shorten it'],
};
writeFileSync(new URL('review/balance-probe.json',base),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,bosses:bosses.map(b=>({id:b.enemyId,level:b.level,hp:b.hp,exp:b.exp,gold:b.gold,
  equippedBasicOnlyRounds:b.equippedBasicOnlyFourActorRounds,maxNakedHitHpPercent:Math.max(...b.targets.map(t=>t.worstNakedHpPercent))}))}));
