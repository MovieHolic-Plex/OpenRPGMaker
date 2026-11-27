// start/firstRun/firstRunBlades.ts
// 첫 사용자 사선 블레이드 5종과 3키워드(무대 · 주인공 · 사건) 자유 조합 풀.
// 원작/외부 게임 이름은 쓰지 않는다. 세 축은 호환 필터 없이 자유롭게 섞인다.
import type { GamePresetId } from "@/project/gameDesignBrief";

export type FirstRunBladeId = "rpg" | "monster" | "story" | "souls" | "horror";

export type FirstRunBlade = {
  readonly id: FirstRunBladeId;
  readonly presetId: GamePresetId;
  /** 접힌 사선 패널의 짧은 세로 라벨. */
  readonly spine: string;
  /** 키워드 3단어. */
  readonly kicker: string;
  /** 펼친 패널 제목. */
  readonly title: string;
  /** 한 줄 소개. */
  readonly desc: string;
  /** 실제 OPRN 도트 장면 에셋 경로. */
  readonly image: string;
  /** 활성 블레이드 바닥 헤어라인·잠금 강조색. */
  readonly tone: string;
  /** 같은 presetId(예: action-rpg) 안에서 결을 뚜렷이 할 때 덧붙이는 톤 지시. */
  readonly toneDirective?: string;
};

export type BladePlace = {
  readonly label: string;
  readonly tilesetHint: "beodeul_city" | "jp_city" | "wizarding_world" | "joseon_baram";
};

export type BladeKeywordRole = "place" | "hero" | "event";

export type FirstRunBladeSelection = {
  readonly blade: FirstRunBlade;
  readonly keywords: readonly [string, string, string];
  readonly tilesetHint?: BladePlace["tilesetHint"];
};

export const FIRST_RUN_BLADES: readonly FirstRunBlade[] = [
  {
    id: "rpg",
    presetId: "adventure-jrpg",
    spine: "왕도 RPG",
    kicker: "파티 · 턴제 · 던전",
    title: "왕도 판타지 RPG",
    desc: "동료와 마을을 떠나 던전 깊은 곳으로 향한다.",
    image: "/assets/start/builtin/fallen-field.webp",
    tone: "#93c5fd",
  },
  {
    id: "monster",
    presetId: "monster-collect",
    spine: "몬스터 수집",
    kicker: "파트너 · 조우 · 포획",
    title: "몬스터 수집 모험",
    desc: "첫 파트너와 풀숲에서 새로운 동료를 만난다.",
    image: "/assets/start/builtin/astra-lab.webp",
    tone: "#6ee7b7",
  },
  {
    id: "story",
    presetId: "story-cutscene",
    spine: "기억 스토리",
    kicker: "전투 없음 · 컷신 · 여운",
    title: "기억을 걷는 스토리",
    desc: "대사와 음악, 컷신 호흡으로 오래 남는 이야기를 쓴다.",
    image: "/assets/start/builtin/firstlove-flashback.webp",
    tone: "#d8b4fe",
  },
  {
    id: "souls",
    presetId: "action-rpg",
    spine: "고난이도 액션",
    kicker: "회피 · 패링 · 보스전",
    title: "고난이도 액션 RPG",
    desc: "화톳불에서 다시 일어나 거대 보스의 패턴을 돌파한다.",
    image: "/assets/concepts/the-dancheong-girl-s-goblin-palace-1nq8dq.full.webp",
    tone: "#fdba74",
    toneDirective: "화톳불·체크포인트에서 거듭 도전하며 회피와 패링으로 거대 보스의 패턴을 파훼하는 고난이도 2D 실시간 액션 RPG.",
  },
  {
    id: "horror",
    presetId: "school-horror",
    spine: "심야 공포",
    kicker: "손전등 · 숨기 · 탈출",
    title: "심야 추격 호러",
    desc: "어두운 복도에서 다가오는 존재를 피해 탈출한다.",
    image: "/assets/concepts/night-patrol-at-the-cursed-academy-of-magic-rjjscz.full.webp",
    tone: "#fda4af",
  },
] as const;

export const BLADE_SLOT_ROLES: readonly { readonly id: BladeKeywordRole; readonly label: string }[] = [
  { id: "place", label: "무대" },
  { id: "hero", label: "주인공" },
  { id: "event", label: "사건" },
] as const;

