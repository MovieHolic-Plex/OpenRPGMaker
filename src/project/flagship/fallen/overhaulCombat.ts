/**
 * 『폴른 스타』 공격적 개편 · 전투·도감·연출 층.
 *
 * 1. 4인 전원 고유 전투 루프:
 *    - 카엘: 별 표식 I→II→III 축적 → 화염검·단죄의 일섬 폭발 (기존 유지 + 설명 정비)
 *    - 엘레나: 원소 공명 — 화상 적에게 블리자드 +45%(열충격), 젖음/둔화 적에게 연쇄 번개 +45%(감전), 둔화/수면 적에게 불덩이 +35%
 *    - 이리스: 관측 잠금(state_fs_iris_lock) — 광자 연사·전격탄으로 잠금(방어 -15%) → 광선 조준(+55%, 소비)·충전 광선포(+45%) 폭발
 *    - 새라: 창세(state_fs_sarah_momentum) — 막아서기·고개 들어라로 창세(공격 +25%, 민첩 +15%) + 큰 도약·창 휘두르기가 관통상/방어하락 적에게 +45%
 *    - 새 유대 연계기(카엘+이리스): 「별빛 약속」 — 아군 전체 HP 회복 + 재생 + 공격 상승
 * 2. 필드-전투 연결: battleFormationRoll(등 뒤 선제·기습) + escapeBonusPercent(12%)
 * 3. 별지기의 관찰 수첩(system.bestiary): 약점 비공개 철학을 유지하되, 전투에서 직접 시험해 맞힌 약점이 수첩에 기록된다.
 * 4. 전용 pixelfx 4종 연결: fourth-answer · lance-dive · iris-beam · ash-recall.
 */
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { normalizeStateRecord } from "@/project/databaseRecordModel";
import { normalizeBestiary, type BestiaryEntry } from "@/project/bestiary";
import { normalizePixelFxSpec } from "@/project/pixelFxSpec";
import type { BattleAnimationRecord, PixelFxSpec, Project, SkillRecord, StateRecord } from "@/project/types";

type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;

export const FS_STATE_IRIS_LOCK = "state_fs_iris_lock";
export const FS_STATE_SARAH_MOMENTUM = "state_fs_sarah_momentum";
export const FS_COMBO_STARLIGHT_PROMISE = "combo_fs_starlight_promise";

const HERO = "actor_hero";
const IRIS = "actor_fs_iris";

function findSkill(project: Project, id: string): SkillRecord | undefined {
  return project.database.skills.find((s) => s.id === id);
}

function upsertState(project: Project, state: Partial<StateRecord> & Pick<StateRecord, "id" | "name">): void {
  const record = normalizeStateRecord(state);
  project.database.states = [...project.database.states.filter((s) => s.id !== record.id), record];
}

function bindPixelFx(project: Project, skillId: string, spec: PixelFxSpec, hit: number, note: string, sound?: string): void {
  const skill = findSkill(project, skillId);
  const normalized = normalizePixelFxSpec(spec);
  if (!skill || !normalized) return;
  const old = skill.animationId ? project.database.battleAnimations.find((a) => a.id === skill.animationId) : undefined;
  const id = `anim_pfx_fs_overhaul_${skillId.replace(/^(skill|combo)_/, "")}`;
  const timings = sound
    ? [{ frameIndex: hit, soundResourceId: sound }]
    : (old?.timings ?? []).filter((t) => t.soundResourceId || t.screenShake).map((t, i) => ({ ...t, frameIndex: hit + i }));
  const record: BattleAnimationRecord = normalizeBattleAnimationRecord({
    id,
    name: `${note} · pixelfx ${normalized.effectId}`,
    scope: old?.scope === "screen" ? "allTargets" : old?.scope ?? "singleTarget",
    position: "feet",
    pixelFx: normalized,
    timings,
  });
  project.database.battleAnimations = [...project.database.battleAnimations.filter((a) => a.id !== id), record];
  skill.animationId = id;
}

