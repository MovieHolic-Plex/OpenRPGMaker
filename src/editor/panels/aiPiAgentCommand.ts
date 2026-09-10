// 채팅 패널의 슬래시 노브. Pi 에이전트(Bun 쪽 oh-my-pi 루프)를 돌리고, 결과 프로젝트에서 맵 묶음만
// 떼어 기존 커밋 게이트(applyProposedProject)로 적용한다. 진행은 로그 안 팀 보드 카드로 그린다.
//
//   /pi <지시>                현재 맵 범위, 에이전트 하나
//   /pi map_a,map_b <지시>    맵마다 에이전트 하나씩 병렬
//   /pi team [맵목록] <지시>  팀장이 맵을 나눠 시공·검수 에이전트를 띄운다
//
// 노브는 `/pi` 없이 맨 앞에 와도 같은 뜻이다:
//
//   /team <지시>     팀 모드
//   /loop 3 <지시>   같은 지시를 최대 3회 반복한다. 어떤 회차에서 바뀐 것이 없으면 조기 종료.
//   /30m <지시>      한 실행의 시간 상한(기본 10m). s·m·h.
//
// 모르는 `/이름` 은 명령이 아니라 평문이다 — 첫 토큰이 `/pi` 도 알려진 노브도 아니면 null.
// 알려진 노브인데 인자가 틀리면(`/loop abc`) error 를 돌려 사용법을 띄운다: 조용히 지시문으로
// 떨어지면 사용자는 왜 안 돌았는지 알 수 없다.
//
// 이 파일은 패널의 나머지와 최소 접점(말풍선·상태 표시·로그 붙이기)만 공유한다.

import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { mergeMapBundles } from "@/ai/piAgent/mapBundle";
import { changedProjectKeys, type PiAgentEvent, type PiAgentMode, type PiAgentThinkingLevel } from "@/ai/piAgent/protocol";
import {
  createTeamBoardState,
  markTeamBoardAborted,
  markTeamBoardApplied,
  markTeamBoardDiscarded,
  markTeamBoardFailed,
  markTeamBoardReview,
  reduceTeamBoard,
  type TeamBoardState,
} from "@/ai/piAgent/teamBoardState";
import { changePreviewChips } from "./aiChangePreview";
import { loadAiConfig } from "@/ai/llmClient";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { summarizeChanges } from "@/editor/tools/changeset";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { createTeamBoard } from "./aiTeamBoard";
import { publishTeamActivity } from "@/ai/piAgent/teamActivity";
import { loadTeamSpec } from "@/ai/piAgent/teamSpecStore";

export const PI_COMMAND_PREFIX = "/pi";
/** `/loop` 상한. 실행 하나가 워커를 10분까지 붙잡을 수 있으므로 상한이 없으면 요금·시간이 조용히 샌다. */
export const MAX_PI_LOOP = 20;
const MIN_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 2 * 60 * 60_000;
const DURATION_TOKEN = /^(\d+)(s|m|h)$/;
const DURATION_UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000 } as const;

export const PI_USAGE_TEXT =
  "사용법: /pi <지시> · /team <지시> · /loop 3 <지시> · /30m <지시> · /pi map_a,map_b <지시>";

/** 입력창 툴팁. 슬래시 노브는 발견 경로가 없으면 없는 기능이다 — 어디서든 한 줄로 읽히게 둔다. */
export const PI_DIRECTIVE_HINT = "슬래시 노브 — /team 팀 · /loop 3 반복 · /30m 시간 상한 · /pi 맵목록 지시";

export interface ParsedPiCommand {
  readonly mode: PiAgentMode;
  readonly mapIds: readonly string[];
  readonly task: string;
  /** 반복 횟수. 1 이면 반복 없음. */
  readonly loop: number;
  /** 한 실행의 시간 상한(ms). 없으면 런타임 기본 10분. */
  readonly timeoutMs?: number;
}

/** 파싱 결과. null 은 "명령이 아니다"(평문 지시). */
export type PiDirectiveParse =
  | { readonly kind: "command"; readonly command: ParsedPiCommand }
  | { readonly kind: "error"; readonly message: string };

function splitMapList(first: string, project: Project): string[] | null {
  const candidates = first.split(",").map((part) => part.trim()).filter(Boolean);
  if (candidates.length === 0 || !candidates.every((id) => Boolean(project.maps[id]))) return null;
  // 같은 맵을 두 번 적으면 에이전트 둘이 한 맵을 다투게 된다 — 파서에서 하나로 접는다.
  return [...new Set(candidates)];
}

function bareToken(token: string): string {
  return token.startsWith("/") ? token.slice(1) : token;
}

function isKnobToken(token: string): boolean {
  const bare = bareToken(token);
  return bare === "team" || bare === "loop" || DURATION_TOKEN.test(bare);
}

