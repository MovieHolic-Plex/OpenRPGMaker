import type { GameMap, Project } from "@/project/types";
import {
  acceptanceRecord, parseAcceptanceCriteria, parseAcceptanceRegion,
  type AcceptancePromise, type AcceptanceRegion, type AcceptanceSnapshot, type AcceptanceItemSnapshot,
} from "./assistantAcceptance";
import {
  acceptanceFingerprint, criterionTargets, evaluateAcceptanceCriterion, resolveAcceptanceMap,
  validRegion, visualFingerprint,
} from "./assistantAcceptanceEvaluation";

export interface AcceptanceImageReceipt {
  readonly mapId: string;
  readonly region: AcceptanceRegion;
  readonly fingerprint: string;
}

/** Session-owned ledger. Plans never own or replace its promises/baselines. */
export class AssistantAcceptanceLedger {
  private readonly baseline: Project;
  private readonly promises = new Map<string, AcceptancePromise>();
  private readonly bindings = new Map<string, string>();
  private delivered: AcceptanceImageReceipt[] = [];
  private readonly reviews = new Map<string, {
    readonly receipts: readonly AcceptanceImageReceipt[];
    readonly note: string;
    readonly passed: boolean;
  }>();
  private snapshot: AcceptanceSnapshot;
  private stopped = false;

  constructor(readonly id: string, readonly goal: string, baseline: Project) {
    this.baseline = structuredClone(baseline);
    this.snapshot = Object.freeze({ id, goal, status: "pending", items: Object.freeze([]) });
  }

  adopt(promises: readonly AcceptancePromise[]): void {
    for (const promise of promises) {
      if (!this.promises.has(promise.id)) this.promises.set(promise.id, structuredClone(promise));
    }
  }

  repair(itemId: unknown, criteria: unknown): boolean {
    const promise = typeof itemId === "string" ? this.promises.get(itemId) : undefined;
    const parsed = parseAcceptanceCriteria(criteria);
    if (!promise || promise.criteria !== null || !parsed) return false;
    this.promises.set(promise.id, { ...promise, criteria: parsed });
    return true;
  }

  resume(): void { this.stopped = false; }
  stop(): void { this.stopped = true; }
  getSnapshot(): AcceptanceSnapshot { return this.snapshot; }

  private bind(project: Project): void {
    for (const promise of this.promises.values()) {
      for (const criterion of promise.criteria ?? []) {
        for (const target of criterionTargets(criterion)) {
          if (!("newMapName" in target) || this.bindings.has(target.newMapName)) continue;
          const matches = Object.values(project.maps).filter(map => !this.baseline.maps[map.id] && map.name === target.newMapName);
          if (matches.length === 1 && matches[0]) this.bindings.set(target.newMapName, matches[0].id);
        }
      }
    }
  }

  captureImage(project: Project, data: unknown): AcceptanceImageReceipt | null {
    if (!acceptanceRecord(data) || typeof data.mapId !== "string") return null;
    const map = project.maps[data.mapId], region = parseAcceptanceRegion(data);
    if (!map || !region || !validRegion(map, region)) return null;
    return { mapId: map.id, region, fingerprint: visualFingerprint(project, map) };
  }

  /** Called only after successful image render AND insertion in the next model input. */
  deliverImages(receipts: readonly AcceptanceImageReceipt[]): void {
    this.delivered.push(...receipts);
  }

  private currentReceipts(receipts: readonly AcceptanceImageReceipt[], project: Project): readonly AcceptanceImageReceipt[] {
    return receipts.filter(receipt => {
      const map = project.maps[receipt.mapId];
      return map && receipt.fingerprint === visualFingerprint(project, map);
    });
  }

  review(itemId: unknown, note: unknown, project: Project, verdict: unknown): boolean {
    if (typeof itemId !== "string" || typeof note !== "string" || !note.trim()
      || (verdict !== "pass" && verdict !== "fail")) return false;
    this.bind(project);
    const promise = this.promises.get(itemId);
    const criteria = promise?.criteria;
    if (!criteria?.some(criterion => criterion.kind === "imageReviewed")) return false;
    const receipts = this.currentReceipts(this.delivered, project);
    const covered = criteria.every(criterion => {
      if (criterion.kind !== "imageReviewed") return true;
      const map = resolveAcceptanceMap(project, criterion.target, this.bindings);
      return map && coveredByImages(receipts, map, criterion.region ?? { x: 0, y: 0, w: map.width, h: map.height });
    });
    if (covered) this.reviews.set(itemId, { receipts, note: note.trim(), passed: verdict === "pass" });
    return covered;
  }

  evaluate(applied: Project, draft = applied): AcceptanceSnapshot {
    this.bind(draft);
    this.delivered = [...this.currentReceipts(this.delivered, draft)];
    for (const [id, review] of this.reviews) {
      const receipts = this.currentReceipts(review.receipts, draft);
      if (receipts.length === 0) this.reviews.delete(id);
      else this.reviews.set(id, { ...review, receipts });
    }
    const items: AcceptanceItemSnapshot[] = [...this.promises.values()].map(promise => {
      if (!promise.criteria) return Object.freeze({ id: promise.id, title: promise.title, status: "blocked", reason: "Missing or malformed criteria: repair_acceptance required", evidence: Object.freeze([]) });
      const review = this.reviews.get(promise.id);
      const evidence = promise.criteria.map(criterion => {
        const result = evaluateAcceptanceCriterion(criterion, {
          project: applied, baseline: this.baseline, bindings: this.bindings,
          reviewed: (map, region) => review?.passed === true
            && coveredByImages(this.currentReceipts(review.receipts, applied), map, region),
        });
        return Object.freeze({
          ...result,
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
    const status = items.length > 0 && items.every(item => item.status === "verified") ? "verified"
      : items.some(item => item.status === "blocked") ? "blocked"
      : items.some(item => item.status === "verifying") ? "verifying" : "working";
    this.snapshot = Object.freeze({ id: this.id, goal: this.goal, status, items: Object.freeze(items) });
    return this.snapshot;
  }
}

function coveredByImages(receipts: readonly AcceptanceImageReceipt[], map: GameMap, region: AcceptanceRegion): boolean {
  if (!validRegion(map, region)) return false;
  const candidates = receipts.filter(receipt => receipt.mapId === map.id);
  // Exact union coverage, not summed rectangle areas (overlap must not count twice).
  for (let y = region.y; y < region.y + region.h; y += 1) {
    const spans = candidates.filter(({ region: r }) => y >= r.y && y < r.y + r.h)
      .map(({ region: r }) => [Math.max(region.x, r.x), Math.min(region.x + region.w, r.x + r.w)])
      .sort(([a], [b]) => a - b);
    let end = region.x;
    for (const [left, right] of spans) {
      if (left > end) break;
      end = Math.max(end, right);
    }
    if (end < region.x + region.w) return false;
  }
  return true;
}
