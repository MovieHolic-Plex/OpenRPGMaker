import { writeFileSync } from 'node:fs';
import { RETRO_ALL_CLASS_SKILLS, RETRO_ALL_FX_SHEETS } from '../../../src/assets/retroSkillCatalog';
import { RETRO_MONSTER_SKILLS } from '../../../src/assets/retroMonsterSkills';
import { retroClassSkillTimeline, RETRO_FX_FRAME_MS } from '../../../src/battle/retroSkillTimeline';

const keys=['skill_mage_fireball','skill_mage_blizzard','skill_mage_chain_lightning','skill_cleric_heal_light'];
const rows=keys.map(id=> {
 const skill=RETRO_ALL_CLASS_SKILLS.find(s=>s.id===id);
 if(!skill)throw new Error(id);
 const timeline=retroClassSkillTimeline(skill);
 return {skill,timeline};
});
writeFileSync(new URL('./current-contracts.json',import.meta.url),JSON.stringify({
 classSkills:RETRO_ALL_CLASS_SKILLS.length,fxSheets:RETRO_ALL_FX_SHEETS.length,
 monsterSkills:RETRO_MONSTER_SKILLS.length,frameMs:RETRO_FX_FRAME_MS,rows,
},null,2));
console.log({classSkills:RETRO_ALL_CLASS_SKILLS.length,fxSheets:RETRO_ALL_FX_SHEETS.length,monsterSkills:RETRO_MONSTER_SKILLS.length});
