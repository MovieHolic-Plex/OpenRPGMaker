// QA-only. No provider adapter, credentials, remote fetch, or generated job/result stubs.
import { createBrowserRuntime } from '../../../../scripts/lib/aiJobs/browserExecutor.mjs';
import { canonicalJson } from '../../../../scripts/lib/aiJobs/validation.mjs';
import { rejectSecrets } from '../../../../scripts/lib/aiJobs/providerOperations.mjs';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';

export const PROJECT_ID = 'task8-disposable-qa';
export const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const fail = (message, status = 409) => Object.assign(new Error(message), { status, code: 'PROVIDER_NOT_DISPATCHED' });
const require = (condition, message) => { if (!condition) throw fail(message, 400); };
const families = ['assistant', 'region', 'database', 'event-commands', 'tileset', 'image'];

export async function createTask8Runtime(wire, options, runtimeFactory = createBrowserRuntime) {
  require(typeof wire?.dispatchProvider === 'function', 'Controlled Node provider is mandatory');
  // Last assignment is deliberate: callers cannot accidentally restore a live adapter.
  const runtime = await runtimeFactory({ ...options, dispatchProvider: wire.dispatchProvider });
  return { ...runtime, ...(runtime.executeJob ? { executeJob: (input, host, signal) => runtime.executeJob(input,
    { ...host, providerOperation: operation => wire.providerOperation(host, operation) }, signal) } : {}) };
}

