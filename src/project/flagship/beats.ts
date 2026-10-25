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
  cameraZoom: 1,
  dialogueStyle: "pixel-cinematic",
  allowedTilesetIds: [
    "beodeul_city",
    "atlas_biome_interior",
    "sf_station",
  ],
  allowedCharsetPrefixes: ["easyrpg-charset-", "tex_easyrpg_charset_", "oprn-charset-heroes"],
  allowedPortraitPrefixes: ["shared-", "oprn_fallen_star_"],
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
    "oprn-charset-dawning-skybirds",
    "tex_oprn_charset_dawning_skybirds",
  ],
  allowedPortraitPrefixes: ["oprn_emerald_", "harness-monster-", "mx_art_"],
  bannedProperNouns: BANNED_IP_PROPER_NOUNS,
} as const;

export const SHITAMACHI_STYLE_LOCK: FlagshipStyleLock = {
  demoId: "shitamachi-fourth-season",
  presetId: "story-cutscene",
  resolution: { width: 480, height: 270 },
  cameraZoom: 1,
  dialogueStyle: "glass",
  allowedTilesetIds: ["jp_city", "modern_city"],
  allowedCharsetPrefixes: ["oprn-charset-modern", "tex_oprn_charset_modern"],
  allowedPortraitPrefixes: ["shared-modern-"],
  bannedProperNouns: BANNED_IP_PROPER_NOUNS,
} as const;

export const FIRST_LOVE_STYLE_LOCK: FlagshipStyleLock = {
  demoId: "first-love",
  presetId: "story-cutscene",
  resolution: { width: 480, height: 270 },
  cameraZoom: 1,
  dialogueStyle: "pixel-cinematic",
  allowedTilesetIds: ["jp_city", "modern_city"],
  allowedCharsetPrefixes: ["oprn-charset-modern", "tex_oprn_charset_modern"],
  allowedPortraitPrefixes: ["shared-modern-"],
  bannedProperNouns: BANNED_IP_PROPER_NOUNS,
} as const;

export const FLAGSHIP_STYLE_LOCKS: Readonly<Record<FlagshipDemoId, FlagshipStyleLock>> = {
  "chrono-bell": CHRONO_BELL_STYLE_LOCK,
  "emerald-crown": EMERALD_CROWN_STYLE_LOCK,
  "shitamachi-fourth-season": SHITAMACHI_STYLE_LOCK,
  "first-love": FIRST_LOVE_STYLE_LOCK,
} as const;

