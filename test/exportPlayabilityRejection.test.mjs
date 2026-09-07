import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { rejectBadExport, requiredRuntimePngPattern } from "../scripts/lib/exportPlayability.mjs";

const runtime = {
  runtimeTarget: "a".repeat(64),
  requiredAssets: ["assets/font.woff2", "assets/current-required.png"],
  files: [{ path: "public/assets/unused-old-skin.png" }, { path: "public/assets/current-required.png" }],
};
const origin = "http://export-qa.test";
let browser;
let exporter;
before(async () => {
  // Bundle the real TS asset-closure entry with the installed dependency, not a
  // custom TS loader. No production build, server or retained archive is needed.
  const bundle = await build({
    stdin: { contents: 'export { publicationAssetEntries } from "./src/project/publicationExport.ts";', resolveDir: process.cwd() },
    bundle: true, write: false, format: "iife", globalName: "publicationQa", platform: "browser",
  });
  exporter = bundle.outputFiles[0].text;
  browser = await chromium.launch({ args: ["--no-sandbox"] });
});
after(async () => { await browser?.close(); });

async function editor(t) {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.route(`${origin}/**`, (route) => route.fulfill({
    contentType: route.request().url() === `${origin}/` ? "text/html" : "application/octet-stream",
    body: route.request().url() === `${origin}/` ? '<button data-testid="menu-project">Project</button><button data-testid="menu-project-export-standalone">Export</button>' : Buffer.from([137, 80, 78, 71]),
  }));
  await page.goto(origin);
  await page.addScriptTag({ content: exporter });
  await page.evaluate((runtime) => {
    const download = () => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob(["export"]));
      link.download = "game.html";
      link.click();
      URL.revokeObjectURL(link.href);
    };
    document.querySelector('[data-testid="menu-project-export-standalone"]').onclick = async () => {
      document.querySelector('[data-testid="toast"]')?.remove();
      try {
        if (window.unrelatedError) throw new Error("Unrelated export failure");
        await window.publicationQa.publicationAssetEntries({ assets: [] }, {
          runtime,
          read: async (path) => {
            const response = await fetch(`/runtime-archive/${runtime.runtimeTarget}/${path}`);
            if (!response.ok) throw new Error(`Required bytes unavailable: ${response.status}`);
            return new Uint8Array(await response.arrayBuffer());
          },
        });
        download();
      } catch (error) {
        if (window.downloadOnFailure) { download(); return; }
        const toast = document.createElement("div");
        toast.dataset.testid = "toast";
        toast.className = "error";
        toast.textContent = String(error);
        document.body.append(toast);
      }
    };
  }, runtime);
  return page;
}

test("missing-image QA selects a PNG from the selected runtime required closure, not optional files", () => {
  assert.equal(requiredRuntimePngPattern(runtime), `**/runtime-archive/${runtime.runtimeTarget}/public/assets/current-required.png`);
  assert.throws(() => requiredRuntimePngPattern({ ...runtime, requiredAssets: ["assets/font.woff2"] }));
});

test("missing required PNG is intercepted in the real publication asset collector and prevents download", { timeout: 15000 }, async (t) => {
  const page = await editor(t);
  const downloaded = page.waitForEvent("download", { timeout: 5000 });
  await page.getByTestId("menu-project-export-standalone").click();
  assert.equal(await (await downloaded).failure(), null);
  const result = await rejectBadExport(page, requiredRuntimePngPattern(runtime), "Missing bytes", 404);
  assert.equal(result.pass, true);
  assert.equal(result.downloaded, false);
  assert.equal(result.interceptions, 1);
  // The failed injection cannot leak into a later export.
  assert.equal(await page.evaluate(async (path) => (await fetch(path)).status,
    `/runtime-archive/${runtime.runtimeTarget}/public/assets/current-required.png`), 200);
});

test("an unrelated error toast cannot pass a missing-asset scenario whose route was never hit", { timeout: 15000 }, async (t) => {
  const page = await editor(t);
  await page.evaluate(() => { window.unrelatedError = true; });
  await assert.rejects(rejectBadExport(page, requiredRuntimePngPattern(runtime), "Missing bytes", 404));
});

test("an invalid download fails immediately instead of waiting for a nonexistent error toast", { timeout: 15000 }, async (t) => {
  const page = await editor(t);
  await page.evaluate(() => { window.downloadOnFailure = true; });
  await assert.rejects(rejectBadExport(page, requiredRuntimePngPattern(runtime), "Missing bytes", 404));
});
