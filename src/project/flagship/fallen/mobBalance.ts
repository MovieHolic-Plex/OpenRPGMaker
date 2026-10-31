/**
 * 『폴른 스타』 잡몹 무리 밸런스 + 우두머리(정예) — 2026-11-01.
 *
 * 사용자: 「잡몹 무리도 승률 60%에서 90% 사이로. 60%는 엘리트 몬스터.. 하나 있어야할듯? 체력 한 1000쯤 되는.」
 *   - 보통 무리: 그 자리에 실제로 닿는 레벨(막 시작 레벨 + 앞 싸움 경험치를 한 번씩 다 받았다고 본 레벨)에서
 *     「공격」만 누르고 아이템을 쓰지 않을 때 승률 60~90%.
 *   - 우두머리: HP 1000 안팎, 같은 조건 승률 60% 근처. 구역(숲·지하 미궁·재의 들판·요새·설원 길·하늘탑)마다 하나.
 *     전투 그림은 같은 종의 그림을 크게(battleScalePercent) 세우고, 첫 차례에 「우두머리의 기운」(붉은 맥동 오라)을 두른다.
 *     기술 하나가 그 우두머리의 표지다.
 *   - 보스(발렌·달빛의 용·재의 회수자)와 새라 결투는 건드리지 않는다.
 * 측정: scripts/qa/runtime/fs-mob-balance-sim.mts(simulateBattle, 무리마다 200판, 시드 7). 표는 이 파일 맨 아래 주석.
 *
 * 능력치는 원래 정의(act2Opening·act2Tower·vaultCombat·battleRoles·기본 DB) 위에 **마지막에 덮어쓴다** — 다른 비트 작업자가
 * 그 파일들을 고치는 중이라 숫자를 여기 한곳에 모았다. 원래 값이 바뀌었으면(아래 표의 `from` 과 다르면) 경고를 찍고 덮어쓴다 —
 * 그때는 시뮬을 다시 돌려 표를 갱신할 것.
 *
 * chronoBell.ts 는 applyFallenFieldRules 다음에 `applyFallenMobBalance(project, execTool)` 한 줄만 부른다.
 */
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { Command, EnemyRecord, GameEvent, Project, SkillRecord, StateRecord, TroopRecord } from "@/project/types";

type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;
type Rec = Record<string, unknown>;
type StatKey = "maxHp" | "attack" | "defense" | "mind" | "agility";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function upsert<T extends { id: string }>(list: T[], record: T): void {
  const at = list.findIndex((r) => r.id === record.id);
  if (at >= 0) list[at] = record; else list.push(record);
}
const m2 = (commandId: string, fields: Rec): Command => ({ kind: "m2Command", commandId, fields } as unknown as Command);
const narrate = (body: string): Command => ({ kind: "text", body } as unknown as Command);
const act = (skillId: string, priority: number, condition: Rec = { kind: "always" }): EnemyRecord["actions"][number] =>
  ({ skillId, priority, condition, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }) as unknown as EnemyRecord["actions"][number];

/** 우두머리 표시 상태 — 효과 없음, 붉은 맥동 오라만. 전투가 끝나면 풀린다. */
export const FS_ELITE_STATE = "state_fs_elite_aura";