export const CHRONO_BELL_BEATS: readonly FlagshipBeat[] = [
  {
    id: "cb_beat_00_opening",
    atMinute: 0,
    act: "0막 · 5컷 도트 애니메틱 오프닝",
    mapKey: "opening_stage_480x270",
    sceneTitle: "밤의 왕도 → 하늘을 가로지른 별 → 천문대의 하넬 → 숲의 은빛 알 → 심문관 입성",
    playerFeel: "게임 화면과 같은 480×270 무대에서 게임 맵을 1:1 로 구운 배경 위에 1배 캐릭터 칩이 걷고, 별똥별·추락 섬광·관의 빛은 빛 효과로 그린다. 자막은 컷에 보이는 것만 말한다.",
    mechanics: ["buildFallenStarOpening", "validateOpeningAnimatic"],
    sharedAssets: ["oprn_fallen_star_art_title", "oprn_fallen_star_art_town", "oprn_fallen_star_art_fall", "oprn_fallen_star_art_observatory", "oprn_fallen_star_art_crash", "oprn_fallen_star_art_morning"],
  },
  {
    id: "cb_beat_01_astel",
    atMinute: 1,
    act: "1막 1장 · 왕도 아스텔 · 별빛 천문대",
    mapKey: "fs_hub",
    sceneTitle: "심문관의 포고와 하넬의 부탁",
    playerFeel: "광장에서 심문관 발렌의 포고를 듣고, 천문대장 하넬에게서 북쪽 숲에 떨어진 별을 먼저 찾아 달라는 부탁을 받는다. 망원경으로 숲 위 연기를 본다.",
    mechanics: ["author_jrpg_chapter", "script_cutscene", "create_quest"],
    sharedAssets: ["beodeul_city", "atlas_biome_interior"],
  },
  {
    id: "cb_beat_02_forest",
    atMinute: 4,
    act: "1막 2장 · 속삭이는 숲 · 추락지",
    mapKey: "fs_forest",
    sceneTitle: "숲지기 브람 · 풀숲 조우 · 은빛 알의 세 단계 수수께끼 · 이리스 합류",
    playerFeel: "숲길 풀숲에서 숲짐승과 싸우며 북쪽 끝 그을린 공터에 닿고, 관 표면 무늬 순서·『살아 있는 손』·겁먹은 목소리에 답하는 세 단계를 풀면 이리스가 깨어나 파티에 든다.",
    mechanics: ["author_wild_route", "choices", "changeParty", "encounterTable"],
    sharedAssets: ["beodeul_city", "sf_station"],
  },
  {
    id: "cb_beat_03_vault",
    atMinute: 10,
    act: "1막 3장 · 천문대 지하 · 옛 별지기의 방",
    mapKey: "fs_vault",
    sceneTitle: "별빛 열쇠로 연 뚜껑문 · 화로 점화 순서 · 지하 던전",
    playerFeel: "관에서 얻은 별빛 열쇠로 천문대 바닥 뚜껑문을 열고, 네 화로를 바른 순서로 밝혀 문을 연 뒤 옛 별지기의 방으로 내려간다.",
    mechanics: ["author_map_puzzle", "changeTile", "lock"],
    sharedAssets: ["atlas_biome_interior", "beodeul_city"],
  },
  {
    id: "cb_beat_04_valen",
    atMinute: 15,
    act: "1막 최종장 · 심문관 발렌 결전 · 제1막 엔딩",
    mapKey: "fs_vault",
    sceneTitle: "발렌과 별지기의 수호상 · 렌즈의 신호 · 북쪽의 답",
    playerFeel: "렌즈 앞에서 발렌과 수호상을 쓰러뜨리면 이리스가 신호를 보내 북쪽에서 답을 받는다. 하넬에게 알리면 제1막이 끝난다.",
    mechanics: ["battleProcessing", "define_ending", "triggerEnding"],
    sharedAssets: ["charset-battler-fs-valen", "generated-enemy-golem-crystal"],
  },
] as const;

