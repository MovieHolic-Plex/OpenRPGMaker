import {
  changeFriendship,
  changeItem,
  giftDayKey,
  type PlaySession,
} from "@/project/session";
import type { GiftPreferenceRank, GiftPrefs, GiftResponses, GameEvent, ItemId, Project } from "@/project/types";

export const GIFT_FRIENDSHIP_DELTA: Record<GiftPreferenceRank, number> = {
  loved: 80,
  liked: 45,
  neutral: 20,
  disliked: -20,
};

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

export function isGiftableEvent(event: GameEvent): boolean {
  return event.giftPrefs !== undefined || event.giftResponses !== undefined;
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

export function giveGiftToNpc(project: Project, session: PlaySession, event: GameEvent, itemId: ItemId): GiftResult {
  const npcKey = event.id?.trim();
  if (!isGiftSystemEnabled(project)) {
    return { ok: false, reason: "system-disabled", npcKey, message: responseText(event.giftResponses, "noItems") };
  }
  if (!isGiftableEvent(event)) {
    return { ok: false, reason: "event-not-giftable", npcKey, message: responseText(event.giftResponses, "noItems") };
  }
  if (!npcKey) {
    return { ok: false, reason: "missing-npc-key", message: responseText(event.giftResponses, "noItems") };
  }
  session.dailyGifts ??= {};
  const today = giftDayKey(session.gameTime);
  if (session.dailyGifts[npcKey] === today) {
    return { ok: false, reason: "already-gifted", npcKey, message: responseText(event.giftResponses, "alreadyGifted") };
  }
  if ((session.inventory[itemId] ?? 0) <= 0) {
    return { ok: false, reason: "no-item", npcKey, message: responseText(event.giftResponses, "noItems") };
  }
  const rank = giftRankForItem(event.giftPrefs, itemId);
  const delta = GIFT_FRIENDSHIP_DELTA[rank];
  changeItem(session, itemId, "-=", 1);
  const friendship = changeFriendship(session, npcKey, delta);
  session.dailyGifts[npcKey] = today;
  return {
    ok: true,
    npcKey,
    itemId,
    rank,
    delta,
    friendship,
    message: responseText(event.giftResponses, rank),
  };
}

function responseText(responses: GiftResponses | undefined, key: keyof typeof DEFAULT_GIFT_RESPONSES): string {
  const override = responses?.[key];
  return override && override.trim().length > 0 ? override : DEFAULT_GIFT_RESPONSES[key];
}
