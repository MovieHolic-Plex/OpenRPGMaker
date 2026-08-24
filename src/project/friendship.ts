import {
  changeFriendship,
  changeItem,
  giftDayKey,
  type PlaySession,
} from "@/project/session";
import { isPositiveItemQuantity } from "@/project/itemQuantities";
import { resolveSocialKey } from "@/project/socialKey";
import {
  resolveBirthday,
  resolveGiftPrefs,
  resolveGiftResponses,
} from "@/project/characterProfiles";
import type { GameTime } from "@/project/gameTime";
import type { GiftPreferenceRank, GiftPrefs, GiftResponses, GameEvent, ItemId, Project } from "@/project/types";

export const GIFT_FRIENDSHIP_DELTA: Record<GiftPreferenceRank, number> = {
  loved: 80,
  liked: 45,
  neutral: 20,
  disliked: -20,
};
/** Gift friendship Δ multiplier when session.gameTime matches resolveBirthday (event or profile). */
export const BIRTHDAY_GIFT_MULTIPLIER = 2;

const DEFAULT_GIFT_RESPONSES: Record<GiftPreferenceRank | "alreadyGifted" | "noItems", string> = {
  loved: "정말 좋아하는 선물이야. 고마워!",
  liked: "마음에 들어. 고마워.",
  neutral: "고마워. 잘 받을게.",
  disliked: "음... 마음만 받을게.",
  alreadyGifted: "오늘은 이미 선물을 받았어.",
  noItems: "줄 수 있는 아이템이 없습니다.",
};

export type GiftResult =
  | {
      readonly ok: true;
      readonly npcKey: string;
      readonly itemId: ItemId;
      readonly rank: GiftPreferenceRank;
      readonly delta: number;
      readonly friendship: number;
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly reason: "system-disabled" | "event-not-giftable" | "no-item" | "already-gifted" | "missing-npc-key";
      readonly npcKey?: string;
      readonly message: string;
    };

export function isGiftSystemEnabled(project: Project): boolean {
  return project.system.giftSystem === true;
}

/** Giftable when resolved prefs/responses exist AND social key resolves (characterId required for self). */
export function isGiftableEvent(project: Project, event: GameEvent): boolean {
  if (resolveGiftPrefs(project, event) === undefined && resolveGiftResponses(project, event) === undefined) return false;
  return resolveSocialKey(event) != null;
}

export function giftRankForItem(prefs: GiftPrefs | undefined, itemId: ItemId): GiftPreferenceRank {
  if (prefs?.loved?.includes(itemId)) return "loved";
  if (prefs?.liked?.includes(itemId)) return "liked";
  if (prefs?.disliked?.includes(itemId)) return "disliked";
  return "neutral";
}

export function giftResponseForRank(responses: GiftResponses | undefined, rank: GiftPreferenceRank): string {
  return responseText(responses, rank);
}

export function giftResponseForKey(
  responses: GiftResponses | undefined,
  key: "alreadyGifted" | "noItems"
): string {
  return responseText(responses, key);
}

/** True only when gameTime is set and matches resolveBirthday season+day. No gameTime => never. */
export function isBirthdayToday(project: Project, event: GameEvent, gameTime: GameTime | undefined): boolean {
  const birthday = resolveBirthday(project, event);
  if (!birthday || !gameTime) return false;
  return gameTime.season === birthday.season && gameTime.day === birthday.day;
}

