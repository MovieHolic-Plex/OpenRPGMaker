// project/lint/projectLint.ts
// 프로젝트 무결성 정적 검사기. 순수 함수(Node 헤드리스에서도 동작 — 브라우저 전역 접근 금지).
// 예외를 던지지 않고 모든 문제를 LintIssue 배열로 수집한다(왕복/참조 검증이 throw하면 catch).
//
// 검사 항목(code):
//  - serialize-roundtrip   (error)   직렬화→역직렬화 왕복 실패
//  - reference-validation  (error)   validateProjectReferences 실패
//  - start-position        (error)   startPos가 맵 밖/통행 불가
//  - transfer-bounds       (error)   transfer 목적지가 맵 경계 밖
//  - transfer-impassable   (error)   transfer 목적지 타일이 통행 불가
//  - transfer-retrigger    (warning) transfer 목적지에 playerTouch 이벤트(무한 재전이 위험)
//  - duplicate-event       (warning) 같은 맵 내 이벤트 좌표 중복
//  - reachability          (error)   opts.reachability 지정 시 도달 불가
//  - cluster-rule:*        (error|warning|info) 타일 그룹 규칙 강도별 위반

import { inBounds, isPassable } from "../collision";
import { deserialize, serialize } from "../io";
import { validateProjectReferences } from "../io/references";
import type { Command, GameEvent, GameMap, LintSeverity, Project, Trigger } from "../types";
import { validateClusterRules, type ClusterRuleViolation } from "./clusterRuleValidators";
import { checkReachability, type ReachabilitySpec } from "./reachability";

export type { LintSeverity } from "../types";

export interface LintIssue {
  readonly severity: LintSeverity;
  readonly code: string;
  readonly mapId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly message: string;
}

export interface LintOptions {
  readonly reachability?: readonly ReachabilitySpec[];
}

export function projectLint(project: Project, opts: LintOptions = {}): LintIssue[] {
  const issues: LintIssue[] = [];
  checkRoundtrip(project, issues);
  checkReferences(project, issues);
  checkStartPosition(project, issues);
  checkTransfers(project, issues);
  checkDuplicateEventPositions(project, issues);
  checkClusterRules(project, issues);
  checkReachabilitySpecs(project, opts.reachability ?? [], issues);
  return issues;
}

// (a) 직렬화 왕복: serialize→deserialize가 throw하면 error로 수집.
function checkRoundtrip(project: Project, issues: LintIssue[]): void {
  try {
    deserialize(serialize(project));
  } catch (cause) {
    issues.push({
      severity: "error",
      code: "serialize-roundtrip",
      message: `직렬화 왕복 실패: ${errorMessage(cause)}`,
    });
  }
}

// (b) 참조 검증: validateProjectReferences가 throw하면 error로 수집.
function checkReferences(project: Project, issues: LintIssue[]): void {
  try {
    validateProjectReferences(project);
  } catch (cause) {
    issues.push({
      severity: "error",
      code: "reference-validation",
      message: `참조 검증 실패: ${errorMessage(cause)}`,
    });
  }
}

// (c) startPos가 통행 가능한 칸인가.
function checkStartPosition(project: Project, issues: LintIssue[]): void {
  const map = project.maps[project.startMapId];
  if (!map) {
    issues.push({
      severity: "error",
      code: "start-position",
      mapId: project.startMapId,
      message: `시작 맵이 존재하지 않습니다: ${project.startMapId}`,
    });
    return;
  }
  const { x, y } = project.startPos;
  if (!inBounds(map, x, y)) {
    issues.push({
      severity: "error",
      code: "start-position",
      mapId: map.id,
      x,
      y,
      message: `시작 위치가 맵 경계 밖입니다: (${x}, ${y})`,
    });
    return;
  }
  if (!isPassable(project, map, x, y)) {
    issues.push({
      severity: "error",
      code: "start-position",
      mapId: map.id,
      x,
      y,
      message: `시작 위치가 통행 불가 타일입니다: (${x}, ${y})`,
    });
  }
}

