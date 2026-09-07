import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEED_ENTRY = path.join(ROOT, "community-site", "db", "seed-community.mts");
const PREFLIGHT_ENTRY = path.join(
  ROOT,
  "community-site",
  "scripts",
  "check-release-preconditions.mjs",
);

function childEnvironment(overrides = {}) {
  return {
    COMSPEC: process.env.COMSPEC,
    Path: process.env.Path,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    ...overrides,
  };
}

async function runProcess(entry, args, env) {
  const child = spawn(process.execPath, [...args.node, entry, ...args.entry], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return { exitCode, stdout, stderr };
}

async function createNoNetworkPgHook(directory) {
  const fakePgPath = path.join(directory, "fake-pg.mjs");
  const fakeEditorPath = path.join(directory, "fake-editor.mjs");
  const hookPath = path.join(directory, "pg-hook.mjs");
  await writeFile(
    fakePgPath,
    `export class Client {
  constructor(options) {
    if (options.connectionString !== process.env.PREFLIGHT_EXPECTED_DATABASE_URL) {
      throw new Error("database input mismatch");
    }
  }
  async connect() {
    if (process.env.PREFLIGHT_FAIL_IF_CLIENT_REACHED === "1") {
      throw new Error("database client reached");
    }
  }
  async query() {}
  async end() {}
}
`,
  );
  await writeFile(
    fakeEditorPath,
    `export function createBlankProject() {
  return { meta: { title: "" }, maps: {}, assets: { uploaded: {} } };
}
export function createProjectPackage() {
  return new Blob([]);
}
`,
  );
  await writeFile(
    hookPath,
    `import { registerHooks } from "node:module";
const fakePgUrl = ${JSON.stringify(pathToFileURL(fakePgPath).href)};
const fakeEditorUrl = ${JSON.stringify(pathToFileURL(fakeEditorPath).href)};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "pg") {
      return { url: fakePgUrl, shortCircuit: true };
    }
    if (specifier === "@/project/defaults/defaultProject" || specifier === "@/project/package") {
      return { url: fakeEditorUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
`,
  );
  return pathToFileURL(hookPath).href;
}

test("seed accepts an injected database URL without network execution", async () => {
  // Given: a fake pg module that performs no socket operations.
  const directory = await mkdtemp(path.join(tmpdir(), "player-release-preflight-"));
  const databaseUrl = "postgresql://local.invalid:1/community";
  try {
    const hookUrl = await createNoNetworkPgHook(directory);

    // When: the seed runs with an explicit database URL.
    const result = await runProcess(
      SEED_ENTRY,
      { node: ["--import", hookUrl], entry: [] },
      childEnvironment({
        COMMUNITY_DATABASE_URL: databaseUrl,
        PREFLIGHT_EXPECTED_DATABASE_URL: databaseUrl,
      }),
    );

    // Then: the entry completes through the fake client without a network call.
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /seed complete/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("seed fails closed with a value-free error when the database URL is absent", async () => {
  // Given: no database URL and a fake client that proves whether DB setup is reached.
  const directory = await mkdtemp(path.join(tmpdir(), "player-release-preflight-"));
  try {
    const hookUrl = await createNoNetworkPgHook(directory);

    // When: the seed entry runs without COMMUNITY_DATABASE_URL.
    const result = await runProcess(
      SEED_ENTRY,
      { node: ["--import", hookUrl], entry: [] },
      childEnvironment({ PREFLIGHT_FAIL_IF_CLIENT_REACHED: "1" }),
    );

    // Then: it exits before client construction with one generic, value-free error.
    assert.notEqual(result.exitCode, 0);
    assert.equal(result.stderr.trim(), "COMMUNITY_DATABASE_URL is required.");
    assert.equal(result.stdout, "");
    assert.equal(
      result.stderr.includes("database client reached"),
      false,
      "seed reached the database client instead of failing closed",
    );
    assert.equal(
      /postgres(?:ql)?:\/\//iu.test(`${result.stdout}\n${result.stderr}`),
      false,
      "seed output contained credential-shaped connection content",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("seed treats a blank database URL as missing configuration", async () => {
  // Given: a whitespace-only database URL and a no-network pg fake.
  const directory = await mkdtemp(path.join(tmpdir(), "player-release-preflight-"));
  try {
    const hookUrl = await createNoNetworkPgHook(directory);

    // When: the seed entry receives malformed blank configuration.
    const result = await runProcess(
      SEED_ENTRY,
      { node: ["--import", hookUrl], entry: [] },
      childEnvironment({
        COMMUNITY_DATABASE_URL: "   ",
        PREFLIGHT_FAIL_IF_CLIENT_REACHED: "1",
      }),
    );

    // Then: it uses the same value-free fail-closed contract.
    assert.notEqual(result.exitCode, 0);
    assert.equal(
      result.stderr.includes("COMMUNITY_DATABASE_URL is required."),
      true,
      "blank database configuration did not fail closed",
    );
    assert.equal(
      result.stderr.includes("database client reached"),
      false,
      "blank database configuration reached the client",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preflight rejects a fake provider sentinel without echoing it", async () => {
  // Given: a disposable artifact containing a credential-shaped fake sentinel.
  const directory = await mkdtemp(path.join(tmpdir(), "player-release-preflight-"));
  const sentinel = ["sk", "ant", "test", "x".repeat(32)].join("-");
  const artifactPath = path.join(directory, "unsafe-player.js");
  try {
    await writeFile(artifactPath, `globalThis.providerToken = ${JSON.stringify(sentinel)};\n`);

    // When: the release preflight scans the artifact.
    const result = await runProcess(
      PREFLIGHT_ENTRY,
      { node: [], entry: [artifactPath] },
      childEnvironment(),
    );
    const output = `${result.stdout}\n${result.stderr}`;

    // Then: it rejects the artifact while emitting counts, never the match.
    assert.equal(result.exitCode, 1);
    assert.equal(result.stderr, "");
    assert.equal(output.includes(sentinel), false, "preflight echoed the fake sentinel");
    assert.deepEqual(result.stdout.trim().split(/\r?\n/u), [
      "release-preflight unsafe=true total=1",
      "file=argument-1 rule=provider-key count=1",
      "release-prerequisite provider-rotation=required scope=llm-key,db-password authority=external",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preflight accepts the current public player artifacts with no findings", async () => {
  // Given: the default current build and installed public player artifact paths.
  // When: the release preflight scans its default targets.
  const result = await runProcess(
    PREFLIGHT_ENTRY,
    { node: [], entry: [] },
    childEnvironment(),
  );
  const output = `${result.stdout}\n${result.stderr}`;

  // Then: safe artifacts pass with zero findings; external provider rotation remains required.
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(result.stdout.trim().split(/\r?\n/u), [
    "release-preflight unsafe=false total=0",
    "release-prerequisite provider-rotation=required scope=llm-key,db-password authority=external",
  ]);
  assert.equal(
    /(?:sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,})/u.test(
      output,
    ),
    false,
    "preflight output exposed credential-shaped content",
  );
});

test("preflight fails closed for an unreadable input without an exception dump", async () => {
  // Given: a disposable path that does not exist.
  const directory = await mkdtemp(path.join(tmpdir(), "player-release-preflight-"));
  try {
    const missingPath = path.join(directory, "missing-player.js");

    // When: the preflight receives malformed input.
    const result = await runProcess(
      PREFLIGHT_ENTRY,
      { node: [], entry: [missingPath] },
      childEnvironment(),
    );

    // Then: it reports a redacted unreadable-input count and exits non-zero.
    assert.notEqual(result.exitCode, 0);
    assert.equal(result.stderr, "");
    assert.equal(
      result.stdout.includes("file=argument-1 rule=input-unreadable count=1"),
      true,
      "preflight did not fail closed for unreadable input",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
