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
import { mergeMapBundles } from "@/ai/piAgent/mapBundle";
import { changedProjectKeys, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentMode } from "@/ai/piAgent/protocol";
import {
  createTeamBoardState,
  markTeamBoardAborted,
  markTeamBoardApplied,
  markTeamBoardFailed,
  reduceTeamBoard,
  type TeamBoardState,
} from "@/ai/piAgent/teamBoardState";
import { loadAiConfig } from "@/ai/llmClient";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { summarizeChanges } from "@/editor/tools/changeset";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { createTeamBoard } from "./aiTeamBoard";

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

export interface PiCommandSurface {
  readonly appendBubble: (role: "system" | "assistant", text: string) => unknown;
  /** 로그에 카드 같은 임의 요소를 붙인다(변경 영수증과 같은 자리). */
  readonly appendCard: (element: HTMLElement) => void;
  readonly setStatus: (text: string) => void;
  readonly getCurrentMapId: () => string | null;
  /** 패널의 중단 버튼. 끊기면 진행 중인 요청을 모두 취소하고 아무것도 적용하지 않는다. */
  readonly signal?: AbortSignal;
}

export async function runPiCommand(command: ParsedPiCommand, surface: PiCommandSurface): Promise<boolean> {
  if (!command.task) {
    surface.appendBubble("system", "사용법: /pi <지시> · /pi 맵id,맵id <지시> · /pi team <지시>");
    return false;
  }
  const base = store.getCurrent();
  const proposalBase = captureProposalBase(base);
  const baseline = new AuthoredProjectBaseline(base);
  const config = loadAiConfig();
  const provider = config.providerId ?? "google-antigravity";
  const team = command.mode === "team";
  const groups = team ? [command.mapIds] : command.mapIds.length > 0 ? command.mapIds.map((id) => [id]) : [[] as string[]];

  let boardState: TeamBoardState = createTeamBoardState(command.mode, command.task);
  const board = createTeamBoard(boardState);
  surface.appendCard(board.root);
  const push = (event: PiAgentEvent): void => {
    boardState = reduceTeamBoard(boardState, event);
    board.update(boardState);
  };
  const scopeText = team
    ? (command.mapIds.length > 0 ? `후보 맵 ${command.mapIds.join(", ")}` : "프로젝트 전체")
    : groups.map((g) => g.join(",") || "전체").join(" · ");
  surface.setStatus(team ? "Pi 팀 실행 중…" : `Pi 에이전트 ${groups.length}개 실행 중…`);

  // 단일·병렬 모드의 평평한 이벤트는 그룹 단위 행으로 감싸 보드에 넣는다. 팀 모드는 런타임이 이미 감싸서 보낸다.
  const wrap = (mapIds: readonly string[], index: number) => (event: PiAgentEvent): void => {
    if (team) { push(event); return; }
    const agentId = mapIds.join(",") || `agent-${index + 1}`;
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
      { mode: command.mode, provider, model: config.model, task: command.task, mapIds, project: base },
      { signal: surface.signal, onEvent: wrap(mapIds, index) },
    )));
  } catch (error) {
    if (surface.signal?.aborted) {
      boardState = markTeamBoardAborted(boardState); board.update(boardState);
      surface.setStatus("대기");
      surface.appendBubble("system", "Pi 에이전트를 중단했습니다. 적용된 변경은 없습니다.");
      return false;
    }
    const message = error instanceof Error ? error.message : String(error);
    boardState = markTeamBoardFailed(boardState, message); board.update(boardState);
    surface.setStatus("Pi 에이전트 실패");
    surface.appendBubble("system", `Pi 에이전트 실패: ${message}`);
    return false;
  }
  if (surface.signal?.aborted) {
    boardState = markTeamBoardAborted(boardState); board.update(boardState);
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
  for (const spill of merged.spills) {
    surface.appendBubble("system", `범위 밖 변경을 버렸습니다 \`${spill.mapIds.join(",")}\`: ${spill.keys.map((key) => `\`${key}\``).join(", ")}`);
  }
  const changed = summarizeChanges(base, merged.project);
  const toolCalls = results.reduce((sum, done) => sum + done.stats.toolCalls, 0);
  const applied = await applyProposedProject(merged.project, {
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
  if (!applied.ok) {
    boardState = markTeamBoardFailed(boardState, `적용 실패(${applied.reason}): ${applied.issue ?? "무결성 오류"}`); board.update(boardState);
    surface.setStatus("적용 실패");
    surface.appendBubble("system", `적용 실패(${applied.reason}): ${applied.issue ?? "무결성 오류"}`);
    return false;
  }
  const appliedText = `적용했습니다 — ${team ? "팀" : `에이전트 ${groups.length}개`}, 툴콜 ${toolCalls}회, 바뀐 맵·항목 ${changedProjectKeys(base, merged.project).length}개.`;
  boardState = markTeamBoardApplied(boardState, appliedText); board.update(boardState);
  surface.setStatus(team ? "Pi 팀 적용 완료" : "Pi 에이전트 적용 완료");
  surface.appendBubble("system", appliedText);
  return true;
}

