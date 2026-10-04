import { RETRO_ALL_CLASS_SKILLS } from "@/assets/retroSkillCatalog";
import { RETRO_MONSTER_SKILLS } from "@/assets/retroMonsterSkills";
import { retroClassSkillTimeline, retroMonsterSkillTimeline, retroTimelineSounds } from "@/battle/retroSkillTimeline";

let cached: readonly string[] | undefined;
/** Shared by the battle preloader and web export so every eager audio request ships. */
export function retroSkillPreloadSoundIds(): readonly string[] {
  return cached ??= Object.freeze([...new Set([
    ...RETRO_ALL_CLASS_SKILLS.flatMap(skill => retroTimelineSounds(retroClassSkillTimeline(skill))),
    ...RETRO_MONSTER_SKILLS.flatMap(skill => retroTimelineSounds(retroMonsterSkillTimeline(skill))),
  ])]);
}
