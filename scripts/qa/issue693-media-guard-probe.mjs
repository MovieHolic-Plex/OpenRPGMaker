import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, firefox } from "playwright";
import { installMediaWriteGuard, observeMediaUi } from "./issue693-media-guard.mjs";

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded(signal) {
  let timer;
  try {
    return await Promise.race([signal, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Local probe event did not arrive")), 20_000);
    })]);
  } finally { clearTimeout(timer); }
}

const output = process.env.MEDIA_QA_PROBE_OUTPUT ?? "/dev/shm/rpg-zzu-issue693-media/guard-probe";
await mkdir(output, { recursive: true });
const received = [];
const relayedGets = [];
const corsPreflights = [];
const uploaded = deferred();
const releaseResponse = deferred();
const handleRequest = async (request, response) => {
  if (request.headers.origin) response.setHeader("Access-Control-Allow-Origin", request.headers.origin);
  if (request.method === "OPTIONS") {
    corsPreflights.push(request.headers["access-control-request-headers"] ?? "");
    response.setHeader("Access-Control-Allow-Methods", "POST, DELETE");
    response.setHeader("Access-Control-Allow-Headers", "content-type");
    response.writeHead(204); response.end(); return;
  }
  if (request.method === "GET") {
    if (request.url === "/relay-proof") {
      const token = randomUUID();
      const body = `actual-upstream:${token}`;
      relayedGets.push({ token, body, profile: request.headers["accept-profile"], authorization: request.headers.authorization });
      response.writeHead(202, { "Content-Type": "text/plain", "X-Local-Proof": token });
      response.end(body); return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end("<!doctype html><title>Local media guard probe</title>");
    return;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  received.push({ method: request.method, url: request.url, bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"), headers: Object.keys(request.headers) });
  if (received.length === 1) {
    uploaded.resolve();
    await releaseResponse.promise;
  }
  response.writeHead(201, { "Content-Type": "application/json" });
  response.end('{"acceptedByLocalServer":true}');
};
const server = createServer(handleRequest);
const crossServer = createServer(handleRequest);
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const base = `http://127.0.0.1:${server.address().port}`;
await new Promise((resolve, reject) => {
  crossServer.once("error", reject);
  crossServer.listen(0, "127.0.0.1", resolve);
});
const crossBase = `http://127.0.0.1:${crossServer.address().port}`;
const report = { remoteProjectId: null, remoteWrites: 0, blockedMutations: [], bodyObservations: [], checks: [], remoteRequests: 0 };
const browserName = process.env.MEDIA_QA_PROBE_BROWSER ?? "chromium";
report.browser = browserName;
let browser;
let guard;
try {
  browser = await ({ chromium, firefox }[browserName]).launch({ headless: true,
    ...(process.env.MEDIA_QA_CHANNEL ? { channel: process.env.MEDIA_QA_CHANNEL } : {}) });
  const context = await browser.newContext({ serviceWorkers: "block" });
  context.on("request", request => {
    if (new URL(request.url()).origin !== base) report.remoteRequests++;
  });
  guard = await installMediaWriteGuard(context, {
    report, permitRemoteCopy: true, relayOrigin: base,
    getConfig: () => ({ projectId: "oprn-1111111111", restUrl: `${base}/rest/v1/` }),
  });
  const page = await context.newPage();
  await page.goto(base);
  const relay = await page.evaluate(async () => {
    const response = await fetch("/relay-proof", { headers: { "Accept-Profile": "rpg_zzu", Authorization: "Bearer local-probe" } });
    return { status: response.status, token: response.headers.get("x-local-proof"), body: await response.text() };
  });
  assert.equal(relayedGets.length, 1);
  assert.deepEqual(relay, { status: 202, token: relayedGets[0].token, body: relayedGets[0].body });
  assert.equal(relayedGets[0].profile, "rpg_zzu");
  assert.equal(relayedGets[0].authorization, "Bearer local-probe");
  report.checks.push("GET-relay-preserves-actual-status-body-and-auth-profile-headers");
  const expected = await page.evaluate(async () => {
    const body = JSON.stringify({ project_id: "oprn-2222222222", current_json: { media: "A".repeat(12 * 1024 * 1024) } });
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)))].map(b => b.toString(16).padStart(2, "0")).join("");
    window.probeSettled = false;
    window.probeNativeResult = fetch("/rest/v1/projects?on_conflict=project_id", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    void window.probeNativeResult.then(() => { window.probeSettled = true; }, () => { window.probeSettled = true; });
    return { bytes: new TextEncoder().encode(body).length, digest, nativePromise: window.probeNativeResult instanceof Promise };
  });
  await bounded(Promise.race([uploaded.promise, guard.failure.then(error => { throw new Error(JSON.stringify(error)); })]));
  assert.equal(expected.nativePromise, true);
  assert.equal(await page.evaluate(() => window.probeSettled), false, "Native response must remain pending until the server replies");
  releaseResponse.resolve();
  const outcome = await page.evaluate(async () => {
    const response = await window.probeNativeResult;
    return { status: response.status, result: await response.json() };
  });
  assert.equal(outcome.status, 201);
  assert.deepEqual(outcome.result, { acceptedByLocalServer: true });
  assert.equal(received.length, 1);
  assert.equal(received[0].bytes, expected.bytes);
  assert.equal(received[0].sha256, expected.digest);
  assert.equal(report.bodyObservations[0].available, true, "Large POST must be inspected directly, not inferred");
  assert(!received[0].headers.includes("x-oprn-media-qa-correlation"));
  assert.equal(received[0].url, "/rest/v1/projects?on_conflict=project_id");
  report.checks.push("large-body-native-byte-equality", "native-promise-pending-until-real-response", "original-url-and-headers-forwarded");

  // Same URL, overlapping native requests: inspect each actual body and every row.
  // The invalid last row is in a >12 MiB body.
  const simultaneous = await page.evaluate(async () => {
    const valid = JSON.stringify([{ project_id: "oprn-2222222222", map_id: "one" }, { project_id: "oprn-2222222222", map_id: "two" }]);
    const invalid = JSON.stringify([{ project_id: "oprn-2222222222", map_json: "A".repeat(12 * 1024 * 1024) }, { project_id: "oprn-3333333333" }]);
    const send = body => fetch("/rest/v1/maps?on_conflict=project_id,map_id", { method: "POST", headers: { "Content-Type": "application/json" }, body })
      .then(response => ({ status: response.status }), error => ({ error: error.name }));
    return Promise.all([send(invalid), send(valid)]);
  });
  assert.deepEqual(simultaneous, [{ error: "TypeError" }, { status: 201 }]);
  assert.equal(received.length, 2);
  assert.equal(report.bodyObservations.at(-1).rows, 2);
  report.checks.push("same-url-concurrent-native-bodies", "every-row-validated-in-large-child-post");

  const boundaries = await page.evaluate(async () => {
    const send = (path, init) => fetch(`/rest/v1/${path}`, init).then(response => response.status, () => "blocked");
    const post = body => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return {
      ownedDelete: await send("maps?project_id=eq.oprn-2222222222", { method: "DELETE" }),
      ownedTilesets: await send("tilesets?on_conflict=project_id,tileset_id", post([{ project_id: "oprn-2222222222", tileset_id: "one" }])),
      shared: await send("projects?on_conflict=project_id", post({ project_id: "oprn-1111111111" })),
      otherCopy: await send("projects?on_conflict=project_id", post({ project_id: "oprn-3333333333" })),
      wrongDelete: await send("tilesets?project_id=eq.oprn-3333333333", { method: "DELETE" }),
      background: await send("editor_identities", post({ id: "unrelated" })),
      invalidJson: await send("projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }),
      wrongEndpoint: await fetch("/wrong/rest/v1/projects", post({ project_id: "oprn-2222222222" })).then(response => response.status, () => "blocked"),
      noBody: await new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/rest/v1/projects");
        xhr.onload = () => resolve(xhr.status);
        xhr.onerror = () => resolve("blocked");
        xhr.send();
      }),
    };
  });
  assert.deepEqual(boundaries, { ownedDelete: 201, ownedTilesets: 201, shared: "blocked", otherCopy: "blocked", wrongDelete: "blocked",
    background: "blocked", invalidJson: "blocked", wrongEndpoint: "blocked", noBody: "blocked" });
  assert.equal(received.length, 4, "Only the four owned requests may reach the local server");
  assert(received.every(request => !request.headers.includes("x-oprn-media-qa-correlation")));
  assert(received.every(request => !request.url.includes("__oprn_media_qa_request")));
  report.checks.push("owned-child-post-delete", "shared-second-target-and-unknown-writes-blocked", "missing-body-fails-closed", "wrong-endpoint-blocked");

  const uiError = await observeMediaUi(page, '[data-testid="toast"].ok', { fresh: true, rejectOnError: true });
  await page.evaluate(() => {
    const toast = document.createElement("div");
    toast.dataset.testid = "toast"; toast.className = "error"; toast.textContent = "probe-error-sentinel";
    document.body.append(toast);
  });
  await assert.rejects(bounded(uiError()), { code: "ui-error" });
  const guardError = await observeMediaUi(page, ".never-published", { guardFailure: guard.failure });
  await assert.rejects(bounded(guardError()), { code: "guard-rejected" });
  report.checks.push("ui-toast-and-guard-errors-end-wait-without-success");
  const crossContext = await browser.newContext({ serviceWorkers: "block" });
  // Chrome separately prompts for a second loopback origin after a relayed
  // navigation. Grant only this local fixture's browser permission, not CORS
  // response headers or any project authority. The editor harness grants none.
  await crossContext.grantPermissions(["local-network-access"], { origin: base });
  crossContext.on("request", request => { if (![base, crossBase].includes(new URL(request.url()).origin)) report.remoteRequests++; });
  const crossReport = { remoteProjectId: null, remoteWrites: 0, blockedMutations: [], bodyObservations: [] };
  report.crossOrigin = crossReport;
  await installMediaWriteGuard(crossContext, {
    report: crossReport, permitRemoteCopy: true, relayOrigin: base,
    getConfig: () => ({ projectId: "oprn-1111111111", restUrl: `${crossBase}/rest/v1/` }),
  });
  const crossPage = await crossContext.newPage();
  crossReport.browserErrors = [];
  crossPage.on("console", message => { if (message.type() === "error") crossReport.browserErrors.push(message.text()); });
  crossContext.on("requestfailed", request => { crossReport.browserErrors.push(request.failure()?.errorText); });
  await crossPage.goto(base);
  const crossResult = await crossPage.evaluate(async target => {
    try {
      const response = await fetch(`${target}/rest/v1/projects?on_conflict=project_id`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: "oprn-2222222222", media: "A".repeat(12 * 1024 * 1024) }),
      });
      return { status: response.status, result: await response.json() };
    } catch (error) { return { error: error.name }; }
  }, crossBase);
  assert.equal(crossResult.status, 201, "Native POST must pass the fixture's ordinary content-type CORS policy");
  assert.equal(received.length, 5);
  assert(corsPreflights.every(headers => !headers.includes("x-oprn-media-qa-correlation")));
  report.checks.push("cross-origin-native-fetch-with-unchanged-CORS-headers");
  assert.equal(report.remoteRequests, 0);
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  releaseResponse.resolve();
  await browser?.close();
  server.closeAllConnections();
  crossServer.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => crossServer.close(resolve));
  report.corsPreflights = corsPreflights;
  report.received = received;
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
