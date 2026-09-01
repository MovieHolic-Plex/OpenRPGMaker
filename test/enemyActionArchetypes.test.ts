import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { archetypeActions, SPIRIT_ELEMENT_SKILLS } from "@/project/defaults/enemyActionArchetypes";
import { defaultDatabase } from "@/project/defaults/defaultDatabase";
import { generatedEnemyRecords } from "@/project/defaults/generatedEnemyRecords";
import { DEFAULT_ELEMENT_RATE_LABELS } from "@/project/actorModel";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";

const db = defaultDatabase() as any;
const skillById = new Map<string, any>((db.skills as any[]).map((skill) => [skill.id, skill]));

/** MP 비용은 DB 에서 유도한다. id 목록을 상수로 박으면 누가 그 스킬에 mpCost 를 붙여도
 *  테스트는 초록으로 남고 고갈 방어만 조용히 무너진다. */
function mpCostOf(skillId: string): number {
  const skill = skillById.get(skillId);
  if (!skill) throw new Error(`${skillId} 가 기본 DB 에 없다`);
  return skill.mpCost?.flat ?? 0;
}

/** 상태를 걸거나 속성을 띠거나 MP 를 먹는 스킬 = 그 아키타입의 정체성.
 *  평범한 무료 무기 공격(attack/sword_slash/throwing_knife)과 구분한다. */
function isIdentitySkill(skillId: string): boolean {
  const skill = skillById.get(skillId);
  if (!skill) throw new Error(`${skillId} 가 기본 DB 에 없다`);
  return (skill.stateEffects ?? []).length > 0 || typeof skill.elementId === "string" || mpCostOf(skillId) > 0;
}

describe("archetypeActions", () => {
  const archetypes = ["blob", "venom", "brute", "curse", "caster", "bulwark", "tactician", "flyer", "boss"] as const;

  it("모든 아키타입이 행동을 2개 이상 준다 — 1개면 효용도 AI 가 선택할 게 없다", () => {
    for (const a of archetypes) {
      expect(archetypeActions(a, "skill_fire").length, a).toBeGreaterThanOrEqual(2);
    }
  });

  it("모든 아키타입이 MP 0 스킬을 최소 1개 갖는다 — MP 고갈 시 행동 불능을 막는다", () => {
    for (const a of archetypes) {
      const ids = archetypeActions(a, "skill_fire").map((p) => p.skillId);
      const free = ids.filter((id) => mpCostOf(id) === 0);
      expect(free.length, `${a}: ${ids.map((id) => `${id}(${mpCostOf(id)}MP)`).join(", ")}`).toBeGreaterThanOrEqual(1);
    }
  });

  // R14 규칙 1. 점수식은 damage 스킬의 stateEffects 를 안 본다(runtime.ts:1896-1898).
  // 정체성 스킬을 평범한 무료 공격보다 낮게 두면 Δscore 가 전투 내내 상수라 낮은 쪽은
  // **한 번도** 안 나온다(라운드 1 실측: poison_sting·earth·dark·throwing_knife 사장).
  it("정체성 스킬(상태·속성·유료)이 평범한 무료 데미지보다 낮은 우선순위를 갖지 않는다", () => {
    for (const a of archetypes) {
      const patterns = archetypeActions(a, "skill_fire");
      const plain = patterns.filter((p) => !isIdentitySkill(p.skillId));
      const identity = patterns.filter((p) => isIdentitySkill(p.skillId));
      if (plain.length === 0 || identity.length === 0) continue;
      const worstIdentity = Math.min(...identity.map((p) => p.priority));
      const bestPlain = Math.max(...plain.map((p) => p.priority));
      expect(
        worstIdentity,
        `${a}: 정체성 최저 ${worstIdentity} < 평범 최고 ${bestPlain} — 낮은 쪽은 영구히 사장된다`,
      ).toBeGreaterThanOrEqual(bestPlain);
    }
  });

  // R14 규칙 2. 유료기가 무료기보다 낮으면 MP 를 고스란히 남긴 채 전투가 끝난다.
  it("유료 스킬이 같은 아키타입의 무료 스킬보다 낮은 우선순위를 갖지 않는다", () => {
    for (const a of archetypes) {
      const patterns = archetypeActions(a, "skill_fire");
      const paid = patterns.filter((p) => mpCostOf(p.skillId) > 0);
      const free = patterns.filter((p) => mpCostOf(p.skillId) === 0);
      if (paid.length === 0 || free.length === 0) continue;
      const worstPaid = Math.min(...paid.map((p) => p.priority));
      const bestFree = Math.max(...free.map((p) => p.priority));
      expect(worstPaid, `${a}: 유료 최저 ${worstPaid} < 무료 최고 ${bestFree}`).toBeGreaterThanOrEqual(bestFree);
    }
  });

  it("참조하는 스킬이 전부 실재한다", () => {
    const known = new Set((db.skills as any[]).map((s) => s.id));
    for (const a of archetypes) {
      for (const p of archetypeActions(a, "skill_fire")) {
        expect(known.has(p.skillId), `${a} → ${p.skillId} 없음`).toBe(true);
      }
    }
    for (const skillId of Object.values(SPIRIT_ELEMENT_SKILLS)) {
      expect(known.has(skillId), `${skillId} 없음`).toBe(true);
    }
  });

  // 조용히 폴백하는 쪽은 정확히 **키**다. Task 4 가 SPIRIT_ELEMENT_SKILLS[enemy.id] 로
  // 조회하면 오타난 키는 아무 신호 없이 무속성 skill_arcane_bolt 폴백으로 떨어지고,
  // SkillId = string 이라 타입도 못 잡는다.
  it("SPIRIT_ELEMENT_SKILLS 의 키(적 id)가 전부 기본 DB 에 실재한다", () => {
    const knownEnemies = new Set((db.enemies as any[]).map((e) => e.id));
    for (const enemyId of Object.keys(SPIRIT_ELEMENT_SKILLS)) {
      expect(knownEnemies.has(enemyId), `${enemyId} 가 기본 DB 의 적에 없음 — 조용히 폴백한다`).toBe(true);
    }
  });

  it("boss 만 turn 조건 패턴을 갖는다", () => {
    for (const a of archetypes) {
      const hasTurn = archetypeActions(a, "skill_fire").some((p) => p.condition.kind === "turn");
      expect(hasTurn, a).toBe(a === "boss");
    }
  });
});

