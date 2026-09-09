import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Agent, get } from "node:http";
import path from "node:path";
import { startPlayerQaServer, writeReport } from "../../../scripts/lib/runtimeQaRun.mjs";

const projectPath = path.resolve(process.env.QA_PROJECT_FILE ?? "output/evidence/live-world-qa/connected-project.json");
const json = readFileSync(projectPath, "utf8");
const authored = JSON.parse(json);
const names = ["남쪽항구", "초원마을", "숲속마을", "호수쉼터", "산길초소", "황야유적", "설원마을", "습지연구소"];
const out = path.resolve("output/evidence/live-world-qa/runtime-" + (process.env.QA_ATTEMPT ?? "initial"));
mkdirSync(out, { recursive: true });
const report = {
  scenarioId: "live-world-landmark-walk", projectPath,
  projectSha256: createHash("sha256").update(json).digest("hex"),
  seed: "authored", viewport: { width: 1024, height: 768 }, beats: [], errors: [],
  arrivals: [], cleanup: {},
};
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-features=LocalNetworkAccessChecks", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: report.viewport });
const page = await context.newPage();
page.on("crash", () => {
  report.errors.push("Renderer crashed");
  void browser.close().catch(error => report.errors.push(error.message));
});
const relay = new Agent({ keepAlive: false, maxSockets: 12 });
page.on("pageerror", error => report.errors.push(error.message));
page.on("requestfailed", request => report.errors.push(`${request.url()}: ${request.failure()?.errorText ?? "request failed"}`));

async function capture(id, note, observed, failures = []) {
  const shot = `${String(report.beats.length).padStart(2, "0")}-${id}.png`;
  await page.screenshot({ path: path.join(out, shot) });
  report.beats.push({ id, note, observed, failures, shot });
}

