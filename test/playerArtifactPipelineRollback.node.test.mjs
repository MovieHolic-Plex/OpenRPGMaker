import assert from "node:assert/strict";
import { copyFile, open, readdir, rename, rm, writeFile } from "node:fs/promises";
import { afterEach, test } from "node:test";
import { runPlayerSync } from "../community-site/scripts/sync-player.mjs";
import { PlayerArtifactSyncError } from "../community-site/scripts/lib/playerSyncError.mjs";
import {
  PIPELINE_SOURCE_INVENTORY,
  cleanupFixture,
  createPipelineFixture,
  seedPriorInstall,
  snapshotInstalledState,
} from "./playerArtifactPipeline.fixture.mjs";

const fixtures = [];
const FIXED_INSTALL_TIME = "2026-07-22T01:02:03.000Z";

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
    installedAt: FIXED_INSTALL_TIME,
    transactionId: "rollback-transaction",
    transactionAdapters,
  };
}

for (const fault of ["copy", "rehash"]) {
  test(`${fault} failure preserves the prior target and lock`, async () => {
    // Given
    const created = await fixture();
    const prior = await seedPriorInstall(created);
    const transactionAdapters = fault === "copy"
      ? { copyFile: async () => { throw "C:/private/copy-canary"; } }
      : {
          copyFile: async (source, destination) => {
            await copyFile(source, destination);
            if (destination.endsWith("player.js")) await writeFile(destination, "tampered stage");
          },
        };

    // When
    const error = await runPlayerSync(syncOptions(created, transactionAdapters)).catch((caught) => caught);

    // Then
    assert.ok(error instanceof PlayerArtifactSyncError);
    assert.equal(String(error).includes("C:/private"), false);
    assert.deepEqual(await snapshotInstalledState(created), prior);
    await assertNoTransactionResidue(created);
  });
}

for (const [name, failingRename] of [
  ["target backup rename", 1],
  ["target install rename", 2],
  ["lock backup rename", 3],
  ["lock install rename", 4],
]) {
  test(`${name} failure rolls back the prior target and lock`, async () => {
    // Given
    const created = await fixture();
    const prior = await seedPriorInstall(created);
    let renameCount = 0;
    const transactionAdapters = {
      rename: async (source, destination) => {
        renameCount += 1;
        if (renameCount === failingRename) throw `C:/private/rename-${failingRename}`;
        await rename(source, destination);
      },
    };

    // When
    const error = await runPlayerSync(syncOptions(created, transactionAdapters)).catch((caught) => caught);

    // Then
    assert.equal(error.code, "install-replace-failed");
    assert.equal(String(error).includes("C:/private"), false);
    assert.deepEqual(await snapshotInstalledState(created), prior);
    await assertNoTransactionResidue(created);
  });
}

for (const [name, failingRename] of [
  ["target backup rename", 1],
  ["target install rename", 2],
  ["lock backup rename", 3],
  ["lock install rename", 4],
]) {
  test(`${name} post-effect failure reconciles and restores the prior install`, async () => {
    // Given
    const created = await fixture();
    const prior = await seedPriorInstall(created);
    let renameCount = 0;
    const transactionAdapters = {
      rename: async (source, destination) => {
        renameCount += 1;
        await rename(source, destination);
        if (renameCount === failingRename) throw `C:/private/post-rename-${failingRename}`;
      },
    };

    // When
    const error = await runPlayerSync(syncOptions(created, transactionAdapters)).catch((caught) => caught);

    // Then
    assert.equal(error.code, "install-replace-failed");
    assert.equal(String(error).includes("C:/private"), false);
    assert.deepEqual(await snapshotInstalledState(created), prior);
    await assertNoTransactionResidue(created);
  });
}

const LOCK_FAULTS = [
  ["serialize", { serializeLock: () => { throw "C:/private/serialize-canary"; } }],
  ["open", { open: stagedLockOpen("open") }],
  ["write", { open: stagedLockOpen("write") }],
  ["fsync", { open: stagedLockOpen("fsync") }],
  ["close", { open: stagedLockOpen("close") }],
];

for (const [name, transactionAdapters] of LOCK_FAULTS) {
  test(`lock ${name} failure preserves the prior target and lock`, async () => {
    // Given
    const created = await fixture();
    const prior = await seedPriorInstall(created);

    // When
    const error = await runPlayerSync(syncOptions(created, transactionAdapters)).catch((caught) => caught);

    // Then
    assert.equal(error.code, "lock-write-failed");
    assert.equal(String(error).includes("C:/private"), false);
    assert.deepEqual(await snapshotInstalledState(created), prior);
    await assertNoTransactionResidue(created);
  });
}

async function assertNoTransactionResidue(created) {
  const names = [
    ...await readdir(created.paths.sitePublicRoot),
    ...await readdir(created.siteRoot),
  ];
  assert.deepEqual(names.filter((name) => (
    name.includes(".backup-")
    || name.includes(".install-")
    || name === ".player-artifact.sync.lock"
  )), []);
}

function stagedLockOpen(failingStage) {
  return async (filePath, ...args) => {
    const handle = await open(filePath, ...args);
    if (!filePath.includes(".install-")) return handle;
    if (failingStage === "open") {
      await handle.close();
      await rm(filePath, { force: true });
      throw "C:/private/lock-open-canary";
    }
    return {
      writeFile: async (payload, encoding) => {
        if (failingStage === "write") throw "C:/private/lock-write-canary";
        return handle.writeFile(payload, encoding);
      },
      sync: async () => {
        if (failingStage === "fsync") throw "C:/private/lock-fsync-canary";
        return handle.sync();
      },
      close: async () => {
        await handle.close();
        if (failingStage === "close") throw "C:/private/lock-close-canary";
      },
    };
  };
}
