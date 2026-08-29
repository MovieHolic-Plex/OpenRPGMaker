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
  readonly gold?: number;
  /** 직전 전투 처리 결과(session.battleResult). */
  readonly battleResult?: "victory" | "defeat" | "escape" | null;
  readonly testidPresent?: readonly string[];
  readonly testidAbsent?: readonly string[];
  readonly playerSpriteResourceNonEmpty?: boolean;
  /** Phaser 텍스처가 실제로 로드됐는지(__MISSING 플레이스홀더 검출). */
  readonly playerSpriteTextureLoaded?: boolean;
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
