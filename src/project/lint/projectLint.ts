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
//  - map-size              (warning) 256×256 초과 맵
//  - runtime-support:*     (warning) command is not fully supported by the map runtime
//  - story-flag:*          (warning) 서사 플래그 read/write/미선언 사용 문제
//  - quest-graph:*         (error|warning) 퀘스트 그래프 조건/도달성 문제
//  - reachability          (error)   opts.reachability 지정 시 도달 불가
//  - cluster-rule:*        (error|warning|info) 타일 그룹 규칙 강도별 위반

import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import { battleEventCommandRuntimeSupport, commandRuntimeSupport, type CommandRuntimeSupport } from "@/editor/eventCommands/runtimeSupport";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { inBounds, isPassable } from "../collision";
import { deserialize, serialize } from "../io";
import { collectProjectReferenceIssues } from "../io/references";
import { isQuestGraphDef } from "../quest/questDef";
import { lintQuestGraph } from "../quest/questGraph";
import { storyFlagForTarget, storyFlagListLabel, storyFlagTargetKey } from "../storyFlags";
import { buildStoryFlagUsageIndex, declaredStoryFlagTargets, usageBucketFor } from "../storyFlagUsage";
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
  checkMapSizes(project, issues);
  checkRuntimeSupportCommands(project, issues);
  checkStoryFlags(project, issues);
  checkQuestGraphs(project, issues);
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
  for (const message of collectProjectReferenceIssues(project)) {
    issues.push({
      severity: "error",
      code: "reference-validation",
      message: `참조 검증 실패: ${message}`,
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

function checkMapSizes(project: Project, issues: LintIssue[]): void {
  for (const map of Object.values(project.maps)) {
    if (map.width <= MAX_TOOL_MAP_DIMENSION && map.height <= MAX_TOOL_MAP_DIMENSION) continue;
    issues.push({
      severity: "warning",
      code: "map-size",
      mapId: map.id,
      message: `맵이 ${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION}을 초과합니다: ${map.id} (${map.width}×${map.height}) — 여러 맵으로 나누고 transfer 이벤트로 연결하세요.`,
    });
  }
}

function checkRuntimeSupportCommands(project: Project, issues: LintIssue[]): void {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      visitCommands(event.commands, (command) =>
        pushRuntimeSupportCommandIssue(command, issues, { mapId: map.id, x: event.x, y: event.y, owner: `맵 이벤트 ${event.id}` })
      );
      for (const page of event.pages ?? []) {
        visitCommands(page.commands, (command) =>
          pushRuntimeSupportCommandIssue(command, issues, {
            mapId: map.id,
            x: event.x,
            y: event.y,
            owner: `맵 이벤트 ${event.id}/${page.id}`,
          })
        );
      }
    }
  }
  for (const commonEvent of project.commonEvents) {
    visitCommands(commonEvent.commands, (command) =>
      pushRuntimeSupportCommandIssue(command, issues, { owner: `커먼 이벤트 ${commonEvent.id}` })
    );
  }
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages ?? []) {
      visitCommands(page.commands, (command) =>
        pushRuntimeSupportCommandIssue(command, issues, {
          owner: `트룹 ${troop.id}/${page.id}`,
          support: battleEventCommandRuntimeSupport(command),
        })
      );
    }
  }
}

export function countLimitedRuntimeSupportCommands(commands: readonly Command[]): number {
  let count = 0;
  visitCommands(commands, (command) => {
    if (limitedRuntimeSupport(commandRuntimeSupport(command))) count += 1;
  });
  return count;
}

export function countLimitedRuntimeSupportCommandsForEvent(event: GameEvent): number {
  let count = countLimitedRuntimeSupportCommands(event.commands);
  for (const page of event.pages ?? []) {
    count += countLimitedRuntimeSupportCommands(page.commands);
  }
  return count;
}

