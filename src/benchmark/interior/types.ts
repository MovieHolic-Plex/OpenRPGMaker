// benchmark/interior/types.ts
// FROZEN CONTRACT for the easyrpg_chipset_interior tile-placement benchmark.
//
// Every module under src/benchmark/interior/ implements against THIS file and
// nothing else. Module ownership (one owner per file, disjoint write scopes):
//
//   groundTruth.ts     → buildInteriorGroundTruth()      (InteriorGroundTruth)
//   inputImages.ts     → renderInteriorAtlasPng(), renderInteriorGridPng()
//   prompts.ts         → INTERIOR_PROMPT_VERSION + frozen prompt builders
//   tasks.ts           → INTERIOR_TASKS (readonly InteriorTaskDef[])
//   scoringSets.ts     → scoreTileSetAnswer()  (schemes S1..S4)
//   scoringStructure.ts→ scorePlacementAnswer() (schemes S5..S6)
//   manifest.ts        → canonicalJson(), sha256Hex(), buildRunManifest(), record io
//   runner.ts          → runInteriorBenchmark(), replayInteriorArchive()
//
// WHY THIS FILE EXISTS: an LLM API is never bit-reproducible, so the benchmark
// cannot inherit reproducibility from the model. It is manufactured in three
// layers, and every type below serves one of them:
//
//   L1 PINNED EXPERIMENT   — RunManifest content-hashes prompts, ground truth,
//                            input image bytes, scoring version and request
//                            params. Equal manifestHash == same experiment.
//   L2 ARCHIVE AND REPLAY  — RunRecord persists the raw model bytes plus the
//                            resolved scores. Re-scoring an archive offline
//                            MUST reproduce byte-identical scores, with no
//                            network. This is the guarantee that actually holds.
//   L3 MEASURED VARIANCE   — repeats per task at temperature 0 turn model
//                            nondeterminism into a reported stddev instead of
//                            a hidden one.
//
// Ground truth is the fully-configured interior tileset (measured 2026-08-20:
// 480/480 labeled tiles, 23 harness groups, 10 autotile groups, 282 solid,
// 139 upper) — the only bundled chipset with a complete metadata contract.

import type { PassFlag } from "@/project/types";

// ── Sheet geometry (easyrpg_chipset_interior) ─────────────────────────────

export const INTERIOR_TILESET_ID = "easyrpg_chipset_interior";
export const INTERIOR_TEXTURE_KEY = "tex_easyrpg_chipset_interior";
export const INTERIOR_TILE_COUNT = 480;
export const INTERIOR_TILES_PER_ROW = 30;
export const INTERIOR_TILE_SIZE = 16;
/** Grid cells may be -1 ("leave empty") or a valid tile id. */
export const EMPTY_CELL = -1;

// ── Ground truth ─────────────────────────────────────────────────────────

/**
 * Answer categories the benchmark asks about.
 *
 * `wallAny` vs `houseShellWall` is deliberate and load-bearing: a model that
 * recognizes generic wall art scores well on `wallAny` while failing
 * `houseShellWall`, which requires the canonical house grammar. The gap between
 * the two is the headline discrimination this benchmark reports.
 *
 * There is deliberately no "door" category. Measured 2026-08-20: this chipset
 * has no door art at all — planInteriorHouseWalls builds a doorway by punching
 * a FLOOR cell through the south wall, and the only label-scan matches are
 * "흰 창문"/"커튼 창문" (windows) and 257, which is a forbidden tile. A category
 * whose canonical set cannot be derived is a question that cannot be asked.
 *
 * `distractor` is outdoor terrain shipped inside an interior sheet (grass,
 * outdoor ground, water, hedge). It is never a correct answer to an interior
 * question, which is exactly what makes it the trap source for `floor`.
 */
export type InteriorCategoryKey =
  | "wallAny"
  | "houseShellWall"
  | "ceiling"
  | "floor"
  | "carpet"
  | "window"
  | "furnitureSolid"
  | "propUpper"
  | "water"
  | "distractor";

