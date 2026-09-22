import { clearAgentBlueprint, setAgentBlueprintFromSpec, markAgentBlueprintProgress, commitAgentBlueprintProgress } from "@/editor/agentBlueprint";
import { blueprintRegionsForToolCall } from "@/editor/agentBlueprintRegions";
import { SPATIAL_BUILD_TOOLS, TILE_WRITE_TOOLS, type BuildSpec } from "@/ai/buildSpec";
import { isAiLiveCanvasEnabled, subscribeAiLiveCanvas } from "@/editor/aiLiveCanvas";
import { resolveCurrentMapId } from "@/editor/mapSelection";
import { requestEditorCameraFocus } from "@/editor/editorCameraFocus";
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
// 중간 증분은 잠정 결과다. 실패한 팀원의 증분은 철회하고 최종 병합 결과로 보정한다.

import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { applyMapDeltas, type PiMapDelta } from "@/ai/piAgent/mapDelta";
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
  readonly present: (before: Project, next: Project, signal?: AbortSignal) => Promise<void>;
  readonly accept: (project: Project) => void;
  /** 검토 화면에는 실제 수용된 병합 결과만 표시한다. */
  readonly reconcile: (project: Project) => void;
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

// 이전 실행의 타이머·검토 버튼은 새 실행의 전역 미리보기를 건드리지 못한다.
let activeOwner: symbol | null = null;

