import type { BattleAnimationRecord, ProjectDatabaseRecords, ProjectSession, SystemRecords, Terms, TitleScreenSettings } from "../types";
import { STARTER_BATTLE_BGM_ID, STARTER_DEFAULT_BGM_ID } from "@/assets/bgmStarterTracks";
import { defaultBattleRecords } from "./defaultDatabaseBattleRecords";
import { defaultPartyRecords, defaultStarterActorIds } from "./defaultDatabasePartyRecords";
import {
  defaultBattleAnimationRecords,
  defaultSkillRecords,
  defaultStateRecords,
} from "./defaultDatabaseStarterRecords";
import { defaultItemRecords } from "./defaultDatabaseItemRecords";
import {
  defaultBattleCommandRecords,
  defaultElementRecords,
  defaultTerrainRecords,
} from "./defaultDatabaseUtilityRecords";
import { DEFAULT_TROOP_ID } from "./constants";
import { rosterClassIds } from "./retroRosterRecords";
import { appendRetroRosterDependencies, type RetroRosterDatabase } from "./retroRosterDependencies";
import {
  CLASS_BARD_ID,
  CLASS_DRUID_ID,
  CLASS_MONK_ID,
  CLASS_NINJA_ID,
  CLASS_SAMURAI_ID,
  CLASS_WITCH_ID,
} from "./defaultDatabaseRecordIds";

/**
 * 번들 전투 애니메이션 수렴. `ensureBundledResourceProfiles` 와 같은 계열이다.
 *
 * 왜 필요한가(실측 2026-08-28): 생성 이펙트 팩 도입 전에 저장된 프로젝트와 마을 데모
 * 픽스처는 `battleAnimations` 가 12개짜리 옛 스냅샷이라 `anim_gen_*` 이 하나도 없다.
 * 그런데 `generatedBattleEffectBindings` 는 스타터 아이템·스킬을 그 id 로 묶어 두었다 —
 * 참조가 통째로 끊겨 `collectProjectReferenceIssues` 가 18건을 뱉는다. 지금은 그것이
 * ▶테스트를 막지는 않지만(게이트 제거), 재생 시 애니메이션이 통째로 빠진다.
 *
 * 같은 id 가 이미 있으면 저자가 손댔을 수 있으므로 건드리지 않고 빠진 것만 채운다.
 */
export function ensureBundledBattleAnimations(project: {
  database: { battleAnimations: BattleAnimationRecord[] };
}): boolean {
  const existingIds = new Set(project.database.battleAnimations.map((record) => record.id));
  let changed = false;
  for (const record of defaultBattleAnimationRecords()) {
    if (existingIds.has(record.id)) continue;
    project.database.battleAnimations.push(record);
    existingIds.add(record.id);
    changed = true;
  }
  return changed;
}

/** 2차 로스터 기믹 상태 8종 + 반응·표적 상태 7종(defaultDatabaseStarterRecords.ts 「기믹 상태」·「반응·표적 상태」 블록). */
const RETRO_GIMMICK_STATE_IDS: readonly string[] = [
  "state_blind", "state_stop", "state_protect", "state_shell",
  "state_berserk", "state_petrify", "state_wet", "state_oiled",
  "state_counter", "state_taunt", "state_cover", "state_evade", "state_reflect", "state_reraise", "state_doom", "state_form_stone",
];
const RETRO_EXTENSION_CLASS_IDS: readonly string[] = [
  CLASS_SAMURAI_ID, CLASS_NINJA_ID, CLASS_MONK_ID, CLASS_BARD_ID, CLASS_DRUID_ID, CLASS_WITCH_ID,
];

/**
 * retro2003 로스터 수렴. `ensureBundledBattleAnimations` 와 같은 계열이다.
 *
 * 왜 필요한가: 로스터(확장 직업 6 + 2차 직업·예비 배우·스킬)와 기믹 상태 8종은 기본 DB 생성기에만 들어 있어,
 * 그 전에 저장된 프로젝트는 발키리·암흑기사 같은 직업이 직업 목록에 없고 기술 참조가 끊긴다.
 *
 * 빠진 직업·예비 배우·스킬·기믹 상태와 새 레코드의 참조 의존성을 id 로 덧붙인다. 같은 id 가 이미 있으면 저자가 손댔을 수
 * 있으므로 건드리지 않는다. 시작 파티(system.startActorIds)·battleUiStyle·저자 레코드는 바꾸지 않는다.
 */
