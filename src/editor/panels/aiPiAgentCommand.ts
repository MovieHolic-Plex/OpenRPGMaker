import { inspectPiVillageCompletion } from "@/ai/piAgent/villageCompletion";
import { observeActivitySave } from "./aiActivitySave";
import { activityNote, activityPhase, recordActivityEvent } from "@/ai/activityTrace";
import { createPiPublication } from "./aiPiPublication";
import { isLiveApplyMode, normalizePiApplyMode } from "@/ai/piAgent/applyMode";
import { createPendingReviewPrompt } from "./aiPendingReview";
import { completionHeadline, createRefineFindings, plainMadeSummary, refineFindingsText } from "./aiPiCompletionReport";
import { friendlyExecutionError } from "@/ai/piAgent/userFacingCopy";
import { configForUltrabrain } from "@/ai/ultrabrainConfig";
import { modelForRole } from "@/ai/modelRoles";
// 채팅 패널의 `/pi` 명령. Pi 에이전트(Bun 쪽 oh-my-pi 루프)를 돌리고, 결과 프로젝트에서 맵 묶음만
// 떼어 기존 커밋 게이트(applyProposedProject)로 적용한다. 진행은 로그 안 팀 보드 카드로 그린다.
//
//   /pi <지시>              현재 맵 범위, 에이전트 하나
//   /pi map_a,map_b <지시>  맵마다 에이전트 하나씩 병렬
//   /pi team <지시>         팀장이 맵을 나눠 시공·검수 에이전트를 띄운다. 후보는 프로젝트 전체, 기본 대상은 현재 맵
//   /pi team map_a,map_b <지시>  팀장이 쓸 후보 맵을 제한
//   (`/team …` 도 같은 뜻으로 남는다 — Pi 가 유일한 실행 경로가 된 뒤에도 호환용)
//
// 이 파일은 패널의 나머지와 최소 접점(말풍선·상태 표시·로그 붙이기)만 공유한다 — 기존 세션 루프는 건드리지 않는다.

import { reviewMapHarmony, unresolvedReviewSignature } from "@/ai/ultrabrainReview";
import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { deriveRunOutcome } from "@/ai/runOutcome";
import type { RunOutcome, RunOutcomeFacts } from "@/ai/runOutcome";
import { startPiRunLog, type PiRunContext, type PiRunFacts } from "@/ai/piAgent/activityLog";
import type { AuditEntry } from "@/ai/session/types";
import { mergeMapBundles } from "@/ai/piAgent/mapBundle";
import { changedProjectKeys, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentMode, type PiAgentStats, type PiAgentThinkingLevel } from "@/ai/piAgent/protocol";
import {
  createTeamBoardState,
  markTeamBoardAborted,
  markTeamBoardApplied,
  markTeamBoardDiscarded,
  markTeamBoardDone,
  markTeamBoardFailed,
  markTeamBoardReview,
  reduceTeamBoard,
  type TeamBoardState,
} from "@/ai/piAgent/teamBoardState";
import { changeChipsWithAreas, openWideChangeViewer, renderChangePreviewCard, type ChangePreviewInput } from "./aiChangePreview";
import { createPiGhostBridge } from "./aiPiGhostBridge";
import { loadAiConfig } from "@/ai/llmClient";
import { composePiTask } from "@/ai/piAgent/executionRoute";
import { buildPiRunRequest, buildUltrabrainPlanRequest, needsUltrabrainPlanTurn, withUltrabrainPlan } from "@/ai/piAgent/plainTurn";
import { applyProposedProject, captureApplyAuthority } from "@/editor/tools/applyChangesetToStore";
import { mapLossConfirmRequest } from "@/ai/mapDestructionConfirm";
import { showConfirm } from "@/editor/ui/modal";
import { adoptSpatialToolProof, authorMergedSpatialProposal, exportSpatialToolProof } from "@/editor/tools/spatialToolState";
import { summarizeChanges } from "@/editor/tools/changeset";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { reachableMapIdsFromStart } from "@/project/mapInspection";
import { changedAreaLabels } from "@/project/changeAreas";
import { computeChangeSites } from "@/project/changeSites";
import { buildChangeLedger, type ChangeLedger } from "@/project/changeLedger";
import { createTeamBoard } from "./aiTeamBoard";
import { currentTeamActivity, publishTeamActivity, setTeamReviewActions } from "@/ai/piAgent/teamActivity";
import { loadTeamSpec } from "@/ai/piAgent/teamSpecStore";

/**
 * 이번 실행이 만들거나 고친 맵 가운데 시작 맵에서 문으로 닿지 않는 것 — 만든 것이 플레이에 안 나온다.
 * 2026-09-24 연애 4회차: 집 12채·주민 14명 마을(과 실내 14장)이 시작 맵 이동 뒤 고아로 남았는데 보고는 「완료」였다.
 */
function unreachableWorkIssues(base: Project, after: Project): string[] {
  const reachable = reachableMapIdsFromStart(after);
  const orphans = Object.values(after.maps).filter((map) => !reachable.has(map.id) && (map.events?.length ?? 0) > 0
    && base.maps[map.id] !== map);
  if (orphans.length === 0) return [];
  const names = orphans.slice(0, 3).map((map) => `'${map.name}'`).join(", ");
  return [`시작 맵에서 문으로 갈 수 없는 맵 ${orphans.length}개: ${names}${orphans.length > 3 ? " 외" : ""} — 이어 주지 않으면 거기 만든 것이 플레이에 나오지 않아요.`];
}

export const PI_COMMAND_PREFIX = "/pi";
export const TEAM_COMMAND_PREFIX = "/team";

export interface ParsedPiCommand {
  readonly mode: PiAgentMode;
  readonly mapIds: readonly string[];
  /** 사용자가 보고 있는 맵. 팀장이 「여기」를 해석하는 기준 — 후보(mapIds)와 별개다. 비우면 실행 시 패널의 현재 맵으로 채운다. */
  readonly currentMapId?: string | null;
  /**
   * 사용자가 `/pi 맵id,맵id …` 로 **직접 맵을 적었다**. 평문 턴이 현재 맵으로 채운 기본값과 구분한다.
   *
   * 왜 필요한가: `mapIds` 만으로는 「이 맵들만 고쳐라」(계약)와 「보통 이 맵일 것이다」(추측)가
   * 구별되지 않았고, 병합이 둘을 똑같이 계약으로 취급해 평문 턴의 DB·시스템 변경을 조용히
   * 버렸다(2026-09-17 실측). 범위를 좁히는 것은 사용자가 좁혔을 때뿐이다.
   */
  readonly scopedByUser?: boolean;
  readonly task: string;
}

function splitMapList(first: string, project: Project): string[] | null {
  const candidates = first.split(",").map((part) => part.trim()).filter(Boolean);
  if (candidates.length === 0 || !candidates.every((id) => Boolean(project.maps[id]))) return null;
  // 같은 맵을 두 번 적으면 에이전트 둘이 한 맵을 다투게 된다 — 파서에서 하나로 접는다.
  return [...new Set(candidates)];
}

/**
 * 이 실행의 결과를 맵 묶음 병합으로 합치는가. 「범위 지정」은 사용자가 `/pi 맵id …` 로 직접 적었을 때뿐이다.
 * 평문 턴도 현재 맵을 mapIds 에 채우기 때문에 예전 조건(`mapIds.length > 0`)은 **모든 평문 턴**을 맵 묶음으로
 * 잘랐고, 그 밖(데이터베이스·시스템·퀘스트)의 변경을 전부 버렸다 — 사용자가 시킨 그 일을(2026-09-17 실측).
 * 에이전트가 둘 이상이면 결과가 여럿이라 병합이 여전히 유일한 합치는 길이다. 팀은 팀 런타임이 합친다.
 */
export function mergesMapBundles(input: { team: boolean; mapIds: readonly string[]; scopedByUser: boolean; groupCount: number }): boolean {
  return !input.team && input.mapIds.length > 0 && (input.scopedByUser || input.groupCount > 1);
}

