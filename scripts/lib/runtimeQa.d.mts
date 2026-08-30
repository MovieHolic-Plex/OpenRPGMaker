// scripts/lib/runtimeQa.mjs 의 타입 계약.
// 설계: docs/superpowers/specs/2026-08-28-runtime-vision-qa-design.md

export type RuntimeQaDir = "up" | "down" | "left" | "right";

export type RuntimeQaOp =
  | { readonly kind: "seed"; readonly seed: number }
  | {
      readonly kind: "setVitals";
      readonly hp: number;
      readonly mp?: number;
      /** 생략하면 현재 파티 전원. */
      readonly actorIds?: readonly string[];
    }
  | { readonly kind: "dir"; readonly dir: RuntimeQaDir | null }
  /**
   * 방향을 `ms` 동안 밀고 있다가 뗀다. 금지된 고정 `wait` 와 다르다 — 경과 시간이 곧 자극이고,
   * "막혀서 아무 일도 안 일어난다" 는 조건으로 표현할 수 없다. 이동이 성공하는 쪽은
   * {@link RuntimeQaOp} 의 `waitForPosition` 으로 조건 대기해야 한다.
   */
  | { readonly kind: "hold"; readonly dir: RuntimeQaDir | null; readonly ms: number }
  | { readonly kind: "face"; readonly dir: RuntimeQaDir }
  | { readonly kind: "action" }
  | { readonly kind: "attack" }
  | { readonly kind: "skill" }
  | { readonly kind: "key"; readonly key: string; readonly times?: number }
  | { readonly kind: "teleport"; readonly mapId: string; readonly x: number; readonly y: number }
  | { readonly kind: "waitForRuntime"; readonly timeoutMs?: number }
  | {
      readonly kind: "waitForPosition";
      readonly mapId: string;
      readonly x: number;
      readonly y: number;
      readonly timeoutMs?: number;
    }
  | {
      readonly kind: "waitFor";
      readonly testid: string;
      readonly state: "present" | "absent";
      readonly timeoutMs?: number;
    }
  /**
   * 마운트가 아니라 **실제로 보일 때까지** 기다린다. 페이드로 들어오는 창(상점·이름입력)은
   * `waitFor: present` 직후 조상 opacity 가 0 이라 visibleText 축이 alpha 0 으로 실패한다.
   */
  | {
      readonly kind: "waitForVisible";
      readonly testid: string;
      /** 통과 조상 alpha 하한. 기본 0.06 — visibleText 축의 판정선(alpha > 0.05) 바로 위다. */
      readonly minAlpha?: number;
      readonly timeoutMs?: number;
    }
  | { readonly kind: "playerRoute"; readonly moves: readonly unknown[] }
  | {
      readonly kind: "waitForLift";
      /** 기본 1 — "떠 있다". */
      readonly minPx?: number;
      readonly maxPx?: number;
      readonly timeoutMs?: number;
    }
  | { readonly kind: "waitForGrounded"; readonly timeoutMs?: number }
  | { readonly kind: "captureShadowSample" }
  | {
      readonly kind: "pressUntil";
      readonly key: string;
      readonly testid: string;
      readonly state: "present" | "absent";
      readonly maxPresses?: number;
      readonly timeoutMs?: number;
    };

