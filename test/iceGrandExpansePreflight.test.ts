import { execFileSync } from "node:child_process";
import { mkdtemp, rename, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runBoundedCommand } from "../scripts/ice-grand-expanse/boundedCommand.mjs";
import { hashValue } from "../scripts/ice-grand-expanse/preflightCore.mjs";
import {
  classifyGitSourceStateDrift,
  collectGitSourceState,
  collectPathSet,
  findDirtyInventoryDrift,
  findGitSourceStateDrift,
  findPathSetDrift,
} from "../scripts/ice-grand-expanse/preflightGit.mjs";
import { readProtectedBaseline } from "../scripts/ice-grand-expanse/preflightRemote.mjs";
import { initializePreflightGitFixture } from "./helpers/iceGrandExpansePreflightGitFixture.js";
import {
  PreflightError,
  assertNoDirtyOverlap,
  buildSourceManifest,
  collectTreeLocations,
  normalizeSupabaseOrigin,
  parsePreflightArgs,
  stableJson,
} from "../scripts/preflight-ice-grand-expanse.mjs";

describe("ice grand expanse preflight", () => {
  it("parses only an explicit project and scoped fresh output", () => {
    const parsed = parsePreflightArgs([
      "--project-id",
      "rpg-zzu-dungeon-theme-gallery",
      "--out",
      "output/evidence/ice-grand-expanse/run-20260722/task-1",
    ]);

    expect(parsed).toEqual({
      out: "output/evidence/ice-grand-expanse/run-20260722/task-1",
      projectId: "rpg-zzu-dungeon-theme-gallery",
    });
  });

  it.each([
    { argv: [], code: "ARGUMENT_INVALID" },
    { argv: ["--project-id", "x"], code: "ARGUMENT_INVALID" },
    { argv: ["--out", "x"], code: "ARGUMENT_INVALID" },
    { argv: ["--project-id", "x", "--out", "../escape/task-1"], code: "ARGUMENT_INVALID" },
  ])("rejects malformed CLI input before any IO: $argv", ({ argv, code }) => {
    expect(() => parsePreflightArgs(argv)).toThrowError(expect.objectContaining({ code }));
  });

  it("normalizes Supabase identity to a secret-free origin", () => {
    expect(normalizeSupabaseOrigin("HTTPS://Example.Supabase.Co/path/?token=secret#x")).toBe(
      "https://example.supabase.co",
    );
  });

  it("canonicalizes object keys without reordering arrays", () => {
    expect(stableJson({ z: 1, a: { y: 2, x: 3 }, list: [{ b: 2, a: 1 }, 4] })).toBe(
      '{"a":{"x":3,"y":2},"list":[{"a":1,"b":2},4],"z":1}',
    );
  });

  it("finds every exact tree location so duplicates cannot be hidden", () => {
    const tree = {
      mapId: "root",
      children: [
        { mapId: "canonical", children: [{ mapId: "adventure", children: [] }] },
        { mapId: "canonical", children: [] },
      ],
    };

    expect(collectTreeLocations(tree, "canonical")).toEqual([
      { childIndexes: [0], mapIds: ["root", "canonical"] },
      { childIndexes: [1], mapIds: ["root", "canonical"] },
    ]);
  });

  it("builds a self-bound source manifest deterministically", async () => {
    const input = {
      gitHeadOrNull: "abc123",
      runId: "run-20260722",
      startedAt: "2026-07-22T00:00:00.000Z",
      supabaseOriginSha256: "f".repeat(64),
      targetProjectId: "rpg-zzu-dungeon-theme-gallery",
      trackedDiffSha256: "a".repeat(64),
      untrackedInventorySha256: "b".repeat(64),
    };
    const first = await buildSourceManifest(input);
    const second = await buildSourceManifest(input);

    expect(first).toEqual(second);
    expect(first.sourceManifestSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(first).toMatchObject(input);
  });

  it("exposes typed failures without leaking external response bodies", () => {
    const error = new PreflightError("PROJECT_NOT_FOUND", "Explicit project was not found");

    expect(error.code).toBe("PROJECT_NOT_FOUND");
    expect(error.message).toBe("Explicit project was not found");
  });

  it("runs an argv command without shell-quoting it into a false failure", async () => {
    const receipt = await runBoundedCommand({
      argv: [process.execPath, "-e", "process.stdout.write('ok')"],
      cwd: process.cwd(),
      phase: "runner-smoke",
      timeoutMs: 5_000,
    });

    expect(receipt).toMatchObject({ exitCode: 0, signal: null, timedOut: false });
    expect(receipt.stdoutSha256).toBe("2689367b205c16ce32ed4200942b8b8b1e262dfc70d9bc9fbc77c49699a4f1df");
  });

  it("resolves the Windows npm shim without invoking cmd quoting", async () => {
    const receipt = await runBoundedCommand({ argv: ["npm", "--version"], cwd: process.cwd(), phase: "npm-smoke", timeoutMs: 5_000 });

    expect(receipt).toMatchObject({ exitCode: 0, signal: null, timedOut: false });
  });

  it("detects a dirty path whose bytes change during a bounded run", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ice-expanse-preflight-"));
    try {
      await writeFile(path.join(root, "dirty.txt"), "before", "utf8");
      const inventory = [{ bytes: 6, path: "dirty.txt", sha256: "6db7d803e74f1ffa7d8f5adc0bf95b3e15bf4c8373fffadf546227cc6c6742cb", status: "?" }];
      await writeFile(path.join(root, "dirty.txt"), "after", "utf8");

      const drift = await findDirtyInventoryDrift(root, inventory);
      expect(drift).toEqual(["dirty.txt"]);
      expect(() => assertNoDirtyOverlap(drift)).toThrowError(expect.objectContaining({ code: "DIRTY_OVERLAP" }));
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("scopes protected child-map reads to the explicit project and ignores cross-project duplicates", async () => {
    const target = "rpg-zzu-dungeon-theme-gallery";
    const canonical = mapFixture({ height: 55, id: "map_g_ice_grand", tile: 1, width: 55 });
    const adventure = mapFixture({ height: 55, id: "map_g_ice_grand_adventure", tile: 2, width: 55 });
    const crossProjectDuplicate = mapFixture({ height: 3, id: "map_g_ice_grand", tile: 9, width: 3 });
    const projectJson = {
      maps: { map_g_ice_grand: canonical, map_g_ice_grand_adventure: adventure },
      mapTree: {
        mapId: "root",
        children: [
          { mapId: "map_g_ice_grand", children: [] },
          { mapId: "map_g_ice_grand_adventure", children: [] },
        ],
      },
      startMapId: "map_g_ice_grand_adventure",
      startPos: { x: 4, y: 5 },
    };
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/projects")) {
        return Response.json([{ project_id: target, title: "Ice", current_json: projectJson, current_sha256: "a".repeat(64) }]);
      }
      expect(url.searchParams.get("project_id")).toBe(`eq.${target}`);
      return Response.json([
        { project_id: "other-project", map_id: "map_g_ice_grand", map_json: crossProjectDuplicate },
        { project_id: target, map_id: "map_g_ice_grand", map_json: canonical },
        { project_id: target, map_id: "map_g_ice_grand_adventure", map_json: adventure },
      ]);
    }));

    try {
      const baseline = await readProtectedBaseline({ anonKey: "test-key", origin: "https://example.supabase.co" }, target);
      expect(baseline.canonical.effectiveGameMapSha256).toBe(hashValue(canonical));
      expect(baseline.canonical.width).toBe(55);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("detects new, deleted, renamed, and status-changed paths after the starting inventory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ice-expanse-git-drift-"));
    try {
      await initializePreflightGitFixture({
        files: { "delete.txt": "delete", "rename-source.txt": "rename", "seed.txt": "seed" },
        root,
      });
      await writeFile(path.join(root, "status.txt"), "status", "utf8");
      const before = await collectGitSourceState(root);
      await unlink(path.join(root, "delete.txt"));
      await rename(path.join(root, "rename-source.txt"), path.join(root, "renamed.txt"));
      execFileSync("git", ["add", "--all"], { cwd: root });
      await writeFile(path.join(root, "appeared.txt"), "new", "utf8");
      const after = await collectGitSourceState(root);

      expect(findGitSourceStateDrift(before, after)).toEqual(expect.arrayContaining([
        "appeared.txt",
        "delete.txt",
        "rename-source.txt",
        "renamed.txt",
        "status.txt",
        "git:porcelain-v2-z",
        "git:tracked-diff",
        "git:untracked-inventory",
      ]));
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("preserves unrelated drift but hard-stops Todo 1 source or read-dependency drift", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ice-expanse-scope-drift-"));
    try {
      await initializePreflightGitFixture({
        files: { ".gitignore": "ignored.env\n", "protected.txt": "protected" },
        root,
      });
      const before = await collectGitSourceState(root);
      await writeFile(path.join(root, "external.txt"), "external", "utf8");
      const externalOnly = await collectGitSourceState(root);

      expect(classifyGitSourceStateDrift(before, externalOnly, new Set(["protected.txt"]))).toMatchObject({
        externalPaths: ["external.txt"],
        protectedPaths: [],
      });

      await writeFile(path.join(root, "protected.txt"), "changed", "utf8");
      const protectedChanged = await collectGitSourceState(root);
      expect(classifyGitSourceStateDrift(externalOnly, protectedChanged, new Set(["protected.txt"]))).toMatchObject({
        externalPaths: [],
        protectedPaths: ["protected.txt"],
      });

      const ignoredBefore = await collectPathSet(root, ["ignored.env"]);
      await writeFile(path.join(root, "ignored.env"), "secret-free-fixture", "utf8");
      const ignoredAfter = await collectPathSet(root, ["ignored.env"]);
      expect(findPathSetDrift(ignoredBefore, ignoredAfter)).toEqual(["ignored.env"]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

function mapFixture(request: { readonly height: number; readonly id: string; readonly tile: number; readonly width: number }) {
  return {
    height: request.height,
    id: request.id,
    lowerTiles: Array.from({ length: request.width * request.height }, () => request.tile),
    upperTiles: Array.from({ length: request.width * request.height }, () => 0),
    width: request.width,
  };
}
