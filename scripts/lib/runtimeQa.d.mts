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
  | { readonly kind: "key"; readonly key: string; readonly times?: number; readonly delayMs?: number }
  | { readonly kind: "teleport"; readonly mapId: string; readonly x: number; readonly y: number }
  | { readonly kind: "wait"; readonly ms: number }
  | {
      readonly kind: "waitFor";
      readonly testid: string;
      readonly state: "present" | "absent";
      readonly timeoutMs?: number;
    }
  | {
      readonly kind: "pressUntil";
      readonly key: string;
      readonly testid: string;
      readonly state: "present" | "absent";
      readonly maxPresses?: number;
      readonly delayMs?: number;
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
  readonly playerSpriteResourceNonEmpty?: boolean;
  /** Phaser 텍스처가 실제로 로드됐는지(__MISSING 플레이스홀더 검출). */
  readonly playerSpriteTextureLoaded?: boolean;
  /**
   * 이벤트 id → 런타임이 계산한 발자국 사각. `runtime-state-json` DOM 노드에서 읽는다.
   * 좌표 이동 단정과 달리 판정의 **입력**을 직접 본다 — 사각이 틀렸는데 결과만 맞는 우연을 배제한다.
   * 사각은 네 변을 전부 적어야 한다(일부만 적으면 나머지가 조용히 통과한다).
   */
  readonly eventRects?: Readonly<Record<string, RuntimeQaEventRects>>;
};

export type RuntimeQaRect = {
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
  readonly bodyRect?: RuntimeQaRect;
  /** 통행 차단이 쓰는 사각. */
  readonly passRect?: RuntimeQaRect;
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
export declare function evaluateExpect(
  expected: RuntimeQaExpect,
  observed: RuntimeQaObserved,
): string[];
