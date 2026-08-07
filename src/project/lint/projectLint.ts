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
//  - world-graph/world-transfer/world-adjacent:* (error|warning) 선언형 월드 그래프/맵 경계/transfer 정합 문제

import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import { battleEventCommandRuntimeSupport, commandRuntimeSupport, type CommandRuntimeSupport } from "@/editor/eventCommands/runtimeSupport";
import { CC0_AUDIO_ASSETS, isBrowserPlayableAudioPath } from "@/assets/cc0AudioAssets";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { inBounds, isPassable } from "../collision";
import { deserialize, serialize } from "../io";
import { collectProjectReferenceIssues } from "../io/references";
import { isQuestGraphDef } from "../quest/questDef";
import { lintQuestGraph } from "../quest/questGraph";
import { storyFlagForTarget, storyFlagListLabel, storyFlagTargetKey } from "../storyFlags";
import { buildStoryFlagUsageIndex, declaredStoryFlagTargets, usageBucketFor } from "../storyFlagUsage";
import type { Command, GameEvent, GameMap, LintSeverity, Project, Trigger } from "../types";
import { lintWorldGraph } from "../worldGraph";
import { validateClusterRules, type ClusterRuleViolation } from "./clusterRuleValidators";
import { checkReachability, type ReachabilitySpec } from "./reachability";
import { activeTileGrafts } from "@/assets/tileGrafts";

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
  issues.push(...lintWorldGraph(project));
  checkCharacterIdSocial(project, issues);
  checkUnplayableAudio(project, issues);
  checkReachabilitySpecs(project, opts.reachability ?? [], issues);
  checkTileGrafts(project, issues);
  checkShopIntegrity(project, issues);
  return issues;
}

/**
 * 재생 불가 오디오 참조(warning) — 브라우저가 못 트는 포맷을 BGM 으로 가리키는 경우.
 *
 * 왜(2026-07-26 실측): 번들된 EasyRPG RTP 음악 30곡이 전부 `.mid` 이고, 브라우저
 * HTMLAudioElement 는 MIDI 를 재생하지 못한다. 그런데 이 참조는 **조용히 무음**이 된다 —
 * 재생 실패는 콘솔 경고 한 줄뿐이라 저작자는 "음악을 넣었는데 안 들린다" 로만 겪는다.
 * 실제로 기본 전투 BGM 이 `easyrpg-music-battle-1`(.mid) 이었고, 전투에 들어가면 필드 음악이
 * 멈춘 뒤 아무 소리도 나지 않았다.
 *
 * error 가 아니라 warning 인 이유: 게임이 돌아가고, 사용자가 외부 재생기를 쓸 의도일 수도 있다.
 * 판단은 저작자 몫이고 린트의 일은 "이건 안 들린다" 를 알리는 것이다.
 */
function checkUnplayableAudio(project: Project, issues: LintIssue[]): void {
  const slots: { readonly label: string; readonly resourceId?: string }[] = [
    { label: "system.battleBgmResourceId", resourceId: project.system.battleBgmResourceId },
    { label: "system.defaultBgmResourceId", resourceId: project.system.defaultBgmResourceId },
    { label: "system.titleScreen.musicResourceId", resourceId: project.system.titleScreen?.musicResourceId },
  ];
  for (const [mapId, map] of Object.entries(project.maps)) {
    if (map.bgm?.mode === "custom" && map.bgm.resourceId) {
      slots.push({ label: `maps.${mapId}.bgm`, resourceId: map.bgm.resourceId });
    }
  }
  for (const slot of slots) {
    const resourceId = slot.resourceId?.trim();
    if (!resourceId) continue;
    const path = bundledAudioPath(resourceId);
    // 번들 자산에서 찾을 수 없으면(업로드 리소스 등) 판단하지 않는다 — 모르는 것을 지적하지 않는다.
    if (path === null || isBrowserPlayableAudioPath(path)) continue;
    issues.push({
      severity: "warning",
      code: "audio-unplayable",
      message:
        `${slot.label} 이 브라우저에서 재생할 수 없는 파일을 가리킨다: ${resourceId} (${path}). ` +
        "MIDI 는 HTMLAudioElement 로 재생되지 않아 조용히 무음이 된다 — ogg/mp3/wav 리소스로 바꾸세요.",
    });
  }
}

