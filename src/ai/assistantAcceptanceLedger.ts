import type { Project } from "@/project/types";
import { isVerifiedActionCombatProof, type ActionCombatProofReceipt } from "@/testing/actionCombatProof";
import {
  parseAcceptanceCriteria,
  acceptanceRecord, type AcceptanceTarget,
  type AcceptancePromise, type AcceptanceSnapshot, type AcceptanceItemSnapshot, type AcceptanceSource, type RequirementWithdrawalAction, type RequirementSupersession,
} from "./assistantAcceptance";
import {
  acceptanceFingerprint, acceptanceReviewRegion, criterionTargets, evaluateAcceptanceCriterion, resolveAcceptanceMap, selectedCriterionState,
} from "./assistantAcceptanceEvaluation";

import { measureVolume, volumeGaps, type VolumeBar, type VolumeSnapshot } from "./volumeContract";
import { createRequestSource, extractRequestCoverage, parseRequestSourceSpan, type RequestSource, type RequestSourceUnit } from "./assistantRequestContract";
import { AssistantImageEvidence, coveredByImages, type AcceptanceImageReceipt } from "./assistantImageEvidence";
import type { ToolVerificationEvidence } from "./toolVerificationEvidence";
export type { AcceptanceImageReceipt } from "./assistantImageEvidence";

interface CanonicalPromise extends AcceptancePromise {
  readonly baseline: Project;
  readonly source?: AcceptanceSource;
  readonly sourceUnit?: RequestSourceUnit;
  readonly withdrawal?: RequirementWithdrawalAction & { readonly source: "user" };
  readonly supersession?: RequirementSupersession;
  readonly retired?: AcceptanceItemSnapshot;
  readonly volume?: { readonly baseline: VolumeSnapshot; readonly bar: VolumeBar };
}
function provenance(source: AcceptanceSource): AcceptanceSource {
  return Object.freeze({ requestId: source.requestId, text: source.text,
    scope: source.scope ? Object.freeze({ mapId: source.scope.mapId, region: Object.freeze({ ...source.scope.region }) }) : null });
}
const reservedId = (id: string): boolean => /:source:\d+$|:volume$/u.test(id);

/** Session-owned ledger. Plans never own or replace its promises/baselines. */
export class AssistantAcceptanceLedger {
  private readonly baseline: Project;
  private readonly promises = new Map<string, CanonicalPromise>();
  // Source inventory is provenance, not a second denominator. Criteria live in promises.
  private readonly requests = new Map<string, RequestSource & { readonly baseline: Project; readonly source: AcceptanceSource }>();

  /** Host captures exact raw text and scope before any await or write. */
  startRequest(requestId: string, rawInstruction: string, baseline: Project, authoring = true,
    scope: AcceptanceSource["scope"] = null): void {
    if (this.requests.has(requestId)) return;
    const source = provenance({ requestId, text: rawInstruction, scope });
    const request = { ...createRequestSource(requestId, rawInstruction), baseline: structuredClone(baseline), authoring, source };
    this.requests.set(requestId, request);
    if (!authoring) return;
    for (const unit of request.units) this.promises.set(unit.id, {
      id: unit.id, title: unit.source.quote, criteria: null, required: true,
      baseline: request.baseline, source, sourceUnit: unit,
    });
  }

  adoptRequestRequirements(requestId: string, payload: unknown): void {
    const request = this.requests.get(requestId);
    if (!request?.authoring) return;
    const units = request.units.map(unit => this.promises.get(unit.id)?.sourceUnit ?? unit);
    for (const unit of extractRequestCoverage({ ...request, units }, payload)) {
      const promise = this.promises.get(unit.id);
      if (!promise || promise.withdrawal || promise.supersession) continue;
      this.promises.set(unit.id, { ...promise, criteria: unit.criteria, sourceUnit: unit });
    }
  }