/** 슬래시 노브 없는 평문 지시. 라우트 셀렉트가 고른 경로로 그대로 보낸다. */
export function plainPiCommand(text: string, mode: PiAgentMode, currentMapId: string | null): ParsedPiCommand {
  return {
    mode,
    mapIds: mode === "team" ? [] : currentMapId ? [currentMapId] : [],
    task: text.trim(),
    loop: 1,
  };
}

/**
 * 슬래시 노브를 읽는다. 문법: `[/pi] [team] [loop N] [10s|10m|2h] [맵목록] <지시>`.
 * 맵 토큰은 프로젝트에 있는 id 일 때만 인정한다(없는 id 는 지시문의 첫 단어일 뿐이다).
 */
export function parsePiDirective(
  text: string,
  project: Project,
  currentMapId: string | null,
): PiDirectiveParse | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const tokens = trimmed.split(/\s+/);
  const explicitPrefix = tokens[0] === PI_COMMAND_PREFIX;
  // 첫 토큰이 `/pi` 도 알려진 노브도 아니면 명령이 아니다 — `/pixel` 은 평문으로 남는다.
  if (!explicitPrefix && !isKnobToken(tokens[0]!)) return null;
  let index = explicitPrefix ? 1 : 0;
  let mode: PiAgentMode = "single";
  let loop = 1;
  let timeoutMs: number | undefined;
  while (index < tokens.length) {
    const bare = bareToken(tokens[index]!);
    if (bare === "team") {
      mode = "team";
      index += 1;
      continue;
    }
    if (bare === "loop") {
      const raw = tokens[index + 1];
      const count = raw && /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
      if (!Number.isInteger(count) || count < 1 || count > MAX_PI_LOOP) {
        return { kind: "error", message: `반복 횟수는 1~${MAX_PI_LOOP} 사이여야 합니다. ${PI_USAGE_TEXT}` };
      }
      loop = count;
      index += 2;
      continue;
    }
    const duration = DURATION_TOKEN.exec(bare);
    if (duration) {
      const ms = Number(duration[1]) * DURATION_UNIT_MS[duration[2] as keyof typeof DURATION_UNIT_MS];
      if (ms < MIN_TIMEOUT_MS || ms > MAX_TIMEOUT_MS) {
        return { kind: "error", message: `시간 상한은 10s~2h 사이여야 합니다. ${PI_USAGE_TEXT}` };
      }
      timeoutMs = ms;
      index += 1;
      continue;
    }
    break;
  }
  const fallback = mode === "team" ? [] : currentMapId ? [currentMapId] : [];
  const rest = tokens.slice(index);
  const budget = timeoutMs === undefined ? {} : { timeoutMs };
  if (rest.length === 0) {
    return { kind: "command", command: { mode, mapIds: fallback, task: "", loop, ...budget } };
  }
  const mapIds = splitMapList(rest[0]!, project);
  if (mapIds && rest.length > 1) {
    return { kind: "command", command: { mode, mapIds, task: rest.slice(1).join(" "), loop, ...budget } };
  }
  return { kind: "command", command: { mode, mapIds: fallback, task: rest.join(" "), loop, ...budget } };
}

export interface PiCommandSurface {
  readonly appendBubble: (role: "system" | "assistant", text: string) => unknown;
  /** 로그에 카드 같은 임의 요소를 붙인다(변경 영수증과 같은 자리). */
  readonly appendCard: (element: HTMLElement) => void;
  readonly setStatus: (text: string) => void;
  readonly getCurrentMapId: () => string | null;
  /** 패널의 중단 버튼. 끊기면 진행 중인 요청을 모두 취소하고 아무것도 적용하지 않는다. */
  readonly signal?: AbortSignal;
}

export interface PiCommandRunOptions {
  /** 라우트 결정이 켠 읽기 전용 실행(자율성 「읽기 전용」·질문). 파서가 아니라 경로 결정이 소유한다. */
  readonly readOnly?: boolean;
  /** 계획 턴: 실행하지 않고 계획만 보고한다(자율성 「확인」). readOnly 와 함께 켜진다. */
  readonly planOnly?: boolean;
  /** 다이얼의 작업 예산 → Pi 턴 상한. */
  readonly maxTurns?: number;
  /** 다이얼의 추론 강도 → Pi thinking level. */
  readonly thinkingLevel?: PiAgentThinkingLevel;
}

/** 계획 턴의 지시문. 계획은 도구 결과가 아니라 말로 남는다 — 그래서 항목 목록을 요구한다. */
const PLAN_ONLY_PREFIX =
  "[계획 턴] 이번 실행은 계획만 세운다. 쓰기 도구가 제공되지 않는다. 읽기 도구로 현재 상태를 확인한 뒤 "
  + "무엇을 어떤 순서로 바꿀지 항목 목록으로 보고하라. 실제 변경은 하지 않는다.\n\n지시: ";