function applyFourHeroLoops(project: Project, exec: Exec): void {
  // ── 1. 이리스 · 관측 잠금 ────────────────────────────────────────────────
  upsertState(project, {
    id: FS_STATE_IRIS_LOCK,
    name: "관측 잠금",
    iconResourceId: "cc0-jetrel-gen2-fs-star-mark-2",
    battleAura: "scan-ring",
    removalCondition: "전투 종료",
    recoverNaturallyFromTurn: 3,
    recoverNaturallyChance: 100,
    runtimeEffects: { defenseMultiplier: 0.85, maxTurns: 3, removeOnBattleEnd: true },
    clearOnBattleEnd: true,
  });

  for (const id of ["skill_gunner_rapid_fire", "skill_fs_iris_shock"] as const) {
    const sk = findSkill(project, id);
    if (!sk) continue;
    sk.stateEffects = [
      ...(sk.stateEffects ?? []).filter((row) => row.stateId !== FS_STATE_IRIS_LOCK),
      { stateId: FS_STATE_IRIS_LOCK, chance: id === "skill_gunner_rapid_fire" ? 85 : 100, operation: "add" },
    ];
    if (id === "skill_gunner_rapid_fire") {
      sk.description = "빛 네 발을 연달아 쏜다. 맞힐 때마다 적 차례를 밀고 「관측 잠금」을 건다.\n사출봉을 들면 +40%. 잠든 적은 깬다.";
    } else {
      sk.description = "전격탄을 쏘아 번개 피해를 주고 「관측 잠금」을 건다.\n물·기계 적에게 특히 잘 든다.";
    }
  }

  const shot = findSkill(project, "skill_gunner_shot");
  if (shot) {
    shot.exploitStates = {
      stateIds: [FS_STATE_IRIS_LOCK, "state_stop", "state_sleep", "state_paralysis"],
      bonusPercent: 55,
      consume: true,
      bonusByState: { [FS_STATE_IRIS_LOCK]: 55, state_stop: 50, state_sleep: 50, state_paralysis: 50 },
    };
    shot.description = "급소 확률 50%(두 배 피해). 사출봉을 들면 +40%.\n관측 잠금(+55%)이나 멈춘 적(+50%)을 꿰뚫어 터뜨린다.";
  }

  const snipe = findSkill(project, "skill_gunner_snipe");
  if (snipe) {
    snipe.exploitStates = {
      stateIds: [FS_STATE_IRIS_LOCK],
      bonusPercent: 45,
      consume: true,
    };
    snipe.description = "빛을 모아 한 줄기로 쏜다. 관통상을 남기며 관측 잠금 적에게 +45%.\n사출봉을 들면 +40%.";
  }

  // ── 2. 엘레나 · 원소 공명(불↔얼음↔번개) ────────────────────────────────
  const blizzard = findSkill(project, "skill_mage_blizzard");
  if (blizzard) {
    blizzard.exploitStates = { stateIds: ["fs_state_burn"], bonusPercent: 45, consume: true };
    blizzard.stateEffects = [{ stateId: "state_agility_down", chance: 50, operation: "add" }];
    blizzard.description = "적 전체에 얼음 피해를 주고 50% 확률로 둔하게 만든다.\n화상 적에게 맞히면 열충격으로 +45% 터진다.";
  }

  const chain = findSkill(project, "skill_mage_chain_lightning");
  if (chain) {
    chain.exploitStates = {
      stateIds: ["state_wet", "state_agility_down"],
      bonusPercent: 45,
      bonusByState: { state_wet: 55, state_agility_down: 40 },
    };
    chain.description = "적 전체에 번개 피해, 25% 마비.\n젖은 적(+55%)이나 둔해진 적(+40%)에게 감전 연쇄가 터진다.";
  }

  const fireball = findSkill(project, "skill_mage_fireball");
  if (fireball) {
    fireball.exploitStates = { stateIds: ["state_agility_down", "state_sleep"], bonusPercent: 35 };
    fireball.stateEffects = [
      ...(fireball.stateEffects ?? []).filter((r) => r.stateId !== "fs_state_burn"),
      { stateId: "fs_state_burn", chance: 35, operation: "add" },
    ];
    fireball.description = "적 하나에 불덩이를 날린다. 35% 확률로 화상을 입힌다.\n둔하거나 잠든 적에게 +35%.";
  }

  // ── 3. 새라 · 창세 & 관통상 폭발 ────────────────────────────────────────
  upsertState(project, {
    id: FS_STATE_SARAH_MOMENTUM,
    name: "창세",
    battleAura: "power-flare",
    removalCondition: "전투 종료",
    recoverNaturallyFromTurn: 2,
    recoverNaturallyChance: 100,
    runtimeEffects: { attackMultiplier: 1.25, agilityMultiplier: 1.15, maxTurns: 2, removeOnBattleEnd: true },
    clearOnBattleEnd: true,
  });

  const hold = findSkill(project, "skill_fs2_hold_line");
  if (hold) {
    hold.stateEffects = [
      ...(hold.stateEffects ?? []).filter((r) => r.stateId !== FS_STATE_SARAH_MOMENTUM),
      { stateId: FS_STATE_SARAH_MOMENTUM, chance: 100, operation: "add" },
    ];
    hold.description = "앞을 막아서 적 공격을 받아내고 방어와 창세(공격·민첩↑)를 세운다.";
  }

  for (const id of ["skill_dragoon_high_jump", "skill_dragoon_sweeping_lance"] as const) {
    const sk = findSkill(project, id);
    if (!sk) continue;
    sk.exploitStates = {
      stateIds: ["state_fs_pierced", "state_defense_down"],
      bonusPercent: 45,
      bonusByState: { state_fs_pierced: 50, state_defense_down: 35 },
    };
    if (id === "skill_dragoon_high_jump") {
      sk.description = "높이 뛰어올라 창끝으로 내리찍는다.\n관통상(+50%)이나 방어가 깎인 적(+35%)을 꿰뚫는다.";
    } else {
      sk.description = "긴 창으로 적 전체를 쓸어 버린다.\n관통상(+50%)이나 방어가 깎인 적(+35%)에게 크게 들어간다.";
    }
  }

  // ── 4. 카엘 + 이리스 유대 연계기 「별빛 약속」 ──────────────────────────
  if (project.database.actors.some((a) => a.id === IRIS)) {
    exec(project, "upsert_combo_tech", {
      id: FS_COMBO_STARLIGHT_PROMISE,
      name: "별빛 약속",
      description: "둘이 나란히 서서 빛을 펼친다.\n아군 전체 HP를 크게 회복하고 재생과 공격 상승을 건다.",
      actorIds: [HERO, IRIS],
      requires: [{ actorId: HERO, skillId: "skill_fs_taunt" }, { actorId: IRIS, skillId: "skill_gunner_rapid_fire" }],
      mpCosts: [{ actorId: HERO, mp: 5 }, { actorId: IRIS, mp: 6 }],
      scope: "allAllies",
      kind: "healing",
      statistic: "mind",
      power: 56,
      combinedStats: true,
      stateEffects: [
        { stateId: "state_regen", chance: 100, operation: "add" },
        { stateId: "state_attack_up", chance: 100, operation: "add" },
      ],
      choreographyId: "skill_cleric_purify",
      staging: { tint: "#c8e6ff", shake: "light", slowMo: false, kicker: "지켜 줄게", partners: "cast" },
    });
  }

  // ── 5. 신규 커스텀 pixelfx 4종 연결 ─────────────────────────────────────
  bindPixelFx(project, "combo_fs2_fourth_answer", { effectId: "fallenstar/fourth-answer" }, 5, "네 번째 대답", "easyrpg-sound-holy7");
  bindPixelFx(project, "skill_dragoon_high_jump", { effectId: "fallenstar/lance-dive" }, 3, "큰 도약", "easyrpg-sound-blow4");
  bindPixelFx(project, "combo_fs2_twin_lance", { effectId: "fallenstar/lance-dive" }, 3, "쌍창 돌파", "easyrpg-sound-blow4");
  bindPixelFx(project, "skill_gunner_snipe", { effectId: "fallenstar/iris-beam" }, 3, "충전 광선포", "easyrpg-sound-flash3");
  bindPixelFx(project, "skill_fs2_ash_recall", { effectId: "fallenstar/ash-recall" }, 5, "재의 회수", "easyrpg-sound-explosion1");
}