export const EMERALD_CROWN_BEATS: readonly FlagshipBeat[] = [
  {
    id: "ec_beat_00_opening",
    atMinute: 0,
    act: "0막 · 6컷 2× 픽셀 애니메틱",
    mapKey: "emerald_opening_480x320",
    sceneTitle: "오르비스 해안과 여명의 날개 새떼 → 1번 도로 → 천문 연구소 → 스타터 무대 → 실바나 체육관 VS → 다우닝 시티 출발",
    playerFeel: "480×320 무대에서 캠페인 실제 맵 배경과 2배 정수 도트 캐릭터·몬스터, 여명갈매기·창공제비 새떼(oprn-charset-dawning-skybirds)가 6컷 애니메틱으로 이어진다.",
    mechanics: ["configureEmeraldMonsterOpening", "emeraldOpeningShot"],
    sharedAssets: ["oprn_emerald_opening_dawn", "oprn_emerald_opening_route", "oprn_emerald_opening_lab", "oprn_emerald_opening_stage", "oprn_emerald_opening_gym", "oprn_emerald_opening_town", "oprn-charset-dawning-skybirds"],
  },
  {
    id: "ec_beat_01_home_to_lab",
    atMinute: 1.5,
    act: "1막 · 다우닝 시티 내 방 2F → 우리 집 1F → 다우닝 시티 → 오르비스 천문 연구소",
    mapKey: "mx_map_lab",
    sceneTitle: "토리프·숯꼬미·아가핀 3스타터 선택 카드 & 라이벌 나루 첫 대결",
    playerFeel: "다우닝 시티 내 방 2F에서 열린 직교 계단(h_stairs_dn)을 내려가 엄마에게 인사한 뒤, 30×24 대도시 다우닝 시티와 오르비스 천문 연구소에서 첫 동료를 고르고 필드 동행(follower)과 함께 여정을 시작한다.",
    mechanics: ["starterChoiceCommands", "battleProcessing", "transfer"],
    sharedAssets: ["monster_rooms", "monster_overworld", "harness-monster-leafling-front", "harness-monster-sparkit-front", "harness-monster-aqualing-front"],
  },
  {
    id: "ec_beat_02_route1_and_grove_town",
    atMinute: 6,
    act: "2막 · 1번 도로 새싹 들길 → 실바나 마을 → 2번 도로 솔방울 언덕",
    mapKey: "mx_map_meadow",
    sceneTitle: "풀숲 야생 조우·포획구슬 투척 & 시야선 트레이너 배틀",
    playerFeel: "여명의 날개 새들이 나는 1번 도로 풀숲에서 야생 몬스터를 만나 포획 구슬로 포획하고, 시야선 트레이너(!)와 겨루며 실바나 마을 회복 센터·도구점으로 나아간다.",
    mechanics: ["encounterTable", "monsterCenterCommands", "shop"],
    sharedAssets: ["monster_overworld", "monster_wild", "harness-monster-pipbug-front"],
  },
  {
    id: "ec_beat_03_gym_vine_puzzle",
    atMinute: 11,
    act: "3막 · 실바나 체육관 신록의 온실 2단 덩굴 문 퍼즐 & 관장 유림전",
    mapKey: "mx_map_grove_gym",
    sceneTitle: "새싹 돌 받침 + 가시 덤불 changeTile 개방 & 새잎 배지 수여식",
    playerFeel: "새싹 돌 받침에 손을 얹어 덩굴 나무 문을 양쪽 화단으로 걷어내고(changeTile), 가시 덤불을 정리해 관장 유림을 이기면 새잎 배지 수여 연출이 펼쳐진다.",
    mechanics: ["changeTile", "battleProcessing", "badgeAwardCommands"],
    sharedAssets: ["monster_gyms", "oprn_emerald_trainer_leader_grass"],
  },
  {
    id: "ec_beat_04_emerald_cave_finale",
    atMinute: 14,
    act: "4막 · 별모래 신전 & 챔피언 전당 · 엔딩",
    mapKey: "mx_map_observatory",
    sceneTitle: "신전 보스 무영(3마리) → 등대 복구 → 챔피언 전당 라이벌 나루(4마리) → 전당 등록 · 스탭롤",
    playerFeel: "배지로 열린 별모래 신전에서 밤막회사 대표 무영을 물리쳐 등대 빛을 되찾고, 다시 날아오른 여명의 날개 새떼를 뒤로 챔피언 전당에서 소꿉친구 나루와 마지막 승부를 겨뤄 엔딩 크레딧에 도달한다.",
    mechanics: ["battleProcessing", "checkpointSave", "triggerEnding"],
    sharedAssets: ["monster_dungeon", "harness-monster-grovewarden-front"],
  },
] as const;

