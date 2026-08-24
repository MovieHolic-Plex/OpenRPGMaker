import { projectLint } from "@/project/lint/projectLint";
import type { Command, EventPage, Project } from "@/project/types";
import { runSceneTest, type SceneTestInput } from "@/testing/sceneTestRunner";

export type HorrorQaScenarioRole =
  | "locked-gate-feedback"
  | "wrong-answer-recovery"
  | "critical-path"
  | "trap-death-retry"
  | "chaser-death-retry"
  | "truth-ending"
  | "alternate-ending";

export interface HorrorQaScenario {
  readonly id: string;
  readonly label: string;
  readonly role: HorrorQaScenarioRole;
  readonly input: SceneTestInput;
}

export interface HorrorBrowserEvidence {
  readonly projectId: string;
  readonly observedAt: string;
  readonly route: string;
  readonly title: {
    readonly resourceId: string;
    readonly imageLoaded: boolean;
  };
  readonly desktopTouchPadVisible: boolean;
  readonly mapStart: {
    readonly mapId: string;
    readonly x: number;
    readonly y: number;
    readonly passable: boolean;
  };
  readonly consoleErrorCount: number;
}

export interface HorrorQaScenarioResult {
  readonly id: string;
  readonly label: string;
  readonly role: HorrorQaScenarioRole;
  readonly ok: boolean;
  readonly stepsRun: number;
  readonly totalSteps: number;
  readonly failureReason?: string;
  readonly finalState: {
    readonly mapId: string;
    readonly x: number;
    readonly y: number;
    readonly gameOver: boolean;
    readonly endingsReached: readonly string[];
  };
}

export interface HorrorQaBlocker {
  readonly id: string;
  readonly message: string;
}

export type HorrorQaAxisId = "stability" | "mystery" | "feedback" | "tension" | "payoff";

export interface HorrorQaAxis {
  readonly id: HorrorQaAxisId;
  readonly label: string;
  readonly score: number;
  readonly maxScore: 20;
  readonly evidence: readonly string[];
}

export interface HorrorExperienceQaReport {
  readonly schemaVersion: 1;
  readonly verdict: "strong-pass" | "conditional-pass" | "fail";
  readonly totalScore: number;
  readonly maxScore: 100;
  readonly axes: readonly HorrorQaAxis[];
  readonly blockers: readonly HorrorQaBlocker[];
  readonly scenarios: readonly HorrorQaScenarioResult[];
  readonly metrics: {
    readonly lintIssueCount: number;
    readonly investigationEventCount: number;
    readonly persistentClueCount: number;
    readonly investigationMapCount: number;
    readonly puzzleMechanicCount: number;
    readonly lethalEventCount: number;
    readonly lethalEventsWithPriorAudio: number;
    readonly checkpointCount: number;
    readonly chaserCount: number;
    readonly safeZoneCount: number;
    readonly endingCount: number;
    readonly endingTriggerCount: number;
    readonly customBgmMapCount: number;
  };
  readonly browserEvidence?: HorrorBrowserEvidence;
}

interface PageRecord {
  readonly mapId: string;
  readonly page: EventPage;
  readonly commands: readonly Command[];
}

function visitCommands(commands: readonly Command[], visit: (command: Command) => void): void {
  for (const command of commands) {
    visit(command);
    if (command.kind === "choices") {
      for (const option of command.options) visitCommands(option.branch, visit);
      if (command.cancelBranch) visitCommands(command.cancelBranch, visit);
    } else if (command.kind === "fork") {
      visitCommands(command.then, visit);
      if (command.else) visitCommands(command.else, visit);
    } else if (command.kind === "loop") {
      visitCommands(command.body, visit);
    } else if (command.kind === "shop") {
      if (command.transactionBranch) visitCommands(command.transactionBranch, visit);
      if (command.failedTransactionBranch) visitCommands(command.failedTransactionBranch, visit);
    } else if (command.kind === "inn") {
      if (command.notEnoughBranch) visitCommands(command.notEnoughBranch, visit);
    } else if (command.kind === "battleProcessing") {
      if (command.victoryBranch) visitCommands(command.victoryBranch, visit);
      if (command.defeatBranch) visitCommands(command.defeatBranch, visit);
      if (command.escapeBranch) visitCommands(command.escapeBranch, visit);
    } else if (command.kind === "promoteActor" || command.kind === "evolveMonster") {
      if (command.successBranch) visitCommands(command.successBranch, visit);
      if (command.failureBranch) visitCommands(command.failureBranch, visit);
    }
  }
}

