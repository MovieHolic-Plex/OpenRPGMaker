import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { ownedConnection } from "./spatial-db-session.mts";
import type { DatabaseSurface } from "./spatial-db-q7.mts";

/** The only client mutation is a private bundle; production source is read-only. */
export async function proveMissingRpcGuard(http: DatabaseSurface, evidence: string) {
  const source = resolve("src/project/spatial/persistenceHttp.ts");
  const original = await readFile(source, "utf8");
  const guard = "if (!response.ok) {";
  assert.equal(original.split(guard).length, 2);
  const owned = ownedConnection().slice(5).split("/socket ")[0]; assert(owned);
  const temporary = await mkdtemp(`${owned}/http-guard.`);
  // The unchanged probe distinguishes rejected HTTP errors from success values.
  const probe = `
let rejected = false;
try {
  await requestSpatialJson(${JSON.stringify(http.config)}, {path: 'rpc/publish_spatial_project', body: {
    p_project_id: 'task20-missing-module', p_expected_sha256: null, p_project: {}, p_operation: 'create'
  }});
} catch (error) {
  if (!(error instanceof SpatialPersistenceError) || error.code !== 'migration-required') throw error;
  rejected = true;
}
if (!rejected) {
  process.stderr.write('SPATIAL_HTTP_GUARD_ACCEPTED_ERROR\\n');
  process.exitCode = 3;
}
`;
  try {
    for (const phase of ["red", "green"] as const) {
      const built = await Bun.build({ entrypoints: [source], target: "bun", outdir: temporary,
        naming: `${phase}.mjs`, plugins: [{ name: "isolated-http-guard", setup(builder) {
          builder.onLoad({ filter: /\/spatial\/persistenceHttp\.ts$/ }, () => ({ loader: "ts",
            contents: (phase === "red" ? original.replace(guard, "if (false) {") : original) + probe }));
        } }] });
      assert(built.success, JSON.stringify(built.logs));
      const child = Bun.spawn(["bun", resolve(temporary, `${phase}.mjs`)], { stdout: "pipe", stderr: "pipe" });
      const [status, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      await appendFile(resolve(evidence, phase === "red" ? "mutation-red.log" : "green.log"),
        JSON.stringify({ guard: "http-error-rejection", phase, status, stdout, stderr }) + "\n");
      switch (phase) {
        case "red": assert.equal(status, 3); assert.equal(stderr.trim(), "SPATIAL_HTTP_GUARD_ACCEPTED_ERROR"); break;
        case "green": assert.equal(status, 0); break;
        default: throw new TypeError(String(phase satisfies never));
      }
    }
    assert.equal(await readFile(source, "utf8"), original);
    await appendFile(resolve(evidence, "guard-definitions.jsonl"), JSON.stringify({ name: "http-error-rejection",
      source, sha256: createHash("sha256").update(original).digest("hex"), guard, mutation: "if (false) {",
      originalSourceUnchanged: true, isolatedBundleOnly: true }) + "\n");
  } finally { await rm(temporary, { recursive: true }); }
}
