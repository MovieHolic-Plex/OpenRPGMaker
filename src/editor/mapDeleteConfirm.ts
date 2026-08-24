// editor/mapDeleteConfirm.ts
// 맵 삭제 확인(도그푸딩 결함 ⑦): 원클릭 파괴 대신 이벤트 수/참조 정리 등 임팩트 요약을
// 확인 다이얼로그로 보여준 뒤 삭제한다. mapList 트리 메뉴와 상단 메뉴가 공유한다.
import { deleteMap, deleteMapsInOrder, dissolveMapFolder, type DeleteMapResult } from "@/editor/actions";
import { showConfirm } from "@/editor/ui/modal";
import { collectMapDeletionImpact, type MapDeletionImpact } from "@/project/mapDeletion";
import { findTreeNode, isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

// 확인 다이얼로그 본문(순수 함수 — 테스트 가능).
export function mapDeletionConfirmMessage(impact: MapDeletionImpact): string {
  const lines = [`'${impact.mapName}' 맵을 삭제할까요?`, ""];
  lines.push(`· 이 맵의 이벤트 ${impact.eventCount}개가 함께 삭제됩니다.`);
  if (impact.isStartMap) lines.push("· 시작 맵이므로 삭제 후 다른 맵이 시작 맵이 됩니다.");
  if (impact.treeChildCount > 0) lines.push(`· 하위 맵 ${impact.treeChildCount}개가 있습니다. 기본: 하위 맵은 상위 레벨로 이동(보존). "하위 포함 삭제" 선택 시 함께 삭제됩니다.`);
  if (impact.incomingCommandCount > 0) lines.push(`· 이 맵으로 이동하는 명령 ${impact.incomingCommandCount}개가 제거됩니다.`);
  if (impact.connectionCount > 0) lines.push(`· 맵 연결 ${impact.connectionCount}개가 제거됩니다.`);
  if (impact.worldRefCount > 0) lines.push(`· 세계관 참조 ${impact.worldRefCount}개가 함께 정리됩니다.`);
  if (impact.worldGraphEdgeCount > 0) lines.push(`· 월드 그래프 노드/간선 ${impact.worldGraphEdgeCount}개가 함께 정리됩니다.`);
  if (impact.villageInfoCount > 0) lines.push(`· 세계관 문서 ${impact.villageInfoCount}개가 제거됩니다.`);
  if (impact.questCount > 0) lines.push(`· 이 맵을 참조하는 퀘스트 ${impact.questCount}개가 제거됩니다.`);
  if (impact.testPresetCount > 0) lines.push(`· 테스트 프리셋 ${impact.testPresetCount}개의 시작 위치가 해제됩니다.`);
  if (impact.farmAnimalBuildingCount > 0) {
    lines.push(`· 동물 축사 ${impact.farmAnimalBuildingCount}개가 삭제되고 배정된 시작 동물은 미배정 상태가 됩니다.`);
  }
  if (impact.farmBuildingPlacementCount > 0) lines.push(`· 범용 농장 건물 ${impact.farmBuildingPlacementCount}개가 함께 삭제됩니다.`);
  if (impact.homeDecorationPlacementCount > 0) lines.push(`· 집 장식 ${impact.homeDecorationPlacementCount}개가 함께 삭제됩니다.`);
  lines.push("", "삭제 후 Ctrl+Z로 되돌릴 수 있습니다.");
  return lines.join("\n");
}

/** 하위 맵 포함 삭제 확인 메시지 */
export function mapDeletionRecursiveMessage(impact: MapDeletionImpact, childNames: string[]): string {
  const lines = [`'${impact.mapName}' 맵과 하위 맵 ${childNames.length}개를 모두 삭제할까요?`, ""];
  lines.push(`삭제 대상: ${childNames.join(", ")}`);
  lines.push("", "한 번의 실행 취소로 이 묶음 삭제를 되돌릴 수 있습니다.");
  return lines.join("\n");
}

export type ConfirmDeleteMapResult = DeleteMapResult | { readonly ok: false; readonly message: string; readonly cancelled: true };

// 임팩트 요약 확인 → 삭제. 사용자가 취소하면 아무것도 하지 않는다.
// 커스텀 인앱 모달(§2.4) — 헤드리스에서는 자동 통과(기존 window.confirm 부재 규약 승계).
export async function confirmAndDissolveFolder(folderId: MapId): Promise<ConfirmDeleteMapResult> {
  const project = store.getCurrent();
  const node = findTreeNode(project.mapTree, folderId);
  if (!node || !isMapTreeFolder(node)) return { ok: false, message: "분류를 찾을 수 없습니다." };
  const label = mapTreeNodeLabel(node, project.maps);
  const confirmed = await showConfirm({
    title: "분류 삭제",
    message: `'${label}' 분류만 지울까요? 안의 맵은 한 단계 위로 남습니다.`,
    confirmLabel: "분류만 삭제",
    danger: true,
  });
  if (!confirmed) return { ok: false, message: "사용자가 삭제를 취소했습니다.", cancelled: true };
  dissolveMapFolder(folderId);
  return {
    ok: true,
    impact: {
      mapId: folderId,
      mapName: label,
      eventCount: 0,
      isStartMap: false,
      isTreeRoot: false,
      treeChildCount: node.children.length,
      incomingCommandCount: 0,
      incomingScheduleRows: [],
      connectionCount: 0,
      worldRefCount: 0,
      worldGraphEdgeCount: 0,
      villageInfoCount: 0,
      questCount: 0,
      testPresetCount: 0,
      farmAnimalBuildingCount: 0,
      farmAnimalBuildingIds: [],
      farmBuildingPlacementCount: 0,
      farmBuildingPlacementIds: [],
      homeDecorationPlacementCount: 0,
      homeDecorationPlacementIds: [],
    },
  };
}

export async function confirmAndDeleteMaps(mapIds: readonly MapId[]): Promise<ConfirmDeleteMapResult> {
  const unique = [...new Set(mapIds)].filter((id) => store.getCurrent().maps[id]);
  if (unique.length === 0) return { ok: false, message: "맵을 찾을 수 없습니다." };
  if (unique.length === 1) return confirmAndDeleteMap(unique[0]!);
  const names = unique.map((id) => store.getCurrent().maps[id]?.name ?? id);
  const confirmed = await showConfirm({
    title: "맵 여러 개 삭제",
    message: `${unique.length}개 맵을 삭제할까요?\n\n${names.join(", ")}\n\n삭제 후 Ctrl+Z로 되돌릴 수 있습니다.`,
    confirmLabel: `${unique.length}개 삭제`,
    danger: true,
  });
  if (!confirmed) return { ok: false, message: "사용자가 삭제를 취소했습니다.", cancelled: true };
  return deleteMapsInOrder(unique);
}

export async function confirmAndDeleteMap(mapId: MapId): Promise<ConfirmDeleteMapResult> {
  const impact = collectMapDeletionImpact(store.getCurrent(), mapId);
  if (impact) {
    if (impact.treeChildCount > 0) {
      // 하위 맵이 있으면: "이 맵만 삭제(하위 보존)" vs "하위 포함 모두 삭제" 선택
      const childNames = collectChildMapNames(mapId);
      const choice = await showConfirm({
        title: "맵 삭제",
        message: mapDeletionConfirmMessage(impact) + `\n\n[확인] = 이 맵만 삭제 (하위 ${childNames.length}개 보존)\n[취소 후 재시도] = 하위 포함 삭제는 컨텍스트 메뉴에서`,
        confirmLabel: "이 맵만 삭제",
        danger: true,
      });
      if (!choice) return { ok: false, message: "사용자가 삭제를 취소했습니다.", cancelled: true };
    } else {
      const confirmed = await showConfirm({
        title: "맵 삭제",
        message: mapDeletionConfirmMessage(impact),
        confirmLabel: "삭제",
        danger: true,
      });
      if (!confirmed) return { ok: false, message: "사용자가 삭제를 취소했습니다.", cancelled: true };
    }
  }
  return deleteMap(mapId);
}

/** 하위 맵 포함 삭제 (재귀). 컨텍스트 메뉴 "하위 포함 삭제"에서 호출. */
export async function confirmAndDeleteMapRecursive(mapId: MapId): Promise<ConfirmDeleteMapResult> {
  const project = store.getCurrent();
  const impact = collectMapDeletionImpact(project, mapId);
  if (!impact) return { ok: false, message: "맵을 찾을 수 없습니다." };

  const childIds = collectDescendantMapIds(mapId);
  const childNames = childIds.map((id) => project.maps[id]?.name ?? id);

  const confirmed = await showConfirm({
    title: "하위 포함 맵 삭제",
    message: mapDeletionRecursiveMessage(impact, childNames),
    confirmLabel: `${childNames.length + 1}개 맵 삭제`,
    danger: true,
  });
  if (!confirmed) return { ok: false, message: "사용자가 삭제를 취소했습니다.", cancelled: true };

  const reversed = [...childIds].reverse();
  return deleteMapsInOrder([...reversed, mapId]);
}

/** 맵 트리에서 해당 맵의 직계 자식 맵 이름을 수집. */
function collectChildMapNames(mapId: MapId): string[] {
  const project = store.getCurrent();
  const node = findNode(project.mapTree, mapId);
  if (!node) return [];
  return node.children.map((child) => project.maps[child.mapId]?.name ?? child.mapId);
}

/** 맵 트리에서 해당 맵의 모든 후손 ID를 수집 (깊이 우선, 자식 → 손자 순). */
function collectDescendantMapIds(mapId: MapId): MapId[] {
  const project = store.getCurrent();
  const node = findNode(project.mapTree, mapId);
  if (!node) return [];
  const ids: MapId[] = [];
  const walk = (n: { children: { mapId: MapId; children: unknown[] }[] }): void => {
    for (const child of n.children) {
      ids.push(child.mapId);
      walk(child as { children: { mapId: MapId; children: unknown[] }[] });
    }
  };
  walk(node);
  return ids;
}

function findNode(node: { mapId: MapId; children: { mapId: MapId; children: unknown[] }[] }, mapId: MapId): { mapId: MapId; children: { mapId: MapId; children: unknown[] }[] } | null {
  if (node.mapId === mapId) return node;
  for (const child of node.children) {
    const found = findNode(child as typeof node, mapId);
    if (found) return found;
  }
  return null;
}
