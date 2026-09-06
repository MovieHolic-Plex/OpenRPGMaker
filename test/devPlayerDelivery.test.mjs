import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createServer } from "vite";
import path from "node:path";

// Real normal-dev configuration, not a static mount or an already-built dist.
// The strict, explicit port and cache are owned by this test alone.
test("normal dev delivers current, verifiable player bundles on a cold export", { timeout: 240_000 }, async (t) => {
  process.env.DEV_SERVER_NO_TLS = "1";
  process.env.VITE_CACHE_DIR = path.resolve(".vite-cache/export-delivery-16477");
  const server = await createServer({
    configLoader: "runner",
    server: { host: "127.0.0.1", port: 16477, strictPort: true, open: false },
  });
  t.after(() => server.close());
  await server.listen();
  const get = (url) => fetch(`http://127.0.0.1:16477${url}`, { signal: AbortSignal.timeout(180_000) });
  const cases = [
    ["/export-player/sdk-manifest.json", "application/json"],
    ["/standalone-player/standalone.js", "javascript"],
    ["/standalone-player/standalone.css", "text/css"],
  ];
  const responses = await Promise.all(cases.map(async ([url, mime]) => {
    const response = await get(url);
    const body = await response.text();
    console.log(JSON.stringify({ url, status: response.status, type: response.headers.get("content-type"), bytes: Buffer.byteLength(body), sha256: createHash("sha256").update(body).digest("hex"), prefix: body.slice(0, 70) }));
    return { url, mime, response, body };
  }));
  for (const { url, mime, response, body } of responses) {
    await t.test(url, () => {
      assert.equal(response.status, 200);
      assert.ok(response.headers.get("content-type")?.includes(mime));
      assert.doesNotMatch(body.slice(0, 200), /<!doctype html|<html/i);
    });
  }
  if (!responses[0].response.headers.get("content-type")?.includes("application/json")) return;
  const manifest = JSON.parse(responses[0].body);
  assert.ok(manifest.files.length > 0);
  for (const file of manifest.files) {
    const response = await get(`/export-player/${file.path}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200, file.path);
    assert.equal(bytes.length, file.bytes, file.path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, file.path);
  }
  const absent = await get("/standalone-player/absent.js");
  assert.equal(absent.status, 404);
  console.log(`Verified ${manifest.files.length} manifest-bound files; absent bundle returns 404.`);

  // Exercise the same export functions called by the menu with real HTTP ingredients.
  const { createBlankProject } = await server.ssrLoadModule("/src/project/defaults.ts");
  const { createStandaloneHtmlExport } = await server.ssrLoadModule("/src/project/standaloneExport.ts");
  const { createWebPlayerExportPackage } = await server.ssrLoadModule("/src/project/webExport.ts");
  const fetchBytes = async (url) => {
    const response = await get(url);
    assert.equal(response.status, 200, url);
    if (url !== "/export-player/player.html") {
      assert.ok(!response.headers.get("content-type")?.includes("text/html"), url);
    }
    return new Uint8Array(await response.arrayBuffer());
  };
  const project = createBlankProject();
  const standalone = await createStandaloneHtmlExport(project, { fetchBytes });
  const html = await standalone.blob.text();
  assert.deepEqual(standalone.summary.missingAssets, []);
  assert.ok(html.includes("#battle-flash-tint"));
  assert.ok(standalone.summary.assetCount > 100);
  console.log(JSON.stringify({ standaloneBytes: standalone.blob.size, assets: standalone.summary.assetCount, missingAssets: standalone.summary.missingAssets }));
  const zip = await createWebPlayerExportPackage(project, { fetchBytes });
  assert.ok(zip.summary.zipEntryCount > 100);
  console.log(JSON.stringify({ standaloneBytes: standalone.blob.size, assets: standalone.summary.assetCount, missingAssets: standalone.summary.missingAssets, zipBytes: zip.blob.size, zipEntries: zip.summary.zipEntryCount }));
  console.log("Real HTTP standalone and ZIP export succeeded; owned server closes in teardown.");
});
