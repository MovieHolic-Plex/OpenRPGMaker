import { parseToolVerdict, VERIFICATION_TOOL_NAMES, type ToolResultLike, type Verdict } from "./agentVerification";
import { acceptanceRecord, type AcceptanceCriterion } from "./assistantAcceptance";
import { getTool } from "@/editor/tools/toolRegistry";
import { normalizeArgsForSchema, validateArgs } from "@/editor/tools/jsonSchema";
import { COORD_SCHEMA } from "@/editor/tools/schemaShapes";
import { isSceneTestInput, type SceneInteractionReceipt, type SceneTestInput } from "@/testing/sceneTestRunner";
import type { Project } from "@/project/types";
import { genId } from "@/util/id";
import { validateWalkthroughScenario } from "@/testing/walkthroughRunner";

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
  /** Host declaration provenance; user-refined executable criteria are not amendable. */
  readonly aiDeclared?: boolean;
  readonly mapTargets?: readonly string[];
  readonly initialState?: unknown;
  readonly interactionTargets?: readonly SceneInteractionReceipt[];
}
interface RequirementState { requirement: VerificationRequirement; pass: boolean; stale: boolean; criterionPassed: boolean; inactive?: boolean }
interface Finding {
  readonly approachCheckId?: string;
  readonly source: "explicit" | "advisory";
  readonly baselineLint?: boolean;
  readonly checkId: string;
  readonly initialState?: unknown;
  readonly ownerId?: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly result: ToolResultLike;
  readonly verdict: Verdict;
}
export interface ApproachPreview {
  readonly previewId: string;
  readonly checkId: string;
  readonly ownerId: string;
  readonly failedAttemptId: string;
  readonly contentRevision: number;
  readonly originalArgs: Record<string, unknown>;
  readonly args: Record<string, unknown>;
  readonly initialState: unknown;
  readonly insertion: { readonly stepIndex: number; readonly mapId: string; readonly step: { readonly kind: "walk"; readonly to: { readonly x: number; readonly y: number }; readonly adjacent: true } };
  readonly interactionTargets: readonly SceneInteractionReceipt[];
}
export interface ApproachRevision extends ApproachPreview {
  readonly revisionId: string;
  readonly confirmation: { readonly id: string; readonly source: "user"; readonly previewId: string };
}
interface ApproachResolution { readonly checkId: string; readonly revisionId: string; readonly attemptId: string; readonly contentRevision: number }

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
  if (name === "play_walkthrough" && !validateWalkthroughScenario(args.scenario).ok) return null;
  if (name === "check_reachability" && (validateArgs(COORD_SCHEMA, args.from).length
    || !Array.isArray(args.targets) || args.targets.some(point => validateArgs(COORD_SCHEMA, point).length))) return null;
  return args;
}

/** Host snapshot shared by ordinary declarations, canonical declarations and execution. */
export function verificationInitialState(name: string, project: Project): unknown {
  if (name !== "run_scene_test") return undefined;
  return { session: project.session, flags: project.flags, switches: project.switches.map(entry => entry.id), variables: project.variables.map(entry => entry.id) };
}

