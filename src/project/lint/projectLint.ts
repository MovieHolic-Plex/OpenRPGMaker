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
//  - playerTouch-impassable (warning) 밟기형(priority≠same) touch/playerTouch 이벤트가 통행 불가 타일 위(영구 미발동)
//  - event-unreachable       (warning) 자신의 칸과 4방향 이웃이 전부 통행 불가라 접근 불가능한 이벤트
//  - duplicate-event       (warning) 같은 맵 내 이벤트 좌표 중복
//  - map-size              (warning) 256×256 초과 맵
//  - runtime-support:*     (warning) command is not fully supported by the map runtime
//  - story-flag:*          (warning) 서사 플래그 read/write/미선언 사용 문제
//  - quest-graph:*         (error|warning) 퀘스트 그래프 조건/도달성 문제
//  - reachability          (error)   opts.reachability 지정 시 도달 불가
//  - cluster-rule:*        (error|warning|info) 타일 그룹 규칙 강도별 위반
//  - world-graph/world-transfer/world-adjacent:* (error|warning) 선언형 월드 그래프/맵 경계/transfer 정합 문제

import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import {
  battleEventCommandRuntimeSupport,
  commandRuntimeSupport,
  type CommandRuntimeSupport,
  type M2RuntimeContext,
} from "@/project/eventCommands/runtimeSupport";
import { CC0_AUDIO_ASSETS, isBrowserPlayableAudioPath } from "@/assets/cc0AudioAssets";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { autoCropSpriteAsset } from "@/project/farmModel";
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
  checkPlayerTouchTilePassability(project, issues);
  checkEventUnreachable(project, issues);
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
  checkSystemOptInConsistency(project, issues);
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

// (e') 밟기형 touch/playerTouch 이벤트가 통행 불가 타일 위에 있으면 영구 미발동(warning).
// 근거: 플레이어 이동은 지형 통행성(canMove)에서 먼저 막히므로(playSceneMovement)
// priority가 "same"이 아닌(=차단하지 않고 밟아서 발동하는) 페이지는 절대 실행될 수 없다.
// priority "same"(차단형)은 부딪힘(bump)으로 발동하므로 이 규칙 대상이 아니다.
// RM2K3 정합 동작이라 런타임을 고치지 않고 저작 함정으로만 잡는다.
function checkPlayerTouchTilePassability(project: Project, issues: LintIssue[]): void {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const steppablePage = (event.pages ?? []).find(
        (page) => isSteppableTouch(page.trigger) && page.priority !== "same"
      );
      if (!steppablePage) continue;
      if (isPassable(project, map, event.x, event.y)) continue;
      issues.push({
        severity: "warning",
        code: "playerTouch-impassable",
        mapId: map.id,
        x: event.x,
        y: event.y,
        message:
          `밟기형 ${steppablePage.trigger.kind} 이벤트가 통행 불가 타일 위에 있어 발동될 수 없습니다: ` +
          `${map.id} ${event.id}/${steppablePage.id} (${event.x}, ${event.y}) — ` +
          `통행 가능한 타일로 옮기거나, 부딪힘 발동을 원하면 priority를 "same"으로 바꾸세요.`,
      });
    }
  }
}

// (f) 같은 맵 내 이벤트 좌표 중복.
// 밟기형 여부와 무관하게, 자신의 칸과 4방향 이웃이 전부 통행 불가인 이벤트는 플레이어가
// 어떻게도 접근할 수 없다(부딪힘 발동도 이웃 칸에서 시도해야 하므로). warning 으로만 잡는다:
// playerTouch-impassable 과 대상이 겹칠 수 있지만 메시지/의미가 다르고 둘 다 울려도 무방하다.
function checkEventUnreachable(project: Project, issues: LintIssue[]): void {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      if (isPassable(project, map, event.x, event.y)) continue;
      const neighbourPassable = [
        { x: event.x, y: event.y - 1 },
        { x: event.x, y: event.y + 1 },
        { x: event.x - 1, y: event.y },
        { x: event.x + 1, y: event.y },
      ].some((cell) => inBounds(map, cell.x, cell.y) && isPassable(project, map, cell.x, cell.y));
      if (neighbourPassable) continue;
      issues.push({
        severity: "warning",
        code: "event-unreachable",
        mapId: map.id,
        x: event.x,
        y: event.y,
        message:
          `이벤트에 도달할 수 없습니다 — 자신의 칸과 4방향 이웃이 모두 통행 불가입니다: ` +
          `${map.id} ${event.id} (${event.x}, ${event.y}) — 통행 가능한 칸으로 옮기세요.`,
      });
    }
  }
}

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
        // 맵 이벤트는 map 컨텍스트로 판정한다 — behaviorClass "full" 이라도
        // M2_MAP_COMMON_FULL_IDS 밖이면 맵 런타임에서는 부분 지원이다.
        (command) =>
          pushRuntimeSupportCommandIssue(command, issues, {
            mapId: map.id,
            x: event.x,
            y: event.y,
            owner: `맵 이벤트 ${event.id}`,
            support: commandRuntimeSupport(command, "map"),
          }),
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
              support: commandRuntimeSupport(command, "map"),
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
      (command) =>
        pushRuntimeSupportCommandIssue(command, issues, {
          owner: `커먼 이벤트 ${commonEvent.id}`,
          support: commandRuntimeSupport(command, "common"),
        }),
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

