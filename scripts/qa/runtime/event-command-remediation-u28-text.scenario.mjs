import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { firefox } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { armEventCommandObservation, eventCommandQaOp } from "../../lib/runtimeQaEventCommands.mjs";

const state = (path, equals) => ({ source: "state", path, equals });
const dialogue = text => [
  { source: "dom", selector: '[data-testid="dialogue-box"].page-ready', read: "present", equals: true },
  { source: "dom", selector: '[data-testid="dialogue-box"] .body', read: "text", equals: text },
];
const key = (key, observe) => ({ kind: "eventCommand", trigger: { kind: "key", key }, observe, timeoutMs: 120_000 });
export function scenario(projectFixture) {
  return { id: "event-command-remediation-u28-text", projectFixture, viewport: { width: 1280, height: 800 }, beats: [
    { id: "ready", ops: [key("Enter", [...dialogue("READY"), state(["variables", "var_0001"], 11), state(["variables", "var_0002"], 29)])] },
    { id: "g1-f18", shot: true, ops: [key("z", dialogue("HelloOther29 world"))] },
    { id: "complete", ops: [key("z", dialogue("DONE"))] },
  ] };
}
export default scenario("/tmp/event-command-remediation/U28/project.json");

export async function provePlayer(editorFile, out, owned) {
  // Given: the actual downloaded editor command, unchanged; separate QA setup/barriers.
  const saved = JSON.parse(await readFile(editorFile, "utf8"));
  const runtime = structuredClone(saved);
  const event = runtime.maps[runtime.startMapId].events[0];
  const command = event.pages[0].commands[0];
  assert.deepEqual(command, { kind: "text", body: "Hello\\n[2]\\v[2] world", speaker: "Narrator", emotion: "happy" });
  assert.equal(runtime.database.actors[0].name, "First Hero"); assert.equal(runtime.database.actors[1].name, "Other");
  const program = [
    { kind: "setVariable", variableId: "var_0001", op: "=", value: 11 },
    { kind: "setVariable", variableId: "var_0002", op: "=", value: 29 },
    { kind: "text", body: "READY" }, command, { kind: "text", body: "DONE" },
  ];
  event.commands = program; event.pages[0].commands = program;
  event.trigger = { kind: "auto" }; event.pages[0].trigger = { kind: "auto" };
  assert.deepEqual(program[3], saved.maps[saved.startMapId].events[0].pages[0].commands[0]);
  const fixture = join(owned, "runtime-project.json"); await writeFile(fixture, JSON.stringify(runtime));
  await writeFile(join(out, "player-inputs.json"), JSON.stringify({ editorFile, command, program,
    qaSetup: "Only host trigger becomes auto and setup/barrier commands surround the exact exported payload. No original command field changes.",
    wrongTargets: ["HelloFirst Hero29 world", "HelloOther11 world"] }, null, 2));
  process.env.VITE_CACHE_DIR = resolve(owned, "player-cache"); process.env.E2E_FREEZE_DEV_SERVER = "1";
  process.env.VITE_SUPABASE_URL = ""; process.env.VITE_SUPABASE_ANON_KEY = ""; process.env.VITE_SUPABASE_USE_PROXY = "0";
  const server = await startPlayerQaServer(); let browser; let page;
  console.log(`PLAYER SERVER ${server.url}`);
  const errors = []; const writes = []; const beats = [];
  try {
    browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }); page = await context.newPage();
    page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(120_000);
    page.on("pageerror", error => errors.push(error.message));
    await page.route(/(?:supabase|dbserver|\/rest\/v1)/i, async route => {
      if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
        writes.push(route.request().method()); await route.abort("blockedbyclient");
      } else await route.continue();
    });
    await page.route("**/__runtime-qa/project.json", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(runtime) }));
    const title = { kind: "eventCommand", trigger: { kind: "none" }, timeoutMs: 120_000,
      observe: [{ source: "dom", selector: '[data-testid="title-screen"]', read: "present", equals: true }] };
    await page.addInitScript(`localStorage.clear(); window.__OPENRPG_BOOT__ = ${JSON.stringify({ projectUrl: "/__runtime-qa/project.json", saveNamespace: out, qaInstrumentation: true })};
      (${armEventCommandObservation.toString()})(${JSON.stringify(title)}); window.__eventCommandQa.start();`);
    // When: dedicated player boot and exact subscriptions precede every real key (no editor play mode).
    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const boot = await page.evaluate(async () => {
      window.__eventCommandQa.check(); const result = await window.__eventCommandQa.result;
      window.__eventCommandQa.abort(); delete window.__eventCommandQa; return result;
    });
    assert.equal(boot.status, "success"); beats.push({ id: "title", observation: boot }); console.log("PLAYER title PASS");
    for (const beat of scenario(fixture).beats) {
      for (const op of beat.ops) beats.push({ id: beat.id, observation: await eventCommandQaOp(page, op) });
      console.log(`PLAYER ${beat.id} PASS`);
      if (beat.id === "g1-f18") {
        const geometry = [];
        for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
          await page.setViewportSize(viewport);
          const bounds = await page.evaluate(() => {
            const nodes = [document.querySelector("canvas"), document.querySelector('[data-testid="dialogue-box"]')];
            return { url: location.href, editor: Boolean(document.querySelector(".editor-layout")), pending: Boolean(window.__eventCommandQa),
              focused: document.activeElement?.tagName, text: document.querySelector('[data-testid="dialogue-box"] .body')?.textContent,
              boxes: nodes.map(node => { if (!node) throw new TypeError("Player surface missing");
                const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; }) };
          });
          assert.ok(bounds.url.endsWith("/player.html")); assert.equal(bounds.editor, false); assert.equal(bounds.pending, false);
          assert.equal(bounds.text, "HelloOther29 world");
          for (const r of bounds.boxes) assert.ok(r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.right <= viewport.width && r.bottom <= viewport.height);
          geometry.push({ ...viewport, ...bounds }); await page.screenshot({ path: join(out, `player-${viewport.width}.png`) });
        }
        await writeFile(join(out, "player-geometry.json"), JSON.stringify(geometry, null, 2));
        // Then: each wrong actor/value expectation must fail on this same rendered command.
        const negatives = [];
        for (const wrong of ["HelloFirst Hero29 world", "HelloOther11 world"]) {
          await assert.rejects(eventCommandQaOp(page, { kind: "eventCommand", trigger: { kind: "none" },
            observe: dialogue(wrong), timeoutMs: 250 }), error => {
            if (!(error instanceof Error) || !("observation" in error)) return false;
            const observation = error.observation;
            assert.equal(observation.status, "timeout"); assert.deepEqual(observation.after, [{ value: true }, { value: "HelloOther29 world" }]);
            negatives.push({ wrong, observation }); return true;
          });
        }
        await writeFile(join(out, "player-negative.json"), JSON.stringify(negatives, null, 2));
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    await writeFile(join(out, "player-observations.json"), JSON.stringify({ status: "PASS", beats, errors, writes,
      exactExportedCommand: command, wrongTargetRejections: 2, observationReleased: await page.evaluate(() => !window.__eventCommandQa) }, null, 2));
    await context.close(); console.log("PLAYER PASS: title + 3 beats, Other29, 2 wrong-target rejections");
  } catch (error) {
    if (page) await page.screenshot({ path: join(out, "player-failure.png") });
    await writeFile(join(out, "player-failure.json"), JSON.stringify({ error: String(error), errors, writes, beats,
      surface: page ? await page.locator("body").innerText() : null }, null, 2)); throw error;
  } finally {
    await browser?.close(); await server.close();
    await writeFile(join(out, "player-cleanup.json"), JSON.stringify({ port: server.port, serverClosed: true, browserClosed: true }, null, 2));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [editorFile, out] = process.argv.slice(2); assert.ok(editorFile && out);
  const owned = await mkdtemp(join(out, "tmp-player-"));
  try { await provePlayer(editorFile, out, owned); }
  finally { await rm(owned, { recursive: true, force: true }); }
}
