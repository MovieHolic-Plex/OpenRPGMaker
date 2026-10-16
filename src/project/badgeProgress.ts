// project/badgeProgress.ts
// 「획득한 배지 수」 — 이벤트 조건 badgeCount 와 복종 레벨 상한(obedienceLevelCaps)의 단일 해석기.
//
// 배지 스위치 규칙(진행 게이팅의 정본): 배지 N 의 스위치 id 는 `mx_badge_N`(N 은 1부터)이고,
// `system.monsterCampaign.badges[i].switchId` 가 정본이다. 캠페인 정의가 있으면 그 목록을 세고,
// 정의가 없는 부분 프로젝트·세션만 있는 호출은 `mx_badge_N` 규약 스위치를 센다.
import { withJosa } from "@/util/josa";
import type { Project } from "@/project/types";
import type { ObedienceLevelCaps } from "@/project/types/database";

/** 캠페인 정의가 없을 때 배지로 보는 스위치 id 규약. */
export const BADGE_SWITCH_PATTERN = /^mx_badge_\d+$/;

/** 이 프로젝트의 배지 스위치 id 목록(캠페인 정의 순서). 정의가 없으면 undefined. */
export function campaignBadgeSwitchIds(project: { readonly system?: { readonly monsterCampaign?: { readonly badges?: readonly { readonly switchId: string }[] } } } | undefined): string[] | undefined {
  const badges = project?.system?.monsterCampaign?.badges;
  return badges ? badges.map((badge) => badge.switchId) : undefined;
}

/**
 * 켜진 배지 스위치 수. switchIds 가 있으면 그 목록 중 켜진 것, 없으면 `mx_badge_N` 규약 스위치 중 켜진 것.
 * flags = 세션 스위치 맵(session.switches).
 */
export function earnedBadgeCount(flags: Readonly<Record<string, boolean>> | undefined, switchIds?: readonly string[]): number {
  if (!flags) return 0;
  if (switchIds) return [...new Set(switchIds)].filter((id) => flags[id] === true).length;
  return Object.keys(flags).filter((id) => BADGE_SWITCH_PATTERN.test(id) && flags[id] === true).length;
}

/** 조건 평가 문맥에 끼울 지연 해석기 — 프로젝트의 캠페인 배지 스위치 목록. 정의가 없으면 규약 스위치로 센다(빈 객체). */
export function badgeContext(project: object | undefined): { readonly badgeSwitchIds?: () => readonly string[] } {
  const ids = campaignBadgeSwitchIds(project as Project | undefined);
  return ids ? { badgeSwitchIds: () => ids } : {};
}

// ── 원작식 복종 레벨 상한(obedienceLevelCaps) ────────────────────────────────────────────────────────────────────

/** 일차 사다리: 배지 0개일 때 base, 배지 하나마다 +step(레벨 상한 100). 설정 화면·도구 기본값이 같이 쓴다. */
export function linearObedienceCaps(badgeTotal: number, baseLevel = 20, step = 5): { badges: number; maxLevel: number }[] {
  const total = Math.max(0, Math.min(64, Math.trunc(badgeTotal)));
  const base = Math.max(1, Math.min(100, Math.trunc(baseLevel)));
  const inc = Math.max(0, Math.min(100, Math.trunc(step)));
  return Array.from({ length: total + 1 }, (_, badges) => ({ badges, maxLevel: Math.min(100, base + badges * inc) }));
}

/** 상한 사다리 기본값(도구가 caps 를 생략했을 때): 배지 0개 Lv20, 이후 배지마다 +5. */
export function defaultObedienceCaps(badgeTotal: number): { badges: number; maxLevel: number }[] {
  return linearObedienceCaps(badgeTotal);
}

/** 이 배지 수에서 말을 듣는 최대 레벨. 규칙이 꺼져 있거나 caps 가 비면 undefined(= 제한 없음). */
export function obedienceLevelCapFor(rule: ObedienceLevelCaps | undefined, earnedBadges: number): number | undefined {
  if (!rule || rule.enabled !== true || rule.caps.length === 0) return undefined;
  let cap = rule.caps[0]!.maxLevel;
  for (const entry of rule.caps) if (entry.badges <= earnedBadges) cap = entry.maxLevel;
  return cap;
}

/** 프로젝트·세션 스위치로 본 현재 복종 상한. 규칙이 꺼져 있으면 undefined. */
export function currentObedienceCap(project: Pick<Project, "system">, switches: Readonly<Record<string, boolean>> | undefined): number | undefined {
  const campaign = project.system.monsterCampaign;
  const rule = campaign?.obedienceLevelCaps;
  if (!rule || rule.enabled !== true) return undefined;
  return obedienceLevelCapFor(rule, earnedBadgeCount(switches, campaignBadgeSwitchIds(project)));
}

const DEFAULT_REFUSE_TAILS = [
  "말을 듣지 않는다!",
  "제멋대로 굴고 있다!",
  "모르는 척 딴청을 피운다!",
  "트레이너의 지시를 따르지 않는다!",
] as const;

/** 거부 문장. 틀이 있으면 {name} 을 바꾸고, 없으면 기본 문장 넷을 차례로 돌려 쓴다(turn 으로 결정적 — 조사는 이름 받침에 맞춘다). */
export function obedienceRefusalLine(rule: ObedienceLevelCaps | undefined, name: string, turn: number): string {
  const template = rule?.refuseLine?.trim();
  if (template) return template.replaceAll("{name}", name);
  return `${withJosa(name, "은/는")} ${DEFAULT_REFUSE_TAILS[Math.abs(Math.trunc(turn)) % DEFAULT_REFUSE_TAILS.length]!}`;
}