/** One resolved ground-truth category. */
export interface InteriorCategoryTruth {
  readonly key: InteriorCategoryKey;
  /** Canonical members — the strict answer. */
  readonly canonical: ReadonlySet<number>;
  /**
   * Generous members — canonical plus defensible neighbours from the same
   * harness group / semantic role. Used by the semantic-credit scheme (S2) to
   * award partial credit instead of a flat miss.
   */
  readonly generous: ReadonlySet<number>;
  /**
   * Tiles that are actively wrong for this category despite looking plausible
   * (right label family, wrong passability or wrong grammar). Scheme S3
   * penalizes these instead of scoring them as ordinary misses.
   */
  readonly traps: ReadonlySet<number>;
  /** Human-readable derivation note naming the source module. */
  readonly source: string;
}

/** The canonical house the placement tasks are scored against. */
export interface HouseReference {
  /** Fixture id this reference was planned from (fixtures.ts). */
  readonly fixtureId: string;
  readonly width: number;
  readonly height: number;
  /** Floor mask, row-major, length width*height. */
  readonly floor: readonly boolean[];
  readonly door: { readonly x: number; readonly y: number };
  /** Output of planInteriorHouseWalls() for this input — the reference walls. */
  readonly walls: readonly { readonly x: number; readonly y: number; readonly tile: number }[];
}

export interface InteriorGroundTruth {
  readonly categories: Readonly<Record<InteriorCategoryKey, InteriorCategoryTruth>>;
  /**
   * One reference plan per grid fixture, keyed by fixture id ("houseGrid",
   * "roomGrid"). Keyed rather than single because the two placement tasks use
   * different grid sizes: one shared reference would make every answer to the
   * two-room task a shape mismatch.
   */
  readonly houses: Readonly<Record<string, HouseReference>>;
  /** Per-tile runtime contract read off the seeded tileset (0..479). */
  readonly passability: readonly PassFlag[];
  readonly priority: readonly ("lower" | "upper")[];
  /** Tiles forbidden as house wall art — interiorHouseWallTiles.ts. */
  readonly forbidden: ReadonlySet<number>;
  /**
   * Stable digest of everything above. Changes whenever a source table
   * changes, which invalidates the manifest and therefore old scores.
   */
  readonly digest: string;
}

// ── Answers ──────────────────────────────────────────────────────────────

export type InteriorAnswerKind = "tileSet" | "placement";

/** {"tileIds":[105,...]} — strictly ascending, unique, 0..479. */
export interface TileSetAnswer {
  readonly tileIds: readonly number[];
}

/** {"lower":[[...]],"upper":[[...]]} — equal shape, cells -1 or 0..479. */
export interface PlacementAnswer {
  readonly lower: readonly (readonly number[])[];
  readonly upper: readonly (readonly number[])[];
}

export type InteriorAnswer = TileSetAnswer | PlacementAnswer;

// ── Scoring ──────────────────────────────────────────────────────────────

/**
 * The six scoring schemes. Reporting several is the point: a single number
 * hides whether a model knows the sheet or understands architecture.
 *
 *  S1 setF1        — strict precision/recall/F1 against `canonical`.
 *  S2 semantic     — partial credit for `generous` members (right family).
 *  S3 trapPenalty  — negative credit for `traps`; measures discrimination.
 *  S4 rolePurity   — fraction of picks whose semantic role matches the ask.
 *  S5 gridIdentity — cell-exact agreement with the reference house plan.
 *  S6 structural   — tile-identity-agnostic validity: closed ring, reachable
 *                    door, walkable interior under real passability, correct
 *                    layer split, zero forbidden tiles. A model can build a
 *                    VALID house from non-canonical tiles: S5 punishes that
 *                    and S6 rewards it, so the pair separates sheet knowledge
 *                    from spatial competence.
 */
export type ScoringSchemeId =
  | "setF1"
  | "semantic"
  | "trapPenalty"
  | "rolePurity"
  | "gridIdentity"
  | "structural";

export interface SchemeScore {
  readonly scheme: ScoringSchemeId;
  /** Normalized 0..1. Schemes that can go negative are clamped here... */
  readonly score: number;
  /** ...and expose the unclamped value for analysis. */
  readonly rawScore: number;
  /** Scheme-specific breakdown. Numbers only, so records diff cleanly. */
  readonly detail: Readonly<Record<string, number>>;
}

export interface ScoredAnswer {
  readonly schemes: readonly SchemeScore[];
  /** Weighted mean over `schemes`, weights taken from the manifest. */
  readonly composite: number;
}

