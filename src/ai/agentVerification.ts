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
// Retry contract (canonical, shared with todo 5): up to 2 repair re-kicks per layer
// after the initial verification failure = at most 3 verification attempts; a 3rd
// consecutive failure stops the layer with reason "verification_failed". Warnings never
// consume retry budget. evaluate_game_quality blocks ONLY on projectLint errors
// (toolRegistry evaluate_game_quality verdict contract: data.verdict.blocked).

export const RUN_LINT_TOOL = "run_lint";
export const EVALUATE_GAME_QUALITY_TOOL = "evaluate_game_quality";
export const VERIFY_QUEST_TOOL = "verify_quest";
export const PLAY_WALKTHROUGH_TOOL = "play_walkthrough";

/** Tools that author quest records (questId = args.id / args.def.key). */
export const DEFINE_QUEST_FAMILY = ["define_quest", "create_quest"] as const;

/** Retry budget: 2 repair re-kicks per layer → at most 3 verification attempts. */
export const MAX_REPAIR_REKICKS = 2;
export const MAX_VERIFICATION_ATTEMPTS = MAX_REPAIR_REKICKS + 1;

export const STOP_REASON = "verification_failed";

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

/** Retry counter for one layer: number of repair re-kicks already issued (0..2). */
export interface RetryState {
  readonly layerId: string;
  readonly attempts: number;
}

export type RetryAction = "proceed" | "repair" | "stop";

export interface RetryOutcome {
  readonly action: RetryAction;
  readonly state: RetryState;
  /** Present only when action === "stop". */
  readonly reason?: "verification_failed";
  /** Present only when action === "repair" — re-kick message for the session. */
  readonly repairInstruction?: string;
}

export interface LayerVerdictInput {
  readonly name: string;
  readonly result: ToolResultLike;
}

export interface LayerGateResult {
  readonly calls: readonly VerificationCall[];
  readonly verdict: Verdict;
  readonly outcome: RetryOutcome;
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
 * - verify_quest / play_walkthrough block when data.ok === false (their real failure channel).
 * - evaluate_game_quality blocks ONLY on projectLint errors (data.verdict.blocked);
 *   its non-error issues are warnings.
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

  if (name === EVALUATE_GAME_QUALITY_TOOL) {
    const verdictData = asRecord(data?.verdict);
    if (verdictData?.blocked === true) {
      const integrity = asRecord(data?.integrity);
      const objective = asRecord(integrity?.objective);
      const objectiveIssues = Array.isArray(objective?.issues)
        ? (objective.issues as readonly { readonly severity?: string; readonly message?: string }[])
        : [];
      const errors = objectiveIssues.filter((issue) => issue?.severity === "error");
      if (errors.length > 0) blocking.push(...errors.map((issue) => issue.message || "projectLint 오류"));
      else blocking.push("게임 품질 평가 차단: projectLint 오류");
    }
    for (const issue of issuesOf(result)) {
      if (issue?.severity !== undefined && issue.severity !== "error") warnings.push(issue.message || "경고");
    }
  } else if (name === VERIFY_QUEST_TOOL || name === PLAY_WALKTHROUGH_TOOL) {
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

// ── retry tracking ───────────────────────────────────────────────

export function createRetryState(layerId: string): RetryState {
  return { layerId, attempts: 0 };
}

/**
 * Repair instruction for the session's existing re-kick mechanism (assistantSession
 * pushOrchestrationMessage tone: Korean imperative, lists the blocking items, states the
 * remaining budget — mirrors "검수 보완 지시: ..." pattern).
 */
export function buildRepairInstruction(verdict: Verdict, attemptsUsed: number): string {
  const lines = [
    "검증 게이트가 통과하지 못했습니다. 아래 차단 항목을 수정한 뒤 이 레이어 작업을 이어서 진행하고 다시 검증하세요.",
    ...verdict.blockingIssues.map((issue) => `- ${issue}`),
    `(재검증 기회 ${MAX_REPAIR_REKICKS}회 중 ${attemptsUsed}회 사용 — 초과 시 레이어 중단)`,
  ];
  return lines.join("\n");
}

/**
 * Retry decision after one verification attempt for a layer.
 * - pass → proceed (budget resets; warnings never consumed budget since pass requires
 *   zero blocking issues).
 * - fail with attempts already at the re-kick cap → stop (reason "verification_failed").
 * - fail otherwise → repair re-kick (attempts + 1) with a repair instruction.
 * Stale state for a different layer is treated as fresh (pure, stateless across layers).
 */
export function evaluateRetry(state: RetryState, layerId: string, verdict: Verdict): RetryOutcome {
  const effective = state.layerId === layerId ? state : { layerId, attempts: 0 };
  if (verdict.pass) {
    return { action: "proceed", state: { layerId, attempts: 0 } };
  }
  if (effective.attempts >= MAX_REPAIR_REKICKS) {
    return { action: "stop", state: effective, reason: STOP_REASON };
  }
  const attempts = effective.attempts + 1;
  return {
    action: "repair",
    state: { layerId, attempts },
    repairInstruction: buildRepairInstruction(verdict, attempts),
  };
}

/**
 * Composed gate: select the verification calls for the layer, parse the executed tool
 * results into a verdict, and produce the retry outcome. Pure — the session executes
 * `calls` and feeds `results` back.
 */
export function runLayerVerificationGate(
  layer: LayerDescriptor,
  history: readonly VerificationCallRecord[],
  results: readonly LayerVerdictInput[],
  retryState: RetryState
): LayerGateResult {
  const calls = selectVerificationCalls(layer, history);
  const verdict = parseLayerVerdict(results);
  const outcome = evaluateRetry(retryState, layer.id ?? "", verdict);
  return { calls, verdict, outcome };
}
