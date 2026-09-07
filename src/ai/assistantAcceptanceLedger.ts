import type { Project } from "@/project/types";
import { isVerifiedActionCombatProof, type ActionCombatProofReceipt } from "@/testing/actionCombatProof";
import {
  ACCEPTANCE_EXAMPLES, parseAcceptanceCriteriaResult,
  type AcceptancePromise, type AcceptanceSnapshot, type AcceptanceItemSnapshot, type AcceptanceIssue, type AcceptanceCriterion,
  acceptanceRecord, type AcceptanceTarget,
} from "./assistantAcceptance";
import {
  acceptanceFingerprint, criterionTargets, evaluateAcceptanceCriterion, resolveAcceptanceMap,
} from "./assistantAcceptanceEvaluation";

import { AssistantImageEvidence, coveredByImages, type AcceptanceImageReceipt } from "./assistantImageEvidence";
export type { AcceptanceImageReceipt } from "./assistantImageEvidence";

export interface AcceptanceToolResult {
  readonly ok: boolean;
  readonly code: "repaired" | "reviewed" | "unknown-item" | "immutable-valid" | "malformed-criteria" | "invalid-review" | "image-review-unavailable";
  readonly issues: readonly AcceptanceIssue[];
}

/** Session-owned ledger. Plans never own or replace its promises/baselines. */
export class AssistantAcceptanceLedger {
  private readonly baseline: Project;
  private readonly promises = new Map<string, AcceptancePromise & { readonly baseline: Project }>();
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
  adopt(promises: readonly AcceptancePromise[], requestBaseline = this.baseline): void {
    const additions = promises.filter(promise => !this.promises.has(promise.id));
    if (additions.length === 0) return;
    const baseline = structuredClone(requestBaseline);
    for (const promise of additions) {
      if (this.promises.has(promise.id)) continue;
      const issues = promise.criteria ? this.originalTargetIssues(promise.criteria, baseline) : [];
      this.promises.set(promise.id, { ...structuredClone(promise), baseline,
        ...(issues.length ? { criteria: null, issues } : {}) });
    }
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
    if (promise.criteria !== null) return { ok: false, code: "immutable-valid", issues: [{
      field: "itemId", code: "immutable-valid", expected: "an item with missing/malformed criteria; valid promises and baselines are immutable", example: ACCEPTANCE_EXAMPLES.mapCount,
    }] };
    const parsed = parseAcceptanceCriteriaResult(criteria);
    if (!parsed.criteria) return { ok: false, code: "malformed-criteria", issues: parsed.issues };
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

  resume(): void { this.stopped = false; }
  stop(): void { this.stopped = true; }
  getSnapshot(): AcceptanceSnapshot { return this.snapshot; }

  /** Detached read-only ownership view. Does not adopt, rebase, bind or forge proof. */
  verificationOwnership(project: Project) {
    return [...this.promises.values(), ...this.actionRequirements.values()].flatMap(promise =>
      (promise.criteria ?? []).flatMap((criterion, criterionIndex) => {
        if (criterion.kind !== "reachability" && criterion.kind !== "actionCombat") return [];
        const map = resolveAcceptanceMap(project, criterion.target, this.bindings);
        const evidence = evaluateAcceptanceCriterion(criterion, {
          project, baseline: promise.baseline, bindings: this.bindings, reviewed: () => false,
          actionProven: target => isVerifiedActionCombatProof(this.actionProofs.get(target.id), project, target.id),
        });
        return [{ promiseId: promise.id, criterionIndex, criterion: structuredClone(criterion),
          mapId: map?.id, passed: evidence.passed }];
      }));
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
      if (!map || !coveredByImages(receipts, map, criterion.region ?? { x: 0, y: 0, w: map.width, h: map.height })) {
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

  evaluate(applied: Project, draft = applied, blockingProblems: readonly string[] = []): AcceptanceSnapshot {
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
    const items: AcceptanceItemSnapshot[] = [...this.promises.values(), ...this.actionRequirements.values()].map(promise => {
      if (!promise.criteria) return Object.freeze({ id: promise.id, title: promise.title, status: "blocked", reason: "Missing or malformed criteria: repair_acceptance required",
        issues: Object.freeze((promise.issues ?? parseAcceptanceCriteriaResult(undefined).issues).map(issue => Object.freeze({ ...issue, example: ACCEPTANCE_EXAMPLES[issue.example.kind] }))), evidence: Object.freeze([]) });
      const review = this.reviews.get(promise.id);
      const evidence = promise.criteria.map((criterion, criterionIndex) => {
        const result = evaluateAcceptanceCriterion(criterion, {
          project: applied, baseline: promise.baseline, bindings: this.bindings,
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
      const unapplied = maps.some(target => {
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
        id: promise.id, title: promise.title, status, evidence: Object.freeze(evidence),
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
    const status = items.length > 0 && items.every(item => item.status === "verified") ? "verified"
      : items.some(item => item.status === "blocked") ? "blocked"
      : items.some(item => item.status === "verifying") ? "verifying" : "working";
    this.snapshot = Object.freeze({ id: this.id, goal: this.goal, status, items: Object.freeze(items) });
    return this.snapshot;
  }
}
