import { findCharsetSemantic } from "@/assets/charsetSemantics";

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

export const CHARSET_BATTLERS = [...WALK_CHIP_BATTLERS, ...CLASS_BATTLERS];

const byId = new Map(CHARSET_BATTLERS.map((entry) => [entry.resourceId, entry]));
export function charsetBattler(resourceId: string | undefined) {
  return resourceId ? byId.get(resourceId) : undefined;
}

export function charsetBattlerForCharacter(characterResourceId?: string, characterIndex = 0): string | undefined {
  if (!/^easyrpg-charset-actor[1-4]$/.test(characterResourceId ?? "")) return undefined;
  if (!Number.isInteger(characterIndex) || characterIndex < 0 || characterIndex > 7) return undefined;
  return `charset-battler-${characterResourceId!.slice("easyrpg-charset-".length)}-${characterIndex}`;
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
