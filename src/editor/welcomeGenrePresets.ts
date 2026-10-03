// editor/welcomeGenrePresets.ts
// Welcome genre chips → fixed AI prompt templates (map + monster/item DB seed checklist).

import { GENRE_PRESET_BRIEF_PREFIX } from "@/ai/genrePresetBrief";
import {
  detectNarrativeHorrorGenre,
  templateToolInstruction,
  type NarrativeHorrorGenre,
} from "@/ai/narrativeHorrorWorkPlan";
import type { GenrePackId } from "@/project/genrePackId";
import { gameDesignBriefContext, type GameDesignBrief } from "@/project/gameDesignBrief";
import { buildActionArenaAuthoringGuide } from "@/ai/actionArenaAuthoring";
import { BATTLE_SKINS, listActiveBattleSkinIds } from "@/battle/skins/registry";
import { battleLookMoodGuide } from "@/project/battleLook";
import {
  createGenreBlankProjectSystemPresetPlan,
  type GenreBlankProjectSystemPresetPlan,
} from "@/editor/genrePacks";
import {
  NEW_PROJECT_CHOICES,
  newProjectChoicePackAnchors,
  newProjectChoiceByLabel,
  type NewProjectChoiceId,
} from "@/editor/newProjectChoices";

/** 첫 화면 포스터 id — 정본(newProjectChoices)과 같은 집합이다. */
export type WelcomeGenrePresetId = NewProjectChoiceId;

export type WelcomeGenrePreset = {
  readonly id: WelcomeGenrePresetId;
  /** Deterministic authoring contract. AI may enhance it, but is not required to select it. */
  readonly packId: GenrePackId;
  readonly systemPresetRecipeId: string;
  readonly label: string;
  /** Short tone line injected into the shared checklist template. */
  readonly tone: string;
  /** Poster thumbnail for cinematic welcome grid. */
  readonly thumb: string;
  /** One-line subtitle under the poster label. */
  readonly blurb: string;
  /**
   * Poster eyebrow — the title people arrive with ("이브 같은"). Rendered above `posterTitle`
   * so a long reference label does not wrap into the poster caption.
   */
  readonly reference?: string;
  /** Poster caption. Defaults to `label` when the world quotes no reference. */
  readonly posterTitle?: string;
  /** Optional narrative/horror template genre for required tools. */
  readonly narrativeHorrorGenre?: NarrativeHorrorGenre;
};

/**
 * Shared authoring checklist for a genre chip.
 *
 * 2026-08-30 실측으로 세 줄이 바뀌었다:
 * - 옛 1번 "이미 blank로 교체된 상태"는 **거짓**이었다. 프리셋 핸드오프는 현재 열린 프로젝트를
 *   그대로 쓴다(mode.ts 의 replaceWithBlank=false). 거짓 전제를 주면 모델이 완성된 100×100
 *   마을에 create_map/set_build_spec 을 대고 거부당한다.
 * - 자율 런에는 사용자 승인 카드가 **없다**(assistantSession.maybeAutoApplyMilestone).
 *   "제안만 하고 승인을 기다려라"는 지시는 없는 게이트를 기다리게 만들어 모델이 설명만 하고
 *   멈추게 유도한다.
 */
export const WELCOME_GENRE_CHECKLIST_LINES = [
  "지금 열려 있는 프로젝트에 이어서 작업한다 — 기존 맵·이벤트·DB 를 먼저 읽고 거기에 얹는다.",
  "장르에 맞는 무대를 마련한다 — 쓸 맵이 없으면 만들고, 있으면 그 맵을 장르에 맞게 고친다.",
  "플레이어 시작 위치를 장르에 맞는 자리로 맞춘다.",
  "장르 핵심 NPC/이벤트를 최소 2개 둔다.",
  "몬스터/적 또는 상호작용 대상 시드를 DB에 넣는다.",
  "관련 아이템 시드를 DB에 넣는다.",
  "id 를 지어내지 않는다 — 트룹·몬스터·아이템을 참조하기 전에 조회 툴로 실제 id 를 확인한다.",
  "계획 항목을 하나씩 끝낸다 — 항목이 요구하는 툴을 실제로 성공시킨 뒤 다음 항목으로 넘어간다.",
] as const;

/**
 * 필수 템플릿 툴이 붙는 장르. 정본 선택지에는 없는 welcome 전용 축이라 여기 남긴다 —
 * 팩/레시피는 정본이 정하고, "어떤 프롬프트를 쓸지" 는 표면의 몫이다.
 */
const NARRATIVE_HORROR_GENRE_BY_CHOICE: Partial<Record<WelcomeGenrePresetId, NarrativeHorrorGenre>> = {
  "story-cutscene": "moon-cutscene",
  "horror-gallery": "ib-gallery",
  "school-horror": "witch-horror",
};