export function giveGiftToNpc(project: Project, session: PlaySession, event: GameEvent, itemId: ItemId): GiftResult {
  const npcKey = resolveSocialKey(event) ?? undefined;
  const responses = resolveGiftResponses(project, event);
  if (!isGiftSystemEnabled(project)) {
    return { ok: false, reason: "system-disabled", npcKey, message: responseText(responses, "noItems") };
  }
  if (!isGiftableEvent(project, event)) {
    return { ok: false, reason: "event-not-giftable", npcKey, message: responseText(responses, "noItems") };
  }
  if (!npcKey) {
    return { ok: false, reason: "missing-npc-key", message: responseText(responses, "noItems") };
  }
  const today = giftDayKey(session.gameTime);
  if (session.dailyGifts?.[npcKey] === today) {
    return { ok: false, reason: "already-gifted", npcKey, message: responseText(responses, "alreadyGifted") };
  }
  if (!isPositiveItemQuantity(session.inventory[itemId])) {
    return { ok: false, reason: "no-item", npcKey, message: responseText(responses, "noItems") };
  }
  const rank = giftRankForItem(resolveGiftPrefs(project, event), itemId);
  let delta = GIFT_FRIENDSHIP_DELTA[rank];
  if (isBirthdayToday(project, event, session.gameTime)) {
    delta = Math.trunc(delta * BIRTHDAY_GIFT_MULTIPLIER);
  }
  if (!changeItem(session, itemId, "-=", 1)) {
    return { ok: false, reason: "no-item", npcKey, message: responseText(responses, "noItems") };
  }
  const friendship = changeFriendship(session, npcKey, delta);
  session.dailyGifts ??= {};
  session.dailyGifts[npcKey] = today;
  return {
    ok: true,
    npcKey,
    itemId,
    rank,
    delta,
    friendship,
    message: responseText(responses, rank),
  };
}

export const DEFAULT_TALK_FRIENDSHIP_DELTA = 10;

export type TalkFriendshipConfig = boolean | { delta?: number };

export type SocialTalkResult =
  | {
      readonly ok: true;
      readonly npcKey: string;
      readonly delta: number;
      readonly friendship: number;
      readonly message?: string;
    }
  | {
      readonly ok: false;
      readonly reason: "not-enabled" | "missing-npc-key" | "already-talked";
      readonly npcKey?: string;
      readonly message?: string;
    };

/** Opt-in talk friendship: characterId + talkFriendship true | { delta? }. */
export function isTalkFriendshipEnabled(event: GameEvent): boolean {
  if (!event.characterId?.trim()) return false;
  const flag = event.talkFriendship;
  if (flag === true) return true;
  if (flag && typeof flag === "object") return true;
  return false;
}

function talkFriendshipDelta(flag: TalkFriendshipConfig | undefined): number {
  if (flag && typeof flag === "object" && typeof flag.delta === "number" && Number.isFinite(flag.delta)) {
    return Math.trunc(flag.delta);
  }
  return DEFAULT_TALK_FRIENDSHIP_DELTA;
}

/**
 * Once-per-day talk friendship grant. Uses resolveSocialKey only (no event.id).
 * Independent of dailyGifts. Mutates session.dailyTalks and friendship on success.
 */
export function trySocialTalk(session: PlaySession, event: GameEvent): SocialTalkResult {
  if (!isTalkFriendshipEnabled(event)) {
    return { ok: false, reason: "not-enabled" };
  }
  const npcKey = resolveSocialKey(event);
  if (!npcKey) {
    return { ok: false, reason: "missing-npc-key" };
  }
  session.dailyTalks ??= {};
  const today = giftDayKey(session.gameTime);
  if (session.dailyTalks[npcKey] === today) {
    return { ok: false, reason: "already-talked", npcKey };
  }
  const delta = talkFriendshipDelta(event.talkFriendship);
  const friendship = changeFriendship(session, npcKey, delta);
  session.dailyTalks[npcKey] = today;
  return { ok: true, npcKey, delta, friendship };
}

function responseText(responses: GiftResponses | undefined, key: keyof typeof DEFAULT_GIFT_RESPONSES): string {
  const override = responses?.[key];
  return override && override.trim().length > 0 ? override : DEFAULT_GIFT_RESPONSES[key];
}
export const DEFAULT_FRIENDSHIP_MAX = 1000;
export const DEFAULT_FRIENDSHIP_TIERS = 10;

