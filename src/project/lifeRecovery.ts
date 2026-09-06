import { changeItemsAtomically, type LifeRecoveryClaim, type LifeRecoveryJson, type LifeRecoveryState, type PlaySession } from "./session";
import { isPositiveItemQuantity, ITEM_QUANTITY_MAX } from "./itemQuantities";
import { isMakerContract } from "./makers";
import type { ItemAmount, Project } from "./types";

export const LIFE_RECOVERY_CLAIM_MAX = 4096;
export const LIFE_RECOVERY_ITEM_MAX = 64;
export const LIFE_RECOVERY_RAW_BYTES_MAX = 64 * 1024;
export const LIFE_RECOVERY_BYTES_MAX = 8 * 1024 * 1024;
const encoder = new TextEncoder();

type RecoveryFailure = "invalid-state" | "invalid-source" | "invalid-count" | "capacity" | "missing-source" | "missing-claim" | "unresolved" | "inventory-overflow";
export type LifeRecoveryResult = { readonly ok: true; readonly claimIds: readonly string[] } | { readonly ok: false; readonly reason: RecoveryFailure };
/** The source is a real session owner, never a detached caller-provided quantity. */
export type LifeRecoverySource = {
  readonly sourceKind: "shippingQueue" | "bundleContributions" | "makerInstances" | "farmBuildingPlacements" | "homeDecorationPlacements" | "farmAnimals" | "placeables";
  readonly sourceId: string;
  readonly reason: string;
  /** Maker cancellation cutoff expressed in the job's ORIGINAL time basis. */
  readonly absoluteMinute?: number;
  readonly unresolvedOnly?: boolean;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function positiveSafe(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }

/** Reject non-JSON/cyclic values instead of silently normalizing away original evidence. */
export function isLifeRecoveryJson(value: unknown): value is LifeRecoveryJson {
  const pending: { readonly value: unknown; readonly leave?: boolean }[] = [{ value }];
  const ancestors = new Set<object>();
  while (pending.length) {
    const frame = pending.pop();
    if (!frame) break;
    const entry = frame.value;
    if (entry === null || typeof entry === "boolean" || typeof entry === "string") continue;
    if (typeof entry === "number" && Number.isFinite(entry)) continue;
    if (typeof entry !== "object" || entry === null) return false;
    if (frame.leave) { ancestors.delete(entry); continue; }
    if (ancestors.has(entry)) return false;
    ancestors.add(entry);
    pending.push({ value: entry, leave: true });
    const array = Array.isArray(entry);
    const prototype = Object.getPrototypeOf(entry);
    if (!array && prototype !== Object.prototype && prototype !== null) return false;
    const keys = Reflect.ownKeys(entry);
    if (array && keys.length !== entry.length + 1) return false;
    for (const key of keys) {
      if (array && key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(entry, key);
      if (typeof key !== "string" || !descriptor?.enumerable || !("value" in descriptor)) return false;
      if (array && (!Number.isSafeInteger(Number(key)) || Number(key) < 0 || Number(key) >= entry.length || String(Number(key)) !== key)) return false;
      pending.push({ value: descriptor.value });
    }
  }
  return true;
}
function jsonBytes(value: unknown): number {
  try { return encoder.encode(JSON.stringify(value)).byteLength; }
  catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) return Infinity;
    throw error;
  }
}
export function isRecoveryItems(value: unknown): value is readonly ItemAmount[] {
  if (!Array.isArray(value) || value.length > LIFE_RECOVERY_ITEM_MAX) return false;
  const ids = new Set<string>();
  return value.every((entry) => {
    if (!record(entry) || !text(entry.itemId) || !isPositiveItemQuantity(entry.count) || ids.has(entry.itemId)) return false;
    ids.add(entry.itemId);
    return true;
  });
}