  /** Host-only accepted correction, never planner/tool/recovery authority. */
  adoptUserAmendments(requestId: string, payload: unknown): void {
    const request = this.requests.get(requestId);
    if (!request?.authoring || !acceptanceRecord(payload) || !Array.isArray(payload.amendments)) return;
    for (const amendment of payload.amendments) {
      if (!acceptanceRecord(amendment) || Object.keys(amendment).some(key => !["obligationId", "source"].includes(key))
        || typeof amendment.obligationId !== "string") continue;
      const anchor = parseRequestSourceSpan(request.rawInstruction, amendment.source);
      if (!anchor || !/\b(?:replace|instead|correct|change)\b|대신|수정|정정|바꿔/iu.test(anchor.quote)) continue;
      const replacements = request.units.map(unit => this.promises.get(unit.id)).filter(promise => promise?.sourceUnit
        && !promise.withdrawal && !promise.supersession
        && promise.sourceUnit.source.start >= anchor.start && promise.sourceUnit.source.end <= anchor.end);
      const replacement = replacements.length === 1 ? replacements[0] : undefined;
      const criterion = replacement?.criteria?.length === 1 ? replacement.criteria[0] : undefined;
      if (!replacement || criterion?.kind !== "valueEquals") continue;
      const matching = [...this.promises.values()].filter(promise => promise.sourceUnit && promise.source?.requestId !== requestId
        && !promise.withdrawal && !promise.supersession && promise.criteria?.length === 1 && promise.criteria[0]?.kind === "valueEquals"
        && acceptanceFingerprint([promise.criteria[0].subject, promise.criteria[0].path]) === acceptanceFingerprint([criterion.subject, criterion.path]));
      const original = matching.length === 1 ? matching[0] : undefined;
      const requestIds = [...this.requests.keys()];
      if (!original?.sourceUnit || original.id !== amendment.obligationId || !original.source
        || requestIds.indexOf(original.source.requestId) >= requestIds.indexOf(requestId)) continue;
      const retired = this.retirementSnapshot(original);
      const supersession = Object.freeze({ requestId, requirementId: replacement.id, source: Object.freeze(anchor) });
      this.promises.set(original.id, { ...original, supersession, retired,
        sourceUnit: { ...original.sourceUnit, supersededBy: requestId, archivedEvidence: retired?.evidence } });
    }
  }

  getRequests(): readonly RequestSource[] {
    return structuredClone([...this.requests.values()].map(request => ({
      requestId: request.requestId, rawInstruction: request.rawInstruction, authoring: request.authoring,
      units: request.units.map(unit => this.promises.get(unit.id)?.sourceUnit ?? unit),
    })));
  }

  requireVolume(requestId: string, bar: VolumeBar, baseline: Project): void {
    const id = `${requestId}:volume`, previous = this.promises.get(id);
    if (previous?.withdrawal || previous?.supersession) return;
    const request = this.requests.get(requestId);
    const original = previous?.baseline ?? request?.baseline ?? structuredClone(baseline);
    this.promises.set(id, {
      id, title: "Supplemental volume", criteria: null, required: true, baseline: original,
      source: request?.source ?? provenance({ requestId, text: this.goal, scope: null }),
      volume: { baseline: previous?.volume?.baseline ?? measureVolume(original), bar: {
        authoredMaps: Math.max(bar.authoredMaps, previous?.volume?.bar.authoredMaps ?? 0),
        multiPageNpcs: Math.max(bar.multiPageNpcs, previous?.volume?.bar.multiPageNpcs ?? 0),
        shops: Math.max(bar.shops, previous?.volume?.bar.shops ?? 0),
        quests: Math.max(bar.quests, previous?.volume?.bar.quests ?? 0),
      } },
    });
  }

  getVolumeGaps(applied: Project): string[] {
    const volumes = [...this.promises.values()].filter(promise => promise.volume && !promise.withdrawal && !promise.supersession);
    if (volumes.length === 0) return [];
    const measured = measureVolume(applied);
    return volumes.flatMap(promise => promise.volume ? volumeGaps(promise.volume.baseline, measured, promise.volume.bar) : []);
  }

