import { READY_PEOPLE_BATTLERS } from "@/assets/charsetBattlerReady";

// 걷기 칩 전투 시트(actor1~4 · people1~5)의 표시 이름만 가볍게 보관한다(에디터 전용 대용량 의미표를 플레이어 번들에 끌어오지 않는다).
const EASYRPG_BATTLER_LABELS: Readonly<Record<string, readonly string[]>> = {
  actor1: ["청년 용사", "빨간 로브 마법사", "붉은 갑옷 기사", "붉은 갑옷 여전사", "젊은 남성 마법사", "젊은 여성 마법사", "파란 로브 마법사", "파란 옷 젊은 여성 마법사"],
  actor2: ["검은 머리 도적", "하늘색 재킷 젊은 여성", "녹색 망토 레인저", "녹색 후드 궁수", "갈색 머리 중년 전사", "젊은 여성 도적", "젊은 여성 엘프", "젊은 남성 엘프"],
  actor3: ["사무라이", "동양풍 떠돌이 검객", "닌자", "여자 닌자", "빨간 모자 녹색 코트 여인", "무도가", "남성 음유시인", "여성 음유시인"],
  actor4: ["파란 머리 청년", "금발 머리 청년", "금발 청년2", "파란 머리 여성 마법사", "분홍 머리 여성 마법사", "금발 남성 갑옷 전사", "보라 머리 여성 마법사", "고깔모자 여성 마법사"],
  people1: ["남자아이", "여자아이", "청년 남성", "젊은 여성", "중년 남성 주민(흑인)", "중년 여성 주민(흑인)", "대머리 남성 주민", "노파"],
  people2: ["중절모 신사", "수녀", "승려", "이국적인 여성", "닌자 소녀", "토끼 귀 여성", "화려한 여왕", "요정 소녀"],
  people3: ["왕", "여왕", "왕자", "공주", "집사", "여자 메이드", "귀족 남성", "파란 갑옷 기사"],
  people4: ["빵모자 아이", "삐쭉머리 남자아이", "이국적인 모자 청년", "머리 장식 이국 여성", "대머리 이국 주민", "노란 전통옷 남성", "터번 노인", "터번 노파"],
  people5: ["청년 병사", "어린 소녀", "청년 전사", "전통 의상 여성", "난쟁이 병사", "하녀", "여관 주인", "노학자"],
};

/** 걷기 칩과 전투 시트의 공용 대응표. 48px 셀 3열×8행, 확대는 표시 계층에서 한 번만 한다. */
const WALK_CHIP_BATTLERS = Array.from({ length: 32 }, (_, index) => {
  const actor = `actor${Math.floor(index / 8) + 1}`;
  const characterIndex = index % 8;
  return {
    resourceId: `charset-battler-${actor}-${characterIndex}`,
    path: `assets/generated/charset-battlers/${actor}-${characterIndex}.png`,
    /** 마법 시전 시트(battlePose.CAST_TYPES 7행 × 3단계). */
    castPath: `assets/generated/charset-battlers/cast/${actor}-${characterIndex}.png`,
    characterResourceId: `easyrpg-charset-${actor}`,
    characterIndex,
    label: `걷기 칩 전투 · ${EASYRPG_BATTLER_LABELS[actor]?.[characterIndex] ?? `${actor} ${characterIndex + 1}`}`,
  };
});

/**
 * 걷기 칩 자동 대응이 아닌 **명시 선택용** 전투 시트(직업 전용·독립 원화).
 * 사무라이(2026-09-28): 걷기 칩 actor3#0 은 기존 마도사가 쓰는 actor3-0 전투 시트와 겹쳐서 새 id 를 쓴다.
 * 자동 대응(charsetBattlerForCharacter)은 이 항목을 고르지 않는다 — 배우가 battleCharacterResourceId 로 명시한다.
 */
