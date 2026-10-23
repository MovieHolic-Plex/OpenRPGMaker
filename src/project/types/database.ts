import type { CharacterMotionSettings, CharacterMotionStyle } from "@/battle/characterMotion";
import type {
  ActorId,
  BattleAnimationId,
  CharacterFootprint,
  ClassId,
  CropId,
  Dir,
  EnemyId,
  EquipmentId,
  ItemId,
  MapId,
  MonsterSpeciesId,
  SkillId,
  StateId,
  TroopId,
} from "./base";
import type { RetroFxAnchor, RetroSkillMotion } from "@/assets/retroClassSkills";
import type { RetroMonsterSkillMotion } from "@/assets/retroMonsterSkills";
import type { PokemonMoveMotion } from "@/battle/pokemonMoveMotion";
import type { Command, Condition, EventPageGraphic, WeatherKind } from "./events";
import type { Season, TimePhase, TimeSystemConfig } from "../gameTime";
import type { GenrePackId } from "../genrePackId";
import type { CinematicSequence, GameOverSettings } from "../cinematicSettings";

export interface CharacterAppearanceRecord {
  id: string;
  name: string;
  description: string;
  charset?: { resourceId: string; characterIndex: number };
  face?: { resourceId: string };
  bust?: { resourceId: string };
  /** 대사 창 뒤에 크게 서는 전신(선택). 없으면 흉상, 그것도 없으면 얼굴. */
  full?: { resourceId: string };
  /**
   * 표정별 흉상·전신(선택, 업로드·스토어 그림). 키는 공용 초상 표정 이름(base, happy, sad …).
   * 대사 표정이 바뀌면 지금 서 있는 그림(bust/full 의 base 또는 다른 표정)이 같은 모양의 그 표정으로 바뀐다.
   * 스토어 캐릭터 팩(char-gen)의 칩↔초상 짝이 이리로 들어온다(2026-10-20).
   */
  portraitExpressions?: {
    bust?: Partial<Record<string, string>>;
    full?: Partial<Record<string, string>>;
  };
}

export interface ActorRecord {
  /** Optional overrides over the bundled class/body motion. */
  battleMotion?: CharacterMotionSettings;
  id: ActorId;
  name: string;
  nickname: string;
  classId: ClassId;
  initialLevel: number;
  maxLevel: number;
  /** 낱장 얼굴 리소스 id(예: easyrpg-faceset-actor1-07). 시트+칸 짝은 v4 마이그레이션이 없앴다. */
  faceResourceId?: string;
  characterResourceId?: string;
  /** Optional charset character index (0..7). Omitted means 0 for legacy projects. */
  characterIndex?: number;
  appearanceId?: string;
  characterTransparent: boolean;
  battleCharacterResourceId?: string;
  critical: ActorCritical;
  parameterCurves: ActorParameterCurves;
  expCurve: ActorExperienceCurve;
  initialEquipment: ActorInitialEquipment;
  unarmedAnimationId?: BattleAnimationId;
  options: ActorOptions;
  learnedSkills: ActorLearnedSkill[];
  stateRates: Record<string, ActorRateGrade>;
  elementRates: Record<string, ActorRateGrade>;
  /**
   * 스킬 장착 칸 수(1~12). 있으면 전투에서는 **장착한 스킬만** 쓸 수 있고, 메뉴 스킬 화면에서 장착을 바꾼다.
   * 생략 = 장착 개념 없음(배운 스킬 전부 사용, 기존 동작).
   */
  loadoutSlots?: number;
  /**
   * 이 배우만의 전투 명령(전역 전투 명령 목록 database.battleCommands 의 id, 메뉴 순서대로). RM2003 의 배우별 명령.
   * 생략·빈 배열 = 직업의 전투 명령을 쓴다. 전투 중 이벤트로 바꾼 명령(eventState.actorBattleCommands)이 이보다 앞선다.
   */
  battleCommandIds?: string[];
}

export type ActorRateGrade = "A" | "B" | "C" | "D" | "E";

export type ActorParameterKey = "maxHp" | "maxMp" | "attack" | "defense" | "mind" | "agility";

export type ActorParameterCurves = Record<ActorParameterKey, number[]>;

export interface ActorCritical {
  enabled: boolean;
  chanceDenominator: number;
}

export interface ActorExperienceCurve {
  base: number;
  extra: number;
  acceleration: number;
}

/** Slot IDs reference the project catalog, including the five legacy built-ins. */
export type ActorInitialEquipment = Partial<Record<string, EquipmentId>>;

export interface EquipmentSlotRecord {
  id: string;
  label: string;
  /**
   * 이 칸에는 `equipsAs` 부위로 만든 장비도 들어간다(FF6 유물 2칸: relic_2.equipsAs = "relic" 이면 slot:"relic" 장비가
   * relic·relic_2 어느 칸에든 낀다). 칸 id 로 만든 장비는 물론 들어간다. 생략 = 자기 부위 장비만.
   */
  equipsAs?: string;
}

export interface ActorOptions {
  dualWield: boolean;
  autoBattle: boolean;
  fixedEquipment: boolean;
  mightyGuard: boolean;
  /** autoBattle 인 배우의 작전. 생략 = 균형(기존 자동 전투 AI). followOrders 면 자동 전투여도 명령을 직접 받는다. */
  autoTactic?: ActorAutoTactic;
}

/** 배우별 자동 전투 작전: 전원 공격 · 회복 우선 · MP 아끼기 · 명령 따르기(수동). */
export type ActorAutoTactic = "attackAll" | "healFirst" | "conserveMp" | "followOrders";

export interface ActorLearnedSkill {
  level: number;
  skillId: SkillId;
  /** 기술 포인트(TP) 습득 문턱. 있으면 레벨만으로는 배우지 않고, 누적 TP 와 레벨을 모두 채운 승리 뒤에 배운다(배우 전용). */
  tp?: number;
}

export interface ClassRecord {
  id: ClassId;
  name: string;
  options: ClassOptions;
  animationId?: BattleAnimationId;
  skillIds: SkillId[];
  battleCommands: ClassBattleCommand[];
  learnedSkills: ActorLearnedSkill[];
  promotions?: ClassPromotion[];
  equipmentPermissions: ClassEquipmentPermissions;
  parameterCurves: ActorParameterCurves;
  expCurve: ActorExperienceCurve;
  stateRates: Record<string, ActorRateGrade>;
  elementRates: Record<string, ActorRateGrade>;
}

export interface ClassPromotion {
  toClassId: ClassId;
  requires: ClassPromotionRequirement;
}

export interface ClassPromotionRequirement {
  requiredSkillIds?: SkillId[];
  requiredNodes?: import('../growth/types').NodeRankRequirement[];
  requiredTreePoints?: { treeId: string; points: number }[];
  level?: number;
  switchId?: string;
  itemId?: ItemId;
  variableId?: string;
  atLeast?: number;
}

export interface ClassOptions {
  dualWield: boolean;
  autoBattle: boolean;
  fixedEquipment: boolean;
  mightyGuard: boolean;
}

export type BattleFlow = "gauge" | "strict";

/**
 * FF6 식 팀 교대 전투(2026-10-15). 팀 = 교대 묶음 — 한 번에 한 팀만 싸우고 나머지는 대기한다.
 * free = 들어온 팀 게이지가 가득(바로 행동) · gauge = 게이지 0 에서 시작(기본) · turn = 적이 한 번 행동할 때까지 쉼.
 */
export type TeamSwapCost = "free" | "gauge" | "turn";

/** 저작된 전투 팀. 구성원은 전투 파티에 있는 배우만 쓰인다. */
export interface BattleTeamRecord {
  id: string;
  name: string;
  actorIds: ActorId[];
}
/** ATB 대기 방식(Chrono Trigger 설정의 Active/Wait). 생략 = wait — 명령·대상 메뉴가 열려 있는 동안 시간이 멈춘다. */
export type BattleAtbMode = "active" | "wait";

/** 전투 화면 UI 스킨 — @/battle/skins/registry 의 BattleSkinId(도트 측면 retro2003 + pokemon).
 *  2026-10-02 정면 스킨(rm2000·dragonquest·mother·mv·vxace·classic)과 창 색만 다르던 측면 스킨
 *  (rm2003·octopath·chrono·bravely·ff·goldensun)을 지웠다. 저장된 옛 값은 로드 때 normalizeSystem 이 지우고
 *  (→ 기본 retro2003, 창 색은 battleLook.window 로), 렌더 때도 resolveSkinId 가 retro2003 으로 푼다. */
export type BattleUiStyle =
  | "pokemon"
  | "retro2003"; // 도트 측면 전투(기본): 청색 픽셀 창 · 겹 배경 · 전진 걸음 연출

/** ESC(X) 게임 메뉴 스킨 — @/player/menuSkins/registry 의 id union. 프로젝트 파일에 저장되므로
 *  id 를 함부로 바꾸지 않는다. 미설정·미지값은 resolveMenuSkinId 가 workbench 로 푼다. */
export type MenuUiStyle = "pixel" | "field-list" | "workbench" | "party-first" | "party-first-warm" | "hub" | "sheet" | "classic" | "journal" | "ribbon" | "retro-2000" | "retro-2003" | "classic-xp" | "classic-vx";

/** 전투 아군측 배틀러 소스 — actors: 파티 액터가 직접 싸움(기본),
 *  monsters: 잡은 파티 몬스터가 필드에 나서 싸움(포켓몬식). */
export type BattleParty = "actors" | "monsters";

/** "event" 는 옛 저장값으로 교체(switch)의 별칭이다. 공통 이벤트를 부르는 명령은 "commonEvent"(RM2003 「이벤트 연결」, 2026-10-02). */
export type ClassBattleCommandKind = "attack" | "skill" | "skillSubset" | "defend" | "guard" | "item" | "capture" | "escape" | "switch" | "event" | "commonEvent";

export interface ClassBattleCommand {
  id: string;
  name: string;
  kind: ClassBattleCommandKind;
  skillSubsetName?: string;
  skillId?: SkillId;
  /** kind "commonEvent" 일 때 고르면 실행할 공통 이벤트. 없으면 그 명령은 메뉴에 나오지 않는다. */
  commonEventId?: string;
}

export type DatabaseElementKind = "physical" | "magical";

export interface DatabaseElementRecord {
  id: string;
  name: string;
  /** 속성 종류. "magical" 인 경우 데미지 감소를 mind(마법 방어력) 로 라우팅 (B2 wiring).
   *  physical 이면 defense(물리 방어력) 사용. runtime.elementMultiplierFor / isMagicalElement /
   *  predictSkillDamage 가 소비한다. */
  kind: DatabaseElementKind;
  /** @reserved 미사용. 등급 라벨은 A–E 하드코딩으로 동작하며, 편집 UI 도 없음(B3).
   *  스키마 호환을 위해 유지·정규화만 수행. */
  rateLabels: ActorRateGrade[];
  damageMultipliers: Record<ActorRateGrade, number>;
}

export type DatabaseTerrainCharacterDisplay = "normal" | "transparent";

export interface DatabaseTerrainVehiclePassage {
  boat: boolean;
  ship: boolean;
  airshipLand: boolean;
  /** 초코보(걷는 탈것): 걸을 수 없는 칸(숲 등)도 지난다. 없으면 false. (2026-10-15) */
  chocobo?: boolean;
  /** 광산 수레: 이 칸(레일)만 다닌다. 없으면 false. */
  cart?: boolean;
  /** 뗏목: 강·얕은 물만 다닌다(바다는 안 됨). 없으면 false. */
  raft?: boolean;
}

export interface DatabaseTerrainRecord {
  id: string;
  name: string;
  damage: number;
  encounterRatePercent: number;
  battleBackgroundResourceId?: string;
  footstepSoundResourceId?: string;
  characterDisplay: DatabaseTerrainCharacterDisplay;
  vehiclePassage: DatabaseTerrainVehiclePassage;
  /** 옆보기 맵(GameMap.sideView)에서 사다리·밧줄처럼 오를 수 있는 칸. 없으면 false. */
  climbable?: boolean;
}

export interface DatabaseBattleCommandRecord {
  id: string;
  name: string;
  kind: ClassBattleCommandKind;
  skillSubsetName?: string;
  skillId?: SkillId;
  /** kind "commonEvent" 일 때 실행할 공통 이벤트. */
  commonEventId?: string;
}

export interface ClassEquipmentPermissions {
  actorIds: ActorId[];
  classIds: ClassId[];
  equipmentIds: EquipmentId[];
}

