import assert from "node:assert/strict";
import { createServer } from "node:net";
import { once } from "node:events";
import { readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import scenario from "../../../../scripts/qa/runtime/event-command-remediation-u03.scenario.mjs";
import { eventCommandQaOp } from "../../../../scripts/lib/runtimeQaEventCommands.mjs";
import { normalizeScenario } from "../../../../scripts/lib/runtimeQa.mjs";
import { runRuntimeQa, startPlayerQaServer } from "../../../../scripts/lib/runtimeQaRun.mjs";
const out = ".omo/evidence/event-command-remediation/U03";
const root = (await readFile(`${out}/owned-root.txt`, "utf8")).trim();
assert.ok(root.startsWith("/tmp/event-command-u03-"));
const cache = join(root, "player-cache");
process.env.VITE_CACHE_DIR = cache;
process.env.E2E_FREEZE_DEV_SERVER = "1";
const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const cases = [
  { id: "restored-A", fixture: join(root, "fixtures/restored-A.json"), direction: "left" },
  { id: "direction-up", fixture: join(root, "fixtures/direction-up.json"), direction: "up" },
];
await writeFile(`${out}/player-scenarios.json`, JSON.stringify({ port, browser: "chromium", surface: "player.html", cases, scenario,
  negative: { action: "After real transfer, real Z with impossible mapB expectation", pass: "bounded timeout observes mapA, observation released" } }, null, 2));
normalizeScenario(scenario);
const server = await startPlayerQaServer({ port });
let browser;
const results = [];
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  for (const entry of cases) {
    const context = await browser.newContext();
    const writes = [];
    await context.route(url => /(?:legacyDb|dbserver|\/rest\/v1|\/projects?(?:\/|$))/i.test(url.href), async route => {
      const request = route.request();
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        writes.push(`${request.method()} ${request.url()}`); await route.abort("blockedbyclient");
      } else await route.continue();
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      const wire = await readFile(entry.fixture, "utf8");
      const authored = JSON.parse(wire).maps.mapA.events[0].pages[0].commands[0];
      assert.deepEqual(authored, { kind: "transfer", mapId: "mapA", x: 2, y: 3, direction: entry.direction, fade: "black", transition: "fade" });
      const report = await runRuntimeQa(page, { ...scenario, id: `${scenario.id}-${entry.id}`, projectFixture: entry.fixture }, { serverUrl: server.url, outDir: `${out}/player-${entry.id}` });
      assert.deepEqual(report.errors, []);
      assert.ok(report.beats.every(beat => beat.failures.length === 0), JSON.stringify(report));
      // Read the rendered sprite through existing hooks; decode with the actual
      // browser module in a static IIFE so no SSR imports enter serialized code.
      const surface = await page.evaluate(`(async () => {
        const { decodeCharsetFrameIndex } = await import('/src/assets/easyrpgRtp.ts');
        const sprite = window.__oprnPlayerSprite();
        return { url: location.href, editor: Boolean(document.querySelector('.editor-layout')),
          canvas: Boolean(document.querySelector('canvas')), pending: Boolean(window.__eventCommandQa),
          sprite, direction: decodeCharsetFrameIndex(Number(sprite.frame)).direction };
      })()`);
      assert.ok(surface.url.endsWith("/player.html"));
      assert.equal(surface.editor, false); assert.equal(surface.canvas, true); assert.equal(surface.pending, false);
      assert.equal(surface.sprite.kind, "charset"); assert.equal(surface.sprite.moving, false);
      assert.equal(surface.direction, entry.direction);
      let negative;
      await assert.rejects(eventCommandQaOp(page, { kind: "eventCommand", trigger: { kind: "key", key: "z" },
        observe: [{ source: "state", path: ["mapId"], equals: "mapB" }], timeoutMs: 1_000 }), error => {
        negative = error.observation; return negative?.status === "timeout";
      });
      assert.deepEqual(negative.after, [{ value: "mapA" }]);
      assert.equal(await page.evaluate(() => Boolean(window.__eventCommandQa)), false);
      assert.deepEqual(writes, []);
      const result = { id: entry.id, status: "PASS", source: entry.fixture, sha256: createHash("sha256").update(wire).digest("hex"), authored,
        surface, negative, remoteWrites: writes, positiveBeats: report.beats.length };
      results.push(result);
      await writeFile(`${out}/player-${entry.id}/surface.json`, JSON.stringify(result, null, 2));
      console.log(`G1-F20 ${entry.id}: real Z -> mapA/(2,3)/${entry.direction}; fade retained; wrong mapB rejected: PASS`);
    } finally { await context.close(); }
  }
  await writeFile(`${out}/player-observation.json`, JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  await browser?.close();
  await server.close();
  await rm(cache, { recursive: true, force: true });
  await writeFile(`${out}/player-cleanup.json`, JSON.stringify({ port, serverExited: true, browserContextsClosed: true, cacheRemoved: cache }, null, 2));
  console.log("U03 player cleanup: browser, fresh contexts/save namespaces, server and owned cache closed");
}
