// benchmark/town/types.ts
// FROZEN CONTRACT for the combined_town 9-question tile-competence benchmark.
//
// Scope: easyrpg_chipset_combined_town (the project DEFAULT tileset). Measured
// 2026-08-20: 207/480 labeled, 44 harness groups, 0 tileset autotileGroups,
// 341 solid, 143 upper, 118 terrain tags (the only tileset carrying terrain).
// Autotile ground truth therefore comes from DEFAULT_AUTOTILE_GROUPS, which is
// the built-in fallback this tileset actually runs on.
//
// NINE QUESTIONS, NINE NUMBERS. The question numbers are the art director's own
// list, kept verbatim so a report can be read against it line by line:
//
//   1 autotile        오토타일을 잘 설정하는지
//   2 reproducibility 재현성
//   3 layer           하위·상위 레이어 처리
//   4 road            길을 잘 만드는지
//   5 wallOutline     벽의 외곽 처리
//   6 roofDiagonal    지붕의 대각 타일 처리
//   7 door            문 설치
//   8 fenceEnd        울타리 끝 처리
//   9 village         마을을 잘 구현하는지
//
// Axis 2 is not a model skill. It is the harness property plus one measurable
// fact about the model: given the identical request three times, does it answer
// the same thing? Replay byte-identity is a HARD GATE (a run that fails it is
// void, not low-scoring); answer stability is the number reported on the axis.
//
// Module ownership (one owner per file, disjoint write scopes):
//   fixtures.ts         -> shapes, probe candidates, marked grids
//   palettes.ts         -> the tile vocabulary handed to the model per task
//   groundTruth.ts      -> buildTownGroundTruth()
//   contract.ts         -> parseTownAnswer()
//   prompts.ts          -> TOWN_PROMPT_VERSION + frozen builders
//   tasks.ts            -> TOWN_TASKS, townTaskSuiteDigest()
//   inputImages.ts      -> renderTownImagePng(), townImageDigests()
//   gridWalk.ts         -> flood fill / passability / component helpers
//   scoringSets.ts      -> scoreTownProbe()      (tileSet answers)
//   scoringGrid.ts      -> scoreTownAutotile()   (axis 1)
//   scoringStructure.ts -> scoreTownPlacement()  (axes 3..9)
//   manifest.ts         -> buildTownRunManifest(), record io
//   runner.ts           -> runTownBenchmark(), replayTownArchive()
//   evidence.ts         -> renderPlacementPng(), buildEvidenceHtml()
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

/** A task counts as passed when its score reaches this. */
export const PASS_THRESHOLD = 0.7;

// ── Axes ─────────────────────────────────────────────────────────────────

export type TownAxisId =
  | "autotile"
  | "reproducibility"
  | "layer"
  | "road"
  | "wallOutline"
  | "roofDiagonal"
  | "door"
  | "fenceEnd"
  | "village";

/** Report order = the art director's question order. */
export const TOWN_AXIS_ORDER: readonly TownAxisId[] = Object.freeze([
  "autotile",
  "reproducibility",
  "layer",
  "road",
  "wallOutline",
  "roofDiagonal",
  "door",
  "fenceEnd",
  "village",
]);

export const TOWN_AXIS_TITLE: Readonly<Record<TownAxisId, string>> = Object.freeze({
  autotile: "오토타일 배치",
  reproducibility: "재현성",
  layer: "상위·하위 레이어 구분",
  road: "길 시공",
  wallOutline: "벽 외곽 처리",
  roofDiagonal: "지붕 대각 처리",
  door: "문 설치",
  fenceEnd: "울타리 끝 처리",
  village: "마을 구현",
});

// ── Ground truth ─────────────────────────────────────────────────────────

/**
 * A probe set turns a subjective "list every X" question into a bounded binary
 * classification: the model sees exactly these tiles and answers which of them
 * satisfy the property. Bounded probes are why the tileSet tasks can be scored
 * with plain balanced accuracy instead of an unbounded-recall F1.
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
 *
 * The `inner` cells are the only ones that require reading the DIAGONAL
 * neighbourhood, so they are reported as their own number inside the axis
 * detail. Averaging them into the cell accuracy would hide the one measurement
 * that separates real autotile understanding from edge/corner pattern matching.
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

/** Grid fixtures that carry a reference placement produced by a real stamper. */
export type TownPlacementKey =
  | "treeGrid"
  | "roadGrid"
  | "wallGrid"
  | "aframeGrid"
  | "doorGrid"
  | "fenceGrid"
  | "villageGrid";

/**
 * A reference placement. Row-major arrays of length width*height so records
 * hash and diff cleanly. EMPTY_CELL marks an untouched cell.
 */
export interface PlacementReference {
  readonly key: TownPlacementKey;
  readonly width: number;
  readonly height: number;
  readonly lower: readonly number[];
  readonly upper: readonly number[];
  /**
   * What is ALREADY drawn in the input image before the model answers — the
   * pre-built house of the door and fence tasks. All EMPTY_CELL when the task
   * starts from bare ground. Structural scoring composes base + answer, because
   * "is the door reachable" is a question about the finished building, not about
   * the two cells the model typed.
   */
  readonly baseLower: readonly number[];
  readonly baseUpper: readonly number[];
  /** Human-readable derivation note naming the engine that produced this. */
  readonly source: string;
}