// ── 보통 적 능력치 ─────────────────────────────────────────────────────
/** 적 id → 바꿀 능력치. `from` 은 이 표를 잴 때의 원래 값(달라졌으면 경고). */
export const FS_MOB_STATS: Readonly<Record<string, { readonly from: Partial<Record<StatKey, number>>; readonly to: Partial<Record<StatKey, number>> }>> = {
  // 무리마다 「몇 배 세야 공격만 80%」를 따로 재고(fs-mob-balance-solve.mts), 적마다 배수를 최소제곱으로 맞췄다(배수 0.6~3.2, HP·공격·마력에 √ 씩).
  // 바위게 — 방어 92 는 「공격」만으로 흠집도 못 냈다(Lv6 승률 0%). 방어 무시·마법이 여전히 훨씬 빠르다.
  // 심문회 방패병 — 둘이 방패 벽을 세우면(방어 72·보호) 「공격」만으로는 끝이 안 났다(지하 3층 방진 0%).
  enemy_fs2_ash_crow: { from: { maxHp: 130, attack: 76, mind: 20 }, to: { maxHp: 120, attack: 70, mind: 18 } },
  enemy_fs2_ash_snake: { from: { maxHp: 180, attack: 78, mind: 30 }, to: { maxHp: 220, attack: 92, mind: 35 } },
  enemy_fs2_ash_wisp: { from: { maxHp: 130, attack: 54, mind: 60 }, to: { maxHp: 190, attack: 82, mind: 92 } },
  enemy_fs2_circuit_snake: { from: { maxHp: 260, attack: 94, mind: 60 }, to: { maxHp: 740, attack: 263, mind: 168 } },
  enemy_fs2_crystal_spider: { from: { maxHp: 300, attack: 104, mind: 40 }, to: { maxHp: 380, attack: 132, mind: 51 } },
  enemy_fs2_fort_crossbow: { from: { maxHp: 180, attack: 82, mind: 10 }, to: { maxHp: 220, attack: 99, mind: 12 } },
  enemy_fs2_fort_dog: { from: { maxHp: 200, attack: 80, mind: 20 }, to: { maxHp: 240, attack: 100, mind: 24 } },
  enemy_fs2_fort_knight: { from: { maxHp: 300, attack: 80, mind: 20 }, to: { maxHp: 370, attack: 97, mind: 24 } },
  enemy_fs2_frost_bat: { from: { maxHp: 200, attack: 76, mind: 60 }, to: { maxHp: 200, attack: 75, mind: 60 } },
  enemy_fs2_frost_wolf: { from: { maxHp: 240, attack: 84, mind: 20 }, to: { maxHp: 280, attack: 100, mind: 24 } },
  enemy_fs2_light_moth: { from: { maxHp: 190, attack: 72, mind: 74 }, to: { maxHp: 260, attack: 99, mind: 102 } },
  enemy_fs2_starved_dog: { from: { maxHp: 150, attack: 74, mind: 20 }, to: { maxHp: 160, attack: 74, mind: 21 } },
  enemy_fs2_watchman: { from: { maxHp: 140, attack: 50, mind: 10 }, to: { maxHp: 220, attack: 83, mind: 16 } },
  enemy_fs_bandit: { from: { maxHp: 190, attack: 66, mind: 30 }, to: { maxHp: 190, attack: 69, mind: 31 } },
  enemy_fs_beetle: { from: { maxHp: 200, attack: 62, mind: 20 }, to: { maxHp: 220, attack: 67, mind: 22 } },
  enemy_fs_boar: { from: { maxHp: 240, attack: 66, mind: 20 }, to: { maxHp: 220, attack: 58, mind: 17 } },
  enemy_fs_crab: { from: { maxHp: 190, attack: 58, defense: 92, mind: 20 }, to: { maxHp: 170, attack: 52, defense: 50, mind: 18 } },
  enemy_fs_eel: { from: { maxHp: 150, attack: 54, mind: 50 }, to: { maxHp: 230, attack: 83, mind: 77 } },
  enemy_fs_fanatic: { from: { maxHp: 290, attack: 76, mind: 34 }, to: { maxHp: 540, attack: 144, mind: 65 } },
  enemy_fs_fanatic_preacher: { from: { maxHp: 260, attack: 46, mind: 82 }, to: { maxHp: 510, attack: 90, mind: 161 } },
  enemy_fs_goblin: { from: { maxHp: 120, attack: 52, mind: 30 }, to: { maxHp: 120, attack: 56, mind: 33 } },
  enemy_fs_hornet: { from: { maxHp: 62, attack: 50, mind: 20 }, to: { maxHp: 90, attack: 79, mind: 31 } },
  enemy_fs_inq_crossbow: { from: { maxHp: 230, attack: 82, mind: 12 }, to: { maxHp: 750, attack: 268, mind: 39 } },
  enemy_fs_inq_flagellant: { from: { maxHp: 260, attack: 74, mind: 10 }, to: { maxHp: 400, attack: 112, mind: 15 } },
  enemy_fs_inq_handler: { from: { maxHp: 340, attack: 70, mind: 14 }, to: { maxHp: 460, attack: 94, mind: 19 } },
  enemy_fs_inq_hound: { from: { maxHp: 190, attack: 72, mind: 10 }, to: { maxHp: 280, attack: 107, mind: 15 } },
  enemy_fs_inq_penitent: { from: { maxHp: 700, attack: 88, mind: 10 }, to: { maxHp: 820, attack: 103, mind: 12 } },
  enemy_fs_inq_priest: { from: { maxHp: 300, attack: 34, mind: 88 }, to: { maxHp: 990, attack: 111, mind: 291 } },
  enemy_fs_inq_shield: { from: { maxHp: 470, attack: 68, defense: 72, mind: 14 }, to: { maxHp: 500, attack: 73, defense: 56, mind: 16 } },
  enemy_fs_inq_spy: { from: { maxHp: 260, attack: 74, mind: 30 }, to: { maxHp: 330, attack: 91, mind: 37 } },
  enemy_fs_mantis: { from: { maxHp: 110, attack: 84, mind: 20 }, to: { maxHp: 130, attack: 103, mind: 24 } },
  enemy_fs_moss: { from: { maxHp: 120, attack: 40, mind: 56 }, to: { maxHp: 180, attack: 58, mind: 82 } },
  enemy_fs_moth: { from: { maxHp: 96, attack: 40, mind: 56 }, to: { maxHp: 140, attack: 60, mind: 85 } },
  enemy_fs_spider: { from: { maxHp: 130, attack: 55, mind: 30 }, to: { maxHp: 150, attack: 65, mind: 35 } },
  enemy_fs_undine: { from: { maxHp: 130, attack: 36, mind: 72 }, to: { maxHp: 130, attack: 34, mind: 68 } },
  enemy_fs_wisp: { from: { maxHp: 90, attack: 60, mind: 60 }, to: { maxHp: 100, attack: 76, mind: 76 } },
  enemy_fs_wolf: { from: { maxHp: 150, attack: 58, mind: 30 }, to: { maxHp: 270, attack: 103, mind: 53 } },
};

