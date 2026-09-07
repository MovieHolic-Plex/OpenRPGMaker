import { isFunctionalCriterionKind, parseFunctionalRequirements, type FunctionalCriterion, type FunctionalRefinement, type UnresolvedFunctionalRequirement } from "./functionalAcceptance";
import type { Project } from "@/project/types";
import { isVerifiedActionCombatProof, type ActionCombatProofReceipt } from "@/testing/actionCombatProof";
import {
  ACCEPTANCE_EXAMPLES, parseAcceptanceCriteriaResult, pendingCanonicalScene,
  type AcceptancePromise, type AcceptanceSnapshot, type AcceptanceItemSnapshot, type AcceptanceIssue, type AcceptanceCriterion,
  acceptanceRecord, type AcceptanceTarget,
  type AcceptanceSource, type RequirementWithdrawalAction,
} from "./assistantAcceptance";
import {
  acceptanceFingerprint, acceptanceReviewRegion, criterionTargets, evaluateAcceptanceCriterion, resolveAcceptanceMap, type AcceptanceEvaluation,
} from "./assistantAcceptanceEvaluation";

import { AssistantImageEvidence, coveredByImages, type AcceptanceImageReceipt } from "./assistantImageEvidence";
import { verificationInput, verificationInitialState, type ToolVerificationEvidence } from "./toolVerificationEvidence";
export type { AcceptanceImageReceipt } from "./assistantImageEvidence";

export interface AcceptanceToolResult {
  readonly ok: boolean;
  readonly code: "repaired" | "reviewed" | "unknown-item" | "immutable-valid" | "malformed-criteria" | "invalid-review" | "image-review-unavailable";
  readonly issues: readonly AcceptanceIssue[];
}

/** Session-owned ledger. Plans never own or replace its promises/baselines. */
export class AssistantAcceptanceLedger {
  private readonly baseline: Project;
  private readonly promises = new Map<string, AcceptancePromise & {
    readonly baseline: Project;
    readonly source: AcceptanceSource;
    readonly refinements?: readonly AcceptanceSource[];
    readonly withdrawal?: RequirementWithdrawalAction & { readonly source: "user" };
  }>();
  private readonly actionRequirements = new Map<string, AcceptancePromise & { readonly baseline: Project }>();
  private readonly actionProofs = new Map<string, ActionCombatProofReceipt>();
  private readonly bindings = new Map<string, string>();
  private readonly reviews = new Map<string, {
    readonly receipts: readonly AcceptanceImageReceipt[];
    readonly note: string;
    readonly passed: boolean;
  }>();
  private snapshot: AcceptanceSnapshot;
  private stopped = false;

  constructor(readonly id: string, readonly goal: string, baseline: Project, private readonly images = new AssistantImageEvidence(),
    private readonly npcRewardProof?: AcceptanceEvaluation["npcRewardProof"]) {
    this.baseline = structuredClone(baseline);
    this.snapshot = Object.freeze({ id, goal, status: "pending", items: Object.freeze([]) });
  }

  /** requestBaseline must precede this request's writes, even for late adoption. */
  adopt(promises: readonly AcceptancePromise[], requestBaseline = this.baseline,
    source: AcceptanceSource = { requestId: this.id, text: this.goal, scope: null }): void {
    const additions = promises.filter(promise => !this.promises.has(promise.id));
    if (additions.length === 0) return;
    const baseline = structuredClone(requestBaseline);
    const provenance = Object.freeze({ requestId: source.requestId, text: source.text,
      scope: source.scope ? Object.freeze({ mapId: source.scope.mapId, region: Object.freeze({ ...source.scope.region }) }) : null });
    for (const promise of additions) {
      if (this.promises.has(promise.id)) continue;
      const issues = promise.criteria ? this.originalTargetIssues(promise.criteria, baseline) : [];
      this.promises.set(promise.id, { ...structuredClone(promise), baseline, required: promise.required !== false || promise.criteria?.some(pendingCanonicalScene) === true, source: provenance,
        ...(issues.length ? { criteria: null, issues } : {}) });
    }
  }

