/**
 * 『이세계로 떠난 한국 고딩, 깽판치다』 데이터베이스 — 기술·직업·배우·적·적 그룹·아이템.
 * 전부 조수 도구(upsert_skill · upsert_class · upsert_actor · upsert_enemy · upsert_troop · upsert_item)로 짓는다.
 * 새 그림은 없다: 배우는 번들 걷기 칩·전투 도트, 적은 도트 측면 적 시트(pixel-enemies)만 쓴다.
 */
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import type { Project } from "@/project/types";
import { CAST, execTool } from "./isekaiGoddingKit";
import forestBackdrop from "./isekaiGoddingBackdrops/battle_backdrop_ig_forest_476a116d.json";
import villageBackdrop from "./isekaiGoddingBackdrops/battle_backdrop_ig_village_4521bc89.json";
import castleBackdrop from "./isekaiGoddingBackdrops/battle_backdrop_ig_castle_5b8389f0.json";
import throneBackdrop from "./isekaiGoddingBackdrops/battle_backdrop_ig_throne_953aef61.json";

export const ACTOR = { minjae: DEFAULT_ACTOR_ID, edel: "actor_ig_edel", fio: "actor_ig_fio", kkur: "actor_ig_kkur" } as const;
export const CLASS = { student: "class_ig_student", knight: "class_ig_knight", mage: "class_ig_mage", chief: "class_ig_chief" } as const;
export const ITEM = { chili: "item_ig_fire_chili", tteok: "item_ig_tteokbokki", crystal: "item_ig_crystal", sword: "item_ig_mop_sword" } as const;
export const TROOP = {
  slime: "troop_ig_slime",
  goblin: "troop_ig_goblin",
  quiz: "troop_ig_quiz",
  dean: "troop_ig_dean",
  maouExam: "troop_ig_maou_exam",
  maouBrawl: "troop_ig_maou_brawl",
} as const;
/**
 * 전투 배경 — battle-backdrop 하네스(맵 캡처 → 생성 → 도트화 → 검사)로 이 데모의 맵 넷을 그렸다.
 * 판 ig-forest/A · ig-village/B · ig-castle/D · ig-throne/B (선택은 화소 해시에 묶임, harness-data/battle-backdrop/ledger.json).
 * 자원 JSON 은 build --out 결과에서 그대로 떼어 냈다(maou-konbini 와 같은 방식).
 */
