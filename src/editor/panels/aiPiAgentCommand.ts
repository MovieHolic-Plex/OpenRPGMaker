// 채팅 패널의 `/pi <지시>` 명령. 현재 맵을 범위로 Pi 에이전트(Bun 쪽 oh-my-pi 루프)를 돌리고,
// 결과 프로젝트에서 맵 묶음만 떼어 기존 커밋 게이트(applyProposedProject)로 적용한다.
//
// `/pi map_a,map_b <지시>` 처럼 맵 목록을 앞에 붙이면 맵마다 에이전트 하나씩 병렬로 돈다.
// 이 파일은 패널의 나머지와 최소 접점(말풍선·상태 표시)만 공유한다 — 기존 세션 루프는 건드리지 않는다.

import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { mergeMapBundles } from "@/ai/piAgent/mapBundle";
import type { PiAgentDoneEvent, PiAgentEvent } from "@/ai/piAgent/protocol";
import { loadAiConfig } from "@/ai/llmClient";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { summarizeChanges } from "@/editor/tools/changeset";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

export const PI_COMMAND_PREFIX = "/pi";

export interface ParsedPiCommand {
  readonly mapIds: readonly string[];
  readonly task: string;
}

/** `/pi 지시` → 현재 맵. `/pi a,b 지시` → 맵 a, b. 맵 토큰은 프로젝트에 있는 id 일 때만 인정한다. */
export function parsePiCommand(text: string, project: Project, currentMapId: string | null): ParsedPiCommand | null {
  const trimmed = text.trim();
  if (trimmed !== PI_COMMAND_PREFIX && !trimmed.startsWith(`${PI_COMMAND_PREFIX} `)) return null;
  const rest = trimmed.slice(PI_COMMAND_PREFIX.length).trim();
  if (!rest) return { mapIds: currentMapId ? [currentMapId] : [], task: "" };
  const [first = "", ...others] = rest.split(/\s+/);
  const candidates = first.split(",").map((part) => part.trim()).filter(Boolean);
  const allMaps = candidates.length > 0 && candidates.every((id) => Boolean(project.maps[id]));
  // 같은 맵을 두 번 적으면 에이전트 둘이 한 맵을 다투게 된다 — 파서에서 하나로 접는다.
  if (allMaps && others.length > 0) return { mapIds: [...new Set(candidates)], task: others.join(" ") };
  return { mapIds: currentMapId ? [currentMapId] : [], task: rest };
}

export interface PiCommandSurface {
  readonly appendBubble: (role: "system" | "assistant", text: string) => unknown;
  readonly setStatus: (text: string) => void;
  readonly getCurrentMapId: () => string | null;
  /** 패널의 중단 버튼. 끊기면 진행 중인 요청을 모두 취소하고 아무것도 적용하지 않는다. */
  readonly signal?: AbortSignal;
}

function describeEvent(event: PiAgentEvent, label: string): string | null {
  switch (event.type) {
    case "start": return `${label} 시작 — ${event.provider}/${event.model}, 도구 ${event.toolCount}개`;
    case "tool_end": return `${label} ${event.ok ? "✓" : "✗"} \`${event.name}\` — ${event.summary}`;
    case "assistant": return `${label} ${event.text}`;
    case "error": return `${label} 오류: ${event.message}`;
    default: return null;
  }
}

export async function runPiCommand(command: ParsedPiCommand, surface: PiCommandSurface): Promise<boolean> {
  if (!command.task) {
    surface.appendBubble("system", "사용법: /pi <지시>  또는  /pi 맵id,맵id <지시>");
    return false;
  }
  const base = store.getCurrent();
  const proposalBase = captureProposalBase(base);
  const baseline = new AuthoredProjectBaseline(base);
  const config = loadAiConfig();
  const provider = config.providerId ?? "google-antigravity";
  const groups = command.mapIds.length > 0 ? command.mapIds.map((id) => [id]) : [[] as string[]];
  surface.setStatus(`Pi 에이전트 ${groups.length}개 실행 중…`);
  surface.appendBubble("system", `Pi 에이전트 ${groups.length}개를 ${groups.map((g) => `\`${g.join(",") || "전체"}\``).join(" · ")} 범위로 돌립니다.`);
  let results: PiAgentDoneEvent[];
  try {
    results = await Promise.all(groups.map((mapIds, index) => {
      const label = groups.length > 1 ? `[${mapIds.join(",")}]` : "";
      return runPiAgentViaCompanion(
        { provider, model: config.model, task: command.task, mapIds, project: base },
        { signal: surface.signal, onEvent: (event) => {
          const line = describeEvent(event, label);
          if (line) surface.appendBubble(event.type === "assistant" ? "assistant" : "system", line.trim());
          if (event.type === "turn") surface.setStatus(`Pi 에이전트 ${index + 1}/${groups.length} — ${event.index}턴`);
        } },
      );
    }));
  } catch (error) {
    if (surface.signal?.aborted) {
      surface.setStatus("대기");
      surface.appendBubble("system", "Pi 에이전트를 중단했습니다. 적용된 변경은 없습니다.");
      return false;
    }
    surface.setStatus("Pi 에이전트 실패");
    surface.appendBubble("system", `Pi 에이전트 실패: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
  if (surface.signal?.aborted) {
    surface.setStatus("대기");
    surface.appendBubble("system", "Pi 에이전트를 중단했습니다. 적용된 변경은 없습니다.");
    return false;
  }
  const scoped = command.mapIds.length > 0;
  const merged = scoped
    ? mergeMapBundles(base, results.map((done, index) => ({ mapIds: groups[index]!, project: done.project })))
    : { project: results[0]!.project, spills: [], conflicts: [] };
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
    agentName: `pi:${provider}/${config.model}`,
    summary: `Pi 에이전트: ${command.task.slice(0, 80)}`,
    toolNames: ["pi_agent"],
    diff: changed,
    snapshotLabel: `Pi 에이전트 ${command.mapIds.join(",") || "전체"}`,
    snapshotMapId: command.mapIds[0] ?? surface.getCurrentMapId(),
    reason: `Pi 에이전트 ${groups.length}개, 툴콜 ${toolCalls}회`,
  });
  if (!applied.ok) {
    surface.setStatus("적용 실패");
    surface.appendBubble("system", `적용 실패(${applied.reason}): ${applied.issue ?? "무결성 오류"}`);
    return false;
  }
  surface.setStatus("Pi 에이전트 적용 완료");
  surface.appendBubble("system", `적용했습니다 — 에이전트 ${groups.length}개, 툴콜 ${toolCalls}회.`);
  return true;
}
