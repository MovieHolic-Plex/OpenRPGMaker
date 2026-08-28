// scripts/lib/runtimeQa.mjs 의 타입 계약.
// 설계: docs/superpowers/specs/2026-08-28-runtime-vision-qa-design.md

export type RuntimeQaDir = "up" | "down" | "left" | "right";

export type RuntimeQaOp =
  | { readonly kind: "seed"; readonly seed: number }
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
  readonly gold?: number;
  readonly testidPresent?: readonly string[];
  readonly testidAbsent?: readonly string[];
  readonly playerSpriteResourceNonEmpty?: boolean;
  /** Phaser 텍스처가 실제로 로드됐는지(__MISSING 플레이스홀더 검출). */
  readonly playerSpriteTextureLoaded?: boolean;
  readonly battlerGeometry?: RuntimeQaBattlerGeometrySpec;
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
