import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtemp, mkdir, open as openFile, readFile, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import unicode15Data from "../src/project/unicode15Data.json" with { type: "json" };
import { unicodeCaseFoldKey } from "../src/project/unicodeCaseFold.js";
import {
  PLAYER_ARTIFACT_CONTRACT,
  PLAYER_SOURCE_INPUT_INVENTORY,
  PlayerArtifactContractError,
  assertSecretScanClean,
  assertUniquePlayerPaths,
  collectFileRecords,
  collectSourceInputRecords,
  compareExactFileSet,
  createPlayerArtifactManifest,
  digestFileRecords,
  normalizeRelativePath,
  parsePlayerArtifactManifest,
  scanSecretShapedFiles,
  verifyPlayerArtifactManifest,
  writePlayerArtifactManifest,
} from "../scripts/lib/playerArtifactContract.mjs";

const BOUNDED = { timeout: 5_000 };
const ROOT_PACKAGE_INPUTS = ["package.json", "package-lock.json"];
const scratchRoots = [];

afterEach(async () => {
  await Promise.all(scratchRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("portable Unicode casefold tables pin offline version and authoritative provenance", BOUNDED, () => {
  assert.deepEqual({
    schemaVersion: unicode15Data.schemaVersion,
    unicodeVersion: unicode15Data.unicodeVersion,
    algorithm: unicode15Data.algorithm,
    counts: unicode15Data.counts,
  }, {
    schemaVersion: 1,
    unicodeVersion: "15.0.0",
    algorithm: "NFKC -> full casefold -> NFKC",
    counts: { decomposition: 5857, combiningClass: 922, composition: 945, casefold: 1530 },
  });
  assert.deepEqual(Object.fromEntries(Object.entries(unicode15Data.sources).map(([name, source]) => [name, source.sha256])), {
    "UnicodeData.txt": "806e9aed65037197f1ec85e12be6e8cd870fc5608b4de0fffd990f689f376a73",
    "CaseFolding.txt": "cdd49e55eae3bbf1f0a3f6580c974a0263cb86a6a08daa10fbf705b4808a56f7",
    "DerivedNormalizationProps.txt": "d5687a48c95c7d6e1ec59cb29c0f2e8b052018eb069a4371b7368d0561e12a29",
    "CompositionExclusions.txt": "3b019c0a33c3140cbc920c078f4f9af2680ba4f71869c8d4de5190667c70b6a3",
    "NormalizationTest.txt": "fb9ac8cc154a80cad6caac9897af55a4e75176af6f4e2bb6edc2bf8b1d57f326",
  });
  assert.equal(unicodeCaseFoldKey("Straße"), "strasse");
});

test("Unicode 15 tables fail closed during module initialization when a stream is malformed", BOUNDED, async () => {
  const root = await scratch();
  const normalizerSource = await readFile("src/project/unicode15Normalize.js", "utf8");
  const malformed = structuredClone(unicode15Data);
  malformed.streams.casefold = malformed.streams.casefold.slice(0, -4);
  await put(root, "package.json", JSON.stringify({ type: "module" }));
  await put(root, "unicode15Normalize.js", normalizerSource);
  await put(root, "unicode15Data.json", JSON.stringify(malformed));

  await assert.rejects(
    import(pathToFileURL(path.join(root, "unicode15Normalize.js")).href),
    (error) => error instanceof TypeError && error.message === "Unicode 15 data contract is malformed",
  );
});

test("Unicode 15 implementation does not delegate normalization or casing to the host runtime", BOUNDED, async () => {
  const source = await readFile("src/project/unicode15Normalize.js", "utf8");
  assert.equal(source.includes(".normalize("), false);
  assert.equal(source.includes(".toLowerCase("), false);
  assert.equal(source.includes(".toLocaleLowerCase("), false);
});

async function scratch() {
  const root = await mkdtemp(path.join(tmpdir(), "rpgzzu-player-contract-"));
  scratchRoots.push(root);
  return root;
}

async function put(root, relative, contents) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

function manifestFor(files, sourceInputs) {
  return createPlayerArtifactManifest({
    files,
    sourceInputs,
    sourceRevision: "test-revision",
    builtAt: "2026-07-21T00:00:00.000Z",
  });
}

async function manifestTempResidue(artifactRoot) {
  const prefix = `.${PLAYER_ARTIFACT_CONTRACT.manifestFile}.`;
  return (await readdir(artifactRoot)).filter((name) => name.startsWith(prefix) && name.endsWith(".tmp"));
}

function failingOpen(errorName) {
  return async (...args) => {
    const handle = await openFile(...args);
    return {
      writeFile: async (payload) => {
        await handle.writeFile(payload.slice(0, 12));
        const error = new Error(`injected-${errorName}`);
        error.name = errorName;
        throw error;
      },
      sync: () => handle.sync(),
      close: () => handle.close(),
    };
  };
}

function atomicStageOpen(failingStage, canary) {
  return async (...args) => {
    if (failingStage === "open") throw { canary, hostPath: "C:/private/atomic-open" };
    const handle = await openFile(...args);
    return {
      writeFile: async (payload, encoding) => {
        if (failingStage === "write") {
          await handle.writeFile(payload.slice(0, 12), encoding);
          throw `C:/private/${canary}`;
        }
        return handle.writeFile(payload, encoding);
      },
      sync: async () => {
        if (failingStage === "sync") throw { canary, hostPath: "C:/private/atomic-sync" };
        return handle.sync();
      },
      close: async () => {
        await handle.close();
        if (failingStage === "close") throw `C:/private/${canary}`;
      },
    };
  };
}

test("collectFileRecords is recursively sorted, normalized, and deterministic", BOUNDED, async () => {
  // Given
  const root = await scratch();
  await put(root, "z.txt", "last");
  await put(root, path.join("a", "first.txt"), "first");

  // When
  const first = await collectFileRecords(root);
  const second = await collectFileRecords(root);

  // Then
  assert.deepEqual(first.map((entry) => entry.path), ["a/first.txt", "z.txt"]);
  assert.deepEqual(second, first);
  assert.equal(normalizeRelativePath("a\\first.txt"), "a/first.txt");
});

for (const [name, left, right] of [
  ["sharp-s", "assets/Straße.js", "assets/STRASSE.js"],
  ["Greek final sigma", "assets/ος.js", "assets/οσ.js"],
  ["compatibility ligature", "assets/ﬃ.js", "assets/ffi.js"],
  ["NFC composition", "assets/café.js", "assets/cafe\u0301.js"],
]) {
  test(`portable Unicode casefold rejects ${name} path collisions`, BOUNDED, () => {
    assert.throws(
      () => assertUniquePlayerPaths([left, right], "Unicode path fixture"),
      (error) => error instanceof PlayerArtifactContractError && error.code === "duplicate-path",
    );
  });
}

for (const [name, left, right] of [
  ["Cyrillic U+1C89 drift", "assets/\u1c89.js", "assets/\u1c8a.js"],
  ["Garay U+10D50 drift", "assets/\u{10d50}.js", "assets/\u{10d70}.js"],
]) {
  test(`Unicode 15 keeps post-version ${name} paths distinct`, BOUNDED, () => {
    assert.notEqual(unicodeCaseFoldKey(left), unicodeCaseFoldKey(right));
    assert.doesNotThrow(() => assertUniquePlayerPaths([left, right], "post-version Unicode fixture"));
  });
}

test("source digest changes when one copied source input becomes dirty", BOUNDED, async () => {
  // Given
  const root = await scratch();
  await put(root, "player.html", "clean");
  const inventory = [{ kind: "file", path: "player.html" }];
  const clean = await collectSourceInputRecords(root, { inventory });

  // When
  await put(root, "player.html", "dirty");
  const dirty = await collectSourceInputRecords(root, { inventory });

  // Then
  assert.notEqual(digestFileRecords(clean), digestFileRecords(dirty));
});

test("explicit inventory covers source modules, CSS, build inputs, and runtime assets", BOUNDED, () => {
  // Given
  const paths = PLAYER_SOURCE_INPUT_INVENTORY.map((entry) => entry.path);

  // When
  const required = ["player.html", "vite.player.config.ts", "scripts/build-player-sdk.mjs", "src/player", "src/project", "src/styles/runtime", "public/assets"];

  // Then
  assert.deepEqual(required.filter((entry) => !paths.includes(entry)), []);
});

test("explicit inventory declares both root dependency manifests as files", BOUNDED, () => {
  // Given / When
  const packageEntries = PLAYER_SOURCE_INPUT_INVENTORY.filter((entry) => ROOT_PACKAGE_INPUTS.includes(entry.path));

  // Then
  assert.deepEqual(packageEntries, ROOT_PACKAGE_INPUTS.map((inputPath) => ({ kind: "file", path: inputPath })));
});

for (const packageInput of ROOT_PACKAGE_INPUTS) {
  test(`source digest changes when copied ${packageInput} mutates`, BOUNDED, async () => {
    // Given
    const root = await scratch();
    for (const inputPath of ROOT_PACKAGE_INPUTS) await put(root, inputPath, `${inputPath}:clean`);
    const inventory = ROOT_PACKAGE_INPUTS.map((inputPath) => ({ kind: "file", path: inputPath }));
    const cleanDigest = digestFileRecords(await collectSourceInputRecords(root, { inventory }));

    // When
    await put(root, packageInput, `${packageInput}:dirty`);
    const dirtyDigest = digestFileRecords(await collectSourceInputRecords(root, { inventory }));

    // Then
    assert.notEqual(dirtyDigest, cleanDigest);
  });
}

test("explicit inventory contains only existing inputs of the declared kind", BOUNDED, async () => {
  // Given / When
  const observations = await Promise.all(PLAYER_SOURCE_INPUT_INVENTORY.map(async (entry) => ({ entry, info: await stat(entry.path) })));

  // Then
  assert.deepEqual(observations.filter(({ entry, info }) => entry.kind === "file" ? !info.isFile() : !info.isDirectory()), []);
});

test("exact-set comparison accepts an identical tree", BOUNDED, async () => {
  // Given
  const root = await scratch();
  await put(root, "player.js", "one");
  const expected = await collectFileRecords(root);

  // When
  const issues = compareExactFileSet(expected, await collectFileRecords(root));

  // Then
  assert.deepEqual(issues, []);
});

test("exact-set comparison reports missing and extra paths", BOUNDED, async () => {
  // Given
  const root = await scratch();
  await put(root, "player.js", "one");
  const expected = await collectFileRecords(root);

  // When
  await unlink(path.join(root, "player.js"));
  await put(root, "stale.js", "stale");
  const issues = compareExactFileSet(expected, await collectFileRecords(root));

  // Then
  assert.deepEqual(issues.map((issue) => [issue.code, issue.path]), [["missing", "player.js"], ["extra", "stale.js"]]);
});

test("exact-set comparison reports same-size artifact tampering", BOUNDED, async () => {
  // Given
  const root = await scratch();
  await put(root, "player.js", "one");
  const expected = await collectFileRecords(root);

  // When
  await put(root, "player.js", "two");
  const issues = compareExactFileSet(expected, await collectFileRecords(root));

  // Then
  assert.deepEqual(issues.map((issue) => [issue.code, issue.path]), [["tampered", "player.js"]]);
});

test("manifest verification reports artifact tampering without mutating the tree", BOUNDED, async () => {
  // Given
  const root = await scratch();
  await put(root, "player.js", "one");
  const expected = await collectFileRecords(root);
  const manifest = manifestFor(expected, expected);

  // When
  await put(root, "player.js", "two");
  const issues = verifyPlayerArtifactManifest({ manifest, artifactFiles: await collectFileRecords(root), sourceInputs: expected });

  // Then
  assert.deepEqual(issues.map((issue) => issue.code), ["tampered", "artifact-digest-mismatch"]);
});

test("path normalization rejects traversal and absolute contract paths", BOUNDED, () => {
  // Given / When / Then
  assert.throws(() => normalizeRelativePath("../outside.js"), PlayerArtifactContractError);
  assert.throws(() => normalizeRelativePath("/absolute.js"), PlayerArtifactContractError);
});

test("manifest parser rejects schema and sentinel mismatches", BOUNDED, async () => {
  // Given
  const root = await scratch();
  await put(root, "player.js", "safe");
  const files = await collectFileRecords(root);
  const manifest = manifestFor(files, files);

  // When / Then
  assert.throws(() => parsePlayerArtifactManifest({ ...manifest, schemaVersion: 999 }), PlayerArtifactContractError);
  assert.throws(() => parsePlayerArtifactManifest({ ...manifest, sentinel: "misleading-manifest" }), PlayerArtifactContractError);
});

test("manifest parser rejects malformed ordering and misleading digests", BOUNDED, async () => {
  // Given
  const root = await scratch();
  await put(root, "a.js", "a");
  await put(root, "b.js", "b");
  const files = await collectFileRecords(root);
  const manifest = manifestFor(files, files);

  // When / Then
  assert.throws(() => parsePlayerArtifactManifest({ ...manifest, files: [...manifest.files].reverse() }), PlayerArtifactContractError);
  assert.throws(() => parsePlayerArtifactManifest({ ...manifest, sourceDigest: "0".repeat(64) }), PlayerArtifactContractError);
  assert.throws(() => parsePlayerArtifactManifest({ ...manifest, artifactVersion: "misleading" }), PlayerArtifactContractError);
});

test("manifest verification reports stale source inputs", BOUNDED, async () => {
  // Given
  const artifactRoot = await scratch();
  const sourceRoot = await scratch();
  await put(artifactRoot, "player.js", "safe");
  await put(sourceRoot, "player.html", "clean");
  const files = await collectFileRecords(artifactRoot);
  const cleanSources = await collectFileRecords(sourceRoot);
  const manifest = manifestFor(files, cleanSources);

  // When
  await put(sourceRoot, "player.html", "dirty");
  const issues = verifyPlayerArtifactManifest({ manifest, artifactFiles: files, sourceInputs: await collectFileRecords(sourceRoot) });

  // Then
  assert.deepEqual(issues.map((issue) => issue.code), ["source-tampered", "source-digest-mismatch"]);
});

test("secret-shaped findings expose only path, rule, and category", BOUNDED, async () => {
  // Given
  const root = await scratch();
  const fakeSentinel = `sk-${"T".repeat(32)}`;
  await put(root, "assets/player.js", `const injected = "${fakeSentinel}";`);
  const files = await collectFileRecords(root);

  // When
  const findings = await scanSecretShapedFiles({ root, files });

  // Then
  assert.deepEqual(Object.keys(findings[0]).sort(), ["category", "path", "rule"]);
  assert.equal(JSON.stringify(findings).includes(fakeSentinel), false);
  assert.throws(() => assertSecretScanClean(findings), (error) => error instanceof PlayerArtifactContractError && !error.message.includes(fakeSentinel));
});

test("failed secret scan preserves a prior valid manifest with no temp residue", BOUNDED, async () => {
  // Given
  const artifactRoot = await scratch();
  const repoRoot = await scratch();
  const manifestPath = path.join(artifactRoot, PLAYER_ARTIFACT_CONTRACT.manifestFile);
  const inventory = [{ kind: "file", path: "player.html" }];
  await put(artifactRoot, "player.js", "console.log('safe');");
  await put(repoRoot, "player.html", "source");
  await writePlayerArtifactManifest({ artifactRoot, repoRoot, manifestPath, sourceInventory: inventory, builtAt: "2026-07-21T00:00:00.000Z" });
  const previous = await readFile(manifestPath, "utf8");

  // When
  await put(artifactRoot, "player.js", `const injected = "sk-${"S".repeat(32)}";`);

  // Then
  await assert.rejects(
    writePlayerArtifactManifest({ artifactRoot, repoRoot, manifestPath, sourceInventory: inventory }),
    (error) => error instanceof PlayerArtifactContractError && error.code === "secret-scan-failed",
  );
  assert.equal(await readFile(manifestPath, "utf8"), previous);
  assert.deepEqual(await manifestTempResidue(artifactRoot), []);
  const prior = parsePlayerArtifactManifest(JSON.parse(previous));
  const artifactFiles = await collectFileRecords(artifactRoot, { excludePaths: [PLAYER_ARTIFACT_CONTRACT.manifestFile] });
  const sourceInputs = await collectSourceInputRecords(repoRoot, { inventory });
  assert.deepEqual(verifyPlayerArtifactManifest({ manifest: prior, artifactFiles, sourceInputs }).map((issue) => issue.code), ["tampered", "artifact-digest-mismatch"]);
});

const ATOMIC_FAILURES = [
  { name: "serialize", canary: "serialize-canary", atomicFileOps: { serialize: () => { throw "C:/private/serialize-canary"; } } },
  { name: "open", canary: "open-canary", atomicFileOps: { open: atomicStageOpen("open", "open-canary") } },
  { name: "write", canary: "write-canary", atomicFileOps: { open: atomicStageOpen("write", "write-canary") } },
  { name: "fsync", canary: "sync-canary", atomicFileOps: { open: atomicStageOpen("sync", "sync-canary") } },
  { name: "close", canary: "close-canary", atomicFileOps: { open: atomicStageOpen("close", "close-canary") } },
  { name: "rename", canary: "rename-canary", atomicFileOps: { rename: async () => { throw "C:/private/rename-canary"; } } },
  {
    name: "remove cleanup",
    canary: "remove-canary",
    atomicFileOps: {
      open: atomicStageOpen("write", "remove-trigger"),
      remove: async () => {
        throw { canary: "remove-canary", hostPath: "C:/private/atomic-remove" };
      },
    },
  },
];

for (const fault of ATOMIC_FAILURES) {
  test(`atomic manifest replacement preserves the valid prior file on ${fault.name} failure`, BOUNDED, async () => {
    // Given
    const artifactRoot = await scratch();
    const repoRoot = await scratch();
    const manifestPath = path.join(artifactRoot, PLAYER_ARTIFACT_CONTRACT.manifestFile);
    const inventory = [{ kind: "file", path: "player.html" }];
    await put(artifactRoot, "player.js", "console.log('safe');");
    await put(repoRoot, "player.html", "source");
    await writePlayerArtifactManifest({ artifactRoot, repoRoot, manifestPath, sourceInventory: inventory, builtAt: "2026-07-21T00:00:00.000Z" });
    const previous = await readFile(manifestPath, "utf8");

    // When / Then
    await assert.rejects(writePlayerArtifactManifest({
      artifactRoot,
      repoRoot,
      manifestPath,
      sourceInventory: inventory,
      builtAt: "2026-07-22T00:00:00.000Z",
      atomicFileOps: fault.atomicFileOps,
    }), (error) => (
      error instanceof PlayerArtifactContractError
      && error.code === "atomic-write-failed"
      && error.message === "player manifest atomic replacement failed"
      && !String(error).includes(fault.canary)
      && !JSON.stringify(error).includes(fault.canary)
      && !String(error).includes("C:/private")
    ));
    assert.equal(await readFile(manifestPath, "utf8"), previous);
    assert.deepEqual(await manifestTempResidue(artifactRoot), []);
    const prior = parsePlayerArtifactManifest(JSON.parse(previous));
    const artifactFiles = await collectFileRecords(artifactRoot, { excludePaths: [PLAYER_ARTIFACT_CONTRACT.manifestFile] });
    const sourceInputs = await collectSourceInputRecords(repoRoot, { inventory });
    assert.deepEqual(verifyPlayerArtifactManifest({ manifest: prior, artifactFiles, sourceInputs }), []);
  });
}