export interface SkillRecord {
  /** Native turn battle gimmick. Omitted keeps the original skill rules. */
  battleGimmick?: import("@/battle/battleGimmickRules").BattleGimmick;
  id: SkillId;
  name: string;
  scope: "self" | "ally" | "allAllies" | "enemy" | "allEnemies";
  power: number;
  animationId?: BattleAnimationId;
  description: string;
  type: "normal" | "teleport" | "escape" | "switch";
  /**
   * 필드 능력(명작 공백 #5, 2026-09-27): 메뉴 스킬 목록에서 쓰면 MP 를 내고 이 공통 이벤트를 실행한다.
   * 실행 전에 주인공 정면 칸의 이벤트 id 를 문자열 변수 `fieldAbilityTarget` 에, 정면 좌표를 변수
   * `fieldAbilityX`·`fieldAbilityY` 에 적는다(황금의 태양 Move·포켓몬 비전머신·OMORI 리더 능력).
   */
  fieldCommonEventId?: string;
  /**
   * 잊을 수 없는 기술(포켓몬 비전머신 HM): 몬스터가 새 기술을 배우려고 칸이 모자랄 때 이 기술은 교체 후보에서 빠진다.
   * 생략 = 잊을 수 있다(기존 동작). 배우 기술에는 영향이 없다.
   */
  unforgettable?: boolean;
  mpCost: SkillMpCost;
  successRate: number;
  variance: number;
  hitRate: number;
  /** Optional authored base damage. Arithmetic only; invalid formulas use the legacy formula. */
  damageFormula?: string;
  criticalRate?: number;
  criticalMultiplier?: number;
  /** Number of subsequent full battle rounds during which this skill is unavailable. */
  cooldownTurns?: number;
  /**
   * 전투당 1회(FF6 소환 마법): 한 전투에서 시전자가 한 번 쓰면 그 전투가 끝날 때까지 다시 쓸 수 없다.
   * cooldownTurns 99 로 근사하던 것을 대신한다(쿨다운은 라운드가 지나면 풀리지만 이것은 풀리지 않는다). 생략 = 제한 없음.
   */
  oncePerBattle?: boolean;
  /** Ordered damage/healing multipliers, one per hit. Omitted means one hit. */
  hitSequence?: number[];
  effect: SkillEffect;
  // 속성 ID. DatabaseElementRecord.id 와 매칭. 없으면 비속성(상성 배율 1.0).
  elementId?: string;
  // 상태이상 부여/해제 효과. 명중 시(데미지 효과) 또는 즉시(서포트/힐) 적용.
  // 각 항목의 chance(0~100)로 부여 확률을 굴리고, operation 으로 부여/해제를 결정한다.
  stateEffects?: DatabaseStateEffect[];
  /**
   * 능력치 단계(포켓몬식 −6~+6) 변화: 명중하면 대상(또는 시전자)의 단계를 올리거나 내린다 — 울음 −1 공격, 칼춤 +2 공격.
   * 전투 한 번 동안만 유지되고 교체하면 사라진다. 생략 = 단계 효과 없음(기존 프로젝트는 저장 바이트 그대로).
   */
  statStageEffects?: SkillStatStageEffect[];
  /**
   * 날씨: 이 기술이 명중하면 전투 날씨를 바꾼다(포켓몬식 쾌청·비·모래바람·싸라기눈). 몇 차례 동안 같은 타입 기술의 피해를 키우거나 줄이고,
   * 모래바람·싸라기눈은 차례 말 피해를 준다. 전투 한 번 동안만 유지(저장 안 함). gen1 전투 모델만. 생략 = 날씨 없음(기존 프로젝트는 저장 바이트 그대로).
   */
  weather?: SkillWeather;
  /** Gen1 move PP cap. Omitted for legacy projects that have not opted into per-move PP yet. */
  maxPp?: number;
  /** Gen1's high-critical move class. Omission is the legacy-compatible normal class. */
  gen1CriticalRate?: "normal" | "high";
  /**
   * 기술 우선도(-7~+7, 기본 0). strict 턴제에서 속도보다 먼저 비교한다 — 퀵어택(+1)류.
   * 이름이 movePriority 인 이유: EnemyActionPattern.priority(적 AI 행동 선택 가중치),
   * StateRecord.priority(상태 표시 우선순위)와 전혀 다른 개념이라 혼동을 차단한다.
   */
  movePriority?: number;
  /** 실시간 액션 전투에서 캐스트 가능한 액션 스킬. 생략 시 턴제 전용. */
  actionSkill?: ActionSkillProfile;
  /** 연계기(듀얼·트리플 테크): 함께 쓰는 배우 2~3명(시전자 포함). 모두 준비돼야 쓸 수 있고 각자 MP·턴을 소비한다. */
  comboActorIds?: ActorId[];
  /**
   * 연계기 해금 조건(크로노 트리거식): 각 항목의 배우가 그 기술을 **배운 상태**여야 연계기가 메뉴에 열린다
   * (예: 개구리가 「베기」, 마법사가 「불꽃」을 알아야 합체기). 비우면 조건 없음(comboActorIds 만 맞으면 열림).
   */
  comboRequires?: { actorId: ActorId; skillId: SkillId }[];
  /** true 면 피해·치유 계산의 공격력·마력이 연계 참가자 전원의 합이다(시전자 한 명의 능력치가 아니라). 기술 위력은 그에 맞춰 낮게 잡는다. */
  comboCombinedStats?: boolean;
  /** 연계기가 발동할 때 켜지는 스위치(전투 이벤트 페이지 조건·전투 뒤 이야기 분기에 쓴다). */
  comboSwitchId?: string;
  /** 위치 범위기: 단일 대상 스코프에서 주 대상 둘레의 같은 편도 함께 맞힌다(전투장 픽셀). */
  area?: SkillArea;
  /**
   * 제2 자원 「기력」 소모량(0~100). system.resource2.enabled 일 때만 본다.
   * 이름이 tp 가 아닌 이유: 기존 TP 는 기술 습득 포인트(rewards.tp)라 뜻이 겹친다.
   */
  resource2Cost?: number;
  /** 리미트 기술: 리미트 게이지가 가득 찼을 때만 쓸 수 있고 쓰면 게이지를 비운다(system.limitGauge.enabled). */
  limitSkill?: boolean;
  /** 추격 연계기: 파티 공용 게이지를 이만큼 쓴다(system.partyGauge.enabled). */
  partyGaugeCost?: number;
  /** 청마법: 적이 이 기술로 배우를 맞히면(또는 learnEnemySkill 로 훔쳐보면) 배울 수 있다. */
  learnable?: boolean;
  /** 입력 커맨드: 성공/실패에 따라 위력이 달라진다. 생략 = 입력 없음. */
  inputSequence?: SkillInputSequence;
  /**
   * HP 대가(0~100): 시전할 때 시전자가 최대 HP 의 N% 를 잃는다(FFT 암흑검·희생). HP 1 밑으로는 깎지 않는다.
   * 전투 타임라인에 시전자 자신을 대상으로 한 damage 엔트리(skillName = 기술 이름)를 남긴다. 생략 = 대가 없음.
   */
  hpCostPercent?: number;
  /**
   * 흡수(0~100): 준 피해의 N% 를 시전자가 회복한다(FFT 흡수 검). effect.affects 가 mp 면 MP 를 흡수한다.
   * 타임라인에 시전자 자신을 대상으로 한 healing 엔트리(resource hp|mp)를 남긴다. 생략 = 흡수 없음.
   */
  drainPercent?: number;
  /**
   * 반동(0~100): 준 피해의 N% 를 시전자도 입는다(몸통박치기·이판사판). 피해가 1 이상일 때만, 최소 1. 타마다 적용한다.
   * 타임라인에 시전자 자신을 대상으로 한 damage 엔트리(aside recoil)를 남긴다. 생략 = 반동 없음.
   */
  recoilPercent?: number;
  /**
   * 고정 피해: 능력치·급소·날씨와 상관없이 정해진 양만 준다(지구던지기 = 시전자 레벨, 용의분노 = 40 같은 고정값).
   * 명중 판정과 타입 무효(상성 0 배)는 그대로 따른다. gen1 전투 모델만 먹는다. 생략 = 보통 피해 식.
   */
  fixedDamage?: { readonly mode: "level" } | { readonly mode: "amount"; readonly amount: number };
  /**
   * 연속 기술(2~5회 같은 무작위 타수): 한 번 쓰면 min~max 번 맞힌다(2~5 는 2·3 번 각 3/8, 4·5 번 각 1/8). 매 타 피해 배율은 1.
   * hitSequence 가 있으면 그쪽(고정 타수·배율)이 이긴다. 대상이 쓰러지면 거기서 멈추고, 끝에 「N번 맞았다!」 한 줄. 생략 = 한 번.
   */
  multiHit?: { readonly min: number; readonly max: number };
  /**
   * 풀죽음(0~100): 명중해서 피해를 주면 대상이 이 확률로 풀이 죽어 **이번 라운드의 자기 차례를 잃는다**.
   * 대상이 아직 이번 라운드에 움직이지 않았을 때만 의미가 있다(strict 턴제). 생략 = 없음.
   */
  flinchChance?: number;
  /**
   * 게이지 밀기(-100~100, ATB 게이지 흐름 전용): 명중한 대상의 행동 게이지를 이만큼 옮긴다. 음수 = 늦추기(크로노 트리거
   * 시간 계열·FF 의 딜레이 공격), 양수 = 앞당기기(아군 퀵). 타격마다 적용한다. strict 턴제에서는 아무 일도 없다. 생략 = 없음.
   */
  gaugeShift?: number;
  /**
   * 힘 모으기(1~3): 쓰겠다고 정한 차례에는 예고만 하고(「…을 준비한다!」), 자기 차례가 이만큼 더 지난 뒤에 발동한다.
   * 적이 쓰면 보스 대기술 예고가 된다 — 플레이어가 방어·회복으로 대비할 틈. 아군도 같다. 생략 = 바로 발동.
   */
  chargeTurns?: number;
  /**
   * 소환(retro2003 연출): 파티원 도트 시트 id("party-pixel-<칩>"). 시전하면 그 몬스터가 시전자 앞에 나타나
   * 대상에게 달려가 첫 착탄에 맞춰 치고 사라진다. 그림만이다 — 위력·타수·상태는 이 레코드 값 그대로. 생략 = 소환 없음.
   */
  summonResourceId?: string;
  /**
   * retro2003 도트 연출 빌리기: 이 스킬 id 가 연출 계약(retroClassSkills·retroRosterSkills·retroMonsterSkills)에 없을 때,
   * 재생할 계약 스킬 id. 새 스킬·복제 스킬이 850여 개 계약 연출을 그대로 쓴다. 조회 순서는 「자기 id → 이 필드」.
   * 위력·비용·상태는 이 레코드 값을 쓰고 그림·움직임·소리·타수 간격만 빌린다. 생략 = 빌리지 않음.
   */
  retroChoreographyId?: string;
  /**
   * 포켓몬 스킨 움직임 종류(접촉·발사체·현장 발생·범위·능력 올리기·상태 걸기·회복). 생략 = 효과·계산 능력치·대상·이펙트 id 로
   * 자동 판정(battle/pokemonMoveMotion.ts). 판정이 틀린 기술만 적는다. 그림·움직임만 바뀌고 위력·명중은 그대로다.
   */
  moveMotion?: PokemonMoveMotion;
}

export interface SkillArea {
  /** circle: 주 대상에서 유클리드 거리 radius 이내. line: 주 대상과 |dy| <= radius/2 인 가로 띠. */
  shape: "circle" | "line";
  radius: number;
}

export interface SkillMpCost {
  flat: number;
  percentMax: number;
}

export interface SkillStatStageEffect {
  stat: import("@/battle/statStages").StatStageKey;
  /** −6~+6 (0 제외). 양수 = 올림, 음수 = 내림. */
  stages: number;
  /** 발동 확률(0~100). 생략 = 100. */
  chance?: number;
  /** 누구의 단계를 바꾸나. 생략 = 기술의 대상, self = 시전자(예: 오버히트로 자신의 특수공격이 떨어진다). */
  target?: "target" | "self";
}

export type SkillWeatherKind = "sun" | "rain" | "sandstorm" | "hail";

export interface SkillWeather {
  kind: SkillWeatherKind;
  /** 지속 차례 3~8. 생략 = 5. */
  turns?: number;
}

export type SkillEffect =
  | { kind: "damage"; statistic: "attack" | "mind"; affects: "hp" | "mp" }
  | { kind: "healing"; statistic: "mind"; affects: "hp" | "mp" }
  | { kind: "support" }
  | { kind: "switch"; switchId?: string }
  /** 훔치기: 대상 적의 stealItems 를 rate(0~100)로 차례로 굴려 하나를 빼앗는다. 적마다 한 번만 성공한다. */
  | { kind: "steal" }
  /** 라이브라: 대상의 HP/MP·약점 속성을 전투 메시지로 알리고 HP 바를 드러낸다. */
  | { kind: "scan" }
  /** 청마법 습득(라젠): 대상 적의 learnable 기술 중 모르는 것 하나를 배운다. 이 기술을 아는 배우는 learnable 기술에 맞아도 배운다. */
  | { kind: "learnEnemySkill" }
  /** 흉내·춤·슬롯: skillIds 중 하나를 무작위로 골라 그 기술을 대신 쓴다. */
  | { kind: "randomSkillFrom"; skillIds: SkillId[] }
  /** 스케치(렐름): 대상 적이 가진 기술 중 하나를 무작위로 그려 시전자가 대신 쓴다(hitRate 가 곧 성공률). 스케치·폭주류 기술은 고르지 않는다. */
  | { kind: "sketch" }
  /**
   * 폭주(가우): 시전자가 몬스터 하나의 모습이 되어 그 몬스터의 행동 표(enemyActions)를 따라 매 차례 자동으로 행동한다(전투 끝까지).
   * 몬스터는 enemyIds 가 있으면 그중, 없으면 시전자가 승리 때마다 모은 폭주 목록(session.actorRageEnemyIds)에서 무작위로 고른다.
   */
  | { kind: "rage"; enemyIds?: string[] }
  /** 대열 섞기: 대상 편 활성 배우의 자리와 열(앞/뒤)을 무작위로 뒤섞는다. 적 기술이 쓰면 플레이어 파티를 섞는다. */
  | { kind: "shuffleParty" }
  /** 강제 교대: 대상 활성 배우를 예비 배우 중 살아 있는 한 명으로 바꾼다(예비가 없으면 실패). */
  | { kind: "forceSwitch" };

/** 입력 커맨드 기술: 전투 UI 가 keys 를 순서대로 요구하고, timeLimitMs 안에 성공하면 successMultiplier, 실패하면 failMultiplier 로 위력이 바뀐다. */
export interface SkillInputSequence {
  keys: SkillInputKey[];
  timeLimitMs: number;
  successMultiplier?: number;
  failMultiplier?: number;
}

export type SkillInputKey = "up" | "down" | "left" | "right" | "confirm" | "cancel";

/** 액션 스킬 홀드 차지 단계: holdMs 이상 누르고 떼면 multiplier 배 피해. */
export interface ActionChargeTier {
  holdMs: number;
  multiplier: number;
}

export interface ActionWeaponProfile {
  /** 스윙 부채꼴 reach. 생략 시 시스템 기본(1). */
  swingRange?: number;
  /** 스윙 쿨다운. 생략 시 시스템 기본. */
  swingCooldownMs?: number;
  /** 스윙 데미지 가산. 생략 시 0. */
  swingDamageBonus?: number;
}

export interface ActionSkillProfile {
  kind: "projectile" | "melee" | "dash" | "trap";
  /** Milliseconds between casts (default 350). */
  cooldownMs?: number;
  /** Trap lifetime, milliseconds (default 5000, maximum 30000). */
  durationMs?: number;
  /** Bounded field enemy effect, independent of turn-based state records. */
  fieldStatus?: { kind: "poison" | "slow"; durationMs: number };
  damage: number;
  range: number;
  speedTilesPerSec?: number;
  /** 발사 시 인벤토리에서 소비하는 탄약 아이템. 부족하면 캐스트가 불발한다. mpCost와 병용 가능(둘 다 필요). */
  itemCost?: { itemId: ItemId; amount: number };
  /** 홀드 차지: 캐스트 키를 누른 시간에 따라 피해 배율. 생략 = 즉시 발동(기존과 같음). */
  chargeTiers?: ActionChargeTier[];
}

