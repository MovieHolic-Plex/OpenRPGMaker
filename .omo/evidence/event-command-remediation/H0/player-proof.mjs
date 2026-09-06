// Reproduce after preparing H0 in the temporary directory passed as argv[2].
import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { eventCommandQaOp } from "../../../../scripts/lib/runtimeQaEventCommands.mjs";
import { runRuntimeQa, startPlayerQaServer } from "../../../../scripts/lib/runtimeQaRun.mjs";
const out = ".omo/evidence/event-command-remediation/H0";
const fixture = process.argv[2];
assert.ok(fixture);
const cache = "/tmp/event-command-h0-player-01a0760f";
process.env.VITE_CACHE_DIR = cache;
const server = await startPlayerQaServer({ port: 39879 });
let browser;
const state = (path, equals) => ({ source: "state", path, equals });
const dom = (selector, equals) => ({ source: "dom", selector, read: "present", equals });
const op = (trigger, observe, timeoutMs = 30000) => ({ kind: "eventCommand", trigger, observe, timeoutMs });
const boot = { id: "h0-boot", ops: [op({ kind: "key", key: "Enter" }, [state(["mapId"], "map_intro"), state(["gold"], 0)])], expect: { mapId: "map_intro", x: 2, y: 3 } };
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage();
  const report = await runRuntimeQa(page, { id: "event-command-remediation-h0", projectFixture: fixture, beats: [boot, {
    id: "h0-real-input", note: "Z activates authored changeGold and text on host; coordinates unchanged", shot: true,
    ops: [{ kind: "face", dir: "up" }, op({ kind: "key", key: "z" }, [state(["gold"], 7), state(["player"], { x: 2, y: 3 }), dom('[data-testid="dialogue-box"]', true)])],
    expect: { gold: 7, x: 2, y: 3, testidPresent: ["dialogue-box"], testidAbsent: ["title-screen"] },
  }] }, { serverUrl: server.url, outDir: `${out}/player` });
  console.log(JSON.stringify(report));
  assert.deepEqual(report.errors, []);
  assert.ok(report.beats.every(beat => beat.failures.length === 0));
  const surface = await page.evaluate(() => ({ url: location.href, editor: Boolean(document.querySelector(".editor-layout")), canvas: Boolean(document.querySelector("canvas")), pending: Boolean(window.__eventCommandQa) }));
  assert.equal(surface.editor, false); assert.equal(surface.canvas, true); assert.equal(surface.pending, false);
  assert.ok(surface.url.endsWith("/player.html"));
  await writeFile(`${out}/player/surface.json`, JSON.stringify(surface, null, 2));
  // Discriminate on the same live result, without booting a second unrelated game.
  let negative;
  await assert.rejects(eventCommandQaOp(page, op({ kind: "key", key: "z" }, [state(["gold"], 8)], 1000)), error => {
    negative = error.observation;
    return negative?.status === "timeout";
  });
  assert.deepEqual(negative.after, [{ value: 7 }]);
  assert.equal(await page.evaluate(() => Boolean(window.__eventCommandQa)), false);
  await writeFile(`${out}/player/negative-observation.json`, JSON.stringify(negative, null, 2));
  console.log("Real-player wrong-result discriminator: rejected 8, observed 7");
} finally {
  await browser?.close();
  await server.close();
  await rm(cache, { recursive: true, force: true });
  console.log("Cleanup: browser/context/saveNamespaces closed, port 39879 server closed, owned Vite cache removed");
}
