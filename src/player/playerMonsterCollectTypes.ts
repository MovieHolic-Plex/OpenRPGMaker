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
};

export type MonsterCollectAction =
  | { readonly kind: "startSwap"; readonly instanceId: string }
  | { readonly kind: "swap"; readonly sourceId: string; readonly targetId: string }
  | { readonly kind: "cancelSwap" }
  | { readonly kind: "summaryPage"; readonly page: MonsterSummaryPage };

export const MONSTER_SUMMARY_PAGE_LABEL: Readonly<Record<MonsterSummaryPage, string>> = { stats: "능력치", moves: "기술", manage: "관리" };

export function nextMonsterSummaryPage(page: MonsterSummaryPage): MonsterSummaryPage {
  return MONSTER_SUMMARY_PAGES[(MONSTER_SUMMARY_PAGES.indexOf(page) + 1) % MONSTER_SUMMARY_PAGES.length]!;
}
