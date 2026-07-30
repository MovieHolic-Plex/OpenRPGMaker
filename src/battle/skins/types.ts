export type BattleSkinId =
  | "pokemon" | "rm2003" | "rm2000" | "octopath" | "chrono"
  | "bravely" | "dragonquest" | "ff" | "mother" | "goldensun" | "mv" | "vxace";

export type BattleLayout = "sideview" | "frontview" | "active" | "firstperson";
export type HudTemplate = "boxes" | "rows" | "ring" | "minimal";

/** 전투 스킨 = 순수 데이터 프리셋. 렌더러는 이 데이터만 읽고, 레이아웃·색은 CSS가 분기한다. */
export interface BattleSkin {
  readonly id: BattleSkinId;
  readonly label: string;
  readonly layout: BattleLayout;
  /** frontview 일부(드퀘 등)는 아군 스프라이트를 숨긴다. */
  readonly showAllySprites: boolean;
  readonly hudTemplate: HudTemplate;
  /** 인트로 연출 클래스 키(.battle-scene[data-battle-skin] 에서 사용). */
  readonly transition: string;
  /** --battle-* CSS 변수 오버라이드. */
  readonly themeVars: Record<string, string>;
  readonly defaultBackdropResourceId?: string;
}