/** Boundary predicate: unknown item/source IDs are valid evidence, invalid quantities are not. */
export function isLifeRecoveryState(value: unknown): value is LifeRecoveryState {
  if (!record(value) || !positiveSafe(value.nextSequence) || !record(value.claims)) return false;
  const entries = Object.entries(value.claims);
  if (entries.length > LIFE_RECOVERY_CLAIM_MAX) return false;
  for (const [id, claim] of entries) {
    const sequence = Number(id.slice("recovery:".length));
    if (!positiveSafe(sequence) || id !== `recovery:${sequence}` || sequence >= value.nextSequence) return false;
    if (!record(claim) || claim.id !== id || !text(claim.sourceKind) || !text(claim.sourceId) || !text(claim.reason) || !isRecoveryItems(claim.items)) return false;
    if (claim.unresolved !== undefined) {
      if (!record(claim.unresolved) || !text(claim.unresolved.detail) || !isLifeRecoveryJson(claim.unresolved.record) || jsonBytes(claim.unresolved.record) > LIFE_RECOVERY_RAW_BYTES_MAX) return false;
    } else if (claim.items.length === 0) return false;
  }
  return isLifeRecoveryJson(value) && jsonBytes(value) <= LIFE_RECOVERY_BYTES_MAX;
}

/** Moves one real source to bounded claims on a draft. Repeating a consumed source cannot reissue it. */
export function moveLifeRecoverySource(project: Project, session: PlaySession, source: LifeRecoverySource): LifeRecoveryResult {
  const recovery = session.lifeRecovery ?? { nextSequence: 1, claims: {} };
  if (!isLifeRecoveryState(recovery)) return { ok: false, reason: "invalid-state" };
  if (!text(source.sourceId) || !text(source.reason)) return { ok: false, reason: "invalid-source" };
  const owners = session[source.sourceKind];
  if (!owners || !Object.hasOwn(owners, source.sourceId)) return { ok: false, reason: "missing-source" };
  const original = owners[source.sourceId];
  if (!isLifeRecoveryJson(original)) return { ok: false, reason: "invalid-source" };
  let items: readonly ItemAmount[] = [];
  if (!source.unresolvedOnly) switch (source.sourceKind) {
    case "shippingQueue":
      items = [{ itemId: source.sourceId, count: session.shippingQueue?.[source.sourceId] ?? 0 }];
      break;
    case "bundleContributions":
      // Completed bundles are tombstones, never refunds.
      if (session.completedBundleIds?.includes(source.sourceId) || session.bundleRewardAppliedIds?.includes(source.sourceId)) return { ok: false, reason: "invalid-source" };
      items = Object.entries(session.bundleContributions?.[source.sourceId] ?? {}).map(([itemId, count]) => ({ itemId, count }));
      break;
    case "makerInstances": {
      const job = session.makerInstances?.[source.sourceId];
      if (!job || job.instanceId !== source.sourceId || (job.status !== "processing" && job.status !== "ready")) return { ok: false, reason: "invalid-source" };
      if (job.contract !== undefined && (!isMakerContract(job.contract) || job.readyAtMinute !== (job.startedAtMinute ?? NaN) + job.contract.durationMinutes)) return { ok: false, reason: "invalid-source" };
      const contract = job.contract ?? project.system.makers?.find((maker) => maker.id === job.makerId);
      if (contract) {
        if (source.absoluteMinute === undefined || !Number.isSafeInteger(source.absoluteMinute) || source.absoluteMinute < 0 || job.readyAtMinute === undefined || !Number.isSafeInteger(job.readyAtMinute)) return { ok: false, reason: "invalid-source" };
        // Current legacy inputs do not prove what this job spent before a definition edit.
        items = job.status === "ready" || source.absoluteMinute >= job.readyAtMinute ? contract.outputs : job.contract?.inputs ?? [];
      }
      break;
    }
    // Spatial/animal recovery policy and receipt consumption are downstream. Preserve raw evidence, never guess a cost.
    case "farmBuildingPlacements": case "homeDecorationPlacements": case "farmAnimals": case "placeables": break;
    default: { const exhaustive: never = source.sourceKind; return exhaustive; }
  }
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!text(item.itemId) || !positiveSafe(item.count)) return { ok: false, reason: "invalid-count" };
    const total = (totals.get(item.itemId) ?? 0) + item.count;
    if (!positiveSafe(total)) return { ok: false, reason: "invalid-count" };
    totals.set(item.itemId, total);
  }
  const known = new Set(project.database.items.map((item) => item.id));
  const unresolved = items.length === 0 || items.some((item) => !known.has(item.itemId))
    ? { record: structuredClone(original), detail: source.reason } : undefined;
  if (unresolved && jsonBytes(original) > LIFE_RECOVERY_RAW_BYTES_MAX) return { ok: false, reason: "capacity" };
  const batches: ItemAmount[][] = [[]];
  for (const [itemId, total] of totals) {
    let remaining = total;
    while (remaining > 0) {
      let batch = batches[batches.length - 1];
      if (!batch) return { ok: false, reason: "invalid-state" };
      if (batch.length === LIFE_RECOVERY_ITEM_MAX || batch.some((entry) => entry.itemId === itemId)) {
        batch = [];
        batches.push(batch);
      }
      if (batches.length + Object.keys(recovery.claims).length > LIFE_RECOVERY_CLAIM_MAX) return { ok: false, reason: "capacity" };
      const count = Math.min(remaining, ITEM_QUANTITY_MAX);
      batch.push({ itemId, count });
      remaining -= count;
    }
  }
  const nextSequence = recovery.nextSequence + batches.length;
  if (!Number.isSafeInteger(nextSequence) || Object.keys(recovery.claims).length + batches.length > LIFE_RECOVERY_CLAIM_MAX) return { ok: false, reason: "capacity" };
  const claims: Record<string, LifeRecoveryClaim> = { ...recovery.claims };
  const claimIds = batches.map((batch, index) => {
    const id = `recovery:${recovery.nextSequence + index}`;
    claims[id] = { id, sourceKind: source.sourceKind, sourceId: source.sourceId, reason: source.reason, items: batch, ...(unresolved ? { unresolved: structuredClone(unresolved) } : {}) };
    return id;
  });
  const next = { nextSequence, claims };
  if (!isLifeRecoveryState(next)) return { ok: false, reason: "capacity" };
  const draft = structuredClone(session);
  const draftOwners = draft[source.sourceKind];
  if (!draftOwners) return { ok: false, reason: "missing-source" };
  delete draftOwners[source.sourceId];
  draft.lifeRecovery = next;
  Object.assign(session, draft);
  return { ok: true, claimIds };
}

