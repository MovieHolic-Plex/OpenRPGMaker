import { findCharsetSemantic } from "@/assets/charsetSemantics";
import { READY_PEOPLE_BATTLERS } from "@/assets/charsetBattlerReady";

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
    label: `걷기 칩 전투 · ${findCharsetSemantic(`tex_easyrpg_charset_${actor}`, characterIndex)?.label ?? `${actor} ${characterIndex + 1}`}`,
  };
});

/**
 * 걷기 칩 자동 대응이 아닌 **직업 전용** 전투 시트. 걷기 칩은 같지만 전투 도트가 다르다.
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
    label: `걷기 칩 전투 · ${findCharsetSemantic(`tex_easyrpg_charset_${people}`, characterIndex)?.label ?? `${people} ${characterIndex + 1}`}`,
  };
}).filter((entry) => READY_PEOPLE_BATTLERS.has(entry.resourceId));

export const CHARSET_BATTLERS = [...WALK_CHIP_BATTLERS, ...PEOPLE_CHIP_BATTLERS, ...CLASS_BATTLERS];

const byId = new Map(CHARSET_BATTLERS.map((entry) => [entry.resourceId, entry]));
export function charsetBattler(resourceId: string | undefined) {
  return resourceId ? byId.get(resourceId) : undefined;
}

export function charsetBattlerForCharacter(characterResourceId?: string, characterIndex = 0): string | undefined {
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

/** 측면 표시·내보내기가 같은 선택 계약을 쓴다. 저작 시트는 자동 대응보다 우선한다. */
export function resolvePartyBattleCharset(actor: {
  readonly battleCharacterResourceId?: string;
  readonly characterResourceId?: string;
  readonly characterIndex?: number;
}, retro = false): string | undefined {
  const authored = actor.battleCharacterResourceId;
  const generatedHero = authored === "hero" || authored?.startsWith("generated-actor-hero-");
  if (authored && !generatedHero) return authored;
  return charsetBattlerForCharacter(actor.characterResourceId, actor.characterIndex)
    ?? (retro && generatedHero ? undefined : authored);
}