/**
 * 첫 화면 포스터의 뷰. 라벨·설명·썸네일·프롬프트 톤은 newProjectChoices 정본에서 오고,
 * 여기서는 프롬프트 전용 축(narrativeHorrorGenre)만 얹는다.
 */
export const WELCOME_GENRE_PRESETS: readonly WelcomeGenrePreset[] = NEW_PROJECT_CHOICES.map((choice) => ({
  id: choice.id,
  packId: choice.packId,
  systemPresetRecipeId: choice.systemPresetRecipeId,
  label: choice.label,
  tone: choice.tone,
  thumb: choice.thumb,
  blurb: choice.blurb,
  ...(choice.reference !== undefined ? { reference: choice.reference } : {}),
  ...(choice.posterTitle !== undefined ? { posterTitle: choice.posterTitle } : {}),
  ...(NARRATIVE_HORROR_GENRE_BY_CHOICE[choice.id] !== undefined
    ? { narrativeHorrorGenre: NARRATIVE_HORROR_GENRE_BY_CHOICE[choice.id] }
    : {}),
}));

export function welcomeGenrePresetById(id: string | undefined): WelcomeGenrePreset | undefined {
  return WELCOME_GENRE_PRESETS.find((preset) => preset.id === id);
}

/** Resolve a visual welcome variant to the canonical pack id persisted in project.system.genre. */
export function officialGenrePackIdForWelcomePreset(id: WelcomeGenrePresetId): GenrePackId {
  const preset = welcomeGenrePresetById(id);
  if (!preset) throw new Error(`Unknown welcome genre preset: ${id}`);
  return preset.packId;
}

/** Pure, non-destructive card selection path. Applying the returned plan is an explicit separate action. */
export function welcomeGenreSystemPresetPlanById(id: WelcomeGenrePresetId): GenreBlankProjectSystemPresetPlan {
  const preset = welcomeGenrePresetById(id);
  if (!preset) throw new Error(`Unknown welcome genre preset: ${id}`);
  return createGenreBlankProjectSystemPresetPlan(preset.packId, preset.systemPresetRecipeId);
}

export function welcomeGenrePresetByLabel(label: string): WelcomeGenrePreset | undefined {
  const choice = newProjectChoiceByLabel(label);
  return choice ? welcomeGenrePresetById(choice.id) : undefined;
}

function requiredTemplateBlock(genre: NarrativeHorrorGenre | undefined): string[] {
  if (!genre) return [];
  return [
    "",
    "## 필수 템플릿 툴 (원큐 조립 — upsert_event thrash 금지)",
    templateToolInstruction(genre),
    "위 템플릿 툴을 실제로 호출하세요. 설명만 하고 끝내지 마세요.",
  ];
}

/**
 * 회상 스토리 기획 경로의 연출 지시. 없던 때 조수는 script_cutscene 을 노출받고도 기억 진입·문 열림·엔딩을
 * upsert_event 대사 나열 + transfer 로만 만들어 기획의 「페이드·두 주인공 이동·카메라」를 전부 말없이 뺐다(2026-09-24).
 */
/** 기획 문장이 추리(단서·지목)를 시키는지. 회상 프리셋 안에서도 저택 사건을 컷신·스위치로 만들지 않게 한다. */
const MYSTERY_BRIEF_RE = /추리|탐정|용의자|지목|독살|살인사건/u;

export function textAsksForMystery(text: string): boolean {
  return MYSTERY_BRIEF_RE.test(text);
}

/**
 * 추리 저작 요령. 도구 이름을 적어 두면 그 스키마가 첫 턴부터 노출된다(mentionedToolSchemas).
 * 2026-09-24 도그푸딩 7회차: 회상 프리셋이 script_cutscene 만 찍어 계획은 증거 스위치였고,
 * 시공은 fill_region 나무 바닥 위에 author_mystery_case 를 올린 뒤 맨땅 경고를 무시하고 run_scene_test 로 끝냈다.
 */
export const MYSTERY_AUTHORING_GUIDE = [
  "추리 저작 요령 (조사·증거 제시·지목은 컷신이 아니다. 이 요령이 회상 컷신 지시보다 우선한다):",
  "- 실행 계획의 첫 시공 항목은 build_hand_interior_room 이다. 저택·서재·거실·주방은 참고문서 「손 도트 실내 (v5)」와 list_hand_interior_parts 로 가구를 읽고 build_hand_interior_room({mapId, plan, objects, …}) 으로 벽과 가구가 있는 새 맵에 짓는다. fill_region 으로 바닥 사각형을 깔아 방을 흉내 내지 않는다.",
  "- 다음 항목은 author_mystery_case 다. 단서·용의자 대화·증거 제시·지목·오답 엔딩을 스위치·변수나 place_npc·define_ending 으로 조립하지 않는다. 좌표는 그 방 안의 통행 칸이다. 쓰기 전에 check_mystery_case 로 검사한다.",
  "- author_mystery_case 요약이 「지금은 run_scene_test 를 호출하지 마라」이면 그 말을 따른다. 방을 지은 뒤 같은 caseId 로 다시 author_mystery_case 를 부르고, 요약이 data.verificationScene 을 run_scene_test 에 넣으라고 할 때만 검증한다.",
  "- script_cutscene 은 오프닝과 엔딩 에필로그만 쓴다. 오프닝·지목 선택지에 범인 이름을 단정하지 않는다.",
].join("\n");

