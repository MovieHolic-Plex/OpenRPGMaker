// ai/agentVerification.ts
// Todo 3 — pure verification-gate module for autonomous runs.
//
// PURE FUNCTIONS ONLY: no DOM, no store imports, no tool execution. The session loop
// (todo 5) executes the returned verification calls through the existing tool executor.
//
// Canonical layer→tools table (todo 5's integration and its tests MUST match exactly):
//   map/world layer    → [run_lint, evaluate_game_quality]
//   quest/story layer  → [run_lint, verify_quest{questId: most recent successful
//                        define_quest-family call in the RUN history}]
//   final layer        → [run_lint, play_walkthrough{scenario: the layer's OWN successful
//                        play_walkthrough call args (do/expect steps, walkthroughRunner
//                        shape)}] — or, if the layer has no such call,
//                        [run_lint, verify_quest × ALL questIds in run history]
// run_lint is always first; every layer adds nothing beyond the table.
//
// CAUTION (verified in code): generate_walkthrough output is run_scene_test input
// (`kind` steps), NOT play_walkthrough input (`do`/`expect` steps) — this module never
// mixes the two. The final-layer scenario is sourced verbatim from the layer's own
// successful play_walkthrough call args only.
//
// ADVISORY CONTRACT (2026-08-30): this module reports, it does not gate. There is no retry
// budget and no stop reason — a blocking verdict is recorded as run evidence and the run
// continues. Measured cause for the change: the boot normalizer injected default items whose
// skill/state references the loaded project could not satisfy, so run_lint reported the same
// 54 pre-existing violations on every attempt. The gate burned its 3 attempts on damage the
// agent had not caused and could not repair (every cleanup commit was refused by the commit
// gate), killing the run at 217s with the 48-turn budget untouched.
// evaluate_game_quality still reports blocking on its own error-severity issues only (toolRegistry
// evaluate_game_quality verdict contract: data.verdict.blocked). That error set is projectLint
// errors + empty-map (99081a0b1, 2026-08-28) + ending-uninvoked (419e067fa, 2026-09-06) — it was
// projectLint alone until those two landed.

export const RUN_LINT_TOOL = "run_lint";
export const EVALUATE_GAME_QUALITY_TOOL = "evaluate_game_quality";
export const VERIFY_QUEST_TOOL = "verify_quest";
export const PLAY_WALKTHROUGH_TOOL = "play_walkthrough";
/** Checks whose execution success is not evidence that the checked artifact passed. */
export const VERIFICATION_TOOL_NAMES: ReadonlySet<string> = new Set([
  RUN_LINT_TOOL, EVALUATE_GAME_QUALITY_TOOL, VERIFY_QUEST_TOOL, PLAY_WALKTHROUGH_TOOL,
  "check_reachability", "run_scene_test", "simulate_battle", "run_action_combat_test",
]);

/** Tools that author quest records (questId = args.id / args.def.key). */
export const DEFINE_QUEST_FAMILY = ["define_quest", "create_quest"] as const;

/** Canonical per-layer tool names (order = execution order). */
export const LAYER_VERIFICATION_TOOLS = {
  map: [RUN_LINT_TOOL, EVALUATE_GAME_QUALITY_TOOL],
  quest: [RUN_LINT_TOOL, VERIFY_QUEST_TOOL],
  final: [RUN_LINT_TOOL, PLAY_WALKTHROUGH_TOOL],
} as const;

export type LayerKind = "map" | "quest" | "final";

/**
 * Completed work-plan layer descriptor. `kind` is the explicit override; when absent the
 * title is inferred (final > quest > map/world default). `isFinal` marks the plan's last
 * layer. Unknown explicit kinds fall through deterministically to the map/world default.
 */
export interface LayerDescriptor {
  readonly id?: string;
  readonly title: string;
  readonly kind?: string;
  readonly isFinal?: boolean;
  readonly items?: readonly {
    readonly id?: string;
    readonly title?: string;
    readonly instruction?: string;
    readonly successTools?: readonly string[];
  }[];
}

/**
 * One recorded tool call from the run's accumulated history (this layer + all prior
 * layers). `ok` is the call's result; `layerId` optionally attributes the call to the
 * layer that made it (used to find the final layer's OWN play_walkthrough scenario).
 */
export interface VerificationCallRecord {
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly ok: boolean;
  readonly layerId?: string;
}

/** A verification call the session should execute (name + args only — no execution here). */
export interface VerificationCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

/** Structural subset of the toolRunner result shape ({ok, summary, issues, warnings, data}). */
export interface ToolResultLike {
  readonly ok?: boolean;
  readonly summary?: string;
  readonly issues?: readonly { readonly severity?: string; readonly code?: string; readonly message?: string }[];
  readonly warnings?: readonly string[];
  readonly data?: unknown;
}

export interface Verdict {
  readonly pass: boolean;
  readonly blockingIssues: readonly string[];
  readonly warnings: readonly string[];
}

