// 채팅 패널의 `/pi` 명령. Pi 에이전트(Bun 쪽 oh-my-pi 루프)를 돌리고, 결과 프로젝트에서 맵 묶음만
// 떼어 기존 커밋 게이트(applyProposedProject)로 적용한다. 진행은 로그 안 팀 보드 카드로 그린다.
//
//   /pi <지시>              현재 맵 범위, 에이전트 하나
//   /pi map_a,map_b <지시>  맵마다 에이전트 하나씩 병렬
//   /pi team <지시>         팀장이 맵을 나눠 시공·검수 에이전트를 띄운다
//   /pi team map_a,map_b <지시>  팀장이 쓸 후보 맵을 제한
//
// 이 파일은 패널의 나머지와 최소 접점(말풍선·상태 표시·로그 붙이기)만 공유한다 — 기존 세션 루프는 건드리지 않는다.

import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { deriveRunOutcome } from "@/ai/runOutcome";
import type { RunOutcome, RunOutcomeFacts } from "@/ai/runOutcome";
import { startPiRunLog, type PiRunContext, type PiRunFacts } from "@/ai/piAgent/activityLog";
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
import { changeChipsWithAreas, renderChangePreviewCard } from "./aiChangePreview";
import { loadAiConfig } from "@/ai/llmClient";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { summarizeChanges } from "@/editor/tools/changeset";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { changedAreaLabels } from "@/project/changeAreas";
import { createTeamBoard } from "./aiTeamBoard";
import { publishTeamActivity } from "@/ai/piAgent/teamActivity";
import { loadTeamSpec } from "@/ai/piAgent/teamSpecStore";

export const PI_COMMAND_PREFIX = "/pi";

export interface ParsedPiCommand {
  readonly mode: PiAgentMode;
  readonly mapIds: readonly string[];
  readonly task: string;
}

function splitMapList(first: string, project: Project): string[] | null {
  const candidates = first.split(",").map((part) => part.trim()).filter(Boolean);
  if (candidates.length === 0 || !candidates.every((id) => Boolean(project.maps[id]))) return null;
  // 같은 맵을 두 번 적으면 에이전트 둘이 한 맵을 다투게 된다 — 파서에서 하나로 접는다.
  return [...new Set(candidates)];
}

/** `/pi 지시` → 현재 맵. `/pi a,b 지시` → 맵 a, b. `/pi team …` → 팀 모드. 맵 토큰은 프로젝트에 있는 id 일 때만 인정한다. */
export function parsePiCommand(text: string, project: Project, currentMapId: string | null): ParsedPiCommand | null {
  const trimmed = text.trim();
  if (trimmed !== PI_COMMAND_PREFIX && !trimmed.startsWith(`${PI_COMMAND_PREFIX} `)) return null;
  let rest = trimmed.slice(PI_COMMAND_PREFIX.length).trim();
  let mode: PiAgentMode = "single";
  if (rest === "team" || rest.startsWith("team ")) {
    mode = "team";
    rest = rest.slice(4).trim();
  }
  const fallback = mode === "team" ? [] : currentMapId ? [currentMapId] : [];
  if (!rest) return { mode, mapIds: fallback, task: "" };
  const [first = "", ...others] = rest.split(/\s+/);
  const mapIds = splitMapList(first, project);
  if (mapIds && others.length > 0) return { mode, mapIds, task: others.join(" ") };
  return { mode, mapIds: fallback, task: rest };
}

/** 슬래시 없는 평문 지시 — 컴포저가 고른 실행 모드(팀 비트)를 그대로 싣는다. */
export function plainPiCommand(text: string, mode: PiAgentMode, currentMapId: string | null): ParsedPiCommand {
  return { mode, mapIds: mode === "team" ? [] : currentMapId ? [currentMapId] : [], task: text.trim() };
}

/**
 * 계획 턴의 지시문 머리. Pi 에는 세션 플래너가 없으므로 «실행하지 말고 계획만» 을 말로 만든다 —
 * 강제는 툴 목록이 한다(request.readOnly). 계획은 도구 결과가 아니라 말로 남으므로 항목 목록을 요구한다.
 */
const PLAN_ONLY_PREFIX = "[계획 턴] 이번 실행에서는 프로젝트를 바꾸지 않는다. 쓰기 도구가 제공되지 않는다. "
  + "요청을 실행 순서가 있는 항목 목록으로만 보고하라. 각 항목은 «무엇을 · 어디에 · 왜» 를 담고, 마지막에 예상 위험을 한 줄로 적어라. ";

