/**
 * 몬스터 도감 상세의 쪽(생태 / 능력 / 기술). 컨트롤러(`playerStatusMenuController`)가 상태를 갖고,
 * 상세 빌더(`playerMonsterDexDetail`)는 읽기만 한다. 쪽 나누기는 에메랄드 스킨에서만 켜진다(그 밖의 스킨은 한 목록).
 */
export type MonsterDexPage = "info" | "stats" | "moves";
export const MONSTER_DEX_PAGES: readonly MonsterDexPage[] = ["info", "stats", "moves"];
export const MONSTER_DEX_PAGE_LABEL: Readonly<Record<MonsterDexPage, string>> = { info: "생태", stats: "능력", moves: "기술" };

export function nextMonsterDexPage(page: MonsterDexPage): MonsterDexPage {
  return MONSTER_DEX_PAGES[(MONSTER_DEX_PAGES.indexOf(page) + 1) % MONSTER_DEX_PAGES.length]!;
}