export function countLimitedRuntimeSupportCommands(
  commands: readonly Command[],
  context?: M2RuntimeContext
): number {
  let count = 0;
  visitCommands(commands, (command) => {
    if (limitedRuntimeSupport(commandRuntimeSupport(command, context))) count += 1;
  });
  return count;
}

// GameEvent 는 맵 이벤트다 — 기본 판정 컨텍스트는 map.
export function countLimitedRuntimeSupportCommandsForEvent(event: GameEvent): number {
  let count = countLimitedRuntimeSupportCommands(event.commands, "map");
  for (const page of event.pages ?? []) {
    count += countLimitedRuntimeSupportCommands(page.commands, "map");
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

// 린트는 저작 중인(=아직 불완전할 수 있는) 프로젝트 위에서 돌므로 필수 필드가 비어 있어도
// throw 해서는 안 된다 — 2026-08-23 실측: page.trigger 누락으로 여기서 TypeError 가 나
// 커밋이 "후처리 실패: Cannot read properties of undefined" 로 끝나고 실제 원인이 가려졌다.
function isPlayerTouch(trigger: Trigger | undefined): boolean {
  return trigger?.kind === "playerTouch";
}

// 밟기(step-on)로도 발동하는 접촉 트리거인가? (touch/playerTouch 둘 다)
function isSteppableTouch(trigger: Trigger | undefined): boolean {
  return trigger?.kind === "playerTouch" || trigger?.kind === "touch";
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
function checkShopEconomyLite(issues: LintIssue[], command: unknown, loc: string): void {
  if (!command || typeof command !== "object" || (command as { kind?: string }).kind !== "shop") return;
  const c = command as unknown as Record<string, unknown>;
  const [mapId2] = loc.split(":");
  const baseMapId = mapId2 ?? "";
  if (Array.isArray(c.cartLines) && (c.cartLines as unknown[]).length > 12) issues.push({ severity: "warning", code: "shop.cart.overflow", message: "장바구니 줄이 12줄을 넘습니다.", mapId: baseMapId });
  if (Array.isArray(c.buyback) && (c.buyback as unknown[]).length > 8) issues.push({ severity: "warning", code: "shop.buyback.overflow", message: "되사기 대기열이 8건을 넘습니다.", mapId: baseMapId });
  if (Array.isArray(c.consignments) && (c.consignments as unknown[]).length > 16) issues.push({ severity: "warning", code: "shop.consignment.overflow", message: "위탁 목록이 16건을 넘습니다.", mapId: baseMapId });
  if (typeof c.investmentLevel === "number" && (((c.investmentLevel as number) < 0) || ((c.investmentLevel as number) > 5))) issues.push({ severity: "warning", code: "shop.investment.range", message: "investmentLevel은 0..5 범위여야 합니다.", mapId: baseMapId });
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
      issues.push({ severity: "warning", code: "shop.empty", message: `${label}: 빈 상점 — 진열할 물건이 없다. 진입하면 "지금은 팔 물건이 없습니다." 안내만 띄우고 닫힌다.` });
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
            checkShopEconomyLite(issues, cmd as unknown as Extract<Command, { kind: "shop" }>, `${mapId}:${event.id}:p${pi}:${prefix}[${ci}]`);
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


/**
 * 옵트인 시스템 토글과 실제 데이터 정합성 검사.
 * 작업 중간 상태일 수 있으므로 severity 는 warning.
 */
function checkSystemOptInConsistency(project: Project, issues: LintIssue[]): void {
  const { system, database } = project;
  const monsterSpecies = database.monsterSpecies ?? [];
  const skills = database.skills ?? [];
  const crops = database.crops ?? [];
  const maps = Object.values(project.maps);

  // 전수 명령 순회로 명령 kind 카운트.
  let craftRecipeCalls = 0;
  let itemUpgradeCalls = 0;
  let eventsWithSchedule = 0;
  const visitKind = (command: Command): void => {
    if (command.kind === "craftRecipe") craftRecipeCalls++;
    if (command.kind === "applyItemUpgrade") itemUpgradeCalls++;
  };
  for (const map of maps) {
    for (const event of map.events) {
      if (event.schedule && event.schedule.length > 0) eventsWithSchedule++;
      visitCommands(event.commands, visitKind);
      for (const page of event.pages ?? []) visitCommands(page.commands, visitKind);
    }
  }
  for (const commonEvent of project.commonEvents) visitCommands(commonEvent.commands, visitKind);
  for (const troop of database.troops) {
    for (const page of troop.battleEventPages ?? []) visitCommands(page.commands, visitKind);
  }

  const farmableMaps = maps.filter((m) => (m.farmableArea ?? []).length > 0);
  const actionCombatMaps = maps.filter((m) => m.actionCombat === true);
 const timeEnabled = system.timeSystem?.enabled === true;

  // 1. monsterCollection && no species
  if (system.monsterCollection === true && monsterSpecies.length === 0) {
    issues.push({ severity: "warning", code: "opt-in:monster-collection-empty", message: "포획이 활성인데 몬스터 종족이 0 — 전투에 포획 명령이 나타나지 않습니다." });
  }
  // 수집 게이트 OFF + 종족 데이터 조합은 여기서 경고하지 않는다: 출하 기본 프로젝트가 이미
  // 종족 120개·포획 아이템 3개를 수집 OFF 상태로 싣고 있어 모든 프로젝트에서 발화한다(노이즈).
  // 대신 수집 3개 탭 상단 배너(db-collection-gate-warn)가 맥락 안에서 알린다.
  // 상성표에 없는 타입도 같은 이유로 여기서 경고하지 않는다(종족 탭 db-monster-species-type-warn 칩이 담당).
  // 2. monsterBattleParty && no species
  if (system.monsterBattleParty === true && monsterSpecies.length === 0) {
    issues.push({ severity: "warning", code: "opt-in:monster-battle-party-empty", message: "몬스터 파티 전투가 활성인데 종족이 0 — 파티에 몬스터를 넣을 수 없습니다." });
  }
  // 3. monsterCare && !monsterCollection
  if (system.monsterCare && system.monsterCollection !== true) {
    issues.push({ severity: "warning", code: "opt-in:monster-care-without-collection", message: "몬스터 돌봄 설정이 있으나 수집이 꺼져 있어 적용 대상이 없습니다." });
  }
  // 4. typeChart && no skills with elementId
  if (system.typeChart && skills.filter((s) => s.elementId).length === 0) {
    issues.push({ severity: "warning", code: "opt-in:type-chart-no-elements", message: "타입 상성표가 있으나 속성을 가진 스킬이 없어 배율이 항상 1.0 입니다." });
  }
  // 5. giftSystem && no events interpreting gift tastes
  if (system.giftSystem === true) {
    // 선물 취향 해석은 NPC 이벤트의 gift 관련 명령으로 판별. 현재 엔진에 gift 전용 kind 가 없으므로
    // 아이템 사용 이벤트의 존재로 대리 측정한다. 실측 필요시 정확한 판별로 교체.
    const hasGiftConsumer = maps.some((m) => m.events.some((e) => (e.pages ?? []).length > 0 || e.commands.length > 0));
    if (!hasGiftConsumer) {
      issues.push({ severity: "warning", code: "opt-in:gift-system-no-npc", message: "선물 시스템이 켜졌으나 받을 NPC 가 없습니다." });
    }
  }
  // 6. season crops but no time system
  if (!timeEnabled && crops.some((c) => (c.seasons ?? []).length > 0)) {
    issues.push({ severity: "warning", code: "opt-in:season-crops-without-time", message: "계절 작물이 있으나 시간 시스템이 꺼져 계절이 진행되지 않습니다." });
  }
  // 7. scheduled events but no time system
  if (!timeEnabled && eventsWithSchedule > 0) {
    issues.push({ severity: "warning", code: "opt-in:schedule-without-time", message: "NPC 일정이 있으나 시간 시스템이 꺼져 일정이 돌지 않습니다." });
  }
  // 8. crops but no farmable maps
  if (crops.length > 0 && farmableMaps.length === 0) {
    issues.push({ severity: "warning", code: "opt-in:crops-without-farmable", message: "작물이 정의됐으나 경작 가능 영역이 지정된 맵이 없습니다." });
  }
  // 9. toolActions but no farmable maps
  if ((system.toolActions ?? []).length > 0 && farmableMaps.length === 0) {
    issues.push({ severity: "warning", code: "opt-in:tool-actions-without-farmable", message: "도구 규칙이 있으나 적용될 경작 영역이 없습니다." });
  }
  // 10. actionCombat enabled but no action combat maps
  if (system.actionCombat?.enabled === true) {
    issues.push({ severity: "warning", code: "deprecated:action-combat", message: "액션 전투는 지원 종료 예정입니다. 지원 전투는 RM식(rm2k3)과 포켓몬식(gen1) 둘뿐이며, 저장된 프로젝트는 계속 동작합니다." });
  }
  if (system.actionCombat?.enabled === true && actionCombatMaps.length === 0) {
    issues.push({ severity: "warning", code: "opt-in:action-combat-no-map", message: "액션 전투가 활성이나 opt-in 한 맵이 없어 필드 접촉이 턴제로 갑니다." });
  }
  // 11. action combat maps but system switch off
  if (actionCombatMaps.length > 0 && system.actionCombat?.enabled !== true) {
    issues.push({ severity: "warning", code: "opt-in:action-combat-map-without-system", message: "맵이 액션 전투를 켰으나 시스템 스위치가 꺼져 무시됩니다." });
  }
  // 12. craftRecipes but no calling commands
  if ((system.craftRecipes ?? []).length > 0 && craftRecipeCalls === 0) {
    issues.push({ severity: "warning", code: "opt-in:craft-recipes-no-call", message: "제작 레시피가 있으나 호출하는 이벤트 명령이 없습니다." });
  }
  // 13. itemUpgrades but no calling commands
  if ((system.itemUpgrades ?? []).length > 0 && itemUpgradeCalls === 0) {
    issues.push({ severity: "warning", code: "opt-in:item-upgrades-no-call", message: "업그레이드 규칙이 있으나 호출하는 명령이 없습니다." });
  }
  // 14. genre-specific requirements
  if (system.genre === "monster-collect" && system.monsterCollection !== true) {
    issues.push({ severity: "warning", code: "opt-in:genre-monster-collect-no-collection", message: "장르가 몬스터 수집이나 포획(monsterCollection)이 꺼져 있습니다." });
  }
  if (system.genre === "farm-life") {
    if (system.timeSystem?.enabled !== true) {
      issues.push({ severity: "warning", code: "opt-in:genre-farm-life-no-time", message: "장르가 농장 생활이나 시간 시스템이 꺼져 있습니다." });
    }
    if (crops.length === 0) {
      issues.push({ severity: "warning", code: "opt-in:genre-farm-life-no-crops", message: "장르가 농장 생활이나 정의된 작물이 없습니다." });
    }
  }
  // 15. crop growth stages exceed the auto-wired sprite's frame count
  for (const crop of crops) {
    // 저작 graphicStages 가 있으면 자동 배선 스프라이트를 쓰지 않는다 — 프레임 수 경고는 거짓이 된다.
    if (crop.graphicStages !== undefined) continue;
    const asset = autoCropSpriteAsset(crop.id, crop.harvestItemId);
    if (!asset || crop.stages.length <= asset.frameCount) continue;
    issues.push({
      severity: "warning",
      code: "opt-in:crop-stages-exceed-sprite-frames",
      message: `작물 ${crop.id} 의 성장 단계 ${crop.stages.length} 개가 스프라이트 ${asset.id} 의 프레임 ${asset.frameCount} 개보다 많아 마지막 프레임이 반복됩니다 — 남는 단계는 화면상 구분되지 않습니다.`,
    });
  }
}