  private retirementSnapshot(promise: CanonicalPromise): AcceptanceItemSnapshot | undefined {
    return this.snapshot.items.find(item => item.id === promise.id);
  }
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
    const additions = promises.filter(promise => !this.promises.has(promise.id) && !reservedId(promise.id));
    if (additions.length === 0) return;
    const baseline = structuredClone(requestBaseline);
    const capturedSource = provenance(source);
    for (const promise of additions) {
      if (!this.promises.has(promise.id)) this.promises.set(promise.id, {
        id: promise.id, title: promise.title, criteria: structuredClone(promise.criteria),
        required: promise.required !== false, baseline, source: capturedSource,
      });
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

  repair(itemId: unknown, criteria: unknown): boolean {
    const promise = typeof itemId === "string" ? this.promises.get(itemId) : undefined;
    const parsed = parseAcceptanceCriteria(criteria);
    if (!promise || promise.sourceUnit || promise.volume || promise.withdrawal || promise.supersession || promise.criteria !== null || !parsed) return false;
    this.promises.set(promise.id, { ...promise, criteria: parsed });
    return true;
  }

  /** Host-only scope action. Never dispatched from an assistant tool. */
  withdraw(action: RequirementWithdrawalAction): boolean {
    const promise = this.promises.get(action.requirementId);
    if (action.acceptanceId !== this.id || !promise || promise.withdrawal || promise.supersession || !action.reason.trim()) return false;
    const withdrawal = Object.freeze({ acceptanceId: this.id, requirementId: promise.id, reason: action.reason.trim(), source: "user" as const });
    this.promises.set(promise.id, { ...promise, withdrawal, retired: this.retirementSnapshot(promise),
      ...(promise.sourceUnit ? { sourceUnit: { ...promise.sourceUnit, withdrawal } } : {}),
    });
    return true;
  }

  resume(): void { this.stopped = false; }
  stop(): void { this.stopped = true; }
  getSnapshot(): AcceptanceSnapshot { return this.snapshot; }

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
    if (!promise || promise.withdrawal || promise.supersession || !criteria?.some(criterion => criterion.kind === "imageReviewed")) return false;
    const receipts = this.images.current(project);
    const covered = criteria.every(criterion => {
      if (criterion.kind !== "imageReviewed") return true;
      const map = resolveAcceptanceMap(project, criterion.target, this.bindings);
      return map && coveredByImages(receipts, map, acceptanceReviewRegion(map, promise.baseline.maps[map.id], criterion.region));
    });
    if (covered) this.reviews.set(itemId, { receipts, note: note.trim(), passed: verdict === "pass" });
    return covered;
  }

