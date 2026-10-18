import type { NewProjectChoiceId } from "@/editor/newProjectChoices";
import type { FlagshipBeat, FlagshipBeatManifest, FlagshipDemoId, FlagshipStyleLock } from "./types";

const BANNED_IP_PROPER_NOUNS = [
  "마르",
  "루카",
  "트루스",
  "가르디아",
  "그랜드리온",
  "라보스",
  "케프카",
  "울트로스",
  "블랙잭",
  "포켓몬",
  "피카츄",
] as const;

export const CHRONO_BELL_STYLE_LOCK: FlagshipStyleLock = {
  demoId: "chrono-bell",
  presetId: "adventure-jrpg",
  resolution: { width: 480, height: 270 },
  cameraZoom: 2,
  dialogueStyle: "pixel-cinematic",
  allowedTilesetIds: [
    "beodeul_city",
    "atlas_biome_interior",
    "gothic_manor",
    "snow_north",
    "steampunk_city",
    "prehistoric",
    "sky_island",
    "sf_station",
    "desert_east",
  ],
  allowedCharsetPrefixes: ["easyrpg-charset-", "tex_easyrpg_charset_", "oprn-charset-heroes"],
  allowedPortraitPrefixes: ["shared-", "oprn-still-", "oprn-pack-still-"],
  bannedProperNouns: BANNED_IP_PROPER_NOUNS,
} as const;

export const EMERALD_CROWN_STYLE_LOCK: FlagshipStyleLock = {
  demoId: "emerald-crown",
  presetId: "monster-collect",
  resolution: { width: 480, height: 320 },
  cameraZoom: 2,
  dialogueStyle: "handheld",
  allowedTilesetIds: [
    "monster_overworld",
    "monster_wild",
    "monster_coast",
    "monster_climate",
    "monster_rooms",
    "monster_dungeon",
    "monster_gyms",
  ],
  allowedCharsetPrefixes: [
    "scarloxy-charset-",
    "tex_scarloxy_charset_",
    "oprn-charset-scarloxy-",
    "tex_oprn_charset_scarloxy_",
    "oprn-charset-harness-monster",
    "tex_oprn_charset_harness_monster",
  ],
  allowedPortraitPrefixes: ["oprn_emerald_", "harness-monster-", "mx_art_"],
  bannedProperNouns: BANNED_IP_PROPER_NOUNS,
} as const;

export const SHITAMACHI_STYLE_LOCK: FlagshipStyleLock = {
  demoId: "shitamachi-fourth-season",
  presetId: "story-cutscene",
  resolution: { width: 1024, height: 768 },
  cameraZoom: 3.2,
  dialogueStyle: "dual-fullbody-veil",
  allowedTilesetIds: ["jp_city", "modern_city", "modern_campus"],
  allowedCharsetPrefixes: ["oprn-charset-modern", "tex_oprn_charset_modern"],
  allowedPortraitPrefixes: ["shared-modern-"],
  bannedProperNouns: BANNED_IP_PROPER_NOUNS,
} as const;

export const FLAGSHIP_STYLE_LOCKS: Readonly<Record<FlagshipDemoId, FlagshipStyleLock>> = {
  "chrono-bell": CHRONO_BELL_STYLE_LOCK,
  "emerald-crown": EMERALD_CROWN_STYLE_LOCK,
  "shitamachi-fourth-season": SHITAMACHI_STYLE_LOCK,
} as const;

