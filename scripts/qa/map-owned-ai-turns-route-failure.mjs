import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { once } from 'node:events';
import { createConnection, createServer } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firefox } from '@playwright/test';

// Run: QA_PORT=19850 EVIDENCE_DIR=output/evidence/map-owned-overlays/cleanup/baseline-red
//      xvfb-run -a node scripts/qa/map-owned-ai-turns-route-failure.mjs
// EVIDENCE_DIR must not exist: stale subject artifacts must never satisfy this probe.
// Derived from the reviewer's real Firefox/Vite wrapper; no subject source mutation.
const root = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.env.QA_PORT ?? 19850);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, process.env.EVIDENCE_DIR ?? 'output/evidence/map-owned-overlays/cleanup/route-failure');
const sentinel = 'REVIEW_INJECTED_ROUTE_FAILURE';

async function bounded(promise, label, milliseconds = 30000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout: ${label}`)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
async function verifyFree() {
  const probe = createServer();
  await new Promise((yes, no) => { probe.once('error', no); probe.listen(port, '127.0.0.1', yes); });
  await new Promise((yes, no) => probe.close(error => error ? no(error) : yes()));
}
async function listenerAccepts() {
  const socket = createConnection({ host: '127.0.0.1', port });
  try {
    await bounded(once(socket, 'connect'), 'listener connection');
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') return false;
    throw error;
  } finally { socket.destroy(); }
}
async function optionalFile(name) {
  try { return await readFile(resolve(out, name), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

if (process.argv[2] !== '--subject') {
  await mkdir(dirname(out), { recursive: true });
  await mkdir(out);
  await verifyFree();
  console.log(`PROBE port verified free: ${base}; fresh evidence: ${out}`);
  const child = childProcess.spawn(process.execPath, [fileURLToPath(import.meta.url), '--subject'], {
    cwd: root, env: { ...process.env, QA_PORT: String(port), EVIDENCE_DIR: out },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let transcript = '';
  let observation;
  let externalCleanup;
  child.on('message', message => {
    if (message.type === 'observation') observation = message;
    if (message.type === 'external-cleanup') externalCleanup = message;
  });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    transcript += chunk.toString();
    process.stdout.write(chunk);
  });
  const [code, signal] = await once(child, 'close');
  await writeFile(resolve(out, 'subject.log'), transcript);
  const checks = {
    subjectExitOne: code === 1 && signal === null,
    ...observation?.checks,
    observationRecorded: !!observation,
    externalCleanupVerified: externalCleanup?.portFree === true,
  };
  const report = { subjectExitCode: code, subjectSignal: signal, observation, externalCleanup, checks,
    result: Object.values(checks).every(Boolean) ? 'PASS' : 'RED' };
  await writeFile(resolve(out, 'probe.json'), JSON.stringify(report, null, 2));
  console.log('REGRESSION_RESULT', JSON.stringify(report));
  assert.equal(report.result, 'PASS', `Failed checks: ${Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name).join(', ')}`);
} else {
  const ownedBrowsers = [];
  const ownedServers = [];
  let injections = 0;
  const realSpawn = childProcess.spawn;
  childProcess.spawn = function(command, args, options) {
    const child = realSpawn.call(this, command, args, options);
    if (args?.[0] === 'node_modules/vite/bin/vite.js' && options?.cwd === root && options.detached) {
      ownedServers.push(child);
    }
    return child;
  };
  syncBuiltinESMExports();
  const launch = firefox.launch.bind(firefox);
  firefox.launch = async options => {
    const browser = await launch(options); // Playwright owns a disposable profile.
    ownedBrowsers.push(browser);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async options => {
      const context = await newContext(options);
      const newPage = context.newPage.bind(context);
      context.newPage = async () => {
        const page = await newPage();
        const addRoute = page.route.bind(page);
        page.route = (match, handler, options) => addRoute(match, async route => {
          const fulfill = route.fulfill.bind(route);
          route.fulfill = async options => {
            const reply = JSON.parse(options.body);
            const call = reply.choices?.[0]?.message?.tool_calls?.[0]?.function;
            if (!injections && call?.name === 'clear_region' && JSON.parse(call.arguments).x === 3) {
              injections++;
              console.log('REVIEW_INJECT: one route.fulfill failure at first real spatial response');
              throw new Error(sentinel);
            }
            return fulfill(options);
          };
          return handler(route);
        }, options);
        return page;
      };
      return context;
    };
    return browser;
  };
  let rejected;
  try {
    try { await import('./map-owned-ai-turns.mjs'); }
    catch (error) {
      rejected = error;
      console.error('SUBJECT_REJECTION', error.stack);
      // Same nonzero outcome as an uncaught entry-point rejection, but retain
      // handles long enough to observe leaks and clean only our own resources.
      process.exitCode ||= 1;
    }
    const actionsText = await optionalFile('actions.json');
    const serverLog = await optionalFile('server.log');
    const actions = actionsText === null ? null : JSON.parse(actionsText);
    const browserStillConnected = ownedBrowsers.some(browser => browser.isConnected());
    const serverStillRunning = ownedServers.some(server => server.exitCode === null && server.signalCode === null);
    const listenerStillAccepts = await listenerAccepts();
    const checks = {
      injectedExactlyOnce: injections === 1,
      realResourcesObserved: ownedBrowsers.length === 1 && ownedServers.length === 1,
      subjectFailurePreserved: Number(process.exitCode) === 1,
      originalRouteErrorPreserved: rejected?.message === sentinel || actions?.routeErrors?.includes(sentinel) === true,
      browserClosed: !browserStillConnected,
      ownedServerStopped: !serverStillRunning,
      listenerClosed: !listenerStillAccepts,
      actionsWritten: actions !== null,
      failureRecorded: actions?.log?.some(entry => entry.type === 'FAIL') === true,
      serverLogWritten: serverLog?.includes(base) === true,
    };
    const observation = { type: 'observation', injections, rejected: rejected?.message ?? null,
      subjectExitCode: process.exitCode ?? 0, browserStillConnected, serverStillRunning,
      listenerStillAccepts, ownedServerPids: ownedServers.map(server => server.pid), checks };
    // This snapshot and RED verdict precede every external close/kill below.
    await writeFile(resolve(out, 'before-external-cleanup.json'), JSON.stringify(observation, null, 2));
    console.log('BEFORE_EXTERNAL_CLEANUP', JSON.stringify(observation));
    console.log('CLEANUP_ASSERTIONS', Object.values(checks).every(Boolean) ? 'PASS' : 'RED');
    process.send(observation);
  } finally {
    // Never find/kill by port: use only handles returned by this subject's launch.
    childProcess.spawn = realSpawn;
    syncBuiltinESMExports();
    firefox.launch = launch;
    for (const browser of ownedBrowsers) {
      if (browser.isConnected()) await bounded(browser.close(), 'external Firefox cleanup');
    }
    for (const server of ownedServers) {
      if (server.exitCode !== null || server.signalCode !== null) continue;
      const stopped = once(server, 'exit');
      process.kill(-server.pid, 'SIGTERM');
      await bounded(stopped, 'external owned Vite cleanup');
    }
    await verifyFree();
    const externalCleanup = { type: 'external-cleanup', portFree: true, base,
      browsersDisconnected: ownedBrowsers.every(browser => !browser.isConnected()),
      ownedServersStopped: ownedServers.every(server => server.exitCode !== null || server.signalCode !== null) };
    console.log('EXTERNAL_CLEANUP', JSON.stringify(externalCleanup));
    process.send(externalCleanup);
    process.disconnect();
  }
}
