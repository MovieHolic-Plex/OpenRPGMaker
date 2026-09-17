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

import { reviewMapHarmony } from "@/ai/ultrabrainReview";
import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { deriveRunOutcome } from "@/ai/runOutcome";
import type { RunOutcome, RunOutcomeFacts } from "@/ai/runOutcome";
import { startPiRunLog, type PiRunContext, type PiRunFacts } from "@/ai/piAgent/activityLog";
import type { AuditEntry } from "@/ai/session/types";
import { mergeMapBundles } from "@/ai/piAgent/mapBundle";
import { changedProjectKeys, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentMode, type PiAgentThinkingLevel } from "@/ai/piAgent/protocol";
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
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { mapLossConfirmRequest } from "@/ai/mapDestructionConfirm";
import { showConfirm } from "@/editor/ui/modal";
import { adoptSpatialToolProof, authorMergedSpatialProposal } from "@/editor/tools/spatialToolState";
import { summarizeChanges } from "@/editor/tools/changeset";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { changedAreaLabels } from "@/project/changeAreas";
import { computeChangeSites } from "@/project/changeSites";
import { buildChangeLedger, type ChangeLedger } from "@/project/changeLedger";
import { createTeamBoard } from "./aiTeamBoard";
import { publishTeamActivity, setTeamReviewActions } from "@/ai/piAgent/teamActivity";
import { loadTeamSpec } from "@/ai/piAgent/teamSpecStore";

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

/**
 * 계획 턴의 지시문 머리. Pi 에는 세션 플래너가 없으므로 «실행하지 말고 계획만» 을 말로 만든다 —
 * 강제는 툴 목록이 한다(request.readOnly). 계획은 도구 결과가 아니라 말로 남으므로 항목 목록을 요구한다.
 */
const PLAN_ONLY_PREFIX = "[계획 턴] 이번 실행에서는 프로젝트를 바꾸지 않는다. 쓰기 도구가 제공되지 않는다. "
  + "요청을 실행 순서가 있는 항목 목록으로만 보고하라. 각 항목은 «무엇을 · 어디에 · 왜» 를 담고, 마지막에 예상 위험을 한 줄로 적어라. ";