function flattened(commands: readonly Command[]): Command[] {
  const result: Command[] = [];
  visitCommands(commands, (command) => result.push(command));
  return result;
}

function pageRecords(project: Project): PageRecord[] {
  return Object.values(project.maps).flatMap((map) => map.events.flatMap((event) => {
    const pages = event.pages?.length
      ? event.pages
      : [{
          id: `${event.id}_legacy_page`,
          name: event.id,
          conditions: event.condition ? [event.condition] : [],
          graphic: event.sprite ? { sprite: event.sprite } : { transparent: true },
          trigger: event.trigger,
          priority: "same" as const,
          movement: { type: "fixed" as const, speed: 3, frequency: 3 },
          commands: event.commands,
        }];
    return pages.map((page) => ({ mapId: map.id, page, commands: flattened(page.commands) }));
  }));
}

function rolePassed(results: readonly HorrorQaScenarioResult[], role: HorrorQaScenarioRole): boolean {
  return results.some((result) => result.role === role && result.ok);
}

function axis(
  id: HorrorQaAxisId,
  label: string,
  score: number,
  evidence: readonly string[],
): HorrorQaAxis {
  return { id, label, score: Math.max(0, Math.min(20, score)), maxScore: 20, evidence };
}

/**
 * Deterministic structural map reachability from the project start map over `transfer`
 * commands. Conservative map graph: every page of every event is scanned, recursing into
 * choices / forks / loops. Exact conditional solvability is deliberately NOT modeled —
 * this only proves the authored transfer topology is connected, never that a puzzle is
 * actually solvable.
 */
export interface HorrorReachabilityAnalysis {
  /** Map ids reachable from the start map over transfer commands (start itself included). */
  readonly reachableMapIds: readonly string[];
  /** Transfer target map ids referenced by commands but absent from project.maps. */
  readonly missingTransferTargets: readonly string[];
  /** Ending ids that are defined/triggered but have no trigger on any reachable map. */
  readonly unreachableEndingIds: readonly string[];
}

function transferTargetsOf(commands: readonly Command[], into: Set<string>): void {
  for (const command of commands) {
    if (command.kind === "transfer" && command.mapId) into.add(command.mapId);
    if (command.kind === "choices") {
      for (const option of command.options) transferTargetsOf(option.branch, into);
      if (command.cancelBranch) transferTargetsOf(command.cancelBranch, into);
    } else if (command.kind === "fork") {
      transferTargetsOf(command.then, into);
      if (command.else) transferTargetsOf(command.else, into);
    } else if (command.kind === "loop") {
      transferTargetsOf(command.body, into);
    } else if (command.kind === "shop") {
      if (command.transactionBranch) transferTargetsOf(command.transactionBranch, into);
      if (command.failedTransactionBranch) transferTargetsOf(command.failedTransactionBranch, into);
    } else if (command.kind === "inn") {
      if (command.notEnoughBranch) transferTargetsOf(command.notEnoughBranch, into);
    } else if (command.kind === "battleProcessing") {
      if (command.victoryBranch) transferTargetsOf(command.victoryBranch, into);
      if (command.defeatBranch) transferTargetsOf(command.defeatBranch, into);
      if (command.escapeBranch) transferTargetsOf(command.escapeBranch, into);
    } else if (command.kind === "promoteActor" || command.kind === "evolveMonster") {
      if (command.successBranch) transferTargetsOf(command.successBranch, into);
      if (command.failureBranch) transferTargetsOf(command.failureBranch, into);
    }
  }
}