const BACKDROP_RESOURCES = [forestBackdrop, villageBackdrop, castleBackdrop, throneBackdrop] as const;
export const BACKDROP = {
  field: forestBackdrop.resource.id,
  forest: forestBackdrop.resource.id,
  village: villageBackdrop.resource.id,
  castle: castleBackdrop.resource.id,
  throne: throneBackdrop.resource.id,
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function setupIsekaiDatabase(project: Project, backdrops: typeof BACKDROP = BACKDROP): void {
  const exec = (name: string, args: Record<string, unknown>) => execTool(project, name, args);
  for (const bd of BACKDROP_RESOURCES) exec("upsert_resource", { resource: bd.resource });
  const skillOf = (id: string) => {
    const s = project.database.skills.find((x) => x.id === id);
    if (!s) throw new Error(`[isekai-godding] 기술 견본 ${id} 없음`);
    return clone(s) as unknown as Record<string, unknown>;
  };
  const skill = (from: string, id: string, patch: Record<string, unknown>) =>
    exec("upsert_skill", { skill: { ...skillOf(from), ...patch, id } });
  const noMp = { flat: 0, percentMax: 0 };
  const mp = (n: number) => ({ flat: n, percentMax: 0 });

  // ── 민재(고딩) — PC방 오더·급식 줄·벼락치기
  skill("skill_hero_war_cry", "skill_ig_focus_fire", { name: "점사 오더", mpCost: mp(4), description: "「저거 하나만 다 같이 쳐!」 파티 모두 공격이 오른다. PC방에서 배웠다." });
  skill("skill_sleep_mist", "skill_ig_lunch_line", { name: "급식 줄 세우기", mpCost: mp(5), scope: "allEnemies", successRate: 70,
    description: "「한 줄로 서! 새치기하면 맨 뒤로!」 적이 얌전히 줄을 선다(잠듦)." });
  skill("skill_weaken", "skill_ig_ping", { name: "핑 찍기", mpCost: mp(2), description: "「여기 약점!」 적 하나의 방어가 내려간다." });
  skill("skill_cleric_mass_heal", "skill_ig_share_snack", { name: "매점 빵 나눠 먹기", mpCost: mp(8), description: "가방 속 소보로빵을 반씩 쪼갠다. 파티 모두 회복." });
  // ── 에델(기사) — 의전
  skill("skill_guard_iron_wall", "skill_ig_protocol_wall", { name: "의전 방패", mpCost: mp(4), description: "「용사님 앞은 기사가 막습니다!」 파티 모두 방어가 오른다." });
  skill("skill_hero_cross_slash", "skill_ig_royal_slash", { name: "왕실 공인 베기", mpCost: mp(5), description: "대본 7장 3절에 적힌 정식 검술." });
  // ── 피오(엘프 마법사) — 기출 변형
  skill("skill_fire", "skill_ig_exam_fireball", { name: "기출 변형 파이어볼", mpCost: mp(5), power: 95, description: "7년 동안 외운 파이어볼을 민재식으로 비틀었다. 시험엔 안 나온 각도로 날아간다." });
  skill("skill_mage_chain_lightning", "skill_ig_summary_bolt", { name: "요점 정리 번개", mpCost: mp(9), description: "요점만 세 줄로 줄인 번개. 적 모두를 친다." });
  // ── 꾸르(고블린 족장)
  skill("skill_scout_knife_storm", "skill_ig_group_call", { name: "단톡 소환", mpCost: mp(6), description: "「@전체 지금 와라」 고블린 친구들이 우르르 몰려와 적 모두를 친다." });
  skill("skill_hero_war_cry", "skill_ig_chief_roar", { name: "족장의 함성", mpCost: mp(4), description: "「꾸르르!」 파티 모두 공격이 오른다." });
  // ── 적 기술
  skill("skill_sword_slash", "skill_ig_pop_quiz", { name: "쪽지 시험", power: 70, mpCost: noMp, description: "예고 없는 쪽지 시험. 마음이 아프다." });
  skill("skill_dark", "skill_ig_mock_exam", { name: "모의고사 폭격", power: 90, mpCost: noMp, scope: "allEnemies", description: "1교시 국어부터 5교시 탐구까지 한꺼번에 떨어진다." });
  skill("skill_dark", "skill_ig_retake", { name: "재수의 그림자", power: 110, mpCost: noMp, description: "「한 번 더 하면 된다」는 말만 15년째." });
  skill("skill_poison_sting", "skill_ig_goblin_poke", { name: "몽둥이 콕", power: 55, mpCost: noMp, description: "고블린이 몽둥이 끝으로 콕 찌른다." });

  // ── 직업
  const heroClass = clone(project.database.classes.find((c) => c.id === "class_hero") ?? project.database.classes[0]!) as unknown as Record<string, unknown>;
  const makeClass = (id: string, name: string, skillIds: string[], attackName: string) => {
    const commands = (clone(heroClass.battleCommands ?? []) as { kind: string; name?: string }[])
      .filter((c) => c.kind !== "escape" && c.kind !== "switch")
      .map((c) => (c.kind === "attack" ? { ...c, name: attackName } : c));
    exec("upsert_class", { class: { ...heroClass, id, name, skillIds: ["skill_attack", ...skillIds],
      learnedSkills: [{ level: 1, skillId: "skill_attack" }, ...skillIds.map((skillId) => ({ level: 1, skillId }))], battleCommands: commands } });
  };
  makeClass(CLASS.student, "고등학생", ["skill_ig_focus_fire", "skill_ig_ping", "skill_ig_lunch_line", "skill_ig_share_snack"], "대걸레 휘두르기");
  makeClass(CLASS.knight, "왕국 기사", ["skill_ig_royal_slash", "skill_ig_protocol_wall"], "정식 베기");
  makeClass(CLASS.mage, "엘프 마법사", ["skill_ig_exam_fireball", "skill_ig_summary_bolt"], "지팡이 콩");
  makeClass(CLASS.chief, "고블린 족장", ["skill_ig_group_call", "skill_ig_chief_roar"], "몽둥이");

  // ── 배우
  // 파티원마다 곡선을 다르게 — 기본 곡선을 그대로 두면 넷 다 HP 545 로 똑같았다(QA castle). 배율: maxHp maxMp attack defense mind agility.
  const baseCurves = clone(project.database.actors.find((a) => a.id === DEFAULT_ACTOR_ID)!.parameterCurves ?? {}) as Record<string, number[]>;
  const curves = (m: [number, number, number, number, number, number]) => Object.fromEntries(
    (["maxHp", "maxMp", "attack", "defense", "mind", "agility"] as const).flatMap((k, i) => baseCurves[k] ? [[k, baseCurves[k]!.map((v) => Math.max(1, Math.round(v * m[i]!)))]] : []));
  const STATS = {
    minjae: curves([0.9, 0.8, 0.95, 0.85, 1.0, 1.25]),
    edel: curves([1.2, 0.6, 1.15, 1.3, 0.7, 0.85]),
    fio: curves([0.75, 1.6, 0.7, 0.75, 1.4, 1.0]),
    kkur: curves([1.35, 0.5, 1.25, 1.05, 0.6, 0.8]),
  };
  exec("upsert_actor", { actor: { id: ACTOR.minjae, name: "강민재", nickname: "고2 · 자칭 용사", classId: CLASS.student, initialLevel: 5, parameterCurves: STATS.minjae,
    // 기본 주인공이 물려준 전투 도트(Actor1 검사)를 지운다 — 비우면 전투에서 민재 자신의 걷기 칩(교복)이 선다.
    battleCharacterResourceId: "",
    characterResourceId: CAST.minjae.resource, characterIndex: CAST.minjae.index, faceResourceId: "shared-modern-uni-boy-navy-expressions-bust-base" } });
  const fantasyActor = (id: string, name: string, nickname: string, classId: string, who: "edel" | "fio" | "kkur", level: number, battle?: string) =>
    exec("upsert_actor", { actor: {
      ...clone(project.database.actors.find((a) => a.id === DEFAULT_ACTOR_ID)!), id, name, nickname, classId, initialLevel: level,
      characterResourceId: CAST[who].resource, characterIndex: CAST[who].index, faceResourceId: `shared-${CAST[who].stem}-expressions-bust-base`,
      ...(battle ? { battleCharacterResourceId: battle } : {}), learnedSkills: [], parameterCurves: STATS[who],
    } });
  fantasyActor(ACTOR.edel, "에델", "왕국 기사 · 의전 담당", CLASS.knight, "edel", 6, "charset-battler-actor1-3");
  fantasyActor(ACTOR.fio, "피오", "엘프 마법사 · 시험 7수", CLASS.mage, "fio", 5, "charset-battler-actor2-7");
  fantasyActor(ACTOR.kkur, "꾸르", "고블린 족장 · 단톡방 방장", CLASS.chief, "kkur", 6, "party-pixel-monster1-5");
  exec("set_session_start", { party: [ACTOR.minjae], gold: 0 });
  project.system.battleLook = { ...project.system.battleLook, enemyHp: true, enemyNames: true };
  // 필드 화면을 전투 배경으로 깔지 않는다 — 위에서 본 맵 위에 옆모습 배틀러가 서면 어색했다(마왕 편의점 처음 하는 사람 검수 4).
  delete project.system.battleBackdrop;

  // ── 아이템
  const itemOf = (id: string) => clone(project.database.items.find((x) => x.id === id)!) as unknown as Record<string, unknown>;
  exec("upsert_item", { item: { ...itemOf("item_old_key"), id: ITEM.chili, name: "불꽃고추 한 줌", price: 0, consumable: false,
    description: "시장 아저씨가 「드래곤도 운다」며 덤으로 준 고추. 고추장 냄새가 난다." } });
  exec("upsert_item", { item: { ...itemOf("item_rice_ball"), id: ITEM.tteok, name: "이세계 떡볶이", price: 0,
    hpRecovery: { flat: 300, percentMax: 0 }, description: "쌀 반죽을 길게 밀고 불꽃고추로 볶았다. 맵다. 그리고 그립다." } });
  exec("upsert_item", { item: { ...itemOf("item_old_key"), id: ITEM.crystal, name: "통신 수정구", price: 0, consumable: false,
    description: "피오가 빌려준 수정구. 여럿이 한꺼번에 말을 주고받는다. 민재는 이걸 단톡방이라고 부른다." } });

  // ── 적 — 보스 HP 는 보통 플레이로 50초 안쪽(처음 하는 사람 검수: 교무부장 900 은 85초, 마왕 1100 은 3분 넘게 걸렸다.
  //    v6 녹화에서 교무부장(표시 590) 67초, 마왕(표시 620) 65초 — 표시 HP 를 400·430 으로 줄였다). 공격력은 그대로 둔다.
  // ── 적 — 보상은 0 이 아니게(마왕 편의점 검수 8: 「EXP +0 · +0 G」 화면은 고장으로 읽힌다).
  const enemyOf = (id: string) => clone(project.database.enemies.find((x) => x.id === id) ?? project.database.enemies[0]!) as unknown as Record<string, unknown>;
  const act = (skillId: string, priority: number, condition: Record<string, unknown> = { kind: "always" }) =>
    ({ skillId, priority, condition, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });
  const enemy = (id: string, name: string, art: string, stats: Record<string, number>, actions: ReturnType<typeof act>[], exp: number, gold: number, level: number, extra: Record<string, unknown> = {}) => {
    const base = enemyOf("enemy_slime");
    exec("upsert_enemy", { enemy: { id, name, monsterResourceId: art, stats, actions, skillIds: actions.map((a) => a.skillId), level,
      rewards: { ...(base.rewards as Record<string, unknown>), exp, gold, dropRatePercent: 0 }, ...extra }, clearFields: ["speciesId"] });
  };
  enemy("enemy_ig_slime", "말랑 슬라임", "generated-enemy-slime-green", { maxHp: 120, maxMp: 0, attack: 34, defense: 10, mind: 10, agility: 20 },
    [act("skill_attack", 7)], 40, 25, 3);
  enemy("enemy_ig_slime_red", "매운 슬라임", "generated-enemy-slime-red", { maxHp: 150, maxMp: 0, attack: 40, defense: 12, mind: 12, agility: 22 },
    [act("skill_attack", 7)], 55, 30, 4);
  enemy("enemy_ig_goblin", "고블린 행동대", "generated-enemy-goblin-scout", { maxHp: 220, maxMp: 0, attack: 52, defense: 24, mind: 20, agility: 40 },
    [act("skill_attack", 6), act("skill_ig_goblin_poke", 7)], 80, 40, 7);
  enemy("enemy_ig_goblin_brute", "꾸르(화남)", "generated-enemy-goblin-brute", { maxHp: 520, maxMp: 0, attack: 62, defense: 30, mind: 22, agility: 30 },
    [act("skill_attack", 6), act("skill_ig_goblin_poke", 7)], 150, 80, 9);
  enemy("enemy_ig_quiz", "출제 위원 해골", "generated-enemy-skeleton-knight", { maxHp: 600, maxMp: 0, attack: 66, defense: 40, mind: 30, agility: 36 },
    [act("skill_attack", 6), act("skill_ig_pop_quiz", 8)], 160, 90, 10);
  enemy("enemy_ig_dean", "마왕군 교무부장", "generated-enemy-lich-frost", { maxHp: 400, maxMp: 50, attack: 70, defense: 38, mind: 60, agility: 40 },
    [act("skill_ig_pop_quiz", 7), act("skill_ig_mock_exam", 8, { kind: "turn", start: 2, interval: 3 })], 260, 150, 12, { role: "boss" });
  enemy("enemy_ig_maou", "재수생 마왕 벨제", "generated-enemy-demon-lord", { maxHp: 430, maxMp: 80, attack: 80, defense: 45, mind: 70, agility: 45 },
    [act("skill_attack", 5), act("skill_ig_retake", 8), act("skill_ig_mock_exam", 9, { kind: "turn", start: 2, interval: 3 })], 500, 300, 15, { role: "boss" });

  // upsert_enemy 는 role:boss 에 「보스 위협 하한」(scaleBossToStartParty)을 걸어 HP 를 590·560 으로 되올린다.
  // 이 데모는 짧은 보스전(50초 안쪽)이 의도라 HP 만 저자 값으로 되돌린다(공격·민첩 하한은 그대로 둔다).
  for (const [id, hp] of [["enemy_ig_dean", 400], ["enemy_ig_maou", 430]] as const) {
    const boss = project.database.enemies.find((e) => e.id === id);
    if (!boss) throw new Error(`[isekai-godding] 보스 ${id} 없음`);
    boss.stats = { ...boss.stats, maxHp: hp };
  }

  const troop = (id: string, name: string, enemyIds: string[], background: string) =>
    exec("upsert_troop", { troop: { id, name, enemyIds, previewBackgroundResourceId: background } });
  // 첫 전투는 둘(처음 하는 사람 검수 4: 셋이면 첫 전투가 54초로 늘어졌다).
  troop(TROOP.slime, "슬라임 둘", ["enemy_ig_slime", "enemy_ig_slime_red"], backdrops.field);
  troop(TROOP.goblin, "통행세 받는 고블린", ["enemy_ig_goblin", "enemy_ig_goblin_brute", "enemy_ig_goblin"], backdrops.village);
  troop(TROOP.quiz, "출제 위원", ["enemy_ig_quiz"], backdrops.castle);
  troop(TROOP.dean, "마왕군 교무부장", ["enemy_ig_dean"], backdrops.castle);
  troop(TROOP.maouExam, "마왕과 모의고사", ["enemy_ig_maou"], backdrops.throne);
  troop(TROOP.maouBrawl, "마왕과 한 판", ["enemy_ig_maou"], backdrops.throne);
}
