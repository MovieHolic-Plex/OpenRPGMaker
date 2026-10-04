// editor/editorReferenceNavigation.ts
// "이 이름을 눌렀다 / 조수가 여기를 보여달라고 했다" → 실제로 화면을 그곳으로 옮긴다.
//
// 조각은 이미 다 있었다(맵 선택 `selectEditorMap`, 카메라 `requestEditorCameraFocus`, 잠깐 반짝이는
// 강조 `requestAgentFocusHighlight`). 이 모듈은 그 셋을 한 동작으로 묶어 **호출부마다 다른 조합을
// 쓰는 일**을 막는다. 채팅 답변 링크와 조수의 화면 이동 툴이 같은 경로를 탄다.
import { requestAgentFocusHighlight } from "@/editor/agentFocus";
import type { EditorReferenceTarget } from "@/editor/aiAnswerLinks";
import { isSameMapMove, withAssistantViewTransition } from "@/editor/assistantViewSwitch";
import { requestEditorCameraFocus } from "@/editor/editorCameraFocus";
import { editorState } from "@/editor/editorState";
import { canOpenEditorMap, selectEditorMap } from "@/editor/mapSelection";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { toast } from "@/util/toast";

export interface EditorFocusRegion {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface FocusEditorRegionOptions {
  /** False permits a highlight on the current map without selecting or moving the view. */
  readonly moveView?: boolean;
  /** 잠깐 반짝이는 강조 사각형을 함께 띄운다(선택 상태는 건드리지 않는다). */
  readonly highlight?: boolean;
  /**
   * 대상이 이미 화면 안에 있으면 카메라를 움직이지 않는다.
   * 조수가 질문용으로 영역을 강조할 때만 켠다. 사용자가 링크를 눌렀거나 "어디야?"라고
   * 물은 경로는 기본(꺼짐) — 눌렀는데 아무 일도 없는 것이 더 나쁘다.
   */
  readonly onlyIfOffscreen?: boolean;
  /**
   * 대상 영역을 선택 사각형으로도 세운다(`highlight_map_region` 의 질문용 강조).
   *
   * 호출부가 **직접** `editorState.set({selection})` 을 하면 안 되는 이유: 맵을 건너뛰는
   * 이동은 크로스페이드로 덮이는데, 선택만 밖에서 먼저 세우면 아직 보이는 **옛 맵** 위에
   * 목적지 좌표의 사각형이 잠깐 그려진다(엉뚱한 자리의 상자). 화면이 바뀌는 일은 전부
   * 베일 안에서 한 묶음으로 일어나야 한다.
   */
  readonly selectRegion?: boolean;
}

/**
 * 맵을 열고 카메라를 영역 중심으로 보낸다.
 *
 * `onlyIfOffscreen` 기본은 꺼져 있다: 사용자가 링크를 눌렀거나 "어디야?"라고 물어서
 * 시작되는 이동은 눌렀는데 아무 일도 일어나지 않는 것이 화면을 빼앗기는 것보다 나쁘다.
 * 조수 질문용 `highlight_map_region` 만 `{ onlyIfOffscreen: true }` 를 넘긴다.
 * 사용자가 드래그·페인트 중이면 씬이 `shouldDeferCameraFocus` 로 알아서 미룬다.
 */
export function focusEditorRegion(region: EditorFocusRegion, options: FocusEditorRegionOptions = {}): boolean {
  const map = store.getCurrent().maps[region.mapId];
  if (!map || map.width <= 0 || map.height <= 0
    || ![map.width, map.height, region.x, region.y, region.w, region.h].every(Number.isFinite)) return false;
  const width = Math.max(1, Math.trunc(region.w));
  const height = Math.max(1, Math.trunc(region.h));
  const x = Math.max(0, Math.min(map.width - 1, Math.trunc(region.x)));
  const y = Math.max(0, Math.min(map.height - 1, Math.trunc(region.y)));
  const bounds = { x, y, width: Math.min(width, map.width - x), height: Math.min(height, map.height - y) };

  if (options.moveView === false) {
    if (!isSameMapMove(region.mapId)) return false;
    if (options.highlight) requestAgentFocusHighlight({ mapId: region.mapId, cells: [], bounds, score: 1 });
    return true;
  }

  // Check before installing a transition; highlights alone must not select a map.
  if (!canOpenEditorMap(region.mapId)) return selectEditorMap(region.mapId, { clearEventSelection: false });

  // 맵이 바뀌면 크로스페이드가 하드컷을 덮고, 카메라는 덮인 동안 목적지에 도착해 있는다.
  // 같은 맵이면 기존 팬이 그대로 「어디서 어디로」를 보여 준다.
  const sameMap = isSameMapMove(region.mapId);
  withAssistantViewTransition(region.mapId, () => {
    selectEditorMap(region.mapId, { clearEventSelection: false });
    // 요청한 좌표 그대로 세운다 — 카메라용 `bounds` 와 달리 이 사각형은 조수가 «여기» 라고
    // 가리킨 값 자체이고, 맵 밖 부분까지 포함해 보여 주는 것이 툴의 기존 계약이다.
    if (options.selectRegion) {
      editorState.set({ selection: { mapId: region.mapId, x: region.x, y: region.y, width: region.w, height: region.h } });
    }
    requestEditorCameraFocus({
      mapId: region.mapId,
      tileX: Math.floor(bounds.x + bounds.width / 2),
      tileY: Math.floor(bounds.y + bounds.height / 2),
      bounds,
      ...(options.onlyIfOffscreen === true ? { onlyIfOffscreen: true } : {}),
      ...(sameMap ? {} : { immediate: true }),
    });
    if (options.highlight) {
      requestAgentFocusHighlight({ mapId: region.mapId, cells: [], bounds, score: 1 });
    }
  });
  return true;
}

export type OpenEditorReferenceSearch = (query: string) => void;

/** 답변 링크 클릭의 단일 처리부. 데려갈 수 없으면 false 를 돌려주고 아무것도 바꾸지 않는다. */
export function navigateToEditorReference(
  target: EditorReferenceTarget,
  openSearch: OpenEditorReferenceSearch = openReferenceSearch,
): boolean {
  const project = store.getCurrent();

  if (target.kind === "ambiguous") {
    // 같은 이름이 여러 곳이면 한 곳을 골라 데려가는 것은 거짓말이다 — 사용자가 고르게 한다.
    openSearch(target.label);
    return true;
  }

  const map = project.maps[target.mapId];
  if (!map) {
    toast("그 맵을 더 이상 찾을 수 없습니다.", "error");
    return false;
  }

  if (target.kind === "map") {
    if (!canOpenEditorMap(target.mapId)) return selectEditorMap(target.mapId);
    withAssistantViewTransition(target.mapId, () => { selectEditorMap(target.mapId); });
    toast(`'${map.name || target.mapId}' 맵을 열었습니다.`, "ok");
    return true;
  }

  const event = map.events.find((entry) => entry.id === target.eventId);
  if (!event) {
    toast("그 대상을 더 이상 찾을 수 없습니다.", "error");
    return false;
  }
  if (!focusEditorRegion({ mapId: target.mapId, x: event.x, y: event.y, w: 1, h: 1 }, { highlight: true })) return false;
  toast(`'${map.name || target.mapId}' (${event.x},${event.y}) 위치로 이동했습니다.`, "ok");
  return true;
}

/**
 * 찾기 창은 지연 import 한다. 정적으로 걸면 채팅 로그 → 이 모듈 → 찾기 창 → 데이터베이스 모달로
 * 이어지는 모듈 순환이 생겨, 순환의 어느 쪽이 먼저 평가되는지에 따라 초기화가 깨진다.
 */
function openReferenceSearch(query: string): void {
  void import("@/editor/panels/mapEventSearchModal").then(({ openMapEventSearchModal }) => {
    openMapEventSearchModal({ initialQuery: query });
  });
}
