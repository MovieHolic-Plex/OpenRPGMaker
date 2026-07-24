import assert from "node:assert/strict";
import test from "node:test";
import { codexProcessSpec } from "../scripts/lib/codexProcess.mjs";

test("Windows launches the native Codex executable instead of a cmd shim", () => {
  const spec = codexProcessSpec("win32");
  assert.equal(spec.command, "codex.exe");
  assert.deepEqual(spec.args, ["app-server", "--listen", "stdio://"]);
});

test("POSIX launches Codex from PATH", () => {
  const spec = codexProcessSpec("linux");
  assert.equal(spec.command, "codex");
});
