// benchmark/town/types.ts
// FROZEN CONTRACT for the combined_town 5-axis tile-competence benchmark.
//
// Scope: easyrpg_chipset_combined_town (the project DEFAULT tileset). Measured
// 2026-08-20: 207/480 labeled, 44 harness groups, 0 tileset autotileGroups,
// 341 solid, 143 upper, 118 terrain tags (the only tileset carrying terrain).
// Autotile ground truth therefore comes from DEFAULT_AUTOTILE_GROUPS, which is
// the built-in fallback this tileset actually runs on.
//
// FIVE AXES, FIVE NUMBERS. Every axis resolves to one 0..1 score so a model can
// be read at a glance:
//
//   A1 autotile     place the correct autotile variant over a marked shape
//   A2 wall         which tiles are walls
//   A3 passability  which tiles a character can walk on
//   A4 layer        which tiles must be drawn on the upper layer
//   A5 innerCorner  the concave-corner cells of A1, scored on their own
//
// A5 is deliberately a SUB-SCORE of the same model answer as A1, not a separate
// question. Placing 4 edges and 4 corners is pattern matching; the inner corner
// is the only cell that requires reading the DIAGONAL neighbourhood, so it is
// where fake autotile understanding shows up. Averaging it into A1 would hide it.
//
// Module ownership (one owner per file, disjoint write scopes):
//   groundTruth.ts  -> buildTownGroundTruth()
//   contract.ts     -> parseTownAnswer()
//   prompts.ts      -> TOWN_PROMPT_VERSION + frozen builders
//   tasks.ts        -> TOWN_TASKS, townTaskSuiteDigest()
//   inputImages.ts  -> renderTownImagePng(), townImageDigests()
//   scoringSets.ts  -> scoreTownTileSet()   (A2, A3, A4)
//   scoringGrid.ts  -> scoreTownGrid()      (A1, A5)
//   runner.ts       -> runTownBenchmark(), replayTownArchive()
//
// Hashing is REUSED from ../interior/hash.ts (already verified against NIST
// vectors). Do not write a second sha256.

import type { PassFlag } from "@/project/types";

export const TOWN_TILESET_ID = "easyrpg_chipset_combined_town";
export const TOWN_TEXTURE_KEY = "tex_easyrpg_chipset_combined_town";
export const TOWN_TILE_COUNT = 480;
export const TOWN_TILES_PER_ROW = 30;
export const TOWN_TILE_SIZE = 16;
/** Grid cells may be -1 ("leave empty") or a valid tile id. */
export const EMPTY_CELL = -1;

// ── Axes ─────────────────────────────────────────────────────────────────

export type TownAxisId = "autotile" | "wall" | "passability" | "layer" | "innerCorner";

export const TOWN_AXIS_TITLE: Readonly<Record<TownAxisId, string>> = Object.freeze({
  autotile: "오토타일 배치",
  wall: "벽 인식",
  passability: "통행 가능 판정",
  layer: "상위·하위 레이어 구분",
  innerCorner: "오토타일 오목 코너",
});

// ── Ground truth ─────────────────────────────────────────────────────────

/**
 * A probe set turns a subjective "list every X" question into a bounded binary
 * classification: the model sees exactly these tiles and answers which of them
 * satisfy the property. Bounded probes are why A3/A4 can be scored with plain
 * balanced accuracy instead of an unbounded-recall F1.
 */
export interface TownProbeSet {
  /** Tiles shown to the model, in the exact render order. */
  readonly probes: readonly number[];
  /** Subset of `probes` for which the property holds. */
  readonly positives: ReadonlySet<number>;
  /** Probes chosen because they contradict their own appearance. */
  readonly traps: ReadonlySet<number>;
  readonly source: string;
}

/** Autotile roles the 3x4 RM2k3 template block can express. */
export type AutotileRole =
  | "body"
  | "edgeN"
  | "edgeS"
  | "edgeW"
  | "edgeE"
  | "cornerNW"
  | "cornerNE"
  | "cornerSW"
  | "cornerSE"
  | "inner"
  | "isolated";

/** One cell of the autotile answer key. */
export interface AutotileCell {
  readonly x: number;
  readonly y: number;
  /** The single correct tile id, from the engine's variantMap. */
  readonly tile: number;
  readonly role: AutotileRole;
}

/**
 * The autotile task's answer key, produced by running the REAL engine
 * (autotileVariantForMask) over the marked shape. Not hand-written: if the
 * engine's mapping changes, this changes with it.
 */