export function createQaWire({ getService, waitTimeout = 90000 }) {
  const plans = [], calls = [], logicalCalls = [], violations = [], events = [], bus = new EventEmitter(), held = new Map();
  let closed = false;
  bus.setMaxListeners(100);
  function emit(type, detail = {}) { const event = { seq: events.length + 1, type, ...detail }; events.push(event); bus.emit('event', event); return event; }
  function violation(kind, detail = {}) { const value = { kind, ...detail }; violations.push(value); emit('violation', value); return fail(`Task8 blocked ${kind}`); }
  function plan(body) {
    rejectSecrets(body);
    require(!closed && typeof body.id === 'string' && body.id.length > 0 && !plans.some(p => p.id === body.id), 'Unique plan id required');
    require(families.includes(body.match?.family) && body.match.projectId === PROJECT_ID, 'Plan must select the disposable project and one family');
    require(Object.keys(body).every(key => ['id', 'match', 'operations'].includes(key)), 'Unknown plan field');
    require(Object.keys(body.match).every(key => ['family', 'projectId', 'operation', 'inputSha256', 'payload'].includes(key)), 'Unknown match field');
    require(!body.match.inputSha256 || /^[a-f0-9]{64}$/.test(body.match.inputSha256), 'Invalid input hash');
    require(Array.isArray(body.operations) && body.operations.length > 0, 'Nonempty exact operation sequence required');
    for (const op of body.operations) {
      require(Object.keys(op).every(key => ['key', 'kind', 'provider', 'response', 'failure', 'hold', 'cancel', 'requestSha256', 'responseSha256'].includes(key)), 'Unknown operation field');
      require(typeof op.key === 'string' && ['text', 'image'].includes(op.kind), 'Exact operation key and kind required');
      require(['google-antigravity', 'openai-codex'].includes(op.provider), 'Exact provider required');
      require(Object.hasOwn(op, 'response') !== Object.hasOwn(op, 'failure'), 'Exactly one response or failure required');
      require(op.hold === undefined || typeof op.hold === 'boolean', 'hold must be boolean');
      require(op.cancel === undefined || ['abort', 'late-response'].includes(op.cancel), 'Unknown cancel behavior');
      require(!op.failure || ['not-dispatched', 'outcome-unknown'].includes(op.failure), 'Unknown failure behavior');
      require(!op.requestSha256 || /^[a-f0-9]{64}$/.test(op.requestSha256), 'Invalid request hash');
      require(!op.responseSha256 || op.responseSha256 === hash(canonicalJson(op.response)), 'Pinned response hash mismatch');
    }
    const value = { ...clone(body), jobId: null, cursor: 0 };
    plans.push(value); emit('plan-registered', { planId: value.id }); return { id: value.id };
  }
  async function providerOperation(host, operation) {
    const prior = getService().repository.snapshot().operations.findLast(op => op.jobId === host.jobId && op.kind === operation.key && op.status === 'succeeded');
    const logical = { jobId: host.jobId, attemptId: host.attemptId, key: operation.key, status: 'requested', reused: false };
    logicalCalls.push(logical);
    try {
      const response = await host.providerOperation(operation);
      logical.status = 'returned'; logical.reused = Boolean(prior);
      if (prior) emit('operation-reused', { ...logical, responseRef: prior.responseRef });
      return response;
    } catch (error) { logical.status = 'failed'; throw error; }
  }
  async function dispatchProvider(request, context) {
    if (closed) throw violation('closed-provider');
    const service = getService(), job = service.scheduler.getJob(context.jobId);
    const input = await service.repository.readJson(job.inputRef);
    let selected = plans.find(p => p.jobId === context.jobId);
    if (!selected) {
      const candidates = plans.filter(p => p.jobId === null && p.match.family === input.family && p.match.projectId === input.project.projectId
        && (!p.match.operation || p.match.operation === input.payload.operation)
        && (!p.match.inputSha256 || p.match.inputSha256 === job.inputRef.sha256)
        && (!p.match.payload || Object.entries(p.match.payload).every(([key, value]) => canonicalJson(input.payload[key] ?? null) === canonicalJson(value))));
      if (candidates.length !== 1) throw violation('unplanned-job', { jobId: context.jobId, key: context.key, candidates: candidates.length });
      selected = candidates[0]; selected.jobId = context.jobId;
    }
    const index = selected.cursor, op = selected.operations[index];
    if (!op || op.key !== context.key || op.kind !== request.kind || op.provider !== request.provider
      || (op.requestSha256 && op.requestSha256 !== hash(canonicalJson(request)))) {
      throw violation('unexpected-operation', { jobId: context.jobId, planId: selected.id, index, key: context.key });
    }
    context.signal.throwIfAborted();
    selected.cursor++;
    const call = { planId: selected.id, index, jobId: context.jobId, attemptId: context.attemptId, operationId: context.operationId,
      key: context.key, requestSha256: hash(canonicalJson(request)), status: 'reached' };
    calls.push(call);
    const token = `${selected.id}:${index}`;
    let release, reject, abort;
    const gate = op.hold ? new Promise((yes, no) => { release = yes; reject = no; }) : Promise.resolve();
    // Register held state BEFORE publishing reached. No release can miss its resolver.
    if (op.hold) {
      held.set(token, { release, reject, call });
      abort = () => {
        emit('operation-aborted', { planId: selected.id, index, jobId: context.jobId });
        if (op.cancel !== 'late-response') { held.delete(token); reject(fail('Controlled cancellation')); }
      };
      context.signal.addEventListener('abort', abort, { once: true });
    }
    emit('operation-reached', clone(call));
    try {
      await gate;
      if (op.failure) throw op.failure === 'not-dispatched' ? fail('Controlled pre-dispatch failure') : new Error('Controlled unknown outcome');
      call.status = 'responded'; call.responseSha256 = hash(canonicalJson(op.response));
      emit('operation-responded', clone(call)); return clone(op.response);
    } catch (error) {
      call.status = 'failed'; emit('operation-failed', clone(call)); throw error;
    } finally {
      if (abort) context.signal.removeEventListener('abort', abort);
      held.delete(token);
    }
  }
  function release(body) {
    const slot = held.get(`${body.planId}:${body.index}`);
    if (!slot) throw fail('Operation is not held/reached');
    held.delete(`${body.planId}:${body.index}`);
    emit('operation-released', { planId: body.planId, index: body.index }); slot.release(); return {};
  }
  function wait(body, signal) {
    require(!closed && typeof body.type === 'string', 'Open fixture and exact event type required');
    const matches = e => e.seq > (body.after ?? 0) && e.type === body.type
      && ['planId', 'index', 'jobId', 'waitType', 'table'].every(key => body[key] === undefined || body[key] === e[key])
      && ['generation', 'report', 'application', 'save'].every(key => body[key] === undefined || body[key] === e.event?.states[key]);
    return new Promise((resolve, reject) => {
      const finish = (error, value) => { clearTimeout(timer); bus.off('event', listener); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value); };
      const listener = event => { if (event.type === 'closing') finish(fail('Fixture closing', 503)); else if (matches(event)) finish(null, event); };
      const abort = () => finish(fail('Wait disconnected', 499));
      const timer = setTimeout(() => finish(fail('Exact event deadline', 408)), waitTimeout);
      bus.on('event', listener); signal?.addEventListener('abort', abort, { once: true });
      emit('waiter-registered', { waitType: body.type, planId: body.planId, index: body.index });
      const prior = events.find(matches); if (prior) finish(null, prior);
      if (signal?.aborted) abort();
    });
  }
  function counts() {
    const snapshot = getService()?.repository.snapshot();
    return clone({ plans: plans.map(({ operations, ...p }) => ({ ...p, expectedOperations: operations.length, remaining: operations.length - p.cursor })),
      calls, logicalCalls, logicalRequests: logicalCalls.length, reusedResponses: logicalCalls.filter(call => call.reused).length, violations, events, held: [...held.keys()], waiters: bus.listenerCount('event'),
      jobs: snapshot?.jobs ?? [], operations: snapshot?.operations ?? [], attempts: snapshot?.attempts ?? [],
      jobCount: snapshot?.jobs.length ?? 0, operationCount: snapshot?.operations.length ?? 0, controlledCalls: calls.length });
  }
  function close() { closed = true; for (const slot of held.values()) slot.reject(fail('Fixture closing')); held.clear(); emit('closing'); }
  return { plan, dispatchProvider, providerOperation, release, wait, counts, close, emit, violation };
}

