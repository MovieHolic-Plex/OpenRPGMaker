// Run from the integration worktree after `npm run build`.
import assert from "node:assert/strict";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { preview } from "vite";
import scenario from "../../scripts/qa/runtime/custom-equipment-slots.scenario.mjs";
import { runRuntimeQa } from "../../scripts/lib/runtimeQaRun.mjs";

const publicRoot = path.resolve("public");
const server = await preview({
  configFile: "vite.player-qa.config.ts",
  logLevel: "warn",
  preview: { host: "127.0.0.1", port: 0, strictPort: true },
  plugins: [{
    name: "integration-player-assets",
    configurePreviewServer(instance) {
      instance.middlewares.use((request, response, next) => {
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
assert.ok(address && typeof address !== "string");
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
try {
  const page = await browser.newPage();
  const report = await runRuntimeQa(page, scenario, {
    serverUrl: `http://127.0.0.1:${address.port}`,
    outDir: path.resolve("verify-shots/runtime-qa/integration-equipment"),
  });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.beats.flatMap((beat) => beat.failures), []);
  console.log(`INTEGRATION_EQUIPMENT_PLAYER_PASS beats=${report.beats.length}`);
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