  getUnresolvedFunctional(): readonly UnresolvedFunctionalRequirement[] {
    return structuredClone([...this.promises.values()].flatMap(promise => {
      const criterion = promise.criteria?.length === 1 ? promise.criteria[0] : undefined;
      return !promise.withdrawal && promise.required !== false && criterion?.kind === "functionalUnresolved"
        ? [{ requirementId: promise.id, source: promise.source, criterion, ...(promise.refinements ? { refinements: promise.refinements } : {}) }] : [];
    }));
  }

  /** Host-only user clarification: refine a placeholder, never a concrete accepted contract. */
  refineFunctional(refinement: FunctionalRefinement, source: AcceptanceSource): boolean {
    const promise = this.promises.get(refinement.requirementId);
    const original = promise?.criteria?.length === 1 ? promise.criteria[0] : undefined;
    if (!promise || promise.withdrawal || original?.kind !== "functionalUnresolved"
      || !source.text.trim() || source.requestId === promise.source.requestId
      || promise.refinements?.some(entry => entry.requestId === source.requestId)) return false;
    const incoming = refinement.criterion.kind === "functionalUnresolved" ? refinement.criterion.expectations : refinement.criterion;
    if (!incoming || (original.expectations && original.expectations.kind !== incoming.kind)) return false;
    const previous: Readonly<Record<string, unknown>> = original.expectations ?? {};
    const next: Readonly<Record<string, unknown>> = incoming;
    const corrections = new Set(refinement.corrections ?? []);
    if ([...corrections].some(key => key === "kind" || !Object.hasOwn(previous, key) || !Object.hasOwn(next, key))) return false;
    if (Object.entries(previous).some(([key, value]) => Object.hasOwn(next, key)
      && acceptanceFingerprint(value) !== acceptanceFingerprint(next[key]) && !corrections.has(key))) return false;
    const criterion = parseFunctionalRequirements([{ ...previous, ...next }])[0];
    if (!criterion) return false;
    this.promises.set(promise.id, { ...promise, criteria: [criterion],
      refinements: [...(promise.refinements ?? []), structuredClone(source)] });
    return true;
  }

  /** Intent-owned obligations are outside planner IDs and cannot be repaired away. */
  requireActionCombat(targets: readonly AcceptanceTarget[], requestBaseline = this.baseline): void {
    for (const target of targets) {
      const id = `action-combat:${acceptanceFingerprint(target)}`;
      if (!this.actionRequirements.has(id)) this.actionRequirements.set(id, {
        id, title: "Action combat", criteria: [{ kind: "actionCombat", target: structuredClone(target) }],
        baseline: structuredClone(requestBaseline),
      });
    }
  }

  /** The async dispatcher supplies the requested map even for failed/aborted runs. */
  captureActionProof(receipt: unknown, project: Project, requestedMapId?: string): boolean {
    const mapId = requestedMapId ?? (acceptanceRecord(receipt) && typeof receipt.mapId === "string" ? receipt.mapId : undefined);
    if (!mapId) {
      this.actionProofs.clear();
      return false;
    }
    this.actionProofs.delete(mapId);
    if (!isVerifiedActionCombatProof(receipt, project, mapId)) return false;
    this.actionProofs.set(mapId, receipt);
    return true;
  }

