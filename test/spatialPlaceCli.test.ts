import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deserialize } from "../src/project/io";
import { inspectNestedTraversal } from "./support/spatialPlaceTraversal";

describe("nested-places CLI", () => {
  it("executes generated transfers through the engine when three requested seeds compile", () => {
    // Given: a per-run evidence sandbox, with no live DB or editor store.
    const directory = mkdtempSync(join(tmpdir(), "task9-cli-"));
    try {
      // When: execute the real CLI with its requested scenario and seeds.
      const result = spawnSync("bun", ["run", "scripts/qa/spatial-compile.mts", "--scenario", "nested-places", "--seeds", "7,19,31", "--evidence", directory],
        { encoding: "utf8", timeout: 90000, stdio: ["ignore", "pipe", "pipe"] });
      // Then: actual serialized proposals execute four directed stair routes each.
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      for (const seed of [7, 19, 31]) {
        const proposal = deserialize(readFileSync(join(directory, `proposal-${seed}.json`), "utf8"));
        const receipt = inspectNestedTraversal(proposal);
        expect(receipt.routes).toHaveLength(4);
        expect(receipt.routes.every(route => route.walk.length > 1 && route.executedTransfer.kind === "transfer")).toBe(true);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 120000);

  it("exits unsuccessfully without a proposal when a persisted landing is blocked", () => {
    // Given: an isolated CLI evidence directory and the explicit error-path fixture.
    const directory = mkdtempSync(join(tmpdir(), "task9-cli-failure-"));
    try {
      // When: drive the failure through the same public command, not a diagnostic witness.
      const result = spawnSync("bun", ["run", "scripts/qa/spatial-compile.mts", "--scenario", "nested-places", "--seeds", "7",
        "--fault", "blocked-port", "--evidence", directory], { encoding: "utf8", timeout: 90000, stdio: ["ignore", "pipe", "pipe"] });
      // Then: the real exit is nonzero and its machine-readable rejection names the landing.
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      const rejection: unknown = JSON.parse(readFileSync(join(directory, "rejection.json"), "utf8"));
      expect(rejection).toMatchObject({ code: "port", callerUnchanged: true, partialProposal: false });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 120000);
});
