import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { ViteNodeServer } from "vite-node/server";
import { ViteNodeRunner } from "vite-node/client";
import { startPlayerQaServer } from "./lib/runtimeQaRun.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = { flow: "both", case: "all", headed: false, out: "output/evidence/event-command-repairs/battle-flow" };
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (key === "--headed") args.headed = true;
  else if (["--flow", "--case", "--out"].includes(key)) args[key.slice(2)] = process.argv[++index];
  else if (key === "--scenario" && process.argv[++index] === "battle-flow") continue;
  else throw new Error(`Unknown argument: ${key}`);
}
assert(["both", "gauge", "strict"].includes(args.flow), "--flow must be both, gauge, or strict");
const out = resolve(ROOT, args.out);
await mkdir(out, { recursive: true });

async function buildFixtures() {
  const server = await createServer({ root: ROOT, configFile: false, logLevel: "error",
    resolve: { alias: { "@": join(ROOT, "src") } }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { watch: null, hmr: false },
  });
  try {
    await server.pluginContainer.buildStart({});
    const transform = new ViteNodeServer(server);
    const runner = new ViteNodeRunner({ root: ROOT, base: server.config.base,
      fetchModule: id => transform.fetchModule(id), resolveId: (id, importer) => transform.resolveId(id, importer),
    });
    const builder = await runner.executeFile(join(ROOT, "test/fixtures/battleEventRepairFlow.ts"));
    const io = await runner.executeFile(join(ROOT, "src/project/io.ts"));
    const refs = await runner.executeFile(join(ROOT, "src/project/io/references.ts"));
    assert(args.case === "all" || builder.BATTLE_FLOW_QA_CASES.includes(args.case), "Unknown --case");
    const cases = args.case === "all" ? builder.BATTLE_FLOW_QA_CASES : [args.case];
    const flows = args.flow === "both" ? ["gauge", "strict"] : [args.flow];
    const fixtures = [];
    for (const flow of flows) for (const scenario of cases) {
      const project = builder.buildBattleEventRepairFlowProject(flow, scenario);
      const wire = io.serialize(project);
      const loaded = io.deserialize(wire);
      refs.validateProjectReferences(loaded);
      assert.equal(loaded.system.battleFlow, flow);
      assert.equal(loaded.maps[loaded.startMapId].events[0].pages[0].commands[0].kind, "battleProcessing");
      const dir = join(out, flow, scenario); await mkdir(dir, { recursive: true });
      const path = join(dir, "project.json"); await writeFile(path, wire);
      fixtures.push({ flow, scenario, dir, path, sentinels: builder.BATTLE_FLOW_QA_SENTINELS });
    }
    return fixtures;
  } finally { await server.close(); }
}