export function createPiGhostBridge(options: PiGhostBridgeOptions): PiGhostBridge {
  const owner = Symbol("pi-ghost");
  activeOwner = owner;
  clearAgentGhostPreview();
  let base = options.baseProject;
  let explicitPlan = false;
  clearAgentBlueprint();
  let journal: { agentId: string; deltas: readonly PiMapDelta[] }[] = [];
  let runningAgentId: string | null = null;
  let maps: Record<string, GameMap> = { ...(base.maps ?? {}) };
  let disposed = false;
  const draftProject = (): Project => ({ ...base, maps } as Project);

  // 스로틀·flush·cancel 은 세션 경로와 같은 기계를 쓴다. 그쪽은 «쓰기 툴이 성공했나» 로 갱신을
  // 예약하는데, 여기서는 증분이 도착한 것 자체가 그 증거라 항상 참이다.
  const applyPreview = (baseProject: Project, draft: Project): void => {
    if (activeOwner !== owner || !isAiLiveCanvasEnabled()) return;
    (options.apply ?? replaceAgentGhostPreviewFromProjectDiff)(baseProject, draft);
  };
  const updater = createThrottledAgentGhostPreviewUpdater({
    getBaseProject: () => base,
    getDraftProject: draftProject,
    isWriteTool: () => true,
    ...(options.throttleMs === undefined ? {} : { throttleMs: options.throttleMs }),
    apply: applyPreview,
    ...(options.setTimeoutFn ? { setTimeoutFn: options.setTimeoutFn } : {}),
    ...(options.clearTimeoutFn ? { clearTimeoutFn: options.clearTimeoutFn } : {}),
  });
  const schedule = (): void => {
    if (!isAiLiveCanvasEnabled()) {
      updater.cancel();
      return;
    }
    updater.handleToolCall({ type: "tool_call", name: "map_delta", result: { ok: true } });
  };
  const paintNow = (): void => {
    updater.cancel();
    if (disposed || activeOwner !== owner || !isAiLiveCanvasEnabled()) return;
    applyPreview(base, draftProject());
  };
  const onLiveCanvas = (): void => {
    if (disposed || activeOwner !== owner) return;
    if (!isAiLiveCanvasEnabled()) {
      updater.cancel();
      return;
    }
    paintNow();
  };
  const unsubscribeLiveCanvas = subscribeAiLiveCanvas(onLiveCanvas);

  // 렌더러가 컴포지터 경로(호수 쿼터·도로 오토타일·밑동 합성)로 실제 타일을 찍으려면 초안 맵이
  // 필요하다. 없으면 셀이 단색 사각형으로 떨어진다.
  setAgentGhostDraftMapProvider((mapId: MapId) => maps[mapId]);

  const reconcile = (project: Project): void => {
    if (disposed || activeOwner !== owner) return;
    maps = { ...project.maps };
    journal = [];
    if (!isAiLiveCanvasEnabled()) {
      updater.cancel();
      return;
    }
    schedule();
    updater.flush();
  };

  return {
    reconcile,
    async present(before, _next, signal) {
      if (disposed || activeOwner !== owner) return;
      // 공개 애니메이션은 다음 쓰기 도구를 붙잡지 않는다. 실제 칸은 적용 알림이 그린다.
      signal?.throwIfAborted();
      base = before;
    },
    accept(project) {
      if (disposed || activeOwner !== owner) return;
      base = project;
      reconcile(project);
      if (explicitPlan) commitAgentBlueprintProgress();
      else clearAgentBlueprint();
    },
    handleEvent(raw): void {
      if (disposed || activeOwner !== owner) return;
      let event = raw;
      let agentId = "root";
      while (event.type === "agent_event") {
        agentId = event.agentId;
        event = event.event;
      }
      if (event.type === "agent_done" && !event.ok) {
        journal = journal.filter(entry => entry.agentId !== event.agentId);
        maps = journal.reduce((current, entry) => applyMapDeltas(current, entry.deltas), { ...base.maps });
        schedule();
      }
      if (raw.type === "done") reconcile(raw.project);
      if (event.type === "execution_status" && event.name === "set_build_spec" && event.ok && event.data) {
        explicitPlan = true;
        setAgentBlueprintFromSpec(event.data as BuildSpec);
        return;
      }
      if (event.type === "tool_end" && runningAgentId === agentId) {
        clearAgentGhostRunningTool();
        if (!explicitPlan && !event.ok) clearAgentBlueprint();
      }
      if (event.type === "tool_start") {
        const args = (event.args && typeof event.args === "object" ? event.args : {}) as Record<string, unknown>;
        const spatial = SPATIAL_BUILD_TOOLS.has(event.name) || TILE_WRITE_TOOLS.has(event.name);
        if (spatial) {
          const target = blueprintRegionsForToolCall(event.name, args);
          const map = target.mapId ? maps[target.mapId] : undefined;
          const regions = target.regions.length ? target.regions : target.wholeTarget && map
            ? [{ mapId: map.id, x: 0, y: 0, w: map.width, h: map.height }] : [];
          if (!explicitPlan && target.mapId && regions.length) {
            setAgentBlueprintFromSpec({ mapId: target.mapId, assets: regions.map((r, i) => ({
              id: `work-${i}`, kind: "작업 영역", x: r.x, y: r.y, w: r.w, h: r.h,
            })) });
          }
          if (explicitPlan) markAgentBlueprintProgress(event.name, args, { write: true });
          const region = regions[0];
          if (isAiLiveCanvasEnabled() && region && region.mapId === resolveCurrentMapId()) requestEditorCameraFocus({
            mapId: region.mapId, tileX: region.x + region.w / 2, tileY: region.y + region.h / 2,
            bounds: { x: region.x, y: region.y, width: region.w, height: region.h }, onlyIfOffscreen: true,
          });
        }
        runningAgentId = agentId;
        setAgentGhostRunningTool(event.name, (event.args ?? undefined) as Record<string, unknown> | undefined);
        return;
      }
      if (event.type === "map_delta") {
        if (event.maps.length === 0) return;
        journal.push({ agentId, deltas: event.maps });
        maps = applyMapDeltas(maps, event.maps);
        schedule();
        return;
      }
      // 실행이 끝나면 밀린 증분을 바로 그린다 — 마지막 한 칸이 스로틀 안에서 잠들면 «끝났는데
      // 아무것도 안 그려진» 상태로 남는다. 고스트를 지우는 건 dispose 의 몫이다(적용 전까지 남는다).
      if (event.type === "done" || event.type === "agent_done" || event.type === "error") {
        if (raw.type === "done" || runningAgentId === (event.type === "agent_done" ? event.agentId : agentId)) {
          clearAgentGhostRunningTool();
          runningAgentId = null;
        }
        if (isAiLiveCanvasEnabled()) updater.flush();
        else updater.cancel();
      }
    },
    flush(): void {
      if (disposed || activeOwner !== owner) return;
      if (!isAiLiveCanvasEnabled()) {
        updater.cancel();
        return;
      }
      updater.flush();
    },
    draftProject,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unsubscribeLiveCanvas();
      updater.cancel();
      journal = [];
      if (activeOwner !== owner) return;
      activeOwner = null;
      setAgentGhostDraftMapProvider(null);
      clearAgentGhostPreview();
      clearAgentBlueprint();
    },
  };
}
