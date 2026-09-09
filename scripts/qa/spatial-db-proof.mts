import "./spatial-local-only.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { postgrest } from "./spatial-postgrest.mts";
import { q7Guards } from "./spatial-db-q7.mts";
import { storeProof } from "./spatial-db-store.mts";

export async function runDatabaseProof(scenario: "stale-writers" | "mirror-failure", evidence: string) {
  await mkdir(evidence, { recursive: true });
  await using http = await postgrest(evidence);
  switch (scenario) {
    case "stale-writers":
      await storeProof(http, scenario, evidence);
      await q7Guards(http, evidence);
      break;
    case "mirror-failure": await storeProof(http, scenario, evidence); break;
    default: throw new TypeError(String(scenario satisfies never));
  }
  console.log(JSON.stringify({ scenario, realDatabase: true, evidence }));
}
if (import.meta.main) {
  const evidence = process.env["SPATIAL_TEST_EVIDENCE"];
  assert(evidence);
  const scope = process.argv[2] ?? "all";
  assert(["all", "Q7", "Q8", "Q9"].includes(scope));
  const commands = [
    ["scripts/qa/spatial-persistence.mts", "--project", "task20", "--scenario", "stale-writers", "--evidence", resolve(evidence, "Q7")],
    ["scripts/qa/spatial-persistence.mts", "--project", "task20", "--scenario", "mirror-failure", "--evidence", resolve(evidence, "Q8")],
    ["scripts/qa/spatial-migration.mts", "--scenario", "legacy-matrix", "--evidence", resolve(evidence, "Q9")],
  ];
  for (const command of commands) {
    if (scope !== "all" && command.at(-1) !== resolve(evidence, scope)) continue;
    console.log(JSON.stringify({ command: ["bun", ...command] }));
    const child = Bun.spawn(["bun", ...command], { stdout: "inherit", stderr: "inherit", env: process.env });
    assert.equal(await child.exited, 0, command.join(" "));
  }
}