// Observation-only browser helper. No engine methods, setters, route injection,
// clock overrides, synthetic DOM activation, or state mutation are used here.
function installObserver(boot) {
  window.__OPENRPG_BOOT__ = boot;
  const waits = new Map(); const events = []; let nextId = 0; let last = "";
  const get = selector => document.querySelector(selector);
  function snapshot() {
    const mirror = get("[data-testid='runtime-state-json']");
    const runtime = mirror?.textContent ? JSON.parse(mirror.textContent) : null;
    const root = get("[data-testid='battle-scene']");
    return {
      url: location.href, runtime,
      session: window.__oprnDebug?.readState() ?? null,
      phase: root?.dataset.battlePhase ?? null,
      busy: root?.dataset.battleSequenceBusy ?? null,
      cursor: root?.querySelector("[data-battle-command-cursor='true']")?.getAttribute("data-testid") ?? null,
      focus: document.activeElement?.getAttribute("data-testid") ?? null,
      prompt: get(".choice-prompt-row")?.textContent ?? "",
      dialogue: get("[data-testid='dialogue-box'] .body")?.textContent ?? "",
      director: get("[data-testid='battle-message-window']")?.textContent ?? "",
      result: get("[data-testid='battle-result-panel']")?.getAttribute("data-battle-result") ?? null,
      party: [...document.querySelectorAll(".battle-actor-status")].map(node => node.textContent),
      choices: [...document.querySelectorAll("[data-testid='runtime-choices'] [role='option']")].map(node => ({
        id: node.getAttribute("data-testid"), selected: node.getAttribute("aria-selected"), text: node.textContent,
      })),
    };
  }
  function matches(spec, state, event) {
    if (spec.keyUp && !(event?.type === "keyup" && event.key === spec.keyUp)) return false;
    if (spec.selector && !get(spec.selector)) return false;
    if (spec.visible) {
      const node = get(spec.visible);
      if (!node || node.getBoundingClientRect().width <= 0 || node.getBoundingClientRect().height <= 0) return false;
      let opacity = 1;
      for (let cursor = node; cursor; cursor = cursor.parentElement) {
        const style = getComputedStyle(cursor);
        if (style.display === "none" || style.visibility === "hidden") return false;
        opacity *= Number(style.opacity);
      }
      if (opacity < 0.9) return false;
    }
    if (spec.absent?.some(selector => get(selector))) return false;
    for (const field of ["phase", "busy", "cursor", "focus", "result"]) {
      if (spec[field] !== undefined && state[field] !== spec[field]) return false;
    }
    if (spec.prompt && !state.prompt.startsWith(spec.prompt)) return false;
    if (spec.dialogue && !state.dialogue.startsWith(spec.dialogue)) return false;
    if (spec.shown && get("[data-testid='dialogue-box']")?.dataset.dialoguePhase !== "shown") return false;
    if (spec.ready && !(state.runtime?.inputEnabled && !state.runtime.running)) return false;
    if (spec.x !== undefined && state.session?.x !== spec.x) return false;
    if (spec.y !== undefined && state.session?.y !== spec.y) return false;
    return true;
  }
  function check(event) {
    const state = snapshot();
    const signature = JSON.stringify({ phase: state.phase, busy: state.busy, cursor: state.cursor, focus: state.focus,
      prompt: state.prompt, dialogue: state.dialogue, director: state.director, result: state.result,
      party: state.party, choices: state.choices, position: [state.session?.x, state.session?.y] });
    if (signature !== last) {
      last = signature;
      events.push({ at: performance.now(), event: event?.type ?? "mutation", view: JSON.parse(signature) });
    }
    for (const wait of waits.values()) if (!wait.done && matches(wait.spec, state, event)) {
      wait.done = true; clearTimeout(wait.timer); wait.resolve(state);
    }
  }
  const observer = new MutationObserver(() => check());
  observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  const eventNames = ["keyup", "animationend", "transitionend", "loadeddata", "playing", "ended", "DOMContentLoaded"];
  for (const name of eventNames) document.addEventListener(name, check, true);
  window.__battleFlowQa = {
    snapshot,
    arm(spec) {
      const id = ++nextId;
      let settle;
      // A ticket carries its error until take() throws it. Registration can
      // precede driver input without an unhandled rejection or swallowed error.
      const promise = new Promise(resolveTicket => { settle = resolveTicket; });
      const wait = { spec, promise, resolve: state => settle({ state }), reject: error => settle({ error }), done: false, timer: null };
      wait.timer = setTimeout(() => {
        wait.done = true;
        wait.reject(new Error(`QA state deadline: ${JSON.stringify(spec)}; observed=${JSON.stringify(snapshot())}`));
      }, spec.timeoutMs ?? 45_000);
      waits.set(id, wait); check(); return id;
    },
    async take(id) {
      const wait = waits.get(id);
      if (!wait) throw new Error(`Unknown observer ticket ${id}`);
      try {
        const result = await wait.promise;
        if (result.error) throw result.error;
        return result.state;
      } finally { clearTimeout(wait.timer); waits.delete(id); }
    },
    dispose() {
      observer.disconnect();
      for (const name of eventNames) document.removeEventListener(name, check, true);
      const outstanding = [...waits.values()].filter(wait => !wait.done).length;
      for (const wait of waits.values()) { clearTimeout(wait.timer); if (!wait.done) wait.reject(new Error("QA observer disposed")); }
      waits.clear(); return { events, outstanding, disposed: true };
    },
  };
  // Register title observation before boot scripts execute, not after navigation.
  window.__battleFlowQa.titleTicket = window.__battleFlowQa.arm({ selector: "[data-testid='title-screen']", timeoutMs: 120_000 });
}

function numbers(text) {
  return Object.fromEntries([...text.matchAll(/\b([a-z])=(\d+)/g)].map(([, key, value]) => [key, Number(value)]));
}
const terminalCases = new Set(["game-over", "kill-player", "abort", "force-escape"]);
const reports = []; let server, browser;
const cleanup = { contexts: [], browserClosed: false, serverClosed: false };