export interface LayerVerdictInput {
  readonly name: string;
  readonly result: ToolResultLike;
}

export interface LayerReport {
  readonly calls: readonly VerificationCall[];
  readonly verdict: Verdict;
}

// ── classification ───────────────────────────────────────────────

const FINAL_LAYER_TITLE_RE = /final|ending|마지막|엔딩|최종|완성|마무리|검증|verify|qa/i;
const QUEST_LAYER_TITLE_RE = /quest|퀘스트|story|스토리|이야기|시나리오|scenario|컷신|cutscene|script|스크립트/i;

/** Deterministic layer classification: explicit kind > title inference > map/world default. */
export function classifyLayer(layer: LayerDescriptor): LayerKind {
  const kind = (layer.kind ?? "").trim().toLowerCase();
  if (kind === "final" || layer.isFinal === true || FINAL_LAYER_TITLE_RE.test(layer.title)) return "final";
  if (kind === "quest" || kind === "story" || QUEST_LAYER_TITLE_RE.test(layer.title)) return "quest";
  // map/world kinds and any unknown explicit kind land here (safe default bucket).
  return "map";
}

// ── questId extraction from run history ──────────────────────────

function questIdOf(record: VerificationCallRecord): string | null {
  if (record.name === "define_quest") {
    const id = record.args?.id;
    return typeof id === "string" && id.trim() !== "" ? id : null;
  }
  if (record.name === "create_quest") {
    const def = record.args?.def;
    if (typeof def === "object" && def !== null && !Array.isArray(def)) {
      const key = (def as Record<string, unknown>).key;
      return typeof key === "string" && key.trim() !== "" ? key : null;
    }
  }
  return null;
}

/** All successful define_quest-family calls in run history, oldest first. */
function questAuthoringRecords(history: readonly VerificationCallRecord[]): VerificationCallRecord[] {
  return history.filter((record) => DEFINE_QUEST_FAMILY.includes(record.name as (typeof DEFINE_QUEST_FAMILY)[number]) && record.ok === true);
}

