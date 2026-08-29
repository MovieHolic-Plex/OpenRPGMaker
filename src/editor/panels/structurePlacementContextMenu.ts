// panels/structurePlacementContextMenu.ts
// 맵에 찍힌 구조물 배치의 우클릭 메뉴 — 다시 찍기 · 지우기 · 킷 편집.
//
// 우클릭은 이미 임자가 있다: 드래그는 영역 선택 + 영역 AI, 이벤트 레이어의 탭은 이벤트 메뉴,
// 타일 레이어의 탭은 스포이트다. 그래서 이 메뉴는 **배치를 덮은 칸을 탭했을 때만** 열고,
// 스포이트를 메뉴 마지막 항목으로 남겨 기존 동작을 빼앗지 않는다. 배치가 없는 칸은 예전처럼 곧장 스포이트.

import {
  openMapContextMenu,
  type MapContextMenuItem,
  type MapContextMenuPoint,
} from "@/editor/panels/mapContextMenu";
import {
  eraseStructurePlacement,
  findStructureKit,
  restampStructurePlacement,
} from "@/editor/structurePlacementActions";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { showConfirm } from "@/editor/ui/modal";
import { structurePlacementAt } from "@/project/structurePlacements";
import { store } from "@/project/store";
import type { MapId, StructureKitDef, StructurePlacement } from "@/project/types";
import { toast } from "@/util/toast";

export interface StructurePlacementMenuTarget {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
}

export interface OpenStructurePlacementContextMenuRequest extends StructurePlacementMenuTarget {
  readonly point: MapContextMenuPoint;
  /** 메뉴에 남겨 두는 기존 우클릭 동작(스포이트). */
  readonly onPickTile: () => void;
}

/** 그 칸을 덮은 배치(겹치면 나중에 찍은 것). 없으면 undefined. */
export function structurePlacementForTarget(target: StructurePlacementMenuTarget): StructurePlacement | undefined {
  const map = store.getCurrent().maps[target.mapId];
  if (!map) return undefined;
  if (target.x < 0 || target.y < 0 || target.x >= map.width || target.y >= map.height) return undefined;
  return structurePlacementAt(map, target.x, target.y);
}

function kitFor(mapId: MapId, placement: StructurePlacement): StructureKitDef | undefined {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) return undefined;
  return findStructureKit(project.tilesets[map.tilesetId], placement.kitId);
}

/** 등록 킷은 킷 편집기를 바로 열 수 있다. 내장 파라메트릭 킷은 편집 대상이 아니라 앨범만 열어 준다. */
function isRegisteredKit(mapId: MapId, kitId: string): boolean {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) return false;
  return (project.tilesets[map.tilesetId]?.structureKits ?? []).some((kit) => kit.id === kitId);
}

export function overpaintConfirmMessage(placement: StructurePlacement, kit: StructureKitDef): string {
  return [
    `'${kit.name ?? kit.id}' 배치를 찍은 뒤 그 자리 타일이 바뀐 것 같습니다 — 덧칠했거나 다른 도구가 지나갔습니다.`,
    "",
    `그래도 킷의 현재 모습으로 덮어쓸까요? (${placement.x},${placement.y}) 부터 ${placement.w}×${placement.h}`,
    "",
    "덮어쓴 뒤에도 Ctrl+Z 로 되돌릴 수 있습니다.",
  ].join("\n");
}

export function structurePlacementMenuItems(
  request: OpenStructurePlacementContextMenuRequest,
  placement: StructurePlacement,
): readonly MapContextMenuItem[] {
  const kit = kitFor(request.mapId, placement);
  const orphan = kit === undefined;
  const kitLabel = kit?.name ?? placement.kitId;
  return [
    {
      action: () => void runRestamp(request.mapId, placement),
      disabled: orphan,
      icon: "rectangle",
      id: "structure-restamp",
      // 고아 배치는 재시공만 막고 지우기는 살려 둔다.
      label: orphan ? "이 구조물 다시 찍기 (킷 없음)" : "이 구조물 다시 찍기",
      testId: "structure-placement-restamp",
    },
    {
      action: () => runErase(request.mapId, placement),
      icon: "eraser",
      id: "structure-erase",
      label: "이 자리 지우기",
      testId: "structure-placement-erase",
    },
    {
      action: () => void openKitEditor(request.mapId, placement),
      disabled: orphan,
      icon: "database",
      id: "structure-edit-kit",
      label: orphan ? `킷 편집 (삭제됨: ${kitLabel})` : `킷 편집 — ${kitLabel}`,
      separatorBefore: true,
      testId: "structure-placement-edit-kit",
    },
    {
      action: () => request.onPickTile(),
      icon: "dropper",
      id: "structure-pick-tile",
      label: "이 타일 스포이트",
      separatorBefore: true,
      testId: "structure-placement-pick-tile",
    },
  ];
}

