import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { exerciseExport } from "../scripts/lib/exportPlayability.mjs";

const prefix = `http://export-qa.test/play/${"release-".repeat(30)}/assets/bgm/field-of-dreams.`;
const decodedUrl = `${prefix}mp3`;
const otherUrl = `${prefix}ogg`;

async function observeFailures(requests, responses = []) {
  const page = new EventEmitter();
  // Exercise the real subscriptions and report, stopping before unrelated
  // gameplay. Events are emitted only after exerciseExport installs handlers.
  page.goto = async () => {
    for (const { url, type, error } of requests) {
      page.emit("requestfailed", {
        url: () => url,
        resourceType: () => type,
        failure: () => ({ errorText: error }),
      });
    }
    for (const { url, status } of responses) {
      page.emit("response", { url: () => url, status: () => status });
    }
    throw new Error("TEST_NAVIGATION_STOP");
  };
  page.evaluate = async () => false;
  page.screenshot = async () => {};
  const result = await exerciseExport(page, { url: "http://export-qa.test/", kind: "network-identity", outDir: "." });
  assert.equal(result.pass, false);
  return result.failures;
}

test("export QA preserves full long media URLs and distinguishes identical 200-character prefixes", async () => {
  assert.ok(decodedUrl.length > 200);
  assert.equal(decodedUrl.slice(0, 200), otherUrl.slice(0, 200));
  const requests = [decodedUrl, otherUrl].map(url => ({ url, type: "media", error: "net::ERR_ABORTED" }));
  const failures = await observeFailures(requests);
  assert.deepEqual(failures, requests);
  assert.equal(new Set(failures.map(failure => failure.url)).size, 2);
  assert.equal(failures[0].url, decodedUrl);
  assert.notEqual(failures[1].url, decodedUrl);
});

test("export QA retains genuine network failure identity, type, error and HTTP status", async () => {
  const requests = [
    { url: decodedUrl, type: "media", error: "net::ERR_FAILED" },
    { url: decodedUrl, type: "image", error: "net::ERR_ABORTED" },
    { url: otherUrl, type: "media", error: "net::ERR_ABORTED" },
  ];
  const responses = [{ url: otherUrl, status: 404 }];
  assert.deepEqual(await observeFailures(requests, responses), [...requests, ...responses]);
});