export function analyzeHorrorReachability(project: Project): HorrorReachabilityAnalysis {
  // Scan every page of every event once, per map, to build a conservative transfer graph
  // and the set of ending ids each map can trigger.
  const transferTargetsByMap = new Map<string, Set<string>>();
  const endingTriggersByMap = new Map<string, Set<string>>();
  for (const map of Object.values(project.maps)) {
    const transfers = new Set<string>();
    const endings = new Set<string>();
    for (const record of pageRecords(project)) {
      if (record.mapId !== map.id) continue;
      transferTargetsOf(record.commands, transfers);
      for (const command of record.commands) {
        if (command.kind === "triggerEnding" && command.endingId) endings.add(command.endingId);
      }
    }
    transferTargetsByMap.set(map.id, transfers);
    endingTriggersByMap.set(map.id, endings);
  }

  // BFS from the actual start map, following only defined transfer targets.
  const missingTransferTargets = new Set<string>();
  const reachableMapIds = new Set<string>();
  const queue = project.startMapId ? [project.startMapId] : [];
  while (queue.length > 0) {
    const mapId = queue.pop()!;
    if (reachableMapIds.has(mapId)) continue;
    reachableMapIds.add(mapId);
    if (!project.maps[mapId]) continue;
    for (const target of transferTargetsByMap.get(mapId) ?? []) {
      if (!project.maps[target]) missingTransferTargets.add(target);
      else queue.push(target);
    }
  }

  // A defined ending is a blocker when no reachable map can trigger it.
  const unreachableEndingIds = (project.endings ?? [])
    .map((ending) => ending.id)
    .filter((endingId) =>
      [...reachableMapIds].every((mapId) => !(endingTriggersByMap.get(mapId)?.has(endingId) ?? false)),
    );

  return {
    reachableMapIds: [...reachableMapIds],
    missingTransferTargets: [...missingTransferTargets],
    unreachableEndingIds,
  };
}