export const SHITAMACHI_FOURTH_SEASON_BEATS: readonly FlagshipBeat[] = [
  { id: "sf-00", atMinute: 0, act: "오프닝", mapKey: "opening_stage_384x216", sceneTitle: "게임 속 맵 그대로 5컷", playerFeel: "상점가·빵집·센토·사무소·정문을 게임 맵 그대로 보여 주고 자막만 흐른다", mechanics: ["place_opening_background(mapId)", "set_opening_caption"], sharedAssets: ["oprn-charset-modern1", "oprn-charset-modern3"] },
  { id: "sf-01", atMinute: 1, act: "저녁", mapKey: "map_venue_train", sceneTitle: "같은 칸의 유나", playerFeel: "통학 전철에서 필름 카메라를 든 아이에게 말을 걸지 고른다", mechanics: ["autorun", "choices", "affection"], sharedAssets: ["shared-modern-uni-girl-sailor-expressions-bust-base"] },
  { id: "sf-02", atMinute: 3, act: "저녁", mapKey: "map_shitamachi_arcade", sceneTitle: "소원 등롱 셋", playerFeel: "학생회장 서연이 축제 일을 부탁하고 걸어간다 — 목표가 생긴다", mechanics: ["autorun", "moveEvent", "variable-stage"], sharedAssets: ["shared-modern-uni-girl-navy-expressions-bust-base"] },
  { id: "sf-03", atMinute: 5, act: "등롱 모으기", mapKey: "map_venue_bakery", sceneTitle: "빵집·센토·사무소", playerFeel: "거리 문으로 걸어 들어가 세 사람을 만나고 등롱을 받는다. 집의 옛 사진이 지호와의 약속을 떠올리게 한다", mechanics: ["link_jp_city_interior", "choices", "affection", "switch"], sharedAssets: ["shared-modern-apron-olive-expressions-bust-base"] },
  { id: "sf-04", atMinute: 11, act: "밤", mapKey: "map_shitamachi_arcade", sceneTitle: "점등", playerFeel: "등롱지기에게 셋을 건네면 거리가 어두워지고 등롱이 하나씩 켜진다. 누구와 걸을지 고른다", mechanics: ["setLighting", "addLight", "choices"], sharedAssets: ["shared-modern-teacher-tweed-expressions-bust-base"] },
  { id: "sf-05", atMinute: 13, act: "밤", mapKey: "map_venue_rooftop", sceneTitle: "옥상의 고백", playerFeel: "쌓인 마음 점수가 진심 결말과 청춘 결말을 가른다", mechanics: ["fork", "triggerEnding", "define_ending"], sharedAssets: [] },
];


const FIRST_LOVE_BEATS: readonly FlagshipBeat[] = [
  { id: "fl-01", atMinute: 0, act: "월요일", mapKey: "fl_platform_am", sceneTitle: "첫 출근", playerFeel: "아침 승강장에서 회사까지 걸어간다", mechanics: ["autorun", "letterbox"], sharedAssets: ["oprn-charset-modern2"] },
  { id: "fl-02", atMinute: 2, act: "월요일", mapKey: "fl_office", sceneTitle: "처음 뵙겠습니다", playerFeel: "사수로 온 첫사랑이 모르는 척한다", mechanics: ["choices", "bust-expression"], sharedAssets: ["shared-modern-casual-boy-hoodie-expressions-bust-base"] },
  { id: "fl-03", atMinute: 6, act: "월요일", mapKey: "fl_rooftop", sceneTitle: "옥상", playerFeel: "모르는 사이로 하자는 부탁", mechanics: ["choices", "affection"], sharedAssets: [] },
  { id: "fl-04", atMinute: 8, act: "월요일 밤", mapKey: "fl_broadcast", sceneTitle: "금요일의 방송실", playerFeel: "세피아 회상 — 이름을 쓴 마지막 사연", mechanics: ["tint", "letterbox", "original-bgm"], sharedAssets: [] },
  { id: "fl-05", atMinute: 11, act: "수요일", mapKey: "fl_office_pm", sceneTitle: "야근", playerFeel: "실수를 숨길지 말할지, 수첩 속 편지", mechanics: ["choices", "switch"], sharedAssets: [] },
  { id: "fl-06", atMinute: 15, act: "금요일", mapKey: "fl_office_fri", sceneTitle: "발표와 발령", playerFeel: "늦은 답장 — 그리고 또 떠나는 사람", mechanics: ["choices", "fork"], sharedAssets: [] },
  { id: "fl-07", atMinute: 17, act: "금요일 밤", mapKey: "fl_platform_pm", sceneTitle: "막차", playerFeel: "이번엔 먼저 말할까", mechanics: ["triggerEnding", "affection"], sharedAssets: [] },
];