export const CHRONO_BELL_BEATS: readonly FlagshipBeat[] = [
  {
    id: "cb_beat_00_opening",
    atMinute: 0,
    act: "0막 · 6컷 픽셀 애니메틱",
    mapKey: "opening_stage_384x216",
    sceneTitle: "천년제의 종소리와 갈라진 하늘",
    playerFeel: "0초부터 384×216 정수 격자 위에서 구름 스크롤·빛줄기·분수 팔레트 루프·인물 보행이 겹쳐 움직인다.",
    mechanics: ["create_opening_animatic_shot", "set_opening_pixel_grid", "set_opening_region_loop", "upsert_opening_light_fx", "set_opening"],
    sharedAssets: ["oprn-still-kingdom-day", "oprn-still-manor-night", "oprn-still-snow-village", "oprn-still-desert-ruin", "oprn-still-dark-citadel", "oprn-still-farm-golden"],
  },
  {
    id: "cb_beat_01_millennial_fair",
    atMinute: 1.5,
    act: "1막 · 벨하임 천년제 광장 & 왕성 알현실",
    mapKey: "ct_truce_fair_hub",
    sceneTitle: "범종 신호와 텔레포드 시연 · 세린과 토우 합류",
    playerFeel: "꽃잎 입자(petals)가 흩날리는 축제 광장에서 2단계 범종·텔레포드 출력 선택지 퍼즐을 풀고, 왕성 알현실 근위대장 오르벤(knight-fallen)을 넘어 왕녀 세린·발명가 토우가 파티에 합류한다.",
    mechanics: ["author_jrpg_chapter", "changeParty", "changeTile", "create_time_gate", "set_scene_mood"],
    sharedAssets: ["beodeul_city", "atlas_biome_interior", "generated-enemy-knight-fallen"],
  },
  {
    id: "cb_beat_02_cathedral_organ",
    atMinute: 7,
    act: "2막 · 안개 묘지 언덕 & 대성당 예배당 & 마왕성 지하",
    mapKey: "ct_middle_ages_chapel",
    sceneTitle: "파이프 오르간 2단계 공명과 비밀 계단 개방",
    playerFeel: "안개 낀 중세 예배당에서 파이프 오르간 성가 화음과 숨은 레버 2단계 선택지를 풀면 changeTile로 바닥 타일이 실제로 열리고, 개굴경 바르도가 합류해 마왕성 지하로 진입한다.",
    mechanics: ["changeTile", "choices", "changeParty", "script_cutscene"],
    sharedAssets: ["gothic_manor", "beodeul_city", "generated-enemy-demon-lord"],
  },
  {
    id: "cb_beat_03_snow_mine_and_clocktower",
    atMinute: 14,
    act: "3막 · 설원 광산 벨른 & 시계탑 도시 크로노스 & 아리아 돔",
    mapKey: "ff6_narshe_mine",
    sceneTitle: "광산 선로 전환기 · 6:10:50 시계탑 · 아리아 돔 에너트론",
    playerFeel: "설원 광산에서 2단계 선로 레버·브레이크 퍼즐을 풀고, 아리아 돔(sparks 입자)의 에너트론 회복 캡슐로 전원을 회복한 뒤, 증기 시계탑 6:10:50 수수께끼를 풀어 로코·리아·노바와 재집결한다.",
    mechanics: ["recoverAll", "choices", "changeParty", "set_scene_mood"],
    sharedAssets: ["snow_north", "steampunk_city", "sf_station", "sky_island"],
  },
  {
    id: "cb_beat_04_volcano_final_boss",
    atMinute: 21,
    act: "4막 · 화산 협곡 & 잔해의 탑 정상 제단",
    mapKey: "ct_prehistory_canyon",
    sceneTitle: "용암 부싯돌 봉인 해제 · 나크타르 & 고대 용 아스칼 결전 · 멀티 엔딩",
    playerFeel: "불씨(embers)가 날리는 화산 협곡에서 용암 부싯돌로 잠긴 동굴 입구를 열고, 9칸 레트로 보스(마왕 나크타르 demon-lord & 고대 용 아스칼 dragon-red)를 격파해 성검 복원 여부에 따른 2종 엔딩에 도달한다.",
    mechanics: ["fork", "battleProcessing", "define_ending", "triggerEnding"],
    sharedAssets: ["prehistoric", "generated-enemy-demon-lord", "generated-enemy-dragon-red"],
  },
] as const;