export interface AutotileReference {
  readonly width: number;
  readonly height: number;
  /** Marked cells, row-major indices into width*height. */
  readonly shape: readonly number[];
  readonly cells: readonly AutotileCell[];
  /** The 11 role tiles of the template block, for prompt-free reference. */
  readonly block: Readonly<Record<AutotileRole, number>>;
  /** Group id in DEFAULT_AUTOTILE_GROUPS this key was derived from. */
  readonly groupId: string;
}

export interface TownGroundTruth {
  /** A2 — canonical wall tiles, plus lookalike traps. */
  readonly wall: TownProbeSet;
  /** A3 — walkable vs solid, probed on appearance-contradicting tiles. */
  readonly passability: TownProbeSet;
  /** A4 — upper vs lower layer. */
  readonly layer: TownProbeSet;
  /** A1 + A5 — the autotile answer key. */
  readonly autotile: AutotileReference;
  /** Per-tile runtime contract read off the seeded tileset (0..479). */
  readonly passFlags: readonly PassFlag[];
  readonly priority: readonly ("lower" | "upper")[];
  /** Content digest over everything above. */
  readonly digest: string;
}

// ── Answers ──────────────────────────────────────────────────────────────

export type TownAnswerKind = "tileSet" | "grid";

/** {"tileIds":[240,...]} — unique, ascending, 0..479. */
export interface TownTileSetAnswer {
  readonly tileIds: readonly number[];
}

/** {"grid":[[...]]} — one layer; cells are -1 or 0..479. */
export interface TownGridAnswer {
  readonly grid: readonly (readonly number[])[];
}

export type TownAnswer = TownTileSetAnswer | TownGridAnswer;

// ── Scoring ──────────────────────────────────────────────────────────────

/**
 * One axis score. `score` is always 0..1 and always simple enough to explain in
 * one sentence, which is the point of this benchmark: F1 for the open-ended
 * wall question, balanced accuracy for the bounded probes, plain cell accuracy
 * for the grids.
 */
export interface AxisScore {
  readonly axis: TownAxisId;
  readonly score: number;
  readonly method: "f1" | "balancedAccuracy" | "cellAccuracy";
  /** Numbers only, so archived records diff cleanly. */
  readonly detail: Readonly<Record<string, number>>;
}

export interface ScoredTownAnswer {
  readonly axes: readonly AxisScore[];
  /** Unweighted mean over the axes this answer produced. */
  readonly mean: number;
}

// ── Tasks ────────────────────────────────────────────────────────────────

export interface TownTaskDef {
  readonly id: string;
  readonly titleKo: string;
  readonly kind: TownAnswerKind;
  /** Input image key resolved by inputImages.ts. */
  readonly input: "atlas" | "passabilityProbe" | "layerProbe" | "autotileShape";
  /** Frozen prompt builder — no arguments, so no answer can be interpolated. */
  readonly prompt: () => string;
  /** Axes this one model call is scored on. The grid task yields TWO. */
  readonly axes: readonly TownAxisId[];
}

// ── Reproducibility spine (same three layers as the interior track) ──────

export interface TownModelParams {
  readonly model: string;
  readonly temperature: number;
  readonly topP: number;
  readonly maxTokens: number;
  readonly seed: number;
}

export const TOWN_DETERMINISTIC_PARAMS: Omit<TownModelParams, "model"> = Object.freeze({
  temperature: 0,
  topP: 1,
  maxTokens: 8192,
  seed: 20260820,
});

export interface TownRunManifest {
  readonly manifestVersion: 1;
  readonly promptVersion: number;
  readonly groundTruthDigest: string;
  readonly imageDigests: Readonly<Record<string, string>>;
  readonly taskSuiteDigest: string;
  readonly scoringVersion: number;
  readonly params: Omit<TownModelParams, "model">;
  readonly manifestHash: string;
}

export interface TownAttemptRecord {
  readonly attempt: number;
  readonly requestHash: string;
  /** Raw model response, verbatim. Replay re-scores exactly this. */
  readonly rawAnswer: string;
  readonly parsed: TownAnswer | null;
  readonly scored: ScoredTownAnswer | null;
  readonly error: { readonly kind: string; readonly message: string } | null;
}

export interface TownTaskRecord {
  readonly taskId: string;
  readonly kind: TownAnswerKind;
  readonly attempts: readonly TownAttemptRecord[];
  readonly meanScore: number | null;
  readonly stdDev: number | null;
}

export interface TownRunRecord {
  readonly recordVersion: 1;
  readonly manifest: TownRunManifest;
  readonly model: string;
  /** ISO timestamp. Excluded from every hash so records stay comparable. */
  readonly startedAt: string;
  readonly tasks: readonly TownTaskRecord[];
  /** The five headline numbers, keyed by axis. null when never scored. */
  readonly axisScores: Readonly<Record<TownAxisId, number | null>>;
  readonly overall: number;
}
