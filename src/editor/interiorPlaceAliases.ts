// Compatibility names select authored places, never hardcoded furniture manifests.
export const PLACE_ALIASES: Readonly<Record<string, readonly [string, string]>> = {
  bedroom: ["house", "bedroom"], kitchen: ["house", "kitchen"],
  dining: ["inn", "dining"], corridor: ["inn", "corridor"],
  study: ["library", "study"], storage: ["warehouse", "hall"],
  tavern: ["tavern", "hall"],
  shop: ["shop", "salesfloor"], workshop: ["smithy", "workshop"],
  dwelling: ["house", "living"], manor: ["house", "living"], inn: ["inn", "dining"],
} as const;