export const EMERALD_CROWN_BEATS: readonly FlagshipBeat[] = [
  {
    id: "ec_beat_00_opening",
    atMinute: 0,
    act: "0막 · 6컷 2× 픽셀 애니메틱",
    mapKey: "emerald_opening_480x320",
    sceneTitle: "새벽섬 팬 → 1번길 풀숲 → 연구소 → 스타터 무대 → 체육관 VS → 출발",
    playerFeel: "480×320 무대에서 캠페인 실제 맵 배경과 2배 정수 도트 캐릭터·몬스터가 6컷 애니메틱으로 이어진다.",
    mechanics: ["configureEmeraldMonsterOpening", "emeraldOpeningShot"],
    sharedAssets: ["oprn_emerald_opening_dawn", "oprn_emerald_opening_route", "oprn_emerald_opening_lab", "oprn_emerald_opening_stage", "oprn_emerald_opening_gym", "oprn_emerald_opening_town"],
  },
  {
    id: "ec_beat_01_home_to_lab",
    atMinute: 1.5,
    act: "1막 · 내 방 2F → 우리 집 1F → 새벽섬 마을 → 천문박사의 연구소",
    mapKey: "mx_map_lab",
    sceneTitle: "새싹토·찌릿토·물방토 3스타터 선택 카드 & 라이벌 나루 첫 대결",
    playerFeel: "내 방 2F에서 계단을 내려가 엄마에게 인사한 뒤 새벽섬 연구소에서 200% 정수 배율 프리뷰 카드로 첫 동료를 고르고, 필드 동행(follower)과 함께 라이벌 나루와 첫 배틀을 치른다.",
    mechanics: ["starterChoiceCommands", "battleProcessing", "transfer"],
    sharedAssets: ["monster_rooms", "monster_overworld", "harness-monster-leafling-front", "harness-monster-sparkit-front", "harness-monster-aqualing-front"],
  },
  {
    id: "ec_beat_02_route1_and_grove_town",
    atMinute: 6,
    act: "2막 · 1번길 새벽 들판 → 초록마을 → 2번길 초록 정원",
    mapKey: "mx_map_meadow",
    sceneTitle: "풀숲 야생 조우·포획구슬 투척 & 시야선 트레이너 배틀",
    playerFeel: "1번길 풀숲에서 야생 몬스터를 만나 포획구슬로 포획하고, 시야선 트레이너(!)와 겨루며 초록마을 회복 센터·도구점과 2번길 정원으로 나아간다.",
    mechanics: ["encounterTable", "monsterCenterCommands", "shop"],
    sharedAssets: ["monster_overworld", "monster_wild", "harness-monster-pipbug-front"],
  },
  {
    id: "ec_beat_03_gym_vine_puzzle",
    atMinute: 11,
    act: "3막 · 새순 체육관 2단 덩굴 문 퍼즐 & 관장 유림전",
    mapKey: "mx_map_grove_gym",
    sceneTitle: "새싹 돌 받침 + 가시 덤불 changeTile 개방 & 새잎 배지 수여식",
    playerFeel: "새싹 돌 받침에 손을 얹어 덩굴 나무 문을 양쪽 화단으로 걷어내고(changeTile), 가시 덤불을 정리해 관장 유림을 이기면 새잎 배지 수여 연출이 펼쳐진다.",
    mechanics: ["changeTile", "battleProcessing", "badgeAwardCommands"],
    sharedAssets: ["monster_gyms", "oprn_emerald_trainer_leader_grass"],
  },
  {
    id: "ec_beat_04_emerald_cave_finale",
    atMinute: 14,
    act: "4막 · 에메랄드 동굴 수호자의 제단 & 진화 · 엔딩",
    mapKey: "mx_map_observatory",
    sceneTitle: "동굴 보스전 · 스타터 진화(숲지기토/용광비늘/조수지기) · 스탭롤",
    playerFeel: "배지로 열린 에메랄드 동굴에서 밤막회사 보스를 물리치고 파트너의 진화와 함께 에메랄드 크라운 엔딩 크레딧에 도달한다.",
    mechanics: ["battleProcessing", "checkpointSave", "triggerEnding"],
    sharedAssets: ["monster_dungeon", "harness-monster-grovewarden-front"],
  },
] as const;

