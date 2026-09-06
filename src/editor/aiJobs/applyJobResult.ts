import type { AiJobInput, AiJobResult, JsonObject, BlobRef } from "@/ai/jobs/contracts";
import { APPLIED_HASH_SCHEME, appliedSnapshotHash, canonicalJson, canonicalProject, equalJson, ResultConflict } from "@/ai/jobs/resultPatch";
import { parseProject } from "@/ai/jobs/checkpointState";
import { store } from "@/project/store";
import { sameProjectIdentity } from "@/project/loadedProjectIdentity";
import { loadProjectFromSupabase } from "@/project/supabaseProjectSync";
import type { Project } from "@/project/types";
import { randomUuid } from "@/util/id";
import { sha256HexText } from "@/util/sha256";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { commitChangeset } from "@/editor/tools/changeset";
import { assertHouseProtection, captureHouseProtection } from "@/editor/tools/houseProtection";
import { ApplicationClient } from "./applicationClient";
import { openApplicationRecords, type ApplicationRecord, type ApplicationRecords } from "./applicationRecords";
import { materializeJobResult, type JobReview } from "./materializeJobResult";

export type JobApplicationOutcome = {
  readonly application: "awaiting-editor" | "awaiting-review" | "conflict" | "applied" | "outcome-unknown";
  readonly save: "unsaved" | "saved" | "failed" | "unknown";
  readonly reason?: string;
  readonly receiptId?: string;
  readonly evidencePending?: boolean;
};
export interface ApplyJobOptions {
  readonly review?: JobReview;
  /** Wire boundary injection for embedders and deterministic HTTP tests; application/store stay real. */
  readonly client?: ApplicationClient;
  readonly storage?: IDBFactory;
}
const volatileRecovery = new Map<string, ApplicationRecord>();
export function getVolatileApplicationRecovery(jobId: string): ApplicationRecord | undefined { return structuredClone(volatileRecovery.get(jobId)); }
const json = (value: unknown): JsonObject => JSON.parse(JSON.stringify(value)) as JsonObject;
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
const recordKey = (jobId: string): string => `job:${jobId}`;
export const applicationLockName = (identity: { backend: string; projectId: string }): string => `ai-job-apply:${canonicalJson(identity)}`;

/** No editor mutation on recovery: only replay immutable evidence, or mark a prepared gap unknown. */
async function publishReceipt(record: ApplicationRecord, records: ApplicationRecords, client: ApplicationClient): Promise<ApplicationRecord> {
  let next = record;
  if (!next.evidence) {
    let evidence: JsonObject;
    if (next.phase === "applied" && next.serialized !== undefined) {
      const hash = await sha256HexText(next.serialized);
      const bytes = new TextEncoder().encode(next.serialized);
      const artifact: BlobRef = { sha256: hash, byteLength: bytes.length, mediaType: "application/json" };
      evidence = json({ appliedSnapshotSha256: hash, appliedArtifact: artifact,
        beforeSnapshotSha256: next.beforeSnapshotSha256,
        noChanges: next.noChanges === true,
        hashScheme: next.draftOnly ? "command-draft-canonical-json-v1" : APPLIED_HASH_SCHEME,
        scope: next.draftOnly ? "draft" : "project" });
    } else evidence = { reason: next.phase === "conflict" ? "guard-rejected-before-mutation" : "prepared-without-durable-applied-receipt" };
    next = { ...next, evidence: json({ claimId: next.claimId, receiptId: next.receiptId, project: next.project, resultSha256: next.resultSha256,
      application: next.phase === "prepared" ? "outcome-unknown" : next.phase, save: "unsaved", evidence, saveEvidence: null }) };
    await records.put(next);
  }
  // Identical prepare recovers an acknowledgement lost before mutation. It never allocates another claim.
  await client.post(next.jobId, "prepare", next.prepare);
  if (next.phase === "applied" && next.serialized !== undefined) {
    const body = next.evidence!.evidence as JsonObject;
    await client.post(next.jobId, "artifact", json({ claimId: next.claimId, receiptId: next.receiptId, project: next.project,
      resultSha256: next.resultSha256, snapshotSha256: body.appliedSnapshotSha256, serialized: next.serialized }));
  }
  await client.post(next.jobId, "evidence", next.evidence!);
  return next;
}
function outcome(record: ApplicationRecord, pending = false, reason?: string): JobApplicationOutcome {
  const detail = reason ?? (record.noChanges ? "no-changes" : undefined);
  return { application: record.phase === "prepared" ? "outcome-unknown" : record.phase, save: "unsaved", receiptId: record.receiptId, ...(pending ? { evidencePending: true } : {}), ...(detail ? { reason: detail } : {}) };
}

