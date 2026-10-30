/**
 * 「사냥꾼 계약」 데이터베이스 — 배우·직업·기술·장비·아이템·적·적 그룹.
 * 전부 조수 도구(upsert_skill · upsert_class · upsert_actor · upsert_equipment · upsert_item · upsert_enemy · upsert_troop)로 짓는다.
 * 새 그림 없음: 도르반은 Actor2#4 걷기 칩, 적은 도트 측면 적(pixel-enemies)만 쓴다.
 *
 * 우회 이음매(엔진 공백 PR 이 머지되면 바꿔 끼운다):
 *   - 칼 기름(공백 D) → 무기 바꿔치기: 「불씨 기름 바른 칼」(불 속성) 장비를 따로 두고, 기름을 바르는 장면이 무기를 갈아 끼운다(applyOil).
 *   - 괴물 도감(공백 B) → 일지 줄(contractA.ts bestiaryLine).
 */
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import type { Command, Project } from "@/project/types";
import { CAST, execTool } from "./kit";

export const ACTOR = { doran: DEFAULT_ACTOR_ID } as const;
export const CLASS = { hunter: "class_hc_hunter" } as const;
export const EQUIP = {
  blade: "equip_hc_blade",
  oiled: "equip_hc_blade_oiled",
  silver: "equip_hc_blade_silver",
} as const;
export const ITEM = {
  oil: "item_hc_ember_oil",
  potion: "item_hc_potion",
  copy1: "item_hc_copy_reed",
  ring: "item_hc_bone_ring",
} as const;
export const ENEMY = { ghoul: "enemy_hc_drowner", mother: "enemy_hc_mother", motherDry: "enemy_hc_mother_dry", lizard: "enemy_hc_lizard" } as const;
export const TROOP = {
  drowners: "troop_hc_drowners",
  /** 기름 없이 — 어미가 매 턴 늪물로 낫는다. */
  mother: "troop_hc_mother",
  /** 불씨 기름을 바르고 — 상처가 마른다. */
  motherDry: "troop_hc_mother_dry",
  lizard: "troop_hc_lizard",
} as const;

/** 전투 배경 — 하네스 판이 나오기 전까지 공용 숲·동굴 배경(설계 6.2 의 5번 자르기). */
export const BACKDROP = { swamp: "battle-scenery-forest", nest: "battle-scenery-cave" } as const;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * 칼에 불씨 기름을 바른다(공백 D 우회) — 지닌 기름 하나를 쓰고 무기를 불 속성 판으로 바꾼다.
 * 칼 기름 PR 이 머지되면 이 함수 하나를 「기름 상태 부여」 명령으로 바꾼다.
 */
export function applyOil(): Command[] {
  return [
    { kind: "changeItem", itemId: ITEM.oil, op: "-=", amount: 1 } as Command,
    { kind: "changeItem", itemId: EQUIP.oiled, op: "+=", amount: 1 } as Command,
    { kind: "changeEquipment", actorId: ACTOR.doran, slot: "weapon", equipmentId: EQUIP.oiled } as Command,
  ];
}
/** 싸움이 끝나면 기름이 탄다 — 원래 칼로 돌아온다. */
export function oilBurnsOff(): Command[] {
  return [
    { kind: "changeItem", itemId: EQUIP.blade, op: "+=", amount: 1 } as Command,
    { kind: "changeEquipment", actorId: ACTOR.doran, slot: "weapon", equipmentId: EQUIP.blade } as Command,
    { kind: "changeItem", itemId: EQUIP.oiled, op: "=", amount: 0 } as Command,
  ];
}

