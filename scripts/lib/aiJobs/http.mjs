import { randomBytes, timingSafeEqual } from 'node:crypto';
import { canonicalJson, keys, object, requireValue } from './validation.mjs';
import { AiJobsServiceError, conflict, rejectSecrets } from './providerOperations.mjs';
export { rejectSecrets } from './providerOperations.mjs';

const ROOT = '/api/ai-jobs';
const COOKIE = 'rpg-ai-jobs-session';
function equalToken(actual, expected) {
  return typeof actual === 'string' && Buffer.byteLength(actual) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
function loopback(address) { return address === '::1' || /^127\./.test(address ?? '') || /^::ffff:127\./.test(address ?? ''); }
async function readJson(req, maxBodyBytes) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) throw new AiJobsServiceError('JSON_REQUIRED', 415, 'Writes require application/json');
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') throw new AiJobsServiceError('JSON_REQUIRED', 415, 'Encoded request bodies are not supported');
  const chunks = []; let length = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > maxBodyBytes) { req.resume(); throw new AiJobsServiceError('BODY_TOO_LARGE', 413, 'Job submission exceeds the local body limit'); }
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AiJobsServiceError('INVALID_JSON', 400, 'Malformed JSON body'); }
  requireValue(object(value), 'Expected a JSON object'); rejectSecrets(value);
  return value;
}