const CLASS_BATTLERS = [
  {
    resourceId: "charset-battler-actor3-0-samurai",
    path: "assets/generated/charset-battlers/actor3-0-samurai.png",
    castPath: "assets/generated/charset-battlers/cast/actor3-0-samurai.png",
    characterResourceId: "easyrpg-charset-actor3",
    characterIndex: 0,
    label: "걷기 칩 전투 · 사무라이",
  },
  {
    // 창을 든 검사(actor1-0) — 몸 층은 actor1-0 그대로, 무기만 창으로 다시 찍었다(scripts/asset-gen/charset-battler/repaint_weapons.py 의 무기 찍기,
    // 공격 네 자세는 찌르기 각도). 자동 대응은 고르지 않는다 — 배우의 weaponBattleSheets(무기 계열 → 시트)가 가리킬 때만 선다.
    resourceId: "charset-battler-actor1-0-spear",
    path: "assets/generated/charset-battlers/actor1-0-spear.png",
    castPath: "assets/generated/charset-battlers/cast/actor1-0-spear.png",
    characterResourceId: "easyrpg-charset-actor1",
    characterIndex: 0,
    label: "걷기 칩 전투 · 창을 든 검사",
  },
  {
    resourceId: "charset-battler-silver-swordswoman",
    path: "assets/generated/charset-battlers/silver-swordswoman.png",
    castPath: "assets/generated/charset-battlers/cast/silver-swordswoman.png",
    // 원본 걷기 칩 없이 직접 저작한 그림. 기존 배우의 자동 대응을 바꾸지 않는다.
    characterResourceId: undefined,
    characterIndex: 0,
    label: "손 도트 전투 · 은발 여검사",
  },
  {
    // 폴른 스타 심문관 발렌 — 걷기 칩(oprn-charset-fs-valen, 광대 모자를 걷고 긴 푸른 머리·금빛 머리띠)과 같은 사람.
    // actor1-4 포즈에서 모자만 머리카락으로 바꾼 파생(scripts/asset-gen/charset-battler/derive_hatless.py actor1-4 fs-valen).
    resourceId: "charset-battler-fs-valen",
    path: "assets/generated/charset-battlers/fs-valen.png",
    castPath: "assets/generated/charset-battlers/cast/fs-valen.png",
    characterResourceId: "oprn-charset-fs-valen",
    characterIndex: 0,
    label: "걷기 칩 전투 · 심문관 발렌(긴 푸른 머리)",
  },
];

/**
 * People1~5 전투 시트 40개(2026-09-28 2차 로스터, `charset-battler-people<N>-<i>`).
 * 시트 PNG 는 아트 묶음이 나눠서 만든다 — **파일이 있는 것만** 등록한다(charsetBattlerReady.ts). 등록만 하고 파일이 없으면
 * 전투에서 빈 배우가 서기 때문이다. 없는 칩은 자동 대응이 undefined 를 돌려줘 기존 스킨 폴백(공용 전사/마법사)으로 간다.
 * 파일이 늘면 `node scripts/content/sync-charset-battler-ready.mjs` 로 목록을 다시 만든다.
 */
const PEOPLE_CHIP_BATTLERS = Array.from({ length: 40 }, (_, index) => {
  const people = `people${Math.floor(index / 8) + 1}`;
  const characterIndex = index % 8;
  return {
    resourceId: `charset-battler-${people}-${characterIndex}`,
    path: `assets/generated/charset-battlers/${people}-${characterIndex}.png`,
    castPath: `assets/generated/charset-battlers/cast/${people}-${characterIndex}.png`,
    characterResourceId: `easyrpg-charset-${people}`,
    characterIndex,
    label: `걷기 칩 전투 · ${EASYRPG_BATTLER_LABELS[people]?.[characterIndex] ?? `${people} ${characterIndex + 1}`}`,
  };
}).filter((entry) => READY_PEOPLE_BATTLERS.has(entry.resourceId));

export const CHARSET_BATTLERS = [...WALK_CHIP_BATTLERS, ...PEOPLE_CHIP_BATTLERS, ...CLASS_BATTLERS];

const byId = new Map(CHARSET_BATTLERS.map((entry) => [entry.resourceId, entry]));
export function charsetBattler(resourceId: string | undefined) {
  return resourceId ? byId.get(resourceId) : undefined;
}

/** 손으로 고친 걷기 칩(업로드 칩)에 맞춘 전투 시트 — 칩 id·자리로 찾는다. 원본 칩의 전투 시트를 쓰면 모자·머리가 다른 사람이 된다. */
const BY_CUSTOM_CHIP = new Map(CLASS_BATTLERS.filter((entry) => entry.characterResourceId && !entry.characterResourceId.startsWith("easyrpg-"))
  .map((entry) => [`${entry.characterResourceId}#${entry.characterIndex}`, entry.resourceId]));

