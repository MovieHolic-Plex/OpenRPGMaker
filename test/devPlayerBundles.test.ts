import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import type { ViteDevServer } from "vite";

const { spawn, writeManifest } = vi.hoisted(() => ({ spawn: vi.fn(), writeManifest: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn }));
vi.mock("../scripts/lib/playerDeploymentManifest.mjs", () => ({ writePlayerDeploymentManifest: writeManifest }));
import { devPlayerBundlesPlugin } from "../scripts/lib/devPlayerBundles";

const roots: string[] = [];
afterEach(async () => {
  vi.resetAllMocks();
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

it("shares an in-flight build, invalidates on source changes and never serves stale output after failure", async () => {
  await mkdir(".vite-cache", { recursive: true });
  const cacheDir = await mkdtemp(resolve(".vite-cache/dev-player-unit-"));
  roots.push(cacheDir);
  const watcher = new EventEmitter();
  let handler: (req: object, res: object, next: () => void) => void;
  const logger = { error: vi.fn() };
  const server = {
    config: { root: resolve("."), cacheDir, logger }, watcher,
    middlewares: { use: (middleware: typeof handler) => { handler = middleware; } },
  };
  const plugin = devPlayerBundlesPlugin();
  const configure = plugin.configureServer;
  if (typeof configure !== "function") throw new Error("Missing dev server hook");
  await configure.call({} as never, server as unknown as ViteDevServer);
  const request = (url: string) => new Promise<{ status: number; body: string }>((done) => {
    const res = { statusCode: 200, setHeader: vi.fn(), end: (body: Buffer | string) => done({ status: res.statusCode, body: body.toString() }) };
    handler({ url }, res, () => { throw new Error("Player request fell through to SPA"); });
  });

  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((done) => { entered = done; });
  const hold = new Promise<void>((done) => { release = done; });
  let content = "first";
  const environments: (string | undefined)[] = [];
  const parentEnvironment = process.env.NODE_ENV;
  spawn.mockImplementation((_command: string, args: string[], options: { env: NodeJS.ProcessEnv }) => {
    environments.push(options.env.NODE_ENV);
    const child = new EventEmitter();
    entered();
    void (async () => {
      await hold;
      const outDir = args[args.indexOf("--outDir") + 1]!;
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "standalone.js"), content);
    })().then(() => child.emit("close", 0), (error) => child.emit("error", error));
    return child;
  });
  writeManifest.mockImplementation(async ({ artifactRoot }) => {
    await writeFile(join(artifactRoot, "sdk-manifest.json"), JSON.stringify({ content }));
  });

  try {
    const first = request("/standalone-player/standalone.js");
    await started;
    const second = request("/export-player/sdk-manifest.json");
    expect(spawn).toHaveBeenCalledTimes(1);
    release();
    expect(await first).toEqual({ status: 200, body: "first" });
    expect(await second).toEqual({ status: 200, body: '{"content":"first"}' });
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(environments).toEqual(["production", "production"]);
    expect(process.env.NODE_ENV).toBe(parentEnvironment);
    expect(writeManifest).toHaveBeenCalledTimes(1);
    await request("/standalone-player/standalone.js");
    expect(spawn).toHaveBeenCalledTimes(2);

    content = "changed";
    watcher.emit("change", resolve("src/player/player.ts"));
    expect(await request("/standalone-player/standalone.js")).toEqual({ status: 200, body: "changed" });
    expect(spawn).toHaveBeenCalledTimes(4);

    watcher.emit("change", resolve("src/player/player.ts"));
    spawn.mockImplementationOnce(() => {
      const child = new EventEmitter();
      queueMicrotask(() => child.emit("error", new Error("compile failed")));
      return child;
    });
    expect(await request("/standalone-player/standalone.js")).toEqual({ status: 500, body: "Player export unavailable: compile failed" });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("compile failed"));
    expect(await request("/standalone-player/standalone.js")).toEqual({ status: 200, body: "changed" });
  } finally {
    release();
    if (typeof plugin.closeBundle === "function") await plugin.closeBundle.call({} as never);
  }
  expect(watcher.listenerCount("change")).toBe(0);
  expect(await readdir(cacheDir)).toEqual([]);
}, 15_000);
