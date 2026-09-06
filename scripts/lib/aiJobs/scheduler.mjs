import { randomUUID } from 'node:crypto';
import { canonicalJson, requireValue, validateCheckpoint, validateResult } from './validation.mjs';
import { AiJobsServiceError, conflict, createProviderOperations, DUPLICATE_SPEND_ACKNOWLEDGED, rejectSecrets } from './providerOperations.mjs';

/** The scheduler is the service's only metadata writer. Subscribers observe durable events. */
export function createAiJobsScheduler({ repository, executeJob, renderReport, dispatchProvider, onError = console.error }) {
  const listeners = new Set();
  let published = repository.snapshot().events.length;
  let stopped = false;
  let fatal = null;
  let pump = null;
  let wakePending = false;
  let active = null;
  let closing;
  function publish() {
    const events = repository.snapshot().events.slice(published);
    published += events.length;
    for (const event of events) for (const listener of listeners) {
      try { listener(event); } catch (error) { onError(error); }
    }
  }
  async function change(callback) { const state = await repository.transaction(callback); publish(); return state; }
  const providers = createProviderOperations({ repository, change, dispatchProvider });
  function available(stage = 'generation') {
    if (fatal || stopped || !(stage === 'generation' ? executeJob : renderReport)) {
      throw new AiJobsServiceError('EXECUTOR_UNAVAILABLE', 503, fatal ? 'Local job service requires restart; durable records are retained' : `${stage} executor unavailable; install and wire the local runtime`);
    }
  }
  function getJob(id) {
    const job = repository.snapshot().jobs.find(j => j.id === id);
    if (!job) throw new AiJobsServiceError('NOT_FOUND', 404, 'Job not found');
    return job;
  }
  function owns(draft, id, attemptId) { return draft.jobs.find(j => j.id === id)?.activeAttemptId === attemptId; }
  function finish(draft, id, attemptId, status, error = null) {
    const job = draft.jobs.find(j => j.id === id);
    const attempt = draft.attempts.find(a => a.id === attemptId);
    attempt.status = status; attempt.finishedAt = Date.now(); attempt.error = error;
    job.activeAttemptId = null;
    job[attempt.stage] = status === 'cancelled' && attempt.stage === 'report' ? 'interrupted' : status;
  }
  async function run(job, input, stage) {
    const attemptId = randomUUID();
    const controller = new AbortController();
    active = { jobId: job.id, attemptId, controller };
    let started = false;
    await change(draft => {
      const current = draft.jobs.find(j => j.id === job.id);
      if (stopped || (stage === 'generation' ? current.generation !== 'queued' : current.report !== 'pending')) return;
      current[stage] = 'running'; current.activeAttemptId = attemptId;
      draft.attempts.push({ id: attemptId, jobId: job.id, stage, status: 'running', startedAt: Date.now(), finishedAt: null, error: null });
      started = true;
    });
    if (!started) { active = null; return; }
    const allowed = new Map([input.projectSnapshot, ...input.artwork].map(ref => [ref.sha256, ref]));
    const fence = () => {
      controller.signal.throwIfAborted();
      if (getJob(job.id).activeAttemptId !== attemptId) conflict('STALE_ATTEMPT', 'Attempt no longer owns this job');
    };
    const host = {
      jobId: job.id, attemptId,
      async readBlob(ref) { fence(); requireValue(canonicalJson(allowed.get(ref.sha256) ?? null) === canonicalJson(ref), 'Blob is not in the attempt manifest'); return repository.readBlob(ref); },
      async readJson(ref) { return JSON.parse(Buffer.from(await host.readBlob(ref)).toString('utf8')); },
      async putBlob(bytes, mediaType) { fence(); const ref = await repository.putBlob(bytes, mediaType); fence(); allowed.set(ref.sha256, ref); return ref; },
      async putJson(value) { fence(); const ref = await repository.putJson(value); fence(); allowed.set(ref.sha256, ref); return ref; },
      dependencies: [],
    };
    try {
      for (const id of input.dependsOn) {
        const predecessor = getJob(id);
        const result = await repository.readJson(predecessor.resultRef);
        host.dependencies.push(result);
        for (const ref of [result.baseSnapshot, result.generatedSnapshot, ...result.artifacts].filter(Boolean)) allowed.set(ref.sha256, ref);
      }
      if (stage === 'generation') {
        host.loadCheckpoint = async () => {
          fence();
          const ref = getJob(job.id).checkpointRef;
          if (!ref) return null;
          const checkpoint = await repository.readJson(ref);
          fence();
          for (const artifact of checkpoint.artifacts) allowed.set(artifact.sha256, artifact);
          return checkpoint;
        };
        host.saveCheckpoint = async ({ stageKey, state, artifacts }) => {
          fence();
          const checkpoint = { version: 1, jobId: job.id, attemptId, inputSha256: job.inputRef.sha256, stageKey, state, artifacts };
          validateCheckpoint(checkpoint); rejectSecrets(checkpoint);
          for (const ref of artifacts) requireValue(canonicalJson(allowed.get(ref.sha256) ?? null) === canonicalJson(ref), 'Checkpoint artifact is outside the attempt manifest');
          const ref = await repository.putJson(checkpoint);
          await change(draft => { fence(); draft.jobs.find(j => j.id === job.id).checkpointRef = ref; });
          return ref;
        };
        host.providerOperation = ({ key, request }) => { fence(); return providers.run({ jobId: job.id, attemptId, key, request, signal: controller.signal }); };
        const result = await executeJob(input, host, controller.signal);
        fence(); validateResult(result);
        requireValue(result.attemptId === attemptId && result.jobId === job.id, 'Executor returned a foreign attempt result');
        const resultRef = await repository.putJson(result);
        await providers.drain();
        await change(draft => {
          if (!owns(draft, job.id, attemptId)) return;
          finish(draft, job.id, attemptId, 'succeeded');
          const current = draft.jobs.find(j => j.id === job.id);
          current.resultRef = resultRef; current.application = input.mode === 'auto' ? 'awaiting-editor' : 'awaiting-review'; current.save = 'unsaved';
        });
      } else {
        const result = await repository.readJson(getJob(job.id).resultRef);
        for (const ref of [result.baseSnapshot, result.generatedSnapshot, ...result.artifacts].filter(Boolean)) allowed.set(ref.sha256, ref);
        const report = await renderReport(result, host, controller.signal);
        fence(); requireValue(['ready', 'partial'].includes(report.state), 'Renderer must return ready or partial');
        const reportRef = await repository.putJson(report.document);
        await change(draft => {
          if (!owns(draft, job.id, attemptId)) return;
          finish(draft, job.id, attemptId, 'succeeded');
          const current = draft.jobs.find(j => j.id === job.id);
          current.report = report.state; current.reportRef = reportRef;
        });
      }
    } catch (error) {
      if (['PERSISTENCE_FAILED', 'DURABILITY_UNKNOWN', 'CORRUPT_STORAGE', 'REPOSITORY_CLOSED'].includes(error?.code)) throw error;
      await change(draft => {
        if (owns(draft, job.id, attemptId)) finish(draft, job.id, attemptId, 'failed', stage === 'generation' ? 'generation-executor-failed' : 'report-renderer-failed');
      });
    } finally {
      await providers.drain();
      active = null;
    }
  }
  async function drainQueue() {
    while (!stopped && !fatal) {
      let selected;
      for (const job of repository.snapshot().jobs) {
        const stage = job.generation === 'queued' && executeJob ? 'generation'
          : job.generation === 'succeeded' && job.report === 'pending' && renderReport ? 'report' : null;
        if (!stage) continue;
        const input = await repository.readJson(job.inputRef);
        const dependencies = input.dependsOn.map(getJob);
        if (dependencies.some(j => ['failed', 'cancelled', 'interrupted'].includes(j.generation))) {
          await change(draft => { const current = draft.jobs.find(j => j.id === job.id); if (current.generation === 'queued') current.generation = 'failed'; });
          continue;
        }
        if (dependencies.some(j => j.generation !== 'succeeded')) continue;
        selected = { job, input, stage }; break;
      }
      if (!selected) return;
      await run(selected.job, selected.input, selected.stage);
    }
  }
  function kick() {
    if (stopped || fatal) return;
    if (pump) { wakePending = true; return; }
    pump = drainQueue().catch(error => { fatal = error; onError(error); }).finally(() => {
      pump = null;
      if (wakePending) { wakePending = false; kick(); }
    });
  }
  async function interrupt(id, status) {
    getJob(id);
    await change(draft => {
      const job = draft.jobs.find(j => j.id === id);
      if (job.activeAttemptId) {
        const attemptId = job.activeAttemptId;
        finish(draft, id, attemptId, status);
        for (const operation of draft.operations) if (operation.attemptId === attemptId && operation.status === 'dispatched') operation.status = 'outcome-unknown';
      } else if (status === 'cancelled') {
        if (job.generation === 'queued') job.generation = 'cancelled';
        else if (job.generation === 'succeeded' && job.report === 'pending') job.report = 'interrupted';
      }
    });
    if (active?.jobId === id) active.controller.abort(new AiJobsServiceError('ATTEMPT_CANCELLED', 409, 'Attempt stopped'));
    return getJob(id);
  }
  return {
    start: kick, available, getJob, change, publish,
    status() { return { generationAvailable: Boolean(executeJob) && !fatal && !stopped, reportAvailable: Boolean(renderReport) && !fatal && !stopped, requiresRestart: Boolean(fatal) }; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async admit(request) { available(); rejectSecrets(request.input); const receipt = await repository.admit(request); publish(); kick(); return receipt; },
    async cancel(id) { const job = await interrupt(id, 'cancelled'); kick(); return job; },
    async retry(id, { stage, acknowledgeDuplicateSpend = false }) {
      requireValue(['generation', 'report'].includes(stage) && typeof acknowledgeDuplicateSpend === 'boolean', 'Invalid retry request');
      available(stage); getJob(id);
      await change(draft => {
        const job = draft.jobs.find(j => j.id === id);
        if (job.activeAttemptId || !(stage === 'generation' ? ['failed', 'interrupted', 'cancelled'].includes(job.generation) : job.generation === 'succeeded' && ['failed', 'partial', 'interrupted'].includes(job.report))) conflict('RETRY_NOT_ALLOWED', 'Only failed, interrupted or cancelled stages can be retried');
        const unknown = draft.operations.filter(o => o.jobId === id && ['dispatched', 'outcome-unknown'].includes(o.status));
        if (stage === 'generation' && unknown.length) {
          if (!acknowledgeDuplicateSpend) conflict('DUPLICATE_SPEND_ACK_REQUIRED', 'Provider outcome is unknown; retry may spend again');
          for (const operation of unknown) operation.error = DUPLICATE_SPEND_ACKNOWLEDGED;
        }
        job[stage] = stage === 'generation' ? 'queued' : 'pending';
      });
      kick(); return getJob(id);
    },
    async markInboxRead(seq) { const state = await repository.markInboxRead(seq); publish(); return state; },
    close() {
      if (!closing) {
        stopped = true;
        closing = (async () => { if (active) await interrupt(active.jobId, 'interrupted'); await pump; await providers.drain(); listeners.clear(); })();
      }
      return closing;
    },
  };
}