/** `/pi 지시` → 현재 맵. `/pi a,b 지시` → 맵 a, b. `/pi team …`·`/team …` → 팀 모드. 맵 토큰은 프로젝트에 있는 id 일 때만 인정한다. */
export function parsePiCommand(text: string, project: Project, currentMapId: string | null): ParsedPiCommand | null {
  const trimmed = text.trim();
  let mode: PiAgentMode = "single";
  let rest: string | null = null;
  if (trimmed === TEAM_COMMAND_PREFIX || trimmed.startsWith(`${TEAM_COMMAND_PREFIX} `)) {
    mode = "team";
    rest = trimmed.slice(TEAM_COMMAND_PREFIX.length).trim();
  } else if (trimmed === PI_COMMAND_PREFIX || trimmed.startsWith(`${PI_COMMAND_PREFIX} `)) {
    rest = trimmed.slice(PI_COMMAND_PREFIX.length).trim();
    if (rest === "team" || rest.startsWith("team ")) {
      mode = "team";
      rest = rest.slice(4).trim();
    }
  }
  if (rest === null) return null;
  const fallback = mode === "team" ? [] : currentMapId ? [currentMapId] : [];
  if (!rest) return { mode, mapIds: fallback, currentMapId, task: "" };
  const [first = "", ...others] = rest.split(/\s+/);
  const mapIds = splitMapList(first, project);
  if (mapIds && others.length > 0) return { mode, mapIds, currentMapId, scopedByUser: true, task: others.join(" ") };
  return { mode, mapIds: fallback, currentMapId, task: rest };
}

/**
 * 슬래시 없는 평문 지시 — 컴포저가 고른 실행 모드(팀 비트)를 그대로 싣는다. 팀은 후보를 비워 두되(팀장이 맵을 나눈다)
 * 현재 맵은 기본 대상으로 함께 보낸다 — 사용자는 보통 «지금 보고 있는 맵» 을 고치라고 말한다(실측 2026-09-15).
 */
export function plainPiCommand(text: string, mode: PiAgentMode, currentMapId: string | null): ParsedPiCommand {
  return { mode, mapIds: mode === "team" ? [] : currentMapId ? [currentMapId] : [], currentMapId, task: text.trim() };
}

// 계획 턴 문장·상한·요청 조립은 `@/ai/piAgent/plainTurn` 이 소유한다 — 헤드리스 생성기(scripts/qa-game/gen.mts)와 같은 함수를 쓴다.

/** 이 실행 하나가 해도 되는 것. 패널이 자율성 다이얼에서 풀어 넘긴다(`resolvePiRunPlan`). */
export interface PiRunOptions {
  readonly villageContract?: import("@/ai/piAgent/villageContract").VillageContract;
  /** 기존 의도 판정이 확인한 단순 생성·수정. 단독·단일 맵일 때만 별도 모델 단계를 줄인다. */
  readonly routineEdit?: boolean;
  /** 쓰기 툴 미제공 — 질문(읽기 전용) 턴. */
  readonly readOnly?: boolean;
  /** 실행하지 않고 계획만. readOnly 와 함께 켜진다(자율성 「확인」). */
  readonly planOnly?: boolean;
  /** 다이얼의 작업 예산 → Pi 턴 상한. */
  readonly maxTurns?: number;
  /**
   * 그 상한을 정한 다이얼 단계의 이름(「균형」 등). 워커는 숫자만 알기 때문에 상한에 걸려 멈췄을 때
   * 「무엇을 올리면 되는지」를 말할 수 없다 — 이름은 여기서만 붙일 수 있다.
   */
  readonly autonomyLabel?: string;
  /** Legacy caller hint. Role-specific reasoning takes precedence in Pi execution. */
  readonly thinkingLevel?: PiAgentThinkingLevel;
  /**
   * Legacy/domain-scoped callers may seed domains. Normal chat sends initialToolNames.
   * Both are exposure hints; discovery may expand them.
   */
  readonly toolDomains?: readonly string[];
  /** Intent-selected initial schemas. Runtime discovery can expand this list. */
  readonly initialToolNames?: readonly string[];
  /**
   * 의도 선언이 확정한 것을 본문에 전하는 노트(`buildPiIntentNote`). 계획 턴·실행 턴·팀장이 같은 문자열을
   * 읽는다. 로그·보드에는 싣지 않는다 — 거기는 사용자 문장(`command.task`)이다.
   */
  readonly intentNote?: string | null;
}

/** 적용 뒤 영수증(지금 → 적용 후) 재료. 렌더는 패널이 한다 — 되돌리기와 스튜디오 「변경」 탭이 거기 있다. */
export interface PiChangeReceipt {
  readonly before: Project;
  readonly after: Project;
  readonly mapId: string | null;
  readonly title: string;
  readonly detail: string;
  readonly chips: readonly string[];
  /** 항목별 before → after 명세 — 큰 위임의 검토는 칩이 아니라 이걸로 한다. */
  readonly ledger?: ChangeLedger;
  /** 되돌리기 신호에 남길 툴 이름(성향 기억이 «가장 강한 부정» 을 이 이름으로 기록한다). */
  readonly toolNames: readonly string[];
}

export interface PiCommandSurface {
  readonly appendBubble: (role: "system" | "assistant", text: string) => unknown;
  /** 로그에 카드 같은 임의 요소를 붙인다(변경 영수증과 같은 자리). */
  readonly appendProcess?: (text: string) => void;
  readonly appendCard: (element: HTMLElement) => void;
  /** User decisions remain visible outside collapsed process details. */
  readonly appendReviewPrompt?: (element: HTMLElement) => void;
  readonly onReviewResolved?: (applied: boolean) => void;
  readonly setStatus: (text: string) => void;
  readonly getCurrentMapId: () => string | null;
  /** 중단 시 미승인 변경을 폐기한다. 실시간·단계별 모드에서 이미 적용한 작업은 남는다. */
  readonly signal?: AbortSignal;
  /**
   * 적용이 끝난 뒤 영수증 카드(지금 → 적용 후)를 남긴다. 없으면 카드 없이 끝난다 —
   * 조수 세션이 하던 그 카드이고, Pi 경로에도 같은 계약(DESIGN.md 「Receipt card」)이 걸린다.
   */
  readonly showChangeReceipt?: (input: PiChangeReceipt) => void;
  /** 실행 종료 4축(실행·목표·전달·이미지) — 패널의 ai-run-outcome 라인이 그린다. 생략하면 아무도 안 보고 안 그린다. */
  readonly setRunOutcome?: (outcome: RunOutcome) => void;
  /**
   * 실행이 끝나면 그 실행의 감사 행을 넘긴다.
   *
   * Pi 경로는 세션이 없어 패널의 `controller.auditHistory` 를 아무도 채우지 않았다 — 그래서
   * 브리지(`window.__oprnAiBridge.audit()`)가 Pi 턴에서 항상 빈 배열이었고, 이 API 를 읽는
   * QA 스펙들이 툴 호출을 0으로 봤다(2026-09-16 실측). 행을 만드는 자리는 활동 로그 하나다.
   */
  readonly onRunAudit?: (rows: readonly AuditEntry[]) => void;
  /** 이번 실행이 쓴 턴·토큰. 패널이 대화 합계로 쌓아 입력줄에 짧게 보여 준다. */
  readonly onSpend?: (spend: { readonly turns: number; readonly tokens: number }) => void;
}