export function ensureRetroRosterRecords(project: {
  database: RetroRosterDatabase;
}): boolean {
  const db = project.database;
  const wantedClassIds = new Set<string>([...RETRO_EXTENSION_CLASS_IDS, ...rosterClassIds()]);
  const party = defaultPartyRecords();
  const skills = defaultSkillRecords();
  const commonMotionIds=new Set(db.skills.map(r=>r.id));
  const missingMotions=skills.filter(r=>r.id.startsWith("skill_motion_")&&!commonMotionIds.has(r.id));
  db.skills.push(...missingMotions);
  const states = defaultStateRecords();
  const added: Parameters<typeof appendRetroRosterDependencies>[2] = [];
  let changed = missingMotions.length>0;
  const classIds = new Set(db.classes.map((record) => record.id));
  for (const record of party.classes) {
    if (!wantedClassIds.has(record.id) || classIds.has(record.id)) continue;
    db.classes.push(record);
    added.push({ kind: "classes", record });
    classIds.add(record.id);
    changed = true;
  }
  const actorIds = new Set(db.actors.map((record) => record.id));
  for (const record of party.actors) {
    if (!wantedClassIds.has(record.classId) || actorIds.has(record.id)) continue;
    db.actors.push(record);
    added.push({ kind: "actors", record });
    actorIds.add(record.id);
    changed = true;
  }
  const wantedSkillIds = new Set<string>();
  for (const record of party.classes) {
    if (!wantedClassIds.has(record.id)) continue;
    for (const skillId of record.skillIds) wantedSkillIds.add(skillId);
  }
  const skillIds = new Set(db.skills.map((record) => record.id));
  for (const record of skills) {
    if (!wantedSkillIds.has(record.id) || skillIds.has(record.id)) continue;
    db.skills.push(record);
    added.push({ kind: "skills", record });
    skillIds.add(record.id);
    changed = true;
  }
  const stateIds = new Set(db.states.map((record) => record.id));
  for (const record of states) {
    if (!RETRO_GIMMICK_STATE_IDS.includes(record.id) || stateIds.has(record.id)) continue;
    db.states.push(record);
    added.push({ kind: "states", record });
    stateIds.add(record.id);
    changed = true;
  }
  if (added.length === 0) return changed;
  return appendRetroRosterDependencies(db, {
    actors: party.actors, classes: party.classes, equipment: party.equipment,
    skills, states,
    battleAnimations: defaultBattleAnimationRecords(), elements: defaultElementRecords(),
  }, added) || changed;
}

export function defaultTerms(): Required<Terms> {
  return {
    attack: "공격",
    skill: "스킬",
    item: "아이템",
    capture: "포획",
    defend: "방어",
    escape: "도주",
    back: "뒤로",
    target: "대상",
    shopGreeting: "어서 오세요.",
    shopBuy: "구입",
    shopSell: "판매",
    shopCancel: "취소",
    shopSellPrompt: "무엇을 판매하시겠습니까?",
    innTitle: "여관",
    yes: "예",
    no: "아니오",
    notEnoughGold: "소지금이 부족합니다.",
    gold: "G",
    goldPrefix: "돈 ",
    level: "레벨",
    hp: "HP",
    mp: "MP",
  };
}