function applyFormationAndEscape(project: Project): void {
  project.system.battleFormationRoll = true;
  project.system.escapeBonusPercent = 12;
}

interface BestiarySpec {
  readonly id: string;
  readonly name: string;
  readonly enemies: readonly string[];
  readonly seen: string;
  readonly weakness: string;
  readonly defeated: string;
}

const BESTIARY_SPECS: readonly BestiarySpec[] = [
  {
    id: "fs_b_wolf", name: "숲늑대", enemies: ["enemy_fs_wolf", "enemy_wolf_grey"],
    seen: "북쪽 숲에 별이 떨어진 뒤로 부쩍 사나워진 늑대. 떼로 몰려들어 먼저 달려든다.",
    weakness: "상성을 직접 맞혀 확인했다. 엘레나의 메모가 수첩 여백에 적혀 있다.",
    defeated: "송곳니와 가죽은 로한의 대장간과 니나의 공방에서 요긴하게 쓰인다.",
  },
  {
    id: "fs_b_spider", name: "덤불거미 · 갑각충", enemies: ["enemy_fs_spider", "enemy_fs_beetle"],
    seen: "어두운 숲길 풀숲에 숨어 지내는 벌레들. 껍질이 단단한 놈은 칼이 잘 안 먹힌다.",
    weakness: "불이나 방어 깎기·마법이 먹히는지 직접 부딪혀 기록해 두었다.",
    defeated: "거미 비단과 독 주머니는 회복약·불씨 병·해독초 재료로 쓸 수 있다.",
  },
  {
    id: "fs_b_wisp", name: "푸른 도깨비불", enemies: ["enemy_fs_wisp"],
    seen: "별빛이 스민 숲 공터 주위를 떠도는 푸른 불꽃. 가만히 보다 갑자기 쏜살같이 달려든다.",
    weakness: "불을 품은 존재답게 상성이 뚜렷하다. 맞혀 본 결과가 수첩에 남았다.",
    defeated: "꺼진 자리에 남는 푸른 불씨는 공방 조합과 로한의 단조에 꼭 들어간다.",
  },
  {
    id: "fs_b_stream", name: "수로 뱀장어 · 바위게 · 물의 정령", enemies: ["enemy_fs_eel", "enemy_fs_crab", "enemy_fs_undine"],
    seen: "옛 수로 물가에 자리 잡은 짐승들. 물기를 머금고 있어 전기나 껍질에 주의해야 한다.",
    weakness: "물가 생물의 약점을 전투 중에 확인해 적어 두었다.",
    defeated: "옛 별지기들이 별을 비추려고 끌었던 물길에 어느새 야생이 들어찼다.",
  },
  {
    id: "fs_b_forest_misc", name: "숲 멧돼지 · 말벌 · 사마귀 · 잎새 정령", enemies: ["enemy_fs_boar", "enemy_fs_hornet", "enemy_fs_mantis", "enemy_fs_moss", "enemy_fs_moth", "enemy_fs_bandit"],
    seen: "속삭이는 숲 깊은 곳을 지키는 야생 짐승과 산적들. 무리마다 공격 박자가 제각각이다.",
    weakness: "직접 맞혀 본 속성과 상태이상 반응이 수첩에 정리됐다.",
    defeated: "숲지기 브람 말대로 길 밖으로 샐수록 더 거친 놈들이 나온다.",
  },
  {
    id: "fs_b_fanatic", name: "성등 교단 광신도 · 설교자", enemies: ["enemy_fs_fanatic", "enemy_fs_fanatic_preacher", "enemy_fs_inq_priest", "enemy_fs_inq_flagellant"],
    seen: "두건을 눌러쓰고 지하 회랑을 먼저 점거한 교단 신도들. 기도를 모으는 설교자를 내버려 두면 판이 꼬인다.",
    weakness: "기도나 주문을 모을 때 끊어 내는 수단과 상성을 기록했다.",
    defeated: "하늘에서 온 것을 죄라 부르면서도, 정작 옛 별지기의 방을 제일 먼저 뒤지고 있었다.",
  },
  {
    id: "fs_b_inq_troops", name: "심문회 병사 · 방패병 · 쇠뇌병", enemies: ["enemy_fs_inq_shield", "enemy_fs_inq_crossbow", "enemy_fs_inq_handler", "enemy_fs_inq_hound", "enemy_fs_inq_penitent", "enemy_fs_inq_spy"],
    seen: "발렌 휘하의 정예 지하반. 방패병이 앞을 막고 쇠뇌병이 뒤에서 노리는 진형을 쓴다.",
    weakness: "방패 벽과 원거리 조준을 깨뜨리는 상성을 전투에서 확인했다.",
    defeated: "교단의 병사들도 누군가의 아들이고 이웃이다. 다만 명령이 무서울 뿐.",
  },
  {
    id: "fs_b_valen", name: "심문관 발렌", enemies: ["enemy_fs_valen", "enemy_fs_valen_crash"],
    seen: "성등 교단 심문회의 책임자. 왼손 장갑 아래로 쇳소리와 톱니가 숨겨져 있다.",
    weakness: "호흡을 고르며 큰 빛을 모을 때 틈이 생긴다. 맞혀 본 상성이 기록됐다.",
    defeated: "그가 두려워하는 건 하늘의 괴물이 아니라, 서른 해 전 다시 불탈지 모르는 마을이었다.",
  },
  {
    id: "fs_b_dragon", name: "달빛의 용", enemies: ["enemy_fs_moon_dragon"],
    seen: "천문대 지하 최하층 단말을 지키는 옛 문지기. 푸른 비늘이 웬만한 주문은 통째로 튕겨 낸다.",
    weakness: "단단한 비늘 틈을 갈라 관통상을 남겼을 때의 반응을 적어 두었다.",
    defeated: "그 용은 침입자를 막은 게 아니라, 준비되지 않은 대답이 하늘에 닿지 않게 지키고 있었는지도 모른다.",
  },
  {
    id: "fs_b_well_beast", name: "우물 밑 눈먼 영주", enemies: ["enemy_fs2_well_beast"],
    seen: "왕도 옛 상수도 저수조에 웅크린 거대한 동굴 도롱뇽. 눈은 퇴화했지만 소리와 물결에 귀신같이 반응한다.",
    weakness: "젖은 아가미를 부풀려 노래를 모을 때와 비늘을 세울 때의 반응을 기록했다.",
    defeated: "서늘한 어둠 속에서 오래 살아남은 주인. 아가미 조각에서 아직도 맑은 울림이 난다.",
  },
  {
    id: "fs_b_ash", name: "재의 들판 마물 (까마귀 · 뱀 · 도깨비 · 들개)", enemies: ["enemy_fs2_ash_crow", "enemy_fs2_ash_snake", "enemy_fs2_ash_wisp", "enemy_fs2_starved_dog"],
    seen: "서른 해 전 타 버린 새벽샘 남쪽을 떠도는 짐승들. 깃털과 비늘마다 아직 식지 않은 재가 묻어 있다.",
    weakness: "재와 불기운에 익숙한 놈들이다. 통하는 속성을 확인해 적어 두었다.",
    defeated: "잿불 핵을 남기고 스러진다. 공방에서 화염·회복 비약의 재료로 쓸 수 있다.",
  },
  {
    id: "fs_b_fort", name: "북방 관문 수비대", enemies: ["enemy_fs2_watchman", "enemy_fs2_fort_knight", "enemy_fs2_fort_crossbow", "enemy_fs2_fort_dog"],
    seen: "통금 왕도와 북방 관문을 지키는 심문회 정규군. 시야가 넓고 들키면 바로 달려든다.",
    weakness: "갑옷과 창병 진형을 뚫는 상성을 전투에서 파악했다.",
    defeated: "새라의 부하들이었다. 명령 때문에 막아섰을 뿐, 눈빛엔 피로가 깊다.",
  },
  {
    id: "fs_b_sarah", name: "창기사 새라", enemies: ["enemy_fs2_sarah"],
    seen: "북방 관문 성벽 위를 홀로 지키는 붉은 창기사. 대장장이 로한의 딸이자 발렌의 부관.",
    weakness: "긴 창을 휘두르는 기세와 빈틈을 맞대며 파악했다.",
    defeated: "칼이 아니라 진심으로 부딪힌 뒤, 이제는 등을 맡길 수 있는 든든한 동료가 됐다.",
  },
  {
    id: "fs_b_frost", name: "설원 짐승 (서리늑대 · 서리박쥐 · 서리예티)", enemies: ["enemy_fs2_frost_wolf", "enemy_fs2_frost_bat", "enemy_fs2_frost_yeti"],
    seen: "서리 가도와 얼음 호수의 눈보라 속에서 사냥하는 북방 야수들. 추위에 단련되어 있다.",
    weakness: "눈보라 속 짐승들에게 통하는 속성과 약점을 기록했다.",
    defeated: "서리 결정을 떨군다. 추위를 이기는 비약과 냉기 병의 핵심 재료다.",
  },
  {
    id: "fs_b_tower", name: "하늘탑 파수 기계 · 수정거미 · 회로뱀 · 빛나방", enemies: ["enemy_fs2_tower_sentinel", "enemy_fs2_crystal_spider", "enemy_fs2_circuit_snake", "enemy_fs2_light_moth"],
    seen: "옛 별지기들이 남긴 하늘탑의 경비 장치와 탑에 깃든 생물들. 심문회 기사마저 가리지 않고 쳐 낸다.",
    weakness: "기계 외피와 회로의 약점을 시험해 수첩에 남겼다.",
    defeated: "고대 회로를 회수했다. 삼백 년 된 장치들이 아직도 누군가의 대답을 기다리며 돌아가고 있었다.",
  },
  {
    id: "fs_b_collector", name: "재의 회수자", enemies: ["enemy_fs2_ash_collector", "enemy_fs2_collector_eye_grab", "enemy_fs2_collector_eye_burn", "enemy_fs2_swallowed_fire"],
    seen: "거부 신호와 정착 확인이 충돌하자 탑 깊은 곳에서 깨어난 회수 기구. 두 눈이 살아 있으면 불을 거두고 태운다.",
    weakness: "불을 삼키는 몸체와 두 눈, 모으는 회수를 끊는 법을 전투 끝에 알아냈다.",
    defeated: "서른 해 묵은 재가 마침내 가라앉았다. 빌린 불을 거두려던 기계도 결국 멈췄다.",
  },
];