  repair(itemId: unknown, criteria: unknown): AcceptanceToolResult {
    const promise = typeof itemId === "string" ? this.promises.get(itemId) : undefined;
    if (!promise) return this.unavailableItem();
    const immutable = (): AcceptanceToolResult => ({ ok: false, code: "immutable-valid", issues: [{
      field: "itemId", code: "immutable-valid", expected: "repair missing/malformed criteria, or fill only missing scene ownership; fixed arguments, known targets, sibling criteria and baselines are immutable", example: ACCEPTANCE_EXAMPLES.toolVerdict,
    }] });
    if (promise.criteria !== null && !promise.criteria.some(pendingCanonicalScene)) return immutable();
    const parsed = parseAcceptanceCriteriaResult(criteria);
    if (!parsed.criteria || parsed.criteria.some(pendingCanonicalScene)) return { ok: false, code: "malformed-criteria", issues: parsed.issues };
    if (promise.criteria !== null) {
      const repaired = parsed.criteria;
      const changed = repaired.length !== promise.criteria.length || promise.criteria.some((original, index) => {
        const next = repaired[index];
        if (original.kind !== "toolVerdict" || !pendingCanonicalScene(original)) return acceptanceFingerprint(original) !== acceptanceFingerprint(next);
        return next?.kind !== "toolVerdict" || next.tool !== original.tool
          || acceptanceFingerprint(next.args) !== acceptanceFingerprint(original.args)
          || (original.interactionTargets ?? []).some(target => !next.interactionTargets?.some(entry => acceptanceFingerprint(entry) === acceptanceFingerprint(target)));
      });
      if (changed) return immutable();
    }
    const issues = this.originalTargetIssues(parsed.criteria, promise.baseline);
    if (issues.length) return { ok: false, code: "malformed-criteria", issues };
    this.promises.set(promise.id, { ...promise, criteria: parsed.criteria, issues: undefined });
    return { ok: true, code: "repaired", issues: [] };
  }

  /** Validate against the owning request, never a later draft or applied rebase. */
  private originalTargetIssues(criteria: readonly AcceptanceCriterion[], baseline: Project): AcceptanceIssue[] {
    return criteria.flatMap((criterion, criterionIndex) => {
      if (criterion.kind !== "preserve" && criterion.kind !== "targetChange") return [];
      if (criterion.kind === "targetChange" && "newMapName" in criterion.target) return [];
      if (resolveAcceptanceMap(baseline, criterion.target, this.bindings)) return [];
      return [{ criterionIndex, field: `criteria[${criterionIndex}].target`, code: "unsupported-original-target",
        expected: criterion.kind === "preserve"
          ? "target present in the original request baseline; use an existing mapId (or previously bound name). A newly created map has no original content to preserve"
          : "mapId present in the original request baseline; for creation use an explicit newMapName selector",
        example: ACCEPTANCE_EXAMPLES[criterion.kind] }];
    });
  }

  private unavailableItem(): AcceptanceToolResult {
    return { ok: false, code: "unknown-item", issues: [{ field: "itemId", code: "unknown-item",
      expected: `existing acceptance item ID: ${[...this.promises.keys()].join(", ")}`, example: ACCEPTANCE_EXAMPLES.mapCount }] };
  }

  /** Host-only scope action. Never dispatched from an assistant tool. */
  withdraw(action: RequirementWithdrawalAction): boolean {
    const promise = this.promises.get(action.requirementId);
    if (action.acceptanceId !== this.id || !promise || promise.withdrawal || !action.reason.trim()) return false;
    const withdrawal = Object.freeze({ acceptanceId: this.id, requirementId: promise.id, reason: action.reason.trim(), source: "user" as const });
    this.promises.set(promise.id, { ...promise, withdrawal });
    return true;
  }

  resume(): void { this.stopped = false; }
  stop(): void { this.stopped = true; }
  getSnapshot(): AcceptanceSnapshot { return this.snapshot; }

  /** Detached read-only ownership view. Does not adopt, rebase, bind or forge proof. */
  verificationOwnership(project: Project, additions: readonly AcceptancePromise[] = [], requestBaseline = this.baseline) {
    // Preview only genuinely new promises using the same first-ID-wins and map
    // binding rules as adoption/evaluation, without mutating promises or proof.
    const promises = new Map(this.promises);
    for (const promise of additions) if (!promises.has(promise.id)) promises.set(promise.id, { ...promise, baseline: requestBaseline, source: { requestId: this.id, text: this.goal, scope: null },
      criteria: promise.criteria && this.originalTargetIssues(promise.criteria, requestBaseline).length ? null : promise.criteria });
    const all = [...promises.values(), ...this.actionRequirements.values()];
    const bindings = new Map(this.bindings);
    const attempted = new Set<string>();
    for (const promise of all) for (const criterion of promise.criteria ?? []) for (const target of criterionTargets(criterion)) {
      if (!("newMapName" in target) || bindings.has(target.newMapName) || attempted.has(target.newMapName)) continue;
      attempted.add(target.newMapName);
      const matches = Object.values(project.maps).filter(map => !promise.baseline.maps[map.id] && map.name === target.newMapName);
      if (matches.length === 1 && matches[0]) bindings.set(target.newMapName, matches[0].id);
    }
    return all.flatMap(promise =>
      (promise.criteria ?? []).flatMap((criterion, criterionIndex) => {
        if (criterion.kind !== "reachability" && criterion.kind !== "actionCombat") return [];
        const map = resolveAcceptanceMap(project, criterion.target, bindings);
        const evidence = evaluateAcceptanceCriterion(criterion, {
          project, baseline: promise.baseline, bindings, reviewed: () => false,
          actionProven: target => isVerifiedActionCombatProof(this.actionProofs.get(target.id), project, target.id),
        });
        return [{ promiseId: promise.id, criterionIndex, criterion: structuredClone(criterion),
          active: promise.required !== false && !("withdrawal" in promise && promise.withdrawal),
          mapId: map?.id, passed: evidence.passed }];
      }));
  }

