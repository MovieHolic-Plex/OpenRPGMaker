import { parseToolVerdict, VERIFICATION_TOOL_NAMES, type ToolResultLike, type Verdict } from "./agentVerification";
import { acceptanceRecord, type AcceptanceCriterion } from "./assistantAcceptance";
import { getTool } from "@/editor/tools/toolRegistry";
import { normalizeArgsForSchema, validateArgs } from "@/editor/tools/jsonSchema";
import { COORD_SCHEMA } from "@/editor/tools/schemaShapes";
import { isSceneTestInput, type SceneInteractionReceipt } from "@/testing/sceneTestRunner";

function key(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    acceptanceRecord(entry) ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);
}

export interface VerificationCriterionRef { readonly promiseId: string; readonly criterionIndex: number }
export type VerificationCheck = { readonly checkId?: string } & (
  | { readonly tool: string; readonly criterion: VerificationCriterionRef }
  | { readonly tool: string; readonly args: Record<string, unknown>; readonly interactionTargets?: readonly SceneInteractionReceipt[] });
export interface VerificationRequirement {
  readonly checkId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly args: Record<string, unknown> | null;
  readonly criterion?: VerificationCriterionRef;
  readonly acceptedCriterion?: AcceptanceCriterion;
  readonly mapTargets?: readonly string[];
  readonly initialState?: unknown;
  readonly interactionTargets?: readonly SceneInteractionReceipt[];
}
interface RequirementState { requirement: VerificationRequirement; pass: boolean; stale: boolean; criterionPassed: boolean }
interface Finding {
  readonly checkId: string;
  readonly initialState?: unknown;
  readonly ownerId?: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly result: ToolResultLike;
  readonly verdict: Verdict;
}
export interface VerificationAttempt {
  readonly attemptId: string;
  readonly revision: number;
  readonly ownerId?: string;
  readonly checkId?: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly result: ToolResultLike;
  readonly status: "passed" | "negative" | "unsuccessful" | "setup-failure";
}

/** Same validation boundary for declarations and correction, without executing a probe. */
export function verificationInput(name: string, raw: unknown): Record<string, unknown> | null {
  const tool = getTool(name);
  if (!tool || tool.mode !== "read" || !VERIFICATION_TOOL_NAMES.has(name) || !acceptanceRecord(raw)) return null;
  const args = normalizeArgsForSchema(tool.parameters, structuredClone(raw));
  if (!acceptanceRecord(args) || validateArgs(tool.parameters, args).length) return null;
  if (name === "run_scene_test" && !isSceneTestInput(args)) return null;
  if (name === "check_reachability" && (validateArgs(COORD_SCHEMA, args.from).length
    || !Array.isArray(args.targets) || args.targets.some(point => validateArgs(COORD_SCHEMA, point).length))) return null;
  return args;
}

export function parseVerificationChecks(raw: unknown): readonly VerificationCheck[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const parsed = raw.flatMap((entry): VerificationCheck[] => {
    if (!acceptanceRecord(entry) || typeof entry.tool !== "string" || !VERIFICATION_TOOL_NAMES.has(entry.tool)
      || (entry.checkId !== undefined && (typeof entry.checkId !== "string" || !entry.checkId))) return [];
    const reference = typeof entry.checkId === "string" ? { checkId: entry.checkId } : {};
    if (Object.keys(entry).every(k => ["tool", "criterion", "checkId"].includes(k)) && acceptanceRecord(entry.criterion)
      && Object.keys(entry.criterion).every(k => ["promiseId", "criterionIndex"].includes(k))
      && typeof entry.criterion.promiseId === "string" && entry.criterion.promiseId.length > 0
      && typeof entry.criterion.criterionIndex === "number" && Number.isSafeInteger(entry.criterion.criterionIndex) && entry.criterion.criterionIndex >= 0) {
      return [{ ...reference, tool: entry.tool, criterion: { promiseId: entry.criterion.promiseId, criterionIndex: entry.criterion.criterionIndex } }];
    }
    if (Object.keys(entry).some(k => !["tool", "args", "interactionTargets", "checkId"].includes(k))) return [];
    const args = verificationInput(entry.tool, entry.args);
    if (!args) return [];
    if (entry.tool === "run_scene_test" && isSceneTestInput(args)) {
      const interactions = args.steps.flatMap((step, stepIndex) => step.kind === "interact" ? [{ step, stepIndex }] : []);
      if (!Array.isArray(entry.interactionTargets) || entry.interactionTargets.length !== interactions.length) return [];
      const targets: SceneInteractionReceipt[] = [];
      for (const [index, { step, stepIndex }] of interactions.entries()) {
        const target: unknown = entry.interactionTargets[index];
        if (!acceptanceRecord(target) || Object.keys(target).some(k => !["stepIndex", "mapId", "eventId"].includes(k))
          || target.stepIndex !== stepIndex || typeof target.mapId !== "string" || !target.mapId
          || typeof step.eventId !== "string" || target.eventId !== step.eventId) return [];
        targets.push({ stepIndex, mapId: target.mapId, eventId: step.eventId });
      }
      return [{ ...reference, tool: entry.tool, args, interactionTargets: targets }];
    }
    return entry.interactionTargets === undefined ? [{ ...reference, tool: entry.tool, args }] : [];
  });
  return parsed.length === raw.length ? parsed : undefined;
}

