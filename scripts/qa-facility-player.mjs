// Render every facility through the shipped player shim, not the editor shell.
import { chromium } from "@playwright/test";
import { copyFile, readFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { preview } from "vite";
import { runRuntimeQa, writeReport } from "./lib/runtimeQaRun.mjs";

const phase = process.argv[2] ?? "after";
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error("Expected a phase name");
const root = path.resolve("output/evidence/facility-quality", phase);
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const facilities = manifest.filter((entry) => entry.id !== "inn");
const first = facilities[0];
if (!first) throw new Error("No facilities to verify");
// Run `npm run build:player` first. The export normally copies referenced
// assets into the package; this QA server reads those same bundled assets.
const publicRoot = path.resolve("public");
const server = await preview({
  configFile: "vite.player-qa.config.ts",
  logLevel: "warn",
  preview: { host: "127.0.0.1", port: 0, strictPort: true },
  plugins: [{
    name: "facility-qa-bundled-assets",
    configurePreviewServer(previewServer) {
      previewServer.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        const file = path.resolve(publicRoot, `.${pathname}`);
        if (!pathname.startsWith("/assets/") || !file.startsWith(`${publicRoot}${path.sep}`) || !existsSync(file)) {
          next();
          return;
        }
        createReadStream(file).pipe(response);
      });
    },
  }],
});
const address = server.httpServer.address();
if (!address || typeof address === "string") throw new Error("Missing player server address");
const serverUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
let failed = false;
const combined = {
  scenarioId: "facility-quality", projectPath: root, seed: 7,
  viewport: { width: 1280, height: 960 }, errors: [], beats: [],
};
try {
  // Boot each facility at its authored start. Debug teleport updates logical
  // coordinates independently of the sprite/camera and is not a capture barrier.
  for (const [index, facility] of facilities.entries()) {
    const page = await browser.newPage();
    page.on("pageerror", (error) => console.error(`PLAYER ERROR: ${error.message}`));
    page.on("requestfailed", (request) => console.error(`PLAYER REQUEST: ${request.url()} ${request.failure()?.errorText}`));
    try {
      const outDir = path.join(root, "player", facility.id);
      const report = await runRuntimeQa(page, {
        id: `facility-${facility.id}`,
        projectFixture: path.join(root, `${facility.id}.json`),
        viewport: combined.viewport,
        beats: [{
          id: facility.id,
          note: `${facility.label}: boot at the authored entrance in the exported player`,
          ops: [
            { kind: "key", key: "Enter" },
            { kind: "waitForRuntime" },
            { kind: "waitForPosition", mapId: facility.mapId, ...facility.start },
          ],
          expect: {
            mapId: facility.mapId, ...facility.start,
            playerSpriteTextureLoaded: true,
            testidAbsent: ["title-screen"],
          },
          shot: true,
        }],
      }, { serverUrl, outDir });
      for (const beat of report.beats) {
        const shot = `${String(index + 1).padStart(2, "0")}-${facility.id}.png`;
        if (!beat.shot) throw new Error(`Missing player screenshot: ${facility.id}`);
        await copyFile(path.join(outDir, beat.shot), path.join(root, "player", shot));
        combined.beats.push({ ...beat, index, shot });
        console.log(`PLAYER ${beat.id}: ${beat.failures.length === 0 ? "PASS" : JSON.stringify(beat.failures)}`);
      }
      combined.errors.push(...report.errors);
    } finally {
      await page.close();
    }
  }
  for (const error of combined.errors) console.error(`PLAYER ERROR: ${error}`);
  await writeReport(path.join(root, "player"), combined);
  failed = combined.errors.length > 0 || combined.beats.some((beat) => beat.failures.length > 0);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
process.exitCode = failed ? 1 : 0;