// ── 무리 구성 ─────────────────────────────────────────────────────────
/**
 * 둘뿐인 무리는 도착 레벨에서 능력치를 서너 배 올려야 60~90% 에 들었다 — 졸개를 하나 더 세우는 쪽이 자연스럽다.
 * `from` 은 이 표를 잴 때의 구성(달라졌으면 경고하고 덮는다).
 */
export const FS_TROOP_MEMBERS: Readonly<Record<string, { readonly from: readonly string[]; readonly to: readonly string[]; readonly name?: string }>> = {
  troop_fs_edge_boar: { from: ["enemy_fs_boar", "enemy_fs_wolf"], to: ["enemy_fs_boar", "enemy_fs_wolf", "enemy_fs_wolf"] },
  troop_fs_stream_eels: { from: ["enemy_fs_eel", "enemy_fs_eel"], to: ["enemy_fs_eel", "enemy_fs_eel", "enemy_fs_eel"] },
  troop_fs_spiders: { from: ["enemy_fs_spider", "enemy_fs_beetle"], to: ["enemy_fs_spider", "enemy_fs_beetle", "enemy_fs_spider"] },
  troop_fs_edge_hornets: { from: ["enemy_fs_hornet", "enemy_fs_hornet", "enemy_fs_hornet"], to: ["enemy_fs_hornet", "enemy_fs_hornet", "enemy_fs_hornet", "enemy_fs_hornet"] },
  troop_fs_inq_shieldwall: { from: ["enemy_fs_inq_shield", "enemy_fs_fanatic_preacher"], to: ["enemy_fs_inq_shield", "enemy_fs_fanatic_preacher", "enemy_fs_fanatic"] },
  troop_fs_inq_bolts: { from: ["enemy_fs_fanatic", "enemy_fs_inq_crossbow"], to: ["enemy_fs_fanatic", "enemy_fs_inq_crossbow", "enemy_fs_inq_crossbow"] },
  troop_fs_inq_kennel: { from: ["enemy_fs_inq_handler", "enemy_fs_inq_hound", "enemy_fs_inq_hound"], to: ["enemy_fs_inq_handler", "enemy_fs_inq_hound", "enemy_fs_inq_hound", "enemy_fs_inq_hound"] },
  // 경종 증원(달 손잡이를 먼저 당긴 벌) — 사냥개 둘이 위 표대로 세져 넷이면 38% 였다. 하나를 뺀다.
  troop_fs_inq_alarm: { from: ["enemy_fs_inq_penitent", "enemy_fs_inq_handler", "enemy_fs_inq_hound", "enemy_fs_inq_hound"], to: ["enemy_fs_inq_penitent", "enemy_fs_inq_handler", "enemy_fs_inq_hound"] },
  troop_fs_inq_vigil: { from: ["enemy_fs_inq_flagellant", "enemy_fs_inq_priest", "enemy_fs_fanatic"], to: ["enemy_fs_inq_flagellant", "enemy_fs_inq_priest", "enemy_fs_fanatic", "enemy_fs_fanatic"] },
  troop_fs_inq_patrol: { from: ["enemy_fs_inq_flagellant", "enemy_fs_inq_shield", "enemy_fs_inq_crossbow"], to: ["enemy_fs_inq_flagellant", "enemy_fs_inq_shield", "enemy_fs_inq_crossbow", "enemy_fs_inq_flagellant"] },
  troop_fs2_curfew_patrol: { from: ["enemy_fs2_watchman", "enemy_fs2_watchman"], to: ["enemy_fs2_watchman", "enemy_fs2_watchman", "enemy_fs2_watchman"] },
  troop_fs2_frost_wolves: { from: ["enemy_fs2_frost_wolf", "enemy_fs2_frost_wolf"], to: ["enemy_fs2_frost_wolf", "enemy_fs2_frost_wolf", "enemy_fs2_frost_wolf"] },
  troop_fs2_tower_moths: { from: ["enemy_fs2_light_moth", "enemy_fs2_light_moth", "enemy_fs2_light_moth"], to: ["enemy_fs2_light_moth", "enemy_fs2_light_moth", "enemy_fs2_light_moth", "enemy_fs2_light_moth"] },
  troop_fs2_tower_snakes: { from: ["enemy_fs2_circuit_snake", "enemy_fs2_circuit_snake", "enemy_fs2_light_moth"], to: ["enemy_fs2_circuit_snake", "enemy_fs2_circuit_snake", "enemy_fs2_circuit_snake", "enemy_fs2_light_moth"] },
};