const FRIENDSHIP_TIER_LABELS: readonly (string | undefined)[] = [
  "무관심",
  "아는 사이",
  "친근",
  "친구",
  "가까운 친구",
  "절친",
  "신뢰",
  "깊은 신뢰",
  "소중한 사이",
  "각별한 사이",
  "특별한 사이",
];

/** Map raw friendship (0..max) to discrete tier 0..tiers. */
export function friendshipTier(
  value: number,
  max: number = DEFAULT_FRIENDSHIP_MAX,
  tiers: number = DEFAULT_FRIENDSHIP_TIERS
): number {
  const safeMax = Number.isFinite(max) && max > 0 ? max : DEFAULT_FRIENDSHIP_MAX;
  const safeTiers = Number.isFinite(tiers) && tiers > 0 ? Math.trunc(tiers) : DEFAULT_FRIENDSHIP_TIERS;
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= safeMax) return safeTiers;
  return Math.min(safeTiers, Math.floor((value / safeMax) * safeTiers));
}

/** Optional short Korean label for a friendship tier. */
export function friendshipTierLabel(tier: number): string | undefined {
  if (!Number.isFinite(tier)) return undefined;
  const index = Math.max(0, Math.min(FRIENDSHIP_TIER_LABELS.length - 1, Math.trunc(tier)));
  return FRIENDSHIP_TIER_LABELS[index];
}

/** Dialogue suffix after a successful social delta (e.g. gift). */
export function formatFriendshipFeedback(input: {
  readonly delta: number;
  readonly friendship: number;
  readonly max?: number;
  readonly tiers?: number;
}): string {
  const tiers = input.tiers ?? DEFAULT_FRIENDSHIP_TIERS;
  const tier = friendshipTier(input.friendship, input.max ?? DEFAULT_FRIENDSHIP_MAX, tiers);
  const delta = Math.trunc(Number.isFinite(input.delta) ? input.delta : 0);
  const signed = delta > 0 ? `+${delta}` : `${delta}`;
  return `호감 ${signed} (${tier}/${tiers})`;
}

/** Star bar + numeric summary for status menu rows. */
export function formatFriendshipTierBar(
  value: number,
  max: number = DEFAULT_FRIENDSHIP_MAX,
  tiers: number = DEFAULT_FRIENDSHIP_TIERS,
  stars: number = 5
): string {
  const tier = friendshipTier(value, max, tiers);
  const safeStars = Number.isFinite(stars) && stars > 0 ? Math.trunc(stars) : 5;
  const safeTiers = Number.isFinite(tiers) && tiers > 0 ? Math.trunc(tiers) : DEFAULT_FRIENDSHIP_TIERS;
  const filled = Math.min(safeStars, Math.max(0, Math.round((tier / safeTiers) * safeStars)));
  const bar = `${"★".repeat(filled)}${"☆".repeat(Math.max(0, safeStars - filled))}`;
  return `${bar} (${tier}/${safeTiers}) · ${Math.trunc(Number.isFinite(value) ? value : 0)}`;
}

export type FriendshipListEntry = {
  readonly key: string;
  readonly value: number;
  readonly tier: number;
  readonly secondary: string;
  readonly label?: string;
  /** Optional profile displayName when friendship key matches characters[characterId]. */
  readonly displayName?: string;
};

/** Sorted read-only list of known social keys present in session.friendship. */
export function listFriendshipEntries(
  friendship: Readonly<Record<string, number>> | undefined,
  max: number = DEFAULT_FRIENDSHIP_MAX,
  tiers: number = DEFAULT_FRIENDSHIP_TIERS,
  project?: Project
): FriendshipListEntry[] {
  if (!friendship) return [];
  return Object.keys(friendship)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const value = Math.trunc(Number.isFinite(friendship[key]) ? friendship[key]! : 0);
      const tier = friendshipTier(value, max, tiers);
      const displayName = project?.characters?.[key]?.displayName?.trim();
      return {
        key,
        value,
        tier,
        secondary: formatFriendshipTierBar(value, max, tiers),
        label: friendshipTierLabel(tier),
        ...(displayName ? { displayName } : {}),
      };
    });
}
