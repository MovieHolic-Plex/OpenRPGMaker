/**
 * 원작 IP 고유명 경고 — 플레이어에게 보이는 글(대사·이름·설명)에 원작 고유명(해리포터풍 학교 이름·기숙사 등)이 들어갔는지.
 * run_lint 가 부른다(조수가 완료 전에 볼 수 있는 길). 출하 play.json 검사(validateShippedPlayJson)와 같은 걷기·같은 낱말 목록.
 * 낱말은 WIZARDING_ORIGINAL_NAMES 만 쓴다 — 짧은 일반어("마르" 등)가 섞인 데모 전용 금지어는 사용자 프로젝트에서 오탐이 많다.
 * 경고(warning)다: 저작자가 일부러 쓴 경우를 막지 않고, 공개·판매용 게임은 고치게 한다.
 */
import { findOriginalIpNames, WIZARDING_ORIGINAL_NAMES } from "@/project/flagship/ipCleanliness";
import type { Project } from "../types";
import type { LintIssue } from "./projectLint";

const MAX_ISSUES = 20;

export function lintOriginalIpNames(project: Project): LintIssue[] {
  const hits = findOriginalIpNames(project, WIZARDING_ORIGINAL_NAMES);
  const issues: LintIssue[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const mapId = /^maps\.([^.[]+)/.exec(hit.path)?.[1];
    const key = `${mapId ?? hit.path}|${hit.noun}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (issues.length >= MAX_ISSUES) break;
    issues.push({
      severity: "warning",
      code: "original-ip-name",
      ...(mapId ? { mapId } : {}),
      message: `원작 고유명 「${hit.noun}」이 플레이어에게 보이는 글에 있습니다(${hit.path}). 공개·판매용이면 일반 낱말로 바꾸세요(예: 마법 학교·붉은 사자 기숙사).`,
    });
  }
  return issues;
}
