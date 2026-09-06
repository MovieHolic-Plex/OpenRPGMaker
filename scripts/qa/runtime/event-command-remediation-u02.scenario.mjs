import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { runRuntimeQa, startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { eventCommandQaOp } from "../../lib/runtimeQaEventCommands.mjs";

const state = (path, equals) => ({ source: "state", path, equals });
const present = selector => ({ source: "dom", selector, read: "present", equals: true });
const text = (selector, equals) => ({ source: "dom", selector, read: "text", equals });
const attr = (selector, name, equals) => ({ source: "dom", selector, read: "attribute", name, equals });
const op = (trigger, observe, timeoutMs = 15_000) => ({ kind: "eventCommand", trigger, observe, timeoutMs });
const key = key => ({ kind: "key", key });
const none = { kind: "none" };
const readyText = value => [present('[data-testid="dialogue-box"].page-ready'), text('[data-testid="dialogue-box"] .body', value)];

export function scenario(projectFixture) {
  return { id: "event-command-remediation-u02", projectFixture, beats: [
    { id: "boot", ops: [op(key("Enter"), [state(["mapId"], "map_intro"), state(["variables", "first"], 91), state(["variables", "answer"], 92)])] },
    { id: "g1-f5", note: "Real Z executes saved other<=50; reward25 and other40 are untouched", shot: true,
      ops: [{ kind: "face", dir: "up" }, op(key("z"), [...readyText("THEN"), state(["variables", "reward"], 25), state(["variables", "other"], 40)])] },
    { id: "choices-ready", ops: [op(key("z"), [present('[data-testid="runtime-choices"]')])] },
    { id: "g1-f14", note: "Real Escape follows saved choice1 to B, not C", shot: true,
      ops: [op(key("Escape"), [text('[data-testid="dialogue-speaker"]', "B"), text('[data-testid="dialogue-box"] .body', "MARKER_B")])] },
    { id: "number-ready", ops: [op(none, [present('[data-testid="runtime-input-number"]'), text('[data-testid="runtime-input-number-title"]', "Code"), state(["variables", "first"], 91), state(["variables", "answer"], 92)])] },
    { id: "g1-f15", note: "Literal keys4,2,Enter write42 only to answer", shot: true,
      ops: [
        op(key("4"), [{ source: "dom", selector: '[data-testid="runtime-input-number-field"]', read: "property", name: "value", equals: "4" }]),
        op(key("2"), [{ source: "dom", selector: '[data-testid="runtime-input-number-field"]', read: "property", name: "value", equals: "42" }]),
        op(key("Enter"), [state(["variables", "answer"], 42), state(["variables", "first"], 91), ...readyText("TIMER_READY")]),
      ] },
    { id: "g1-f13", note: "Authored set17 -> saved start-without-seconds -> stop retains17, not60; other timer stays9", shot: true,
      ops: [op(none, [state(["timers", "timer2"], 17), state(["timerActive", "timer2"], false), state(["timers", "timer1"], 9), present('[data-testid="runtime-timer-hud"]')])] },
    { id: "g1-f4", note: "Edited loop text renders its saved speaker/emotion. Only QA termination commands are appended after the untouched original children.", shot: true,
      ops: [op(key("z"), [text('[data-testid="dialogue-speaker"]', "Edited NPC"), attr('[data-testid="dialogue-box"]', "data-dialogue-emotion", "happy"), text('[data-testid="dialogue-box"] .body', "Edited")])] },
    { id: "g1-f4-auto-advance", note: "No key: autoAdvance completes text, nested break exits only inner loop, QA marker and outer break execute", shot: true,
      ops: [op(none, [state(["flags", "u02-loop-completed"], true), ...readyText("AUTO_ADVANCED"), state(["variables", "first"], 91), state(["timers", "timer2"], 17)])] },
  ] };
}

export default scenario("/tmp/event-command-remediation/U02/project.json");

export async function provePlayer(editorFile, out, owned) {
  const saved = JSON.parse(await readFile(editorFile, "utf8"));
  const runtime = structuredClone(saved);
  const event = runtime.maps.map_intro.events[0];
  const commands = event.pages[0].commands;
  const loop = commands.find(command => command.kind === "loop");
  assert.ok(loop);
  assert.deepEqual(loop.body[0], { kind: "text", body: "Edited", speaker: "Edited NPC", emotion: "happy", autoAdvance: true });
  const program = [
    commands.find(command => command.kind === "fork"),
    commands.find(command => command.kind === "choices"),
    commands.find(command => command.kind === "inputNumber"),
    { kind: "timer", action: "set", timerId: "timer1", seconds: 9 },
    { kind: "timer", action: "set", timerId: "timer2", seconds: 17 },
    commands.find(command => command.kind === "timer"), { kind: "timer", action: "stop", timerId: "timer2" },
    { kind: "text", body: "TIMER_READY" },
    { ...loop, body: [...loop.body, { kind: "setFlag", flag: "u02-loop-completed", value: true }, { kind: "breakLoop" }] },
    { kind: "text", body: "AUTO_ADVANCED" },
  ];
  event.commands = program; event.pages[0].commands = program;
  const fixture = join(owned, "runtime-project.json");
  await writeFile(fixture, JSON.stringify(runtime));
  await writeFile(join(out, "player-inputs.json"), JSON.stringify({
    sourceEditorFile: editorFile, savedCommands: commands, runtimeCommands: program,
    note: "QA-only authored timer setup, stable text barrier and appended outer-loop termination; original saved children and command payloads retained.",
    inputs: "Enter boot; face up; Z fork; Z choices; Escape B; keys4,2,Enter input; Z loop; no-input automatic completion",
    pass: { fork: "THEN", cancel: "MARKER_B", answer: 42, first: 91, timer2: 17, timer1: 9, timerActive2: false, speaker: "Edited NPC", emotion: "happy", loopCompleted: true },
    reject: { forkOther5: "ELSE", cancel: "MARKER_C", first: 42, timer2: 60, speaker: "NPC" },
  }, null, 2));
  const cache = join(owned, "vite-player");
  const previousCache = process.env.VITE_CACHE_DIR;
  process.env.VITE_CACHE_DIR = cache;
  process.env.E2E_FREEZE_DEV_SERVER = "1";
  process.env.VITE_SUPABASE_URL = ""; process.env.VITE_SUPABASE_ANON_KEY = ""; process.env.VITE_SUPABASE_USE_PROXY = "0";
  const server = await startPlayerQaServer();
  let browser;
  let page;
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
    const context = await browser.newContext();
    page = await context.newPage();
    page.on("pageerror", error => console.error("PLAYER_PAGEERROR", error.message));
    page.on("console", message => { if (message.type() === "error") console.error("PLAYER_CONSOLE", message.text()); });
    page.on("requestfailed", request => console.error("PLAYER_REQUESTFAILED", request.url(), request.failure()));
    const report = await runRuntimeQa(page, scenario(fixture), { serverUrl: server.url, outDir: join(out, "player") });
    assert.deepEqual(report.errors, []);
    assert.ok(report.beats.every(beat => beat.failures.length === 0), JSON.stringify(report.beats.filter(beat => beat.failures.length)));
    const surface = await page.evaluate(() => ({ url: location.href, editor: Boolean(document.querySelector(".editor-layout")), pending: Boolean(window.__eventCommandQa), canvas: Boolean(document.querySelector("canvas")) }));
    assert.ok(surface.url.endsWith("/player.html")); assert.equal(surface.editor, false); assert.equal(surface.pending, false); assert.equal(surface.canvas, true);
    await writeFile(join(out, "player", "surface.json"), JSON.stringify(surface, null, 2));
    let negative;
    await assert.rejects(eventCommandQaOp(page, op(none, [state(["variables", "first"], 42)], 250)), error => {
      negative = error.observation; return negative?.status === "timeout";
    });
    assert.deepEqual(negative.after, [{ value: 91 }]);
    await writeFile(join(out, "player", "wrong-target.json"), JSON.stringify(negative, null, 2));
    await context.close();
    // An independent runtime value distinguishes >=10 from <=50, unlike the supplied40.
    runtime.session.variables.other = 5;
    await writeFile(fixture, JSON.stringify(runtime));
    const counter = await browser.newContext();
    const adversarial = await runRuntimeQa(await counter.newPage(), { ...scenario(fixture), id: "u02-g1-f5-other5", beats: [
      scenario(fixture).beats[0],
      { id: "g1-f5-other5", shot: true, ops: [{ kind: "face", dir: "up" }, op(key("z"), [...readyText("THEN"), state(["variables", "other"], 5)])] },
    ] }, { serverUrl: server.url, outDir: join(out, "player-adversarial") });
    assert.deepEqual(adversarial.errors, []);
    assert.ok(adversarial.beats.every(beat => beat.failures.length === 0));
    await counter.close();
    console.log("PLAYER PASS: all five findings plus other5 and wrong-target rejection");
  } catch (error) {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: join(out, "player-failure.png") });
      await writeFile(join(out, "player-failure.txt"), `${String(error)}\n${await page.locator("body").innerText()}`);
    }
    throw error;
  } finally {
    await browser?.close(); await server.close(); await rm(cache, { recursive: true, force: true });
    if (previousCache === undefined) delete process.env.VITE_CACHE_DIR; else process.env.VITE_CACHE_DIR = previousCache;
    await writeFile(join(out, "player-cleanup.json"), JSON.stringify({ port: server.port, serverClosed: true, browserClosed: true, cacheRemoved: true, memorySaveNamespacesDisposed: true }, null, 2));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [editorFile, out = ".omo/evidence/event-command-remediation/U02"] = process.argv.slice(2);
  assert.ok(editorFile, "Pass the editor-confirmed project JSON");
  const owned = await mkdtemp(join(tmpdir(), "u02-player-"));
  try { await provePlayer(editorFile, out, owned); }
  finally { await rm(owned, { recursive: true, force: true }); }
}
