import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { firefox } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { armEventCommandObservation, eventCommandQaOp } from "../../lib/runtimeQaEventCommands.mjs";

const state = (path, equals) => ({ source: "state", path, equals });
const present = selector => ({ source: "dom", selector, read: "present", equals: true });
const op = (key, observe, timeoutMs = 15_000) => ({ kind: "eventCommand", trigger: { kind: "key", key }, observe, timeoutMs });
const barrier = body => [present('[data-testid="dialogue-box"].page-ready'),
  { source: "dom", selector: '[data-testid="dialogue-box"] .body', read: "text", equals: body }];
const viewports = [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }];

export function scenario(projectFixture) {
  return { id: "event-command-remediation-u10-erase", projectFixture, viewport: viewports[1], beats: [
    { id: "boot", ops: [op("Enter", [state(["player"], { x: 2, y: 3 })], 120_000)] },
    { id: "ready", shot: true, ops: [op("z", barrier("U10_READY"))] },
    { id: "erased-and-followed", shot: true, ops: [op("z", [...barrier("U10_AFTER_ERASE"), state(["switches", "eraseFollowed"], true)])] },
  ] };
}
export default scenario("/tmp/event-command-remediation/U10/project.json");

async function observeAction(page, observations, action) {
  await page.evaluate(armEventCommandObservation, { kind: "eventCommand", trigger: { kind: "none" }, observe: observations, timeoutMs: 15_000 });
  try {
    await page.evaluate(() => window.__eventCommandQa.start());
    await action();
    const trace = await page.evaluate(async () => { window.__eventCommandQa.check(); return await window.__eventCommandQa.result; });
    assert.equal(trace.status, "success", JSON.stringify(trace));
    return trace;
  } finally { await page.evaluate(() => { window.__eventCommandQa.abort(); delete window.__eventCommandQa; }); }
}