async function exercise(fixture, pass) {
  const dir = join(fixture.dir, pass); await mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  const page = await context.newPage();
  const report = { flow: fixture.flow, scenario: fixture.scenario, pass, actions: [], observations: [], errors: [], warnings: [], requests: [], shots: [] };
  const snapshot = () => page.evaluate(() => window.__battleFlowQa.snapshot());
  async function shot(label) {
    await page.screenshot({ path: join(dir, `${label}.png`) }); report.shots.push(`${label}.png`);
  }
  async function capture(label) {
    if (label === "06-result") {
      const ticket = await page.evaluate(() => window.__battleFlowQa.arm({ visible: "[data-testid='battle-result-panel']" }));
      await page.evaluate(id => window.__battleFlowQa.take(id), ticket);
    }
    const observed = await snapshot(); report.observations.push({ label, observed }); await shot(label); return observed;
  }
  async function press(key, until) {
    const ticket = until ? await page.evaluate(spec => window.__battleFlowQa.arm(spec), until) : null;
    const action = { index: report.actions.length, key, until, before: await snapshot() };
    report.actions.push(action);
    await page.keyboard.press(key);
    action.after = ticket === null ? await snapshot() : await page.evaluate(id => window.__battleFlowQa.take(id), ticket);
    return action.after;
  }
  page.on("pageerror", error => report.errors.push(error.stack ?? error.message));
  page.on("console", message => {
    if (message.type() === "error") report.errors.push(message.text());
    else if (message.type() === "warning") report.warnings.push(message.text());
  });
  page.on("request", request => report.requests.push({ method: request.method(), url: request.url() }));
  try {
    // Proxy only the real local-server bytes through Playwright's request transport.
    // This isolates Chromium ERR_NETWORK_CHANGED without fabricating app responses.
    await page.route(url => url.origin === server.url, async route => {
      try {
        // Only connection-reset retries for idempotent local asset GETs; never retry a scenario.
        const method = route.request().method();
        await route.fulfill({ response: await route.fetch({ maxRetries: method === "GET" || method === "HEAD" ? 1 : 0 }) });
      } catch (error) {
        if (page.isClosed()) return;
        report.errors.push(`Local asset transport: ${error instanceof Error ? error.message : String(error)}`);
        try {
          await route.abort();
        } catch (abortError) {
          if (!page.isClosed()) report.errors.push(`Abort request: ${abortError instanceof Error ? abortError.message : String(abortError)}`);
        }
      }
    });
    await page.routeWebSocket(url => url.host === new URL(server.url).host, () => {});
    // The fixture is a real file served by Vite's permitted repository filesystem.
    // No request route is fulfilled with a fake runtime result or simulated effect.
    await page.addInitScript(installObserver, {
      projectUrl: `${server.url}/@fs${fixture.path}`, saveNamespace: `battle-flow-qa:${fixture.flow}:${fixture.scenario}`, qaInstrumentation: true,
    });
    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.__battleFlowQa.take(window.__battleFlowQa.titleTicket));
    await capture("00-title");
    await press("Enter", { ready: true, x: 8, y: 8, absent: ["[data-testid='title-screen']"] });
    const start = await capture("01-field");
    assert(Object.values(start.session.variables).every(value => value === 0), "new game starts with authored zero sentinels");
    assert.equal(await page.locator(".editor-topbar, [data-testid='editor-shell']").count(), 0);
    await press("Enter", { phase: "actorCommand", busy: "false", cursor: "actor-command-defend" });
    await capture("02-battle-command");
    const terminal = terminalCases.has(fixture.scenario);
    const expectedResult = ["game-over", "kill-player"].includes(fixture.scenario) ? "defeat" : "escape";
    await press("Enter", terminal
      ? { result: expectedResult, busy: "false" }
      : { prompt: "BF_PICK", shown: true, phase: "eventChoice" });
    if (!terminal) {
      const pick = await capture("03-choice-before-input");
      assert.deepEqual(numbers(pick.prompt), { f: 0, s: 0, c: 0, e: 1, t: 0 });
      assert(Object.values(pick.session.variables).every(value => value === 0), "battle has not written back before input");
      if (pass === "teardown-pending") { report.cancelledAtChoice = true; return report; }
      if (fixture.scenario === "cancel-option" || fixture.scenario === "cancel-branch") {
        await press("Escape", { prompt: "BF_DONE", shown: true });
      } else {
        const held = await press("Escape", { prompt: "BF_PICK", keyUp: "Escape", phase: "eventChoice" });
        assert.deepEqual(numbers(held.prompt), numbers(pick.prompt), "disallowed cancel leaves the authored choice pending");
        await press("ArrowDown", { focus: "runtime-choice-1" });
        await capture("04-second-option");
        await press(fixture.scenario === "choice-z" ? "z" : "Enter", { prompt: "BF_DONE", shown: true });
      }
      const done = await capture("05-nested-continuation");
      const cancelled = fixture.scenario === "cancel-branch";
      assert.deepEqual(numbers(done.prompt), { f: 0, s: cancelled ? 0 : 1, c: cancelled ? 1 : 0, p: 1, i: 1, o: 1, m: 1, n: 1 });
      await press("Enter", { result: "escape", busy: "false" });
    }
    await capture("06-result");
    await press("Enter", { dialogue: "BF_MAP", selector: "[data-testid='dialogue-box'].page-ready" });
    const returned = await capture("07-map-writeback");
    const values = fixture.sentinels.map((name, index) => [name, returned.session.variables[`var_${String(index + 1).padStart(4, "0")}`]]);
    const expected = [0, terminal || fixture.scenario === "cancel-branch" ? 0 : 1, fixture.scenario === "cancel-branch" ? 1 : 0,
      1, 1, 1, 1, terminal ? 0 : 1, terminal ? 0 : 1, terminal ? 0 : 1, terminal ? 0 : 1, terminal ? 0 : 1, 0, 1];
    assert.deepEqual(values.map(([, value]) => value), expected, "exact branch/caller/page/terminal/map sentinel counts");
    assert.equal(returned.session.battleResult, expectedResult);
    await press("Enter", { ready: true, absent: ["[data-testid='dialogue-box']", "[data-testid='battle-scene']"] });
    await press("ArrowRight", { x: 9, y: 8 });
    await capture("08-keyboard-restored");
    report.sentinels = Object.fromEntries(values);
  } catch (error) {
    report.errors.push(error.stack ?? String(error));
    try { await capture("failure"); } catch (captureError) { report.errors.push(`Failure capture: ${String(captureError)}`); }
  } finally {
    try { report.observer = await page.evaluate(() => window.__battleFlowQa?.dispose()); }
    catch (error) { report.errors.push(`Observer cleanup: ${String(error)}`); }
    const closed = new Promise(resolveClose => page.once("close", resolveClose));
    await context.close(); await closed;
    cleanup.contexts.push({ flow: fixture.flow, scenario: fixture.scenario, pass, closed: page.isClosed(), remainingPages: context.pages().length,
      observerDisposed: report.observer?.disposed === true, pendingObservers: report.observer?.outstanding ?? null });
    if (!report.observer?.disposed || report.observer.outstanding !== 0 || !page.isClosed() || context.pages().length !== 0) {
      report.errors.push("Incomplete observer/context cleanup; see cleanup receipt");
    }
    report.writeRequests = report.requests.filter(request => !["GET", "HEAD", "OPTIONS"].includes(request.method));
    if (report.writeRequests.length) report.errors.push("Unexpected network write requests; see writeRequests");
    await writeFile(join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    reports.push(report);
    console.log(`${report.errors.length ? "FAIL" : "PASS"} ${fixture.flow}/${fixture.scenario}/${pass}`);
  }
  return report;
}

