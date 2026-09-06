import { createHash } from 'node:crypto';

export class AiJobsRepositoryError extends Error {
  constructor(code, message, options) { super(message, options); this.name = 'AiJobsRepositoryError'; this.code = code; }
}
export function requireValue(condition, message) {
  if (!condition) throw new AiJobsRepositoryError('INVALID_DATA', message);
}
export const families = ['assistant', 'region', 'database', 'event-commands', 'tileset', 'image'];
const states = {
  generation: ['queued', 'running', 'succeeded', 'failed', 'cancelled', 'interrupted'],
  report: ['pending', 'running', 'ready', 'partial', 'failed', 'interrupted'],
  application: ['not-requested', 'awaiting-editor', 'awaiting-review', 'applying', 'applied', 'conflict', 'outcome-unknown'],
  save: ['not-requested', 'unsaved', 'saving', 'saved', 'failed', 'unknown'],
};
const text = (v) => typeof v === 'string' && v.length > 0;
const time = (v) => Number.isSafeInteger(v) && v >= 0;
export function object(v) { return v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype; }
export function keys(v, names) {
  requireValue(object(v) && Object.keys(v).sort().join(',') === [...names].sort().join(','), 'Unexpected object fields');
}
/** Reject values JSON.stringify would silently drop/coerce, accessors and cycles. Sort object keys for identity. */
export function canonicalJson(value) {
  const seen = new Set();
  function encode(v) {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'number') { requireValue(Number.isFinite(v) && !Object.is(v, -0), 'Non-JSON number'); return String(v); }
    requireValue(Array.isArray(v) || object(v), 'Expected plain JSON value');
    requireValue(!seen.has(v), 'Cyclic JSON');
    seen.add(v);
    const descriptors = Object.getOwnPropertyDescriptors(v);
    requireValue(Object.getOwnPropertySymbols(v).length === 0 && Object.values(descriptors).every(d => 'value' in d), 'Non-JSON property');
    let result;
    if (Array.isArray(v)) {
      requireValue(Object.keys(v).length === v.length && Object.keys(v).every((k, i) => k === String(i)), 'Sparse or decorated array');
      result = `[${v.map(encode).join(',')}]`;
    } else {
      requireValue(Object.values(descriptors).every(d => d.enumerable), 'Non-enumerable JSON property');
      result = `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${encode(v[k])}`).join(',')}}`;
    }
    seen.delete(v);
    return result;
  }
  return encode(value);
}
export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
export function validateRef(ref) {
  keys(ref, ['sha256', 'byteLength', 'mediaType']);
  requireValue(/^[a-f0-9]{64}$/.test(ref.sha256) && time(ref.byteLength) && text(ref.mediaType), 'Invalid blob reference');
}
function identity(v) { keys(v, ['backend', 'projectId']); requireValue(text(v.backend) && text(v.projectId), 'Invalid project identity'); }
export function validateInput(v) {
  canonicalJson(v);
  keys(v, ['version', 'family', 'project', 'projectSnapshot', 'artwork', 'target', 'mode', 'payload', 'dependsOn']);
  requireValue(v.version === 1 && families.includes(v.family) && text(v.mode) && object(v.target) && object(v.payload), 'Invalid job input');
  identity(v.project); validateRef(v.projectSnapshot);
  requireValue(Array.isArray(v.artwork) && Array.isArray(v.dependsOn) && v.dependsOn.every(text) && new Set(v.dependsOn).size === v.dependsOn.length, 'Invalid input references');
  v.artwork.forEach(validateRef);
}
export function validateResult(v) {
  keys(v, ['version', 'family', 'jobId', 'attemptId', 'project', 'baseSnapshot', 'generatedSnapshot', 'artifacts', 'payload']);
  requireValue(v.version === 1 && families.includes(v.family) && text(v.jobId) && text(v.attemptId) && object(v.payload) && Array.isArray(v.artifacts), 'Invalid result');
  identity(v.project); validateRef(v.baseSnapshot);
  if (v.generatedSnapshot !== null) validateRef(v.generatedSnapshot);
  v.artifacts.forEach(validateRef);
}
export function validateCheckpoint(v) {
  keys(v, ['version', 'jobId', 'attemptId', 'inputSha256', 'stageKey', 'state', 'artifacts']);
  requireValue(v.version === 1 && text(v.jobId) && text(v.attemptId) && /^[a-f0-9]{64}$/.test(v.inputSha256) && text(v.stageKey) && object(v.state) && Array.isArray(v.artifacts), 'Invalid checkpoint');
  v.artifacts.forEach(validateRef);
}
export function jobStates(job) { return Object.fromEntries(Object.keys(states).map(key => [key, job[key]])); }
function validateStates(v) { for (const [key, values] of Object.entries(states)) requireValue(values.includes(v[key]), `Invalid ${key} state`); }
export function isOutcome(before, after) {
  return (!before || before.generation !== after.generation) && ['succeeded', 'failed', 'cancelled', 'interrupted'].includes(after.generation)
    || ['report', 'application', 'save'].some(k => before?.[k] !== after[k] && ({ report: ['ready', 'partial', 'failed', 'interrupted'], application: ['applied', 'conflict', 'outcome-unknown'], save: ['saved', 'failed', 'unknown'] })[k].includes(after[k]));
}
export function validateSnapshot(s) {
  canonicalJson(s);
  keys(s, ['version', 'revision', 'jobs', 'attempts', 'operations', 'events', 'inbox']);
  requireValue(s.version === 1 && time(s.revision), 'Invalid snapshot version/revision');
  for (const name of ['jobs', 'attempts', 'operations', 'events', 'inbox']) requireValue(Array.isArray(s[name]), `Invalid ${name}`);
  const jobs = new Map(s.jobs.map(j => [j.id, j]));
  const attempts = new Map(s.attempts.map(a => [a.id, a]));
  for (const rows of [s.jobs, s.attempts, s.operations]) requireValue(rows.every(r => text(r.id)) && new Set(rows.map(r => r.id)).size === rows.length, 'Duplicate/invalid record ID');
  requireValue(new Set(s.jobs.map(j => j.idempotencyKey)).size === s.jobs.length, 'Duplicate idempotency key');
  for (const j of s.jobs) {
    keys(j, ['id', 'idempotencyKey', 'family', 'project', 'inputRef', 'createdAt', 'updatedAt', 'generation', 'report', 'application', 'save', 'activeAttemptId', 'resultRef', 'reportRef', 'applicationEvidence', 'saveEvidence', ...('checkpointRef' in j ? ['checkpointRef'] : [])]);
    requireValue(text(j.idempotencyKey) && families.includes(j.family) && time(j.createdAt) && time(j.updatedAt) && j.updatedAt >= j.createdAt, 'Invalid job');
    identity(j.project); validateRef(j.inputRef); validateStates(j);
    for (const ref of [j.resultRef, j.reportRef, j.checkpointRef ?? null]) if (ref !== null) validateRef(ref);
    for (const evidence of [j.applicationEvidence, j.saveEvidence]) requireValue(evidence === null || object(evidence), 'Invalid evidence');
    requireValue(j.generation !== 'succeeded' || j.resultRef !== null, 'Successful generation needs a result');
    requireValue(!['ready', 'partial'].includes(j.report) || j.reportRef !== null, 'Ready report needs an artifact');
    requireValue(j.application !== 'applied' || j.applicationEvidence !== null, 'Applied state needs evidence');
    requireValue(j.save !== 'saved' || j.application === 'applied' && j.saveEvidence !== null, 'Saved state needs application and save evidence');
    const active = attempts.get(j.activeAttemptId);
    requireValue(j.activeAttemptId === null || active?.jobId === j.id && active.status === 'running', 'Invalid active attempt');
    requireValue((j.generation === 'running' || j.report === 'running') === (j.activeAttemptId !== null), 'Running state needs an active attempt');
    if (active) requireValue(j[active.stage] === 'running', 'Attempt stage mismatch');
  }
  for (const a of s.attempts) {
    keys(a, ['id', 'jobId', 'stage', 'status', 'startedAt', 'finishedAt', 'error']);
    requireValue(jobs.has(a.jobId) && ['generation', 'report'].includes(a.stage) && ['running', 'succeeded', 'failed', 'cancelled', 'interrupted'].includes(a.status), 'Invalid attempt');
    requireValue(time(a.startedAt) && (a.status === 'running' ? a.finishedAt === null : time(a.finishedAt) && a.finishedAt >= a.startedAt) && (a.error === null || text(a.error)), 'Invalid attempt completion');
    if (a.status === 'running') requireValue(jobs.get(a.jobId).activeAttemptId === a.id, 'Orphan running attempt');
  }
  for (const o of s.operations) {
    keys(o, ['id', 'jobId', 'attemptId', 'kind', 'status', 'requestRef', 'responseRef', 'error']);
    requireValue(attempts.get(o.attemptId)?.jobId === o.jobId && text(o.kind) && ['prepared', 'dispatched', 'succeeded', 'failed', 'outcome-unknown'].includes(o.status) && (o.error === null || text(o.error)), 'Invalid operation');
    validateRef(o.requestRef); if (o.responseRef !== null) validateRef(o.responseRef);
    requireValue(o.status !== 'succeeded' || o.responseRef !== null, 'Successful operation needs a response');
  }
  for (const [index, e] of s.events.entries()) {
    keys(e, ['seq', 'jobId', 'kind', 'createdAt', 'states']);
    requireValue(e.seq === index + 1 && jobs.has(e.jobId) && ['admitted', 'updated', 'outcome', 'inbox-read'].includes(e.kind) && time(e.createdAt), 'Invalid event');
    keys(e.states, Object.keys(states)); validateStates(e.states);
  }
  requireValue(new Set(s.inbox.map(i => i.eventSeq)).size === s.inbox.length, 'Duplicate inbox item');
  for (const i of s.inbox) {
    keys(i, ['eventSeq', 'jobId', 'createdAt', 'readAt']);
    const event = s.events[i.eventSeq - 1];
    requireValue(event?.kind === 'outcome' && event.jobId === i.jobId && i.createdAt === event.createdAt && (i.readAt === null || time(i.readAt)), 'Invalid inbox item');
  }
  requireValue(s.events.filter(e => e.kind === 'outcome').length === s.inbox.length, 'Outcome missing its inbox item');
}
/** Existing identities/history are immutable; lifecycle policy belongs to the scheduler. */
export function validateHistory(before, after) {
  for (const [table, fields] of [
    ['jobs', ['id', 'idempotencyKey', 'family', 'project', 'inputRef', 'createdAt']],
    ['attempts', ['id', 'jobId', 'stage', 'startedAt']],
    ['operations', ['id', 'jobId', 'attemptId', 'kind', 'requestRef']],
  ]) for (const old of before[table]) {
    const next = after[table].find(r => r.id === old.id);
    requireValue(next && fields.every(k => canonicalJson(next[k]) === canonicalJson(old[k])), 'Cannot remove records or change their identity');
    if (table === 'attempts' && old.status !== 'running') requireValue(canonicalJson(old) === canonicalJson(next), 'Cannot rewrite a finished attempt');
    if (table === 'operations' && ['succeeded', 'failed'].includes(old.status)) requireValue(canonicalJson(old) === canonicalJson(next), 'Cannot rewrite a finished operation');
  }
}
