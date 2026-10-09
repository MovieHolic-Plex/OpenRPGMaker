// 레인 → 캔버스 시공 표시(고스트). 레인마다 워커가 흘리는 `map_delta` 를 초안 맵으로 복원해 두고,
// 살아 있는 레인(작업 중·결과 대기) 전부를 **한 장의 초안 프로젝트**로 겹쳐 기존 고스트 기계에 넣는다.
//
// 왜 aiPiGhostBridge 를 그대로 쓰지 않는가(2026-09-17): 그 다리는 실행 하나 = 고스트 한 벌이고,
// replace 가 전체를 갈아 끼우며 dispose 가 전체를 지운다. 레인은 서로 다른 맵에서 동시에 여럿이 도므로
// 레인 A 의 증분이 레인 B 의 고스트를 지우면 안 된다. 여기서는 레인별 초안을 따로 들고, 그릴 때마다
// «지금 프로젝트 ↔ 지금 프로젝트 + 살아 있는 레인 초안 전부» 의 diff 를 한 번에 낸다.
//
// 이 표시는 스튜디오 안팎을 가리지 않는다 — 캔버스 레이어(EditScene)가 같은 스토어를 보므로 표준
// 편집기에서도 레인이 어디를 깔고 있는지 점선으로 보인다.

import { applyMapDeltas } from "@/ai/piAgent/mapDelta";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import {
  clearAgentGhostPreview,
  clearAgentGhostRunningTool,
  createThrottledAgentGhostPreviewUpdater,
  replaceAgentGhostPreviewFromProjectDiff,
  setAgentGhostDraftMapProvider,
  setAgentGhostRunningTool,
} from "@/editor/agentGhostPreview";
import { store } from "@/project/store";
import type { GameMap, MapId, Project } from "@/project/types";

export interface LaneGhostSink {
  /** 레인이 출발했다 — 이 사본이 초안의 바닥이다. */
  start(laneId: string, base: Project): void;
  /** 실행 이벤트 하나. `map_delta` 만 초안에 얹고, `tool_start` 는 실행 중 도구 칩에 쓴다. */
  handleEvent(laneId: string, event: PiAgentEvent): void;
  /**
   * 실행이 끝났다 — 결과 프로젝트가 있으면 **이 레인의 묶음 맵만** 결과로 확정한다(결과 대기 동안 남는다).
   * 결과 프로젝트는 와이어를 건너온 새 객체라 모든 맵이 «다른 객체» 다. 통째로 받으면 손대지 않은 맵까지
   * 겹침에 들어가 다른 레인의 초안을 덮는다(실측 2026-09-17: B 가 끝나자 A 의 고스트가 사라졌다).
   */
  finish(laneId: string, project: Project | null, mapIds: readonly string[]): void;
  /** 레인이 적용·버림·중단·실패·삭제됐다 — 그 레인의 고스트만 내린다. */
  drop(laneId: string): void;
  /** 밀린 갱신을 지금 그린다. */
  flush(): void;
  dispose(): void;
}

export interface LaneGhostSinkOptions {
  readonly currentProject?: () => Project;
  readonly apply?: (baseProject: Project, draftProject: Project) => void;
  readonly setTimeoutFn?: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>;
  readonly clearTimeoutFn?: (handle: ReturnType<typeof setTimeout>) => void;
  readonly throttleMs?: number;
}

interface LaneDraft {
  readonly base: Project;
  maps: Record<string, GameMap>;
}

export function createLaneGhostSink(options: LaneGhostSinkOptions = {}): LaneGhostSink {
  const currentProject = options.currentProject ?? (() => store.getCurrent());
  const drafts = new Map<string, LaneDraft>();
  let disposed = false;

  /** 살아 있는 레인 초안 중 바닥과 달라진 맵만 겹친다 — 손대지 않은 맵은 diff 가 객체 동일성으로 빠진다. */
  const overlay = (): Record<string, GameMap> => {
    const out: Record<string, GameMap> = {};
    for (const draft of drafts.values()) {
      for (const [mapId, map] of Object.entries(draft.maps)) {
        if (draft.base.maps[mapId] !== map) out[mapId] = map;
      }
    }
    return out;
  };

  const draftProject = (): Project => {
    const current = currentProject();
    return { ...current, maps: { ...current.maps, ...overlay() } } as Project;
  };

  const updater = createThrottledAgentGhostPreviewUpdater({
    getBaseProject: currentProject,
    getDraftProject: draftProject,
    isWriteTool: () => true,
    ...(options.throttleMs === undefined ? {} : { throttleMs: options.throttleMs }),
    apply: options.apply ?? ((baseProject, draft) => { replaceAgentGhostPreviewFromProjectDiff(baseProject, draft); }),
    ...(options.setTimeoutFn ? { setTimeoutFn: options.setTimeoutFn } : {}),
    ...(options.clearTimeoutFn ? { clearTimeoutFn: options.clearTimeoutFn } : {}),
  });
  const schedule = (): void => updater.handleToolCall({ type: "tool_call", name: "map_delta", result: { ok: true } });

  const syncProvider = (): void => {
    if (drafts.size === 0) {
      setAgentGhostDraftMapProvider(null);
      return;
    }
    setAgentGhostDraftMapProvider((mapId: MapId) => overlay()[mapId]);
  };

  return {
    start(laneId, base): void {
      if (disposed) return;
      drafts.set(laneId, { base, maps: { ...(base.maps ?? {}) } });
      syncProvider();
    },
    handleEvent(laneId, event): void {
      if (disposed) return;
      const draft = drafts.get(laneId);
      if (!draft) return;
      if (event.type === "tool_start") {
        setAgentGhostRunningTool(event.name, (event.args ?? undefined) as Record<string, unknown> | undefined);
        return;
      }
      if (event.type === "map_delta") {
        if (event.maps.length === 0) return;
        draft.maps = applyMapDeltas(draft.maps, event.maps);
        schedule();
      }
    },
    finish(laneId, project, mapIds): void {
      if (disposed) return;
      const draft = drafts.get(laneId);
      if (!draft) return;
      clearAgentGhostRunningTool();
      if (project) {
        const next = { ...draft.maps };
        for (const mapId of mapIds) {
          const map = project.maps[mapId];
          if (map) next[mapId] = map;
        }
        draft.maps = next;
      }
      // 마지막 증분이 스로틀 안에서 잠들면 «끝났는데 아무것도 안 그려진» 채 남는다.
      schedule();
      updater.flush();
    },
    drop(laneId): void {
      if (disposed) return;
      if (!drafts.delete(laneId)) return;
      syncProvider();
      if (drafts.size === 0) {
        updater.cancel();
        clearAgentGhostRunningTool();
        clearAgentGhostPreview();
        return;
      }
      schedule();
      updater.flush();
    },
    flush(): void {
      if (disposed) return;
      updater.flush();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      updater.cancel();
      drafts.clear();
      setAgentGhostDraftMapProvider(null);
      clearAgentGhostPreview();
    },
  };
}
