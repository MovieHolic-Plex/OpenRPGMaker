import type { Project, StateRecord } from "../types";
import type { LintIssue } from "./projectLint";

/**
 * 기술·장비가 거는 상태가 실제로 닿는 자리를 본다(검토 경고, 막지 않는다).
 *
 * 왜(2026-11-10 폴른 스타 적대 VQA, fs-vqa-fix-all):
 *  1. 카엘 고유 「별 표식」(감정 계열 상태)을 적 약 25종도 쓰는 공용 기술 skill_sword_slash 에 달아,
 *     적 병사가 아군에게 카엘의 표식을 새겼다 — 영웅 개성이 적에게 샜다.
 *  2. 「별꿰기 창 — 평타: 맞히면 가끔 관통상을 낸다」가 적 111 중 110 이 관통상 면역(E)이라 확률 100% 로도 걸리지 않았다.
 *     적 전부가 E 인지 보는 규칙은 1/111(달빛의 용 A) 같은 경우를 못 잡으므로 «걸리는 적 수» 를 센다.
 *
 * 구조화 출력: code 와 message 안의 「skill:<id>」「state:<id>」「적 n/m」 을 조수·도구가 그대로 읽는다.
 */

/** 걸리는 적이 이 수 이하이면 알린다(0 이면 «아무 적에게도 안 걸린다»). */
const FEW_ENEMIES = 3;

type EnemyLike = { id: string; name: string; actions?: readonly { skillId?: string }[]; stateRates?: Record<string, string> };

function enemiesUsing(enemies: readonly EnemyLike[], skillId: string): EnemyLike[] {
  return enemies.filter((enemy) => (enemy.actions ?? []).some((action) => action.skillId === skillId));
}

function receivers(enemies: readonly EnemyLike[], stateId: string): EnemyLike[] {
  return enemies.filter((enemy) => enemy.stateRates?.[stateId] !== "E");
}

export function lintBattleStateReach(project: Project): LintIssue[] {
  const db = project.database;
  const enemies = (db.enemies ?? []) as unknown as EnemyLike[];
  const states = new Map<string, StateRecord>((db.states ?? []).map((state) => [state.id, state]));
  const issues: LintIssue[] = [];

  for (const skill of db.skills ?? []) {
    for (const effect of skill.stateEffects ?? []) {
      if (effect.operation !== "add") continue;
      const state = states.get(effect.stateId);
      if (!state?.emotion) continue;
      const users = enemiesUsing(enemies, skill.id);
      if (users.length === 0) continue;
      issues.push({
        severity: "warning",
        code: "skill-identity-state-shared-with-enemies",
        message: `skill:${skill.id}(${skill.name}) 이 계열 상태 state:${state.id}(${state.name})를 거는데 적 ${users.length}종도 이 기술을 쓴다`
          + ` (${users.slice(0, 3).map((enemy) => enemy.name).join(", ")}${users.length > 3 ? " …" : ""}). 적이 아군에게 같은 표식을 건다 — 아군 전용 사본 기술로 떼어 낸다.`,
      });
    }
  }

  if (enemies.length === 0) return issues;
  const sources: { label: string; stateId: string }[] = [];
  for (const item of db.equipment ?? []) {
    if ((item.stateInflictionChance ?? 0) <= 0) continue;
    for (const stateId of item.stateInflictIds ?? []) sources.push({ label: `equipment:${item.id}(${item.name})`, stateId });
  }
  for (const skill of db.skills ?? []) {
    if (skill.scope !== "enemy" && skill.scope !== "allEnemies") continue;
    for (const effect of skill.stateEffects ?? []) {
      if (effect.operation === "add" && effect.chance > 0) sources.push({ label: `skill:${skill.id}(${skill.name})`, stateId: effect.stateId });
    }
  }
  for (const source of sources) {
    const can = receivers(enemies, source.stateId);
    if (can.length > FEW_ENEMIES) continue;
    const state = states.get(source.stateId);
    issues.push({
      severity: "warning",
      code: can.length === 0 ? "state-reaches-no-enemy" : "state-reaches-few-enemies",
      message: `${source.label} 이 거는 state:${source.stateId}(${state?.name ?? "?"})가 걸리는 적 ${can.length}/${enemies.length}`
        + (can.length ? `: ${can.map((enemy) => enemy.name).join(", ")}` : "") + ". 나머지는 내성 E 라 설명한 특성이 화면에 나오지 않는다.",
    });
  }
  return issues;
}
