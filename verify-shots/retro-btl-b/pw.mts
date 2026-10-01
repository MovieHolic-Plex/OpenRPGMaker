import { defaultSkillRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
const ids = ["skill_archmage_grand_fusion","skill_dragonewt_flame_breath","skill_cyclops_eye_beam","skill_wraith_mage_requiem","skill_chronomancer_time_arrow","skill_chronomancer_time_skip","skill_gunner_flare","skill_noble_noble_order","skill_sailor_hoist_sail","skill_miner_tunnel_quake","skill_gunslinger_dead_eye"];
const m = new Map(defaultSkillRecords().map(s=>[s.id,s]));
for (const id of ids) { const s = m.get(id)!; console.log(id, s.power, s.mpCost?.flat, s.scope, s.effect.kind, JSON.stringify(s.hitSequence ?? null), s.damageFormula ?? ""); }