export interface ItemRecord {
  id: ItemId;
  name: string;
  imageResourceId?: string;
  iconResourceId?: string;
  scope: ItemScope;
  price: number;
  skillId?: SkillId;
  description: string;
  type: ItemType;
  occasion: "always" | "battle" | "field" | "never";
  consumable: boolean;
  animationId?: BattleAnimationId;
  stateEffects: DatabaseStateEffect[];
  consumptionLimit: ItemConsumptionLimit;
  usableActorIds: ActorId[];
  usableClassIds: ClassId[];
  healStateIds: StateId[];
  hpRecovery: SkillMpCost;
  mpRecovery: SkillMpCost;
  /** Restore this flat amount plus percentage of each known move's PP cap.
   * Explicit and independent of MP recovery; absent means no move-PP effect. */
  ppRecovery?: SkillMpCost;
  onlyUsableInMenu: boolean;
  onlyEffectiveOnDeadActors: boolean;
  learnedSkillId?: SkillId;
  activateSkillId?: SkillId;
  usageMessage: "normal" | "skill";
  switchId?: string;
  occasionField: boolean;
  occasionBattle: boolean;
  seedParameterBonuses: EquipmentStatBonuses;
  equipmentProfile: ItemEquipmentProfile;
  farmTool?: FarmTool;
  captureProfile?: ItemCaptureProfile;
  careProfile?: ItemCareProfile;
  /** 지닌 도구 효과(선택). 있으면 몬스터 파티 게임에서 파티 몬스터에게 지니게 할 수 있다(gen1 전투에서 적용). 생략 = 일반 아이템. */
  heldEffect?: HeldItemEffect;
  /**
   * 몬스터 파티 게임 가방 포켓을 직접 정한다(선택). 생략하면 captureProfile → 볼, 기술머신(learnedSkillId) → 기술머신,
   * heldEffect → 지닌 도구, 쓸 곳 없는 never 아이템 → 중요한 물건, 나머지 → 도구로 정해진다. 다른 장르의 아이템 화면은 이 값을 쓰지 않는다.
   */
  pocket?: ItemBagPocket;
  /** 벌레퇴치류(선택): 쓰면 이 걸음 수(1~9999) 동안 야생 조우를 막는다. 필드 메뉴에서 쓴다. 생략 = 일반 아이템. */
  repelSteps?: number;
  /** repelSteps 와 함께: true 면 파티 선두 몬스터보다 레벨이 낮은 야생만 막는다(포켓몬식). 생략 = 전부 막는다. */
  repelBelowLead?: boolean;
  /** 탈출 로프류(선택): "entrance" = 던전·동굴(mapRole dungeon)에서 쓰면 마지막으로 들어온 입구 밖으로 나간다. 전투 중·던전 밖에서는 「효과가 없다」. */
  escapeTo?: "entrance";
}

export type ItemBagPocket = "items" | "balls" | "machines" | "held" | "key";

export type HeldItemEffectKind = "healBelow" | "cureStatus" | "boostType" | "endureOnce" | "regen";
export type HeldItemStatus = "poison" | "burn" | "sleep" | "freeze" | "paralysis" | "any";

/**
 * 지닌 도구 효과(선언형). healBelow{thresholdPercent=50,healPercent,healFlat?} · cureStatus{status} ·
 * boostType{type,percent 101~200} · endureOnce · regen{percent 1~25}. healBelow/cureStatus/endureOnce 는 쓰면 사라진다.
 */
export interface HeldItemEffect {
  kind: HeldItemEffectKind;
  thresholdPercent?: number;
  healPercent?: number;
  healFlat?: number;
  status?: HeldItemStatus;
  type?: string;
  percent?: number;
}

export interface ItemCaptureProfile {
  multiplier: number;
  /** Optional Gen1 capture algorithm class; multiplier remains the compatibility contract. */
  ballClass?: "poke" | "great" | "ultra" | "master";
  /**
   * 조건부 볼(포켓몬식 그물·퀵·타이머·리피트 볼): 조건이 맞으면 포획 확률 배율이 더 오른다. 볼 등급과 겹친다.
   * 생략 = 조건 없음(기존 프로젝트는 저장 바이트 그대로). 규칙은 battle/captureBalls.ts.
   */
  condition?: ItemCaptureCondition;
}

export type ItemCaptureConditionKind = "type" | "firstTurn" | "turns" | "repeat";

export interface ItemCaptureCondition {
  kind: ItemCaptureConditionKind;
  /** 1.1~8. type·repeat 기본 3.5, firstTurn 기본 5, turns 는 상한(기본 4). */
  multiplier: number;
  /** kind === "type": 대상이 이 타입 중 하나면 적용(system.typeChart.types 값). */
  types?: string[];
  /** kind === "turns": 차례마다 늘어나는 배율(기본 0.3). */
  step?: number;
}

export interface ItemCareProfile {
  kind: "feed" | "toy";
  friendshipDelta: number;
  expDelta?: number;
  /** 이상한 사탕: 개체 레벨을 이만큼 올린다(1~10). 경험치는 그 레벨의 문턱까지 채워지고 레벨업 기술·진화가 이어진다. 생략 = 올리지 않음. */
  levelUp?: number;
}

export type FarmTool = "hoe" | "wateringCan" | "axe" | "pickaxe";

export type ItemScope = "none" | "ally" | "allAllies" | "enemy";
export type ItemType =
  | "normalGoods"
  | "weapon"
  | "shield"
  | "body"
  | "head"
  | "accessory"
  | "medicine"
  | "book"
  | "seed"
  | "special"
  | "switch";
export type ItemConsumptionLimit = "noLimit" | 1 | 2 | 3 | 4 | 5;

export interface ItemEquipmentProfile {
  statBonuses: EquipmentStatBonuses;
  equippableActorIds: ActorId[];
  equippableClassIds: ClassId[];
  twoHanded: boolean;
  mpCost: number;
  accuracy: number;
  criticalRate: number;
  attackElementIds: string[];
  stateInflictIds: StateId[];
  stateInflictionChance: number;
  effectFlags: ItemEquipmentEffectFlags;
  elementalDefenseIds: string[];
  stateDefenseIds: StateId[];
  stateDefenseMode: "resist" | "inflict";
  stateResistanceChance: number;
}

export interface ItemEquipmentEffectFlags {
  preemptive: boolean;
  doubleAttack: boolean;
  attackAll: boolean;
  ignoreDodge: boolean;
  preventCriticalHits: boolean;
  increasePhysicalDodge: boolean;
  halfMpCost: boolean;
  negateTerrainDamage: boolean;
  fixedEquipment: boolean;
  /** 전투 불능이 되면 최대 HP 의 이 %(1~100)로 한 번 일어난다(전투당 1회). 생략 = 없음. */
  autoRevive?: number;
}

export interface EquipmentRecord {
  /** Explicit battle movement family; does not replace a baked sprite weapon. */
  battleMotionStyle?: CharacterMotionStyle;
  id: EquipmentId;
  name: string;
  imageResourceId?: string;
  iconResourceId?: string;
  slot: string;
  price: number;
  skillId?: SkillId;
  description: string;
  statBonuses: EquipmentStatBonuses;
  equippableActorIds: ActorId[];
  equippableClassIds: ClassId[];
  cursed: boolean;
  twoHanded: boolean;
  /** 일반 공격 명중률에 곱하는 0~100% 장비 보정. */
  accuracy: number;
  /** 액터/적 기본 치명타율에 더하는 0~100%p 장비 보정. */
  criticalRate: number;
  usableAsItemSkillId?: SkillId;
  attackElementIds: string[];
  stateInflictIds: StateId[];
  stateInflictionChance: number;
  effectFlags: ItemEquipmentEffectFlags;
  elementalDefenseIds: string[];
  stateDefenseIds: StateId[];
  stateDefenseMode: "resist" | "inflict";
  stateResistanceChance: number;
  /** 실시간 액션 전투에서 이 무기를 들었을 때의 스윙 프로필. */
  actionWeapon?: ActionWeaponProfile;
  /** 장착 중에만 쓸 수 있는 스킬. 배우지 않아도 전투 스킬 목록에 들어간다. */
  grantsSkillIds?: SkillId[];
  /** 장착 중에만 전투 명령 메뉴에 붙는 명령. skillId 가 있으면 그 스킬도 함께 쓸 수 있다. */
  grantsCommand?: ClassBattleCommand;
  /**
   * 마석 AP 습득(FF6): 장착한 배우가 전투 승리마다 AP(적 rewards.ap 합계 × apRate%)를 이 장비의 각 항목에 쌓고,
   * 필요 AP 를 채우면 그 스킬을 **영구히** 배운다 — 장비를 벗어도 남는다. 배운 스킬은 PlaySession.actorSkillIds 와
   * learnedViaAp 에 기록된다. grantsSkillIds 와 따로이다(거기 넣으면 배우기 전에도 장착 중에는 쓸 수 있다). 생략 = 없음.
   */
  apGrants?: EquipmentApGrant[];
  /** AP 습득률 %(1~1000, 기본 100). 이 장비의 apGrants 에만 곱한다(마석마다 배우는 속도가 다르다). */
  apRate?: number;
  /** 레벨업 보너스(FF6 마석): 장착한 배우가 레벨이 오를 때마다 영구 능력치 보너스를 받는다(PlaySession.actorParamBonuses). 생략 = 없음. */
  levelUpBonus?: EquipmentLevelUpBonus;
}

export interface EquipmentApGrant {
  skillId: SkillId;
  /** 영구 습득에 필요한 AP(1~99999). */
  ap: number;
}

/** 레벨 하나가 오를 때마다 더해지는 영구 보너스. *Percent 는 그때의 최대치의 %, 나머지는 고정값. */
export interface EquipmentLevelUpBonus {
  maxHpPercent?: number;
  maxMpPercent?: number;
  attack?: number;
  defense?: number;
  mind?: number;
  agility?: number;
}

export interface EquipmentStatBonuses {
  attack: number;
  defense: number;
  mind: number;
  agility: number;
}

export interface DatabaseStateEffect {
  stateId: StateId;
  chance: number;
  operation: "add" | "remove";
}

export interface EnemyRecord {
  id: EnemyId;
  name: string;
  speciesId?: MonsterSpeciesId;
  level?: number;
  monsterResourceId?: string;
  /** 전투 이미지 표시 크기(10~300%, 정수). 생략 시 기존 크기 100%. */
  battleScalePercent?: number;
  graphicHue: number;
  transparent: boolean;
  flying: boolean;
  criticalHit: EnemyCritical;
  attackOptions: EnemyOptions;
  skillIds: SkillId[];
  stats: EnemyStats;
  rewards: EnemyRewards;
  actions: EnemyActionPattern[];
  /** 실시간 액션 전투용 필드 프로필. 생략 시 턴제 전용 적. */
  actionProfile?: EnemyActionProfile;
  /** 소속 진영 id(project.factions.defs). 생략 시 예약 진영 enemy — 기존 프로젝트와 동일하게 플레이어만 적대한다. */
  factionId?: string;
  stateRates: Record<string, ActorRateGrade>;
  elementRates: Record<string, ActorRateGrade>;
  /** 반격. 피격 후 살아 있으면 skillId 를 차례 밖에서 쓴다(게이지 유지, 타격당 최대 1회). 생략 = 없음. */
  reactions?: EnemyReaction[];
  /** 훔치기 표. rate 0~100. 생략 = 훔칠 것 없음. */
  stealItems?: EnemyStealItem[];
  /** 쓰러지는 연출(project/enemyCollapse.ts). 생략 = 스킨 기본 소멸. */
  collapseEffect?: "pixelBreak" | "bossSink" | "flash" | "instant";
}

export interface EnemyStealItem {
  itemId: ItemId;
  rate: number;
}

/** trigger: physical(공격 계열) · magic(마력 계열) · onDeath(쓰러질 때 최후의 일격, 전투당 1회) · 그 밖의 문자열은 속성 id. skillId "" = 통상 공격. chance 0~100. */
export interface EnemyReaction {
  trigger: string;
  skillId: SkillId;
  chance: number;
}

export interface EnemyActionAttack {
  kind: "melee" | "projectile" | "dash";
  /** 선딜 — 텔레그래프(적 점멸 + 위협 칸 표시) 시간. */
  windupMs: number;
  /** 후딜 — 공격 후 플레이어 반격 창. */
  recoverMs: number;
  damage: number;
  /** melee: 부채꼴 reach / projectile: 최대 비행 타일 / dash: 최대 돌진 타일. */
  range: number;
  /** 재공격 쿨다운. 기본 1200ms. */
  cooldownMs?: number;
  /** 투사체 속도(타일/초). 기본 6. */
  projectileSpeedTilesPerSec?: number;
}

export interface EnemyActionProfile {
  /** 접촉 데미지. 생략 시 attack/2 기반 폴림. */
  contactDamage?: number;
  /** 추격 이동 간격(ms). 생략 시 이동 타입 기본. */
  moveIntervalMs?: number;
  /** 어그로(추격 시작) 거리. 생략 시 스폰 정의/기본값. */
  aggroRange?: number;
  /** 넉백 저항 0..1. 기본 0. */
  knockbackResist?: number;
  /** 선딜/후딜이 있는 능동 공격. 생략 시 접촉만. */
  attack?: EnemyActionAttack;
}

export interface EnemyStats {
  maxHp: number;
  maxMp: number;
  attack: number;
  defense: number;
  mind: number;
  agility: number;
}

export interface MonsterSpeciesGraphic {
  monsterResourceId?: string;
  /** Optional true rear-view battle sprite; front graphic remains the fallback. */
  backResourceId?: string;
  /** Optional overworld CharSet texture key (e.g. tex_easyrpg_charset_monster1). */
  fieldCharsetId?: string;
  /** Optional full overworld graphic override; wins over fieldCharsetId when present. */
  fieldGraphic?: EventPageGraphic;
  graphicHue: number;
  transparent: boolean;
  flying: boolean;
}

export type MonsterAbilityKind = "immuneType" | "resistType" | "boostLowHp" | "immuneStatus" | "contactStatus" | "statMultiplier" | "endure";
export type MonsterAbilityStatus = "poison" | "burn" | "sleep" | "freeze" | "paralysis";
export type MonsterAbilityStat = "attack" | "defense" | "mind";

