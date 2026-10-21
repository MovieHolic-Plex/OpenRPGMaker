import {
  changeFriendship,
  changeItem,
  giftDayKey,
  type PlaySession,
} from "@/project/session";
import { isPositiveItemQuantity } from "@/project/itemQuantities";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import { resolveSocialKey } from "@/project/socialKey";
import { recordSocialLoopTalk, resolveSocialLoop, socialLoopGate, socialLoopToday } from "@/project/socialLoop";
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
  // 소셜 루프가 켜져 있으면 선물 호감도 사람별 하루 상한에 센다(칸은 쓰지 않는다).
  const loop = resolveSocialLoop(project);
  if (loop && delta > 0) {
    const day = socialLoopToday(session);
    delta = Math.min(delta, Math.max(0, loop.dailyFriendshipCap - (day.gained[npcKey] ?? 0)));
    session.socialLoop = { day: day.day, slotsUsed: day.slotsUsed, gained: { ...day.gained, [npcKey]: (day.gained[npcKey] ?? 0) + delta } };
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
      /** 소셜 루프가 하루 상한으로 호감을 깎았다(0 일 수 있다 — 칸은 썼다). */
      readonly capped?: boolean;
      /** 소셜 루프가 켜져 있을 때 오늘 남은 시간대 칸(이 대화가 쓴 뒤). */
      readonly slotsLeft?: number;
    }
  | {
      readonly ok: false;
      readonly reason: "not-enabled" | "missing-npc-key" | "already-talked" | "no-slots";
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
export function trySocialTalk(session: PlaySession, event: GameEvent, project?: Project): SocialTalkResult {
  if (!isTalkFriendshipEnabled(event)) {
    return { ok: false, reason: "not-enabled" };
  }
  const npcKey = resolveSocialKey(event);
  if (!npcKey) {
    return { ok: false, reason: "missing-npc-key" };
  }
  session.dailyTalks ??= {};
  const today = giftDayKey(session.gameTime);
  const loop = resolveSocialLoop(project);
  // 소셜 루프가 켜져 있으면 「하루 한 번」 대신 시간대 칸 + 사람별 하루 상한이 횟수를 정한다.
  if (!loop && session.dailyTalks[npcKey] === today) {
    return { ok: false, reason: "already-talked", npcKey };
  }
  const wanted = talkFriendshipDelta(event.talkFriendship);
  if (!loop) {
    const friendship = changeFriendship(session, npcKey, wanted);
    session.dailyTalks[npcKey] = today;
    return { ok: true, npcKey, delta: wanted, friendship };
  }
  const gate = socialLoopGate(session, loop, npcKey, wanted);
  if (!gate.ok) return { ok: false, reason: gate.reason, npcKey };
  const friendship = changeFriendship(session, npcKey, gate.grant);
  session.dailyTalks[npcKey] = today;
  recordSocialLoopTalk(session, npcKey, gate.grant);
  return { ok: true, npcKey, delta: gate.grant, friendship, capped: gate.capped, slotsLeft: gate.slotsLeft };
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

/** 관계 중심(연애) 게임의 단계 이름 — 「절친」「신뢰」 같은 우정 낱말 대신 마음의 거리(첫사랑 VQA 1차). */
const ROMANCE_TIER_LABELS: readonly (string | undefined)[] = [
  "낯선 사이",
  "어색함",
  "아는 사이",
  "편한 사이",
  "가까워짐",
  "설렘",
  "두근거림",
  "마음이 기욺",
  "좋아함",
  "깊이 좋아함",
  "사랑",
];

/** Optional short Korean label for a friendship tier. romance = 관계 중심 게임의 단계 이름. */
export function friendshipTierLabel(tier: number, romance = false): string | undefined {
  if (!Number.isFinite(tier)) return undefined;
  const labels = romance ? ROMANCE_TIER_LABELS : FRIENDSHIP_TIER_LABELS;
  const index = Math.max(0, Math.min(labels.length - 1, Math.trunc(tier)));
  return labels[index];
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

/** 호칭 꼬리(「한서연 선배」의 「선배」) — HUD 처럼 좁은 곳은 이름만 쓴다. 호칭만 남는 이름(「선생님」)은 그대로 둔다. */
export function friendshipShortName(name: string): string {
  // 「하린 (운영자)」 같은 괄호 설명은 HUD 에서 잘려 「하린 (운…」 이 되던 것(연애 R06) — 괄호 뒤는 버린다.
  const plain = name.trim().replace(/\s*[(（\[【].*$/u, "").trim() || name.trim();
  let short = plain.replace(/\s+(선배|후배|님|씨|선생님?|교수님?|사장님|점장님|쌤|오빠|언니|누나|형)$/u, "");
  // 「바리스타 선배 도윤」·「산책객 민호」 처럼 직함이 앞에 붙은 한글 이름은 마지막 낱말(이름)만.
  const words = short.split(/\s+/u);
  const last = words[words.length - 1] ?? "";
  if (words.length > 1 && /^[가-힣]{2,4}$/u.test(last)) short = last;
  return short.length >= 2 ? short : plain;
}

const eventNameByCharacter = new WeakMap<object, Map<string, string>>();

/**
 * 호감 키(characterId)의 사람 이름. 캐릭터 프로필이 있으면 그 displayName, 없으면(place_npc/make_villager 로만 만든 NPC) 그 키를 가진 이벤트의 이름.
 * 프로젝트 단위로 한 번 색인한다(HUD 가 프레임마다 부른다).
 */
export function friendshipDisplayName(project: Project | undefined, key: string): string | undefined {
  if (!project) return undefined;
  const trimmed = key.trim();
  const base = trimmed.replace(/(?:_\d+)+$/u, "") || trimmed;
  const stripped = base.replace(/^(?:ev_)?npc_/u, "");
  const candidates = [...new Set([trimmed, base, `npc_${stripped}`, stripped])];
  for (const candidate of candidates) {
    const profile = project.characters?.[candidate]?.displayName?.trim();
    if (profile) return profile;
  }
  let index = eventNameByCharacter.get(project);
  if (!index) {
    index = new Map();
    for (const map of Object.values(project.maps ?? {})) {
      for (const event of map.events ?? []) {
        const id = event.characterId?.trim();
        const name = event.name?.trim();
        if (id && name && !index.has(id)) index.set(id, name);
      }
    }
    eventNameByCharacter.set(project, index);
  }
  for (const candidate of candidates) {
    const found = index.get(candidate);
    if (found) return found;
  }
  return undefined;
}

/** Sorted read-only list of known social keys present in session.friendship. */
export function listFriendshipEntries(
  friendship: Readonly<Record<string, number>> | undefined,
  max: number = DEFAULT_FRIENDSHIP_MAX,
  tiers: number = DEFAULT_FRIENDSHIP_TIERS,
  project?: Project
): FriendshipListEntry[] {
  if (!friendship) return [];
  const merged = new Map<string, { key: string; value: number; displayName?: string }>();
  for (const rawKey of Object.keys(friendship).sort((a, b) => a.localeCompare(b))) {
    const value = Math.trunc(Number.isFinite(friendship[rawKey]) ? friendship[rawKey]! : 0);
    const displayName = friendshipDisplayName(project, rawKey);
    const baseKey = (rawKey.trim().replace(/(?:_\d+)+$/u, "") || rawKey.trim()).replace(/^(?:ev_)?npc_/u, "");
    const groupKey = displayName ? `name:${displayName}` : `key:${baseKey}`;
    const prev = merged.get(groupKey);
    if (!prev) {
      merged.set(groupKey, { key: rawKey, value, ...(displayName ? { displayName } : {}) });
    } else {
      const preferNewKey = /_\d+$/u.test(prev.key) && !/_\d+$/u.test(rawKey);
      merged.set(groupKey, {
        key: preferNewKey ? rawKey : prev.key,
        value: Math.max(prev.value, value),
        ...((displayName ?? prev.displayName) ? { displayName: displayName ?? prev.displayName } : {}),
      });
    }
  }
  const romance = project ? usesRelationshipMenu(project) : false;
  return [...merged.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ key, value, displayName }) => {
      const tier = friendshipTier(value, max, tiers);
      return {
        key,
        value,
        tier,
        secondary: formatFriendshipTierBar(value, max, tiers),
        label: friendshipTierLabel(tier, romance),
        ...(displayName ? { displayName } : {}),
      };
    });
}