/** 이 실행 하나가 해도 되는 것. 패널이 자율성 다이얼에서 풀어 넘긴다(`resolvePiRunPlan`). */
export interface PiRunOptions {
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
   * 의도 선언이 연 툴 도메인 — 초기 노출을 core+이 도메인들로 좁힌다(빠진 툴은 find_tools·
   * 폴백 에스컬레이션이 실행 중 얹는다). 비우면 레지스트리 전량 노출.
   */
  readonly toolDomains?: readonly string[];
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
  readonly appendCard: (element: HTMLElement) => void;
  readonly setStatus: (text: string) => void;
  readonly getCurrentMapId: () => string | null;
  /** 패널의 중단 버튼. 끊기면 진행 중인 요청을 모두 취소하고 아무것도 적용하지 않는다. */
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
  const proposalBase = captureProposalBase(base);
  const baseline = new AuthoredProjectBaseline(base);
  const config = loadAiConfig();
  const brain = configForUltrabrain(config);
  const deep = modelForRole(config, "deep");
  const effective = options.planOnly || (command.mode === "team" && !options.readOnly)
    ? { provider: brain.providerId!, model: brain.model } : deep;
  const provider = effective.provider;
  const readOnly = options.readOnly === true || options.planOnly === true;
  // 조회 턴에 팀을 켜면 시공 팀원이 아무것도 못 하는 채로 예산만 태운다 — 읽기 전용은 언제나 단독이다.
  const team = command.mode === "team" && !readOnly;
  const routineEdit = options.routineEdit === true && !readOnly && !team
    && command.mapIds.length === 1 && Boolean(base.maps[command.mapIds[0]!]);
  const groups = team || options.planOnly ? [command.mapIds] : command.mapIds.length > 0 ? command.mapIds.map((id) => [id]) : [[] as string[]];
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
  /** 사실 팩 하나를 4축으로 투영한다 — 목표 축은 수용 검사의 소유라 여기선 늘 unassessed. */
  const publishOutcome = (facts: Omit<RunOutcomeFacts, "acceptance" | "visualDelivery">): void => {
    surface.setRunOutcome?.(deriveRunOutcome({ ...facts, acceptance: null }));
  };
  /** 종료 시점의 4축 하나를 게시한다. 종료 경로가 여러 개라서 하나로 모은다. */
  const publishFinalOutcome = (): void => {
    if (!surface.setRunOutcome) return;
    const hasPendingDraft = changedCount > 0 && ((config.piApply ?? "review") !== "auto" || harmonyManualReview);
    publishOutcome({
      execution: surface.signal?.aborted ? "cancelled"
        : streamErrors.length > 0 && changedCount === 0 ? "blocked" : "response-final",
      hasPendingDraft,
      hasApplied: applied,
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

  let boardState: TeamBoardState = createTeamBoardState(command.mode, command.task);
  const board = createTeamBoard(boardState);
  setTeamReviewActions(null);
  surface.appendCard(board.root);
  const sync = (): void => { board.update(boardState); publishTeamActivity(boardState); };
  const push = (event: PiAgentEvent): void => {
    boardState = reduceTeamBoard(boardState, event);
    sync();
  };
  sync();
  const teamSpec = team ? loadTeamSpec() : undefined;
  const scopeText = team
    ? (command.mapIds.length > 0 ? `후보 맵 ${command.mapIds.join(", ")}` : "프로젝트 전체")
    : groups.map((g) => g.join(",") || "전체").join(" · ");
  surface.setStatus(team ? "Pi 팀 실행 중…" : "작업 중…");

  // 단일·병렬 모드의 평평한 이벤트는 그룹 단위 행으로 감싸 보드에 넣는다. 팀 모드는 런타임이 이미 감싸서 보낸다.
  // 질문(읽기 전용)·계획 턴의 결과는 «바뀐 것» 이 아니라 **말**이다. 보드는 마지막 한 줄만 남기므로
  // 답이 될 문장을 따로 붙잡아 둔다 — 이게 없으면 질문 모드가 220자로 잘린 한 줄이 된다.
  let lastAssistantText = "";
  // 캔버스 시공 표시(밑그림). 워커의 `map_delta` 를 초안으로 복원해 고스트를 그린다 — 이게 없으면
  // 결과 프로젝트가 맨 끝 `done` 에만 실려서 턴 내내 캔버스가 조용하다(2026-09-17 회귀).
  // 단일·병렬·팀이 다리 **하나**를 공유한다: 에이전트마다 소유한 맵이 다르므로 증분은 그대로 겹친다.
  const ghost = createPiGhostBridge({ baseProject: base });
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
    return `${dial}(${hit[1]}턴)에 도달해 중단했습니다 — 한 일은 남기지 않았습니다. 자율성 다이얼을 올려 다시 보내세요.`;
  };
  const wrap = (mapIds: readonly string[], index: number) => (raw: PiAgentEvent): void => {
    // heartbeat 는 연결 생존 신호다 — 클라이언트 워치독이 이미 소뱄했고, 보드에는 그릴 것이 없다.
    if (raw.type === "heartbeat") return;
    // 오류 문구는 갈라지기 **전에** 한 번만 고친다(explainTurnCap 주석 참고).
    const event: PiAgentEvent = raw.type === "error" ? { ...raw, message: explainTurnCap(raw.message) } : raw;
    ghost.handleEvent(event);
    if (event.type === "assistant") lastAssistantText = event.text;
    // 팀 모드의 오류도 실행 요약에 실린다. 예전에는 여기서 곧장 return 해 streamErrors 가 늘 비었고,
    // 팀 런은 오류를 한 건도 안 낸 것처럼 기록됐다.
    if (event.type === "error" && streamErrors.length < 3) streamErrors.push(event.message);
    if (team) { push(event); return; }
    const agentId = mapIds.join(",") || `agent-${index + 1}`;
    if (event.type === "start") {
      push({ type: "agent_spawn", agentId, role: "builder", mapId: mapIds[0] ?? null, mapName: mapIds[0] ? base.maps[mapIds[0]]?.name ?? null : null, task: command.task });
    }
    if (event.type === "error") { push({ type: "agent_event", agentId, event }); push(event); return; }
    if (event.type === "done") { push({ type: "agent_event", agentId, event }); return; }
    push({ type: "agent_event", agentId, event });
    if (event.type === "turn") surface.setStatus(groups.length > 1 ? `작업 중… (${index + 1}/${groups.length})` : "작업 중…");
  };

  let results: PiAgentDoneEvent[];
  try {
    // 모델이 읽는 지시문 = 사용자 문장 + 의도 노트. 계획 턴도 같은 것을 읽어야 계획에 author_village 같은
    // 이름이 남고, 실행 턴이 그 이름을 따라간다(노트 없이는 산문 계획 → paint_road 손작업으로 흘렀다).
    const modelTask = composePiTask(command.task, options.intentNote);
    let executionTask = modelTask;
    if (!readOnly && !team && !routineEdit) {
      surface.setStatus(`Ultrabrain · 계획 작성 (${brain.model})`);
      let plan = "";
      let planError = "";
      push({ type: "agent_spawn", agentId: "ultrabrain-plan", role: "orchestrator", mapId: null, mapName: null, task: command.task, label: "Ultrabrain · 계획" });
      const planned = await runPiAgentViaCompanion({
        mode: "single", provider: brain.providerId!, model: brain.model,
        task: `${PLAN_ONLY_PREFIX}${modelTask}`, mapIds: command.mapIds, ...here, project: base,
        scopeStrict: command.scopedByUser === true,
        readOnly: true, maxTurns: options.maxTurns, thinkingLevel: brain.reasoningEffort,
      }, { signal: surface.signal, onEvent: raw => {
        if (raw.type === "heartbeat") return;
        const event: PiAgentEvent = raw.type === "error" ? { ...raw, message: explainTurnCap(raw.message) } : raw;
        ghost.handleEvent(event);
        push({ type: "agent_event", agentId: "ultrabrain-plan", event });
        if (event.type === "assistant") plan = event.text;
        if (event.type === "error") planError = event.message;
      } });
      surface.signal?.throwIfAborted();
      if (planError || !plan.trim() || planned.changedKeys.length) throw new Error(planError || "Ultrabrain 계획을 완료하지 못했습니다.");
      push({ type: "agent_done", agentId: "ultrabrain-plan", ok: true, summary: plan,
        stats: planned.stats, changedKeys: [], spills: [], conflicts: [] });
      surface.appendBubble("assistant", `Ultrabrain 계획\n${plan}`);
      executionTask = `${modelTask}\n\nUltrabrain 실행 계획:\n${plan}`;
    }
    results = await Promise.all(groups.map((mapIds, index) => runPiAgentViaCompanion(
      {
        mode: team ? "team" : "single",
        provider: options.planOnly || team ? brain.providerId! : deep.provider,
        model: options.planOnly || team ? brain.model : deep.model,
        ...(!options.planOnly ? { roleModels: { deep, writer: modelForRole(config, "writer") } } : {}),
        task: options.planOnly ? `${PLAN_ONLY_PREFIX}${modelTask}` : executionTask,
        mapIds,
        ...here,
        project: base,
        // 평문 턴의 기본 대상 맵은 계약이 아니다 — 계약으로 읽히면 모델이 DB·시스템을 손대지 않는다.
        scopeStrict: command.scopedByUser === true,
        ...(readOnly ? { readOnly: true } : {}),
        ...(options.maxTurns === undefined ? {} : { maxTurns: options.maxTurns }),
        thinkingLevel: options.planOnly || team ? brain.reasoningEffort : deep.thinkingLevel,
        ...(options.toolDomains && options.toolDomains.length > 0 ? { toolDomains: options.toolDomains } : {}),
        ...(teamSpec ? { team: teamSpec } : {}),
      },
      { signal: surface.signal, onEvent: wrap(mapIds, index) },
    )));
  } catch (error) {
    if (surface.signal?.aborted) {
      // fetch 는 abort 에서 AbortError 를 던진다 — 실패가 아니라 중단이므로 중단 경로로 돌린다(실측 2026-09-11).
      ghost.dispose();
      publishFinalOutcome();
      boardState = markTeamBoardAborted(boardState); sync();
      finishLog({ applied: false, changedCount: 0, stoppedReason: "중단" });
      surface.setStatus("대기");
      surface.appendBubble("system", "Pi 에이전트를 중단했습니다. 적용된 변경은 없습니다.");
      return false;
    }
    const message = error instanceof Error ? error.message : String(error);
    streamErrors.push(message);
    ghost.dispose();
    publishFinalOutcome();
    boardState = markTeamBoardFailed(boardState, message); sync();
    finishLog({ applied: false, changedCount: 0, error: message });
    surface.setStatus("Pi 에이전트 실패");
    surface.appendBubble("system", `Pi 에이전트 실패: ${message}`);
    return false;
  }
  if (surface.signal?.aborted) {
    ghost.dispose();
    publishFinalOutcome();
    boardState = markTeamBoardAborted(boardState); sync();
    finishLog({ applied: false, changedCount: 0, stoppedReason: "중단" });
    surface.setStatus("대기");
    surface.appendBubble("system", "Pi 에이전트를 중단했습니다. 적용된 변경은 없습니다.");
    return false;
  }
  // 팀 모드는 런타임이 이미 맵 묶음으로 병합해 돌려준다. 단일 범위 지정은 여기서 병합한다.
  //
  // 「범위 지정」은 사용자가 `/pi 맵id …` 로 직접 적었을 때뿐이다. 평문 턴도 현재 맵을 mapIds 에
  // 채우기 때문에 예전 조건(`command.mapIds.length > 0`)은 **모든 평문 턴**을 맵 묶음으로 잘랐고,
  // 그 밖(데이터베이스·시스템·퀘스트)의 변경을 전부 버렸다 — 사용자가 시킨 그 일을(2026-09-17 실측).
  // 에이전트가 둘 이상이면 결과가 여럿이라 병합이 여전히 유일한 합치는 길이다.
  const mergedFromBundles = !team && command.mapIds.length > 0
    && (command.scopedByUser === true || groups.length > 1);
  const merged = mergedFromBundles
    ? mergeMapBundles(base, results.map((done, index) => ({ mapIds: groups[index]!, project: done.project })))
    : { project: results[0]!.project, spills: [], conflicts: [] as string[] };
  // 수용 게이트는 «도구가 만든 제안»이라는 증거를 요구하는데, 그 프루프는 객체 정체성에 살아
  // 동반 서비스(워커)에서 건너오지 못한다. 묶음을 여기서 병합했으면 살아있는 문서 위에 얹었다는
  // 증거를 다시 찍고, 워커 결과를 그대로 적용하는 경우(팀·전체 범위)는 워커가 실어 보낸
  // 다이제스트를 되붙인다 — 없으면 게이트가 정당하게 거절한다.
  if (mergedFromBundles) authorMergedSpatialProposal(merged.project, base);
  else adoptSpatialToolProof(merged.project, results[0]!.spatialProof, base);
  if (merged.conflicts.length > 0) {
    surface.appendBubble("system", `에이전트 둘 이상이 같은 맵을 바꿨습니다(뒤의 결과 채택): ${merged.conflicts.map((id) => `\`${id}\``).join(", ")}`);
  }
  spilledKeys.push(...merged.spills.flatMap((spill) => spill.keys));
  for (const spill of merged.spills) {
    surface.appendBubble("system", `범위 밖 변경을 버렸습니다 \`${spill.mapIds.join(",")}\`: ${spill.keys.map((key) => `\`${key}\``).join(", ")}`);
  }
  const changed = summarizeChanges(base, merged.project);
  const toolCalls = results.reduce((sum, done) => sum + done.stats.toolCalls, 0);
  toolErrorCount += results.reduce((sum, done) => sum + done.stats.toolErrors, 0);
  const changedKeys = changedProjectKeys(base, merged.project);
  changedCount = changedKeys.length;
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
          : "Pi 에이전트가 끝났지만 프로젝트에 바뀐 것이 없습니다.";
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
    if (answer) surface.appendBubble("assistant", answer);
    surface.appendBubble("system", caption);
    return true;
  }
  // 영수증이 그릴 맵: 먼저 바뀐 맵, 없으면 지시 범위의 첫 맵, 그것도 없으면 프로젝트의 첫 맵.
  // 마지막 후보가 없으면 맵 없는 프로젝트에서 영수증이 통째로 사라진다(그림은 못 그려도 이름은 남아야 한다).
  const receiptMapId = changedKeys.find((key) => key.startsWith("maps."))?.slice("maps.".length)
    ?? command.mapIds[0] ?? surface.getCurrentMapId() ?? Object.keys(merged.project.maps)[0] ?? null;
  const receiptTitle = team ? `Pi 팀 — ${scopeText}` : "변경 내용";
  // 카운터가 없는 영역(퀘스트·스토리 플래그·캐릭터·맵 연결…)까지 한 줄에 — 검토 카드와 영수증이
  // 같은 칩을 쓴다. 이게 없으면 그런 턴은 "적용/버리기" 만 있는 빈 카드로 끝났다.
  const receiptChips = changeChipsWithAreas(changed, changedAreaLabels(base, merged.project));
  // Review the merged postprocessed draft once; preserve whole-map context.
  // Negative/unavailable review keeps the existing manual proposal path, never auto-applies.
  // 예상보다 범위가 커졌으면 검토를 복원한다. 생략을 "검수 통과"로 기록하지 않는다.
  const needsHarmonyReview = !routineEdit || changedKeys.some(key => key !== `maps.${command.mapIds[0]}`);
  let harmonyApproved = false;
  if (needsHarmonyReview) {
    try {
      const reviews = await reviewMapHarmony(base, merged.project, command.task, config, {
        signal: surface.signal,
        onStatus: text => surface.setStatus(text),
        onReview: review => {
          push({ type: "agent_spawn", agentId: `ultrabrain-${review.mapId}`, role: "reviewer", mapId: review.mapId,
            mapName: merged.project.maps[review.mapId]?.name ?? null, task: "전체 맵 조화 검수", label: "Ultrabrain" });
          surface.appendBubble("assistant", `Ultrabrain · ${merged.project.maps[review.mapId]?.name ?? review.mapId}\n${review.summary}${review.findings.length ? "\n" + review.findings.map(f => `• ${f}`).join("\n") : ""}`);
          push({ type: "review", agentId: `ultrabrain-${review.mapId}`, mapId: review.mapId, ok: review.harmonious, findings: [...review.findings] });
        },
      });
      harmonyApproved = reviews.every(review => review.harmonious);
    } catch (error) {
      if (surface.signal?.aborted) {
        ghost.dispose();
        publishFinalOutcome();
        boardState = markTeamBoardAborted(boardState); sync();
        finishLog({ applied: false, changedCount, stoppedReason: "중단" });
        surface.setStatus("대기");
        return false;
      }
      const message = error instanceof Error ? error.message : String(error);
      surface.appendBubble("system", `Ultrabrain 조화 검수를 완료하지 못했습니다: ${message} — 검수 지적으로 세지 않고, 적용 전 확인용 초안을 남겼습니다.`);
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
  const builderFailed = stoppedByLimit;
  if (builderFailed) {
    surface.appendBubble(
      "system",
      "시공이 끝까지 가지 못했습니다 — 아래 변경은 **중단된 작업의 일부**입니다. 검수 결과와 무관하게 확인하고 적용하세요.",
    );
  }
  harmonyManualReview = (needsHarmonyReview && !harmonyApproved) || builderFailed;
  // 명세는 한 번만 계산해 검토 카드와 영수증이 **같은 것**을 쓴다 — 두 번 만들면 두 화면이 갈라진다.
  const receiptLedger = buildChangeLedger(base, merged.project);
  const apply = async (): Promise<boolean> => {
    // 맵·이벤트가 사라지는 적용만 사람이 한 번 더 본다. 근거는 툴 이름이 아니라 base ↔ 제안의
    // 실제 차이다. 검토 카드가 아니라 apply() 안에 두는 이유: 자동 적용(piApply="auto")에는 카드
    // 자체가 없어서, 카드에만 붙이면 그 경로가 그대로 뚫린다(2026-09-17 실측: 「맵 전부 지워줘」
    // 한 줄에 맵 16→4, 이벤트 20→0, 확인 한 번 없이 「적용 완료」).
    const loss = mapLossConfirmRequest(base, merged.project);
    if (loss) {
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
    // 초안이 진짜 타일이 되는 순간 밑그림은 지운다 — 같은 그림이 두 겹으로 남지 않게
    // (세션 경로의 aiProposalCard.applyProposal 과 같은 관례).
    ghost.dispose();
    const appliedResult = await applyProposedProject(merged.project, {
    base: proposalBase,
    baseline,
    source: "agent",
    agentName: `pi${team ? "-team" : ""}:${provider}/${config.model}`,
    summary: `Pi ${team ? "팀" : "에이전트"}: ${command.task.slice(0, 80)}`,
    toolNames: [team ? "pi_team" : "pi_agent"],
    diff: changed,
    mapDestructionApproved: loss !== null,
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
      surface.appendBubble("system", reason);
      return false;
    }
    applied = true;
    publishFinalOutcome();
    const spillNotice = spilledKeys.length > 0 ? `, 범위 밖 ${spilledKeys.length}건 버림(${spilledKeys.map((key) => `\`${key}\``).join(", ")})` : "";
    const appliedText = team
      ? `적용했습니다 — 팀, 툴콜 ${toolCalls}회, 바뀐 맵·항목 ${changedCount}개${spillNotice}${errorDigest()}.`
      : `변경 내용을 적용했습니다${spillNotice}${errorDigest()}.`;
    boardState = markTeamBoardApplied(boardState, appliedText); sync();
    finishLog({ applied: true, changedCount, stoppedReason: "적용됨" });
    surface.setStatus(team ? "Pi 팀 적용 완료" : "적용 완료");
    if (team || !surface.showChangeReceipt || !receiptMapId) surface.appendBubble("system", appliedText);
    surface.showChangeReceipt?.({
      before: base,
      after: merged.project,
      mapId: receiptMapId,
      title: receiptTitle,
      detail: appliedText,
      chips: receiptChips,
      ledger: receiptLedger,
      toolNames: [team ? "pi_team" : "pi_agent"],
    });
    return true;
  };
  // 기본은 검토 후 적용: 보드 발의 검토 카드에서 사용자가 승인해야 프로젝트가 바뀐다.
  // 기준(base)이 그 사이 바뀌면 applyProposedProject 가 stale-base 로 거절한다.
  if ((config.piApply ?? "review") === "auto" && !harmonyManualReview) return apply();
  surface.setStatus("변경 확인 대기");
  // 밀린 증분을 마저 그린다. 밑그림은 여기서 지우지 않는다 — 사용자가 「적용/버리기」를 고르는
  // 동안 캔버스에 남아 있는 그 그림이 곧 판단 재료다. 정리는 두 버튼이 맡는다.
  ghost.flush();
  // 적용 전에도 «무엇이 바뀔 것인가» 를 보여준다 — 여기가 사용자가 결정하는 자리다.
  // 같은 카드·같은 렌더러를 쓰고 배지만 「적용 전」 이다(두 번째 어휘를 만들지 않는다).
  // 보고서 모드 재료 — 지점 목록(여러 곳을 곤치면 사진도 여러 쌍) + 팀 보고 문장 + 검수 지적.
  const reviewSites = computeChangeSites(base, merged.project);
  const reviewFindings = boardState.agents.flatMap((agent) => agent.review && !agent.review.ok ? agent.review.findings : []);
  const reviewInput: ChangePreviewInput | null = receiptMapId === null ? null : {
    before: base,
    after: merged.project,
    mapId: receiptMapId,
    title: receiptTitle,
    sites: reviewSites,
    ...(boardState.report ? { report: boardState.report } : {}),
    ...(reviewFindings.length > 0 ? { findings: reviewFindings } : {}),
    detail: team ? `아직 프로젝트에 반영하지 않았습니다 — 툴콜 ${toolCalls}회, 바뀐 맵·항목 ${changedCount}개.`
      : "아직 프로젝트에 반영하지 않았습니다.",
    chips: receiptChips,
    ledger: receiptLedger,
    state: "proposed",
  };
  const reviewPreview = reviewInput ? renderChangePreviewCard(reviewInput) : null;
  // 로그 카드의 적용/버리기와 작업 탭 검토 스트립이 **같은 클로저**를 부른다 — 두 경로, 한 동작.
  const applyReviewed = (): void => { board.setReview(null); setTeamReviewActions(null); void apply(); };
  const discardReviewed = (): void => {
    board.setReview(null);
    setTeamReviewActions(null);
    ghost.dispose();
    changedCount = 0;
    publishFinalOutcome();
    boardState = markTeamBoardDiscarded(boardState); sync();
    finishLog({ applied: false, changedCount, stoppedReason: "버림" });
    surface.setStatus("대기");
    surface.appendBubble("system", "Pi 결과를 버렸습니다. 프로젝트는 그대로입니다.");
  };
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