/**
 * 종의 특성 하나(선언형). 종류별 필수 매개변수는 정규화(`normalizeMonsterAbility`)가 지킨다.
 * immuneType{type,healPercent?} · resistType{type,percent} · boostLowHp{type,percent} · immuneStatus{status} ·
 * contactStatus{status,percent=확률} · statMultiplier{stat,percent} · endure.
 */
export interface MonsterAbility {
  name: string;
  description?: string;
  kind: MonsterAbilityKind;
  type?: string;
  status?: MonsterAbilityStatus;
  stat?: MonsterAbilityStat;
  percent?: number;
  healPercent?: number;
}

export interface MonsterSpeciesRecord {
  id: MonsterSpeciesId;
  name: string;
  graphic: MonsterSpeciesGraphic;
  types?: string[];
  baseStats: EnemyStats;
  expCurve?: ActorExperienceCurve;
  captureRate: number;
  skillsByLevel?: ActorLearnedSkill[];
  /**
   * 기술머신·비전머신(learnedSkillId 아이템)으로 가르칠 수 있는 기술. 생략하거나 비면 제한이 없다(기존 동작 —
   * 아이템 하나가 모든 종에게 통한다). 값이 있으면 이 목록의 기술만 이 종에게 가르칠 수 있다(예: 파도타기는 물 종만).
   */
  machineSkillIds?: SkillId[];
  evolutions?: MonsterEvolutionRecord[];
  /** 도감 설명(선택). 원정 정의(monsterCampaign)가 없는 수집 게임의 도감이 쓴다 — 원정 노트가 있으면 그쪽이 우선. */
  dexNote?: string;
  /** 암컷 비율 0~1(0 = 수컷만, 1 = 암컷만). 생략 = 무성(성별 표시 없음). */
  genderRatio?: number;
  /** 특성(선택). 생략 = 특성 없음(기존 동작). gen1 전투 모델에서만 적용된다. */
  ability?: MonsterAbility;
  /**
   * 노력치 보상(선택, system.monsterStatRules.evs 일 때만): 이 종을 쓰러뜨리면 승리한 참전 몬스터가 받는 노력치. 종목당 0~3, 합계 3 이하. 생략 = 없음.
   */
  evYield?: { hp?: number; atk?: number; def?: number; spd?: number };
}

export interface CropStageRecord {
  days: number;
}

export interface CropGraphicStage {
  resourceId?: string;
  frame?: string | number;
  label?: string;
}

export interface CropRegrowRecord {
  days: number;
}

export interface CropRecord {
  id: CropId;
  name: string;
  seedItemId: ItemId;
  harvestItemId: ItemId;
  harvestCount: number;
  stages: CropStageRecord[];
  seasons: Season[];
  regrow?: CropRegrowRecord;
  graphicStages?: CropGraphicStage[];
}

export interface MonsterEvolutionRecord {
  toSpeciesId: MonsterSpeciesId;
  requires: MonsterEvolutionRequirement;
}

export interface MonsterEvolutionRequirement {
  level?: number;
  itemId?: ItemId;
  friendshipAtLeast?: number;
}

export interface TypeChartRecord {
  types: string[];
  multipliers: Record<string, Record<string, number>>;
}

export interface EnemyRewards {
  exp: number;
  gold: number;
  dropItemId?: ItemId;
  dropRatePercent: number;
  /** 기술 포인트. 승리 시 살아남은 파티원 전원이 트룹 합계를 받는다. 생략 = 0. */
  tp?: number;
  /** 마석 AP. 승리 시 살아남은 파티원 전원이 트룹 합계를 받아 장착한 마석의 apGrants 에 쌓는다. 생략 = 0. */
  ap?: number;
  /** When present, replaces the legacy single drop (including an explicitly empty list). */
  drops?: { itemId: ItemId; ratePercent: number; quantity: number; condition: EnemyActionCondition }[];
}

export interface EnemyCritical {
  enabled: boolean;
  oneIn: number;
}

export interface EnemyOptions {
  normalAttacksMiss: boolean;
}

export type EnemyActionCondition = { kind: "always" } | { kind: "turn"; start: number; interval: number }
  | { kind: "hp" | "mp"; minPercent: number; maxPercent: number }
  | { kind: "status"; stateId: string; present: boolean }
  | { kind: "allies"; min: number; max: number }
  | { kind: "switch"; switchId: string; value: boolean };

export interface EnemyActionSwitchEffect {
  enabled: boolean;
  switchId?: string;
}

export interface EnemyActionPattern {
  skillId: SkillId;
  priority: number;
  condition: EnemyActionCondition;
  switchOnAfterAction: EnemyActionSwitchEffect;
  switchOffAfterAction: EnemyActionSwitchEffect;
  /** 이 행동을 하기 전에 전투장 좌표(트룹 members 와 같은 좌표계)로 옮겨 간다. 생략 = 제자리. */
  moveTo?: { x: number; y: number };
  /** 부위 행동: 이 태그의 부위(TroopMemberRecord.partTag)가 파괴되면 쓰지 않는다. */
  requiresPart?: string;
}

export interface TroopMemberRecord {
  enemyId: EnemyId;
  x: number;
  y: number;
  hidden?: boolean;
  /** 다부위 적: 본체 멤버의 트룹 내 인덱스(0부터). 본체가 쓰러지면 이 부위도 쓰러진다. */
  partOf?: number;
  /** 부위 태그. 이 부위가 쓰러지면 본체의 requiresPart 가 같은 행동이 막힌다. */
  partTag?: string;
}

export type BattleEventSpan = "battle" | "turn" | "moment";

export type BattleEventCondition =
  | Condition
  | { kind: "turn"; start: number; interval: number }
  | { kind: "onRound"; round: number }
  | { kind: "everyRound"; start?: number; interval?: number }
  | { kind: "enemyHp"; enemyId: EnemyId; minPercent: number; maxPercent: number }
  | { kind: "enemyHpBelow"; enemyId?: EnemyId; percent: number }
  | { kind: "actorHp"; actorId: ActorId; minPercent: number; maxPercent: number }
  | { kind: "enemyTurn"; enemyId: EnemyId; turn: number }
  | { kind: "actorTurn"; actorId: ActorId; turn: number }
  | { kind: "actorCommand"; actorId: ActorId; commandId: string };

export interface BattleEventPageRecord {
  id: string;
  name: string;
  conditions: BattleEventCondition[];
  span: BattleEventSpan;
  runOnce?: boolean;
  commands: Command[];
}

/** 트레이너 전투 인물 그림 계약(에메랄드 전투 소개·볼 던지기). 값은 모두 업로드 그림(`assets.uploaded`) id 다.
 *  - front: 상대 정면 한 장. 64x64·64x96(옛 세로 초상)·128x128·128x192 중 하나(화면 폭은 모두 128px: 64 폭 2배, 128 폭 1배).
 *  - back: 내 뒷모습 한 장(64x64·64x96·128x128·128x192 중 하나). 생략하면 `oprn_emerald_trainer_hero_back`.
 *  - throw / backThrow: 볼 던지기 프레임을 가로로 이은 시트. 프레임은 정사각 64 또는 128, 폭 = 프레임 x N(2~8), 높이 = 프레임(64 또는 128). 화면에는 한 칸을 128x128 로 보인다. 왼쪽부터 재생하고
 *    마지막 프레임이 볼을 놓는 순간이다. 생략하면 던지는 동작 없이 정지 자세로 미끄러져 나간다. */
export interface TroopTrainerSprite {
  front: string;
  back?: string;
  throw?: string;
  backThrow?: string;
}

export interface TroopRecord {
  id: TroopId;
  name: string;
  enemyIds: EnemyId[];
  members?: TroopMemberRecord[];
  autoAlign: boolean;
  uncapturable?: boolean;
  /** Distinguishes trainer battles from wild encounters without guessing from troop ids. */
  trainerBattle?: boolean;
  /** 트레이너 전투의 인물 그림. 없으면 필드 이벤트 그래픽에서 추정(옛 방식), 그것도 없으면 슬라이드 인 연출 없이 시작한다. */
  trainerSprite?: TroopTrainerSprite;
  previewBackgroundResourceId?: string;
  /** 전투 배경 움직임(스크롤·물결·색 순환). 생략 = 정지 배경(기존). project/battleBackdropAnimation.ts 가 정규화한다. */
  backdropAnimation?: BattleBackdropAnimation;
  /** 배경 겹(안개·구름·비·눈·불티·별·빛줄기·저자 그림), 최대 4. project/battleBackdropLayers.ts. 모든 스킨에서 보인다. */
  backdropLayers?: BattleBackdropLayer[];
  battleFlow?: BattleFlow;
  activeSlots?: number;
  /** 이 전투만의 팀 교대 비용. 생략 = 시스템 설정. */
  teamSwapCost?: TeamSwapCost;
  battleEventPages: BattleEventPageRecord[];
  /**
   * 전투 뒤 이벤트 — 결과 화면이 닫히고 필드로 돌아온 **다음**, 결과별로 한 번 실행하는 명령.
   * 전투를 연 길(이벤트 전투 처리 · 랜덤 인카운터 · 필드 심볼 접촉)과 상관없이 이 그룹이면 돈다.
   * 게임 오버로 끝나는 패배(canLose=false)에는 돌지 않는다. 생략·빈 목록 = 없음(옛 JSON 바이트 유지).
   * 모델·순회는 project/troopAfterBattle.ts.
   */
  afterBattle?: TroopAfterBattle;
}

export type TroopAfterBattleOutcome = "victory" | "defeat" | "escape";
export type TroopAfterBattle = Partial<Record<TroopAfterBattleOutcome, Command[]>>;

/**
 * 마더2식 움직이는 전투 배경. 모든 값은 선택이며 0/생략이면 그 효과가 꺼진다.
 * prefers-reduced-motion 이면 런타임이 전부 멈추고 정지 배경을 보인다.
 */
export interface BattleBackdropAnimation {
  /** 가로 스크롤 속도(px/초, -400~400). 양수 = 오른쪽. */
  scrollX?: number;
  /** 세로 스크롤 속도(px/초, -400~400). 양수 = 아래. */
  scrollY?: number;
  /** 물결 왜곡 진폭(px, 0~24). */
  waveAmplitude?: number;
  /** 물결 주파수(초당 흔들림 횟수, 0~8). 진폭이 있고 주파수가 0 이면 1 로 본다. */
  waveFrequency?: number;
  /** 색 순환 주기(초, 0~60). 0 = 끔. 주기마다 색상이 한 바퀴(hue-rotate 360°) 돈다. */
  paletteCycleSeconds?: number;
}

export interface BattleBackdropLayer {
  /** 그림 없이 그리는 프리셋. resourceId 가 있으면 그림이 먼저다. */
  preset?: "fog" | "clouds" | "mist" | "rain" | "snow" | "embers" | "stars" | "lightRays" | "glow";
  /** 바둑판으로 깔 그림(투명 PNG 권장). */
  resourceId?: string;
  /** true = 배틀러·이펙트 앞(덤불·안개 장막). 생략 = 배경 바로 위. */
  front?: boolean;
  /** 흐르는 속도 px/초(-1200~1200). 생략 = 프리셋 기본. */
  scrollX?: number;
  scrollY?: number;
  /** 불투명도 %(0~100). 생략 = 프리셋 기본. */
  opacity?: number;
  blendMode?: "add" | "screen" | "multiply";
}

export interface StateRecord {
  id: StateId;
  name: string;
  /** Gen1 persistent major status semantics, independent of authored state id/name. */
  gen1MajorStatus?: "poison" | "toxic" | "burn" | "sleep" | "freeze" | "paralysis";
  /**
   * 주요 상태와 따로 겹쳐 걸리는 휘발 상태(gen1 전투 전용). "confusion" = 걸릴 때 2~5 행동 동안 지속,
   * 행동마다 절반이 위력 40 자해로 행동을 잃는다. 교체하면 풀린다. 생략 = 일반 상태.
   */
  volatileStatus?: "confusion";
  // RM2K3 상태(State) 편집 가능 필드 — 사용자가 DB 탭에서 재정의한 값.
  // 값을 설정하지 않으면 ontology 기본값(stateOntologyFor)이 사용된다.
  removalCondition?: string;
  restriction?: string;
  priority?: number;
  accuracyModifier?: number;
  animationIndex?: number;
  recoverNaturallyFromTurn?: number;
  recoverNaturallyChance?: number;
  recoverWhenHitChance?: number;
  hpReleaseTurn?: number;
  /**
   * 필드 걸음당 HP 변화(음수 = 피해). 명작 공백 #25(2026-09-27)부터 런타임이 실제로 적용한다:
   * `fieldStepInterval` 걸음마다 한 번, 걸음 피해로는 1 아래로 내려가지 않는다(`fieldStepCanKill` 이면 0까지).
   */
  hpReleaseStep?: number;
  mpReleaseTurn?: number;
  /** 필드 걸음당 MP 변화(음수 = 소모). hpReleaseStep 과 같은 간격. */
  mpReleaseStep?: number;
  /** hp/mpReleaseStep 적용 간격(걸음). 생략 = 1. */
  fieldStepInterval?: number;
  /** 걸음 피해가 HP 0 까지 깎을 수 있다(전원 0 이면 필드 패배). 생략 = 1 에서 멈춤. */
  fieldStepCanKill?: boolean;
  /** 이 걸음 수를 걸으면 상태가 풀린다(필드 N걸음 지속). 생략 = 걸음으로 풀리지 않음. */
  releaseAfterSteps?: number;
  specialFlags?: readonly string[];
  lockedParameters?: readonly string[];
  runtimeEffects?: StateRuntimeEffects;
  /**
   * 감정 계열과 단계. 같은 계열 상태를 다시 걸면 한 단계씩 올라가고(최고 단계에서 멈춤),
   * 계열당 한 상태만 남는다. 공격자·대상 계열 상성은 system.emotionCycle 이 정한다.
   */
  emotion?: StateEmotion;
  /** 부위 손실: 이 상태인 동안 해당 장비 슬롯(weapon/shield/armor/helmet/accessory)의 능력치 보너스를 잃는다. */
  disablesEquipSlot?: string;
  /** retro2003 전투에서 이 상태가 걸린 동안 몸 위에 남는 오라 프리셋 id(src/assets/battleStateAuras.ts). "none" = 끔, 없으면 기본 상태 id 표. */
  battleAura?: string;
}

export interface StateEmotion {
  family: string;
  /** 1 부터. 같은 계열에서 클수록 강하다. */
  tier: number;
}

