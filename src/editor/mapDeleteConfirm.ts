// editor/mapDeleteConfirm.ts
// 맵 삭제 확인(도그푸딩 결함 ⑦): 원클릭 파괴 대신 이벤트 수/참조 정리 등 임팩트 요약을
// 확인 다이얼로그로 보여준 뒤 삭제한다. mapList 트리 메뉴와 상단 메뉴가 공유한다.
import { deleteMap, type DeleteMapResult } from "@/editor/actions";
import { collectMapDeletionImpact, type MapDeletionImpact } from "@/project/mapDeletion";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

// 확인 다이얼로그 본문(순수 함수 — 테스트 가능).
export function mapDeletionConfirmMessage(impact: MapDeletionImpact): string {
  const lines = [`'${impact.mapName}' 맵을 삭제할까요?`, ""];
  lines.push(`· 이 맵의 이벤트 ${impact.eventCount}개가 함께 삭제됩니다.`);
  if (impact.isStartMap) lines.push("· 시작 맵이므로 삭제 후 다른 맵이 시작 맵이 됩니다.");
  if (impact.treeChildCount > 0) lines.push(`· 맵 트리의 하위 맵 ${impact.treeChildCount}개는 상위로 이동해 보존됩니다.`);
  if (impact.incomingCommandCount > 0) lines.push(`· 이 맵으로 이동하는 명령 ${impact.incomingCommandCount}개가 제거됩니다.`);
  if (impact.connectionCount > 0) lines.push(`· 맵 연결 ${impact.connectionCount}개가 제거됩니다.`);
  if (impact.villageInfoCount > 0) lines.push(`· 세계관 문서 ${impact.villageInfoCount}개가 제거됩니다.`);
  if (impact.questCount > 0) lines.push(`· 이 맵을 참조하는 퀘스트 ${impact.questCount}개가 제거됩니다.`);
  if (impact.testPresetCount > 0) lines.push(`· 테스트 프리셋 ${impact.testPresetCount}개의 시작 위치가 해제됩니다.`);
  lines.push("", "삭제 후 Ctrl+Z로 되돌릴 수 있습니다.");
  return lines.join("\n");
}

export type ConfirmDeleteMapResult = DeleteMapResult | { readonly ok: false; readonly message: string; readonly cancelled: true };

// 임팩트 요약 확인 → 삭제. 사용자가 취소하면 아무것도 하지 않는다.
export function confirmAndDeleteMap(mapId: MapId): ConfirmDeleteMapResult {
  const impact = collectMapDeletionImpact(store.getCurrent(), mapId);
  if (impact && typeof window !== "undefined" && typeof window.confirm === "function") {
    if (!window.confirm(mapDeletionConfirmMessage(impact))) {
      return { ok: false, message: "사용자가 삭제를 취소했습니다.", cancelled: true };
    }
  }
  return deleteMap(mapId);
}