/** Partial ownership can be retained while pending; executable scopes require every interaction. */
export function parseSceneInteractionTargets(input: SceneTestInput, raw: unknown, complete = true): SceneInteractionReceipt[] | null {
  if (!Array.isArray(raw)) return null;
  const targets: SceneInteractionReceipt[] = [];
  let previous = -1;
  for (const target of raw) {
    if (!acceptanceRecord(target) || Object.keys(target).some(k => !["stepIndex", "mapId", "eventId"].includes(k))
      || typeof target.stepIndex !== "number" || !Number.isSafeInteger(target.stepIndex) || target.stepIndex <= previous
      || typeof target.mapId !== "string" || !target.mapId || typeof target.eventId !== "string") return null;
    const step = input.steps[target.stepIndex];
    if (step?.kind !== "interact" || typeof step.eventId !== "string" || target.eventId !== step.eventId) return null;
    targets.push({ stepIndex: target.stepIndex, mapId: target.mapId, eventId: target.eventId });
    previous = target.stepIndex;
  }
  return complete && targets.length !== input.steps.filter(step => step.kind === "interact").length ? null : targets;
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
      const targets = parseSceneInteractionTargets(args, entry.interactionTargets);
      return targets ? [{ ...reference, tool: entry.tool, args, interactionTargets: targets }] : [];
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
  const selection = data.failedSelection;
  if (acceptanceRecord(selection) && typeof selection.stepIndex === "number" && typeof selection.mapId === "string"
    && typeof selection.eventId === "string") {
    const step = args.steps[selection.stepIndex];
    if (step?.kind === "interact" && step.eventId === selection.eventId) {
      targets.push({ stepIndex: selection.stepIndex, mapId: selection.mapId, eventId: selection.eventId });
      return targets;
    }
  }
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

/** Battle/troop events have no scene interaction receipts; this release cannot authorize them. */
function encounterFreeApproach(project: Project, mapId: string): boolean {
  const map = project.maps[mapId];
  if (!map) return false;
  if ((map.encounterRate ?? 0) <= 0) return true;
  // Native encounters give a nonempty table precedence over legacy troopIds and
  // select only positive integer weights. Treat conditional entries as possible:
  // setup, walking position and time can enable them after the initial snapshot.
  return map.encounterTable?.length
    ? !map.encounterTable.some(entry => Number.isInteger(entry.weight) && entry.weight > 0)
    : !map.troopIds?.length;
}

/** Full diagnostic records (including referenced IDs/locations), never just counts or codes. */
function lintErrorKeys(result: ToolResultLike): string[] | null {
  if (result.ok !== true || !acceptanceRecord(result.data) || !acceptanceRecord(result.data.counts)
    || !Array.isArray(result.data.issues) || !result.data.issues.every(acceptanceRecord)) return null;
  const errors = result.data.issues.filter(issue => issue.severity === "error");
  if (result.data.counts.errors !== errors.length
    || errors.some(issue => typeof issue.code !== "string" || !issue.code || typeof issue.message !== "string" || !issue.message)) return null;
  const keys = errors.map(key).sort();
  if (result.issues?.some(issue => issue.severity === "error" && !keys.includes(key(issue)))) return null;
  return keys;
}

/** Existing declarations and diagnostics, not transferable execution or proof authority. */
export interface VerificationRecoveryState {
  readonly schemaVersion: 1;
  readonly requirements: readonly { readonly requirement: VerificationRequirement; readonly inactive?: boolean }[];
  readonly findings: readonly Finding[];
  readonly attempts: readonly VerificationAttempt[];
  readonly sequence: number;
  readonly revision: number;
  /** undefined = uncaptured; null = capture failed; entries = original error multiset. */
  readonly lintBaseline?: readonly (readonly [string, number])[] | null;
}

/** A session owns adoption. Invocation history can never declare a requirement. */
export class ToolVerificationEvidence {
  private readonly requirements = new Map<string, RequirementState>();
  private readonly findings = new Map<string, Finding>();
  private readonly attempts: VerificationAttempt[] = [];
  private readonly approaches: ApproachRevision[] = [];
  private readonly resolutions: ApproachResolution[] = [];
  private pendingApproach: { preview: ApproachPreview; project: string } | null = null;
  private sequence = 0;
  private revision = 0;
  private lintBaseline: ReadonlyMap<string, number> | null | undefined;

  exportRecovery(): VerificationRecoveryState {
    return structuredClone({ schemaVersion: 1,
      requirements: [...this.requirements.values()].map(({ requirement, inactive }) => ({ requirement, inactive })),
      findings: [...this.findings.values()], attempts: this.attempts, sequence: this.sequence, revision: this.revision,
      lintBaseline: this.lintBaseline ? [...this.lintBaseline] : this.lintBaseline });
  }

  /** Fresh revision invalidates even unowned exploratory passes. No confirmed approach is reauthorized. */
  restoreRecovery(state: VerificationRecoveryState): void {
    const saved = structuredClone(state);
    this.clear();
    this.sequence = saved.sequence;
    this.revision = saved.revision + 1;
    this.lintBaseline = saved.lintBaseline ? new Map(saved.lintBaseline) : saved.lintBaseline;
    for (const { requirement, inactive } of saved.requirements) this.requirements.set(requirement.checkId, {
      requirement, inactive, pass: false, stale: true, criterionPassed: !requirement.criterion,
    });
    for (const finding of saved.findings) this.findings.set(finding.checkId, finding);
    this.attempts.push(...saved.attempts);
  }

  hasLintBaseline(): boolean { return this.lintBaseline !== undefined; }

  /** Host-only capture before writes. Same-goal repair, rebase and continuation cannot replace it. */
  captureLintBaseline(result: ToolResultLike): void {
    if (this.hasLintBaseline()) return;
    const errors = lintErrorKeys(result);
    if (errors === null) { this.lintBaseline = null; return; }
    const counts = new Map<string, number>();
    for (const error of errors) counts.set(error, (counts.get(error) ?? 0) + 1);
    this.lintBaseline = counts;
  }

  private baselineLint(result: ToolResultLike): boolean {
    const errors = lintErrorKeys(result);
    if (!this.lintBaseline || errors === null || errors.length === 0) return false;
    const remaining = new Map(this.lintBaseline);
    for (const error of errors) {
      const count = remaining.get(error) ?? 0;
      if (count === 0) return false;
      remaining.set(error, count - 1);
    }
    return true;
  }

  adopt(requirement: VerificationRequirement): void {
    const existing = this.requirements.get(requirement.checkId);
    if (existing && existing.requirement.args !== null) return;
    if (existing && (existing.requirement.ownerId !== requirement.ownerId || existing.requirement.name !== requirement.name
      || (existing.requirement.acceptedCriterion && key(existing.requirement.acceptedCriterion) !== key(requirement.acceptedCriterion)))) return;
    this.requirements.set(requirement.checkId, { requirement: structuredClone(requirement), pass: false, stale: false, criterionPassed: !requirement.criterion });
  }

  /** Only the host-owned acceptance ledger may change optional/withdrawn authority. */
  setRequirementActive(checkId: string, active: boolean): void {
    const state = this.requirements.get(checkId);
    if (state) state.inactive = !active;
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
      approaches: this.approaches, resolutions: this.resolutions,
    });
  }

  /** Bounded derivation, never execution: the native adjacent walk owns routing and facing. */
  approach(checkId: string, project: Project): Omit<ApproachPreview, "previewId"> | null {
    const state = this.requirements.get(checkId);
    const requirement = state?.requirement;
    const original = requirement?.args;
    const finding = this.findings.get(checkId);
    if (!state || state.inactive || state.pass || !requirement?.aiDeclared || requirement.acceptedCriterion?.kind !== "toolVerdict"
      || requirement.name !== "run_scene_test" || !original || !isSceneTestInput(original)
      || !encounterFreeApproach(project, original.mapId)
      || this.approaches.some(entry => entry.checkId === checkId) || finding?.source !== "explicit") return null;
    const targets = parseSceneInteractionTargets(original, requirement.interactionTargets);
    const attempt = [...this.attempts].reverse().find(entry => entry.name === requirement.name && key(entry.args) === key(original)
      && (entry.checkId === undefined || entry.checkId === checkId));
    const data = attempt && acceptanceRecord(attempt.result.data) ? attempt.result.data : null;
    const failed = data && acceptanceRecord(data.failedSelection) ? data.failedSelection : null;
    const final = data && acceptanceRecord(data.finalState) ? data.finalState : null;
    if (!final || final.gameOver !== false || final.mapId !== original.mapId
      || !Array.isArray(data?.interactions) || data.interactions.length > 0) return null;
    if (!targets || !attempt || attempt.status !== "negative" || attempt.revision !== this.revision || !failed
      || failed.stepIndex !== data?.failedStepIndex || typeof failed.stepIndex !== "number"
      || !targets.some(target => key(target) === key(failed)) || failed.mapId !== original.mapId
      || key(requirement.initialState) !== key(finding.initialState)
      || key(requirement.initialState) !== key(verificationInitialState(requirement.name, project))) return null;
    // This release repairs the first named selection on its starting map. Earlier
    // gameplay, relocation or deferred interpreters require a different contract.
    if (original.steps.slice(0, failed.stepIndex).some(step => !["set", "face", "snapshotRewards", "expect"].includes(step.kind)
      || (step.kind === "set" && (step.mapId !== undefined || step.x !== undefined || step.y !== undefined)))) return null;
    const target = project.maps[original.mapId]?.events.find(event => event.id === failed.eventId);
    if (!target || !target.pages?.length || target.pages.some(page => page.trigger.kind !== "action" || page.movement.type !== "fixed")) return null;
    const insertion = { stepIndex: failed.stepIndex, mapId: original.mapId,
      step: { kind: "walk" as const, to: { x: target.x, y: target.y }, adjacent: true as const } };
    return structuredClone({ checkId, ownerId: requirement.ownerId, failedAttemptId: attempt.attemptId, contentRevision: this.revision,
      originalArgs: original, initialState: requirement.initialState, insertion,
      args: { ...original, steps: [...original.steps.slice(0, insertion.stepIndex), insertion.step, ...original.steps.slice(insertion.stepIndex)] },
      interactionTargets: targets.map(target => ({ ...target, stepIndex: target.stepIndex >= insertion.stepIndex ? target.stepIndex + 1 : target.stepIndex })) });
  }

  previewApproach(checkId: string, project: Project): ApproachPreview | null {
    const approach = this.approach(checkId, project);
    if (!approach) return null;
    const preview = { ...approach, previewId: genId("approach-preview") };
    this.pendingApproach = { preview, project: key(project) };
    return structuredClone(preview);
  }

  /** Host user-action capability only. Caller-supplied scripts or permission prose cannot authorize it. */
  confirmApproach(preview: ApproachPreview, project: Project): ApproachRevision | null {
    const pending = this.pendingApproach;
    if (!pending || key(preview) !== key(pending.preview) || key(project) !== pending.project) return null;
    const current = this.approach(preview.checkId, project);
    if (!current || key({ ...current, previewId: preview.previewId }) !== key(preview)) return null;
    const revision: ApproachRevision = { ...structuredClone(preview), revisionId: genId("approach-revision"),
      confirmation: { id: genId("approach-confirmation"), source: "user", previewId: preview.previewId } };
    this.approaches.push(revision);
    this.pendingApproach = null;
    return structuredClone(revision);
  }

  expireApproachPreview(): void { this.pendingApproach = null; }

  private resolved(finding: Finding): boolean {
    const checkId = finding.approachCheckId ?? finding.checkId;
    const state = this.requirements.get(checkId);
    return !!state?.pass && !state.stale && this.resolutions.some(entry => entry.checkId === checkId && entry.contentRevision === this.revision);
  }

  /** Resolves only this session's stored check; caller data supplies no verdict. */
  correction(checkId: unknown, raw: unknown, project?: Project): { name: string; args: Record<string, unknown> } | null {
    if (typeof checkId !== "string") return null;
    const stored = this.requirements.get(checkId)?.requirement ?? this.findings.get(checkId);
    if (!stored?.args) return null;
    const args = verificationInput(stored.name, raw);
    const approach = this.approaches.find(entry => entry.checkId === checkId);
    if (!args || (approach ? this.requirements.get(checkId)?.inactive || key(approach.args) !== key(args)
      || !project || !encounterFreeApproach(project, approach.insertion.mapId)
      : !compatible(stored.name, stored.args, args))) return null;
    if (stored.name === "run_scene_test" && "result" in stored && key(stored.args) !== key(args)
      && sceneTargets(stored.args, stored.result).length === 0) return null;
    return { name: stored.name, args };
  }

  hasChecks(): boolean { return this.requirements.size > 0 || this.findings.size > 0 || this.attempts.length > 0; }

  clear(): void {
    this.requirements.clear(); this.findings.clear(); this.attempts.length = 0; this.lintBaseline = undefined;
    this.approaches.length = 0; this.resolutions.length = 0; this.expireApproachPreview();
  }

  observe(name: string, raw: Record<string, unknown>, result: ToolResultLike, source: "explicit" | "advisory" = "explicit", ownerId?: string, checkId?: string, initialState?: unknown, ownedCheckIds: readonly string[] = []): Verdict | null {
    if (!VERIFICATION_TOOL_NAMES.has(name)) return null;
    const args = verificationInput(name, raw);
    const verdict = parseToolVerdict(name, result);
    const data = acceptanceRecord(result.data) ? result.data : {};
    const setup = acceptanceRecord(data.setupFailure) ? data.setupFailure : {};
    const unsuccessful = !args || result.ok !== true || ["invalid-input", "execution-failure"].includes(String(setup.kind));
    const candidate = args ?? raw;
    const matching = [...this.requirements.values()].filter(({ requirement, inactive }) => {
      const approach = this.approaches.find(entry => entry.checkId === requirement.checkId);
      return requirement.name === name && (checkId === undefined || requirement.checkId === checkId)
        && requirement.args !== null && (approach
          ? !inactive && source === "explicit" && checkId === requirement.checkId && key(approach.args) === key(candidate)
          : requirement.acceptedCriterion?.kind === "toolVerdict" ? key(requirement.args) === key(candidate) : compatible(name, requirement.args, candidate));
    });
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
      const approach = this.approaches.find(entry => entry.checkId === requirement.checkId);
      const interactions = Array.isArray(data.interactions) ? data.interactions : null;
      const traceMatches = name !== "run_scene_test" || (approach
        ? interactions !== null && !data.failedSelection && !data.setupFailure
          && interactions.every(entry => acceptanceRecord(entry) && entry.stepIndex !== approach.insertion.stepIndex)
          && approach.interactionTargets.every(target => interactions.some(entry => key(entry) === key(target)))
        : matchingTrace(requirement.args!, requirement.interactionTargets ?? [], candidate, result));
      state.pass = !unsuccessful && verdict.pass && traceMatches
        && (requirement.acceptedCriterion?.kind !== "toolVerdict" || source === "explicit" || (state.pass && !state.stale))
        && (requirement.initialState === undefined || key(requirement.initialState) === key(initialState));
      state.stale = false;
      if (state.pass && approach) this.resolutions.push({ checkId: requirement.checkId, revisionId: approach.revisionId,
        attemptId: this.attempts.at(-1)!.attemptId, contentRevision: this.revision });
    }
    if (unsuccessful || invalidProbe) return verdict;
    if (verdict.pass) {
      for (const [id, finding] of this.findings) {
        if (finding.approachCheckId || this.approaches.some(entry => entry.checkId === id)) continue; // Original failures are append-only after amendment.
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
      const approachCheckId = matching.find(state => this.approaches.some(entry => entry.checkId === state.requirement.checkId))?.requirement.checkId;
      const existing = [...this.findings.values()].find(f => f.approachCheckId === approachCheckId && f.name === name && key(f.args) === key(candidate)
        && key(f.initialState) === key(initialState)
        && (name !== "run_lint" || key(lintErrorKeys(f.result)) === key(lintErrorKeys(result)))
        && (name !== "run_scene_test" || key(sceneTargets(f.args, f.result)) === key(sceneTargets(candidate, result))));
      // Identical input can visit distinct map-owned targets after a write.
      // Sharing a requirement must not overwrite another unresolved finding.
      const requirementId = matching[0]?.requirement.checkId;
      const id = existing?.checkId ?? (requirementId && !this.findings.has(requirementId) ? requirementId : `finding-${++this.sequence}`);
      if (!this.findings.has(id)) this.findings.set(id, structuredClone({ checkId: id, ownerId, name, args: candidate, result, verdict, initialState, source,
        ...(approachCheckId ? { approachCheckId } : {}),
        ...(name === "run_lint" ? { baselineLint: key(candidate) === key({}) && this.baselineLint(result) } : {}) }));
      else if (existing && source === "explicit" && existing.source !== "explicit") this.findings.set(id, { ...existing, source });
    }
    return verdict;
  }

  invalidateAfterWrite(): void {
    this.expireApproachPreview();
    this.revision++;
    for (const state of this.requirements.values()) if (state.pass) state.stale = true;
  }

  passed(name: string, checkIds?: readonly string[], ownerId?: string): boolean {
    // 스펙 미지정(args === null)을 여기서 제외하면 안 된다. 형제 하나가 통과했다고 미지정 선언이
    // 함께 만족되면, 선언만 해두고 지정하지 않은 검증이 조용히 완료로 넘어간다 —
    // verificationRouteDeclaration·verificationNativeScopes·verificationPlanAtomicity 가 지키는 성질.
    // 2026-09-10 로그의 complete_work_item 영구 거부는 이 게이트가 아니라 **탈출 경로 미고지** 탓이다:
    // 미지정은 set_work_plan 재선언({checkId, args})으로만 해소되는데 그 사실이 어디에도 없었다.
    // 그 고지는 problems() 문구가 담당한다.
    const states = [...this.requirements.values()].filter(state => !state.inactive && state.requirement.name === name
      && (checkIds === undefined || checkIds.includes(state.requirement.checkId)));
    if (states.length) return states.every(state => state.requirement.args !== null && state.pass && !state.stale && state.criterionPassed)
      && ![...this.findings.values()].some(f => !this.resolved(f) && f.name === name && (checkIds === undefined || states.some(s => s.requirement.ownerId === f.ownerId)));
    return ![...this.findings.values()].some(f => !this.resolved(f) && f.name === name && (ownerId === undefined || f.ownerId === ownerId))
      && this.attempts.some(attempt => attempt.name === name && attempt.status === "passed" && attempt.revision === this.revision && (ownerId === undefined || attempt.ownerId === ownerId));
  }

  /** Canonical proof reads adopted exact scopes, never exploratory invocation history. */
  passedScope(name: string, args: Readonly<Record<string, unknown>>, checkId?: string): boolean {
    const states = [...this.requirements.values()].filter(state => state.requirement.name === name
      && state.requirement.acceptedCriterion?.kind === "toolVerdict"
      && (checkId === undefined || state.requirement.checkId === checkId)
      && key(state.requirement.args) === key(args));
    return states.length > 0 && states.every(state => state.pass && !state.stale)
      && ![...this.findings.values()].some(finding => !this.resolved(finding) && finding.name === name && key(finding.args) === key(args));
  }

  problems(scope: "all" | "blocking" = "all"): readonly string[] {
    const requiredLint = [...this.requirements.values()].some(state => !state.inactive && state.requirement.name === "run_lint");
    return [...new Set([
      ...[...this.findings.values()].filter(f => !this.resolved(f) && (scope === "all" || f.source !== "advisory" || !f.baselineLint || requiredLint))
        .flatMap(f => f.verdict.blockingIssues.map(issue => `${f.name}: ${issue} [${f.checkId}]`)),
      ...[...this.requirements.values()].flatMap(({ requirement, pass, stale, criterionPassed, inactive }) => {
        if (inactive) return [];
        // 스펙 미지정은 **계획의 공백**이므로 계속 blocking 이다 — 선언만 해두고 지정하지 않은 검증이
        // 조용히 "verified" 로 넘어가면 승인 원장이 거짓이 된다. 다만 실행으로는 절대 해소되지 않으므로
        // (observe 의 matching 은 args !== null 만 고른다) 유일한 해소 경로를 문구에 명시한다.
        // 이 문구가 없던 동안 모델은 무엇을 지정해야 하는지 몰라 같은 검증만 반복 실행했다.
        if (requirement.args === null) {
          return [`${requirement.name}: 검증 스펙 미지정 — set_work_plan 의 verificationChecks 에`
            + ` {checkId:"${requirement.checkId}", args:{…}} 로 지정하세요 (실행만으로는 해소되지 않습니다)`
            + ` [${requirement.checkId}]`];
        }
        const problem = stale ? "변경 후 재검증 필요" : !pass || !criterionPassed ? "필수 검증 미통과" : null;
        return problem ? [`${requirement.name}: ${problem} [${requirement.checkId}]`] : [];
      }),
    ])];
  }
}