/** 공용 무대 풀 — 모두 실제 보유 칩셋 4종에 대응한다. */
export const BLADE_PLACES: readonly BladePlace[] = [
  { label: "안개 낀 항구 마을", tilesetHint: "beodeul_city" },
  { label: "폭풍 치는 등대 섬", tilesetHint: "beodeul_city" },
  { label: "비밀이 숨은 부두 창고", tilesetHint: "beodeul_city" },
  { label: "비 내리는 심야 학교", tilesetHint: "jp_city" },
  { label: "막차가 끊긴 지하철역", tilesetHint: "jp_city" },
  { label: "골목 끝 심야 편의점", tilesetHint: "jp_city" },
  { label: "통금 뒤의 마법학교", tilesetHint: "wizarding_world" },
  { label: "금지된 고성 지하 서고", tilesetHint: "wizarding_world" },
  { label: "별빛 시계탑 기숙사", tilesetHint: "wizarding_world" },
  { label: "어스름한 한양 저잣거리", tilesetHint: "joseon_baram" },
  { label: "도깨비불 낀 폐궁", tilesetHint: "joseon_baram" },
  { label: "국경 고갯길 객잔", tilesetHint: "joseon_baram" },
] as const;

/** 공용 주인공 풀 — 장르와 무관하게 자유 조합된다. */
export const BLADE_HEROES: readonly string[] = [
  "은퇴한 전설의 용사",
  "낙제 위기 견습 마법사",
  "기억을 잃은 여행자",
  "심야 편의점 알바생",
  "비밀을 숨긴 전학생",
  "몰락한 가문의 막내",
  "떠돌이 도사와 제자",
  "말단 야간 경비원",
  "고장 난 기계 소녀",
  "허당 신참 탐정",
  "시간을 되감는 우체부",
  "겁 많은 초보 모험가",
  "왕실을 떠난 호위 무사",
  "마왕성에서 해고된 비서",
  "말하는 검은 고양이",
  "졸업을 앞둔 연금술사",
] as const;

/** 공용 사건 풀 — 장르와 무관하게 자유 조합된다. */
export const BLADE_EVENTS: readonly string[] = [
  "사라진 등대지기 구출",
  "봉인된 고대 유적 개방",
  "10년 늦게 도착한 편지",
  "뒤에서 가까워지는 발소리",
  "한 방이 치명적인 수호자",
  "희귀 아기 정령과의 조우",
  "자정에 모든 문이 잠긴 밤",
  "배신한 옛 스승과의 결투",
  "첫 체육관 배지 도전",
  "그날 밤 말하지 못한 진심",
  "가짜 영웅 사칭단 소탕",
  "화톳불이 꺼진 붉은 달",
  "거울 속에만 비치는 그림자",
  "전설의 알 부화 작전",
  "멈춰 버린 시계탑의 하루",
  "비상 열쇠 3개를 찾아 탈출",
  "왕실 보물 도난 사건",
  "최약체 파트너의 대반전",
  "꺼져 가는 손전등 배터리",
  "사라진 친구의 마지막 메모",
] as const;

export const BLADE_KEYWORD_POOLS: readonly (readonly string[])[] = [
  BLADE_PLACES.map((place) => place.label),
  BLADE_HEROES,
  BLADE_EVENTS,
] as const;

export function pickRandomKeyword(pool: readonly string[], exclude?: string, random: () => number = Math.random): string {
  if (pool.length === 0) return "";
  if (pool.length === 1) return pool[0]!;
  const index = Math.floor(Math.max(0, Math.min(0.999999, random())) * pool.length);
  const picked = pool[index]!;
  if (picked !== exclude) return picked;
  return pool[(index + 1) % pool.length]!;
}

export function rollKeywordSlots(
  current: readonly [string, string, string],
  locks: readonly [boolean, boolean, boolean],
  random: () => number = Math.random,
): [string, string, string] {
  return [
    locks[0] ? current[0] : pickRandomKeyword(BLADE_KEYWORD_POOLS[0]!, current[0], random),
    locks[1] ? current[1] : pickRandomKeyword(BLADE_KEYWORD_POOLS[1]!, current[1], random),
    locks[2] ? current[2] : pickRandomKeyword(BLADE_KEYWORD_POOLS[2]!, current[2], random),
  ];
}

export function findPlaceTilesetHint(placeText: string): BladePlace["tilesetHint"] | undefined {
  const trimmed = placeText.trim();
  return BLADE_PLACES.find((place) => place.label === trimmed)?.tilesetHint;
}

export function composeBladeSentence(blade: FirstRunBlade, keywords: readonly [string, string, string]): string {
  const parts = keywords.map((item) => item.trim()).filter(Boolean);
  if (parts.length === 0) return blade.title;
  return `${parts.join(" · ")} — ${blade.title}`;
}
