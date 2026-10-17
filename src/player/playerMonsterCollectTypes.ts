/**
 * 몬스터 수집 화면(파티·박스)의 하위 상태와 동작.
 * 컨트롤러(`playerStatusMenuController`)가 상태를 갖고, 상세 빌더(`playerStatusMenuDetails`·`playerMonsterPartyDetail`)는
 * 이 상태를 읽기만 한다 — 메뉴 옵션 한 칸(`monsterCollect`)과 동작 한 칸(`onMonsterCollect`)으로만 지나간다.
 */
export type MonsterSummaryPage = "stats" | "moves" | "manage";
export const MONSTER_SUMMARY_PAGES: readonly MonsterSummaryPage[] = ["stats", "moves", "manage"];

export type MonsterCollectUi = {
  /** 자리 바꾸기 중 먼저 고른 파티 몬스터. 있으면 파티 목록의 다음 선택이 그 자리와 맞바꾼다. */
  readonly swapSourceId?: string;
  /** 요약 화면의 쪽. 생략 = 모든 칸을 한 목록에(에메랄드 스킨이 아닌 화면의 기존 모양). */
  readonly summaryPage?: MonsterSummaryPage;
  /** 보관함 화면에서 보고 있는 상자(0부터). 생략 = 0. */
  readonly boxIndex?: number;
  /** 「다른 칸으로 옮기기」 중 집어 든 보관함 몬스터. 있으면 다음 칸 선택이 그 몬스터를 놓는다. */
  readonly boxMoveSourceId?: string;
  /** 놓아주기 확인을 한 번 거친 몬스터(두 번째 선택에서 실제로 놓아준다). */
  readonly releaseConfirmId?: string;
  /** 별명을 바꾸는 중인 몬스터. 있으면 요약 화면 위에 입력창이 뜬다. */
  readonly renameId?: string;
};

export type MonsterCollectAction =
  | { readonly kind: "startSwap"; readonly instanceId: string }
  | { readonly kind: "swap"; readonly sourceId: string; readonly targetId: string }
  | { readonly kind: "cancelSwap" }
  | { readonly kind: "summaryPage"; readonly page: MonsterSummaryPage }
  | { readonly kind: "boxStep"; readonly delta: -1 | 1 }
  | { readonly kind: "startBoxMove"; readonly instanceId: string }
  | { readonly kind: "cancelBoxMove" }
  | { readonly kind: "boxPlace"; readonly sourceId: string; readonly slot: number }
  | { readonly kind: "releaseAsk"; readonly instanceId: string }
  | { readonly kind: "release"; readonly instanceId: string }
  | { readonly kind: "startRename"; readonly instanceId: string }
  | { readonly kind: "rename"; readonly instanceId: string; readonly name: string }
  | { readonly kind: "cancelRename" };

export const MONSTER_SUMMARY_PAGE_LABEL: Readonly<Record<MonsterSummaryPage, string>> = { stats: "능력치", moves: "기술", manage: "관리" };

export function nextMonsterSummaryPage(page: MonsterSummaryPage): MonsterSummaryPage {
  return MONSTER_SUMMARY_PAGES[(MONSTER_SUMMARY_PAGES.indexOf(page) + 1) % MONSTER_SUMMARY_PAGES.length]!;
}
