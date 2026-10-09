import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const runner = resolve("scripts/audio-ai-descriptions-run.mjs");
function runCase(response, args = [], missing = false) {
  const dir = mkdtempSync(join(tmpdir(), "audio-runner-test-"));
  try {
    const bin = join(dir, "bin");
    const scratch = join(dir, "scratch");
    mkdirSync(bin); mkdirSync(scratch);
    writeFileSync(join(bin, "agy"), '#!/usr/bin/env node\nconst a=process.argv.slice(2);console.log(JSON.stringify({...JSON.parse(process.env.AUDIO_TEST_RESPONSE),receivedModel:a[a.indexOf("--model")+1]}));\n', { mode: 0o755 });
    const manifest = join(dir, "manifest.json");
    writeFileSync(manifest, JSON.stringify([{ id: "qa-audio", kind: "sound", source: "local", path: missing ? "missing.wav" : "assets/cc0/audio/ui-confirm.wav" }]));
    const out = join(dir, "result.jsonl");
    const result = spawnSync("bun", [runner, "--manifest", manifest, "--out", out, ...args], {
      encoding: "utf8", timeout: 15000,
      env: { ...process.env, TMPDIR: scratch, PATH: bin + ":" + process.env.PATH, AUDIO_TEST_RESPONSE: JSON.stringify(response) },
    });
    assert.equal(result.error, undefined);
    const record = JSON.parse(readFileSync(out, "utf8").trim());
    assert.deepEqual(readdirSync(scratch), [], "runner must remove temporary audio");
    return { code: result.status, record };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test("defaults to Pro and passes the selected model to the analyzer", () => {
  const { code, record } = runCase({ audio_available: true, description: "QA_VALID_AUDIO" });
  assert.equal(code, 0);
  assert.equal(record.status, "ok");
  assert.equal(record.model, "gemini-3.1-pro-high");
  assert.equal(record.result.receivedModel, record.model);
});
test("preserves an explicitly chosen model", () => {
  const { code, record } = runCase({ audio_available: true, description: "QA_VALID_AUDIO" }, ["--model", "gemini-3.8-flash-high"]);
  assert.equal(code, 0);
  assert.equal(record.result.receivedModel, "gemini-3.8-flash-high");
});
for (const response of [{ description: "missing flag" }, { audio_available: "true", description: "wrong flag type" }, { audio_available: true, description: "" }, { audio_available: true, description: " ", }, { audio_available: true, description: "x".repeat(4001) }]) {
  test("rejects malformed analysis " + JSON.stringify(response).slice(0,80), () => {
    const { code, record } = runCase(response);
    assert.equal(record.status, "fail");
    assert.notEqual(code, 0);
  });
}
test("no audio is not a successful batch exit", () => {
  const { code, record } = runCase({ audio_available: false, description: "not available" });
  assert.equal(record.status, "no-audio");
  assert.notEqual(code, 0);
});
test("input failure is recorded and returns nonzero", () => {
  const { code, record } = runCase({}, [], true);
  assert.equal(record.status, "fail");
  assert.notEqual(code, 0);
});
