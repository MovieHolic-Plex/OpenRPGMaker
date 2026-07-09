// 선택 영역 우클릭 컨텍스트 메뉴 항목: "이 영역에 AI 작업…".
// EditScene가 우클릭 셀이 활성 선택 안일 때 event 레이어 항목 앞에 붙인다.
import type { MapContextMenuItem } from "@/editor/panels/mapContextMenu";
import { openRegionTaskModal, type RegionTaskModalOptions } from "@/editor/panels/regionTaskModal";
import type { MapId } from "@/project/types";

export interface RegionSelection {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

type ModalOpener = (options: RegionTaskModalOptions) => unknown;

// 클릭 셀(x,y)이 선택 영역 안에 있는지.
export function isCellInsideSelection(selection: RegionSelection, x: number, y: number): boolean {
  return x >= selection.x && y >= selection.y && x < selection.x + selection.width && y < selection.y + selection.height;
}

export function regionTaskMenuItems(
  selection: RegionSelection,
  openModal: ModalOpener = openRegionTaskModal,
): MapContextMenuItem[] {
  return [
    {
      action: () =>
        openModal({
          mapId: selection.mapId,
          region: { x: selection.x, y: selection.y, width: selection.width, height: selection.height },
        }),
      icon: "rectangle",
      id: "region-ai-task",
      label: "✦ 이 영역에 AI 작업…",
      testId: "region-ai-task-menu-item",
    },
  ];
}
