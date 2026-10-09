import assert from "node:assert/strict";
import {
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { afterEach, test } from "node:test";
import { runPlayerSync } from "../community-site/scripts/sync-player.mjs";
import { PlayerArtifactSyncError } from "../community-site/scripts/lib/playerSyncError.mjs";
import { createPlayerSyncPaths } from "../community-site/scripts/lib/playerSyncPaths.mjs";
import {
  COMMUNITY_BUILD_STEPS,
  CommunityBuildPipelineError,
  runCommunityBuildPipeline,
} from "../scripts/build-community.mjs";
import {
  PIPELINE_SOURCE_INVENTORY,
  cleanupFixture,
  createPipelineFixture,
  put,
  seedPriorInstall,
  snapshotInstalledState,
} from "./playerArtifactPipeline.fixture.mjs";

const fixtures = [];
const FIXED_INSTALL_TIME = "2026-07-22T01:02:03.000Z";

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(cleanupFixture));
});

async function fixture(options) {
  const created = await createPipelineFixture(options);
  fixtures.push(created);
  return created;
}

function syncOptions(created, overrides = {}) {
  return {
    repoRoot: created.repoRoot,
    siteRoot: created.siteRoot,
    sourceInventory: PIPELINE_SOURCE_INVENTORY,
    installedAt: FIXED_INSTALL_TIME,
    transactionId: "fixture-transaction",
    ...overrides,
  };
}

test("sync installs the exact verified set and check accepts it", async () => {
  // Given
  const created = await fixture();

  // When
  const installed = await runPlayerSync(syncOptions(created));
  const checked = await runPlayerSync(syncOptions(created, { checkOnly: true }));

  // Then
  assert.equal(installed.kind, "installed");
  assert.equal(checked.kind, "verified");
  assert.deepEqual(
    checked.installed.installedFiles.map((entry) => entry.path),
    created.manifest.files.map((entry) => entry.path),
  );
  assert.equal(checked.installed.lock.deploymentDigest, created.manifest.deployment.deploymentDigest);
});

for (const [name, mutate] of [
  ["tampered", async (created) => writeFile(path.join(created.paths.targetRoot, "player.js"), "tampered")],
  ["missing", async (created) => unlink(path.join(created.paths.targetRoot, "player.js"))],
  ["extra", async (created) => put(created.paths.targetRoot, "stale.js", "stale")],
]) {
  test(`check rejects an installed ${name} exact set`, async () => {
    // Given
    const created = await fixture();
    await runPlayerSync(syncOptions(created));
    await mutate(created);

    // When / Then
    await assert.rejects(
      runPlayerSync(syncOptions(created, { checkOnly: true })),
      (error) => error instanceof PlayerArtifactSyncError && error.code === "installed-artifact-stale",
    );
  });
}

test("check rejects an old partial lock even when artifactVersion matches", async () => {
  // Given
  const created = await fixture();
  await runPlayerSync(syncOptions(created));
  await writeFile(created.paths.lockPath, JSON.stringify({ artifactVersion: created.manifest.artifactVersion }));

  // When / Then
  await assert.rejects(
    runPlayerSync(syncOptions(created, { checkOnly: true })),
    (error) => error instanceof PlayerArtifactSyncError && error.code === "lock-invalid",
  );
});

test("sync rejects a source digest mismatch before touching the prior install", async () => {
  // Given
  const created = await fixture();
  const prior = await seedPriorInstall(created);
  await writeFile(path.join(created.repoRoot, "player-source.txt"), "dirty source");

  // When / Then
  await assert.rejects(runPlayerSync(syncOptions(created)), { code: "source-digest-stale" });
  assert.deepEqual(await snapshotInstalledState(created), prior);
});

test("sync rejects a runtime asset digest mismatch before touching the prior install", async () => {
  // Given
  const created = await fixture();
  const prior = await seedPriorInstall(created);
  await writeFile(path.join(created.runtimeAssetRoot, "assets/runtime.png"), "dirty runtime");

  // When / Then
  await assert.rejects(runPlayerSync(syncOptions(created)), { code: "runtime-assets-stale" });
  assert.deepEqual(await snapshotInstalledState(created), prior);
});

test("sync rejects a malformed deployment manifest before touching the prior install", async () => {
  // Given
  const created = await fixture();
  const prior = await seedPriorInstall(created);
  await writeFile(created.paths.manifestPath, "{not-json");

  // When / Then
  await assert.rejects(runPlayerSync(syncOptions(created)), { code: "built-manifest-invalid" });
  assert.deepEqual(await snapshotInstalledState(created), prior);
});

test("sync rejects a misleading deployment digest before touching the prior install", async () => {
  // Given
  const created = await fixture();
  const prior = await seedPriorInstall(created);
  const manifest = JSON.parse(await readFile(created.paths.manifestPath, "utf8"));
  manifest.deployment.deploymentDigest = "0".repeat(64);
  await writeFile(created.paths.manifestPath, JSON.stringify(manifest));

  // When / Then
  await assert.rejects(runPlayerSync(syncOptions(created)), { code: "built-manifest-invalid" });
  assert.deepEqual(await snapshotInstalledState(created), prior);
});