/** Connect-compatible real Node HTTP handler. No CORS, remote fetch, or browser execution path. */
export function createAiJobsHttpHandler({ repository, scheduler, origins, maxBodyBytes = 32 * 1024 * 1024, onError = console.error }) {
  const session = randomBytes(32).toString('hex');
  const csrfToken = randomBytes(32).toString('hex');
  const streams = new Set();
  function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
  }
  function guard(req) {
    const allowed = typeof origins === 'function' ? origins() : origins;
    const scheme = req.socket.encrypted ? 'https:' : 'http:';
    const origin = allowed.find(value => { const url = new URL(value); return url.protocol === scheme && url.host === req.headers.host; });
    if (!loopback(req.socket.remoteAddress) || !origin || req.headers.origin !== undefined && req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') {
      throw new AiJobsServiceError('FORBIDDEN_ORIGIN', 403, 'Exact local Origin and Host required');
    }
    if (req.method !== 'GET') {
      const cookie = (req.headers.cookie ?? '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${COOKIE}=`));
      if (req.headers.origin !== origin || cookie.length !== 1 || !equalToken(cookie[0].slice(COOKIE.length + 1), session) || !equalToken(req.headers['x-ai-jobs-csrf'], csrfToken)) {
        throw new AiJobsServiceError('CSRF_REQUIRED', 403, 'Obtain the local session and send X-AI-Jobs-CSRF');
      }
    }
  }
  async function manifest(job) {
    const input = await repository.readJson(job.inputRef);
    const refs = [job.inputRef, input.projectSnapshot, ...input.artwork];
    if (job.checkpointRef) { refs.push(job.checkpointRef); const checkpoint = await repository.readJson(job.checkpointRef); refs.push(...checkpoint.artifacts); }
    if (job.resultRef) {
      refs.push(job.resultRef);
      const result = await repository.readJson(job.resultRef);
      refs.push(...result.artifacts);
      if (result.generatedSnapshot) refs.push(result.generatedSnapshot);
    }
    if (job.reportRef) {
      refs.push(job.reportRef);
      // Renderers explicitly list immutable report assets; never recurse arbitrary JSON/URLs.
      const report = await repository.readJson(job.reportRef);
      if (Array.isArray(report.artifacts)) refs.push(...report.artifacts);
    }
    return [...new Map(refs.map(ref => [ref.sha256, ref])).values()];
  }
  function events(req, res, url) {
    const afterText = url.searchParams.get('after') ?? req.headers['last-event-id'] ?? '0';
    requireValue(typeof afterText === 'string' && /^(0|[1-9]\d*)$/.test(afterText) && Number.isSafeInteger(Number(afterText)), 'Invalid event sequence');
    let after = Number(afterText);
    requireValue(after <= repository.snapshot().events.length, 'Event cursor is ahead of local history');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
    let blocked = false;
    const flush = () => {
      if (blocked || res.destroyed) return;
      for (const event of repository.snapshot().events.slice(after)) {
        after = event.seq;
        if (!res.write(`id: ${event.seq}\nevent: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`)) { blocked = true; break; }
      }
    };
    // Subscribe before replay; a per-stream durable cursor closes the replay/live gap.
    const unsubscribe = scheduler.subscribe(flush);
    streams.add(res);
    res.on('drain', () => { blocked = false; flush(); });
    res.on('close', () => { unsubscribe(); streams.delete(res); });
    res.flushHeaders(); flush();
  }
  async function route(req, res) {
    guard(req);
    const url = new URL(req.url, 'http://local.invalid');
    const parts = url.pathname.slice(ROOT.length).split('/').filter(Boolean);
    if (req.method === 'GET') {
      if (parts.length === 0) return json(res, 200, { jobs: repository.snapshot().jobs, ...scheduler.status() });
      if (parts[0] === 'session' && parts.length === 1) {
        res.setHeader('Set-Cookie', `${COOKIE}=${session}; Path=${ROOT}; HttpOnly; SameSite=Strict${req.socket.encrypted ? '; Secure' : ''}`);
        return json(res, 200, { csrfToken, ...scheduler.status() });
      }
      if (parts[0] === 'events' && parts.length === 1) return events(req, res, url);
      if (parts[0] === 'inbox' && parts.length === 1) return json(res, 200, { inbox: repository.snapshot().inbox });
      const job = scheduler.getJob(parts[0]);
      if (parts.length === 1) {
        const state = repository.snapshot();
        return json(res, 200, { job, attempts: state.attempts.filter(a => a.jobId === job.id),
          operations: state.operations.filter(o => o.jobId === job.id), manifest: await manifest(job) });
      }
      if (parts[1] === 'artifacts' && parts.length === 3) {
        const ref = (await manifest(job)).find(ref => ref.sha256 === parts[2]);
        if (!ref) throw new AiJobsServiceError('NOT_FOUND', 404, 'Artifact is not in this job manifest');
        const bytes = await repository.readBlob(ref);
        res.writeHead(200, { 'Content-Type': ref.mediaType, 'Content-Length': bytes.length,
          'Content-Disposition': `attachment; filename="${ref.sha256}"`, 'Content-Security-Policy': "default-src 'none'; sandbox",
          'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ETag: `"${ref.sha256}"` });
        return res.end(bytes);
      }
    } else if (req.method === 'POST') {
      const body = await readJson(req, maxBodyBytes);
      if (parts.length === 0) {
        scheduler.available();
        keys(body, ['input', 'projectSnapshot', 'artwork']);
        keys(body.input, ['version', 'family', 'project', 'target', 'mode', 'payload', 'dependsOn']);
        const key = req.headers['idempotency-key'];
        requireValue(typeof key === 'string' && key.trim().length > 0 && key.length <= 256, 'Idempotency-Key required');
        requireValue(Array.isArray(body.artwork), 'Artwork must be an array');
        const artwork = [];
        for (const item of body.artwork) {
          keys(item, ['mediaType', 'base64']);
          requireValue(typeof item.mediaType === 'string' && /^(image\/(png|jpeg|webp|gif)|application\/octet-stream)$/.test(item.mediaType), 'Unsupported artwork media type');
          requireValue(typeof item.base64 === 'string' && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.base64), 'Artwork must be canonical base64');
          artwork.push(await repository.putBlob(Buffer.from(item.base64, 'base64'), item.mediaType));
        }
        const input = { ...body.input, projectSnapshot: await repository.putJson(body.projectSnapshot), artwork };
        const receipt = await scheduler.admit({ idempotencyKey: key, input });
        res.setHeader('Location', `${ROOT}/${receipt.job.id}`);
        return json(res, receipt.created ? 202 : 200, receipt);
      }
      if (parts[0] === 'inbox' && parts[2] === 'read' && parts.length === 3) {
        keys(body, []); requireValue(/^[1-9]\d*$/.test(parts[1]), 'Invalid inbox sequence');
        await scheduler.markInboxRead(Number(parts[1])); return json(res, 200, { inbox: repository.snapshot().inbox });
      }
      const id = parts[0]; scheduler.getJob(id);
      if (parts.length === 2 && parts[1] === 'cancel') { keys(body, []); return json(res, 200, { job: await scheduler.cancel(id) }); }
      if (parts.length === 2 && parts[1] === 'retry') {
        requireValue(Object.keys(body).every(k => ['stage', 'acknowledgeDuplicateSpend'].includes(k)), 'Unexpected retry fields');
        return json(res, 202, { job: await scheduler.retry(id, body) });
      }
      if (parts.length === 3 && parts[1] === 'application') {
        if (parts[2] === 'prepare') {
          keys(body, ['claimId', 'project', 'resultSha256', 'baselineSha256']);
          requireValue(typeof body.claimId === 'string' && body.claimId.length > 0 && body.claimId.length <= 256, 'Application claim ID required');
          const input = await repository.readJson(scheduler.getJob(id).inputRef);
          await scheduler.change(draft => {
            const job = draft.jobs.find(j => j.id === id);
            if (canonicalJson(body.project) !== canonicalJson(job.project) || body.resultSha256 !== job.resultRef?.sha256 || body.baselineSha256 !== input.projectSnapshot.sha256) conflict('APPLICATION_IDENTITY_MISMATCH', 'Project, result or baseline mismatch');
            if (job.applicationEvidence?.claim) {
              if (canonicalJson(job.applicationEvidence.claim) === canonicalJson(body)) return;
              conflict('APPLICATION_ALREADY_CLAIMED', 'Another application claim owns this result');
            }
            if (job.generation !== 'succeeded' || !['awaiting-editor', 'awaiting-review'].includes(job.application)) conflict('APPLICATION_NOT_READY', 'Result is not awaiting application');
            job.application = 'applying'; job.applicationEvidence = { claim: body };
          });
          return json(res, 200, { job: scheduler.getJob(id) });
        }
        if (parts[2] === 'evidence') {
          keys(body, ['claimId', 'receiptId', 'project', 'resultSha256', 'application', 'save', 'evidence', 'saveEvidence']);
          requireValue(typeof body.receiptId === 'string' && body.receiptId.length > 0 && object(body.evidence) && ['applied', 'conflict', 'outcome-unknown'].includes(body.application) && ['unsaved', 'saved', 'failed', 'unknown'].includes(body.save), 'Invalid application evidence');
          requireValue(body.saveEvidence === null || object(body.saveEvidence), 'Invalid save evidence');
          requireValue(body.application !== 'applied' || /^[a-f0-9]{64}$/.test(body.evidence.appliedSnapshotSha256), 'Applied receipt requires its exact snapshot hash');
          requireValue(body.save !== 'saved' || body.application === 'applied' && body.saveEvidence?.method === 'reload' && body.saveEvidence?.confirmedSnapshotSha256 === body.evidence.appliedSnapshotSha256, 'Saved requires reload evidence for the exact applied snapshot');
          await scheduler.change(draft => {
            const job = draft.jobs.find(j => j.id === id);
            const claim = job.applicationEvidence?.claim;
            if (!claim || claim.claimId !== body.claimId || canonicalJson(body.project) !== canonicalJson(job.project) || body.resultSha256 !== job.resultRef?.sha256) conflict('APPLICATION_IDENTITY_MISMATCH', 'Evidence does not match the application claim');
            const previous = job.applicationEvidence.receipt;
            if (previous) {
              if (canonicalJson(previous) === canonicalJson(body)) return;
              conflict('APPLICATION_RECEIPT_CONFLICT', 'Application receipt is immutable');
            }
            if (!['applying', 'outcome-unknown'].includes(job.application)) conflict('APPLICATION_NOT_READY', 'No unresolved application claim');
            job.application = body.application; job.save = body.save;
            job.applicationEvidence = { claim, receipt: body };
            job.saveEvidence = { updates: [{ saveAttemptId: 'initial', save: body.save, evidence: body.saveEvidence }] };
          });
          return json(res, 200, { job: scheduler.getJob(id) });
        }
        if (parts[2] === 'save-evidence') {
          keys(body, ['claimId', 'receiptId', 'project', 'resultSha256', 'saveAttemptId', 'save', 'saveEvidence']);
          requireValue(typeof body.saveAttemptId === 'string' && body.saveAttemptId.length > 0 && body.saveAttemptId.length <= 256 && body.saveAttemptId !== 'initial' && ['saved', 'failed', 'unknown'].includes(body.save) && object(body.saveEvidence), 'Invalid save-only evidence');
          await scheduler.change(draft => {
            const job = draft.jobs.find(j => j.id === id);
            const receipt = job.applicationEvidence?.receipt;
            if (job.application !== 'applied' || !receipt || receipt.claimId !== body.claimId || receipt.receiptId !== body.receiptId || canonicalJson(body.project) !== canonicalJson(job.project) || body.resultSha256 !== job.resultRef?.sha256) conflict('APPLICATION_IDENTITY_MISMATCH', 'Save evidence does not match the applied receipt');
            if (body.save === 'saved' && (body.saveEvidence.method !== 'reload' || body.saveEvidence.confirmedSnapshotSha256 !== receipt.evidence.appliedSnapshotSha256)) conflict('SAVE_SNAPSHOT_MISMATCH', 'Reload must confirm the exact applied snapshot');
            const update = { saveAttemptId: body.saveAttemptId, save: body.save, evidence: body.saveEvidence };
            const previous = job.saveEvidence.updates.find(item => item.saveAttemptId === body.saveAttemptId);
            if (previous) {
              if (canonicalJson(previous) === canonicalJson(update)) return;
              conflict('SAVE_EVIDENCE_CONFLICT', 'Save attempt evidence is immutable');
            }
            if (job.save === 'saved') conflict('SAVE_ALREADY_CONFIRMED', 'The applied snapshot is already confirmed saved');
            job.saveEvidence.updates.push(update); job.save = body.save;
          });
          return json(res, 200, { job: scheduler.getJob(id) });
        }
      }
    } else throw new AiJobsServiceError('METHOD_NOT_ALLOWED', 405, 'Only GET and JSON POST are supported');
    throw new AiJobsServiceError('NOT_FOUND', 404, 'AI jobs endpoint not found');
  }
  const handler = (req, res, next) => {
    if (!(req.url === ROOT || req.url?.startsWith(`${ROOT}/`) || req.url?.startsWith(`${ROOT}?`))) { if (next) return next(); return json(res, 404, { code: 'NOT_FOUND' }); }
    return route(req, res).catch(error => {
      const status = error.status ?? ({ INVALID_DATA: 400, IDEMPOTENCY_CONFLICT: 409, PERSISTENCE_FAILED: 503, DURABILITY_UNKNOWN: 503 })[error.code] ?? 500;
      if (status >= 500) onError(error);
      if (res.headersSent) { res.destroy(); return; }
      json(res, status, { code: error.code ?? 'INTERNAL_ERROR', error: status >= 500 && error.code !== 'EXECUTOR_UNAVAILABLE' ? 'Local job service failed; durable records are retained' : error.message });
    });
  };
  handler.close = () => { for (const res of streams) res.end(); streams.clear(); };
  return handler;
}