export type RuntimeQaExpect = {
  readonly mapId?: string;
  readonly x?: number;
  readonly y?: number;
  /**
   * "x 가 이 값이 **아니어야** 한다". 대조군을 표현하기 위한 부등 기대치다 — 동등만으로는
   * "골렘이 없으면 움직인다" 를 단정할 수 없고, 그러면 입력이 죽어도 "안 움직였다" 가 통과한다.
   */
  readonly xNot?: number;
  /** y 의 부등 기대치. {@link RuntimeQaExpect.xNot} 참조. */
  readonly yNot?: number;
  readonly gold?: number;
  /** 직전 전투 처리 결과(session.battleResult). */
  readonly battleResult?: "victory" | "defeat" | "escape" | null;
  readonly testidPresent?: readonly string[];
  readonly testidAbsent?: readonly string[];
  /**
   * testid → 그 노드에 **화면에 보이는 상태로** 들어 있어야 하는 부분 문자열.
   * {@link RuntimeQaExpect.testidPresent} 는 DOM 존재만 본다 — 클래식 전투 스킨은 적 HP 목록
   * 패널을 display:none 으로 숨기므로, 그 축으로 HP 감소를 단정하면 화면에 없는 숫자를 증거로
   * 삼는다. 이 축은 상자·display·visibility·조상 opacity 를 함께 보고 글자까지 맞춘다.
   *
   * 문자열이 벼 `""` 면 "보이기만 하면 된다" 는 뜻이다 — 글리프를 CSS `::before` 로 그리는
   * 노드(상태 배지 등)는 textContent 가 반드시 비어 있다.
   */
  readonly visibleText?: Readonly<Record<string, string>>;
  readonly playerSpriteResourceNonEmpty?: boolean;
  /** Phaser 텍스처가 실제로 로드됐는지(__MISSING 플레이스홀더 검출). */
  readonly playerSpriteTextureLoaded?: boolean;
  /**
   * 이벤트 id → 런타임이 계산한 발자국 사각. `runtime-state-json` DOM 노드에서 읽는다.
   * 좌표 이동 단정과 달리 판정의 **입력**을 직접 본다 — 사각이 틀렸는데 결과만 맞는 우연을 배제한다.
   * 사각은 네 변을 전부 적어야 한다(일부만 적으면 나머지가 조용히 통과한다).
   */
  readonly eventRects?: Readonly<Record<string, RuntimeQaEventRects>>;
  readonly battleTextClean?: boolean;
  readonly battlerGeometry?: RuntimeQaBattlerGeometrySpec;
  /** 체공 높이 하한(px). 리프트는 원점 채널에 있어 x/y 로는 보이지 않는다. */
  readonly playerLiftPxAtLeast?: number;
  /** 체공 높이 정확값(px). 착지 증명은 0 을 쓴다. */
  readonly playerLiftPx?: number;
  /** 접지선(월드 px). 체공 중에도 타일 경계에 남아야 깊이·카메라·조명이 깨지지 않는다. */
  readonly playerSpriteY?: number;
  /** 발밑 그림자 가시성. true 면 깊이 띠(0~100k)와 alpha>0 도 함께 본다. */
  readonly playerShadowVisible?: boolean;
  /** 그림자 타원 **아래 끝**의 월드 Y. 접지선과 같아야 한다(±1px). */
  readonly playerShadowGroundY?: number;
  /** 체공 상태기 생존 여부. 착지 판정은 반올림된 liftPx 가 아니라 이 값으로 한다. */
  readonly playerAirborne?: boolean;
  /** 렌더된 픽셀로 잰 그림자 농도(대조 상자 대비 어두워진 비율). 오브젝트가 있는데도
   *  한 픽셀도 그려지지 않는 거짓 통과를 잡는 유일한 축이다. */
  readonly playerShadowInkAtLeast?: number;
};

export type RuntimeQaShadow = {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly alpha: number;
  readonly scaleX: number;
  readonly visible: boolean;
  /** 타원 아래 끝(y + displayHeight/2). 접지 판정용. */
  readonly bottomY: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
};

/** 월드 → 화면 변환. 렌더된 픽셀을 재는 데만 쓴다. */
export type RuntimeQaCanvasView = {
  readonly left: number;
  readonly top: number;
  readonly cssScaleX: number;
  readonly cssScaleY: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly zoom: number;
};

/**
 * **타일** 좌표 사각(발자국). 픽셀 상자인 {@link RuntimeQaRect} 와 축이 다르다 —
 * 이름을 갈라 둔 이유: 둘 다 left/right/top/bottom 을 갖지만 단위가 타일 대 CSS 픽셀이고,
 * 섞이면 "18" 이 19번째 타일인지 18px 인지 알 수 없게 된다.
 */
export type RuntimeQaFootprintRect = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

export type RuntimeQaEventRects = {
  /** 활성 페이지의 몸 크기(타일). 저작이 없으면 1x1. */
  readonly footprint?: { readonly width: number; readonly height: number };
  /** 몸 사각 하단 몇 행이 통행을 막는가. 생략 저작이면 몸 높이와 같다. */
  readonly passRows?: number;
  /** 조사·전투·클릭이 쓰는 사각. */
  readonly bodyRect?: RuntimeQaFootprintRect;
  /** 통행 차단이 쓰는 사각. */
  readonly passRect?: RuntimeQaFootprintRect;
};

/** 실브라우저 DOM 상자(CSS 픽셀). 전투 배틀러 기하가 쓴다. */
export type RuntimeQaRect = {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly width: number;
  readonly height: number;
};

export type RuntimeQaBattler = {
  readonly id: string;
  readonly node?: RuntimeQaRect | null;
  readonly image?: RuntimeQaRect | null;
  readonly name?: RuntimeQaRect | null;
};

export type RuntimeQaBattlerGeometry = {
  readonly skin: string;
  readonly directorStep?: string;
  readonly field: RuntimeQaRect;
  readonly enemyGroup?: RuntimeQaRect;
  readonly enemies: readonly RuntimeQaBattler[];
  readonly allies?: readonly RuntimeQaBattler[];
};

export type RuntimeQaBattlerGeometrySpec = {
  readonly minEnemies?: number;
  readonly horizonRatio?: number;
  readonly groundBandRatio?: number;
};