export const FLAGSHIP_BEAT_MANIFESTS: Readonly<Record<FlagshipDemoId, FlagshipBeatManifest>> = {
  "chrono-bell": {
    id: "chrono-bell",
    title: "폴른 스타: 떨어진 별",
    subtitle: "중세 마법 판타지 JRPG · 별에서 온 소녀를 집에 보내는 여정 제1막",
    genreChoiceId: "adventure-jrpg",
    targetMinutes: 20,
    mapCount: 5,
    endingCount: 1,
    releaseOrder: 2,
    priorityRank: 1,
    summary: "왕도 아스텔의 견습 별지기 카엘과 마도학자 엘레나가 북쪽 숲에 떨어진 별을 찾아가, 그 안에서 깨어난 기계 소녀 이리스를 만난다. 하늘에서 온 것을 모두 거두려는 심문관 발렌보다 먼저 천문대 지하의 옛 렌즈로 이리스의 집에 신호를 보내는 중세 마법 판타지 JRPG 제1막.",
    thumb: "/assets/generated/welcome/slide-04.png",
    cast: [
      { id: "actor_hero", name: "카엘", role: "주인공 · 견습 별지기", assetId: "easyrpg-charset-actor1" },
      { id: "actor_fs_elena", name: "엘레나", role: "마도학자 · 카엘의 동료", assetId: "easyrpg-charset-actor1" },
      { id: "actor_fs_iris", name: "이리스", role: "별에서 온 기계 소녀", assetId: "easyrpg-charset-actor4" },
      { id: "npc_fs_hanel", name: "하넬", role: "천문대장", assetId: "easyrpg-charset-people3" },
      { id: "npc_fs_bram", name: "브람", role: "숲지기", assetId: "easyrpg-charset-actor2" },
      { id: "enemy_fs_valen", name: "심문관 발렌", role: "제1막 보스", assetId: "charset-battler-fs-valen" },
      { id: "enemy_fs_guardian", name: "별지기의 수호상", role: "제1막 보스와 함께 깨어나는 수호상", assetId: "generated-enemy-golem-crystal" },
    ],
    beats: CHRONO_BELL_BEATS,
    styleLock: CHRONO_BELL_STYLE_LOCK,
  },
  "emerald-crown": {
    id: "emerald-crown",
    title: "아스트라 호라이즌: 다우닝 시티와 여명의 날개",
    subtitle: "내 방에서 출발해 첫 배지·별모래 신전·챔피언 전당까지",
    genreChoiceId: "monster-collect",
    targetMinutes: 15,
    mapCount: 15,
    endingCount: 1,
    releaseOrder: 1,
    priorityRank: 2,
    summary: "다우닝 시티 내 방에서 출발해 오르비스 천문 연구소에서 토리프·숯꼬미·아가핀 중 첫 동료를 고르고, 1번 도로 풀숲 포획·트레이너전, 실바나 체육관 덩굴 문 퍼즐과 관장 유림전, 별모래 신전의 밤막회사 대표 무영, 챔피언 전당의 라이벌 나루까지 이어지는 배지 하나 분량의 몬스터 수집 데모.",
    thumb: "/assets/generated/welcome/slide-01.png",
    cast: [
      { id: "actor_hero", name: "여행자", role: "주인공 트레이너", assetId: "scarloxy-charset-people1" },
      { id: "npc_professor", name: "천문박사", role: "오르비스 천문 연구소 박사", assetId: "oprn_emerald_professor" },
      { id: "npc_rival_naru", name: "나루", role: "소꿉친구 라이벌 · 챔피언 전당의 마지막 상대", assetId: "oprn_emerald_trainer_hero_f_front" },
      { id: "npc_leader_yurim", name: "유림", role: "실바나 체육관 관장", assetId: "oprn_emerald_trainer_leader_grass" },
      { id: "mx_species_spriglet", name: "토리프", role: "풀 스타터 (토리프→실바리온→벨데로드)", assetId: "harness-monster-leafling-front" },
      { id: "mx_species_coalbit", name: "숯꼬미", role: "불/격투 스타터 (숯꼬미→불박치→마그렉스)", assetId: "harness-monster-sparkit-front" },
      { id: "mx_species_rivulet", name: "아가핀", role: "물 스타터 (아가핀→마린웨이→네레이드)", assetId: "harness-monster-aqualing-front" },
    ],
    beats: EMERALD_CROWN_BEATS,
    styleLock: EMERALD_CROWN_STYLE_LOCK,
  },
  "shitamachi-fourth-season": {
    id: "shitamachi-fourth-season",
    title: "시타마치의 네 번째 계절",
    subtitle: "현대·일본 일상 연애 · 등롱 축제 전날의 상점가",
    genreChoiceId: "story-cutscene",
    targetMinutes: 15,
    mapCount: 7,
    endingCount: 4,
    releaseOrder: 3,
    priorityRank: 3,
    summary: "등롱 축제 전날, 시타마치 상점가의 빵집·센토·진흥회 사무소를 걸어 다니며 소원 등롱 셋을 모으고, 점등 뒤 옥상에서 고백한다. 장면마다 고른 마음이 진심 결말 셋과 청춘 결말을 가른다.",
    thumb: "/assets/generated/welcome/mini-03-moon.png",
    cast: [
      { id: "actor_hajin", name: "하진", role: "주인공 · 돌아온 전학생", assetId: "shared-modern-uni-boy-navy-expressions-bust-base" },
      { id: "char_seoyeon", name: "서연", role: "학생회장 · 축제를 떠맡았다", assetId: "shared-modern-uni-girl-navy-expressions-bust-base" },
      { id: "char_jiho", name: "지호", role: "빵집 딸 · 소꿉친구", assetId: "shared-modern-apron-olive-expressions-bust-base" },
      { id: "char_yuna", name: "유나", role: "센토 손녀 · 같은 칸의 사진가", assetId: "shared-modern-uni-girl-sailor-expressions-bust-base" },
    ],
    beats: SHITAMACHI_FOURTH_SEASON_BEATS,
    styleLock: SHITAMACHI_STYLE_LOCK,
  },
  "first-love": {
    id: "first-love",
    title: "첫사랑",
    subtitle: "현대 오피스 로맨스 · 첫 출근 날, 사수가 된 첫사랑",
    genreChoiceId: "story-cutscene",
    targetMinutes: 18,
    mapCount: 10,
    endingCount: 3,
    releaseOrder: 4,
    priorityRank: 4,
    summary: "앱 회사 스튜디오 늘봄에 첫 출근한 디자이너 윤서하. 사수로 배정된 선임은 10년 전 말없이 전학 간 고등학교 방송부 선배 강지후였다. 그는 「처음 뵙겠습니다」라고 말한다. 월요일 옥상과 편의점, 수요일 야근, 금요일 발표와 막차까지 — 선택이 쌓여 세 결말로 갈린다.",
    thumb: "/assets/start/builtin/firstlove-title.webp",
    cast: [
      { id: "actor_hero", name: "윤서하", role: "주인공 · 신입 UX 디자이너", assetId: "shared-modern-casual-girl-lavender-expressions-bust-base" },
      { id: "npc_fl_jihu", name: "강지후", role: "첫사랑 · 앱 개발 선임, 서하의 사수", assetId: "shared-modern-casual-boy-hoodie-expressions-bust-base" },
      { id: "npc_fl_minho", name: "차민호", role: "입사 동기 · 백엔드 신입", assetId: "shared-modern-casual-boy-mustard-expressions-bust-base" },
      { id: "npc_fl_lead", name: "오정민", role: "프로덕트팀 팀장", assetId: "shared-modern-suit-girl-navy-expressions-bust-base" },
    ],
    beats: FIRST_LOVE_BEATS,
    styleLock: FIRST_LOVE_STYLE_LOCK,
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