/** QuestIds in first-appearance order, deduped. */
function allQuestIds(history: readonly VerificationCallRecord[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const record of questAuthoringRecords(history)) {
    const id = questIdOf(record);
    if (id !== null && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** QuestId from the most recent successful define_quest-family call, or null. */
function mostRecentQuestId(history: readonly VerificationCallRecord[]): string | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const record = history[i];
    if (!DEFINE_QUEST_FAMILY.includes(record.name as (typeof DEFINE_QUEST_FAMILY)[number]) || record.ok !== true) continue;
    const id = questIdOf(record);
    if (id !== null) return id;
  }
  return null;
}

/**
 * The final layer's OWN successful play_walkthrough scenario (do/expect steps).
 * Attribution rules: calls carrying `layerId` must match the layer's id; unattributed
 * calls count as this layer's (the final layer runs last, so the most recent
 * unattributed call is its own in practice). Malformed (non-array) scenarios are
 * rejected → null → verify_quest×all fallback.
 */
function layerOwnWalkthroughScenario(layer: LayerDescriptor, history: readonly VerificationCallRecord[]): readonly unknown[] | null {
  const candidates = history.filter((record) => record.name === PLAY_WALKTHROUGH_TOOL && record.ok === true);
  if (candidates.length === 0) return null;
  let pick: VerificationCallRecord | undefined;
  if (layer.id !== undefined && layer.id !== "") {
    pick = [...candidates].reverse().find((record) => record.layerId === undefined || record.layerId === layer.id);
  } else {
    pick = candidates[candidates.length - 1];
  }
  if (pick === undefined) return null;
  const scenario = pick.args?.scenario;
  return Array.isArray(scenario) ? [...scenario] : null;
}

// ── selection ────────────────────────────────────────────────────

/**
 * Ordered verification tool calls for a completed layer, per the canonical table.
 * Pure: returns name+args only; the session executes them.
 */
export function selectVerificationCalls(
  layer: LayerDescriptor,
  history: readonly VerificationCallRecord[] = []
): VerificationCall[] {
  const kind = classifyLayer(layer);
  const calls: VerificationCall[] = [{ name: RUN_LINT_TOOL, args: {} }];

  if (kind === "map") {
    calls.push({ name: EVALUATE_GAME_QUALITY_TOOL, args: {} });
    return calls;
  }

  if (kind === "quest") {
    const questId = mostRecentQuestId(history);
    if (questId !== null) calls.push({ name: VERIFY_QUEST_TOOL, args: { questId } });
    return calls;
  }

  // final layer
  const scenario = layerOwnWalkthroughScenario(layer, history);
  if (scenario !== null) {
    calls.push({ name: PLAY_WALKTHROUGH_TOOL, args: { scenario } });
  } else {
    for (const questId of allQuestIds(history)) {
      calls.push({ name: VERIFY_QUEST_TOOL, args: { questId } });
    }
  }
  return calls;
}

// ── verdict parsing ──────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** Issues from the result's top level, falling back to data.issues (run_lint's real shape). */
function issuesOf(result: ToolResultLike): readonly { readonly severity?: string; readonly code?: string; readonly message?: string }[] {
  if (Array.isArray(result.issues)) return result.issues;
  const data = asRecord(result.data);
  return Array.isArray(data?.issues) ? (data.issues as readonly { readonly severity?: string; readonly code?: string; readonly message?: string }[]) : [];
}

/**
 * Parse ONE tool result into a verdict.
 * - Tool-level failure (ok !== true) always blocks (fail-closed on missing ok).
 * - Scenario checks block when data.ok === false; reachability uses data.reachable.
 * - evaluate_game_quality blocks on data.verdict.blocked, i.e. its error-severity objective issues
 *   (projectLint errors + empty-map + ending-uninvoked); its non-error issues are warnings.
 * - Other tools (run_lint): error-severity issues block; warning/info issues are warnings.
 * - result.warnings never block.
 */
export function parseToolVerdict(name: string, result: ToolResultLike): Verdict {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const data = asRecord(result.data);

  if (result.ok !== true) {
    blocking.push(result.summary?.trim() !== "" && result.summary !== undefined ? result.summary : `${name} 실행 실패`);
  }

  if (name === "run_action_combat_test") {
    if (data?.pass !== true || data.status !== "verified") {
      blocking.push(typeof data?.reason === "string" ? data.reason : "Action combat proof is unverified");
    }
  } else if (name === EVALUATE_GAME_QUALITY_TOOL) {
    const verdictData = asRecord(data?.verdict);
    if (verdictData?.blocked === true) {
      const integrity = asRecord(data?.integrity);
      const objective = asRecord(integrity?.objective);
      const objectiveIssues = Array.isArray(objective?.issues)
        ? (objective.issues as readonly { readonly severity?: string; readonly message?: string }[])
        : [];
      const errors = objectiveIssues.filter((issue) => issue?.severity === "error");
      if (errors.length > 0) blocking.push(...errors.map((issue) => issue.message || "객관 무결성 오류"));
      else blocking.push("무결성 점검 차단: 객관 오류(내역 없음)");
    }
    for (const issue of issuesOf(result)) {
      if (issue?.severity !== undefined && issue.severity !== "error") warnings.push(issue.message || "경고");
    }
  } else if (name === VERIFY_QUEST_TOOL || name === PLAY_WALKTHROUGH_TOOL || name === "run_scene_test") {
    if (data?.ok === false) {
      const reason = data?.failureReason;
      blocking.push(typeof reason === "string" && reason !== "" ? reason : `${name} 검증 실패`);
    }
    for (const issue of issuesOf(result)) {
      if (issue?.severity === "error") blocking.push(issue.message || "오류");
    }
  } else {
    for (const issue of issuesOf(result)) {
      if (issue?.severity === "error") blocking.push(issue.message || issue.code || "오류");
      else if (issue?.severity !== undefined) warnings.push(issue.message || "경고");
    }
    // Counts remain authoritative when detailed issues are omitted or truncated.
    if (name === RUN_LINT_TOOL) {
      const errors = asRecord(data?.counts)?.errors;
      if (typeof errors === "number" && errors > 0 && blocking.length === 0) {
        blocking.push(`lint 오류 ${errors}건`);
      }
    }
    if (name === "check_reachability" && data?.reachable === false) {
      blocking.push("도달 불가 지점이 있습니다");
    }
  }

  for (const warning of result.warnings ?? []) {
    if (typeof warning === "string") warnings.push(warning);
  }

  return {
    pass: blocking.length === 0,
    blockingIssues: [...new Set(blocking)],
    warnings: [...new Set(warnings)],
  };
}

/** Combine per-tool verdicts into one layer verdict; blocking issues prefixed with tool name. */
export function parseLayerVerdict(results: readonly LayerVerdictInput[]): Verdict {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const { name, result } of results) {
    const verdict = parseToolVerdict(name, result);
    for (const issue of verdict.blockingIssues) {
      const prefixed = `${name}: ${issue}`;
      if (!seen.has(prefixed)) {
        seen.add(prefixed);
        blocking.push(prefixed);
      }
    }
    for (const warning of verdict.warnings) {
      const key = `w:${warning}`;
      if (!seen.has(key)) {
        seen.add(key);
        warnings.push(warning);
      }
    }
  }
  return { pass: blocking.length === 0, blockingIssues: blocking, warnings };
}

/**
 * Composed report: select the verification calls for the layer and parse the executed tool
 * results into a verdict. Pure — the session executes `calls`, feeds `results` back, and
 * records the verdict as evidence. Nothing here can stop a run.
 */
export function runLayerVerificationReport(
  layer: LayerDescriptor,
  history: readonly VerificationCallRecord[],
  results: readonly LayerVerdictInput[]
): LayerReport {
  return {
    calls: selectVerificationCalls(layer, history),
    verdict: parseLayerVerdict(results),
  };
}
