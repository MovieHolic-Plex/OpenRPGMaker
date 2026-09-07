import { isFunctionalCriterionKind, parseFunctionalRequirements, type FunctionalCriterion, type FunctionalRefinement, type UnresolvedFunctionalRequirement } from "./functionalAcceptance";
import type { Project } from "@/project/types";
import { isVerifiedActionCombatProof, type ActionCombatProofReceipt } from "@/testing/actionCombatProof";
import {
  parseAcceptanceCriteria,
  acceptanceRecord, type AcceptanceTarget,
  type AcceptancePromise, type AcceptanceSnapshot, type AcceptanceItemSnapshot, type AcceptanceSource, type RequirementWithdrawalAction,
} from "./assistantAcceptance";
import {
  acceptanceFingerprint, acceptanceReviewRegion, criterionTargets, evaluateAcceptanceCriterion, resolveAcceptanceMap,
} from "./assistantAcceptanceEvaluation";

import { AssistantImageEvidence, coveredByImages, type AcceptanceImageReceipt } from "./assistantImageEvidence";
import type { ToolVerificationEvidence } from "./toolVerificationEvidence";
export type { AcceptanceImageReceipt } from "./assistantImageEvidence";

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

  constructor(readonly id: string, readonly goal: string, baseline: Project, private readonly images = new AssistantImageEvidence()) {
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
      if (!this.promises.has(promise.id)) this.promises.set(promise.id, {
        id: promise.id, title: promise.title, criteria: structuredClone(promise.criteria),
        required: promise.required !== false, baseline, source: provenance,
      });
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

  repair(itemId: unknown, criteria: unknown): boolean {
    const promise = typeof itemId === "string" ? this.promises.get(itemId) : undefined;
    const parsed = parseAcceptanceCriteria(criteria);
    if (!promise || promise.criteria !== null || !parsed) return false;
    this.promises.set(promise.id, { ...promise, criteria: parsed });
    return true;
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

  getFunctionalCriteria(): readonly FunctionalCriterion[] {
    return structuredClone([...this.promises.values()].filter(promise => promise.required !== false && !promise.withdrawal)
      .flatMap(promise => promise.criteria ?? []).filter((criterion): criterion is FunctionalCriterion => isFunctionalCriterionKind(criterion.kind)));
  }

  /** Called on the canonical reloaded snapshot inside accepted-revision proof. */
  functionalProblems(project: Project): readonly string[] {
    this.bind(project);
    return [...this.promises.values()].filter(promise => promise.required !== false && !promise.withdrawal)
      .flatMap(promise => (promise.criteria ?? []).filter(criterion => isFunctionalCriterionKind(criterion.kind)).map(criterion =>
        evaluateAcceptanceCriterion(criterion, { project, baseline: promise.baseline, bindings: this.bindings, reviewed: () => false })))
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
    if (typeof itemId !== "string" || typeof note !== "string" || !note.trim()
      || (verdict !== "pass" && verdict !== "fail")) return false;
    this.bind(project);
    const promise = this.promises.get(itemId);
    const criteria = promise?.criteria;
    if (!promise || !criteria?.some(criterion => criterion.kind === "imageReviewed")) return false;
    const receipts = this.images.current(project);
    const covered = criteria.every(criterion => {
      if (criterion.kind !== "imageReviewed") return true;
      const map = resolveAcceptanceMap(project, criterion.target, this.bindings);
      return map && coveredByImages(receipts, map, acceptanceReviewRegion(map, promise.baseline.maps[map.id], criterion.region));
    });
    if (covered) this.reviews.set(itemId, { receipts, note: note.trim(), passed: verdict === "pass" });
    return covered;
  }

  /** Read-only draft evidence for the independent reviewer, not applied verification. */
  evaluateForReview(draft: Project, verification?: ToolVerificationEvidence): AcceptanceSnapshot {
    const previous = this.snapshot;
    const result = this.evaluate(draft, draft, verification, [], true);
    this.snapshot = previous;
    return result;
  }

  evaluate(applied: Project, draft = applied, verification?: ToolVerificationEvidence,
    blockingProblems: readonly string[] = [], deliveredImagesOnly = false): AcceptanceSnapshot {
    this.bind(draft);
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
      if (!promise.criteria) return Object.freeze({ ...metadata, id: promise.id, title: promise.title, status: "blocked", reason: "Missing or malformed criteria: repair_acceptance required", evidence: Object.freeze([]) });
      const review = this.reviews.get(promise.id);
      const evidence = promise.criteria.map(criterion => {
        const result = evaluateAcceptanceCriterion(criterion, {
          project: applied, baseline: promise.baseline, bindings: this.bindings, verification,
          reviewed: (map, region) => deliveredImagesOnly
            ? coveredByImages(this.images.matching(applied), map, region)
            : review?.passed === true && coveredByImages(this.currentReceipts(review.receipts, applied), map, region),
          actionProven: map => isVerifiedActionCombatProof(this.actionProofs.get(map.id), applied, map.id),
        });
        return Object.freeze({
          ...result,
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