function pushRuntimeSupportCommandIssue(
  command: Command,
  issues: LintIssue[],
  context: { readonly owner: string; readonly mapId?: string; readonly x?: number; readonly y?: number; readonly support?: CommandRuntimeSupport }
): void {
  const support = context.support ?? commandRuntimeSupport(command);
  if (!limitedRuntimeSupport(support)) return;
  issues.push({
    severity: "warning",
    code: `runtime-support:${runtimeSupportCommandKind(command)}`,
    mapId: context.mapId,
    x: context.x,
    y: context.y,
    message: `${context.owner}에 런타임 지원이 제한된 명령이 있습니다(${support}): ${commandLabel(command)}`,
  });
}

function limitedRuntimeSupport(support: CommandRuntimeSupport): boolean {
  return support !== "runtime-full";
}

function runtimeSupportCommandKind(command: Command): string {
  return command.kind === "m2Command" ? command.commandId : command.kind;
}

function checkStoryFlags(project: Project, issues: LintIssue[]): void {
  const index = buildStoryFlagUsageIndex(project);
  for (const flag of project.storyFlags ?? []) {
    if (flag.retired === true) continue;
    const usage = usageBucketFor(index, flag.kind, flag.targetId);
    const label = storyFlagListLabel(project, flag);
    if (usage.reads.length > 0 && usage.writes.length === 0) {
      issues.push({
        severity: "warning",
        code: "story-flag:read-without-write",
        message: `서사 플래그가 읽히지만 쓰이지 않습니다: ${label} (read ${usage.reads.length}, write 0)`,
      });
    }
    if (usage.writes.length > 0 && usage.reads.length === 0) {
      issues.push({
        severity: "warning",
        code: "story-flag:write-without-read",
        message: `서사 플래그가 쓰이지만 읽히지 않습니다: ${label} (read 0, write ${usage.writes.length})`,
      });
    }
  }

  if ((project.storyFlags ?? []).length === 0) return;
  const declared = declaredStoryFlagTargets(project);
  const warnedTargets = new Set<string>();
  for (const site of index.sites) {
    const targetKey = storyFlagTargetKey(site.kind, site.targetId);
    if (declared.has(targetKey) || warnedTargets.has(targetKey)) continue;
    const retired = storyFlagForTarget(project, site.kind, site.targetId, { includeRetired: true })?.retired === true;
    issues.push({
      severity: "warning",
      code: retired ? "story-flag:retired-used" : "story-flag:undeclared",
      message: retired
        ? `retire된 서사 플래그 target이 아직 사용됩니다: ${targetKey} (${site.label})`
        : `레지스트리 밖 스위치/변수 사용: ${targetKey} (${site.label})`,
    });
    warnedTargets.add(targetKey);
  }
}

function checkQuestGraphs(project: Project, issues: LintIssue[]): void {
  for (const quest of project.quests ?? []) {
    if (!isQuestGraphDef(quest)) continue;
    for (const issue of lintQuestGraph(project, quest)) {
      issues.push({
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
      });
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
  visitCommand(command, (candidate) => {
    if (candidate.kind === "transfer") out.push(candidate);
  });
}

function visitCommands(commands: readonly Command[], visit: (command: Command) => void): void {
  for (const command of commands) visitCommand(command, visit);
}

function visitCommand(command: Command, visit: (command: Command) => void): void {
  visit(command);
  if (command.kind === "choices") {
    for (const option of command.options) visitCommands(option.branch, visit);
    if (command.cancelBranch) visitCommands(command.cancelBranch, visit);
    return;
  }
  if (command.kind === "fork") {
    visitCommands(command.then, visit);
    if (command.else) visitCommands(command.else, visit);
    return;
  }
  if (command.kind === "loop") {
    visitCommands(command.body, visit);
    return;
  }
  if (command.kind === "shop" && command.transactionBranch) {
    visitCommands(command.transactionBranch, visit);
  }
}

function commandLabel(command: Command): string {
  if (command.kind !== "m2Command") return command.kind;
  return m2CommandById(command.commandId)?.label ?? command.commandId;
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
