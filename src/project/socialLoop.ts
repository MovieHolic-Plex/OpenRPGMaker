// project/socialLoop.ts
// 연애·관계 게임의 하루 루프 뼈대(2026-10-16). 옵트인이다 — `system.socialLoop` 이 없으면 아무 동작도 바뀌지 않고 저장 바이트도 그대로다.
// 켜면 (1) 호감이 오르는 대화 한 번이 하루 시간대 한 칸을 쓴다, (2) 한 사람에게서 하루에 얻는 호감에 상한이 있다.
// 판정은 여기 하나(`trySocialTalk` 가 부른다). 시계를 얼마나 움직일지도 여기서 계산하고, 실제 시계 이동은 player 쪽(`player/socialSlotClock.ts`)이 한다.

import { minutesUntilDayEnd, resolveTimeSystem } from "@/project/gameTime";
import { giftDayKey, type PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export const DEFAULT_SOCIAL_SLOTS_PER_DAY = 3;
export const DEFAULT_SOCIAL_DAILY_FRIENDSHIP_CAP = 20;
export const MAX_SOCIAL_SLOTS_PER_DAY = 12;

/** `system.socialLoop` — 저장 형태. 필드를 생략하면 위 기본값. */
export interface SocialLoopConfig {
  /** 하루에 호감을 올리는 대화를 할 수 있는 횟수(시간대 칸 수). 1..12. */
  readonly slotsPerDay?: number;
  /** 한 사람에게서 하루에 얻을 수 있는 대화 호감 합계. 선물은 따로 센다. */
  readonly dailyFriendshipCap?: number;
}

export interface ResolvedSocialLoop {
  readonly slotsPerDay: number;
  readonly dailyFriendshipCap: number;
}

/** `session.socialLoop` — 오늘 쓴 칸과 사람별 오늘 얻은 호감. 날이 바뀌면 다음 대화에서 새로 시작한다. */
export interface SocialLoopDayState {
  readonly day: string;
  readonly slotsUsed: number;
  readonly gained: Readonly<Record<string, number>>;
}

function wholeInRange(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function resolveSocialLoop(project: Pick<Project, "system"> | undefined): ResolvedSocialLoop | undefined {
  const config = project?.system?.socialLoop;
  if (!config || typeof config !== "object") return undefined;
  return {
    slotsPerDay: wholeInRange(config.slotsPerDay, DEFAULT_SOCIAL_SLOTS_PER_DAY, 1, MAX_SOCIAL_SLOTS_PER_DAY),
    dailyFriendshipCap: wholeInRange(config.dailyFriendshipCap, DEFAULT_SOCIAL_DAILY_FRIENDSHIP_CAP, 1, 1000),
  };
}

/** 오늘의 상태. 저장된 날과 오늘이 다르면 빈 상태. */
export function socialLoopToday(session: PlaySession): SocialLoopDayState {
  const today = giftDayKey(session.gameTime);
  const state = session.socialLoop;
  return state && state.day === today ? state : { day: today, slotsUsed: 0, gained: {} };
}

export function socialSlotsLeft(session: PlaySession, loop: ResolvedSocialLoop): number {
  return Math.max(0, loop.slotsPerDay - socialLoopToday(session).slotsUsed);
}

export type SocialLoopGate =
  | { readonly ok: true; readonly grant: number; readonly slotsLeft: number; readonly capped: boolean }
  | { readonly ok: false; readonly reason: "no-slots" };

/**
 * 이번 대화가 얼마를 줄 수 있는가(상태는 건드리지 않는다).
 * 하루 상한을 채운 사람과 또 이야기해도 거부하지 않는다 — 대화는 실제로 시간을 쓰므로 칸은 쓰고 호감만 0 이다(grant 0, capped).
 * 거부하면 플레이어가 시계를 못 움직인 채 갇힌다.
 */
export function socialLoopGate(session: PlaySession, loop: ResolvedSocialLoop, npcKey: string, delta: number): SocialLoopGate {
  const today = socialLoopToday(session);
  if (today.slotsUsed >= loop.slotsPerDay) return { ok: false, reason: "no-slots" };
  const room = Math.max(0, loop.dailyFriendshipCap - (today.gained[npcKey] ?? 0));
  const grant = delta > 0 ? Math.min(delta, room) : delta;
  return { ok: true, grant, slotsLeft: loop.slotsPerDay - today.slotsUsed - 1, capped: grant !== delta };
}

/** 대화가 성공했을 때 칸 하나와 얻은 호감을 기록한다. */
export function recordSocialLoopTalk(session: PlaySession, npcKey: string, granted: number): void {
  const today = socialLoopToday(session);
  session.socialLoop = {
    day: today.day,
    slotsUsed: today.slotsUsed + 1,
    gained: { ...today.gained, [npcKey]: (today.gained[npcKey] ?? 0) + Math.max(0, granted) },
  };
}

/**
 * 시간대 한 칸의 분. 하루 길이를 칸 수로 나눈 값이고, 대화가 하루를 끝내 버리지 않도록 남은 시간 안으로 자른다.
 * 시간 시스템이 꺼져 있으면 0(시계는 움직이지 않고 칸 수 제한만 남는다 — 하루는 잠으로만 넘어간다).
 */
export function socialSlotMinutes(project: Project, session: PlaySession, loop: ResolvedSocialLoop): number {
  const system = resolveTimeSystem(project);
  if (!system || !session.gameTime) return 0;
  const dayMinutes = Math.max(1, (system.dayEndHour - system.dayStartHour) * 60);
  const slot = Math.max(1, Math.floor(dayMinutes / loop.slotsPerDay));
  return Math.max(0, Math.min(slot, minutesUntilDayEnd(session.gameTime, system) - 1));
}

export function socialLoopSummary(project: Project, session: PlaySession): string | undefined {
  const loop = resolveSocialLoop(project);
  if (!loop) return undefined;
  return `오늘 남은 시간 ${socialSlotsLeft(session, loop)}/${loop.slotsPerDay}`;
}

/** 오늘 칸을 다 썼는가. */
export function socialSlotsExhausted(session: PlaySession, loop: ResolvedSocialLoop): boolean {
  return socialSlotsLeft(session, loop) <= 0;
}