describe("스타터 적", () => {
  it("기본 트룹이 쓰는 적이 전부 행동 2개 이상을 갖는다", () => {
    const db = defaultDatabase() as any;
    const used = new Set(db.troops.flatMap((t: any) => (t.members ?? []).map((m: any) => m.enemyId)));
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) {
      const enemy = db.enemies.find((e: any) => e.id === id);
      expect(enemy, `${id} 없음`).toBeDefined();
      expect((enemy.actions ?? []).length, `${id} 행동 부족`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("적 전원", () => {
  it("행동이 1개뿐인 적이 없다", () => {
    const db = defaultDatabase() as any;
    const shallow = db.enemies.filter((e: any) => (e.actions ?? []).length <= 1).map((e: any) => e.id);
    expect(shallow, `행동 1개뿐: ${shallow.join(", ")}`).toEqual([]);
  });

  it("정령 10마리가 서로 다른 속성 공격을 쓴다 — 속성 저항이 의미를 가지려면", () => {
    const db = defaultDatabase() as any;
    const spiritIds = Object.keys(SPIRIT_ELEMENT_SKILLS);
    const used = new Set<string>();
    for (const id of spiritIds) {
      const enemy = db.enemies.find((e: any) => e.id === id);
      expect(enemy, `${id} 없음`).toBeDefined();
      for (const p of enemy.actions) {
        const skill = db.skills.find((s: any) => s.id === p.skillId);
        if (skill?.elementId) used.add(skill.elementId);
      }
    }
    // 불·물·대지·바람·신성·암흑·얼음 = 7종 이상이 정령 계열에서 실제로 쓰인다.
    expect(used.size, `쓰인 속성: ${[...used].join(",")}`).toBeGreaterThanOrEqual(7);
  });

  it("모든 적이 MP 0 스킬을 최소 1개 갖는다", () => {
    const db = defaultDatabase() as any;
    const free = new Set(db.skills.filter((s: any) => (s.mpCost?.flat ?? 0) === 0).map((s: any) => s.id));
    const stuck = db.enemies
      .filter((e: any) => !(e.actions ?? []).some((p: any) => free.has(p.skillId)))
      .map((e: any) => e.id);
    expect(stuck, `MP 고갈 시 행동 불능: ${stuck.join(", ")}`).toEqual([]);
  });
});

// 적이 dark 속성 공격(skill_dark)을 쓰는데 저항 시드 표에 dark 가 없으면, 맞는 쪽
// (액터·직업)의 elementRates 에 등급이 없어 runtime.elementMultiplierFor 가 배율 1.0 으로
// 조용히 빠진다 — 무속성 공격과 수치가 완전히 같아져 curse 아키타입의 속성 배정이 장식이 된다.
describe("dark 속성 저항 시드", () => {
  it("기본 저항 시드 표가 dark 를 포함한다", () => {
    expect(DEFAULT_ELEMENT_RATE_LABELS.map((entry) => entry.id)).toContain("dark");
  });

  it("시드 표의 모든 속성이 elements 테이블에 실재한다", () => {
    const known = new Set((defaultDatabase().elements ?? []).map((entry) => entry.id));
    for (const label of DEFAULT_ELEMENT_RATE_LABELS) {
      expect(known.has(label.id), `${label.id} 가 elements 에 없음`).toBe(true);
    }
  });

  it("새 적/액터의 elementRates 가 dark 등급을 갖는다", () => {
    expect(normalizeEnemyRecord({ id: "enemy_probe", name: "탐침" }).elementRates?.dark).toBe("C");
    expect(defaultDatabase().actors[0]?.elementRates?.dark).toBe("C");
  });
});

// ── 산출물: 계열별 배정표 ───────────────────────────────────────────────────
// Task 5·6 이 이 표를 기준으로 재측정한다. 손으로 적은 표는 코드와 어긋나므로,
// 아래 EXPECTED 는 **레코드의 actions 를 archetypeActions() 출력과 대조해 역판정한
// 결과**와 매 실행마다 맞춰진다. 배정을 바꾸면 이 표가 먼저 빨개진다.
const ARCHETYPES = [
  "blob",
  "venom",
  "brute",
  "curse",
  "caster",
  "bulwark",
  "tactician",
  "flyer",
  "boss",
] as const;

function signatureOf(patterns: readonly any[]): string {
  return patterns
    .map((p) => `${p.skillId}@${p.priority}@${p.condition.kind}`)
    .sort()
    .join("|");
}

/** 이 적의 행동 집합을 낳은 아키타입을 역판정한다. 정령은 개체 속성을 넘겨야 맞는다. */
function classify(enemy: any): string | null {
  const want = signatureOf(enemy.actions ?? []);
  for (const archetype of ARCHETYPES) {
    for (const element of [undefined, SPIRIT_ELEMENT_SKILLS[enemy.id]]) {
      if (signatureOf(archetypeActions(archetype, element)) === want) return archetype;
    }
  }
  return null;
}

const EXPECTED_ARCHETYPES: Record<string, string[]> = {
  // 슬라임·젤리 (8)
  blob: [
    "enemy_slime_blue",
    "enemy_slime_red",
    "enemy_slime_green",
    "enemy_slime_metal",
    "enemy_slime_king",
    "enemy_slime_cube",
    "enemy_ooze_black",
    "enemy_ooze_acid",
  ],
  // 곤충·절지 (12)
  venom: [
    "enemy_bat_cave",
    "enemy_bat_vampire",
    "enemy_bee_giant",
    "enemy_spider_cave",
    "enemy_spider_widow",
    "enemy_scorpion_sand",
    "enemy_beetle_horn",
    "enemy_mantis_blade",
    "enemy_centipede_fire",
    "enemy_moth_dust",
    "enemy_worm_sand",
    "enemy_ant_soldier",
  ],
  // 야수 (14)
  brute: [
    "enemy_wolf_grey",
    "enemy_wolf_dire",
    "enemy_boar_tusk",
    "enemy_bear_brown",
    "enemy_tiger_saber",
    "enemy_rat_giant",
    "enemy_bird_hawk",
    "enemy_snake_viper",
    "enemy_cat_shadow",
    "enemy_goat_mountain",
    "enemy_crab_rock",
    "enemy_hound_hell",
    "enemy_ape_stone",
    "enemy_deer_forest",
  ],
  // 언데드 (12)
  curse: [
    "enemy_skeleton_bone",
    "enemy_skeleton_archer",
    "enemy_skeleton_knight",
    "enemy_zombie_rot",
    "enemy_ghoul_grave",
    "enemy_ghost_pale",
    "enemy_wraith_dark",
    "enemy_lich_frost",
    "enemy_mummy_bandage",
    "enemy_banshee_wail",
    "enemy_revenant_vengeful",
    "enemy_bonepile_crawler",
  ],
  // 정령·원소 (10)
  caster: [
    "enemy_spirit_fire",
    "enemy_spirit_water",
    "enemy_spirit_earth",
    "enemy_spirit_wind",
    "enemy_spirit_light",
    "enemy_spirit_dark",
    "enemy_wisp_blue",
    "enemy_sylph_air",
    "enemy_undine_sea",
    "enemy_salamander_flame",
  ],
  // 골렘·구조물 (10)
  bulwark: [
    "enemy_golem_stone",
    "enemy_golem_iron",
    "enemy_golem_clay",
    "enemy_golem_crystal",
    "enemy_armor_living",
    "enemy_sword_flying",
    "enemy_mimic_chest",
    "enemy_scarecrow_field",
    "enemy_puppet_string",
    "enemy_totem_cursed",
  ],
  // 인간형 (15)
  tactician: [
    "enemy_goblin_scout",
    "enemy_goblin_brute",
    "enemy_orc_warrior",
    "enemy_orc_shaman",
    "enemy_kobold_digger",
    "enemy_bandit_mask",
    "enemy_mage_rogue",
    "enemy_knight_fallen",
    "enemy_lizardman_spear",
    "enemy_harpy_cliff",
    "enemy_minotaur_maze",
    "enemy_centaur_plains",
    "enemy_troll_cave",
    "enemy_ogre_club",
    "enemy_imp_mischief",
  ],
  // 수생·비행 (9)
  flyer: [
    "enemy_fish_piranha",
    "enemy_squid_deep",
    "enemy_shark_land",
    "enemy_eel_electric",
    "enemy_griffin_sky",
    "enemy_wyvern_cliff",
    "enemy_roc_giant",
    "enemy_gargoyle_stone",
    "enemy_phoenix_rebirth",
  ],
  // 드래곤·보스 (10)
  boss: [
    "enemy_dragon_whelp",
    "enemy_dragon_red",
    "enemy_dragon_blue",
    "enemy_dragon_bone",
    "enemy_hydra_three",
    "enemy_behemoth_horn",
    "enemy_demon_lord",
    "enemy_angel_fallen",
    "enemy_eye_floating",
    "enemy_plant_carnivore",
  ],
};

describe("생성된 적 100마리 배정표", () => {
  const generated = generatedEnemyRecords() as any[];

  // 역판정이 성립하려면 9 개 아키타입의 서명이 서로 달라야 한다. 같아지면 classify 가
  // 먼저 걸린 쪽을 조용히 반환해 배정표가 거짓으로 초록이 된다.
  it("아키타입 서명이 서로 겹치지 않는다 — 역판정의 전제", () => {
    const seen = new Map<string, string>();
    for (const archetype of ARCHETYPES) {
      const sig = signatureOf(archetypeActions(archetype, "skill_fire"));
      expect(seen.has(sig), `${archetype} 가 ${seen.get(sig)} 와 서명 충돌`).toBe(false);
      seen.set(sig, archetype);
    }
  });

  it("100마리 전원이 어느 아키타입에서 유래했는지 판정된다", () => {
    const orphans = generated.filter((e) => classify(e) === null).map((e) => e.id);
    expect(orphans, `헬퍼 출력과 안 맞는 적: ${orphans.join(", ")}`).toEqual([]);
    expect(generated.length).toBe(100);
  });

  it("배정표가 코드에서 유도한 결과와 일치한다", () => {
    const derived: Record<string, string[]> = {};
    for (const enemy of generated) (derived[classify(enemy)!] ??= []).push(enemy.id);
    expect(derived).toEqual(EXPECTED_ARCHETYPES);
  });

  it("정령 10마리만 caster 이며 SPIRIT_ELEMENT_SKILLS 의 키와 정확히 같다", () => {
    expect(EXPECTED_ARCHETYPES.caster.slice().sort()).toEqual(Object.keys(SPIRIT_ELEMENT_SKILLS).sort());
  });

  // EXPECTED_ARCHETYPES 만으로는 **체계적** 오배정을 못 잡는다 — 표를 편집 결과에서
  // 뽑았으므로 구획을 통째로 잘못 붙여도 표가 같이 틀려 초록이 된다. 그래서 배정의
  // 근거인 소스의 구획 주석을 직접 읽어 계획의 계열↔아키타입 표와 대조한다.
  it("소스의 구획 주석과 아키타입이 계획의 표대로 대응한다", () => {
    const SECTION_ARCHETYPE: Record<string, string> = {
      "슬라임·젤리": "blob",
      "곤충·절지": "venom",
      야수: "brute",
      언데드: "curse",
      "정령·원소": "caster",
      "골렘·구조물": "bulwark",
      인간형: "tactician",
      "수생·비행": "flyer",
      "드래곤·보스": "boss",
    };
    const source = readFileSync(new URL("../src/project/defaults/generatedEnemyRecords.ts", import.meta.url), "utf8");
    const byId = new Map(generated.map((e) => [e.id, e]));
    const seenSections = new Set<string>();
    let section: string | null = null;
    let checked = 0;
    for (const line of source.split("\n")) {
      const comment = line.match(/^\s*\/\/ (.+)$/);
      if (comment && SECTION_ARCHETYPE[comment[1]!]) {
        section = comment[1]!;
        seenSections.add(section);
        continue;
      }
      const record = line.match(/normalizeEnemyRecord\(\{ \.\.\.\{"id":"([a-z_]+)"/);
      if (!record) continue;
      const id = record[1]!;
      expect(section, `${id} 가 구획 주석 밖에 있다`).not.toBeNull();
      expect(classify(byId.get(id)), `${id} (${section})`).toBe(SECTION_ARCHETYPE[section!]);
      checked += 1;
    }
    expect(checked, "소스에서 읽어낸 레코드 수").toBe(100);
    expect(seenSections.size, "소스에서 읽어낸 구획 수").toBe(9);
  });
});
