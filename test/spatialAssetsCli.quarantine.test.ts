import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("proves the asset contract through real IO when the task29 CLI executes", async () => {
  // Given: isolated across runs and checkouts; no network or shared output root.
  const evidence = await mkdtemp(join(tmpdir(), "spatial-assets-cli-"));
  try {
    // When
    await promisify(execFile)("bun", ["--tsconfig-override", "tsconfig.app.json", "scripts/qa/spatial-assets.mts", "--evidence", evidence], { timeout: 30_000 });
    // Then
    const report: unknown = JSON.parse(await readFile(join(evidence, "assets.json"), "utf8"));
    expect(report).toMatchObject({ verdict: "passed", builtinGraphics: 55, authoredOverrides: 3, rejectedAtlases: 8, rejectedUnknownIds: 3, sourceUnchanged: true, converterImplemented: false, remoteWrites: 0 });
  } finally {
    await rm(evidence, { recursive: true, force: true });
  }
}, 35_000);
