// editor/aiFollowCamera.ts
// 조수가 지금 쓰는 맵을 화면이 따라간다 — 「AI 조수가 실시간으로 뭘 만드는지 볼 수가 없다」(2026-11-04 오너).
//
// 재료는 워커의 `map_delta` 하나다(scripts/lib/piAgentRuntime.ts, 도구마다 tool_end 뒤). 따라가는 동안:
//   - 다른 맵에 쓰기 시작하면 그 맵을 연다(맵이 아직 스토어에 없으면 체크포인트가 들어오는 순간 연다).
//   - 같은 맵이면 바뀐 칸이 화면 밖일 때만 카메라를 옮긴다(화면 안이면 가만히 둔다 — 흔들림 방지).
//   - 새로 놓인 칸을 잠깐 반짝인다(기존 초점 강조 `requestAgentFocusHighlight` 를 그대로 쓴다).
// 사용자가 손으로 화면을 밀거나(드래그·휠·방향키·줌) 다른 맵을 고르면 그 실행에서는 따라가기를 멈춘다.
// 멈춘 동안 조수가 다른 맵에 쓰면 그 맵의 작은 그림(PiP)을 캔버스 구석에 띄우고, 「따라가기」 알약으로 다시 붙는다.
//
// 2026-10-04 규칙(「찾아달라는 요청이 아니면 화면이 움직이지 않았으면」)과의 관계: 오너가 2026-11-04 에
// 따라가기를 직접 승인했다. 끄는 길은 기존 「맵 위 실시간 시공 연출」 토글(aiLiveCanvas)이 그대로 맡는다.
import { applyMapDeltas, type PiMapDelta } from "@/ai/piAgent/mapDelta";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { isUiInBackground } from "@/ai/yieldToUi";
import { requestAgentFocusHighlight, type AgentFocusCell } from "@/editor/agentFocus";
import { isAiLiveCanvasEnabled } from "@/editor/aiLiveCanvas";
import { editorState } from "@/editor/editorState";
import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import { store } from "@/project/store";
import type { GameMap, MapId, Project } from "@/project/types";
import { el } from "@/util/dom";

/** 바뀐 영역 하나 — 맵 좌표(칸). `cells` 는 반짝일 칸(너무 많으면 비운다). */
export interface FollowRegion {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly cells: readonly AgentFocusCell[];
}

/** 반짝임 칸 상한 — 초점 렌더러의 칸 사각형 상한(256)과 같다. 넘으면 테두리만 반짝인다. */
const FLASH_CELL_LIMIT = 256;

/**
 * 증분에서 맵마다 바뀐 사각형을 뽑는다(순수). 층 통째(`full`)·새 맵 뼈대는 맵 전체, 칸 목록은 그 칸들의 상자,
 * 이벤트는 그 좌표. `mapOf` 는 증분을 얹은 **뒤**의 맵(가로 폭으로 칸 번호를 좌표로 푼다).
 */