export interface StateRuntimeEffects {
  restrictsAction?: boolean;
  blocksSkillUse?: boolean;
  hpDamagePercentPerTurn?: number;
  hpHealPercentPerTurn?: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
  agilityMultiplier?: number;
  removeOnBattleEnd?: boolean;
  /** 스톱: ATB 게이지가 멈추고(gauge) 행동하지 못한다(strict). */
  freezesGauge?: boolean;
  /** 프로텍트: 공격(attack) 계열 피해에만 곱하는 방어 배율. */
  physicalDefenseMultiplier?: number;
  /** 실드: 마력(mind) 계열 피해에만 곱하는 방어 배율. */
  magicDefenseMultiplier?: number;
  /** 버서크(attackRandom): 명령 없이 무작위 상대를 통상 공격한다. 폭주(rage): 폭주 중인 몬스터(배틀러 rageEnemyId)의 행동 표대로 자동 행동한다. */
  forcedAction?: "attackRandom" | "rage";
  /** 이 상태인 동안 속성 등급을 덮어쓴다(속성 id → A~E). */
  elementRates?: Record<string, ActorRateGrade>;
  /** 석화처럼 전투 불능으로 친다 — 아군 전원이 쓰러졌거나 이 상태면 패배. 이 상태로는 행동하지 못한다. */
  incapacitates?: boolean;
  /** 받는 HP 피해 중 이 비율(0~1)을 MP 에서 대신 깎는다(MP 가 모자라면 남은 만큼만). */
  damageToMpRate?: number;
  /** 반격: 상대의 물리(공격력 계열) 타격을 맞으면 이 확률(%)로 통상 공격을 되돌려 준다. */
  counterChance?: number;
  /** 도발: 적이 대상을 고를 때 이 상태인 배우를 먼저 노린다. */
  taunt?: boolean;
  /** 감싸기: HP 가 1/4 이하인 동료가 단일 물리 공격을 받으면 대신 맞는다. */
  cover?: boolean;
  /** 회피: 물리(공격력 계열) 피해 타격을 이 확률(%, 최대 95)로 피한다. */
  evasionChance?: number;
  /** 리플렉: 이 배틀러를 겨눈 단일 대상 마법(정신력 계열 피해·회복, 보조)을 시전자에게 되돌린다. 되돌린 마법은 다시 튕기지 않는다. */
  reflect?: boolean;
  /** 리레이즈: 쓰러지면 최대 HP 의 이 %(1~100)로 한 번 일어나고 상태가 풀린다(배우만). */
  reraisePercent?: number;
  /** 선고: 걸린 뒤 자기 턴이 이만큼 지나면 쓰러진다(1~9). */
  doomTurns?: number;
  /** 좀비: 이 상태인 동안 받는 HP 회복(회복 스킬·회복 아이템·재생)이 같은 양의 피해가 된다(FF6 좀비). MP 회복은 그대로. */
  invertHealing?: boolean;
  /**
   * 트랜스·변신 상태가 주는 기술: 이 상태인 동안만 전투 명령 목록에 더해지고 상태가 풀리면 사라진다(장비의 grantsSkillIds 와 같은 방식).
   * 리미트 게이지(system.limitGauge)가 찬 뒤 limitSkill 기술로 이 상태를 걸면 FF6 트랜스(테라)가 된다. transformResourceId·배율과 같이 쓴다.
   */
  grantSkillIds?: string[];
  /**
   * 변신: 이 상태인 동안 전투 그림을 이 리소스 id 로 바꾼다. 아군은 전투 그림 id(예 "party-pixel-monster4-5" 9칸 시트,
   * 걷기 칩 전투 시트), 적은 몬스터 그림 id. 능력치는 같은 상태의 배율 칸으로 바꾼다. 풀리면 원래 그림으로 돌아온다.
   */
  transformResourceId?: string;
}

export interface BattleAnimationRecord {
  id: BattleAnimationId;
  name: string;
  resourceId?: string;
  sheet?: BattleAnimationSheet;
  scope?: BattleAnimationScope;
  position?: BattleAnimationPosition;
  large?: boolean;
  frames?: BattleAnimationFrame[];
  timings?: BattleAnimationTiming[];
  /**
   * 이어서 재생할 애니메이션(연출 합성, 2026-09-03). 본 애니메이션이 `startFrame` 에 닿으면 같은 앵커에
   * 겹쳐 시작한다 — 착탄 뒤의 연기·불티·잔광처럼 "한 컷" 에 담기지 않는 잔향을 둘째 레코드가 맡는다.
   * 전체 길이는 본체와 후속의 끝 중 늦은 쪽이고, 시퀀서가 그만큼 recover 비트를 늘린다.
   */
  followUps?: BattleAnimationFollowUp[];
  /**
   * 겹치기 방식(2026-10-02). 마법 빛·불꽃은 "add"(더하기)로 아래 배틀러·배경을 밝힌다. 생략 = 보통.
   * 셀마다가 아니라 레코드 하나에 거는 이유: 전투 이펙트 노드는 transform·z-index 로 스태킹 컨텍스트를
   * 만들어서, 안쪽 셀에 섞기를 걸면 투명한 자기 상자와만 섞인다. 노드 자체에 걸어야 무대와 섞인다.
   */
  blendMode?: "add" | "screen" | "multiply";
}

export interface BattleAnimationFollowUp {
  animationId: BattleAnimationId;
  /** 본 애니메이션의 몇 번째 프레임(0 기준)에서 시작하는가. */
  startFrame: number;
}

export type BattleAnimationScope = "singleTarget" | "allTargets" | "screen";

export type BattleAnimationPosition = "head" | "center" | "feet" | "screen";

export interface BattleAnimationSheet {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  /**
   * 시트 1px 이 전투 무대(640×480 논리 해상도)에서 차지하는 논리 px.
   * 없으면 2 — 320×240 시대 RM 자산(EasyRPG RTP·Scarloxy 96px 시트)의 값이다.
   * 번들 고해상도 이펙트(384px 프레임)는 0.5 로 같은 192 논리 px 를 차지한다.
   * 셀 오프셋(`BattleAnimationCell.x/y`)은 이 값과 무관하게 항상 RM px 다.
   */
  assetScale?: number;
}

export interface BattleAnimationFrame {
  cells: BattleAnimationCell[];
}

export interface BattleAnimationCell {
  pattern: number;
  x: number;
  y: number;
  zoom: number;
  opacity: number;
  visible: boolean;
  tone?: BattleAnimationTone;
  /** 회전(도, 시계 방향, -360~360). 생략 = 0. 칼 궤적·회오리처럼 한 장을 돌려 쓰는 셀. */
  rotation?: number;
  /** 좌우 뒤집기. 생략 = false. 한 시트로 왼쪽·오른쪽 베기를 함께 낸다. */
  mirror?: boolean;
}

export interface BattleAnimationTone {
  red: number;
  green: number;
  blue: number;
  gray: number;
}

export interface BattleAnimationTiming {
  frameIndex: number;
  soundResourceId?: string;
  flash?: BattleAnimationFlash;
  screenShake?: BattleAnimationScreenShake;
}

export interface BattleAnimationFlash {
  target: "target" | "screen";
  color: BattleAnimationTone;
  durationFrames: number;
}

export interface BattleAnimationScreenShake {
  power: number;
  speed: number;
  durationFrames: number;
}

export interface DatabaseRecords {
  actors: ActorRecord[];
  classes: ClassRecord[];
  skills: SkillRecord[];
  items: ItemRecord[];
  equipment: EquipmentRecord[];
  enemies: EnemyRecord[];
  troops: TroopRecord[];
  states: StateRecord[];
  battleAnimations: BattleAnimationRecord[];
}

/** 라이프스킬 종류 — 스타듀밸리 5스킬 차용. */
export type LifeSkillType = "farming" | "mining" | "foraging" | "fishing" | "combat";

/** 레벨업 보상 — 스위치 ON 또는 제작 레시피 해금. */
export interface LifeSkillLevelUpReward {
  readonly level: number;
  readonly switchId?: string;
  readonly recipeId?: string;
}

/** 생활 스킬 레코드 — 농사/채광/채집/나씨/전투 XP 레벨링. */
export interface LifeSkillRecord {
  readonly id: string;
  readonly name: string;
  readonly skillType: LifeSkillType;
  readonly maxLevel: number;
  readonly levelUpRewards: readonly LifeSkillLevelUpReward[];
}

/** One weighted authored outcome for a season's deterministic daily weather table. */
export interface DailyWeatherRule {
  readonly kind: WeatherKind;
  readonly weight: number;
  readonly intensity?: number;
}

/** Optional life-sim weather package. Forecasts are derived, never persisted as authored rows. */
export interface DailyWeatherConfig {
  readonly enabled: boolean;
  readonly forecastDays?: number;
  readonly seasons: Partial<Record<Season, readonly DailyWeatherRule[]>>;
}

/** Authored animal kind. Runtime ownership/progress lives in PlaySession.farmAnimals. */
export interface FarmAnimalSpeciesRecord {
  readonly id: string;
  readonly name: string;
  readonly graphic?: EventPageGraphic;
  readonly feedItemId: ItemId;
  readonly productItemId: ItemId;
  readonly productCount: number;
  readonly productEveryDays: number;
  readonly petFriendship: number;
}

/** A placed animal home definition, deliberately narrower than future general farm buildings. */
export interface FarmAnimalBuildingDefinition {
  readonly id: string;
  readonly name: string;
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly capacity: number;
  readonly allowedSpeciesIds: readonly string[];
}

export interface FishSpeciesRecord {
  readonly id: string;
  readonly name: string;
  readonly itemId: ItemId;
  readonly skillXp?: number;
}

export interface FishingCatchRule {
  readonly fishId: string;
  readonly weight: number;
  readonly seasons?: readonly Season[];
  readonly timePhases?: readonly TimePhase[];
  readonly weatherKinds?: readonly WeatherKind[];
  readonly minSkillLevel?: number;
}

/**
 * 낚으면 아이템 대신 몬스터 조우(야생 전투)가 되는 어획 규칙. 도감 종 speciesId 의 야생 무리로 싸운다.
 * levelMin/levelMax 가 있으면 그 범위에서 굴린 레벨(조우표와 같은 의미), 없으면 적 레코드 레벨.
 */
export interface FishingMonsterCatchRule {
  readonly speciesId: string;
  readonly weight: number;
  readonly levelMin?: number;
  readonly levelMax?: number;
  readonly seasons?: readonly Season[];
  readonly timePhases?: readonly TimePhase[];
  readonly weatherKinds?: readonly WeatherKind[];
}

export interface FishingSpotDefinition {
  readonly id: string;
  readonly name?: string;
  readonly mapId: MapId;
  readonly area: import("./project").Rect;
  readonly catches: readonly FishingCatchRule[];
  /** 몬스터가 낚이는 규칙(선택). catches 의 어종과 같은 가중치 풀에서 함께 뽑힌다. */
  readonly monsterCatches?: readonly FishingMonsterCatchRule[];
}

export interface FishingSystemConfig {
  readonly enabled: boolean;
  readonly energyCost?: number;
  readonly spots: readonly FishingSpotDefinition[];
}

export interface ForageEntryDefinition {
  readonly id: string;
  readonly weight: number;
  readonly itemId?: ItemId;
  readonly seasonalDrops?: Partial<Record<Season, ItemId>>;
}

export interface ForageAreaDefinition {
  readonly id: string;
  readonly name?: string;
  readonly mapId: MapId;
  readonly area: import("./project").Rect;
  readonly dailySpawnCount: number;
  readonly maxActive: number;
  readonly spawnEveryDays?: number;
  readonly despawnAfterDays: number;
  readonly entries: readonly ForageEntryDefinition[];
}

export interface SeasonalForageConfig {
  readonly enabled: boolean;
  readonly areas: readonly ForageAreaDefinition[];
}

export interface CollectionSystemConfig {
  readonly enabled: boolean;
  readonly trackedItemIds?: readonly ItemId[];
}

export interface MuseumRewardDefinition {
  readonly id: string;
  readonly name?: string;
  readonly minDonations?: number;
  readonly requiredItemIds?: readonly ItemId[];
  readonly reward?: BundleRewardDefinition;
}

export interface MuseumSystemConfig {
  readonly enabled: boolean;
  readonly eligibleItemIds: readonly ItemId[];
  readonly rewards: readonly MuseumRewardDefinition[];
}

export interface SpatialFootprint {
  readonly width: number;
  readonly height: number;
}

export interface SpatialPlacementCost {
  readonly gold?: number;
  readonly items?: ItemAmount[];
}

export interface FarmBuildingLevelDefinition {
  readonly level: number;
  readonly name?: string;
  readonly footprint: SpatialFootprint;
  /** Generic facility slots, never P1 farm-animal housing capacity. */
  readonly capacity: number;
  /** Explicit per-instance animal slots when animalHousing is enabled; 0..9999. */
  readonly animalCapacity?: number;
  /** Level 1 builds the structure; later levels upgrade into that level. */
  readonly cost?: SpatialPlacementCost;
  readonly graphicResourceId: string;
  readonly orientationGraphicResourceIds?: Partial<Record<Dir, string>>;
}

/** General farm structure catalog, deliberately independent from farmAnimalBuildings. */
export interface FarmBuildingTypeRecord {
  readonly id: string;
  readonly name: string;
  readonly levels: FarmBuildingLevelDefinition[];
  readonly animalHousing?: { readonly allowedSpeciesIds: string[] };
  /** Omitted/empty permits every map. */
  readonly allowedMapIds?: MapId[];
}

export interface HomeDecorationTypeRecord {
  readonly id: string;
  readonly name: string;
  readonly placementItemId: ItemId;
  readonly footprint: SpatialFootprint;
  readonly blocksMovement: boolean;
  readonly allowedOrientations: Dir[];
  readonly graphicResourceId: string;
  readonly orientationGraphicResourceIds?: Partial<Record<Dir, string>>;
  /** Omitted/empty permits every map. */
  readonly allowedMapIds?: MapId[];
}

/** 스킬 연출 레코드의 층 하나. 시트 키(pixel-fx)만 저장하고 frame·frames 는 시트 메타(retroFxSheetMeta)에서 읽는다. */
export interface SkillChoreographyLayer {
  /** 이펙트 시트 키(public/assets/generated/pixel-fx/<key>.png). 모르는 키는 정규화가 버린다. */
  sheet: string;
  anchor: RetroFxAnchor;
  /** 시작 시각(ms, 0~5000). 없으면 기존 타임라인이 정하는 시각. */
  startMs?: number;
  /** 0.5~3. 기본 1. */
  scale?: number;
  /** 같은 층을 이어서 반복 재생하는 횟수(1~6). 기본 1. */
  repeat?: number;
  /** each: 다단 스킬이면 타수마다 이 착탄 층을 다시 깐다. first(기본): 첫 타에 한 번. */
  onHit?: "first" | "each";
  tint?: string;
  /** 층이 시작될 때 울리는 효과음 id. */
  se?: string;
}