export async function applyJobResult(jobId: string, options: ApplyJobOptions = {}): Promise<JobApplicationOutcome> {
  const client = options.client ?? new ApplicationClient();
  const identity = store.getLoadedProjectIdentity(), epoch = store.getProjectEpoch();
  if (!store.isLoaded()) return { application: "awaiting-editor", save: "unsaved", reason: "project-not-loaded" };
  if (store.hasReadOnlyProjectSnapshot()) return { application: "awaiting-editor", save: "unsaved", reason: "read-only-play-snapshot" };
  if (!globalThis.navigator?.locks) return { application: "awaiting-editor", save: "unsaved", reason: "web-locks-unavailable" };
  return navigator.locks.request(applicationLockName(identity), async () => {
    let records: ApplicationRecords | undefined, record: ApplicationRecord | undefined;
    let mutated = false, freshPreparation = false;
    const guard = (before?: Project): void => {
      if (store.hasReadOnlyProjectSnapshot()) throw new ResultConflict(["read-only-play-snapshot"]);
      if (store.getProjectEpoch() !== epoch || !sameProjectIdentity(identity, store.getLoadedProjectIdentity())) throw new ResultConflict(["project-replaced"]);
      if (before && !equalJson(store.getCurrent(), before)) throw new ResultConflict(["live-project-changed-during-preparation"]);
    };
    try {
      records = await openApplicationRecords(options.storage);
      record = await records.get(recordKey(jobId));
      if (record) {
        if (!sameProjectIdentity(record.project, identity)) return { application: "awaiting-editor", save: "unsaved", reason: "different-loaded-project" };
        const recovery = volatileRecovery.get(jobId) ?? record;
        // A memory-only applied image is retained for inspection, never promoted into durable proof automatically.
        if (recovery !== record) return { application: "outcome-unknown", save: "unknown", receiptId: record.receiptId, reason: "applied-receipt-write-failed" };
        const recovered = await publishReceipt(record, records, client);
        return outcome(recovered);
      }
      guard();
      const { job } = await client.detail(jobId);
      if (!sameProjectIdentity(job.project, identity)) return { application: "awaiting-editor", save: "unsaved", reason: "different-loaded-project" };
      if (!job.resultRef || job.generation !== "succeeded") return { application: "awaiting-editor", save: "unsaved", reason: "result-not-ready" };
      if (job.applicationEvidence) return { application: "outcome-unknown", save: "unknown", reason: "server-claim-without-local-recovery-record" };
      const [input, result] = await Promise.all([client.json<AiJobInput>(jobId, job.inputRef), client.json<AiJobResult>(jobId, job.resultRef)]);
      if (result.jobId !== jobId || result.family !== input.family || !sameProjectIdentity(result.project, identity) || !sameProjectIdentity(input.project, identity) || !equalJson(result.baseSnapshot, input.projectSnapshot)) throw new ResultConflict(["result-binding"]);
      const automatic = input.mode === "auto" && ["assistant", "database", "image"].includes(result.family) && result.generatedSnapshot !== null;
      if (!options.review?.approved && !automatic) return { application: "awaiting-review", save: "unsaved" };
      await store.assertEffectiveConnection(identity);
      guard();
      const before = structuredClone(store.getCurrent());
      const base = parseProject(await client.json(jobId, result.baseSnapshot));
      const materialized = await materializeJobResult(input, result, base, before, client, options.review);
      guard(before); materialized.draft?.check();
      assertHouseProtection(captureHouseProtection(before), materialized.project, []);
      const validation = commitChangeset(materialized.project, before);
      if (!validation.ok) throw new ResultConflict(validation.blocking.map(v => `${v.mapId ?? "project"}:${v.message}`));
      const noChanges = equalJson(canonicalProject(before), canonicalProject(materialized.project))
        && (!materialized.draft || equalJson(materialized.draft.before, materialized.draft.after));
      record = {
        key: recordKey(jobId), jobId, project: identity, resultSha256: job.resultRef.sha256,
        claimId: randomUuid(), receiptId: randomUuid(), prepare: {}, before, beforeSnapshotSha256: await appliedSnapshotHash(before), proposed: materialized.project,
        draftOnly: materialized.draftOnly, noChanges, ...(materialized.draft ? { draftBefore: materialized.draft.before, draftAfter: materialized.draft.after } : {}), phase: "prepared",
      };
      record = { ...record, prepare: json({ claimId: record.claimId, receiptId: record.receiptId, project: identity, resultSha256: record.resultSha256, baselineSha256: result.baseSnapshot.sha256 }) };
      freshPreparation = true;
      await records.put(record);
      try { await client.post(jobId, "prepare", record.prepare); }
      catch (error) {
        // The only safe acknowledgement recovery is an observed identical claim, never equality of project state.
        const observed = await client.detail(jobId);
        if (!equalJson(observed.job.applicationEvidence?.claim, record.prepare)) throw error;
      }
      await store.assertEffectiveConnection(identity);
      guard(before); materialized.draft?.check();
      let captured: Project | undefined;
      const capture = (snapshot: Project): void => { captured = structuredClone(snapshot); mutated = true; };
      let commit: Promise<unknown> | undefined;
      if (noChanges) {
        captured = structuredClone(before);
      } else if (materialized.draft && equalJson(before, materialized.project)) {
        materialized.draft.owner.replaceAll(materialized.draft.after);
        capture(store.getCurrent());
      } else {
        commit = applyProposedProject(materialized.project, {
          source: "agent", summary: `AI job ${jobId}`, toolNames: [],
          onApplied: snapshot => {
            capture(snapshot);
            // Resource creation and reviewed draft linking share the synchronous application boundary.
            materialized.draft?.owner.replaceAll(materialized.draft.after);
          },
        });
        // applyProposedProject mutates synchronously before its first commit-log await.
        if (!captured) { await commit; throw new ResultConflict(["commit-rejected"]); }
      }
      const serialized = canonicalJson(materialized.draft ? { project: identity, owner: materialized.draft.owner.owner, draftId: materialized.draft.owner.draftId, commands: materialized.draft.after,
        resources: captured!.assets.uploaded } : canonicalProject(captured!));
      record = { ...record, phase: "applied", applied: captured, serialized };
      volatileRecovery.set(jobId, record);
      await records.put(record);
      volatileRecovery.delete(jobId);
      // Commit logging is independent of application and save evidence.
      if (commit) await commit;
      record = await publishReceipt(record, records, client);
      return outcome(record);
    } catch (error) {
      if (record) {
        if (volatileRecovery.has(jobId)) return { application: "outcome-unknown", save: "unknown", receiptId: record.receiptId, reason: message(error), evidencePending: true };
        if (!mutated && freshPreparation && record.phase === "prepared") {
          record = { ...record, phase: "conflict" };
          await records!.put(record);
          try { record = await publishReceipt(record, records!, client); }
          catch (evidenceError) { return outcome(record, true, `${message(error)}; ${message(evidenceError)}`); }
          return outcome(record, false, message(error));
        }
        return outcome(record, true, message(error));
      }
      return { application: error instanceof ResultConflict ? "conflict" : "awaiting-editor", save: "unsaved", reason: message(error) };
    } finally { records?.close(); }
  });
}