export type RuntimeQaBeat = {
  readonly id: string;
  readonly note?: string;
  readonly ops?: readonly RuntimeQaOp[];
  readonly expect?: RuntimeQaExpect;
  /** 기본 false. 실패한 비트는 이 값과 무관하게 샷을 남긴다. */
  readonly shot?: boolean;
};

export type RuntimeQaViewport = { readonly width: number; readonly height: number };

export type RuntimeQaScenario = {
  readonly id: string;
  readonly beats: readonly RuntimeQaBeat[];
  readonly seed?: number;
  readonly viewport?: RuntimeQaViewport;
  readonly projectFixture?: string;
  /** player.html 에 붙일 쿼리(예: e2eVitals=1 로 액터 바이탈 훅 개방). */
  readonly query?: Readonly<Record<string, string>>;
};

export type RuntimeQaNormalizedBeat = RuntimeQaBeat & {
  readonly ops: readonly RuntimeQaOp[];
  readonly shot: boolean;
};

export type RuntimeQaNormalizedScenario = RuntimeQaScenario & {
  readonly seed: number;
  readonly viewport: RuntimeQaViewport;
  readonly projectFixture: string;
  readonly beats: readonly RuntimeQaNormalizedBeat[];
};

export type RuntimeQaCompactState = {
  readonly currentMapId: string;
  readonly x: number;
  readonly y: number;
  readonly gold: number;
};

export type RuntimeQaBattleTextNode = {
  readonly text: string;
  readonly selector: string;
  readonly reasons: readonly string[];
  readonly clippedRatio: number;
  readonly slicedRatio: number;
  readonly clipper: string | null;
};

export type RuntimeQaObserved = {
  /** 런타임 훅 설치 전(타이틀 화면 등)에는 null. */
  readonly state: RuntimeQaCompactState | null;
  /**
   * 시나리오가 `eventRects` 로 이름을 댄 이벤트의 사각. 전량이 아닌 이유는 맵마다 이벤트가
   * 수십 개라 매니페스트가 노이즈로 덮이기 때문이다. 이름을 안 댄 런에서는 빈 객체다.
   */
  readonly events?: Readonly<Record<string, RuntimeQaEventRects>>;
  readonly testids: readonly string[];
  readonly playerSpriteResourceId: string | null;
  readonly playerSpriteTextureKey: string | null;
  /** 캐릭터 스프라이트 훅 설치 전에는 null. */
  readonly playerLiftPx?: number | null;
  readonly playerSpriteY?: number | null;
  readonly playerDepth?: number | null;
  readonly playerShadow?: RuntimeQaShadow | null;
  readonly playerAirborne?: boolean | null;
  readonly canvasView?: RuntimeQaCanvasView | null;
  /** `battleTextClean` 을 요구한 비트에서만 칸다. */
  readonly battleText?: {
    readonly mounted: boolean;
    readonly nodes: readonly RuntimeQaBattleTextNode[];
  };
  readonly battlers?: RuntimeQaBattlerGeometry | null;
};

export type RuntimeQaBeatReport = {
  readonly index: number;
  readonly id: string;
  readonly note?: string;
  readonly shot: string | null;
  readonly failures: readonly string[];
  readonly state: RuntimeQaCompactState | null;
  /** 사각을 단정한 비트에만 실린다 — 안 쓰는 비트에 빈 객체를 남기면 "사각을 봤다" 로 읽힌다. */
  readonly events?: Readonly<Record<string, RuntimeQaEventRects>>;
  readonly battlers?: RuntimeQaBattlerGeometry;
  /** 그림자 농도 측정값(요구한 비트에만 있다). */
  readonly shadowInk?: number;
};

export type RuntimeQaReport = {
  readonly scenarioId: string;
  readonly projectPath: string;
  readonly seed: number;
  readonly viewport: RuntimeQaViewport;
  readonly errors: readonly string[];
  readonly beats: readonly RuntimeQaBeatReport[];
};

export declare const DEFAULT_PROJECT_FIXTURE: string;
export declare const DEFAULT_VIEWPORT: RuntimeQaViewport;
export declare const DEFAULT_SEED: number;
export declare const OP_KINDS: readonly string[];

export declare function normalizeScenario(scenario: RuntimeQaScenario): RuntimeQaNormalizedScenario;
export declare function shouldCaptureShot(
  beat: { readonly shot?: boolean },
  failures: readonly string[],
): boolean;
export declare function shotFileName(index: number, beatId: string): string;
export declare function renderSummary(report: RuntimeQaReport): string;
export declare const BATTLE_HORIZON_RATIO: number;
export declare const BATTLE_GROUND_BAND_RATIO: number;

export declare function evaluateBattlerGeometry(
  spec: RuntimeQaBattlerGeometrySpec,
  battlers: RuntimeQaBattlerGeometry | null,
): string[];
export declare function evaluateExpect(
  expected: RuntimeQaExpect,
  observed: RuntimeQaObserved,
): string[];