/** 반복 회차의 지시문. 이전 회차 결과가 이미 반영돼 있다는 사실을 모델이 알아야 같은 일을 반복하지 않는다. */
function loopContinuationTask(task: string, iteration: number, total: number): string {
  return `${task}\n\n(반복 ${iteration}/${total}) 이전 반복의 결과가 이미 이 맵에 반영되어 있다. `
    + "같은 지시를 더 나은 상태로 밀어붙여라. 더 할 일이 없으면 아무것도 바꾸지 말고 그 사실만 보고하라.";
}

export async function runPiCommand(
  command: ParsedPiCommand,
  surface: PiCommandSurface,
  options: PiCommandRunOptions = {},
): Promise<boolean> {
  if (!command.task) {
    surface.appendBubble("system", PI_USAGE_TEXT);
    return false;
  }
  const base = store.getCurrent();
  const proposalBase = captureProposalBase(base);
  const baseline = new AuthoredProjectBaseline(base);
  const config = loadAiConfig();
  const provider = config.providerId ?? "google-antigravity";
  const team = command.mode === "team";
  const groups = team ? [command.mapIds] : command.mapIds.length > 0 ? command.mapIds.map((id) => [id]) : [[] as string[]];
  const iterations = command.loop;

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
  const runLabel = `${team ? "Pi 팀" : `Pi 에이전트 ${groups.length}개`}${iterations > 1 ? ` ×${iterations}회` : ""}`;
  surface.setStatus(`${runLabel} 실행 중…`);

  // 단일·병렬 모드의 평평한 이벤트는 그룹 단위 행으로 감싸 보드에 넣는다. 팀 모드는 런타임이 이미 감싸서 보낸다.
  // 반복 회차는 행 id 에 회차를 붙여 분리한다 — 같은 id 로 접으면 회차 진행이 한 행에 뭉개진다.
  const wrap = (iteration: number) =>
    (mapIds: readonly string[], index: number, event: PiAgentEvent): void => {
      if (team) { push(event); return; }
      const agentId = `${mapIds.join(",") || `agent-${index + 1}`}${iterations > 1 ? `#${iteration}` : ""}`;
      if (event.type === "start") {
        push({ type: "agent_spawn", agentId, role: "builder", mapId: mapIds[0] ?? null, mapName: mapIds[0] ? base.maps[mapIds[0]]?.name ?? null : null, task: command.task });
      }
      if (event.type === "error") { push({ type: "agent_event", agentId, event }); push(event); return; }
      if (event.type === "done") { push({ type: "agent_event", agentId, event }); return; }
      push({ type: "agent_event", agentId, event });
      if (event.type === "turn") {
        const round = iterations > 1 ? ` · 반복 ${iteration}/${iterations}` : "";
        surface.setStatus(`Pi 에이전트 ${index + 1}/${groups.length} — ${event.index}턴${round}`);
      }
    };

  let project = base;
  let toolCalls = 0;
  let iterationsRun = 0;
  try {
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
      const before = project;
      const task = iteration === 1
        ? (options.planOnly ? `${PLAN_ONLY_PREFIX}${command.task}` : command.task)
        : loopContinuationTask(command.task, iteration, iterations);
      const onEvent = wrap(iteration);
      const results = await Promise.all(groups.map((mapIds, index) => runPiAgentViaCompanion(
        {
          mode: command.mode,
          provider,
          model: config.model,
          task,
          mapIds,
          project: before,
          ...(options.readOnly ? { readOnly: true } : {}),
          ...(command.timeoutMs === undefined ? {} : { timeoutMs: command.timeoutMs }),
          ...(options.maxTurns === undefined ? {} : { maxTurns: options.maxTurns }),
          ...(options.thinkingLevel === undefined ? {} : { thinkingLevel: options.thinkingLevel }),
          ...(teamSpec ? { team: teamSpec } : {}),
        },
        { signal: surface.signal, onEvent: (event) => onEvent(mapIds, index, event) },
      )));
      iterationsRun = iteration;
      toolCalls += results.reduce((sum, done) => sum + done.stats.toolCalls, 0);
      // 팀 모드는 런타임이 이미 맵 묶음으로 병합해 돌려준다. 단일 범위 지정은 여기서 병합한다.
      const merged = !team && command.mapIds.length > 0
        ? mergeMapBundles(before, results.map((done, index) => ({ mapIds: groups[index]!, project: done.project })))
        : { project: results[0]!.project, spills: [], conflicts: [] as string[] };
      project = merged.project;
      if (merged.conflicts.length > 0) {
        surface.appendBubble("system", `에이전트 둘 이상이 같은 맵을 바꿨습니다(뒤의 결과 채택): ${merged.conflicts.map((id) => `\`${id}\``).join(", ")}`);
      }
      for (const spill of merged.spills) {
        surface.appendBubble("system", `범위 밖 변경을 버렸습니다 \`${spill.mapIds.join(",")}\`: ${spill.keys.map((key) => `\`${key}\``).join(", ")}`);
      }
      if (iteration === iterations) break;
      const changedThisRound = changedProjectKeys(before, project).length;
      if (changedThisRound === 0) {
        surface.appendBubble("system", `${iteration}번째 반복에서 바뀐 것이 없어 반복을 멈췄습니다.`);
        break;
      }
      surface.appendBubble("system", `${iteration}/${iterations} 반복 완료 — 바뀐 항목 ${changedThisRound}개.`);
    }
  } catch (error) {
    if (surface.signal?.aborted) {
      boardState = markTeamBoardAborted(boardState); sync();
      surface.setStatus("대기");
      surface.appendBubble("system", "Pi 에이전트를 중단했습니다. 적용된 변경은 없습니다.");
      return false;
    }
    const message = error instanceof Error ? error.message : String(error);
    boardState = markTeamBoardFailed(boardState, message); sync();
    surface.setStatus("Pi 에이전트 실패");
    surface.appendBubble("system", `Pi 에이전트 실패: ${message}`);
    return false;
  }
  if (surface.signal?.aborted) {
    boardState = markTeamBoardAborted(boardState); sync();
    surface.setStatus("대기");
    surface.appendBubble("system", "Pi 에이전트를 중단했습니다. 적용된 변경은 없습니다.");
    return false;
  }
  const changed = summarizeChanges(base, project);
  const changedCount = changedProjectKeys(base, project).length;
  const roundsText = iterationsRun > 1 ? `, 반복 ${iterationsRun}/${iterations}` : "";
  if (changedCount === 0) {
    // 계획 턴은 바뀌지 않는 것이 정상이다 — "프로젝트에 바뀐 것이 없다" 로 끝내면 실패로 읽힌다.
    const idle = options.planOnly
      ? "계획만 세웠습니다. 실행하려면 같은 지시를 다시 보내세요."
      : "Pi 에이전트가 끝났지만 프로젝트에 바뀐 것이 없습니다.";
    boardState = markTeamBoardApplied(boardState, options.planOnly ? "계획만 세웠습니다." : "바뀐 것이 없습니다."); sync();
    surface.setStatus("대기");
    surface.appendBubble("system", idle);
    return true;
  }
  const apply = async (): Promise<boolean> => {
    const applied = await applyProposedProject(project, {
    base: proposalBase,
    baseline,
    source: "agent",
    agentName: `pi${team ? "-team" : ""}:${provider}/${config.model}`,
    summary: `Pi ${team ? "팀" : "에이전트"}: ${command.task.slice(0, 80)}`,
    toolNames: [team ? "pi_team" : "pi_agent"],
    diff: changed,
    snapshotLabel: `Pi ${team ? "팀" : "에이전트"} ${scopeText}`,
    snapshotMapId: command.mapIds[0] ?? surface.getCurrentMapId(),
    reason: `${runLabel}, 툴콜 ${toolCalls}회`,
  });
    if (!applied.ok) {
      boardState = markTeamBoardFailed(boardState, `적용 실패(${applied.reason}): ${applied.issue ?? "무결성 오류"}`); sync();
      surface.setStatus("적용 실패");
      surface.appendBubble("system", `적용 실패(${applied.reason}): ${applied.issue ?? "무결성 오류"}`);
      return false;
    }
    const appliedText = `적용했습니다 — ${team ? "팀" : `에이전트 ${groups.length}개`}${roundsText}, 툴콜 ${toolCalls}회, 바뀐 맵·항목 ${changedCount}개.`;
    boardState = markTeamBoardApplied(boardState, appliedText); sync();
    surface.setStatus(team ? "Pi 팀 적용 완료" : "Pi 에이전트 적용 완료");
    surface.appendBubble("system", appliedText);
    return true;
  };
  // 기본은 검토 후 적용: 보드 발의 검토 카드에서 사용자가 승인해야 프로젝트가 바뀐다.
  // 기준(base)이 그 사이 바뀌면 applyProposedProject 가 stale-base 로 거절한다.
  if ((config.piApply ?? "review") === "auto") return apply();
  boardState = markTeamBoardReview(boardState, changePreviewChips(changed)); sync();
  board.setReview({
    onApply: () => { board.setReview(null); void apply(); },
    onDiscard: () => {
      board.setReview(null);
      boardState = markTeamBoardDiscarded(boardState); sync();
      surface.setStatus("대기");
      surface.appendBubble("system", "Pi 결과를 버렸습니다. 프로젝트는 그대로입니다.");
    },
  });
  surface.setStatus("검토 대기 — 보드에서 적용 또는 버리기");
  return true;
}