/** 같은 무리가 레벨이 다른 두 곳에 놓여 한 값으로 못 맞추는 경우 — 뒤쪽 자리에 새 무리를 준다(맵의 그 전투만 무리 id 를 바꾼다). */
export const FS_TROOP_SPLITS: readonly { readonly mapId: string; readonly fromTroop: string; readonly id: string; readonly name: string; readonly enemyIds: readonly string[] }[] = [
  // 재의 들판(Lv7) 도깨비 셋과 새벽샘 마을 터(Lv8) 도깨비 — 마을 터는 넷.
  { mapId: "fs2_dawnwell", fromTroop: "troop_fs2_ash_wisps", id: "troop_fs2_ash_wisps_dawn", name: "잿불 도깨비 떼",
    enemyIds: ["enemy_fs2_ash_wisp", "enemy_fs2_ash_wisp", "enemy_fs2_ash_wisp", "enemy_fs2_ash_wisp"] },
];

// ── 우두머리 ──────────────────────────────────────────────────────────
interface EliteSpec {
  readonly id: string;
  /** 새로 만들면 견본 적, 제자리(같은 id)면 그 적. */
  readonly from: string;
  readonly name: string;
  readonly level: number;
  readonly scale: number;
  readonly stats: Record<StatKey | "maxMp", number>;
  readonly exp: number;
  readonly gold: number;
  readonly skill: { readonly id: string; readonly name: string; readonly description: string; readonly fields: Partial<SkillRecord>; readonly priority: number; readonly every: number };
  /** 견본의 행동 중 남길 기술(나머지는 버린다). */
  readonly keep: readonly string[];
  readonly line: string;
}