export function defaultDatabase(): ProjectDatabaseRecords {
  const party = defaultPartyRecords();
  const battle = defaultBattleRecords();

  return {
    actors: party.actors,
    classes: party.classes,
    skills: defaultSkillRecords(),
    items: defaultItemRecords(),
    equipment: party.equipment,
    enemies: battle.enemies,
    troops: battle.troops,
    states: defaultStateRecords(),
    battleAnimations: defaultBattleAnimationRecords(),
    elements: defaultElementRecords(),
    terrains: defaultTerrainRecords(),
    battleCommands: defaultBattleCommandRecords(),
    monsterSpecies: battle.monsterSpecies,
    // 농사는 옵트인 시스템이다 — 빈 프로젝트는 작물을 싣지 않는다(systemOptInLint 계약).
    crops: [],
    lifeSkills: [],
  };
}

/** 옛 v1/v2 문서 이관도 이 함수를 쓴다. 새 프로젝트 호출자만 새 스킨을 명시한다. */
export function defaultSystem(newProject = false): SystemRecords {
  return {
    startActorIds: defaultStarterActorIds(),
    titleResourceId: "oprn-title-field",
    // CSS-ready 9-slice windowskin. EasyRPG System/*.png is a chrome sheet (orange key + icons), not a windowskin.
    systemResourceId: "windowskin-warm",
    // System2 stays as gauge/number chrome only — never used as border-image fill.
    battleSystemResourceId: "easyrpg-system2-system2-c",
    // EasyRPG RTP 음악 30곡은 전부 .mid 다 — 브라우저 HTMLAudioElement 는 MIDI 를 재생하지 못한다.
    // 그래서 easyrpg-music-* 을 기본값으로 두면 게임이 무음으로 돌아간다(실측). CC0 mp3/ogg 를 쓴다.
    //
    // 기본 BGM 세트는 281곡 CC0 카탈로그(bgmCatalog.ts)에서 고른다. 이 두 슬롯이 쓰는 곡은
    // CDN 미설정 환경에서도 들려야 하므로 레포에 함께 커밋된 스타터 곡이다(bgmStarterTracks.ts).
    battleBgmResourceId: STARTER_BATTLE_BGM_ID,
    defaultBgmResourceId: STARTER_DEFAULT_BGM_ID,
    initialTroopId: DEFAULT_TROOP_ID,
    battleFlow: "gauge",
    ...(newProject ? { battleUiStyle: "retro2003" as const } : {}),
    typeChart: {
      types: ["fire", "water", "grass"],
      multipliers: {
        fire: { fire: 0.5, water: 0.5, grass: 2 },
        water: { fire: 2, water: 0.5, grass: 0.5 },
        grass: { fire: 0.5, water: 2, grass: 0.5 },
      },
    },
    titleScreen: defaultTitleScreenSettings(),
  };
}

export function defaultTitleScreenSettings(): TitleScreenSettings {
  return {
    title: "새 프로젝트",
    backgroundResourceId: "oprn-title-field",
    // 타이틀 BGM 은 의도적으로 비워 둔다("silent title" — test/titleScreenMusic.test.ts 가 계약으로 못박음).
    // 카탈로그에 타이틀·메뉴 곡이 있으므로 저작자는 피커에서 한 번에 고르면 된다.
    // 후보: cc0-bgm-rtp-ttl-001(새벽의 의뢰서), cc0-bgm-rtp-uix-001..005(UI · 첫 조작).
    layout: {
      titleX: 32,
      titleY: 48,
      menuX: 34,
      menuY: 128,
    },
    menuLabels: {
      newGame: "새 게임",
      // "이어하기"가 아니라 "불러오기" — 이 항목은 저장 슬롯 패널을 열고, 그 패널 제목이 "불러오기"다.
      // 오토세이브 즉시 재개(resume)가 "이어하기"를 쓰므로, 여기서 겹치면 오토세이브가 생긴 뒤
      // 타이틀에 같은 글자가 두 줄 뜬다. test/titleScreenMenuLabels.test.ts 가 계약으로 못박음.
      continueGame: "불러오기",
      quit: "종료",
    },
    menuVisibility: {
      newGame: true,
      continueGame: true,
      quit: true,
    },
    showInputHint: true,
  };
}

export function defaultSession(): ProjectSession {
  return {
    switches: {},
    variables: {},
    inventory: {},
    partyActorIds: defaultStarterActorIds(),
  };
}