export const SHITAMACHI_FOURTH_SEASON_BEATS: readonly FlagshipBeat[] = [
  {
    id: "sf_beat_00_commute_opening",
    atMinute: 0,
    act: "0막 · 통학 전동차와 시타마치의 봄 6컷 애니메틱",
    mapKey: "opening_stage_384x216",
    sceneTitle: "전동차 창밖으로 흐르는 시타마치와 건널목의 약속",
    playerFeel: "아침 노을빛이 비치는 전동차와 시타마치 거리의 6컷 픽셀 애니메틱이 흐른 뒤 1024×768 고해상도 무대로 진입한다.",
    mechanics: ["create_opening_animatic_shot", "set_opening_pixel_grid", "upsert_opening_light_fx", "set_opening"],
    sharedAssets: ["oprn-pack-still-modern-01", "oprn-pack-still-modern-02", "oprn-pack-still-modern-03"],
  },
  {
    id: "sf_beat_01_shitamachi_arcade",
    atMinute: 1.5,
    act: "1막 · 시타마치 아케이드 상점가 (shotengai #2943) & 아침 등교",
    mapKey: "map_shitamachi_arcade",
    sceneTitle: "아케이드 지붕 아래의 첫 만남과 14차종 거리 교통",
    playerFeel: "유리 아케이드 지붕(shotengai)과 지조 사당(jizo hokora), 달리는 자동차·배달 스쿠터가 살아 움직이는 시타마치 상점가에서 아오이·시온·유즈하 세 사람과 마주친다.",
    mechanics: ["compose_jp_city_street", "set_street_traffic", "place_npc"],
    sharedAssets: ["jp_city", "oprn-charset-modern1", "oprn-charset-modern2"],
  },
  {
    id: "sf_beat_02_school_and_daily_venues",
    atMinute: 4,
    act: "2막 · 일상 실내 8곳 (#2944 VENUE_SCALE_CONTRACT) 탐방",
    mapKey: "map_mc_school_building",
    sceneTitle: "가정집 → 전동차 → 교사동 → 체육관 → 학생회실 → 옥상 → 베이커리 카페 → 센토",
    playerFeel: "4방향 의자가 놓인 가정집(34×26)·전동차(40×12)·교사동(46×34)·체육관(46×34)·학생회실(36×26)·학교 옥상(36×24)·베이커리 카페(32×22)·센토(40×30)를 자유롭게 오가며 일상을 보낸다.",
    mechanics: ["build_hand_interior_room", "create_transfer_pair", "set_npc_schedule"],
    sharedAssets: ["modern_city", "shared-modern-uni-girl-sailor-expressions-full-base", "shared-modern-uni-girl-long-expressions-full-base"],
  },
  {
    id: "sf_beat_03_dual_fullbody_vn_choices",
    atMinute: 8,
    act: "3막 · 1024×768 양쪽 전신 마주 봄 대화 (dual-fullbody-veil) & 호감도 분기",
    mapKey: "map_shitamachi_arcade",
    sceneTitle: "반투명 다크 베일 위 768×1130 양쪽 전신 스탠딩과 선택지",
    playerFeel: "왼쪽 히로인(→)과 오른쪽 주인공(←)이 1024×768 무대 양쪽에서 서로를 마주 보며, 선택지에 따라 호감도와 상점가 축제 등불 타일(changeTile)이 실시간으로 바뀐다.",
    mechanics: ["choices", "changeVariables", "changeTile"],
    sharedAssets: [
      "shared-modern-uni-boy-navy-expressions-full-base",
      "shared-modern-uni-girl-sailor-expressions-full-base",
      "shared-modern-uni-girl-long-expressions-full-base",
      "shared-modern-uni-girl-navy-expressions-full-base",
    ],
  },
  {
    id: "sf_beat_04_festival_confession_endings",
    atMinute: 13,
    act: "4막 · 세 번째 계절의 밤 축제 고백 & 4종 멀티 엔딩",
    mapKey: "map_shitamachi_arcade",
    sceneTitle: "아오이 · 시온 · 유즈하 · 혼자의 봄 4종 결말",
    playerFeel: "누적된 호감도와 마지막 고백 선택에 따라 세 히로인 각각의 커플 엔딩 또는 『혼자 걷는 시타마치의 봄』 엔딩 카드로 이어진다.",
    mechanics: ["define_ending", "set_deadline_ending", "triggerEnding"],
    sharedAssets: ["shared-modern-uni-girl-sailor-expressions-bust-happy", "shared-modern-uni-girl-long-expressions-bust-happy", "shared-modern-uni-girl-navy-expressions-bust-happy"],
  },
] as const;