  getFunctionalCriteria(): readonly FunctionalCriterion[] {
    return structuredClone([...this.promises.values()].filter(promise => promise.required !== false && !promise.withdrawal)
      .flatMap(promise => promise.criteria ?? []).filter((criterion): criterion is FunctionalCriterion => isFunctionalCriterionKind(criterion.kind)));
  }

  /** Called on the canonical reloaded snapshot inside accepted-revision proof. */
  functionalProblems(project: Project): readonly string[] {
    this.bind(project);
    return [...this.promises.values()].filter(promise => promise.required !== false && !promise.withdrawal)
      .flatMap(promise => (promise.criteria ?? []).filter(criterion => isFunctionalCriterionKind(criterion.kind)).map(criterion =>
        evaluateAcceptanceCriterion(criterion, { project, baseline: promise.baseline, bindings: this.bindings, reviewed: () => false, npcRewardProof: this.npcRewardProof })))
      .filter(evidence => !evidence.passed).map(evidence => `${evidence.expected} -> ${evidence.observed}`);
  }

  private bind(project: Project): void {
    const attempted = new Set<string>();
    for (const promise of [...this.promises.values(), ...this.actionRequirements.values()]) {
      for (const criterion of promise.criteria ?? []) {
        for (const target of criterionTargets(criterion)) {
          if (!("newMapName" in target) || this.bindings.has(target.newMapName) || attempted.has(target.newMapName)) continue;
          // A later promise's baseline cannot resolve an earlier ambiguous name.
          attempted.add(target.newMapName);
          const matches = Object.values(project.maps).filter(map => !promise.baseline.maps[map.id] && map.name === target.newMapName);
          if (matches.length === 1 && matches[0]) this.bindings.set(target.newMapName, matches[0].id);
        }
      }
    }
  }

  captureImage(project: Project, data: unknown): AcceptanceImageReceipt | null {
    return this.images.capture(project, data);
  }

  /** Called only after successful image render AND insertion in the next model input. */
  deliverImages(receipts: readonly AcceptanceImageReceipt[]): void {
    this.images.deliver(receipts);
  }

  private currentReceipts(receipts: readonly AcceptanceImageReceipt[], project: Project): readonly AcceptanceImageReceipt[] {
    const current = this.images.matching(project);
    return receipts.filter(receipt => current.includes(receipt));
  }

  review(itemId: unknown, note: unknown, project: Project, verdict: unknown): boolean {
    return this.reviewResult(itemId, note, project, verdict).ok;
  }

