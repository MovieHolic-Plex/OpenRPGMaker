// 검토 중인 영역 작업의 **활성 청크 선택**. 캔버스 고스트가 이걸 보고 그린다.
// 스펙 docs/superpowers/specs/2026-09-10-region-task-uiux-redesign-design.md §4.2.
//
// 왜 필요한가: 검토 중 고스트를 그리는 자리(aiChatPanelHelpers, aiTurnRunner)는 지금까지
// 언제나 `pendingRegion.clippedProject` — 즉 **전체 결과**를 그렸다. 그 사이 팝오버
// 체크박스는 일부 청크를 빼고 있었으므로 캔버스와 체크리스트가 서로 다른 것을 보여줬고,
// 사용자가 둘을 머릿속에서 합성해야 했다. 여기 활성 투영을 두면 두 화면이 같은 말을 한다.
//
// pendingRegionApply 가 이미 단일 활성 항목을 들고 있는 구조라 여기도 같은 모양을 따른다.
import type { Project } from "@/project/types";
import type { RegionSelectionProjection } from "./regionSelectionProjection";

let active: RegionSelectionProjection | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** 검토를 시작하는 쪽(영역 작업 창)이 부른다. 이전 투영은 대체된다. */
export function setActiveRegionSelection(projection: RegionSelectionProjection): void {
  active = projection;
  emit();
}

/** 검토가 끝나면(적용·폐기·창 닫힘) 반드시 부른다 — 안 치우면 다음 결과가 옛 선택을 물려받는다. */
export function clearActiveRegionSelection(): void {
  if (!active) return;
  active = null;
  emit();
}

export function getActiveRegionSelection(): RegionSelectionProjection | null {
  return active;
}

/** 청크 토글 뒤에 부른다. 고스트를 다시 그리게 하는 신호다. */
export function notifyRegionSelectionChanged(): void {
  emit();
}

export function subscribeRegionPreviewSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 고스트가 그릴 프로젝트. 활성 투영이 없으면 종전대로 전체 결과다(동작 변화 없음). */
export function regionPreviewProject(pending: {
  readonly baseProject: Project;
  readonly clippedProject: Project;
}): Project {
  if (!active) return pending.clippedProject;
  return active.project();
}