// 우두머리 민첩은 파티와 비슷하게 — 굼뜬 종(멧돼지·참회자·기계)을 그대로 두면 셋이 여섯 번 칠 때 한 번 움직여
// HP 1000 이 무색했다(공격을 다섯 배로 올려도 승률 100%).
export const FS_ELITES: readonly EliteSpec[] = [
  {
    id: "enemy_fs_elite_thornback", from: "enemy_fs_boar", name: "가시등 멧돼지", level: 8, scale: 165,
    stats: { maxHp: 1080, maxMp: 0, attack: 70, defense: 34, mind: 20, agility: 56 }, exp: 260, gold: 120,
    skill: { id: "skill_fs_elite_thorn_rush", name: "가시등 들이받기", priority: 12, every: 3,
      description: "등의 가시를 곤두세우고 줄 전체를 들이받는다.",
      fields: { scope: "allEnemies", power: 58, effect: { kind: "damage", statistic: "attack", affects: "hp" }, animationId: "anim_gen_tackle_impact", gaugeShift: -20 } as Partial<SkillRecord> },
    keep: ["skill_mon_tusk_charge", "skill_attack"],
    line: "덤불이 갈라진다. 등에 가시가 돋은 큰 멧돼지가 콧김을 뿜는다.",
  },
  {
    id: "enemy_fs_elite_penitent", from: "enemy_fs_inq_penitent", name: "쇠사슬 대참회자", level: 10, scale: 140,
    stats: { maxHp: 1200, maxMp: 0, attack: 138, defense: 36, mind: 10, agility: 64 }, exp: 220, gold: 90,
    skill: { id: "skill_fs_elite_chain_storm", name: "쇠사슬 폭풍", priority: 12, every: 3,
      description: "온몸에 감은 쇠사슬을 풀어 방 안을 휩쓴다.",
      fields: { scope: "allEnemies", power: 64, effect: { kind: "damage", statistic: "attack", affects: "hp" }, animationId: "anim_gen_wind_slice" } as Partial<SkillRecord> },
    // 참회의 일격(힘 모으기)은 뺀다 — 셋이 번갈아 치면 늘 끊겨 혼자 선 대참회자가 한 대도 못 쳤다(승률 100%).
    keep: ["skill_fs_inq_chain", "skill_attack"],
    line: "쇠사슬이 바닥을 긁는다. 다른 참회자들보다 머리 하나가 크다.",
  },
  {
    id: "enemy_fs2_cinder_golem", from: "enemy_fs2_cinder_golem", name: "달아오른 숯덩이 골렘", level: 9, scale: 150,
    stats: { maxHp: 1070, maxMp: 0, attack: 92, defense: 72, mind: 47, agility: 48 }, exp: 280, gold: 90,
    skill: { id: "skill_fs2_elite_ember_slam", name: "숯불 내려찍기", priority: 12, every: 3,
      description: "달아오른 두 팔로 땅을 내려찍어 불티를 흩뿌린다.",
      fields: { scope: "allEnemies", power: 60, elementId: "fire", effect: { kind: "damage", statistic: "attack", affects: "hp" }, animationId: "anim_gen_earth_spike" } as Partial<SkillRecord> },
    keep: ["skill_attack", "skill_earth"],
    line: "잿더미가 일어선다. 갈라진 틈마다 숯불이 붉게 숨 쉰다.",
  },
  {
    id: "enemy_fs2_elite_warden", from: "enemy_fs2_fort_knight", name: "요새 수문장", level: 10, scale: 135,
    stats: { maxHp: 980, maxMp: 0, attack: 80, defense: 50, mind: 19, agility: 58 }, exp: 150, gold: 80,
    skill: { id: "skill_fs2_elite_gate_charge", name: "성문 돌파", priority: 12, every: 3,
      description: "방패를 앞세우고 돌진해 앞줄을 쓰러뜨린다.",
      fields: { scope: "enemy", power: 95, effect: { kind: "damage", statistic: "attack", affects: "hp" }, animationId: "anim_gen_tackle_impact", gaugeShift: -40 } as Partial<SkillRecord> },
    keep: ["skill_attack", "skill_sword_slash"],
    line: "투구 깃이 붉다. 수문장이 성문 열쇠 꾸러미를 허리에 찬 채 창을 겨눈다.",
  },
  {
    id: "enemy_fs2_elite_frostmane", from: "enemy_fs2_frost_wolf", name: "서리갈기 우두머리", level: 11, scale: 150,
    stats: { maxHp: 1200, maxMp: 0, attack: 149, defense: 36, mind: 65, agility: 76 }, exp: 240, gold: 60,
    skill: { id: "skill_fs2_elite_frost_howl", name: "서리 울부짖음", priority: 12, every: 3,
      description: "얼어붙은 숨을 길게 내뱉어 무리 전체를 얼린다.",
      fields: { scope: "allEnemies", power: 56, elementId: "ice", effect: { kind: "damage", statistic: "attack", affects: "hp" }, animationId: "anim_gen_ice_shatter" } as Partial<SkillRecord> },
    keep: ["skill_attack", "skill_mon_savage_maul"],
    line: "눈보라 속에서 갈기가 하얗게 언 늑대가 걸어 나온다. 다른 늑대들이 길을 비킨다.",
  },
  {
    id: "enemy_fs2_tower_sentinel", from: "enemy_fs2_tower_sentinel", name: "탑 파수 기계", level: 12, scale: 150,
    stats: { maxHp: 1140, maxMp: 0, attack: 126, defense: 58, mind: 41, agility: 60 }, exp: 260, gold: 60,
    skill: { id: "skill_fs2_elite_sentinel_sweep", name: "파수 회전베기", priority: 12, every: 3,
      description: "몸통을 한 바퀴 돌려 팔날로 둘레를 벤다.",
      fields: { scope: "allEnemies", power: 58, effect: { kind: "damage", statistic: "attack", affects: "hp" }, animationId: "anim_gen_slash_steel" } as Partial<SkillRecord> },
    // 껍질 굳히기(방어 상승)는 뺀다 — 혼자 선 기계가 굳히기를 되풀이하면 「공격」만으로는 끝이 안 났다.
    keep: ["skill_attack", "skill_mon_body_slam"],
    line: "기사를 쳐 낸 파수 기계가 이쪽으로 몸통을 돌린다. 눈구멍의 빛이 붉게 바뀐다.",
  },
];