export const MOON_CUTSCENE_STAGING_LINE =
  "연출은 script_cutscene 한 번으로 한 장면씩 쓰세요: 장면 진입은 trigger:'auto'·once:true 로 fade in → 인물 moveActor(이벤트 id·player) → camera pan/return → say, "
  + "조건이 모이면 열리는 장면(메멘토 다 모음 등)은 requiresSwitches, 다음 장면·기억으로 넘어갈 때는 switch·transfer 비트, 마지막은 ending 비트. "
  + "대사만 늘어놓은 upsert_event 로 컷신을 대신하지 말고, 기획에 적힌 연출을 못 넣었다면 미확인으로 보고하세요.";

/** Build the auto-send user message for a genre chip. */
/**
 * 몬스터 수집 장르 전용 저작 요령 — 도구 이름을 적어 두면 그 스키마가 첫 턴부터 노출된다(mentionedToolSchemas).
 * 2026-09-24 도그푸딩: 도로를 create_map 빈 잔디로 두고 끝냄, 트레이너 battleProcessing 13회 거부, 체육관이 야외 잔디(2회 연속 —
 * 「실내 맵」 한 줄로는 안 바뀌었다. 개념 꾸러미가 빈 몬스터 프로젝트에서는 run_interior_room_pipeline 이 거부되므로 던전 방 파이프라인을 쓴다).
 */
export const MONSTER_COLLECT_AUTHORING_GUIDE = [
  "몬스터 수집 저작 요령:",
  "- 전투는 잡은 몬스터가 싸운다 — configure_monster_system 을 부를 때는 battleParty:true 를 함께 준다.",
  "- 첫 파트너는 give_starter_monsters(3종 선택 + 재지급 방지)로 만든다.",
  "- 도로·필드 맵은 create_map 뒤 author_wild_route({mapId, exits, grassPatches, encounters:[{troopId,weight}]}) 로 흙길·숲·키큰 풀숲과 「풀숲에서만」 나오는 야생 조우를 한 번에 시공한다. 결과 exits 칸에 create_transfer_pair 로 문을 달고, trainerSpots 에 트레이너를 둔다.",
  "- 트레이너·관장은 place_npc 페이지 commands 에 {kind:\"battleProcessing\", troopId:\"조회한 troop id\", canEscape:false, canLose:false} 를 넣는다. 트레이너의 몬스터는 upsert_enemy(speciesId) → upsert_troop 로 만든다.",
  "- 체육관은 create_map 빈 잔디로 만들지 않는다 — run_dungeon_room_pipeline({mapId:\"map_gym\", name:\"○○ 체육관\", theme:\"stone\", character:\"crypt\", path:\"straight\", hazard:false, linkMapId:\"들어오는 맵\"}) 로 석상이 선 돌 회관을 시공하고, 관장은 입구에서 먼 안쪽 칸에 place_npc 로 세운다.",
  "- 연구소·회복 센터·상점은 마을 집 실내를 쓴다 — 그 맵 이름을 시설 이름으로 바꾸고(set_map_properties) 마을 문 앞에 표지판을 둔다.",
].join("\n");

/** 마법사로 시작한 게임의 임시 제목 — 조수가 기획에 맞는 제목으로 바꾼다(레시피 이름이 게임 제목이 되던 결함). */
export const UNNAMED_GAME_TITLE = "새 게임";

export const ADVENTURE_JRPG_AUTHORING_GUIDE = [
  "턴제 JRPG 저작 요령:",
  "- 전투 능력치는 배우 parameterCurves 가 정본이다(직업 곡선은 직업 변경 뒤에만). 파티원마다 역할이 보이게 upsert_actor parameterCurves 에 [Lv1값, Lv99값] 을 준다 — 예: 검사 maxHp:[120,2400], 마법사 maxMp:[40,800]·mind:[30,300].",
  "- 무기·방어구는 upsert_equipment(slot, statBonuses, price)로 만들고, 상점은 make_villager({shop:{stock:[{itemId}]}}) 또는 set_shop_stock 으로 장비 id 와 아이템 id 를 진열한다. 골드만 깎고 대사로 「샀다」 하는 선택지는 만들지 않는다.",
  "- 던전 층마다 set_encounter_table(mapId, entries, encounterRate) 로 무작위 전투를 넣고, 깊을수록 강한 적 그룹을 쓴다.",
  "- 적 수치는 위에서 정한 파티 능력치 척도로 새로 정한다(기본 DB 적은 다른 척도일 수 있다). 잡몹은 simulate_battle 로 이기되 피해를 입고, 보스는 합류가 끝난 파티로 몇 레벨 올린 뒤 회복·MP 를 써야 이기는지 확인하고 tune_enemy 로 맞춘다.",
  "- 턴제 JRPG 에는 시간 시스템(configure_time_system)·주민 시간표·선물 선호가 필요 없다. 기획이 요구하지 않으면 만들지 않는다.",
].join("\n");

