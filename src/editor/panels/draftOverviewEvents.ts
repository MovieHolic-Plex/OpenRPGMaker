// editor/panels/draftOverviewEvents.ts
// 「초안 한 장 보기」 여는 요청. 받는 쪽은 조수 패널이다 — 입력창·보내기 경로를 그쪽이 쥐고 있다.
// 화면 모듈(draftOverviewView)은 늦게 불러오므로 이벤트 이름만 따로 둔다.
export const DRAFT_OVERVIEW_OPEN_EVENT = "oprn:open-draft-overview";

export function requestDraftOverview(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DRAFT_OVERVIEW_OPEN_EVENT));
}