try {
  const fixtures = await buildFixtures();
  server = await startPlayerQaServer();
  browser = await chromium.launch({ headless: !args.headed, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebRTC"] });
  for (const fixture of fixtures) {
    if (fixture.scenario === "teardown") await exercise(fixture, "teardown-pending");
    await exercise(fixture, fixture.scenario === "teardown" ? "restart" : "play");
  }
} catch (error) {
  reports.push({ errors: [error.stack ?? String(error)] });
} finally {
  if (browser) { await browser.close(); cleanup.browserClosed = !browser.isConnected(); }
  if (server) { await server.close(); cleanup.serverClosed = true; }
  const failed = reports.length === 0 || reports.some(report => report.errors.length > 0) || !cleanup.browserClosed || !cleanup.serverClosed;
  await writeFile(join(out, "cleanup.json"), `${JSON.stringify(cleanup, null, 2)}\n`);
  await writeFile(join(out, "summary.json"), `${JSON.stringify({ passed: !failed, reports: reports.map(report => ({ flow: report.flow,
    scenario: report.scenario, pass: report.pass, errors: report.errors, shots: report.shots })), cleanup }, null, 2)}\n`);
  await writeFile(join(out, "SUMMARY.md"), `# Shipping-player battle-flow QA\n\nResult: ${failed ? "FAIL" : "PASS"}\n\n` +
    "Real player.html/export shim; authored fixture boot; gameplay uses keyboard only. Read-only session/DOM observations; no runtime resumption calls or effect injection.\n\n" +
    "Screenshots and full action/observed-state logs are in each flow/case/play (or teardown-pending/restart) directory. Terminal cases are authored canLose=true so their zero-tail sentinels are observable after result write-back.\n\n" +
    "Teardown closes the entire browser context while a choice is open, then boots a new context and completes the battle. This does not claim in-document save/load teardown coverage. See cleanup.json.\n\n" +
    "Final acceptance requires supervisor direct execution; an agent debugging run is not supervisor acceptance.\n");
  process.exitCode = failed ? 1 : 0;
  console.log(`Evidence: ${out}/SUMMARY.md`);
}
