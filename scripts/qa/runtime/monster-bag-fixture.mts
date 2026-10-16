// bun 전용 QA 픽스처: 몬스터 캠페인 프로젝트에 «가방 화면» 시험용 시작 상태(파티·소지품)를 심어 JSON 으로 쓴다.
//   bun scripts/qa/runtime/monster-bag-fixture.mts <in.json> <out.json>
// 게임 내용(캠페인·아이템)은 건드리지 않는다 — 시작 세션(project.session)만 채운다.
import { readFileSync, writeFileSync } from "node:fs";
import { startSession } from "@/project/session";
import { giveMonster } from "@/project/monsterCollection";
import { serialize } from "@/project/io";
import type { Project } from "@/project/types";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error("bun monster-bag-fixture.mts <in.json> <out.json>");
const project = JSON.parse(readFileSync(input, "utf8")) as Project;

// 기술머신 두 개(이 캠페인 기본에는 없다) — 가방의 「기술머신」 포켓 시험용 사본이다. 저작 데이터가 아니라 QA 사본에만 있다.
const skillIds = project.database.skills.filter((skill) => skill.id.startsWith("mx_skill_")).map((skill) => skill.id);
const machines = [
  { id: "qa_tm_01", name: "기술머신 01", skill: skillIds[3] ?? skillIds[0]! },
  { id: "qa_tm_02", name: "기술머신 02", skill: skillIds[7] ?? skillIds[1]! },
];
for (const machine of machines) {
  project.database.items.push({ ...project.database.items.find((item) => item.id === "item_skill_book")!, id: machine.id, name: machine.name, type: "book",
    scope: "ally", occasion: "field", consumable: true, learnedSkillId: machine.skill, skillId: machine.skill,
    description: `${project.database.skills.find((skill) => skill.id === machine.skill)?.name ?? machine.skill}을(를) 가르친다.` });
}

const session = startSession(project);
const spec = (slug: string) => `mx_species_${slug}`;
const give = (slug: string, level: number, extra: Parameters<typeof giveMonster>[2] extends infer T ? Partial<T> : never = {}) => {
  const result = giveMonster(project, session, { speciesId: spec(slug), level, ...extra } as never);
  if (!result.ok) throw Error(`giveMonster ${slug}`);
  return result.instance.instanceId;
};
const a = give("spriglet", 15, { nickname: "새싹이" });
const b = give("zaptoe", 14);
const c = give("wickworm", 9);
const d = give("rivulet", 99);
const e = give("coalbit", 20);
// b: HP 낮고 독 + 기술 PP 소진, c: 기절, d: 최대 레벨, e: 일반
const mutate = (id: string, patch: Record<string, unknown>) => { session.monsterInstances[id] = { ...session.monsterInstances[id]!, ...patch } as never; };
const skillPp = Object.fromEntries((session.monsterInstances[b]!.skillIds ?? []).map((id, i) => [id, i === 0 ? 2 : 5]));
mutate(b, { currentHp: 18, stateIds: ["state_poison"], stateTurns: { state_poison: 0 }, skillPp });
mutate(c, { currentHp: 0 });
mutate(e, { currentHp: 41 });
session.inventory = {
  item_potion: 5, item_hi_potion: 2, item_ether: 3, item_antidote: 2, item_wake_herb: 1, mx_revive: 2, mx_candy: 3,
  mx_stone_thunder: 1, mx_stone_fire: 1, mx_stone_frost: 1,
  item_capture_orb: 12, mx_ball_net: 2, mx_ball_quick: 1,
  qa_tm_01: 1, qa_tm_02: 2,
  mx_held_oran: 1, mx_held_charcoal: 1,
  item_old_key: 1, item_traveler_badge: 1,
};
project.session = { ...project.session, inventory: session.inventory, monsterInstances: session.monsterInstances, monsterParty: session.monsterParty, monsterBox: session.monsterBox ?? [], gold: 4200 } as never;
// 오프닝 컷신(대사 6장)을 QA 사본에서만 뺀다 — 새 게임 직후 바로 필드·ESC 메뉴로 가기 위해서다. 캠페인 정의는 그대로다.
delete (project.system as { opening?: unknown }).opening;
writeFileSync(output, serialize(project));
console.log(JSON.stringify({ party: session.monsterParty.map((id) => `${session.monsterInstances[id]!.speciesId}@${session.monsterInstances[id]!.level}`), skills: machines }));