test("sync rejects secret-shaped build bytes with a value-free error", async () => {
  // Given
  const canary = `sk-${"Q".repeat(32)}`;
  const created = await fixture({ playerJs: `const credential = "${canary}";` });

  // When
  const error = await runPlayerSync(syncOptions(created)).catch((caught) => caught);

  // Then
  assert.equal(error.code, "built-artifact-unsafe");
  assert.equal(String(error).includes(canary), false);
  assert.equal(JSON.stringify(error).includes(canary), false);
});

test("release orchestration stops after a redacted build failure", async () => {
  // Given
  const calls = [];
  const canary = "C:/private/build-canary";

  // When
  const error = await runCommunityBuildPipeline({
    repoRoot: process.cwd(),
    siteRoot: path.join(process.cwd(), "community-site"),
    runner: async (step) => {
      calls.push(step.step);
      throw canary;
    },
  }).catch((caught) => caught);

  // Then
  assert.ok(error instanceof CommunityBuildPipelineError);
  assert.equal(error.step, "build-player");
  assert.deepEqual(calls, ["build-player"]);
  assert.equal(String(error).includes(canary), false);
});

test("sync removes interrupted staging temps inside owned parents", async () => {
  // Given
  const created = await fixture();
  const staleTarget = path.join(path.dirname(created.paths.targetRoot), ".player-static.install-interrupted");
  const staleLock = path.join(path.dirname(created.paths.lockPath), ".player-artifact.lock.json.install-interrupted");
  await put(staleTarget, "partial.js", "partial");
  await writeFile(staleLock, "partial lock");

  // When
  await runPlayerSync(syncOptions(created));

  // Then
  await assert.rejects(readFile(staleTarget), { code: "ENOENT" });
  await assert.rejects(readFile(staleLock), { code: "ENOENT" });
  await runPlayerSync(syncOptions(created, { checkOnly: true }));
});

for (const [name, pathOptions] of [
  ["artifact", (created) => ({ artifactRoot: path.join(created.root, "outside-artifact") })],
  ["target", (created) => ({ targetRoot: path.join(created.root, "outside-target") })],
  ["lock", (created) => ({ lockPath: path.join(created.root, "outside-lock.json") })],
]) {
  test(`${name} path escape is rejected before recursive replacement`, async () => {
    // Given
    const created = await fixture();

    // When / Then
    assert.throws(
      () => createPlayerSyncPaths({
        repoRoot: created.repoRoot,
        siteRoot: created.siteRoot,
        ...pathOptions(created),
      }),
      (error) => error instanceof PlayerArtifactSyncError && error.code === "path-escape",
    );
  });
}

test("non-Error adapter failures are converted without canary or host path leakage", async () => {
  // Given
  const created = await fixture();
  const canary = "C:/private/read-manifest-canary";

  // When
  const error = await runPlayerSync(syncOptions(created, {
    verificationAdapters: { readText: async () => { throw canary; } },
  })).catch((caught) => caught);

  // Then
  assert.equal(error.code, "built-manifest-invalid");
  assert.equal(String(error).includes(canary), false);
  assert.equal(JSON.stringify(error).includes(canary), false);
});

test("package scripts expose explicit build sync verify build order and verify-only prebuild", async () => {
  // Given / When
  const rootManifest = JSON.parse(await readFile("package.json", "utf8"));
  const siteManifest = JSON.parse(await readFile("community-site/package.json", "utf8"));
  const calls = [];
  await runCommunityBuildPipeline({
    repoRoot: process.cwd(),
    siteRoot: path.join(process.cwd(), "community-site"),
    runner: async (step) => { calls.push([step.step, step.script, step.cwd]); },
  });

  // Then
  assert.equal(rootManifest.scripts["build:community"], "node scripts/build-community.mjs");
  assert.equal(siteManifest.scripts.prebuild, "npm run verify:player");
  assert.equal(siteManifest.scripts.prebuild.includes("||"), false);
  assert.deepEqual(
    COMMUNITY_BUILD_STEPS.map((step) => [step.name, step.script]),
    [
      ["build-player", "build:player"],
      ["sync-player", "sync:player"],
      ["verify-player", "verify:player"],
      ["build-community", "build"],
    ],
  );
  assert.deepEqual(calls.map(([step, script]) => [step, script]), COMMUNITY_BUILD_STEPS.map((step) => [step.name, step.script]));
  assert.deepEqual(calls.map(([, , cwd]) => cwd), [
    process.cwd(),
    path.join(process.cwd(), "community-site"),
    path.join(process.cwd(), "community-site"),
    path.join(process.cwd(), "community-site"),
  ]);
});