/** 우두머리 무리 — 새 무리는 만들고, 기존 무리는 구성만 바꾼다. */
export const FS_ELITE_TROOPS: readonly { readonly id: string; readonly name: string; readonly enemyIds: readonly string[]; readonly fromTroop: string }[] = [
  // 우두머리는 혼자 선다 — 곁에 졸개를 붙이면 「공격」만 누르는 파티가 우두머리(첫 줄)를 치는 동안 졸개가 파티를 쓰러뜨려
  // (졸개는 위 표대로 세졌다) 우두머리 HP 1000 과 상관없이 승률이 0% 로 떨어졌다. 혼자 서야 「HP 1000 짜리 한 놈」이 된다.
  { id: "troop_fs_elite_thornback", name: "가시등 멧돼지", enemyIds: ["enemy_fs_elite_thornback"], fromTroop: "troop_fs_edge_boar" },
  { id: "troop_fs_inq_penance", name: "쇠사슬 대참회자", enemyIds: ["enemy_fs_elite_penitent"], fromTroop: "troop_fs_inq_penance" },
  { id: "troop_fs2_cinder_golem", name: "달아오른 숯덩이 골렘", enemyIds: ["enemy_fs2_cinder_golem"], fromTroop: "troop_fs2_cinder_golem" },
  { id: "troop_fs2_elite_warden", name: "요새 수문장", enemyIds: ["enemy_fs2_elite_warden"], fromTroop: "troop_fs2_fort_knights" },
  { id: "troop_fs2_elite_frost", name: "서리갈기 우두머리", enemyIds: ["enemy_fs2_elite_frostmane"], fromTroop: "troop_fs2_frost_mixed" },
  { id: "troop_fs2_tower_sentinel", name: "탑 파수 기계", enemyIds: ["enemy_fs2_tower_sentinel"], fromTroop: "troop_fs2_tower_sentinel" },
];

/** 이미 놓인 보이는 적 하나를 우두머리로 바꿔 세운다(같은 칸). 새 칸을 고르지 않는다 — 다른 비트가 맵을 고치는 중이다. */
export const FS_ELITE_PLACEMENTS: readonly { readonly mapId: string; readonly fromTroop: string; readonly toTroop: string; readonly pick: "last" | "first" }[] = [
  { mapId: "fs_forest_glade", fromTroop: "troop_fs_glade_poachers", toTroop: "troop_fs_elite_thornback", pick: "last" },
  { mapId: "fs2_fortress", fromTroop: "troop_fs2_fort_knights", toTroop: "troop_fs2_elite_warden", pick: "last" },
  { mapId: "map_snow_north_2", fromTroop: "troop_fs2_frost_mixed", toTroop: "troop_fs2_elite_frost", pick: "last" },
];