/** 프로젝트가 소유하는 스킬 도트 연출. 기본 연출(계약 카탈로그 약 1,130개)은 복사하지 않고 읽기 전용으로 남는다. id 는 chor_<slug>. */
export interface SkillChoreographyRecord {
  /** Shared motion program used in preview and exported player. */
  movement?: import("@/battle/battleMotionProgram").BattleMotionProgram;
  id: string;
  name: string;
  description?: string;
  /** 직업 동작 9종 또는 몬스터 동작 7종(몬스터 기본 연출을 복제할 수 있게 합집합). */
  motion: RetroSkillMotion | RetroMonsterSkillMotion;
  layers: SkillChoreographyLayer[];
  /** 0.5~2. */
  speed?: number;
  weight?: "light" | "normal" | "heavy";
  tint?: string;
  screen?: { shake?: number; flash?: string; dim?: boolean; cutIn?: boolean };
  tags?: { family?: string; element?: string };
  /** 복제 원본(기본 연출 id 또는 다른 프로젝트 레코드 id). */
  sourceId?: string;
}

export interface ProjectDatabaseRecords extends DatabaseRecords {
  /** 스킬 연출 레코드. 없음 = 빈 배열(스키마 변경 없이 덧붙는 옵셔널 컬렉션). */
  skillChoreographies?: SkillChoreographyRecord[];
  characterAppearances?: CharacterAppearanceRecord[];
  /** Optional additive catalog; built-in slots always remain available. */
  equipmentSlots?: EquipmentSlotRecord[];
  elements?: DatabaseElementRecord[];
  terrains?: DatabaseTerrainRecord[];
  battleCommands?: DatabaseBattleCommandRecord[];
  monsterSpecies?: MonsterSpeciesRecord[];
  crops?: CropRecord[];
  lifeSkills?: LifeSkillRecord[];
  farmAnimalSpecies?: FarmAnimalSpeciesRecord[];
  fishSpecies?: FishSpeciesRecord[];
  farmBuildingTypes?: FarmBuildingTypeRecord[];
  homeDecorationTypes?: HomeDecorationTypeRecord[];
}

export interface TitleScreenLayout {
  titleX: number;
  titleY: number;
  menuX: number;
  menuY: number;
}

export interface TitleScreenMenuLabels {
  newGame: string;
  continueGame: string;
  quit: string;
  /** 오토세이브 "이어하기" 라벨. 생략 시 런타임 기본 라벨("이어하기"). */
  resume?: string;
  /** "강하게 다시 하기"(New Game+) 라벨. system.newGamePlus.label 보다 우선한다. */
  newGamePlus?: string;
  /** 크레딧(저작자 표기) 라벨. 생략 시 "크레딧". 항목 자체는 숨길 수 없다. */
  credits?: string;
}
export interface TitleScreenMenuVisibility {
  newGame: boolean;
  continueGame: boolean;
  quit: boolean;
  /** 오토세이브 "이어하기" 표시 여부. 생략은 true(!== false 패턴) — 구 JSON 전후방 호환. */
  resume?: boolean;
}

export interface TitleScreenSounds {
  cursorSeResourceId?: string;
  confirmSeResourceId?: string;
  cancelSeResourceId?: string;
}

export type TitleScreenTitleMode = "text" | "graphic" | "both";

export interface TitleScreenGraphic {
  mode: TitleScreenTitleMode;
  resourceId?: string;
  x: number;
  y: number;
}

/** 배경 위에 얹는 무한 스크롤 레이어(최대 4장). additive optional — 구 JSON 은 필드 자체가 없다. */
export interface TitleBackgroundLayer {
  resourceId: string;
  /** 초당 스크롤 px(320×240 논리 좌표계). 음수 = 반대 방향. 생략/0 = 정지. */
  scrollXPerSec?: number;
  scrollYPerSec?: number;
  /** 스크롤 속도 배율(깊이감). 생략 = 1. */
  parallax?: number;
  /** 0..1. 생략 = 1(불투명). */
  opacity?: number;
}

export type TitleParticlePreset = "snow" | "rain" | "fireflies";

export interface TitleParticleSettings {
  preset: TitleParticlePreset;
  /** 밀도 0..100. 생략 시 런타임 기본 50. */
  density?: number;
}

export type TitleIntroLogoAnimation = "none" | "fadeIn" | "riseIn";
export type TitleIntroMenuAnimation = "none" | "fadeIn" | "slideUp";

/** 로고/메뉴 등장 연출. 로고·메뉴가 모두 없으면(none 포함) normalize 가 필드를 통째로 생략한다. */
export interface TitleIntroSettings {
  logo?: TitleIntroLogoAnimation;
  menu?: TitleIntroMenuAnimation;
  /** 첫 등장 전 지연 ms (0..10000). */
  delayMs?: number;
  /** 메뉴 항목 간 시차 ms (0..2000). */
  staggerMs?: number;
}

/** 로고가 처음 드러나는 방식. bloom = 빛 번짐에서 초점이 잡힌다, wipe = 왼→오 빛 커튼. */
export type TitleSequenceLogoReveal = "fade" | "rise" | "bloom" | "wipe";
/** 로고 표면을 훑는 반사광. once = 등장 직후 한 번, loop = 몇 초마다. */
export type TitleLogoShine = "none" | "once" | "loop";

/**
 * 입장 시퀀스(첫 진입 한 번). 검은 화면 → 페이드 → 카메라 밀기 → 빛 훑기 → 로고 → 메뉴.
 * 아무 키·클릭이면 즉시 끝 상태로 건너뛴다. 모든 필드 생략 = 런타임 기본값. 필드 자체가 없으면 시퀀스 없음(레거시 intro 만).
 */
export interface TitleOpeningSequence {
  /** 검은 화면이 걷히는 시간 ms (0..6000). 기본 1600. */
  fadeMs?: number;
  /** 카메라 밀기 폭 0..0.3 (1+push 배에서 1배로). 기본 0.08. 0 = 끔. */
  push?: number;
  /** 로고 직전 화면을 가로지르는 빛 띠. false 만 저장. */
  sweep?: boolean;
  /** 로고 등장 시각 ms (0..10000). 기본 1100. */
  logoAtMs?: number;
  /** 기본 bloom. */
  logoReveal?: TitleSequenceLogoReveal;
  /** 메뉴 등장 시각 ms (0..12000). 기본 logoAtMs + 1100. */
  menuAtMs?: number;
}

/** 「새 게임」을 고른 뒤 게임으로 넘어가는 전환. */
export type TitleTransitionKind = "flash" | "fade" | "zoom" | "mist";
export interface TitleTransitionSettings {
  kind: TitleTransitionKind;
  /** 200..3000. 생략 = 종류별 기본(flash 700, fade 800, zoom 1000, mist 1100). */
  durationMs?: number;
}

/**
 * 배경 그림 맞춤. 생략 = 레거시 "stretch"(100% 100% 로 늘림) — 구 JSON 은 필드가 없고 화면도 그대로다.
 * cover = 비율 유지로 화면을 채우고 넘치는 쪽을 자른다, contain = 비율 유지로 전부 보인다.
 */
export type TitleBackgroundFit = "cover" | "contain" | "stretch";
/** 생략 = 레거시 "pixelated". 그려 넣은 키아트는 "smooth" 여야 계단이 안 생긴다. */
export type TitleBackgroundRendering = "smooth" | "pixelated";

/** 그림 좌표계(0..1, 좌상단 원점) 한 점. 빛 근원은 그림 밖(-0.5..1.5)에 둘 수 있다. */
export type TitleEffectPoint = [number, number];

/**
 * 그림 위 영역 효과. 좌표는 모두 **배경 그림** 기준 정규 좌표라 화면 비율·맞춤이 바뀌어도 제자리에 남는다.
 * - godRays: source → toward 방향의 빛내림(spread = 부채꼴 폭)
 * - motes:   빛 속을 떠다니는 먼지 입자(source/toward 부채꼴 또는 region 안, count 개)
 * - glint:   line(칼날 등) 위를 periodSec 마다 훑는 반사광
 * - water:   region 안의 물결 일렁임 + 반짝임
 * - mist:    region 안을 흐르는 안개
 * - dapple:  region 안의 나뭇잎 그림자 흔들림
 * - glow:    source 둘레의 깜빡이는 불빛(횃불·창문), spread = 반경
 * - camera:  화면 전체의 느린 호흡 줌(intensity = 폭)
 * - parallax: 깊이 지도로 가까운 것과 먼 것을 다르게 움직이는 2.5D 시차(intensity = 폭).
 *             depthResourceId 가 없으면 「아래가 가깝다」는 기본 깊이를 쓴다.
 */
export type TitleEffectKind = "godRays" | "motes" | "glint" | "water" | "mist" | "dapple" | "glow" | "camera" | "parallax";

export interface TitleEffect {
  kind: TitleEffectKind;
  /** false 만 저장한다(끔). 생략 = 켬. */
  enabled?: boolean;
  /** 0..2, 생략 = 1. */
  intensity?: number;
  /** 0..4, 생략 = 1. */
  speed?: number;
  /** "#rrggbb". 생략 = 종류별 기본색. */
  color?: string;
  source?: TitleEffectPoint;
  toward?: TitleEffectPoint;
  /** 0.02..1 — godRays/motes 부채꼴 폭, glow 반경. */
  spread?: number;
  line?: [TitleEffectPoint, TitleEffectPoint];
  /** glint 주기 초(1..60). */
  periodSec?: number;
  /** 3..8 점 다각형. */
  region?: TitleEffectPoint[];
  /** motes 개수(0..96). */
  count?: number;
  /** parallax 깊이 지도 그림 id(흰색 = 가까움, 검정 = 멂). 배경 그림과 같은 구도여야 한다. */
  depthResourceId?: string;
}

export type TitleLogoStyle = "plain" | "metal" | "gold" | "stone" | "glow";
/** 생략 = "window"(윈도스킨 창). "plain" = 창 없이 글자만, 선택 항목이 빛난다. */
export type TitleMenuStyle = "window" | "plain";

export interface TitleScreenSettings {
  title: string;
  backgroundResourceId?: string;
  /** 생략 = stretch(레거시). */
  backgroundFit?: TitleBackgroundFit;
  /** 생략 = pixelated(레거시). */
  backgroundRendering?: TitleBackgroundRendering;
  /** 그림 영역 효과(최대 12). 빈/무효면 normalize 가 필드를 생략한다. */
  effects?: TitleEffect[];
  /** 글자 로고 질감. 생략 = 레거시 편집 글꼴. 지정하면 기본 문구("A NEW ADVENTURE")를 숨긴다. */
  logoStyle?: TitleLogoStyle;
  /** 로고 아래 부제(최대 60자). */
  logoSubtitle?: string;
  menuStyle?: TitleMenuStyle;
  /** 메뉴 글자 크기(논리 px, 10..24). 생략 = 스킨 기본(11px). 480 폭 화면에서 11px 은 작다(폴른 스타 가혹 검수 r12). */
  menuFontPx?: number;
  /** Optional title-screen BGM (music resource id). Empty/undefined = silent. */
  musicResourceId?: string;
  layout: TitleScreenLayout;
  menuLabels: TitleScreenMenuLabels;
  /** Required after normalize; missing fields default true, newGame always true. */
  menuVisibility: TitleScreenMenuVisibility;
  sounds?: TitleScreenSounds;
  /** Omitted when text-only with no logo resource (legacy compact JSON). */
  titleGraphic?: TitleScreenGraphic;
  /** 레거시 필드. 타이틀은 더 이상 조작 안내 줄을 그리지 않는다(2026-09-25) — 옛 JSON 호환으로만 남는다. */
  showInputHint?: boolean;
  /** 배경 스크롤 레이어(최대 4). 빈/무효면 normalize 가 필드를 생략한다(레거시 JSON byte-stable). */
  backgroundLayers?: TitleBackgroundLayer[];
  /** 타이틀 파티클. 무효 preset 이면 normalize 가 필드를 생략한다. */
  particles?: TitleParticleSettings;
  /** 로고/메뉴 등장 연출. 유효한 연출이 하나도 없으면 normalize 가 필드를 생략한다. */
  intro?: TitleIntroSettings;
  /** 입장 시퀀스. 있으면 intro 의 로고/메뉴 연출보다 우선한다. */
  sequence?: TitleOpeningSequence;
  /** 로고 반사광. 생략 = none. */
  logoShine?: TitleLogoShine;
  /** 새 게임 전환. 생략 = 기존 짧은 확인 연출(180ms)만. */
  transition?: TitleTransitionSettings;
  /**
   * 클리어·마지막 저장 상태에 따라 바뀌는 배경/음악. 위에서부터 처음 맞는 한 줄을 쓴다.
   * 비어 있거나 맞는 줄이 없으면 기본 backgroundResourceId/musicResourceId 그대로다.
   */
  variants?: TitleScreenVariant[];
  /** 켜면 저장이 있을 때 타이틀을 건너뛰고 가장 최근 저장(자동 저장 포함)으로 바로 이어한다. 생략 = 타이틀. */
  resumeOnLaunch?: boolean;
}

/** 타이틀 변형의 조건 — 한 줄에 조건 하나. */
export type TitleScreenVariantWhen =
  /** 이 엔딩을 본 적이 있다(클리어 기록). */
  | { readonly kind: "endingSeen"; readonly endingId: string }
  /** 서로 다른 엔딩을 이만큼 이상 봤다. */
  | { readonly kind: "clearCount"; readonly atLeast: number }
  /** 가장 최근 저장이 이 맵에서 이뤄졌다. */
  | { readonly kind: "saveMapId"; readonly mapId: string };

export interface TitleScreenVariant {
  readonly when: TitleScreenVariantWhen;
  /** 생략 = 기본 배경 유지. */
  readonly backgroundResourceId?: string;
  /** 생략 = 기본 음악 유지. */
  readonly musicResourceId?: string;
}

/** Project-authored logical viewport used by the map runtime and its DOM stage. */
export interface PlayResolution {
  width: number;
  height: number;
}

