#!/usr/bin/env node
// Package captured evidence without rewriting raw model responses or the remote project.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

const root = resolve('output/evidence/acceptance-live');
const labels = ['before', 'after', 'after-fence', 'final-coverage', 'generate', 'repair', 'repair-pricing'];
const runs = [];
for (const label of labels) {
  const path = resolve(root, label, 'session.json');
  const session = JSON.parse(await readFile(path, 'utf8'));
  const transport = JSON.parse(await readFile(resolve(root, label, 'transport.json'), 'utf8'));
  const models = transport.map(entry => {
    let returnedModel;
    try { returnedModel = JSON.parse(entry.body).model; } catch { returnedModel = null; }
    return { requestedModel: entry.requestedModel, returnedModel: returnedModel ?? null, status: entry.status };
  });
  runs.push({ label, prompt: session.prompt, config: session.config, models,
    declarationOutcomes: session.declarations.map(entry => entry.outcome), outcome: session.outcome,
    savedSha256: session.saved?.sha256 ?? null });
  if (label === 'generate') {
    let archived = false;
    try { await access(resolve(root, label, 'full-session.json.gz')); archived = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!archived) await pipeline(createReadStream(path), createGzip(), createWriteStream(resolve(root, label, 'full-session.json.gz'), { flags: 'wx' }));
  }
  // Retain every returned completion, all initial declaration/audit/planner inputs,
  // tool calls, outcomes and final acceptance. Only repeated context/snapshots and
  // duplicate project blobs are removed from this readable index.
  session.calls = session.calls.map((call, index) => ({ ...call, messages: index < 3 ? call.messages : undefined }));
  session.events = session.events.filter(event => event.type !== 'acceptance');
  if (session.saved) {
    delete session.saved.project;
    if (session.saved.flush) delete session.saved.flush.project;
  }
  session.packaging = 'Repeated model input context, acceptance snapshots and duplicate project blobs omitted; exact returned model responses remain in transport.json.';
  await writeFile(path, JSON.stringify(session, null, 2) + '\n');
  const receiptPath = resolve(root, label, 'save-receipt.json');
  try {
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    delete receipt.project;
    if (receipt.flush) delete receipt.flush.project;
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await writeFile(resolve(root, 'models-and-prompts.json'), JSON.stringify(runs, null, 2) + '\n');
const validation = resolve(root, 'validation');
await mkdir(validation, { recursive: true });
for (const name of ['request-coverage-red', 'request-coverage-fence-red', 'request-coverage-omitted-red', 'coverage-resume-red',
  'acceptance-live-final-tests', 'acceptance-live-serial-tests', 'acceptance-live-typecheck', 'acceptance-live-build-complete', 'acceptance-live-smoke', 'acceptance-live-check']) {
  // Normalize trailing whitespace only; retain every diagnostic and failure.
  const log = (await readFile(`/tmp/${name}.log`, 'utf8')).replace(/[ \t]+$/gm, '').trimEnd() + '\n';
  await writeFile(resolve(validation, `${name}.log`), log);
}
const bytes = await readFile(resolve(root, 'handoff/project.json'));
console.log(JSON.stringify({ runs: runs.length, canonicalFileSha256: createHash('sha256').update(bytes).digest('hex'), root }, null, 2));