export function evaluateHorrorExperienceQa(
  project: Project,
  scenarios: readonly HorrorQaScenario[],
  browserEvidence?: HorrorBrowserEvidence,
): HorrorExperienceQaReport {
  const lintIssues = projectLint(project);
  const pages = pageRecords(project);
  const reachability = analyzeHorrorReachability(project);
  const scenarioResults: HorrorQaScenarioResult[] = scenarios.map((scenario) => {
    const result = runSceneTest(project, scenario.input);
    return {
      id: scenario.id,
      label: scenario.label,
      role: scenario.role,
      ok: result.ok,
      stepsRun: result.stepsRun,
      totalSteps: result.totalSteps,
      failureReason: result.failureReason,
      finalState: {
        mapId: result.finalState.mapId,
        x: result.finalState.x,
        y: result.finalState.y,
        gameOver: result.finalState.gameOver,
        endingsReached: result.finalState.endingsReached,
      },
    };
  });

  const investigationPages = pages.filter(({ page, commands }) =>
    page.trigger.kind === "action" && commands.some((command) => command.kind === "text"),
  );
  const persistentClueCount = investigationPages.filter(({ commands }) =>
    commands.some((command) => command.kind === "setSelfSwitch"),
  ).length;
  const investigationMapCount = new Set(investigationPages.map(({ mapId }) => mapId)).size;
  const puzzleKinds = new Set(
    pages.flatMap(({ commands }) => commands.map((command) => command.kind))
      .filter((kind) => ["changeItem", "setSwitch", "setVariable", "fork"].includes(kind)),
  );
  const lethalPages = pages.filter(({ commands }) => commands.some((command) => command.kind === "killPlayer"));
  const lethalEventsWithPriorAudio = lethalPages.filter(({ commands }) => {
    const killIndex = commands.findIndex((command) => command.kind === "killPlayer");
    const audioIndex = commands.findIndex((command) => command.kind === "playAudio");
    return audioIndex >= 0 && audioIndex < killIndex;
  }).length;
  const checkpointCount = pages.filter(({ commands }) =>
    commands.some((command) => command.kind === "checkpointSave"),
  ).length;
  const chaserCount = pages.filter(({ page }) => page.movement.type === "chase").length;
  const safeZoneCount = Object.values(project.maps).reduce((sum, map) => sum + (map.safeZones?.length ?? 0), 0);
  const endingTriggerCount = pages.reduce(
    (sum, { commands }) => sum + commands.filter((command) => command.kind === "triggerEnding").length,
    0,
  );
  const customBgmMapCount = Object.values(project.maps).filter((map) =>
    map.bgm?.mode === "custom" && Boolean(map.bgm.resourceId),
  ).length;
  const metrics = {
    lintIssueCount: lintIssues.length,
    investigationEventCount: investigationPages.length,
    persistentClueCount,
    investigationMapCount,
    puzzleMechanicCount: puzzleKinds.size,
    lethalEventCount: lethalPages.length,
    lethalEventsWithPriorAudio,
    checkpointCount,
    chaserCount,
    safeZoneCount,
    endingCount: project.endings?.length ?? 0,
    endingTriggerCount,
    customBgmMapCount,
  };

  const allScenariosPass = scenarioResults.length > 0 && scenarioResults.every((result) => result.ok);
  const stability = axis("stability", "작동성과 회귀 안전", (
    (lintIssues.length === 0 ? 8 : 0)
    + (allScenariosPass ? 10 : 0)
    + (scenarioResults.length >= 7 ? 2 : 0)
  ), [
    `project lint ${lintIssues.length}건`,
    `필수 런타임 시나리오 ${scenarioResults.filter((result) => result.ok).length}/${scenarioResults.length} 통과`,
  ]);
  const mystery = axis("mystery", "조사 밀도와 단서 지속성", (
    (investigationPages.length >= 6 ? 8 : investigationPages.length)
    + (investigationMapCount >= 2 ? 4 : investigationMapCount * 2)
    + (persistentClueCount >= 4 ? 4 : persistentClueCount)
    + (investigationPages.length >= 8 ? 4 : 0)
  ), [
    `조사 대화 이벤트 ${investigationPages.length}개`,
    `조사 가능 맵 ${investigationMapCount}개`,
    `1회성/지속 단서 ${persistentClueCount}개`,
  ]);
  const feedback = axis("feedback", "퍼즐 피드백과 선택 주도성", (
    (rolePassed(scenarioResults, "locked-gate-feedback") ? 5 : 0)
    + (rolePassed(scenarioResults, "wrong-answer-recovery") ? 5 : 0)
    + (rolePassed(scenarioResults, "critical-path") ? 5 : 0)
    + (puzzleKinds.size >= 3 ? 5 : puzzleKinds.size)
  ), [
    `잠긴 장치 피드백 ${rolePassed(scenarioResults, "locked-gate-feedback") ? "통과" : "실패"}`,
    `오답 후 복구 ${rolePassed(scenarioResults, "wrong-answer-recovery") ? "통과" : "실패"}`,
    `핵심 진행 경로 ${rolePassed(scenarioResults, "critical-path") ? "통과" : "실패"}`,
    `퍼즐 상태 메커니즘 ${puzzleKinds.size}종`,
  ]);
  const tension = axis("tension", "위협, 사망 피드백, 복구", (
    (rolePassed(scenarioResults, "trap-death-retry") ? 4 : 0)
    + (rolePassed(scenarioResults, "chaser-death-retry") ? 4 : 0)
    + (lethalPages.length >= 2 ? 3 : lethalPages.length)
    + (lethalPages.length > 0 && lethalEventsWithPriorAudio === lethalPages.length ? 4 : 0)
    + (checkpointCount > 0 ? 2 : 0)
    + (safeZoneCount > 0 ? 3 : 0)
  ), [
    `함정 사망/재시도 ${rolePassed(scenarioResults, "trap-death-retry") ? "통과" : "실패"}`,
    `추격 사망/재시도 ${rolePassed(scenarioResults, "chaser-death-retry") ? "통과" : "실패"}`,
    `사망 이벤트 ${lethalPages.length}개 중 선행 효과음 ${lethalEventsWithPriorAudio}개`,
    `체크포인트 ${checkpointCount}개, 안전구역 ${safeZoneCount}개, 추격자 ${chaserCount}개`,
  ]);
  const titleResourceId = project.system.titleScreen?.backgroundResourceId;
  const browserChecks = browserEvidence
    ? [
        browserEvidence.title.imageLoaded && browserEvidence.title.resourceId === titleResourceId,
        !browserEvidence.desktopTouchPadVisible,
        browserEvidence.mapStart.passable && Boolean(project.maps[browserEvidence.mapStart.mapId]),
        browserEvidence.consoleErrorCount === 0,
      ]
    : [false, false, false, false];
  const payoff = axis("payoff", "결말 보상과 화면 연출", (
    (rolePassed(scenarioResults, "truth-ending") ? 4 : 0)
    + (rolePassed(scenarioResults, "alternate-ending") ? 4 : 0)
    + ((project.endings?.length ?? 0) >= 2 && endingTriggerCount >= 2 ? 4 : 0)
    + (titleResourceId ? 2 : 0)
    + (customBgmMapCount === Object.keys(project.maps).length ? 2 : 0)
    + browserChecks.filter(Boolean).length
  ), [
    `도달 가능한 결말 ${scenarioResults.filter((result) => result.role.endsWith("ending") && result.ok).length}개`,
    `정의된 결말 ${project.endings?.length ?? 0}개 / 결말 트리거 ${endingTriggerCount}개`,
    `커스텀 타이틀 ${titleResourceId ?? "없음"}, 커스텀 BGM 맵 ${customBgmMapCount}/${Object.keys(project.maps).length}`,
    `브라우저 관찰 ${browserChecks.filter(Boolean).length}/4 통과`,
  ]);

  const blockers: HorrorQaBlocker[] = [];
  for (const missingTarget of reachability.missingTransferTargets) blockers.push({
    id: "reachability:missing-transfer-target",
    message: `전이 대상 맵이 존재하지 않습니다: ${missingTarget}`,
  });
  for (const endingId of reachability.unreachableEndingIds) blockers.push({
    id: "reachability:unreachable-ending",
    message: `정의된 결말 '${endingId}'의 트리거가 시작 맵에서 도달 가능한 어떤 맵에도 없습니다.`,
  });
  for (const result of scenarioResults) {
    if (!result.ok) blockers.push({
      id: `scenario:${result.id}`,
      message: `${result.label}: ${result.failureReason ?? "런타임 시나리오 실패"}`,
    });
  }
  const lintErrors = lintIssues.filter((issue) => issue.severity === "error");
  if (lintErrors.length > 0) blockers.push({
    id: "stability:lint-errors",
    message: `프로젝트 lint error ${lintErrors.length}건`,
  });
  if (lethalPages.length > 0 && lethalEventsWithPriorAudio < lethalPages.length) blockers.push({
    id: "tension:lethal-sound-missing",
    message: `사망 이벤트 ${lethalPages.length - lethalEventsWithPriorAudio}개에 사망 전 효과음이 없습니다.`,
  });
  if (safeZoneCount === 0) blockers.push({
    id: "tension:no-safe-zone",
    message: "추격 압력을 끊고 판단할 안전구역이 없습니다.",
  });
  if (!browserEvidence) blockers.push({
    id: "browser:evidence-missing",
    message: "타이틀과 실제 조작 화면의 브라우저 증거가 없습니다.",
  });
  if (browserEvidence && browserChecks.some((passed) => !passed)) blockers.push({
    id: "browser:smoke-failed",
    message: `브라우저 관찰 ${browserChecks.filter(Boolean).length}/4만 통과했습니다.`,
  });

  const axes = [stability, mystery, feedback, tension, payoff] as const;
  const totalScore = axes.reduce((sum, entry) => sum + entry.score, 0);
  const verdict = blockers.length > 0 || totalScore < 75
    ? "fail"
    : totalScore >= 90
      ? "strong-pass"
      : "conditional-pass";

  return {
    schemaVersion: 1,
    verdict,
    totalScore,
    maxScore: 100,
    axes,
    blockers,
    scenarios: scenarioResults,
    metrics,
    browserEvidence,
  };
}
