import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runGenreTrial } from './genreExperiment.mjs';
const argv = process.argv.slice(2);
const option = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const root = option('out'), caseId = option('case');
if (!root || !caseId) throw Error('genreEntry --out <experiment root> --case <genre>');
const result = await runGenreTrial(resolve(root), caseId, {
  attempt: Number(option('attempt') ?? '1'),
  ...(option('prompt-file') ? { prompt: readFileSync(resolve(option('prompt-file')), 'utf8') } : {}),
  ...(option('input-mode') ? { inputMode: option('input-mode') } : {}),
});
console.log(JSON.stringify({ caseId, attempt: result.attempt, completedMeasurement: result.completedMeasurement,
  realNativeRun: result.realNativeRun, modelDone: result.modelDone, failure: result.failure,
  persistence: result.persistence, outputDir: result.outputDir }));
process.exitCode = result.completedMeasurement ? 0 : 1;