export function setupHunterDatabase(project: Project): void {
  const exec = (name: string, args: Record<string, unknown>) => execTool(project, name, args);
  const skillOf = (id: string) => {
    const s = project.database.skills.find((x) => x.id === id);
    if (!s) throw new Error(`[hunter] 기술 견본 ${id} 없음`);
    return clone(s) as unknown as Record<string, unknown>;
  };
  const skill = (from: string, id: string, patch: Record<string, unknown>) => exec("upsert_skill", { skill: { ...skillOf(from), ...patch, id } });
  const mp = (n: number) => ({ flat: n, percentMax: 0 });
  const noMp = { flat: 0, percentMax: 0 };

  // ── 도르반의 기술 — 이름은 이 세계 사냥꾼 말(원작 고유명 없음).
  skill("skill_hero_cross_slash", "skill_hc_low_cut", { name: "다리 베기", mpCost: mp(4), description: "무릎 뒤를 끊는다. 물에서 나온 놈들은 다리가 약하다." });
  skill("skill_hero_flame_sword", "skill_hc_ember_sign", { name: "불씨 표식", mpCost: mp(6), elementId: "fire", description: "부싯돌로 칼끝에 불을 붙여 긋는다. 기름이 없어도 한 번은 탄다." });
  skill("skill_cleric_heal_light", "skill_hc_bandage", { name: "붕대 감기", mpCost: mp(5), scope: "self", description: "싸우는 중에 상처를 싸맨다. 피가 멎는 만큼만 낫는다." });
  skill("skill_guard_iron_wall", "skill_hc_brace", { name: "버티기", mpCost: mp(3), scope: "self", description: "발을 넓게 딛는다. 한 번은 덜 아프다." });
  // ── 적 기술
  skill("skill_attack", "skill_hc_drag", { name: "끌어당기기", power: 105, mpCost: noMp, description: "발목을 잡고 물 쪽으로 끈다." });
  skill("skill_heal", "skill_hc_mire_mend", { name: "늪물로 메우기", mpCost: noMp, scope: "self", description: "늪물이 상처로 스며 들어간다. 불에 마른 살은 메우지 못한다." });
  skill("skill_dark", "skill_hc_wail", { name: "물 밑 울음", power: 140, mpCost: noMp, scope: "allEnemies", description: "물 밑에서 아이들이 한꺼번에 운다." });

  // ── 직업
  const heroClass = clone(project.database.classes.find((c) => c.id === "class_hero") ?? project.database.classes[0]!) as unknown as Record<string, unknown>;
  const commands = (clone(heroClass.battleCommands ?? []) as { kind: string; name?: string }[])
    .filter((c) => c.kind !== "switch")
    .map((c) => (c.kind === "attack" ? { ...c, name: "베기" } : c));
  const skills = ["skill_hc_low_cut", "skill_hc_ember_sign", "skill_hc_bandage", "skill_hc_brace"];
  exec("upsert_class", { class: { ...heroClass, id: CLASS.hunter, name: "떠돌이 사냥꾼", skillIds: ["skill_attack", ...skills],
    learnedSkills: [{ level: 1, skillId: "skill_attack" }, ...skills.map((skillId) => ({ level: 1, skillId }))], battleCommands: commands } });

  // ── 장비 — 사냥꾼 칼 셋(쇠·기름·은). 기름·은 판은 바꿔치기용.
  const swordOf = clone(project.database.equipment.find((e) => e.id === "equip_iron_sword")!) as unknown as Record<string, unknown>;
  const blade = (id: string, name: string, attack: number, elements: string[], description: string, price: number) =>
    exec("upsert_equipment", { equipment: { ...swordOf, id, name, price, description, attackElementIds: elements,
      statBonuses: { ...(swordOf.statBonuses as Record<string, number>), attack }, equippableActorIds: [ACTOR.doran], equippableClassIds: [CLASS.hunter] } });
  blade(EQUIP.blade, "사냥꾼 쇠칼", 24, ["sword"], "날을 스무 해 갈았다. 쇠는 물에서 나온 놈들 가죽에서 미끄러진다.", 0);
  blade(EQUIP.oiled, "불씨 기름 바른 칼", 26, ["fire"], "칼날에 불씨 기름을 먹였다. 한 번 싸우면 다 탄다.", 0);
  blade(EQUIP.silver, "은박 칼", 28, ["holy"], "날에 은을 얇게 입혔다. 죽은 것이 싫어한다.", 260);

  // ── 아이템
  const itemOf = (id: string) => clone(project.database.items.find((x) => x.id === id)!) as unknown as Record<string, unknown>;
  exec("upsert_item", { item: { ...itemOf("item_old_key"), id: ITEM.oil, name: "불씨 기름", price: 40, consumable: true, occasion: "never",
    description: "늪 기름에 송진과 유황을 섞었다. 칼에 바르면 한 번 싸우는 동안 불이 붙는다. 여관 주인이 판다." } });
  exec("upsert_item", { item: { ...itemOf("item_potion"), id: ITEM.potion, name: "쓴 약초 물", price: 20,
    description: "늪 약초를 달였다. 맛은 나쁘고 상처는 닫힌다." } });
  exec("upsert_item", { item: { ...itemOf("item_old_key"), id: ITEM.copy1, name: "계약서 사본 (갈대늪)", price: 0, consumable: false, occasion: "never",
    description: "리스크의 글씨. 「갈대늪, 익사자 처리. 의뢰인 하그네.」 귀퉁이에 「셋째 날」이라고 적었다." } });
  exec("upsert_item", { item: { ...itemOf("item_old_key"), id: ITEM.ring, name: "뼈 반지", price: 0, consumable: false, occasion: "never",
    description: "어미의 손가락에서 빠졌다. 아이 손가락에 맞는 크기다." } });

  // ── 배우 — 도르반(마흔 줄, 혼자).
  const base = project.database.actors.find((a) => a.id === DEFAULT_ACTOR_ID)!;
  const baseCurves = clone(base.parameterCurves ?? {}) as Record<string, number[]>;
  const curves = Object.fromEntries((["maxHp", "maxMp", "attack", "defense", "mind", "agility"] as const)
    .flatMap((k, i) => baseCurves[k] ? [[k, baseCurves[k]!.map((v) => Math.max(1, Math.round(v * [1.25, 0.9, 1.2, 1.1, 0.8, 0.95][i]!)))]] : []));
  exec("upsert_actor", { actor: { id: ACTOR.doran, name: "도르반", nickname: "떠돌이 사냥꾼", classId: CLASS.hunter, initialLevel: 8, parameterCurves: curves,
    battleCharacterResourceId: "", characterResourceId: CAST.doran.resource, characterIndex: CAST.doran.index,
    faceResourceId: `shared-${CAST.doran.stem}-expressions-bust-base`,
    initialEquipment: { ...(clone(base.initialEquipment ?? {}) as Record<string, unknown>), weapon: EQUIP.blade } } });
  exec("set_session_start", { partyActorIds: [ACTOR.doran], gold: 11, inventory: { [ITEM.potion]: 2 } });
  project.system.battleLook = { ...project.system.battleLook, enemyHp: true, enemyNames: true };
  exec("set_project_settings", { terms: { battleVictory: "끝났다", battleCommandPrompt: "{name}." } });
  delete project.system.battleBackdrop;

  // ── 적 — 기본 DB 의 무덤 구울 도트를 이름만 바꿔 쓴다.
  const enemyOf = (id: string) => clone(project.database.enemies.find((x) => x.id === id) ?? project.database.enemies[0]!) as unknown as Record<string, unknown>;
  const act = (skillId: string, priority: number, condition: Record<string, unknown> = { kind: "always" }) =>
    ({ skillId, priority, condition, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });
  // 약점: 불 ×2(A), 빛 ×1.5(B), 물 무효(E), 칼 반감(D).
  const drownerRates = { fire: "A", holy: "B", water: "E", sword: "D" };
  const enemy = (id: string, name: string, from: string, stats: Record<string, number>, actions: ReturnType<typeof act>[], exp: number, gold: number, level: number, extraIn: Record<string, unknown> = {}) => {
    const src = enemyOf(from);
    const { role, ...extra } = extraIn;
    exec("upsert_enemy", { enemy: { monsterResourceId: src.monsterResourceId, criticalHit: src.criticalHit, attackOptions: src.attackOptions, stateRates: src.stateRates, id, name, stats, actions, skillIds: actions.map((a) => a.skillId), level,
      rewards: { ...(src.rewards as Record<string, unknown>), exp, gold, dropRatePercent: 0 }, ...extra }, clearFields: ["speciesId"], ...(role ? { role } : {}) });
  };
  enemy(ENEMY.ghoul, "익사귀", "enemy_ghoul_grave", { maxHp: 150, maxMp: 0, attack: 58, defense: 22, mind: 20, agility: 34 },
    [act("skill_attack", 6), act("skill_hc_drag", 7)], 60, 0, 6, { elementRates: drownerRates });
  // 공백 D 우회(설계 3.6 A): 기름 없이 싸우면 어미가 매 턴 메운다(상태 「불로 풀림」 필드가 엔진에 없다 — 트룹 둘로 가른다).
  const motherStats = { maxHp: 520, maxMp: 30, attack: 74, defense: 30, mind: 50, agility: 30 };
  const motherActs = [act("skill_attack", 5), act("skill_hc_drag", 6), act("skill_hc_wail", 8, { kind: "turn", start: 3, interval: 3 })];
  const motherExtra = { elementRates: drownerRates, role: "boss", battleScalePercent: 150, collapseEffect: "bossSink" };
  enemy(ENEMY.mother, "물에 잠긴 어미", "enemy_ghoul_grave", motherStats, [...motherActs, act("skill_hc_mire_mend", 7, { kind: "turn", start: 1, interval: 1 })], 240, 0, 10, motherExtra);
  enemy(ENEMY.motherDry, "물에 잠긴 어미", "enemy_ghoul_grave", motherStats, motherActs, 240, 0, 10, motherExtra);
  enemy(ENEMY.lizard, "늪 도마뱀", "enemy_lizardman_spear", { maxHp: 170, maxMp: 0, attack: 60, defense: 26, mind: 14, agility: 44 },
    [act("skill_attack", 7)], 50, 12, 6, { elementRates: { ice: "B" } });
  // upsert_enemy 의 보스 위협 하한이 HP 를 올린다 — 저자 값으로 되돌린다.
  for (const id of [ENEMY.mother, ENEMY.motherDry]) {
    const boss = project.database.enemies.find((e) => e.id === id)!;
    boss.stats = { ...boss.stats, maxHp: 520 };
  }

  const troop = (id: string, name: string, enemyIds: string[], background: string) =>
    exec("upsert_troop", { troop: { id, name, enemyIds, previewBackgroundResourceId: background } });
  troop(TROOP.drowners, "익사귀 셋", [ENEMY.ghoul, ENEMY.ghoul, ENEMY.ghoul], BACKDROP.nest);
  troop(TROOP.mother, "물에 잠긴 어미", [ENEMY.mother, ENEMY.ghoul], BACKDROP.nest);
  troop(TROOP.motherDry, "물에 잠긴 어미", [ENEMY.motherDry, ENEMY.ghoul], BACKDROP.nest);
  troop(TROOP.lizard, "늪 도마뱀", [ENEMY.lizard], BACKDROP.swamp);
}
