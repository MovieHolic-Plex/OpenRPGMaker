import { canonicalJson, requireValue, validateRef, sha256 } from './validation.mjs';
import { reportData } from '../../../src/ai/jobs/reportData.mjs';

export function reportEvidenceKey(job) {
  return sha256(Buffer.from(canonicalJson({ application: job.application, save: job.save,
    applicationEvidence: job.applicationEvidence, saveEvidence: job.saveEvidence })));
}
export function appliedReportBinding(job) {
  const empty = { status: 'not-applied', scope: null, noChanges: false, receiptId: null, hashScheme: null, artifact: null, reason: null };
  if (job.application !== 'applied') return empty;
  const { claim, receipt, artifact } = job.applicationEvidence ?? {};
  const evidence = receipt?.evidence;
  const scope = evidence?.scope;
  const scheme = scope === 'project' ? 'project-canonical-json-no-event-drafts-v1'
    : scope === 'draft' ? 'command-draft-canonical-json-v1' : null;
  const matches = scheme && job.resultRef && evidence.hashScheme === scheme && receipt.application === 'applied'
    && typeof receipt.receiptId === 'string' && typeof receipt.claimId === 'string'
    && claim?.claimId === receipt.claimId && (!claim.receiptId || claim.receiptId === receipt.receiptId)
    && canonicalJson(receipt.project ?? null) === canonicalJson(job.project)
    && canonicalJson(claim.project ?? null) === canonicalJson(job.project)
    && receipt.resultSha256 === job.resultRef.sha256 && claim.resultSha256 === job.resultRef.sha256
    && artifact?.receiptId === receipt.receiptId && artifact.resultSha256 === job.resultRef.sha256
    && canonicalJson(artifact.ref ?? null) === canonicalJson(evidence.appliedArtifact ?? null)
    && artifact.ref?.sha256 === evidence.appliedSnapshotSha256 && artifact.ref?.mediaType === 'application/json'
    && Number.isSafeInteger(artifact.ref.byteLength) && artifact.ref.byteLength >= 0;
  if (!matches) return { ...empty, status: 'unavailable', reason: 'Applied artifact does not match the receipt/result/hash scheme' };
  return { status: 'available', scope, noChanges: evidence.noChanges === true,
    receiptId: receipt.receiptId, hashScheme: scheme, artifact: artifact.ref, reason: null };
}
export function createReportShell(job, result, attemptId, previous, input, checkpoint) {
  const applied = appliedReportBinding(job);
  const sameSource = previous && canonicalJson(previous.result ?? null) === canonicalJson(job.resultRef)
    && canonicalJson(previous.checkpoint ?? null) === canonicalJson(job.checkpointRef ?? null);
  return { version: 1, kind: 'ai-job-report', jobId: job.id, family: job.family, project: job.project,
    source: result ? 'result' : checkpoint ? 'checkpoint' : 'input', checkpoint: job.checkpointRef ?? null,
    generationAttemptId: result?.attemptId ?? checkpoint?.attemptId ?? null, reportAttemptId: attemptId, input: job.inputRef, result: job.resultRef,
    baseSnapshot: result?.baseSnapshot ?? input.projectSnapshot, generatedSnapshot: result?.generatedSnapshot ?? null, previous: job.reportRef,
    evidenceKey: reportEvidenceKey(job), states: { generation: job.generation, application: job.application, save: job.save },
    applied, applicationEvidence: job.applicationEvidence, saveEvidence: job.saveEvidence,
    output: reportData(result?.payload ?? (checkpoint ? { stageKey: checkpoint.stageKey, retainedStage: checkpoint.state } : { request: input.payload })), usage: result?.payload.usage ?? null,
    sections: sameSource ? (previous.sections ?? []).filter(s => !s.phase.startsWith('applied') || applied.status === 'available' && s.snapshot.sha256 === applied.artifact.sha256) : [],
    artifacts: [...new Map([job.inputRef, job.resultRef, input.projectSnapshot, ...input.artwork, result?.generatedSnapshot,
      ...(result?.artifacts ?? []), job.checkpointRef, ...(checkpoint?.artifacts ?? []), ...(previous?.artifacts ?? []), job.reportRef]
      .filter(Boolean).map(ref => [ref.sha256, ref])).values()], failure: null };
}
export function validateReportDocument(document, shell, allowed) {
  requireValue(document?.kind === 'ai-job-report' && document.version === 1, 'Invalid report document');
  for (const key of ['jobId', 'family', 'project', 'generationAttemptId', 'reportAttemptId', 'input', 'result', 'baseSnapshot',
    'generatedSnapshot', 'source', 'checkpoint', 'evidenceKey', 'states', 'applied', 'applicationEvidence', 'saveEvidence', 'output', 'usage']) {
    requireValue(canonicalJson(document[key]) === canonicalJson(shell[key]), `Report changed its captured ${key}`);
  }
  requireValue(Array.isArray(document.sections) && Array.isArray(document.artifacts), 'Missing report sections/artifacts');
  const refs = [...document.artifacts];
  const ids = new Set();
  for (const section of document.sections) {
    requireValue(typeof section.id === 'string' && !ids.has(section.id) && Array.isArray(section.previews)
      && ['map', 'artwork', 'tileset', 'commands', 'quest', 'change'].includes(section.kind)
      && ['before', 'generated', 'applied', 'applied-draft', 'staged'].includes(section.phase), 'Invalid report section'); ids.add(section.id);
    if (section.phase === 'applied' || section.phase === 'applied-draft') {
      requireValue(shell.applied.status === 'available' && shell.applied.scope === (section.phase === 'applied' ? 'project' : 'draft')
        && canonicalJson(section.snapshot) === canonicalJson(shell.applied.artifact), 'Applied preview must use the exact receipt-bound artifact and scope');
    }
    if (section.phase === 'staged') requireValue(shell.source === 'checkpoint' && canonicalJson(section.snapshot) === canonicalJson(shell.checkpoint), 'Staged preview requires its checkpoint source');
    refs.push(section.snapshot);
    for (const preview of section.previews) {
      requireValue(['pending', 'ready', 'missing', 'unsupported', 'failed'].includes(preview.status), 'Invalid preview status');
      requireValue(preview.status !== 'ready' || preview.artifact, 'Ready preview needs an artifact');
      if (preview.source) refs.push(preview.source);
      if (preview.artifact) { refs.push(preview.artifact); requireValue(document.artifacts.some(r => canonicalJson(r) === canonicalJson(preview.artifact)), 'Preview missing from report manifest'); }
    }
  }
  for (const ref of refs) {
    validateRef(ref);
    requireValue(canonicalJson(allowed.get(ref.sha256) ?? null) === canonicalJson(ref), 'Report artifact is outside the attempt manifest');
  }
}
