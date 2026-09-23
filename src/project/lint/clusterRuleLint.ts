// project/lint/clusterRuleLint.ts
// 타일 그룹 규칙(cluster-rule:*) 진단만 따로 낸다. projectLint 도 이 함수를 그대로 쓴다.
//
// 따로 두는 이유: 규칙 감사 배지·패널은 cluster-rule 만 보는데 projectLint 전체를 돌리면
// 직렬화 왕복(serialize→deserialize→마이그레이션→검증)까지 딸려 온다. 기본 100×100 마을에서
// 한 번에 ~800ms 라 칠하기 드래그 중 250ms 마다 메인 스레드를 멈춰 세웠다(2026-09-23 실측).

import type { Project } from "../types";
import type { LintIssue } from "./projectLint";
import { validateClusterRules, validateClusterRulesForMaps, type ClusterRuleViolation } from "./clusterRuleValidators";

/** cluster-rule:* 진단. mapIds 가 있으면 그 맵만 본다(전역 개수 규칙은 여전히 프로젝트 전체). */
export function clusterRuleLintIssues(project: Project, mapIds?: readonly string[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const violations = mapIds ? validateClusterRulesForMaps(project, mapIds) : validateClusterRules(project);
  for (const violation of violations) {
    const message = clusterRuleMessage(violation);
    if (violation.coords.length === 0) {
      issues.push({ severity: violation.severity, code: violation.code, message });
      continue;
    }
    for (const coord of violation.coords) {
      issues.push({
        severity: violation.severity,
        code: violation.code,
        mapId: coord.mapId,
        x: coord.x,
        y: coord.y,
        message,
      });
    }
  }
  return issues;
}

function clusterRuleMessage(violation: ClusterRuleViolation): string {
  const custom = violation.rule.message?.trim();
  if (custom) return custom;
  return `클러스터 규칙 위반: ${violation.groupId} / ${violation.rule.kind} / ${violation.rule.strength}`;
}