/** 번들 오디오 레지스트리에서 resourceId 의 파일 경로를 찾는다. 없으면 null. */
function bundledAudioPath(resourceId: string): string | null {
  const cc0 = CC0_AUDIO_ASSETS.find((asset) => asset.id === resourceId);
  if (cc0) return cc0.path;
  const rtp = EASYRPG_RTP_ASSETS.find((asset) => asset.id === resourceId);
  return rtp ? rtp.path : null;
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
      for (const command of eventCommands(event, issues, `맵 이벤트 ${event.id}`)) collectTransfers(command, transfers, issues, `맵 이벤트 ${event.id}`);
    }
  }
  for (const commonEvent of project.commonEvents) {
    visitCommands(commonEvent.commands, (command) => collectTransfers(command, transfers, issues, `커먼 이벤트 ${commonEvent.id}`), issues, `커먼 이벤트 ${commonEvent.id}.commands`);
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
      visitCommands(
        event.commands,
        (command) => pushRuntimeSupportCommandIssue(command, issues, { mapId: map.id, x: event.x, y: event.y, owner: `맵 이벤트 ${event.id}` }),
        issues,
        `맵 이벤트 ${event.id}.commands`
      );
      for (const page of event.pages ?? []) {
        visitCommands(
          page.commands,
          (command) =>
            pushRuntimeSupportCommandIssue(command, issues, {
              mapId: map.id,
              x: event.x,
              y: event.y,
              owner: `맵 이벤트 ${event.id}/${page.id}`,
            }),
          issues,
          `맵 이벤트 ${event.id}/${page.id}.commands`
        );
      }
    }
  }
  for (const commonEvent of project.commonEvents) {
    visitCommands(
      commonEvent.commands,
      (command) => pushRuntimeSupportCommandIssue(command, issues, { owner: `커먼 이벤트 ${commonEvent.id}` }),
      issues,
      `커먼 이벤트 ${commonEvent.id}.commands`
    );
  }
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages ?? []) {
      visitCommands(
        page.commands,
        (command) =>
          pushRuntimeSupportCommandIssue(command, issues, {
            owner: `트룹 ${troop.id}/${page.id}`,
            support: battleEventCommandRuntimeSupport(command),
          }),
        issues,
        `트룹 ${troop.id}/${page.id}.commands`
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
function eventCommands(event: GameEvent, issues?: LintIssue[], owner = `이벤트 ${event.id}`): Command[] {
  const commands: Command[] = [];
  commands.push(...commandArrayOrWarn(event.commands, issues, `${owner}.commands`));
  for (const page of event.pages ?? []) {
    commands.push(...commandArrayOrWarn(page.commands, issues, `${owner}/${page.id}.commands`));
  }
  return commands;
}

// fork/choices/loop 분기 내부까지 재귀 순회하며 transfer 커맨드를 수집한다.
function collectTransfers(
  command: Command,
  out: Array<Extract<Command, { kind: "transfer" }>>,
  issues?: LintIssue[],
  label = "command"
): void {
  visitCommand(command, (candidate) => {
    if (candidate.kind === "transfer") out.push(candidate);
  }, issues, label);
}

function commandArrayOrWarn(commands: unknown, issues: LintIssue[] | undefined, label: string): Command[] {
  if (Array.isArray(commands)) return commands as Command[];
  pushCommandShapeWarning(issues, label, `커맨드 배열이 아니어서 lint 순회를 건너뜁니다: ${valueKind(commands)}`);
  return [];
}

function visitCommands(commands: unknown, visit: (command: Command) => void, issues?: LintIssue[], label = "commands"): void {
  const list = commandArrayOrWarn(commands, issues, label);
  for (const [index, command] of list.entries()) visitCommand(command, visit, issues, `${label}[${index}]`);
}

function visitCommand(command: Command, visit: (command: Command) => void, issues?: LintIssue[], label = "command"): void {
  if (typeof command !== "object" || command === null || Array.isArray(command)) {
    pushCommandShapeWarning(issues, label, `커맨드 객체가 아니어서 lint 순회를 건너뜁니다: ${valueKind(command)}`);
    return;
  }
  visit(command);
  if (command.kind === "choices") {
    if (!Array.isArray(command.options)) {
      pushCommandShapeWarning(issues, `${label}.options`, `choices options 배열이 아니어서 분기 순회를 건너뜁니다: ${valueKind(command.options)}`);
      return;
    }
    for (const [index, option] of command.options.entries()) visitCommands(option.branch, visit, issues, `${label}.options[${index}].branch`);
    if (command.cancelBranch) visitCommands(command.cancelBranch, visit, issues, `${label}.cancelBranch`);
    return;
  }
  if (command.kind === "fork") {
    visitCommands(command.then, visit, issues, `${label}.then`);
    if (command.else) visitCommands(command.else, visit, issues, `${label}.else`);
    return;
  }
  if (command.kind === "loop") {
    visitCommands(command.body, visit, issues, `${label}.body`);
    return;
  }
  if (command.kind === "shop" && command.transactionBranch) {
    visitCommands(command.transactionBranch, visit, issues, `${label}.transactionBranch`);
  }
  if (command.kind === "shop" && (command as unknown as { failedTransactionBranch?: Command[] }).failedTransactionBranch) {
    visitCommands((command as unknown as { failedTransactionBranch: Command[] }).failedTransactionBranch, visit, issues, `${label}.failedTransactionBranch`);
  }
  if (command.kind === "inn" && command.notEnoughBranch) {
    visitCommands(command.notEnoughBranch, visit, issues, `${label}.notEnoughBranch`);
  }
}

function pushCommandShapeWarning(issues: LintIssue[] | undefined, label: string, detail: string): void {
  if (!issues) return;
  const message = `${label}: ${detail}`;
  if (issues.some((issue) => issue.code === "command-shape" && issue.message === message)) return;
  issues.push({ severity: "warning", code: "command-shape", message });
}

function valueKind(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(length:${value.length})`;
  if (typeof value === "object") return `object(keys:${Object.keys(value as Record<string, unknown>).slice(0, 4).join(",")})`;
  return typeof value;
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
function checkShopIntegrity(project: Project, issues: LintIssue[]): void {
  const visit = (command: Command, label: string) => {
    if (command.kind !== "shop") return;
    if (command.shopType && command.allowSell !== undefined) {
      const implied = command.shopType !== "buyOnly";
      if (implied !== command.allowSell) {
        issues.push({ severity: "warning", code: "shop.allowSell-mismatch", message: `${label}: shopType=${command.shopType}인데 allowSell=${command.allowSell}로 모순. shopType이 우선한다.` });
      }
    }
    if ((command.itemIds?.length ?? 0) === 0 && (!command.stock || command.stock.length === 0)) {
      issues.push({ severity: "warning", code: "shop.empty", message: `${label}: 빈 상점 — 판매할 아이템이 없다. 진입 시 바로 닫힌다.` });
    }
    const ids = new Set<string>();
    for (const entry of command.stock ?? []) {
      if (ids.has(entry.itemId)) issues.push({ severity: "warning", code: "shop.stock-duplicate", message: `${label}: stock에 중복 itemId: ${entry.itemId}` });
      ids.add(entry.itemId);
      if (!command.itemIds.includes(entry.itemId)) issues.push({ severity: "warning", code: "shop.stock-orphan", message: `${label}: stock itemId ${entry.itemId}가 itemIds에 없음 — 동기화 필요` });
    }
    if (command.branchOnFailedTransaction && !command.failedTransactionBranch?.length) {
      issues.push({ severity: "warning", code: "shop.failed-branch-empty", message: `${label}: branchOnFailedTransaction이 켜졌는데 failedTransactionBranch가 비었다.` });
    }
  };
  for (const [mapId, map] of Object.entries(project.maps)) {
    for (const event of map.events) {
      for (const [pi, page] of (event.pages ?? []).entries()) {
        const walk = (commands: readonly Command[] | unknown, prefix: string) => {
          if (!Array.isArray(commands)) return;
          for (const [ci, cmd] of (commands as readonly Command[]).entries()) {
            visit(cmd, `${mapId}:${event.id}:p${pi}:${prefix}[${ci}]`);
            if (cmd.kind === "shop" && cmd.transactionBranch) walk(cmd.transactionBranch, "transactionBranch");
            if (cmd.kind === "shop" && (cmd as unknown as { failedTransactionBranch?: Command[] }).failedTransactionBranch) walk((cmd as unknown as { failedTransactionBranch: Command[] }).failedTransactionBranch, "failedTransactionBranch");
          }
        };
        walk(page.commands, "commands");
      }
    }
  }
}

function checkTileGrafts(project: Project, issues: LintIssue[]): void {
  for (const [tilesetId, tileset] of Object.entries(project.tilesets)) {
    for (const graft of activeTileGrafts(tileset)) {
      const sourceExists = Boolean(
        project.tilesets[graft.sourceChipset] ||
          project.assets.uploaded[graft.sourceChipset] ||
          project.assets.sprites[graft.sourceChipset]
      );
      // bundled texture ids like tex_* are still external; require at least known uploaded/bundled mapping
      // keep warning minimal: unknown source is error because bake will warn+skip silently.
      if (!sourceExists && !String(graft.sourceChipset).startsWith("tex_")) {
        issues.push({
          severity: "error",
          code: "tileset.graft-unknown-source",
          message: `tilesets.${tilesetId}: graft sourceChipset을 찾을 수 없습니다: ${graft.sourceChipset} (targetTile ${graft.targetTile})`,
        });
      }
    }
  }
}

function checkCharacterIdSocial(project: Project, issues: LintIssue[]): void {
  type GiftSig = string;
  const byCharacter = new Map<string, { mapId: string; eventId: string; giftSig: GiftSig; scheduled: boolean }[]>();
  for (const [mapId, map] of Object.entries(project.maps)) {
    for (const event of map.events) {
      const characterId = event.characterId?.trim();
      if (!characterId) continue;
      const giftSig = JSON.stringify({
        giftPrefs: event.giftPrefs ?? null,
        giftResponses: event.giftResponses ?? null,
      });
      const scheduled = Array.isArray(event.schedule) && event.schedule.length > 0;
      const list = byCharacter.get(characterId) ?? [];
      list.push({ mapId, eventId: event.id, giftSig, scheduled });
      byCharacter.set(characterId, list);
    }
  }
  for (const [characterId, hosts] of byCharacter) {
    if (hosts.length < 2) continue;
    const giftSigs = new Set(hosts.map((host) => host.giftSig));
    if (giftSigs.size > 1) {
      issues.push({
        severity: "warning",
        code: "character-id:divergent-gift-prefs",
        mapId: hosts[0]?.mapId,
        message: `characterId '${characterId}' 를 공유하는 이벤트들의 giftPrefs/giftResponses 가 다릅니다 (자동 병합 없음). 공통 기본값은 project.characters['${characterId}'] 프로필을 쓰세요.`,
      });
    }
    const scheduledCount = hosts.filter((host) => host.scheduled).length;
    if (scheduledCount > 1) {
      issues.push({
        severity: "warning",
        code: "character-id:dual-schedule",
        mapId: hosts[0]?.mapId,
        message: `characterId '${characterId}' 에 스케줄 본체가 ${scheduledCount}개 있습니다. 활동은 이벤트 단위이며 병합되지 않습니다.`,
      });
    }
  }
}

// 라이브러리 소비자가 도달성 검사를 재사용할 수 있게 재수출.
export { checkReachability };
export type { ReachabilitySpec };
