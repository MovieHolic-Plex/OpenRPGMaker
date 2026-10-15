import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
import { teachMonsterSkill, replacePendingMonsterSkill, normalizeMonsterInstanceBattleState, monsterSkillIds } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import { useItemFromMenu, previewMonsterMachine } from "@/player/playerItemUse";
const p: any = deserialize(readFileSync("qa-runs/poke-fix-p/hm2.json", "utf8"));
const s: any = startSession(p, 1);
// 시작 파티에 몬스터가 없을 수 있으니 하나 만든다
const sp = p.database.monsterSpecies[0];
const mk = (id: string, skills: string[]) => ({ instanceId: id, speciesId: sp.id, level: 20, exp: 0, currentHp: 99, friendship: 70, skillIds: skills });
const moves = p.database.skills.filter((k: any) => k.maxPp && !k.fieldCommonEventId).slice(0, 4).map((k: any) => k.id);
s.monsterInstances = { m1: mk("m1", moves), m2: mk("m2", moves.slice(0, 2)) };
s.monsterParty = ["m1", "m2"];
s.inventory = { item_hm_cut: 2 };
const show = (l: string, v: any) => console.log(l, JSON.stringify(v));
// 1) 칸이 남는 몬스터: 바로 익힘
show("preview m2", previewMonsterMachine(p, s, p.database.items.find((i: any) => i.id === "item_hm_cut"), "m2"));
show("use m2", useItemFromMenu(p, s, "item_hm_cut", undefined, "m2"));
show("m2 skills", s.monsterInstances.m2.skillIds);
show("inventory after HM (not consumed)", s.inventory.item_hm_cut);
// 2) 가득 찬 몬스터: 대기 → 교체
show("use m1", useItemFromMenu(p, s, "item_hm_cut", undefined, "m1"));
show("m1 pending", s.monsterInstances.m1.pendingSkillIds);
// 3) 이미 익힘 거절
show("use m2 again", useItemFromMenu(p, s, "item_hm_cut", undefined, "m2"));
// 4) 잊을 수 없는 기술 교체 거절 + 일반 기술 교체는 허용
const before = s.monsterInstances.m2;
const full = { ...s.monsterInstances.m2, skillIds: [moves[0], moves[1], "skill_field_cut", moves[2]] };
show("replace unforgettable", replacePendingMonsterSkill(p, { ...full, pendingSkillIds: [moves[3]] }, moves[3], "skill_field_cut").ok);
show("replace ordinary", replacePendingMonsterSkill(p, { ...full, pendingSkillIds: [moves[3]] }, moves[3], moves[0]).ok);
// 5) 종 제한
sp.machineSkillIds = ["skill_field_ford"];
show("species-restricted HM cut ->", teachMonsterSkill(p, mk("m3", moves.slice(0, 2)) as any, "skill_field_cut" as any));
sp.machineSkillIds = ["skill_field_cut"];
show("species-allowed", (teachMonsterSkill(p, mk("m3", moves.slice(0, 2)) as any, "skill_field_cut" as any) as any).ok);