/**
 * 배치를 덮은 칸이면 메뉴를 열고 true. 아니면 아무것도 하지 않고 false —
 * 호출자(EditScene)가 기존 스포이트 동작을 그대로 이어간다.
 */
export function openStructurePlacementContextMenu(request: OpenStructurePlacementContextMenuRequest): boolean {
  const placement = structurePlacementForTarget(request);
  if (!placement) return false;
  const map = store.getCurrent().maps[request.mapId];
  if (!map) return false;
  openMapContextMenu({
    items: structurePlacementMenuItems(request, placement),
    mapId: request.mapId,
    mapName: `${map.name} 구조물 (${placement.x},${placement.y})`,
    point: request.point,
  });
  return true;
}

async function runRestamp(mapId: MapId, placement: StructurePlacement): Promise<void> {
  if (!canEditMap(mapId)) {
    toast(mapEditLockNotice(mapId), "error");
    return;
  }
  const result = await restampStructurePlacement(mapId, placement.id, {
    confirmOverpaint: ({ placement: target, kit }) =>
      showConfirm({
        title: "구조물 다시 찍기",
        message: overpaintConfirmMessage(target, kit),
        confirmLabel: "덮어쓰기",
      }),
  });
  switch (result.kind) {
    case "restamped":
      toast(
        result.resized
          ? `구조물을 다시 찍었습니다 — 킷 크기가 ${result.placement.w}×${result.placement.h} 로 바뀌어 좌상단을 유지했습니다.`
          : "구조물을 킷의 현재 모습으로 다시 찍었습니다.",
        "ok",
      );
      return;
    case "cancelled":
      return;
    case "kit-missing":
      toast(`킷이 삭제돼 다시 찍을 수 없습니다: ${result.kitId}. 지우기는 됩니다.`, "error");
      return;
    case "out-of-bounds":
      toast(`킷이 커져서 맵 경계를 넘습니다 — 건너뛰었습니다 (${result.rect.w}×${result.rect.h} 필요).`, "error");
      return;
    case "blocked":
      toast(`킷이 커져서 이웃 구조물 ${result.blockedBy.length}개와 부딪힙니다 — 건너뛰었습니다.`, "error");
      return;
    case "not-found":
      toast("구조물 배치를 찾을 수 없습니다.", "error");
  }
}

function runErase(mapId: MapId, placement: StructurePlacement): void {
  if (!canEditMap(mapId)) {
    toast(mapEditLockNotice(mapId), "error");
    return;
  }
  const result = eraseStructurePlacement(mapId, placement.id);
  if (result.kind === "not-found") {
    toast("구조물 배치를 찾을 수 없습니다.", "error");
    return;
  }
  toast(
    result.skipped > 0
      ? `구조물을 지우고 ${result.restored}칸을 되돌렸습니다 — 나중에 찍은 구조물이 덮은 ${result.skipped}칸은 그대로 뒀습니다.`
      : `구조물을 지우고 ${result.restored}칸을 찍기 전 타일로 되돌렸습니다.`,
    "ok",
  );
}

/**
 * 킷 편집 창은 **동적 import** 로 연다. 이 메뉴는 맵 캔버스(EditScene)가 정적으로 물고 있어서,
 * 데이터베이스 모달을 정적으로 끌어오면 캔버스 모듈 그래프에 DB 탭 전체가 딸려 온다
 * (모듈 로드 시점에 window.localStorage 를 읽는 탭이 있어 헤드리스 로드가 깨진다).
 */
async function openKitEditor(mapId: MapId, placement: StructurePlacement): Promise<void> {
  const map = store.getCurrent().maps[mapId];
  if (!map) return;
  if (isRegisteredKit(mapId, placement.kitId)) {
    const { openStructureKitEditor } = await import("@/editor/panels/structureKitEditorDialog");
    openStructureKitEditor(map.tilesetId, placement.kitId, () => {});
    return;
  }
  // 내장 파라메트릭 킷은 프로젝트 데이터가 아니라 편집기가 없다 — 앨범(데이터베이스 구조물 탭)을 연다.
  const { openDatabaseModal } = await import("@/editor/panels/databaseModal");
  openDatabaseModal("structureKits");
  toast("내장 킷은 직접 편집할 수 없습니다 — 구조물 탭에서 복제해 쓰세요.", "info");
}