export const FLAGSHIP_BEAT_MANIFESTS: Readonly<Record<FlagshipDemoId, FlagshipBeatManifest>> = {
  "chrono-bell": {
    id: "chrono-bell",
    title: "시간의 종소리와 무너진 별",
    subtitle: "시대의 문 정통 JRPG · 7대 시대 거점과 9칸 보스전",
    genreChoiceId: "adventure-jrpg",
    targetMinutes: 25,
    mapCount: 18,
    endingCount: 2,
    releaseOrder: 2,
    priorityRank: 1,
    summary: "천년제 광장의 범종과 텔레포드 사고로 열린 시대의 문을 넘어 중세 대성당·설원 광산·증기 시계탑·아리아 돔·태고의 화산을 가로지르는 정통 파티 JRPG.",
    thumb: "/assets/generated/welcome/slide-04.png",
    cast: [
      { id: "actor_haram", name: "하람", role: "주인공 · 대장장이 견습 검사", assetId: "easyrpg-charset-actor1" },
      { id: "actor_ct_truce_fair_marle", name: "세린", role: "벨하임 왕녀 · 빛/회복", assetId: "easyrpg-charset-people1" },
      { id: "actor_ct_truce_fair_lucca", name: "토우", role: "천재 발명가 · 화염/기계", assetId: "easyrpg-charset-actor2" },
      { id: "actor_ct_middle_ages_frog", name: "개굴경 바르도", role: "성검의 수호 기사", assetId: "easyrpg-charset-monster1" },
      { id: "actor_ff6_zozo_kefka_sabin", name: "로코", role: "시계탑 도시의 격투가", assetId: "easyrpg-charset-actor3" },
      { id: "enemy_chrono_final_demon", name: "종말의 사도 나크타르", role: "최종 보스 1형 (96px 9칸)", assetId: "generated-enemy-demon-lord" },
      { id: "enemy_chrono_final_dragon", name: "고대 용 아스칼", role: "최종 보스 2형 (96px 9칸)", assetId: "generated-enemy-dragon-red" },
    ],
    beats: CHRONO_BELL_BEATS,
    styleLock: CHRONO_BELL_STYLE_LOCK,
  },
  "emerald-crown": {
    id: "emerald-crown",
    title: "에메랄드 크라운: 새벽섬의 수호자",
    subtitle: "몬스터 수집 RPG · 6컷 2× 픽셀 오프닝과 체육관·동굴 모험",
    genreChoiceId: "monster-collect",
    targetMinutes: 15,
    mapCount: 15,
    endingCount: 1,
    releaseOrder: 1,
    priorityRank: 2,
    summary: "내 방 2층에서 출발해 새벽섬 연구소에서 새싹토·찌릿토·물방토 중 첫 파트너를 고르고, 1번길 포획과 새순 체육관 덩굴 문 퍼즐·관장전을 넘어 에메랄드 동굴을 수호하는 몬스터 수집 정본.",
    thumb: "/assets/generated/welcome/slide-01.png",
    cast: [
      { id: "actor_hero", name: "여행자", role: "주인공 트레이너", assetId: "scarloxy-charset-people1" },
      { id: "npc_professor", name: "천문박사", role: "새벽섬 몬스터 연구소 박사", assetId: "oprn_emerald_professor" },
      { id: "npc_rival_naru", name: "나루", role: "소꿉친구 라이벌 트레이너", assetId: "oprn_emerald_trainer_hero_f_front" },
      { id: "npc_leader_yurim", name: "유림", role: "새순 체육관 관장", assetId: "oprn_emerald_trainer_leader_grass" },
      { id: "mx_species_spriglet", name: "새싹토", role: "풀 스타터 (새싹토→잎귀토→숲지기토)", assetId: "harness-monster-leafling-front" },
      { id: "mx_species_coalbit", name: "찌릿토", role: "불/번개 스타터 (찌릿토→가마발→용광비늘)", assetId: "harness-monster-sparkit-front" },
      { id: "mx_species_rivulet", name: "물방토", role: "물 스타터 (물방토→뗏목랑→조수지기)", assetId: "harness-monster-aqualing-front" },
    ],
    beats: EMERALD_CROWN_BEATS,
    styleLock: EMERALD_CROWN_STYLE_LOCK,
  },
  "shitamachi-fourth-season": {
    id: "shitamachi-fourth-season",
    title: "시타마치의 네 번째 계절",
    subtitle: "현대·일본 일상 & 미연시 · 쇼텐가이 아케이드와 일상 실내 8곳",
    genreChoiceId: "story-cutscene",
    targetMinutes: 15,
    mapCount: 9,
    endingCount: 4,
    releaseOrder: 3,
    priorityRank: 3,
    summary: "시타마치 아케이드 상점가(shotengai)와 가정집·전동차·고등학교·체육관·학생회실·옥상·베이커리 카페·센토를 오가며 1024×768 양쪽 전신 대화 무대에서 세 히로인과 계절의 끝을 맞이하는 연애 시뮬레이션 정본.",
    thumb: "/assets/generated/welcome/mini-03-moon.png",
    cast: [
      { id: "actor_haru", name: "하루", role: "주인공 · 전학생", assetId: "shared-modern-uni-boy-navy-expressions-full-base" },
      { id: "char_aoi", name: "아오이", role: "소꿉친구 · 세일러복 문예부원", assetId: "shared-modern-uni-girl-sailor-expressions-full-base" },
      { id: "char_shion", name: "시온", role: "학생회장 · 긴 머리 우등생", assetId: "shared-modern-uni-girl-long-expressions-full-base" },
      { id: "char_yuzuha", name: "유즈하", role: "베이커리 카페 아르바이트 · 밴드부", assetId: "shared-modern-uni-girl-navy-expressions-full-base" },
    ],
    beats: SHITAMACHI_FOURTH_SEASON_BEATS,
    styleLock: SHITAMACHI_STYLE_LOCK,
  },
} as const;

