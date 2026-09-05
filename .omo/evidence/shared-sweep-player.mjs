// Execute with vite-node after the shared main production build.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { firefox } from "@playwright/test";
import { preview } from "vite";
import { canMove } from "../../src/project/collision";
import { deserialize } from "../../src/project/io";
import { runRuntimeQa } from "../../scripts/lib/runtimeQaRun.mjs";

const out = path.resolve("output/evidence/shared-sweep-player");
await mkdir(out, { recursive: true });
const fixtures = JSON.parse(await readFile("output/evidence/pr618-fixtures/manifest.json", "utf8"));
const publicRoot = path.resolve("public");
const server = await preview({
  configFile: "vite.player-qa.config.ts", configLoader: "runner",
  logLevel: "warn", preview: { host: "127.0.0.1", port: 0, strictPort: true },
  plugins: [{
    name: "shared-sweep-assets",
    configurePreviewServer(instance) {
      instance.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        const file = path.resolve(publicRoot, `.${pathname}`);
        if (!pathname.startsWith("/assets/") || !file.startsWith(`${publicRoot}${path.sep}`) || !existsSync(file)) {
          next(); return;
        }
        createReadStream(file).pipe(response);
      });
    },
  }],
});
const address = server.httpServer.address();
assert.ok(address && typeof address !== "string");
const browser = await firefox.launch({ headless: true });
const results = [];
try {
  for (const fixture of fixtures) {
    const project = deserialize(await readFile(fixture.file, "utf8"));
    const beats = [{
      id: "start", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
      expect: { mapId: fixture.mapId, playerSpriteTextureLoaded: true }, shot: true,
    }];
    let mapId = fixture.mapId;
    let position = fixture.start;
    for (const step of fixture.steps.filter((step) => step.do === "interact")) {
      const map = project.maps[mapId];
      const event = map.events.find((event) => event.id === step.eventId);
      assert.ok(event);
      const transfer = event.pages.flatMap((page) => page.commands).find((command) => command.kind === "transfer");
      assert.ok(transfer);
      const target = { x: event.x, y: event.y + 1 };
      const queue = [{ ...position, moves: [] }];
      const seen = new Set([`${position.x},${position.y}`]);
      let route;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const point = queue[cursor];
        if (point.x === target.x && point.y === target.y) { route = point.moves; break; }
        for (const [dx, dy, dir] of [[1, 0, "right"], [-1, 0, "left"], [0, 1, "down"], [0, -1, "up"]]) {
          const x = point.x + dx, y = point.y + dy, key = `${x},${y}`;
          if (seen.has(key) || !canMove(project, map, point.x, point.y, x, y)) continue;
          seen.add(key);
          queue.push({ x, y, moves: [...point.moves, { x, y, dir }] });
        }
      }
      assert.ok(route, `No real walking route to ${event.id}`);
      beats.push({
        id: `stairs-${beats.length}-${transfer.mapId.replaceAll("_", "-")}`,
        ops: [
          ...route.flatMap(({ x, y, dir }) => [
            { kind: "playerRoute", moves: [{ kind: "move", dir }] },
            { kind: "waitForPosition", mapId, x, y },
          ]),
          { kind: "face", dir: "up" }, { kind: "action" },
          { kind: "waitForAttr", testid: "dialogue-box", attr: "data-sweep-ready", value: "true" },
          { kind: "key", key: "Enter" },
          { kind: "waitForPosition", mapId: transfer.mapId, x: transfer.x, y: transfer.y },
        ],
        expect: { mapId: transfer.mapId }, shot: true,
      });
      mapId = transfer.mapId;
      position = { x: transfer.x, y: transfer.y };
    }
    const page = await browser.newPage();
    await page.addInitScript(`{
      new MutationObserver(() => {
        const box = document.querySelector('[data-testid="dialogue-box"]');
        if (box) box.dataset.sweepReady = String(box.classList.contains("page-ready"));
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
      let phaser;
      Object.defineProperty(window, "Phaser", {
        configurable: true, get() { return phaser; },
        set(value) {
          phaser = value;
          const Game = value.Game;
          value.Game = class extends Game {
            constructor(config) { super(config); window.__sweepGame = this; }
          };
        }
      });
    }`);
    const report = await runRuntimeQa(page, {
      id: `shared-${fixture.id}`, projectFixture: fixture.file,
      viewport: { width: 1280, height: 960 }, beats,
    }, { serverUrl: `http://127.0.0.1:${address.port}`, outDir: path.join(out, fixture.id) });
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.beats.flatMap((beat) => beat.failures), []);
    let frames = [];
    if (fixture.id !== "inn") {
      frames = await page.evaluate((lit) => {
        const objects = [];
        const visit = (object) => { objects.push(object); for (const child of object.list ?? []) visit(child); };
        for (const object of window.__sweepGame.scene.getScenes(true)[0].children.list) visit(object);
        if (!lit) {
          const cold = objects.find((object) => object.frame?.name === "tile_463");
          if (!cold || cold.anims?.isPlaying) throw new Error("Static hearth missing or animating");
          return ["tile_463"];
        }
        const fire = objects.find((object) => object.anims?.currentAnim?.key?.endsWith(":chipset_waterfall_124_4fps"));
        if (!fire) throw new Error("Animated interior hearth missing");
        return new Promise((resolve, reject) => {
          const expected = new Set(["tile_124", "tile_154", "tile_184", "tile_214"]);
          const seen = new Set();
          const update = () => {
            if (expected.has(fire.frame.name)) seen.add(fire.frame.name);
            if (seen.size !== expected.size) return;
            clearTimeout(timer); fire.off("animationupdate", update); resolve([...seen].sort());
          };
          const timer = setTimeout(() => { fire.off("animationupdate", update); reject(new Error("Missing fire animation frames")); }, 10000);
          fire.on("animationupdate", update);
          update();
        });
      }, fixture.id === "hearth-lit");
    }
    results.push({ fixture: fixture.id, beats: report.beats.length, frames, errors: report.errors });
    await page.close();
  }
  await writeFile(path.join(out, "result.json"), JSON.stringify({ passed: true, teleports: 0, results }, null, 2));
  console.log(`SHARED_PLAYER_PASS ${JSON.stringify(results)}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
