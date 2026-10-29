#!/usr/bin/env node
// Run one lane of hig-ux devices against a build and check the expectation.
//   node scripts/qa/hig-ux/run.mjs --lane selftest --base-url http://127.0.0.1:9881 --expect pass
//   node scripts/qa/hig-ux/run.mjs --lane selftest --fixture planted-defects --expect fail
// A lane module (devices/<lane>.mjs) exports `surfaces` ({id: {width,height,lang,dsf,steps}})
// and `devices` ([{id, surface, run({page, surface, log, lib, probes}) => {pass, measured}}]).
// Each surface gets a fresh browser context; its devices run in declared order.
// --expect pass: every device passes; fail: every device fails with a measurement (no errors);
// any: record only. Exit 1 when the expectation is not met, 2 on usage errors.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as lib from './lib.mjs';
import * as probes from './probes.mjs';
import { fixtureDir, serveDir } from './serve-baseline.mjs';

const USAGE =
  'usage: run.mjs --lane <name> (--base-url <url> | --fixture <name>) [--expect pass|fail|any] [--todo <n>] [--out <file>] [--only id,id] [--headed]';

function hasMeasuredNumber(measured) {
  if (!measured || typeof measured !== 'object') return false;
  return Object.values(measured).some((v) => typeof v === 'number' && Number.isFinite(v));
}

function verdictOk(expect, results) {
  if (expect === 'any') return true;
  if (!results.length) return false;
  if (expect === 'pass') return results.every((r) => r.pass === true && !r.error);
  return results.every((r) => r.pass === false && !r.error);
}

async function main() {
  let args;
  try {
    args = lib.parseArgs(process.argv.slice(2), {
      lane: 'str', todo: 'str', 'base-url': 'str', fixture: 'str', expect: 'str', out: 'str', only: 'str', headed: 'bool',
    });
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`);
    return 2;
  }
  const expect = args.expect ?? 'pass';
  if (!args.lane || !['pass', 'fail', 'any'].includes(expect) || !args['base-url'] === !args.fixture) {
    console.error(USAGE);
    return 2;
  }
  const laneFile = path.join(lib.HERE, 'devices', `${args.lane}.mjs`);
  if (!fs.existsSync(laneFile)) {
    console.error(`no lane module ${laneFile}`);
    return 2;
  }
  const lane = await import(pathToFileURL(laneFile).href);
  const only = (args.only ?? '').split(',').filter(Boolean);
  const devices = lane.devices.filter((d) => !only.length || only.includes(d.id));

  let fixtureServer = null;
  let baseUrl = args['base-url'];
  if (args.fixture) {
    const served = await serveDir(fixtureDir(args.fixture));
    fixtureServer = served.server;
    baseUrl = served.url;
  }

  const startedAt = new Date().toISOString();
  const results = [];
  const surfaceLogs = {};
  const groups = new Map();
  for (const d of devices) {
    if (!lane.surfaces[d.surface]) throw new Error(`device ${d.id} names unknown surface ${d.surface}`);
    if (!groups.has(d.surface)) groups.set(d.surface, []);
    groups.get(d.surface).push(d);
  }

  const browser = await lib.launchBrowser({ headed: !!args.headed });
  try {
    for (const [surfaceId, group] of groups) {
      const surface = { id: surfaceId, width: 1440, height: 900, lang: 'ko', dsf: 1, ...lane.surfaces[surfaceId] };
      const key = lib.surfaceKey(surface);
      let opened = null;
      try {
        opened = await lib.openSurface(browser, baseUrl, surface);
        await lib.runSteps(opened.page, surface.steps ?? [], { lang: surface.lang, log: opened.log });
      } catch (e) {
        for (const d of group) results.push({ id: d.id, surface: key, pass: false, measured: {}, error: `surface open failed: ${String(e.message).split('\n')[0]}` });
        if (opened) await opened.ctx.close();
        continue;
      }
      surfaceLogs[key] = opened.log;
      for (const d of group) {
        const t0 = Date.now();
        const rec = { id: d.id, surface: key, title: d.title ?? '' };
        if (opened.log.stepErrors.length) {
          Object.assign(rec, { pass: false, measured: {}, error: `surface steps failed: ${opened.log.stepErrors.join(' | ')}` });
        } else {
          try {
            const r = await d.run({ page: opened.page, surface, log: opened.log, lib, probes });
            if (typeof r?.pass !== 'boolean' || !hasMeasuredNumber(r.measured)) {
              Object.assign(rec, { pass: false, measured: r?.measured ?? {}, error: 'device returned no boolean pass or no measured number' });
            } else {
              Object.assign(rec, { pass: r.pass, measured: r.measured });
            }
          } catch (e) {
            Object.assign(rec, { pass: false, measured: {}, error: String(e.message).split('\n')[0].slice(0, 240) });
          }
        }
        rec.ms = Date.now() - t0;
        results.push(rec);
        const tag = rec.error ? 'ERROR' : rec.pass ? 'pass ' : 'FAIL ';
        console.log(`${tag} ${rec.id} ${JSON.stringify(rec.error ?? summarize(rec.measured))}`);
      }
      await opened.ctx.close();
    }
  } finally {
    await browser.close();
    fixtureServer?.close();
  }

  const expectationMet = verdictOk(expect, results);
  const report = {
    lane: args.lane,
    todo: args.todo ?? null,
    baseUrl,
    fixture: args.fixture ?? null,
    expect,
    startedAt,
    finishedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((r) => r.pass && !r.error).length,
      failed: results.filter((r) => !r.pass && !r.error).length,
      errored: results.filter((r) => r.error).length,
    },
    expectationMet,
    results,
    surfaceLogs,
  };
  const out = args.out ?? path.join(lib.REPO_ROOT, '.vite-cache/hig-ux-evidence', `${args.lane}${args.fixture ? `-${args.fixture}` : ''}.json`);
  lib.writeJson(out, report);
  console.log(`${expectationMet ? 'EXPECTATION MET' : 'EXPECTATION NOT MET'} (expect ${expect}) ${JSON.stringify(report.summary)} -> ${out}`);
  return expectationMet ? 0 : 1;
}

function summarize(measured) {
  return Object.fromEntries(Object.entries(measured).filter(([, v]) => typeof v !== 'object'));
}

process.exitCode = await main();