/** Weights are pinned in the manifest: scores are incomparable across weights. */
export type SchemeWeights = Readonly<Record<ScoringSchemeId, number>>;

export const DEFAULT_SCHEME_WEIGHTS: SchemeWeights = Object.freeze({
  setF1: 1,
  semantic: 0.5,
  trapPenalty: 0.75,
  rolePurity: 0.5,
  gridIdentity: 1,
  structural: 1.25,
});

// ── Tasks ────────────────────────────────────────────────────────────────

export interface InteriorTaskDef {
  readonly id: string;
  readonly titleKo: string;
  readonly kind: InteriorAnswerKind;
  /** Category scored for `kind === "tileSet"`. */
  readonly category?: InteriorCategoryKey;
  /** Input image key resolved by inputImages.ts. */
  readonly input: "atlas" | "houseGrid" | "roomGrid";
  /** Frozen prompt builder — takes no arguments so no ground truth can leak. */
  readonly prompt: () => string;
  /** Schemes applied to this task's answer. */
  readonly schemes: readonly ScoringSchemeId[];
}

// ── Reproducibility spine ────────────────────────────────────────────────

/** Sampling params pinned for determinism. Deviating invalidates comparison. */
export interface ModelParams {
  readonly model: string;
  readonly temperature: number;
  readonly topP: number;
  readonly maxTokens: number;
  readonly seed: number;
}

export const DETERMINISTIC_PARAMS: Omit<ModelParams, "model"> = Object.freeze({
  temperature: 0,
  topP: 1,
  maxTokens: 8192,
  seed: 20260820,
});

/**
 * Content hashes pinning every input to a score. Two runs are comparable only
 * when their manifestHash matches.
 */
export interface RunManifest {
  readonly manifestVersion: 1;
  readonly promptVersion: number;
  readonly groundTruthDigest: string;
  /** sha256 of each input image's PNG bytes, keyed by input key. */
  readonly imageDigests: Readonly<Record<string, string>>;
  /** sha256 over the task suite definition (ids, kinds, prompts, schemes). */
  readonly taskSuiteDigest: string;
  readonly scoringVersion: number;
  readonly weights: SchemeWeights;
  readonly params: Omit<ModelParams, "model">;
  /** sha256 over every field above, in canonical JSON key order. */
  readonly manifestHash: string;
}

export interface AttemptRecord {
  readonly attempt: number;
  /** sha256 of the exact request body sent — proves request-side determinism. */
  readonly requestHash: string;
  /** Raw model response text, verbatim. Replay re-scores exactly this. */
  readonly rawAnswer: string;
  readonly parsed: InteriorAnswer | null;
  readonly scored: ScoredAnswer | null;
  readonly error: { readonly kind: string; readonly message: string } | null;
}

export interface TaskRecord {
  readonly taskId: string;
  readonly kind: InteriorAnswerKind;
  readonly attempts: readonly AttemptRecord[];
  /** Mean / stddev of composite across attempts — L3 measured variance. */
  readonly compositeMean: number | null;
  readonly compositeStdDev: number | null;
  /** 1 when any attempt reached composite >= passThreshold. */
  readonly passAtK: number;
}

export interface RunRecord {
  readonly recordVersion: 1;
  readonly manifest: RunManifest;
  readonly model: string;
  /** ISO timestamp. Excluded from every hash so records stay comparable. */
  readonly startedAt: string;
  readonly tasks: readonly TaskRecord[];
  readonly overallComposite: number;
}

/** A task counts as passed when its composite reaches this. */
export const PASS_THRESHOLD = 0.7;

// ── Module surface the runner fans in ────────────────────────────────────

export interface TileSetScorer {
  (input: {
    readonly answer: TileSetAnswer;
    readonly truth: InteriorCategoryTruth;
    readonly groundTruth: InteriorGroundTruth;
    readonly schemes: readonly ScoringSchemeId[];
    readonly weights: SchemeWeights;
  }): ScoredAnswer;
}

export interface PlacementScorer {
  (input: {
    readonly answer: PlacementAnswer;
    /** The reference plan for THIS task's fixture. */
    readonly house: HouseReference;
    /** Supplies passability, priority and the forbidden set. */
    readonly groundTruth: InteriorGroundTruth;
    readonly schemes: readonly ScoringSchemeId[];
    readonly weights: SchemeWeights;
  }): ScoredAnswer;
}