export async function proveErasePlayer(editorFile, out, owned) {
  // Given: byte-hashed real editor export. Exact erase payloads, never reconstructed fields.
  const editorBytes = await readFile(editorFile, "utf8");
  const saved = JSON.parse(editorBytes);
  const commands = saved.maps.map_intro.events.find(event => event.id === "host").pages[0].commands;
  assert.deepEqual(commands.map(command => command.fields.eventId), ["selectedOther", "", "unknownEvent"]);
  process.env.VITE_CACHE_DIR = resolve(owned, "player-cache"); process.env.E2E_FREEZE_DEV_SERVER = "1";
  process.env.VITE_SUPABASE_URL = ""; process.env.VITE_SUPABASE_ANON_KEY = ""; process.env.VITE_SUPABASE_USE_PROXY = "0";
  const server = await startPlayerQaServer(); let browser;
  const cases = [{ id: "selected", index: 0, remains: ["host"] },
    { id: "current", index: 1, remains: ["selectedOther"] },
    { id: "unknown", index: 2, remains: ["host", "selectedOther"] },
    { id: "common-host", index: 0, remains: ["host"], common: true }];
  const receipts = [];
  try {
    browser = await firefox.launch({ headless: true });
    for (const entry of cases) {
      const project = structuredClone(saved);
      const host = project.maps.map_intro.events.find(event => event.id === "host");
      const command = commands[entry.index];
      project.switches.push({ id: "eraseFollowed", name: "Erase followed" });
      const erase = entry.common ? { kind: "callCommonEvent", commonEventId: "u10_common" } : command;
      if (entry.common) project.commonEvents[0].commands = [command];
      host.pages[0].commands = [{ kind: "text", body: "U10_READY" }, erase,
        { kind: "setSwitch", switchId: "eraseFollowed", value: true }, { kind: "text", body: "U10_AFTER_ERASE" }];
      const context = await browser.newContext({ viewport: viewports[1] });
      try {
        const page = await context.newPage(); const errors = []; const writes = [];
        page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(120_000);
        page.on("pageerror", error => errors.push(String(error)));
        page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
        await page.route(/(?:supabase|dbserver|\/rest\/v1)/i, async route => {
          if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) writes.push(route.request().method());
          await route.abort("blockedbyclient");
        });
        await page.route("**/__runtime-qa/project.json", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
        const title = { kind: "eventCommand", trigger: { kind: "none" }, timeoutMs: 120_000, observe: [present('[data-testid="title-screen"]')] };
        await page.addInitScript(`window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "u10-${entry.id}", qaInstrumentation: true }; (${armEventCommandObservation.toString()})(${JSON.stringify(title)}); window.__eventCommandQa.start();`);
        await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 120_000 });
        const titleTrace = await page.evaluate(async () => {
          window.__eventCommandQa.check(); const trace = await window.__eventCommandQa.result;
          window.__eventCommandQa.abort(); delete window.__eventCommandQa; return trace;
        });
        assert.equal(titleTrace.status, "success", JSON.stringify(titleTrace));
        const beats = scenario(editorFile).beats;
        const boot = await eventCommandQaOp(page, beats[0].ops[0]);
        // Facing setup uses the existing QA hook; the event itself is activated by real keyboard input.
        await page.evaluate(() => window.__oprnInput.face("up"));
        const ready = await eventCommandQaOp(page, beats[1].ops[0]);
        const before = await page.evaluate(() => window.__oprnCharacterSprites());
        assert.deepEqual(Object.keys(before.events).sort(), ["host", "selectedOther"]);
        for (const sprite of Object.values(before.events)) assert.ok(sprite.alpha > 0 && sprite.textureKey);
        await page.screenshot({ path: join(out, `player-${entry.id}-before.png`) });
        // When: subscribe before advancing the dialogue into the exact exported erase command.
        const followed = await eventCommandQaOp(page, beats[2].ops[0]);
        const after = await page.evaluate(() => window.__oprnCharacterSprites());
        // Then: actual Phaser sprite-map absence/presence, not eraseRequested metadata.
        assert.deepEqual(Object.keys(after.events).sort(), entry.remains);
        for (const id of entry.remains) assert.deepEqual(after.events[id], before.events[id]);
        const geometry = [];
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          const bounds = await page.evaluate(() => {
            const canvas = document.querySelector("canvas");
            if (!canvas) throw new Error("Missing player canvas");
            const r = canvas.getBoundingClientRect();
            return { url: location.href, editor: Boolean(document.querySelector(".editor-layout")), pending: Boolean(window.__eventCommandQa),
              x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
          });
          assert.ok(bounds.url.endsWith("/player.html")); assert.equal(bounds.editor, false); assert.equal(bounds.pending, false);
          assert.ok(bounds.width > 0 && bounds.height > 0 && bounds.x >= 0 && bounds.y >= 0 && bounds.right <= viewport.width && bounds.bottom <= viewport.height);
          geometry.push({ ...viewport, ...bounds });
          await page.screenshot({ path: join(out, `player-${entry.id}-${viewport.width}.png`) });
        }
        let restored;
        if (entry.id === "selected") {
          const away = await observeAction(page, [state(["mapId"], "map_12")], () => page.evaluate(() => window.__oprnDebug.teleport("map_12", 2, 3)));
          const home = await observeAction(page, [state(["mapId"], "map_intro")], () => page.evaluate(() => window.__oprnDebug.teleport("map_intro", 2, 3)));
          restored = await page.evaluate(() => window.__oprnCharacterSprites());
          assert.deepEqual(Object.keys(restored.events).sort(), ["host", "selectedOther"]);
          receipts.push({ temporaryErase: { away, home, restored } });
        }
        assert.deepEqual(errors, []); assert.deepEqual(writes, []);
        receipts.push({ case: entry.id, command, program: host.pages[0].commands, titleTrace, boot, ready, followed, before, after, geometry, errors, writes });
      } finally { await context.close(); }
    }
    await writeFile(join(out, "player-observations.json"), JSON.stringify({ editorSha256: createHash("sha256").update(editorBytes).digest("hex"), receipts,
      noHostCoverage: "Original seven-case test uses actual runCommands scene consumer with no host, including common frames. No claim of editor context or parallel scheduler support is made." }, null, 2));
    console.log("PLAYER PASS: 4 cases; selected/current/unknown/common-host; actual sprites, following marker, map-reload restoration");
  } finally {
    await browser?.close(); await server.close();
    await writeFile(join(out, "player-cleanup.json"), JSON.stringify({ port: server.port, browserClosed: true, serverClosed: true, contextsClosed: true }, null, 2));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [editorFile, out] = process.argv.slice(2); assert.ok(editorFile && out); await mkdir(out, { recursive: true });
  const owned = await mkdtemp(join(out, "tmp-player-"));
  try { await proveErasePlayer(editorFile, out, owned); }
  finally { await rm(owned, { recursive: true, force: true }); }
}