/** 능력치·우두머리 기록만(맵은 안 건드린다) — 시뮬 스크립트도 이것을 부른다. */
export function applyFallenMobStats(project: Project, stats: typeof FS_MOB_STATS = FS_MOB_STATS): string[] {
  const db = project.database;
  const warnings: string[] = [];
  upsert(db.states as StateRecord[], {
    id: FS_ELITE_STATE, name: "우두머리", restriction: "없음", removalCondition: "전투 종료", battleAura: "berserk-pulse",
    recoverNaturallyFromTurn: 0, recoverNaturallyChance: 0, runtimeEffects: { removeOnBattleEnd: true },
  } as unknown as StateRecord);

  for (const [id, row] of Object.entries(stats)) {
    const enemy = db.enemies.find((e) => e.id === id);
    if (!enemy) { warnings.push(`적 없음: ${id}`); continue; }
    for (const [k, v] of Object.entries(row.from) as [StatKey, number][]) {
      if (enemy.stats[k] !== v) warnings.push(`${id}.${k} 원래 값이 ${v} 가 아니라 ${enemy.stats[k]} — 시뮬을 다시 돌릴 것`);
    }
    enemy.stats = { ...enemy.stats, ...row.to };
  }

  for (const [id, row] of Object.entries(FS_TROOP_MEMBERS)) {
    const troop = db.troops.find((t) => t.id === id);
    if (!troop) { warnings.push(`무리 없음: ${id}`); continue; }
    if (troop.enemyIds.join(",") !== row.from.join(",")) warnings.push(`${id} 구성이 ${row.from.join("+")} 가 아니라 ${troop.enemyIds.join("+")} — 시뮬을 다시 돌릴 것`);
    setMembers(troop, row.to);
    if (row.name) troop.name = row.name;
  }
  for (const split of FS_TROOP_SPLITS) {
    const from = db.troops.find((t) => t.id === split.fromTroop);
    if (!from) { warnings.push(`나눌 무리 없음: ${split.fromTroop}`); continue; }
    const troop = clone(from) as TroopRecord;
    troop.id = split.id;
    troop.name = split.name;
    setMembers(troop, split.enemyIds);
    upsert(db.troops, troop);
  }

  const template = db.skills.find((s) => s.id === "skill_fs_judgment") ?? db.skills.find((s) => s.id === "skill_attack");
  if (!template) throw new Error("[fallen-star mob] 기술 견본이 없다");
  for (const spec of FS_ELITES) {
    const base = db.enemies.find((e) => e.id === spec.from);
    if (!base) { warnings.push(`우두머리 견본 없음: ${spec.from}`); continue; }
    upsert(db.skills, {
      ...clone(template), id: spec.skill.id, name: spec.skill.name, description: spec.skill.description,
      stateEffects: [], chargeTurns: undefined, chargeBreak: undefined, elementId: undefined, hitRate: 100, variance: 12,
      mpCost: { flat: 0, percentMax: 0 }, ...spec.skill.fields,
    } as SkillRecord);
    const kept = (base.actions ?? []).filter((a) => spec.keep.includes(a.skillId));
    const actions = [act(spec.skill.id, spec.skill.priority, { kind: "turn", start: 2, interval: spec.skill.every }), ...clone(kept)];
    const e = clone(base) as EnemyRecord & Rec;
    upsert(db.enemies, normalizeEnemyRecord({
      ...e, id: spec.id, name: spec.name, level: spec.level, battleScalePercent: spec.scale, stats: spec.stats, actions,
      skillIds: [...new Set(actions.map((a) => a.skillId))], collapseEffect: "bossSink",
      rewards: { exp: spec.exp, gold: spec.gold, dropRatePercent: 0, drops: [{ itemId: "item_hi_potion", ratePercent: 100, quantity: 1, condition: { kind: "always" } }] },
      stateRates: { ...(e.stateRates ?? {}), state_stop: "D", state_sleep: "D", state_paralysis: "D", [FS_ELITE_STATE]: "A" },
    } as unknown as EnemyRecord));
  }
  for (const t of FS_ELITE_TROOPS) {
    const from = db.troops.find((x) => x.id === t.fromTroop);
    if (!from) { warnings.push(`우두머리 무리 견본 없음: ${t.fromTroop}`); continue; }
    const lead = FS_ELITES.find((s) => s.id === t.enemyIds[0])!;
    const troop = clone(from) as TroopRecord;
    troop.id = t.id;
    troop.name = t.name;
    setMembers(troop, t.enemyIds);
    troop.battleEventPages = [
      ...(troop.battleEventPages ?? []).filter((pg) => pg.id !== `${t.id}_elite_open`),
      { id: `${t.id}_elite_open`, name: "우두머리 — 첫 차례", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 1 }],
        commands: [narrate(lead.line), m2("m2-100-change-enemy-state", { target: lead.id, operation: "add", value: FS_ELITE_STATE })] },
    ] as TroopRecord["battleEventPages"];
    upsert(db.troops, troop);
  }
  return warnings;
}