  reviewResult(itemId: unknown, note: unknown, project: Project, verdict: unknown): AcceptanceToolResult {
    const promise = typeof itemId === "string" ? this.promises.get(itemId) : undefined;
    if (!promise) return this.unavailableItem();
    if (typeof note !== "string" || !note.trim() || (verdict !== "pass" && verdict !== "fail")) return {
      ok: false, code: "invalid-review", issues: [{ field: typeof note !== "string" || !note.trim() ? "note" : "verdict",
        code: "invalid-field", expected: "nonempty note and explicit verdict pass|fail", example: ACCEPTANCE_EXAMPLES.imageReviewed }],
    };
    if (!promise.criteria) return { ok: false, code: "malformed-criteria", issues: promise.issues ?? parseAcceptanceCriteriaResult(undefined).issues };
    this.bind(project);
    const receipts = this.images.current(project);
    const imageCriteria = promise.criteria.filter(criterion => criterion.kind === "imageReviewed");
    const issues: AcceptanceIssue[] = [];
    promise.criteria.forEach((criterion, criterionIndex) => {
      if (criterion.kind !== "imageReviewed") return;
      const map = resolveAcceptanceMap(project, criterion.target, this.bindings);
      if (!map || !coveredByImages(receipts, map, acceptanceReviewRegion(map, promise.baseline.maps[map.id], criterion.region))) {
        issues.push({ criterionIndex, field: `criteria[${criterionIndex}]`, code: "image-review-unavailable",
          expected: "current delivered show_map_region image coverage for this scope, consumed in a subsequent response",
          example: ACCEPTANCE_EXAMPLES.imageReviewed, ...(map ? { mapId: map.id } : {}) });
      }
    });
    if (!imageCriteria.length) issues.push({ field: "itemId", code: "image-review-unavailable",
      expected: "an item with an imageReviewed criterion", example: ACCEPTANCE_EXAMPLES.imageReviewed });
    if (issues.length) return { ok: false, code: "image-review-unavailable", issues };
    this.reviews.set(promise.id, { receipts, note: note.trim(), passed: verdict === "pass" });
    return { ok: true, code: "reviewed", issues: [] };
  }

  bindVerificationRequirements(verification?: ToolVerificationEvidence, project?: Project): void {
    // Canonical tool consumers declare authority before execution. Evaluation can
    // bind a late declaration, but cannot reuse the earlier exploratory attempt.
    const existing = new Map(verification?.snapshot(false).requirements.map(requirement => [requirement.checkId, requirement]));
    for (const promise of this.promises.values()) for (const [index, criterion] of (promise.criteria ?? []).entries()) {
      if (criterion.kind !== "toolVerdict") continue;
      const checkId = `${this.id}:${promise.id}:${index}`;
      const original = existing.get(checkId);
      verification?.adopt({ checkId, ownerId: `${this.id}:${promise.id}`, name: criterion.tool,
        args: pendingCanonicalScene(criterion) ? null : verificationInput(criterion.tool, criterion.args),
        acceptedCriterion: original?.acceptedCriterion ?? criterion,
        interactionTargets: criterion.tool === "run_scene_test" ? criterion.interactionTargets ?? [] : undefined,
        initialState: original ? original.initialState : verificationInitialState(criterion.tool, project ?? promise.baseline) });
      verification?.setRequirementActive(checkId, promise.required !== false && !promise.withdrawal);
    }
  }