export async function runPiCommand(
  command: ParsedPiCommand,
  surface: PiCommandSurface,
  options: PiRunOptions = {},
): Promise<boolean> {
  if (!command.task) {
    surface.appendBubble("system", "사용법: /pi <지시> · /pi 맵id,맵id <지시> · /team <지시>");
    return false;
  }
  const base = store.getCurrent();
  const { base: proposalBase, baseline } = captureApplyAuthority(base);
  const config = loadAiConfig();
  const applyMode = normalizePiApplyMode(config.piApply);
  const publication = createPiPublication(base, applyMode, surface, {
    beforeApply: (before, next) => ghost.present(before, next, surface.signal),
    afterApply: project => ghost.accept(project),
  });
  const brain = configForUltrabrain(config);
  const deep = modelForRole(config, "deep");
  const effective = options.planOnly || (command.mode === "team" && !options.readOnly)
    ? { provider: brain.providerId!, model: brain.model } : deep;
  const provider = effective.provider;
  const readOnly = options.readOnly === true || options.planOnly === true;
  // 조회 턴에 팀을 켜면 시공 팀원이 아무것도 못 하는 채로 예산만 태운다 — 읽기 전용은 언제나 단독이다.
  const team = command.mode === "team" && !readOnly && !options.villageContract;
  const routineEdit = options.routineEdit === true && !readOnly && !team
    && command.mapIds.length === 1 && Boolean(base.maps[command.mapIds[0]!]);
  const groups = team || options.planOnly ? [command.mapIds] : command.mapIds.length > 0 ? command.mapIds.map((id) => [id]) : [[] as string[]];
  // 병합 여부 한 곳 — 체크포인트 발행·최종 병합·요청의 가드 신호(mapBundleMerge)가 같은 값을 쓴다.
  // 가드가 꺼진 채 병합만 하면 범위 밖 맵 변경이 도구에선 성공하고 병합에서 버려진다.
  const mergedFromBundles = mergesMapBundles({ team, mapIds: command.mapIds, scopedByUser: command.scopedByUser === true, groupCount: groups.length });
  // 사용자가 보고 있는 맵 — 팀장의 「여기」. 명령이 못 실었으면(옛 호출자) 패널의 현재 맵으로 채운다.
  const currentMapId = command.currentMapId ?? surface.getCurrentMapId();
  const here = currentMapId && base.maps[currentMapId] ? { currentMapId } : {};

  // 실행 결과 4축 — 세션 경로(assistantSession.getRunOutcome)와 같은 deriveRunOutcome 을 쓴다.
  // 실행부는 사실만 정하고 판정(목표)은 수용 검사가 소유하므로 Pi 경로에선 unassessed 가 정직한 값이다.
  const streamErrors: string[] = [];
  const spilledKeys: string[] = [];
  let toolErrorCount = 0;
  let changedCount = 0;
  let applied = false;
  let harmonyManualReview = false;
  let villageIncomplete = false;
  let villageVerified = false;
  let unpublishedChanges = false;
  /** 사실 팩 하나를 4축으로 투영한다 — 마을 검사 실패는 incomplete, 나머지 목표 충족은 별도 수용 검사의 소유다. */
  const publishOutcome = (facts: Omit<RunOutcomeFacts, "acceptance" | "visualDelivery">): void => {
    surface.setRunOutcome?.(deriveRunOutcome({ ...facts, acceptance: villageIncomplete ? "blocked" : villageVerified ? "verified" : null }));
  };
  /** 종료 시점의 4축 하나를 게시한다. 종료 경로가 여러 개라서 하나로 모은다. */
  const publishFinalOutcome = (): void => {
    if (!surface.setRunOutcome) return;
    const hasPendingDraft = !applied && unpublishedChanges && changedCount > 0 && (!isLiveApplyMode(applyMode) || harmonyManualReview);
    publishOutcome({
      execution: surface.signal?.aborted ? "cancelled"
        : streamErrors.length > 0 && changedCount === 0 ? "blocked" : "response-final",
      hasPendingDraft,
      hasApplied: applied || publication.count > 0,
      persistence: "none",
    });
  };
  /** 성공·실패 캡션에 오류를 묻는다 — "실패 1" 배지가 "적용됨" 캡션에 묻히지 않게(실측 2026-09-11). */
  const errorDigest = (): string => {
    if (streamErrors.length === 0 && toolErrorCount === 0) return "";
    const counts = [streamErrors.length > 0 ? `오류 ${streamErrors.length}건` : null, toolErrorCount > 0 ? `툴 실패 ${toolErrorCount}건` : null].filter((part) => part !== null);
    const first = streamErrors[0] ?? "";
    const separator = counts.length > 0 ? " — " : "";
    return ` (⚠ ${counts.join(", ")}${separator}${first})`;
  };
  // 이 실행 하나가 활동 로그 행 하나다. 시작은 pending, 끝은 같은 id 로 upsert —
  // 죽은 실행도 "무슨 지시였고 언제 시작했는지" 가 남는다(세션 턴과 같은 관례).
  const logContext: PiRunContext = {
    applyMode,
    instruction: command.task,
    mode: command.mode,
    mapIds: command.mapIds,
    mapId: command.mapIds[0] ?? surface.getCurrentMapId(),
    mapName: command.mapIds[0] ? base.maps[command.mapIds[0]]?.name ?? null : null,
    provider,
    model: effective.model,
  };
  const runLog = startPiRunLog(logContext);
  // boardState 는 push 마다 새 객체로 갈아 끼워지므로 호출 시점의 것을 싣는다.
  const finishLog = (facts: Omit<PiRunFacts, "board">): void => {
    void runLog.finish({ ...facts, board: boardState }).then(
      (rows) => surface.onRunAudit?.(rows),
      () => { /* 기록 실패는 이미 삼켜진다 — 감사 전달도 실행을 막지 않는다 */ },
    );
  };

  let boardState: TeamBoardState = createTeamBoardState(command.mode, command.task, store.getProjectIdentity().id);
  const board = createTeamBoard(boardState, { externalReview: Boolean(surface.appendReviewPrompt) });
  setTeamReviewActions(null);
  surface.appendCard(board.root);
  const sync = (): void => {
    if (boardState.trace) boardState = { ...boardState, trace: activityPhase(boardState.trace, boardState.phase) };
    board.update(boardState); publishTeamActivity(boardState);
  };
  const push = (event: PiAgentEvent): void => {
    boardState = reduceTeamBoard(boardState, event);
    sync();
  };
  sync();
  const teamSpec = team ? loadTeamSpec() : undefined;
  const scopeText = team
    ? (command.mapIds.length > 0 ? `후보 맵 ${command.mapIds.join(", ")}` : "프로젝트 전체")
    : groups.map((g) => g.join(",") || "전체").join(" · ");
  surface.setStatus(team ? "팀원들이 작업하고 있어요." : "작업하고 있어요.");

  // 단일·병렬 모드의 평평한 이벤트는 그룹 단위 행으로 감싸 보드에 넣는다. 팀 모드는 런타임이 이미 감싸서 보낸다.
  // 질문(읽기 전용)·계획 턴의 결과는 «바뀐 것» 이 아니라 **말**이다. 보드는 마지막 한 줄만 남기므로
  // 답이 될 문장을 따로 붙잡아 둔다 — 이게 없으면 질문 모드가 220자로 잘린 한 줄이 된다.
  let lastAssistantText = "";
  // 팀의 검수 팀원이 통과시킨 맵. 마지막 판정만 남긴다 — 수정 뒤 재검수가 떨어뜨리면 빠진다.
  const teamApprovedMaps = new Set<string>();
  // 캔버스 시공 표시(밑그림). 워커의 `map_delta` 를 초안으로 복원해 고스트를 그린다 — 이게 없으면
  // 결과 프로젝트가 맨 끝 `done` 에만 실려서 턴 내내 캔버스가 조용하다(2026-09-17 회귀).
  // 단일·병렬·팀이 다리 하나를 공유하며 검토 진입 시 실제 병합 결과로 보정한다.
  const ghost = createPiGhostBridge({ baseProject: base });
  const showConstructionEvent = (event: PiAgentEvent): void => {
    let nested = event;
    while (nested.type === "agent_event") nested = nested.event;
    // Live modes preview authoritative checkpoints; post-commit deltas must not replay.
    if (!options.villageContract && isLiveApplyMode(applyMode) && (nested.type === "map_delta" || nested.type === "done")) return;
    ghost.handleEvent(event);
  };
  // 워커의 「턴 상한(N)을 넘어 중단했습니다.」를 다이얼 어휘로 옮긴다. 옮기는 자리가 여기인 이유:
  // 이 문장은 `error` 이벤트 하나에서 갈라져 보드 행·실행 요약·적용 캡션·영수증·활동 로그 다섯
  // 군데로 퍼진다. 갈라지기 전에 한 번 고쳐야 다섯 군데가 같은 말을 한다.
  // 왜 필요한가(2026-09-17 실측): 상한에 걸린 7번 모두 원인도 해법도 화면에 없었다 — 사용자는
  // 자기가 내린 다이얼이 원인인 줄 모른 채 「끝났지만 바뀐 게 없습니다」만 봤다.
  const TURN_CAP_PATTERN = /^턴 상한\((\d+)\)을 넘어 중단했습니다\.$/;
  // 상한·시간에 걸려 **중간에 끊긴** 실행인가. 끊긴 실행의 결과물은 «완성된 것»이 아니라
  // «하다 만 것»이라 자동 적용하지 않는다(아래 harmonyManualReview). 회수 가능한 스트림 오류
  // (토큰 만료 등)와 구별해야 한다 — 그쪽은 끝까지 갔으면 성공이 맞다.
  const STOPPED_PATTERNS = [TURN_CAP_PATTERN, /^시간 상한을 넘어 중단했습니다\.$/, /^Request was aborted$/];
  let stoppedByLimit = false;
  const explainTurnCap = (message: string): string => {
    const text = message.trim();
    if (STOPPED_PATTERNS.some((pattern) => pattern.test(text))) stoppedByLimit = true;
    const hit = TURN_CAP_PATTERN.exec(text);
    if (!hit) return message;
    const label = options.autonomyLabel;
    const dial = label ? `자율성 「${label}」의 작업 한도` : "작업 한도";
    return `${dial}(${hit[1]}턴)에 도달해 중단했습니다 — ${publication.count ? "이미 반영한 변경은 남아 있습니다." : "아직 적용하지 않은 결과는 초안으로 남습니다."} 자율성 다이얼을 올려 다시 보내세요.`;
  };
  const wrap = (mapIds: readonly string[], index: number) => (raw: PiAgentEvent): void => {
    // heartbeat 는 연결 생존 신호다 — 클라이언트 워치독이 이미 소뱄했고, 보드에는 그릴 것이 없다.
    if (raw.type === "heartbeat") {
      if (boardState.trace) boardState = { ...boardState, trace: recordActivityEvent(boardState.trace, raw) };
      return;
    }
    // 오류 문구는 갈라지기 **전에** 한 번만 고친다(explainTurnCap 주석 참고).
    const event: PiAgentEvent = raw.type === "error" ? { ...raw, message: explainTurnCap(raw.message) } : raw;
    showConstructionEvent(event);
    if (event.type === "assistant") lastAssistantText = event.text;
    // 팀 모드의 오류도 실행 요약에 실린다. 예전에는 여기서 곧장 return 해 streamErrors 가 늘 비었고,
    // 팀 런은 오류를 한 건도 안 낸 것처럼 기록됐다.
    if (event.type === "error" && streamErrors.length < 3) streamErrors.push(event.message);
    if (team) {
      if (event.type === "review" && event.mapId) {
        if (event.ok) teamApprovedMaps.add(event.mapId);
        else teamApprovedMaps.delete(event.mapId);
      }
      push(event);
      return;
    }
    const agentId = mapIds.join(",") || `agent-${index + 1}`;
    if (event.type === "start") {
      push({ type: "agent_spawn", agentId, role: "builder", mapId: mapIds[0] ?? null, mapName: mapIds[0] ? base.maps[mapIds[0]]?.name ?? null : null, task: command.task });
    }
    if (event.type === "error") { push({ type: "agent_event", agentId, event }); push(event); return; }
    if (event.type === "done") { push({ type: "agent_event", agentId, event }); return; }
    push({ type: "agent_event", agentId, event });
    if (event.type === "turn") surface.setStatus(groups.length > 1 ? `작업 중… (${index + 1}/${groups.length})` : "작업 중…");
    // 검색은 실제로 길다(실측 2026-09-21: 31초). 그동안 화면이 "작업 중…"만 보여 주면 멈춘 것처럼 보인다 —
    // 무엇을 기다리는지 말해 주면 사용자가 기다릴 지 알 수 있다.
    if (event.type === "tool_start" && event.name === "web_search") {
      surface.setStatus("웹에서 참고 작품을 찾는 중… (십 초 정도 걸릴 수 있어요)");
    }
  };

  let results: PiAgentDoneEvent[];
  const spendStats: PiAgentStats[] = [];
  const reportSpend = (): void => {
    let turns = 0;
    let tokens = 0;
    for (const stats of spendStats) {
      turns += stats.turns;
      tokens += stats.usage?.totalTokens ?? 0;
    }
    if (turns > 0 || tokens > 0) surface.onSpend?.({ turns, tokens });
  };
  try {
    // 모델이 읽는 지시문 = 사용자 문장 + 의도 노트. 계획 턴도 같은 것을 읽어야 계획에 author_village 같은
    // 이름이 남고, 실행 턴이 그 이름을 따라간다(노트 없이는 산문 계획 → paint_road 손작업으로 흘렀다).
    const modelTask = composePiTask(command.task, options.intentNote);
    let executionTask = modelTask;
    if (needsUltrabrainPlanTurn({ villageContract: options.villageContract, readOnly, team, routineEdit, applyMode })) {
      surface.setStatus("어떻게 바꿀지 정리하고 있어요.");
      let plan = "";
      let planError = "";
      push({ type: "agent_spawn", agentId: "ultrabrain-plan", role: "orchestrator", mapId: null, mapName: null, task: command.task, label: "Ultrabrain · 계획" });
      const planned = await runPiAgentViaCompanion(buildUltrabrainPlanRequest({
        brain, modelTask, mapIds: command.mapIds, ...here, project: base,
        scopedByUser: command.scopedByUser === true,
        ...(options.maxTurns === undefined ? {} : { maxTurns: options.maxTurns }),
        ...(options.initialToolNames ? { initialToolNames: options.initialToolNames } : {}),
      }), { signal: surface.signal, onEvent: raw => {
        if (raw.type === "heartbeat") {
          if (boardState.trace) boardState = { ...boardState, trace: recordActivityEvent(boardState.trace, raw, "ultrabrain-plan") };
          return;
        }
        const event: PiAgentEvent = raw.type === "error" ? { ...raw, message: explainTurnCap(raw.message) } : raw;
        showConstructionEvent(event);
        push({ type: "agent_event", agentId: "ultrabrain-plan", event });
        // 계획 턴이 참고 작품을 검색하는 자리다 — 사용자는 아직 화면에 "어떻게 바꿀지 정리하고 있어요"만 보고 있다.
        if (event.type === "tool_start" && event.name === "web_search") {
          surface.setStatus("웹에서 참고 작품을 찾는 중… (십 초 정도 걸릴 수 있어요)");
        }
        if (event.type === "assistant") plan = event.text;
        if (event.type === "error") planError = event.message;
      } });
      surface.signal?.throwIfAborted();
      if (planError || !plan.trim() || planned.changedKeys.length) throw new Error(planError || "Ultrabrain 계획을 완료하지 못했습니다.");
      spendStats.push(planned.stats);
      push({ type: "agent_done", agentId: "ultrabrain-plan", ok: true, summary: plan,
        stats: planned.stats, changedKeys: [], spills: [], conflicts: [] });
      (surface.appendProcess ?? ((text: string) => surface.appendBubble("assistant", text)))(`계획\n${plan}`);
      executionTask = withUltrabrainPlan(modelTask, plan);
    }
    results = await Promise.all(groups.map((mapIds, index) => runPiAgentViaCompanion(
      buildPiRunRequest({
        team, planOnly: options.planOnly, readOnly, applyMode, villageContract: options.villageContract,
        brain, deep, writer: modelForRole(config, "writer"),
        modelTask, executionTask, mapIds, ...here, project: base,
        scopedByUser: command.scopedByUser === true, mapBundleMerge: mergedFromBundles,
        ...(options.maxTurns === undefined ? {} : { maxTurns: options.maxTurns }),
        ...(options.toolDomains ? { toolDomains: options.toolDomains } : {}),
        ...(options.initialToolNames ? { initialToolNames: options.initialToolNames } : {}),
        ...(teamSpec ? { teamSpec } : {}),
      }),
      { signal: surface.signal, onEvent: wrap(mapIds, index),
        onCheckpoint: options.villageContract || readOnly || applyMode === "review" ? undefined : async checkpoint => {
          // Parallel explicit map requests publish only their owned bundle on the latest accepted base.
          if (mergedFromBundles) {
            const next = mergeMapBundles(publication.project, [{ mapIds, project: checkpoint.project }]).project;
            authorMergedSpatialProposal(next, publication.project);
            return publication.publish({ ...checkpoint, project: next, spatialProof: exportSpatialToolProof(next) });
          } else return publication.publish(checkpoint);
        },
      },
    )));
    spendStats.push(...results.map((done) => done.stats));
    reportSpend();
  } catch (error) {
    reportSpend();
    if (surface.signal?.aborted) {
      // fetch 는 abort 에서 AbortError 를 던진다 — 실패가 아니라 중단이므로 중단 경로로 돌린다(실측 2026-09-11).
      ghost.dispose();
      publishFinalOutcome();
      boardState = markTeamBoardAborted(boardState); sync();
      finishLog({ applied: publication.count > 0, changedCount: publication.count, stoppedReason: "중단" });
      surface.setStatus("대기");
      surface.appendBubble("system", publication.count ? "작업을 중단했어요. 이미 반영한 변경은 남아 있으며 되돌릴 수 있어요." : "작업을 중단했어요. 변경한 내용은 적용하지 않았어요.");
      return false;
    }
    const message = error instanceof Error ? error.message : String(error);
    streamErrors.push(message);
    ghost.dispose();
    publishFinalOutcome();
    boardState = markTeamBoardFailed(boardState, message); sync();
    finishLog({ applied: publication.count > 0, changedCount: publication.count, error: message });
    surface.setStatus("작업을 마치지 못했어요.");
    surface.appendProcess?.(message);
    surface.appendBubble("system", `${friendlyExecutionError(message)} ${publication.count ? "이미 반영한 변경은 남아 있으며 되돌릴 수 있어요." : "변경한 내용은 적용하지 않았어요."}`);
    return false;
  }
  if (surface.signal?.aborted) {
    ghost.dispose();
    publishFinalOutcome();
    boardState = markTeamBoardAborted(boardState); sync();
    finishLog({ applied: publication.count > 0, changedCount: publication.count, stoppedReason: "중단" });
    surface.setStatus("대기");
    surface.appendBubble("system", publication.count ? "작업을 중단했어요. 이미 반영한 변경은 남아 있으며 되돌릴 수 있어요." : "작업을 중단했어요. 변경한 내용은 적용하지 않았어요.");
    return false;
  }
  if (readOnly && results.some(result => changedProjectKeys(base, result.project).length > 0)) {
    ghost.dispose();
    streamErrors.push("읽기 전용 실행이 변경을 반환했습니다. 적용하지 않았습니다.");
    publishFinalOutcome();
    boardState = markTeamBoardFailed(boardState, streamErrors.at(-1)!); sync();
    finishLog({ applied: false, changedCount: 0, error: streamErrors.at(-1)! });
    surface.appendBubble("system", streamErrors.at(-1)!);
    surface.setStatus("적용 거부");
    return false;
  }
  // 팀 모드는 런타임이 이미 맵 묶음으로 병합해 돌려준다. 단일 범위 지정은 여기서 병합한다.
  //
  const villageMapIds = new Set(results.flatMap(result => result.villageCompletion?.mapIds ?? []));
  villageIncomplete = !!options.villageContract && results.some(result => !result.villageCompletion || result.villageCompletion.issues.length > 0);
  let merged = mergedFromBundles
    ? mergeMapBundles(base, results.map((done, index) => ({ mapIds: groups[index]!, project: done.project })))
    : { project: results[0]!.project, spills: [], conflicts: [] as string[] };
  // 수용 게이트는 «도구가 만든 제안»이라는 증거를 요구하는데, 그 프루프는 객체 정체성에 살아
  // 동반 서비스(워커)에서 건너오지 못한다. 묶음을 여기서 병합했으면 살아있는 문서 위에 얹었다는
  // 증거를 다시 찍고, 워커 결과를 그대로 적용하는 경우(팀·전체 범위)는 워커가 실어 보낸
  // 다이제스트를 되붙인다 — 없으면 게이트가 정당하게 거절한다.
  if (mergedFromBundles) authorMergedSpatialProposal(merged.project, base);
  else adoptSpatialToolProof(merged.project, results[0]!.spatialProof, base);
  if (merged.conflicts.length > 0) {
    surface.appendBubble("system", "여러 팀원이 같은 맵이나 설정을 바꿔 마지막 변경을 선택했어요. 적용할 내용을 확인해 주세요.");
    surface.appendProcess?.(`에이전트 둘 이상이 같은 맵·설정을 바꿨습니다(뒤의 결과 채택): ${merged.conflicts.map((id) => `\`${id}\``).join(", ")}`);
  }
  spilledKeys.push(...merged.spills.flatMap((spill) => spill.keys));
  if (spilledKeys.length) surface.appendBubble("system", "선택한 작업 범위를 벗어난 변경은 제외했어요.");
  for (const spill of merged.spills) {
    surface.appendProcess?.(`범위 밖 변경을 버렸습니다 \`${spill.mapIds.join(",")}\`: ${spill.keys.map((key) => `\`${key}\``).join(", ")}`);
  }
  let changed = summarizeChanges(base, merged.project);
  const toolCalls = results.reduce((sum, done) => sum + done.stats.toolCalls, 0);
  toolErrorCount += results.reduce((sum, done) => sum + done.stats.toolErrors, 0);
  let changedKeys = changedProjectKeys(base, merged.project);
  changedCount = changedKeys.length;
  unpublishedChanges = changedProjectKeys(publication.project, merged.project).length > 0;
  // 에이전트가 한 일이 **전부** 범위 밖이라 버려진 턴. 이건 「바뀐 것이 없다」가 아니라 실패다.
  //
  // 2026-09-17 실측: 「회복약 아이템 하나 만들어줘」에 대해 ① 계획이 "DB 변경은 병합 때 빠질 수
  // 있다"고 예고하고 ② 병합이 `database` 를 버리고 ③ 에이전트가 "등록을 완료했습니다"라고 답하고
  // ④ 시스템이 "프로젝트는 바뀌지 않았습니다"로 끝냈다. 네 문장이 한 화면에서 서로를 부정했고,
  // 화면의 모든 어휘(초록 「완료」 칩·「대기」 상태·성공으로 적힌 활동 로그)가 성공을 가리켰다.
  // 여기서 성공 어휘를 끊는다 — 무엇이 왜 버려졌는지 말하고, 실행 기록에도 실패로 남긴다.
  const droppedEverything = changedCount === 0 && spilledKeys.length > 0 && !options.planOnly;
  if (changedCount === 0) {
    const answer = lastAssistantText.trim();
    const spillList = spilledKeys.map((key) => `\`${key}\``).join(", ");
    const spillReason = `요청한 변경이 이번 실행의 범위(${scopeText}) 밖이라 적용되지 않았습니다 — 버린 것: ${spillList}.`
      + " 에이전트의 답과 달리 프로젝트는 그대로입니다.";
    // 「적용됨」은 커밋된 실행에만 쓴다 — 계획 턴과 답(질문) 턴은 바뀌지 않는 것이 정상이고,
    // "바뀐 것이 없다" 로 끝내면 성공한 질문이 실패로 읽힌다(2026-09-12 실측).
    const caption = options.planOnly
      ? "계획만 세웠습니다. 실행하려면 같은 지시를 다시 보내세요."
      : droppedEverything
        ? spillReason
        : answer
          ? "프로젝트는 바뀌지 않았습니다."
          : "확인을 마쳤어요. 프로젝트는 바꾸지 않았어요.";
    ghost.dispose();
    publishFinalOutcome();
    boardState = droppedEverything
      ? markTeamBoardFailed(boardState, spillReason)
      : markTeamBoardDone(
        boardState,
        options.planOnly ? "계획만 세웠습니다." : answer ? "답변했습니다 — 프로젝트는 그대로입니다." : "바뀐 것이 없습니다.",
      );
    sync();
    finishLog({
      applied: false,
      changedCount: 0,
      stoppedReason: options.planOnly ? "계획만" : droppedEverything ? "범위 밖 버림" : answer ? "답변" : "변경 없음",
      // 실행 기록의 ok 는 error 유무로 정해진다(activityLog). 버려진 턴을 성공으로 적으면
      // `npm run ai:log --failed` 가 이 실패를 영영 못 본다.
      ...(droppedEverything ? { error: spillReason } : {}),
    });
    surface.setStatus(droppedEverything ? "적용 실패" : "대기");
    // 답이 곧 결과인 턴은 본문 말풍선이 먼저다 — 보드의 잘린 한 줄·시스템 줄이 답 앞에 서지 않게 한다.
    if (answer && !droppedEverything) surface.appendBubble("assistant", answer);
    if (streamErrors.length) {
      surface.appendProcess?.(streamErrors.join("\n"));
      surface.appendBubble("system", stoppedByLimit ? "작업 한도에 도달해 끝까지 마치지 못했어요. 작업 범위를 줄이거나 자율성 설정을 조정해 다시 요청해 주세요." : "작업 중 일부 문제가 있었어요. 작업 과정을 확인해 주세요.");
    }
    if (droppedEverything) surface.appendProcess?.(spillReason);
    surface.appendBubble("system", droppedEverything ? "요청한 변경이 선택한 작업 범위를 벗어나 적용하지 않았어요. 작업 범위를 바꿔 다시 요청해 주세요." : caption);
    return true;
  }
  // 영수증이 그릴 맵: 먼저 바뀐 맵, 없으면 지시 범위의 첫 맵, 그것도 없으면 프로젝트의 첫 맵.
  // 마지막 후보가 없으면 맵 없는 프로젝트에서 영수증이 통째로 사라진다(그림은 못 그려도 이름은 남아야 한다).
  const receiptMapId = changedKeys.find((key) => key.startsWith("maps."))?.slice("maps.".length)
    ?? command.mapIds[0] ?? surface.getCurrentMapId() ?? Object.keys(merged.project.maps)[0] ?? null;
  const receiptTitle = "변경 내용";
  // 카운터가 없는 영역(퀘스트·스토리 플래그·캐릭터·맵 연결…)까지 한 줄에 — 검토 카드와 영수증이
  // 같은 칩을 쓴다. 이게 없으면 그런 턴은 "적용/버리기" 만 있는 빈 카드로 끝났다.
  let receiptChips = changeChipsWithAreas(changed, changedAreaLabels(base, merged.project));
  // Review the merged postprocessed draft once; preserve whole-map context.
  // Negative/unavailable review keeps the existing manual proposal path, never auto-applies.
  // 예상보다 범위가 커졌으면 검토를 복원한다. 생략을 "검수 통과"로 기록하지 않는다.
  const needsHarmonyReview = !options.villageContract && applyMode !== "yolo" && (applyMode === "auto" || !routineEdit || changedKeys.some(key => key !== `maps.${command.mapIds[0]}`));
  let harmonyApproved = false;
  // 끝난 뒤 사용자에게 보여 줄 «남은 문제» — 무엇이 문제인지 말하지 않는 경고는 아무것도 알려 주지 않는다.
  let unresolvedFindings: string[] = [];
  let harmonyIssue: string | null = null;
  if (needsHarmonyReview) {
    try {
      // 팀 검수 팀원이 이미 통과시킨 맵은 다시 그려 묻지 않는다(팀 3중 검수의 마지막 겹).
      const harmonyTargets = teamApprovedMaps.size
        ? new Set(Object.keys(merged.project.maps).filter(id => !teamApprovedMaps.has(id)))
        : undefined;
      let reviews = await reviewMapHarmony(base, merged.project, command.task, config, {
        ...(harmonyTargets ? { mapIds: harmonyTargets } : {}),
        signal: surface.signal,
        onStatus: text => { surface.appendProcess?.(text); surface.setStatus("바뀐 내용이 잘 맞는지 확인하고 있어요."); },
        onReview: review => {
          push({ type: "agent_spawn", agentId: `ultrabrain-${review.mapId}`, role: "reviewer", mapId: review.mapId,
            mapName: merged.project.maps[review.mapId]?.name ?? null, task: "전체 맵 조화 검수", label: "Ultrabrain" });
          (surface.appendProcess ?? ((text: string) => surface.appendBubble("assistant", text)))(`확인 기록 · ${merged.project.maps[review.mapId]?.name ?? review.mapId}\n${review.summary}${review.findings.length ? "\n" + review.findings.map(f => `• ${f}`).join("\n") : ""}`);
          push({ type: "review", agentId: `ultrabrain-${review.mapId}`, mapId: review.mapId, ok: review.harmonious, findings: [...review.findings] });
        },
      });
      harmonyApproved = reviews.every(review => review.harmonious);
      // AUTO owns bounded repair; unresolved changes never masquerade as reviewed success.
      for (let attempt = 0; applyMode === "auto" && !harmonyApproved && attempt < 2; attempt++) {
        surface.signal?.throwIfAborted();
        const before = unresolvedReviewSignature(reviews);
        const repairBase = publication.count ? publication.project : merged.project;
        surface.setStatus(`AI가 검수 문제를 수정하고 있어요 (${attempt + 1}/2).`);
        const repaired = await runPiAgentViaCompanion({
          mode: "single", provider: deep.provider, model: deep.model, project: repairBase,
          mapIds: command.mapIds, ...here, scopeStrict: command.scopedByUser === true,
          task: `사용자 요청: ${command.task}\n기존 요청 범위를 유지하며 다음 검수 문제만 수정하세요.\n${reviews.filter(r => !r.harmonious).map(r => `${r.mapId}: ${r.summary} ${r.findings.join("; ")}`).join("\n")}`,
          applyMode: "auto", maxTurns: options.maxTurns, thinkingLevel: deep.thinkingLevel,
          // 수리 실행도 같은 의도 선별 목록에서 시작한다 — 없으면 새 Agent 가 전체 카탈로그(≈113k 토큰)를 매 호출 받는다.
          ...(options.initialToolNames ? { initialToolNames: options.initialToolNames } : {}),
        }, { signal: surface.signal, onEvent: wrap(command.mapIds, 0), onCheckpoint: c => publication.publish(c) });
        const preRepair = merged.project;
        for (const id of repaired.villageCompletion?.mapIds ?? []) villageMapIds.add(id);
        merged = { ...merged, project: repaired.project };
        adoptSpatialToolProof(merged.project, repaired.spatialProof, publication.count ? publication.project : base);
        // 재검수는 «떨어진 맵 + 수리가 실제로 그림을 바꾼 맵» 만 본다. 예전엔 바뀐 맵 전부를
        // 매 라운드 다시 그려, 마을 한 채 요청(외경+실내 3장)이 검수만 24회 호출로 불었다.
        const recheck = new Set<string>([
          ...reviews.filter(review => !review.harmonious).map(review => review.mapId),
          ...changedProjectKeys(preRepair, merged.project)
            .filter(key => key.startsWith("maps."))
            .map(key => key.slice("maps.".length)),
        ]);
        const fresh = await reviewMapHarmony(base, merged.project, command.task, config, { signal: surface.signal, mapIds: recheck });
        reviews = [...reviews.filter(review => !recheck.has(review.mapId)), ...fresh];
        harmonyApproved = reviews.every(review => review.harmonious);
        // 수리가 지적을 한 글자도 못 바꿨으면 다음 라운드도 못 바꾼다 — 같은 값을 내려고
        // 파이 에이전트를 한 번 더 돌리지 않는다(실측: 실내 맵을 「마을이 아니다」로 떨어뜨린
        // 판정이 두 라운드 내내 동일했고 턴이 끝나지 않았다).
        if (!harmonyApproved && unresolvedReviewSignature(reviews) === before) {
          surface.appendProcess?.("검수 지적이 수리 뒤에도 그대로라 반복을 멈췄어요 — 아래 지적은 그대로 남습니다.");
          break;
        }
      }
      unresolvedFindings = reviews.filter(review => !review.harmonious)
        .flatMap(review => review.findings.map(finding => `${merged.project.maps[review.mapId]?.name ?? review.mapId}: ${finding}`));
      changed = summarizeChanges(base, merged.project);
      changedKeys = changedProjectKeys(base, merged.project);
      changedCount = changedKeys.length;
      unpublishedChanges = changedProjectKeys(publication.project, merged.project).length > 0;
      receiptChips = changeChipsWithAreas(changed, changedAreaLabels(base, merged.project));
    } catch (error) {
      if (surface.signal?.aborted) {
        ghost.dispose();
        publishFinalOutcome();
        boardState = markTeamBoardAborted(boardState); sync();
        finishLog({ applied: publication.count > 0, changedCount, stoppedReason: "중단" });
        surface.setStatus("대기");
        return false;
      }
      const message = error instanceof Error ? error.message : String(error);
      harmonyIssue = `검수를 하지 못했어요 — ${friendlyExecutionError(message)}`;
      surface.appendProcess?.(message);
      surface.appendBubble("system", publication.count ? "변경 내용을 끝까지 검수하지 못했어요. 이미 반영한 변경은 남아 있으며 되돌릴 수 있어요." : "변경 내용을 끝까지 확인하지 못했어요. 아직 적용하지 않았으니 직접 확인하고 적용해 주세요.");
      push({ type: "agent_spawn", agentId: "ultrabrain", role: "reviewer", mapId: null, mapName: null, task: "전체 맵 조화 검수", label: "Ultrabrain" });
      // 검수를 «하지 못한 것» 은 «지적»이 아니다. 예전에는 findings=[오류문구] 로 발행되어
      // 보드에 「지적 1건」 이 생겼다 — 프로바이더 빈응답이 작품 결함처럼 보였다.
      push({ type: "agent_event", agentId: "ultrabrain", event: { type: "error", message: `검수 불가 — ${message}` } });
    }
  }
  // 시공이 실패한 런의 부분 결과는 자동 적용하지 않는다 — 사람이 반드시 본다.
  //
  // 2026-09-17 실측: 「맵 전부 지워줘」에서 시공이 「실패 · 17턴 · 중단」으로 끝났는데 검수는
  // 「검수 통과」를 찍었고, 그 부분 결과가 그대로 적용돼 맵 12개가 사라졌다. 「tile_paint 로 길을
  // 그려줘」·「여기 좀 허전한데」도 실패한 채로 타일 220·181칸을 적용 후보로 내놨다.
  // 검수는 결과물만 보므로 시공의 실패를 알지 못한다 — 실패 사실은 여기서만 합칠 수 있다.
  const villageCompletion = options.villageContract
    ? { mapIds: [...villageMapIds], issues: results.flatMap(result => result.villageCompletion?.issues ?? ["마을 계약 검사 결과가 없습니다."]) }
    : inspectPiVillageCompletion(merged.project, base, villageMapIds);
  villageIncomplete = villageCompletion.issues.length > 0;
  villageVerified = !!options.villageContract && !villageIncomplete;
  if (villageIncomplete) surface.appendProcess?.(`마을 완료 검사 미통과\n${villageCompletion.issues.join("\n")}`);
  const builderFailed = stoppedByLimit || villageIncomplete;
  if (builderFailed) {
    surface.appendBubble(
      "system",
      publication.count ? "작업을 끝까지 마치지 못했어요. 이미 반영한 부분 결과가 남아 있으니 확인하거나 되돌려 주세요." : "작업을 끝까지 마치지 못했어요. 아래 변경은 **완성되지 않은 결과**예요. 직접 확인하고 적용해 주세요.",
    );
  }
  harmonyManualReview = (needsHarmonyReview && !harmonyApproved) || builderFailed;
  if (applyMode === "auto" && harmonyManualReview && publication.count > 0) {
    // AUTO reports unresolved work; it never turns into a manual approval mode.
    merged = { ...merged, project: publication.project };
    changed = summarizeChanges(base, merged.project);
    changedKeys = changedProjectKeys(base, merged.project);
    changedCount = changedKeys.length;
    unpublishedChanges = changedProjectKeys(publication.project, merged.project).length > 0;
    receiptChips = changeChipsWithAreas(changed, changedAreaLabels(base, merged.project));
  }
  // 명세는 한 번만 계산해 검토 카드와 영수증이 **같은 것**을 쓴다 — 두 번 만들면 두 화면이 갈라진다.
  const receiptLedger = buildChangeLedger(base, merged.project);
  const apply = async (): Promise<boolean> => {
    surface.signal?.throwIfAborted();
    // 맵·이벤트가 사라지는 적용만 사람이 한 번 더 본다. 근거는 툴 이름이 아니라 base ↔ 제안의
    // 실제 차이다. 검토 카드가 아니라 apply() 안에 두는 이유: 자동 적용(piApply="auto")에는 카드
    // 자체가 없어서, 카드에만 붙이면 그 경로가 그대로 뚫린다(2026-09-17 실측: 「맵 전부 지워줘」
    // 한 줄에 맵 16→4, 이벤트 20→0, 확인 한 번 없이 「적용 완료」).
    const loss = mapLossConfirmRequest(publication.project, merged.project);
    if (loss && applyMode !== "yolo" && applyMode !== "auto") {
      const approved = await showConfirm({
        title: loss.title,
        message: loss.message,
        confirmLabel: loss.confirmLabel,
        cancelLabel: "그만두기",
        danger: true,
      });
      if (!approved) {
        // 취소는 되돌리기가 아니라 무변경이다. 초안도 함께 걷는다 — 「지우지 말라」는 답은
        // 결과를 남겨 둘 이유가 아니다(discardReviewed 와 같은 정리를 한다).
        ghost.dispose();
        changedCount = 0;
        publishFinalOutcome();
        boardState = markTeamBoardDiscarded(boardState); sync();
        finishLog({ applied: false, changedCount: 0, stoppedReason: "삭제 취소" });
        surface.setStatus("대기");
        surface.appendBubble("system", loss.cancelNotice);
        return false;
      }
    }
    surface.signal?.throwIfAborted();
    // 초안이 진짜 타일이 되는 순간 밑그림은 지운다 — 같은 그림이 두 겹으로 남지 않게
    // (세션 경로의 aiProposalCard.applyProposal 과 같은 관례).
    ghost.dispose();
    const alreadyPublished = publication.count > 0 && changedProjectKeys(publication.project, merged.project).length === 0;
    const appliedResult = alreadyPublished ? { ok: true as const } : await applyProposedProject(merged.project, {
    base: publication.count ? publication.authority : proposalBase,
    baseline: publication.count ? publication.baseline : baseline,
    source: "agent",
    agentName: `pi${team ? "-team" : ""}:${provider}/${config.model}`,
    summary: `Pi ${team ? "팀" : "에이전트"}: ${command.task.slice(0, 80)}`,
    toolNames: [team ? "pi_team" : "pi_agent"],
    diff: changed,
    mapDestructionApproved: loss !== null || applyMode === "yolo" || applyMode === "auto",
    skipSnapshot: applyMode !== "step" && publication.count > 0,
    snapshotLabel: `Pi ${team ? "팀" : "에이전트"} ${scopeText}`,
    snapshotMapId: command.mapIds[0] ?? surface.getCurrentMapId(),
    reason: `Pi ${team ? "팀" : `에이전트 ${groups.length}개`}, 툴콜 ${toolCalls}회`,
  });
    if (!appliedResult.ok) {
      const reason = `적용 실패(${appliedResult.reason}): ${appliedResult.issue ?? "무결성 오류"}`;
      publishFinalOutcome();
      boardState = markTeamBoardFailed(boardState, reason); sync();
      finishLog({ applied: false, changedCount, error: reason });
      surface.setStatus("적용 실패");
      surface.appendProcess?.(reason);
      surface.appendBubble("system", "변경 내용을 적용하지 못했어요. 현재 맵과 작업 과정을 확인해 주세요.");
      return false;
    }
    applied = true;
    publishFinalOutcome();
    const spillNotice = spilledKeys.length > 0 ? `, 범위 밖 ${spilledKeys.length}건 버림(${spilledKeys.map((key) => `\`${key}\``).join(", ")})` : "";
    const appliedText = team
      ? `적용했습니다 — 팀, 툴콜 ${toolCalls}회, 바뀐 맵·항목 ${changedCount}개${spillNotice}${errorDigest()}.`
      : `변경 내용을 적용했습니다${spillNotice}${errorDigest()}.`;
    boardState = markTeamBoardApplied(boardState, appliedText); sync();
    observeActivitySave((name, summary, status, data) => {
      if (boardState.trace) boardState = { ...boardState, trace: activityNote(boardState.trace, name, summary, status, data) };
      board.update(boardState);
      // Do not replace a newer run in the live team rail.
      if (currentTeamActivity()?.trace?.id === boardState.trace?.id) publishTeamActivity(boardState);
    });
    finishLog({ applied: true, changedCount, stoppedReason: "적용됨" });
    surface.setStatus((villageIncomplete || (harmonyManualReview && applyMode !== "yolo")) ? "반영됨 · 확인할 문제 있음" : "적용 완료");
    if (team || !surface.showChangeReceipt || !receiptMapId) surface.appendBubble("system", `변경 내용을 적용했어요.${spilledKeys.length ? " 선택한 범위를 벗어난 변경은 제외했어요." : ""}${streamErrors.length ? " 작업 중 일부 문제가 있었어요. 작업 과정을 확인해 주세요." : ""}`);
    surface.showChangeReceipt?.({
      before: base,
      after: merged.project,
      mapId: receiptMapId,
      title: receiptTitle,
      detail: `${(villageIncomplete || (harmonyManualReview && applyMode !== "yolo")) ? "변경은 반영됐지만 검수 문제 또는 미완료 항목이 남아 있어요." : "변경 내용을 적용했어요."}${applyMode === "step" ? " 되돌리기는 마지막으로 적용한 단계부터 복구합니다." : ""}${spilledKeys.length ? " 선택한 범위를 벗어난 변경은 제외했어요." : ""}${streamErrors.length ? " 작업 중 일부 문제가 있었어요. 작업 과정을 확인해 주세요." : ""}`,
      chips: receiptChips,
      ledger: receiptLedger,
      toolNames: [team ? "pi_team" : "pi_agent"],
    });
    return true;
  };
  // 정책에 따라 자동 반영하거나 미적용 초안을 검토 카드에 남긴다.
  // 기준(base)이 그 사이 바뀌면 applyProposedProject 가 stale-base 로 거절한다.
  if ((!(options.villageContract ? builderFailed : villageIncomplete) && applyMode === "yolo") || (isLiveApplyMode(applyMode) && !harmonyManualReview)
    || (applyMode === "step" && publication.count > 0 && changedProjectKeys(publication.project, merged.project).length === 0)) return apply();
  if (applyMode === "auto" && harmonyManualReview && publication.count === 0) {
    ghost.dispose();
    surface.appendBubble("system", "AI가 문제를 해결하지 못해 결과 적용을 보류했어요. 요청을 보완해 다시 실행해 주세요.");
    publishFinalOutcome();
    boardState = markTeamBoardFailed(boardState, "검수 문제 미해결 · 적용 보류"); sync();
    finishLog({ applied: false, changedCount, error: "검수 문제 미해결" });
    surface.setStatus("적용 보류");
    return false;
  }
  if (publication.count > 0 && changedProjectKeys(publication.project, merged.project).length === 0) {
    // Live work is already real; do not present an imaginary pending draft.
    // 이미 반영된 작업이다 — 모달로 막아 봐야 되돌릴 수 있다는 사실 말고는 할 말이 없다(2026-09-23 실측:
    // 「검수 문제 또는 미완료 항목이 있어요」 모달이 무엇이 문제인지 한 줄도 말하지 않았다).
    // 대신 남은 문제를 이름으로 적는다.
    const issues = [
      ...villageCompletion.issues,
      ...(stoppedByLimit && streamErrors[0] ? [streamErrors[0]] : []),
      ...(harmonyIssue ? [harmonyIssue] : []),
      ...unreachableWorkIssues(base, merged.project),
      ...unresolvedFindings,
    ];
    // 첫 줄은 «무엇을 만들었나» 다(2026-09-23 실측: 「반영했지만 확인할 것이 남았어요」 + 검토 문장
    // 여러 줄이 맵 14개를 만든 실행을 실패처럼 보이게 했다). 지적은 버리지 않고 접은 칸으로 옮긴다.
    // 이름 붙은 지적이 하나도 없으면 «끝까지 확인하지 못했다» 는 사실을 머리말에 그대로 남긴다.
    // 「만들었어요」 는 적용이 끝난 뒤에만 말한다 — 삭제 확인을 거절하거나 적용이 실패하면 apply() 가 따로 말한다.
    const appliedOk = await apply();
    if (!appliedOk) return false;
    const stoppedEarly = results.find((done) => done.stoppedEarly)?.stoppedEarly;
    const bubble = surface.appendBubble("system", completionHeadline(plainMadeSummary(base, merged.project), { unverified: issues.length === 0, ...(stoppedEarly ? { stoppedEarly } : {}) }));
    if (issues.length) {
      if (bubble && typeof (bubble as HTMLElement).append === "function") (bubble as HTMLElement).append(createRefineFindings(issues));
      else surface.appendBubble("system", refineFindingsText(issues));
    }
    return true;
  }
  surface.setStatus("변경 확인 대기");
  // 밀린 증분을 마저 그린다. 밑그림은 여기서 지우지 않는다 — 사용자가 「적용/버리기」를 고르는
  // 동안 캔버스에 남아 있는 그 그림이 곧 판단 재료다. 정리는 두 버튼이 맡는다.
  ghost.reconcile(merged.project);
  // 적용 전에도 «무엇이 바뀔 것인가» 를 보여준다 — 여기가 사용자가 결정하는 자리다.
  // 같은 카드·같은 렌더러를 쓰고 배지만 「적용 전」 이다(두 번째 어휘를 만들지 않는다).
  // 보고서 모드 재료 — 지점 목록(여러 곳을 곤치면 사진도 여러 쌍) + 팀 보고 문장 + 검수 지적.
  const reviewBase = publication.count ? publication.project : base;
  const reviewSites = computeChangeSites(reviewBase, merged.project);
  const reviewFindings = boardState.agents.flatMap((agent) => agent.review && !agent.review.ok ? agent.review.findings : []);
  const reviewInput: ChangePreviewInput | null = receiptMapId === null ? null : {
    before: reviewBase,
    after: merged.project,
    mapId: receiptMapId,
    title: receiptTitle,
    sites: reviewSites,
    ...(boardState.report ? { report: boardState.report } : {}),
    ...(reviewFindings.length > 0 ? { findings: reviewFindings } : {}),
    detail: publication.count ? "일부는 이미 반영했어요. 여기에는 아직 적용하지 않은 나머지 변경을 표시합니다." : "아직 적용하지 않았어요. 변경 내용을 확인하고 적용해 주세요.",
    chips: receiptChips,
    ledger: receiptLedger,
    state: "proposed",
  };
  const reviewPreview = reviewInput ? renderChangePreviewCard(reviewInput) : null;
  // 로그 카드의 적용/버리기와 작업 탭 검토 스트립이 **같은 클로저**를 부른다 — 두 경로, 한 동작.
  let applying = false;
  let settled = false;
  const clearReview = (): void => { settled = true; prompt.root.remove(); board.setReview(null); setTeamReviewActions(null); surface.onReviewResolved?.(applied); };
  const applyReviewed = (): void => {
    if (applying || settled) return;
    applying = true;
    prompt.setBusy(true);
    void (async () => {
      try {
        const success = await apply();
        if (success || changedCount === 0) clearReview();
      } catch {
        surface.appendBubble("system", "변경 내용을 적용하지 못했어요. 다시 적용하거나 변경안을 버려 주세요.");
      } finally {
        applying = false;
        if (!settled) prompt.setBusy(false);
      }
    })();
  };
  const discardReviewed = (): void => {
    if (applying || settled) return;
    clearReview();
    ghost.dispose();
    changedCount = 0;
    publishFinalOutcome();
    boardState = markTeamBoardDiscarded(boardState); sync();
    finishLog({ applied: false, changedCount, stoppedReason: "버림" });
    surface.setStatus("대기");
    surface.appendBubble("system", "변경안을 버렸어요. 프로젝트는 그대로예요.");
  };
  const prompt = createPendingReviewPrompt({
    apply: applyReviewed, discard: discardReviewed,
    ...(reviewInput ? { report: () => { openWideChangeViewer(reviewInput); } } : {}),
  });
  (surface.appendReviewPrompt ?? surface.appendCard)(prompt.root);
  board.setReview({
    ...(reviewPreview ? { preview: reviewPreview } : {}),
    onApply: applyReviewed,
    onDiscard: discardReviewed,
  });
  setTeamReviewActions({
    apply: applyReviewed,
    discard: discardReviewed,
    ...(reviewInput ? { openReport: () => { openWideChangeViewer(reviewInput); } } : {}),
  });
  // 「검토 대기」 게시는 버스 액션 등록 **뒤**다 — 작업 탭 스트립은 버스 게시 때만 다시 그리므로, 먼저 게시하면 버튼이 비활성으로 굳는다.
  boardState = markTeamBoardReview(boardState, receiptChips); sync();
  publishFinalOutcome();
  finishLog({ applied: false, changedCount, stoppedReason: "검토 대기" });
  return true;
}