export interface EnergySystemConfig {
  /** Maximum energy available to a fully-rested player. */
  readonly max: number;
  /** New-session energy. Omitted means max. */
  readonly initial?: number;
  /** Day/sleep restore amount. Omitted means a full restore. */
  readonly restorePerDay?: number;
}

export interface ShippingSystemConfig {
  readonly enabled: boolean;
  /** Number of immutable settlement summaries retained in a save. */
  readonly historyLimit?: number;
  /** Omitted means every item with a resolvable sell price is accepted. */
  readonly allowedItemIds?: ItemId[];
}

export interface ItemAmount {
  readonly itemId: ItemId;
  readonly count: number;
}

export interface BundleRewardDefinition {
  readonly gold?: number;
  readonly itemRewards?: ItemAmount[];
  readonly switchId?: string;
  readonly worldUnlockIds?: string[];
  readonly recipeIds?: string[];
}

export interface BundleDefinition {
  readonly id: string;
  readonly name?: string;
  readonly requirements: ItemAmount[];
  readonly reward?: BundleRewardDefinition;
}

export interface WorldUnlockDefinition {
  readonly id: string;
  readonly name?: string;
  /** Optional switch mirrored on when this region is unlocked. */
  readonly switchId?: string;
}

export interface MakerDefinition {
  readonly id: string;
  readonly name?: string;
  readonly inputs: ItemAmount[];
  readonly outputs: ItemAmount[];
  /** Processing duration on a monotonic absolute game-minute clock. */
  readonly durationMinutes: number;
}

/**
 * 캠페인이 약속한 규모 — 검수(review_monster_game)와 점검(qa:game check)이 상수 대신 읽는 하한.
 * 생략하면 옛 고정 계약(8관·60종·72맵·142연결). build_monster_game 의 gymCount·speciesCount 가 정한다.
 */
export interface MonsterCampaignPlan {
  /** 체육관(=배지) 수. 0 이면 체육관 없는 캠페인. */
  gyms: number;
  /** 도감에 있어야 하는 고유 종 수(하한). */
  species: number;
  /** 맵 수 하한. */
  maps: number;
  /** 이동(transfer) 명령 수 하한. */
  links: number;
}

/**
 * 원작식 복종 레벨 상한(선택 규칙, 기본 꺼짐 = 필드 없음). 획득한 배지 수에 따라 「이 레벨까지의 몬스터만 말을 듣는다」 상한이 오르고,
 * 상한을 넘은 내 파티 몬스터는 전투에서 기술 명령을 거부한다(아이템·교체·도망·포획은 막지 않는다).
 * 상한 = caps 중 badges ≤ 현재 배지 수인 마지막 항목의 maxLevel(없으면 첫 항목). 배지 수는 badges[].switchId 가 켜진 개수.
 */
export interface ObedienceLevelCaps {
  enabled: boolean;
  /** badges 오름차순. 예: [{badges:0,maxLevel:20},{badges:1,maxLevel:25}]. */
  caps: { badges: number; maxLevel: number }[];
  /** 거부 문장 틀. {name} 이 몬스터 이름으로 바뀐다. 생략 = 원작식 기본 문장 네 가지를 돌려 쓴다. */
  refuseLine?: string;
}

export interface MonsterCampaignConfig {
  id: string;
  name: string;
  /** 생략 = 옛 고정 계약. */
  plan?: MonsterCampaignPlan;
  /** 새 종을 처음 잡았을 때 전투에 뜨는 도감 등록 문장. `{name}` 은 종 이름. 생략 = 「{name}의 데이터가 도감에 등록되었다!」. */
  dexRegisteredText?: string;
  speciesIds: string[];
  speciesNotes: Record<string, string>;
  /**
   * 배지. switchId 가 진행 게이팅의 정본이다(관장 승리가 켠다 — build_monster_game 은 `mx_badge_N`, N 은 1부터).
   * iconResourceId = 배지 그림(번들 아이콘 id, 선택): 배지 획득 연출과 배지 화면이 쓴다. 생략하면 연출·화면은 기본 배지 아이콘.
   */
  badges: { id: string; name: string; switchId: string; cityMapId: string; iconResourceId?: string }[];
  locations: { mapId: string; name: string; x: number; y: number; kind: "town" | "route" | "dungeon" | "league" }[];
  /** summary = 목록 한 줄용 짧은 이름(생략하면 title). 긴 문장 title 은 「다음 목표」 칸과 설명에만 쓴다. */
  objectives: { id: string; title: string; summary?: string; switchId: string; requiresSwitchId?: string }[];
  /** 선택 규칙 — 생략 = 꺼짐(기존 프로젝트·저장 바이트 불변). */
  obedienceLevelCaps?: ObedienceLevelCaps;
}

export interface SystemRecords {
  startActorIds: ActorId[];
  monsterCampaign?: MonsterCampaignConfig;
  /** Omitted means the legacy 320x240 viewport. */
  playResolution?: PlayResolution;
  /**
   * 프로젝트 기본 카메라 배율. 생략하면 1(클래식).
   *
   * 왜 system 인가: 줌은 원래 연출 상태(session.camera.zoom, 이벤트 명령 m2-201)로만
   * 존재했다. 그래서 고해상도 배경(1920x1080)을 1:1 로 쓰려면 맵마다 auto 이벤트를 심어
   * 줌을 걸어야 했고, 새 맵에서는 1 로 돌아갔다. 기본값은 프로젝트가 정하고 연출은 그 위에
   * 일시적으로 덮어쓰는 것이 맞다.
   *
   * playResolution 과의 관계: 해상도는 픽셀 밀도이고 시야는 배율이 정한다.
   * 1440x1080 + 4.5 면 20x15 타일(320x240 과 동일 시야)에 배경이 1:1 로 맞는다.
   */
  cameraZoom?: number;
  /**
   * 주인공의 **몸 크기**(타일, 발밑 앵커). 생략하면 1x1 — 기존 프로젝트와 동작이 같다.
   * 이벤트의 `EventPage.footprint` 와 같은 규약이다(2차 스펙 §9).
   */
  playerFootprint?: CharacterFootprint;
  /** 맵을 클릭(탭)하면 주인공이 경로를 찾아 걸어간다(명작 공백 #32). 생략 = 꺼짐. */
  pointerMovement?: boolean;
  /**
   * 몸 사각 **하단 몇 행**이 지형·이벤트에 막히는가. 생략하면 몸 높이 전체(= 통행 사각 === 몸 사각).
   * 3x3 주인공에 1 이면 발밑 한 줄만 막혀 상체가 벽을 스치며 지나갈 수 있다.
   */
  playerPassRows?: number;
  titleResourceId?: string;
  systemResourceId?: string;
  battleSystemResourceId?: string;
  battleBgmResourceId?: string;
  /** 맵이 BGM 을 지정하지 않았을 때(mode=parent 상속 실패 포함) 쓰는 프로젝트 기본 BGM. */
  defaultBgmResourceId?: string;
  /** 승리 시 한 번 재생하는 팡파레(ME). 비우면 런타임 합성 팡파레. */
  battleVictoryMeResourceId?: string;
  /** 패배 시 효과음. 비우면 기본 붕괴음. */
  battleDefeatSeResourceId?: string;
  /** 도주 시 효과음. 비우면 기본 도주음. */
  battleEscapeSeResourceId?: string;
  initialTroopId?: TroopId;
  battleFlow?: BattleFlow;
  /** gauge 흐름 전용. active 면 명령 메뉴가 열려 있어도 적 게이지가 차고 적이 행동한다. 생략 = wait. */
  atbMode?: BattleAtbMode;
  /** ATB 속도 1~8(4 = 기존 속도). 생략 = 기존 속도. */
  atbSpeed?: number;
  /** true 면 전투마다 선제·기습·백어택·협공을 민첩으로 굴리고, 심볼 인카운트는 접촉 방향으로 정한다. 생략 = 항상 보통 개시. */
  battleFormationRoll?: boolean;
  /** 도주에 실패할 때마다 다음 도주 확률에 더하는 %p. 생략 = 0(가산 없음, 예전 식). 명작식은 10 정도. */
  escapeBonusPercent?: number;
  /** field 면 전투 배경이 주인공 주변 필드 화면의 스냅숏이고 진입은 제자리 페이드. 생략 = 트룹/지형 배경. */
  battleBackdrop?: "field";
  /** true 면 전투 HP 가 마더(EarthBound)식 롤링 미터로 표시된다: 표시 HP 가 실제 HP 쪽으로 초당
   *  battleRollingHpPerSecond 만큼 흘러가고, 치명타를 받은 아군은 미터가 0 에 닿기 전까지 「쓰러지는 중」이다.
   *  그 사이 전투가 승리·도주로 끝나면 미터에 남은 HP 로 살아남는다. 생략 = 즉시 표시(기존). */
  battleRollingHp?: boolean;
  /** 롤링 미터 속도(HP/초, 1~999). 생략 = DEFAULT_ROLLING_HP_PER_SECOND. */
  battleRollingHpPerSecond?: number;
  /** onField 면 전투가 **필드 위에서** 벌어진다(크로노식): 전환 연출 없이, 적은 부딪힌 심볼 자리에, 아군은 파티가 선 자리에
   *  선다. 배경은 필드 스냅샷 그대로(확대·자르기 없음). battleBackdrop 과 무관하게 필드 배경을 쓴다. 생략 = 전환 후 전투장. */
  battlePresentation?: "onField";
  battleUiStyle?: BattleUiStyle;
  /** 전투 타격감 프리셋(project/battleHitFeel.ts). 생략 = impact(묵직하게). 스킨과 별개 축이다. */
  battleHitFeel?: import("@/project/battleHitFeel").BattleHitFeel;
  /** 전투 화면 꾸미기(project/battleLook.ts) — 프리셋 + 바꾼 칸. 생략 = 「도트 창」 프리셋. 스킨(전투 방식)과 별개 축이다. */
  battleLook?: import("@/project/battleLook").BattleLookSettings;
  /** 화면 표시 필터(project/displayFilter.ts) — 주사선·브라운관. 생략 = 없음. */
  displayFilter?: "scanlines" | "crt";
  /**
   * 플레이 화면을 창에 키우는 방식(project/playSurfaceScaleMode.ts). integer = 정수 배율+여백, fit = 창에 꽉.
   * 생략하면 해상도를 저장한 프로젝트는 integer, 옛 320×240 프로젝트는 fit.
   */
  playSurfaceScale?: "integer" | "fit";
  /** ESC(X) 게임 메뉴 디자인. 생략 = workbench(작업대, 지금 화면). */
  menuUiStyle?: MenuUiStyle;
  /** 대화창 스타일(project/dialogueStyles.ts). 생략 = glass(지금까지의 유리 창). */
  dialogueStyle?: import("@/project/dialogueStyles").DialogueStyleId;
  /** 대화창 글꼴 — 에디터 UI 글꼴과 따로 간다. 생략 = 스타일이 정한 글꼴. */
  dialogueFont?: import("@/project/fontRegistry").FontFamilyId;
  /** 프로젝트 기본 말 빠르기 배율(0.5~2). 생략 = 1. 화자 빠르기와 곱한다. */
  dialogueSpeed?: number;
  /** false 면 구두점 뒤에 쉬지 않는다. 생략 = 쉰다. */
  dialoguePunctuationPause?: boolean;
  /** 하단 대사창 뒤 전신 초상의 크기·내림(%). 생략 = 높이 125·내림 20. */
  dialogueFullPortrait?: import("@/project/dialogueStyles").DialogueFullPortraitSettings;
  fieldHud?: import("../fieldHud").FieldHudConfig;
  /** Project-wide, scoped battle menu CSS; absent preserves the selected skin. */
  battleCommandCss?: string;
  battleParty?: BattleParty;
  /** 전투 규칙 엔진 선택. "rm2k3"(기본/생략) 또는 "gen1"(포켓몬 레드 스타일).
   *  생략 시 기존 RM2k3 전투 규칙이 100% 유지된다. CSS·UI 게이팅은 body[data-battle-model] 속성으로 한다. */
  battleModel?: "rm2k3" | "gen1";
  activeSlots?: number;
  /** 팀 교대 전투(2~4팀). 생략 = 기존 한 파티 전투. 한 번에 한 팀만 싸운다(교대 묶음). */
  battleTeams?: BattleTeamRecord[];
  /** 팀 교대 비용 기본값. 팀이 둘 이상일 때만 뜻이 있고 생략하면 "gauge". */
  teamSwapCost?: TeamSwapCost;
  rewardPolicy?: RewardPolicy;
  /** 포획 던지기마다 흔들린 횟수(0~3, 잡히면 4)를 이 변수에 기록한다 — 이벤트가 읽어 「아깝다!」 같은 분기를 만든다. 생략 = 기록 안 함. */
  captureShakesVariableId?: string;
  titleScreen?: TitleScreenSettings;
  /** Opt-in pre-map new-game sequence. Disabled sequences retain their authored content. */
  opening?: CinematicSequence;
  /** Optional game-over sequence and terminal-menu presentation. */
  gameOver?: GameOverSettings;
  gameOvers?: import("../cinematicSettings").GameOverDefinition[];
  defaultGameOverId?: string;
  monsterCollection?: boolean;
  /** 보관함(PC) 상자 이름(상자 1번부터, 최대 8글자). 생략·빈 칸 = 「상자 N」. project/monsterBox.ts. */
  monsterBoxNames?: string[];
  // 전투를 몬스터 파티로 진행(옵션 A). monsterCollection(포획 게이트)과 별개 축이다.
  monsterBattleParty?: boolean;
  giftSystem?: boolean;
  /** 관계·연애 하루 루프(옵트인): 호감 대화가 시간대 칸을 쓰고 사람별 하루 호감 상한이 있다. project/socialLoop.ts. 생략 = 기존 동작 그대로. */
  socialLoop?: import("@/project/socialLoop").SocialLoopConfig;
  /**
   * 갤러리. enabled 가 아니면 메뉴에 나오지 않는다.
   * label 을 비우면 메뉴 이름은 「갤러리」. 다른 낱말을 적어 두면 그 이름으로 보인다.
   */
  gallery?: {
    readonly enabled: boolean;
    readonly label?: string;
  };
  /** 클리어 후 타이틀의 "강하게 다시 하기". 생략 = 없음. */
  newGamePlus?: import("@/project/newGamePlus").NewGamePlusSettings;
  /** 변수 값 → 장(시대) 이름. ESC 메뉴·저장 칸에 보인다. 생략 = 표시 없음. */
  chapter?: import("@/project/newGamePlus").ChapterSettings;
  /** 소형선·대형선·비행선. 생략 = 탈것 없음(기존 프로젝트). 계약은 `src/project/vehicles.ts`. */
  vehicles?: import("@/project/vehicles").VehicleConfig[];
  typeChart?: TypeChartRecord;
  timeSystem?: TimeSystemConfig;
  /** Opt-in 실시간 액션 전투 패키지. 생략 시 필드 스폰 접촉은 기존 턴제 전투로 라우팅된다. */
  actionCombat?: SystemActionCombat;
  /** Opt-in tool→world rules. Empty/absent → legacy farm hoe/can only. */
  toolActions?: import("@/project/toolActions").ToolActionRule[];
  /** Opt-in craft recipes. */
  craftRecipes?: import("@/project/craftRecipes").CraftRecipe[];
  /** Opt-in item upgrade rows. */
  itemUpgrades?: import("@/project/upgrades").ItemUpgradeRule[];
  /** Opt-in sell price overrides. */
  /** 도망 성공 뒤 야생 조우를 건너뛰는 걸음 수(0~99, 0 = 끔). 생략 = 몬스터 파티 게임은 4, 다른 장르는 0. project/encounterGuard.ts. */
  escapeGraceSteps?: number;
  /** 색이 다른 개체 확률 1/N(2~65536). 생략 = 나오지 않음. */
  shinyRate?: number;
  /**
   * 몬스터 능력치 심화(옵트인): natures = 성격(공격·방어·특공·속도 중 하나 +10%, 하나 −10%), evs = 노력치(승리 때 종의 evYield 만큼 쌓여 능력치에 +floor(EV/4)).
   * 생략 = 둘 다 꺼짐(기존 능력치 공식·저장 바이트 그대로). project/monsterStatRules.ts.
   */
  monsterStatRules?: { natures?: boolean; evs?: boolean };
  sellPrices?: import("@/project/upgrades").SellPriceEntry[];
  /** Opt-in life-sim energy pool. */
  energy?: EnergySystemConfig;
  /** Opt-in shipping queue and nightly settlement policy. */
  shipping?: ShippingSystemConfig;
  /** Community-style contribution definitions. */
  bundles?: BundleDefinition[];
  /** Stable world/region unlock definitions referenced by bundle rewards. */
  worldUnlocks?: WorldUnlockDefinition[];
  /** Timed input/output processing definitions. */
  makers?: MakerDefinition[];
  /** Optional authored daily weather tables. Runtime selection is owned by the day transition. */
  dailyWeather?: DailyWeatherConfig;
  /** Placed animal homes for the P1 farm-animal loop. */
  farmAnimalBuildings?: FarmAnimalBuildingDefinition[];
  /** Deterministic fishing availability and weighted catch definitions. */
  fishing?: FishingSystemConfig;
  /** Deterministic daily forage spawn policy. */
  seasonalForage?: SeasonalForageConfig;
  /** Opt-in unified item discovery/shipping/catch/donation journal. */
  collections?: CollectionSystemConfig;
  /** Exact-once museum donation and reward definitions. */
  museum?: MuseumSystemConfig;
  /** Out-of-battle party monster care (walk ticks + feed/toy items). */
  monsterCare?: MonsterCareConfig;
  /** 필드에서 플레이어를 따라오는 동료(액터)의 전역 규칙. 생략 시 간격 1칸·인원 무제한. */
  companions?: CompanionConfig;
  /** Opt-in life skill leveling system (farming/mining/foraging/fishing/combat). */
  skillSystem?: { enabled: boolean };
  /** 자자가 골람 역할별 글꼴. 생략·기본값은 저장하지 않으며 tokens.css 기본 토큰이 그대로 산다. */
  fonts?: import("@/project/fontRegistry").SystemFontConfig;
  /** 저자가 선언한 장르. lint 가 이 선언 대비 옵트인 정합성을 검사한다. 미설정이면 장르 검사 없음. */
  genre?: GenrePackId;
  /**
   * 장르 잠금(옵트인). 조수·도구가 새 맵·칩셋에 허용 계열 밖 칩셋을 쓰면 거부한다 — 판정은 project/genreLock.ts 하나.
   * 없으면 아무 동작도 바뀌지 않는다(저장 바이트 불변). 사용자의 손 편집은 막지 않는다.
   */
  genreLock?: import("../genreLock").GenreLock;
  /** AI 마을 생성의 물·숲·길 수치와 낱말 규칙. 생략하면 내장 기본값(예전 하드코딩과 동일 동작). */
  worldGen?: import("@/project/worldGenRules").WorldGenRules;
  /** 배우별 리미트 게이지(0~100). 생략 = 없음. */
  limitGauge?: BattleLimitGaugeConfig;
  /** 제2 기술 자원 「기력」(0~max). 생략 = 없음. */
  resource2?: BattleResource2Config;
  /** 파티 공용 게이지(0~max). 생략 = 없음. */
  partyGauge?: BattlePartyGaugeConfig;
  /** 약점(속성 배율 > 1)을 찌르면 한 번 더 행동한다(페르소나식). 같은 적은 제 차례가 올 때까지 다시 쓰러지지 않는다. */
  weaknessExtraAction?: boolean;
  /** 감정 상성표: 공격자 감정 계열 → 대상 감정 계열 → 피해 배율. 생략 = 상성 없음. */
  emotionCycle?: EmotionCycleRule[];
  /**
   * 난이도 목록. 비어 있지 않으면 새 게임을 고를 때 난이도를 묻고(1개면 묻지 않는다), 적 HP/공격력·경험치·골드·
   * 인카운트율에 배율을 곱한다. 이벤트 명령 setDifficulty 로 바꾸고 조건 difficulty 로 읽는다. 생략 = 난이도 없음.
   */
  difficulties?: DifficultyRecord[];
  /** 새 게임의 난이도 id. 생략·무효면 목록 첫 줄. */
  defaultDifficultyId?: string;
  /** 몬스터 합성 표(fuseMonsters). 두 종의 순서는 따지지 않는다. */
  monsterFusions?: MonsterFusionRecord[];
}