export function charsetBattlerForCharacter(characterResourceId?: string, characterIndex = 0): string | undefined {
  const custom = BY_CUSTOM_CHIP.get(`${characterResourceId ?? ""}#${characterIndex}`);
  if (custom) return custom;
  if (!/^easyrpg-charset-(actor[1-4]|people[1-5])$/.test(characterResourceId ?? "")) return undefined;
  if (!Number.isInteger(characterIndex) || characterIndex < 0 || characterIndex > 7) return undefined;
  const id = `charset-battler-${characterResourceId!.slice("easyrpg-charset-".length)}-${characterIndex}`;
  // People 시트는 아직 다 그려지지 않았다 — 파일이 없는 칩은 undefined(기존 폴백).
  return byId.has(id) ? id : undefined;
}

/** 이 걷기 칩의 전투 시트 id 가 규칙상 있는가(파일 존재와 무관). 로스터 생성기가 「시트가 아직 없다」를 구분할 때 쓴다. */
export function charsetBattlerIdForChip(characterResourceId: string, characterIndex: number): string {
  return `charset-battler-${characterResourceId.slice("easyrpg-charset-".length)}-${characterIndex}`;
}

/**
 * 걷기 칩 대응이 없는 배우(업로드·생성 영웅 칩, 옛 프로젝트)가 도트 측면 전투에 설 기본 도트(2026-10-03).
 * 예전에는 은퇴한 정면 스킨의 전사·마법사 일러스트(deprecated/)로 물러났다. 짝수 자리는 전사, 홀수 자리는 마도사.
 */
export const RETRO_FALLBACK_PARTY_BATTLERS = ["charset-battler-actor1-0", "charset-battler-actor1-5"] as const;

export function retroFallbackPartyBattler(index: number): string {
  return RETRO_FALLBACK_PARTY_BATTLERS[Math.abs(index) % RETRO_FALLBACK_PARTY_BATTLERS.length]!;
}

/** 측면 표시·내보내기가 같은 선택 계약을 쓴다. 저작 시트는 자동 대응보다 우선한다. */
export function resolvePartyBattleCharset(actor: {
  readonly battleCharacterResourceId?: string;
  readonly characterResourceId?: string;
  readonly characterIndex?: number;
}, retro = false): string | undefined {
  // 걷기 칩 시트(288×256, 8명)를 전투 시트로 적어 둔 경우는 저작 시트가 아니다 — 그대로 그리면 시트 전체가 작은 칸 수백 개로 깔린다
  // (jrpg-loop-1 ct2: 조수가 battleCharacterResourceId 에 characterResourceId 와 같은 oprn-charset-heroes1 을 넣어 전투 화면 오른쪽이 군중이 됐다).
  // 전투 전용 칩(charset-battler-*)은 그대로 통과한다. 걷기 칩 대응이 없으면 호출자의 기본 도트로 물러난다.
  const rawAuthored = actor.battleCharacterResourceId;
  const walkSheetAsBattle = rawAuthored !== undefined && !charsetBattler(rawAuthored)
    && (rawAuthored === actor.characterResourceId || /^(?:oprn|easyrpg)-charset-/u.test(rawAuthored));
  const authored = walkSheetAsBattle ? undefined : rawAuthored;
  const generatedHero = authored === "hero" || authored?.startsWith("generated-actor-hero-");
  if (authored && !generatedHero) return authored;
  return charsetBattlerForCharacter(actor.characterResourceId, actor.characterIndex)
    ?? (retro && generatedHero ? undefined : authored);
}

/**
 * 전투 시트도 칩 대응도 없는 배우가 측면 전투에 자기 걷기 칩으로 서는가(2026-10-30). 걷기 칩이 있으면 그 칩·자리를,
 * 없으면 undefined(호출자가 기본 도트로 물러난다). 시트 전체를 그리지 않고 한 사람 칸만 자른다 — battleWalkChipBattler.ts.
 * 저작 시트·charset-battler-*·party-pixel-* 로 풀리는 배우는 여기 오지 않는다(resolvePartyBattleCharset 가 먼저 이긴다).
 */
export function partyWalkChipBattler(actor: {
  readonly battleCharacterResourceId?: string;
  readonly characterResourceId?: string;
  readonly characterIndex?: number;
}, retro = false): { readonly characterResourceId: string; readonly characterIndex: number } | undefined {
  if (resolvePartyBattleCharset(actor, retro)) return undefined;
  const characterResourceId = actor.characterResourceId?.trim();
  if (!characterResourceId) return undefined;
  const index = actor.characterIndex ?? 0;
  return { characterResourceId, characterIndex: Number.isInteger(index) && index >= 0 ? index : 0 };
}