function sceneIdentity(args: Record<string, unknown>): unknown {
  if (!isSceneTestInput(args)) return args;
  // Facing is the only permitted script repair. Movement, debug state, reward
  // snapshots and all assertions stay ordered and exact, including map guards.
  return { ...args, steps: args.steps.filter(step => step.kind !== "face") };
}
function compatible(name: string, original: Record<string, unknown>, args: Record<string, unknown>): boolean {
  if (key(original) === key(args)) return true;
  return name === "run_scene_test" && isSceneTestInput(original) && isSceneTestInput(args)
    && original.steps.some(step => step.kind === "interact")
    && original.steps.filter(step => step.kind === "interact").every(step => typeof step.eventId === "string")
    && key(sceneIdentity(original)) === key(sceneIdentity(args));
}
function sceneTargets(args: Record<string, unknown>, result: ToolResultLike): SceneInteractionReceipt[] {
  if (!isSceneTestInput(args) || !acceptanceRecord(result.data)) return [];
  const data = result.data;
  const trace = Array.isArray(data.interactions) ? data.interactions : [];
  const targets = trace.filter((entry): entry is SceneInteractionReceipt => acceptanceRecord(entry)
    && typeof entry.stepIndex === "number" && typeof entry.mapId === "string" && typeof entry.eventId === "string");
  const failure = data.setupFailure;
  if (acceptanceRecord(failure) && failure.kind === "no-interaction-target" && typeof failure.stepIndex === "number" && typeof failure.mapId === "string") {
    const step = args.steps[failure.stepIndex];
    if (step?.kind === "interact" && step.eventId) targets.push({ stepIndex: failure.stepIndex, mapId: failure.mapId, eventId: step.eventId });
  }
  return targets;
}
function canonicalTarget(args: Record<string, unknown>, target: SceneInteractionReceipt): SceneInteractionReceipt {
  return { ...target, stepIndex: isSceneTestInput(args)
    ? args.steps.slice(0, target.stepIndex).filter(step => step.kind !== "face").length : target.stepIndex };
}
function matchingTrace(original: Record<string, unknown>, targets: readonly SceneInteractionReceipt[], args: Record<string, unknown>, result: ToolResultLike): boolean {
  const observed = sceneTargets(args, result).map(target => canonicalTarget(args, target));
  return targets.every(target => observed.some(entry => key(entry) === key(canonicalTarget(original, target))));
}

/** A session owns adoption. Invocation history can never declare a requirement. */
export class ToolVerificationEvidence {
  private readonly requirements = new Map<string, RequirementState>();
  private readonly findings = new Map<string, Finding>();
  private readonly attempts: VerificationAttempt[] = [];
  private sequence = 0;
  private revision = 0;

  adopt(requirement: VerificationRequirement): void {
    const existing = this.requirements.get(requirement.checkId);
    if (existing && existing.requirement.args !== null) return;
    if (existing && (existing.requirement.ownerId !== requirement.ownerId || existing.requirement.name !== requirement.name
      || (existing.requirement.acceptedCriterion && key(existing.requirement.acceptedCriterion) !== key(requirement.acceptedCriterion)))) return;
    this.requirements.set(requirement.checkId, { requirement: structuredClone(requirement), pass: false, stale: false, criterionPassed: !requirement.criterion });
  }

  setCriterionPassed(checkId: string, passed: boolean): void {
    const state = this.requirements.get(checkId);
    if (state?.requirement.criterion) state.criterionPassed = passed;
  }

  snapshot(includeAttempts = true) {
    return structuredClone({
      requirements: [...this.requirements.values()].map(({ requirement, pass, stale, criterionPassed }) => ({ ...requirement,
        status: requirement.args === null ? "pending-specification" : stale ? "stale" : pass && criterionPassed ? "passed" : "unverified" })),
      findings: [...this.findings.values()], attempts: includeAttempts ? this.attempts : [],
    });
  }

  /** Resolves only this session's stored check; caller data supplies no verdict. */
  correction(checkId: unknown, raw: unknown): { name: string; args: Record<string, unknown> } | null {
    if (typeof checkId !== "string") return null;
    const stored = this.requirements.get(checkId)?.requirement ?? this.findings.get(checkId);
    if (!stored?.args) return null;
    const args = verificationInput(stored.name, raw);
    if (!args || !compatible(stored.name, stored.args, args)) return null;
    if (stored.name === "run_scene_test" && "result" in stored && key(stored.args) !== key(args)
      && sceneTargets(stored.args, stored.result).length === 0) return null;
    return { name: stored.name, args };
  }

  clear(): void { this.requirements.clear(); this.findings.clear(); this.attempts.length = 0; }

