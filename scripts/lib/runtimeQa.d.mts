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