export interface TownGroundTruth {
  /** Axis 5 probe — canonical house-shell walls, plus lookalike traps. */
  readonly wall: TownProbeSet;
  /** Axis 4 probe — walkable vs solid, on appearance-contradicting tiles. */
  readonly passability: TownProbeSet;
  /** Axis 3 probe — upper vs lower layer. */
  readonly layer: TownProbeSet;
  /** Axis 1 — the autotile answer key. */
  readonly autotile: AutotileReference;
  /** Axes 3..9 — one reference placement per grid fixture. */
  readonly placements: Readonly<Record<TownPlacementKey, PlacementReference>>;
  /** Per-tile runtime contract read off the seeded tileset (0..479). */
  readonly passFlags: readonly PassFlag[];
  readonly priority: readonly ("lower" | "upper")[];
  /** Tiles banned by the project (placeholder art). Using one is a hard miss. */
  readonly banned: ReadonlySet<number>;
  /** Content digest over everything above. */
  readonly digest: string;
}

// ── Answers ──────────────────────────────────────────────────────────────

export type TownAnswerKind = "tileSet" | "grid" | "layered";

/** {"tileIds":[240,...]} — unique, ascending, 0..479. */
export interface TownTileSetAnswer {
  readonly tileIds: readonly number[];
}

/** {"grid":[[...]]} — one layer; cells are -1 or 0..479. */
export interface TownGridAnswer {
  readonly grid: readonly (readonly number[])[];
}

/** {"lower":[[...]],"upper":[[...]]} — equal shape; cells are -1 or 0..479. */
export interface TownLayeredAnswer {
  readonly lower: readonly (readonly number[])[];
  readonly upper: readonly (readonly number[])[];
}

export type TownAnswer = TownTileSetAnswer | TownGridAnswer | TownLayeredAnswer;

// ── Scoring ──────────────────────────────────────────────────────────────

/**
 * How an axis number was computed. Every method is simple enough to explain in
 * one sentence, which is the point of this benchmark:
 *
 *  balancedAccuracy — bounded probe: (sensitivity + specificity) / 2
 *  f1               — unbounded "list every X" question
 *  cellAccuracy     — fraction of graded cells carrying the exact right tile
 *  structural       — mean of identity (did it match the canonical stamp) and
 *                     structural validity (is what it built sound at all)
 *  ruleRate         — fraction of a named grammar rule set that holds
 *  stability        — agreement between repeats of the identical request
 */
export type TownScoringMethod =
  | "balancedAccuracy"
  | "f1"
  | "cellAccuracy"
  | "structural"
  | "ruleRate"
  | "stability";

export interface AxisScore {
  readonly axis: TownAxisId;
  readonly score: number;
  readonly method: TownScoringMethod;
  /** Numbers only, so archived records diff cleanly. */
  readonly detail: Readonly<Record<string, number>>;
}

export interface ScoredTownAnswer {
  readonly axes: readonly AxisScore[];
  /** Unweighted mean over the axes this answer produced. */
  readonly mean: number;
}

// ── Tasks ────────────────────────────────────────────────────────────────

/**
 * Input image keys resolved by inputImages.ts — exactly one image per task.
 * A probe image is a strip of the probed tiles in prompt order; a grid image is
 * the task's palette strip stacked above the marked grid, so the model can see
 * which picture each palette id refers to.
 */
export type TownImageKey =
  | "wallProbe"
  | "passabilityProbe"
  | "layerProbe"
  | "autotileShape"
  | "treeGrid"
  | "roadGrid"
  | "wallGrid"
  | "aframeGrid"
  | "doorGrid"
  | "fenceGrid"
  | "villageGrid";

export type TownProbeKey = "wall" | "passability" | "layer";

export interface TownTaskDef {
  readonly id: string;
  readonly titleKo: string;
  readonly kind: TownAnswerKind;
  readonly input: TownImageKey;
  /** Frozen prompt builder — no arguments, so no answer can be interpolated. */
  readonly prompt: () => string;
  /** The single axis this task feeds. Axis 2 is derived, never authored here. */
  readonly axis: TownAxisId;
  /** Probe key for `kind === "tileSet"`. */
  readonly probe?: TownProbeKey;
  /** Reference placement key — every grid task except the autotile one. */
  readonly placement?: TownPlacementKey;
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
  readonly axis: TownAxisId;
  readonly attempts: readonly TownAttemptRecord[];
  readonly meanScore: number | null;
  readonly stdDev: number | null;
  /** 1 when any attempt reached PASS_THRESHOLD. */
  readonly passAtK: number;
  /**
   * Agreement between repeats of the identical request, 0..1. null when fewer
   * than two attempts produced a parsed answer — one answer cannot disagree
   * with itself. Axis 2 is the mean of these.
   */
  readonly stability: number | null;
}

export interface TownRunRecord {
  readonly recordVersion: 1;
  readonly manifest: TownRunManifest;
  readonly model: string;
  /** ISO timestamp. Excluded from every hash so records stay comparable. */
  readonly startedAt: string;
  readonly tasks: readonly TownTaskRecord[];
  /** The nine headline numbers, keyed by axis. null when never scored. */
  readonly axisScores: Readonly<Record<TownAxisId, number | null>>;
  readonly overall: number;
}