/**
 * 미술관 퍼즐 호러 저작 요령. 2026-09-24 도그푸딩: 기획의 「꽃잎 5장이 체력, 0장이면 게임오버」를 함정마다
 * setVariable -= 1 로 흩뿌려 시작값 0·게임 오버 없음·꽃잎 HUD 없음이 됐다. 도구 이름을 지시문에 적어야
 * 첫 요청에 그 도구가 노출된다(mentionedToolSchemas).
 */
export const HORROR_GALLERY_AUTHORING_GUIDE = [
  "미술관 퍼즐 호러 저작 요령:",
  "- 꽃잎·장미처럼 부서지는 생명(체력)은 set_life_flower({name,max,showAfterSwitchId,defeatEndingId?}) 한 번으로 만든다 — 체력 변수·꽃잎 HUD·피해/회복 공용 이벤트·0장 게임 오버가 함께 생긴다.",
  "- 튀어나오는 그림·검은 손·가시 바닥 이벤트에는 {kind:\"callCommonEvent\",commonEventId:\"ce_life_damage\"}, 꽃병에는 {kind:\"callCommonEvent\",commonEventId:\"ce_life_restore\"} 를 넣는다. 체력 변수를 setVariable 로 직접 깎지 않는다.",
  "- 열쇠·레버·순서 퍼즐은 compile_puzzle(item-gate·switch-sequence·password)로 만들고, 조건 분기는 {kind:\"fork\",condition:{kind:\"switch\",switchId,value:true},then:[…]} 모양이다.",
  "- 맵마다 set_scene_mood({mapId, applyMode:\"map\", lighting:{ambient:0.35, color:\"#1a1024\"}}) 로 어둡게 둔다. 기본 조명(ambient 1)은 전시실이 낮처럼 밝다.",
  "- 전시실·화실 같은 실내는 build_hand_interior_room({mapId, plan, floor, wall, objects}) 로 벽·천장·가구까지 한 번에 짓는다. 먼저 list_hand_interior_parts 로 가구 id(그림·조각상·진열장)를 찾아라. fill_region·paint_tiles 로 바닥만 깔아 빈 판으로 끝내지 말 것.",
  "- 문간·한 칸 통로에 인물을 세우지 마라. 대화를 마친 페이지는 priority:\"below\" 와 overlapForbidden:false 로 비켜 준다.",
].join("\n");

/**
 * 추격 호러 저작 요령. 도구 이름을 지시문에 적어야 첫 요청에 그 스키마가 노출된다(mentionedToolSchemas).
 * 2026-09-24 도그푸딩 r6 「잿빛 저택의 술래」: 방이 벽 없는 벽돌 바닥, 금고 암호가 선택지 「4729」,
 * 옷장은 사람 그림이고 추격 스위치를 꺼서 숨는 척을 했다. 진짜 은신처는 옆 칸의 투명 이벤트였다.
 */
export const HORROR_CHASE_AUTHORING_GUIDE = [
  "추격 호러 저작 요령:",
  "- 방(현관·복도·서재·침실·창고)은 build_hand_interior_room(plan, 새 mapId)로 벽이 있는 실내를 만든다. fill_region·paint_tiles 로 벽돌 바닥만 깔아 빈 판을 만들지 말 것.",
  "- 방 사이 문은 create_transfer_pair 를 벽·가장자리 통행 칸에 두고, 그 칸에 place_door 로 문 그림을 붙인다. 방 한가운데 투명 칸으로 두지 말 것.",
  "- 방을 잇는 유일한 통로(문간) 칸에는 playerTouch 컷신·즉사 함정을 얹지 말 것 — 밟는 이벤트가 유일한 길을 막아 자동 검사가 끝까지 못 간다(막힘). 조우 컷신은 통로 옆 조사(action) 이벤트로 두고, 통로 칸에는 create_transfer_pair 문만 두세요.",
  "- 추격자는 make_chase_scene. speed 6, killOnTouch true, checkpointOnEntry true. 여러 방이면 pursuit 에 scope:\"connected\" 만 주고 tracking 은 생략한다(스위치를 켜 깨우면 persistent 가 기본. lastSeen 을 직접 넣으면 벽 너머에서 안 움직인다). activateSwitch 를 켜는 트리거를 같은 흐름에 만든다.",
  "- 옷장 은신은 hidingSpots:[{x,y,mapId}] 를 옷장과 같은 칸에 준다(다른 방이면 mapId). 옆 칸의 투명 은신처는 플레이어가 못 찾는다. 추격 스위치를 setSwitch value:false 로 끄지 말 것 — 추격자가 사라질 뿐 수색하지 않는다.",
  "- 금고·자물쇠의 숫자 암호는 compile_puzzle({kind:\"password\", answer:\"4자리 숫자\", at:{x,y}, prompt:\"암호를 입력한다.\", onSolve:{setSwitch, message}}) 로 만든다. 1~6자리 숫자는 inputNumber 가 된다. 선택지 보기에 정답 숫자를 적지 말 것. 쪽지는 조사 대사 본문에만 숫자를 적는다.",
  "- 옷장·쪽지·문·금고에 사람 charset 을 붙이지 말 것. 서 있는 인물만 place_npc.",
  "- 붙잡히면 killPlayer 로 게임 오버하고 진입 체크포인트에서 재개한다. 꽃잎 체력은 만들지 말 것.",
].join("\n");