  observe(name: string, raw: Record<string, unknown>, result: ToolResultLike, source: "explicit" | "advisory" = "explicit", ownerId?: string, checkId?: string, initialState?: unknown, ownedCheckIds: readonly string[] = []): Verdict | null {
    if (!VERIFICATION_TOOL_NAMES.has(name)) return null;
    const args = verificationInput(name, raw);
    const verdict = parseToolVerdict(name, result);
    const data = acceptanceRecord(result.data) ? result.data : {};
    const setup = acceptanceRecord(data.setupFailure) ? data.setupFailure : {};
    const unsuccessful = !args || result.ok !== true || ["invalid-input", "execution-failure"].includes(String(setup.kind));
    const candidate = args ?? raw;
    const matching = [...this.requirements.values()].filter(({ requirement }) => requirement.name === name
      && (checkId === undefined || requirement.checkId === checkId)
      && requirement.args !== null && compatible(name, requirement.args, candidate));
    const invalidProbe = !unsuccessful && matching.length === 0 && setup.kind === "no-interaction-target"
      && isSceneTestInput(candidate) && !candidate.steps.some(step => step.kind === "expect" || (step.kind === "interact" && step.eventId !== undefined))
      && Array.isArray(data.interactions) && !data.interactions.some(entry => acceptanceRecord(entry) && entry.stepIndex === setup.stepIndex);
    const status = unsuccessful ? "unsuccessful" : invalidProbe ? "setup-failure" : verdict.pass ? "passed" : "negative";
    this.attempts.push(structuredClone({ attemptId: `attempt-${++this.sequence}`, revision: this.revision, name, args: raw, result, status, ownerId, checkId }));
    for (const state of this.requirements.values()) {
      const requirement = state.requirement;
      if (requirement.name !== name) continue;
      if (unsuccessful && (checkId === requirement.checkId || (source === "explicit" && (ownerId === requirement.ownerId || ownedCheckIds.includes(requirement.checkId))))) state.pass = false;
      if (!matching.includes(state)) continue;
      const traceMatches = name !== "run_scene_test" || matchingTrace(requirement.args!, requirement.interactionTargets ?? [], candidate, result);
      state.pass = !unsuccessful && verdict.pass && traceMatches
        && (requirement.initialState === undefined || key(requirement.initialState) === key(initialState));
      state.stale = false;
    }
    if (unsuccessful || invalidProbe) return verdict;
    if (verdict.pass) {
      for (const [id, finding] of this.findings) {
        if ((checkId !== undefined && id !== checkId) || finding.name !== name || !compatible(name, finding.args, candidate)
          || (finding.initialState !== undefined && key(finding.initialState) !== key(initialState))) continue;
        const targets = sceneTargets(finding.args, finding.result);
        // No failed-early trace is evidence for a changed script. Exact reruns
        // still work, but must retain every previously observed map/event pair.
        if (name === "run_scene_test" && ((!targets.length && key(finding.args) !== key(candidate))
          || !matchingTrace(finding.args, targets, candidate, result))) continue;
        this.findings.delete(id);
      }
    } else {
      const existing = [...this.findings.values()].find(f => f.name === name && key(f.args) === key(candidate)
        && key(f.initialState) === key(initialState)
        && (name !== "run_scene_test" || key(sceneTargets(f.args, f.result)) === key(sceneTargets(candidate, result))));
      // Identical input can visit distinct map-owned targets after a write.
      // Sharing a requirement must not overwrite another unresolved finding.
      const requirementId = matching[0]?.requirement.checkId;
      const id = existing?.checkId ?? (requirementId && !this.findings.has(requirementId) ? requirementId : `finding-${++this.sequence}`);
      if (!this.findings.has(id)) this.findings.set(id, structuredClone({ checkId: id, ownerId, name, args: candidate, result, verdict, initialState }));
    }
    return verdict;
  }

  invalidateAfterWrite(): void {
    this.revision++;
    for (const state of this.requirements.values()) if (state.pass) state.stale = true;
  }

  passed(name: string, checkIds?: readonly string[], ownerId?: string): boolean {
    const states = [...this.requirements.values()].filter(state => state.requirement.name === name
      && (checkIds === undefined || checkIds.includes(state.requirement.checkId)));
    if (states.length) return states.every(state => state.requirement.args !== null && state.pass && !state.stale && state.criterionPassed)
      && ![...this.findings.values()].some(f => f.name === name && (checkIds === undefined || states.some(s => s.requirement.ownerId === f.ownerId)));
    return ![...this.findings.values()].some(f => f.name === name && (ownerId === undefined || f.ownerId === ownerId))
      && this.attempts.some(attempt => attempt.name === name && attempt.status === "passed" && attempt.revision === this.revision && (ownerId === undefined || attempt.ownerId === ownerId));
  }

  problems(): readonly string[] {
    return [...new Set([
      ...[...this.findings.values()].flatMap(f => f.verdict.blockingIssues.map(issue => `${f.name}: ${issue} [${f.checkId}]`)),
      ...[...this.requirements.values()].flatMap(({ requirement, pass, stale, criterionPassed }) => {
        const problem = requirement.args === null ? "pending specification" : stale ? "변경 후 재검증 필요" : !pass || !criterionPassed ? "필수 검증 미통과" : null;
        return problem ? [`${requirement.name}: ${problem} [${requirement.checkId}]`] : [];
      }),
    ])];
  }
}