/** Explicit receipt only. No renderer, timer or save operation pays claims. */
export function collectLifeRecoveryClaim(project: Project, session: PlaySession, claimId: string): LifeRecoveryResult {
  const recovery = session.lifeRecovery;
  if (!recovery) return { ok: false, reason: "missing-claim" };
  if (!isLifeRecoveryState(recovery)) return { ok: false, reason: "invalid-state" };
  const claim = Object.hasOwn(recovery.claims, claimId) ? recovery.claims[claimId] : undefined;
  if (!claim) return { ok: false, reason: "missing-claim" };
  const known = new Set(project.database.items.map((item) => item.id));
  if (claim.items.length === 0 || claim.items.some((item) => !known.has(item.itemId))) return { ok: false, reason: "unresolved" };
  const draft = structuredClone(session);
  if (!changeItemsAtomically(draft, claim.items.map((item) => ({ itemId: item.itemId, op: "+=", amount: item.count })))) return { ok: false, reason: "inventory-overflow" };
  const claims = { ...recovery.claims };
  delete claims[claimId];
  draft.lifeRecovery = { nextSequence: recovery.nextSequence, claims };
  Object.assign(session, draft);
  return { ok: true, claimIds: [claimId] };
}

export { LifeReconciliationError, parseLifeState, preserveUnresolvedLifeSource, reconcileLifeState } from "./lifeStateReconciliation";
