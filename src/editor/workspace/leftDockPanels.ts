// editor/workspace/leftDockPanels.ts
// 좌측 도크에 **실제로 마운트할 패널 목록**을 정한다.
//
// 왜 별 모듈인가 — 이 규칙은 세 곳이 같은 답을 알아야 한다: 도크 조립(editor.ts),
// 멱등 동기화 서명(dockSignature), 그리고 "되지 않는 선택지를 보여주지 않는" 패널 메뉴
// (workspaceBar.ts). editor.ts 안에 두면 메뉴가 editor 를 import 해 순환이 생기고,
// editor.ts 는 이미 LOC 상한 위에 있다.
//
// 규칙(계획서 §2-1):
//  1. `docks.left` 를 **존중한다** — 그래야 `▤` 토글과 Ctrl+K 명령이 DOM 을 바꾼다.
//  2. 결과가 비면 레지스트리 선호 기본값으로 되돌린다. `.left-panel` 은 절대 비지 않는다
//     (2026-08-26 불변식을 "패널 목록"이 아니라 "최소 1개"로 표현한 것).
//  3. 초보 모드(`chrome.paletteRail`)는 `tiles` 를 고정한다 — 아이콘 레일이 그 호스트
//     안에 렌더되므로 끄면 사이드바가 빈다.

import type { EditorChromeVisibility } from "@/editor/editorUiMode";
import { allPanels, sortPanels, type DockZone, type PanelId } from "@/editor/workspace/panelRegistry";

/** AI 독은 자기 호스트(`chatSidePanel`)를 갖는다 — 좌측 도크가 만들지 않는다. */
export const LEFT_DOCK_EXTERNAL: readonly PanelId[] = ["assistant"];

/** 초보 모드에서 끌 수 없는 패널 — 레일 호스트다. */
export const LEFT_DOCK_RAIL_HOST: PanelId = "tiles";

/** 구성이 비었을 때 되돌릴 목록 = 좌측을 선호하는 등록 패널. */
export function preferredLeftDockPanels(): readonly PanelId[] {
  return sortPanels(
    allPanels()
      .filter((panel) => panel.preferredDock === "left" && !LEFT_DOCK_EXTERNAL.includes(panel.id))
      .map((panel) => panel.id),
  );
}

export type LeftDockResolution = {
  /** 워크스페이스 레이아웃의 `docks.left`. */
  readonly left: readonly PanelId[];
  /** `chrome.paletteRail` — 초보 아이콘 레일 모드인가. */
  readonly paletteRail: boolean;
  readonly mapTree?: boolean | undefined;
};

export function resolveLeftDockPanels(input: LeftDockResolution): readonly PanelId[] {
  const owned = input.left.filter((id) => !LEFT_DOCK_EXTERNAL.includes(id));
  // 초보 레일은 tiles 호스트만 쓴다. 저장된 maps 도크는 플라이아웃이 담당하므로 여기 안 올린다.
  if (input.paletteRail) return [LEFT_DOCK_RAIL_HOST];
  // 표준/전문가의 작업 호스트(tiles)는 저장 레이아웃이 maps-only여도 마운트한다.
  // 저장값은 건드리지 않는다 — 토글은 구성을 바꾸고, 호스트는 작업면이 비지 않게 남긴다.
  const withTaskHost = owned.includes(LEFT_DOCK_RAIL_HOST)
    ? owned
    : [LEFT_DOCK_RAIL_HOST, ...owned];
  const resolved = sortPanels(withTaskHost);
  return resolved.length > 0 ? resolved : preferredLeftDockPanels();
}

/** 초보 모드에서 타일 도크는 아이콘 레일의 호스트라 구성에서 뺄 수 없다. */
export function isLeftDockPinned(id: PanelId, paletteRail: boolean): boolean {
  return paletteRail && id === LEFT_DOCK_RAIL_HOST;
}

/**
 * 현재 크롬에서 도크 멤버십을 바꾸는 컨트롤을 제공해도 되는가.
 * 초보는 레일 플라이아웃만 있고 도크 토글은 거짓말이 된다.
 * 표준/전문가의 맵 도크는 구성 토글 대상이다.
 */
export function isLeftDockPanelOffered(
  id: PanelId,
  chrome: Pick<EditorChromeVisibility, "paletteRail">,
): boolean {
  if (chrome.paletteRail || isLeftDockPinned(id, chrome.paletteRail)) return false;
  return true;
}

/**
 * 그 zone 에 **마운트된 도크 호스트가 있는가**. 호스트는 `dockHost.mountDock` 이
 * `data-dock-zone` 을 박아 만든다 — 지금 right/bottom 도크는 아무도 마운트하지 않으므로
 * 이동 칩을 제시하면 거짓말이 된다.
 */
export function dockZoneHasHost(zone: DockZone): boolean {
  if (typeof document === "undefined") return false;
  const hosts = document.querySelectorAll?.(`[data-dock-zone="${zone}"]`);
  return (hosts?.length ?? 0) > 0;
}
