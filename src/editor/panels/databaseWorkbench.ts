import type { AutoSaveState } from "@/project/store";

export const DATABASE_FOOTER_ACTION_TEST_IDS = {
  apply: "database-footer-apply",
  ok: "database-footer-ok",
} as const;

export type DatabaseFooterStatusKind = "ok" | "pending" | "error" | "info";
export type DatabaseFooterStatus = { readonly text: string; readonly kind: DatabaseFooterStatusKind };

// 푸터 상태줄. 설명을 길게 적으면 항상 보이는 1500px 배너가 되어 노이즈만 늘어난다.
// 상태는 짧게, "지금 저장"과의 관계 설명은 버튼 title 로 넘긴다(DATABASE_APPLY_BUTTON_HINT).
//
// 예전에는 인자 없는 상수 함수라 **저장이 실패해도 영구히 "자동 저장됨"** 이었다. 모달이
// 열려 있는 동안(창·최대화 모드) 톱바 칩이 가려지므로 이게 사용자의 유일한 저장 상태
// 채널인데 거짓말을 하고 있었다(2026-09-19 리뷰 P0-4). store 의 autosave 상태를 그대로 옮긴다.
export function databaseFooterStatus(state: AutoSaveState): DatabaseFooterStatus {
  // 자동 저장이 아예 없는 세션(shared-demo·임시 세션)은 실패가 아니라 "원래 안 됨"이다.
  // 빨간 오류 필로 칠하면 다시 시도하면 될 줄 알게 된다 — 중립 안내로 말한다.
  if (state.kind === "error" && state.code === "session-not-persisted") return { text: state.message, kind: "info" };
  if (state.kind === "error") return { text: `자동 저장 실패 — ${state.message}`, kind: "error" };
  // pending·saving 은 접는다 — 톱바 칩이 같은 이유로 이미 접고 있다(menu.ts 의 paintSaveStatus:
  // 타일 한 칸마다 상태가 떴다 사라지며 옆 버튼이 튀는 것이 오조작을 만든다). 거짓말이었던 건
  // 진행 상태가 아니라 **실패를 성공으로 말하던 것**이므로, 실패만 드러내면 결함이 닫힌다.
  // 명시적 저장("지금 저장")의 진행 문구는 writeDatabaseFooterPending 이 따로 쓴다.
  // v2(2026-09-03): 체크 글리프는 뺐다 — 푸터 필이 앞에 상태 점을 그린다.
  return { text: "자동 저장됨", kind: "ok" };
}

// "자동 저장됨"과 "지금 저장"이 모순처럼 보이는 것은 버튼 툴팁에서 풀어준다.
// 편집은 즉시 메모리에 반영되고, 이 버튼은 store.flush() 로 온라인·브라우저에 확정한다.
export const DATABASE_APPLY_BUTTON_HINT =
  "편집은 이미 자동으로 반영됩니다. 이 버튼은 지금 상태를 온라인·브라우저에 즉시 확정합니다.";
