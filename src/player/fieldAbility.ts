// 명작 공백 #5(2026-09-27) — 필드 능력(메뉴에서 쓰는 스킬 → 대상 지정 공통 이벤트).
import { syncActorVitals } from "@/project/sessionVitals";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import type { Dir, Project, SkillRecord } from "@/project/types";

export const FIELD_ABILITY_TARGET_STRING = "fieldAbilityTarget";
export const FIELD_ABILITY_X_VARIABLE = "fieldAbilityX";
export const FIELD_ABILITY_Y_VARIABLE = "fieldAbilityY";
export const FIELD_ABILITY_USER_STRING = "fieldAbilityUser";

const DELTA: Record<Dir, { dx: number; dy: number }> = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };

export type FieldAbilityResult =
  | { readonly kind: "ok"; readonly commonEventId: string }
  | { readonly kind: "unusable"; readonly message: string };

/**
 * 필드 능력을 준비한다: MP 를 내고 대상 칸을 기록한다. 실행은 호출측이 공통 이벤트로 한다.
 * frontEventId 는 필드 씬이 정면 칸에서 찾은 이벤트(없으면 undefined).
 */
export function prepareFieldAbility(
  project: Project,
  session: PlaySessionLike,
  actorId: string,
  skill: SkillRecord,
  front: { readonly facing: Dir; readonly eventId?: string },
): FieldAbilityResult {
  const commonEventId = skill.fieldCommonEventId;
  if (!commonEventId || !(project.commonEvents ?? []).some((event) => event.id === commonEventId)) {
    return { kind: "unusable", message: `${skill.name}은(는) 필드에서 쓸 수 없습니다` };
  }
  syncActorVitals(project, session.actorVitals, actorId);
  const vitals = session.actorVitals[actorId];
  const cost = Math.max(0, Math.trunc(skill.mpCost.flat ?? 0)) + (vitals ? Math.floor((vitals.maxMp * Math.max(0, skill.mpCost.percentMax ?? 0)) / 100) : 0);
  if (!vitals || vitals.mp < cost) return { kind: "unusable", message: "MP 가 모자랍니다" };
  if (vitals.hp <= 0) return { kind: "unusable", message: "쓰러진 동료는 쓸 수 없습니다" };
  vitals.mp -= cost;
  const d = DELTA[front.facing];
  session.variables[FIELD_ABILITY_X_VARIABLE] = session.x + d.dx;
  session.variables[FIELD_ABILITY_Y_VARIABLE] = session.y + d.dy;
  session.stringVariables ??= {};
  session.stringVariables[FIELD_ABILITY_TARGET_STRING] = front.eventId ?? "";
  session.stringVariables[FIELD_ABILITY_USER_STRING] = actorId;
  return { kind: "ok", commonEventId };
}

/** 스킬이 필드 능력인가(메뉴 행에 '사용' 표시). */
export function isFieldAbility(skill: SkillRecord): boolean {
  return Boolean(skill.fieldCommonEventId);
}
