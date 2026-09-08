import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { before, after, describe, it } from "node:test";

const bytes = await readFile(new URL("../public/icons/pwa-192.png", import.meta.url));
const base64 = bytes.toString("base64");
const jwt = (claims) => "eyJhbGciOiJub25lIn0." + Buffer.from(JSON.stringify(claims)).toString("base64url") + ".test-signature";
const accountId = "test-account-not-a-real-account";
const token = jwt({ "https://api.openai.com/auth": { chatgpt_account_id: accountId } });
let reply = { status: 200, body: { data: [{ b64_json: base64 }] } };
const upstreamCalls = [];
let server, worker, workerPort;
async function request(body, provider = "openai-codex", apiKey = token) {
  const response = await fetch("http://127.0.0.1:" + workerPort + "/image", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, apiKey, body }), signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, body: await response.json() };
}

describe("Codex native image real worker dispatch and transport", () => {
  before(async () => {
    server = createServer(async (req, res) => {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      upstreamCalls.push({ headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString()) });
      res.writeHead(reply.status, { "Content-Type": "application/json" });
      res.end(typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body));
    });
    const listening = once(server, "listening"); server.listen(0, "127.0.0.1"); await listening;
    worker = spawn("bun", ["--preload", "./test/codexImageWorker.preload.ts", "./scripts/oh-my-pi-worker.ts"], {
      cwd: new URL("..", import.meta.url), stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, RPG_ZZU_OH_MY_PI_WORKER_PORT: "0", RPG_ZZU_OH_MY_PI_TEST_STUB: "0", CODEX_IMAGE_TEST_UPSTREAM: "http://127.0.0.1:" + server.address().port },
    });
    let stderr = ""; worker.stderr.on("data", data => { stderr += data; });
    workerPort = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error("Worker readiness deadline: " + stderr)), 15000);
      worker.once("error", error => { clearTimeout(timer); reject(error); });
      worker.once("exit", code => { clearTimeout(timer); reject(new Error("Worker exited before ready: " + code + " " + stderr)); });
      worker.stdout.on("data", chunk => { output += chunk; const match = output.match(/READY (\d+)/); if (match) { clearTimeout(timer); resolve(Number(match[1])); } });
    });
  });
  after(async () => {
    if (worker && worker.exitCode === null) { const closed = once(worker, "close"); worker.kill(); await closed; }
    if (server) { const closed = once(server, "close"); server.close(); server.closeAllConnections(); await closed; }
  });
  it("routes the sentinel to native OAuth image transport and preserves original bytes", async () => {
    const result = await request({ prompt: "wizard", model: "codex-image-default" });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { provider: "openai-codex", model: "codex-image-default", mimeType: "image/png", base64 });
    assert.deepEqual(upstreamCalls.at(-1).body, { prompt: "wizard", n: 1, size: "1024x1024" });
    assert.equal(upstreamCalls.at(-1).headers.authorization, "Bearer " + token);
    assert.equal(upstreamCalls.at(-1).headers["chatgpt-account-id"], accountId);
  });
  it("accepts omitted model and empty references without inventing a version", async () => {
    const result = await request({ prompt: "wizard", referenceImages: [] });
    assert.equal(result.status, 200); assert.equal(result.body.model, "codex-image-default");
    assert.equal(Object.hasOwn(upstreamCalls.at(-1).body, "model"), false);
  });
  it("rejects every explicit nondefault model before transport", async () => {
    for (const model of ["gpt-image-2", "gpt-5.4", "", null, 42]) {
      const count = upstreamCalls.length;
      assert.equal((await request({ prompt: "wizard", model })).status, 400);
      assert.equal(upstreamCalls.length, count);
    }
  });
  it("does not silently drop references or accept malformed reference containers", async () => {
    for (const [referenceImages, status] of [[[{ mimeType: "image/png", data: base64 }], 409], [null, 400], [{}, 400]]) {
      const count = upstreamCalls.length;
      assert.equal((await request({ prompt: "wizard", referenceImages })).status, status);
      assert.equal(upstreamCalls.length, count);
    }
  });
  it("rejects missing prompt and unusable OAuth account claim without transport", async () => {
    const count = upstreamCalls.length;
    assert.equal((await request({ prompt: " " })).status, 400);
    for (const credential of ["", "not-a-jwt", jwt({}), jwt({ "https://api.openai.com/auth": { chatgpt_account_id: 42 } })]) {
      assert.equal((await request({ prompt: "wizard" }, "openai-codex", credential)).status, 401);
    }
    assert.equal(upstreamCalls.length, count);
  });
  it("preserves HTTP permission/rate-limit outcomes without exposing credentials", async () => {
    for (const status of [401, 403, 429, 503]) {
      reply = { status, body: { error: { message: "upstream failure " + token + " " + accountId } } };
      const result = await request({ prompt: "wizard" }); assert.equal(result.status, status);
      assert.equal(JSON.stringify(result).includes(token), false); assert.equal(JSON.stringify(result).includes(accountId), false);
    }
  });
  it("reports malformed/no-image responses, invalid base64 and unsupported bytes", async () => {
    for (const body of ["not-json", null, {}, { data: [] }, { data: [null] }, { data: [{ b64_json: base64 }, { b64_json: base64 }] }, { data: [{ b64_json: "bad!" }] }, { data: [{ b64_json: Buffer.from("not an image").toString("base64") }] }]) {
      reply = { status: 200, body }; assert.equal((await request({ prompt: "wizard" })).status, 502);
    }
  });
  it("retains other-provider dispatch", async () => {
    assert.equal((await request({ prompt: " " }, "google-antigravity")).status, 400);
    assert.equal((await request({ prompt: "wizard" }, "unknown-provider")).status, 409);
  });
  it("preserves JPEG bytes and detects MIME instead of trusting format labels", async () => {
    const jpeg = await readFile(new URL("../public/assets/generated/welcome/_cinematic_backup/slide-03.jpg", import.meta.url));
    reply = { status: 200, body: { output_format: "png", data: [{ b64_json: jpeg.toString("base64") }] } };
    const result = await request({ prompt: "wizard" });
    assert.equal(result.status, 200); assert.equal(result.body.mimeType, "image/jpeg");
    assert.deepEqual(Buffer.from(result.body.base64, "base64"), jpeg);
  });
  it("reports a deadline when body consumption aborts after response headers", async (t) => {
    // Given: a response body subscribed to the request deadline before it fires.
    const { generateCodexImage } = await import("../scripts/lib/codexImageRuntime.ts");
    const deadline = new AbortController();
    t.mock.method(AbortSignal, "timeout", () => deadline.signal);
    const result = generateCodexImage({ prompt: "wizard" }, { apiKey: token, fetch: async () =>
      new Response(new ReadableStream({ start(controller) {
        deadline.signal.addEventListener("abort", () => controller.error(new DOMException("Body aborted", "AbortError")), { once: true });
      } }))
    });
    // When: the deadline aborts the body using fetch's AbortError behavior.
    deadline.abort(new DOMException("Deadline exceeded", "TimeoutError"));
    // Then: the app reports a deadline, not a generic upstream failure.
    await assert.rejects(result, error => { assert.equal(error.status, 504); return true; });
  });
  it("uses a 180-second bound, manual redirects, and reports deadline/network failures", async (t) => {
    const { generateCodexImage } = await import("../scripts/lib/codexImageRuntime.ts");
    const originalTimeout = AbortSignal.timeout;
    t.mock.method(AbortSignal, "timeout", ms => { assert.equal(ms, 180000); return originalTimeout(ms); });
    for (const [failure, status] of [[new DOMException("deadline", "TimeoutError"), 504], [new Error("network " + token), 502]]) {
      await assert.rejects(generateCodexImage({ prompt: "wizard" }, { apiKey: token, fetch: async (_url, init) => {
        assert.equal(init.redirect, "manual"); assert.ok(init.signal instanceof AbortSignal);
        throw failure;
      } }), error => { assert.equal(error.status, status); assert.equal(error.message.includes(token), false); return true; });
    }
    await assert.rejects(generateCodexImage({ prompt: "wizard" }, { apiKey: token, fetch: async () =>
      new Response(new ReadableStream({ start(controller) { controller.error(new DOMException("deadline", "TimeoutError")); } }))
    }), error => { assert.equal(error.status, 504); return true; });
    await assert.rejects(generateCodexImage({ prompt: "wizard" }, { apiKey: token, fetch: async () =>
      new Response("", { status: 302, headers: { Location: "https://example.invalid" } })
    }), error => { assert.equal(error.status, 502); return true; });
  });
});
