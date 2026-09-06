import { randomUUID } from 'node:crypto';
import { canonicalJson, object, requireValue } from './validation.mjs';

const SECRET_FIELD = /^(apikey|accesstoken|refreshtoken|authorization|password|clientsecret|credentials|privatekey|cookie|secretkey)$/i;
export function rejectSecrets(value) {
  if (typeof value === 'string') {
    requireValue(!/\bBearer\s+\S+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(value), 'Credentials must remain in Node provider auth');
  } else if (Array.isArray(value)) value.forEach(rejectSecrets);
  else if (object(value)) for (const [key, item] of Object.entries(value)) {
    requireValue(!SECRET_FIELD.test(key.replace(/[-_]/g, '')), 'Credentials must remain in Node provider auth');
    rejectSecrets(item);
  }
}

export const DUPLICATE_SPEND_ACKNOWLEDGED = 'duplicate-spend-acknowledged';
export class AiJobsServiceError extends Error {
  constructor(code, status, message) { super(message); this.name = 'AiJobsServiceError'; this.code = code; this.status = status; }
}
export function conflict(code, message) { throw new AiJobsServiceError(code, 409, message); }

/** One physical request at a time, even when cancellation cannot stop the upstream.
 * kind is the executor's stable logical step key, NOT a display label. */
export function createProviderOperations({ repository, change, dispatchProvider }) {
  let tail = Promise.resolve();
  function run({ jobId, attemptId, key, request, signal }) {
    const copy = JSON.parse(canonicalJson(request));
    rejectSecrets(copy);
    requireValue(typeof key === 'string' && key.length > 0 && key.length <= 256, 'Provider step key required');
    const work = tail.then(async () => {
      const fenced = () => {
        signal.throwIfAborted();
        if (repository.snapshot().jobs.find(j => j.id === jobId)?.activeAttemptId !== attemptId) conflict('STALE_ATTEMPT', 'Attempt no longer owns this job');
      };
      fenced();
      const requestRef = await repository.putJson(copy);
      const previous = repository.snapshot().operations.filter(o => o.jobId === jobId && o.kind === key);
      if (previous.some(o => o.requestRef.sha256 !== requestRef.sha256)) conflict('OPERATION_MISMATCH', 'Stable provider key was reused with different input');
      const completed = previous.findLast(o => o.status === 'succeeded');
      if (completed) { const response = await repository.readJson(completed.responseRef); fenced(); return response; }
      if (previous.some(o => ['dispatched', 'outcome-unknown'].includes(o.status) && o.error !== DUPLICATE_SPEND_ACKNOWLEDGED)) {
        conflict('DUPLICATE_SPEND_ACK_REQUIRED', 'Provider outcome is unknown; explicit duplicate-spend acknowledgement is required');
      }
      if (!dispatchProvider) throw new AiJobsServiceError('PROVIDER_UNAVAILABLE', 503, 'Node provider adapter is unavailable');
      const id = randomUUID();
      await change(draft => {
        fenced();
        draft.operations.push({ id, jobId, attemptId, kind: key, status: 'prepared', requestRef, responseRef: null, error: null });
      });
      await change(draft => { fenced(); draft.operations.find(o => o.id === id).status = 'dispatched'; });
      // No await between the final fence and the physical dispatch.
      fenced();
      let response;
      try { response = await dispatchProvider(copy, { jobId, attemptId, operationId: id, key, signal }); }
      catch (error) {
        // Only the trusted Node adapter can prove that a request never left the host.
        // All other exceptions, including AbortError, imply unknown cost.
        await change(draft => {
          const operation = draft.operations.find(o => o.id === id);
          operation.status = error?.code === 'PROVIDER_NOT_DISPATCHED' ? 'failed' : 'outcome-unknown';
          if (operation.error !== DUPLICATE_SPEND_ACKNOWLEDGED) operation.error = operation.status === 'failed' ? 'provider-not-dispatched' : 'provider-outcome-unknown';
        });
        throw error;
      }
      // Persist even a late response for a cancelled attempt, but never deliver it to that worker.
      const responseRef = await repository.putJson(response);
      await change(draft => {
        const operation = draft.operations.find(o => o.id === id);
        operation.status = 'succeeded'; operation.responseRef = responseRef; operation.error = null;
      });
      const persistedResponse = await repository.readJson(responseRef);
      fenced();
      return persistedResponse;
    });
    // Caller owns rejection; this tail is only a serialization/drain barrier.
    tail = work.then(() => undefined, () => undefined);
    return work;
  }
  return { run, drain: () => tail };
}
