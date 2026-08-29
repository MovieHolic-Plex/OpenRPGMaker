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
  /** 정수리 이모트 개수 하한(__oprnEmotes 훅). */
  readonly emoteCountAtLeast?: number;
  /** 떠 있어야 하는 이모트 프레임 인덱스(EMOTE_KINDS 순서). */
  readonly emoteFrames?: readonly (number | string)[];
  /** 특정 주인에게 붙어 있어야 하는 이모트(target + EMOTE_KINDS 프레임 인덱스). */
  readonly emoteTargets?: readonly {
    readonly target: string;
    readonly frame: number | string;
  }[];
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
