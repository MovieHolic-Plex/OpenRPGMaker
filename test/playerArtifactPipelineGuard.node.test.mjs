import assert from "node:assert/strict";
import { lstat, open, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, test } from "node:test";
import { runPlayerSync } from "../community-site/scripts/sync-player.mjs";
import {
  PLAYER_INSTALL_GUARD,
  withPlayerInstallGuard,
} from "../community-site/scripts/lib/playerSyncAtomicFs.mjs";
import { PlayerArtifactSyncError } from "../community-site/scripts/lib/playerSyncError.mjs";
import {
  PIPELINE_SOURCE_INVENTORY,
  cleanupFixture,
  createPipelineFixture,
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
    transactionId: "guard-transaction",
    transactionAdapters,
  };
}

test("guard close post-effect failure removes its owned guard and the next sync succeeds", async () => {
  const created = await fixture();
  const canary = "C:/private/guard-close-canary";
  const firstError = await runPlayerSync(syncOptions(created, {
    open: guardFaultOpen("close", canary),
  })).catch((caught) => caught);
  const guardPath = path.join(created.siteRoot, ".player-artifact.sync.lock");

  assert.ok(firstError instanceof PlayerArtifactSyncError);
  assert.equal(String(firstError).includes(canary), false);
  await assert.rejects(readFile(guardPath), { code: "ENOENT" });
  assert.equal((await runPlayerSync(syncOptions(created))).kind, "installed");
});

for (const stage of ["open", "write", "fsync"]) {
  test(`guard ${stage} non-Error failure is typed, redacted, and leaves no residue`, async () => {
    const created = await fixture();
    const canary = `C:/private/guard-${stage}-canary`;
    const error = await runPlayerSync(syncOptions(created, {
      open: guardFaultOpen(stage, canary),
    })).catch((caught) => caught);

    assert.ok(error instanceof PlayerArtifactSyncError);
    assert.equal(String(error).includes(canary), false);
    await assert.rejects(readFile(path.join(created.siteRoot, ".player-artifact.sync.lock")), { code: "ENOENT" });
  });
}

test("guard remove adapter failure falls back without residue", async () => {
  const created = await fixture();
  const result = await runPlayerSync(syncOptions(created, {
    rm: async (target, options) => {
      if (target.endsWith(".player-artifact.sync.lock")) {
        await rm(target, options);
        throw "C:/private/guard-remove-canary";
      }
      return rm(target, options);
    },
  }));

  assert.equal(result.kind, "installed");
  await assert.rejects(readFile(path.join(created.siteRoot, ".player-artifact.sync.lock")), { code: "ENOENT" });
});

test("concurrent guard acquisition rejects the second owner and preserves the first token", async () => {
  const created = await fixture();
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const first = withPlayerInstallGuard({
    paths: created.paths,
    adapters: guardAdapters(),
    operation: () => blocked,
  });
  await waitForFile(path.join(created.siteRoot, ".player-artifact.sync.lock"));

  await assert.rejects(withPlayerInstallGuard({
    paths: created.paths,
    adapters: guardAdapters(),
    operation: async () => "unexpected",
  }), { code: "install-busy" });
  release("done");
  assert.equal(await first, "done");
  await assert.rejects(readFile(path.join(created.siteRoot, ".player-artifact.sync.lock")), { code: "ENOENT" });
});

test("guard cleanup never deletes a replacement owned by another token", async () => {
  const created = await fixture();
  const guardPath = path.join(created.siteRoot, ".player-artifact.sync.lock");
  const replacement = JSON.stringify({
    sentinel: PLAYER_INSTALL_GUARD.sentinel,
    schemaVersion: PLAYER_INSTALL_GUARD.schemaVersion,
    pid: process.pid,
    token: "other-owner-token",
    createdAt: "2026-07-22T03:04:05.000Z",
  });
  const transactionAdapters = {
    open: async (filePath, ...args) => {
      const handle = await open(filePath, ...args);
      if (filePath !== guardPath) return handle;
      return replacementOnClose(handle, guardPath, replacement);
    },
  };

  const error = await runPlayerSync(syncOptions(created, transactionAdapters)).catch((caught) => caught);

  assert.ok(error instanceof PlayerArtifactSyncError);
  assert.equal(await readFile(guardPath, "utf8"), replacement);
  await rm(guardPath, { force: true });
});

test("guard release preserves a successor that replaced it during the operation", async () => {
  const created = await fixture();
  const guardPath = path.join(created.siteRoot, ".player-artifact.sync.lock");
  const replacement = JSON.stringify({
    sentinel: PLAYER_INSTALL_GUARD.sentinel,
    schemaVersion: PLAYER_INSTALL_GUARD.schemaVersion,
    pid: process.pid,
    token: "successor-owner-token",
    createdAt: "2026-07-22T03:04:05.000Z",
  });

  const result = await withPlayerInstallGuard({
    paths: created.paths,
    adapters: guardAdapters(),
    operation: async () => {
      await rm(guardPath, { force: true });
      await writeFile(guardPath, replacement);
      return "done";
    },
  });

  assert.equal(result, "done");
  assert.equal(await readFile(guardPath, "utf8"), replacement);
  await rm(guardPath, { force: true });
});

function replacementOnClose(handle, guardPath, replacement) {
  return {
    writeFile: (...args) => handle.writeFile(...args),
    sync: () => handle.sync(),
    stat: () => handle.stat(),
    close: async () => {
      await handle.close();
      await rm(guardPath, { force: true });
      await writeFile(guardPath, replacement);
      throw "C:/private/ownership-race";
    },
  };
}

function guardFaultOpen(stage, canary) {
  return async (filePath, ...args) => {
    if (stage === "open" && filePath.endsWith(".player-artifact.sync.lock")) throw canary;
    const handle = await open(filePath, ...args);
    if (!filePath.endsWith(".player-artifact.sync.lock")) return handle;
    return {
      writeFile: async (...writeArgs) => {
        await handle.writeFile(...writeArgs);
        if (stage === "write") throw canary;
      },
      sync: async () => {
        await handle.sync();
        if (stage === "fsync") throw canary;
      },
      stat: () => handle.stat(),
      close: async () => {
        await handle.close();
        if (stage === "close") throw canary;
      },
    };
  };
}

function guardAdapters() {
  return { lstat, open, readFile, rm };
}

async function waitForFile(filePath) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await readFile(filePath);
      return;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new TypeError("guard fixture did not appear");
}
