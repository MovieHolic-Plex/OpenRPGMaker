import type { MenuUiStyle } from "@/project/types";

export type MenuSkinId = MenuUiStyle;
/** main 모드(레일에 커서) 첫 화면이 무엇인가. */
export type MenuSkinLanding = "work" | "party" | "hub" | "sheet";
export type MenuSkinTone = "glass" | "warm";
/** 레일 구성 — collapsed: 접힌 6항목(행동 3 + 파티▸·기록▸·시스템▸), flat: 평탄 최대 10항목. */
export type MenuSkinRailStyle = "collapsed" | "flat";

export type MenuSkin = {
  readonly id: MenuSkinId;
  /** 자료집 드롭다운에 그대로 보인다 — 생김새를 서술하고 타사 프랜차이즈 이름은 쓰지 않는다. */
  readonly label: string;
  readonly description: string;
  readonly landing: MenuSkinLanding;
  readonly tone: MenuSkinTone;
  /** glyph: 유니코드 문자(지금 화면), painted: 컬러 PNG 아이콘. */
  readonly railIcons: "glyph" | "painted";
  readonly railStyle: MenuSkinRailStyle;
  /** main 모드 커서 격자 열 수. 1 이면 ↑↓ 만 움직이고 → 가 진입, 2 이상이면 ←→ 도 커서를 움직이고 Enter 만 진입. */
  readonly railColumns: 1 | 2 | 3 | 6;
  /** function 모드 작업 패널 오른쪽 열에 파티 미니를 붙인다. */
  readonly sideParty: boolean;
  /** Optional landing artwork; omitted skins use the actor face. */
  readonly partyArt?: "character";
};