/** 구성을 바꾼다 — 자리는 전투가 자동으로 늘어세운다(autoAlign). */
function setMembers(troop: TroopRecord, enemyIds: readonly string[]): void {
  troop.enemyIds = [...enemyIds];
  troop.members = enemyIds.map((enemyId, i) => ({ enemyId, x: 80 + i * 56, y: 96, hidden: false })) as TroopRecord["members"];
  troop.autoAlign = true;
}

function battleTroopIds(event: GameEvent): string[] {
  const out: string[] = [];
  const walk = (cs: readonly Command[] | undefined): void => {
    for (const c of cs ?? []) {
      const r = c as unknown as Rec;
      if (r.kind === "battleProcessing" && typeof r.troopId === "string") out.push(r.troopId);
      for (const v of Object.values(r)) if (Array.isArray(v) && v.length && typeof v[0] === "object" && v[0] && "kind" in (v[0] as object)) walk(v as Command[]);
    }
  };
  for (const pg of event.pages ?? []) walk(pg.commands);
  return out;
}

export function applyFallenMobBalance(project: Project, exec: Exec): void {
  for (const w of applyFallenMobStats(project)) console.warn(`[fallen-star mob] ${w}`);
  for (const split of FS_TROOP_SPLITS) {
    let changed = 0;
    const swap = (cs: readonly Command[] | undefined): void => {
      for (const c of cs ?? []) {
        const r = c as unknown as Rec;
        if (r.kind === "battleProcessing" && r.troopId === split.fromTroop) { r.troopId = split.id; changed += 1; }
        for (const v of Object.values(r)) if (Array.isArray(v) && v.length && typeof v[0] === "object" && v[0] && "kind" in (v[0] as object)) swap(v as Command[]);
      }
    };
    for (const ev of project.maps[split.mapId]?.events ?? []) for (const pg of ev.pages ?? []) swap(pg.commands);
    if (!changed) console.warn(`[fallen-star mob] ${split.mapId} 에 ${split.fromTroop} 전투가 없어 ${split.id} 로 못 바꿨다`);
  }
  for (const p of FS_ELITE_PLACEMENTS) {
    const map = project.maps[p.mapId];
    const events = (map?.events ?? []).filter((e) => e.name?.startsWith?.("ev_field_enemy") || e.id.startsWith("ev_field_enemy") || e.id.includes("_foe"))
      .filter((e) => battleTroopIds(e).includes(p.fromTroop));
    const at = p.pick === "last" ? events[events.length - 1] : events[0];
    if (!map || !at) { console.warn(`[fallen-star mob] ${p.mapId} 에 ${p.fromTroop} 보이는 적이 없어 우두머리를 못 세웠다`); continue; }
    const { x, y } = at;
    const original = clone(at);
    exec(project, "remove_event", { mapId: p.mapId, eventId: at.id });
    // 우두머리는 늘 보이는 곳에 서서 지키다 가까이(4칸) 와야 천천히 온다 — 피해 갈 수 있다. 한 번 이기면 다시 서지 않는다.
    try {
      exec(project, "place_field_enemy", { mapId: p.mapId, x, y, troopId: p.toTroop, behavior: "chase", patrol: { length: 1, axis: "horizontal" },
        sightRange: 4, vision: "cone", pace: "slow", alert: "anger", respawnSec: 0, canEscape: false, id: `ev_${p.toTroop}` });
    } catch (error) {
      console.warn(`[fallen-star mob] ${p.mapId} (${x},${y}) 우두머리 자리 거절 — 원래 적을 되돌린다: ${String((error as Error).message).slice(0, 160)}`);
      project.maps[p.mapId]!.events.push(original);
    }
  }
}
