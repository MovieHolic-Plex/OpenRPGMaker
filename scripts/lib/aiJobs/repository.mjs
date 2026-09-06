import { randomUUID } from 'node:crypto';
import { openStorage } from './storage.mjs';
import { AiJobsRepositoryError, canonicalJson, isOutcome, jobStates, requireValue, sha256, validateCheckpoint, validateHistory, validateInput, validateResult, validateSnapshot } from './validation.mjs';
export { AiJobsRepositoryError } from './validation.mjs';

/** @param {import('./repository.mjs').AiJobsRepositoryOptions} options */
export async function openAiJobsRepository(options) {
  const storage = await openStorage(options);
  const now = options.now ?? Date.now;
  let state;
  let closed = false;
  let poisoned = false;
  let tail = Promise.resolve();
  let closing;
  function available() {
    if (closed) throw new AiJobsRepositoryError('REPOSITORY_CLOSED', 'Repository is closed');
    if (poisoned) throw new AiJobsRepositoryError('DURABILITY_UNKNOWN', 'Close and reopen repository to reconcile uncertain persistence');
  }
  function serialize(work) {
    try { available(); } catch (error) { return Promise.reject(error); }
    const result = tail.then(async () => {
      if (poisoned) throw new AiJobsRepositoryError('DURABILITY_UNKNOWN', 'Writer requires restart');
      try { return await work(); }
      catch (error) { if (error.code === 'DURABILITY_UNKNOWN') poisoned = true; throw error; }
    });
    // Each caller receives its rejection; the queue tail only orders subsequent work.
    tail = result.then(() => undefined, () => undefined);
    return result;
  }
  async function validateBlobs(snapshot) {
    const checked = new Set();
    async function check(ref) {
      const key = canonicalJson(ref);
      if (!checked.has(key)) { await storage.read(ref); checked.add(key); }
    }
    for (const job of snapshot.jobs) {
      const input = await storage.readJson(job.inputRef);
      validateInput(input);
      requireValue(input.family === job.family && canonicalJson(input.project) === canonicalJson(job.project), 'Input/job identity mismatch');
      requireValue(input.dependsOn.every(id => snapshot.jobs.some(j => j.id === id && j.createdAt <= job.createdAt && j.id !== job.id)), 'Unknown job dependency');
      for (const ref of [input.projectSnapshot, ...input.artwork]) await check(ref);
      if (job.resultRef) {
        const result = await storage.readJson(job.resultRef);
        validateResult(result);
        requireValue(result.jobId === job.id && result.family === job.family && canonicalJson(result.project) === canonicalJson(job.project) && canonicalJson(result.baseSnapshot) === canonicalJson(input.projectSnapshot), 'Result/job identity mismatch');
        requireValue(snapshot.attempts.some(a => a.id === result.attemptId && a.jobId === job.id && a.stage === 'generation'), 'Result attempt mismatch');
        for (const ref of [result.baseSnapshot, ...result.artifacts, ...(result.generatedSnapshot ? [result.generatedSnapshot] : [])]) await check(ref);
      }
      if (job.reportRef) {
        await check(job.reportRef);
        const report = await storage.readJson(job.reportRef);
        // Legacy report documents remain readable. All explicitly listed immutable
        // preview/revision bytes must survive restart, not just the head JSON.
        for (const ref of report.artifacts ?? []) await check(ref);
      }
      if (job.applicationEvidence?.artifact?.ref) await check(job.applicationEvidence.artifact.ref);
      if (job.checkpointRef) {
        const checkpoint = await storage.readJson(job.checkpointRef);
        validateCheckpoint(checkpoint);
        requireValue(checkpoint.jobId === job.id && checkpoint.inputSha256 === job.inputRef.sha256 && snapshot.attempts.some(a => a.id === checkpoint.attemptId && a.jobId === job.id && a.stage === 'generation'), 'Checkpoint/job identity mismatch');
        for (const ref of checkpoint.artifacts) await check(ref);
      }
    }
    for (const operation of snapshot.operations) {
      await check(operation.requestRef);
      if (operation.responseRef) await check(operation.responseRef);
    }
  }
  function appendEvent(next, job, kind, timestamp) {
    const event = { seq: next.events.length + 1, jobId: job.id, kind, createdAt: timestamp, states: jobStates(job) };
    next.events.push(event);
    if (kind === 'outcome') next.inbox.push({ eventSeq: event.seq, jobId: job.id, createdAt: timestamp, readAt: null });
  }
  async function commit(next) {
    validateSnapshot(next); validateHistory(state, next); await validateBlobs(next);
    await storage.save(next);
    state = next;
    return structuredClone(state);
  }
  async function update(change) {
    const next = structuredClone(state);
    const draft = { jobs: next.jobs, attempts: next.attempts, operations: next.operations };
    const returned = change(draft);
    requireValue(returned === undefined, 'Transaction callback must be synchronous and return void');
    next.jobs = draft.jobs; next.attempts = draft.attempts; next.operations = draft.operations;
    requireValue(next.jobs.length === state.jobs.length && next.jobs.every(j => state.jobs.some(old => old.id === j.id)), 'Use admit to create jobs');
    if (canonicalJson(next) === canonicalJson(state)) return structuredClone(state);
    const timestamp = now();
    for (const job of next.jobs) {
      const before = state.jobs.find(j => j.id === job.id);
      const related = (s) => [s.attempts.filter(a => a.jobId === job.id), s.operations.filter(o => o.jobId === job.id)];
      if (canonicalJson(job) !== canonicalJson(before) || canonicalJson(related(next)) !== canonicalJson(related(state))) {
        job.updatedAt = timestamp;
        appendEvent(next, job, isOutcome(before, job) ? 'outcome' : 'updated', timestamp);
      }
    }
    next.revision += 1;
    // Sever references retained by the callback before any filesystem await.
    return commit(structuredClone(next));
  }
  try {
    const loaded = await storage.load();
    state = loaded ?? { version: 1, revision: 0, jobs: [], attempts: [], operations: [], events: [], inbox: [] };
    try { validateSnapshot(state); await validateBlobs(state); }
    catch (cause) { throw new AiJobsRepositoryError('CORRUPT_STORAGE', 'Invalid durable job records or referenced blobs', { cause }); }
    if (!loaded) await storage.save(state);
    await update(draft => {
      for (const attempt of draft.attempts) if (attempt.status === 'running') {
        attempt.status = 'interrupted'; attempt.finishedAt = now(); attempt.error = 'Local writer restarted';
        const job = draft.jobs.find(j => j.id === attempt.jobId);
        job[attempt.stage] = 'interrupted'; job.activeAttemptId = null;
      }
      for (const operation of draft.operations) if (operation.status === 'dispatched') operation.status = 'outcome-unknown';
      for (const job of draft.jobs) {
        if (job.application === 'applying') job.application = 'outcome-unknown';
        if (job.save === 'saving') job.save = 'unknown';
      }
    });
  } catch (error) {
    try { await storage.close(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Repository initialization and cleanup failed'); }
    throw error;
  }
  return {
    snapshot() { available(); return structuredClone(state); },
    putBlob(bytes, mediaType) {
      requireValue(bytes instanceof Uint8Array, 'Blob bytes must be Uint8Array');
      const copy = Buffer.from(bytes);
      return serialize(() => storage.put(copy, mediaType));
    },
    putJson(value) {
      const bytes = Buffer.from(canonicalJson(value));
      return serialize(() => storage.put(bytes, 'application/json'));
    },
    readBlob(ref) { const copy = structuredClone(ref); return serialize(() => storage.read(copy)); },
    readJson(ref) { const copy = structuredClone(ref); return serialize(() => storage.readJson(copy)); },
    async admit(request) {
        requireValue(typeof request.idempotencyKey === 'string' && request.idempotencyKey.trim().length > 0, 'Idempotency key required');
        validateInput(request.input);
        const key = request.idempotencyKey;
        const input = JSON.parse(canonicalJson(request.input));
        return serialize(async () => {
          const bytes = Buffer.from(canonicalJson(input));
          const existing = state.jobs.find(j => j.idempotencyKey === key);
          if (existing) {
            if (existing.inputRef.sha256 !== sha256(bytes)) throw new AiJobsRepositoryError('IDEMPOTENCY_CONFLICT', 'Idempotency key already belongs to different input');
            return { created: false, job: structuredClone(existing) };
          }
          const inputRef = await storage.put(bytes, 'application/json');
          const timestamp = now();
          const job = { id: randomUUID(), idempotencyKey: key, family: input.family, project: input.project, inputRef, createdAt: timestamp, updatedAt: timestamp,
            generation: 'queued', report: 'pending', application: 'not-requested', save: 'not-requested', activeAttemptId: null,
            resultRef: null, reportRef: null, checkpointRef: null, applicationEvidence: null, saveEvidence: null };
          const next = structuredClone(state);
          next.jobs.push(job); next.revision += 1;
          appendEvent(next, job, 'admitted', timestamp);
          await commit(next);
          return { created: true, job: structuredClone(job) };
        });
    },
    transaction(change) { return serialize(() => update(change)); },
    markInboxRead(eventSeq) {
      return serialize(async () => {
        const next = structuredClone(state);
        const item = next.inbox.find(i => i.eventSeq === eventSeq);
        requireValue(item, 'Unknown inbox event');
        if (item.readAt !== null) return structuredClone(state);
        item.readAt = now(); next.revision += 1;
        appendEvent(next, next.jobs.find(j => j.id === item.jobId), 'inbox-read', item.readAt);
        return commit(next);
      });
    },
    close() {
      if (!closing) { closed = true; closing = tail.then(() => storage.close()); }
      return closing;
    },
  };
}