export interface BattleLimitGaugeConfig {
  enabled: boolean;
  /** 표시 이름. 생략 = 「리미트」. */
  label?: string;
  /** 받은 피해가 최대 HP 의 몇 %인지에 곱하는 충전율(%). 생략 = 100(최대 HP 만큼 맞으면 가득). */
  takenRate?: number;
  /** 공격이 명중할 때마다 더하는 점수. 생략 = 5. */
  dealtGain?: number;
}

export interface BattleResource2Config {
  enabled: boolean;
  /** 표시 이름. 생략 = 「기력」. */
  label?: string;
  /** 최대치. 생략 = 100. */
  max?: number;
  /** 전투 시작 값. 생략 = 0. */
  start?: number;
  /** 피해를 줄 때마다 얻는 양. 생략 = 5. */
  dealtGain?: number;
  /** 피해를 받을 때마다 얻는 양. 생략 = 10. */
  takenGain?: number;
}

export interface BattlePartyGaugeConfig {
  enabled: boolean;
  /** 표시 이름. 생략 = 「연계 게이지」. */
  label?: string;
  /** 최대치. 생략 = 100. */
  max?: number;
  /** 아군 공격이 명중할 때마다 차는 양. 생략 = 10. */
  gainPerHit?: number;
}

export interface EmotionCycleRule {
  attackerFamily: string;
  targetFamily: string;
  multiplier: number;
}

export interface DifficultyRecord {
  id: string;
  name: string;
  /** 모든 배율은 1 = 그대로. 0.1~10 으로 자른다. */
  enemyHpRate?: number;
  enemyAttackRate?: number;
  expRate?: number;
  goldRate?: number;
  encounterRate?: number;
}

export interface MonsterFusionRecord {
  speciesA: MonsterSpeciesId;
  speciesB: MonsterSpeciesId;
  resultSpeciesId: MonsterSpeciesId;
}

export interface ActionCombatHudConfig {
  /** 플레이어 HP 하트 바. 생략 시 true. */
  hearts?: boolean;
  /** 스태미나 바 **표시** 토글. 생략 시 false. 소모 규칙 자체는 액션 맵에서 항상 켜진다. */
  stamina?: boolean;
  /** 몬스터 철력 바. "damaged"(기본)=피해입은 개척만, "always"=항상, "never"=숨김. */
  enemyHpBars?: "always" | "damaged" | "never";
}

export interface SystemActionCombat {
  enabled: boolean;
  /** true 면 따라오는 파티 동료가 가까운 적을 스스로 때리고, V 키로 조작 캐릭터(선두)를 바꾼다. 없으면 꺼짐. */
  allies?: boolean;
  /** 플레이어 피격 무적시간. 기본 800ms. */
  playerIframesMs?: number;
  /** 공격 스윙 쿨다운. 기본 350ms. */
  swingCooldownMs?: number;
  /** 플레이어 스윙 데미지 가산. 기본 0. */
  swingDamageBonus?: number;
  /** true면 액션 전투 맵에서 대각 이동을 끄고 4방향 그리드 이동만 허용(클식 서바이벌 호러 감각). */
  fourWayMovement?: boolean;
  /** 회피(대시) 1회 스태미나 비용. 기본 25. 0이면 공짜 회피. */
  dodgeStaminaCost?: number;
  /** 회피 성공 시 열리는 무적 창. 기본 300ms. */
  dodgeIframesMs?: number;
  /** 홀드 가드 중 피해 감소율(%). 기본 50, 최대 90 — 완전 방어는 없다. */
  guardDamageReductionPercent?: number;
  /** 가드 유지 초당 스태미나 소모. 기본 20. 0이면 공짜 가드. */
  guardStaminaDrainPerSec?: number;
  hud?: ActionCombatHudConfig;
}

/**
 * 동료 추종 규칙. 추종은 경로탐색이 아니라 플레이어 이동 궤적(followerTrail) 재생이므로,
 * 간격은 "몇 번째 궤적 점을 쓰는가"로 표현된다. 궤적 길이가 유한(MAX_FOLLOWER_TRAIL_POINTS)해서
 * `gap * maxCompanions` 가 그 길이를 넘으면 뒷 동료가 플레이어 위에 겹친다 — 저작 시점에 거부한다.
 */
export interface CompanionConfig {
  /** 동시에 따라올 수 있는 액터 동료 수 상한. 생략 시 무제한. 몬스터 열차는 monsterParty 가 지배하므로 세지 않는다. */
  maxCompanions?: number;
  /** 동료 사이 간격(칸). 1 = 바로 뒤, 4 = 4칸씩 벌어져 따라온다. 생략·1 이면 기존 동작과 동일. */
  gap?: number;
  /** 상한 초과 시 정책. "reject"(기본) = 새 동료를 붙이지 않음, "replaceOldest" = 가장 먼저 붙은 동료를 밀어냄. */
  overflow?: "reject" | "replaceOldest";
  /**
   * 대형. "line"(기본) = 궤적을 따라 일렬. "beside" = 플레이어 사방 인접 칸에 붙어 다닌다
   * (인접 칸이 4개뿐이라 앞 4명만 옆에 서고 나머지는 일렬로 떨어진다. gap 은 무시된다).
   */
  formation?: "line" | "beside";
  /** true 면 맵 이동 시 액터 동료를 해제한다. 생략 시 유지(기존 동작). */
  clearOnTransfer?: boolean;
  /**
   * true 면 파티 선두 뒤의 활성 멤버(partyActorIds[1..activeSlots|4))가 addFollower 없이 자동으로
   * 따라온다(크로노 트리거식). 새 게임·불러오기·changeParty 마다 다시 맞춘다. 생략 = 기존 동작.
   */
  fromParty?: boolean;
  /**
   * true 면 궤적에 설 칸이 없는 동료를 숨기지 않고, 주인공에게서 걸어서 닿는 가장 가까운 빈 칸
   * (주인공·다른 동료·NPC 와 몸 길이만큼 떨어진 칸)에 세운다. 좁은 방에서 순간이동·장면 진입 직후
   * 동료가 사라지거나 한 칸에 겹쳐 보이던 문제(폴른 스타 가혹 검수 r8·r9). 생략 = 기존 동작(숨김).
   */
  spreadWhenBlocked?: boolean;
  /**
   * true 면 이벤트(대화·장면)가 도는 동안 둘째 동료부터 앞 동료 **옆**(몸 길이만큼 떨어진 칸)에 선다 — 한 줄 세로 대열 대신
   * ㄴ자 두 줄 대형. 장면이 끝나고 주인공이 걸으면 궤적 자리로 돌아온다(폴른 스타 가혹 검수 r11). 생략 = 기존 동작.
   */
  fanOutInScenes?: boolean;
  /**
   * false 면 파티 몬스터가 필드에서 주인공을 따라 걷지 않는다(HGSS 식 동행 끄기). 생략 = 따라온다 — 몬스터 동료는 주인공이
   * 떠난 칸으로 같은 박자에 한 칸 뒤를 걷는다(@/player/playSceneFollowers beginFollowerStep).
   */
  monsterFollowers?: boolean;
}

export interface MonsterCareConfig {
  /** Player steps between walk care ticks. Default 50. */
  stepsPerTick: number;
  /** Friendship granted to each party monster per walk tick. Default 1. */
  walkFriendship: number;
  /** EXP granted to each party monster per walk tick. Default 1. */
  walkExp: number;
  /** Max friendship points granted by walk ticks per calendar day. Default 30. */
  dailyCareCap: number;
}

export interface RewardPolicy {
  participationOnly?: boolean;
  levelGapPenalty?: boolean;
  /** 몬스터 파티 전투: 이번 전투에 나서지 않은 살아 있는 파티 몬스터도 경험치의 절반을 받는다(경험치 나누기). 생략 = 나선 몬스터만. */
  expShare?: boolean;
  /**
   * 3세대식 경험치 분배(몬스터 파티 전투): 참전해 쓰러지지 않은 몬스터만 받고, 얻은 경험치를 그 수로 나눈다(1 미만이면 1).
   * 생략 = 참전자 전원이 전액(쓰러진 참전자 포함) — 기존 동작.
   */
  expSplitAlive?: boolean;
  /** 트레이너 전 상금 = 상대 마지막 몬스터 레벨 × 이 값(3세대 공식). 생략·0 = 적 레코드의 rewards.gold 합(저작 고정값). */
  trainerPrizePerLevel?: number;
}
