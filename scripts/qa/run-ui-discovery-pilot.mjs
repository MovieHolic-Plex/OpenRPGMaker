import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDiscoveryPilot, discoveryTasks } from './ui-discovery-pilot.mjs';

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Usage: node scripts/qa/run-ui-discovery-pilot.mjs before|after');
const cli = process.env.UI_DISCOVERY_CLI;
if (!cli) throw new Error('UI_DISCOVERY_CLI must name the installed Senpi dist/cli.js (not the OmO wrapper)');
const output = path.resolve(process.env.UI_DISCOVERY_OUTPUT ?? 'output/evidence/ui-discovery-v2');
const scratch = await mkdtemp(path.join(os.tmpdir(), 'ui-discovery-agents-'));
const pilot = await createDiscoveryPilot({
  baseUrl: process.env.UI_DISCOVERY_URL ?? 'http://127.0.0.1:9867',
  output,
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
});
const system = `You are an independent first-time user in a screenshot-only UI experiment.
Use only attached screenshots and the task instruction. You have no tools, source,
DOM, accessibility tree, prior sessions or other subjects. Choose ONE input action
for the visible 1440x900 screen. Return a single JSON object, no Markdown:
{"type":"click","x":100,"y":100}; {"type":"doubleClick","x":100,"y":100};
{"type":"hover","x":100,"y":100}; {"type":"drag","x":100,"y":100,"toX":200,"toY":100,"button":"left"};
{"type":"key","key":"Escape"}; {"type":"text","text":"..."}; {"type":"scroll","deltaX":0,"deltaY":100};
{"type":"done","success":true,"reason":"visible evidence"}.
The drag button may be left, middle or right. Key chords use Playwright syntax.
Do not guess at invisible controls. Stop when the task is visibly achieved or you
cannot proceed. Maximum 15 inputs and 240 seconds. Your actions execute in a real
browser, and the resulting screenshot is returned. Do not modify map content.`;

async function decide(session, image, prompt, remainingMs, transcript) {
  const args = ['--no-extensions', '--no-skills', '--no-context-files', '--no-tools',
    '--model', 'opencodex/gpt-6-astra:high', '--system-prompt', system,
    '--session', session, '--print', prompt, `@${image}`];
  const child = spawn('bun', [cli, ...args], { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks = [], errors = [];
  child.stdout.on('data', data => chunks.push(data));
  child.stderr.on('data', data => errors.push(data));
  let expired = false;
  const timer = setTimeout(() => { expired = true; child.kill('SIGTERM'); }, remainingMs);
  let code;
  try {
    code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
  } finally {
    clearTimeout(timer);
  }
  const stdout = Buffer.concat(chunks).toString();
  const stderr = Buffer.concat(errors).toString();
  await writeFile(transcript, JSON.stringify({ code, expired, stdout, stderr }, null, 2));
  if (expired) throw new Error('Subject time budget exhausted');
  if (code !== 0) throw new Error(`Subject process failed: ${code}; see ${transcript}`);
  return JSON.parse(stdout.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
}

const results = [];
try {
  for (const task of Object.keys(discoveryTasks)) {
    const trial = await pilot.prepare(phase, task);
    const directory = path.join(output, phase, task);
    const started = performance.now();
    let image = trial.image;
    let claim;
    let failure;
    console.log(`TRIAL START ${phase} ${task}`);
    try {
      for (let step = 0; step <= 15; step++) {
        const remaining = 240000 - (performance.now() - started);
        if (remaining <= 0) throw new Error('Subject time budget exhausted');
        const action = await decide(path.join(scratch, `${task}.jsonl`), image,
          step === 0 ? `Task: ${trial.instruction}` : 'Here is the resulting screen. Return your next single action or done.',
          remaining, path.join(directory, `subject-${String(step).padStart(2, '0')}.json`));
        console.log(`ACTION ${phase} ${task} ${JSON.stringify(action)}`);
        if (action.type === 'done') { claim = action; break; }
        if (step === 15) throw new Error('Subject input budget exhausted');
        image = (await pilot.act(trial.id, action)).image;
      }
    } catch (error) {
      failure = String(error);
      console.log(`TRIAL FAILURE ${phase} ${task} ${failure}`);
    } finally {
      const result = await pilot.finish(trial.id);
      results.push({ task, claim, failure, elapsedMs: performance.now() - started, ...result });
      await writeFile(path.join(output, phase, 'results.json'), JSON.stringify(results, null, 2));
      console.log(`TRIAL END ${phase} ${task} inputs=${result.inputs} claimed=${claim?.success ?? false}`);
    }
  }
} finally {
  await pilot.close();
  await rm(scratch, { recursive: true, force: true });
  await mkdir(path.join(output, phase), { recursive: true });
  await writeFile(path.join(output, phase, 'runner-cleanup.json'), JSON.stringify({ browserClosed: true, scratchRemoved: scratch }));
  console.log(`CLEANUP ${phase} browser closed; scratch removed`);
}