export const FLAGSHIP_DEMO_BY_CHOICE: Partial<Record<NewProjectChoiceId, FlagshipDemoId>> = {
  "adventure-jrpg": "chrono-bell",
  "monster-collect": "emerald-crown",
  "partner-raise": "emerald-crown",
  "story-cutscene": "shitamachi-fourth-season",
} as const;

export const FLAGSHIP_DEMO_ID_BY_CHOICE = FLAGSHIP_DEMO_BY_CHOICE;

export function flagshipManifestForChoice(choiceId: NewProjectChoiceId | undefined): FlagshipBeatManifest | undefined {
  const demoId = choiceId ? FLAGSHIP_DEMO_BY_CHOICE[choiceId] : undefined;
  return demoId ? FLAGSHIP_BEAT_MANIFESTS[demoId] : undefined;
}

export const flagshipBeatManifestForChoice = flagshipManifestForChoice;

/**
 * Formats the canonical flagship beat curve & gimmick grammar so the AI assistant can
 * reference the exemplar's pacing, state-mutating world gimmicks, and style lock without copying tiles.
 */
export function formatFlagshipExemplarPrompt(manifest: FlagshipBeatManifest): string {
  const beatLines = manifest.beats.map(
    (b) => `  - [${b.atMinute}분 · ${b.act}] ${b.sceneTitle}: ${b.playerFeel} (도구/기믹: ${b.mechanics.join(", ")})`,
  );
  return [
    `[정본 대표 데모 참고 박자표 · 『${manifest.title}』 (${manifest.targetMinutes}분 · 맵 ${manifest.mapCount}개 · 엔딩 ${manifest.endingCount}종)]`,
    `- 요약: ${manifest.summary}`,
    `- 그림체 잠금: 해상도 ${manifest.styleLock.resolution.width}×${manifest.styleLock.resolution.height} (zoom ${manifest.styleLock.cameraZoom}), 대화창 ${manifest.styleLock.dialogueStyle}, 허용 타일셋 [${manifest.styleLock.allowedTilesetIds.join(", ")}], 외부 저작권 고유명사 금지.`,
    "- 분 단위 상승 곡선과 세계 변화 기믹(박자·기믹 문법만 참고하고 타일은 기획에 맞게 새로 조립):",
    ...beatLines,
  ].join("\n");
}

export function formatFlagshipExemplarForPrompt(choiceId: NewProjectChoiceId | undefined): string | undefined {
  const manifest = flagshipManifestForChoice(choiceId);
  return manifest ? formatFlagshipExemplarPrompt(manifest) : undefined;
}

export function validateFlagshipIpCleanliness(serializedText: string): readonly string[] {
  return BANNED_IP_PROPER_NOUNS.filter((noun) => serializedText.includes(noun));
}