export function buildWelcomeGenrePresetPrompt(preset: WelcomeGenrePreset, brief?: GameDesignBrief): string {
  if (brief) {
    if (brief.presetId !== preset.id) throw new Error("게임 기획과 프리셋이 다릅니다.");
    return [
      `${GENRE_PRESET_BRIEF_PREFIX} ${preset.label}`,
      gameDesignBriefContext(brief),
      "확정된 기획의 첫 제작 범위만 실제 편집 도구로 구현하세요. 핵심 행동 → 진행 → 사건의 결과가 이어지는 플레이 가능한 구간을 만드세요.",
      "현재 프로젝트의 시스템 설정·맵·DB·타일 참고문서를 먼저 읽으세요. 기존 실제 ID를 조회한 뒤 참조하고, 저작 도구의 실행 결과를 확인하세요.",
      "기본 프리셋의 분위기나 임의의 NPC·아이템 수로 사용자 기획을 덮어쓰지 마세요. 분위기 변주만으로 선택한 수집·육성·전투 시스템을 끄지 마세요.",
      ...(brief.interview ? [
        "interview.genre/secondary는 사용자가 고른 장르이고 preset은 이를 실행하는 엔진이다. 관계·연애를 회상 수집물로, 추리를 공포 추격으로 임의 변환하지 않는다. 두 장르를 고른 경우 blend에 적은 연결 방식과 각각의 핵심 행동을 실제 이벤트·상태·결과로 연결한다.",
        "아래 장르 저작 요령은 도구 사용 참고다. 선택한 조우가 교감·부화라면 3종 스타터 선택이나 포획을 강제하지 말고, 선택한 방식으로 동료 획득과 중복 방지를 구현한다. 미술은 16비트 JRPG풍의 선명한 도트와 제한된 색 단계로 통일한다. 회화·매끈한 그라데이션·안티앨리어싱으로 도트를 흉내 낸 자산은 반려하고 다시 제작·검수한다.",
        "기존 첫 구간 뼈대의 인물·대사·기억 조사·스타터는 사용자 설정이 아니라 임시 시드다. 확정 기획의 핵심 행동으로 고치되 시작부터 구간 끝까지의 연결과 검증 계약을 보존한다.",
      ] : []),
      "타이틀 화면과 오프닝은 새 프로젝트 자리표시입니다(오프닝은 제목 카드뿐일 수 있습니다). 기획에 맞게 set_title_screen 으로 타이틀을, edit_opening/set_opening 으로 게임 안 목소리의 도입을 바꾸세요. 기획 요약을 그대로 옮기지 말고, 범인·반전 같은 정답은 도입에 쓰지 마세요.",
      WELCOME_DIALOGUE_LOOK_LINE,
      "한국어로 진행하고, 생성 후 기획의 핵심 흐름을 검증하세요. 작성·실행 확인·미확인을 구별해 보고하세요.",
      `게임 제목이 아직 「${UNNAMED_GAME_TITLE}」 같은 기본값이면 기획에 맞는 제목을 지어 set_project_settings({title}) 로 저장하세요(타이틀 화면에도 반영됩니다).`,
      ...(preset.packId === "monster-collect" ? [MONSTER_COLLECT_AUTHORING_GUIDE] : []),
      ...(preset.packId === "adventure-jrpg" ? [ADVENTURE_JRPG_AUTHORING_GUIDE, welcomeBattleLookLine()] : []),
      ...(preset.narrativeHorrorGenre === "moon-cutscene" ? [MOON_CUTSCENE_STAGING_LINE] : []),
      ...(textAsksForMystery(brief.summary) || brief.interview?.genre === "mystery" || brief.interview?.secondary === "mystery" ? [MYSTERY_AUTHORING_GUIDE] : []),
      ...(preset.id === "horror-gallery" ? [HORROR_GALLERY_AUTHORING_GUIDE] : []),
      ...(preset.id === "school-horror" ? [HORROR_CHASE_AUTHORING_GUIDE] : []),
    ].join("\n\n");
  }
  if (preset.packId === "action-rpg") {
    return [
      `${GENRE_PRESET_BRIEF_PREFIX} ${preset.label}`,
      `톤: ${preset.tone}`,
      buildActionArenaAuthoringGuide(),
      WELCOME_DIALOGUE_LOOK_LINE,
      "한국어로 진행하고, 도구로 실제 2D 액션 전투 공간을 저작하세요.",
    ].join("\n\n");
  }
  const checklist = WELCOME_GENRE_CHECKLIST_LINES.map((line, index) => `${index + 1}. ${line}`).join("\n");
  return [
    `${GENRE_PRESET_BRIEF_PREFIX} ${preset.label}`,
    `톤: ${preset.tone}`,
    "",
    "다음 체크리스트를 모두 만족하도록 실제 편집 툴을 호출해 작업하세요. 설명만 하고 끝내지 마세요.",
    checklist,
    ...requiredTemplateBlock(preset.narrativeHorrorGenre),
    ...(preset.id === "horror-gallery" ? ["", HORROR_GALLERY_AUTHORING_GUIDE] : []),
    ...(preset.id === "school-horror" ? ["", HORROR_CHASE_AUTHORING_GUIDE] : []),
    ...(preset.packId === "adventure-jrpg" ? ["", welcomeBattleLookLine()] : []),
    "",
    WELCOME_DIALOGUE_LOOK_LINE,
    "한국어로 진행하고, 도구로 맵·이벤트·DB를 실제로 구성하세요.",
  ].join("\n");
}