  evaluate(applied: Project, draft = applied, verification?: ToolVerificationEvidence,
    blockingProblems: readonly string[] = []): AcceptanceSnapshot {
    this.bind(draft);
    this.bindVerificationRequirements(verification, draft);
    // Retirement is permanent: an edit followed by undo cannot revive old proof.
    for (const [mapId, receipt] of this.actionProofs) {
      if (!isVerifiedActionCombatProof(receipt, draft, mapId)) this.actionProofs.delete(mapId);
    }
    this.images.current(draft);
    for (const [id, review] of this.reviews) {
      const receipts = this.currentReceipts(review.receipts, draft);
      if (receipts.length === 0) this.reviews.delete(id);
      else this.reviews.set(id, { ...review, receipts });
    }
    const promises: (AcceptancePromise & {
      readonly baseline: Project;
      readonly source?: AcceptanceSource;
      readonly refinements?: readonly AcceptanceSource[];
      readonly withdrawal?: RequirementWithdrawalAction & { readonly source: "user" };
    })[] = [...this.promises.values(), ...this.actionRequirements.values()];
    const projectBound = (kind: string): boolean => kind === "toolVerdict" || isFunctionalCriterionKind(kind);
    const toolDraftChanged = applied !== draft
      && promises.some(promise => promise.criteria?.some(criterion => projectBound(criterion.kind)))
      && acceptanceFingerprint(applied) !== acceptanceFingerprint(draft);
    const items: AcceptanceItemSnapshot[] = promises.map(promise => {
      const metadata = { required: promise.required !== false, ...(promise.source ? { source: promise.source } : {}),
        ...(promise.refinements ? { refinements: Object.freeze(promise.refinements.map(source => Object.freeze({ ...source,
          scope: source.scope ? Object.freeze({ ...source.scope, region: Object.freeze({ ...source.scope.region }) }) : null }))) } : {}),
        ...(promise.withdrawal ? { withdrawal: promise.withdrawal } : {}) };
      if (!promise.criteria) return Object.freeze({ ...metadata, id: promise.id, title: promise.title, status: "blocked", reason: "Missing or malformed criteria: repair_acceptance required",
        issues: Object.freeze((promise.issues ?? parseAcceptanceCriteriaResult(undefined).issues).map(issue => Object.freeze({ ...issue, example: ACCEPTANCE_EXAMPLES[issue.example.kind] }))), evidence: Object.freeze([]) });
      const review = this.reviews.get(promise.id);
      const evidence = promise.criteria.map((criterion, criterionIndex) => {
        const result = evaluateAcceptanceCriterion(criterion, {
          project: applied, baseline: promise.baseline, bindings: this.bindings, verification,
          verificationCheckId: `${this.id}:${promise.id}:${criterionIndex}`, npcRewardProof: this.npcRewardProof,
          reviewed: (map, region) => review?.passed === true
            && coveredByImages(this.currentReceipts(review.receipts, applied), map, region),
          actionProven: map => isVerifiedActionCombatProof(this.actionProofs.get(map.id), applied, map.id),
        });
        return Object.freeze({
          ...result,
          ...(result.issues ? { issues: Object.freeze(result.issues.map(issue => Object.freeze({ ...issue,
            criterionIndex, field: `criteria[${criterionIndex}].${issue.field}`,
          }))) } : {}),
          observed: criterion.kind === "imageReviewed" && review
            ? `${result.observed}: ${review.note}` : result.observed,
        });
      });
      const maps = promise.criteria.flatMap(criterion => criterionTargets(criterion));
      const unapplied = (toolDraftChanged && promise.criteria.some(criterion => projectBound(criterion.kind))) || maps.some(target => {
        const before = resolveAcceptanceMap(applied, target, this.bindings), after = resolveAcceptanceMap(draft, target, this.bindings);
        return acceptanceFingerprint(before) !== acceptanceFingerprint(after);
      });
      const first = promise.criteria[0];
      const target = first ? criterionTargets(first)[0] : undefined;
      const map = target ? resolveAcceptanceMap(draft, target, this.bindings) : undefined;
      const region = first && "region" in first ? first.region : undefined;
      const passed = evidence.every(entry => entry.passed) && !unapplied;
      const status = passed ? "verified" : this.stopped ? "blocked" : unapplied ? "verifying" : "working";
      return Object.freeze({
        ...metadata, id: promise.id, title: promise.title, status, evidence: Object.freeze(evidence),
        ...(promise.issues?.length ? { issues: promise.issues } : {}),
        ...(!passed ? { reason: unapplied ? "Draft is not yet applied" : this.stopped ? "Acceptance incomplete; execution stopped" : "Acceptance checks remain open" } : {}),
        ...(map ? { mapId: map.id } : {}), ...(region ? { region: Object.freeze({ ...region }) } : {}),
      });
    });
    if (blockingProblems.length > 0) items.push(Object.freeze({
      id: "required-verification", title: "Required verification", status: "blocked",
      reason: blockingProblems.join("; "),
      evidence: Object.freeze(blockingProblems.map(observed => Object.freeze({
        expected: "Every required check passes against current content", observed, passed: false,
      }))),
    }));
    const required = items.filter(item => item.required !== false && !item.withdrawal);
    const status = items.length > 0 && required.every(item => item.status === "verified") ? "verified"
      : required.some(item => item.status === "blocked") ? "blocked"
      : required.some(item => item.status === "verifying") ? "verifying" : "working";
    this.snapshot = Object.freeze({ id: this.id, goal: this.goal, status, items: Object.freeze(items) });
    return this.snapshot;
  }
}
