import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import {
  OFFICIAL_GENRE_PACK_IDS,
  OFFICIAL_GENRE_PACK_REQUIREMENTS,
} from "@/project/officialGenrePackRequirements";
import { sha256HexText } from "@/util/sha256";

const createdDirectories: string[] = [];

afterEach(() => {
  for (const directory of createdDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("verify:genre-packs CLI", () => {
  it("rejects receipt evidence:'x' instead of passing on a non-existent path string", async () => {
    const evidenceRoot = resolve("output", "evidence");
    mkdirSync(evidenceRoot, { recursive: true });
    const directory = mkdtempSync(join(evidenceRoot, "genre-cli-negative-"));
    createdDirectories.push(directory);
    const projectRaw = serialize(createBlankProject());
    const projectRevision = await sha256HexText(projectRaw);
    const projectPath = join(directory, "project.json");
    const receiptPath = join(directory, "receipts.json");
    writeFileSync(projectPath, projectRaw, "utf8");
    writeFileSync(receiptPath, JSON.stringify(OFFICIAL_GENRE_PACK_IDS.map((packId) => ({
      schemaVersion: 1,
      packId,
      projectRevision,
      assertions: OFFICIAL_GENRE_PACK_REQUIREMENTS[packId].requiredAssertions.map((assertionId) => ({
        assertionId,
        status: "passed",
        evidence: "x",
      })),
    }))), "utf8");

    const result = runCli(receiptPath, projectPath);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("evidence-outside-allowed-root");
  }, 40_000);

  it("combines valid evidence files with actual authored/runtime readiness and keeps monster blocked", async () => {
    const evidenceRoot = resolve("output", "evidence");
    mkdirSync(evidenceRoot, { recursive: true });
    const directory = mkdtempSync(join(evidenceRoot, "genre-cli-matrix-"));
    createdDirectories.push(directory);
    const projectRaw = serialize(createBlankProject());
    const projectRevision = await sha256HexText(projectRaw);
    const projectPath = join(directory, "project.json");
    const receiptPath = join(directory, "receipts.json");
    writeFileSync(projectPath, projectRaw, "utf8");

    const receipts = OFFICIAL_GENRE_PACK_IDS.map((packId) => ({
      schemaVersion: 1 as const,
      packId,
      projectRevision,
      assertions: OFFICIAL_GENRE_PACK_REQUIREMENTS[packId].requiredAssertions.map((assertionId) => {
        const evidencePath = join(directory, `${packId}-${assertionId}.json`);
        writeFileSync(evidencePath, JSON.stringify({
          schemaVersion: 1,
          packId,
          assertionId,
          projectRevision,
          status: "passed",
        }), "utf8");
        return {
          assertionId,
          status: "passed" as const,
          evidence: relative(process.cwd(), evidencePath),
        };
      }),
    }));
    writeFileSync(receiptPath, JSON.stringify(receipts), "utf8");

    const result = runCli(receiptPath, projectPath);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain('"receiptVerification"');
    expect(output).toContain('"monster-collect"');
    expect(output).toContain('"status": "blocked"');
    expect(output).toContain('"status": "incomplete"');
    expect(output).toContain('"ok": false');
  }, 40_000);
});

function runCli(receiptPath: string, projectPath: string): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [
    resolve("node_modules", "vite-node", "vite-node.mjs"),
    "--script",
    resolve("scripts", "verify-genre-pack-receipts.mts"),
    receiptPath,
    projectPath,
  ], { cwd: process.cwd(), encoding: "utf8", timeout: 30_000 });
}
