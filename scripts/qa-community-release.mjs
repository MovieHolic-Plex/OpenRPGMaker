import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "@playwright/test";
import { exerciseExport, installExportObservations } from "./lib/exportPlayability.mjs";

const [originArgument, zipArgument, outputArgument] = process.argv.slice(2);
assert.ok(originArgument && zipArgument, "Supply a private local community origin and editor QA release ZIP");
const origin = new URL(originArgument);
assert.equal(origin.hostname, "127.0.0.1", "Community QA must use the isolated local database server");
const zipPath = resolve(zipArgument);
const outDir = resolve(outputArgument ?? "verify-shots/release-community");
await mkdir(outDir, { recursive: true });
const uploadedBytes = await readFile(zipPath);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const report = { zipPath, uploadedBytes: uploadedBytes.length, uploadedSha256: digest(uploadedBytes) };
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
try {
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  await page.goto(new URL("/ko/upload", origin).href, { waitUntil: "load" });
  await page.locator(".type-toggle button").nth(1).click();
  await page.locator("#name").fill("Release preservation QA");
  await page.locator("#license").selectOption("CC0");
  await page.locator("#file").setInputFiles(zipPath);
  const published = page.waitForResponse(response =>
    response.url() === new URL("/api/games", origin).href && response.request().method() === "POST",
  { timeout: 120_000 });
  await page.locator("button[type=submit]").click();
  const response = await published;
  assert.equal(response.status(), 201, "The actual upload must succeed");
  const publishedLink = page.locator(".form-status.ok a");
  await publishedLink.waitFor({ state: "visible" });
  const href = await publishedLink.getAttribute("href");
  assert.ok(href, "The upload UI must expose the new listing");
  const slug = decodeURIComponent(new URL(href, origin).pathname.split("/").at(-1));
  const redirect = await fetch(new URL(`/play/${encodeURIComponent(slug)}`, origin), {
    redirect: "manual", signal: AbortSignal.timeout(30_000),
  });
  assert.equal(redirect.status, 307);
  const releasePath = redirect.headers.get("location")?.match(/\/releases\/([a-f0-9]{64})\/player\.html$/);
  assert.ok(releasePath, "The listing must resolve to an immutable release");
  const publication = { slug, releaseId: releasePath[1] };
  report.publication = publication;
  await page.screenshot({ path: join(outDir, "published.png"), fullPage: true });

  const downloadUrl = new URL(`/api/games/${encodeURIComponent(publication.slug)}/releases/${publication.releaseId}/download`, origin);
  const downloaded = await fetch(downloadUrl, { signal: AbortSignal.timeout(120_000) });
  assert.equal(downloaded.status, 200);
  const downloadedBytes = Buffer.from(await downloaded.arrayBuffer());
  assert.deepEqual(downloadedBytes, uploadedBytes, "The retained download must be byte-identical");
  report.downloadSha256 = digest(downloadedBytes);

  await installExportObservations(context);
  const playPage = await context.newPage();
  playPage.setDefaultTimeout(60_000);
  report.gameplay = await exerciseExport(playPage, {
    url: new URL(`/play/${encodeURIComponent(publication.slug)}/`, origin).href,
    kind: "community",
    outDir,
  });
  assert.equal(report.gameplay.pass, true, JSON.stringify(report.gameplay));
  assert.ok(playPage.url().includes(`/releases/${publication.releaseId}/player.html`));
  report.pass = true;
  console.log(`PASS actual editor release uploaded, played, saved, reloaded and downloaded: ${publication.releaseId}`);
} finally {
  await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
}
