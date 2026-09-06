import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startPlayerQaServer } from "../../../../../scripts/lib/runtimeQaRun.mjs";
import { provePictureCancellationContinuation } from "../../../../../scripts/qa/runtime/event-command-remediation-u04.scenario.mjs";

const fixture = process.argv[2];
assert.ok(fixture, "Pass the existing exported U04 editor project");
const original = JSON.parse(await readFile(fixture, "utf8"));
const out = ".omo/evidence/event-command-remediation/U04/followup-continuation/player-focused";
const temporary = await mkdtemp(join(tmpdir(), "u04-continuation-"));
const cache = await mkdtemp(join(tmpdir(), "u04-continuation-cache-"));
Object.assign(process.env, { VITE_CACHE_DIR: cache, E2E_FREEZE_DEV_SERVER: "1", VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", VITE_SUPABASE_USE_PROXY: "0" });
await mkdir(out, { recursive: true });
let server;
const receipts = [];
try {
  server = await startPlayerQaServer();
  for (const operation of ["replacement", "erase"]) {
    receipts.push(await provePictureCancellationContinuation(server, original, temporary, out, operation));
  }
  await writeFile(join(out, "SUMMARY.md"), receipts.map(receipt => `- ${receipt.report}: PASS`).join("\n") + "\n");
} finally {
  await server?.close();
  await rm(temporary, { recursive: true, force: true });
  await rm(cache, { recursive: true, force: true });
  await writeFile(join(out, "cleanup.json"), JSON.stringify({ serverPort: server?.port, serverClosed: true, browsersClosedByCase: true, temporaryRemoved: temporary, cacheRemoved: cache, completedCases: receipts.length }, null, 2));
  console.log("Focused U04 cleanup: browsers/server closed; temporary fixtures/cache removed");
}