  evaluate(applied: Project, draft = applied, verification?: ToolVerificationEvidence,
    blockingProblems: readonly string[] = []): AcceptanceSnapshot {
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
    const promises: CanonicalPromise[] = [...this.promises.values(), ...this.actionRequirements.values()];
    const measuredVolume = promises.some(promise => promise.volume && !promise.retired) ? measureVolume(applied) : undefined;
    const draftVolume = measuredVolume && applied !== draft ? measureVolume(draft) : measuredVolume;
    const volumeDraftChanged = measuredVolume !== draftVolume
      && acceptanceFingerprint(measuredVolume) !== acceptanceFingerprint(draftVolume);
    const toolDraftChanged = applied !== draft
      && promises.some(promise => !promise.retired && promise.criteria?.some(criterion => criterion.kind === "toolVerdict"))
      && acceptanceFingerprint(applied) !== acceptanceFingerprint(draft);
    const items: AcceptanceItemSnapshot[] = promises.map(promise => {
      const metadata = { required: promise.required !== false, ...(promise.source ? { source: promise.source } : {}),
        ...(promise.withdrawal ? { withdrawal: promise.withdrawal } : {}),
        ...(promise.supersession ? { supersession: promise.supersession } : {}),
        ...(promise.sourceUnit ? { sourceSpan: Object.freeze({ ...promise.sourceUnit.source }), coverage: promise.sourceUnit.coverage } : {}) };
      if (promise.retired) return Object.freeze({ ...promise.retired, ...metadata });
      if (promise.volume && measuredVolume) {
        const gaps = volumeGaps(promise.volume.baseline, measuredVolume, promise.volume.bar);
        return Object.freeze({ ...metadata, id: promise.id, title: promise.title, status: volumeDraftChanged ? this.stopped ? "blocked" : "verifying" : gaps.length ? this.stopped ? "blocked" : "working" : "verified",
          evidence: Object.freeze([Object.freeze({ expected: JSON.stringify(promise.volume.bar), observed: JSON.stringify(measuredVolume), passed: gaps.length === 0 })]),
          ...(volumeDraftChanged ? { reason: "Draft is not yet applied" } : gaps.length ? { reason: gaps.join("; ") } : {}),
        });
      }
      if (!promise.criteria) return Object.freeze({ ...metadata, id: promise.id, title: promise.title, status: "blocked", reason: promise.sourceUnit ? promise.sourceUnit.unresolvedReason ?? "Request source coverage unresolved" : "Missing or malformed criteria: repair_acceptance required", evidence: Object.freeze([]) });
      const review = this.reviews.get(promise.id);
      const evidence = promise.criteria.map(criterion => {
        const result = evaluateAcceptanceCriterion(criterion, {
          project: applied, baseline: promise.baseline, bindings: this.bindings, verification,
          reviewed: (map, region) => review?.passed === true
            && coveredByImages(this.currentReceipts(review.receipts, applied), map, region),
          actionProven: map => isVerifiedActionCombatProof(this.actionProofs.get(map.id), applied, map.id),
        });
        return Object.freeze({
          ...result,
          observed: criterion.kind === "imageReviewed" && review
            ? `${result.observed}: ${review.note}` : result.observed,
        });
      });
      const maps = promise.criteria.flatMap(criterion => criterionTargets(criterion));
      const unapplied = (toolDraftChanged && promise.criteria.some(criterion => criterion.kind === "toolVerdict")) || (applied !== draft && promise.criteria.some(criterion => ("subject" in criterion || "collection" in criterion)
        && acceptanceFingerprint(selectedCriterionState(applied, criterion)) !== acceptanceFingerprint(selectedCriterionState(draft, criterion)))) || maps.some(target => {
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
    // A host can withdraw before the first evaluation. Preserve that first real
    // assessment rather than inventing empty or passing historical evidence.
    for (const item of items) {
      const promise = this.promises.get(item.id);
      if (promise && (promise.withdrawal || promise.supersession) && !promise.retired) {
        this.promises.set(item.id, { ...promise, retired: item,
          ...(promise.supersession && promise.sourceUnit ? { sourceUnit: { ...promise.sourceUnit, archivedEvidence: item.evidence } } : {}),
        });
      }
    }
    if (blockingProblems.length > 0) items.push(Object.freeze({
      id: "required-verification", title: "Required verification", status: "blocked",
      reason: blockingProblems.join("; "),
      evidence: Object.freeze(blockingProblems.map(observed => Object.freeze({
        expected: "Every required check passes against current content", observed, passed: false,
      }))),
    }));
    const required = items.filter(item => item.required !== false && !item.withdrawal && !item.supersession);
    const status = items.length > 0 && required.every(item => item.status === "verified") ? "verified"
      : required.some(item => item.status === "blocked") ? "blocked"
      : required.some(item => item.status === "verifying") ? "verifying" : "working";
    this.snapshot = Object.freeze({ id: this.id, goal: this.goal, status, items: Object.freeze(items) });
    return this.snapshot;
  }
}
