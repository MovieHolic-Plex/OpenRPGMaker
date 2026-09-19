import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

const bun = process.env.OPRN_BUN_PATH?.trim()
  || (existsSync(join(homedir(), ".bun", "bin", "bun")) ? join(homedir(), ".bun", "bin", "bun") : "bun");
const bunAvailable = spawnSync(bun, ["--version"], { stdio: "ignore" }).status === 0;

describe("OMP login reuse", () => {
  it("adopts an existing OMP OAuth credential without a second login", { skip: !bunAvailable }, () => {
    const root = mkdtempSync(join(process.env.TMPDIR || "/tmp", "oprn-omp-auth-reuse-"));
    const agentDir = join(root, "agent");
    const seed = spawnSync(bun, ["-e", `
      import { SqliteAuthCredentialStore } from "@oh-my-pi/pi-ai/auth-storage";
      const store = await SqliteAuthCredentialStore.open();
      store.saveOAuth("google-antigravity", {
        access: "omp-test-access",
        refresh: "omp-test-refresh",
        expires: Date.now() + 60_000,
        projectId: "omp-test-project",
      });
      store.close();
    `], {
      cwd: process.cwd(),
      env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
      encoding: "utf8",
    });
    assert.equal(seed.status, 0, seed.stderr || seed.stdout);

    const child = spawnSync(process.execPath, [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      `
        const runtime = await import("./scripts/lib/aiAuthRuntime.ts");
        const status = runtime.publicProviderStatus("google-antigravity");
        const packed = await runtime.resolveRequestApiKey("google-antigravity");
        const wire = JSON.parse(String(packed));
        console.log(JSON.stringify({ status, wireProjectId: wire.projectId, hasToken: Boolean(wire.token) }));
      `,
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: root,
        PI_CODING_AGENT_DIR: agentDir,
        OPRN_BUN_PATH: bun,
        OPRN_DISABLE_OMP_AUTH_REUSE: undefined,
        OPRN_OH_MY_PI_AUTH_PATH: undefined,
      },
      encoding: "utf8",
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const line = child.stdout.trim().split(/\r?\n/u).filter(Boolean).pop();
    const result = JSON.parse(line);
    assert.equal(result.status.connected, true);
    assert.equal(result.wireProjectId, "omp-test-project");
    assert.equal(result.hasToken, true);

    const cache = JSON.parse(readFileSync(join(root, ".oprn", "oh-my-pi-auth.json"), "utf8"));
    assert.equal(cache.providers["google-antigravity"].source, "omp");
    rmSync(root, { recursive: true, force: true });
  });
});
