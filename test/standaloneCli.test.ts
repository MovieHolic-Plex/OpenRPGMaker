import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, rm, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { afterEach, expect, it } from "vitest";

const run = promisify(execFile);
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))); });

it("CLI rejects missing project media without writing an HTML artifact", async () => {
  await mkdir(".vite-cache", { recursive: true });
  const root = await mkdtemp(resolve(".vite-cache/standalone-cli-"));
  roots.push(root);
  const bundle = join(root, "dist/standalone-player");
  await mkdir(bundle, { recursive: true });
  await writeFile(join(bundle, "standalone.js"), "console.log('player')");
  await writeFile(join(bundle, "standalone.css"), "body{color:red}");
  const out = join(root, "game.html");
  const attempt = run(process.execPath, [
    resolve("node_modules/vite-node/vite-node.mjs"), "--config", resolve("vitest.config.ts"),
    resolve("scripts/build-standalone-html.mts"), "--out", out,
  ], { cwd: root, timeout: 60_000 });
  await expect(attempt).rejects.toMatchObject({ stderr: expect.stringContaining("assets/") });
  await expect(stat(out)).rejects.toMatchObject({ code: "ENOENT" });
}, 90_000);