// Minimal PostgREST wire used by the real store/supabaseProjectSync implementation.
// No upstream exists. Canonical project and map rows remain separate, as in production.
export function createQaPersistence({ violation, emit }) {
  const tables = new Map(['projects', 'maps', 'tilesets', 'project_commits', 'project_changes', 'ai_activity_logs', 'ai_analysis_runs', 'ai_conversations', 'map_edit_locks'].map(t => [t, []]));
  const keys = { projects: 'project_id', maps: 'map_id', tilesets: 'tileset_id', project_commits: 'commit_id', project_changes: 'commit_id', ai_activity_logs: 'log_id', ai_analysis_runs: 'run_id', ai_conversations: 'conversation_id', map_edit_locks: 'map_id' };
  const requests = [];
  let initialized = false, failures = 0, blockWrites = false, reads = 0, writes = 0, rejectedWrites = 0;
  function initialize(body) {
    require(!initialized, 'Disposable project already initialized; start a fresh fixture to reset');
    require(body.projectId === PROJECT_ID && typeof body.serialized === 'string' && body.sha256 === hash(body.serialized), 'Pinned disposable project bytes/hash required');
    const project = JSON.parse(body.serialized);
    require(project.maps && project.tilesets && project.meta, 'Serialized project required');
    rejectSecrets(project);
    tables.set('projects', [{ project_id: PROJECT_ID, title: project.meta.title, current_json: project, current_sha256: body.sha256,
      map_count: Object.keys(project.maps).length, tileset_count: Object.keys(project.tilesets).length }]);
    tables.set('maps', Object.values(project.maps).map(map => ({ project_id: PROJECT_ID, map_id: map.id, map_json: map, tileset_id: map.tilesetId, width: map.width, height: map.height })));
    tables.set('tilesets', Object.values(project.tilesets).map(tileset => ({ project_id: PROJECT_ID, tileset_id: tileset.id, tileset_json: tileset })));
    initialized = true; emit('persistence-initialized', { sha256: body.sha256 }); return { projectId: PROJECT_ID, sha256: body.sha256 };
  }
  function configure(body) {
    require(Number.isInteger(body.failWrites) && body.failWrites >= 0, 'failWrites must be a nonnegative integer');
    require(body.blockWrites === undefined || typeof body.blockWrites === 'boolean', 'blockWrites must be boolean');
    failures = body.failWrites; blockWrites = body.blockWrites ?? false; return { failWrites: failures, blockWrites };
  }
  function request(method, url, body) {
    const table = url.pathname.slice('/supabase/rest/v1/'.length), params = url.searchParams;
    if (!initialized || !tables.has(table)) throw violation('persistence-uninitialized-or-route', { method, path: url.pathname });
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) throw violation('persistence-method', { method });
    const mutation = method !== 'GET', rows = Array.isArray(body) ? body : [body];
    const projectFilter = params.get('project_id');
    const ownsRow = row => table === 'project_changes'
      ? row?.entity_id === PROJECT_ID && tables.get('project_commits').some(commit => commit.commit_id === row.commit_id && commit.project_id === PROJECT_ID)
      : row?.project_id === PROJECT_ID;
    if ((method === 'POST' && rows.some(row => !ownsRow(row)))
      || (method !== 'POST' && projectFilter !== `eq.${PROJECT_ID}` && !(method === 'GET' && table === 'projects' && !projectFilter))) {
      throw violation('foreign-project', { method, table });
    }
    if (method === 'PATCH' && body.project_id !== PROJECT_ID) throw violation('foreign-project', { method, table });
    const filters = [...params].filter(([key]) => !['select', 'order', 'limit', 'on_conflict'].includes(key));
    for (const [key, value] of filters) require(['project_id', keys[table], 'current_sha256', ...(table === 'map_edit_locks' ? ['owner_session_id'] : []), ...(table === 'ai_activity_logs' ? ['run_id', 'channel'] : [])].includes(key) && (value.startsWith('eq.') || key === 'map_id' && value.startsWith('in.(') && value.endsWith(')')), 'Unsupported canonical query');
    const matches = row => filters.every(([key, value]) => value.startsWith('eq.') ? String(row[key]) === value.slice(3)
      : value.slice(4, -1).split(',').map(v => v.replace(/^"|"$/g, '').replace(/\\"/g, '"')).includes(row[key]));
    requests.push({ method, table, projectId: PROJECT_ID });
    if (mutation && table === 'projects' && (blockWrites || failures > 0)) { if (failures > 0) failures--; rejectedWrites++; emit('persistence-write-failed', { table }); throw fail('Controlled publication failure', 503); }
    const current = tables.get(table);
    if (method === 'GET') {
      reads++; emit('persistence-read', { table });
      let found = current.filter(matches);
      if (params.has('order')) {
        const [key, direction] = params.get('order').split('.');
        found = found.toSorted((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * (direction === 'desc' ? -1 : 1));
      }
      if (params.has('limit')) { require(/^\d+$/.test(params.get('limit')), 'Invalid limit'); found = found.slice(0, Number(params.get('limit'))); }
      return clone(found);
    }
    rejectSecrets(body);
    let result = [];
    if (method === 'DELETE') tables.set(table, current.filter(row => !matches(row)));
    if (method === 'PATCH') { result = current.filter(matches); for (const row of result) Object.assign(row, clone(body)); }
    if (method === 'POST') {
      for (const row of rows) {
        require(typeof row[keys[table]] === 'string', 'Row identity required');
        const prior = current.find(item => item[keys[table]] === row[keys[table]]);
        if (prior) Object.assign(prior, clone(row)); else current.push(clone(row));
      }
      result = rows;
    }
    writes++; emit('persistence-write', { table, method }); return clone(result);
  }
  function status() { return clone({ initialized, projectId: PROJECT_ID, reads, writes, rejectedWrites, failWrites: failures, blockWrites,
    requests, rowCounts: Object.fromEntries([...tables].map(([table, rows]) => [table, rows.length])), currentSha256: tables.get('projects')[0]?.current_sha256 ?? null }); }
  function snapshot() { return clone({ ...status(), tables: Object.fromEntries(tables) }); }
  return { initialize, configure, request, snapshot, status };
}