try {
  await page.route(`${server.url}/**`, async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET" || !(url.pathname === "/player.html" || /^\/(src|assets|@vite|@id|@fs|node_modules)\//.test(url.pathname))) return route.fallback();
    const response = await new Promise((resolve, reject) => {
      const outgoing = get(url, { agent: relay }, incoming => {
        const chunks = [];
        incoming.on("data", chunk => chunks.push(chunk));
        incoming.once("error", reject);
        incoming.once("end", () => resolve({
          status: incoming.statusCode ?? 502,
          headers: Object.fromEntries(Object.entries(incoming.headers).filter(([, value]) => typeof value === "string")),
          body: Buffer.concat(chunks),
        }));
      });
      outgoing.once("error", reject);
      outgoing.setTimeout(120_000, () => outgoing.destroy(new Error(`Runtime static GET deadline: ${url.pathname}`)));
    });
    await route.fulfill(response);
  });
  const world = authored.maps[authored.startMapId];
  if (!world || world.width !== 128 || world.height !== 128) throw new Error("Authored start world is not 128x128");
  const targets = process.env.QA_TARGETS_FILE ? JSON.parse(readFileSync(process.env.QA_TARGETS_FILE, "utf8")) : names.map(name => {
    const matches = world.events.filter(event => event.name === `${name} 안내판`);
    if (matches.length !== 1) throw new Error(`Expected one unambiguous authored guide for ${name}; got ${matches.length}`);
    return { name, eventId: matches[0].id };
  });
  if (targets.length !== names.length || new Set(targets.map(target => target.eventId)).size !== names.length
    || names.some(name => !targets.some(target => target.name === name))
    || targets.some(target => !world.events.some(event => event.id === target.eventId))) {
    throw new Error("Landmark targets must identify eight distinct authored guide events");
  }
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = {
      projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:live-world", qaInstrumentation: true,
    };
    window.__worldTitleReady = new Promise((resolve, reject) => {
      const finish = () => { observer.disconnect(); clearTimeout(timer); };
      const check = () => {
        if (document.querySelector("[data-testid=title-screen]")) { finish(); resolve(); }
      };
      const observer = new MutationObserver(check);
      const timer = setTimeout(() => { finish(); reject(new Error("Title did not mount")); }, 180_000);
      observer.observe(document, { childList: true, subtree: true });
      check();
    });
  });
  await page.route("**/__runtime-qa/project.json", route => route.fulfill({ contentType: "application/json", body: json }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.evaluate(() => window.__worldTitleReady);
  const preflight = await page.evaluate(async () => {
    const storePath = "/src/player/exportProjectStoreShim.ts";
    const preflightPath = "/src/project/playPreflight.ts";
    const { store } = await import(storePath);
    const { preflightProjectForPlay } = await import(preflightPath);
    const { resolvePlayerBody } = await import("/src/project/playerFootprint.ts");
    const { footprintSpriteX, characterSpriteY } = await import("/src/player/characterDepth.ts");
    const project = store.getCurrent();
    const result = preflightProjectForPlay(project);
    return {
      repairs: result.repairs, blockers: result.blockers,
      startPixel: { x: footprintSpriteX(project.startPos.x, resolvePlayerBody(project).footprint), y: characterSpriteY(project.startPos.y) },
    };
  });
  report.preflight = preflight;
  if (preflight.repairs.length || preflight.blockers.length) throw new Error("Authored project requires preflight repair; not accepting a relocated/repaired start");
  const ready = await page.evaluateHandle(() => ({
    promise: new Promise((resolve, reject) => {
      const finish = () => { observer.disconnect(); clearTimeout(timer); };
      const check = () => {
        const mirror = document.querySelector("[data-testid=runtime-state-json]");
        if (!mirror || !window.__oprnDebug || !window.__oprnPlayerSprite) return;
        const state = JSON.parse(mirror.textContent);
        if (state.inputEnabled && !state.running && window.__oprnPlayerSprite()) { finish(); resolve(); }
      };
      const observer = new MutationObserver(check);
      const timer = setTimeout(() => { finish(); reject(new Error("Player did not become ready")); }, 180_000);
      observer.observe(document, { childList: true, characterData: true, subtree: true });
      check();
    }),
  }));
  await page.keyboard.press("Enter");
  await ready.evaluate(value => value.promise);
  await ready.dispose();
  const start = await page.evaluate(() => ({
    state: window.__oprnDebug.readState(),
    mirror: JSON.parse(document.querySelector("[data-testid=runtime-state-json]").textContent),
    sprite: window.__oprnPlayerSprite(),
  }));
  const startFailures = [];
  if (start.state.currentMapId !== authored.startMapId || start.state.x !== authored.startPos.x || start.state.y !== authored.startPos.y) {
    startFailures.push("Runtime start differs from authored start");
  }
  if (!start.sprite?.textureKey || start.sprite.textureKey === "__MISSING"
    || start.sprite.x !== preflight.startPixel.x || start.sprite.y !== preflight.startPixel.y) {
    startFailures.push("Rendered player does not match the authored start");
  }
  for (const [id, event] of Object.entries(start.mirror.events ?? {})) {
    const r = event.passRect;
    if (event.priority === "same" && r && start.state.x >= r.left && start.state.x <= r.right
      && start.state.y >= r.top && start.state.y <= r.bottom) startFailures.push(`Authored start overlaps blocking event ${id}`);
  }
  await capture("start", "저작된 시작 위치", start, startFailures);
  if (startFailures.length) throw new Error(startFailures.join("; "));

  for (const target of targets) {
    // Candidate route uses real collision and current rendered event rectangles.
    // The actual input/arrival loop below is the authority, not the BFS alone.
    const route = await page.evaluate(async ({ eventId }) => {
      const { store } = await import("/src/player/exportProjectStoreShim.ts");
      const { canMoveFootprint } = await import("/src/project/collision.ts");
      const { resolvePlayerBody, playerPassageRect } = await import("/src/project/playerFootprint.ts");
      const { footprintSpriteX, characterSpriteY } = await import("/src/player/characterDepth.ts");
      const project = store.getCurrent(), state = window.__oprnDebug.readState();
      const mirror = JSON.parse(document.querySelector("[data-testid=runtime-state-json]").textContent);
      const map = project.maps[state.currentMapId], guide = mirror.events[eventId];
      if (!guide) throw new Error("Guide is not active in the current map");
      const body = resolvePlayerBody(project);
      const solid = Object.values(mirror.events).filter(event => event.priority === "same" && event.passRect).map(event => event.passRect);
      const blocked = (x, y) => {
        const r = playerPassageRect(body, x, y);
        return solid.some(e => r.left <= e.right && r.right >= e.left && r.top <= e.bottom && r.bottom >= e.top);
      };
      const key = (x, y) => `${x},${y}`;
      const startKey = key(state.x, state.y);
      const queue = [{ x: state.x, y: state.y }], previous = new Map([[startKey, null]]);
      let destination;
      for (let index = 0; index < queue.length; index += 1) {
        const cell = queue[index];
        if (Math.abs(cell.x - guide.x) + Math.abs(cell.y - guide.y) === 1) { destination = cell; break; }
        for (const [dx, dy, dir] of [[1, 0, "right"], [0, 1, "down"], [-1, 0, "left"], [0, -1, "up"]]) {
          const x = cell.x + dx, y = cell.y + dy, next = key(x, y);
          if (previous.has(next) || blocked(x, y) || !canMoveFootprint(project, map, cell.x, cell.y, body.footprint, x, y, body.passRows)) continue;
          previous.set(next, { x: cell.x, y: cell.y, dir });
          queue.push({ x, y });
        }
      }
      if (!destination) throw new Error(`No candidate route to guide ${eventId}`);
      const steps = [];
      for (let cell = destination; key(cell.x, cell.y) !== startKey;) {
        const parent = previous.get(key(cell.x, cell.y));
        if (!parent) throw new Error("Broken route predecessor");
        steps.push({
          x: cell.x, y: cell.y, dir: parent.dir, mapId: state.currentMapId,
          pixelX: footprintSpriteX(cell.x, body.footprint), pixelY: characterSpriteY(cell.y),
        });
        cell = parent;
      }
      return { steps: steps.reverse(), guide, destination };
    }, target);
    for (const expected of route.steps) {
      report.pendingStep = expected;
      const observed = await page.evaluate(({ expected }) => new Promise((resolve, reject) => {
        const mirror = document.querySelector("[data-testid=runtime-state-json]");
        const before = window.__oprnDebug.readState();
        const sprite = window.__oprnPlayerSprite();
        if (!mirror || !sprite || sprite.moving || Math.abs(expected.x - before.x) + Math.abs(expected.y - before.y) !== 1) {
          reject(new Error("Invalid one-tile movement premise")); return;
        }
        let inputFrame = 0;
        const cleanup = () => { observer.disconnect(); cancelAnimationFrame(inputFrame); clearTimeout(timer); window.__oprnInput.dir(null); };
        const fail = message => { cleanup(); reject(new Error(message)); };
        const observer = new MutationObserver(() => {
          const state = window.__oprnDebug.readState();
          const rendered = window.__oprnPlayerSprite();
          if (state.currentMapId !== expected.mapId) { fail("Unexpected map transfer"); return; }
          if (state.x === before.x && state.y === before.y) return;
          if (state.x !== expected.x || state.y !== expected.y) { fail("Unexpected arrival tile"); return; }
          if (!rendered || rendered.moving) return;
          const actual = JSON.parse(mirror.textContent);
          if (actual.player.x !== expected.x || actual.player.y !== expected.y) { fail("Scene/session position mismatch"); return; }
          if (!rendered.textureKey || rendered.textureKey === "__MISSING"
            || rendered.x !== expected.pixelX || rendered.y !== expected.pixelY) { fail("Rendered player arrival mismatch"); return; }
          cleanup(); resolve({ expected, actual: { x: state.x, y: state.y, mapId: state.currentMapId }, sprite: rendered });
        });
        const timer = setTimeout(() => fail("Real walking step blocked or did not finish"), 8000);
        observer.observe(mirror, { childList: true, characterData: true, subtree: true });
        // Queue one tap after the previous engine frame has finished consuming input.
        inputFrame = requestAnimationFrame(() => {
          window.__oprnInput.dir(expected.dir);
          window.__oprnInput.dir(null);
        });
      }), { expected });
      appendFileSync(path.join(out, "steps.jsonl"), JSON.stringify(observed) + "\n");
      delete report.pendingStep;
    }
    const arrived = await page.evaluate(() => ({ state: window.__oprnDebug.readState(), sprite: window.__oprnPlayerSprite() }));
    if (arrived.state.x !== route.destination.x || arrived.state.y !== route.destination.y) throw new Error("Landmark arrival mismatch");
    report.arrivals.push({ ...target, steps: route.steps.length, position: route.destination });
    await capture(`landmark-${report.arrivals.length}`, target.name, { ...arrived, target, guide: route.guide });
    console.log("ARRIVED", JSON.stringify(report.arrivals.at(-1)));
  }
  if (report.arrivals.length !== 8) throw new Error("Not all landmarks were visited");
} catch (error) {
  report.errors.push(error.message);
  report.failureState = await page.evaluate(() => ({
    state: window.__oprnDebug?.readState(),
    sprite: window.__oprnPlayerSprite?.(),
    mirror: document.querySelector("[data-testid=runtime-state-json]")?.textContent,
  })).catch(cause => ({ captureError: cause.message }));
  report.domText = await page.locator("body").innerText().catch(cause => `DOM unavailable: ${cause.message}`);
  await capture("failure", "이동 검증 중단", {}, [error.message]).catch(captureError => report.errors.push(captureError.message));
  process.exitCode = 1;
  console.error("WALK_FAILED", error.message);
} finally {
  await context.close();
  await browser.close();
  relay.destroy();
  await server.close();
  report.cleanup = { browser: true, server: true };
  await writeReport(out, report);
  console.log("WALK_REPORT", path.join(out, "SUMMARY.md"));
}
