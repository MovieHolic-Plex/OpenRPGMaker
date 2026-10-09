import assert from "node:assert/strict";
import { mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, test } from "node:test";
import { runPlayerSync } from "../community-site/scripts/sync-player.mjs";
import { PLAYER_INSTALL_GUARD } from "../community-site/scripts/lib/playerSyncAtomicFs.mjs";
import { PlayerArtifactSyncError } from "../community-site/scripts/lib/playerSyncError.mjs";
import { createPlayerSyncPaths } from "../community-site/scripts/lib/playerSyncPaths.mjs";
import {
  PIPELINE_SOURCE_INVENTORY,
  cleanupFixture,
  createPipelineFixture,
  put,
  seedPriorInstall,
  snapshotInstalledState,
  snapshotTree,
} from "./playerArtifactPipeline.fixture.mjs";

const fixtures = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(cleanupFixture));
});

async function fixture() {
  const created = await createPipelineFixture();
  fixtures.push(created);
  return created;
}

function syncOptions(created, transactionAdapters) {
  return {
    repoRoot: created.repoRoot,
    siteRoot: created.siteRoot,
    sourceInventory: PIPELINE_SOURCE_INVENTORY,
    installedAt: "2026-07-22T03:04:05.000Z",
    transactionId: "recovery-transaction",
    transactionAdapters,
  };
}

test("stale dead-process guard and interrupted backups recover before a failed re-entry", async () => {
  const created = await fixture();
  const prior = await seedPriorInstall(created);
  const targetBackup = path.join(path.dirname(created.paths.targetRoot), ".player-static.backup-crash");
  const lockBackup = path.join(path.dirname(created.paths.lockPath), ".player-artifact.lock.json.backup-crash");
  await rename(created.paths.targetRoot, targetBackup);
  await rename(created.paths.lockPath, lockBackup);
  await put(created.paths.targetRoot, "new.txt", "interrupted new target");
  await writeFile(created.paths.lockPath, "interrupted new lock");
  await put(path.dirname(created.paths.targetRoot), ".player-static.install-crash/partial.js", "partial");
  await writeFile(path.join(created.siteRoot, ".player-artifact.sync.lock"), JSON.stringify({
    sentinel: PLAYER_INSTALL_GUARD.sentinel,
    schemaVersion: PLAYER_INSTALL_GUARD.schemaVersion,
    pid: 2147483647,
    token: "stale-owner-token",
    createdAt: "2026-07-22T03:04:05.000Z",
  }));

  const error = await runPlayerSync(syncOptions(created, {
    copyFile: async () => { throw "C:/private/reentry-stop"; },
  })).catch((caught) => caught);

  assert.ok(error instanceof PlayerArtifactSyncError);
  assert.deepEqual(await snapshotInstalledState(created), prior);
  await assert.rejects(readFile(targetBackup), { code: "ENOENT" });
  await assert.rejects(readFile(lockBackup), { code: "ENOENT" });
  await assert.rejects(readFile(path.join(
    path.dirname(created.paths.targetRoot),
    ".player-static.install-crash",
    "partial.js",
  )), { code: "ENOENT" });
  await assert.rejects(readFile(path.join(created.siteRoot, ".player-artifact.sync.lock")), { code: "ENOENT" });
});

for (const stage of ["mkdir", "readdir", "stale-remove"]) {
  test(`${stage} preflight adapter failure is typed and value-free`, async () => {
    const created = await fixture();
    const prior = await seedPriorInstall(created);
    const canary = `C:/private/${stage}-canary`;
    if (stage === "stale-remove") {
      await put(path.dirname(created.paths.targetRoot), ".player-static.install-stale/partial.js", "partial");
    }
    const transactionAdapters = stage === "mkdir"
      ? { mkdir: async () => { throw canary; } }
      : stage === "readdir"
        ? { readdir: async () => { throw canary; } }
        : {
            rm: async (target, options) => {
              if (target.includes(".install-stale")) throw canary;
              return rm(target, options);
            },
          };

    const error = await runPlayerSync(syncOptions(created, transactionAdapters)).catch((caught) => caught);

    assert.ok(error instanceof PlayerArtifactSyncError);
    assert.equal(String(error).includes(canary), false);
    assert.deepEqual(await snapshotInstalledState(created), prior);
  });
}

for (const [kind, linkType] of [["junction", "junction"], ["symlink", "dir"]]) {
  test(`physical containment rejects a Windows directory ${kind} before outside mutation`, async (context) => {
    const created = await fixture();
    const outside = path.join(created.root, `outside-${kind}`);
    const link = path.join(created.siteRoot, "public", `escape-${kind}`);
    await mkdir(outside, { recursive: true });
    await mkdir(path.dirname(link), { recursive: true });
    await put(outside, ".player-static.install-interrupted/canary.txt", "outside canary");
    const before = await snapshotTree(outside);
    try {
      await symlink(outside, link, linkType);
    } catch (error) {
      if (error instanceof Error && "code" in error && ["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
        context.skip(`${kind} creation unavailable: ${error.code}`);
        return;
      }
      throw error;
    }

    assert.throws(() => createPlayerSyncPaths({
      repoRoot: created.repoRoot,
      siteRoot: created.siteRoot,
      targetRoot: path.join(link, "player-static"),
    }), (error) => error instanceof PlayerArtifactSyncError && error.code === "path-reparse-point");
    assert.deepEqual(await snapshotTree(outside), before);
  });
}
