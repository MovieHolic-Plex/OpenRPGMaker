export type BattleSkinId =
  | "pokemon" | "rm2000" | "rm2003" | "octopath" | "chrono"
  | "bravely" | "dragonquest" | "ff" | "mother" | "goldensun" | "mv" | "vxace";

/** 같은 창 크롬(CSS 파일)을 나눠 쓰는 스킨 묶음. battleDom 이 `data-battle-skin-family` 로 루트에 심고,
 *  `_rm2000.css` 의 유리 HUD 규칙은 이 속성으로 스코프한다 — 정면(rm2000)·측면(rm2003) 이 한 파일을 공유한다. */
export type BattleSkinFamily = "glass";

export type BattleLayout = "sideview" | "frontview" | "active" | "firstperson";
export type HudTemplate = "boxes" | "rows" | "ring" | "minimal";
export type BattleTransition =
  | "flash-white"
  | "wipe-blue"
  | "wipe-black"
  | "focus-blur"
  | "sweep-cyan"
  | "brave-shift"
  | "psychedelic"
  | "fade"
  | "slide-pokemon"
  | "curtain-dq";

/** 12 CSS vars that every skin must author. 4 legacy vars keep rendering compat. */
export type BattleThemeVars = {
  "--battle-window-bg": string;
  "--battle-window-edge": string;
  "--battle-window-inner"?: string;
  "--battle-text": string;
  "--battle-text-muted"?: string;
  "--battle-accent": string;
  "--battle-accent-soft"?: string;
  "--battle-hp-high"?: string;
  "--battle-hp-mid"?: string;
  "--battle-hp-low"?: string;
  "--battle-shadow"?: string;
  "--battle-cursor"?: string;
  "--battle-backdrop-filter"?: string;
};

/** 전투 스킨 = 순수 데이터 프리셋. 렌더러는 이 데이터만 읽고, 레이아웃·색은 CSS가 분기한다. */
export interface BattleSkin {
  readonly id: BattleSkinId;
  readonly label: string;
  readonly layout: BattleLayout;
  /** frontview 일부(드퀘 등)는 아군 스프라이트를 숨긴다. */
  readonly showAllySprites: boolean;
  readonly hudTemplate: HudTemplate;
  /** 인트로 연출 클래스 키(.battle-scene[data-battle-skin][data-battle-transition]) */
  readonly transition: BattleTransition;
  /** --battle-* CSS 변수 오버라이드 — 12 vars, 렌더에서 style.setProperty로 주입. */
  readonly themeVars: BattleThemeVars;
  readonly defaultBackdropResourceId?: string;
  /** 창 크롬 CSS 를 나눠 쓰는 묶음. 없으면 스킨 id 가 곧 묶음이다(`data-battle-skin-family` = id). */
  readonly family?: BattleSkinFamily;
  /** 지원 종료 스킨 — 저장된 프로젝트에서는 계속 로드·렌더되지만 새 저작 UI에서는 숨긴다. */
  readonly deprecated?: true;
}