/**
 * 장르 칩 핸드오프의 «보이는 문장». 모델은 `buildWelcomeGenrePresetPrompt` 전체를 읽지만, 사용자 말풍선에는
 * 자기가 고른 것만 남긴다.
 * 체크리스트·「한국어로 진행하고…」 같은 내부 지시가 사용자 말로 보이면 안 된다(2026-09-23 실측).
 *
 * 기획이 있으면 확정 요약(인터뷰 답 또는 사용자가 고친 요약)을 줄 단위로 보인다. 예전에는 첫 답과 범위만
 * 24자로 잘라 한 줄로 붙여서, 모델은 다섯 답을 다 받는데도 사용자에게는 인터뷰가 안 넘어간 것처럼 보였다
 * (2026-09-28 신고). 요약이 길면 BRIEF_DISPLAY_LIMIT 에서 자른다 — 전문은 모델 쪽 지시문과 「게임 기획」 메뉴에 있다.
 */
const BRIEF_DISPLAY_LIMIT = 600;

export function welcomeGenrePresetDisplayText(preset: WelcomeGenrePreset, brief?: GameDesignBrief): string {
  if (brief) {
    const lines = brief.summary.replace(/\r\n?/gu, "\n").split("\n").map((line) => line.replace(/[ \t]+/gu, " ").trim()).filter(Boolean);
    let body = lines.join("\n");
    if (body.length > BRIEF_DISPLAY_LIMIT) body = `${body.slice(0, BRIEF_DISPLAY_LIMIT - 1).trimEnd()}…`;
    return body ? `${preset.label} · 확정한 게임 기획\n${body}` : preset.label;
  }
  const short = (text: string | undefined): string => {
    const line = (text ?? "").split(/\r?\n/u)[0]!.replace(/\s+/gu, " ").trim();
    return line.length > 24 ? `${line.slice(0, 23)}…` : line;
  };
  return [...new Set([preset.label, short(preset.blurb)].filter(Boolean))].join(" · ");
}

/** 자유 입력 핸드오프의 «보이는 문장» — 사용자가 친 한 문장 그대로. */
export function welcomeFreeTextDisplayText(userIntent: string): string {
  return userIntent.trim();
}

/**
 * 첫 제작 때 대화창·화자 목소리를 고르게 하는 지시. 장르 추천 스타일은 코드가 이미 깔아 두므로
 * (projectInterviewStartup·reset_project) 여기서는 톤이 다를 때만 바꾸고, 인물별 차이를 만들게 한다.
 */
export const WELCOME_DIALOGUE_LOOK_LINE =
  "대화창: 기획 톤에 맞는 대화창 스타일을 set_project_settings 의 dialogue.style 로 고르세요(장르 추천값이 이미 깔려 있으니 톤이 다를 때만 바꾸기). "
  + "주요 인물은 upsert_character_profile 의 dialogue 로 이름 색·목소리·음 높이·말 빠르기를 서로 다르게 정하고, "
  + "내레이션·속마음·표지판·편지·안내 문구는 대사의 context(narration/thought/sign/letter/system)로 구별하세요. "
  + "지나가는 마을 사람 잡담은 container:\"bark\"(게임을 안 멈춤), 짧은 대꾸는 balloon, 무전은 corner 로 두고, "
  + "감정이 튀는 대목은 본문 태그 [흔들]…[/]·[크게]…[/]·[쉼:0.5]·[표정:놀람] 을 아껴 쓰세요.";