export function followRegionsFromDeltas(deltas: readonly PiMapDelta[], mapOf: (mapId: string) => GameMap | undefined): FollowRegion[] {
  const out: FollowRegion[] = [];
  for (const delta of deltas) {
    if (delta.removed) continue;
    const map = mapOf(delta.mapId);
    if (!map || map.width <= 0 || map.height <= 0) continue;
    let whole = Boolean(delta.shape);
    const cells: AgentFocusCell[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const mark = (x: number, y: number, layer: AgentFocusCell["layer"]): void => {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      if (cells.length <= FLASH_CELL_LIMIT) cells.push({ x, y, layer });
    };
    for (const layer of delta.layers ?? []) {
      if (layer.full) { whole = true; continue; }
      const kind: AgentFocusCell["layer"] = layer.layer === "lower" || layer.layer === "layer2" || layer.layer === "shadow" ? "lower" : "upper";
      for (const cell of layer.cells ?? []) mark(cell.i % map.width, Math.floor(cell.i / map.width), kind);
      for (const stack of layer.stacks ?? []) mark(stack.i % map.width, Math.floor(stack.i / map.width), kind);
    }
    for (const event of delta.events?.upserts ?? []) mark(event.x, event.y, "event");
    if (whole) {
      out.push({ mapId: delta.mapId as MapId, x: 0, y: 0, w: map.width, h: map.height, cells: [] });
      continue;
    }
    if (minX === Infinity) continue;
    out.push({ mapId: delta.mapId as MapId, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1,
      cells: cells.length > FLASH_CELL_LIMIT ? [] : cells });
  }
  return out;
}

// EditScene 이 손으로 한 카메라 이동(드래그 팬·휠·방향키·스크롤 막대·줌)마다 부른다.
const userMoveListeners = new Set<() => void>();
export function noteUserViewMove(): void {
  for (const listener of [...userMoveListeners]) listener();
}
function onUserViewMove(listener: () => void): () => void {
  userMoveListeners.add(listener);
  return () => { userMoveListeners.delete(listener); };
}

export interface AiFollowCamera {
  /** 실행 이벤트 하나. 팀 이벤트(`agent_event`)는 알아서 벗긴다. `map_delta` 만 쓴다. */
  observe(event: PiAgentEvent): void;
  dispose(): void;
}

export interface AiFollowCameraOptions {
  readonly baseProject: Project;
  /** 다른 맵에서 같이 도는 대기열 실행 — 앞 실행의 화면을 빼앗지 않는다. */
  readonly background?: boolean;
  readonly now?: () => number;
}

/** 같은 맵 안에서 카메라를 다시 옮기는 최소 간격. 도구가 몰아칠 때 화면이 덜컥거리지 않게. */
const PAN_INTERVAL_MS = 900;
const PIP_INTERVAL_MS = 1500;

let releasePrevious: (() => void) | null = null;

export function createAiFollowCamera(options: AiFollowCameraOptions): AiFollowCamera {
  if (options.background || typeof document === "undefined") return { observe() {}, dispose() {} };
  releasePrevious?.();
  const now = options.now ?? (() => Date.now());
  let maps: Record<string, GameMap> = { ...(options.baseProject.maps ?? {}) };
  let following = true;
  let disposed = false;
  /** 우리가 맵을 여는 동안 일어난 currentMapId 변경은 사용자 선택이 아니다. */
  let programmatic = false;
  let lastPanAt = 0;
  let lastRegion: FollowRegion | null = null;
  /** 맵이 아직 스토어에 없어 못 연 목표 — 체크포인트가 맵을 넣는 순간 연다. */
  let pending: FollowRegion | null = null;
  let pipDrawnAt = 0;
  let pipMapId: MapId | null = null;
  let pipTimer: ReturnType<typeof setTimeout> | null = null;

  const host = (): HTMLElement | null => document.querySelector<HTMLElement>(".phaser-container");
  const pipCanvasSlot = el("div", { class: "canvas-ai-follow-pip-canvas" });
  const pipLabel = el("span", { class: "canvas-ai-follow-pip-label" });
  const pip = el("figure", {
    class: "canvas-ai-follow-pip", dataset: { testid: "ai-follow-pip" },
    attrs: { "aria-label": "조수가 지금 짓는 맵" },
    children: [pipCanvasSlot, el("figcaption", { children: [el("span", { class: "canvas-ai-follow-pip-dot", attrs: { "aria-hidden": "true" } }), pipLabel] })],
  });
  pip.hidden = true;
  const pill = el("button", {
    class: "canvas-ai-follow-pill", text: "따라가기",
    attrs: { type: "button", title: "조수가 작업하는 곳으로 화면을 다시 옮겨요" },
    dataset: { testid: "ai-follow-pill" },
  }) as HTMLButtonElement;
  pill.hidden = true;
  const overlay = el("div", { class: "canvas-ai-follow-overlay", dataset: { testid: "ai-follow-overlay" }, children: [pip, pill] });
  host()?.append(overlay);

  const paintChrome = (): void => {
    if (!overlay.isConnected) host()?.append(overlay);
    pill.hidden = following || !lastRegion;
    const elsewhere = !following && lastRegion !== null && lastRegion.mapId !== editorState.get().currentMapId;
    pip.hidden = !elsewhere;
    if (elsewhere) schedulePip();
  };

  const drawPip = async (): Promise<void> => {
    pipTimer = null;
    if (disposed || !lastRegion) return;
    const map = maps[lastRegion.mapId];
    if (!map) return;
    pipDrawnAt = now();
    pipMapId = map.id;
    pipLabel.textContent = `${map.name || map.id} · 짓는 중`;
    const project = store.getCurrent();
    try {
      const canvas = await renderRegionSnapshot({ ...project, maps: { ...project.maps, [map.id]: map } } as Project, map,
        { x: 0, y: 0, width: map.width, height: map.height }, { targetWidth: 220 });
      if (disposed) return;
      pipCanvasSlot.replaceChildren(canvas);
    } catch {
      // 타일셋 그림을 아직 못 읽었다 — 이름표만 남긴다(그림은 다음 증분에서 다시 시도).
      pipCanvasSlot.replaceChildren();
    }
  };
  const schedulePip = (): void => {
    if (pipTimer) return;
    const wait = lastRegion?.mapId !== pipMapId ? 0 : Math.max(0, PIP_INTERVAL_MS - (now() - pipDrawnAt));
    pipTimer = setTimeout(() => { void drawPip(); }, wait);
  };

  const flash = (region: FollowRegion): void => {
    requestAgentFocusHighlight({ mapId: region.mapId, cells: region.cells,
      bounds: { x: region.x, y: region.y, width: region.w, height: region.h }, score: 1 });
  };

  /** 따라가는 중일 때 그 영역으로 화면을 옮긴다. 맵이 스토어에 없으면 미뤄 둔다. */
  const go = (region: FollowRegion, force: boolean): void => {
    if (!store.getCurrent().maps[region.mapId]) { pending = region; return; }
    pending = null;
    const switching = editorState.get().currentMapId !== region.mapId;
    if (!switching && !force && now() - lastPanAt < PAN_INTERVAL_MS) { flash(region); return; }
    lastPanAt = now();
    programmatic = true;
    try {
      focusEditorRegion({ mapId: region.mapId, x: region.x, y: region.y, w: region.w, h: region.h },
        { highlight: false, ...(switching || force ? {} : { onlyIfOffscreen: true }) });
    } finally {
      programmatic = false;
    }
    flash(region);
  };

  const stopFollowing = (): void => {
    if (!following || disposed) return;
    following = false;
    pending = null;
    paintChrome();
  };
  const resume = (): void => {
    if (disposed) return;
    following = true;
    paintChrome();
    if (lastRegion) go(lastRegion, true);
  };
  pill.addEventListener("click", resume);
  pip.addEventListener("click", resume);

  const unsubscribeMove = onUserViewMove(stopFollowing);
  let seenMapId = editorState.get().currentMapId;
  const unsubscribeEditor = editorState.subscribe((state) => {
    if (state.currentMapId === seenMapId) return;
    seenMapId = state.currentMapId;
    // 맵 전환 크로스페이드는 베일 아래에서 늦게 currentMapId 를 바꿀 수 있다 — 우리가 연 맵이면 사용자 선택이 아니다.
    if (!programmatic && state.currentMapId !== lastRegion?.mapId && state.currentMapId !== pending?.mapId) stopFollowing();
    else paintChrome();
  });
  const unsubscribeStore = store.subscribe(() => {
    if (pending && following && store.getCurrent().maps[pending.mapId]) go(pending, true);
  });

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (pipTimer) clearTimeout(pipTimer);
    unsubscribeMove();
    unsubscribeEditor();
    unsubscribeStore();
    overlay.remove();
    if (releasePrevious === dispose) releasePrevious = null;
  };
  releasePrevious = dispose;

  return {
    observe(raw) {
      if (disposed) return;
      let event = raw;
      while (event.type === "agent_event") event = event.event;
      if (event.type !== "map_delta" || event.maps.length === 0) return;
      maps = applyMapDeltas(maps, event.maps);
      const regions = followRegionsFromDeltas(event.maps, (id) => maps[id]);
      // 여러 맵이 한 증분에 실리면 마지막 것(가장 최근 쓰기)을 따른다.
      const region = regions.at(-1);
      if (!region) return;
      lastRegion = region;
      if (!isAiLiveCanvasEnabled() || isUiInBackground()) { paintChrome(); return; }
      if (following) go(region, false);
      paintChrome();
    },
    dispose,
  };
}