/** Save-only retry never reapplies a result or replaces the live project with a reload. */
export async function retryJobSave(jobId: string, options: Pick<ApplyJobOptions, "client" | "storage"> = {}): Promise<JobApplicationOutcome> {
  const identity = store.getLoadedProjectIdentity(), epoch = store.getProjectEpoch();
  if (!globalThis.navigator?.locks) return { application: "awaiting-editor", save: "unsaved", reason: "web-locks-unavailable" };
  const client = options.client ?? new ApplicationClient();
  return navigator.locks.request(applicationLockName(identity), async () => {
    const records = await openApplicationRecords(options.storage);
    try {
      let record = await records.get(recordKey(jobId));
      if (!record || record.phase !== "applied" || !sameProjectIdentity(identity, record.project)) return { application: "outcome-unknown", save: "unknown", reason: "durable-applied-receipt-required" };
      if (record.draftOnly) return { ...outcome(record), reason: "draft-only-not-remotely-saved" };
      record = await publishReceipt(record, records, client);
      if (record.saveRequest && (!record.saveAcknowledged || record.saveRequest.save === "saved")) {
        await client.post(jobId, "save-evidence", record.saveRequest);
        await records.put({ ...record, saveAcknowledged: true });
        return { ...outcome(record), save: record.saveRequest.save as "saved" | "failed" | "unknown" };
      }
      const interruptedAttempt = record.saveAttemptId && !record.saveAcknowledged;
      record = { ...record, saveAttemptId: interruptedAttempt ? record.saveAttemptId : randomUuid(), saveRequest: undefined, saveAcknowledged: false };
      await records.put(record);
      let save: "saved" | "failed" | "unknown" = "unknown", saveEvidence: JsonObject;
      try {
        if (interruptedAttempt) throw new Error("save-attempt-interrupted-without-evidence");
        if (store.hasReadOnlyProjectSnapshot() || store.getProjectEpoch() !== epoch) throw new Error("editor-unavailable-or-replaced");
        await store.assertEffectiveConnection(identity);
        if (store.getProjectEpoch() !== epoch || !sameProjectIdentity(identity, store.getLoadedProjectIdentity())) throw new Error("project-changed-before-save");
        const config = store.getLoadedConnection();
        if (!config) throw new Error("local-project-not-remotely-saved");
        const flushed = await store.flush();
        if (flushed.kind !== "saved") { save = "failed"; throw new Error(`flush-${flushed.kind}`); }
        const reloaded = await loadProjectFromSupabase(config);
        await store.assertEffectiveConnection(identity);
        if (store.getProjectEpoch() !== epoch || !reloaded) throw new Error("reload-or-project-changed");
        const hash = await appliedSnapshotHash(reloaded);
        const expected = (record.evidence!.evidence as JsonObject).appliedSnapshotSha256;
        if (hash !== expected) throw new Error("reload-does-not-confirm-applied-snapshot");
        save = "saved";
        saveEvidence = { method: "reload", hashScheme: APPLIED_HASH_SCHEME, confirmedSnapshotSha256: hash };
      } catch (error) { saveEvidence = { method: "reload", reason: message(error) }; }
      const request = json({ claimId: record.claimId, receiptId: record.receiptId, project: identity, resultSha256: record.resultSha256,
        saveAttemptId: record.saveAttemptId, save, saveEvidence });
      record = { ...record, saveRequest: request };
      await records.put(record);
      await client.post(jobId, "save-evidence", request);
      await records.put({ ...record, saveAcknowledged: true });
      return { ...outcome(record), save };
    } finally { records.close(); }
  });
}