// (d)/(e) 모든 맵 이벤트 + 커먼이벤트의 커맨드 트리를 순회하며 transfer 목적지를 검사.
function checkTransfers(project: Project, issues: LintIssue[]): void {
  const transfers: Array<Extract<Command, { kind: "transfer" }>> = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const command of eventCommands(event)) collectTransfers(command, transfers);
    }
  }
  for (const commonEvent of project.commonEvents) {
    for (const command of commonEvent.commands) collectTransfers(command, transfers);
  }

  for (const command of transfers) {
    const target = project.maps[command.mapId];
    // 대상 맵 부재는 참조 검증(reference-validation)이 이미 error로 잡으므로 여기선 좌표 검사만 생략.
    if (!target) continue;
    if (!inBounds(target, command.x, command.y)) {
      issues.push({
        severity: "error",
        code: "transfer-bounds",
        mapId: command.mapId,
        x: command.x,
        y: command.y,
        message: `transfer 목적지가 맵 경계 밖입니다: ${command.mapId} (${command.x}, ${command.y})`,
      });
      continue;
    }
    if (!isPassable(project, target, command.x, command.y)) {
      issues.push({
        severity: "error",
        code: "transfer-impassable",
        mapId: command.mapId,
        x: command.x,
        y: command.y,
        message: `transfer 목적지가 통행 불가 타일입니다: ${command.mapId} (${command.x}, ${command.y})`,
      });
    }
    // (e) 착지 좌표에 playerTouch 트리거 이벤트가 있으면 무한 재전이 위험 → warning.
    if (hasPlayerTouchEventAt(target, command.x, command.y)) {
      issues.push({
        severity: "warning",
        code: "transfer-retrigger",
        mapId: command.mapId,
        x: command.x,
        y: command.y,
        message: `transfer 착지 좌표에 playerTouch 이벤트가 있어 즉시 재전이될 수 있습니다: ${command.mapId} (${command.x}, ${command.y})`,
      });
    }
  }
}

// (f) 같은 맵 내 이벤트 좌표 중복.
function checkDuplicateEventPositions(project: Project, issues: LintIssue[]): void {
  for (const map of Object.values(project.maps)) {
    const seen = new Map<string, string>();
    for (const event of map.events) {
      const key = `${event.x},${event.y}`;
      const previous = seen.get(key);
      if (previous) {
        issues.push({
          severity: "warning",
          code: "duplicate-event",
          mapId: map.id,
          x: event.x,
          y: event.y,
          message: `이벤트 좌표가 겹칩니다: ${map.id} (${event.x}, ${event.y}) — ${previous} & ${event.id}`,
        });
      } else {
        seen.set(key, event.id);
      }
    }
  }
}

function checkClusterRules(project: Project, issues: LintIssue[]): void {
  for (const violation of validateClusterRules(project)) {
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
}

function clusterRuleMessage(violation: ClusterRuleViolation): string {
  const custom = violation.rule.message?.trim();
  if (custom) return custom;
  return `클러스터 규칙 위반: ${violation.groupId} / ${violation.rule.kind} / ${violation.rule.strength}`;
}

// (g) opts.reachability 지정 시 도달 불가 = error.
function checkReachabilitySpecs(
  project: Project,
  specs: readonly ReachabilitySpec[],
  issues: LintIssue[]
): void {
  for (const spec of specs) {
    const map = project.maps[spec.mapId];
    if (!map) {
      issues.push({
        severity: "error",
        code: "reachability",
        mapId: spec.mapId,
        message: `도달성 검사 대상 맵이 존재하지 않습니다: ${spec.mapId}`,
      });
      continue;
    }
    const result = checkReachability(project, spec.mapId, spec.from, spec.targets);
    for (const point of result.unreachable) {
      issues.push({
        severity: "error",
        code: "reachability",
        mapId: spec.mapId,
        x: point.x,
        y: point.y,
        message: `시작 지점 (${spec.from.x}, ${spec.from.y})에서 (${point.x}, ${point.y})에 도달할 수 없습니다: ${spec.mapId}`,
      });
    }
  }
}

// --- 헬퍼 ---

// 이벤트의 커맨드(레거시 event.commands + 모든 페이지 commands)를 모은다.
function eventCommands(event: GameEvent): Command[] {
  const commands: Command[] = [...event.commands];
  for (const page of event.pages ?? []) commands.push(...page.commands);
  return commands;
}

// fork/choices/loop 분기 내부까지 재귀 순회하며 transfer 커맨드를 수집한다.
function collectTransfers(
  command: Command,
  out: Array<Extract<Command, { kind: "transfer" }>>
): void {
  if (command.kind === "transfer") {
    out.push(command);
    return;
  }
  if (command.kind === "choices") {
    for (const option of command.options) for (const sub of option.branch) collectTransfers(sub, out);
    if (command.cancelBranch) for (const sub of command.cancelBranch) collectTransfers(sub, out);
    return;
  }
  if (command.kind === "fork") {
    for (const sub of command.then) collectTransfers(sub, out);
    if (command.else) for (const sub of command.else) collectTransfers(sub, out);
    return;
  }
  if (command.kind === "loop") {
    for (const sub of command.body) collectTransfers(sub, out);
  }
}

// (x,y)에 playerTouch 트리거를 가진 이벤트(레거시 트리거 또는 어느 페이지든)가 있는가?
function hasPlayerTouchEventAt(map: GameMap, x: number, y: number): boolean {
  for (const event of map.events) {
    if (event.x !== x || event.y !== y) continue;
    if (isPlayerTouch(event.trigger)) return true;
    for (const page of event.pages ?? []) {
      if (isPlayerTouch(page.trigger)) return true;
    }
  }
  return false;
}

function isPlayerTouch(trigger: Trigger): boolean {
  return trigger.kind === "playerTouch";
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

// 라이브러리 소비자가 도달성 검사를 재사용할 수 있게 재수출.
export { checkReachability };
export type { ReachabilitySpec };