function applyBestiary(project: Project): void {
  const existingIds = new Set(project.database.enemies.map((e) => e.id));
  const entries: BestiaryEntry[] = [];
  for (const spec of BESTIARY_SPECS) {
    // 같은 이름의 분할/우두머리 변종(_t_, _elite)까지 함께 묶어 기록이 누락되지 않게 한다.
    const matched = new Set<string>();
    for (const baseId of spec.enemies) {
      if (existingIds.has(baseId)) matched.add(baseId);
      for (const e of project.database.enemies) {
        if (e.id.startsWith(`${baseId}_t_`) || e.id.startsWith(`${baseId}_elite`)) matched.add(e.id);
      }
    }
    if (matched.size === 0) continue;
    entries.push({
      id: spec.id,
      name: spec.name,
      enemyIds: [...matched],
      sections: [
        { id: "seen", title: "현장 관찰", text: spec.seen, unlock: "seen" },
        { id: "weakness", title: "상성 기록", text: spec.weakness, unlock: "weakness" },
        { id: "defeated", title: "토벌 메모", text: spec.defeated, unlock: "defeated" },
      ],
    });
  }
  const normalized = normalizeBestiary({ enabled: true, title: "관찰 수첩", entries });
  if (normalized) project.system.bestiary = normalized;
}

export function applyFallenCombatOverhaul(project: Project, exec: Exec): void {
  applyFourHeroLoops(project, exec);
  applyFormationAndEscape(project);
  applyBestiary(project);
}
