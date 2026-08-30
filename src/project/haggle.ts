export const HAGGLE_PATIENCE_MIN = 1;
export const HAGGLE_PATIENCE_MAX = 5;
export const HAGGLE_PATIENCE_DEFAULT = 3;
export const HAGGLE_INSULT_RATIO_MIN = 0.4;
export const HAGGLE_INSULT_RATIO_MAX = 0.9;
export const HAGGLE_INSULT_RATIO_DEFAULT = 0.6;
export const HAGGLE_MAX_DISCOUNT_MIN = 0;
export const HAGGLE_MAX_DISCOUNT_MAX = 0.4;
export const HAGGLE_MAX_DISCOUNT_DEFAULT = 0.25;

export type HaggleRole = "playerBuys" | "playerSells";
export type HaggleMood = "open" | "wary" | "cold";
export type HaggleBreakReason = "insulted" | "exhausted";

export type HaggleConfig = {
  readonly patience?: number;
  readonly insultRatio?: number;
  readonly maxDiscount?: number;
  readonly skillId?: string;
};

export type HaggleSetup = {
  readonly role: HaggleRole;
  readonly reference: number;
  readonly reserve: number;
  readonly patience: number;
  readonly insultRatio: number;
  readonly buyPrice: number;
};

export type HaggleVerdict =
  | { readonly kind: "accept"; readonly price: number }
  | {
      readonly kind: "counter";
      readonly price: number;
      readonly patience: number;
      readonly mood: HaggleMood;
      readonly reserve: number;
    }
  | { readonly kind: "broken"; readonly reason: HaggleBreakReason };

export type NormalizedHaggleConfig = {
  readonly patience: number;
  readonly insultRatio: number;
  readonly maxDiscount: number;
};

export function normalizeHaggleConfig(config: HaggleConfig | undefined): NormalizedHaggleConfig {
  const patience = clampInt(config?.patience, HAGGLE_PATIENCE_DEFAULT, HAGGLE_PATIENCE_MIN, HAGGLE_PATIENCE_MAX);
  const insultRatio = clampRatio(
    config?.insultRatio,
    HAGGLE_INSULT_RATIO_DEFAULT,
    HAGGLE_INSULT_RATIO_MIN,
    HAGGLE_INSULT_RATIO_MAX,
  );
  const maxDiscount = clampRatio(
    config?.maxDiscount,
    HAGGLE_MAX_DISCOUNT_DEFAULT,
    HAGGLE_MAX_DISCOUNT_MIN,
    HAGGLE_MAX_DISCOUNT_MAX,
  );
  return { patience, insultRatio, maxDiscount };
}

export function haggleBuyFloor(reference: number): number {
  return Math.max(0, Math.floor(safeInt(reference) / 2));
}

export function haggleSellCeiling(buyPrice: number): number {
  return Math.max(0, safeInt(buyPrice) - 1);
}

export function clampAgreedBuyPrice(reference: number, offer: number): number {
  const ref = safeInt(reference);
  return clampInt(offer, ref, haggleBuyFloor(ref), ref);
}

export function clampAgreedSellPrice(reference: number, buyPrice: number, offer: number): number {
  const ref = safeInt(reference);
  const ceiling = haggleSellCeiling(buyPrice);
  if (ceiling < ref) return ref;
  return clampInt(offer, ref, ref, ceiling);
}

export function hash32(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function haggleVisitKey(shopKey: string, itemId: string, dayKey: string): string {
  return `${shopKey}:${itemId}:${dayKey}`;
}

export function resolveHaggleReserve(input: {
  readonly role: HaggleRole;
  readonly reference: number;
  readonly buyPrice: number;
  readonly maxDiscount: number;
  readonly itemId: string;
  readonly merchantKey: string;
  readonly dayKey: string;
  readonly attemptIndex: number;
  readonly drift?: number;
}): number {
  const reference = safeInt(input.reference);
  const buyPrice = Math.max(reference, safeInt(input.buyPrice));
  const jitter = (hash32(`${input.itemId}|${input.merchantKey}|${input.dayKey}|${input.attemptIndex}`) % 1000) / 1000;
  const drift = safeInt(input.drift ?? 0);
  if (input.role === "playerBuys") {
    const floor = haggleBuyFloor(reference);
    const span = Math.max(0, Math.floor(reference * clampRatio(input.maxDiscount, HAGGLE_MAX_DISCOUNT_DEFAULT, 0, 0.4)));
    const raw = reference - Math.floor(span * (0.35 + jitter * 0.65)) + drift;
    return clampInt(raw, reference, floor, reference);
  }
  const ceiling = haggleSellCeiling(buyPrice);
  const span = Math.max(0, ceiling - reference);
  const raw = reference + Math.floor(span * (0.35 + jitter * 0.65)) + drift;
  return clampInt(raw, reference, reference, Math.max(reference, ceiling));
}

export function proposeHaggle(setup: HaggleSetup, offer: number): HaggleVerdict {
  const reference = safeInt(setup.reference);
  const buyPrice = Math.max(reference, safeInt(setup.buyPrice));
  const proposed = safeInt(offer);
  if (reference <= 0) {
    return { kind: "broken", reason: "insulted" };
  }
  const aggression = Math.abs(proposed - reference) / reference;
  if (aggression > setup.insultRatio) {
    return { kind: "broken", reason: "insulted" };
  }
  if (setup.role === "playerBuys") {
    const price = clampAgreedBuyPrice(reference, proposed);
    if (proposed >= setup.reserve && proposed >= haggleBuyFloor(reference) && proposed <= reference) {
      return { kind: "accept", price };
    }
  } else {
    const price = clampAgreedSellPrice(reference, buyPrice, proposed);
    const ceiling = haggleSellCeiling(buyPrice);
    if (proposed <= setup.reserve && proposed >= reference && proposed <= ceiling) {
      return { kind: "accept", price };
    }
  }
  const nextPatience = setup.patience - 1;
  if (nextPatience < 1) {
    return { kind: "broken", reason: "exhausted" };
  }
  const mood = moodFromAggression(aggression);
  const nextReserve = driftReserve(setup, aggression);
  return {
    kind: "counter",
    price: nextReserve,
    patience: nextPatience,
    mood,
    reserve: nextReserve,
  };
}

export function moodFromAggression(aggression: number): HaggleMood {
  if (aggression >= 0.35) return "cold";
  if (aggression >= 0.15) return "wary";
  return "open";
}

function driftReserve(setup: HaggleSetup, aggression: number): number {
  const reference = safeInt(setup.reference);
  const step = Math.max(1, Math.round(reference * 0.08 * aggression));
  if (setup.role === "playerBuys") {
    return clampInt(setup.reserve + step, reference, haggleBuyFloor(reference), reference);
  }
  const ceiling = haggleSellCeiling(setup.buyPrice);
  return clampInt(setup.reserve - step, reference, reference, Math.max(reference, ceiling));
}

function safeInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  const source = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.min(max, Math.max(min, source));
}

function clampRatio(value: number | undefined, fallback: number, min: number, max: number): number {
  const source = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, source));
}