/** 이 실행 하나가 해도 되는 것. 패널이 자율성 다이얼에서 풀어 넘긴다(`resolvePiRunPlan`). */
export interface PiRunOptions {
  /** 쓰기 툴 미제공 — 질문(읽기 전용) 턴. */
  readonly readOnly?: boolean;
  /** 실행하지 않고 계획만. readOnly 와 함께 켜진다(자율성 「확인」). */
  readonly planOnly?: boolean;
  /** 다이얼의 작업 예산 → Pi 턴 상한. */
  readonly maxTurns?: number;
  /** 다이얼의 추론 강도 → Pi thinking level. */
  readonly thinkingLevel?: PiAgentThinkingLevel;
}

/** 적용 뒤 영수증(지금 → 적용 후) 재료. 렌더는 패널이 한다 — 되돌리기와 스튜디오 「변경」 탭이 거기 있다. */
export interface PiChangeReceipt {
  readonly before: Project;
  readonly after: Project;
  readonly mapId: string | null;
  readonly title: string;
  readonly detail: string;
  readonly chips: readonly string[];
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
}

export async function runPiCommand(
  command: ParsedPiCommand,
  surface: PiCommandSurface,
  options: PiRunOptions = {},
): Promise<boolean> {
  if (!command.task) {
    surface.appendBubble("system", "사용법: /pi <지시> · /pi 맵id,맵id <지시> · /pi team <지시>");
    return false;
  }
  const base = store.getCurrent();
  const proposalBase = captureProposalBase(base);
  const baseline = new AuthoredProjectBaseline(base);
  const config = loadAiConfig();
  const provider = config.providerId ?? "google-antigravity";
  const readOnly = options.readOnly === true;
  // 조회 턴에 팀을 켜면 시공 팀원이 아무것도 못 하는 채로 예산만 태운다 — 읽기 전용은 언제나 단독이다.
  const team = command.mode === "team" && !readOnly;
  const groups = team ? [command.mapIds] : command.mapIds.length > 0 ? command.mapIds.map((id) => [id]) : [[] as string[]];

  // 실행 결과 4축 — 세션 경로(assistantSession.getRunOutcome)와 같은 deriveRunOutcome 을 쓴다.
  // 실행부는 사실만 정하고 판정(목표)은 수용 검사가 소유하므로 Pi 경로에선 unassessed 가 정직한 값이다.
  const streamErrors: string[] = [];
  const spilledKeys: string[] = [];
  let toolErrorCount = 0;
  let changedCount = 0;
  let applied = false;
  /** 사실 팩 하나를 4축으로 투영한다 — 목표 축은 수용 검사의 소유라 여기선 늘 unassessed. */
  const publishOutcome = (facts: Omit<RunOutcomeFacts, "acceptance" | "visualDelivery">): void => {
    surface.setRunOutcome?.(deriveRunOutcome({ ...facts, acceptance: null }));
  };
  /** 종료 시점의 4축 하나를 게시한다. 종료 경로가 여러 개라서 하나로 모은다. */
  const publishFinalOutcome = (): void => {
    if (!surface.setRunOutcome) return;
    const hasPendingDraft = changedCount > 0 && (config.piApply ?? "review") !== "auto";
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
    model: config.model,
  };
  const runLog = startPiRunLog(logContext);
  // boardState 는 push 마다 새 객체로 갈아 끼워지므로 호출 시점의 것을 싣는다.
  const finishLog = (facts: Omit<PiRunFacts, "board">): void => {
    void runLog.finish({ ...facts, board: boardState });
  };

  let boardState: TeamBoardState = createTeamBoardState(command.mode, command.task);
  const board = createTeamBoard(boardState);
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
  surface.setStatus(team ? "Pi 팀 실행 중…" : `Pi 에이전트 ${groups.length}개 실행 중…`);

  // 단일·병렬 모드의 평평한 이벤트는 그룹 단위 행으로 감싸 보드에 넣는다. 팀 모드는 런타임이 이미 감싸서 보낸다.
  // 질문(읽기 전용)·계획 턴의 결과는 «바뀐 것» 이 아니라 **말**이다. 보드는 마지막 한 줄만 남기므로
  // 답이 될 문장을 따로 붙잡아 둔다 — 이게 없으면 질문 모드가 220자로 잘린 한 줄이 된다.
  let lastAssistantText = "";
  const wrap = (mapIds: readonly string[], index: number) => (event: PiAgentEvent): void => {
    if (event.type === "assistant") lastAssistantText = event.text;
    if (team) { push(event); return; }
    const agentId = mapIds.join(",") || `agent-${index + 1}`;
    if (event.type === "error") { if (streamErrors.length < 3) streamErrors.push(event.message); }
    if (event.type === "start") {
      push({ type: "agent_spawn", agentId, role: "builder", mapId: mapIds[0] ?? null, mapName: mapIds[0] ? base.maps[mapIds[0]]?.name ?? null : null, task: command.task });
    }
    if (event.type === "error") { push({ type: "agent_event", agentId, event }); push(event); return; }
    if (event.type === "done") { push({ type: "agent_event", agentId, event }); return; }
    push({ type: "agent_event", agentId, event });
    if (event.type === "turn") surface.setStatus(`Pi 에이전트 ${index + 1}/${groups.length} — ${event.index}턴`);
  };

  let results: PiAgentDoneEvent[];
  try {
    results = await Promise.all(groups.map((mapIds, index) => runPiAgentViaCompanion(
      {
        mode: team ? "team" : "single",
        provider,
        model: config.model,
        task: options.planOnly ? `${PLAN_ONLY_PREFIX}${command.task}` : command.task,
        mapIds,
        project: base,
        ...(readOnly ? { readOnly: true } : {}),
        ...(options.maxTurns === undefined ? {} : { maxTurns: options.maxTurns }),
        ...(options.thinkingLevel === undefined ? {} : { thinkingLevel: options.thinkingLevel }),
        ...(teamSpec ? { team: teamSpec } : {}),
      },
      { signal: surface.signal, onEvent: wrap(mapIds, index) },
    )));
  } catch (error) {
    if (surface.signal?.aborted) {
      // fetch 는 abort 에서 AbortError 를 던진다 — 실패가 아니라 중단이므로 중단 경로로 돌린다(실측 2026-09-11).
      publishFinalOutcome();
      boardState = markTeamBoardAborted(boardState); sync();
      finishLog({ applied: false, changedCount: 0, stoppedReason: "중단" });
      surface.setStatus("대기");
      surface.appendBubble("system", "Pi 에이전트를 중단했습니다. 적용된 변경은 없습니다.");
      return false;
    }
    const message = error instanceof Error ? error.message : String(error);
    streamErrors.push(message);
    publishFinalOutcome();
    boardState = markTeamBoardFailed(boardState, message); sync();
    finishLog({ applied: false, changedCount: 0, error: message });
    surface.setStatus("Pi 에이전트 실패");
    surface.appendBubble("system", `Pi 에이전트 실패: ${message}`);
    return false;
  }
  if (surface.signal?.aborted) {
    publishFinalOutcome();
    boardState = markTeamBoardAborted(boardState); sync();
    finishLog({ applied: false, changedCount: 0, stoppedReason: "중단" });
    surface.setStatus("대기");
    surface.appendBubble("system", "Pi 에이전트를 중단했습니다. 적용된 변경은 없습니다.");
    return false;
  }
  // 팀 모드는 런타임이 이미 맵 묶음으로 병합해 돌려준다. 단일 범위 지정은 여기서 병합한다.
  const merged = !team && command.mapIds.length > 0
    ? mergeMapBundles(base, results.map((done, index) => ({ mapIds: groups[index]!, project: done.project })))
    : { project: results[0]!.project, spills: [], conflicts: [] as string[] };
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
  if (changedCount === 0) {
    const answer = lastAssistantText.trim();
    // 「적용됨」은 커밋된 실행에만 쓴다 — 계획 턴과 답(질문) 턴은 바뀌지 않는 것이 정상이고,
    // "바뀐 것이 없다" 로 끝내면 성공한 질문이 실패로 읽힌다(2026-09-12 실측).
    const caption = options.planOnly
      ? "계획만 세웠습니다. 실행하려면 같은 지시를 다시 보내세요."
      : answer
        ? "프로젝트는 바뀌지 않았습니다."
        : "Pi 에이전트가 끝났지만 프로젝트에 바뀐 것이 없습니다.";
    publishFinalOutcome();
    boardState = markTeamBoardDone(
      boardState,
      options.planOnly ? "계획만 세웠습니다." : answer ? "답변했습니다 — 프로젝트는 그대로입니다." : "바뀐 것이 없습니다.",
    ); sync();
    finishLog({ applied: false, changedCount: 0, stoppedReason: options.planOnly ? "계획만" : answer ? "답변" : "변경 없음" });
    surface.setStatus("대기");
    // 답이 곧 결과인 턴은 본문 말풍선이 먼저다 — 보드의 잘린 한 줄·시스템 줄이 답 앞에 서지 않게 한다.
    if (answer) surface.appendBubble("assistant", answer);
    surface.appendBubble("system", caption);
    return true;
  }
  // 영수증이 그릴 맵: 먼저 바뀐 맵, 없으면 지시 범위의 첫 맵, 그것도 없으면 프로젝트의 첫 맵.
  // 마지막 후보가 없으면 맵 없는 프로젝트에서 영수증이 통째로 사라진다(그림은 못 그려도 이름은 남아야 한다).
  const receiptMapId = changedKeys.find((key) => key.startsWith("maps."))?.slice("maps.".length)
    ?? command.mapIds[0] ?? surface.getCurrentMapId() ?? Object.keys(merged.project.maps)[0] ?? null;
  const receiptTitle = `${team ? "Pi 팀" : `Pi 에이전트 ${groups.length}개`} — ${scopeText}`;
  // 카운터가 없는 영역(퀘스트·스토리 플래그·캐릭터·맵 연결…)까지 한 줄에 — 검토 카드와 영수증이
  // 같은 칩을 쓴다. 이게 없으면 그런 턴은 "적용/버리기" 만 있는 빈 카드로 끝났다.
  const receiptChips = changeChipsWithAreas(changed, changedAreaLabels(base, merged.project));
  const apply = async (): Promise<boolean> => {
    const appliedResult = await applyProposedProject(merged.project, {
    base: proposalBase,
    baseline,
    source: "agent",
    agentName: `pi${team ? "-team" : ""}:${provider}/${config.model}`,
    summary: `Pi ${team ? "팀" : "에이전트"}: ${command.task.slice(0, 80)}`,
    toolNames: [team ? "pi_team" : "pi_agent"],
    diff: changed,
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
    const appliedText = `적용했습니다 — ${team ? "팀" : `에이전트 ${groups.length}개`}, 툴콜 ${toolCalls}회, 바뀐 맵·항목 ${changedCount}개${spillNotice}${errorDigest()}.`;
    boardState = markTeamBoardApplied(boardState, appliedText); sync();
    finishLog({ applied: true, changedCount, stoppedReason: "적용됨" });
    surface.setStatus(team ? "Pi 팀 적용 완료" : "Pi 에이전트 적용 완료");
    surface.appendBubble("system", appliedText);
    surface.showChangeReceipt?.({
      before: base,
      after: merged.project,
      mapId: receiptMapId,
      title: receiptTitle,
      detail: appliedText,
      chips: receiptChips,
      toolNames: [team ? "pi_team" : "pi_agent"],
    });
    return true;
  };
  // 기본은 검토 후 적용: 보드 발의 검토 카드에서 사용자가 승인해야 프로젝트가 바뀐다.
  // 기준(base)이 그 사이 바뀌면 applyProposedProject 가 stale-base 로 거절한다.
  if ((config.piApply ?? "review") === "auto") return apply();
  boardState = markTeamBoardReview(boardState, receiptChips); sync();
  // 적용 전에도 «무엇이 바뀔 것인가» 를 보여준다 — 여기가 사용자가 결정하는 자리다.
  // 같은 카드·같은 렌더러를 쓰고 배지만 「적용 전」 이다(두 번째 어휘를 만들지 않는다).
  const reviewPreview = receiptMapId === null ? null : renderChangePreviewCard({
    before: base,
    after: merged.project,
    mapId: receiptMapId,
    title: receiptTitle,
    detail: `아직 프로젝트에 반영하지 않았습니다 — 툴콜 ${toolCalls}회, 바뀐 맵·항목 ${changedCount}개.`,
    chips: receiptChips,
    state: "proposed",
  });
  publishFinalOutcome();
  finishLog({ applied: false, changedCount, stoppedReason: "검토 대기" });
  board.setReview({
    ...(reviewPreview ? { preview: reviewPreview } : {}),
    onApply: () => { board.setReview(null); void apply(); },
    onDiscard: () => {
      board.setReview(null);
      changedCount = 0;
      publishFinalOutcome();
      boardState = markTeamBoardDiscarded(boardState); sync();
      finishLog({ applied: false, changedCount, stoppedReason: "버림" });
      surface.setStatus("대기");
      surface.appendBubble("system", "Pi 결과를 버렸습니다. 프로젝트는 그대로입니다.");
    },
  });
  return true;
}