/**
 * 첫 제작 때 전투 화면 꾸미기(system.battleLook)를 기획 톤에 맞춰 고르게 하는 지시. 없던 때 조수는 이 칸이 있는 줄 몰라
 * 어떤 게임이든 기본 「도트 창」 그대로 두었다(2026-10-02). 꾸밈은 도트 측면 스킨에서만 보이므로 그 스킨 id 를 함께 준다.
 */
export function welcomeBattleLookLine(): string {
  const sideSkins = listActiveBattleSkinIds().filter((id) => BATTLE_SKINS[id].motionStyle === "retro");
  return "전투 화면: 턴제 전투가 있으면 기획 톤에 맞는 전투 화면 프리셋을 set_project_settings 의 battle.look.preset 으로 고르세요. "
    + "기본 pixel 은 고전 레트로·향수를 노린 게임에만 그대로 둡니다. "
    + `꾸밈은 도트 측면 전투(battle.uiStyle: ${sideSkins.join("·")}, 기본)에서만 보이고 몬스터 대치(pokemon)에는 보이지 않습니다. `
    + `분위기 안내: ${battleLookMoodGuide()}. `
    + "프리셋 위에 accent(#rrggbb 강조색)·party·command 칸을 덧바꿔 게임 색을 맞춰도 됩니다.";
}

const TURN_BATTLE_INTENT_RE = /전투|턴제|던전|보스|RPG|용사|모험/iu;

/** 자유 문장이 턴제 전투를 시키는지(전투 화면 꾸미기 지시를 붙일지). */
export function textAsksForTurnBattle(text: string): boolean {
  return TURN_BATTLE_INTENT_RE.test(text);
}

/** Free text keeps the user's scope; structured intent selects a recipe later. */
export function buildWelcomeFreeTextPrompt(userIntent: string): string {
  const intent = userIntent.trim();
  const genre = detectNarrativeHorrorGenre(intent);
  return [
    `사용자 의도: ${intent}`,
    "",
    "지금 열려 있는 프로젝트에 이어서 작업한다 — 기존 맵·이벤트·DB 를 먼저 읽고 거기에 얹는다.",
    "사용자가 요청한 범위만 실제 편집 툴로 작성하세요. 구조화된 의도에 맞는 저작 순서를 따르고, 요청하지 않은 NPC·아이템·퀘스트·상점·보스·보상·페이지 수를 할당하지 마세요.",
    ...requiredTemplateBlock(genre ?? undefined),
    ...(textAsksForTurnBattle(intent) ? ["", welcomeBattleLookLine()] : []),
    "",
    WELCOME_DIALOGUE_LOOK_LINE,
    "한국어로 진행하고, 도구로 맵·이벤트·DB를 실제로 구성하세요.",
  ].join("\n");
}

/** Secondary inspirations — compact chips in the unified worlds row. */
export type WelcomeInspirationMini = {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
  readonly thumb: string;
  /** Free-text intent used when user starts from this mini. */
  readonly intent: string;
};

export const WELCOME_INSPIRATION_MINIS: readonly WelcomeInspirationMini[] = [
  {
    id: "dream-psych",
    label: "심리·꿈 탐험",
    blurb: "안전한 방과 이상한 꿈세계",
    thumb: "/assets/generated/welcome/mini-01-omori.png",
    intent: "안전한 방과 이상한 꿈세계를 오가는 심리 탐험 게임",
  },
  {
    id: "surreal-doors",
    label: "초현실 꿈 워프",
    blurb: "문으로 이어지는 기묘한 세계",
    thumb: "/assets/generated/welcome/mini-02-yume.png",
    intent: "방에서 문으로 이상한 세계를 탐험하는 초현실 어드벤처",
  },
  {
    id: "memory-story",
    label: "감동 스토리",
    blurb: "회상과 감정이 중심",
    thumb: "/assets/generated/welcome/mini-03-moon.png",
    intent: "전투보다 회상과 감정이 중심인 스토리 어드벤처. script_cutscene_preset 필수.",
  },
  {
    id: "mansion-horror",
    label: "저택 호러",
    blurb: "고전 저택 탐험",
    thumb: "/assets/generated/welcome/mini-04-mansion.png",
    intent: "저택을 탐험하는 고전 도트 호러. make_horror_loop로 트랩+체크포인트+추격 (기존 작품 고유명/캐릭터 복제 금지)",
  },
  {
    id: "meta-choice",
    label: "메타 선택 서사",
    blurb: "대화와 선택",
    thumb: "/assets/generated/welcome/mini-05-meta.png",
    intent: "대화와 선택이 중요한 메타 감성 JRPG (기존 작품 고유명/캐릭터 복제 금지)",
  },
  {
    id: "modern-psi",
    label: "현대 초능력 JRPG",
    blurb: "현대 마을 배경",
    thumb: "/assets/generated/welcome/mini-06-mother.png",
    intent: "현대 마을을 배경으로 한 초능력 JRPG (고유명 복제 금지)",
  },
] as const;

