// Compatibility names select authored places, never hardcoded furniture manifests.
export const PLACE_ALIASES: Readonly<Record<string, readonly [string, string]>> = {
  bedroom: ["house", "bedroom"], kitchen: ["house", "kitchen"],
  dining: ["inn", "dining"], corridor: ["inn", "corridor"],
  study: ["library", "study"], storage: ["warehouse", "hall"],
  tavern: ["tavern", "hall"],
  shop: ["shop", "salesfloor"], workshop: ["smithy", "workshop"],
  dwelling: ["house", "living"], manor: ["house", "living"], inn: ["inn", "dining"],
} as const;

/** 번들 기본값(여관·민가)만 있을 때 옛 방 테마가 기댈 장소 — 저작된 꾸러미의 PLACE_ALIASES 가 먼저다. */
export const FALLBACK_PLACE_ALIASES: Readonly<Record<string, readonly [string, string]>> = {
  tavern: ["inn", "dining"], storage: ["inn", "pantry"], reception: ["inn", "reception"],
  living: ["house", "living"],
} as const;
