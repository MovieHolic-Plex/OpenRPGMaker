// Pi 실행 이벤트 → 캔버스 시공 표시(고스트). 워커가 툴마다 흘리는 `map_delta` 를 초안 맵으로
// 복원하고, **기존 고스트 기계를 그대로** 돌린다(base↔초안 diff).
//
// 왜 이 다리가 필요한가 (2026-09-17): 조수 채팅의 평문 지시는 전부 Pi 로 간다. 그런데 Pi 는
// 루프가 Bun 워커에 있고 결과 프로젝트가 맨 끝 `done` 에만 실려서, base↔초안 diff 로 굴러가던
// 고스트가 턴 내내 먹을 재료가 없었다 — 「AI 가 실시간으로 맵에 뭘 까는 게 안 보인다」의 원인이
// 고스트 고장이 아니라 **경로 이사**였던 이유다. 고스트 기계(agentGhostPreview)는 멀쩡했다.
//
// 붙이는 자리는 `aiPiAgentCommand` 의 이벤트 래퍼 하나다 — 단일·병렬·팀 이벤트가 전부 그곳을
// 지난다(팀은 `agent_event` 한 겹만 벗기면 된다). 병렬·팀에서 여러 에이전트가 동시에 흘려도
// 에이전트마다 소유한 맵이 다르므로 맵 단위 증분은 그대로 겹쳐 쌓인다.

import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { applyMapDeltas } from "@/ai/piAgent/mapDelta";
import {
  clearAgentGhostPreview,
  clearAgentGhostRunningTool,
  createThrottledAgentGhostPreviewUpdater,
  replaceAgentGhostPreviewFromProjectDiff,
  setAgentGhostDraftMapProvider,
  setAgentGhostRunningTool,
} from "@/editor/agentGhostPreview";
import type { GameMap, MapId, Project } from "@/project/types";

export interface PiGhostBridge {
  /** 실행 이벤트 하나를 흘려 넣는다. 팀 이벤트(`agent_event`)는 알아서 한 겹 벗긴다. */
  readonly handleEvent: (event: PiAgentEvent) => void;
  /** 밀린 갱신을 지금 그린다 — 실행이 끝났는데 마지막 증분이 스로틀 안에서 잠들지 않게. */
  readonly flush: () => void;
  /** 지금까지 쌓인 초안 맵. 검토 카드·테스트가 «무엇이 그려졌나» 를 묻는 창구다. */
  readonly draftProject: () => Project;
  /** 고스트를 지우고 초안 공급을 끊는다. 실행이 끝나는 모든 길(적용·폐기·중단·실패)에서 한 번. */
  readonly dispose: () => void;
}

export interface PiGhostBridgeOptions {
  readonly baseProject: Project;
  /** 테스트 시임. 비우면 진짜 고스트 스토어에 쓴다. */
  readonly apply?: (baseProject: Project, draftProject: Project) => void;
  readonly setTimeoutFn?: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>;
  readonly clearTimeoutFn?: (handle: ReturnType<typeof setTimeout>) => void;
  readonly throttleMs?: number;
}

/** 팀 이벤트를 한 겹 벗긴다. 중첩은 한 겹뿐이지만 방어적으로 끝까지 판다. */
function unwrap(event: PiAgentEvent): PiAgentEvent {
  let current = event;
  while (current.type === "agent_event") current = current.event;
  return current;
}

export function createPiGhostBridge(options: PiGhostBridgeOptions): PiGhostBridge {
  const base = options.baseProject;
  let maps: Record<string, GameMap> = { ...(base.maps ?? {}) };
  let disposed = false;
  const draftProject = (): Project => ({ ...base, maps } as Project);

  // 스로틀·flush·cancel 은 세션 경로와 같은 기계를 쓴다. 그쪽은 «쓰기 툴이 성공했나» 로 갱신을
  // 예약하는데, 여기서는 증분이 도착한 것 자체가 그 증거라 항상 참이다.
  const updater = createThrottledAgentGhostPreviewUpdater({
    getBaseProject: () => base,
    getDraftProject: draftProject,
    isWriteTool: () => true,
    ...(options.throttleMs === undefined ? {} : { throttleMs: options.throttleMs }),
    apply: options.apply ?? ((baseProject, draft) => { replaceAgentGhostPreviewFromProjectDiff(baseProject, draft); }),
    ...(options.setTimeoutFn ? { setTimeoutFn: options.setTimeoutFn } : {}),
    ...(options.clearTimeoutFn ? { clearTimeoutFn: options.clearTimeoutFn } : {}),
  });
  const schedule = (): void => updater.handleToolCall({ type: "tool_call", name: "map_delta", result: { ok: true } });

  // 렌더러가 컴포지터 경로(호수 쿼터·도로 오토타일·밑동 합성)로 실제 타일을 찍으려면 초안 맵이
  // 필요하다. 없으면 셀이 단색 사각형으로 떨어진다.
  setAgentGhostDraftMapProvider((mapId: MapId) => maps[mapId]);

  return {
    handleEvent(raw): void {
      if (disposed) return;
      const event = unwrap(raw);
      if (event.type === "tool_start") {
        setAgentGhostRunningTool(event.name, (event.args ?? undefined) as Record<string, unknown> | undefined);
        return;
      }
      if (event.type === "map_delta") {
        if (event.maps.length === 0) return;
        maps = applyMapDeltas(maps, event.maps);
        schedule();
        return;
      }
      // 실행이 끝나면 밀린 증분을 바로 그린다 — 마지막 한 칸이 스로틀 안에서 잠들면 «끝났는데
      // 아무것도 안 그려진» 상태로 남는다. 고스트를 지우는 건 dispose 의 몫이다(적용 전까지 남는다).
      if (event.type === "done" || event.type === "agent_done" || event.type === "error") {
        clearAgentGhostRunningTool();
        updater.flush();
      }
    },
    flush(): void {
      if (disposed) return;
      updater.flush();
    },
    draftProject,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      updater.cancel();
      setAgentGhostDraftMapProvider(null);
      clearAgentGhostPreview();
    },
  };
}