/**
 * 정본 순서 그대로. featured 3장이 먼저 오므로 팩 앵커는 가능한 한 보이는 포스터에 붙는다
 * (newProjectChoices 의 순서 계약이 여기서도 성립한다).
 */
const WELCOME_POSTER_ORDER: readonly WelcomeGenrePresetId[] =
  NEW_PROJECT_CHOICES.map((choice) => choice.id);

export type WelcomePosterCard = {
  readonly preset: WelcomeGenrePreset;
  /** Small line above the title, present only when the world quotes a reference. */
  readonly reference?: string;
  readonly title: string;
  /** True when the poster is mounted on the start surfaces. Other catalog posters are not shown there. */
  readonly featured: boolean;
  /**
   * Anchor poster for its official pack, or null for a sibling variant of a pack already anchored.
   * Exactly one poster per GenrePackId is an anchor, so the five-official-packs DOM gate
   * (scripts/browser-verify-genre-presets.mts) keeps its exactly-once contract while variants of the
   * same pack remain peers — featured or collapsed.
   */
  readonly packAnchor: GenrePackId | null;
};

function buildPosterCards(): readonly WelcomePosterCard[] {
  const featured = new Set<WelcomeGenrePresetId>(
    NEW_PROJECT_CHOICES.filter((choice) => choice.featured).map((choice) => choice.id),
  );
  const anchors = newProjectChoicePackAnchors();
  return WELCOME_POSTER_ORDER.map((id) => {
    const preset = welcomeGenrePresetById(id);
    if (!preset) throw new Error(`Unknown welcome poster preset: ${id}`);
    return {
      preset,
      reference: preset.reference,
      title: preset.posterTitle ?? preset.label,
      featured: featured.has(id),
      packAnchor: anchors[id],
    };
  });
}

export const WELCOME_POSTER_CARDS: readonly WelcomePosterCard[] = buildPosterCards();
export const WELCOME_FEATURED_POSTER_CARDS: readonly WelcomePosterCard[] =
  WELCOME_POSTER_CARDS.filter((card) => card.featured);
export const WELCOME_HIDDEN_POSTER_CARDS: readonly WelcomePosterCard[] =
  WELCOME_POSTER_CARDS.filter((card) => !card.featured);

export type WelcomeStarterTemplateId = "snow-village-inn" | "forest-dungeon" | "reunion-cutscene" | "harbor-market";

export type WelcomeStarterTemplate = {
  readonly id: WelcomeStarterTemplateId;
  readonly label: string;
  readonly blurb: string;
  readonly thumb: string;
  readonly intent: string;
};

export const WELCOME_STARTER_TEMPLATES: readonly WelcomeStarterTemplate[] = [
  { id: "snow-village-inn", label: "눈 마을 여관", blurb: "따뜻한 불빛과 단골손님", thumb: "/assets/generated/welcome/slide-00-hero.png", intent: "눈 내리는 마을 한가운데 여관 — 여관주인과 단골손님이 등장하는 오프닝 컷신과 밤 이벤트" },
  { id: "forest-dungeon", label: "숲속 던전", blurb: "입구부터 보스까지", thumb: "/assets/generated/welcome/slide-04.png", intent: "숲속 던전 입구부터 보스 방까지 이어지는 짧은 모험 — 보물상자·전투·열쇠 이벤트 포함" },
  { id: "reunion-cutscene", label: "재회 컷신", blurb: "대사와 감정 중심", thumb: "/assets/generated/welcome/mini-03-moon.png", intent: "오랜 친구와의 재회 컷신 — 대화, 회상 연출, 선택지로 갈리는 엔딩" },
  { id: "harbor-market", label: "항구 시장", blurb: "상인과 손님의 하루", thumb: "/assets/generated/welcome/slide-03.png", intent: "항구 시장이 있는 마을 — 상점, 손님 NPC, 낮/밤 일과가 있는 생활 마을" },
] as const;

/**
 * Second tier of the gallery — free-text worlds, collapsed until asked for. These entries carry an
 * `intent` instead of a pack, so they run the same path as typing into the prompt row.
 */
export type WelcomeMoreWorld = {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
  readonly thumb: string;
  readonly intent: string;
};

export const WELCOME_MORE_WORLDS: readonly WelcomeMoreWorld[] = [
  ...WELCOME_INSPIRATION_MINIS,
  ...WELCOME_STARTER_TEMPLATES,
] as const;
